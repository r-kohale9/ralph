#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ralph.sh — Automated game-building pipeline
#
# Usage: ./ralph.sh <game-dir> <spec-path>
#   game-dir:  Directory where index.html will be generated
#   spec-path: Path to the game's spec.md
#
# Environment variables (all optional, with sane defaults):
#   PROXY_URL           - CLIProxyAPI endpoint (default: http://localhost:8317)
#   PROXY_KEY           - API key for the proxy
#   RALPH_GEN_MODEL     - Model for HTML generation (default: claude-opus-4-6)
#   RALPH_TEST_MODEL    - Model for test generation (default: gemini-2.5-pro)
#   RALPH_FIX_MODEL     - Model for fix iterations (default: claude-sonnet-4-6)
#   RALPH_REVIEW_MODEL  - Model for review (default: gemini-2.5-pro)
#   RALPH_FALLBACK_MODEL- Overflow model (default: gpt-4.1)
#   RALPH_MAX_ITERATIONS- Max fix iterations (default: 5)
#   RALPH_MAX_VERIFY    - Max checklist verification iterations (default: 2)
#   RALPH_VERIFY_MODEL  - Model for verification (default: same as FIX_MODEL)
#   RALPH_WAREHOUSE_DIR - Path to warehouse directory (default: ./warehouse)
#   RALPH_LLM_TIMEOUT   - Timeout for LLM calls in seconds (default: 300)
#   RALPH_TEST_TIMEOUT   - Timeout for Playwright runs in seconds (default: 120)
#   RALPH_REPORT_DIR    - Directory for ralph-report.json (default: game-dir)
#   CORE_API_URL        - claude-core API URL (enables auto-publish when set with token)
#   CORE_API_TOKEN      - Bearer token for claude-core API
#   RALPH_PUBLISH_ENABLED - Force enable/disable publish (default: auto if URL+token set)
#   RALPH_GAME_VERSION  - Version string for published game (default: 1.0.0)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── macOS compatibility ─────────────────────────────────────────────────────
if ! command -v timeout &>/dev/null; then
  if command -v gtimeout &>/dev/null; then
    timeout() { gtimeout "$@"; }
  else
    echo "Error: 'timeout' not found. Install coreutils: brew install coreutils" >&2
    exit 1
  fi
fi

# ─── Arguments ───────────────────────────────────────────────────────────────
GAME_DIR="${1:?Usage: ralph.sh <game-dir> <spec-path>}"
SPEC_PATH="${2:?Usage: ralph.sh <game-dir> <spec-path>}"

# Resolve to absolute paths
GAME_DIR="$(cd "$(dirname "$GAME_DIR")" && pwd)/$(basename "$GAME_DIR")"
SPEC_PATH="$(cd "$(dirname "$SPEC_PATH")" && pwd)/$(basename "$SPEC_PATH")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Configuration ───────────────────────────────────────────────────────────
PROXY_URL="${PROXY_URL:-http://localhost:8317}"
PROXY_KEY="${PROXY_KEY:-ralph-local-dev-key}"

# Model assignments (T5: correct defaults — Opus for gen, Sonnet for fixes)
GEN_MODEL="${RALPH_GEN_MODEL:-claude-opus-4-6}"
TEST_MODEL="${RALPH_TEST_MODEL:-gemini-2.5-pro}"
FIX_MODEL="${RALPH_FIX_MODEL:-claude-opus-4-6}"
REVIEW_MODEL="${RALPH_REVIEW_MODEL:-gemini-2.5-pro}"
FALLBACK_MODEL="${RALPH_FALLBACK_MODEL:-gpt-4.1}"

MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-5}"
MAX_VERIFY="${RALPH_MAX_VERIFY:-2}"
VERIFY_MODEL="${RALPH_VERIFY_MODEL:-$FIX_MODEL}"
LLM_TIMEOUT="${RALPH_LLM_TIMEOUT:-300}"
TEST_TIMEOUT="${RALPH_TEST_TIMEOUT:-120}"
REPORT_DIR="${RALPH_REPORT_DIR:-$GAME_DIR}"

# ─── Derived paths ───────────────────────────────────────────────────────────
GAME_ID="$(basename "$(dirname "$SPEC_PATH")")"
LOG_FILE="$GAME_DIR/ralph.log"
REPORT_FILE="$REPORT_DIR/ralph-report.json"
HTML_FILE="$GAME_DIR/index.html"
TEST_FILE="$GAME_DIR/tests/game.spec.js"
SERVER_PID=""
START_TIME=$(date +%s)

# ─── Logging ─────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠ $*" | tee -a "$LOG_FILE" >&2; }
err()  { echo "[$(date '+%H:%M:%S')] ✗ $*" | tee -a "$LOG_FILE" >&2; }

# ─── Cleanup trap (T8) ──────────────────────────────────────────────────────
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$GAME_DIR"/.ralph-claude-output-*
}
trap cleanup EXIT INT TERM

# ─── Report state ────────────────────────────────────────────────────────────
REPORT_STATUS="FAILED"
REPORT_ITERATIONS=0
REPORT_GEN_TIME=0
REPORT_TEST_RESULTS="[]"
REPORT_REVIEW_RESULT=""
REPORT_ERRORS="[]"

write_report() {
  local END_TIME
  END_TIME=$(date +%s)
  local TOTAL_TIME=$(( END_TIME - START_TIME ))
  local ARTIFACTS
  ARTIFACTS=$([ -f "$HTML_FILE" ] && echo '["index.html"]' || echo '[]')

  # Load publish info if available
  local PUBLISH_INFO='{}'
  if [ -f "$GAME_DIR/publish-info.json" ]; then
    PUBLISH_INFO=$(cat "$GAME_DIR/publish-info.json")
  fi

  # Use jq to construct valid JSON (prevents injection from LLM output)
  jq -n \
    --arg game_id "$GAME_ID" \
    --arg spec "$SPEC_PATH" \
    --arg status "$REPORT_STATUS" \
    --argjson iterations "$REPORT_ITERATIONS" \
    --argjson gen_time "$REPORT_GEN_TIME" \
    --argjson total_time "$TOTAL_TIME" \
    --argjson test_results "$REPORT_TEST_RESULTS" \
    --arg review_result "$REPORT_REVIEW_RESULT" \
    --arg gen_model "$GEN_MODEL" \
    --arg test_model "$TEST_MODEL" \
    --arg fix_model "$FIX_MODEL" \
    --arg review_model "$REVIEW_MODEL" \
    --argjson artifacts "$ARTIFACTS" \
    --argjson errors "$REPORT_ERRORS" \
    --argjson publish "$PUBLISH_INFO" \
    --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    '{
      game_id: $game_id,
      spec: $spec,
      status: $status,
      iterations: $iterations,
      generation_time_s: $gen_time,
      total_time_s: $total_time,
      test_results: $test_results,
      review_result: $review_result,
      errors: $errors,
      models: {
        generation: $gen_model,
        test_gen: $test_model,
        fix: $fix_model,
        review: $review_model
      },
      artifacts: $artifacts,
      publish: $publish,
      timestamp: $timestamp
    }' > "$REPORT_FILE"
  log "Report written to $REPORT_FILE"
}

# ─── Provider-agnostic LLM call (T7: with timeout) ──────────────────────────
LLM_OUTPUT=""
MAX_LLM_RETRIES=3

call_llm() {
  local STEP_NAME="$1"
  local PROMPT="$2"
  local MODEL="${3:-$FIX_MODEL}"
  local TIMEOUT="${4:-$LLM_TIMEOUT}"
  local RETRY_COUNT="${5:-0}"

  log "  [$STEP_NAME] model=$MODEL timeout=${TIMEOUT}s ..."

  local RESPONSE
  RESPONSE=$(timeout "$TIMEOUT" curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
    -X POST "$PROXY_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $PROXY_KEY" \
    -d "$(jq -n \
      --arg model "$MODEL" \
      --arg prompt "$PROMPT" \
      '{
        model: $model,
        max_tokens: 128000,
        messages: [{ role: "user", content: $prompt }]
      }')") || {
    local EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 124 ]; then
      err "[$STEP_NAME] timed out after ${TIMEOUT}s"
    else
      err "[$STEP_NAME] curl failed with exit code $EXIT_CODE"
    fi
    LLM_OUTPUT=""
    return 1
  }

  local HTTP_CODE
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    # Handle both Claude format (.content[0].text) and OpenAI format (.choices[0].message.content)
    LLM_OUTPUT=$(echo "$BODY" | jq -r '
      .content[0].text //
      .choices[0].message.content //
      empty
    ')
    log "  ✓ [$STEP_NAME] completed"
    return 0
  elif [ "$HTTP_CODE" -eq 429 ]; then
    local NEXT_RETRY=$(( RETRY_COUNT + 1 ))
    if [ "$NEXT_RETRY" -gt "$MAX_LLM_RETRIES" ]; then
      err "[$STEP_NAME] rate limited — max retries ($MAX_LLM_RETRIES) exhausted"
      LLM_OUTPUT=""
      return 1
    fi
    local BACKOFF=$(( 30 * NEXT_RETRY ))
    warn "[$STEP_NAME] rate limited (HTTP 429) — retry $NEXT_RETRY/$MAX_LLM_RETRIES in ${BACKOFF}s"
    sleep "$BACKOFF"
    call_llm "$STEP_NAME" "$PROMPT" "$MODEL" "$TIMEOUT" "$NEXT_RETRY"
    return $?
  else
    err "[$STEP_NAME] proxy returned HTTP $HTTP_CODE"
    LLM_OUTPUT=""
    return 1
  fi
}

# ─── Spec checksum cache (E6) ────────────────────────────────────────────────
SPEC_CACHE_DIR="${RALPH_CACHE_DIR:-$HOME/.ralph-cache}"
ENABLE_CACHE="${RALPH_ENABLE_CACHE:-0}"

check_cache() {
  [ "$ENABLE_CACHE" != "1" ] && return 1

  mkdir -p "$SPEC_CACHE_DIR"
  local SPEC_HASH
  SPEC_HASH=$(sha256sum "$SPEC_PATH" | cut -d' ' -f1)
  local CACHE_FILE="$SPEC_CACHE_DIR/${GAME_ID}.sha256"
  local CACHED_HTML="$SPEC_CACHE_DIR/${GAME_ID}.html"

  if [ -f "$CACHE_FILE" ] && [ -f "$CACHED_HTML" ]; then
    local CACHED_HASH
    CACHED_HASH=$(cat "$CACHE_FILE")
    if [ "$SPEC_HASH" = "$CACHED_HASH" ]; then
      log "  ✓ Cache hit — spec unchanged, reusing cached artifact"
      cp "$CACHED_HTML" "$HTML_FILE"
      return 0
    fi
  fi
  return 1
}

update_cache() {
  [ "$ENABLE_CACHE" != "1" ] && return 0

  mkdir -p "$SPEC_CACHE_DIR"
  sha256sum "$SPEC_PATH" | cut -d' ' -f1 > "$SPEC_CACHE_DIR/${GAME_ID}.sha256"
  if [ -f "$HTML_FILE" ]; then
    cp "$HTML_FILE" "$SPEC_CACHE_DIR/${GAME_ID}.html"
  fi
}

# ─── Warehouse spec validation (E9) ─────────────────────────────────────────
WAREHOUSE_DIR="${RALPH_WAREHOUSE_DIR:-}"

validate_spec_against_warehouse() {
  [ -z "$WAREHOUSE_DIR" ] && return 0  # Skip if no warehouse configured

  log "Validating spec against warehouse schemas..."

  # Check for referenced parts in spec
  local MISSING_PARTS=""
  local PARTS_DIR="$WAREHOUSE_DIR/parts"

  if [ -d "$PARTS_DIR" ]; then
    # Extract part references from spec (e.g., {{part:timer}}, {{part:scoring}})
    local REFS
    REFS=$(grep -oP '\{\{part:([^}]+)\}\}' "$SPEC_PATH" 2>/dev/null | sed 's/{{part://;s/}}//' || true)

    for ref in $REFS; do
      if [ ! -f "$PARTS_DIR/$ref.md" ] && [ ! -f "$PARTS_DIR/$ref.json" ]; then
        MISSING_PARTS="$MISSING_PARTS $ref"
      fi
    done
  fi

  if [ -n "$MISSING_PARTS" ]; then
    err "Spec references missing warehouse parts:$MISSING_PARTS"
    return 1
  fi

  # Validate spec has required metadata for warehouse integration
  if ! grep -q "^## 1\." "$SPEC_PATH" 2>/dev/null; then
    warn "Spec missing section 1 header (warehouse convention)"
  fi

  log "  ✓ Warehouse validation passed"
  return 0
}

# ─── Spec validation (T9) ───────────────────────────────────────────────────
validate_spec() {
  log "Validating spec structure..."

  if [ ! -f "$SPEC_PATH" ]; then
    err "Spec file not found: $SPEC_PATH"
    return 1
  fi

  local SPEC_SIZE
  SPEC_SIZE=$(wc -c < "$SPEC_PATH")
  if [ "$SPEC_SIZE" -lt 500 ]; then
    err "Spec file too small (${SPEC_SIZE} bytes) — likely truncated"
    return 1
  fi

  # Check for expected section markers (13-section template)
  local MISSING_SECTIONS=""
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13; do
    if ! grep -q "^## ${i}\." "$SPEC_PATH" 2>/dev/null && \
       ! grep -q "^## Section ${i}" "$SPEC_PATH" 2>/dev/null && \
       ! grep -q "^##.*${i}\." "$SPEC_PATH" 2>/dev/null; then
      MISSING_SECTIONS="$MISSING_SECTIONS $i"
    fi
  done

  if [ -n "$MISSING_SECTIONS" ]; then
    warn "Spec may be missing sections:$MISSING_SECTIONS (non-fatal, continuing)"
  fi

  log "  ✓ Spec validation passed"
  return 0
}

# ─── Static validation (T1) ─────────────────────────────────────────────────
run_static_validation() {
  log "Running static validation..."

  if [ ! -f "$HTML_FILE" ]; then
    err "HTML file not found: $HTML_FILE"
    return 1
  fi

  # Run the Node.js static validator (T1)
  if [ -f "$SCRIPT_DIR/lib/validate-static.js" ]; then
    if ! node "$SCRIPT_DIR/lib/validate-static.js" "$HTML_FILE" 2>>"$LOG_FILE"; then
      err "Static validation failed"
      return 1
    fi
    log "  ✓ Static validation passed"
  else
    warn "Static validator not found, skipping"
  fi

  # Run contract validation (T2)
  if [ -f "$SCRIPT_DIR/lib/validate-contract.js" ]; then
    if ! node "$SCRIPT_DIR/lib/validate-contract.js" "$HTML_FILE" 2>>"$LOG_FILE"; then
      warn "Contract validation found issues (non-blocking)"
    else
      log "  ✓ Contract validation passed"
    fi
  fi

  return 0
}

# ─── Web server lifecycle (T3) ──────────────────────────────────────────────
start_server() {
  log "Starting local server on port 8787..."
  npx -y serve "$GAME_DIR" -l 8787 -s --no-clipboard 2>>"$LOG_FILE" &
  SERVER_PID=$!
  sleep 2

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    err "Server failed to start"
    SERVER_PID=""
    return 1
  fi

  log "  ✓ Server started (PID $SERVER_PID)"
  return 0
}

stop_server() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    log "  ✓ Server stopped"
  fi
  SERVER_PID=""
}

# ─── Extract HTML from LLM output ───────────────────────────────────────────
extract_html() {
  local OUTPUT="$1"
  local EXTRACTED

  # Strategy 1: Find the LARGEST ```html...``` code block
  EXTRACTED=$(echo "$OUTPUT" | awk '
    /^```html/ { capture=1; current=""; next }
    /^```/ && capture {
      if (length(current) > length(best)) best=current
      capture=0; next
    }
    capture { current = current (current ? "\n" : "") $0 }
    END {
      # If last block was never closed (token limit), use it if its the largest
      if (capture && length(current) > length(best)) best=current
      print best
    }
  ')
  if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q '<!DOCTYPE\|<html\|<head'; then
    echo "$EXTRACTED"
    return 0
  fi

  # Strategy 2: Find the largest generic code block containing HTML
  EXTRACTED=$(echo "$OUTPUT" | awk '
    /^```/ && !capture { capture=1; current=""; next }
    /^```/ && capture {
      if (length(current) > length(best) && current ~ /<!DOCTYPE|<html|<head/) best=current
      capture=0; next
    }
    capture { current = current (current ? "\n" : "") $0 }
    END {
      if (capture && length(current) > length(best) && current ~ /<!DOCTYPE|<html|<head/) best=current
      print best
    }
  ')
  if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q '<!DOCTYPE\|<html\|<head'; then
    echo "$EXTRACTED"
    return 0
  fi

  # Strategy 3: Strip everything before <!DOCTYPE (LLM may have prose before raw HTML)
  EXTRACTED=$(echo "$OUTPUT" | awk '/<!DOCTYPE/{found=1} found{print}')
  if [ -n "$EXTRACTED" ] && [ "$(echo "$EXTRACTED" | wc -c)" -gt 1000 ]; then
    echo "$EXTRACTED"
    return 0
  fi

  return 1
}

# ─── Extract test code from LLM output ──────────────────────────────────────
extract_tests() {
  local OUTPUT="$1"
  local EXTRACTED
  # Try javascript code block
  EXTRACTED=$(echo "$OUTPUT" | sed -n '/```javascript/,/```/p' | sed '1d;$d')
  if [ -n "$EXTRACTED" ]; then
    echo "$EXTRACTED"
    return 0
  fi
  # Try js code block
  EXTRACTED=$(echo "$OUTPUT" | sed -n '/```js/,/```/p' | sed '1d;$d')
  if [ -n "$EXTRACTED" ]; then
    echo "$EXTRACTED"
    return 0
  fi
  # Try generic code block
  EXTRACTED=$(echo "$OUTPUT" | sed -n '/```/,/```/p' | sed '1d;$d')
  if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q 'test\|expect\|describe'; then
    echo "$EXTRACTED"
    return 0
  fi
  return 1
}

# ═════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

log "═══════════════════════════════════════════════════════════"
log "Ralph Pipeline — $GAME_ID"
log "═══════════════════════════════════════════════════════════"
log "Game dir: $GAME_DIR"
log "Spec:     $SPEC_PATH"
log "Models:   gen=$GEN_MODEL test=$TEST_MODEL fix=$FIX_MODEL review=$REVIEW_MODEL"

# Create directories
mkdir -p "$GAME_DIR/tests" "$REPORT_DIR"

# ─── Step 0: Validate spec (T9) ─────────────────────────────────────────────
validate_spec || {
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["Spec validation failed"]'
  write_report
  exit 1
}

# ─── Step 0b: Warehouse validation (E9) ─────────────────────────────────────
validate_spec_against_warehouse || {
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["Spec references missing warehouse parts"]'
  write_report
  exit 1
}

# Read spec content
SPEC_CONTENT=$(cat "$SPEC_PATH")

# ─── Step 0c: Cache check (E6) ──────────────────────────────────────────────
CACHE_HIT=0
if check_cache; then
  CACHE_HIT=1
  log "Skipping generation — using cached artifact"
fi

# ─── Step 1: Generate HTML ──────────────────────────────────────────────────
log ""
log "Step 1: Generate HTML"
GEN_START=$(date +%s)

if [ "$CACHE_HIT" -eq 0 ]; then
  GEN_PROMPT="You are an expert HTML game assembler. The following specification is a self-contained assembly book — it contains ALL code blocks, element IDs, function signatures, CSS, game logic, and verification checks needed to produce a working game.

INSTRUCTIONS:
- Follow the specification EXACTLY — do not invent new element IDs, function names, or game logic
- Assemble all sections into a single index.html file (all CSS in <style>, all JS in <script>)
- Copy code blocks from the spec verbatim, filling in only where placeholders exist
- Use the element IDs, class names, and function signatures defined in the spec
- Use the star calculation logic defined in the spec (Section 11 or Parts table), not a generic formula
- The spec's Section 15 (Verification Checklist) lists every requirement — ensure all items pass
- Output ONLY the complete HTML file content, wrapped in a \`\`\`html code block

SPECIFICATION:
$SPEC_CONTENT"

  call_llm "generate-html" "$GEN_PROMPT" "$GEN_MODEL" || {
    err "HTML generation failed"
    REPORT_STATUS="FAILED"
    REPORT_ERRORS='["HTML generation LLM call failed"]'
    write_report
    exit 1
  }

  GEN_END=$(date +%s)
  REPORT_GEN_TIME=$(( GEN_END - GEN_START ))

  # Extract and save HTML
  EXTRACTED_HTML=$(extract_html "$LLM_OUTPUT") || {
    err "Could not extract HTML from LLM output"
    REPORT_STATUS="FAILED"
    REPORT_ERRORS='["Could not extract HTML from generation output"]'
    write_report
    exit 1
  }

  printf '%s\n' "$EXTRACTED_HTML" > "$HTML_FILE"
  log "  ✓ HTML saved to $HTML_FILE ($(wc -c < "$HTML_FILE") bytes)"
else
  GEN_END=$(date +%s)
  REPORT_GEN_TIME=$(( GEN_END - GEN_START ))
  log "  ✓ Using cached HTML ($(wc -c < "$HTML_FILE") bytes)"
fi

# ─── Step 1a: Generate inputSchema.json ─────────────────────────────────────
log ""
log "Step 1a: Generate inputSchema.json"
INPUT_SCHEMA_FILE="$GAME_DIR/inputSchema.json"

SCHEMA_PROMPT="Analyze the following HTML game and its specification. Generate an inputSchema (JSON Schema draft-07) that describes the EXACT content structure the game expects via postMessage game_init.

IMPORTANT: Look at BOTH:
1. The handlePostMessage / game_init handler — what fields does it read from event.data.data.content?
2. The fallbackContent object — this IS the canonical content shape the game expects.

The schema must match the structure of fallbackContent exactly. Every top-level field in fallbackContent must appear as a required property. For arrays, describe the item schema based on the actual objects in the fallback data.

Output ONLY valid JSON (no markdown, no code blocks, no explanation).

HTML:
$(cat "$HTML_FILE")

SPECIFICATION:
$SPEC_CONTENT"

if call_llm "generate-schema" "$SCHEMA_PROMPT" "$REVIEW_MODEL" 120 2>/dev/null; then
  # Try to extract valid JSON from the output
  SCHEMA_JSON=$(echo "$LLM_OUTPUT" | sed -n '/^{/,/^}/p' | head -200)
  if [ -z "$SCHEMA_JSON" ]; then
    SCHEMA_JSON=$(echo "$LLM_OUTPUT" | sed -n '/\`\`\`json/,/\`\`\`/p' | sed '1d;$d')
  fi
  if [ -z "$SCHEMA_JSON" ]; then
    SCHEMA_JSON="$LLM_OUTPUT"
  fi

  if echo "$SCHEMA_JSON" | jq '.' > /dev/null 2>&1; then
    echo "$SCHEMA_JSON" | jq '.' > "$INPUT_SCHEMA_FILE"
    log "  ✓ inputSchema.json generated"
  else
    warn "  LLM produced invalid JSON for inputSchema — will infer from fallback content"
    INPUT_SCHEMA_FILE=""
  fi
else
  warn "  inputSchema generation failed — will infer from fallback content"
  INPUT_SCHEMA_FILE=""
fi

# ─── Step 1b: Static validation (T1) ────────────────────────────────────────
log ""
log "Step 1b: Static validation"
STATIC_ATTEMPTS=0
MAX_STATIC_ATTEMPTS=2

while ! run_static_validation; do
  STATIC_ATTEMPTS=$(( STATIC_ATTEMPTS + 1 ))
  if [ "$STATIC_ATTEMPTS" -ge "$MAX_STATIC_ATTEMPTS" ]; then
    warn "Static validation failed after $STATIC_ATTEMPTS attempts, proceeding to functional tests"
    break
  fi

  log "  Attempting static fix (attempt $STATIC_ATTEMPTS)..."
  STATIC_ERRORS=$(node "$SCRIPT_DIR/lib/validate-static.js" "$HTML_FILE" 2>&1 || true)

  STATIC_FIX_PROMPT="The following HTML game file has structural issues that need fixing.

ERRORS:
$STATIC_ERRORS

CURRENT HTML:
$(cat "$HTML_FILE")

SPECIFICATION (for reference — use exact element IDs, function names, and structure from this spec):
$SPEC_CONTENT

Fix ALL the listed structural issues while keeping the game aligned with the specification. Output the complete corrected HTML wrapped in a \`\`\`html code block."

  call_llm "static-fix-$STATIC_ATTEMPTS" "$STATIC_FIX_PROMPT" "$FIX_MODEL" || break
  FIXED_HTML=$(extract_html "$LLM_OUTPUT") || break
  printf '%s\n' "$FIXED_HTML" > "$HTML_FILE"
done

# ─── Step 1c: Checklist verification (general + game-specific) ──────────────
log ""
log "Step 1c: Checklist verification (max $MAX_VERIFY iterations)"

WAREHOUSE_DIR="${RALPH_WAREHOUSE_DIR:-$SCRIPT_DIR/warehouse}"
CHECKLIST_FILE="$WAREHOUSE_DIR/verification-checklist.md"
GAME_CHECKLIST="$GAME_DIR/game-checklist.md"

if [ -f "$CHECKLIST_FILE" ]; then
  CHECKLIST_CONTENT=$(cat "$CHECKLIST_FILE")
  HTML_CONTENT_FOR_VERIFY=$(cat "$HTML_FILE")
  VERIFY_ITER=0
  VERIFIED=false

  while [ "$VERIFY_ITER" -lt "$MAX_VERIFY" ]; do
    VERIFY_ITER=$(( VERIFY_ITER + 1 ))
    log "  ── Verification $VERIFY_ITER / $MAX_VERIFY ──"

    # Include inputSchema in verification if it was generated
    INPUT_SCHEMA_FOR_VERIFY=""
    if [ -n "$INPUT_SCHEMA_FILE" ] && [ -f "$INPUT_SCHEMA_FILE" ]; then
      INPUT_SCHEMA_FOR_VERIFY="
### inputSchema.json (must match fallbackContent structure):
$(cat "$INPUT_SCHEMA_FILE")"
    fi

    VERIFY_PROMPT="You are verifying a generated MathAI game HTML. Check BOTH a general platform checklist AND game-specific logic in a single pass.

## FILES

### Generated HTML:
$HTML_CONTENT_FOR_VERIFY

### Game Specification:
$SPEC_CONTENT

### General Verification Checklist:
$CHECKLIST_CONTENT
$INPUT_SCHEMA_FOR_VERIFY

## PART A: General Platform Checklist

Go through EVERY item in the general checklist. For each item:
- If the feature is not used in this game, mark it SKIP
- If the code is correct, mark it PASS
- If the code is wrong or missing, mark it FAIL with the exact issue

The most common issues are:
- sound.register() instead of sound.preload([{id,url}])
- Missing await on sound.play() before screen transitions
- sound.stopAll() instead of sound.pause() in VisibilityTracker
- Timer pause/resume without { fromVisibilityTracker: true } flag
- Timer container ID mismatch
- onComplete callback on sound.play() (doesn't exist)
- Audio URLs from spec not included in preload array
- Missing sticker objects in sound.play() calls
- Missing Sentry integration (SentryConfig package + SDK)
- Missing playDynamicFeedback for end-game TTS

## PART B: inputSchema Verification

If an inputSchema.json is provided above, verify:
- Every top-level required property in the schema exists in the game's fallbackContent
- The types match (string, number, array, object)
- Array item schemas match the actual objects in fallbackContent arrays
- The schema does NOT require fields that fallbackContent doesn't have
If the schema is wrong, include the corrected schema in your output as a \`\`\`json code block labelled INPUT_SCHEMA_FIX.

## PART C: Game-Specific Logic

Analyze the spec to understand THIS game's specific mechanics, then verify the HTML implements them correctly:
- Game Mechanics — Are the core interactions wired up as the spec describes?
- Round / Question Logic — Does round data load correctly? Is answer validation correct?
- UI / Layout — Do game-specific UI elements exist and match the spec?
- Scoring & Progression — Is scoring logic correct?
- Edge Cases — What happens on timeout? Empty input? All-wrong? All-correct? Last round?

Generate 15-30 game-specific checklist items and verify each one.

## OUTPUT

First, output the game-specific checklist items you verified.

Then output your combined result in this EXACT format:

CHECKLIST_RESULT: PASS
(if ALL general items are PASS/SKIP AND all game-specific items are PASS)

OR

CHECKLIST_RESULT: FAIL
ISSUES:
- <what is wrong> → <what it should be>

Then output the COMPLETE FIXED HTML wrapped in a \`\`\`html code block (only if there are issues to fix)."

    call_llm "verify-$VERIFY_ITER" "$VERIFY_PROMPT" "$VERIFY_MODEL" || {
      warn "  Verification attempt $VERIFY_ITER failed, continuing..."
      continue
    }

    # Extract fixed inputSchema if present (Part B fix)
    SCHEMA_FIX=$(echo "$LLM_OUTPUT" | awk '/INPUT_SCHEMA_FIX/,0' | sed -n '/```json/,/```/p' | sed '1d;$d')
    if [ -n "$SCHEMA_FIX" ] && echo "$SCHEMA_FIX" | jq '.' > /dev/null 2>&1; then
      echo "$SCHEMA_FIX" | jq '.' > "$GAME_DIR/inputSchema.json"
      INPUT_SCHEMA_FILE="$GAME_DIR/inputSchema.json"
      log "  ✓ inputSchema.json updated from verification"
    fi

    if echo "$LLM_OUTPUT" | grep -q "CHECKLIST_RESULT: PASS"; then
      log "  ✓ Verification passed on iteration $VERIFY_ITER"
      # Save game-specific checklist for test generation context
      echo "$LLM_OUTPUT" | sed -n '1,/CHECKLIST_RESULT/p' > "$GAME_CHECKLIST" 2>/dev/null || true
      VERIFIED=true
      break
    else
      log "  ✗ Verification found issues, applying fixes..."
      # Extract fixed HTML if present
      FIXED_HTML=$(extract_html "$LLM_OUTPUT") || true
      if [ -n "$FIXED_HTML" ]; then
        printf '%s\n' "$FIXED_HTML" > "$HTML_FILE"
        HTML_CONTENT_FOR_VERIFY=$(cat "$HTML_FILE")
        log "  ✓ HTML updated ($(wc -c < "$HTML_FILE") bytes)"
      else
        warn "  No fixed HTML in output, re-verifying with same HTML"
      fi
      # Save game-specific checklist
      echo "$LLM_OUTPUT" | sed -n '1,/CHECKLIST_RESULT/p' > "$GAME_CHECKLIST" 2>/dev/null || true
    fi
  done

  if [ "$VERIFIED" = false ]; then
    warn "Verification loop exhausted after $MAX_VERIFY iterations — proceeding to tests"
  fi
else
  warn "Checklist file not found at $CHECKLIST_FILE — skipping verification"
fi

# ─── Step 2: Generate tests ─────────────────────────────────────────────────
log ""
log "Step 2: Generate Playwright tests"

HTML_CONTENT=$(cat "$HTML_FILE")
TEST_PROMPT="You are an expert Playwright test writer. Generate a Playwright test suite for the following HTML game.

The SPECIFICATION contains a 'Test Scenarios' section (Section 14) with exact test scenarios including specific selectors, user actions, and assertions. Use these as the PRIMARY source for your tests. Translate each scenario into one or more Playwright test cases.

Additionally, include these structural tests:
1. postMessage validation — verify gameOver event contains: type, score (number), stars (0-3), total (number >= 1)
2. Game state initialization — gameState object has required fields per Section 3
3. Responsive layout — fits within 480px width

IMPORTANT:
- Use \`@playwright/test\` imports
- Base URL is http://localhost:8787
- Tests run against index.html served at the root
- Use page.goto('/') to load the game
- Wait for game initialization before testing
- Use the EXACT element selectors from the specification and HTML, not invented ones
- Output ONLY the test code wrapped in a \`\`\`javascript code block

SPECIFICATION:
$SPEC_CONTENT

HTML:
$HTML_CONTENT"

call_llm "generate-tests" "$TEST_PROMPT" "$TEST_MODEL" || {
  err "Test generation failed"
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["Test generation LLM call failed"]'
  write_report
  exit 1
}

EXTRACTED_TESTS=$(extract_tests "$LLM_OUTPUT") || {
  err "Could not extract tests from LLM output"
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["Could not extract tests from generation output"]'
  write_report
  exit 1
}

printf '%s\n' "$EXTRACTED_TESTS" > "$TEST_FILE"
log "  ✓ Tests saved to $TEST_FILE"

# Copy Playwright config into game dir for test execution
if [ -f "$SCRIPT_DIR/playwright.config.js" ]; then
  cp "$SCRIPT_DIR/playwright.config.js" "$GAME_DIR/playwright.config.js"
else
  err "playwright.config.js not found at $SCRIPT_DIR — tests will fail"
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["playwright.config.js not found"]'
  write_report
  exit 1
fi

# ─── Step 3: Test → Fix loop ────────────────────────────────────────────────
log ""
log "Step 3: Test → Fix loop (max $MAX_ITERATIONS iterations)"

# Start web server (T3)
start_server || {
  err "Could not start web server"
  REPORT_STATUS="FAILED"
  REPORT_ERRORS='["Web server failed to start"]'
  write_report
  exit 1
}

ITERATION=0
ALL_TEST_RESULTS="["
FIX_HISTORY=""

while [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
  ITERATION=$(( ITERATION + 1 ))
  REPORT_ITERATIONS=$ITERATION
  log ""
  log "  ── Iteration $ITERATION / $MAX_ITERATIONS ──"

  # Run Playwright tests (T7: with timeout)
  log "  Running Playwright tests..."
  TEST_OUTPUT=""
  TEST_EXIT_CODE=0

  TEST_OUTPUT=$(timeout "$TEST_TIMEOUT" npx playwright test \
    --config "$GAME_DIR/playwright.config.js" \
    --reporter=json 2>&1) || TEST_EXIT_CODE=$?

  if [ "$TEST_EXIT_CODE" -eq 124 ]; then
    err "  Playwright timed out after ${TEST_TIMEOUT}s"
    TEST_OUTPUT='{"suites":[],"stats":{"expected":0,"unexpected":1,"flaky":0}}'
  fi

  # Parse test results
  PASSED=$(echo "$TEST_OUTPUT" | jq -r '.stats.expected // 0' 2>/dev/null || echo "0")
  FAILED=$(echo "$TEST_OUTPUT" | jq -r '.stats.unexpected // 0' 2>/dev/null || echo "0")
  FAILURES_DESC=$(echo "$TEST_OUTPUT" | jq -r '[.suites[]?.specs[]? | select(.ok == false) | .title] | join(", ")' 2>/dev/null || echo "unknown")

  log "  Results: $PASSED passed, $FAILED failed"

  # Build test result entry (use jq for safe JSON construction)
  TEST_ENTRY=$(jq -n \
    --argjson iteration "$ITERATION" \
    --argjson passed "$PASSED" \
    --argjson failed "$FAILED" \
    --arg failures "$FAILURES_DESC" \
    '{iteration: $iteration, passed: $passed, failed: $failed, failures: $failures}')
  if [ "$ITERATION" -gt 1 ]; then
    ALL_TEST_RESULTS="$ALL_TEST_RESULTS,$TEST_ENTRY"
  else
    ALL_TEST_RESULTS="$ALL_TEST_RESULTS$TEST_ENTRY"
  fi

  # All tests pass → proceed to review
  if [ "$FAILED" -eq 0 ] && [ "$PASSED" -gt 0 ]; then
    log "  ✓ All tests pass!"
    break
  fi

  # Tests failed — attempt fix
  if [ "$ITERATION" -ge "$MAX_ITERATIONS" ]; then
    err "  Max iterations reached ($MAX_ITERATIONS)"
    break
  fi

  log "  Attempting fix..."

  # Smart retry escalation (E2): escalate strategy on iteration 3+
  if [ "$ITERATION" -ge 3 ]; then
    FIX_STRATEGY="DIAGNOSIS MODE: This is attempt $ITERATION. Previous fixes have not resolved all issues.

Previous fix history:
$FIX_HISTORY

Please diagnose the ROOT CAUSE of the persistent failures before attempting a fix. Explain what's fundamentally wrong, then fix it."
  else
    FIX_STRATEGY="Fix the failing tests by modifying the HTML. Do NOT modify the tests."
  fi

  # E8: Diff-based fix prompts — send only relevant sections instead of full context
  # when the HTML is large and failures are localized
  HTML_SIZE=$(wc -c < "$HTML_FILE")
  if [ "$HTML_SIZE" -gt 20000 ] && [ "$ITERATION" -ge 2 ]; then
    # Extract only the <script> section for focused fix
    SCRIPT_SECTION=$(sed -n '/<script>/,/<\/script>/p' "$HTML_FILE")
    CONTEXT_HTML="[HTML truncated for focus — showing <script> section only]

$SCRIPT_SECTION

[Full HTML is ${HTML_SIZE} bytes. Only the script section is shown above to focus on logic fixes.]"
    log "  (E8: Using diff-based prompt — ${HTML_SIZE} bytes → script section only)"
  else
    CONTEXT_HTML="$(cat "$HTML_FILE")"
  fi

  FIX_PROMPT="The following HTML game has test failures that need fixing.

$FIX_STRATEGY

FAILING TESTS:
$FAILURES_DESC

TEST OUTPUT (summary):
$(echo "$TEST_OUTPUT" | head -100)

CURRENT HTML:
$CONTEXT_HTML

SPECIFICATION (for reference — use Section 8 for exact function signatures, Section 15 for verification):
$SPEC_CONTENT

IMPORTANT:
- Fix the HTML to make the failing tests pass
- Use the EXACT element IDs, function names, and logic from the specification
- Do NOT rename functions, change selectors, or alter game logic — match the spec
- Output the complete fixed HTML wrapped in a \`\`\`html code block"

  # Track fix history for smart retry
  FIX_HISTORY="$FIX_HISTORY
Iteration $ITERATION: $FAILED failures — $FAILURES_DESC"

  call_llm "fix-iteration-$ITERATION" "$FIX_PROMPT" "$FIX_MODEL" || {
    warn "  Fix LLM call failed, trying fallback model"
    call_llm "fix-fallback-$ITERATION" "$FIX_PROMPT" "$FALLBACK_MODEL" || {
      err "  Both fix models failed"
      continue
    }
  }

  FIXED_HTML=$(extract_html "$LLM_OUTPUT") || {
    warn "  Could not extract HTML from fix output"
    continue
  }

  printf '%s\n' "$FIXED_HTML" > "$HTML_FILE"
  log "  ✓ HTML updated ($(wc -c < "$HTML_FILE") bytes)"
done

ALL_TEST_RESULTS="$ALL_TEST_RESULTS]"
REPORT_TEST_RESULTS="$ALL_TEST_RESULTS"

# Stop web server
stop_server

# ─── Step 4: Review ─────────────────────────────────────────────────────────
log ""
log "Step 4: Review"

# Only review if tests passed
if [ "$FAILED" -gt 0 ] || [ "$PASSED" -eq 0 ]; then
  err "Tests did not pass — skipping review"
  REPORT_STATUS="FAILED"
  REPORT_REVIEW_RESULT="SKIPPED"
  write_report
  exit 1
fi

REVIEW_CHECKLIST=""
if [ -f "$CHECKLIST_FILE" ]; then
  REVIEW_CHECKLIST="

PLATFORM VERIFICATION CHECKLIST (check every item):
$(cat "$CHECKLIST_FILE")"
fi

REVIEW_GAME_CHECKLIST=""
if [ -f "$GAME_CHECKLIST" ]; then
  REVIEW_GAME_CHECKLIST="

GAME-SPECIFIC CHECKLIST (generated during verification):
$(cat "$GAME_CHECKLIST")"
fi

REVIEW_PROMPT="You are a game quality reviewer. Review the following HTML game against its specification AND the platform verification checklist.

Review in this order:
1. Walk through the PLATFORM VERIFICATION CHECKLIST — verify every item passes in the HTML
2. Walk through the spec's Section 15 (Verification Checklist) — verify every item
3. Walk through the GAME-SPECIFIC CHECKLIST (if provided) — verify every item
4. Check for anti-patterns: sound.register(), sound.stopAll() in visibility, new Audio(), missing stickers, missing Sentry

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
$SPEC_CONTENT
$REVIEW_CHECKLIST
$REVIEW_GAME_CHECKLIST

HTML:
$(cat "$HTML_FILE")"

call_llm "review" "$REVIEW_PROMPT" "$REVIEW_MODEL" || {
  warn "Review LLM call failed — treating as approved (tests passed)"
  REPORT_STATUS="APPROVED"
  REPORT_REVIEW_RESULT="SKIPPED_LLM_FAILURE"
  write_report
  exit 0
}

REVIEW_RESULT="$LLM_OUTPUT"
REPORT_REVIEW_RESULT="$REVIEW_RESULT"

if echo "$REVIEW_RESULT" | grep -qi "^APPROVED"; then
  log "  ✓ APPROVED by review"
  REPORT_STATUS="APPROVED"

  # ─── Step 5: Post-approval tasks ─────────────────────────────────────────
  log ""
  log "Step 5: Post-approval tasks"

  # E6: Update cache after successful build
  update_cache

  # ─── Step 6: Publish to claude-core ─────────────────────────────────────
  CORE_API_URL="${CORE_API_URL:-}"
  CORE_API_TOKEN="${CORE_API_TOKEN:-}"
  PUBLISH_ENABLED="${RALPH_PUBLISH_ENABLED:-0}"

  # Auto-enable publish if CORE_API_URL and CORE_API_TOKEN are set
  if [ -n "$CORE_API_URL" ] && [ -n "$CORE_API_TOKEN" ]; then
    PUBLISH_ENABLED="1"
  fi

  PUBLISH_GAME_ID=""
  PUBLISH_GAME_LINK=""
  PUBLISH_CONTENT_SETS="[]"

  if [ "$PUBLISH_ENABLED" = "1" ] && [ -n "$CORE_API_URL" ] && [ -n "$CORE_API_TOKEN" ]; then
    log ""
    log "Step 6: Publish to claude-core"

    # Read metadata from spec
    GAME_TITLE=$(grep -m1 '^# ' "$SPEC_PATH" | sed 's/^# //' || echo "$GAME_ID")
    GAME_DESC=$(grep -i 'description\|overview' "$SPEC_PATH" | head -1 | sed 's/.*[:\s]*//' || echo "$GAME_ID game")
    GAME_NAME=$(echo "$GAME_ID" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')
    GAME_VERSION="${RALPH_GAME_VERSION:-1.0.0}"

    # Read inputSchema
    INPUT_SCHEMA='{}'
    if [ -n "$INPUT_SCHEMA_FILE" ] && [ -f "$INPUT_SCHEMA_FILE" ]; then
      INPUT_SCHEMA=$(cat "$INPUT_SCHEMA_FILE")
    fi

    # Build register payload
    REGISTER_PAYLOAD=$(jq -n \
      --arg name "$GAME_NAME" \
      --arg version "$GAME_VERSION" \
      --arg title "$GAME_TITLE" \
      --arg desc "$GAME_DESC" \
      --argjson inputSchema "$INPUT_SCHEMA" \
      --arg artifactContent "$(cat "$HTML_FILE")" \
      '{
        name: $name,
        version: $version,
        metadata: {
          title: $title,
          description: $desc,
          concepts: [],
          difficulty: "medium",
          estimatedTime: 300,
          minGrade: 1,
          maxGrade: 12,
          type: "practice"
        },
        capabilities: {
          tracks: ["accuracy", "time", "stars"],
          provides: ["score", "stars"]
        },
        inputSchema: $inputSchema,
        artifactContent: $artifactContent,
        publishedBy: "ralph-pipeline"
      }')

    log "  Registering game with claude-core..."
    REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 60 \
      -X POST "$CORE_API_URL/api/games/register" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CORE_API_TOKEN" \
      -d "$REGISTER_PAYLOAD") || {
      warn "  Failed to connect to claude-core API"
    }

    REG_HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -1)
    REG_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')

    if [ "$REG_HTTP_CODE" = "201" ] || [ "$REG_HTTP_CODE" = "200" ]; then
      PUBLISH_GAME_ID=$(echo "$REG_BODY" | jq -r '.data.id // empty')
      ARTIFACT_URL=$(echo "$REG_BODY" | jq -r '.data.artifactUrl // empty')
      log "  ✓ Game registered: $PUBLISH_GAME_ID"
      log "  ✓ Artifact URL: $ARTIFACT_URL"

      # ── Generate 3 content sets (easy, medium, hard) via LLM ──────────
      log "  Generating content sets (easy, medium, hard)..."

      CONTENT_GEN_PROMPT="You are generating game content for a MathAI educational game. The game expects content in a specific JSON format defined by the inputSchema below.

GAME SPECIFICATION:
$SPEC_CONTENT

INPUT SCHEMA (the content must conform to this structure):
$INPUT_SCHEMA

CURRENT FALLBACK CONTENT (from the HTML — use this as a reference for the exact structure):
$(grep -A 100 'fallbackContent' "$HTML_FILE" | head -120)

Generate THREE content sets at different difficulty levels. Each must conform exactly to the inputSchema structure.

RULES:
- easy: Simpler values, smaller numbers, fewer items — suitable for younger or beginner students
- medium: Moderate difficulty — similar to the fallback content
- hard: Challenging values, larger numbers, more items — suitable for advanced students
- Each content set must be a valid JSON object matching the inputSchema
- Use age-appropriate, educationally sound content
- Vary the content between difficulties (don't just change one number)

Output EXACTLY this format (no other text):

CONTENT_EASY:
\`\`\`json
{...}
\`\`\`

CONTENT_MEDIUM:
\`\`\`json
{...}
\`\`\`

CONTENT_HARD:
\`\`\`json
{...}
\`\`\`"

      CONTENT_SET_IDS="[]"

      if call_llm "generate-content-sets" "$CONTENT_GEN_PROMPT" "$GEN_MODEL" 180 2>/dev/null; then
        # Extract each content set from the LLM output
        for DIFFICULTY in easy medium hard; do
          DIFFICULTY_UPPER=$(echo "$DIFFICULTY" | tr '[:lower:]' '[:upper:]')
          # Extract JSON block after CONTENT_{DIFFICULTY}: marker
          CS_JSON=$(echo "$LLM_OUTPUT" | awk "
            /CONTENT_${DIFFICULTY_UPPER}:/{found=1; next}
            found && /\`\`\`json/{capture=1; next}
            found && capture && /\`\`\`/{exit}
            capture{print}
          ")

          if [ -z "$CS_JSON" ] || ! echo "$CS_JSON" | jq '.' > /dev/null 2>&1; then
            warn "  Invalid JSON for $DIFFICULTY content set, skipping"
            continue
          fi

          # Save content set to file
          echo "$CS_JSON" | jq '.' > "$GAME_DIR/content-${DIFFICULTY}.json"

          # Create content set via API
          CS_PAYLOAD=$(jq -n \
            --arg gameId "$PUBLISH_GAME_ID" \
            --arg name "$GAME_TITLE — ${DIFFICULTY^}" \
            --arg desc "Auto-generated $DIFFICULTY content set" \
            --arg difficulty "$DIFFICULTY" \
            --argjson content "$CS_JSON" \
            '{
              gameId: $gameId,
              name: $name,
              description: $desc,
              grade: (if $difficulty == "easy" then 2 elif $difficulty == "hard" then 6 else 4 end),
              difficulty: $difficulty,
              concepts: ["general"],
              content: $content,
              createdBy: "ralph-pipeline"
            }')

          CS_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 30 \
            -X POST "$CORE_API_URL/api/content-sets/create" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $CORE_API_TOKEN" \
            -d "$CS_PAYLOAD") || {
            warn "  Failed to create $DIFFICULTY content set"
            continue
          }

          CS_HTTP=$(echo "$CS_RESPONSE" | tail -1)
          CS_BODY=$(echo "$CS_RESPONSE" | sed '$d')

          if [ "$CS_HTTP" = "201" ] || [ "$CS_HTTP" = "200" ]; then
            CS_ID=$(echo "$CS_BODY" | jq -r '.data.id // empty')
            CS_VALID=$(echo "$CS_BODY" | jq -r '.data.isValid // false')
            if [ "$CS_VALID" = "true" ]; then
              log "  ✓ Content set ($DIFFICULTY): $CS_ID"
              CONTENT_SET_IDS=$(echo "$CONTENT_SET_IDS" | jq --arg id "$CS_ID" --arg diff "$DIFFICULTY" \
                '. + [{"id": $id, "difficulty": $diff}]')
            else
              CS_ERRORS=$(echo "$CS_BODY" | jq -r '.data.validationErrors // [] | join(", ")')
              warn "  Content set ($DIFFICULTY) created but invalid: $CS_ERRORS"
            fi
          else
            CS_ERR=$(echo "$CS_BODY" | jq -r '.error.message // .error // "unknown error"' 2>/dev/null)
            warn "  Failed to create $DIFFICULTY content set: HTTP $CS_HTTP — $CS_ERR"
          fi
        done
      else
        warn "  Content set generation LLM call failed"
      fi

      PUBLISH_CONTENT_SETS="$CONTENT_SET_IDS"

      # Build game links
      MEDIUM_CS_ID=$(echo "$CONTENT_SET_IDS" | jq -r '.[] | select(.difficulty == "medium") | .id // empty')
      if [ -n "$MEDIUM_CS_ID" ]; then
        PUBLISH_GAME_LINK="https://learn.mathai.ai/game/${PUBLISH_GAME_ID}/${MEDIUM_CS_ID}"
      elif [ "$(echo "$CONTENT_SET_IDS" | jq length)" -gt 0 ]; then
        FIRST_CS_ID=$(echo "$CONTENT_SET_IDS" | jq -r '.[0].id')
        PUBLISH_GAME_LINK="https://learn.mathai.ai/game/${PUBLISH_GAME_ID}/${FIRST_CS_ID}"
      else
        PUBLISH_GAME_LINK="https://learn.mathai.ai/game/${PUBLISH_GAME_ID}"
      fi

      log "  ✓ Game link: $PUBLISH_GAME_LINK"

      # Log all content set URLs
      for ROW in $(echo "$CONTENT_SET_IDS" | jq -r '.[] | @base64'); do
        CS_DIFF=$(echo "$ROW" | base64 -d | jq -r '.difficulty')
        CS_ID=$(echo "$ROW" | base64 -d | jq -r '.id')
        log "  ✓ $CS_DIFF: https://learn.mathai.ai/game/${PUBLISH_GAME_ID}/${CS_ID}"
      done

      # Save publish info for the report
      jq -n \
        --arg gameId "$PUBLISH_GAME_ID" \
        --arg artifactUrl "$ARTIFACT_URL" \
        --arg gameLink "$PUBLISH_GAME_LINK" \
        --argjson contentSets "$CONTENT_SET_IDS" \
        '{
          gameId: $gameId,
          artifactUrl: $artifactUrl,
          gameLink: $gameLink,
          contentSets: $contentSets
        }' > "$GAME_DIR/publish-info.json"

    else
      REG_ERR=$(echo "$REG_BODY" | jq -r '.error.message // .error // "unknown error"' 2>/dev/null)
      warn "  Game registration failed: HTTP $REG_HTTP_CODE — $REG_ERR"
    fi
  else
    log "  Publish skipped (set CORE_API_URL + CORE_API_TOKEN to enable)"
  fi

  write_report
  exit 0
else
  warn "  Review rejected: $REVIEW_RESULT"
  REPORT_STATUS="REJECTED"
  write_report
  exit 1
fi

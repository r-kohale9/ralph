#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ralph.sh — Automated game-building pipeline
#
# Usage: ./ralph.sh <game-dir> <spec-path>
#   game-dir:  Directory where index.html will be generated
#   spec-path: Path to the game's spec.md
#
# Environment variables (all optional, with sane defaults):
#   PROXY_URL           - CLIProxyAPI endpoint (default: http://localhost:8080)
#   PROXY_KEY           - API key for the proxy
#   RALPH_GEN_MODEL     - Model for HTML generation (default: claude-opus-4-6)
#   RALPH_TEST_MODEL    - Model for test generation (default: gemini-2.5-pro)
#   RALPH_FIX_MODEL     - Model for fix iterations (default: claude-sonnet-4-6)
#   RALPH_REVIEW_MODEL  - Model for review (default: gemini-2.5-pro)
#   RALPH_FALLBACK_MODEL- Overflow model (default: gpt-4.1)
#   RALPH_MAX_ITERATIONS- Max fix iterations (default: 5)
#   RALPH_LLM_TIMEOUT   - Timeout for LLM calls in seconds (default: 300)
#   RALPH_TEST_TIMEOUT   - Timeout for Playwright runs in seconds (default: 120)
#   RALPH_REPORT_DIR    - Directory for ralph-report.json (default: game-dir)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Arguments ───────────────────────────────────────────────────────────────
GAME_DIR="${1:?Usage: ralph.sh <game-dir> <spec-path>}"
SPEC_PATH="${2:?Usage: ralph.sh <game-dir> <spec-path>}"

# Resolve to absolute paths
GAME_DIR="$(cd "$(dirname "$GAME_DIR")" && pwd)/$(basename "$GAME_DIR")"
SPEC_PATH="$(cd "$(dirname "$SPEC_PATH")" && pwd)/$(basename "$SPEC_PATH")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Configuration ───────────────────────────────────────────────────────────
PROXY_URL="${PROXY_URL:-http://localhost:8080}"
PROXY_KEY="${PROXY_KEY:-ralph-pipeline-key}"

# Model assignments (T5: correct defaults — Opus for gen, Sonnet for fixes)
GEN_MODEL="${RALPH_GEN_MODEL:-claude-opus-4-6}"
TEST_MODEL="${RALPH_TEST_MODEL:-gemini-2.5-pro}"
FIX_MODEL="${RALPH_FIX_MODEL:-claude-sonnet-4-6}"
REVIEW_MODEL="${RALPH_REVIEW_MODEL:-gemini-2.5-pro}"
FALLBACK_MODEL="${RALPH_FALLBACK_MODEL:-gpt-4.1}"

MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-5}"
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
        max_tokens: 16000,
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
  # Try to extract HTML from markdown code blocks first
  local EXTRACTED
  EXTRACTED=$(echo "$OUTPUT" | sed -n '/```html/,/```/p' | sed '1d;$d')
  if [ -n "$EXTRACTED" ]; then
    echo "$EXTRACTED"
    return 0
  fi
  # Try generic code block
  EXTRACTED=$(echo "$OUTPUT" | sed -n '/```/,/```/p' | sed '1d;$d')
  if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q '<!DOCTYPE\|<html\|<head\|<body'; then
    echo "$EXTRACTED"
    return 0
  fi
  # If the output itself looks like HTML, use it directly
  if echo "$OUTPUT" | grep -q '<!DOCTYPE\|<html'; then
    echo "$OUTPUT"
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
  GEN_PROMPT="You are an expert HTML game developer. Generate a complete, single-file HTML game based on the following specification.

REQUIREMENTS:
- Output ONLY the complete HTML file content, wrapped in a \`\`\`html code block
- Single file: all CSS in <style>, all JS in <script>
- Must include #gameContent and #gameArea containers
- Must implement: initGame(), checkAnswer(), endGame() functions
- Must use postMessage for communication with parent frame
- Must be fully self-contained and playable
- Star thresholds: 80% = 3 stars, 50% = 2 stars, >0% = 1 star, 0% = 0 stars
- Mobile-first: max-width 480px, touch-friendly

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

Fix ALL the listed structural issues. Output the complete corrected HTML wrapped in a \`\`\`html code block."

  call_llm "static-fix-$STATIC_ATTEMPTS" "$STATIC_FIX_PROMPT" "$FIX_MODEL" || break
  FIXED_HTML=$(extract_html "$LLM_OUTPUT") || break
  printf '%s\n' "$FIXED_HTML" > "$HTML_FILE"
done

# ─── Step 2: Generate tests ─────────────────────────────────────────────────
log ""
log "Step 2: Generate Playwright tests"

HTML_CONTENT=$(cat "$HTML_FILE")
TEST_PROMPT="You are an expert Playwright test writer. Generate a comprehensive Playwright test suite for the following HTML game.

Write tests covering these 8 MANDATORY categories:
1. Initial render — correct DOM structure, elements visible
2. Game state initialization — gameState object has required fields
3. User interaction — clicks, inputs, game responses
4. Score/progress tracking — score updates correctly
5. Timer behavior — countdown works if applicable
6. Completion flow — endGame triggers correctly, stars calculated
7. Responsive layout — fits within 480px width
8. Edge cases — empty inputs, rapid clicks, boundary values

9. postMessage event validation (E5) — verify gameOver event contains: type='gameOver', score (number), stars (0-3), total (number >= 1)

IMPORTANT:
- Use \`@playwright/test\` imports
- Base URL is http://localhost:8787
- Tests run against index.html served at the root
- Use page.goto('/') to load the game
- Wait for game initialization before testing
- Include a test that listens for postMessage events and validates the gameOver payload schema
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
  local TEST_ENTRY
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

SPECIFICATION (for reference):
$SPEC_CONTENT

Output the complete fixed HTML wrapped in a \`\`\`html code block. Fix the HTML to make the failing tests pass."

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

REVIEW_PROMPT="You are a game quality reviewer. Review the following HTML game against its specification.

Check this EXACT checklist:
1. ✅ All game mechanics match the specification
2. ✅ UI layout is correct (480px max-width, mobile-friendly)
3. ✅ Score tracking works as specified
4. ✅ Timer behavior matches spec (if applicable)
5. ✅ Star thresholds: 80% = 3 stars, 50% = 2 stars, >0% = 1 star, 0% = 0 stars
6. ✅ endGame() produces correct metrics
7. ✅ postMessage communication is correct
8. ✅ No forbidden patterns (document.write, inline handlers)
9. ✅ All content is within #gameContent
10. ✅ Game is fully playable from start to finish

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <reason> — if any item fails

SPECIFICATION:
$SPEC_CONTENT

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

  # T6: Generate inputSchema.json
  log "  Generating inputSchema.json (T6)..."
  INPUT_SCHEMA_FILE="$GAME_DIR/inputSchema.json"

  SCHEMA_PROMPT="Analyze the following HTML game and generate an inputSchema.json that describes its configuration options.

The schema should follow JSON Schema draft-07 format and include:
- Game title and description
- Any configurable parameters (number of questions, difficulty, time limit, etc.)
- Input types (e.g., multiple choice, text input, drag-and-drop)
- Required vs optional fields

Output ONLY valid JSON (no markdown, no code blocks, no explanation).

HTML:
$(cat "$HTML_FILE")

SPECIFICATION:
$SPEC_CONTENT"

  if call_llm "generate-schema" "$SCHEMA_PROMPT" "$REVIEW_MODEL" 2>/dev/null; then
    # Try to extract valid JSON from the output
    SCHEMA_JSON=$(echo "$LLM_OUTPUT" | sed -n '/^{/,/^}/p' | head -100)
    if [ -z "$SCHEMA_JSON" ]; then
      # Try from code block
      SCHEMA_JSON=$(echo "$LLM_OUTPUT" | sed -n '/```json/,/```/p' | sed '1d;$d')
    fi
    if [ -z "$SCHEMA_JSON" ]; then
      SCHEMA_JSON="$LLM_OUTPUT"
    fi

    # Validate it's valid JSON using jq
    if echo "$SCHEMA_JSON" | jq '.' > /dev/null 2>&1; then
      echo "$SCHEMA_JSON" | jq '.' > "$INPUT_SCHEMA_FILE"
      log "  ✓ inputSchema.json generated"
    else
      warn "  LLM produced invalid JSON for inputSchema — using fallback"
      jq -n \
        --arg game_id "$GAME_ID" \
        --arg title "$GAME_ID" \
        '{
          "$schema": "http://json-schema.org/draft-07/schema#",
          "title": $title,
          "type": "object",
          "properties": {
            "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"], "default": "medium" },
            "questionCount": { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 }
          }
        }' > "$INPUT_SCHEMA_FILE"
      log "  ✓ inputSchema.json generated (fallback)"
    fi
  else
    warn "  inputSchema.json generation failed — using fallback"
    jq -n \
      --arg game_id "$GAME_ID" \
      '{
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": $game_id,
        "type": "object",
        "properties": {}
      }' > "$INPUT_SCHEMA_FILE"
  fi

  # E10: Deployment step — register artifact, version tag
  DEPLOY_ENABLED="${RALPH_DEPLOY_ENABLED:-0}"
  DEPLOY_DIR="${RALPH_DEPLOY_DIR:-}"

  if [ "$DEPLOY_ENABLED" = "1" ] && [ -n "$DEPLOY_DIR" ]; then
    log "  Running deployment step (E10)..."

    # Create versioned artifact directory
    VERSION_TAG="$(date -u '+%Y%m%d-%H%M%S')"
    ARTIFACT_DIR="$DEPLOY_DIR/$GAME_ID/$VERSION_TAG"
    mkdir -p "$ARTIFACT_DIR"

    # Copy approved artifacts
    cp "$HTML_FILE" "$ARTIFACT_DIR/index.html"
    [ -f "$INPUT_SCHEMA_FILE" ] && cp "$INPUT_SCHEMA_FILE" "$ARTIFACT_DIR/inputSchema.json"
    cp "$REPORT_FILE" "$ARTIFACT_DIR/ralph-report.json" 2>/dev/null || true

    # Create/update latest symlink
    ln -sfn "$ARTIFACT_DIR" "$DEPLOY_DIR/$GAME_ID/latest"

    # Write version manifest
    jq -n \
      --arg game_id "$GAME_ID" \
      --arg version "$VERSION_TAG" \
      --arg timestamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      --arg html_hash "$(sha256sum "$HTML_FILE" | cut -d' ' -f1)" \
      '{
        game_id: $game_id,
        version: $version,
        timestamp: $timestamp,
        html_sha256: $html_hash,
        status: "APPROVED"
      }' > "$ARTIFACT_DIR/manifest.json"

    log "  ✓ Deployed to $ARTIFACT_DIR"
  else
    log "  Deployment skipped (RALPH_DEPLOY_ENABLED=${DEPLOY_ENABLED})"
  fi

  # E6: Update cache after successful build
  update_cache

  write_report
  exit 0
else
  warn "  Review rejected: $REVIEW_RESULT"
  REPORT_STATUS="REJECTED"
  write_report
  exit 1
fi

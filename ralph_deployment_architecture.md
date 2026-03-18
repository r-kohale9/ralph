# Ralph Pipeline — Deployment & Operations Architecture

**Date:** March 13, 2026
**Scope:** How to deploy, run, trigger, monitor, and interact with Ralph in production
**Companion to:** `ralph_pipeline_analysis.md` (script-level analysis)
**Key dependency:** [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) — multi-provider proxy wrapping Claude Code, Codex, and Gemini behind a unified API

---

## The Problem Statement

Ralph currently runs locally on a developer's machine. The target state: a spec gets published (merged to GitHub), and within minutes a validated game artifact appears — or a failure report lands in Slack. No human in the loop between publish and result.

---

## Available Resources

| Provider | Access | Quota Model | Best For |
|---|---|---|---|
| **Claude** (2 Max accounts) | OAuth via Claude Code | ~200-800 msgs per 5h rolling window per account, shared with interactive use | Generation (Opus), fix reasoning (Sonnet) |
| **Codex / GPT** (1 Pro account) | OAuth via Codex CLI | Rolling window, similar to Claude | Overflow fixes when Claude is rate-limited |
| **Gemini 2.5 Pro** (API key) | Direct API access | Usage-based billing, no rolling window | Mechanical tasks (test gen, review) — always available |

**The solution: CLIProxyAPI** — an open-source Go proxy (12.4k stars, MIT licensed, 112 contributors) that wraps CLI tools behind a standard OpenAI/Claude-compatible HTTP API, with **multi-provider routing and multi-account load balancing**. Ralph calls a local HTTP endpoint with a model name; the proxy routes to the right provider and account automatically.

**Provider routing strategy:**
- **Claude Opus** → HTML generation (the one-shot that needs highest quality, warehouse-aware reasoning)
- **Gemini 2.5 Pro** → test generation + review (mechanical checklist tasks, no window quota constraint)
- **Claude Sonnet** → fix iterations (needs reasoning about test failures + HTML structure)
- **Codex GPT** → fallback if both Claude accounts are rate-limited during fix iterations

This splits the load: ~40% of calls go to Gemini (free of window constraints), ~50% to Claude (the scarce resource, used only where it matters), ~10% overflow to Codex.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SPEC AUTHORING (Claude Desktop — any team member's machine)             │
│                                                                          │
│  Author spec → Test in artifact preview → Commit & push to GitHub        │
│  Branch: feature/doubles-spec → PR → Merge to c_code                     │
└──────────────┬───────────────────────────────────────────────────────────┘
               │
               │  GitHub webhook (push to c_code, path: warehouse/templates/**)
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PIPELINE SERVER (single VPS — Hetzner CX22, ~€4/month)                  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  CLIProxyAPI (Docker)                                             │    │
│  │                                                                   │    │
│  │  CLAUDE     2 Max accounts (OAuth) ── round-robin                 │    │
│  │  CODEX      1 Pro account  (OAuth) ── overflow fallback           │    │
│  │  GEMINI     API key access         ── direct, no window limit     │    │
│  │                                                                   │    │
│  │  Exposes: http://localhost:8317/v1/messages                       │    │
│  │  Routes by model name → right provider + account                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│         ▲                                                                │
│         │  call_llm("generate-html", $PROMPT, "claude-opus-4-6")         │
│         │  call_llm("generate-tests", $PROMPT, "gemini-2.5-pro")         │
│         │                                                                │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────────┐       │
│  │  Webhook      │────▶│  Job Queue   │────▶│  Ralph Worker      │       │
│  │  Receiver     │     │  (BullMQ /   │     │  (calls proxy,     │       │
│  │  (Express)    │     │  Redis)      │     │  runs Playwright)  │       │
│  └──────────────┘     └──────────────┘     └─────────┬──────────┘       │
│                                                       │                  │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────┴──────────┐       │
│  │  Artifact     │     │  Results DB  │     │  Playwright        │       │
│  │  Store        │     │  (SQLite)    │     │  (test execution)  │       │
│  │  (git + disk) │     └──────────────┘     └────────────────────┘       │
│  └──────────────┘                                                        │
│                        ┌──────────────┐                                  │
│                        │  Slack        │                                  │
│                        │  Notifier     │                                  │
│                        └──────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## What CLIProxyAPI Gives Us

| Before (direct `claude -p`) | After (CLIProxyAPI proxy) |
|---|---|
| Shell out to CLI, parse text output | HTTP POST, structured JSON response |
| One provider, one account | 3 providers (Claude, Gemini, Codex), multi-account |
| Auth expires → silent failure | Proxy rotates to next account/provider, returns HTTP status |
| No model routing | Model name in request → proxy routes to right provider |
| Concurrency = 1 | Concurrency = 2-3 (distributed across providers + accounts) |
| Claude-only, quota-constrained | Mechanical tasks offloaded to Gemini (no window quota) |

**The proxy is local.** OAuth tokens and API keys stay on your server. CLIProxyAPI calls each provider's endpoints directly — no third-party data routing.

---

## Component Details

### 1. CLIProxyAPI Setup

```yaml
# docker-compose.yml
services:
  cliproxyapi:
    image: eceasy/cli-proxy-api:latest
    ports:
      - "8317:8317"
    volumes:
      - ./config.yaml:/CLIProxyAPI/config.yaml
      - ./auths:/root/.cli-proxy-api
    restart: always
```

**Config with all 3 providers:**

```yaml
# config.yaml
port: 8317

api-keys:
  - "ralph-pipeline-key-change-this"

gemini-api-key:
  - api-key: "your-gemini-api-key"
```

**Account authentication (one-time per account):**

```bash
# Claude accounts (opens browser for OAuth on port 54545)
docker run --rm -p 54545:54545 \
  -v ./config.yaml:/CLIProxyAPI/config.yaml \
  -v ./auths:/root/.cli-proxy-api \
  eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --claude-login

# Codex / OpenAI account (opens browser for OAuth on port 1455)
docker run --rm -p 1455:1455 \
  -v ./config.yaml:/CLIProxyAPI/config.yaml \
  -v ./auths:/root/.cli-proxy-api \
  eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --codex-login

# Gemini — no auth step, API key is in config.yaml
```

### 2. Ralph's `call_llm()` — the Provider-Agnostic Core

The core change to `ralph.sh`. Replaces the old `run_claude()` with a generic function that calls any model through the proxy. The proxy handles routing — Ralph just specifies the model name.

```bash
PROXY_URL="${PROXY_URL:-http://localhost:8317}"
PROXY_KEY="${PROXY_KEY:-ralph-pipeline-key}"

# ─── Provider-agnostic LLM call ──────────────────────────────────────────
# Usage: call_llm <step-name> <prompt> [model]
# Model defaults to $DEFAULT_MODEL (sonnet). Override per call.
# Output stored in $LLM_OUTPUT (global, like the old CLAUDE_OUTPUT).
DEFAULT_MODEL="${RALPH_FIX_MODEL:-claude-sonnet-4-6}"
LLM_OUTPUT=""

call_llm() {
  local STEP_NAME="$1"
  local PROMPT="$2"
  local MODEL="${3:-$DEFAULT_MODEL}"

  log "  [$STEP_NAME] model=$MODEL ..."

  local RESPONSE
  RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 300 \
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
      }')")

  local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    # Handle both Claude format (.content[0].text) and OpenAI format (.choices[0].message.content)
    LLM_OUTPUT=$(echo "$BODY" | jq -r '
      .content[0].text //
      .choices[0].message.content //
      empty
    ')
    log "  ✓ [$STEP_NAME] completed"
    echo "$STEP_NAME" >> "$LOG_FILE"
    return 0
  elif [ "$HTTP_CODE" -eq 429 ]; then
    warn "[$STEP_NAME] rate limited — retrying in 30s"
    sleep 30
    call_llm "$STEP_NAME" "$PROMPT" "$MODEL"
  else
    err "[$STEP_NAME] proxy returned HTTP $HTTP_CODE"
    LLM_OUTPUT=""
    return 1
  fi
}
```

**Pipeline steps with provider routing:**

```bash
# ─── Model assignments (configurable via env vars) ───────────────────────
GEN_MODEL="${RALPH_GEN_MODEL:-claude-opus-4-6}"       # Generation: Claude Opus
TEST_MODEL="${RALPH_TEST_MODEL:-gemini-2.5-pro}"       # Test gen: Gemini (no window quota)
FIX_MODEL="${RALPH_FIX_MODEL:-claude-sonnet-4-6}"      # Fixes: Claude Sonnet (needs reasoning)
REVIEW_MODEL="${RALPH_REVIEW_MODEL:-gemini-2.5-pro}"   # Review: Gemini (mechanical checklist)
FALLBACK_MODEL="${RALPH_FALLBACK_MODEL:-gpt-4.1}"      # Overflow: Codex/GPT

# ─── Step 1: Generate HTML ───────────────────────────────────────────────
call_llm "generate-html" "$GEN_PROMPT" "$GEN_MODEL"

# ─── Step 2: Generate tests ──────────────────────────────────────────────
call_llm "generate-tests" "$TEST_PROMPT" "$TEST_MODEL"

# ─── Step 3: Fix loop ────────────────────────────────────────────────────
call_llm "fix-tests" "$FIX_PROMPT" "$FIX_MODEL"
# If Claude is rate-limited (429), the retry can fall back:
# call_llm "fix-tests-fallback" "$FIX_PROMPT" "$FALLBACK_MODEL"

# ─── Step 4: Review ──────────────────────────────────────────────────────
call_llm "review" "$REVIEW_PROMPT" "$REVIEW_MODEL"
```

### 3. Job Queue (BullMQ + Redis)

```javascript
const worker = new Worker('ralph-builds', async (job) => {
  await exec('git pull origin c_code');
  const result = await runRalph(job.data.gameId, job.data.specPath);
  await storeResult(job.data.gameId, job.data.commitSha, result);
  await notifySlack(job.data.gameId, result);
  return result;
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 2,  // safe with 2 Claude accounts + Gemini offload
  limiter: { max: 10, duration: 3600000 }
});
```

### 4. Webhook Receiver

```javascript
app.post('/webhook/github', verifySignature, (req, res) => {
  const changedSpecs = extractChangedSpecs(req.body);
  
  if (changedSpecs.size > 5) {
    // Bulk — schedule overnight
    const midnight = getNextMidnight('Asia/Kolkata');
    changedSpecs.forEach(id => queue.add('build-game', { gameId: id }, { delay: midnight - Date.now() }));
    notifySlack(`📋 ${changedSpecs.size} games queued for overnight build`);
  } else {
    // Small batch — run now
    changedSpecs.forEach(id => queue.add('build-game', { gameId: id }));
  }
  
  res.json({ queued: changedSpecs.size });
});

app.post('/api/build', (req, res) => {
  // Manual trigger
  if (req.body.all) {
    // Queue all 47 templates overnight
  } else {
    queue.add('build-game', { gameId: req.body.gameId });
  }
  res.json({ queued: true });
});
```

### 5. Slack Notifications

```
✅ doubles — APPROVED (2 iterations · 47s · 5 calls)
   Commit: abc1234 by Sammit

❌ queens — FAILED after 5 iterations
   Failures: "Grid exceeds 480px", "Timer stuck at 00:00"

⚠️ crazy-maze — RATE LIMITED (all accounts exhausted, retrying in 30m)
```

---

## Quota Model

### Per-game build (multi-provider)

| Step | Calls | Provider | Quota Impact |
|---|---|---|---|
| Generate HTML | 1 | Claude Opus | Hits Claude window (heaviest call) |
| Generate tests | 1 | Gemini 2.5 Pro | API-billed, no window constraint |
| Fix (0-5 iterations) | 0-5 | Claude Sonnet | Hits Claude window (separate Sonnet limit) |
| Review | 1 | Gemini 2.5 Pro | API-billed, no window constraint |

**Typical: 5 calls total** — but only 3 hit Claude quota (1 Opus + 2 Sonnet fixes). The other 2 go to Gemini which is always available.

### Claude quota math (2 accounts)

```
Per account per 5h window:  ~300 Sonnet messages (conservative)
Combined Claude pool:       ~600 messages/window
Claude calls per game:      ~3 (1 Opus + 2 Sonnet) — 40% less than all-Claude
Games per window:           ~200 (theoretical), ~40 practical with interactive headroom

47-template rebuild:
  Claude calls: ~140 (47 Opus + ~94 Sonnet) ÷ 2 accounts = ~70 each
  Gemini calls: ~94 (47 test gen + 47 reviews) — no quota concern
  Codex calls:  ~0 (only used if Claude hits 429)
  Time: ~2-3 hours overnight
```

### Gemini cost estimate

Gemini 2.5 Pro API pricing is ~$1.25/M input tokens, ~$10/M output tokens. Each test-gen or review call is roughly ~30K input + ~5K output ≈ $0.09 per call. For a 47-template rebuild: 94 calls × $0.09 = ~$8.50. Negligible.

### Why this split works

Offloading test generation and review to Gemini cuts Claude consumption by ~40%. That's the difference between "tight overnight with 2 accounts" and "comfortable with headroom to spare." Claude is reserved for the two tasks where it demonstrably outperforms: understanding the warehouse spec (generation) and reasoning about test failures (fixes).

---

## Server Spec

| Resource | Spec | Cost |
|---|---|---|
| VPS | 2 vCPU, 4GB RAM, 40GB disk (Hetzner CX22) | ~€4/month |
| Claude usage | 2 existing Max plans | $0 additional |
| Codex usage | 1 existing Pro plan | $0 additional |
| Gemini API | ~94 calls per full rebuild | ~$8-10 per rebuild |
| **Total** | | **~€4/month + ~$20-30/month Gemini** |

The Gemini cost only applies when Ralph runs. During active development (~5 pushes/day), that's roughly $1-2/day in Gemini API calls.

---

## Security

| Concern | Solution |
|---|---|
| Webhook spoofing | Verify GitHub HMAC-SHA256 signature on every request |
| Proxy access | API key required on all requests, proxy bound to localhost only |
| OAuth tokens | Stored in Docker volume on server, not in code or logs |
| Token expiry | Proxy handles rotation; if all accounts for a provider expire → HTTP 401 → Slack alert |
| Gemini API key | In config.yaml on server disk, not in repo. `.gitignore` the config. |
| Server access | SSH key only, no password. Firewall: 443 (webhook) + 22 (SSH) |
| Generated HTML | Read-only preview serving. Never executed server-side. |
| Third-party trust | CLIProxyAPI is MIT, 12k stars, 112 contributors. All tokens stay on your server. Audit the code before first deploy. |

---

## Process Management

Three long-running processes, each independently restartable:

```ini
# /etc/systemd/system/ralph-server.service
[Unit]
Description=Ralph Webhook + API Server
After=redis.service docker.service

[Service]
Type=simple
User=ralph
WorkingDirectory=/srv/ralph
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
EnvironmentFile=/srv/ralph/.env

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/ralph-worker.service
[Unit]
Description=Ralph Build Worker
After=redis.service docker.service ralph-server.service

[Service]
Type=simple
User=ralph
WorkingDirectory=/srv/ralph
ExecStart=/usr/bin/node worker.js
Restart=always
RestartSec=10
EnvironmentFile=/srv/ralph/.env
# Prevent systemd from killing the worker mid claude -p call (which can run 5-10 min)
TimeoutStopSec=600
# Kill the entire cgroup (node + all child claude/serve processes) on stop
# This prevents orphaned claude processes consuming tokens when the worker is restarted
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

CLIProxyAPI runs via `docker-compose` with `restart: always` — Docker handles its lifecycle.

If the worker crashes mid-Playwright, the server stays up accepting webhooks. BullMQ retries the failed job when the worker restarts.

---

## How Each Role Interacts

### Spec authors (Sammit, Rishabh, Lokesh)

1. Write spec in Claude Desktop using the game-builder skill
2. Test logic via artifact preview in chat
3. Push to GitHub → PR → merge to `c_code`
4. Watch `#ralph-builds` in Slack for result
5. If approved: play at `https://ralph.server/games/{game-id}/`
6. If failed: read failure report, fix spec, push again

**One-time setup:** The 2 Claude Max account holders and the Codex account holder each authenticate once with the proxy via SSH. Gemini uses an API key (no human auth). After that, nobody touches the server — just push specs and watch Slack.

### Pipeline maintainer (you)

```bash
# Manual build
curl -X POST http://ralph.server/api/build -d '{"gameId":"doubles"}'

# Bulk rebuild (schedules overnight if >5 games)
curl -X POST http://ralph.server/api/build -d '{"all":true}'

# Check proxy health + which providers are up
curl http://localhost:8317/health

# Queue depth
redis-cli LLEN bull:ralph-builds:wait

# Recent builds
sqlite3 /srv/ralph/data/builds.db \
  "SELECT game_id, status, iterations, duration_s FROM builds ORDER BY completed_at DESC LIMIT 20"

# Add a new Claude account to the pool
# Run --claude-login again (see Account authentication above)

# Re-route fix calls to Codex temporarily (if Claude is rate-limited)
# Edit .env: RALPH_FIX_MODEL=gpt-4.1
systemctl restart ralph-worker
```

### Supervisor (checking in remotely)

1. Check `#ralph-builds` Slack channel for pass/fail ratio
2. Open `https://ralph.server/api/builds` in browser for build history
3. Play any approved game at `https://ralph.server/games/{game-id}/`

No setup, no SSH, no CLI. Pure read-only visibility.

---

## Environment Variables

```bash
# Proxy
PROXY_URL=http://localhost:8317
PROXY_KEY=ralph-pipeline-key-change-this

# Model routing (override to reroute any step)
RALPH_GEN_MODEL=claude-opus-4-6          # Step 1: HTML generation
RALPH_TEST_MODEL=gemini-2.5-pro          # Step 2: Test generation
RALPH_FIX_MODEL=claude-sonnet-4-6        # Step 3: Fix iterations
RALPH_REVIEW_MODEL=gemini-2.5-pro        # Step 4: Review
RALPH_FALLBACK_MODEL=gpt-4.1             # Overflow when primary is 429

# Pipeline
RALPH_CONCURRENCY=2
RALPH_MAX_ITERATIONS=5
RALPH_BULK_THRESHOLD=5

# Infrastructure
GITHUB_WEBHOOK_SECRET=...
SLACK_WEBHOOK_URL=...
```

---

## Deploy from Scratch

```bash
# 1. Provision Ubuntu 24.04 VPS (2 vCPU, 4GB RAM)
# 2. SSH in as root

# System
apt update && apt install -y docker.io docker-compose nodejs npm redis-server git jq
systemctl enable --now docker redis

# Service user
useradd -m -s /bin/bash ralph && usermod -aG docker ralph
su - ralph

# ─── CLIProxyAPI ──────────────────────────────────────────────────────────
mkdir -p /srv/cliproxy && cd /srv/cliproxy
# Set up docker-compose.yml + config.yaml (see Component Details above)
# CRITICAL: config.yaml MUST include auth-dir: "~/.cli-proxy-api" (proxy crashes without it)
# config.yaml must also include: api-keys, gemini-api-key
mkdir -p auths

# Authenticate Claude accounts (2 Max accounts — each opens browser for OAuth)
# From a machine with a browser, open SSH tunnel first:
#   ssh -L 54545:127.0.0.1:54545 user@server
docker run --rm -p 54545:54545 \
  -v "$(pwd)/config.yaml:/CLIProxyAPI/config.yaml" \
  -v "$(pwd)/auths:/root/.cli-proxy-api" \
  eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --claude-login  # Account 1
# Repeat for Account 2

# Authenticate Codex account (1 Pro account)
# SSH tunnel: ssh -L 1455:127.0.0.1:1455 user@server
docker run --rm -p 1455:1455 \
  -v "$(pwd)/config.yaml:/CLIProxyAPI/config.yaml" \
  -v "$(pwd)/auths:/root/.cli-proxy-api" \
  eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --codex-login

# Gemini — no auth needed, API key is in config.yaml

# Start proxy + Redis
docker compose up -d

# Verify all providers are up:
curl -s -H "x-api-key: $PROXY_KEY" http://localhost:8317/v1/models | jq '.data | length'

# ─── Ralph ────────────────────────────────────────────────────────────────
mkdir -p /srv/ralph && cd /srv/ralph
git clone git@github.com:the-hw-app/claude-skills.git repo && cd repo && git checkout c_code
cd /srv/ralph && npm init -y
npm install bullmq express better-sqlite3
npx playwright install chromium --with-deps

# Environment + systemd services
cat > .env << 'EOF'
PROXY_URL=http://localhost:8317
PROXY_KEY=ralph-pipeline-key-change-this
RALPH_REPO_DIR=.
RALPH_USE_NODE_PIPELINE=1
RALPH_GEN_MODEL=claude-opus-4-6
RALPH_TEST_MODEL=gemini-2.5-pro
RALPH_FIX_MODEL=claude-sonnet-4-6
RALPH_REVIEW_MODEL=gemini-2.5-pro
RALPH_FALLBACK_MODEL=gpt-4.1
RALPH_TEST_TIMEOUT=300
GITHUB_WEBHOOK_SECRET=your-webhook-secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
NODE_ENV=production
EOF
# Note: systemd loads .env via EnvironmentFile.
# For manual runs: set -a && source .env && set +a

sudo systemctl enable --now ralph-server ralph-worker

# ─── GitHub Webhook ───────────────────────────────────────────────────────
# Repo → Settings → Webhooks → URL: https://ralph.server/webhook/github
```

---

## Troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| Webhook not firing | GitHub → Webhooks → Recent Deliveries | Re-enter URL + secret |
| Jobs queued but stuck | `systemctl status ralph-worker` | `systemctl restart ralph-worker` |
| HTTP 401 from proxy (Claude) | Claude OAuth tokens expired | Re-run `--claude-login` (see Account authentication) |
| HTTP 401 from proxy (Codex) | Codex OAuth token expired | Re-run `--codex-login` (see Account authentication) |
| HTTP 429 on Claude calls | Both Claude accounts rate-limited | Builds pause until window resets; fix calls can fall back to Codex |
| HTTP 4xx on Gemini calls | API key invalid or quota exceeded | Check Gemini API key in config.yaml, check GCP billing |
| Playwright OOM | `free -m` | Reduce concurrency to 1 |
| All tests fail with 0/0 (no error logged) | `RALPH_TEST_TIMEOUT` too low; pipeline kills Playwright mid-run | Set `RALPH_TEST_TIMEOUT=300` in `.env` |
| All tests fail 0/0 or 13/13 with browser error | `npx playwright test 2>&1 \| head -20` | Browsers not installed: `npx playwright install chromium` |
| Worker killed mid-job with `Result: timeout` | `systemctl status ralph-worker` | Add `TimeoutStopSec=600` + `KillMode=process` to service file, `systemctl daemon-reload` |
| SQLite readonly / Playwright EACCES on test-results | `ls -la /opt/ralph/test-results/` | `sudo chown -R <user>:<user> /opt/ralph/` — must cover entire repo, not just `data/` |
| Proxy container down | `docker ps` | `docker compose up -d` |
| Generation quality drop | Wrong model routing | Check env vars: `RALPH_GEN_MODEL` should be `claude-opus-4-6` |

---

## Migration Path

**Phase 1 (2-3 days):** VPS + CLIProxyAPI + modified Ralph + webhook + Slack. Push a spec → game builds → notification.

**Phase 2 (1 week):** Static/contract validation layers, structured reports, SQLite tracking, timeout guards.

**Phase 3 (2 weeks):** Smart retry escalation, inputSchema.json generation, event schema validation, warehouse-aware context assembly.

**Phase 4 (when needed):** More accounts in pool, CDN artifact storage, dashboard UI, PR preview URLs, regression detection on warehouse changes.

---

## What This Enables Downstream

1. **P3 (Content Generator):** Same proxy, same queue — after Ralph approves a game, a follow-up job triggers content generation. Could use Gemini for bulk problem generation (cheap, fast) and Claude for pedagogical validation (higher quality reasoning).

2. **PR previews:** Ralph runs on branches, posts playable preview URL to the PR before merge.

3. **Regression detection:** Warehouse part update → rebuild affected games → flag new failures.

4. **Template registry auto-population:** Extract metadata from approved specs → feed Session Planner (P9).

5. **Provider A/B testing:** Run the same spec through Claude generation vs Gemini generation, compare test pass rates. This tells you where Gemini is "good enough" and where Claude is genuinely required — informing future routing decisions.

6. **Model upgrade path:** When new models drop (Claude 5, Gemini 2.6, GPT-5.1), add them to config.yaml, route one pipeline step to the new model, compare results. Zero-downtime experimentation because the proxy abstracts the provider.

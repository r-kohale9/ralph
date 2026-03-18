# Lessons Learned — Ralph Pipeline Deployment

## CLIProxyAPI Setup

### `auth-dir` is required in config.yaml
Without `auth-dir: "~/.cli-proxy-api"` in config.yaml, CLIProxyAPI crashes with:
```
cliproxy: failed to create auth directory : mkdir : no such file or directory
```
OAuth credentials also won't persist to the host volume without this setting.

### OAuth login commands
```bash
# Claude (callback port 54545)
docker compose run --rm -p 54545:54545 cliproxyapi ./CLIProxyAPI login claude

# Codex (callback port 1455)
docker compose run --rm -p 1455:1455 cliproxyapi ./CLIProxyAPI login codex
```
Credentials are saved to the `auths/` directory (mapped to `/root/.cli-proxy-api` in the container).

### OAuth credentials are portable
Credentials generated locally can be copied to a remote server — no need to re-authenticate on each machine. Just copy the `auths/` directory.

## Node.js Environment

### .env files are NOT auto-loaded
Node.js does not auto-load `.env` files. For manual runs:
```bash
set -a && source .env && set +a && node server.js
```
For systemd services, use `EnvironmentFile=/opt/ralph/.env`.

### RALPH_REPO_DIR defaults to `./repo`
If not set, the worker looks for specs at `./repo/warehouse/...`. For local development, set `RALPH_REPO_DIR=.` in `.env`. For production, use the absolute path: `RALPH_REPO_DIR=/opt/ralph`.

## Playwright on Remote Servers

### Install browsers with dependencies
```bash
sudo npx playwright install --with-deps chromium
```
Without `--with-deps`, system libraries (libatk, libnss3, etc.) will be missing and Chromium won't launch.

### Headless-only on servers
Remote servers have no display. Playwright defaults to headless mode, which works fine. Ensure `xvfb` is installed as a fallback.

## Docker Desktop (macOS)

### Intermittent crashes
Docker Desktop for Mac can crash with 502 Bad Gateway errors. Fix: restart Docker Desktop with `open -a Docker`. This happened multiple times during local development.

## GCP Deployment

### Instance setup
- Machine type: `e2-medium` (2 vCPU, 4GB RAM) — equivalent to Hetzner CX22
- OS: Ubuntu 24.04 LTS
- Disk: 30GB SSD
- Region: `asia-south1-a` (Mumbai)

### Service account for GCP uploads
Uses `bucket-uploader` service account credentials stored in `gcp-keyfile.json` (gitignored). Set `GOOGLE_APPLICATION_CREDENTIALS=./gcp-keyfile.json` in `.env`.

### Git safe directory
When cloning as one user and running services as root:
```bash
git config --global --add safe.directory /opt/ralph
```
Otherwise git operations in worker.js will fail with "dubious ownership" error.

## Pipeline Behavior

### Fix loop empty responses
During e2e testing, the fix loop (iterations 1-5) sometimes receives empty content from LLM providers. The HTML generation and test generation steps work correctly — the issue is specific to the fix prompt when test results show 0 passed / 0 failed.

### Test results 0/0
Two things must be installed for Playwright tests to work on a server:

1. **Browsers**: `sudo npx playwright install --with-deps chromium`
2. **npm package**: `npm install @playwright/test --save-dev`

Missing either causes tests to return `{ expected: 0, unexpected: 0 }` instead of failing with an error. The pipeline's catch block swallows the crash and reports 0/0, causing the fix loop to run all 5 iterations without meaningful feedback.

The most common miss is installing browsers but forgetting the npm package. The `playwright.config.js` does `require('@playwright/test')` — without the package, it crashes before any test runs.

`@playwright/test` is in `devDependencies` because it's not needed for the server/API itself, but the pipeline worker needs it at runtime. **Do not use `npm install --production` on the server** — the worker needs devDependencies to run Playwright tests during builds.

### Static validation often fails on first generation
The initial HTML generation from Claude frequently misses requirements like `id="gameContent"` on the container div. The static-fix step reliably corrects this.

### Contract validation warnings are non-blocking
Contract validation issues (gameState, postMessage, scoring contracts) are logged as warnings but don't block the pipeline from proceeding to test generation.

## Slack Integration

### Thread replies require string `ts`
`createGameThread()` returns `{ ts, channel }`. When posting thread replies, pass only the `ts` string value, not the whole object. Passing the object causes `invalid_thread_ts` error.

## Game Output Directory

### `specPath` resolution creates wrong game directory
When triggering a build with `specPath: "warehouse/templates/adjustment-strategy/spec.md"`, the worker resolves the game directory as:
```
path.dirname(specPath) + '/../game' → warehouse/templates/game/
```
This puts ALL games into the same `warehouse/templates/game/` directory instead of per-game directories. The `..` in the path goes one level too high. Watch for this when running multiple games — they'll overwrite each other.

## MCP for Claude Desktop

### Warehouse knowledge is required for spec generation
Claude Desktop can't generate good specs without reading the warehouse parts, rules, and contracts. The MCP server exposes these as resources and tools (`get_warehouse_guide`, `read_warehouse_part`, etc.). Without this knowledge, generated specs miss mandatory fields, use wrong patterns, and fail validation.

### Claude Desktop MCP config
Claude Desktop doesn't support `type: "streamableHttp"` directly. Use `mcp-remote` as a bridge:
```json
{
  "mcpServers": {
    "ralph": {
      "command": "npx",
      "args": ["mcp-remote", "http://SERVER_IP/mcp", "--allow-http"]
    }
  }
}
```
`--allow-http` is required for non-HTTPS URLs. For production, set up TLS with Certbot to avoid this.

## Claude CLI (`claude -p`) for HTML Generation

### Pass file paths, not content
The original claude-skills implementation passes **file paths** to `claude -p` and lets Claude read them via tools:
```bash
claude -p "Read the template at: $TEMPLATE_PATH. Write index.html to: $OUTPUT_PATH" \
  --allowedTools "Read,Write,Edit,Glob,Grep"
```
**Do NOT pass the full spec content as a CLI argument or stdin** — a 53KB spec causes timeouts. Claude reads the files itself using the allowed tools, which is much faster and matches how Claude Code skills work.

### Skill context via working directory
Running `claude -p` from the `warehouse/mathai-game-builder/` directory auto-loads the skill's CLAUDE.md, giving Claude full component API knowledge (FeedbackManager, TimerComponent, etc.). Use `--add-dir` for additional directories:
```bash
claude -p "..." --allowedTools "Read,Write,Edit,Glob,Grep" \
  --add-dir /path/to/warehouse
```

### Claude Code auth on servers
Install with `sudo npm install -g @anthropic-ai/claude-code`. Auth with `claude auth login` (not under `sudo` — auth is per-user). For Max subscription, the OAuth flow shows a URL to open in your browser and returns a code to paste back.

### `RALPH_USE_CLAUDE_CLI=1`
Set this env var to use `claude -p` instead of CLIProxyAPI for HTML generation and fix steps. This gives Claude full skill context but requires Claude Code installed and authenticated. Test generation and review still use CLIProxyAPI (Gemini).

### Timeout needs to be generous
`claude -p` has startup overhead (loading CLAUDE.md, reading files via tools). Set `RALPH_LLM_TIMEOUT=600` (10 min) minimum for large specs.

## Server Deployment with Claude CLI

### Systemd user must match Claude auth user
Claude Code auth is per-user. If you authenticate as `the-hw-app`, the systemd services must also run as `the-hw-app` (not root). Update the service files:
```bash
sudo sed -i 's/User=root/User=the-hw-app/' /etc/systemd/system/ralph-server.service
sudo sed -i 's/User=root/User=the-hw-app/' /etc/systemd/system/ralph-worker.service
sudo systemctl daemon-reload
```

### File ownership after switching users
After changing systemd services from root to another user, fix ownership for the **entire** repo:
```bash
sudo chown -R the-hw-app:the-hw-app /opt/ralph/
```
Otherwise SQLite fails with `attempt to write a readonly database`, and Playwright fails with `EACCES: permission denied, unlink '/opt/ralph/test-results/.last-run.json'`. The partial fix (`data/` + `warehouse/` only) misses `test-results/` and any other directories created while running as root.

### Game output goes to `data/games/{gameId}/`
Build artifacts (index.html, tests, reports) are written to `data/games/{gameId}/`, NOT inside the warehouse. The warehouse directory is the knowledge base — it should only contain specs, parts, rules, and contracts. This also prevents parallel builds from overwriting each other.

### Playwright `test-results/` permissions cause silent 0/0 failures
If `test-results/.last-run.json` is owned by root, Playwright crashes with `EACCES` on every run. The worker's catch block swallows the crash and reports `{ expected: 0, unexpected: 0 }`, causing the fix loop to run all 5 iterations with no real feedback. Fix: `sudo chown -R the-hw-app:the-hw-app /opt/ralph/`

### systemd `TimeoutStopSec` kills worker mid-job
The default systemd stop timeout is 90 seconds. If `claude -p` is running a fix iteration (which can take several minutes), systemd will SIGKILL the worker when `systemctl stop` or a restart is triggered. Fix: add `TimeoutStopSec=600` and `KillMode=process` to the service file:
```ini
TimeoutStopSec=600
KillMode=process
```
`KillMode=control-group` kills the entire cgroup (node + all child `claude` and `serve` processes) when systemd stops the service. This prevents orphaned `claude -p` processes consuming tokens after the worker is restarted. Do NOT use `KillMode=process` — that only kills the node parent, leaving children running.

### `RALPH_TEST_TIMEOUT` must cover worst-case test run time
Default is 120s. With 13 tests that each timeout at 10s (Playwright's `actionTimeout`), a full failure run takes ~130s — exceeding the pipeline's test runner timeout. When the pipeline kills Playwright mid-run, `err.stdout` is empty, `JSON.parse('{}')` succeeds, and the result shows `0 passed, 0 failed`. This is indistinguishable from the browser-not-installed case.

Set `RALPH_TEST_TIMEOUT=300` in `.env` to cover worst-case runs. Formula: `numTests × playwright.timeout / 1000 × 1.5` rounded up.

### Playwright browsers must be installed after fresh server setup
`npx playwright install` (or `npm install`) does NOT download browser binaries. They must be installed separately:
```bash
npx playwright install chromium
```
If missing, every test fails with `browserType.launch: Executable doesn't exist`. The worker's JSON parse catches 0 expected/unexpected stats and reports `0 passed, 0 failed` — the fix loop runs 5 iterations but has nothing to fix. This was the root cause of all early server builds failing with 0/0. Run this once after any fresh deploy or `npm install` on a new machine.

## Ports Reference

| Service | Port |
|---------|------|
| CLIProxyAPI | 8317 |
| Redis | 6379 |
| Ralph Server | 3000 |
| Nginx | 80/443 |
| Claude OAuth callback | 54545 |
| Codex OAuth callback | 1455 |

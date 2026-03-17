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

### Streamable HTTP transport
Claude Desktop connects to Ralph MCP via `streamableHttp` transport (not stdio). Config:
```json
{
  "mcpServers": {
    "ralph": {
      "type": "streamableHttp",
      "url": "http://SERVER_IP/mcp"
    }
  }
}
```

## Ports Reference

| Service | Port |
|---------|------|
| CLIProxyAPI | 8317 |
| Redis | 6379 |
| Ralph Server | 3000 |
| Nginx | 80/443 |
| Claude OAuth callback | 54545 |
| Codex OAuth callback | 1455 |

# Local Testing Guide

Run the Ralph pipeline against any game spec — from a local file or a public URL.

## Prerequisites

- Node.js >= 20
- Redis (for BullMQ job queue)

```bash
# Install dependencies
npm install

# Start Redis (pick one)
redis-server                        # if installed locally
docker run -d -p 6379:6379 redis    # via Docker
```

## 1. Start the Server and Worker

You need both processes running. Open two terminals:

```bash
# Terminal 1 — webhook server + API
cp .env.example .env
# Edit .env: set GITHUB_WEBHOOK_SECRET, adjust REDIS_URL if needed
NODE_ENV=development npm start
# Server listening on http://localhost:3000

# Terminal 2 — BullMQ worker (processes queued builds)
npm run worker
```

## 2. Submit a Build

### From a local spec file

```bash
curl -X POST http://localhost:3000/api/build \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "my-game",
    "specPath": "/absolute/path/to/spec.md"
  }'
```

The `specPath` must be an absolute path to a Markdown spec file on the machine where the worker runs.

### From a public URL

```bash
curl -X POST http://localhost:3000/api/build \
  -H 'Content-Type: application/json' \
  -d '{
    "gameId": "my-game",
    "specUrl": "https://example.com/specs/my-game.md"
  }'
```

The worker downloads the URL content before running the pipeline. Requirements:

- URL must be publicly accessible (no auth headers are sent)
- Response must be at least 100 characters (rejects empty/tiny responses)
- Only one of `specPath` or `specUrl` can be provided per request

### Response

```json
{
  "queued": true,
  "gameId": "my-game",
  "buildId": 42
}
```

## 3. Monitor the Build

### Check build status

```bash
curl http://localhost:3000/api/builds/42
```

### List recent builds

```bash
curl http://localhost:3000/api/builds
```

### Watch worker logs

The worker prints progress to stdout:

```
[worker] Running ralph.sh for my-game
[worker]   game-dir: /srv/ralph/repo/warehouse/templates/my-game/game
[worker]   spec:     /srv/ralph/repo/warehouse/templates/my-game/spec.md
```

For URL specs, you'll also see:

```
[worker] Downloading spec from https://example.com/specs/my-game.md
[worker] Spec saved to /srv/ralph/repo/warehouse/templates/my-game/spec.md (4523 chars)
```

## 4. Run Tests (No Infrastructure Needed)

Tests mock all external dependencies — no Redis, no LLM API, no filesystem side effects.

```bash
# All tests
npm test

# Single test file
node --test test/worker.test.js
node --test test/server-integration.test.js

# Lint + format check
npm run lint
npm run format:check
```

## 5. Use the Node.js Pipeline (Optional)

By default, builds use `ralph.sh` (bash). To use the Node.js pipeline instead:

```bash
RALPH_USE_NODE_PIPELINE=1 npm run worker
```

This uses `lib/pipeline.js` which calls LLMs via `lib/llm.js` directly instead of curl. Enables cost tracking, structured I/O, and per-call metrics.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `RALPH_REPO_DIR` | `/srv/ralph/repo` | Repository directory |
| `RALPH_DB_PATH` | `/srv/ralph/data/builds.db` | SQLite database path |
| `RALPH_USE_NODE_PIPELINE` | unset | Set to `1` for Node.js pipeline |
| `RALPH_CONCURRENCY` | `2` | Max concurrent builds |
| `RALPH_MAX_ITERATIONS` | `5` | Max test/fix iterations |
| `NODE_ENV` | — | Set to `development` to skip webhook secret check |

See `.env.example` for the full list of 39 config variables.

## Troubleshooting

**"gameId is required"** — POST body must include `gameId` as a string.

**"Provide specPath or specUrl, not both"** — Only one source allowed per request.

**"specUrl must be a valid URL"** — Must be a fully qualified URL starting with `http://` or `https://`.

**"Fetched spec is too small"** — The URL returned fewer than 100 characters. Check the URL is correct and publicly accessible.

**"ralph.sh crashed without producing a report"** — The pipeline failed before generating `ralph-report.json`. Check worker logs for the underlying error.

**"GITHUB_WEBHOOK_SECRET is required"** — Set `NODE_ENV=development` or provide the secret in `.env`.

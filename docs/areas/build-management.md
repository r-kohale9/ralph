# Build Manager Agent

Instructions for any agent responsible for managing the Ralph build queue lifecycle.

---

## Core Principle

**Never let a build run past its useful life.** Running builds consume LLM tokens (Claude/Gemini calls at ~$0.01–0.10 each), compute time on the GCP worker, and Playwright browser resources. Kill a build the moment it no longer serves a purpose.

**But do not kill prematurely.** Silence in the logs does NOT mean hung. Normal step durations:
- LLM fix call (claude-sonnet): 2–5 min
- LLM generation call (claude-opus): 3–8 min
- Gemini test-gen call: 1–3 min
- Playwright test run (5 tests): 1–3 min
- Full batch (test + triage + fix + retest): 8–15 min
- Full build (5 batches × 3 iter): 30–60 min

**Only declare a build hung if:** no new log line for >15 minutes AND the last logged step was an LLM call (not a test run which can silently execute). Check `journalctl --since "15 minutes ago"` before killing.

---

## When to Kill a Build Immediately

Kill without waiting via `sudo systemctl kill --signal=SIGKILL ralph-worker`:

| Condition | Reason |
|-----------|--------|
| Build started on old pipeline code (e.g., before a worker restart) | Results are from stale logic — not useful for validation |
| Iteration 2+ with 0% pass rate AND same error both iterations | Triage is looping; pipeline change needed, not more iterations |
| Infrastructure failure (serve crash, Playwright init loop, Redis timeout) | Pipeline cannot progress; kill and fix infra first |
| Same static validation failure persists after static-fix LLM attempt | LLM can't fix it; fix the spec or prompt template instead |
| Build was queued as part of a test/debug run that has been superseded | Superseded builds waste queue slots |
| HTML size dropped >30% after a fix iteration | LLM truncated the game — HTML is corrupted |

After killing: always `db.failBuild(id, 'reason')` to mark it in the DB.

---

## When to Let a Build Continue

| Condition | Action |
|-----------|--------|
| Build is on iteration 1 for any batch | Let it run — first iteration always needed to establish baseline |
| Build is on correct pipeline version AND making progress (pass rate increasing) | Let it run |
| Only 1–2 batches failing and fix LLM is making different attempts each iteration | Let it run |
| Build is in review step | Let it run — review is fast (<60s) |
| Last log was <15 min ago during an LLM call | Let it run — LLM calls are silent for 2–8 min |
| Last log was <5 min ago during Playwright tests | Let it run — tests are silent while executing |

---

## Deciding if a Build Has "Served Its Purpose"

Ask:
1. **Is it running the current pipeline code?** If no (worker loaded old code at startup) → kill, restart worker, requeue.
2. **Will the result teach us something new?** If the game type was already validated by a similar game this run → kill.
3. **Is there a better build queued?** If a new build for the same game is queued → kill the older one.
4. **Has it been running >45 minutes?** Investigate — likely stuck in a loop.

---

## Build Lifecycle Commands

```bash
# Kill worker (kills current build)
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "sudo systemctl kill --signal=SIGKILL ralph-worker"

# Mark build as failed in DB
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "cd /opt/ralph && node -e \"require('./lib/db').failBuild(BUILD_ID, 'reason')\""

# Restart worker with latest code
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "sudo systemctl restart ralph-worker"

# Check current build status
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "journalctl -u ralph-worker --no-pager -n 10"

# Queue a new build
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "curl -s -X POST http://localhost:3000/api/build \
   -H 'Content-Type: application/json' \
   -d '{\"gameId\":\"GAME_ID\"}'"
```

---

## Monitoring Loop (for background build manager agent)

Poll every 60 seconds. For each active build:

1. Check iteration number and pass rate trend
2. If 0% pass rate on iteration 2+: triage → kill if stuck
3. If >45 min elapsed with no completion: kill
4. If worker loaded old code at startup: kill → git sync → restart → requeue

Report format on completion:
```
Build NNN (game-id): APPROVED/FAILED — X/Y tests passing
Time: Nm, Iterations: N, Architecture C triggered: yes/no
```

---

## Git Sync Procedure (before restarting worker)

Always sync before restarting to activate latest pipeline code:

```bash
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "cd /opt/ralph && git checkout lib/pipeline.js lib/db.js && git pull origin main"
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 \
  "sudo systemctl restart ralph-worker"
```

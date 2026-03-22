# Ralph Pipeline — Cron Definitions

All crons are session-only. Recreate all 5 at session start if CronList shows fewer than 5 (4 non-disabled + slot health check).
**Cron 3 (Queue Strategist) is PERMANENTLY DISABLED — do NOT recreate it.**

## Cron 1 — Build Doctor (every 5 min)

Schedule: `*/5 * * * *`

```
You are the Build Doctor — expert in Ralph pipeline build health. Your job: monitor the currently running build and intervene if kill criteria are met.

SSH: ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206

1. Check running build: node -p "const Database = require('better-sqlite3'); const db = new Database('data/builds.db'); JSON.stringify(db.prepare('SELECT id,game_id,status,iterations,created_at FROM builds WHERE status=?').get('running') || 'IDLE')"
2. If running >45min with no Slack thread progress → flag for kill
3. Check: same test failing iter 1+2 with identical error → kill immediately
4. Check: iter 1 at 0% game-flow with obvious init failure → kill immediately
5. Report status in 3 lines: game/build, current state, action taken or "no action".
```

## Cron 2 — Slack Update (every 15 min)

Schedule: `*/15 * * * *`

```
Send a Slack progress update to Mithilesh (U0242GULG48) in channel C09J341LC2K using SLACK_TOKEN from /Users/the-hw-app/Projects/slack-helpers/.env

Spawn a sub-agent to:
1. SSH to server: ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206
2. Get current running build + queue depth from DB
3. Get recent approvals/failures (last 3 each)
4. Post to Slack with format:
   - Running: Build #X (game) at step Y — Value if completes: <what we learn/gain>. Not killed because: <kill criteria not met>
   - Queue: N builds
   - ✅ Approved since last update: [list]
   - ❌ Failed: [list with 1-line reason]
   - 🔬 R&D: [current task + status]
   - 🎓 Education slot: [current task + status]
   - 🎨 UI/UX: [current audit target + status]
   - 🚢 Shipped: [improvements since last update]
   - 🚨 Needs attention: [any flag or "none"]
Tag @U0242GULG48
```

## Cron 3 — Queue Strategist — PERMANENTLY DISABLED

Do not recreate under any circumstances. Automated queuing is disabled. All builds are queued manually, only to verify a specific fix or change.

## Cron 4 — Roadmap Manager (hourly at :47)

Schedule: `47 * * * *`

```
You are the Roadmap Manager — expert in Ralph pipeline strategy and prioritization.

Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md and /Users/the-hw-app/Projects/mathai/ralph/docs/lessons-learned.md

1. Check if any planned items are now complete based on recent commits (git log --oneline -10)
2. Check if the R&D slot has an active task — if not, identify the highest-leverage next R&D task from recent build data
3. Update ROADMAP.md if needed (mark items done, update R&D slot)
4. Report: what changed, what's the active R&D task
```

## Cron 5 — Roadmap Task Check (hourly at :23)

Schedule: `23 * * * *`

```
Roadmap task queue check. Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md

Check: is there exactly one R&D task marked 'active'? If not, identify the highest-leverage pending R&D item (look at recent build failure patterns, iteration counts, which failures are most common) and mark it active.

Check: is there a pending local test slot handoff (HTML bug or test bug classification) that has not yet been routed to R&D? If yes, that handoff becomes the R&D task immediately — HTML bugs go to CDN_CONSTRAINTS_BLOCK + T1 checks, test bugs go to test-gen category prompts.

Also check: are there any P8 priority items in the backlog that can be implemented now (no blockers, clear scope)? If yes, report which one should be next.

Report in 3 lines: R&D slot status, active task, recommended next action.
```

## Cron 6 — Slot Health Check (every 30 min)

Schedule: `*/30 * * * *`

```
Cron + slot health check. Report inline ONLY — do NOT send any Slack message.

1. Check CronList — are all 5 non-disabled crons present? Report count.
2. Check ROADMAP.md R&D slot — is one task marked 'active'? Report.
3. Check Education slot in ROADMAP.md — is one task marked 'active'? Report.
4. Check UI/UX slot — is there an active audit target in docs/ui-ux/audit-log.md? Report.
5. Check local test slot — is there a recent spec_rca update (within last session)? Report.
6. If any slot is empty, flag it: "SLOT EMPTY — launch immediately".

Output: 6 lines max, inline only.
```

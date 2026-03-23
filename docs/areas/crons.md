# Ralph Pipeline — Cron Definitions

All crons are session-only. Recreate all 7 at session start if CronList shows fewer than 7 (4 operational + slot health check + slot watchdog + analytics cron). The Code Review slot does not have its own cron — it is monitored by Slot Watchdog (step 8) and Slot Health Check (step 9).
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
4. Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md — for each slot section, extract the "Current task" and "Waiting on" fields from the Active slot state table. If the table is absent, fall back to the first **active** row in the slot's task table.
5. Read /Users/the-hw-app/Projects/mathai/ralph/docs/ui-ux/audit-log.md — extract active UI/UX audit target
6. Read latest rca.md for any game diagnosed this session — check games/<game>/rca.md first (primary; symlinked from warehouse/templates/<game>/rca.md), fall back to docs/spec_rca/<game>.md for very old games not yet migrated to games/ — extract local test verdict
7. Post to Slack with format:
   - Running: Build #X (game) at step Y — Value if completes: <what we learn/gain>. Not killed because: <kill criteria not met>
   - Queue: N builds
   - ✅ Approved since last update: [list]
   - ❌ Failed: [list with 1-line reason]
   - 🔬 Gen Quality: [current active task — 1 line] | Waiting: [what result/build/decision it needs next, or "nothing — unblocked"]
   - 🧪 Test Engineering: [current active task — 1 line] | Waiting: [what it needs, or "nothing — unblocked"]
   - ✅ Local Verification: [last fix verified, or "N/A — no fixes deployed this session"]
   - 🔍 Code Review: [last file reviewed this session, or "none this session"]
   - 🎓 Education: [current active task — 1 line] | Waiting: [what it needs, or "nothing — unblocked"]
   - 🎨 UI/UX: [current audit target — 1 line] | Waiting: [what it needs, or "nothing — unblocked"]
   - 📊 Analytics: [last ANALYTICS UPDATE summary — 1 line, or "not yet run this session"]
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
2. Check if the Gen Quality slot has an active task — if not, identify the highest-leverage next Gen Quality task from recent build data
3. Update ROADMAP.md if needed (mark items done, update Gen Quality slot)
4. Report: what changed, what's the active Gen Quality task
```

## Cron 5 — Roadmap Task Check (hourly at :23)

Schedule: `23 * * * *`

```
Roadmap task queue check. Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md

Check: is there exactly one Gen Quality task marked 'active'? If not, identify the highest-leverage pending Gen Quality item (look at recent build failure patterns, iteration counts, which failures are most common) and mark it active.

Check: is there a pending Test Engineering slot handoff (HTML bug or test bug classification) that has not yet been routed to Gen Quality? If yes, that handoff becomes the Gen Quality task immediately — HTML bugs go to CDN_CONSTRAINTS_BLOCK + T1 checks, test bugs go to test-gen category prompts.

Also check: are there any P8 priority items in the backlog that can be implemented now (no blockers, clear scope)? If yes, report which one should be next.

Report in 3 lines: Gen Quality slot status, active task, recommended next action.
```

## Cron 6 — Slot Health Check (every 30 min)

Schedule: `*/30 * * * *`

```
Cron + slot health check. Report inline ONLY — do NOT send any Slack message.

1. Check CronList — are all 7 non-disabled crons present (including Analytics at :15/:45)? Report count.
2. Check ROADMAP.md Gen Quality slot — is one task marked 'active'? Report.
3. Check Education slot in ROADMAP.md — is one task marked 'active'? Report.
4. Check UI/UX slot — is there an active audit target in docs/ui-ux/audit-log.md? Report.
5. Check Test Engineering slot — is there an active diagnosis or category-improvement task this session? Report lowest category pass rate from recent builds if available.
6. Check Local Verification slot — has any fix been shipped this session that hasn't been locally verified? If yes, flag: "UNVERIFIED FIX — run local verification immediately".
7. Check Analytics slot — when was the last Analytics output? If >30 min, flag: "ANALYTICS STALE — query DB now".
8. If any slot is empty or passive, flag it: "SLOT EMPTY — launch immediately".
9. Check Code Review slot — has any code review been run this session? If not AND there are recent commits to lib/, flag: "CODE REVIEW PENDING — run against [most recently modified lib/ file]".

Output: 10 lines max, inline only.
```

## Cron 7 — Slot Watchdog (every 5 min)

Schedule: `*/5 * * * *`

```
Slot watchdog. Check all 7 slots for idleness and launch sub-agents for any that are idle. Report inline ONLY — do NOT send Slack.

IDLE DETECTION — check each slot:

1. Gen Quality slot: Read /Users/the-hw-app/Projects/mathai/ralph/ROADMAP.md ## R&D table.
   IDLE if: no row has status containing "active".
   ACTION: Spawn sub-agent — use last Analytics output (if available) to pick the highest-leverage pending item; otherwise look at Gen Quality backlog + recent build failure patterns. Mark it active in ROADMAP.md and begin the task.

2. Test Engineering slot: Read ROADMAP.md ## Test Quality (or Test gen) section.
   IDLE if: no task is marked active AND no build is currently running that a diagnosis depends on.
   ACTION: Spawn sub-agent — use last Analytics output lowest-category finding if available; otherwise SSH to server, query DB for lowest category pass rate, begin Phase B improvement (draft CT rule, implement in lib/prompts.js, run tests, deploy).

3. Education slot: Read /Users/the-hw-app/Projects/mathai/ralph/docs/education/trig-session.md and ROADMAP.md Education section.
   IDLE if: no spec review, session planning, pedagogical audit, interaction pattern work, or curriculum alignment work has been done in the last 30 min. A running build does NOT make this slot active — the slot must be doing actual Education work, not build-watching.
   ALWAYS-AVAILABLE: real-world-problem spec review, Session 2 area identification, soh-cah-toa-worked-example pedagogy audit, interaction-patterns.md L3/L4 gaps, Session Planner architecture design.
   ACTION: Spawn sub-agent — advance education slot (draft/review spec for next game, or document findings from last approved game, or audit interaction-patterns.md for gaps).

4. UI/UX slot: Read /Users/the-hw-app/Projects/mathai/ralph/docs/ui-ux/audit-log.md (or games/<game>/ui-ux.md).
   IDLE if: last audit entry is >4 hours old AND there are approved games with no audit (check warehouse/templates/* for games missing ui-ux.md).
   ACTION: Spawn sub-agent — run diagnostic.js against next unaudited approved game, produce ui-ux.md with issue list.

5. Cross-slot handoff routing: Read games/*/ui-ux.md for any game audited this session.
   For each (a) gen-prompt-rule finding NOT yet in ROADMAP.md Gen Quality backlog: add it as a pending Gen Quality task.
   For each (d) test-coverage-gap finding NOT yet in ROADMAP.md Test Engineering backlog: add it.
   This step runs every fire — UI/UX findings must never sit unrouted.

6. Analytics slot: Check when last Analytics output was produced this session.
   IDLE if: no Analytics output in last 30 min.
   ACTION: Spawn sub-agent — query DB for (a) lowest category pass rate, (b) top failure patterns, (c) last 10 builds approval rate, (d) never-approved game list. Format output as ANALYTICS UPDATE block. Store result for Slot Watchdog next fire.

7. Local Verification slot: Check if any fix has been shipped this session without local verification.
   IDLE if: any unverified fix exists (gen rule, T1 check, test-gen rule deployed but not locally validated).
   ACTION: Spawn sub-agent — download most recent relevant failed build HTML from GCP, apply the unverified fix to the HTML, run diagnostic.js + Playwright locally, report whether fix is verified.

8. Code Review slot: Check if any deploy occurred in the last hour without a code review.
   IDLE if: `git log --oneline --since='1 hour ago' -- lib/ worker.js server.js` returns commits AND no code review has been reported this session.
   ACTION: Spawn sub-agent — `git log --oneline -3 -- lib/ worker.js server.js`, pick the most recently modified complex file (prefer pipeline-fix-loop.js, prompts.js, validate-static.js), review for logic errors/edge cases/test gaps, report findings to ROADMAP.md.

INTER-SLOT FEED RULES (always apply, not just when idle):
- UI/UX (a) finding → Gen Quality: "Add gen rule: <exact rule text>" — Gen Quality implements, tests, deploys
- UI/UX (d) finding → Test Engineering: "Add assertion: <what Playwright check was missing>" — Test Engineering adds to test-gen prompts
- UI/UX (b) finding → Education: "Update spec: <visual requirement>" — Education updates games/<game>/spec.md
- Build diagnosis "HTML bug" verdict → Gen Quality: "New CDN constraint: <rule>" — Gen Quality adds T1 check + gen rule
- Build diagnosis "test bug" verdict → Test Engineering: "Fix test-gen: <category> <rule>" — Test Engineering implements immediately
- Education approved game → UI/UX: audit immediately after approval to catch visual issues before deployment
- Gen Quality rule shipped → Local Verification: verify against past failed HTML before queuing build
- Analytics output → Gen Quality + Test Engineering: use ranked next-action list to assign specific tasks

IMPORTANT CONSTRAINTS:
- "Waiting for a build to complete" is NOT idle — if a build is running and the slot is actively watching it for a decision, that slot is not idle.
- Only act if genuinely idle. A slot that produced output in the last 30 min is not idle.
- Each action must spawn a real sub-agent with a concrete task — not just report.
- After launching sub-agents, report: one line per slot + handoffs routed. Format: "Gen Quality: ACTIVE — [task]" or "Gen Quality: IDLE → launched [action]"

Output: 7 lines (one per slot) + count of sub-agents launched + "N UI/UX handoffs routed".
```

## Cron 8 — Analytics Cron (every 30 min at :15/:45)

Schedule: `15,45 * * * *`

```
Analytics cron. Report inline ONLY — do NOT send Slack. This is slot fuel, not a status report.

Run ALL of these DB queries via SSH to server (cd /opt/ralph before each):

1. Category pass rates (Test Engineering priority):
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"const db=require('./lib/db'); console.log(JSON.stringify(db.db.prepare('SELECT category, ROUND(AVG(CAST(passed AS FLOAT)/NULLIF(total,0)),2) as rate, COUNT(*) as builds FROM test_progress GROUP BY category ORDER BY rate ASC').all()))\""

2. Recent failure patterns (Gen Quality priority):
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"const db=require('./lib/db'); console.log(JSON.stringify(db.db.prepare('SELECT pattern, COUNT(*) as freq FROM failure_patterns GROUP BY pattern ORDER BY freq DESC LIMIT 10').all()))\""

3. First-attempt rate (last 15 builds):
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"const db=require('./lib/db'); const builds=db.db.prepare('SELECT id,game_id,status,iterations FROM builds WHERE status IN (?,?) ORDER BY id DESC LIMIT 15').all('approved','failed'); console.log(JSON.stringify(builds))\""

4. Never-approved games (>3 builds, no approval):
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cd /opt/ralph && node -e \"const db=require('./lib/db'); console.log(JSON.stringify(db.db.prepare('SELECT game_id, COUNT(*) as build_count FROM builds WHERE status IN (?,?,?) GROUP BY game_id HAVING COUNT(*)>3 AND game_id NOT IN (SELECT game_id FROM builds WHERE status=?)').all('failed','cancelled','running','approved')))\""

Format output as:
ANALYTICS UPDATE (HH:MM):
- Test Engineering: [lowest category] at [X]%
- Gen Quality: [top failure pattern] (freq [N])
- First-attempt rate (last 15): [N/15 approved at iter=0]
- Never-approved: [game] ([N] builds)
- Local Verification queue: [list any fixes deployed this session not yet verified locally]

Output: 6 lines max.
```

# Slot Operating Procedures

Full operating instructions for all 7 mandatory slots. Referenced from CLAUDE.md Rules 13–20.

**Context7 is the preferred source for all library docs.** Use `mcp__context7__resolve-library-id` to find the library, then `mcp__context7__query-docs` to fetch current docs. Fall back to WebFetch for standards (WCAG, MDN, HIG, NCERT) not in Context7.

---

## Rule 13 — Gen Quality Slot

**State tracking:** `ROADMAP.md` R&D section — Current task / Waiting on / Blocked by table (always maintained).

**Gen Quality is always running.** One sub-agent must ALWAYS be actively working on a Gen Quality task. The moment one completes, immediately pick the next and launch a new sub-agent in the same response. One item must always be marked `active` in `ROADMAP.md` under `## R&D`.

**Gen Quality inputs — four channels:**
1. **Test Engineering handoffs** — every diagnosis session ends with a classified verdict (HTML bug or test bug):
   - HTML bug → new rule in `CDN_CONSTRAINTS_BLOCK` (`lib/prompts.js`) + T1 check in `lib/validate-static.js`
   - Test bug → fix in test-gen category prompts in `lib/prompts.js`
2. **UI/UX handoffs** — every (a) gen prompt rule finding from a UI/UX audit becomes a Gen Quality task; implement in `lib/prompts.js` and deploy
3. **Live build data** — iteration counts, failure patterns, which test categories fail most
4. **Analytics slot priority ranking** — highest-leverage pending item from the last Analytics output (failure pattern frequency + category pass rates)

**Prioritise:** Test Engineering handoffs > Analytics top pattern > test gen quality > fix loop accuracy > review false positives > infra reliability

**Gen Quality process:** Trace → Hypothesize (one falsifiable line) → Prototype → Local Verification (see Rule 18) → Measure (queue 1-2 builds) → Ship or kill

**Build verification required:** Every hypothesis touching game quality MUST be verified with at least one real build showing a before/after metric.

**Context7 + WebFetch mandate:**
- CDN package docs: use Context7 for API docs for CDN components (ProgressBarComponent, FeedbackManager, VisibilityTracker, ScreenLayout, TimerComponent)
- Browser compatibility: MDN via WebFetch for any CSS/JS feature being required or banned
- WCAG accessibility: `https://www.w3.org/WAI/WCAG21/quickref/` via WebFetch
- Past failure patterns: read `docs/lessons-learned.md` and `docs/failure-patterns-tracker.md` before proposing any new rule

Every Gen Quality sub-agent must start with a Context7 query or WebFetch before writing any rule. "I believe X" is not acceptable.

**Constraints:** Gen Quality never blocks critical work. Must produce a measurable result — "made it cleaner" is not Gen Quality.

---

## Rule 14 — Test Engineering Slot

**State tracking:** `ROADMAP.md` Test Engineering section — Current task / Waiting on / Blocked by table.

**Test Engineering is always running.** Diagnosis and test gen improvement are one slot — every diagnosis finding feeds directly into a test gen fix. Purpose: (1) reduce test execution time, (2) improve reliability, (3) ensure tests represent real user behaviour.

**This slot is never "caught up."** Every category below 100% pass rate is active work. Every approved build with weak coverage is active work. Every test that fires on a correct game is active work.

**Three-phase loop (always running):**

### Phase A — Diagnosis
Run `diagnostic.js` against a recently failed build. Must run the browser — reading HTML does not count.
- How to pick: Query DB for recent failures → skip cancelled/approved/queued → prioritise games with incomplete RCA §2/§3.
- Output: Update `games/<game>/rca.md` with §2 (evidence) and §3 (POC). Classify verdict:

| Verdict | Meaning | Next action |
|---------|---------|-------------|
| **HTML bug** | Game broken in browser | POC fix → hand to Gen Quality as gen prompt rule + T1 check |
| **Test bug** | Game correct, tests wrong | Test-gen prompt fix → implement immediately in this slot |

### Phase B — Test gen improvement
Analyse category pass rates and fix the lowest-performing category.
- Query DB: `SELECT category, AVG(CAST(passed AS FLOAT)/NULLIF(total,0)) as rate FROM test_progress GROUP BY category ORDER BY rate ASC`
- For the lowest category: find the specific failing assertion pattern, draft a CT rule, add it to `lib/prompts.js`, run tests, deploy.
- Every session must ship at least one concrete fix OR a documented finding with a proposed fix.

### Phase C — Local verification
After any test-gen rule is added to `lib/prompts.js`, immediately verify before queuing a build.
- Download a recently failed game's HTML from GCP: `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
- Apply the fix manually to the HTML, run `node diagnostic.js` + Playwright locally.
- Report: "Fix verified: [yes/no] against build #X — [what was tested]". If no: iterate on fix before queuing.

**Always-available work (no build required):**
- Category pass rates from DB (Phase B query) — always computable
- GCP build artifacts — test output from every past build is permanently accessible
- `docs/spec_rca/` — every "test bug" verdict that hasn't had a fix shipped is queued work
- Approved builds — compare their test assertions against failed builds to identify what good tests look like
- Timing analysis — which tests have flaky timing, which assertions use hard sleeps instead of waitForPhase

**Context7 + WebFetch mandate:**
- Playwright docs: use Context7 (`resolve-library-id: "playwright"`) to verify correct assertion API syntax before adding a CT rule (e.g., `expect.poll()`, `waitForSelector`, `toBeVisible` semantics)
- Accessibility testing: `https://www.w3.org/WAI/WCAG21/quickref/` via WebFetch — WCAG 2.1 criteria
- a11y testing patterns: WebFetch for ARIA live regions, focus management, keyboard navigation in browser automation
- CDN component behavior: Context7 or WebFetch to understand correct event sequences before writing assertions

Every test-gen rule must be grounded in either: (a) a Context7 or fetched Playwright/CDN doc confirming correct API usage, or (b) observed failure evidence from a real build.

**Constraints:** Never blocks critical pipeline work. "No new failures to diagnose" is not idle — switch to Phase B immediately.

---

## Rule 15 — Education Slot

**State tracking:** `ROADMAP.md` Education section — Current task / Waiting on / Blocked by table.

**Education implementation is always running.** R&D targets pipeline reliability; Education targets learning science and content quality.

**The Education slot is never idle.** The slot's scope is "build the capability to autonomously generate complete learning sessions for any curriculum area." A running build is irrelevant — spec review, session planning, pedagogical audit, and interaction pattern work proceed independently.

**Priorities:** (1) Next unbuilt game in active session sequence, (2) New interaction patterns at apply/analyze/create Bloom's level, (3) New session plan for a different curriculum area.

**Process:** Research → Spec draft (check CDN compliance) → Build verification → Measure learning quality → Ship or iterate.

**Always-available Education work (no build required):**
- **Spec review** — review pending game specs for Bloom level accuracy, misconception coverage, production vs recognition demand, CDN compliance, test hook clarity
- **Session planning** — identify and plan the next curriculum area (Session 2, Session 3). Ground in NCERT/CC standards, draft prerequisite DAG, identify required interaction patterns
- **Interaction patterns** — `docs/education/interaction-patterns.md` is always incomplete at L3/L4 Bloom levels. Document patterns immediately after approval
- **Pedagogical quality audit** — any approved game that hasn't had a pedagogy audit is active work. Check: does the game require the learner to *produce* the cognitive operation, or just recognize the answer?
- **Misconception coverage** — does each game target at least one documented misconception? Check `games/<game>/spec.md`
- **Session Planner architecture** — `docs/education/README.md` §7 describes the long-term vision. Each subsystem (goal parsing, prerequisite analysis, session design, spec generation) can be designed independently
- **Curriculum alignment** — map approved games to NCERT chapter/section and CC standard codes

**Context7 + WebFetch mandate:**
- CDN component APIs: use Context7 for current CDN component docs when spec references specific component behavior
- NCERT textbooks: Class 9/10 Mathematics chapters from NCERT official site (WebFetch)
- Common Core standards: CC Math standards for the relevant grade band (WebFetch)
- Cognitive science research: papers on worked examples (Sweller), ZPD (Vygotsky), spaced repetition, Bloom's taxonomy (WebFetch)
- Khan Academy / BYJU's: how leading platforms teach the target concept (WebFetch)
- Wikipedia: concept prerequisites and curriculum progression (WebFetch)
- Misconception databases: documented student misconceptions in the target concept area (WebFetch)

Every Education sub-agent planning a new session or game must fetch at least 2 external sources before writing any spec or session plan.

**Example workflow for planning Session 2:**
1. Fetch NCERT Class 9/10 chapter list → identify what follows trig in Indian curriculum
2. Fetch Common Core HS Math standards → find the US progression
3. Fetch 1-2 misconception papers/articles for the target concept
4. THEN draft the session plan

**Documentation mandate — after every Education build result, update ALL of:**
1. `docs/education/trig-session.md` (or relevant session file)
2. `docs/education/interaction-patterns.md`
3. `docs/education/README.md`
4. `ROADMAP.md` Education section
5. `games/<game>/rca.md`

**Constraints:** Must produce a measurable artifact per session. Education slot never blocks critical pipeline work.

---

## Rule 16 — UI/UX Slot

**State tracking:** `docs/ui-ux/audit-log.md` — Current task / Waiting on / Blocked by entry (maintained each session).

**UI/UX review is always running.** One sub-agent must ALWAYS be actively auditing the visual and interaction quality of approved games.

**What UI/UX covers:** visual layout and spacing, mobile responsiveness (480px), colour contrast and accessibility, feedback clarity (correct/incorrect states), animation and transition quality, progress indicators, button affordance, error states, loading states, consistency across games in a session — **and full interactive flow from start to end screen.**

**How to pick the target game:** Start with the most recently approved game that has not had a UI/UX audit. Work backwards through the approved game library. Record audit status in `docs/ui-ux/audit-log.md`.

**Audit is always a full browser playthrough — not static HTML analysis.** Static analysis is insufficient and cannot detect the most critical class of issues.

**Required audit procedure (every game, no exceptions):**
1. Download the approved HTML: `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
2. Run `node diagnostic.js` from the repo root — this serves the HTML locally, injects the Playwright harness, and drives the game through every phase with screenshots
3. **Complete the full intended experience from start to end screen** — play at least one round correctly, one incorrectly, advance through all phases, reach the results/completion screen. If the game does not reach the end screen, that is a Critical P0 issue.
4. At every step, verify: buttons respond when clicked, phases advance correctly, feedback appears, progress updates, no phase gets stuck, no silent failures
5. Capture screenshots at: start screen, first interaction, correct feedback, incorrect feedback, phase transition, results screen

**Flow issues to explicitly check (these are P0 — game-breaking):**
- Button clicked → nothing happens (no feedback, no phase change, no visual response)
- Game stuck in a phase (cannot advance, no timeout, no exit)
- Results/end screen never reachable from normal play
- Correct answer doesn't register as correct
- Progress bar or lives counter doesn't update
- Game ends prematurely (exits before all rounds complete)

**Required output per session:**
1. Full playthrough verdict: "Completed end-to-end: yes/no" — if no, P0 issue with exact step where it broke
2. Screenshot evidence for every phase transition
3. Issue list — categorise as: (a) gen prompt rule, (b) spec addition, (c) CDN constraint, (d) test coverage gap, **(P0) game-breaking flow bug → re-queue immediately**
4. Update `games/<game>/ui-ux.md` with game, date, playthrough verdict, issues found, and resolution path

**Context7 + WebFetch mandate:**
- WCAG 2.1 quickref: `https://www.w3.org/WAI/WCAG21/quickref/` via WebFetch — for any contrast, focus, ARIA, or keyboard finding
- Apple HIG touch targets: minimum 44×44pt touch target specification (WebFetch from HIG)
- Material Design: spacing, elevation, and typography guidelines for mobile-first design (WebFetch or Context7)
- Color contrast: use WCAG contrast ratio formula (4.5:1 for normal text, 3:1 for large) — report actual ratio
- MDN: use Context7 for CSS property behavior (position:fixed, z-index stacking, viewport units) before WebFetch

Every UI/UX finding must cite the standard it violates (WCAG SC X.X.X, HIG touch target spec, etc.).

**Cross-slot handoffs:**

| Finding type | Route to | Action |
|-------------|----------|--------|
| **(a) Gen prompt rule** | Gen Quality | Add to ROADMAP.md Gen Quality backlog with exact rule text |
| **(b) Spec addition** | Education | Flag to Education — add visual requirement to `games/<game>/spec.md` |
| **(c) CDN constraint** | Document only | Note in `games/<game>/ui-ux.md` as CDN-blocked |
| **(d) Test coverage gap** | Test Engineering | Propose Playwright assertion (CSS content check, visibility check, aria-live check) |
| **Visual bug in approved HTML** | Build queue | Re-queue with UI/UX issue list as targeted fix context |

**Routing protocol:** After every audit:
- (a) issues → add to ROADMAP.md Gen Quality backlog with "source: UI/UX audit <game>"
- (d) issues → add to ROADMAP.md Test Engineering backlog with the specific assertion that was missing
- Never leave findings as "noted" — every finding has an owner slot and a next action

**Constraints:** UI/UX never blocks critical pipeline work. Must produce a documented issue list per session — "looks fine" is not an audit.

---

## Rule 18 — Local Verification Slot

**State tracking:** One line in `ROADMAP.md` Local Verification section after each action: "[date] [what was verified] | Waiting: [what's next]"

**Local verification closes the fix cycle.** Every fix we ship to `lib/prompts.js` or `lib/validate-static.js` currently requires a full build (25-35 min) to verify. Local verification reduces this to 5-10 min.

**Trigger:** Any time a gen rule, T1 check, or test-gen rule is shipped.

**Process:**
1. Identify the most recent failed build that would have been caught by this fix
2. Download its HTML: `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/<gameId>/builds/<buildId>/index.html" -o /tmp/<gameId>/index.html`
3. Apply the fix manually to the HTML (add the missing rule, strip the banned pattern, etc.)
4. Run `node diagnostic.js` — verify the issue is resolved in browser
5. Run Playwright tests locally against the patched HTML
6. If passes: fix is verified → queue build; If fails: iterate on fix before queuing

**For T1 validator changes:** Run `npm run validate` against the problematic HTML first (pre-fix), confirm it doesn't catch the bug. Then against patched HTML (post-fix), confirm it does. This verifies both sides.

**For gen rule changes:** Download 2-3 recent failed builds, inspect if the rule would have prevented the failure. Gen rules can't be locally tested against future generation, but can be verified against past failures.

**Output per verification:** One line — "Fix verified: [yes/no] against build #X — [what was tested]". If no: what needs to change.

**Never queue a build without local verification first** (exception: builds where the fix is to the gen prompt itself and there's no existing HTML to test against — document this explicitly).

---

## Rule 19 — Analytics Slot

**State tracking:** One line in `ROADMAP.md` Analytics section after each run: "[date] [what queries ran + top finding] | Waiting: [what's next]"

**Analytics is the prioritization brain.** Without it, each slot picks its own next task based on local knowledge. With it, all slots receive a globally-optimal ranked next-action based on real DB data.

**Runs every 30 minutes.** The Analytics cron (at :15 and :45) queries the DB and produces a ranked next-action list. This is not a human-facing report — it's slot fuel.

**Queries to run:**
1. Category pass rates: `SELECT category, AVG(CAST(passed AS FLOAT)/NULLIF(total,0)) as rate FROM test_progress GROUP BY category ORDER BY rate ASC` — lowest category goes to Test Engineering
2. Failure patterns: `SELECT pattern, COUNT(*) as freq FROM failure_patterns GROUP BY pattern ORDER BY freq DESC LIMIT 5` — top pattern goes to Gen Quality
3. First-attempt approval rate (last 10 builds): count of approved builds with iterations=0 vs total recent
4. Never-approved games: games with >3 builds, 0 approved — candidates for deep diagnosis

**Output format:**
```
ANALYTICS UPDATE (HH:MM):
- Test Engineering next: [category] at [X]% pass rate — [specific failing pattern if known]
- Gen Quality next: [pattern] (freq [N]) — [specific rule candidate]
- Local Verification queue: [N] fixes shipped since last verification
- Never-approved priority: [game] — [build count], [brief failure pattern]
```

**This output feeds Slot Watchdog's idle detection.** When Slot Watchdog fires and finds a slot idle, it uses the last Analytics output to assign a specific task rather than generic backlog exploration.

---

## Rule 20 — Code Review Slot

**State tracking:** One line in `ROADMAP.md` Code Review section after each action: "[date] [file reviewed + finding] | Waiting: [what's next]"

**Code review is always running.** The Ralph pipeline codebase (`worker.js`, `server.js`, `lib/*.js`) is modified frequently. Without proactive code review, bugs surface only when builds fail (30-min feedback cycle). Code Review catches them before that.

**This reviews pipeline source code — NOT generated game HTML.**

**Triggers (any of these starts a review cycle):**
1. Any deploy to the server — review the changed files within 30 min of deploy
2. Any commit to `lib/pipeline-fix-loop.js`, `lib/prompts.js`, or `lib/validate-static.js` — highest-risk files
3. Hourly sweep — `git log --oneline -3` to find recently modified files; pick the most complex changed file

**Review focus areas:**
- **Logic errors:** Does the control flow handle all branches? Are there off-by-one errors, wrong comparisons, inverted conditions?
- **Edge cases:** What happens when the LLM returns empty string? When the build DB has no running build? When SSH fails mid-deploy?
- **Error handling:** Are all async calls wrapped in try/catch? Are errors logged with enough context to diagnose?
- **Prompt rule coherence:** In `lib/prompts.js` — do any rules contradict each other? Does rule X undo what rule Y requires?
- **Test coverage gaps:** Is every new function tested? Are error paths tested or only happy paths?
- **Race conditions:** In `worker.js` — could two concurrent operations write to the same DB row? Could a stalled build lock prevent cleanup?

**Context7 + WebFetch mandate:**
- Node.js built-ins: use Context7 (`resolve-library-id: "node"`) for fs, child_process, http API behavior
- better-sqlite3: use Context7 (`resolve-library-id: "better-sqlite3"`) — transaction semantics, WAL mode, prepared statement reuse
- BullMQ: use Context7 (`resolve-library-id: "bullmq"`) — lock semantics, stall detection, retry configuration
- Express: use Context7 (`resolve-library-id: "express"`) — middleware ordering, error handler signatures, async error propagation
- OWASP: WebFetch for any security-relevant code path (input validation, SQL construction, file path handling)

Every code review finding that involves an API behavior claim must cite the source (Context7 doc or URL).

**Output per review cycle:**
1. Files reviewed (list)
2. Issues found — categorized: (a) logic error → fix immediately, (b) edge case → add to ROADMAP.md backlog, (c) test gap → add unit test, (d) architectural risk → flag to Analytics
3. If no issues: "Clean — no issues found in [file]"

**Constraints:** Code Review never delays critical pipeline work. Always run `npm test` after any code review fix before deploying.

# Slot Activity Principle + Cross-Slot Feed Links

## Slot Activity Principle (applies to all seven slots)

**A slot is never passive.** "Waiting for a build", "nothing to do until X completes", and "monitoring" are not slot activities. Every slot has an unbounded backlog of available work that does not depend on any build being running:

- **Gen Quality:** Past build logs, failure pattern analysis, hypothesis drafting, prompt rule writing, doc updates — all available at any time from existing DB + docs.
- **Test Engineering:** Category pass rates are always computable from DB. Every category below 100% is active work. Past failed game HTMLs are permanently on GCP — `diagnostic.js` can run on any of them. Every "test bug" verdict in `docs/spec_rca/` that hasn't had a fix shipped is queued work.
- **Education:** Next game spec can always be drafted, interaction-patterns.md always has gaps to fill, past approved games can always be audited for pedagogical quality.
- **UI/UX:** The approved game library grows with every build. Any approved game that hasn't been visually audited is valid work.
- **Local Verification:** Any fix shipped this session that hasn't been locally validated is immediate work. Download the most recent relevant failed HTML from GCP and run Playwright now.
- **Analytics:** Category pass rates + failure patterns + first-attempt rate + never-approved list are always computable from DB. If last output is >30 min old, run immediately.
- **Code Review:** Any file in `lib/` or `worker.js`/`server.js` modified in the last 3 commits is always available for review.

**Passive states — always trigger immediate next-task planning:**

| Passive state | What to do instead |
|--------------|-------------------|
| Waiting for a build to complete | Pick next independent task from the backlog above and start it now |
| Waiting for a deploy to finish | Same — deploy is async, slot keeps working |
| Waiting for another slot's output | Same — work on anything from the backlog that doesn't depend on it |
| Monitoring / watching logs | Not a task. Report status in one line, then start the next task |
| "Nothing to do until X" | X is never true. Enumerate the backlog above and pick one |
| Local Verification idle | Download most recent failed build HTML, apply last shipped fix, run Playwright |
| No Analytics in >30 min | Query DB immediately for category rates + failure patterns + never-approved games |
| Code Review idle | Run `git log --oneline -5`, pick most recently modified lib/ file, review for logic errors, edge cases, test coverage gaps |

**The rule:** If the current step requires waiting, that is fine — but the slot must immediately identify the next independent task and start it in the same response. A slot that is only waiting is a slot that is empty.

---

## Cross-Slot Feed Links (mandatory — slots actively feed each other)

Slots are not independent. Every slot produces outputs that other slots must act on. These feeds are always active:

| Source | Finding | Target slot | Required action |
|--------|---------|-------------|-----------------|
| UI/UX | (a) gen prompt rule | **Gen Quality** | Add to ROADMAP.md Gen Quality backlog with exact rule text; Gen Quality implements in `lib/prompts.js`, tests, deploys |
| UI/UX | (d) test coverage gap | **Test Engineering** | Add to ROADMAP.md Test Engineering backlog with the specific assertion; Test Engineering adds to test-gen prompts |
| UI/UX | (b) spec addition | **Education** | Update `games/<game>/spec.md` with visual requirement; Education slot owns the update |
| UI/UX | visual bug in approved HTML | **Build queue** | Re-queue with the UI/UX issue list as targeted fix context |
| Test Engineering | "HTML bug" verdict | **Gen Quality** | New CDN constraint → Gen Quality adds T1 check + gen prompt rule in same response |
| Test Engineering | "test bug" verdict | **Test Engineering (self)** | Fix test-gen prompts immediately — do not defer |
| Education | game approved | **UI/UX** | Trigger UI/UX audit immediately — audit before declaring the game "done" |
| Gen Quality | new gen rule shipped | **Test Engineering** | Verify the rule is tested by at least one unit test; add if missing |
| Gen Quality | new gen rule shipped | **Local Verification** | Download most recent relevant failed HTML, confirm fix would have helped, report verified/not |
| Build | iteration >1 failure pattern | **Gen Quality** | Pattern becomes active Gen Quality input — check if it's a known class, update ROADMAP if new |
| Analytics | Lowest category pass rate | **Test Engineering** | Assign as active Phase B target — fix that category's test-gen prompts next |
| Analytics | Highest-frequency failure pattern | **Gen Quality** | Assign as active task — implement gen prompt rule or T1 check for that pattern |
| Code Review | logic error or edge case | **Gen Quality** | Add T1 check or gen rule that would catch the issue |
| Code Review | untested code path | **Test Engineering** | Add unit test to test/*.test.js covering the gap |
| Code Review | architectural risk | **Analytics** | Flag in ANALYTICS UPDATE output for prioritization |

**Routing protocol:** When a slot produces a handoff, it must:
1. Write the finding to the target slot's input (ROADMAP.md backlog, games/<game>/spec.md, etc.)
2. Note "→ handed to [slot]" in its own output doc
3. Never leave a finding as "noted" — every finding has an owner and a next action

**Cron 7 (Slot Watchdog) enforces this** — every 5 minutes it checks for unrouted UI/UX findings and adds them to the appropriate backlogs.

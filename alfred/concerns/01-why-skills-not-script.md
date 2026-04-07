# Why Alfred (Skills + Orchestrator) — Honest Comparison vs Pipeline-v2

## TL;DR

- Pipeline-v2 also uses Claude Agent SDK. Both systems are "Claude with tools." This doc is NOT "scripts vs LLMs."
- The real difference is **organizational**: pipeline-v2 keeps all generation knowledge in one 4007-line file (`lib/prompts.js`); Alfred keeps it in ~108 small markdown files, one concern per file.
- Skills do **not** magically prevent contradictions. Small organized files just make contradictions easier to **find and fix** in code review.
- Alfred is explicitly designed for **iteration across many sessions** — the system-loop (ship → capture → gauge → iterate) is the core model, not a fix loop bolted on.
- Alfred is not inherently more correct. It is structurally better at three things: findability, iteration, and progressive disclosure.

---

## What is the SAME between Alfred and pipeline-v2

| Dimension | Both systems |
|-----------|--------------|
| LLM | Claude (via `@anthropic-ai/claude-agent-sdk`) — see `pipeline-v2/agent.js` line 28 |
| Sub-agents | Both spawn agents; pipeline-v2 via SDK session resume, Alfred via the Agent tool |
| Tools | Read/Write/Edit/Bash/Glob/Grep + Playwright MCP |
| Knowledge in markdown | Both can have skill-style markdown (pipeline-v2 has `pipeline-v2/GAME_PROMPT.md`) |
| CDN constraints, contracts, archetypes | Same target platform, same FeedbackManager, same `gameState`/`game_complete` schema |
| Iteration within a build | Both have a test → fix → re-test loop |
| Categorized testing | Both use the same 5 categories (game-flow, mechanics, level-progression, edge-cases, contract) |
| Final review + rejection fix | Both have a final review step with up to N rejection-fix attempts |
| Visual review with screenshots | Both use Playwright to screenshot game states |

If you compare them on "Does it use Claude SDK? Does it have skills? Does it iterate?" — the answer is **yes** for both. Saying "Alfred has skills" without context is misleading.

---

## What is ACTUALLY different

| Dimension | Pipeline-v2 | Alfred | Why it matters |
|-----------|-------------|--------|----------------|
| Knowledge file count | 1 main file (`lib/prompts.js`, 4007 lines) + GAME_PROMPT.md | ~108 small markdown files organized by concern | Updating one rule means touching one small file vs scrolling a giant blob |
| Largest single file | 4007 lines | Skills target ≤300 lines per `SKILL.md` | A small file fits in a human's head; a 4000-line file does not |
| Knowledge loaded per build | The whole prompt (every builder concatenates large blocks) | Only the relevant skills via progressive disclosure | LLM context stays focused on what the current step needs |
| Organization principle | Functions that build prompt strings | One folder per skill, one concern per file, references on demand | Findability via filenames + grep |
| Iteration model | Inner loop only: test → fix → re-test inside one build | Inner loop **plus** outer loop: ship → student data → gauge → update content/spec → rebuild | Iteration is the lifecycle, not a bug-fix mechanism |
| Lesson capture | Append a paragraph to the 4000-line prompt | Update the relevant skill file (or its `reference/`) | Both are possible; small files are easier to maintain and review |
| Anthropic alignment | Big system prompt — pattern Anthropic explicitly recommends against for complex agents | Progressive disclosure pattern from Anthropic's Agent Skills guidance | We are following published guidance, not guessing |

The list above is the honest claim. None of these are "magic." They are organizational properties.

---

## The contradiction concern (supervisor was right)

> "Self-contradictory statements can also be in skills — skill by default don't fix that == its the content in those files."

**Conceded.** Skills are markdown files. A human (or an LLM) can write contradictory markdown files just as easily as contradictory JS strings. The skill format does not enforce correctness.

What the structure actually buys is this:

1. **Smaller files → contradictions are visible in code review.** A 300-line file can be read end-to-end in 5 minutes. A 4007-line file cannot.
2. **One concern per file → cross-file contradictions are findable by grep.** If two files mention `ProgressBarComponent.destroy`, you can list them in one command.
3. **Tree structure → ownership and locality.** The "progress bar" rule lives in one place; you don't have to wonder where to look.
4. **Principle 1 (single source of truth) is enforced by file boundaries**, not by hope. It can still be violated, but the violation is observable.

### Concrete contradiction in `lib/prompts.js` (today, real)

| Line | Says |
|------|------|
| 93 | "NEVER call progressBar.destroy() immediately in endGame() — use 10s delay: `setTimeout(() => { progressBar?.destroy(); }, 10000);`" |
| 1541–1559 | "GEN-PROGRESSBAR-DESTROY: NEVER use setTimeout to destroy ProgressBarComponent... `setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000); // ← NEVER do this`" |
| 51 | "A delayed destroy via setTimeout IS compliant. Either immediate or delayed cleanup PASSES." |

Three statements in one file: "always use 10s setTimeout-destroy", "never use setTimeout-destroy", and "either is fine." A generation agent reads all three and picks one. This is not a hypothetical — these lines are in `lib/prompts.js` right now.

### How Alfred's structure would catch this

- The `progressBar` rule would live in one file, e.g. `alfred/skills/game-building/reference/cdn-components.md`, under a `ProgressBarComponent` heading.
- A grep for `progressBar.destroy` across `alfred/skills/` would return one location, not three.
- Adding a new rule about cleanup forces an edit to that single file; the diff is reviewable in seconds.
- It does not prevent a human from writing a self-contradictory rule **inside that file**, but the contradiction would be on adjacent lines, not 1448 lines apart.

Honest framing: **organization makes contradictions findable, not impossible.**

---

## The iteration concern (front and center)

> "Are you proposing we won't need iteration to fix game i.e we are not designing for long running agents? and expecting game in one go?"

**No.** Alfred is explicitly designed for iteration across many sessions. The current concern doc downplayed this. Here is the iteration model:

### Two loops, not one

| Loop | Where | What it fixes | Time scale |
|------|-------|---------------|------------|
| Inner loop (build-time) | `game-testing` skill, `final-review` skill | Bugs found by Playwright tests + visual review during one build | Minutes (within a build) |
| Outer loop (lifetime) | `gauge` skill + `iteration` skill + Phase 4 of orchestration | Pedagogy/content/spec problems found by real students playing the deployed game | Days/weeks (across many sessions) |

Pipeline-v2 has the **inner loop only**. Alfred has both. The outer loop is what the supervisor asked about.

### The outer loop, concretely

From `alfred/design/system-loop.md`:

```
Game Creator → Pipeline → Deployed Artifact → Student plays → Data captured
        ↑                                                            │
        └─── Gauge (Claude + MCP) ←───────────────────────────────────┘
```

From `alfred/skills/orchestration/SKILL.md` Phase 4:
- Step 11 — **Gauge**: query MCP for per-round accuracy, top misconceptions, abandonment, completion rate, learning-vs-guessing signal.
- Step 12 — **Iterate**: pick the cheapest fix that addresses the finding.

### Three iteration depths (defined in the gauge skill)

| Depth | Trigger | Cost | Example |
|-------|---------|------|---------|
| Content swap | Wrong distractors, bad ordering, one round too hard | Minutes (no rebuild) | Replace round 7 question with an easier bridge |
| Spec tweak | Pedagogy gap, wrong feedback for a misconception, lives system too punitive | Hours (rebuild) | Add misconception-specific feedback to spec, rebuild |
| Full rebuild | Code bug, wrong archetype, fundamentally unengaging | Hours (new HTML) | Rebuild from corrected spec with new archetype |

The gauge skill explicitly forbids recommending a rebuild when a content swap will do. This is a lifecycle principle, not a build-time check.

### "Long-running agents"

Alfred is designed so the **same game iterates across many sessions over weeks**. The orchestrator stops at gates, the creator returns days later with new student data, gauge runs, and the iteration continues. The pipeline is not "build once and ship" — it is "build, gauge, iterate, repeat."

Pipeline-v2 has no `gauge` step. Iteration after deploy is manual.

---

## Stage-by-stage comparison

| Stage | Pipeline-v2 | Alfred |
|-------|-------------|--------|
| Spec creation | Manual (human writes) | Skill: `spec-creation` |
| Spec validation | Regex + manual | Skill: `spec-review` (24+ checks) |
| Plan generation | `buildPreGenerationPrompt` in `lib/prompts.js` | Skill: `game-planning` |
| Build | `buildGeneratePrompt` | Skill: `game-building` |
| Static + contract validation | `validate-static.js` + `validate-contract.js` | Same modules, invoked from `data-contract` skill |
| Test + fix (5 categories) | `buildTestFixPrompt` | Skill: `game-testing` (same 5 categories) |
| Visual review | `buildVisualReviewPrompt` | Skill: `visual-review` |
| Final review + rejection fix | `buildFinalReviewPrompt` + rejection-fix step | Skill: `final-review` |
| Deploy + content sets | `buildContentGenPrompt` | Skill: `deployment` |
| **Gauge** | **None** | **Skill: `gauge` (NEW)** |
| **Iterate (outer loop)** | **Manual** | **Phase 4 of orchestration + `iteration` skill** |

The new pieces are gauge and explicit outer-loop iteration. Everything else is reorganized, not invented.

---

## What we lose by going back to pipeline-v2

- One 4000-line prompt file that is hard to read, review, and update without breaking adjacent rules.
- No explicit outer-loop iteration model — gauging deployed games becomes ad-hoc.
- No `gauge` skill — no canonical 5 questions to ask after students play.
- Larger context per generation call (the whole prompt vs only the relevant skill files).

## What pipeline-v2 has that Alfred does not (yet)

Be honest about where pipeline-v2 is ahead:

| Capability | Pipeline-v2 | Alfred |
|------------|-------------|--------|
| Production deployment infrastructure | Mature (BullMQ, worker, GCP, Slack, Sentry, metrics) | None — Alfred runs in Claude Code locally |
| Games shipped | Many (in production today) | Two end-to-end (Scale It Up v2, Match Up) |
| Parallel build queue | BullMQ-backed | Manual orchestration |
| Webhook + Slack integration | Wired up | Not built |
| Health checks, monitoring, retries | Built into worker | Not built |
| Real-world test hours | Months | Days |

Alfred is the knowledge organization. Pipeline-v2 is the production runtime. The realistic path is to keep pipeline-v2's runtime and migrate its knowledge into Alfred's skill files.

---

## Honest conclusion

Alfred is **structurally** better at three things, not magically better at any:

1. **Findability** — small files organized by concern are easier to read, grep, review, and update than a 4000-line blob.
2. **Iteration as the system** — gauge + iterate is built into the lifecycle, not bolted on as bug fixing.
3. **Progressive disclosure** — only the relevant skill files load per step, matching Anthropic's published Agent Skills guidance.

The skill format is the medium. The discipline of organization is the win. A team that wrote 108 self-contradictory markdown files would be in the same place as the current `lib/prompts.js` — the format does not save you from bad content.

---

## Review Response

| Supervisor concern | What changed in this doc |
|-------------------|--------------------------|
| "Pipeline-v2 also uses ClaudeSDK and skills — what is different?" | Added "What is the SAME" section. Removed the "scripts vs skills" framing entirely. Confirmed both use `@anthropic-ai/claude-agent-sdk` (see `pipeline-v2/agent.js` line 28). The real difference is organizational. |
| "Self-contradictory statements can also be in skills — skill by default don't fix that == its the content in those files" | Conceded. Reframed claim from "skills prevent contradictions" to "small organized files make contradictions findable in code review." Showed a real 3-way contradiction in `lib/prompts.js` (lines 51, 93, 1541) and explained that Alfred's structure makes it observable, not impossible. |
| "Are we not designing for iteration / long-running agents?" | Added explicit "iteration concern" section. Showed two loops (inner build-time + outer lifetime), three iteration depths (content/spec/rebuild), and the system-loop diagram. Confirmed Alfred is designed for iteration across many sessions over weeks. |

## Acknowledged limitations

| Limitation | Status |
|-----------|--------|
| N=2 games shipped end-to-end via Alfred | Need more before claiming proven |
| No head-to-head measurement vs pipeline-v2 | TODO |
| Outer loop never run on real student data | Gauge skill exists but unverified at scale |
| Skill format does not enforce correctness | Acknowledged — discipline does, not the format |
| Pipeline-v2 production runtime has no Alfred equivalent | Migration plan needed |

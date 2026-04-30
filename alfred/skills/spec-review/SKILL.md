# Skill: Spec Review

## Purpose

Validate a game spec against all pipeline guidelines before it enters the build pipeline. Catch structural, pedagogical, and data-contract problems that would waste a 30-minute build cycle.

## When to use

After spec-creation produces a spec.md, before spending compute on planning or building.

## Owner

**Maintainer:** Education slot
**Deletion trigger:** When spec-review is replaced by automated schema validation that covers all checklist items.

## Reads

- `skills/game-archetypes.md` — archetype profiles, decision tree, PART flags — **ALWAYS**
- `skills/pedagogy/SKILL.md` — Bloom-to-game mapping, misconception design, difficulty progression — **ALWAYS**
- `skills/data-contract.md` — recordAttempt fields, gameState schema, game_complete schema — **ON-DEMAND** (only for checks G1, E1-E4)
- `skills-taxonomy.md` — Creator Decision Defaults table — **ALWAYS** (needed for check H4)

## Input

A game spec (markdown file). Typically `games/<gameId>/spec.md`.

## Output

A `REVIEW_RESULT` block with per-check verdicts and an overall decision. See Output Format below.

---

## Procedure

Run every check in the checklist below, in order. Record PASS, WARN, or FAIL for each. Then emit the REVIEW_RESULT.

### Verdict logic

- **FAIL** = the spec has a problem that will cause a build failure, broken game, or missing analytics data. Must be fixed before building.
- **WARN** = the spec is ambiguous or relies on a pipeline default. The build may succeed but the result may not match creator intent. Should be reviewed.
- **PASS** = the check is satisfied.

### Overall verdict

- If any check is FAIL: overall = **BLOCKED** (do not build)
- If no FAIL but any WARN: overall = **REVIEW** (can build, but creator should confirm the warnings)
- If all PASS: overall = **READY** (build)

---

## Checklist

### A. Required Sections

Every spec must contain these sections. Missing any one is a structural gap the pipeline cannot fill.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| A1 | **Identity** section exists (gameId, title, class/grade, math domain, topic) | All 5 fields present | gameId or title missing (inferrable) | class/grade or math domain missing |
| A2 | **Mechanics** section exists (interaction type, input method, what the student does) | Interaction clearly described | Interaction implied but not named | No mechanics section |
| A3 | **Rounds/Progression** section exists (round count, stages, how difficulty changes) | Rounds + stages explicit | Round count present but stages vague | No round or progression info |
| A4 | **Scoring** section exists (points, stars, lives if applicable) | Scoring rules explicit | Scoring mentioned but incomplete | No scoring section |
| A5 | **Feedback** section exists (what happens on correct, what happens on wrong) | Both paths described | Only correct path described | No feedback section |
| A6 | **Content** section exists (sample questions, answer keys, content structure) | At least 3 sample rounds with answers | Samples present but fewer than 3 | No content samples |

### B. Archetype Mapping

The spec must map to a recognized archetype from `game-archetypes.md`. Custom games need extra validation.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| B1 | **Maps to a recognized archetype** — run the decision tree from `game-archetypes.md` Step 2 | Clear single-archetype match | Ambiguous between two archetypes (document both) | Contradictory signals (e.g., "timed lives puzzle with phases") |
| B2 | **Screen flow is consistent with archetype** — screens listed in spec match archetype's state machine | Screens match or spec explicitly overrides | Spec does not list screens (will use archetype default) | Spec lists screens that contradict archetype (e.g., `game_over` on a no-lives game) |
| B3 | **PART flags implied by archetype are not contradicted** | No contradictions | Spec adds features requiring extra PART flags (note which) | Spec explicitly excludes a required PART flag |

### C. Bloom-Interaction Consistency

The Bloom level must match the interaction type and scoring model per `pedagogy.md` Bloom-to-Game Mapping.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| C1 | **Bloom level is stated or inferrable** — check for Bloom keywords or verbs per pedagogy.md Step 1 | Bloom level explicit in spec | Bloom level not stated but inferrable from verbs | No Bloom signal at all (verbs are ambiguous) |
| C2 | **Interaction matches Bloom level** — e.g., L1-L2 should not require number input; L3+ should not be pure MCQ without justification | Interaction is in the recommended set for the Bloom level | Interaction is outside recommended set but spec justifies it | L1/L2 spec uses lives + strict penalty, or L3+ spec has no-penalty with no rationale |
| C3 | **Scoring/lives policy matches Bloom level** — L1-L2 should be no-penalty; L3+ should have lives | Policy matches pedagogy.md lookup table | Policy deviates but spec explains why | L1 game with 3 lives and game-over, or L3 game with no scoring consequence |
| C4 | **Feedback style matches Bloom level** — L1 = show answer; L2 = explain why; L3 = show procedure; L4 = ask-back | Feedback description matches Bloom-level guidance | Feedback not fully described (will use defaults) | Feedback contradicts Bloom level (e.g., L4 game just shows answer with no reasoning) |

### D. Difficulty Progression

A flat game (all rounds at same difficulty) teaches nothing. Every spec must define how difficulty increases.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| D1 | **Difficulty progression is defined** — spec states what changes between stages | Explicit axis of difficulty (e.g., "Stage 1: single-step, Stage 2: two-step, Stage 3: unfamiliar context") | Spec says "rounds get harder" or similar without stating HOW | No mention of difficulty change across rounds |
| D2 | **Difficulty axis matches Bloom level** — per pedagogy.md: L1 = confusability, L2 = ambiguity, L3 = procedural steps, L4 = dimensional complexity | Axis matches the Bloom-level guidance | Axis is reasonable but not the canonical one for this Bloom level | Axis contradicts Bloom level (e.g., L1 game where difficulty is "more procedural steps") |
| D3 | **Stage count is explicit** — how many stages, how many rounds per stage | Both stated | Stage count stated, rounds per stage inferrable | Neither stated |

### E. Star Thresholds and Scoring Parameters

Star thresholds must be explicit numbers, not vague descriptions.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| E1 | **Star thresholds are explicit numbers** — e.g., "3 stars >= 90%, 2 stars >= 66%, 1 star >= 33%" | All three thresholds are numbers | Thresholds missing (pipeline default 90/66/33 will apply — flag it) | Thresholds described vaguely ("3 stars for doing great") |
| E2 | **Lives count is explicit or archetype-defaulted** — if the game uses lives, how many? | Lives count is a number in the spec | Spec says "lives" without a count (pipeline default 3 will apply — flag it) | Spec is contradictory about lives (e.g., "no lives" in one section, "3 hearts" in another) |
| E3 | **Timer is explicit or confirmed absent** — if timed, how many seconds? | Timer value stated OR spec confirms no timer | Spec mentions "timed" without a duration (pipeline default will apply — flag it) | Spec is contradictory about timer |
| E3a | **PART-006 mandatory triggers** — scan the spec for any time/duration/speed concept: `timer\|seconds\|duration\|"time pressure"\|"time limit"\|speed\|fast\|"how quickly"\|"how fast"\|"under N second"\|"in N second"\|"within N second"\|"under N minute"\|within\|"response time"\|countdown\|"speed round"\|"race against"`. If ANY match, the spec MUST declare PART-006 (TimerComponent). Star tiers / feedback that depend on duration MUST source from `timer.getTimeTaken()` / `timer.getElapsedTimes()` — hand-rolled `Date.now()` is forbidden in player-visible logic per PART-006 § "Forbidden patterns". | No time-trigger words OR spec declares PART-006 with timer config | Spec implies a speed concept loosely (e.g. "be quick") but doesn't declare a timer — flag for confirmation | Spec describes a speed gate ("3 stars for solving in under N seconds") but does not declare PART-006, OR spec declares speed-based stars but says "no visible timer" |
| E4 | **Round count is explicit** | Round count is a number | Round count missing (archetype default will apply — flag it) | No round count and no content to infer from |
| E5 | **Stars contract — no mid-game ActionBar widget** — the platform ActionBar header (stars `x/y` + question label) is end-of-game-only. Spec MUST NOT propose a "running ActionBar score that updates per correct round" or a custom `'L1'`/`'Level 1'`/`'Round 1'` label format. Game-internal running counters (fast-tap meters, point tallies, level indicators) belong in `#gameContent`. | Spec describes stars as overall performance (single end-of-game award) and uses `Q + N` for any platform-header label OR keeps custom labels inside game UI | Spec is silent on header behavior (default applies — flag it) | Spec proposes a per-round mid-game ActionBar score update OR a non-`Q+N` action-bar label format |
| E6 | **Star denominator (`y`) declared if non-default** — default `y = 3`. If the spec proposes a different denominator (e.g. `y = 5` for a 5-tier game), the spec must state it explicitly and explain why. | `y = 3` (default) OR spec declares `Star denominator: N` with rationale | — | Spec proposes a non-default `y` without declaring it, or declares `y` without rationale |

### F. Misconception Design

Every distractor must exist because a real student would pick it for a real reason.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| F1 | **Every distractor has a misconception tag** — each wrong option in sample content is tagged with a named misconception | All distractors tagged | Some distractors tagged, others missing tags | No misconception tags anywhere in the spec |
| F2 | **Misconception tags are meaningful** — tags name a specific wrong belief, not "wrong answer" or "other" | All tags describe a real cognitive error | Some tags are generic (e.g., "calculation error" used for more than one distractor type) | Tags are placeholder text or random labels |
| F3 | **No duplicate misconceptions within a single question** — each distractor in a question targets a different wrong belief | All questions have unique misconception per distractor | Not verifiable (too few sample questions) | Same misconception tag used twice in one question |

### G. Content and Fallback Structure

The spec must define enough content for the pipeline to build fallbackContent.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| G1 | **fallbackContent structure is defined or inferrable** — the spec shows the shape of a round object (fields, types) | Round schema explicit (e.g., `{ question, options, answer, misconceptions }`) | Round schema inferrable from samples but not stated | No round structure and no samples to infer from |
| G2 | **Round count matches content count** — if spec says 9 rounds, there should be at least 9 rounds of content (or a content generation rule) | Content count >= round count, OR spec says "generate content following this pattern" with enough samples | Content count < round count but close (e.g., 6 samples for 9 rounds) | Content count is drastically short (e.g., 2 samples for 9 rounds) with no generation rule |
| G3 | **Content covers all difficulty stages** — samples include easy, medium, and hard | Samples span all defined stages | Samples only cover 1-2 stages | All samples are same difficulty |
| G4 | **Preview fields present in fallbackContent** — `previewInstruction` (HTML) and `previewAudioText` (plain text for TTS) are both specified per PART-039 | Both fields present with real content | Only one present, or both present but empty placeholders | Both fields missing from fallbackContent — WARN on pre-existing specs, FAIL on newly-generated specs |
| G5 | **Round-set cycling — three sets authored** (multi-round games only; standalone `totalRounds: 1` is exempt). Spec MUST contain rounds for ≥ 3 distinct `set` values (`'A'`, `'B'`, `'C'`) per validator rule `GEN-ROUNDSETS-MIN-3`. Each set has exactly `totalRounds` rounds. Every round object has a `set` key. Round `id`s globally unique across sets (prefix convention `A_r1_…`, `B_r1_…`, `C_r1_…`). | All three sets present with `totalRounds` rounds each, every round has `set` key, ids globally unique, parallel difficulty across sets | Two sets present, OR set keys present but only one set populated, OR one set has fewer than `totalRounds` rounds | Single flat `rounds` array (no `set` keys), OR fewer than 3 distinct `set` values, OR mixed tagged/untagged rounds, OR duplicate ids across sets — game will fail validator at build-time |

### H. Ambiguity Check

Vague specs produce random games. Flag anything the pipeline would have to guess about.

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| H1 | **No "rounds get harder" without HOW** — any claim about progression must be accompanied by a concrete mechanism | All progression claims have mechanisms | — | Any progression claim without a mechanism |
| H2 | **No "appropriate feedback" without WHAT** — feedback must describe what the student sees, not just that feedback exists | Feedback actions are concrete (show X, play Y, display Z) | — | Feedback described only as "give feedback" or "show appropriate response" |
| H3 | **No unresolved "TBD" or placeholder sections** | No placeholders | Placeholders exist but are in non-critical sections | Placeholders in mechanics, scoring, or content |
| H4 | **All defaults are flagged** — compare every decision against the Creator Decision Defaults table; if the spec is silent on a decision, flag it | Spec explicitly addresses all 13 decisions from the defaults table | 1-3 decisions use defaults (flag which ones) | 4+ decisions use defaults (spec is underspecified) |
| H5 | **`answerComponent: false` requires explicit creator opt-out** (PART-051) — any spec containing `answerComponent: false` MUST include an audit trail in Defaults Applied / Warnings / spec body showing the creator EXPLICITLY requested the opt-out (e.g. quoted creator language, "no answer review", "sandbox/exploration game"). LLM-judgment opt-outs ("inline panel already shows the answer", "one-question standalone, no carousel needed", "creator silent so opt-out") are FAIL — `answerComponent: false` is a creator-only decision, never an auto-fill. | Spec has no `answerComponent: false`, OR spec quotes the creator's explicit opt-out request | — | Spec has `answerComponent: false` with no creator-quoted justification — REJECT and re-author with `answerComponent: true` (the default) |

### Z. Scope creep

Spec-creation is a faithful translation of the creator description (see spec-creation/SKILL.md § Faithful translation boundary). These checks ensure the spec did not silently inject pedagogy, feedback, or composition choices the creator never requested. Any Z* FAIL bumps overall to **BLOCKED**; any Z* WARN bumps overall to **REVIEW** (same logic as existing checks).

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| Z1 | **Diff section present** — the spec must include a `## Diff from creator description` section per spec-creation/SKILL.md § Faithful translation boundary | Section present | — | Section missing → `SCOPE-CREEP-MISSING-DIFF` |
| Z2 | **Every diff entry has a justification** — each line in the diff section must end with `— added because <reason>` | All diff lines have a justification clause | — | Any diff line lacks a justification → `SCOPE-CREEP-UNJUSTIFIED` |
| Z3 | **Pedagogy SUGGESTED rules not silently inlined** — cross-check the spec against pedagogy/ rules tagged `[SUGGESTED]`. If a SUGGESTED rule appears reflected in the spec body (not in `## Suggestions (require explicit creator approval)`), without the diff section explaining why | No `[SUGGESTED]` pedagogy rule appears inline, OR every inline appearance is justified in the diff | — | A `[SUGGESTED]` pedagogy rule is inlined without diff justification → `SCOPE-CREEP-PEDAGOGY-INLINE` |
| Z4 | **Feedback composition matches the table** — for every row in the spec's Feedback table, the (FeedbackManager call + TransitionScreen + FloatingButton mode) tuple must match a row in feedback/SKILL.md § Composition with screen primitives. If a row is novel, the diff must say so. | Every Feedback table row matches an existing composition row, OR novel rows are flagged in the diff | A novel composition row is unflagged → `SCOPE-CREEP-COMPOSITION-NOVEL` | — |
| Z5 | **Suggestions section is creator-pending** — if `## Suggestions (require explicit creator approval)` exists, none of its items may already be wired into the main spec body (Game Parameters, Feedback table, Core Mechanic, etc.) | No Suggestions section, OR every listed suggestion is absent from the main spec body | — | A suggestion is also live in the spec body → `SCOPE-CREEP-SUGGESTION-LIVE` |
| Z6 | **`creatorScreenAudio` entries are well-formed** — `creatorScreenAudio` is OPTIONAL in the spec (spec-creation only writes it when the creator quoted per-screen narration or asked for a screen's TTS to be skipped). When present, every entry MUST have either a non-empty `audioText` string OR `silent: true` — never both, never neither. Keys must be one of `welcome / roundIntro / victory / gameOver / motivation / starsCollected`. Spec-review does NOT FAIL if the block is missing or screens are absent — game-planning fills defaults. The shape-level check (which screens are required for this game's shape) is game-planning's job, not spec-review's. | Block absent, OR every present entry has exactly one of `audioText` (non-empty) / `silent: true`, with a recognized key | — | Entry has both `audioText` and `silent: true`, OR has neither, OR `audioText` is empty/whitespace, OR key is not one of the six recognized screens → `SCOPE-CREEP-SCREENAUDIO-MALFORMED` |
| Z7 | **Per-round `*TTS` fields have paired `*Subtitle` fields linked by content** — for every per-round content field whose name ends with `TTS` (e.g. `keyInferenceTTS`, `violatedClueTTS`), the same round MUST contain a sibling field with the same prefix and a `Subtitle` suffix. The Subtitle string MUST be (a) non-empty after trim, (b) ≤60 chars, and (c) share at least one substantive content word (≥4 chars, excluding common stopwords like `the/and/that/this/with/from/your/over/into`) with the paired TTS. Catches the cross-logic 2026-04-29 disconnect where audio narrated "since Arjun is from India and the Lion lover is from Japan, Maya must like the Lion" while the on-screen subtitle showed "Nice deduction!" — generic literals untethered from the audio's puzzle-specific scaffolding strand students who can't hear the audio. **Auto-skips** if the round contains no `*TTS` fields at all (the rule is opt-in by the presence of TTS authoring). Single-language only — content-word overlap heuristic does not apply when audio_content and subtitle are in different languages (revisit when localization lands). | Every round with a `*TTS` field has a paired `*Subtitle` field passing all three checks | — | Any `*TTS` without a paired `*Subtitle`, OR `*Subtitle` empty/over-60-char, OR `*Subtitle` shares zero content words ≥4 chars with the TTS → `SCOPE-CREEP-SUBTITLE-DISCONNECTED` |

---

## Output Format

> Note: the Z* (Scope creep) checks defined above may also appear in the CHECK RESULTS / ISSUES / WARNINGS sections of the output, with the same PASS/WARN/FAIL semantics as A–H.

```
REVIEW_RESULT
=============

Spec: <gameId> — <title>
Archetype: <matched archetype name> (confidence: HIGH/MEDIUM/CUSTOM)
Bloom level: <L1/L2/L3/L4> (<stated or inferred>)

CHECK RESULTS
─────────────

A. Required Sections
  A1 Identity:           PASS
  A2 Mechanics:          PASS
  A3 Rounds/Progression: WARN — round count present but stages not described
  A4 Scoring:            PASS
  A5 Feedback:           PASS
  A6 Content:            FAIL — no content samples provided

B. Archetype Mapping
  B1 Archetype match:    PASS — MCQ Quiz (#1)
  B2 Screen flow:        WARN — spec does not list screens, using archetype default
  B3 PART flags:         PASS

C. Bloom-Interaction Consistency
  C1 Bloom level:        PASS — L2 Understand (stated)
  C2 Interaction match:  PASS
  C3 Scoring/lives:      PASS
  C4 Feedback style:     WARN — feedback not fully described

D. Difficulty Progression
  D1 Progression defined: FAIL — spec says "questions get harder" with no mechanism
  D2 Difficulty axis:     FAIL — cannot evaluate (no progression defined)
  D3 Stage count:         WARN — stages not stated, defaulting to 3

E. Star Thresholds and Scoring
  E1 Star thresholds:    WARN — not stated, defaulting to 90/66/33
  E2 Lives count:        PASS — no lives (consistent with L2)
  E3 Timer:              PASS — no timer
  E4 Round count:        PASS — 9 rounds

F. Misconception Design
  F1 Distractor tags:    FAIL — no misconception tags on distractors
  F2 Tag quality:        FAIL — no tags to evaluate
  F3 No duplicates:      PASS

G. Content and Fallback
  G1 Fallback structure: WARN — inferrable from samples but not explicit
  G2 Content count:      PASS — 9 samples for 9 rounds
  G3 Stage coverage:     PASS — samples span easy/medium/hard

H. Ambiguity
  H1 Progression claims: FAIL — "rounds get harder" without mechanism
  H2 Feedback claims:    PASS
  H3 Placeholders:       PASS
  H4 Defaults flagged:   WARN — 2 defaults assumed: star thresholds, feedback delay

SUMMARY
───────

  PASS: 14    WARN: 6    FAIL: 5

  Overall: BLOCKED

ISSUES (must fix before build)
──────────────────────────────

  1. [A6]  No content samples. Provide at least 3 sample rounds with questions,
           answers, distractors, and misconception tags.
  2. [D1]  "Questions get harder" is not a difficulty progression. State the axis:
           what changes between stages? (e.g., single-step → two-step → unfamiliar context)
  3. [D2]  Cannot evaluate difficulty axis without a defined progression.
  4. [F1]  Every distractor needs a misconception tag. See pedagogy.md Section 2
           for the format: tag, name, explanation.
  5. [H1]  "Rounds get harder" appears without a mechanism. Replace with concrete
           stage definitions.

WARNINGS (review before build)
──────────────────────────────

  1. [A3]  Round count present but stages not described. Pipeline will default to
           3 equal stages (easy/medium/hard).
  2. [B2]  Spec does not list screens. Pipeline will use MCQ Quiz default:
           start → gameplay → results.
  3. [C4]  Feedback not fully described. Pipeline will use: playDynamicFeedback
           + show correct answer + 1-sentence explanation (L2 default).
  4. [D3]  Stage count not stated. Defaulting to 3 stages.
  5. [E1]  Star thresholds not stated. Defaulting to 90%/66%/33%.
  6. [H4]  2 decisions use pipeline defaults: star thresholds, feedback delay.
           Confirm these are acceptable.
```

---

## What This Skill Does NOT Check

These are downstream concerns validated by other skills or pipeline stages:

- **HTML quality** — checked by `game-building.md` and `game-testing.md`
- **Visual design** — checked by UI/UX audit slot
- **CDN package compatibility** — checked at build time by `validate-static.js`
- **Test pass rate** — checked by `game-testing.md`
- **Mobile layout** — checked by `mobile.md` skill during build
- **Actual gameplay** — requires a built game; spec review is pre-build
- **Content correctness** — whether math answers are right is not a structural check (but misconception plausibility IS checked)
- **Deployment health** — checked by `deployment.md`

---

## Constraints

1. **CRITICAL — Never pass a spec that has zero content samples.** The pipeline needs samples to build fallbackContent and to verify the round schema. A spec with no samples is not a spec.
2. **CRITICAL — Never pass a spec with vague difficulty progression.** "Gets harder" is not a progression. The axis of difficulty must be named.
3. **STANDARD — Never silently assume defaults.** Every default the pipeline will use must appear as a WARN in the output so the creator can confirm or override.
4. **STANDARD — Run all checks, even if early checks FAIL.** The creator needs the full picture, not just the first problem.
5. **STANDARD — Do not invent content to fill gaps.** If the spec has 3 samples and needs 9 rounds, flag it. Do not generate the missing 6.

## Defaults

When the spec is silent on a decision, report it as a WARN using the pipeline default from the Creator Decision Defaults table:

| Decision | Pipeline Default | Flag as |
|----------|-----------------|---------|
| Game structure | Rounds-based | WARN if not stated |
| Interaction type | MCQ (single) | WARN if not stated |
| Scoring | +1 per correct, stars at 90/66/33% | WARN if not stated |
| Difficulty curve | 3 equal stages (easy/medium/hard) | WARN if not stated |
| Rounds | 9 (3 per stage) | WARN if not stated |
| Lives | 0 (L1-L2) or 3 (L3+) based on Bloom level | WARN if not stated |
| Timer | None | **FAIL** if spec mentions any time/duration/speed concept without declaring PART-006 (see E3a). WARN only if spec is silent on time. |
| Feedback style | playDynamicFeedback + show correct answer | WARN if not stated |
| Bloom level | L2 Understand | WARN if not stated |
| Scaffolding | Show correct after wrong, auto-advance | WARN if not stated |

## Anti-patterns

### 1. Passing a spec because it "looks complete"

**Bad:** Spec has `## Scoring`, `## Feedback`, `## Content` headers but the sections are empty or contain only "TBD". Reviewer marks PASS because all headers exist.

**Good:** Reviewer reads the content under each header. Empty `## Scoring` section gets FAIL on check A4.

### 2. Failing a spec for using defaults

**Bad:** Marking FAIL on a spec because it does not mention a timer, even though the MCQ Quiz archetype has no timer by default.

**Good:** Marking WARN: "Timer not specified. Pipeline default: no timer (consistent with MCQ Quiz archetype). Confirm this is intended."

### 3. Reviewing content correctness

**Bad:** Spending time verifying that "2/3 + 1/4 = 11/12" is mathematically correct. This is not a structural check.

**Good:** Checking that each question has a `correct_answer` field and that distractors have `misconception_tag` values. The math itself is out of scope.

### 4. Blocking on WARN-only results

**Bad:** Telling the creator "spec cannot be built" when the result is 0 FAILs and 8 WARNs.

**Good:** Reporting overall verdict as REVIEW with the note: "8 defaults in play -- creator should confirm these are acceptable before building."

### 5. Skipping the ambiguity checks (Section H)

**Bad:** Running checks A-G, seeing all PASS, and reporting READY without running Section H.

**Good:** Running all checks A-H. A spec that passes A-G but has "rounds get harder" without a mechanism in Section H gets FAIL on H1.

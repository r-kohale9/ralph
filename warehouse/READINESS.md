# Warehouse Spec — Readiness Verification

**Date:** March 10, 2026
**Scope:** Full review of `game-spec/` warehouse for readiness to write game-specific templates

---

## Verdict: Ready

The warehouse spec is structurally sound, internally consistent, and complete for K-12 math game generation. No blockers for writing game specs against it.

---

## What Was Verified

### 1. Structural Integrity

The warehouse is cleanly decomposed into 4 layers that don't leak into each other:

| Layer | Contents | Role |
|---|---|---|
| `SPEC.md` | Router only (~100 lines) | Navigation + pipeline logic, zero code |
| `parts/` | 35 parts + manifest | Self-contained code units with versioned manifests |
| `rules/` | 7 rules + manifest | Universal constraints, short, always loaded |
| `contracts/` | 7 JSON schemas | Machine-readable data shape enforcement |
| `templates/` | 1 schema (13 sections) | Assembly book format for game-specific templates |

The router loads manifests first, selects parts via capability matrix, loads only what's needed. Stage 2 reads only the generated template — no warehouse re-reads. This separation holds.

### 2. Part Classification

Parts are correctly classified into 5 categories with clear semantics:

| Category | Count | What it means |
|---|---|---|
| MANDATORY | 17 | Code-generating parts in every game's HTML |
| CONDITIONAL | 13 | Loaded only when game features require them |
| EXTENSION | 2 | Added after initial approval (feedback, Sentry) |
| REFERENCE | 1 | Verification checklist, not code-generating |
| POST_GEN | 2 | Run after HTML generation (schema serialization, test plan) |

The capability matrix cleanly separates these: `any_game` (17 code parts), `verification` (1), `post_gen` (2), then 15 conditional capabilities. No ambiguity about what loads when.

### 3. Dependency Graph

Every part has explicit dependencies in its manifest entry. The `dependency_validation` section defines 4 rules and asserts `any_game_closure_valid: true` — all transitive dependencies of `any_game` parts resolve within the set.

Verified manually:
- PART-004 → PART-003 → PART-002. All in `any_game`. ✓
- PART-019 → PART-011 → PART-007, 009, 010. All in `any_game`. ✓
- PART-022 → PART-020, 021. Both in `any_game`. ✓
- PART-027 → PART-021. In `any_game`. ✓
- PART-028 → PART-008. In `any_game`. ✓
- Conditional: PART-006 → PART-003, 004 (both in `any_game`). ✓
- Conditional: PART-033 → PART-021, 027 (both in `any_game`). ✓
- Conditional: PART-029 → PART-002, PART-016. PART-016 is conditional — selecting `is_story_only` must also pull `has_stories`. Correct behavior, documented. ✓

No cycles exist.

### 4. Contract Consistency

| Contract | Matches Part Code |
|---|---|
| `game-state.schema.json` | 9 required fields match PART-007 exactly ✓ |
| `metrics.schema.json` | Fields match PART-011's endGame() output ✓ |
| `metrics.schema.json` star_thresholds | 80/50/1/0 matches PART-011 code and PART-035 test plan ✓ |
| `attempt.schema.json` | Fields match PART-009's recordAttempt() output ✓ |
| `duration-data.schema.json` | 7 fields match PART-007's duration_data structure ✓ |
| `postmessage-in.schema.json` | Matches PART-008 receiver code ✓ |
| `postmessage-out.schema.json` | Matches PART-008/011 sender code ✓ |
| `html-structure.json` | Required elements, functions, forbidden patterns all match part code ✓ |

No mismatches between contracts and part code.

### 5. Template Schema Completeness

The assembly book format (template-schema.md) has 13 sections:

| # | Section | Purpose | Status |
|---|---|---|---|
| 1 | Game Identity | Name, ID, type | ✓ |
| 2 | Parts Selected | Full 35-row table with config | ✓ |
| 3 | Game State | Mandatory + custom fields | ✓ |
| 4 | Input Schema | Content shape + fallback data | ✓ Forward-flow (authored here, serialized in post-gen) |
| 5 | Screens & HTML | Exact DOM with element IDs | ✓ |
| 6 | CSS | Complete styles | ✓ |
| 7 | Game Flow | Step-by-step logic | ✓ |
| 8 | Functions | Every function with signatures | ✓ |
| 9 | Event Schema | Lifecycle + game-specific events | ✓ |
| 10 | Scaffold Points | Where hints can be injected | ✓ |
| 11 | Feedback Triggers | Audio/sticker moments for Phase 3 | ✓ |
| 12 | Visual Spec | Colors, typography, spacing | ✓ |
| 13 | Verification Checklist | Structural + functional + design + rules + contracts | ✓ |

These 13 sections cover everything an LLM needs to produce a complete HTML file without re-reading the warehouse. The template is self-contained by design.

### 6. Completeness Model

COVERAGE.md Section 16 provides a 6-dimension completeness argument:

| Dimension | Coverage |
|---|---|
| Lifecycle | Every phase (load→setup→loop→validate→end→cleanup) has parts ✓ |
| Input Method | 6 primitives (tap, drag, type, grid, tag, passive) cover K-12 math ✓ |
| Visual Structure | Layout + play area + buttons + feedback + progress + transitions ✓ |
| Data Flow | All directions covered (content in, state tracking, results/analytics/errors out) ✓ |
| Runtime Concerns | Tab handling, audio, errors, debugging, logging, cleanup ✓ |
| Artifact Generation | Template → HTML → inputSchema → tests ✓ |

Out-of-scope items explicitly named (multiplayer, physics, open-world) with justification.

### 7. Skill Folder Cross-Reference

`manifest.json → skill_folder_coverage` maps every file in `mathai-game-builder/` to its warehouse part or marks it `N/A`. No skill folder file is unmapped. This is the gap detection mechanism — when new files are added to the skill folder, this map shows whether the warehouse needs updating.

### 8. Scalability

- **Adding parts:** Create file, update manifest, update capability matrix, update template schema. No existing parts change.
- **Context cost:** Games load only what they need. Warehouse can grow to 100+ parts without affecting games that don't use new ones.
- **Versioning:** Every part has a version field. Registry version (1.1.0) tracks overall warehouse state.

### 9. LLM Readability

- SPEC.md is a numbered step-by-step protocol (Steps 1–7). No ambiguity about execution order.
- Each part file is self-contained: category header, code block, anti-patterns, verification checklist.
- Capability matrix is a simple key→value lookup.
- Contracts are JSON Schema — the most LLM-native validation format.

---

## Previously Identified Issues — All Resolved

| # | Issue | Resolution |
|---|---|---|
| 1 | Star thresholds inconsistent (80/50 in PART-011 vs 90/70 in PART-035) | Fixed. 80/50/1/0 everywhere. `metrics.schema.json` is source of truth. PART-035 references contract. |
| 2 | inputSchema derived from HTML instead of forward-flow | Fixed. Authored in template Section 4, serialized in post-gen. PART-034 renamed to "Serialization". |
| 4 | No version per part | Fixed. Every manifest entry has `"version": "1.0.0"`. |
| 5 | PART-026 was MANDATORY but generates no code | Fixed. Reclassified as REFERENCE. Separated in capability matrix as `verification`. |
| 5b | PART-034/035 mixed with code parts | Fixed. Reclassified as POST_GEN. Separated in capability matrix as `post_gen`. |
| 7 | No dependency graph validation | Fixed. `dependency_validation` section with 4 rules + closure assertion. |
| 8 | Deep references point to skill folder paths | Acknowledged. Warehouse used alongside skill folder in practice. Deep refs loaded from skill folder during code gen. Not a blocker. |
| 9 | Template missing event schema, scaffold points, feedback triggers | Fixed. Sections 9, 10, 11 added to template-schema.md. |
| 10 | COVERAGE.md had no completeness argument | Fixed. Section 16 added with 6-dimension model + gap analysis. |
| 11 | Capability matrix "21 mandatory" without breakdown | Fixed. Now: "17 code parts + 1 verification + 2 post-gen = 20 always-loaded". |

---

## Known Deferred Items (Not Blockers)

| Item | Why deferred | Impact on game spec writing |
|---|---|---|
| tests.md is prose, not executable | Test runner infra not built | None — test plan generated, Playwright integration later |
| Deep references point to skill folder | Warehouse used alongside skill in practice | None — loaded from skill folder during code gen |
| answer-component.md (1528 lines) not inlined | Too large for a warehouse part | None — loaded as deep reference when needed |
| Browser verification pipeline not automated | Pipeline is the next build phase | None — manual verification via checklist |

None prevent writing or executing game specs.

---

## What's Next

Write game-specific templates. Minimum set to prove completeness:

| Template | Exercises |
|---|---|
| Speed Drill (tap + timer + fixed validation) | Timer, tap-select, fixed validation, time-attack end condition |
| Sorter (drag + no timer + fixed validation) | Drag-drop, no timer, round-based end condition |
| Strategy Builder (text + stories + function validation) | Text input, stories, function validation, retries |
| Constructor (text + LLM validation) | Text input, LLM validation, open-ended |

4 templates cover all 3 validation types, all major input types, timer/no-timer, stories/no-stories. Each follows the 13-section template-schema.md and produces index.html + inputSchema.json + tests.md.

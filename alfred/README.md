# Alfred

How we ship math games to students. Self-contained knowledge base for the game pipeline.

## Knowledge Tree

Every file has exactly one place. Every folder has one purpose. Every file below is reachable by following links from this README.

```
alfred/
  README.md                                         ← You are here
  │
  ├── parts/
  │   ├── README.md                                 PART index with links to all 38 PART files
  │   ├── PART-001.md                               HTML Shell
  │   ├── PART-002.md                               Package Scripts
  │   ├── PART-003.md                               waitForPackages
  │   ├── PART-004.md                               Initialization Block
  │   ├── PART-005.md                               VisibilityTracker
  │   ├── PART-006.md                               TimerComponent
  │   ├── PART-007.md                               Game State Object
  │   ├── PART-008.md                               PostMessage Protocol
  │   ├── PART-009.md                               Attempt Tracking
  │   ├── PART-010.md                               Event Tracking
  │   ├── PART-011.md                               End Game & Metrics
  │   ├── PART-012.md                               Debug Functions
  │   ├── PART-013.md                               Validation: Fixed Answer
  │   ├── PART-014.md                               Validation: Function-Based
  │   ├── PART-015.md                               Validation: LLM Subjective
  │   ├── PART-016.md                               StoriesComponent
  │   ├── PART-017.md                               Feedback Integration
  │   ├── PART-018.md                               Case Converter
  │   ├── PART-019.md                               Results Screen (v2 via TransitionScreen)
  │   ├── PART-020.md                               CSS Variables & Colors
  │   ├── PART-021.md                               Screen Layout (DEPRECATED)
  │   ├── PART-022.md                               Game Buttons
  │   ├── PART-023.md                               ProgressBar Component (v2)
  │   ├── PART-024.md                               TransitionScreen Component (v2)
  │   ├── PART-025.md                               ScreenLayout Component (v2)
  │   ├── PART-026.md                               Anti-Patterns
  │   ├── PART-027.md                               Play Area Construction
  │   ├── PART-028.md                               InputSchema Patterns
  │   ├── PART-029.md                               Story-Only Game Variant
  │   ├── PART-030.md                               Sentry Error Tracking
  │   ├── PART-031.md                               API Helper & Session Tracking
  │   ├── PART-032.md                               AnalyticsManager
  │   ├── PART-033.md                               Interaction Patterns
  │   ├── PART-034.md                               Variable Schema Serialization
  │   ├── PART-035.md                               Test Plan Generation
  │   ├── PART-037.md                               Playwright Testing & Ralph Loop
  │   ├── PART-038.md                               InteractionManager
  │   ├── PART-039.md                               Preview Screen
  │   └── PART-042.md                               SignalCollector
  │
  ├── design/
  │   ├── system-loop.md                            Ship → capture → gauge → iterate loop
  │   ├── skills-taxonomy.md                        55 skills, 9 domains, defaults, DAG, archetypes
  │   ├── architecture-and-plan.md                  Claude Code + skills + MCPs + agents
  │   └── skill-warehouse-architecture.md           Skill ↔ warehouse mapping and sync rules
  │
  ├── skills/
  │   ├── README.md                                 Framework: format, coverage, ship gate
  │   │
  │   ├── orchestration/
  │   │   └── SKILL.md                              Master skill: chains all skills into a pipeline
  │   │
  │   ├── spec-creation/
  │   │   ├── SKILL.md                              Game description → structured spec
  │   │   └── eval.md                               Eval cases for spec-creation
  │   │
  │   ├── spec-review/
  │   │   └── SKILL.md                              Validate spec before building
  │   │
  │   ├── game-archetypes/
  │   │   ├── SKILL.md                              10 profiles: structure + interaction + PART flags
  │   │   └── eval.md                               Eval cases for game-archetypes
  │   │
  │   ├── game-planning/
  │   │   ├── SKILL.md                              Spec → 5 plan docs (flow, screens, rounds, feedback, scoring)
  │   │   └── reference/
  │   │       ├── plan-formats.md                   Plan document format specifications
  │   │       └── cross-validation.md               Cross-plan consistency checks
  │   │
  │   ├── game-building/
  │   │   ├── SKILL.md                              Spec + plan → single-file HTML game
  │   │   └── reference/
  │   │       ├── html-template.md                  HTML structure template
  │   │       ├── code-patterns.md                  Required JS function patterns
  │   │       ├── css-reference.md                  CSS variables, animations, layout
  │   │       └── static-validation-rules.md        Rules for static HTML validation
  │   │
  │   ├── game-testing/
  │   │   └── SKILL.md                              Test with Playwright, 5 categories, fix issues
  │   │
  │   ├── visual-review/
  │   │   └── SKILL.md                              Screenshot-based visual QA
  │   │
  │   ├── final-review/
  │   │   └── SKILL.md                              Spec compliance + go/no-go verdict
  │   │
  │   ├── deployment/
  │   │   └── SKILL.md                              Upload, register, content sets, health check
  │   │
  │   ├── gauge/
  │   │   └── SKILL.md                              Query data, analyze, produce insights
  │   │
  │   ├── data-contract/
  │   │   ├── SKILL.md                              Platform integration overview + quick reference
  │   │   ├── eval.md                               Eval cases for data-contract
  │   │   └── schemas/
  │   │       ├── gamestate-schema.md               gameState required + conditional fields
  │   │       ├── attempt-schema.md                 recordAttempt 12-field schema
  │   │       ├── postmessage-schema.md             game_complete, game_ready, game_init
  │   │       ├── syncdom-events.md                 syncDOMState event definitions
  │   │       └── validation-rules.md               Contract validation rule set
  │   │
  │   ├── feedback/
  │   │   ├── SKILL.md                              Feedback overview + event table + procedure
  │   │   ├── eval.md                               Eval cases for feedback
  │   │   └── reference/
  │   │       ├── feedbackmanager-api.md             playDynamicFeedback API + wrapper
  │   │       ├── timing-and-blocking.md            All timing values + input blocking rules
  │   │       ├── emotional-arc.md                  Pacing, streaks, failure recovery, tone
  │   │       └── juice-animations.md               7 CSS keyframes + round presentation sequence
  │   │
  │   ├── pedagogy/
  │   │   ├── SKILL.md                              Bloom quick-reference + procedure
  │   │   ├── eval.md                               Eval cases for pedagogy
  │   │   └── reference/
  │   │       ├── bloom-mapping.md                  Full L1-L4 mapping (structure, interaction, scoring)
  │   │       ├── misconceptions.md                 30+ named misconceptions, distractor design
  │   │       ├── difficulty-tuning.md              70-85% target, stage calibration, domain axes
  │   │       ├── scaffolding.md                    Per-Bloom-level scaffolding patterns
  │   │       ├── emotional-safety.md               Game-over language, failure recovery
  │   │       └── indian-curriculum.md              NCERT/CBSE mapping, Hindi-English vocab
  │   │
  │   ├── mobile/
  │   │   ├── SKILL.md                              Quick-reference rules table
  │   │   ├── eval.md                               Eval cases for mobile
  │   │   └── reference/
  │   │       ├── layout-and-viewport.md            Viewport, max-width, dvh, safe areas, orientation
  │   │       ├── touch-and-input.md                Touch targets, thumb zone, keyboard, gestures
  │   │       ├── cross-browser.md                  Banned features, Safari rules, performance budget
  │   │       └── css-variables.md                  Complete --mathai-* reference
  │   │
  │   └── signal-collector/
  │       ├── SKILL.md                              Integration points + constraints + anti-patterns
  │       ├── eval.md                               Eval cases for signal-collector
  │       └── reference/
  │           ├── signalcollector-api.md             Constructor, methods, view/custom event types
  │           ├── lifecycle-and-flushing.md          Init, signalConfig, seal, restart, ordering rules
  │           └── view-event-patterns.md            Copy-paste patterns for each viewType
  │
  ├── principles/
  │   └── knowledgebase.md                          14 principles for knowledge organization
  │
  ├── concerns/
  │   ├── SUPERVISOR-BRIEF.md                       2-min executive summary (start here)
  │   ├── README.md                                 Index of supervisor checkpoint Q&A
  │   ├── 01-why-skills-not-script.md               Why skills + Claude orchestrator beats script
  │   ├── 02-v0-completion-checklist.md             What's done, what's pending for v0
  │   ├── 03-reliability.md                         Failure modes and reliability sources
  │   ├── 04-iteration.md                           3 iteration levels (content/spec/rebuild)
  │   ├── 05-update-mechanism.md                    Where and how to update Alfred
  │   ├── 06-per-skill-concerns.md                  Per-skill failure modes and gaps
  │   ├── 07-timeline.md                            Days to v0, weeks to v1
  │   ├── 08-claude-reasoning-proof.md              How we prove Claude's reasoning
  │   ├── REVIEW-ceo-skeptic.md                     CEO + Skeptic review of all concerns
  │   ├── REVIEW-pedagogy-systems.md                Pedagogy + Systems Architect review
  │   └── REVIEW-engineering-qa.md                  Platform + QA review
  │
  ├── reviews/
  │   └── skills-review.md                          10-persona review findings
  │
  ├── templates/
  │   └── meta-review-prompt.md                     Multi-persona review template
  │
  └── reference/
      └── bookmarks.md                              Tools and frameworks to evaluate
```

## File Index

Every file linked here. No orphans.

### Top-level folders

| Folder | Purpose | Entry point |
|--------|---------|-------------|
| [parts/](parts/README.md) | Distilled PART reference (5-10 lines per PART) | [parts/README.md](parts/README.md) (links to all PART files) |
| [design/](design/system-loop.md) | Strategy — the loop, taxonomy, architecture | See links below |
| [skills/](skills/README.md) | Executable knowledge — what Claude reads | [skills/README.md](skills/README.md) |
| [principles/](principles/knowledgebase.md) | Governing rules | [principles/knowledgebase.md](principles/knowledgebase.md) |
| [concerns/](concerns/README.md) | Supervisor checkpoint Q&A | [concerns/README.md](concerns/README.md) |
| [reviews/](reviews/skills-review.md) | Audit outputs | [reviews/skills-review.md](reviews/skills-review.md) |
| [templates/](templates/meta-review-prompt.md) | Reusable prompts | [templates/meta-review-prompt.md](templates/meta-review-prompt.md) |
| [reference/](reference/bookmarks.md) | External resources | [reference/bookmarks.md](reference/bookmarks.md) |

### design/

- [design/system-loop.md](design/system-loop.md) — Ship, capture, gauge, iterate loop
- [design/skills-taxonomy.md](design/skills-taxonomy.md) — 55 skills, 9 domains, defaults, DAG, archetypes
- [design/architecture-and-plan.md](design/architecture-and-plan.md) — Claude Code + skills + MCPs + agents
- [design/skill-warehouse-architecture.md](design/skill-warehouse-architecture.md) — Skill and warehouse mapping and sync rules

### skills/

Framework and conventions: [skills/README.md](skills/README.md)

| Skill | SKILL.md | eval.md | Reference files |
|-------|----------|---------|-----------------|
| orchestration | [SKILL.md](skills/orchestration/SKILL.md) | — | — |
| spec-creation | [SKILL.md](skills/spec-creation/SKILL.md) | [eval.md](skills/spec-creation/eval.md) | — |
| spec-review | [SKILL.md](skills/spec-review/SKILL.md) | — | — |
| game-archetypes | [SKILL.md](skills/game-archetypes/SKILL.md) | [eval.md](skills/game-archetypes/eval.md) | — |
| game-planning | [SKILL.md](skills/game-planning/SKILL.md) | — | [plan-formats.md](skills/game-planning/reference/plan-formats.md), [cross-validation.md](skills/game-planning/reference/cross-validation.md) |
| game-building | [SKILL.md](skills/game-building/SKILL.md) | — | [html-template.md](skills/game-building/reference/html-template.md), [code-patterns.md](skills/game-building/reference/code-patterns.md), [css-reference.md](skills/game-building/reference/css-reference.md), [static-validation-rules.md](skills/game-building/reference/static-validation-rules.md) |
| game-testing | [SKILL.md](skills/game-testing/SKILL.md) | — | — |
| visual-review | [SKILL.md](skills/visual-review/SKILL.md) | — | — |
| final-review | [SKILL.md](skills/final-review/SKILL.md) | — | — |
| deployment | [SKILL.md](skills/deployment/SKILL.md) | — | — |
| gauge | [SKILL.md](skills/gauge/SKILL.md) | — | — |
| data-contract | [SKILL.md](skills/data-contract/SKILL.md) | [eval.md](skills/data-contract/eval.md) | [gamestate-schema.md](skills/data-contract/schemas/gamestate-schema.md), [attempt-schema.md](skills/data-contract/schemas/attempt-schema.md), [postmessage-schema.md](skills/data-contract/schemas/postmessage-schema.md), [syncdom-events.md](skills/data-contract/schemas/syncdom-events.md), [validation-rules.md](skills/data-contract/schemas/validation-rules.md) |
| feedback | [SKILL.md](skills/feedback/SKILL.md) | [eval.md](skills/feedback/eval.md) | [feedbackmanager-api.md](skills/feedback/reference/feedbackmanager-api.md), [timing-and-blocking.md](skills/feedback/reference/timing-and-blocking.md), [emotional-arc.md](skills/feedback/reference/emotional-arc.md), [juice-animations.md](skills/feedback/reference/juice-animations.md) |
| pedagogy | [SKILL.md](skills/pedagogy/SKILL.md) | [eval.md](skills/pedagogy/eval.md) | [bloom-mapping.md](skills/pedagogy/reference/bloom-mapping.md), [misconceptions.md](skills/pedagogy/reference/misconceptions.md), [difficulty-tuning.md](skills/pedagogy/reference/difficulty-tuning.md), [scaffolding.md](skills/pedagogy/reference/scaffolding.md), [emotional-safety.md](skills/pedagogy/reference/emotional-safety.md), [indian-curriculum.md](skills/pedagogy/reference/indian-curriculum.md) |
| mobile | [SKILL.md](skills/mobile/SKILL.md) | [eval.md](skills/mobile/eval.md) | [layout-and-viewport.md](skills/mobile/reference/layout-and-viewport.md), [touch-and-input.md](skills/mobile/reference/touch-and-input.md), [cross-browser.md](skills/mobile/reference/cross-browser.md), [css-variables.md](skills/mobile/reference/css-variables.md) |
| signal-collector | [SKILL.md](skills/signal-collector/SKILL.md) | [eval.md](skills/signal-collector/eval.md) | [signalcollector-api.md](skills/signal-collector/reference/signalcollector-api.md), [lifecycle-and-flushing.md](skills/signal-collector/reference/lifecycle-and-flushing.md), [view-event-patterns.md](skills/signal-collector/reference/view-event-patterns.md) |

## Reading Order

1. **This README** — map of everything
2. **design/system-loop.md** — the WHY
3. **design/skills-taxonomy.md** — the WHAT
4. **design/architecture-and-plan.md** — the HOW
5. **skills/orchestration/SKILL.md** — the ONE prompt that runs it all
6. **skills/README.md** — how skills are built and tested

## Governing Principles

All files follow [principles/knowledgebase.md](principles/knowledgebase.md):

- **Single source** — every concept in one place; others link, never restate
- **Atomic scope** — one skill per folder, one concern per file
- **Weighted** — every rule marked CRITICAL / STANDARD / ADVISORY
- **Trigger-scoped** — every SKILL.md says WHEN it applies
- **Owned** — every SKILL.md has a maintainer and deletion trigger
- **Token-budget-aware** — SKILL.md under 300 lines; reference files on-demand

## Folder Purpose

| Folder | Contains | When to read |
|--------|----------|-------------|
| parts/ | Distilled PART reference (5-10 lines per PART) | When skills need component API details. Synced from warehouse, never read warehouse directly. |
| design/ | Strategy — the loop, taxonomy, architecture | When planning or understanding WHY |
| skills/ | Executable knowledge — what Claude reads | When building, testing, or reviewing a game |
| principles/ | Governing rules | When writing or updating any Alfred file |
| reviews/ | Audit outputs | When deciding what to improve next |
| templates/ | Reusable prompts | When running a review on any artifact |
| reference/ | External resources | When evaluating tools or frameworks |

## Skill Folder Convention

Every skill is a folder. No exceptions. No loose files.

```
skills/<skill-name>/
  SKILL.md              ← Always loaded. Under 300 lines.
  eval.md               ← Test cases (if exists). P0/P1/P2 priority.
  reference/            ← On-demand detail files (if skill is large).
    topic-a.md
    topic-b.md
  schemas/              ← Data schemas (for data-contract specifically).
    schema-name.md
```

**Rules:**
- Root of skill folder has ONLY: SKILL.md, eval.md. Nothing else.
- Reference material goes in `reference/` subfolder.
- Schemas go in `schemas/` subfolder.
- Small skills (spec-review, deployment, gauge) have just SKILL.md.
- Large skills (pedagogy, mobile, feedback) have SKILL.md + reference/ with sub-files.

# Warehouse Spec — Complete Coverage Map

> Quick-reference for reviewing what this spec covers. Every row is something the LLM knows how to generate. If something is missing from this doc, it's missing from the spec.

---

## Pipeline Overview

```
Stage 1: Warehouse + User Requirements  →  Game-Specific Template (spec.md)
Stage 2: Game-Specific Template          →  index.html
Stage 3: Post-Generation                 →  inputSchema.json + tests.md
```

**Output per game:**
```
{game-directory}/
├── index.html          ← The playable game
├── inputSchema.json    ← Extracted variable schema for content creation
└── tests.md            ← Test plan (ready for Playwright integration)
```

---

## 1. HTML Structure & Architecture

| What | Part | Covers |
|------|------|--------|
| DOCTYPE, head, body, meta tags | PART-001 | Complete HTML shell with charset, viewport, title |
| Single file constraint | RULE-007 | All CSS in one `<style>`, all JS in one `<script>`, no external files |
| CDN package loading | PART-002 | FeedbackManager → Components → Helpers (strict order) |
| Async package readiness | PART-003 | `waitForPackages()` with 10s timeout, polls for each global |
| DOMContentLoaded init | PART-004 | `waitForPackages → FeedbackManager.init → Timer → VisibilityTracker → setupGame` |

## 2. Game State & Data

| What | Part | Covers |
|------|------|--------|
| gameState object | PART-007 | `currentRound`, `totalRounds`, `score`, `attempts`, `events`, `startTime`, `isActive`, `content`, `duration_data` |
| duration_data tracking | PART-007 | `startTime`, `preview`, `attempts`, `evaluations`, `inActiveTime`, `totalInactiveTime`, `currentTime` |
| Attempt recording | PART-009 | `recordAttempt()` — timestamp, time_since_start, input_of_user, attempt_number, correct, metadata |
| Event tracking | PART-010 | `trackEvent()` — game_start, tap, question_shown, answer_submitted, etc. |
| End game metrics | PART-011 | `endGame()` — accuracy, time, stars, attempts, duration_data, postMessage, cleanup |

## 3. Communication Protocol

| What | Part | Covers |
|------|------|--------|
| Receiving content | PART-008 | `game_init` postMessage listener, content extraction, standalone fallback |
| Sending results | PART-008 | `game_complete` postMessage with metrics, attempts, events |
| InputSchema definition | PART-028 | JSON Schema patterns for questions, MCQ, grid, text, word problems, nested levels |
| Variable schema extraction | PART-034 | **Post-gen:** extracts inputSchema.json with schema, 3 example content sets, field mapping, constraints |
| Case conversion | PART-018 | `toSnakeCase()` / `toCamelCase()` for backend communication |
| API submission | PART-031 | `APIHelper.submitResults()` — payload shape, error handling, endpoint config |

## 4. Validation

| What | Part | Covers |
|------|------|--------|
| Fixed answer | PART-013 | Exact match — string/number/array comparison |
| Function-based | PART-014 | Rule-based — custom validation function with try/catch |
| LLM subjective | PART-015 | `MathAIHelpers.SubjectiveEvaluation.evaluate()` with loading state |

## 5. UI Components (CDN Packages)

| What | Part | Covers |
|------|------|--------|
| TimerComponent | PART-006 | Countdown/count-up, `start/pause/resume/destroy`, `onEnd` callback, MM:SS format |
| VisibilityTracker | PART-005 | Tab switch pause/resume, `onInactive/onResume` callbacks, popup, duration tracking |
| ProgressBarComponent | PART-023 | Round progress bar + lives display, `update(round, lives)`, `destroy()` |
| TransitionScreenComponent | PART-024 | Start/victory/game-over/level screens — icons, stars, buttons, auto-hide |
| ScreenLayout | PART-025 | `ScreenLayout.inject()` — slot system for ProgressBar + TransitionScreen |
| StoriesComponent | PART-016 | Narrative stories — `storyBlockId`, `onComplete`, `onStoryChange` |
| Results Screen | PART-019 | Score/time/accuracy/stars display with HTML + `showResults()` function |

## 6. Audio & Feedback

| What | Part | Covers |
|------|------|--------|
| FeedbackManager | PART-017 | Audio preload, `sound.play()` with subtitle/sticker, dynamic TTS streaming |
| SubtitleComponent | PART-017 | Managed by FeedbackManager — text overlays with markdown support |
| Stickers (Lottie/GIF) | PART-017 | Visual feedback animations alongside audio |
| Audio pause/resume | PART-005 | VisibilityTracker pauses/resumes all audio on tab switch |

**Rules:**
- No `new Audio()` — use FeedbackManager (RULE-006)
- No `SubtitleComponent.show()` — pass subtitle as prop to `sound.play()` (RULE-006)

## 7. Design System

| What | Part | Covers |
|------|------|--------|
| CSS Variables | PART-020 | Full `--mathai-*` variable system: colors, fonts, spacing, borders, gradients |
| Gameplay feedback colors | PART-020 | Green (correct), red (incorrect), blue (selected), gray (neutral), with light variants |
| Screen layout | PART-021 | Mobile-first 480px max-width, `page-center/game-wrapper/game-stack/game-block`, `100dvh` |
| Game buttons | PART-022 | Reset/Submit/Retry/Next — mutual exclusivity, primary/secondary/danger styles, hover effects |
| Color anti-patterns | PART-020 | No hardcoded hex values — always use CSS variables |

## 8. Interaction Patterns

| What | Part | Covers |
|------|------|--------|
| Play area framework | PART-027 | Design process (interpret → construct → simulate → verify), grid/options/input layouts, state management |
| Drag and drop | **PART-043** (authoritative) | `@dnd-kit/dom` ESM, pointer + touch sensors, bank/zone tracking maps, evict/swap/transfer logic, per-round lifecycle. ~~PART-033 Pattern 1 (native HTML5 drag)~~ SUPERSEDED — banned because it does not fire on mobile touch. |
| Clickable grid | PART-033 | CSS Grid cells, single/multi select, row/col data attributes, selection extraction |
| Tag/chip input | PART-033 | Type-and-enter chips, removable tags, correct/incorrect coloring |
| Button state management | PART-022 | `showButton(id)` — mutual exclusivity of Submit/Retry/Next |

## 9. Analytics

| What | Part | Covers |
|------|------|--------|
| AnalyticsManager | PART-032 | Multi-platform (Mixpanel, Amplitude, CleverTap), auto `harness: true` |
| User identification | PART-032 | `analytics.identify({ id, mobile, name, email })` |
| 7 mandatory events | PART-032 | `question_submitted`, `question_evaluation_complete`, `question_timed_out`, `show_submit_button`, `hide_submit_button`, `next_btn_clicked`, `show_image_not_loaded_popup` |
| Game lifecycle events | PART-032 | `game_started`, `game_paused`, `game_resumed`, `game_completed` |

## 10. Error Handling & Debugging

| What | Part | Covers |
|------|------|--------|
| Debug functions | PART-012 | `debugGame()`, `debugAudio()`, `testAudio()`, `testPause()`, `testResume()` on `window` |
| Anti-patterns | PART-026 | 12 common mistakes: manual timers, `new Audio()`, wrong load order, missing timeout, hardcoded colors, etc. |
| Sentry integration | PART-030 | SDK loading, `Sentry.init()`, breadcrumbs, error capture, tagging strategy, global handlers |
| Error handling rule | RULE-003 | All async operations in try/catch |
| Structured logging | RULE-004 | `JSON.stringify(obj, null, 2)` — never raw objects |

## 11. Game Variants

| What | Part | Covers |
|------|------|--------|
| Standard game | `any_game` matrix | Full flow: load → init → rounds → validate → track → endGame → results |
| Story-only game | PART-029 | No validation, no feedback, no attempt tracking — StoriesComponent only, auto-complete |

## 12. Post-Generation Outputs

| What | Part | Covers |
|------|------|--------|
| inputSchema.json | PART-034 | Schema + 3 example content sets (easy/medium/hard) + field mapping + constraints |
| tests.md | PART-035 | 14 test categories: page load, postMessage, game flow, validation, buttons, timer, visibility, metrics, results, debug, errors, layout, CSS, game-specific |

## 13. Universal Rules

| Rule | Severity | What |
|------|----------|------|
| RULE-001 | CRITICAL | All HTML `onclick` handlers must reference global-scope functions |
| RULE-002 | CRITICAL | Every function using `await` must be declared `async` |
| RULE-003 | CRITICAL | All async operations wrapped in try/catch |
| RULE-004 | REQUIRED | All object logging uses `JSON.stringify` |
| RULE-005 | REQUIRED | `destroy()` timer + VisibilityTracker, `stopAll()` audio in endGame |
| RULE-006 | CRITICAL | No `new Audio()`, no `setInterval` for timers, no `SubtitleComponent.show()` |
| RULE-007 | REQUIRED | Single `index.html` file, no external CSS/JS except CDN packages |

## 14. Data Contracts (JSON Schemas)

| Contract | File | Validates |
|----------|------|-----------|
| Game State | `game-state.schema.json` | Shape of `gameState` object (9 mandatory fields + duration_data) |
| Attempt | `attempt.schema.json` | Shape of each attempt (timestamp, input, correctness, metadata) |
| Metrics | `metrics.schema.json` | Shape of endGame metrics (accuracy, time, stars, attempts, duration_data) |
| Duration Data | `duration-data.schema.json` | Shape of duration_data (7 fields for time tracking) |
| PostMessage In | `postmessage-in.schema.json` | Shape of `game_init` message |
| PostMessage Out | `postmessage-out.schema.json` | Shape of `game_complete` message |
| HTML Structure | `html-structure.json` | Required DOM elements, functions, forbidden patterns |

---

## Capability Matrix (Quick Reference)

When the LLM builds a game, it loads `any_game` (18 code parts) + `verification` (1) + `post_gen` (2) = 21 always-loaded parts, then adds conditional parts based on game features:

| Game Feature | Parts Added |
|-------------|-------------|
| Every game (code) | PART-001 through 012, 019 through 022, 027, 028, 030 (18 parts) |
| Every game (verification) | PART-026 (anti-patterns checklist) |
| Every game (post-gen) | PART-034 (schema serialization), PART-035 (test plan) |
| Has timer | + PART-006 |
| Has stories | + PART-016 |
| Fixed answer validation | + PART-013 |
| Function-based validation | + PART-014 |
| LLM subjective validation | + PART-015 |
| Backend communication | + PART-018 |
| Audio feedback | + PART-017 |
| Progress bar | + PART-023, PART-025 |
| Transition screens | + PART-024, PART-025 |
| Story-only game | + PART-029 |
| API result submission | + PART-031 |
| Multi-platform analytics | + PART-032 |
| Drag-and-drop | + PART-033, **+ PART-043** (AUTHORITATIVE — @dnd-kit/dom; native HTML5 drag banned) |
| Grid interaction | + PART-033 |
| Tag/chip input | + PART-033 |

---

## Skill Folder Cross-Reference

Every file in the mathai-game-builder skill folder is mapped to its warehouse part below. Files marked **N/A** are workflow/tooling files that don't affect HTML generation.

### Components
| Skill File | Warehouse Part |
|-----------|---------------|
| feedback-manager.md | PART-017 |
| timer-component.md | PART-006 |
| stories-component.md | PART-016 |
| subtitle-component.md | PART-017 (internal to FeedbackManager) |
| visibility-tracker.md | PART-005 |
| analytics-manager.md | PART-032 |
| game-analytics-events.md | PART-032 |
| interaction-manager.md | N/A — not used in generated games |

### Helpers
| Skill File | Warehouse Part |
|-----------|---------------|
| api-helper.md | PART-031 |
| case-converter.md | PART-018 |
| tracker-helper.md | PART-031 |

### Reference Docs
| Skill File | Warehouse Part |
|-----------|---------------|
| architecture.md | PART-008 |
| answer-component.md | Deep reference only (1528 lines — too large for inline) |
| component-props.md | PART-006, PART-005, PART-017 |
| components-library.md | PART-023, PART-024, PART-025 |
| color-guidelines.md | PART-020 |
| css-variables-reference.md | PART-020 |
| screen-layout.md | PART-021 |
| play-area-construction.md | PART-027 |
| inputschema-guide.md | PART-028 |
| validation-types.md | PART-013, PART-014, PART-015 |
| sentry-integration.md | PART-030 |
| error-messages.md | PART-026 (distilled into anti-patterns) |
| debug-functions.md | PART-012 |
| mcp-integration.md | N/A — workflow tooling |
| mcp-server-setup.md | N/A — workflow tooling |
| claude-code-usage.md | N/A — skill usage docs |
| file-operations.md | N/A — workflow tooling |

### Workflows
| Skill File | Warehouse Part |
|-----------|---------------|
| story-only-games.md | PART-029 |
| phase-0 through phase-5 | N/A — workflow orchestration |
| prompt-dispatch.md | N/A — skill workflow guard |
| game-resumption.md | N/A — workflow tooling |

### Examples
| Skill File | Warehouse Part |
|-----------|---------------|
| correct-patterns.md | Deep reference — linked from PART-026 |
| anti-patterns.md | PART-026 |
| QUICK-REFERENCE.md | Deep reference — linked from SPEC.md |
| story-only-game-example.md | PART-029 |
| attempt-history-examples.md | PART-009 |

---

## 15. Dimension Model — Completeness Argument

The warehouse covers game generation across **6 orthogonal dimensions**. Every possible game is a point in this space:

### Dimension 1: Lifecycle (temporal)
Every game progresses through these phases. Each phase maps to specific parts.

| Phase | Parts | Coverage |
|-------|-------|----------|
| Load & Init | PART-001, 002, 003, 004 | HTML shell → CDN scripts → wait → init sequence |
| Setup | PART-007, 008, 028 | Game state → postMessage content → schema validation |
| Gameplay Loop | PART-009, 010, 027 | Attempt tracking → event tracking → play area |
| Validation | PART-013, 014, 015 | Fixed / function / LLM — every answer type covered |
| End & Results | PART-011, 019 | Metrics → results screen |
| Cleanup | PART-005, RULE-005 | VisibilityTracker destroy, timer destroy, audio stop |

**Completeness:** A game that doesn't go through load→setup→loop→validate→end→cleanup isn't a game. Every phase has at least one part.

### Dimension 2: Input Method
How the user provides answers.

| Input Method | Part | Coverage |
|-------------|------|----------|
| Tap/click | PART-027 (options layout) | MCQ, toggle, select |
| Drag & drop | PART-033 | Reorder, sort, match |
| Text/number input | PART-027 (input layout) | Type answer, fill blank |
| Grid selection | PART-033 | Matrix, coordinate, region |
| Tag/chip entry | PART-033 | Multi-answer, set builder |
| No input (story) | PART-029 | Passive viewing |

**Completeness:** These 6 input primitives compose into any educational interaction. A math game that can't be expressed as tap, drag, type, grid, tag, or passive viewing doesn't exist in the K-12 math domain.

### Dimension 3: Visual Structure
How the game looks on screen.

| Layer | Part | Coverage |
|-------|------|----------|
| Colors & theming | PART-020 | CSS variables, feedback colors |
| Page layout | PART-021 | Mobile-first 480px, page-center/game-wrapper |
| Play area | PART-027 | Grid/options/input construction |
| Buttons | PART-022 | Submit/Retry/Next/Reset |
| Progress indicator | PART-023 | Round progress + lives |
| Screen transitions | PART-024 | Start/victory/game-over overlays |
| Screen layout slots | PART-025 | Composable slot injection |

**Completeness:** Structure (layout) + Content (play area) + Controls (buttons) + Feedback (colors) + Navigation (progress/transitions) covers all visual concerns.

### Dimension 4: Data Flow
How data moves through the system.

| Flow | Parts | Coverage |
|------|-------|----------|
| Content in | PART-008 (postMessage in) | Platform → game |
| User capture | PART-010 (trackEvent) | Raw interaction events |
| State tracking | PART-007, 009, 010 | Game state, attempts, events |
| Results out | PART-008 (postMessage out), PART-011 | Game → platform |
| Analytics out | PART-032 | Game → Mixpanel/Amplitude/CleverTap |
| Errors out | PART-030 | Game → Sentry |
| API out | PART-031 | Game → backend |

**Completeness:** Data either comes in (content) or goes out (results, analytics, errors). All paths covered.

### Dimension 5: Runtime Concerns
Cross-cutting behaviors during gameplay.

| Concern | Part/Rule | Coverage |
|---------|-----------|----------|
| Tab switch handling | PART-005 | Pause/resume all |
| Audio/feedback | PART-017 | Sound, subtitles, stickers |
| Error handling | RULE-003 | try/catch on all async |
| Debugging | PART-012 | debugGame/debugAudio/testPause/testResume |
| Structured logging | RULE-004 | JSON.stringify all objects |
| Cleanup | RULE-005 | Destroy timer, tracker, stop audio |

### Dimension 6: Artifact Generation
What the pipeline produces.

| Artifact | Stage | Part | Coverage |
|----------|-------|------|----------|
| Game-specific template | Stage 1 | SPEC.md pipeline | Assembly book with all code + test scenarios |
| index.html | Stage 2 | Template → HTML | Single-file playable game |
| inputSchema.json | Stage 3 | PART-034 | Content contract for CMS |
| tests.md | Stage 3 | PART-035 | 15-category test plan with Playwright scenarios |
| tests/game.spec.js | Stage 4 | PART-037 | Executable Playwright tests |
| Verified HTML | Stage 4 | PART-037 (ralph loop) | Tested + Claude-approved HTML |

### Gap Analysis

To check if a new game feature is covered:
1. Identify which dimension(s) it belongs to
2. Find the corresponding part(s)
3. If no part exists → the warehouse has a gap

**Current known gaps:** None for K-12 math games. The warehouse does NOT cover:
- Multi-player games (would need new parts for WebSocket, turn management)
- Physics simulations (would need canvas/WebGL parts)
- Open-world exploration (no spatial navigation parts)

These are intentionally out of scope for the MathAI educational game platform.

---

## Known Gaps / Future Work

| Item | Status | Notes |
|------|--------|-------|
| answer-component.md (1528 lines) | Deep reference only | Correct answer gallery — too large for inline part. Load from skill folder when needed. |
| correct-patterns.md (350 lines) | Deep reference only | Production-ready code examples. Linked from PART-026. |
| Playwright test integration | **Implemented** | Ralph loop (PART-037) generates Playwright tests + runs fix cycle via `claude -p`. |
| Browser verification pipeline | **Implemented** | Ralph loop: Generate → Test → Fix → Review → Approve (Stage 4 in SPEC.md). |

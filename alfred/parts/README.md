# PART Index — Alfred Quick Lookup

> Each PART lives in its own file. Skills load only the PARTs they need.
> For full code and deep details, see `warehouse/parts/PART-NNN-*.md`.

| PART | Name | Purpose | Mandatory? |
|------|------|---------|------------|
| [PART-001](PART-001.md) | HTML Shell | Single-file HTML structure for every game | Yes |
| [PART-002](PART-002.md) | Package Scripts | CDN script tags for game framework packages | Yes |
| [PART-003](PART-003.md) | waitForPackages | Async polling for CDN packages on `window` | Yes |
| [PART-004](PART-004.md) | Initialization Block | DOMContentLoaded boot sequence | Yes |
| [PART-005](PART-005.md) | VisibilityTracker | Pause/resume on tab focus change | Yes |
| [PART-006](PART-006.md) | TimerComponent | Countdown or count-up timer | Conditional (time pressure) |
| [PART-007](PART-007.md) | Game State Object | Global `window.gameState` tracking | Yes |
| [PART-008](PART-008.md) | PostMessage Protocol | iframe-parent communication | Yes |
| [PART-009](PART-009.md) | Attempt Tracking | Records every user answer attempt | Yes |
| [PART-010](PART-010.md) | Event Tracking | Game-level event logging to `gameState.events[]` | Yes |
| [PART-011](PART-011.md) | End Game & Metrics | Final metrics, seal signals, show results | Yes |
| [PART-012](PART-012.md) | Debug Functions | Exposes debug/test functions on `window` | Yes |
| [PART-013](PART-013.md) | Validation — Fixed Answer | Validate with known correct values | Conditional (fixed answers) |
| [PART-014](PART-014.md) | Validation — Function-Based | Validate with rule functions | Conditional (rule-based) |
| [PART-015](PART-015.md) | Validation — LLM Subjective | AI-powered evaluation | Conditional (subjective) |
| [PART-016](PART-016.md) | StoriesComponent | Narrative/story display | Conditional (stories) |
| [PART-017](PART-017.md) | Feedback Integration | Audio feedback and sticker animations | Conditional (audio/stickers) |
| [PART-018](PART-018.md) | Case Converter | camelCase/snake_case conversion | Conditional (backend data) |
| [PART-019](PART-019.md) | Results Screen (v2) | End-of-game results via TransitionScreen | Yes |
| [PART-020](PART-020.md) | CSS Variables & Colors | CSS custom properties from Components | Yes |
| [PART-021](PART-021.md) | Screen Layout (DEPRECATED) | Legacy manual HTML layout | No (legacy only) |
| [PART-022](PART-022.md) | Game Buttons | Standard button patterns | Yes |
| [PART-023](PART-023.md) | ProgressBar Component (v2) | Round counter + lives display | Yes |
| [PART-024](PART-024.md) | TransitionScreen Component (v2) | Welcome, results, game-over screens | Yes |
| [PART-025](PART-025.md) | ScreenLayout Component (v2) | Auto-generates page structure | Yes |
| [PART-026](PART-026.md) | Anti-Patterns | Verification checklist of common mistakes | Reference |
| [PART-027](PART-027.md) | Play Area Construction | Interactive game area inside `#gameContent` | Yes |
| [PART-028](PART-028.md) | InputSchema Patterns | Content structure for `game_init` | Yes |
| [PART-029](PART-029.md) | Story-Only Game Variant | Simplified story-only game | Conditional (story-only) |
| [PART-030](PART-030.md) | Sentry Error Tracking | Production error monitoring | Yes |
| [PART-031](PART-031.md) | API Helper & Session Tracking | Submit results to backend | Conditional (backend API) |
| [PART-032](PART-032.md) | AnalyticsManager | Multi-platform analytics | Conditional (analytics) |
| [PART-033](PART-033.md) | Interaction Patterns | Drag-and-drop, grids, tag/chip inputs | Conditional (complex UI) |
| [PART-034](PART-034.md) | Variable Schema Serialization | Serialize InputSchema to JSON | Post-generation |
| [PART-035](PART-035.md) | Test Plan Generation | Create testable behavior docs | Post-generation |
| [PART-037](PART-037.md) | Playwright Testing & Ralph Loop | Automated test + fix loop | Post-generation |
| [PART-038](PART-038.md) | InteractionManager | Suppress interaction during feedback | Conditional (feedback suppression) |
| [PART-039](PART-039.md) | Preview Screen | Instruction/preview before gameplay | Yes |
| [PART-042](PART-042.md) | SignalCollector | Atomic interaction capture + batch flushing to GCS | Yes |

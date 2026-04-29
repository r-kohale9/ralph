### PART-003: waitForPackages
**Purpose:** Async readiness gate — resolves only when every CDN class the game intends to instantiate is registered on `window`.

**Single source of truth:** [`alfred/skills/game-building/reference/mandatory-components.md`](../skills/game-building/reference/mandatory-components.md). The package set is derived per-spec from that registry; the four-package list below is only the always-required baseline.

**API:** `await waitForPackages()` — polls every 100ms, 180s timeout, rejects on failure.

**Key rules:**
- **Baseline** (always required): `FeedbackManager`, `TimerComponent`, `VisibilityTracker`, `SignalCollector`, `ScreenLayout`.
- **Conditional** (drop only when spec opt-out is set): `PreviewScreenComponent` (drop on `previewScreen: false`), `TransitionScreenComponent` (drop on no transitionScreen slot), `ProgressBarComponent` (drop on Shape 1 single-screen), `FloatingButtonComponent` (drop on `floatingButton: false`), `AnswerComponentComponent` (drop on `answerComponent: false`).
- **Hard `&&` only** in the readiness expression. Validator `GEN-WAITFORPACKAGES-NO-OR` rejects any `||`. The `(typeof X !== 'undefined' || typeof ScreenLayout !== 'undefined')` fail-open shape is the age-matters bug.
- Must be called first thing in DOMContentLoaded.
- On timeout, **rejects** so the standalone fallback can render an attributable error UI. Do not silently resolve.
- **Component instantiations use attributable catches.** Validator `GEN-SLOT-INSTANTIATION-MATCH` requires every `slots: { X: true }` to have a matching `new XComponent(...)`.

See `warehouse/parts/PART-003-wait-for-packages.md` for the full template + verification checklist.

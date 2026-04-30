# Mandatory Components Registry

**Status:** AUTHORITATIVE. This file is the single source of truth for the set of CDN components a generated game must wait for, instantiate, and wire up. PART-003, PART-021/025, PART-039, PART-050, PART-051 cross-reference this file.

If you are an LLM generating a game, **derive your `waitForPackages` set from this table only**. Do not infer it from `code-patterns.md`, `html-template.md`, or any individual PART — those documents may lag this registry.

---

## Component table

| Component (global) | CDN bundle | Mandatory unless | Spec opt-out flag | Owner PART |
|--------------------|------------|------------------|-------------------|------------|
| `FeedbackManager` | feedback-manager | never optional | — | PART-003 |
| `TimerComponent` | components | never optional (registers even if game has no timer) | — | PART-003 / PART-006 |
| `VisibilityTracker` | helpers | never optional | — | PART-003 |
| `SignalCollector` | helpers | never optional | — | PART-003 / PART-010 |
| `ScreenLayout` | components | game uses any CDN slot | — (implicit) | PART-021 / PART-025 |
| `PreviewScreenComponent` | components | spec sets `previewScreen: false` | `previewScreen: false` | PART-039 |
| `TransitionScreenComponent` | components | game has only one screen (omit slot) | (omit `slots.transitionScreen`) | PART-024 |
| `ProgressBarComponent` | components | spec is Shape 1 single-screen (omit slot) | (omit `slots.progressBar`) | PART-023 |
| `FloatingButtonComponent` | components | spec sets `floatingButton: false` | `floatingButton: false` | PART-050 |
| `AnswerComponentComponent` | components | spec sets `answerComponent: false` (creator-only) | `answerComponent: false` | PART-051 |

**Notes on the table:**

- "Mandatory unless" describes when the component can be omitted. Default is **always include**.
- "Spec opt-out flag" is the literal key in `spec.md` (or `gameContent` JSON) that disables the component. `answerComponent: false` is **creator-only** — no LLM step may auto-default it (PART-051).
- `ScreenLayout` is *implicitly* required whenever any slotted component is used, because every other component in this table mounts into a slot it owns. There is no `screenLayout: false` opt-out.
- `TimerComponent` is required even for games without a visible timer — the components bundle registers the global on load, and other code paths assume the symbol exists.

---

## How to derive your `waitForPackages` set

1. Open `spec.md` for the game you're generating.
2. Read every opt-out flag the spec declares.
3. Take the table above, **drop only the rows whose opt-out flag is set in the spec**, keep all others.
4. Each kept row's "Component (global)" cell becomes a **hard `&&` term** in the readiness expression.
5. Do not group, OR, or substitute. Do not write `|| typeof ScreenLayout !== 'undefined'`. Do not write `Components`, `Helpers`, or any umbrella name.

Worked example for a default game (no opt-outs):

```js
function waitForPackages() {
  return new Promise(function (resolve, reject) {
    var startedAt = Date.now();
    var TIMEOUT_MS = 180000;
    function check() {
      var ok =
        typeof FeedbackManager !== 'undefined' &&
        typeof TimerComponent !== 'undefined' &&
        typeof VisibilityTracker !== 'undefined' &&
        typeof SignalCollector !== 'undefined' &&
        typeof ScreenLayout !== 'undefined' &&
        typeof PreviewScreenComponent !== 'undefined' &&
        typeof TransitionScreenComponent !== 'undefined' &&
        typeof ProgressBarComponent !== 'undefined' &&
        typeof FloatingButtonComponent !== 'undefined' &&
        typeof AnswerComponentComponent !== 'undefined';
      if (ok) return resolve(true);
      if (Date.now() - startedAt > TIMEOUT_MS) {
        return reject(new Error('waitForPackages timeout: ' + TIMEOUT_MS + 'ms'));
      }
      setTimeout(check, 100);
    }
    check();
  });
}
```

If `spec.md` declares `previewScreen: false` and `answerComponent: false` (with quoted creator opt-out for the latter), drop those two rows and keep the other eight.

---

## Why `||` is forbidden in the readiness expression

The fail-open shape that shipped in `age-matters`:

```js
// ❌ WRONG
(typeof PreviewScreenComponent !== 'undefined' || typeof ScreenLayout !== 'undefined')
```

`ScreenLayout` and `PreviewScreenComponent` are both registered on `window` by the same components bundle, but at *different* points during the bundle's IIFE. `ScreenLayout` is registered first (CDN load step 2), and individual component classes register later (steps 3, 4, …). The `||` short-circuit makes the gate resolve as soon as `ScreenLayout` is defined — while the component the agent intends to instantiate is still `undefined`. The subsequent `try { new PreviewScreenComponent(...) } catch (e) {}` then fires a `ReferenceError` that is silently swallowed.

**Rule:** every component you intend to call `new X(...)` on must be a hard `&&` term in the readiness expression. No `||` operators. No umbrella substitutes. No exceptions.

---

## Slot ↔ class instantiation contract

If your file calls `ScreenLayout.inject('app', { slots: { X: true } })`, you MUST also call `new XComponent(...)` (using the slot→class map below) AND include `XComponent` in `waitForPackages`. The validator rule `GEN-SLOT-INSTANTIATION-MATCH` enforces this.

| Slot key | Component class to instantiate |
|----------|-------------------------------|
| `previewScreen` | `PreviewScreenComponent` |
| `transitionScreen` | `TransitionScreenComponent` |
| `progressBar` | `ProgressBarComponent` |
| `floatingButton` | `FloatingButtonComponent` |
| `answerComponent` | `AnswerComponentComponent` |

A slot declared but never instantiated is a wasted DOM node and a sign the gate is incomplete. A `new XComponent(...)` without a matching slot is a missing-slot bug.

---

## Catch blocks must be attributable

Component instantiation MUST surface failures, not swallow them. Use this exact shape:

```js
try {
  previewScreen = new PreviewScreenComponent({ slotId: 'mathai-preview-slot' });
} catch (e) {
  console.error('[PreviewScreenComponent ctor failed]', e && e.message, e);
  if (typeof Sentry !== 'undefined') Sentry.captureException(e);
}
```

A silent `catch (e) {}` on a `new XComponent(...)` line is forbidden — it converts a `ReferenceError` from a missing class into a null reference downstream, which the user only experiences as "the preview never appeared" 30 seconds later. Step 6 of orchestration (game-testing) fails any build with `console.error`, so an attributable error makes the bug self-detecting.

---

## See also

- `alfred/skills/game-building/reference/html-template.md` — the canonical init sequence (uses this template).
- `alfred/skills/game-building/reference/code-patterns.md` — the standalone fallback contract (re-checks this set).
- `lib/validate-static.js` rules `5f3a/b/c/d`, `GEN-WAITFORPACKAGES-NO-OR`, `GEN-WAITFORPACKAGES-MISSING`, `GEN-SLOT-INSTANTIATION-MATCH` — the static gates that enforce this registry.

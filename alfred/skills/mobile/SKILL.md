# Skill: Mobile Device Constraints

## Purpose
Defines every constraint a game must satisfy to render and play correctly on a cheap Android phone (the target device for Indian Class 5-10 students).

## When to use
When generating HTML/CSS/JS for a game. Every game must comply with all CRITICAL rules. Consult before writing any layout, input, or animation code.

## Owner
**Maintainer:** Gen Quality slot (pipeline team).
**Deletion trigger:** Retire only if games stop targeting mobile devices entirely and all references in `game-building.md` and `game-testing.md` are removed.

## Reads
- `skills/game-archetypes.md` — archetype profiles reference mobile skill — ALWAYS
- PART-020 (CSS variables) — all values come from the `--mathai-*` system — ALWAYS
- PART-021 (Screen layout) — base layout already follows these rules — ON-DEMAND
- PART-022 (Buttons) — touch target sizing — ON-DEMAND

## Input
None directly. This skill is loaded as context during game-building and game-testing.

## Output
No artifact. This skill is a constraint set — every rule here is a verification check on the generated HTML.

## Procedure
When building or reviewing a game, verify every rule below. A violation of any CRITICAL rule is a build-blocking defect. Detail files contain full CSS/JS snippets.

---

## Quick-Reference Rules

| # | Rule | Level | Detail file |
|---|------|-------|-------------|
| 1 | Viewport meta: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` | CRITICAL | [layout-and-viewport.md](layout-and-viewport.md) |
| 2 | `.game-wrapper` max-width: `var(--mathai-game-max-width)` (480px) | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 3 | Use `100dvh` everywhere, never bare `100vh` (provide `@supports` fallback) | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 4 | `overflow-x: hidden` on `html`, `body`, and `.game-stack` | CRITICAL | [layout-and-viewport.md](layout-and-viewport.md) |
| 5 | Vertical scroll only when content genuinely overflows; never during active interaction | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 6 | `env(safe-area-inset-*)` padding on outer container | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 7 | Bottom buttons clear gesture bar via `env(safe-area-inset-bottom)` | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 8 | Portrait-only; landscape shows "rotate to portrait" overlay | STANDARD | [layout-and-viewport.md](layout-and-viewport.md) |
| 9 | All buttons/options at least 44x44 CSS px | CRITICAL | [touch-and-input.md](touch-and-input.md) |
| 10 | Spacing between adjacent touch targets at least 8px | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 11 | Interactive elements in the lower 60% of the viewport (thumb zone) | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 12 | Disabled targets: `opacity: 0.6; pointer-events: none` | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 13 | Number inputs: `type="text" inputmode="numeric" pattern="[0-9]*"`, never `type="number"` | CRITICAL | [touch-and-input.md](touch-and-input.md) |
| 14 | `visualViewport` resize listener keeps question visible when keyboard opens | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 15 | FeedbackManager overlays remain visible when keyboard is open | CRITICAL | [touch-and-input.md](touch-and-input.md) |
| 16 | Enter key triggers submit on text/number inputs | CRITICAL | [touch-and-input.md](touch-and-input.md) |
| 17 | Never auto-focus inputs during transitions (keyboard flicker) | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 18 | `overscroll-behavior: none` on `html` and `body` (pull-to-refresh) | CRITICAL | [touch-and-input.md](touch-and-input.md) |
| 19 | `touch-action: manipulation` on all interactive elements | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 20 | `-webkit-touch-callout: none` and `user-select: none` on `.game-wrapper` | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 21 | `user-select: text` re-enabled on inputs | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 22 | `touch-action: none` + `user-select: none` on **draggable elements only** (never on drop-zones or their wrappers — that kills page scroll wherever the user's finger lands). Active-drag scroll suppression is handled by a document-level `touchmove` listener keyed on drag state, not by `touch-action` on the target. | STANDARD | [touch-and-input.md](touch-and-input.md) |
| 23 | No flexbox `gap` (use margins); grid `gap` is acceptable | CRITICAL | [cross-browser.md](cross-browser.md) |
| 24 | No `aspect-ratio`, `:has()`, `container queries`, `color-mix()` | CRITICAL | [cross-browser.md](cross-browser.md) |
| 25 | No optional chaining (`?.`) or nullish coalescing (`??`) | CRITICAL | [cross-browser.md](cross-browser.md) |
| 26 | No `Array.at()`, `structuredClone()`, top-level `await` | CRITICAL | [cross-browser.md](cross-browser.md) |
| 27 | Every `-webkit-` property has a standard fallback (prefix first, standard second) | STANDARD | [cross-browser.md](cross-browser.md) |
| 28 | Inputs: `-webkit-appearance: none; appearance: none`; `font-size: 16px+` (Safari zoom) | STANDARD | [cross-browser.md](cross-browser.md) |
| 29 | HTML file size under 500KB | ADVISORY | [cross-browser.md](cross-browser.md) |
| 30 | No continuous CSS animations during gameplay; momentary feedback only | ADVISORY | [cross-browser.md](cross-browser.md) |
| 31 | Use `requestAnimationFrame` for JS animations, not `setTimeout` | ADVISORY | [cross-browser.md](cross-browser.md) |
| 32 | Resize/scroll handlers are debounced | ADVISORY | [cross-browser.md](cross-browser.md) |
| 33 | Total DOM element count under 500; render current round only | ADVISORY | [cross-browser.md](cross-browser.md) |
| 34 | Font family via `var(--mathai-font-family)`; no bare custom fonts | STANDARD | [css-variables.md](css-variables.md) |
| 35 | No font size below 14px anywhere; inputs are 16px+ | STANDARD | [css-variables.md](css-variables.md) |
| 36 | Line height 1.4+ on text blocks | STANDARD | [css-variables.md](css-variables.md) |
| 37 | All colors use `--mathai-*` variables, no hardcoded hex | STANDARD | [css-variables.md](css-variables.md) |
| 38 | All spacing/radii use `--mathai-*` variables where one exists | STANDARD | [css-variables.md](css-variables.md) |
| 39 | In preview-wrapper mode (`previewScreen: true`), `.mathai-preview-body` is the single vertical scroll owner. Lock root/page scrolling and do NOT add nested `overflow-y:auto` containers inside `.game-stack`. | CRITICAL | [layout-and-viewport.md](layout-and-viewport.md) |

---

## Defaults

When the spec does not mention mobile behavior:
- Viewport: 375x667, portrait only
- Touch targets: 44px minimum
- Typography: system font stack via `--mathai-font-family`, 16px body
- Scroll: vertical allowed only if content overflows; horizontal never
- Keyboard: numeric keypad for number inputs, Enter submits
- Orientation: portrait locked
- Safe areas: all `env()` insets applied

## Anti-patterns

1. **Never use `100vh`** — always `100dvh` (with fallback). STANDARD.
2. **Never use `type="number"`** — use `type="text" inputmode="numeric"`. CRITICAL.
3. **Never set font-size below 16px on inputs** — causes Safari auto-zoom. STANDARD.
4. **Never use flexbox `gap`** — use margins (grid `gap` is fine). CRITICAL.
5. **Never use optional chaining (`?.`)** — explicit null checks only. CRITICAL.
6. **Never hardcode colors** — use `--mathai-*` variables. STANDARD.
7. **Never use `-webkit-` without the standard property**. STANDARD.
8. **Never auto-focus inputs during transitions** — causes keyboard flicker. STANDARD.
9. **Never place interactive elements in the top 40% of screen** — thumb zone violation. STANDARD.
10. **Never allow horizontal scroll** — `overflow-x: hidden` on html, body, and game-stack. CRITICAL.
11. **Never omit `overscroll-behavior: none`** — pull-to-refresh will reload mid-game. CRITICAL.
12. **Never omit `touch-action: manipulation` on buttons** — 300ms delay + double-tap zoom. STANDARD.
13. **Never render all rounds at once** — budget phones choke above 500 DOM elements. ADVISORY.
14. **Never use continuous animations during gameplay** — momentary feedback only. ADVISORY.
15. **Never set `overflow: hidden` on `#app` (the full-page game container)** — on short viewports the preview screen + play area + piece bank + results can sum to more than 100dvh, and this clips the overflow so mouse-wheel scroll AND touch-swipe scroll both appear to do nothing. Use `overflow-x: clip` (or omit overflow entirely) — horizontal scroll is already prevented by `overflow-x: hidden` on html/body, and `position:fixed` overlays are unaffected by #app's box so there is nothing legitimate to clip. CRITICAL.
16. **Never set `touch-action: none` on drop-zones, grids, or piece banks** — these typically cover most of the viewport, and `touch-action: none` disables the browser's pan gesture there, killing mobile scroll. Scope `touch-action: none` to the draggable elements only; use a document-level `touchmove` + `preventDefault` keyed on drag state for active-drag scroll suppression. CRITICAL.

## Verification Checklist

- [ ] Viewport meta tag present with correct attributes — CRITICAL
- [ ] `.game-wrapper` max-width constrained — STANDARD
- [ ] `100dvh` used, never bare `100vh` — STANDARD
- [ ] `overflow-x: hidden` on `html`, `body`, `.game-stack` — CRITICAL
- [ ] All touch targets 44x44px+ with 8px spacing — CRITICAL/STANDARD
- [ ] Interactive elements in lower 60% — STANDARD
- [ ] Font family via variable, no size below 14px, inputs 16px+ — STANDARD
- [ ] All colors via `--mathai-*` variables — STANDARD
- [ ] Safe area insets applied — STANDARD
- [ ] `inputmode="numeric"` with `type="text"` for numbers — CRITICAL
- [ ] `visualViewport` listener for keyboard — STANDARD
- [ ] FeedbackManager visible with keyboard open — CRITICAL
- [ ] Enter key submits — CRITICAL
- [ ] Landscape overlay present — STANDARD
- [ ] `overscroll-behavior: none` present — CRITICAL
- [ ] `touch-action: manipulation` on interactive elements — STANDARD
- [ ] Preview-wrapper mode uses `.mathai-preview-body` as the only vertical scroll container — CRITICAL
- [ ] No banned CSS/JS features — CRITICAL
- [ ] File under 500KB, DOM under 500 elements — ADVISORY

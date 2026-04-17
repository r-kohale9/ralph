### PART-024: TransitionScreen Component (v2)

**Source of truth:** `warehouse/parts/PART-024-transition-screen.md`

**Purpose:** Welcome, round intro, level / section intro, motivation, victory, game over, stars collected — every between-phase screen except Preview.

**API:** `new TransitionScreenComponent({ autoInject: true })` → `.show({ icons, stars, title, subtitle, buttons, duration, persist, content, styles, onMounted })` → `.hide()`.

Injects into `#mathai-transition-slot` (sibling of `#gameContent` inside `.game-stack`).

**Invariants:**
- **Every transition MUST play audio** — no silent transitions. Silent = not mathai-equivalent. Fire audio via the `onMounted` callback: `onMounted: () => FeedbackManager.sound.play('<id>', { sticker })`. Approved IDs: `vo_game_start`, `sound_game_complete`, `sound_game_over`, `vo_level_start_N`, `vo_motivation`, `sound_correct`, etc.
- **`stars` and `icons` share one DOM slot — pass only ONE.** Internally the component writes `stars`'s star markup into `.mathai-ts-icons`; when `stars` is present, any `icons: [...]` emoji never renders. Victory uses `stars: N`; all other transitions (Welcome, Round Intro, Section Intro, Motivation, Game Over, Stars Collected) use `icons: ['<emoji>']`.
- **CRITICAL: `show()` Promise resolves IMMEDIATELY** (next `requestAnimationFrame` after `onMounted` fires) — it does NOT block until a button is tapped, and it does NOT block for a `duration`. `duration` and `persist` are documented in the options table but the CDN component does NOT implement either — `show()` never reads them. Code after `await transitionScreen.show(...)` runs before the student interacts. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. For auto-dismiss screens (round intro), fire audio + `hide()` + continuation inside the `onMounted` IIFE. Validator rule `5e2-TS-PERSIST-FALLTHROUGH`. (scale-it-up-ratios 2026-04-17: welcome screen skipped because `showRoundIntro(1)` ran after `await show()`.)
- **`show()` takes ONE options-object argument.** Never a string title as the first arg (GEN-TRANSITION-API).
- **`icons[]` accepts emoji strings only** — never SVG / HTML / path markup (GEN-TRANSITION-ICONS).
- **Button labels come from `pre-generation/screens.md`.** Never invent buttons (e.g. an `Exit` button the plan didn't list). Count, labels, order match the screen's Elements table.
- **Results / Game Over content mounts here, not in a separate `#results-screen` div.** Pass `content: metricsHTML, persist: true, buttons: [...]`. Do NOT create a top-level results overlay.
- **No `duration` + `buttons` on the same screen.** Use one or the other.
- **`voGameStartPlayed` guard** prevents duplicate Welcome VO when restart skips preview + welcome.

**ScreenLayout requirement:** `ScreenLayout.inject({ slots: { ..., transitionScreen: true } })` or `sections.transitionScreen: true` — slot must exist.

**Typical patterns:** `auto-dismiss` (round intro, stars collected) → `await FeedbackManager.sound.play(...); ts.hide();`. `tap-dismiss` (welcome, motivation, victory, game over) → button click handler calls `ts.hide()`.

**Default transition screens.** The 4 standard end-of-flow transitions (`game_over`, `motivation`, `victory`, `stars_collected`) have canonical templates in `alfred/skills/game-planning/reference/default-transition-screens.md`. Structure is fixed; strings come from `screens.md` (copied from the defaults unless the spec overrides).

See `warehouse/parts/PART-024-transition-screen.md` for full detail.

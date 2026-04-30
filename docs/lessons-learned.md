# Ralph Pipeline — Lessons Learned

Accumulated insights from build failures, bug fixes, and proofs. Update immediately after every notable build or bug fix.

---

## Sound id invented + URL copied from previous preload row — `bubble_pop_sfx` regression (2026-04-29 — cross-logic)

**Lesson L-SOUND-ID-001: planner invented a sound id; builder filled the URL by copy-pasting the previous preload row; cell taps played the round-intro sting instead of a bubble.** | Source: cross-logic 2026-04-29 — `plan.md:94, 180` named the cell-tap SFX `bubble_pop_sfx`. That id does NOT appear in `feedback/reference/feedbackmanager-api.md`'s canonical (id, URL) table. The planner LLM made up a name because the spec said "soft bubble micro-SFX" + "pop" felt natural. The build agent then registered the invented id at `index.html:2161` with a URL copied from the row above (`rounds_sound_effect → …1757506558124.mp3`), because the plan didn't supply a URL and the canonical table didn't either (the id wasn't in it). Result: every cell tap played the round-intro sting at the volume and tone of a transition cue. A 12-puzzle L4 logic-grid game with constant tapping turned into background-music-on-every-tap; the canonical CASE 9 sound is `sound_bubble_select` at `…1758162403784.mp3`, and the canonical table specifies it explicitly at `feedbackmanager-api.md:162`.

**Same three-layer pattern as L-FB-SUBTITLE / L-TS-AUDIO.** Fabrication-without-canonical-source bug:

| Layer | Today's state | Effect |
|---|---|---|
| **Spec/plan content** | Planner free to invent sound ids; nothing forced consultation of `feedbackmanager-api.md`'s canonical table. | `bubble_pop_sfx` slipped past plan review. |
| **Build wiring** | Build skill said "use exact URLs from feedbackmanager-api.md" but didn't enforce that the (id, url) PAIR matches. The builder treated id and url as independently chosen. | URL drift: invented id paired with copy-pasted URL → wrong sound plays at runtime. |
| **Validator** | `5b2-REGISTER` blocked `sound.register()`. `PART-011-SOUND` blocked the wrong API call. Nothing whitelisted ids; nothing pinned id → URL. | `bubble_pop_sfx + rounds URL` passed Step 5 cleanly. |

**Why the build picked the copy-paste URL with confidence.** The previous preload entry was `rounds_sound_effect → …1757506558124.mp3`. The builder needed a URL for `bubble_pop_sfx`, the plan didn't supply one, and the most recently-seen URL in the file was the rounds URL. Without a canonical lookup, "stay near the local context" is the path of least resistance.

**Fix landed 2026-04-29:**

1. **Canonical table promoted to authoritative** (`feedbackmanager-api.md` § Standard Audio URLs) — one-paragraph "AUTHORITATIVE" header above the table; invented ids forbidden; (id, URL) pair fixed; custom assets via spec's `creatorSounds` block.
2. **Feedback skill CASE 9 row tightened** — explicitly enumerates `sound_bubble_select` / `sound_bubble_deselect` / `tap_sound` and names invented variants like `bubble_pop_sfx` / `tap_select_sfx` as forbidden.
3. **Spec-creation rule** — sound ids not spec-creation's invention space; optional `creatorSounds` block holds creator-uploaded URLs only.
4. **Game-planning rule** (§ 7d) — every sound id in plan.md MUST be canonical or in `spec.creatorSounds`; planner asks via clarifying-question loop, never guesses.
5. **Build skill rule** — every preload `(id, url)` pair MUST match canonical verbatim; copy-from-previous-row anti-pattern forbidden.
6. **Validator** (`alfred/scripts/validate-static.js`) — new rule `GEN-SOUND-ID-CANONICAL`. Hard-coded canonical map snapshotted from `feedbackmanager-api.md`. Two failure modes flagged: (a) invented id not in canonical / aliases / `spec.creatorSounds`; (b) URL drift on canonical id. Auto-skips dynamic id expressions. Smoke-tested: cross-logic's `bubble_pop_sfx` flagged correctly; synthetic URL drift flagged correctly; spot-the-pairs + hexa-numbers pass.

**Open documentation drift (out of session scope).** Several skill-doc references (`sound_game_over`, `sound_motivation`, `sound_game_victory`, `sound_stars_collected`, `sound_game_complete`) are NOT in the authoritative table — they're aliases used in `default-transition-screens.md` and `code-patterns.md` without canonical URLs. The validator allows these aliases (id permitted, URL not enforced) so existing games don't break, but next sweep should add proper URLs to the canonical table OR migrate skill docs to canonical names.

**Affected games:** cross-logic only — validator flags on next regeneration; new build will use `sound_bubble_select` + canonical URL. spot-the-pairs and hexa-numbers pass.

**Sibling, not extension.** Third instance of the "creator-content slot needs a canonical source + validator gate" pattern, joining L-TS-AUDIO and L-FB-SUBTITLE. Each handles a different content domain (TS narration, per-attempt subtitle, sound id/URL); the remediation recipe is shared but the canonical surfaces are disjoint.

---

## TransitionScreen TTS narration silently dropped — SFX-only onMounted regression (2026-04-29 — cross-logic, spot-the-pairs, hexa-numbers)

**Lesson L-TS-AUDIO-001: feedback/SKILL.md prescribed SFX → TTS in onMounted; default-transition-screens.md per-screen tables showed only SFX. Build agents followed the latter and dropped TTS** | Source: cross-logic + spot-the-pairs regenerated builds, both shipped with `safePlaySound(...).catch(noop)` and zero `playDynamicFeedback` calls inside any TS `onMounted`. hexa-numbers (Round Intro + Victory) shows the same shape.

The Alfred pipeline gave contradictory guidance about TS audio:
- `feedback/SKILL.md` § Composition with screen primitives (rows 198-204) + CASE 1/2/11/12 prescribed `await safePlaySound(...) → await playDynamicFeedback({audio_content, subtitle, sticker})` for every prescribed TS.
- `game-planning/reference/default-transition-screens.md` § 1-4 per-screen tables showed only `FeedbackManager.sound.play('sound_*', {sticker})` in each `onMounted` row — no TTS line.
- `game-building/SKILL.md` line ~283 prescribed `onMounted: () => FeedbackManager.sound.play('<id>', {sticker})` — SFX-only example.
- `spec-creation/SKILL.md` had no field for per-screen TS narration text and forbade inventing copy without a creator quote (line 224).
- `validate-static.js` `GEN-FEEDBACK-TTS-AWAIT` carved out `onmounted`/`showroundintro`/`showvictory`/etc., exempting TS audio from TTS-await enforcement.

Every signal pointed the build agent toward SFX-only. The TTS prescription existed only in feedback/SKILL.md's composition table — the build agent's per-screen reference of choice was default-transition-screens.md, which was silent on TTS. Result: every regenerated game shipped with sticker SFX only on every TS, no spoken narration anywhere outside the gameplay correct/wrong path.

Fix landed 2026-04-29 across spec, planning, building, validator, and games:

1. **Ownership clarified.** TS audio is OWNED by game-planning (which writes the resolved `## Screen Audio` table into `pre-generation/screens.md`) and `default-transition-screens.md` (canonical narration templates). Spec-creation does NOT enumerate TS audio — it only carries an OPTIONAL `creatorScreenAudio` block when the creator quoted per-screen narration or asked for a screen's TTS to be skipped. This mirrors how `previewAudioText` is only present when the creator authored content.

2. **Default narration strings published.** `default-transition-screens.md` got a new "Default narration strings" subsection with canonical templates (e.g. `"Puzzle ${n} of ${N}"`, `"Victory! You got ${score} out of ${totalRounds}!"`, `"Ready to improve your ${primaryMetric}?"`). These are runtime data interpolations (round number, score, game title, primary metric), NOT authored prose — using them is not invention. Stars Collected stays silent by canon (SFX + show_star + setTimeout, no TTS).

3. **Per-screen tables reconciled.** Each `onMounted` row in default-transition-screens.md § 1-3 now reads `await safePlaySound(...) → try { await playDynamicFeedback({audio_content: ttsText, subtitle: ttsText, sticker}); } catch(e){}` — the same shape as feedback/SKILL.md's composition table. The two references no longer disagree.

4. **Game-planning owns the resolution.** A new step in `game-planning/SKILL.md` walks the prescribed TS list for the game shape, pulls templates from default-transition-screens.md, applies any `creatorScreenAudio` overrides from the spec, and writes the resolved `## Screen Audio` table at the top of `screens.md`. The build agent reads ONLY this table for TS audio decisions.

5. **Validator enforcement.** Two new rules in `alfred/scripts/validate-static.js`: `GEN-TS-TTS-MISSING` flags any prescribed TS `onMounted` lacking a `playDynamicFeedback`/`safeDynamic`/`safePlayDynamic` call (auto-skips Stars Collected and standalone games). `GEN-TS-AUDIO-AWAITED` requires both SFX and TTS to be `await`ed when both are present in the same `onMounted` body. Implementation note: the rules use a balanced-brace traversal (`_extractTsShowBlocks`) instead of the naive non-greedy regex `[\s\S]{0,4000}?\}\s*\)`, which stops at the FIRST `})` (typically the inner `safePlaySound({sticker})` close) and would miss the rest of the `onMounted` body where the TTS call lives.

6. **Build skill snippets.** `code-patterns.md` got new "Canonical Round Intro snippet" + "Canonical Welcome snippet"; the existing Canonical Victory snippet (added in the FloatingButton-lifecycle session 2026-04-28) gained the awaited-TTS chain after the SFX. `flow-implementation.md` per-screen rows updated to the SFX → TTS shape.

7. **Game backfill.** spot-the-pairs got a `safeDynamic` helper + awaited SFX → TTS in Welcome / Round Intro / Victory / Game Over / Motivation (validator now passes). cross-logic's index.html was moved to `index.html.prev` mid-session; a fresh build will pick up the new pipeline contract automatically. hexa-numbers (Round Intro + Victory) is out of session scope; the validator will flag it on its next regeneration.

**Pipeline-level invariant going forward:** every prescribed TS plays SFX → TTS, both awaited, in `onMounted`. The narration content comes from `screens.md` (default templates by canon, creator overrides via `creatorScreenAudio`). Stars Collected is the only silent-by-canon screen. Standalone games (`totalRounds === 1`) have no TS at all and use the inline `#gameContent` end-flow panel.

---

## Victory buttons stripped to silence FloatingButton-TS-CTA rule (2026-04-29 — cross-logic, bodmas-blitz, doubles)

**Lesson L-VICTORY-001: `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` reserved-word list incorrectly included `Play Again`** | Source: cross-logic Step 5 RCA 2026-04-29; bodmas-blitz 2026-04-23 regression; doubles (suspected)

Three sub-agent regressions across two weeks all traced to the same pipeline contradiction. The default Victory template (`alfred/skills/game-planning/reference/default-transition-screens.md` § 3) requires `[Play Again, Claim Stars]` for `<3★` and `[Claim Stars]` for `3★`. The validator rule `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` then flagged `text: 'Play Again'` because the reserved-word list grouped it with navigation verbs (`Next | Continue | Done | Finish | Go to Next | Play Again`). Sub-agents read the validator error literally and chose the easy fix: strip ALL Victory buttons (`buttons: []`), wire `transitionScreen.onDismiss(...) → showStarsCollected`. Side effects: (a) `Play Again` branch unreachable — `<3★` runs go straight to Stars Collected with no retry option, killing the documented motivation/restart loop; (b) tap-anywhere dismiss replaces explicit-button dismiss, deviating from the canonical Victory template; (c) `floatingBtn.setMode('next')` named in the workaround comment but not actually wired in `showVictory` (cross-logic example) — the FloatingButton was never re-shown after Victory dismissed.

Root cause was the reserved-word list conflating two semantically distinct categories:
- **Navigation verbs** — `Next`, `Continue`, `Done`, `Finish`, `Go to Next`, `Skip Forward`. These advance the lifecycle by one step. They are FloatingButton's job. Putting them on a TS card creates the documented double-Next UX (player taps card-Next, sees floating-Next at the bottom, can't tell which fires `next_ended`).
- **Semantic end-game actions** — `Play Again`, `Claim Stars`, `Try Again`, `I'm ready`, `Let's go`, `Skip`. These name a destination/branch (route to `showMotivation`, `showStarsCollected`, `restartGame`). They belong on TS cards.

Fix landed 2026-04-29: (1) Removed `Play Again` from the navigation-verb reserved list in `lib/validate-static.js` (`GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`). The list now contains navigation verbs only. (2) Added new positive rule `GEN-VICTORY-BUTTONS-REQUIRED` that fires when a `transitionScreen.show({...title: /Victory/i...})` call is missing a `Claim Stars` button, OR is missing `Play Again` while branching on `gameState.stars` / `showMotivation` exists. Catches the strip-and-onDismiss regression directly. (3) Added `GEN-FLOATING-BUTTON-LIFECYCLE` requiring `floatingBtn.setMode('hidden')` (or `.destroy()`) within ±25 lines of any Victory / Game Over / Motivation `transitionScreen.show()` — Victory's in-card buttons can't compete with a stale submit-mode floating button.

Companion doc updates: `alfred/skills/game-planning/reference/default-transition-screens.md` got a new top-level "FloatingButton ownership per screen" table and a "Game shape: when these screens apply" table that distinguishes multi-round vs standalone end-flows. `alfred/skills/game-building/reference/code-patterns.md` got three canonical snippets: Victory (multi-round, AnswerComponent enabled), Stars Collected → AnswerComponent → next_ended chain, and standalone end-flow (no TransitionScreen). The "FloatingButton ownership (CRITICAL)" subsection enumerates the three regression patterns the validator now blocks.

Cross-game backfill required: cross-logic, bodmas-blitz (2026-04-23 source of the rule's reserved list), doubles (suspected). Each needs `showVictory` rebuilt per the canonical snippet — restore conditional `[Play Again, Claim Stars]`, add `floatingBtn.setMode('hidden')` before show, remove the `transitionScreen.onDismiss(...)` workaround.

**Standalone games (`totalRounds === 1`) are unaffected** — `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` already bans TransitionScreen entirely. End-flow is inline `#gameContent` panel + `floatingBtn.setMode('next')`. Documented as "Canonical Standalone end-flow" snippet in code-patterns.md.

---

## waitForPackages fail-open gate (2026-04-28 — age-matters preview-never-mounts bug)

**Lesson L-INIT-001: `||` inside `waitForPackages` readiness expression creates fail-open gates — never use it** | Source: age-matters cold-load logs 2026-04-28, full-pipeline gap analysis
Age-matters shipped with `(typeof PreviewScreenComponent !== 'undefined' || typeof ScreenLayout !== 'undefined')` in `waitForPackages`. `ScreenLayout` is bundled in the components umbrella and registers on `window` *before* the individual component classes (`PreviewScreenComponent`, `TransitionScreenComponent`, …) register during the same bundle's IIFE. The `||` short-circuits as soon as `ScreenLayout` is defined, so init proceeds while the component the agent intends to instantiate is still `undefined`. The subsequent `try { new PreviewScreenComponent(...) } catch (e) {}` with an empty catch silently swallows the `ReferenceError`, `previewScreen` stays `null`, and the 2-second standalone fallback boots the game with no preview. The bug is invisible on warm reloads because the bundle is in cache and all classes are defined synchronously — only cold loads expose the race. **Rule:** every component the file calls `new X(...)` on must be a hard `&&` term in the readiness expression, never `||`. Validator rule `GEN-WAITFORPACKAGES-NO-OR` (lib/validate-static.js, 5f3h) rejects any `||` operator inside the `waitForPackages` body. Validator rule `GEN-WAITFORPACKAGES-MISSING` (5f3i) cross-checks every `new XComponent(...)` against a matching `typeof XComponent` *inside the waitForPackages body* (a typeof guard at instantiation time is the silent-skip variant of the same bug — same null-reference outcome). Validator rule `GEN-SLOT-INSTANTIATION-MATCH` (5f3j) requires every `slots: { X: true }` in `ScreenLayout.inject(...)` to have a matching `new XComponent(...)` constructor. Blast radius at fix time: 3 of 3 audited games affected (age-matters, spot-the-pairs — same `|| ScreenLayout` shape; cross-logic — silent-skip variant with `if (typeof X !== 'undefined') new X(...)`).

**Lesson L-INIT-002: Silent `try { ... } catch (e) {}` on component instantiation hides the root cause** | Source: same session
The `html-template.md` recommended init sequence used silent catches around every `new XComponent(...)` call. A `ReferenceError` from a missing class therefore disappeared with no `console.error` and no Sentry capture. Step 6's "no console errors" gate then passed cleanly while the game was actually broken. Fix: every component instantiation MUST use an attributable catch — `console.error('[X ctor failed]', e.message, e); if (typeof Sentry !== 'undefined') Sentry.captureException(e)`. Step 6's existing zero-console-error gate then makes the bug self-detecting on the next build.

**Lesson L-INIT-003: Mandatory-component list must live in one place, derived from spec opt-outs** | Source: same session
The mandatory-component roster was scattered across PART-003 (4 baseline packages), PART-021/025 (slots), PART-039 (Preview), PART-050 (FloatingButton), PART-051 (AnswerComponent). The build agent reading any one of those files got a partial list, so the agent extrapolated — adding components inconsistently across games (age-matters had `PreviewScreenComponent` with `||` fallback; cross-logic omitted Preview/Transition entirely from the gate). Fix: single canonical registry at `alfred/skills/game-building/reference/mandatory-components.md` with the full table + spec opt-out flags + slot↔class map. PART-003 now redirects to the registry; html-template.md and code-patterns.md cite the registry as source of truth.

**Lesson L-INIT-004: Standalone fallback must re-check the readiness gate before booting** | Source: same session
The 2-second `setTimeout` standalone fallback (in `code-patterns.md`) called `setupGame()` whenever `gameState.isActive === false`, with no re-verification that mandatory components were instantiated. When `waitForPackages` had a fail-open gate, the fallback then booted the game with `previewScreen === null`, masking the bug as "preview just doesn't appear" instead of "init failed." Fix: the fallback now re-checks every required class against the same set as `waitForPackages` and, if any are missing, renders an inline `"Game failed to load — please refresh"` error and logs `Sentry.captureMessage('standalone fallback: required class undefined: <name>')`. The fallback does NOT silently boot with a partial component graph.

**Lesson L-INIT-005: Step 6 needs a cold-load category — warm reloads hide the bug** | Source: same session
Step 6's 5 categories (game-flow, mechanics, level-progression, edge-cases, contract) all run after the page settles, with the CDN bundle in cache. The fail-open gate only fires on cold loads where script-load order matters. Fix: added Category 1.5 (init-readiness, cold load) to `alfred/skills/game-testing/SKILL.md` — runs the page with cache disabled, asserts every kept component (`previewScreen`, `transitionScreen`, etc.) is non-null within 5s of `DOMContentLoaded`, asserts `data-phase !== 'gameplay'` while preview is enabled, and asserts no `console.error`. Cold load is the runtime backstop for the validator's static checks.

---

## Voice-input disable lessons (2026-04-23 — word-problem-workshop interaction-after-submit bug)

**Lesson L-VI-001: `voiceInput.disable()` alone does NOT block keyboard typing — textarea stays typeable** | Source: word-problem-workshop manual bug report 2026-04-23, confirmed via Playwright diagnostic
User reported "I am still able to interact even after submitting" on word-problem-workshop. Root cause chain: (1) CDN VoiceInput's `disable()` sets internal `_disabled` flag to `true` AND renders a 50%-opacity wrapper, but does NOT reliably set `textarea.disabled=true` on the rendered textarea. (2) Before fix, the submit handler also awaited `FeedbackManager.playDynamicFeedback()`, so any TTS network stall kept the input re-enable blocked for seconds — but even during that window, the student could keep typing into the textarea because `_disabled=true` was only enforced on mic toggle + toolbar button click handlers, not on keyboard input focus. (3) Playwright verification (`/Users/sammitbadodekar/ralph/_wpw_verify.js`) injecting fake keystrokes during processing confirmed: `textareaDisabled=false`, `textareaReadOnly=false`, mic/hint correctly blocked via `pointer-events:none`, but typed text appended. Fix requires FOUR layers of defense-in-depth: (a) fire-and-forget TTS (remove `await` on `playDynamicFeedback`) so flow is not coupled to audio completion, (b) CSS `#gameContent.is-processing .voice-input-wrapper { pointer-events: none }` to block mouse/touch on mic/toolbar, (c) JS `textarea.disabled = true; textarea.readOnly = true; textarea.blur()` right after `voiceInput.disable()` to block keyboard input, (d) matching re-enable `textarea.disabled = false; textarea.readOnly = false` right after `voiceInput.enable()` in `loadRound()`. The warehouse CDN source (`warehouse/packages/components/voice-input/index.js`) was also patched to add `_disabled` guards in `_onMicToggleClick`, `_onToolClick`, `_syncUI`, plus a wrapper-level `.vi-disabled` CSS class, but that fix only takes effect once the CDN is redeployed to `storage.googleapis.com/test-dynamic-assets/packages/components/index.js`. Until redeployed, the game-level defense is what protects users. Canonical rule lives in `alfred/skills/interaction/reference/patterns/p17-voice-input.md` Constraint 3 + Anti-patterns table (last row) + lifecycle snippets.

**Lesson L-VI-002: Never couple submit re-enable to TTS completion — audio must be fire-and-forget** | Source: same session, skill doc sweep
The audio-await anti-pattern (`await FeedbackManager.playDynamicFeedback(...)` inside a submit handler followed by re-enabling inputs) is fragile: if the TTS network stalls or the API returns slow, the entire input-disable window stretches from ~200ms to many seconds or indefinitely. The learner sees "Evaluating..." and can tap mic/submit/hint during the gap. The fix pattern is universal: (1) use `ttsPromise = FeedbackManager.playDynamicFeedback(...); ttsPromise.catch(e => console.error(...))` — NO `await`, (2) use a fixed-duration `setTimeout` (e.g. 4000ms) as a "read the feedback panel" dwell, (3) make `loadRound()` / `renderRound()` / `advanceRound()` the ONLY place that re-enables inputs (never the submit handler's post-audio block). Sweep-time impact: 6 games had the bug (tap-or-tell, say-the-answer, puzzle, odd-one-out, fill-the-gap, equation-builder) plus word-problem-workshop. 20 skill docs taught the anti-pattern and were rewritten (feedback/SKILL.md CASE 4/7, reference/timing-and-blocking.md, reference/feedback-summary.md, feedbackmanager-api.md, eval.md, interaction/patterns p07/p17/p06, state-and-guards.md, subjective-evaluation/reference/api.md + SKILL.md, game-building/code-patterns.md, game-planning/plan-formats.md, alfred/parts/PART-017.md, warehouse/parts PART-017/PART-015/PART-026, mathai-game-builder/workflows/phase-3-feedback.md + checklists feedback-integration + subjective-evaluation). The distinction to preserve: awaiting TTS is STILL correct inside transition-screen/CTA callbacks where the user explicitly tapped a button to hear the full prompt — just not inside submit handlers where game flow must continue.

---

## Feedback cleanup lessons (2026-04-21 — portfolio audit)

**Lesson L-FB-001: FeedbackManager overlay auto-clear does NOT fire on silent round transitions or end-screen entry** | Source: Gen Quality audit 2026-04-21 (user question on cleanup-between-rounds requirement)
The common assumption that "FeedbackManager auto-clears previous feedback because the overlay is reused" is only half true. The CDN overlay auto-clear fires ONLY when a NEW `playDynamicFeedback()` call starts — same DOM node, new content. It does NOT fire on: (1) silent `nextRound()` where the new round doesn't immediately call playDynamicFeedback, (2) `endGame()` transitioning to TransitionScreen victory/game-over, (3) `restartGame()` recreating components, (4) level-transition action callbacks, (5) skip/next button handlers, (6) any TransitionScreen buttons[].action that advances state. Symptom: previous round's TTS subtitle still visible and previous sticker still animating when the end screen paints; previous round's audio still audible for 1-3s into the new round. Before this fix the only gate catching the bug was the UI/UX slot playthrough (30 min after build, one game at a time); no T1 / prompt rule / test / skill document enforced it. Portfolio sweep at fix time showed 8 of 10 shipped games affected (only matching-doubles and word-problem-workshop already complied). **Canonical source:** the rule now lives in `alfred/skills/feedback/SKILL.md` Cross-Cutting Rule 10 + Anti-patterns 13–14, reinforced in `alfred/skills/feedback/reference/timing-and-blocking.md` (Stop Triggers table + new "Round/Phase Cleanup" section), and `alfred/parts/PART-017.md` (new key-rule + checklist items). Downstream: `lib/prompts.js` GEN-CLEANUP-BETWEEN-ROUNDS rule in CDN_CONSTRAINTS_BLOCK (single edit propagates to all 6 prompt paths — buildGenerationPrompt, buildCliGenPrompt, and 4 fix prompts) cites alfred as the authority. `lib/validate-static.js` validator rule `5e0-CLEANUP-BETWEEN-ROUNDS` (balanced-brace function-body extractor checks nextRound / scheduleNextRound / endGame / restartGame for `FeedbackManager.sound.stopAll()` or `FeedbackManager.stream.stopAll()` or equivalent playDynamicFeedback-triggered auto-clear or explicit feedback DOM reset). `warehouse/verification-checklist.md` Section 2 and Section 6 items updated. Canonical cleanup call uses try/catch because `.stopAll` is not on every CDN bundle version — a bare `FeedbackManager.sound.stopAll()` throws TypeError on older bundles and deadlocks the round the same way `.sound.playDynamicFeedback` does (Lesson 115).

**Lesson L-FB-002: Cleanup must happen BEFORE gameState mutation, not after** | Source: Gen Quality audit 2026-04-21
The cleanup block must run BEFORE any `gameState.currentRound++`, `gameState.phase =`, `gameState.gameEnded = true`, or `renderRound()` call. If cleanup runs after state mutation, there is a 1-2 frame window where the next round's UI paints while the previous round's sticker / TTS subtitle is still visible — visually jarring and detectable in Playwright screenshots. Canonical ordering in `endGame()`: (1) gameEnded guard, (2) set `gameState.gameEnded = true`, (3) cleanup block, (4) set `gameState.isActive = false`, (5) set `gameState.phase = reason === 'victory' ? 'results' : 'gameover'`, (6) `syncDOMState()`, (7) `await transitionScreen.show({...})`. This matches the GEN-PHASE-SEQUENCE ordering (Lesson L-GF-004) where phase assignment precedes syncDOMState — cleanup slots in right after the gameEnded guard.

---

## Scroll-killer lessons (2026-04-17 — jigsaw-puzzle scroll audit)

**Lesson L-SCROLL-001: `#app { overflow: hidden }` is a silent scroll killer on every generated game** | Source: jigsaw-puzzle 2026-04-17 scroll-audit, pipeline portfolio sweep
The canonical `#app` CSS block in `alfred/skills/game-building/reference/css-reference.md` (lines 87–100) shipped with `overflow: hidden`. Every game template copies this verbatim, so **8 of 9 shipped games inherited the bug** (only `possition-maximizer` happened to omit it). On any viewport where preview-screen + play-area + piece-bank + results sum to more than 100dvh (e.g. all drag-and-drop games on 375×667 mobile, content ≈1100–1200px), the rule silently clips the vertical overflow while `#app`'s flex-column still grows with its children. Result: html/body end up with the same height as #app, body has nothing to scroll past the viewport, AND mouse wheel / touch swipe both appear to do nothing. Not a touch-specific issue — desktop wheel is equally dead. Fix: replace with `overflow-x: clip` (keeps accidental horizontal scroll prevention, allows vertical body scroll). Horizontal clipping is already enforced by `overflow-x: hidden` on html/body. Absolute/fixed overlays (dragging piece, popups) are not constrained by #app's box so there is nothing legitimate to clip here. Fixed in: `css-reference.md`, `data/concepts/game-design-word-problem-workshop.md`, `mobile/SKILL.md` (new anti-pattern #15), plus all 8 affected shipped games. T1 follow-up: add a validator check that flags `#app { ... overflow: hidden ... }` as CRITICAL.

**Lesson L-SCROLL-002: `touch-action: none` on drop-zones kills mobile scroll portfolio-wide** | Source: jigsaw-puzzle 2026-04-17 scroll-audit, `mobile/SKILL.md` rule 22 review
`alfred/skills/mobile/SKILL.md` rule 22 prescribed "`touch-action: none` + `user-select: none` on **draggables/drop-zones**" and the reference example in `touch-and-input.md` §13 showed the selector `.draggable, .drop-zone { touch-action: none; }`. The draggable half is correct (needed so pointer-event drag suppresses the browser's native pan gesture). The drop-zone half is the bug — drop-zones (grids, buckets, piece banks) typically cover most of the mobile viewport, so `touch-action: none` there tells the browser to refuse to treat ANY swipe starting on them as a pan, killing page scroll whenever the user's finger lands in the play area. jigsaw-puzzle shipped with `touch-action: none` on `.puzzle-grid` + `.piece-bank` (≈95% of viewport combined on 375×667). sort-the-shapes spec and plan already prescribed the same pattern for buckets. Active-drag scroll suppression doesn't need this at all — the existing `document.addEventListener('touchmove', e => { if (dragState) e.preventDefault() }, { passive: false })` pattern covers the drag interval. Fix: rewrote rule 22 to scope `touch-action: none` to **draggables only**, added CRITICAL anti-pattern #16 to mobile/SKILL.md, updated the reference selector and example in `touch-and-input.md` §13 (now shows the correct JS `touchmove` handler alongside the CSS), and fixed `games/sort-the-shapes/spec.md` + `plan.md` before the first build. Verification: Playwright 375×667 + CDP `Input.dispatchTouchEvent` — after fix, grid swipe scrolls 444px, bank swipe 492px, desktop wheel on grid/bank 260–280px across 480×700 and 1280×720.

---

## Browser Audit Lessons (2026-03-23 batch)

**Lesson 192: adjustment-strategy rendering toBeVisible failures are all CDN init failures** | Source: TE diagnosis 2026-03-23, build #381
The "rendering" failure category (53 occurrences in DB) is almost entirely caused by `waitForPackages()` timeout=10000ms instead of 120000ms. On CDN cold-start, packages take 30-120s to load — the 10s timeout fires first, "Packages failed to load" aborts beforeEach, and EVERY test in EVERY batch fails with toBeVisible. Secondary: unawaited `transitionScreen.show()` corrupts CDN state machine — buttons stay visibility:hidden in subsequent calls. Diagnostic: if test_results=[] for a build, CDN never loaded. If ALL tests fail toBeVisible across all batches, check waitForPackages timeout first.

**Lesson 193: transitionScreen.show() string mode ('victory', 'gameover') doesn't exist in CDN** | Source: which-ratio #561 browser audit, BROWSER-P0-001
The CDN TransitionScreenComponent has no string-mode shorthand. `transitionScreen.show('victory', {...})` logs `{title: undefined, buttons: undefined}` and renders a completely blank screen — user stranded with no Play Again button. ALL transitionScreen.show() calls must use the object API: `transitionScreen.show({ icons: ['🎉'], title: '...', buttons: [{...}] })`. Rules shipped: GEN-TRANSITION-API, GEN-TRANSITION-ICONS, GEN-PROGRESSBAR-LIVES.

**Lesson 194: SVG markup strings in icons[] are HTML-escaped by CDN** | Source: which-ratio #561, BROWSER-P0-002
`icons: ['<svg ...>']` — the CDN inserts icons as textContent (not innerHTML), so SVG string renders as escaped text filling the screen. Use emoji only: `icons: ['🔺', '🎉']`. Never pass SVG, HTML, or file paths.

## Gen Rule Lessons (2026-03-23 batch — game-flow root cause analysis)

**Lesson L-GF-001: Test-name trigger phrases cause `#mathai-transition-slot button` violations** | Source: game-flow analytics 2026-03-23, GF9-ENFORCEMENT commit 870c6d5
The LLM generates the banned `#mathai-transition-slot button` selector predictably when test names contain specific phrases: "start screen to game start", "game starts when start is clicked", "transition to playing", "screen advances to game", "start button starts game", "clicking start shows game screen". Adding explicit test-name → correct-implementation mapping in GF9-ENFORCEMENT reduced this 27% of game-flow failures class.

**Lesson L-GF-002: `progressBar.update(currentRound, totalRounds)` causes `RangeError: Invalid count value`** | Source: which-ratio #559/#560/#561, GEN-112 wrong-args commit 870c6d5+d76ecb0
`ProgressBarComponent.update()` takes `(currentRound, livesRemaining)` as 2nd arg — NOT totalRounds. When a game has `totalLives=0` and `totalRounds=5`, passing `totalRounds` as 2nd arg passes `5` as lives to a 0-lives bar, computing a fill ratio of `(5-0)/0 = Infinity` → `String.repeat(-5)` → RangeError. Fix: explicit WRONG/CORRECT block in both `buildGenerationPrompt()` AND `buildCliGenPrompt()` — both paths are independent and both need the rule.

**Lesson L-GF-003: `answer(page, true)` is MCQ-only — step-panel games need DOM-derived selectors** | Source: real-world-problem #563-#565, find-triangle-side #547, GF10 commit 870c6d5
`answer(page, selector)` targets MCQ option buttons by CSS class. Step-based games (step1-panel, step2-panel, faded-panel, practice-panel) have panel interaction elements with IDs/classes derived from the spec — they cannot be navigated with the generic `answer()` helper. Test gen must use DOM-snapshot-derived selectors for step interactions.

**Lesson L-GF-004: GEN-PM-DUAL-PATH CORRECT example was missing `gameState.phase` assignment — LLMs copied it and produced `syncDOMState()` calls that wrote `'playing'` to data-phase** | Source: Gen Quality slot GEN-PHASE-SEQUENCE analysis 2026-03-23
The GEN-PM-DUAL-PATH CORRECT code block in `buildGenerationPrompt()` showed `endGame(reason) { gameState.gameEnded=true; syncDOMState(); postMessage... }` — no `gameState.phase` assignment before `syncDOMState()`. LLMs learning from this example generated functions where `syncDOMState()` ran with `gameState.phase` still equal to `'playing'`, writing `data-phase='playing'` to `#app` even at game-over. The 500ms harness poll propagated this wrong value. Fix: (1) Added `gameState.phase = reason === 'victory' ? 'results' : 'gameover'` before `syncDOMState()` in the CORRECT example. (2) Added `GEN-PHASE-SEQUENCE` rule explicitly documenting the ordering requirement with WRONG/CORRECT examples. (3) Added T1 warning `[GEN-PHASE-SEQUENCE]` in validate-static.js to detect endGame bodies where syncDOMState is called without phase assignment, or phase is assigned after syncDOMState. (4) Added 4 test cases. This is the root cause of game-flow 18% pass rate (analytics 2026-03-23).

**Lesson L-GF-005: GEN-112 T1 check false-positive — `Math.max(0, lives)` triggers "3-arg progressBar.update()" error** | Source: stats-mean-direct build #575 diagnosis 2026-03-23
The GEN-112 regex `/progressBar\.update\(\s*\S[^)]*,\s*\S[^)]*,\s*\S[^)]*\)/` matches `progressBar.update(currentRound, Math.max(0, lives))` as a 3-arg call because the comma inside `Math.max(0, ...)` fools the character-class regex. The W14 rule (LP-PROGRESSBAR-CLAMP) mandates `Math.max(0, lives)` clamping — so correct code fails T1. Fix: replace the regex with a paren-depth-aware arg counter (see rca.md Fix 1). Until fixed, every game that correctly clamps lives will fail T1 at build time.

**Lesson L-SPEC-001: stats-mean-direct spec Section 7 uses `progressBar.setRound()` and `progressBar.setLives()` — both are hallucinated methods** | Source: stats-mean-direct build #575 diagnosis 2026-03-23
The spec was written with `progressBar.setRound(roundNumber)` and `progressBar.setLives(3)`. These methods do not exist on `ProgressBarComponent` (rule 5f10). The actual API is `progressBar.update(currentRound, livesRemaining)`. The LLM in build #575 correctly used `update()` despite the spec — but future LLMs following the spec literally would fail T1. Fix: update spec Section 7 to use `progressBar.update(roundNumber, gameState.lives)`.

**Lesson L-TE-001: failure_patterns rows with `pattern='unknown'` are noise, not signal** | Source: TE-UNKNOWN-001 analysis 2026-03-23
Pre-GEN-ANALYTICS-001 builds stored `recordFailurePattern(gameId, 'unknown', 'unknown')` when `categorizeFailure()` returned 'unknown'. The pattern field stored the literal string 'unknown' — no diagnostic content. These rows skew category counts and failure-pattern injection into fix prompts. Fix: mark `resolved=1` where `pattern='unknown'` (11 rows cleaned up). New rows are prevented by GEN-ANALYTICS-001's expanded categorizeFailure() branches.

---

## Build Proofs

| Build | Game | Result | Score | Notes |
|-------|------|--------|-------|-------|
| 204 | doubles | APPROVED | 6/7 | game-flow: 2/3, mechanics: 2/2, level-progression: 1/1, contract: 1/1. Review APPROVED first pass. |
| 208 | doubles | APPROVED | 10/10 | 0 fix iterations — all passing on iteration 1 |
| 211 | right-triangle-area | APPROVED | 7/11 (64%) | Sequential batch ordering issue; game-flow: 0/3, mechanics: 4/4, level-progression: 1/1, edge-cases: 2/3, contract: 0/2 |
| 212 | doubles | APPROVED | 10/10 | Zero review rejections; game-flow: 3/3, mechanics: 3/3, level-progression: 2/2, contract: 2/2 |
| 226 | match-the-cards | APPROVED | 12/12 | First scale-run APPROVED (~33 min). game-flow: 2/2 (iter 2), mechanics: 4/4 (iter 3), level-progression: 1/1, edge-cases: 3/3, contract: 2/2 (iter 2). Early review APPROVED first attempt. Final review rejected twice (CDN domain + waitForPackages timeout), APPROVED 3rd attempt. |
| 384 | matching-doubles | APPROVED | — | Gemini-only mode. First build with new pipeline. |
| 385 | adjustment-strategy | APPROVED | — | Non-CDN game. Global fix loop triggered 2 spurious calls (Lesson 65 bug, pre-fix). APPROVED. |
| 386 | bubbles-pairs | APPROVED | — | Passed all per-batch loops iter=1. Review rejected twice (postMessage+calcStars), fixed in 2 review-fix cycles. APPROVED. |
| 388 | zip | APPROVED | — | Review passed on FIRST attempt (32s). First build with new review rejection gen-prompt fixes. |
| 387 | interactive-chat | FAILED | 5/12 | Lesson 66 bug: mechanics+level-prog spec files deleted → passRate=42% → FAILED before review. Fixed in dc20844. Re-queued as #390. |
| 389 | kakuro | FAILED | — | Early-review-fix broke CDN init → smoke-regen also failed. Re-queued as #391. |

## Pipeline Fix Lessons

1. **extractHtml** returns entire LLM output when `<!DOCTYPE` appears anywhere. Fixed to slice from first DOCTYPE position (LLMs sometimes add analysis text before the HTML).
2. **Re-clicking `.correct` cells** times out in Playwright — CSS `pointer-events: none`. Use `{ force: true }` for re-click tests. Fix prompt includes rule; post-gen fixup patches it automatically.
3. **0/0 test results** = page broken by last fix. Restored best HTML immediately, skip triage.
4. **`game_over` phase** — game sets `gameState.phase = 'game_over'` (underscore) but tests expect `'gameover'`. Harness normalizes automatically.
5. **Local `endGame` function** — CDN games define `endGame` inside DOMContentLoaded, not on `window`. Fix prompt now requires `window.endGame = endGame` exposure.
6. **Triage `window.__ralph undefined`** — `TypeError: Cannot read properties of undefined (reading 'setLives')` means `window.__ralph` itself is undefined → page has JS error → `fix_html`, NOT `skip_test`. Added KNOWN HTML BUGS section to triage prompt.
7. **Stale BullMQ job replay** — after SIGKILL, active jobs replay on worker restart. Always fail stale DB builds and obliterate queue before requeuing.
8. **gameState.phase** — must be set at every state transition: `'playing'`, `'transition'`, `'gameover'`, `'results'`. Added as gen prompt rule 15 and fix prompt CDN constraint.
9. **Early review** — now checks full spec verification checklist (not just 5 items). Catches endGame guard, signalPayload, 100dvh, etc. before test generation.
10. **MAX_REVIEW_FIX_ATTEMPTS = 3** — increased from 2. Review fix prompt: "Fix ALL issues in ONE pass. Do NOT change anything not mentioned."
11. **PROOF: doubles game APPROVED** — build 204 (2026-03-19). game-flow: 2/3, mechanics: 2/2, level-progression: 1/1, contract: 1/1. Review APPROVED first pass.
12. **Playwright cwd fix** — Playwright must be run with `cwd: gameDir` and relative spec paths (not absolute). Absolute paths fail silently: 0/0 results + "test.beforeEach() not expected here" error because Playwright can't match absolute paths to testDir-scanned files.
13. **Warehouse HTML must have 100dvh + correct gameover phase** — when pipeline overwrites warehouse with approved build, any manual fixes (100dvh CSS, `setPhase('gameover')` in handleGameOver) are lost. Re-apply after each warehouse update.
14. **gemini-3.1-pro-preview** — correct proxy model name for review step (not `gemini-2.5-pro-preview`). Check `curl -H "Authorization: Bearer $PROXY_KEY" http://localhost:8317/v1/models` for valid names.
15. **PROOF: doubles APPROVED with 0 fix iterations** — build 208 (2026-03-19). game-flow: 3/3, mechanics: 2/2, level-progression: 1/1, edge-cases: 2/4 (2 skipped), contract: 2/2. All passing on iteration 1.
16. **Review model catches async/signalPayload/sound patterns** — build 212 (doubles warehouse): rejected for (a) missing `async` on `handleGameOver`/`endGame`, (b) manual `signals:`/`metadata:` props instead of `...signalPayload` spread (omits `events`), (c) `sound.play().catch()` instead of `await sound.play()`. One review-fix pass → APPROVED. These are recurring issues in warehouse HTML.
17. **Contract `metrics.stars` unfixable by fix loop** — build 212: 3 iterations, still wrong formula. Pipeline APPROVED anyway (8/9). Root cause: triage says "use livesRemaining directly" but LLM keeps guessing. Spec's star formula must be quoted verbatim in triage context to work.
18. **Sequential batch processing wastes fix iterations** — build 211 (right-triangle-area): game-flow maxed at 0/3 because init fix hadn't happened yet. Mechanics fix (iter 2) fixed the init issue that would have fixed game-flow too, but game-flow was already done. Contract also 0/2. Final score: 7/11 (64%) → APPROVED. A "final re-test" step after all batches would give a more accurate score.
19. **Step 3b extended to re-test ALL batches (not just zero-score)** — Previously Step 3b only re-tested batches with 0 passes. This missed cross-batch regressions where a later fix degraded an earlier batch from 1-2 passes down to 0. Now Step 3b re-tests every batch with any recorded result and diffs prevPassed/prevFailed against new results to update totalPassed/totalFailed correctly. This gives an accurate final score and catches both improvements (zero-score batches fixed) and regressions (previously-passing batches broken by later fixes).
20. **PROOF: right-triangle-area APPROVED** — build 211 (2026-03-19). Fresh e2e, no warehouse HTML. game-flow: 0/3 (batch ordering issue), mechanics: 4/4 ✅, level-progression: 1/1 ✅, edge-cases: 2/3 ✅, contract: 0/2 (postMessage timing). 7/11 = 64% → Review APPROVED.
21. **signalPayload T1 check fires immediately** — build 211+212 both caught ...signalPayload non-spread at Step 1b static validation. Static-fix (claude-sonnet-4-6) fixed it before tests even ran. This is the correct defense-in-depth approach.
22. **Spec scoring context in fix prompt fixed stars on first try** — build 212 (doubles): contract "Star Rating Logic" fixed by fix-contract-1 on iter 1. The spec scoring section in the fix prompt gave the LLM the exact formula. Previously this failed all 3 iterations (build 209 lesson 17).
23. **PROOF: doubles APPROVED 10/10** — build 212 (2026-03-20). game-flow: 3/3, mechanics: 3/3, level-progression: 2/2, contract: 2/2. APPROVED first review pass. Zero review rejections.
24. **BUG (fixed): early-review-2 was reviewing stale pre-fix HTML** — `earlyReviewPrompt` captured `fs.readFileSync(htmlFile)` once at construction time. When `early-review-2` reran after `early-review-fix`, it sent the ORIGINAL broken HTML to Gemini, not the fixed one. This caused every early-review-fix to fail the second review regardless of whether the fix was correct. Fixed by reconstructing the prompt fresh for early-review-2. Build 213 was REJECTED due to this bug; build 214 confirmed the fix.
25. **Warehouse prebuilt HTML causes generation bypass** — If `warehouse/templates/<gameId>/game/index.html` exists, worker.js copies it to every new build dir, and pipeline.js skips HTML generation entirely (`index.html exists`). For games that have never been approved, a stale/broken warehouse HTML causes every build to reuse the broken file. Delete the warehouse HTML before queuing fresh e2e builds for unproven games.
26. **Fix LLM CDN URL hallucination causes 0/2 regressions** — When the fix LLM rewrites HTML, it often "corrects" CDN script URLs from `cdn.homeworkapp.ai` (correct) to `cdn.mathai.ai` (wrong — 404s). This makes ALL CDN scripts fail to load, producing a blank page and all tests failing `toBeVisible`. Also: when fixing restart, it removes `gameState.isActive=true; syncDOMState()` from DOMContentLoaded as collateral damage. Both patterns added to CRITICAL CDN CONSTRAINTS in fix prompt.
27. **Architecture C: global fix loop (Step 3c) implemented** — After all per-batch fix loops complete (Step 3a), a new Step 3c runs before the final re-test (Step 3b). It collects ALL remaining failures across every batch into a single cross-category fix prompt, explicitly instructing the LLM to diagnose root causes visible only when looking at multiple categories simultaneously. Runs up to `RALPH_MAX_GLOBAL_FIX_ITERATIONS` (default 2) iterations. Includes regression guards (passing categories + prior passing tests) and a size-drop guard (aborts if HTML shrinks >30%). This directly addresses the build 211 lesson: game-flow maxed its 3 iterations before mechanics ran the fix that would have fixed game-flow too.
28. **Deterministic pre-triage patterns** — Certain failure signatures have a fixed, unambiguous action and should never waste a triage LLM call: (a) `window.__ralph is not defined` in ALL failures → always `fix_html` (harness never initialized, page has a JS error); (b) `Cannot redefine property: visibilityState` → always `skip_tests` (untestable in headless); (c) `pointer-events: none` re-click errors → always `skip_tests`. Detecting these before calling the triage model eliminates a full LLM round-trip per affected batch.
29. **E8 script-only fix (token savings)** — On iteration 2+, for non-contract batches where HTML exceeds 10 KB: extract only `<script>` sections, send them to the fix LLM, then merge back via `mergeScriptFix()`. Saves 50–70% tokens per fix call. Do NOT apply to the contract batch — contract failures frequently require structural HTML changes (DOM, data attributes), not just JS. If `mergeScriptFix()` returns null (merge failed), fall back to sending full HTML.
30. **Parallel test generation `Promise.all` gotcha** — When test-generation is parallelized with `Promise.all(CATEGORIES.map(async () => { ... }))`, `continue` statements inside the inner loop body must become `return` (early-exit from the async callback), not `continue` (which is invalid in a `map` callback). `llmCalls.push()` inside parallel async tasks is safe — JS is single-threaded despite async concurrency, so array pushes never interleave.
31. **Model routing rationale** — Assign models by task difficulty, not uniformly: triage is a JSON classification task → use the smallest capable model (`TRIAGE_MODEL`, e.g. gpt-4.1-mini) to save ~10× cost vs. sonnet; global fix (Step 3c) is the hardest reasoning task → use `GEN_MODEL` (opus) because cross-category root-cause diagnosis requires stronger reasoning; learnings extraction is summarization → use the smallest model (`LEARNINGS_MODEL`). Applying a large model uniformly is wasteful; applying a small model to global fix produces shallow root-cause analysis.
32. **Build kill criteria (from build-manager-agent.md)** — Kill a build immediately if: (a) it started before the most recent worker restart (stale pipeline code — results are from old logic); (b) 0% pass rate on iteration 2+ with the same error appearing on both iterations (fix LLM is looping; a pipeline code change is required, not another iteration). Always call `failBuild(id, reason)` in the DB after killing. Never leave a build in "running" state — it blocks the queue and misleads monitoring.
33. **window.endGame scope (CDN games)** — CDN games define `endGame` inside a `DOMContentLoaded` closure; it is NOT on `window`. Calling `window.__ralph.endGame()` fails silently because the harness delegates to `window.endGame`. Fix: add `window.endGame = endGame` (and similarly `window.restartGame`, `window.nextRound`) at global scope, outside the DOMContentLoaded callback. The harness now emits a `console.error` diagnostic on the `load` event for any missing required globals, making the root cause immediately visible in Playwright traces.
34. **game_init must set gameState.phase = 'playing' immediately** — All game-flow and mechanics tests call `waitForPhase(page, 'playing')` after firing `game_init`. If the HTML's `handlePostMessage` does not set `gameState.phase = 'playing'` as the FIRST action in the `game_init` case, the test harness never sees the phase change and all tests timeout. Fix in generation prompt: Added explicit CRITICAL instruction that `game_init` case must start with `gameState.phase = 'playing'`. Static check added: `validate-static.js` now errors if `handlePostMessage` + `game_init` are present but `gameState.phase = 'playing'` is not found in the HTML. Proof: This was the dominant failure pattern in the scale run (builds 218, 216, 214 all failed with 0 iterations due to this). After the fix, game-flow and mechanics tests should pass on iteration 1.

39. **waitForPackages timeout must throw on expiry** — build 226 review was rejected twice because `waitForPackages()` didn't implement PART-003 correctly: it must have EXACTLY `timeout=10000` (≤10s) and MUST `throw new Error(...)` on expiry (not `console.error`, not silent). The review model checks the verification checklist item "waitForPackages() has a timeout (≤10s) with error handling". Correct pattern: `if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')}`. Added as rule 19 in API gen prompt, CLI gen prompt, and all three CDN constraint blocks in fix prompts. T1 static check added.

40. **window.gameState must be exposed for syncDOMState** — build 227 (hidden-sums) game-flow had all 4 tests fail with `waitForPhase('playing')` timeout because `#app[data-phase]` was never set. Root cause: `syncDOMState()` (injected test harness) reads `window.gameState` — if the game declares `const gameState = {}` or `let gameState = {}` at the script top level (not on window), `syncDOMState` returns early and `data-phase` is NEVER written. Fix: CDN games must use `window.gameState = { ... }` OR explicitly add `window.gameState = gameState;` at global scope. Added as T1 static check (section 5b3) and as part of rule 21 in gen/fix prompts: `window.gameState=gameState` in the window exposure list.

41. **Step 3b 0/0 re-test = page crash, not zero score** — build 227 (hidden-sums): Step 3b final re-test returned 0/0 on game-flow (previously 2/4). This is Lesson 3: "0/0 = page broken by last fix". The zero result caused totals to drop from ~73% to 67% (below 70% threshold), triggering premature FAILED. Fix: in Step 3b, if a batch returns 0 total tests AND previously had results, preserve the previous score instead of zeroing. 0/0 means "page crash — result unknown", not "0 passed". Applied in pipeline.js Step 3b re-test loop.

## Lesson 43 — Auto-restart agents kill active builds when DB shows 0 iterations

**Pattern:** A monitoring agent polling `db.getBuild(id).iterations` saw 0 iterations for visual-memory (build 229) after 20 minutes and restarted the worker. But the pipeline was actively running (mechanics E8 fix in progress) — the DB only records iterations when a full batch pass+fail cycle completes. A build in the middle of a fix LLM call shows 0 iterations until the re-test finishes. The restart killed the build mid-fix.

**Root cause:** Monitoring agents using wall-clock timeouts can't distinguish "stuck" from "in-progress LLM call". Long LLM calls (48KB HTML, 3-5 min response time) + DOM snapshot (65s timeout) + Playwright test runs all make a build appear stuck externally.

**Fix:** Never auto-restart the worker while any build shows `status='running'` in the DB. Always check `running` status before restarting. Better signal than wall-clock timeout: watch journalctl for activity (`journalctl -u ralph-worker -n 1` timestamp advancing = alive). Only restart if the log hasn't advanced in >10 minutes AND the claude subprocess is no longer running.

**How to apply:** Don't set timeout-based worker restarts. Restart only after explicit build completion (APPROVED/FAILED status in DB). If a build appears stuck: check if `claude` or `node` subprocess is running (`ps aux | grep -E 'claude|playwright'`); if yes, it's working. Wait it out.

---

**INSTRUCTIONS FOR MAINTAINING LESSONS:** Always update this file after every notable build outcome or pipeline bug fix. Add lesson immediately when: a new pipeline bug is found and fixed, a build proves or disproves a hypothesis, a new failure pattern is discovered, or any hard-won insight that would help avoid repeating a mistake. Never let insights live only in conversation memory.
35. **beforeEach transition-slot wait fails for non-CDN games** — The shared test boilerplate `beforeEach` unconditionally waited for `#mathai-transition-slot button`. Games that don't use the TransitionScreen CDN component (non-CDN or inline-layout games) never have this button — ALL tests failed in `beforeEach` with "expected locator to be visible" timeout. Caused build 216 (count-and-tap) to score 0/10 across all batches. **Fix:** At `sharedBoilerplate` generation time, check `htmlContent` for `mathai-transition-slot`. If present (`hasTransitionSlot = true`), use the existing 50s polling loop. If absent, use a fallback: `waitForSelector('#app[data-phase="start"], #gameContent, #start-screen', { timeout: 30000 })`. The `domSnapshot` string is checked as a secondary signal. Default is `true` (slot path) only when both `htmlContent` is empty and `domSnapshot` is null. **How to apply:** Any game whose HTML doesn't include `mathai-transition-slot` gets the fallback `beforeEach`. Games using ScreenLayout CDN always have it.

## Lesson 36 — Stale warehouse HTML causes all scale run builds to fail at initialization

**Pattern:** When `warehouse/templates/<gameId>/game/index.html` exists, the worker copies it to each new build directory and the pipeline SKIPS HTML generation entirely. For games that were never approved, this means every build reuses broken/stale warehouse HTML. The fix loop cannot recover because the fundamental initialization issue is in the original HTML, not in the test logic.

**Root cause of scale run failures (builds 219-223+):** All queued games had pre-existing warehouse HTML from prior manual/pipeline runs. None was approved. The HTML had initialization bugs (start screen never renders, `#mathai-transition-slot button` never appears) that the per-batch fix loop couldn't resolve in 3 iterations.

**Fix (one-time cleanup):** Before running a scale validation, delete `warehouse/templates/<gameId>/game/index.html` for ALL games that have never reached APPROVED status in the DB. Keeps: games with `status='approved'` in the games table.

**Pipeline improvement needed:** Add auto-detection: if game-flow AND mechanics both score 0/N on iteration 1 AND warehouse HTML was copied (not freshly generated), delete warehouse HTML and regenerate. Add to build kill criteria.

**Proof:** Deleting 41 warehouse HTML files (non-approved games) immediately unblocked the scale run. Build 224 (true-or-false) generated fresh HTML and passed static validation on the same run.

## Lesson 37 — Always-applied post-processing overwrites conditional beforeEach (bug identified, fix pending)

**Pattern:** The "always-applied test post-processing" block (pipeline.js ~line 1847) replaces every `test.beforeEach` with a hardcoded version that unconditionally waits for `#mathai-transition-slot button`. This overwrites the conditional sharedBoilerplate fix (lesson 35) for games without the transition slot. Even when sharedBoilerplate correctly generates a fallback beforeEach, post-processing replaces it on every run.

**Fix:** In the post-processing block, check `htmlContent.includes('mathai-transition-slot')` and use the appropriate beforeEach (slot-based vs fallback).

**Also:** Gemini sometimes generates `#${transitionSlotId}` as a literal string (template variable hallucination). Fix: add post-processing cleanup to replace `${transitionSlotId}` → `mathai-transition-slot` in all spec files.

**Status:** Fix committed (see task #31 follow-up). Both issues found during monitoring of builds 221-223.

## Lesson 38 — CDN URL constraint missing from generation prompt caused fresh-HTML init failures

**Pattern:** The fix prompt had CRITICAL CDN CONSTRAINTS (`cdn.homeworkapp.ai`, not `cdn.mathai.ai`) but the **generation prompt** did not. LLMs hallucinate `cdn.mathai.ai` as the CDN domain. Using the wrong domain causes all CDN scripts (ProgressBarComponent, TransitionScreen, etc.) to 404 silently — the game page renders blank, the start screen never appears, and ALL tests fail in `beforeEach` with "element not found" timeout. This was the root cause of fresh-HTML init failures in builds 222-225 (start screen never renders even after game_init fix and warehouse HTML deletion).

**Fix:** Added rule 18 to both the API generation prompt and the CLI (`claude -p`) generation prompt: "ALWAYS use cdn.homeworkapp.ai. NEVER use cdn.mathai.ai." Also added post-generation cleanup in pipeline.js that replaces `cdn.mathai.ai` → `cdn.homeworkapp.ai` in the generated HTML file before harness injection (defense in depth).

**How to apply:** If a freshly generated CDN game has 0% on game-flow iteration 1 AND init failures (start screen never renders), check the generated HTML for `cdn.mathai.ai` — that's the first thing to verify.

## Lesson 42 — Test data shape mismatch: `validSolution is not iterable`

**Pattern:** Build 227 (hidden-sums): After the window.gameState fix resolved game-flow iteration 1 (data-phase now set), iterations 2+ failed with `TypeError: round1.validSolution is not iterable` and `TypeError: solutionIndices is not iterable`. The generated tests assumed the game's round data structure had specific iterable array properties, but the actual game stored data differently. This is a test-side assumption mismatch, not a game bug.

**Root cause:** Test generation prompt uses the spec markdown + DOM snapshot for context. When the DOM snapshot doesn't show actual JS data structures (only HTML elements), the LLM infers round data shapes from spec language like "valid solutions" → assumes `validSolution: []` array. The game may use `validSolution: number` (single value) or `validAnswers: []` (different key).

**Fix (needed):** The DOM snapshot should include a sample `window.__ralph.getState()` result so the test generator sees the actual data shape. Currently the DOM snapshot captures element IDs/classes only. Add `window.__ralph.getState()` output to the snapshot injection context so generated tests use the real property names and types.

**Workaround (current):** The test fix loop will eventually catch and fix shape mismatches, but wastes iterations. If a game consistently fails with `is not iterable` or `undefined reading '0'`, check whether the test is accessing a property that doesn't exist on the actual game state object.

**How to apply:** When game-flow fails on iter 1 for window.gameState reasons but iter 2+ fails with `not iterable` / `Cannot read properties of undefined`, the issue shifted from game init → test data assumptions. Don't re-queue; the fix loop should resolve it. If it fails all 3 iterations on the same property error, this is a known gap in the DOM snapshot context (no runtime state shape).

## Lesson 44 — `extractSpecRounds()` parses spec metadata tables as round data

**Pattern:** Build 232 (face-memory): `extractSpecRounds()` parsed the spec's "Parts Selected" table — rows like `PART-001 | HTML Shell | YES` — as game round data because the header filter only excluded the literal text `"Question"` / `"Answer"` / `"Round"`. The `Part ID` header and `PART-xxx` data rows passed through, producing `fallbackContent.rounds = [{ question: "PART-001", answer: "HTML Shell" }]`. Tests then crashed with `TypeError: Cannot read properties of undefined (reading 'eyes')` when accessing `rounds[0].faceFeatures['eyes']` — a property that would only exist on real face-memory round data.

**Triage failure:** The triage model saw `TypeError: Cannot read properties of undefined (reading 'eyes')` and diagnosed it as an HTML init failure (gameState not fully initialized). Fix attempts rewrote initialization code, which broke the HTML and cascaded into `page.waitForSelector Timeout 30000ms` across all batches. The real root cause — garbage data injected by `extractSpecRounds` — was never surfaced because the TypeError message gave no hint of its origin being test data.

**Root cause:** `extractSpecRounds()` matched any two-column markdown table in the spec. The "Parts Selected" table (`PART-001 | HTML Shell`) is a spec metadata table, not a rounds table. No exclusion existed for part-reference rows.

**Fix:** Added skip conditions in `extractSpecRounds()`:
1. Skip any row where `col1` matches `Part ID` (header row) or `/^PART-\d+/` (data rows).
2. Skip any row where `col2` is `YES`, `NO`, or `—` (the "Included" column of the parts table).

**Proof:** Build 232 killed after cascading failures. Fix deployed, build 279 requeued and completed successfully.

**How to apply:** If tests crash with `TypeError: Cannot read properties of undefined` accessing a game-specific nested property (e.g., `.faceFeatures`, `.gridData`, `.pattern`) on `rounds[0]`, check `fallbackContent.rounds` first — the question/answer values may be spec metadata rather than actual game rounds. Log or inspect the extracted rounds before injecting them into the test context.

## Lesson 45 — BullMQ queue loss on Redis restart: enable AOF persistence

**Pattern:** In a past incident, 39 queued builds vanished after a Redis restart. Redis's default configuration uses RDB snapshots only (periodic dumps to `dump.rdb`). If Redis exits between snapshots, all in-memory queue state — pending BullMQ jobs, job locks, job data — is lost. On restart, the queue appears empty and all queued builds are gone with no record.

**Root cause:** Redis defaults to RDB-only persistence. RDB snapshots happen at intervals (e.g., every 60s if 1000 keys changed, every 300s if 10 keys changed). Any Redis restart between snapshot intervals loses all changes made since the last snapshot. BullMQ jobs are entirely Redis-backed; there is no secondary durable store.

**Fix:** Enable Redis AOF (Append Only File) persistence via `--appendonly yes` in the Redis startup command. With AOF, every write command is appended to a file on disk. Redis 7 uses the multi-part AOF format: an `appendonlydir/` directory containing a base RDB snapshot (`*.base.rdb`) and an incremental log (`*.incr.aof`). On restart, Redis replays the AOF log — all queued jobs survive.

**How it was applied:**
1. `docker-compose.yml` Redis service already has `command: redis-server --appendonly yes` — this is the correct configuration for local/Docker deployments.
2. The live server runs Redis in the `ralph-redis-1` Docker container. Verified with `sudo docker inspect ralph-redis-1 --format='{{.Config.Cmd}}'` → `[redis-server --appendonly yes]`. AOF is active: `sudo docker exec ralph-redis-1 redis-cli CONFIG GET appendonly` returns `yes`. The `appendonlydir/` directory exists in `/data/` with `appendonly.aof.2.incr.aof` actively written.

**Verification command:**
```bash
sudo docker exec ralph-redis-1 redis-cli CONFIG GET appendonly
# Expected: appendonly / yes
sudo docker exec ralph-redis-1 ls -la /data/appendonlydir/
# Expected: *.base.rdb + *.incr.aof files present and recently modified
```

**How to apply:** Always start Redis with `--appendonly yes`. For docker-compose deployments, include it in the `command:` field. For standalone Redis, set `appendonly yes` in `redis.conf` and run `redis-cli CONFIG REWRITE` to persist the change. Never rely on RDB-only persistence for BullMQ-backed pipelines where job loss is unacceptable.

## Lesson 46 — Step 1d: Page load smoke check prevents wasted test-gen tokens on broken pages

**Pattern:** Generated HTML can fail to load entirely due to CDN package timeouts, missing globals, or JS init errors. The page is a white screen from generation, but the pipeline doesn't detect this until iteration 1 of the test loop returns 0/10 — after test-gen LLM tokens have already been spent. Real example: `"Packages failed to load within 10s"` — the console error appears at page load, but the pipeline wasn't listening.

**Root cause:** The pipeline had no pre-test-gen check for page-level init failures. Static validation (Step 1b) checks HTML structure and CDN contract compliance but cannot detect runtime errors. The test loop's 0/10 iteration-1 result was the first signal.

**Fix (Step 1d):** Added `runPageSmokeDiagnostic(htmlFile, gameDir, logger)` in `lib/pipeline-utils.js`. Runs after Step 1c (early review), before test generation:
1. Spawns a local static server (same pattern as `captureGameDomSnapshot`)
2. Opens the page in headless Playwright with a 5s navigation timeout
3. Collects `console.error` events for 8 seconds
4. Classifies errors against fatal patterns: `packages? failed to load`, `initialization error`, `failed to load resource`, `waitforpackages`, `is not a constructor`, and CDN-context `X is not defined`
5. If fatal errors found: one HTML regeneration attempt with the error appended to the gen prompt, then re-smoke-checks
6. If still failing after regen: throws immediately (no test-gen, no fix loop wasted)

**Pattern matching helper:** `classifySmokeErrors(consoleErrors)` is exported separately for unit testing without Playwright. The `X is not defined` pattern is only fatal when the error message also contains a CDN/package context string — avoids false positives from routine JS reference errors.

**Cost saved:** Prevents ~2 full LLM fix iterations + test generation tokens ($0.20–$0.50 per incident) on CDN-broken pages that would otherwise waste 5 full iterations before the pipeline fails.

**How to apply:** When a build fails iteration 1 with 0/N on all categories AND the error is `page.waitForSelector Timeout` or similar, check the Slack thread for a `smoke-check-failed` progress event. If present, the root cause is a page load failure — the smoke check caught it on the next build attempt.

## Lesson 47 — Queue-sync job loss: auto-requeue at worker startup eliminates manual intervention

**Pattern:** When the `ralph-worker` systemd service restarts (planned deploy, OOM kill, or crash), any BullMQ jobs that were in-flight are lost from the queue. The existing `cleanupOrphanedBuilds()` at startup correctly marks `status=running` builds as `failed` with `error_message = "orphaned: worker restarted..."`. But these builds were never automatically retried — they required a manual `POST /api/build` call. In the last 10 build failures, 9 had exactly this pattern (queue-sync job loss).

**Root cause:** `cleanupOrphanedBuilds()` only marks builds failed; it has no requeue path. There was no automated recovery: the operator had to notice the failure in Slack, identify it as a queue-sync loss, and manually requeue. On busy days with multiple deploys, this meant 3–5 manual requeue calls per session.

**Fix:** `requeueQueueSyncBuilds()` added to `worker.js` startup, called right after `cleanupOrphanedBuilds()`:
1. Queries: `status='failed' AND error_message LIKE '%queue-sync%' AND (retry_count IS NULL OR retry_count < 1)`
2. For each candidate, checks if the game already has a `queued` or `running` build — skips if so (prevents duplicate)
3. Enqueues via `new Queue('ralph-builds', { connection })` and calls `.add('build', { gameId, requeueOf: build.id })`
4. Sets `retry_count = 1` on the old failed build to prevent repeated requeue on subsequent restarts
5. Logs: `[worker] queue-sync auto-requeue: ${gameId} (was build #${id})`

**Guard rails:**
- `retry_count < 1` — only auto-requeues once per failed build; prevents infinite loops
- Active-build check — skips if game already has queued/running build; prevents duplicate concurrent pipelines
- Only matches `error_message LIKE '%queue-sync%'` — never auto-retries other failure types (pipeline errors, review rejections, etc.)
- Queue is opened and closed within the function; does not interfere with the main worker's connection

**Tests:** 7 new unit tests in `test/worker.test.js` covering: candidate selection (retry_count=0), exclusion (retry_count=1), null retry_count eligibility, skip when queued/running build exists, allow when no active build, empty table.

**How to apply:** This is now automatic. After any worker restart, the startup log will show `[worker] queue-sync requeue: found N builds to requeue` (or 0). No manual intervention needed. If a game is stuck and you need to prevent the auto-requeue, set `retry_count=1` directly: `node -e "require('./lib/db').getDb().prepare('UPDATE builds SET retry_count=1 WHERE id=?').run(BUILD_ID)"`.

## Lesson 48 — Deterministic pre-triage: toBeVisible/toBeHidden batch failures are rendering mismatches, not HTML bugs

**Pattern:** When a test batch returns >3 failures all containing `toBeVisible()` or `toBeHidden()`, these are invariably test-side DOM visibility assumptions that the game HTML doesn't satisfy. The test generator assumed certain elements would be visible at specific points in the game flow, but the game renders them differently (e.g., hidden by default until the game starts, or visibility toggled by CDN components). The LLM triage model correctly identifies these as `skip_tests` (rendering mismatch, not an HTML bug), but only AFTER spending a full triage LLM call.

**Real example:** adjustment-strategy game had 8 distinct `toBeVisible()` failures in one batch, all categorized as "rendering" in the failure_patterns table. Each triage call for this pattern costs a full LLM round-trip with no HTML fix output.

**Fix:** `detectRenderingMismatch(failureDescs)` added to `lib/pipeline-fix-loop.js`. Runs BEFORE the triage LLM call in the per-batch iteration loop. If more than 3 failures match `/toBeVisible|toBeHidden/i`, the function returns `true` and the loop immediately breaks with `skip_tests` — no LLM call. The threshold is `>3` (not `>=3`) because 3 toBeVisible failures could be a real DOM bug affecting a specific element; 4+ distributed across different elements strongly indicates test-side assumptions.

**Saves:** One LLM triage round-trip per affected batch per iteration. For games that trigger this pattern on iterations 1, 2, and 3, this saves 3 triage calls (roughly $0.01–$0.03 per batch, plus latency).

**How to apply:** If a batch repeatedly hits `skip_tests` in triage for `toBeVisible` reasons, it's this pattern. The fix loop will log `[pipeline] [batchLabel] Pre-triage: toBeVisible pattern detected (N failures) — skip_tests` and emit a `pretriage-visibility-skip` progress event. No action needed — the pre-triage guard is active automatically.

**Implementation:** `detectRenderingMismatch()` exported from `lib/pipeline-fix-loop.js` alongside `isInitFailure`. 6 unit tests cover: 4 visible=true, 3 visible-false (boundary), 2+2 mixed=true, empty=false, 4 non-visibility=false, case-insensitive=true.

## Lesson 49 — Abort pipeline on DOM snapshot failure: regen HTML instead of proceeding to test-gen

**Pattern:** `captureGameDomSnapshot()` (Step 2.5) can return `null` when the generated HTML is fatally broken — blank page, CDN packages failed to load, JS init error. Previously, the pipeline would silently proceed to test-gen using an empty DOM snapshot, spending a full LLM test-gen call (60–120s, $0.10–$0.30) on a page that is confirmed broken. The resulting tests fail 100% on iteration 1, and the fix loop then has to diagnose the underlying HTML bug from test failures rather than from the direct evidence of a blank page.

**Fix:** `lib/pipeline-test-gen.js` now checks the return value of `captureGameDomSnapshot()`. If it returns `null`, it throws an error with `isFatalSnapshotError = true`. `lib/pipeline.js` catches this in the Step 2 entry point: regenerates the HTML with a "blank-page context" note appended to the gen prompt, then retries the full test-gen step (snapshot + test generation). If the retry also fails with a null snapshot, the build is aborted entirely — no test-gen, no fix loop, no wasted compute.

**Impact:** R&D trace of 65 triage events across builds 218–232:
- 58% — HTML fatal init (CDN 404, JS ReferenceError, ScreenLayout blocked)
- 22% — phase-transition missing syncDOMState() call
- 9% — data-shape mismatch (test assumed wrong property names)
- 11% — other

Of the 58% init failures, ~44% had a null DOM snapshot detectable at Step 2.5. Aborting early on those cases eliminates the test-gen LLM call and the full first fix iteration — saving ~2 LLM round-trips per affected build.

Full analysis at `docs/rnd-first-pass-failure-analysis.md`.

**How to apply:** If a build Slack thread shows a `snapshot-failed-regenerating` progress event, the pipeline detected a null snapshot and is regenerating HTML. If a second `snapshot-failed-abort` event appears, the HTML was still broken after regen and the build aborted. Investigate the generated HTML (check for CDN URL errors, initSentry order, waitForPackages missing) rather than waiting for 5 failed iterations.

## Lesson 50 — Every `gameState.phase =` assignment must be immediately followed by `syncDOMState()`

**Pattern:** CDN games generated by the pipeline frequently passed game-flow tests on iteration 1 for some transitions but failed others with `waitForPhase() timeout`. Root cause: `syncDOMState()` (injected by the test harness into `<script id="ralph-test-harness">`) reads `window.gameState.phase` and writes it to `#app[data-phase]` — but only when called. If the game sets `gameState.phase = 'playing'` without immediately calling `syncDOMState()`, the `data-phase` attribute on `#app` is never updated until the next periodic sync tick (500ms). `waitForPhase(page, 'playing')` times out if the transition happens faster than the polling interval, or if `syncDOMState()` is never called for that phase at all.

**Root cause:** The generation prompt did not explicitly require calling `syncDOMState()` after every phase assignment. LLMs sometimes call it at game start and at `endGame`, but omit it at intermediate transitions (`'transition'`, `'correct'`, `'wrong'`, etc.). This was causing 22% of all iteration-1 failures in the R&D trace.

**Fix:** Rule 22 added to `lib/prompts.js`: "After EVERY `gameState.phase =` assignment, immediately call `syncDOMState()`. Without this call, `data-phase` on `#app` is never updated and ALL `waitForPhase()` test calls will timeout." This rule is injected into the API generation prompt, CLI generation prompt, and all fix/global-fix prompts via the CDN_CONSTRAINTS_BLOCK.

**How to apply:** If tests fail with `waitForPhase('transition')` or `waitForPhase('correct')` timeout on iteration 1, search the generated HTML for `gameState.phase = 'transition'` (or whichever phase). If there is no `syncDOMState()` call on the immediately following line, that is the bug. The fix prompt should already include this rule (as of 2026-03-20); if it doesn't, the LLM will fix it on iteration 1 triage.

## Lesson 51 — FeedbackManager.init() popup causes 100% non-deterministic test failure when PART-017=NO

**Pattern:** adjustment-strategy had 58 failed builds with all failures labeled as "rendering/toBeVisible". The page was NOT blank — it rendered fine. The real cause: `FeedbackManager.init()` was being called despite the spec saying `PART-017 Feedback Integration: NO`. This shows a blocking audio permission popup ("Okay!" button). The `beforeEach` tries to dismiss it with an 8-second timeout, but the catch is silent. When it misses (race condition), ALL tests fail on the same `waitForFunction` timeout.

**Proof of non-determinism:** Build 159 showed the SAME HTML passing 6/0 then failing 0/10 in the same pipeline run. Identical code, identical page — different outcomes depending on whether the popup appeared before or after the `beforeEach` dismissal window. This is the clearest possible signal of a race condition, not an HTML logic bug.

**Root cause:** `FeedbackManager.init()` initializes audio subsystems that may trigger browser permission dialogs in headless Playwright. When the spec says `PART-017=NO`, the game should never call this function. LLMs include it as boilerplate without checking the spec's PART-017 value.

**Fix:**
1. Gen prompt rule added: never call `FeedbackManager.init()` unless spec says `PART-017=YES` or `popupProps` is explicitly specified.
2. adjustment-strategy `spec.md` updated with an explicit `CRITICAL` prohibition block.
3. These two changes fix 58 builds worth of thrashing caused by the race condition.

**How to identify:** Any game where:
- 100% of failures are labeled "rendering/toBeVisible" across ALL test categories
- DOM snapshot shows elements rendering correctly (page is not blank)
- Failures are non-deterministic (pass rate fluctuates run-to-run on the same HTML)
- `FeedbackManager.init()` appears in the generated HTML

Check the spec's `PART-017` value. If `NO`, the call must be removed.

**How to apply:** Search generated HTML for `FeedbackManager.init(`. If present, check the spec: if `PART-017=NO` and `popupProps` is not specified, remove the call entirely. The fix loop will not reliably catch this on its own because the non-determinism means some iterations "pass" — masking the root cause.

## Lesson 52 — Cross-batch fix loop regressions (63% of multi-batch builds)

**Pattern:** When the per-batch fix loop fixes batch N, it can break batch N+1 because the fix overwrites the shared htmlFile with no rollback mechanism for downstream batches.

**Fix:** Added `detectCrossBatchRegression()` in pipeline-fix-loop.js — smoke-checks all prior-passing batch spec files after each batch completes. On regression, rolls back to preBatchHtml and marks batch as rolled_back.

**Proof:** Empirical trace of 19 multi-batch builds showed 63% had cross-batch regressions. 6 new unit tests. Commit 76996c1.

## Lesson 53 — HTML generation token truncation on large specs

**Pattern:** `trackedLlmCall` for HTML generation defaulted to maxTokens=16000. Large specs (bubbles-pairs 64KB, interactive-chat 59KB) generated HTML that exceeded 16K output tokens, truncating mid-script. Reviewer correctly rejected.

**Fix:** All 4 HTML generation call sites in pipeline.js updated to `{ maxTokens: 32000 }`.

**Proof:** bubbles-pairs truncated at `window.testS` (mid-function), interactive-chat at `case 'challenge_intro':` (mid-switch). Both games had 3-5 previously unexplained rejections. Commit a8392bc.

## Lesson 54 — RALPH_LLM_TIMEOUT config drift (production = 1200s vs 300s documented)

**Pattern:** Production server had RALPH_LLM_TIMEOUT=1200 in .env — 4x the documented default. Static-fix LLM calls could hang for up to 20 minutes before timing out, stalling the worker and blocking 40+ queued builds.

**Fix:** Updated /opt/ralph/.env to RALPH_LLM_TIMEOUT=300. The AbortController mechanism in llm.js is correctly wired — this was a config-only issue.

**Proof:** Worker stalled 23 minutes on futoshiki build #296 static-fix call. Force-kill required to unblock queue.

## Lesson 55 — debug-function window exposure rule conflict (29% of review rejections)

**Pattern:** CDN_CONSTRAINTS_BLOCK told gen LLM "debug functions MUST NOT be on window" but spec Verification Checklist requires them ON window. LLM followed the gen rule, reviewer rejected per spec checklist — an unfixable loop causing 29% of early-review rejections.

**Fix:** Changed rule to "MUST be exposed on window — define as named functions inside DOMContentLoaded then assign: window.debugGame = debugGame".

**Proof:** queens build 285 rejected 3 consecutive times for this exact conflict. Commit dd7f170.

## Lesson 56 — Cross-batch-guard false rollbacks from 30s timeout (0/0 treated as regression)

**Pattern:** `detectCrossBatchRegression()` smoke-checks prior passing batches after each new batch completes. With a 30-second timeout, game-flow tests (which can take 30-60s for complex games) would timeout and return 0/0 results. `0 < prevPassed` was true, so every batch triggered a false rollback — effectively wasting all per-batch improvements.

**Observed:** queens build — every batch (mechanics, level-progression, edge-cases, contract) passed their own tests but then had cross-batch-guard fire `REGRESSION: batch X broke prior batch game-flow (was 7/7, now 0/0)`. All batches rolled back. Only game-flow tests were preserved.

**Fix:** (1) Skip regression detection when `nowTotal === 0` (inconclusive — can't distinguish timeout from actual crash); (2) Increase smoke timeout from 30s → 90s. Commit 7d27432.

**Rule:** When `nowTotal === 0`, the test execution itself failed (timeout, infra error). Never treat this as a regression — it's inconclusive. Only trigger rollback when `nowTotal > 0 && nowPassed < prevPassed`.

## Lesson 57 — Generation LLM timeout (RALPH_LLM_TIMEOUT=300 kills large-spec HTML gen)

**Pattern:** Large-spec games (interactive-chat 59KB, bubbles-pairs 64KB) that require `maxTokens: 32000` output generate HTML that takes >5 minutes. `RALPH_LLM_TIMEOUT=300` aborted these at exactly 300 seconds with `iterations=0` — before the pipeline could do anything.

**Fix:** Added `RALPH_GEN_LLM_TIMEOUT` config (default 600s) used specifically at all 4 HTML generation call sites (generate-html, generate-html-retry, smoke-regen, snapshot-regen). Triage/fix calls keep 300s. Commit 4eb1d29.

**Rule:** Generation calls (maxTokens=32000) need a separate, larger timeout than fix/triage calls. Never use a single global timeout for all LLM call types.

## Lesson 58 — #popup-backdrop overlay persists after VisibilityTracker onResume — intercepts all clicks

**Pattern:** CDN VisibilityTracker shows a full-screen `#popup-backdrop` element when the page becomes inactive. When `onResume` fires and the user dismisses the "Continue" popup, the backdrop remains in the DOM with `position:fixed; z-index:9999` (or similar) — NOT automatically hidden. Any click on a game element (grid cells, Next Round button, answer input) hits the backdrop instead.

**Symptom:** game-flow and mechanics tests fail at iteration 2 with `locator.click: Timeout` errors despite the game rendering correctly. Tests pass in early iterations (before VisibilityTracker fires) but fail after a round transition or restart.

**Fix:** In `VisibilityTracker` `onResume` callback AND in `restartGame()`:
```javascript
const bd = document.getElementById('popup-backdrop');
if (bd) { bd.style.display = 'none'; bd.style.pointerEvents = 'none'; }
```

**Proof:** builds 306 (two-digit-doubles-aided, iter 2: "backdrop overlay not hidden after popup dismissal") and 310 (speedy-taps, iter 2: "popup backdrop intercepts clicks on Next Round button").

**Note:** The pipeline test harness already dismisses popups in `startGame()` via `dismissPopupIfPresent()`, but this only runs at test setup. The backdrop can re-appear during gameplay when page visibility changes occur.

**Rule:** Never rely on VisibilityTracker to auto-hide #popup-backdrop. Always explicitly set `display='none'` and `pointerEvents='none'` in the `onResume` callback and in `restartGame()`.

## Lesson 59 — adjustment-strategy chronic failures: 4 root causes across 60 builds (8% approval rate)

**Symptom:** 60 builds of adjustment-strategy, 8% approval rate. Mechanics tests persistently fail across all builds. Three independent root causes compounded each other.

**Root cause 1: Button ID mismatch after `updateAdjusterUI()` innerHTML rebuild**
The spec's `updateAdjusterUI()` used `innerHTML` to rebuild top/bottom adjuster areas on every delta change, but the injected markup omitted `id="btn-a-plus"` etc. The initial HTML template also lacked these IDs. Generated tests correctly expected `#btn-a-plus` / `#btn-a-minus` / `#btn-b-plus` / `#btn-b-minus` (since the warehouse `game.spec.js` used them), but after the first adjustment click, `innerHTML` replaced the button DOM node with a new element lacking the ID. Every subsequent `page.locator('#btn-a-plus').click()` timed out.

**Root cause 2: `isProcessing` race in `checkAnswer()`**
`checkAnswer()` sets `isProcessing = true`, awaits `FeedbackManager.sound.play()` and `FeedbackManager.playDynamicFeedback()`, then schedules `setTimeout(() => roundComplete(), 400)` — but does NOT reset `isProcessing = false` before the setTimeout. If FeedbackManager threw or took longer than expected, `isProcessing` remained `true` permanently, blocking all further user interaction and causing mechanics tests to timeout on the next round's button clicks.

**Root cause 3: `calcStars` not handling `game_over → 0★` explicitly**
The `endGame` star calculation in generated HTML sometimes applied the time-based formula even for `reason === 'game_over'`, resulting in `stars = 1` (instead of 0) when the game ended early with some level times recorded. The contract validator expects `stars = 0` for game_over. Review would reject with "calcStars wrong for game_over path".

**Root cause 4: postMessage missing `duration_data` / `attempts`**
Some generated HTML variants built `metrics` without explicitly including `duration_data` and `attempts`, or included them as undefined references. The contract validator checks both fields. Review rejected with "metrics.duration_data missing" or "metrics.attempts not an array".

**Fix:**
1. Spec `specs/Adjustment Strategy.md` updated: button IDs (`btn-a-minus`, `btn-a-plus`, `btn-b-minus`, `btn-b-plus`) added to the initial HTML template and to all `updateAdjusterUI()` innerHTML patterns. CRITICAL note added at top of spec.
2. `checkAnswer()` spec updated: `gameState.isProcessing = false` added immediately before `setTimeout(() => roundComplete(), 400)`.
3. `endGame()` spec updated: explicit `if (reason === 'game_over') stars = 0` branch required, with CRITICAL note in Verification Checklist.
4. postMessage spec updated: CRITICAL note requiring `duration_data` and `attempts` inside the `metrics` object.
5. Stale warehouse HTML (`warehouse/templates/adjustment-strategy/game/index.html`) and stale test files (`game/tests/`) deleted from both local and server so the next build generates fresh HTML and tests.

**Proof:** Identified 2026-03-20 via R&D deep-dive. Pre-fix approval rate: 8% over 60 builds. Fix deployed to both `specs/Adjustment Strategy.md` and server `/opt/ralph/specs/Adjustment Strategy.md`. Warehouse HTML and test cache cleared.

**How to apply:** For any game with persistent mechanics test failures where button clicks timeout after the first interaction: check whether `innerHTML` rebuild in UI update functions preserves button IDs. This is a systematic pattern — any game that uses innerHTML to show/hide adjusted values without re-injecting IDs will hit this bug.

## Lesson 60 — Rate-limiter starvation from manual build cancellations

**Pattern:** Admin operations calling `db.failBuild()` directly (e.g., to cancel duplicate/already-approved builds) still trigger the BullMQ `worker.on('failed')` handler, which increments the rate-limiter counter. With a 10/hr limit, 8+ admin cancellations in one hour blocked all legitimate builds for ~50 minutes. The rate limiter key is a fixed-window Redis counter; deleting it manually (`node -e "q.client.then(c=>c.del('bull:ralph-builds:limiter'))"`) instantly unblocks the queue.

**Root cause:** The BullMQ rate limiter uses a fixed-window Redis counter keyed by `bull:ralph-builds:limiter`. Every job that reaches the `failed` event handler — including admin-cancelled builds — increments this counter. There is no distinction between "pipeline failure" and "intentionally cancelled by admin".

**Fix:** Raised rate limit from 10/hr to 20/hr (commit ac6588a). This gives 3× headroom for admin operations without blocking legitimate builds.

**Detection:** If the queue appears blocked and all recent DB builds show `status='failed'` with short duration, check the rate limiter: `redis-cli GET bull:ralph-builds:limiter`. If near or at the limit, delete the key to immediately unblock: `node -e "q.client.then(c=>c.del('bull:ralph-builds:limiter'))"`.

**How to apply:** After any batch of admin cancellations (5+ builds failed manually in one session), check the rate-limiter counter before queuing new builds. If >15, delete the key. Consider incrementing the limit further if admin ops remain heavy.

## Lesson 61 — Claude CLI auth can silently expire during long sessions

**Pattern:** `claude auth status` returns `loggedIn: true` (reads cached credentials) even when the API session is invalid. Actual `claude -p` calls fail with "Your organization does not have access to Claude." after intensive Opus calls (build #305 ran 64 minutes). All subsequent builds fail in ~8 seconds with `iterations=0, error_message=null`. On 2026-03-20 ~19:07, 20+ builds in queue failed immediately due to this condition.

**Root cause:** `claude auth status` checks cached credential presence — it does NOT make a live API call. A session can be marked `loggedIn: true` while the underlying token is expired or the org's usage limit has been hit. The difference between session expiry and usage limit cannot be determined without attempting an actual generation call.

**Detection signal:** Monitor for builds failing with `duration_s < 30` AND `iterations=0` — indicates pre-generation failure, not a pipeline failure. Check `error_message` — if `null` despite failed status, the process exited before pipeline.js could write an error.

**Fix:** Re-authenticate via `claude auth logout && claude auth login`. Consider adding an auth health-check step at pipeline start: attempt a minimal `claude -p "ping"` call; if it fails, mark the build as `auth-failed` and skip the queue until re-auth is complete.

**How to apply:** If builds are completing in <30 seconds with 0 iterations and no Slack error detail, run `claude -p "test" 2>&1` directly on the server to confirm auth state. Do not trust `claude auth status` alone.

## Lesson 62 — CLIProxyAPI Claude OAuth blocked at org level; fallback to Gemini-only mode

**Pattern:** After switching from `RALPH_USE_CLAUDE_CLI=1` to `RALPH_USE_CLAUDE_CLI=0` (proxy mode), the CLIProxyAPI itself returned `"OAuth authentication is currently not allowed for this organization."` for all Claude models (`claude-opus-4-6`, `claude-sonnet-4-6`). This is an org-level restriction on OAuth-based Claude access — the Docker-mounted OAuth tokens are invalidated. All builds fail at Step 1 (generate-html) with HTTP 500 from the proxy.

**Root cause:** CLIProxyAPI authenticates Claude via OAuth tokens stored in `./auths/`. When Anthropic revokes OAuth access for the org (e.g., after quota exhaustion or plan changes), all proxy Claude calls return 500. This is distinct from Lesson 61 (CLI auth expiry) — the proxy layer is also affected.

**Detection signal:** Proxy returns `HTTP 500: {"error":{"message":"auth_unavailable: no auth available"}}` or `{"error":{"message":"OAuth authentication is currently not allowed for this organization."}}`. Check with: `curl -X POST http://localhost:8317/v1/messages -H "x-api-key: $PROXY_KEY" -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'`

**Fix applied 2026-03-20:** Switched all models to `gemini-3.1-pro-preview` in `.env`:
```
RALPH_GEN_MODEL=gemini-3.1-pro-preview
RALPH_FIX_MODEL=gemini-3.1-pro-preview
RALPH_TEST_MODEL=gemini-3.1-pro-preview
RALPH_REVIEW_MODEL=gemini-3.1-pro-preview
```
Gemini uses API key authentication (not OAuth) and is unaffected by Claude org restrictions. Pipeline runs fully on Gemini until Claude auth is restored.

**How to apply:** If both `claude -p` and CLIProxyAPI Claude calls fail, check Gemini availability with a direct proxy test (`curl ... -d '{"model":"gemini-3.1-pro-preview"...}'`). If Gemini works, switch all `RALPH_*_MODEL` vars to gemini and restart worker. The pipeline quality difference is minimal — Gemini 3.1 Pro Preview is capable of full pipeline execution.

## Lesson 63 — skip_test vs skip_tests triage decision mismatch

**Issue:** The LLM triage prompt instructed returning `"skip_test"` (singular) in the decision description text, but the pipeline code checked for `"skip_tests"` (plural). The LLM consistently followed the description wording rather than the JSON schema example, so the pipeline never saw `skip_tests` — it fell through to `fix_html` on every call where skip was intended.

**Root cause:** Inconsistency between `prompts.js` line 751 (description said `"skip_test"`) and line 768 JSON schema (used `"skip_tests"`) plus the `pipeline-fix-loop.js` check for `"skip_tests"`.

**Fix:** Added normalization `if (triageDecision === 'skip_test') triageDecision = 'skip_tests'` after JSON parse. Also fixed the prompt JSON schema to use `skip_test` consistently. Commit 5158275.

**Impact:** All builds where the LLM returned `skip_test` (singular) had unnecessary fix LLM calls run, which often corrupted the HTML — causing 0/0 cascade failures on the next iteration.

**Prevention:** When adding new decision values to triage, ensure the prompt description text, the JSON schema example, and all code checks use exactly the same string. A normalization alias is a useful safety net but the root cause is always prompt/code mismatch.

## Lesson 64 — Non-CDN games got CDN startGame() helper causing all tests to timeout

**Issue:** The `sharedBoilerplate` in `pipeline-test-gen.js` always included a `startGame()` helper that clicked `#mathai-transition-slot button`. For non-CDN games (no CDN ScreenLayout), this button does not exist. Every test that called `startGame()` timed out, triage marked all tests as skip, all spec files were deleted, and the build failed with 0/0 across all categories.

**Detection signal:** Triage rationale saying "startGame helper hardcodes a wait and click for '#mathai-transition-slot button', which times out on non-CDN games". All 5 categories affected simultaneously with skip_tests.

**Fix:** `startGame()` and `clickNextLevel()` are now conditional on `hasTransitionSlot`. For non-CDN games they try generic button selectors (Start/Play/Begin, `.start-btn`) then fall back to `waitForPhase(page, 'playing')`. Commit 3df4a3e.

**Detection:** `hasTransitionSlot` is derived by checking whether the HTML or domSnapshot contains `mathai-transition-slot`. Non-CDN games (e.g., adjustment-strategy, game-type templates) must use the new phase-based `startGame()` path.

**How to apply:** If a non-CDN build has all 5 categories skip_tests on iteration 1 and the triage rationale mentions the transition-slot button, verify `hasTransitionSlot` is being computed correctly from the HTML content. The fallback `startGame()` tries three generic button selectors before falling back to phase waiting — if none of those match the game's actual start button, add the correct selector to the fallback list.

## Lesson 65 — Global fix loop treats deleted spec files as failing batches (0/0)

**Issue:** When triage deletes a spec file (all tests in a category were skipped via `skip_tests`), the global fix loop at Step 3c still iterates over it from the pre-built `batches` array. Running Playwright on a non-existent file produces 0 passed / 0 failed, which the global loop treats as a failing batch. This triggers a spurious HTML fix LLM call even though the category was intentionally cleared by triage.

**Detection signal:** Log line `"[global] [edge-cases] 0/0 tests ran — page likely broken, treating as failing batch"` immediately after a per-batch loop where triage returned `skip_tests` and the spec file was deleted.

**Fix:** In the global fix loop, check `existingBatchFiles = batch.filter(f => fs.existsSync(f))` before running Playwright. If all files are missing (length === 0), treat the batch as passing and skip. Commit 749a2f1.

**How to apply:** Any time a category shows 0/0 in the global loop immediately after per-batch triage, check whether the spec file was deleted. If it was, the issue was this bug (pre-fix). Post-fix, deleted batches are silently skipped in the global loop.

## Lesson 66 — Deleted batch spec files cause passRate < 0.5 false-fail before review

**Issue:** When triage deletes all spec files in a batch (skip_tests), the per-batch fix loop records those test counts as failures in `totalFailed` (line 861 of pipeline-fix-loop.js). Step 3b (final re-test) only re-tests batches with existing spec files — it never corrects the deleted batch counts. This means `passRate = totalPassed / (totalPassed + totalFailed)` still includes the deleted test failures, potentially pushing it below the 0.5 threshold at Step 4, causing a FAILED before review even when all remaining tests pass.

**Example:** Build #387 interactive-chat — mechanics (0/6) + level-progression (0/1) deleted by triage. Remaining passing tests: game-flow:2, edge-cases:1, contract:2 = 5 passed, 7 failed. passRate = 5/12 = 42% < 50% → FAILED before review.

**Detection signal:** Build FAILED immediately after `[gcp] Uploaded games/.../index.html` with no Step 4 review logs. DB shows `status=failed`, all final re-test batches show 0 failures.

**Fix:** Before Step 3b in the fix loop, subtract deleted batches' counts from `totalPassed`/`totalFailed` and zero out their `category_results` entry. Commit dc20844.

**How to apply:** If a build FAILED without any review logs and the test_results in DB show some categories with all failures (0/N passing) that match categories that were skip_tests'd, this was the bug. Post-fix, deleted batches are removed from the passRate calculation.

## Lesson 67: FeedbackManager.init() in spec initialization blocks causes CDN smoke-check failure

**Date:** 2026-03-20  
**Games affected:** associations (3 consecutive failures at CDN smoke check), + 18 more specs with same pattern  
**Root cause:** The spec quality fix (R&D session 2026-03-20) replaced `await FeedbackManager.init()` in 48/50 specs, but missed instances formatted as `   - FeedbackManager.init()` (with 3-space indent bullet syntax, no `await`). These were still interpreted by the LLM as executable init code. When `FeedbackManager.init()` runs during `waitForPackages()` callback, it shows a blocking audio popup that prevents `ScreenLayout.inject()` from being called → #gameContent never created → smoke check fails with "Blank page: missing #gameContent element".

**Fix:** Replaced `   - FeedbackManager.init()` with `   - // DO NOT call FeedbackManager.init() — PART-015 auto-inits on load. Calling it shows a blocking audio popup that breaks all tests.` across 20 specs (associations, bubbles-pairs, connect, crazy-maze, disappearing-numbers, doubles, explain-the-pattern, free-the-key, hidden-sums, identify-pairs-list, jelly-doods, kakuro, keep-track, listen-and-add, loop-the-loop, matching-doubles, queens, truth-tellers-liars, two-digit-doubles-aided, template-schema).

**Proof:** associations #398 (next build after fix) should not hit CDN smoke check failure.

**Pattern to watch:** Any spec that says `FeedbackManager.init()` without `await` prefix in a bullet list is still dangerous — LLM generates it as executable code.

## Lesson 68: extractPhaseNamesFromGame() returned raw phase names that don't match syncDOMState() output

**Date:** 2026-03-21  
**Games affected:** kakuro #391, rapid-challenge #394 (2/5 non-first-attempt approvals), colour-coding-tool #398 (game-flow test expecting 'start_screen' when data-phase contains 'start')  
**Root cause:** `extractPhaseNamesFromGame()` in `lib/prompts.js` parsed raw phase names from the HTML source code (e.g., `gameState.phase = 'start_screen'`, `gameState.phase = 'game_over'`) and injected them directly into the GF1 test-gen prompt: "use ONLY these exact strings in waitForPhase() calls." But `syncDOMState()` normalizes these before setting `data-phase` on `#app`:
- `game_over` → `gameover`
- `game_complete` → `results`  
- `start_screen` → `start`
- `game_init` → `start`
- `game_playing` → `playing`

So when the test called `waitForPhase(page, 'start_screen')`, `data-phase` was `'start'` — permanent timeout.

**Fix:** Apply the same normalization map in `extractPhaseNamesFromGame()` before returning phase names (commit 32785d3). Also added CRITICAL warning to GF1 prompt block with explicit raw→canonical mapping table.

**Proof:** Colour-coding-tool #398 triage confirmed the pattern: "game initially uses 'start_screen' for data-phase, but restart button sets 'start' instead of 'start_screen', causing test's expectation to fail." With the fix active on subsequent builds (crazy-maze #399+), phase-name mismatches should be eliminated.

**Pattern to watch:** If triage says "waitForPhase timeout: Expected 'X', Received 'Y'" where Y is the normalized form of X, this is the same root cause.

## Lesson 69: ScreenLayout.inject() requires `slots` wrapper — omitting it causes blank page at Step 1d

**Pattern:** CDN games fail smoke check with "missing #gameContent element" even after smoke-regen.

**Root cause:** LLM generates `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })` — the outer key must be `slots`: `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`. Without `slots`, ScreenLayout runs without error but never creates `#gameContent`; smoke check times out after 8s waiting for the element.

**Why smoke-regen also failed:** The smoke-regen prompt described the symptom ("missing #gameContent") but did not show the correct call format. The LLM reproduced the same broken structure on regen because it had no example of what correct looks like.

**Fix:** `CDN_CONSTRAINTS_BLOCK` in `lib/prompts.js` updated with the exact required format including a CORRECT/WRONG example pair. Smoke-regen error context in `lib/pipeline.js` now includes the canonical call snippet. Gen prompt Rule 2 uses the exact call with `slots` wrapper.

**Proof:** Commit 2666e36; affects disappearing-numbers, kakuro, face-memory, associations builds.

**Pattern to watch:** Any CDN game that hits "missing #gameContent element" at Step 1d with a smoke-regen that also fails — check whether `ScreenLayout.inject()` is called with `slots` wrapper. The outer options object must have a `slots` key; passing slot flags directly at the top level is silently ignored by ScreenLayout.

## Lesson 70: Three review false-rejection patterns fixed with RULE-006/007/008 + T1 checks

**Date:** 2026-03-21  
**Root cause:** The review step (Step 4) was rejecting games for three patterns that are actually correct or acceptable:
1. **Pattern 1 (game_over phase):** Reviewer rejected games where `gameState.phase` was never set to `'game_over'` (string). But `endGame()` is the correct termination mechanism — games that call `endGame()` and send the postMessage payload are correct even if the phase is `'gameover'` (no underscore) or `'results'`. The canonical phase for the test harness is `'gameover'`; the raw `'game_over'` string is normalized by `syncDOMState()`.
2. **Pattern 2 (isActive guard):** Reviewer rejected games where `isActive` wasn't found in the `gameState` init object, even though handlers checked `gameState.isActive`. Two separate issues: (a) `gameEnded = true` at start of `endGame()` is equivalent to `isActive = false` as a re-entry guard; (b) `isActive` must be in the gameState init object (`isActive: true`) so handlers aren't immediately blocked on the first click.
3. **Pattern 3 (TransitionScreen not awaited):** Reviewer rejected games that called `transitionScreen.show()` without `await`. While `await` is strongly preferred (without it, race conditions occur), it is technically optional for the initial DOMContentLoaded call.

**Fix:**
- `lib/prompts.js`: Added RULE-006 (endGame() is the correct termination pattern), RULE-007 (isActive guard acceptable forms), RULE-008 (await on TransitionScreen.show() is optional) to `REVIEW_SHARED_GUIDANCE`.
- `lib/prompts.js`: Added rule 25 (TransitionScreen await) and rule 26 (isActive in gameState init) to `buildGenerationPrompt()` ADDITIONAL GENERATION RULES.
- `lib/prompts.js`: Updated `CDN_CONSTRAINTS_BLOCK` with `TransitionScreen AWAIT` and `isActive IN GAMESTATE INIT` constraints (propagates to fix prompts).
- `lib/prompts.js`: Updated `buildCliGenPrompt()` with TransitionScreen await + isActive init rules.
- `lib/validate-static.js`: Added T1 warning check 5h (TransitionScreen.show() calls not awaited — counts awaited vs total).
- `lib/validate-static.js`: Enhanced T1 check 12 (isActive guard) to also warn when `gameState.isActive` is used in handlers but not in the gameState init object literal.
- `test/validate-static.test.js`: 4 new tests for the new T1 checks. Total: 554 tests (was 550).

**Pattern to watch:**
- If review rejects with "phase never set to game_over" — check that `endGame()` is called correctly and sends postMessage; `RULE-006` in `REVIEW_SHARED_GUIDANCE` should prevent this.
- If review rejects with "missing isActive guard" but handlers do check it — verify `isActive: true` is in the gameState init object. T1 check 12 now warns when it's missing from init.
- If review rejects with "TransitionScreen not awaited" — add `await` to all `transitionScreen.show()` calls. T1 check 5h now warns when any show() calls are unawaited.

## Lesson 71: Silent failures (iterations=0, error_message=NULL) — root causes identified and fixed

**Date:** 2026-03-21
**Scale:** 204 of 344 failed builds (59%) had NULL error_message in the DB, making root cause diagnosis impossible via DB queries alone.

**Root cause 1 — completeBuild() never set error_message:**
`db.completeBuild()` updated status, iterations, test_results, etc., but the SQL never touched the `error_message` column. The column was only written by `db.failBuild()` (called for crashes/orphans). When the pipeline returned a FAILED report normally (e.g., HTML generation failed, T1 validation killed it), `completeBuild()` stored `status='failed'` but left `error_message=NULL`. The report's `errors` array had the failure reason but it was never persisted.

**Root cause 2 — report.iterations never set in runPipeline():**
`report.iterations` was initialized to 0 and was only updated in `pipeline-targeted-fix.js`. In `runPipeline()` and `runFixLoop()`, `report.iterations` was never set. Result: all builds that went through the test loop showed `iterations=0` in the DB, even if the fix loop ran 5 iterations.

**Failure pattern breakdown (from 59 ralph-report.json files analyzed):**
- 30x: `HTML generation failed: claude -p exited with code 1` — LLM process crashed (non-zero exit)
- 8x: `HTML generation failed: claude -p exited with code 143` — SIGTERM (timeout/kill)
- 3x: `HTML generation failed: Proxy returned HTTP 500: auth_unavailable` — Claude OAuth blocked
- 2x: `HTML generation failed: claude -p timed out after 300s` — gen timeout
- 2x: `HTML generation failed: Proxy returned HTTP 403` — auth error
- 13x: Empty errors array + test_results present — fix loop ran but pipeline code had iterations=0 bug

**Fix (commit 4131eca):**
1. `db.completeBuild()` now sets `error_message = COALESCE(error_message, ?)` where the value is:
   - `report.errors.join('; ')` when errors array is non-empty
   - Derived summary `"Tests failed: X/Y passed after N iteration(s). Review: SKIPPED"` when errors is empty but test_results exist
   - Generic fallback when both are empty
   - `COALESCE` ensures pre-existing error_message (set by failBuild() for crashes) is never overwritten
   - NULL for approved builds (no error_message set when status != 'failed')
2. `runPipeline()` now computes `report.iterations = Math.max(...report.test_results.map(r => r.iteration || 1))` after `runFixLoop()` returns, so the DB reflects the actual iteration count.

**Tests:** 4 new unit tests in `test/db.test.js`: from report.errors, from test_results fallback, COALESCE non-overwrite, approved builds have null error_message.

**How to apply:** After this fix, any new failed build will have a non-null error_message in the DB. To backfill existing silent failures, query `reports` in `data/games/*/builds/*/ralph-report.json` and update via `db.failBuild(id, errors[0])` if `error_message IS NULL`. Future diagnostic queries like `SELECT game_id, error_message FROM builds WHERE status='failed' AND error_message LIKE '%code 1%'` will work immediately.

**Detection going forward:** If `error_message IS NULL AND status='failed'` appears in the DB after this fix, it indicates either: (a) the build was failed by an external process that called `failBuild()` with an empty string (check the fallback in worker.js line 1069), or (b) a new code path was added to the pipeline that returns a FAILED report without populating `report.errors`. Both cases are now caught by the worker-level safety net.

---

### Lesson 72 — waitForPackages must check a loaded package; PART-017=NO → check ScreenLayout not FeedbackManager

**Root cause (light-up #411):** The gen prompt's `waitForPackages` template hardcoded `while (typeof FeedbackManager === 'undefined')`. But light-up's spec has PART-017=NO (no Feedback Integration), so FeedbackManager is never loaded by the CDN scripts. The loop spun for 10 seconds, threw "Packages failed to load within 10s", crashed the DOMContentLoaded handler before `window.gameState` was populated, and left `gameState: []` (empty). All tests then timed out on `waitForPhase()`.

**Diagnosis signal:** DOM snapshot shows `gameState: []` (empty array, not object) and the browser error is "Packages failed to load within 10s".

**Fix (commit fd7a36c):** Updated `buildGenerationPrompt()` PART-003 section to show TWO variants based on PART-017:
- PART-017=YES → `while (typeof FeedbackManager === 'undefined')` (unchanged)
- PART-017=NO → `while (typeof ScreenLayout === 'undefined')` (ScreenLayout is always loaded)

Also added rule to `CDN_CONSTRAINTS_BLOCK`: "waitForPackages() typeof check MUST match packages that ARE loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout. NEVER check typeof FeedbackManager when PART-017=NO."

Updated `buildCliGenPrompt()` PART-003 rule with the same constraint.

**How to apply:** If a CDN game's DOM snapshot shows `gameState: []` (empty) and the browser error is "Packages failed to load within 10s", check whether PART-017=NO in the spec and whether the HTML's `waitForPackages` is checking FeedbackManager anyway. The gen prompt fix prevents this on new builds; for existing broken builds, re-queue after the fix is deployed.

---

## Lesson 73 — BullMQ job resurrection: `db.failBuild()` does NOT remove from BullMQ queue

**Date:** 2026-03-21

**Pattern:** Calling `db.failBuild(id, reason)` marks the DB record as `status='failed'` but has NO effect on the corresponding BullMQ/Redis job. The job remains in Redis and will be redelivered to the worker on the next worker restart. When the worker processes the resurrected job, `db.startBuild()` unconditionally overwrote `status='failed'` → `status='running'`, silently re-running a build that was intentionally cancelled.

**Root cause:** BullMQ jobs are entirely Redis-backed. `db.failBuild()` only touches SQLite. The Redis job entry (keyed `bull:ralph-builds:<jobId>`) persists independently. Any worker restart causes BullMQ to redeliver delayed/waiting jobs — including ones whose DB record was already marked failed by admin operations.

**How it manifested:** Five duplicate queue entries (speed-input, true-or-false, truth-tellers-liars, two-player-race, visual-memory) were cancelled via `db.failBuild()`. After a worker restart for a code deploy, all five resurrected and started running as new builds, each overwriting the failed DB record with a new running record.

**Fix (commit b254482):** Added terminal state guard in `worker.js` before `db.startBuild()`:
```javascript
if (buildId) {
  const existingBuild = db.getBuild(buildId);
  if (existingBuild && ['failed', 'approved', 'rejected'].includes(existingBuild.status)) {
    logger.warn(`[worker] Build #${buildId} (${gameId}) already in terminal state '${existingBuild.status}' — skipping stale BullMQ job`);
    return;
  }
  db.startBuild(buildId, { workerId: WORKER_ID });
}
```

**How to apply:** If you need to truly cancel a queued build: (1) call `db.failBuild(id, reason)` to mark DB, AND (2) optionally delete the Redis key directly. The terminal state guard now prevents resurrection, so step (2) is only needed if you also want to free the queue slot immediately without waiting for the next worker pick-up. To find the BullMQ job ID corresponding to a DB build: check the job `data.buildId` field in Redis.

---

## Lesson 74 — window.debugGame T1 false positive: T1 validator wrongly rejected required spec pattern

**Date:** 2026-03-21

**Pattern:** T1 static validator (`lib/validate-static.js`) had a check flagging `window.debugGame = debugGame` as an error, with a comment claiming "review model rejects window-exposed debug functions." This was incorrect — the review model does NOT reject them, and all specs explicitly REQUIRE debug functions to be assigned to `window` in the Verification Checklist.

**Evidence of false positive:** simon-says build #416 was APPROVED with `iterations=0` (no fix loop) and contained 3× `window.debugGame` assignments. The review model passed it. Every other approved CDN game also has these assignments.

**Compounding damage:** The gen prompt CDN_CONSTRAINTS_BLOCK had three mutually contradictory statements:
1. Gen prompt rule: "NEVER assign debug functions to window"
2. T1 validator: Error on `window.debugGame = ...`
3. Spec Verification Checklist: "window.debugGame = debugGame — MUST be assigned to window"

The LLM followed rule 1 (NEVER), T1 validated against rule 2, but the review model actually enforced the spec checklist (rule 3). This produced an unfixable loop: gen followed gen prompt → review rejected per spec.

**Fix (commit d827777):**
1. Removed the `debugWindowPattern` error check from `validate-static.js` entirely. Added comment: "PART-012 debug functions SHOULD be assigned to window per spec — no check here."
2. Flipped the gen prompt rule from "NEVER" → "MUST": "PART-012 debug functions (debugGame, testAudio, etc.) MUST be assigned to window: `window.debugGame = debugGame`. Copy this pattern verbatim from the spec."
3. Corrected the EXCEPTION note and CDN_CONSTRAINTS_BLOCK to use "MUST" language.

**How to apply:** If a build fails T1 with `window.debugGame` flagged as an error, the fix is already deployed (post-commit d827777). If you see a review rejection mentioning debug functions not on window, check whether the gen prompt constraint has reverted. The correct invariant: debug functions are ALWAYS assigned to `window` — this is a spec requirement, not a lint violation.

---

## Lesson 75 — Phase name injection: non-standard game phases require post-processing fixup after test-gen

**Date:** 2026-03-21

**Pattern:** The test generator defaults to `waitForPhase(page, 'playing')` as the universal active phase. Games with custom phase names (e.g., `'memorize'` for matrix-memory, `'question'` for quiz games) have a different active phase — the `'playing'` string never appears in `data-phase`, so all `waitForPhase(page, 'playing')` calls immediately time out and the entire game-flow category fails iteration 1.

**Root cause:** The test-gen LLM prompt instructed "use 'playing' as the game-active phase" as a default. For standard games this is correct. For games where the LLM was told to use a custom phase via DOM snapshot context, the generator sometimes still defaulted to 'playing'. The DOM snapshot's `gameStateShape.phase` field (e.g., `string "memorize"`) captured the runtime phase but wasn't used to override the generated test string.

**Fix (commit 7796007):** Added post-processing step in `lib/pipeline-test-gen.js` that runs immediately after test generation:
```javascript
const snapPath = path.join(testsDir, 'dom-snapshot.json');
if (fs.existsSync(snapPath)) {
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
  const phaseEntry = snap.gameStateShape && snap.gameStateShape.phase;
  const phaseMatch = phaseEntry && phaseEntry.match(/^string "([^"]+)"/);
  const actualPhase = phaseMatch && phaseMatch[1];
  const STANDARD_PHASES = new Set(['playing', 'start', 'gameover', 'results', 'transition', 'paused']);
  if (actualPhase && !STANDARD_PHASES.has(actualPhase) &&
      tests.includes("waitForPhase(page, 'playing')")) {
    tests = tests.replace(
      /waitForPhase\s*\(\s*page\s*,\s*['"]playing['"]/g,
      `waitForPhase(page, '${actualPhase}'`,
    );
  }
}
```

Only fires when: (1) dom-snapshot.json exists, (2) the actual phase is non-standard (not in STANDARD_PHASES), and (3) the generated tests contain a 'playing' reference. Standard games are unaffected.

**How to apply:** If a game with a custom phase (not 'playing') fails iteration 1 with `waitForPhase('playing') timeout`, check dom-snapshot.json for `gameStateShape.phase`. If it shows `string "memorize"` (or similar non-standard phase), the post-processing should have caught it. If tests still use 'playing', verify `pipeline-test-gen.js` is deployed with this fix and that dom-snapshot.json was written before test generation ran.

---

## Lesson 76 — Sentry.captureConsoleIntegration is not a function: separate plugin bundle not loaded

**Date:** 2026-03-21

**Pattern:** CDN games fail smoke check with "Sentry.captureConsoleIntegration is not a function" immediately followed by "missing #gameContent". The smoke check fails even after smoke-regen.

**Root cause:** `CDN_CONSTRAINTS_BLOCK` in `lib/prompts.js` told the LLM: "Use the flat function API instead: `Sentry.captureConsoleIntegration({levels:['error']})`". This function exists only in Sentry's separate `captureconsole.min.js` plugin bundle — NOT in the base `bundle.tracing.replay.feedback.min.js` that games load. Calling it throws `TypeError`, crashes `initSentry()`, prevents `ScreenLayout.inject()` from running, and `#gameContent` is never created.

**Why smoke-regen also failed:** The regen prompt showed only the symptom ("missing #gameContent") without identifying the Sentry API as root cause. LLMs regenerated with the same broken call.

**Fix (commit 562387c):** Banned `captureConsoleIntegration` in `CDN_CONSTRAINTS_BLOCK` with explicit explanation; mandated "OMIT integrations entirely — call initSentry() with no integrations argument or pass []".

**How to apply:** If a CDN build's smoke-check console errors include "Sentry.captureConsoleIntegration is not a function", kill and requeue. Post-fix builds generate correct `initSentry()` without integrations.

---

## Lesson 77 — `.resolves` on already-awaited value throws TypeError: received value must be a Promise

**Date:** 2026-03-21

**Pattern:** Test generator produces `expect(await page.evaluate(() => window.gameState.lives)).resolves.toBe(3)`. This throws `TypeError: received value must be a Promise and resolve to the expected value, but instead it resolved to 3` — crashing the test at runtime and causing 0/0 for the batch.

**Root cause:** `.resolves` is a Jest/Playwright test matcher modifier for unresolved Promises. When the value has already been `await`ed, it is a plain value (e.g., number 3), not a Promise. Applying `.resolves` to a non-Promise throws.

**Fix (commit 576f3a2):**
1. Post-processing in `lib/pipeline-test-gen.js` strips `.resolves` from `expect(await ...).resolves.` patterns automatically after test gen.
2. R7 rule added to test-gen prompt: "NEVER USE .resolves ON AN AWAITED VALUE — WRONG: `expect(await page.evaluate(...)).resolves.toBe(3)` — RIGHT: `expect(await page.evaluate(...)).toBe(3)`"

**How to apply:** If a batch returns 0/0 and the test file contains `.resolves.toBe()` or `.resolves.toEqual()` on an `await` expression, this is the bug. Post-fix, post-processing catches it automatically; R7 rule prevents generation.

---

## Lesson 78 — CDN game toBeVisible assertions need 10s timeout after startGame()

**Date:** 2026-03-21

**Pattern:** `await expect(page.locator('#question-text')).toBeVisible()` flakes on CDN games immediately after `startGame()`. The CDN ScreenLayout and TransitionScreen components continue rendering for 5-10 seconds after the transition animation completes. The default 5s Playwright timeout fires during this window.

**Root cause:** CDN components (TransitionScreen, ProgressBar, ScreenLayout) are async and may not expose game elements until their internal render cycle completes. `startGame()` returns when the transition animation starts, not when all CDN slots are populated.

**Fix (commit 576f3a2):** R6 rule added to test-gen prompt: "For CDN games, use `{ timeout: 10000 }` on toBeVisible() assertions immediately after startGame(). Default 5s timeout will flake on slow CDN loads."

**How to apply:** If a CDN game's mechanics or game-flow tests flake with `toBeVisible()` timeout immediately after startGame() but pass on retry, increase the timeout to 10000ms on those specific assertions.

---

## Lesson 79 — Contract auto-fix T1 re-check used wrong property (errors.length on undefined)

**Date:** 2026-03-21

**Pattern:** After applying a contract auto-fix (Step 1b), the pipeline re-ran T1 static validation and accessed `reStaticResult.errors.length`. `runStaticValidation()` returns `{ passed: boolean, output: string }` — there is NO `errors` array. Every call threw `TypeError: Cannot read properties of undefined (reading 'length')`.

**Why it was silent:** The error was caught by the Step 1b `catch (e)` block and logged as a warning. The pipeline continued without the re-check functioning. The contract auto-fix T1 re-validation was completely non-functional in all builds.

**Impact:** Potentially many builds silently skipped the T1 re-check after contract fix, allowing contract-fixed HTML with lingering static errors to proceed to test-gen.

**Fix (commit cc5fae7):** Changed `reStaticResult.errors.length > 0` → `!reStaticResult.passed`. Error lines extracted from `reStaticResult.output.split('\n').filter(l => l.includes('✗'))`, consistent with the rest of the file.

**How to apply:** If future code accesses properties on `runStaticValidation()` output, always use `.passed` (boolean) and `.output` (string) — never `.errors` (does not exist).

---

## Lesson 80 — associations chronic failure: 4 root causes across 15 builds

**Date:** 2026-03-21

**Pattern:** associations had 15 consecutive failures (0% approval rate) spanning multiple pipeline eras. Each era had a distinct root cause:

**Root cause 1 (builds 109, 157, 158, 291, 345): Wrong mechanics tests — lives on unlimited-lives game**
Test generator produced `❤️❤️` hearts/lives-decrement assertions on an accuracy-scored unlimited-lives game. `totalLives: 0` means no hearts render — correct game, wrong test. Fix loop cannot resolve this. Fix: add CRITICAL no-lives note to spec; H1 LIVES SYSTEM CHECK rule in test-gen prompt.

**Root cause 2 (builds 392, 396): Step 1d smoke-check failure — missing #gameContent**
HTML generation produced no `#gameContent` element. Caught by smoke-check, triggered smoke-regen. These are pre-test-loop failures covered by Step 1d + smoke-regen.

**Root cause 3 (build 405): CDN package load timeout causes silent DOMContentLoaded crash**
`waitForPackages()` 10s timeout fires during Playwright test runs (CDN packages take >10s under test server load). Error is caught silently by DOMContentLoaded `catch (e)` block. `ScreenLayout.inject()` never runs. `#mathai-transition-slot button` never appears. `beforeEach` polls 50s then times out on every test. Note: this is non-deterministic — smoke check at Step 1d uses a different network context and may pass while Playwright tests fail.

**Root cause 4 (build 405): Corrupt fallbackContent — SignalCollector events captured**
`captureGameDomSnapshot()` runs at Step 2.5 before pairs load into `window.gameState.content`. When content is null, the snapshot pipeline falls back to `game-content.json` populated with SignalCollector event API surface names (`{ question: "Event", answer: "Target" }`). Tests using `fallbackContent.rounds` get garbage data, causing assertion crashes.

**Fix applied:**
1. Spec fix: CRITICAL no-lives note added (prevents wrong test generation)
2. Spec fix: CRITICAL content-structure note added (prevents corrupt fallbackContent)

**The CDN package timeout issue (Root cause 3) is not fixable without changing the review model's `≤10s` requirement for waitForPackages. It is a known network variance issue — next build attempt (447) may succeed if CDN packages load within 10s.**

**How to apply:** Any game with unlimited-lives accuracy scoring should have an explicit CRITICAL note in the spec prohibiting lives-based test assertions. Any game where `window.gameState.content` populates asynchronously (after a network fetch) is at risk of corrupt fallbackContent — the spec should describe the actual content structure with a concrete example.

---

## Lesson 81 — Corrupt fallbackContent: SignalCollector API names captured instead of real game data

**Date:** 2026-03-21

**Pattern:** Test generator uses `fallbackContent.rounds` to populate test assertions. For games that load content asynchronously (e.g., Associations fetches word pairs from a server), `window.gameState.content` is null when `captureGameDomSnapshot()` runs at Step 2.5. The pipeline falls back to `extractSpecRounds()` — but this function can parse CDN SignalCollector API surface names ('Event', 'Target', 'Input', 'Action', 'Source', 'Destination') from spec markdown tables as if they were game round data.

**Symptom:** Tests crash with assertions against game-specific properties (e.g., `.emoji`, `.name`) on objects that are actually CDN API event descriptors. Tests pass `question: "Event"` into game logic and get unexpected crashes.

**Fix (commit 668c087):** `detectCorruptFallbackContent(fallbackContent)` added to `lib/pipeline-test-gen.js`. Checks if >50% of `question`/`answer` string values across all rounds match a 10-member CDN API name set. If detected, returns `{ rounds: [], corrupt: true }` and logs a warning — the corrupt data is discarded and test-gen proceeds with empty fallbackContent. 4 unit tests; 562 total pass.

**How to apply:** If tests crash with assertions on game-specific properties that don't match real game data (especially for games with async content loading), inspect `tests/game-content.json` — if it contains CDN event names rather than real game pairs, this is the pattern. Post-fix, the detection runs automatically before test-gen.

---

## Lesson 82 — CDN package load timeout silently kills DOMContentLoaded; window.__initError surfaces it

**Date:** 2026-03-21

**Pattern:** When `waitForPackages()` throws "Packages failed to load within 10s" (CDN slow under Playwright load), the error is caught by DOMContentLoaded's `catch (e)` block which only calls `console.error('Init error: ' + e.message)`. The test harness `beforeEach` then polls 50 seconds for `#mathai-transition-slot button` — a button that will never appear because `ScreenLayout.inject()` never ran. The 50s wait is silent; triage sees only a timeout with no root cause.

**Fix (commit 842c649):**
1. `lib/pipeline-test-gen.js` `beforeEach` template: reads `window.__initError` after `page.goto()` and before the polling loop. If set, logs `[test-harness] DOMContentLoaded init error: <message>` — triage now has the actual error string, not just a timeout.
2. `lib/prompts.js` CDN_CONSTRAINTS_BLOCK: new rule "DOMContentLoaded catch block MUST set `window.__initError = e.message`" so generated HTML always includes this assignment.

**How to apply:** If triage logs show `[test-harness] DOMContentLoaded init error: Packages failed to load within 10s`, the root cause is CDN package load timeout on the test server. Options: (a) re-queue and hope CDN is faster, (b) check CDN script URLs for 404s, (c) check if waitForPackages() is checking the correct package (Lesson 72: PART-017=NO → check ScreenLayout not FeedbackManager).

---

## Lesson 83 — Smoke-regen repeat-failure rate is 38.5%, far above 10% target

**Date:** 2026-03-21

**Measurement:** R&D agent analyzed all CDN smoke-regen events in builds >= 420 (post-ScreenLayout slots fix, commit 2666e36). 13 definitive cases; 8 passed post-regen, 5 failed again. Repeat-failure rate: 38.5%.

**Root causes of post-regen failures:**

1. **Missing #gameContent after regen (4/5 failures)**: smoke-regen uses `genPrompt + smokeErrorContext` — asks the LLM to regenerate from scratch with the error appended. The LLM generates a new game and can still produce broken ScreenLayout.inject() calls. The smokeErrorContext has correct rules but they apply at the end of a full generation prompt and can be overridden by the LLM's own generation path. Key: a from-scratch regen re-introduces the same CDN init mistakes.

2. **HTTP 403 on CDN resources (affects loop-the-loop, bubbles-pairs)**: Some CDN script URLs return 403. `fixCdnDomainsInFile()` fixes wrong domain names but does not fix wrong paths. If a script URL has the right domain but wrong path, it 403s, packages fail to load, ScreenLayout.inject() never runs, #gameContent never created.

3. **Regen introduces new CDN API bugs (face-memory)**: The regen LLM changed something else incorrectly while fixing the init issue (Sentry.captureConsoleIntegration call introduced). Fixed by Sentry ban in commit 562387c — this specific failure mode should not recur.

**Fix needed:** Change smoke-regen from "regenerate from scratch" to "surgical CDN init fix": show the failing HTML to the LLM, ask it to fix ONLY the CDN init sequence (waitForPackages → FeedbackManager.init → initSentry → ScreenLayout.inject). This avoids re-introducing bugs in the rest of the game logic while precisely fixing the root cause.

**Expected impact:** If 4/5 failures are caused by the from-scratch regen approach, switching to a surgical fix prompt could reduce repeat-failure rate from 38.5% to ~8% (1/13 — just the CDN URL 403 case which requires a different fix).

**How to apply:** When investigating a smoke-regen failure where the post-regen HTML still lacks #gameContent, check if the HTML's CDN script URLs return 403. If yes, this is a URL path issue, not a prompt issue. If no, the LLM generated broken ScreenLayout.inject() again — switch to surgical fix prompt approach.

---

## Lesson 84 — Step 1b T1 re-check silently skipped: undefined .output from runStaticValidation() catch path

**Date:** 2026-03-21

**Pattern:** After contract auto-fix (Step 1b), the pipeline re-runs T1 static validation and then calls `reStaticResult.output.split('\n').filter(...)` to extract error lines. If `runStaticValidation()` throws internally (e.g., process killed with no stdout buffered), the catch path returns `{ passed: false, output: err.stdout || err.message }`. When `err.stdout` is undefined (no buffered output) AND `err.message` is also falsy, the result is `undefined || undefined = undefined`. Then `undefined.split(...)` throws TypeError.

**Why it was silent:** The TypeError was caught by the Step 1b outer `try/catch` at line 728, logged as a warning, and execution continued. The T1 re-check after contract-fix was silently skipped — same failure mode as Lesson 79 (cc5fae7), just one level deeper.

**This is the same class of bug as Lesson 79.** The cc5fae7 fix changed `reStaticResult.errors.length` to `reStaticResult.output.split(...)` but left `output` itself unguarded.

**Fix (commit 6e4f06b):**
1. `reStaticResult.output.split(...)` → `(reStaticResult.output || '').split(...)` — null guard on output
2. `recheckErrors.length` → `(recheckErrors || []).length` — belt-and-suspenders for the re-validate check
3. Catch block now logs full stack trace for future debugging

**How to apply:** Any access to `runStaticValidation()` result fields should defensively guard both `.passed` (boolean, safe) and `.output` (string, but can be undefined if process exits without stdout). Always `(result.output || '').split(...)` — never `result.output.split(...)` directly.

---

## Lesson 85 — CDN script 404/403 errors are invisible to smoke-regen LLM without URL pre-validation

**Date:** 2026-03-21

**Pattern:** When CDN script URLs return 404 or 403, `waitForPackages()` times out after 10s and throws. The smoke-regen LLM only sees "Packages failed to load within 10s" — it has no idea which specific URL failed. The LLM guesses at CDN init sequence fixes (ScreenLayout.inject() format etc.) when the actual problem is a wrong URL path that needs correction.

**Examples observed:** memory-flip #432 and true-or-false #436 both failed smoke-regen with CDN 404s. The surgical init fix (commit 8c645dc) could not help since the issue was URL correctness, not init sequence order.

**Fix (commit e867f36):** `checkCdnScriptUrls(htmlContent)` added to `lib/pipeline.js`. Before constructing the smoke-regen prompt:
1. Parses all `<script src>` tags from failing HTML
2. Filters to CDN URLs (storage.googleapis.com, cdn.homeworkapp.ai)
3. Fires parallel HEAD requests with 5s timeout each
4. If any return non-200: builds `cdnUrlContext` listing each failed URL + HTTP status
5. Injects into smoke-regen prompt as "BROKEN CDN SCRIPT URLS (HIGH PRIORITY — fix these first)"

LLM now sees exactly which URL failed and what domain to replace it with, rather than only seeing "packages failed to load".

**How to apply:** Any time smoke-regen logs show `cdnUrlContext` with HTTP 404/403, the root cause is URL path hallucination (not init sequence). The LLM is now told the exact broken URL. Check that `fixCdnDomainsInFile()` is also running after the regen to catch any domain re-introduction.

---

## Lesson 86 — Two 0/0 false-approval gaps: single-category threshold and global fix loop blind spot

**Date:** 2026-03-21

**Gap 1:** `lib/pipeline.js` line 1107 — `zeroCoverageCats.length >= 2`. A build where exactly ONE non-game-flow category returned 0/0 (page broken, no tests ran) passed this guard because it checked for 2 or more zero-coverage categories. That category contributed nothing to `totalFailed`, keeping `passRate` artificially high → build proceeded to review → could be approved with a broken category.

**Fix:** Changed threshold to `>= 1`. Any single category with 0 tests run now fails the build immediately before review.

**Gap 2:** `lib/pipeline-fix-loop.js` line 967 — `hasCrossFailures` only checked `r.failed > 0`. A batch stuck at 0/0 (page broken) was silently ignored by the global fix loop — no repair attempt was made. The global fix loop would skip it and potentially approve.

**Fix:** Updated to `r.failed > 0 || (r.passed === 0 && r.failed === 0)`. A 0/0 batch now counts as failing for global fix triggering, and `failingCategoryNames` includes it in the fix prompt context.

**DB audit:** No existing approved builds had 0/0 categories — the bug was latent, not yet triggered in production. 6 new unit tests added. 573 total pass.

**How to apply:** Any time a build is approved but a category shows 0/0 in the report, it was approved incorrectly. Post-fix, 0/0 categories halt the build before review (Gap 1) and trigger the global fix loop (Gap 2).
## Lesson 87 — TimerComponent: not in CDN bundle → ReferenceError crash

**Pattern:** Games referencing `TimerComponent` fail smoke-check with `ReferenceError: TimerComponent is not defined`. This crashes `DOMContentLoaded` before `ScreenLayout.inject()` runs, leaving `#gameContent` never created → blank page on every smoke-check.

**Root cause:** `packages/components/index.js` does NOT export `TimerComponent`. The LLM hallucinates it as a valid CDN class because the gen prompt previously contained a rule "TimerComponent MUST be initialized with startTime: 0", which implicitly suggested it was valid. Affected games: light-up, face-memory, visual-memory, truth-tellers-liars.

**Fix:** 
- CDN_CONSTRAINTS_BLOCK rule changed from "startTime: 0" → "NEVER use TimerComponent"
- T1 static validator now raises ERROR (not warning) for `TimerComponent` in HTML
- Use `setInterval`/`setTimeout` for countdown/elapsed timers

**Commit:** 48e9992

## Lesson 88 — ScreenLayout.inject() creates empty #gameContent at runtime despite syntactically correct call

**Pattern:** visual-memory #439 failed smoke-check with `#gameContent` having 0 children even after surgical CDN init fix regen. The HTML had the correct `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })` call with the mandatory `slots:` wrapper. CDN URLs were correct. PART-017=NO was handled correctly. Yet Playwright reported `#gameContent` empty after 8 seconds.

**Root cause (investigated):** Likely a subtle ScreenLayout API timing issue — `inject()` may require all CDN packages to be fully initialized (not just ScreenLayout itself) before the DOM slot is created, OR the `<template id="game-template">` clone into `#gameContent` is failing silently if `#gameContent` does not yet exist immediately after `inject()` returns synchronously. Neither the surgical smoke-regen prompt nor the gen prompt addresses this edge case.

**Key insight:** The surgical smoke-regen prompt (commit 8c645dc, Lesson 83) is tuned for CDN URL errors and wrong init order, but it CANNOT fix runtime ScreenLayout API behavior issues. When the HTML already has the correct syntactic pattern, a second surgical regen produces the same HTML and the same failure.

**Current status:** No fix deployed. When a CDN game fails smoke-check with correct CDN URLs and correct `ScreenLayout.inject()` syntax, the cause is likely this runtime timing issue. A Playwright trace is needed to observe exactly when `#gameContent` appears relative to the DOMContentLoaded sequence.

**Affected games:** visual-memory #439.

## Lesson 89 — colour-coding-tool PART-017=YES: overly broad CDN domain rule causes wrong asset URL domain

**Pattern:** colour-coding-tool #441 was early-review-rejected because audio/sticker asset URLs used `storage.googleapis.com/test-dynamic-assets` instead of the spec-provided `cdn.mathai.ai` paths. The spec (PART-017=YES) included explicit example code with `cdn.mathai.ai/mathai-assets/dev/...` URLs for game audio and sticker GIFs.

**Root cause:** `CDN_CONSTRAINTS_BLOCK` contained the rule "EVERY URL in the file must use storage.googleapis.com/test-dynamic-assets". The LLM applied this rule too broadly, replacing spec-provided `cdn.mathai.ai` asset URLs. The rule was intended for PACKAGE SCRIPT tags only, not for spec-provided media asset URLs.

**Note:** The `fixCdnDomainsInFile()` pipeline fix-pass ONLY fixes script src tags (wrong domain → correct domain), NOT audio/sticker JS string URLs. So even with the post-processing pass running, the wrong asset URLs survived into the early-review stage.

**Fix:** CDN_CONSTRAINTS_BLOCK updated to explicitly scope the domain rule to package script tags, and add an exception for spec-provided asset URLs in PART-017=YES games. Commit: [will update].

**Affected games:** colour-coding-tool #441.

## Lesson 90 — Runtime dependency pre-validation: catch broken CDN URLs before test-gen

**Pattern:** CDN games fetch external URLs at runtime (packages/helpers/index.js, packages/components/index.js, packages/feedback-manager/index.js) via `<script>` tags. If any URL returns 404/non-200, the CDN bundle silently fails to load. This surfaces as a blank page / "Packages failed to load" smoke-check failure. The existing `checkCdnScriptUrls()` in pipeline.js checks static HTML script tags before smoke-regen; but if the smoke-check passes but a game still loads broken URLs at runtime (e.g. during DOM snapshot), those failures were invisible.

**Fix:** `captureGameDomSnapshot()` (pipeline-utils.js) now intercepts `page.on('request', ...)` to capture all external URLs fetched at runtime from storage.googleapis.com, cdn.homeworkapp.ai, cdn.mathai.ai. After the snapshot session, HEAD-checks each unique URL. Failures are:
1. Logged immediately to worker console
2. Saved to `tests/runtime-dependencies.json` for audit  
3. Appended as "BROKEN RUNTIME CDN DEPENDENCIES" section to the DOM snapshot string — the test-gen LLM sees broken URLs in context and can reference them

**Value:** Converts silent CDN load failures (50s beforeEach timeout, cryptic test errors) into explicit URL-level error messages visible to both the worker log and the test-gen/smoke-regen LLMs.

**Commit:** 6830daa

**Affected games:** Any CDN game that loads external packages — will see runtime-dependencies.json created from next build.

## Lesson 91 — Always run tests locally with browser screenshots before diagnosing HTML failures

**Pattern:** count-and-tap #440 failed with "locator('#mathai-transition-slot button').first() not found within 5s" across both game-flow tests (0/2 at iterations 1 and 3). Reading test output alone suggested HTML was wrong — wrong transition slot setup, wrong fallbackContent, TimerComponent issues.

**Diagnosis (wrong, from file reading alone):** Assumed fallbackContent had no round data, TimerComponent caused ReferenceError, test selectors were wrong.

**Diagnosis (correct, from running tests locally with screenshots):** Downloaded HTML from GCP, injected test harness, ran game-flow tests with Playwright locally. Both tests PASSED. The game renders correctly — 4 option buttons visible, lives deduct on wrong answer, game-over triggers at 0 lives. `TimerComponent` IS defined at runtime (`typeof TimerComponent !== 'undefined'` = true).

**Real root cause:** CDN cold-start on GCP server. The smoke-check browser took 2.5 minutes to load CDN (cold VM, first load). The test runner opened a fresh Playwright browser with no CDN cache. The beforeEach 50s timeout expired before CDN loaded → "transition slot button not visible". This was a transient infra issue. The oscillation (0→1→0 across iterations) was the fix loop breaking HTML that was actually correct.

**Additional findings from running tests:**
- `window.nextRound` not exposed on window → silent failures for level-progression tests
- TimerComponent IS in CDN bundle (loads late, after ScreenLayout/FeedbackManager)
- Audio preload 404s (FeedbackManager tries generic audio paths) are non-blocking

**Fix:** Corrected Lesson 87 — changed "NEVER use TimerComponent" to "add typeof TimerComponent to waitForPackages() loop". Changed T1 5f3 from ERROR to WARNING. Re-queued count-and-tap #457 with corrected code.

**Rule:** Before diagnosing any HTML failure, run `node diagnostic.js` locally: download HTML from GCP, inject harness, screenshot every step. Screenshots answer "overlay blocking? wrong phase? CDN slow?" in seconds. Reading test output alone cannot distinguish CDN latency from game logic bugs.

**Commit:** 16c5640

## Lesson 92 — Surgical smoke-regen was dead code: specMeta.isCdnGame never set

**Pattern:** commit 8c645dc (Lesson 83) added `buildSmokeRegenFixPrompt()` — a surgical CDN init fix that shows the LLM failing HTML and fixes ONLY the CDN init block. It was gated on `if (specMeta.isCdnGame)`. But `extractSpecMetadata()` (pipeline-utils.js) never sets `isCdnGame` — the function only sets `totalRounds`, `totalLives`, `interactionType`, `starType`, `starThresholds`. So `specMeta.isCdnGame` was always `undefined`, the `if` was permanently false, and the surgical fix path NEVER executed in any build. Every smoke regen fired the full regen (else branch) instead.

**Discovery method:** Background investigation agent cross-checked `extractSpecMetadata()` return value against the `if (specMeta.isCdnGame)` check. Confirmed by running `node -e "require('./lib/pipeline-utils').extractSpecMetadata(spec)"` — no `isCdnGame` key in result.

**Impact:** The measured 38.5% repeat-failure rate on smoke-regen was 100% full regens, not surgical fixes. The surgical fix prompt (which is the correct approach) had never been tested in production. We've been measuring the wrong intervention.

**Fix:** Replace `if (specMeta.isCdnGame)` with HTML-based CDN detection: `const isCdnGame = failingHtml.includes('storage.googleapis.com/test-dynamic-assets') || failingHtml.includes('cdn.homeworkapp.ai')`. The failing HTML is already read at this point (for `checkCdnScriptUrls`), so no extra I/O. Now the surgical path fires for all CDN games. Commit: c4d24f2

**Evidence:** Confirmed by investigation agent (task a5414227a1a48b84d). Pipeline.js lines 889-916 examined. extractSpecMetadata() at pipeline-utils.js lines 413-476 confirmed no isCdnGame field. Node.js eval confirmed return shape.

## Lesson 93 — window.gameState.content must be pre-populated; game_init is async

**Pattern:** count-and-tap #440 generated correct game HTML. But `captureGameDomSnapshot()` reads `window.gameState?.content` synchronously at snapshot time. The game only sets `content` when it receives a `game_init` postMessage — which the test harness sends asynchronously after page load. At snapshot time, content was null. `extractSpecRounds()` was used as fallback — but it parsed the spec's metadata overview table (Field/Value rows) instead of the actual round data (JSON code block with `dotCount`, `options`, `correctAnswer`). Test gen received `fallbackContent.rounds[0].correctAnswer = undefined`, producing selector `.option-btn[data-value="undefined"]` which never exists. Triage correctly skipped all affected tests. Build FAILED: 0 test evidence across 3 categories.

**Fix:** Gen prompt rule added to CDN_CONSTRAINTS_BLOCK: "window.gameState.content MUST be pre-populated with fallback/default round data at the START of DOMContentLoaded (before await waitForPackages()), then override with real content when game_init arrives." This makes the DOM snapshot tool always read real round data, not null. Commit: c4d24f2

**Evidence:** Confirmed by investigation agent (task a0d098ed34ae74469). gameState shape returned as {} (empty) at snapshot time. game-content.json never written. fallbackContent had wrong shape (question/answer pairs from metadata table, not dotCount/options/correctAnswer from round schema).

**Secondary fix needed:** `extractSpecRounds()` should prefer JSON fenced code blocks over markdown tables when spec round data is in JSON schema format. Markdown table fallback is fragile when spec overview table appears first.

## Lesson 94 — TimerComponent race condition: loads 554ms after ScreenLayout

**Pattern (source: visual-memory #422 + #439, local diagnostic 2026-03-21):** CDN registers components one-by-one. ScreenLayout is ready at +152ms. The game's `waitForPackages()` checked only `typeof ScreenLayout === 'undefined'` and resolved at +152ms. Init sequence ran, reached `new TimerComponent(...)` at +186ms, and crashed with `ReferenceError: TimerComponent is not defined`. TimerComponent only became available at +706ms. This caused a blank transition slot — all tests timed out in `beforeEach`.

**Why it recurred (builds 422 + 439):** Two compounding causes — (1) Gen prompt contradiction: line 85 said "TimerComponent IS in bundle, add typeof check to waitForPackages" while line 185 said "NEVER use TimerComponent — not in CDN bundle." LLM used TimerComponent (correct per PART-006=YES) but skipped the typeof guard (contradicted by line 185). (2) Surgical smoke-regen was dead code — `specMeta.isCdnGame` never set — so both builds got full-regen which reproduced the same bug.

**Fix:** Commit 4899b4e — (1) Line 185 contradiction removed: now says "MUST NOT use unless PART-006=YES; if PART-006=YES, MUST add typeof TimerComponent check to waitForPackages". (2) `buildSmokeRegenFixPrompt()` detects TimerComponent in failing HTML and injects guard instruction. (3) Added `/\binit\s+error\b/i` to SMOKE_FATAL_PATTERNS — "Init error: TimerComponent is not defined" previously silently passed smoke check.

**Evidence:** Console timeline from diagnostic: ScreenLayout at +152ms → crash at +186ms → TimerComponent at +706ms. `#mathai-transition-slot` had 0 children despite `#gameContent` having 2 children (template cloned before crash). Screenshots at `/tmp/visual-memory-debug/`.

**Prevention:** Any PART-006=YES game must check `typeof TimerComponent === 'undefined'` in `waitForPackages()` condition alongside ScreenLayout. T1 validator warns if TimerComponent used without typeof check.

## Lesson 96 — CDN bundle load order: TransitionScreenComponent (step 4), ProgressBarComponent (step 3)

**Pattern (source: face-memory #446, #232, #161, local diagnostic 2026-03-21):** CDN bundle loads components in sequential steps: (2) ScreenLayout → (3) ProgressBarComponent → (4) TransitionScreenComponent → (7) TimerComponent. `waitForPackages()` was only checking `typeof ScreenLayout`. Init ran, hit `new TransitionScreenComponent(...)` at ~186ms, crashed with ReferenceError. Transition slot empty → `beforeEach` timeout → 0/2 game-flow at iterations 1 AND 2. LLM fixers received "transition button never appears" triage — too vague to identify the specific missing typeof check.

**Fix:** (1) Gen prompt CDN load order table added — rule to include typeof check for every CDN component instantiated (ProgressBar step 3, TransitionScreen step 4, Timer step 7). (2) Static validator adds checks 5f3b/5f3c for TransitionScreenComponent and ProgressBarComponent. (3) Smoke-regen prompt detects these components in failing HTML and injects guard instruction. Commit: 274796a.

**Evidence:** Local diagnostic: `window.__initError = 'TransitionScreenComponent is not defined'` in <1s. `#mathai-transition-slot` had 0 children. `gameState.phase = 'start_screen'` but no visible button. Confirmed CDN bundle loads ScreenLayout at step 2 and TransitionScreenComponent at step 4 (step 2+2 gap = race window).

**Prevention:** Add typeof check for EVERY CDN component the game calls `new X()` on. ScreenLayout only is insufficient for any game that uses TransitionScreen, ProgressBar, or Timer.

## Lesson 95 — Audio/media 404s are non-fatal; smoke pattern too aggressive

**Pattern (source: expression-completer #444, 2026-03-21):** `FeedbackManager.sound.preload()` references audio files at `storage.googleapis.com/test-dynamic-assets/audio/*.mp3`. These files don't exist on the CDN. Playwright logs 12× "Failed to load resource: the server responded with a status of 404 ()". SMOKE_FATAL_PATTERNS matched `/failed\s+to\s+load\s+resource(?!.*status of 403)/i` — the 403 exclusion only covered cdn.homeworkapp.ai auth failures. 404s were not excluded. Build failed at Step 1d with 12 "fatal" 404 errors. The game HTML itself was correct.

**Fix:** Extended the negative lookahead to exclude both 403 AND 404: `(?!.*status of 40[34])`. Real CDN package failures always manifest as "Packages failed to load" or "X is not defined" — caught by other patterns. Audio/media 404s are non-blocking for game functionality. Commit: c5bfa4c. expression-completer re-queued as #458.

**Evidence:** error_message field in DB was 12× identical "Failed to load resource: 404" strings. No other errors. CDN package URLs in HTML were correct (storage.googleapis.com/test-dynamic-assets/packages/). Unit test updated: 404 resource error → result.length = 0 (non-fatal).

## Lesson 97 — ScreenLayout.inject() missing slots: wrapper → silent blank page

**Pattern (source: disappearing-numbers #400, local diagnostic 2026-03-21):** LLM generated `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })` without the required `slots:` key. Without `{ slots: { ... } }`, ScreenLayout receives options in the wrong argument shape — it silently ignores them. #gameContent, #mathai-transition-slot, #mathai-progress-slot are never created. `document.getElementById('gameContent').appendChild(...)` throws `TypeError: null.appendChild`, caught as `Init error: {}`, window.__initError set, page blank.

**Fix:** T1 check 5e2 added: warns when ScreenLayout.inject() is present but `slots:` keyword is absent in the call region. Commit: aa3a503. Correct form: `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`.

**Evidence:** diagnostic.js against build #400: `#gameContent: false`, `window.__initError: 'Init error: {}'`, `window.gameState: null`. HTML line 949: `ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })` — confirmed no `slots:` key. Secondary failure in build #442: added slots: wrapper, but TransitionScreenComponent called with `{ containerId: 'mathai-transition-slot' }` instead of correct `{ autoInject: true }` API → `'Container with id [object Object] not found'`.

**Prevention:** T1 check 5e2 warns before Step 1d smoke check. Gen prompt CDN_CONSTRAINTS_BLOCK already shows correct `slots:` form with exact code example. Future builds will also surface this earlier via T1 static validation.

## Lesson 98 — TimerComponent constructor: first arg must be ID string, not object

**Pattern (source: disappearing-numbers #442 base HTML, local diagnostic 2026-03-21):** LLM generated `new TimerComponent({ container: document.getElementById('timer-container'), timerType: 'increase', ... })`. TimerComponent's constructor expects the container element ID as the first positional string argument. Passing an object causes the component to coerce it to `"[object Object]"`, call `document.getElementById("[object Object]")`, get null, and throw `'Container with id "[object Object]" not found'` — crashing DOMContentLoaded before `transitionScreen.show()`. Start screen never appears.

**Fix:** Gen prompt updated with constructor signature: `new TimerComponent('container-id', { timerType: ..., startTime: ..., endTime: ..., autoStart: ..., format: ... })`. T1 check 5f4 warns when `new TimerComponent({` or `new TimerComponent(document.` detected. Commit: 3ce80aa.

**Evidence:** Playwright constructor instrumentation confirmed: `[CTOR] TimerComponent(0:object={...})` → `[CTOR ERROR]: Container with id "[object Object]" not found`. CDN loads completed in <500ms (not a race condition — all packages loaded). POC fix: patching constructor call to string ID eliminated error; `#mathai-transition-slot button` visible, `gameState.phase = 'start_screen'`.

**Prevention:** T1 check 5f4 warns before Step 1d. Gen prompt shows correct signature with named options. Applies to any game using PART-006=YES (TimerComponent).

## Lesson 99 — TimerComponent must be initialized AFTER ScreenLayout.inject() + template clone

**Pattern (source: keep-track #427, #452, local diagnostic 2026-03-21):** Two compounding bugs caused every keep-track build to fail with "Blank page: missing #gameContent":
1. Wrong constructor API (same as Lesson 98): `new TimerComponent({ container: el, ... })` instead of `new TimerComponent('id', { ... })` — crashes before ScreenLayout.inject() runs.
2. Even with correct string ID, `#timer-container` lives inside `<template id="game-template">`. It does NOT exist in the live DOM until after `ScreenLayout.inject()` + `tpl.content.cloneNode(true)`. Calling `new TimerComponent('timer-container', ...)` before the template clone hits `getElementById` returning null → same crash.

**Why T1 WARNING wasn't enough:** T1 check 5f4 was a WARNING. The static-fix LLM call prioritizes hard errors; WARNING was deprioritized and the wrong constructor repeated across 3 builds.

**Fix:** (1) T1 check 5f4 upgraded to ERROR — now forces static-fix LLM to correct it. Error message includes the ordering requirement. (2) `buildSmokeRegenFixPrompt()` extended: when TimerComponent detected, prompt explicitly states string ID requirement AND ordering after template clone. Commit: 7e8688d.

**Evidence:** diagnostic.js patched both fixes → `gameContentExists: true`, `appPhase: "start"`, start screen renders, no init errors. POC verified before E2E. keep-track #465 queued.

**Prevention:** Any PART-006=YES game: TimerComponent constructor MUST use string ID as first arg AND MUST be called after ScreenLayout.inject() + template clone. T1 ERROR enforces both.

## Lesson 100 — Spec PART-006 contradiction: YES triggers TimerComponent but note says setInterval

**Pattern (source: two-player-race #421, #438, local diagnostic 2026-03-21):** Spec PART table had `PART-006 | TimerComponent | YES | ... (manual setInterval, not TimerComponent class)`. The gen prompt rule is "if PART-006=YES, use TimerComponent." LLM followed YES → generated `new TimerComponent({ startTime: 0 })` (wrong constructor API) → crash before ScreenLayout.inject() → blank page. The parenthetical "not TimerComponent class" was ignored.

**Fix:** Changed PART-006 from YES to NO in spec on server. Gen prompt will now generate plain setInterval for countdown. CDN TimerComponent not needed and not safe for this game.

**Secondary bug (two-player-race #438):** LLM hallucinated `audio/success.mp3` and `audio/error.mp3` (generic local paths) instead of spec's actual `cdn.mathai.ai/mathai-assets/dev/.../XXXX.mp3` URLs. FeedbackManager retried each 6× = 12 console 404 errors → smoke check false-positive (same pattern as Lesson 95 but from wrong URLs in generated code, not CDN path). Fix: audio 404 smoke check exclusion already in place (c5bfa4c). Root cause is LLM hallucinating audio IDs — spec's audio preload block has the correct URLs, LLM must copy them exactly.

**Prevention:** Spec PART-006=YES must unambiguously mean "use TimerComponent CDN class." If the intent is plain setInterval, use PART-006=NO. Any PART table YES/NO must agree with the implementation note.

## Lesson 101 — Unawaited transitionScreen.show() corrupts CDN state machine on ALL calls

**Pattern (source: keep-track #465, local diagnostic 2026-03-21):** keep-track was unawaiting the *initial* start-screen call: `transitionScreen.show({ ... })` without `await`. The CDN TransitionScreenComponent is an async state machine. An unawaited first `show()` queues a state transition that hasn't resolved when the second `await show()` (after game data loads) fires. The second call's internal lock sees a pending transition and silently hangs with the button at `visibility: hidden`. The screen "shows" visually in some tests but its button is never clickable. `waitForPhase()` times out on every single test.

**Why the gen prompt exception made it worse:** Gen prompt Rule 25 had an EXCEPTION: "the first show() call to render the start screen may be unawaited." LLM faithfully followed this exception — and generated exactly the broken pattern.

**Fix:** Commit 42830fd. (1) T1 check upgraded WARNING → ERROR with message explaining the CDN state machine corruption and that ALL calls must use await. (2) Gen prompt Rule 25 rewritten: "await is REQUIRED on ALL calls including the initial start-screen call — there are NO exceptions." (3) Review RULE-008 updated from "await is optional on initial call" to "await is REQUIRED on ALL calls." 47/47 validate-static tests pass.

**Evidence:** keep-track #465 — game-flow 0/3 at iteration 1, 2, 3. Local diagnostic: `startScreenVisible: true` but `startButtonVisible: false` and `startButtonComputedVisibility: 'hidden'`. No console errors. Removing `await` from the initial show() replicated exact failure. Adding `await` to initial call → button visibility:visible → tests pass.

**Prevention:** Any CDN game with TransitionScreenComponent: `await transitionScreen.show({ ... })` on EVERY call site, with no exceptions. T1 ERROR enforces this before Step 1d.

## Lesson 102 — Shuffle/animation games: never call answer() before gameState.isActive===true

**Pattern (source: keep-track #465, local diagnostic 2026-03-21):** keep-track has an initial shuffle animation phase before player interaction. During shuffle, `window.gameState.isActive === false`. Test called `answer(page, true)` immediately after `startGame()`, but the game ignores all clicks while `isActive===false` — they are silently swallowed, no state change, transition button never appears, `waitForPhase(page, 'results')` times out after 30s.

**Why hard to diagnose from logs alone:** The test output shows "Timeout: waiting for 'results' phase" — identical to a click-selector mismatch or wrong phase string. Only running the game live with browser reveals the shuffle animation playing while clicks do nothing.

**Fix:** Commit 42830fd. M6 rule added to `buildTestGenCategoryPrompt()`:
```
M6. For games with ANIMATION or REVEAL phases before player interaction (shuffle games, memory-reveal games):
    NEVER call answer() or click an option immediately after startGame(). The game has reveal/shuffle phases
    where gameState.isActive = false — clicks are silently swallowed. ALWAYS wait for isActive=true first:
    await expect.poll(() => page.evaluate(() => window.gameState?.isActive === true), { timeout: 15000 }).toBeTruthy();
```
DOM snapshot gameState shape now also reveals `isActive: boolean` — test-gen LLM can see this directly.

**Evidence:** keep-track DOM snapshot showed `isActive: boolean` in gameState shape. Local diagnostic: clicking start → shuffle animation plays for ~2s → `gameState.isActive` transitions false→true → only then do clicks register.

**Prevention:** Any game spec mentioning "shuffle," "reveal," "animation," "memorize phase," or "study phase" — generated tests must poll for `isActive===true` before interacting. M6 enforced in test-gen prompt.

## Lesson 103 — Shell/shuffle games: read correctCup from gameState dynamically, never hardcode

**Pattern (source: keep-track #465, local diagnostic 2026-03-21):** keep-track tracks correct cup by original position (`data-signal-id`). After shuffle, the cup moves to a different visual position. Test was clicking `[data-signal-id="0"]` (original position) — but after shuffle the correct cup is now at position 2. `window.gameState.correctCup` holds the current correct position index, not the original. Using a hardcoded `data-signal-id` means the test clicks the wrong cup ~67% of the time (2/3 cups are wrong).

**Fix:** Commit 42830fd. M7 rule added to `buildTestGenCategoryPrompt()`:
```
M7. For games where the CORRECT TARGET changes position after shuffling (shell games, card-swap games):
    NEVER use a hardcoded data-signal-id or fixed index to identify the correct element after shuffles.
    ALWAYS read the current correct position from gameState dynamically:
    const correctPos = await page.evaluate(() => window.gameState?.correctCup ?? window.gameState?.correctIndex ?? 0);
    const correctBtn = page.locator(`[data-testid="option-${correctPos}"]`);
```

**Evidence:** keep-track DOM snapshot showed `correctCup: number` in gameState shape. Local diagnostic: shuffle animation reorders cups visually; `gameState.correctCup` updates to reflect new position after each shuffle. Clicking cup at original `data-signal-id` index = wrong cup after shuffle.

**Prevention:** M7 enforced in test-gen prompt. DOM snapshot `gameState` shape now injected into test-gen context — LLM sees `correctCup: number` directly and should use it. Applies to any spec with "shuffle," "swap," "hidden position," or "find the correct X" mechanics.

## Lesson 104 — fixCdnDomainsInFile Fix 2 was replacing valid cdn.mathai.ai audio URLs

**Pattern (source: hide-unhide #426/#449, pipeline investigation 2026-03-21):** `fixCdnDomainsInFile()` has two passes:
- Fix 1: replaces `cdn.mathai.ai/games/...` in `<script src>` tags → correct domain for CDN packages
- Fix 2 (bug): replaced ALL `cdn.mathai.ai` occurrences globally, including audio/media asset URLs like `cdn.mathai.ai/mathai-assets/dev/.../sound.mp3`

`cdn.mathai.ai` is a VALID CDN for audio/media assets (returns HTTP 200). Specs explicitly reference it for `FeedbackManager.init()` audio preloads. Fix 2 converted these valid URLs to `storage.googleapis.com/test-dynamic-assets/mathai-assets/...` — which 404s. The game would then fail Step 1d with 404 resource errors from FeedbackManager preload, triggering the smoke check.

**Root cause of 3 hide-unhide failures:** hide-unhide spec has `FeedbackManager.init()` with `cdn.mathai.ai` audio URLs. Pipeline was destroying them every build.

**Fix:** Commit e81f410. Fix 2 now only replaces `cdn.homeworkapp.ai` (universally wrong — returns 403 due to old auth scheme). Fix 1 already handles `cdn.mathai.ai` in `<script src>` tags specifically and correctly. Non-script `cdn.mathai.ai` references (audio, images, other media) are left untouched. 573 tests pass.

**Evidence:** hide-unhide build #426 error: 12× "Failed to load resource: 404" on `cdn.mathai.ai/mathai-assets/...` URLs. These were valid audio URLs in the spec — pipeline was replacing them. Local inspection of pipeline.js Fix 2 confirmed the global replace. POC: removing Fix 2 from cdn.mathai.ai → audio URLs preserved → smoke check passes.

**Prevention:** Any CDN game with PART-017=YES (FeedbackManager) and audio URLs from `cdn.mathai.ai` — Fix 2 no longer corrupts them. Rule: Fix 2 = `cdn.homeworkapp.ai` only. Fix 1 handles script-tag CDN domains case-by-case.

## Lesson 105 — Sentry.captureConsoleIntegration() also not in CDN bundle — T1 gave wrong fix

**Pattern (source: light-up #428, local diagnostic 2026-03-21):** T1 warning 5f2 said: "use `Sentry.captureConsoleIntegration()` instead of `new Sentry.Integrations.CaptureConsole()`." But `captureConsoleIntegration` is in `@sentry/browser` v7+ — also not in the CDN bundle. When the static-fix LLM followed T1's advice and generated `Sentry.captureConsoleIntegration({...})`, calling it threw `TypeError: Sentry.captureConsoleIntegration is not a function`, aborting `initSentry()` before `ScreenLayout.inject()` ran — blank page, 0/2 game-flow at every iteration.

**Compound effect:** T1 5f2 was a WARNING — LLM received it but prioritized hard errors. The fix for the WARNING introduced a new hard crash. The new crash had no T1 check, so it would silently pass T1 and only fail at Step 1d smoke check or test runtime.

**Fix:** Commit 3d8528c. (1) T1 5f2 message corrected: "OMIT the integrations array entirely — pass `[]` or no argument. Both `Sentry.Integrations.CaptureConsole` AND `Sentry.captureConsoleIntegration` are absent from the CDN bundle." (2) New T1 check: warns when `/Sentry\s*\.\s*captureConsoleIntegration\s*\(/` detected. 47/47 validate-static tests pass.

**Evidence:** light-up #428 — game-flow 0/2. Local diagnostic: `window.__initError: 'Sentry.captureConsoleIntegration is not a function'`. T1 run on failing HTML confirmed only the captureConsoleIntegration WARNING — it passed T1 despite crashing at runtime. POC: changing to `Sentry.init({ dsn: '...' })` (no integrations) → initSentry completes → start screen renders → tests pass.

**Prevention:** Any CDN game with PART-015=YES (Sentry): use bare `Sentry.init({ dsn: '...' })` with no integrations. T1 WARNING catches both CaptureConsole variants before Step 1d. New rule in T1: "If you see a Sentry integration error, fix by removing integrations entirely — not by switching to a different integration API."

## Lesson 106 — T1 typeof-check WARNINGs for CDN components must be ERRORs

**Pattern (source: true-or-false #436, keep-track diagnostic 2026-03-21):** T1 checks for missing `typeof TimerComponent`, `typeof TransitionScreenComponent`, `typeof ProgressBarComponent` in `waitForPackages()` were WARNINGs. WARNINGs are deprioritized by the static-fix LLM (it fixes hard errors first; WARNINGs are often skipped if the HTML otherwise passes). Missing typeof guards cause 100% blank-page failures — CDN component race condition. true-or-false #436 had all three typeof checks missing, passed T1 as WARNINGs, then failed at Step 1d smoke check with blank page.

**Fix:** Commit d2a3324. Upgraded all three to ERRORs with clear error messages explaining: "loads at CDN step N, AFTER ScreenLayout (step 2) → without typeof guard, init runs before X is defined → ReferenceError → blank page." 4 new unit tests added (fail without guard for each component type, pass with guard for Timer). 577/577 tests pass.

**Evidence:** true-or-false #436: T1 showed 3 WARNINGs + 3 hard errors. Static-fix LLM fixed the 3 hard errors but left all 3 WARNINGs unfixed — HTML passed T1 after static fix, then failed Step 1d with blank page. The 3 WARNINGs were exactly the missing typeof checks.

**Prevention:** Any CDN component that loads AFTER ScreenLayout (step 2) must have an ERROR-level T1 check for missing typeof guard. ScreenLayout itself is checked implicitly (it's the reference point). All downstream components (TransitionScreen/step 4, ProgressBar/step 3, Timer/step 7) now trigger ERRORs that force static-fix LLM to add the guards.

## Lesson 107 — CDN cold-start requires 120s beforeEach poll, 180s test timeout

**Pattern (source: keep-track #465, count-and-tap, local diagnostic 2026-03-21):** CDN scripts can take 60-120s to load on server when cache is cold. The beforeEach poll loop was `Date.now() + 50000` (50s). On warm CDN, beforeEach completes in <5s. On cold CDN, the poll expires at 50s and the test fails with `#mathai-transition-slot button is not visible` — the same HTML that passes locally and on warm CDN.

**Double jeopardy for animation games:** keep-track requires CDN load time + 5.6s shuffle animation before the first interactive click. Even if CDN loads in 45s (within 50s), the game may not be interactive by the time the test calls `answer()` because the M6 `waitForFunction(phase==='guess')` hasn't been added to the test yet.

**Fix:** Commit 89149d4. (1) `buildBeforeEach()` deadline: `50000` → `120000` (120s). (2) `buildPlaywrightConfig()` timeout: `90000` → `180000` (180s — must exceed poll + 5s check + animation time). Comment updated. 577/577 tests pass, deployed to server.

**Evidence:** keep-track local diagnostic: CDN loads in <1s locally. On server, Lesson 91 established CDN cold-start = 2.5 min for count-and-tap. keep-track game HTML is correct — browser runs it perfectly locally with `isActive=true`, correct `.correct` class, and 5.6s animation before guess phase.

**Prevention:** Any CDN game with animation phases (shuffle, reveal, memory) needs the increased timeouts — not just keep-track. The fix applies globally to ALL CDN games in the beforeEach template. The tradeoff (slow test suites on infra failures) is acceptable; false failures on correct HTML are not.

## Lesson 108 — Contract test direct gameState mutation causes 0/0 evidence gate failure

**Pattern (source: visual-memory #456, 2026-03-21):** Contract test-gen generated `window.gameState.score = X` (direct property assignment) to trigger game completion instead of playing through the game via `answer()` or `skipToEnd()`. Triage correctly identified this as a test logic bug → `skip_test`. With ALL contract tests skipped, the category had 0 tests run → 0/0 evidence → the `0/0 contract evidence gate` (Step 4) tripped → build failed.

**Root cause:** No rule in triage prompt or test-gen prompt explicitly forbade direct `window.gameState` property assignment. Contract test-gen defaulted to the shortest path (direct mutation) rather than the correct path (UI interaction or harness calls).

**Fix:** Commit 97b1cc0. Two additions:
1. `buildTriagePrompt` KNOWN TEST BUGS: "Test directly assigns to window.gameState properties... bypasses game handlers → harness out of sync → skip_test"
2. `buildTestGenCategoryPrompt` OUTPUT INSTRUCTIONS: "NEVER directly assign to window.gameState properties — always use answer()/skipToEnd() + getLastPostMessage() for contract tests"

**Prevention:** Contract tests must reach game-over state by interacting through the game (click buttons, call `answer()`) or by calling `skipToEnd(page, 'victory')`. Then read the postMessage via `window.__ralph.getLastPostMessage()`. Direct `window.gameState.x = value` is always wrong — the game's internal handlers must process state changes.

**Cost:** visual-memory #456 wasted a full pipeline run (~$0.50). The rules prevent recurrence on any future contract test gen.

## Lesson 109 — Dot/card reveal phase: renderRound() must keep isProcessing=true until options are rendered

**Pattern (source: count-and-tap #457, 2026-03-21 HTML analysis):** Games with a preview/reveal animation before player interaction (dots display, card flip, memory reveal, shuffle) set `gameState.isProcessing = false` in `renderRound()` — but the option buttons aren't rendered yet. The harness `answer()` polls `isProcessing !== true`, finds it false immediately, calls `querySelectorAll('.option-btn')` → empty list (no buttons rendered yet). Click fails silently. Later the 10s timer fires and the game moves on, but the test is completely desync'd — it thinks the answer was registered when it wasn't. Tests report "phase remained 'playing'" because the game never actually received a player answer.

**Root cause in count-and-tap #457:**
```javascript
function renderRound(index) {
  gameState.isProcessing = false;  // Set FALSE immediately — options not rendered yet!
  ...
  setTimeout(() => {
    hideDots(); showCover(); renderOptions(roundData); startRoundTimer();  // Options rendered 1.5s later
  }, 1500);
}
```
`answer()` helper fires when `isProcessing = false`, but buttons exist only after 1500ms.

**Required fix pattern:**
```javascript
function renderRound(index) {
  gameState.isProcessing = true;  // Keep TRUE until options are ready
  gameState.isActive = true;
  gameState.currentRound = index;
  gameState.phase = 'playing';
  syncDOMState();  // Update DOM with playing phase
  // ... show dots ...
  setTimeout(() => {
    hideDots(); showCover(); renderOptions(roundData); startRoundTimer();
    gameState.isProcessing = false;  // NOW options are rendered — harness can click
    syncDOMState();
  }, REVEAL_DURATION_MS);  // e.g. 1500 for count-and-tap
}
```

**Gen prompt rule needed (Lesson 109):** "If the game shows a reveal/preview phase in renderRound() before the player can interact (dots appear, cards flip, memory tiles show), set `gameState.isProcessing = true` at the START of renderRound() and only set it to `false` AFTER the reveal setTimeout fires and option buttons are rendered. The test harness waits for `isProcessing = false` before clicking — if set too early, answer() runs when no buttons exist, click is silently ignored, and the game timer advances without a player answer."

**How to apply:** Any game with a `setTimeout` delay between `renderRound()` and when interaction becomes possible (dots, card reveal, memory tiles, pattern display) needs this pattern. Set `isProcessing = true` at start, clear it inside the reveal timeout.

---

## Lesson 110 — Contract-fix LLM breaks Sentry ordering despite CDN constraints rule

**Source:** Pipeline iteration lesson — keep-track #465 (2026-03-21)

**What happened:** keep-track #465 generated HTML with initSentry() correctly INSIDE waitForPackages() (local diagnostic confirmed correct ordering at line 375). Contract validation found other errors and ran `buildContractFixPrompt`. The contract-fix LLM rewrote the full HTML to fix the contract errors and accidentally moved initSentry() BEFORE waitForPackages(). The T1 validator then caught: "FORBIDDEN: initSentry() called before waitForPackages()". Build failed after 3 iterations. The `CDN_CONSTRAINTS_BLOCK` included in the contract-fix prompt has "SENTRY ORDER: initSentry() MUST be called INSIDE the waitForPackages() callback" — but the LLM ignored it during a full-HTML rewrite focused on fixing contract errors.

**Fix (commit this session):** Added a VERIFY BEFORE RETURNING checklist to `buildContractFixPrompt` that explicitly calls out: "initSentry() (if present) is INSIDE the waitForPackages() callback, NOT called before it". The checklist also covers window.gameState/endGame/restartGame/nextRound exports and CDN script order.

**How to apply:** If a game with PART-030=YES (Sentry) fails with "Contract-fix T1: FORBIDDEN: initSentry() called before waitForPackages()", root cause is the contract-fix LLM, not the gen LLM. The verification checklist should prevent recurrence. If it recurs, consider restricting the contract-fix to targeted patches (not full HTML rewrite).


## Lesson 111 — hasTwoPhases contract tests: skipToEnd('victory') → recall phase, not results

**Source:** Pipeline iteration lesson — associations #462, light-up #463 (2026-03-21)

**What happened:** associations and light-up are hasTwoPhases games (learn + recall phases). The generated contract test used `skipToEnd(page, 'victory')` to reach the end state, expecting to land in 'results' phase for postMessage validation. But for hasTwoPhases games, `endGame('victory')` transitions to the RECALL phase (not 'results') because the recall phase must be completed first. The test failed with `waitForPhase('results')` timeout. Triage correctly identified this as a test logic error and deleted the contract spec. The deleted spec left contract with 0 test evidence → pipeline gate failed: "1 category with 0 test evidence (contract)."

**Fix (commit 4f4164c):** Updated hasTwoPhases feature flag in `buildGameFeaturesBlock()` to explicitly warn: "CRITICAL for contract tests: `skipToEnd(page, 'victory')` transitions to RECALL phase first — use `skipToEnd(page, 'game_over')` to reach gameover directly without going through recall phase."

**How to apply:** Any hasTwoPhases game (associations, light-up, face-memory, rapid-challenge) where contract tests use `skipToEnd(page, 'victory')` → wrong phase → spec deleted → 0 evidence → FAILED. With this fix, the test gen LLM will use `skipToEnd(page, 'game_over')` for contract tests on hasTwoPhases games.

---

## Lesson 112 — Global fix loop incorrectly triggered when triage deletes contract spec

**Source:** Pipeline iteration lesson — associations #462, light-up #463 (2026-03-21)

**What happened:** When triage deletes all spec files in a batch (skip_tests), `batchFailed` was still recorded from the pre-deletion test run (e.g., `failed: 1`). After the per-batch loop, `report.category_results['contract'] = { passed: 0, failed: 1 }` — `failed > 0` triggers the global fix loop. Inside the global fix loop, game-flow and other batches returned 0/0 in ~3 seconds. The global fix loop ran 2 LLM fix iterations on the HTML but couldn't improve scores (because the real problem was the test spec, now deleted). This wasted ~10 minutes of LLM calls and made the final build result look worse than it was.

**Root cause of 0/0 in global fix loop:** The edge-cases LLM fix applied during the per-batch loop broke the page HTML. The cross-batch regression guard treated 0/0 as "inconclusive" (not regression) so the broken HTML was kept. Global fix loop then ran game-flow on broken HTML → all tests fail in beforeEach → stats.skipped > 0, stats.expected = 0, stats.unexpected = 0 → 0/0 detection fires.

**Fix (commit 4f4164c):** Two-part fix in `runFixLoop()`:
1. When triage deletes all spec files in a batch (`!anySpecStillExists`), reset `batchFailed = 0` and add to `deletedSpecBatches` set.
2. Global fix loop trigger condition now excludes `deletedSpecBatches`: `!deletedSpecBatches.has(cat) && (r.failed > 0 || ...)`.

**How to apply:** The global fix loop should now only trigger for categories where spec files still exist and have real failures. Deleted specs (test logic errors) no longer cause cascading global fix loop invocations.

---

## Lesson 113 — Global fix loop 0/0 result treated as inconclusive, not page-broken

**Source:** Pipeline iteration lesson — associations #462, light-up #463, true-or-false #467 (2026-03-21)

**What happened:** When Playwright runs tests in the global fix loop and returns 0/0 (no tests passed, no tests failed), the pipeline was treating it as a failing batch: "page may be broken, trigger LLM HTML fix." This caused unnecessary LLM fix calls when the real issue was not the HTML but the test runner itself (resource exhaustion under parallel builds, Playwright startup failure, or spec parse error). Observed: 5-second exits from Playwright for game-flow batches where no beforeEach hook even started.

**Root cause of 0/0 in global loop:** Parallel builds running multiple Chromium instances on a 2GB server can cause Playwright to fail to start a page or crash immediately in beforeEach, producing 0 expected / 0 unexpected results. The per-batch loop already had a guard for this case (`detectCrossBatchRegression`: if `nowTotal === 0`, skip the regression check). The global fix loop lacked an equivalent guard.

**Fix (commit 2e0f890):** When `gPassed === 0 && gFailed === 0` in the global fix loop iteration, treat as inconclusive: log a warning, skip the LLM HTML fix, and keep the per-batch score for that batch. This mirrors the `detectCrossBatchRegression` behavior on line 313: `if (nowTotal === 0) continue`.

**How to apply:** Global fix loop 0/0 is now never treated as "page broken." If a game consistently shows 0/0 in the global fix loop (not just once), that signals a persistent infra issue (port conflict, OOM) — diagnose infrastructure before assuming the HTML is broken. A single 0/0 occurrence is ignored and the previous score is kept.


---

## Lesson 114 — LLM fix pass drops all CDN <script src> tags → "Packages failed to load within 10s"

**Source:** Local diagnostic lesson — disappearing-numbers #464 (2026-03-21)

**What happened:** disappearing-numbers #464 ran game-flow fix iterations (game-flow-fix1, game-flow-fix2 uploaded to GCP). Diagnostic of `index-fix2.html` found **zero external `<script src>` tags** — no CDN package bundles loaded at all. `waitForPackages()` polled for `ScreenLayout`, `ProgressBarComponent`, `TransitionScreenComponent`, `TimerComponent` for 10 seconds, found none, threw `"Init error: Packages failed to load within 10s"`. Blank white page, `#mathai-transition-slot` never populated, all tests fail in `beforeEach` after 50-second timeout.

**Root cause:** The game-flow fix LLM (fix2 HTML) generated a full HTML rewrite that included all game logic but accidentally omitted all `<script src="...">` tags for the CDN packages. The inline game script was complete and correct — but the packages it depends on were never fetched.

**T1 gap:** validate-static.js had no check for CDN script tag presence. The validator checked `waitForPackages()` timeout/throw behavior but not whether packages were actually being loaded.

**Fix (commit debe44a):** Added T1 check 5c2: when `waitForPackages()` is defined (CDN game), validate that at least one `<script src="https://storage.googleapis.com/...">` tag is present. If missing → T1 ERROR → pipeline triggers static-fix LLM to regenerate. 577 tests pass.

**How to apply:** Any CDN game that fails with "Packages failed to load within 10s" with a blank page — check if CDN script tags are present in the HTML. If not, the LLM dropped them during a fix pass. T1 check 5c2 now catches this before test gen runs.

---

## Lesson 115 — FeedbackManager.sound.playDynamicFeedback does not exist

**Source:** Local diagnostic lesson — count-and-tap #471 (2026-03-21)

**Pattern:** LLM calls `FeedbackManager.sound.playDynamicFeedback()` (wrong namespace). The method lives on `FeedbackManager` (top-level), NOT on `FeedbackManager.sound`. The `.sound` sub-object has: audioKit, sounds, pauseSound, pausedAudioId, pendingPlayQueue, config, unlocked, unlockAttempted — no `playDynamicFeedback`.

**Effect:** Synchronous TypeError thrown inside `showFeedback()` → `handleAnswer()` exits before calling `scheduleNextRound()` → `isProcessing` stuck `true` → round lifecycle deadlocked permanently → level-progression test sees round never advance → fails all 3 fix iterations.

**Fix:** Gen prompt rule added in both CDN_CONSTRAINTS_BLOCK (fix prompts) and the gen prompt FeedbackManager rules section: always call `FeedbackManager.playDynamicFeedback(...)` not `FeedbackManager.sound.playDynamicFeedback(...)`. Also corrected the misleading line 102 which previously listed `FeedbackManager.sound.play()/playDynamicFeedback()` as valid (only `.sound.play()` is valid; `.sound.playDynamicFeedback` is not).

**Proof:** Local Playwright diagnostic confirmed PAGE_ERROR "FeedbackManager.sound.playDynamicFeedback is not a function". POC: patching 2 occurrences → rounds advance correctly.

## Lesson 116 — DOM snapshot CDN cold-start timeout

**Source:** disappearing-numbers #475 (2026-03-21), R&D #53

**Pattern:** `captureGameDomSnapshot()` in `lib/pipeline-utils.js` polls for `#mathai-transition-slot button` visibility with a 65s deadline, then does a **final `waitFor` with only 5000ms timeout**. CDN games open a fresh Playwright browser for the snapshot — CDN packages load cold (30-120s on GCP) even after the smoke check already warmed the CDN in a separate browser instance. When CDN takes exactly 65s+ to load, the poll loop exhausts without finding the button, then the 5s final check fires immediately and throws: "locator('#mathai-transition-slot button').first() to be visible". Pipeline falls back to static HTML analysis, losing `window.gameState` shape capture — test-gen has to guess data structures instead of knowing them.

**Fix:** Detect CDN games by reading `index.html` and checking for `storage.googleapis.com`, `cdn.homeworkapp.ai`, or `cdn.mathai.ai` script tags. For CDN games: increase poll deadline 65s → 120s, increase final `waitFor` timeout 5s → 60s. For non-CDN games: keep 65s + 5s (sufficient for any non-CDN init). Logs `[snapshot] CDN game detected — using extended timeouts (poll=120s, finalWait=60s)`.

**Impact:** Eliminates static-fallback on CDN games when CDN loads in <180s (120s poll + 60s final). Preserves `window.gameState` shape injection into test-gen prompts, producing stronger tests with correct data structures.

**Commit:** ce79a04


---

## Lesson 117 — waitForPackages() 10s timeout is always fatal in CDN test browsers

**Source:** R&D #54, disappearing-numbers #475 (2026-03-21)

**Pattern:** CDN game test build fails game-flow iter 1 AND iter 2 with identical triage `fix_html`: "game fails to initialize and render start screen button inside #mathai-transition-slot." Fix loop applies HTML fix each iteration but the symptom never changes.

**Root cause:** `waitForPackages()` had `const timeout = 10000` (10 seconds). In Playwright test browsers, every test file opens a FRESH browser instance with no HTTP cache. CDN packages (storage.googleapis.com) take 30-120s to load cold on a GCP VM. The game throws "Packages failed to load within 10s" before CDN finishes, `window.__initError` gets set, the transition slot is never populated, and all tests fail in `beforeEach`. The triage LLM correctly classifies this as `fix_html` (the game doesn't render) but has no way to increase a timeout it can't see.

**Evidence:** disappearing-numbers #475 — same error across iter 1 and iter 2; diagnostic shows `waitForPackages()` timeout at 10s in index-fix1.html while CDN cold-start takes 30+ seconds in fresh browser.

**Fix:** Increased `waitForPackages()` timeout from `10000` to `120000` (2 min) everywhere in `lib/prompts.js` — gen prompt template, CDN constraints block, smoke-regen prompt, inline rule at line 91. 120s matches beforeEach CDN poll (Lesson 107) and gives CDN adequate cold-start window.

**Commit:** c32e39f

---

## Lesson 118 — TransitionScreen.show() buttons API: NEVER hasButton/buttonText/onComplete

**Source:** disappearing-numbers #475 (2026-03-21)

**Pattern:** CDN game passes smoke check but ALL game-flow tests timeout in beforeEach — "transition slot button never visible." No `__initError`, game initializes correctly up to the TransitionScreen show call.

**Root cause:** `transitionScreen.show()` was called with `{ hasButton: true, buttonText: 'Start', onComplete: fn }` — properties that don't exist in the TransitionScreenComponent API. The component renders `#transitionButtons` div but leaves it empty (no recognized button config), so no button appears in `#mathai-transition-slot`. Tests poll for transition slot button up to 120s and timeout.

**Correct API:**
```js
await transitionScreen.show({
  icons: ['...'],
  title: '...',
  subtitle: '...',
  buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }]
});
```

**Fix:** Added explicit anti-pattern warning to gen prompt CDN rules and smoke-regen prompt: NEVER use `hasButton`, `buttonText`, or `onComplete` — ALWAYS use `buttons: [{ text, type, action }]`.

**Commit:** 6d8411b

---

## Lesson 119 — T1 check 5e1 self-enforces waitForPackages 120s timeout (R&D #55 validated)

**Source:** disappearing-numbers #479 (2026-03-21)

**Pattern:** Gen prompt has Lesson 117 rule (120s timeout) but LLM still generates `const timeout = 10000`. Without T1 enforcement, this would cause CDN cold-start failures in every test browser. T1 check 5e1 (R&D #55, commit 50b5a4e) catches it automatically.

**Observed:** #479 generated HTML with `const timeout = 10000` at line 394. T1 check 5e1 flagged it as ERROR. static-fix LLM (117s) corrected it to `const timeout = 120000`. Build proceeds with correct timeout.

**Why this matters:** Gen prompt rules alone are insufficient — LLMs drift and ignore them. T1 self-enforcement is the reliable backstop. Same pattern as T1 W3/W4 for data-testid and syncDOMState. This is the "rule-to-validator" pattern: every critical rule in the gen prompt should have a corresponding T1 check.

**Rule-to-validator pattern applied to:**
- Lesson 117 (waitForPackages timeout) → T1 check 5e1 ✅
- TimerComponent wrong API → T1 check 5f4 (WARNING — should be ERROR)
- Missing CDN script tags → T1 check 5c2 ✅
- Missing #gameContent → T1 smoke check ✅

**Action:** Upgrade T1 check 5f4 (TimerComponent wrong constructor) from WARNING → ERROR to also self-enforce Lesson 98.

**Commit:** 50b5a4e (T1 check 5e1)

---

## Lesson 120 — hasTwoPhases flag causes level-progression test gen to wrongly assume #mathai-transition-slot between rounds

**Source:** disappearing-numbers #479 (2026-03-21)
**Pattern:** When `hasTwoPhases: true` is injected into test-gen prompts, the level-progression test generator infers that round transitions within the recall phase use a CDN `#mathai-transition-slot button`. But `hasTwoPhases` only describes the learn→recall phase transition — round transitions within recall are game-specific (may auto-advance, may use game-internal buttons).
**Symptom:** Triage message: "test incorrectly assumes #mathai-transition-slot button will appear between game rounds, but game likely auto-advances." Spec file deleted. Approval gate catches 0 test evidence.
**Fix needed:** For hasTwoPhases games, inject explicit clarification in level-progression test-gen prompt: "hasTwoPhases = learn phase → recall phase transition. Round transitions WITHIN the recall phase are game-specific — do NOT assume #mathai-transition-slot between rounds."
**Fix applied:** `lib/pipeline-test-gen.js` `buildGameFeaturesBlock()` — appended to the `hasTwoPhases` feature flag line: "CRITICAL for level-progression tests: hasTwoPhases describes the learn→recall PHASE transition ONLY — round transitions WITHIN the recall phase are game-specific (game may auto-advance, or use a game-internal button); do NOT assume a #mathai-transition-slot button appears between rounds within the recall phase."
**Commit:** pending

---

## Lesson 106 (revised) — keep-track CDN cold-start: GCP server takes ~150s, poll loop was only 120s

**Source:** keep-track #482 (2026-03-21, build killed)

**Pattern:** Every test in every batch (game-flow, mechanics, contract, edge-cases, level-progression) timed out in beforeEach. Total: 2+ minutes per test × all tests = build failure across all categories.

**Root cause confirmed:** GCP server CDN cold-start takes ~150s. The beforeEach poll loop for `#mathai-transition-slot button` was `Date.now() + 120000` (120s). Since CDN takes 150s to load TimerComponent (the last CDN package, step 7), waitForPackages() throws after 120s, `transitionScreen.show()` never fires, transition slot is never populated → button never visible → poll loop times out → every test fails.

**Key observation:** Each Playwright test gets a fresh BrowserContext (no cache sharing between tests). Every test = cold CDN. With 3-5 tests per batch and 5 batches, this multiplied to catastrophic failure.

**Fix applied (e4e149b):**
- `lib/pipeline-test-gen.js`: CDN poll deadline `120000` → `160000` ms
- `lib/pipeline-utils.js`: Playwright test timeout `180000` → `240000` ms (160s CDN + 75s execution margin)

**Why 160s works:** CDN cold-start measured at ~150s. 160s gives 10s safety margin. Total beforeEach: 165s max. Test timeout 240s leaves 75s for actual test execution.

**Distinguishing feature from Lesson 91 (count-and-tap):** Lesson 91 diagnosed a 50s beforeEach timeout (old code) and concluded "run tests locally before blaming HTML". This lesson confirms the GCP CDN cold-start is ~150s and that the poll loop must be ≥150s + margin.

**Commit:** e4e149b

---

## Lesson 121 — Empty spec after triage skip — wasted fix LLM call

**Source:** Pipeline build observation — position-maximizer #484, keep-track #483 (commit 16f9586)

**Pattern:** When triage returns a `'mixed'` verdict (some tests are bad, some are HTML issues), it skips the bad tests and leaves only the good tests in the spec. If the only test in the spec was the bad one, the spec file becomes empty. Previously, the guard that prevented a pointless fix LLM call only fired for the `'skip_tests'` verdict — not for `'mixed'`. So even with an empty spec, `pipeline-fix-loop.js` still launched a full fix LLM call (~3 minutes wasted). Then iteration 2 returned 0/0 ("page likely broken by last fix") even though the game was fine — the spec simply had no tests left to run.

**Real example:** position-maximizer #484 mechanics batch had 2 tests. Triage (verdict `'mixed'`) skipped "Correct slot selection" because it tested internal `pendingEndProblem` state inaccessible from the outside. The spec became empty. Old code ran `fix-mechanics-1` anyway (266.4s wasted). Iteration 2 and 3 returned 0/0 with no actionable signal.

**Fix:** After the `triageSkipTests` block, added a check: if `triageSkipTests.length > 0` and none of the batch spec files exist on disk (`!batch.some(f => fs.existsSync(f))`), add the batch to `deletedSpecBatches` and `break` out of the fix loop (skip fix). `lib/pipeline-fix-loop.js` lines 822–829. Commit 16f9586.

**How to apply:** If a build shows an unexpected fix LLM call for a category whose only test was triage-skipped, this was the gap. With the fix deployed, the fix loop exits immediately when triage empties the spec — no LLM call, no wasted 3 minutes.

---

## Lesson 122 — Approval gate failed on triage-skipped categories not in triageDeletedCategories

**Source:** Pipeline build failure — keep-track #483 and position-maximizer #484, both FAILED at Step 4 (commit d2b4d23)

**Pattern:** Step 4 approval gate exempts 0/0 categories using the `triageDeletedCategories` set (populated from `deletedSpecBatches` in `runBatchFixLoop`). But `deletedSpecBatches` was only populated via the `triageDecision === 'skip_tests'` path. When triage verdict is `'mixed'` (fix some tests as HTML issues AND skip others), the category is not added to `deletedSpecBatches` even if skipping the bad tests empties the spec entirely. Result: Step 4 sees 0/0 for that category → "0 test evidence" → FAILED.

**Real example:** Both keep-track #483 and position-maximizer #484 had a mechanics batch where triage verdict was `'mixed'`, one bad test was skipped, the spec was deleted, but `triageDeletedCategories` was never updated. Step 4 found 0/0 evidence for mechanics and failed both builds. Both were re-queued as #503 and #504.

**Fix:** In `pipeline.js` Step 4, added a `batchesWithSkippedTests` set populated from `report.skipped_tests[].batch`. The `isTriageSkipped(cat)` helper returns `true` if the category appears in EITHER `triageDeletedCategories` OR `batchesWithSkippedTests`. Categories where all tests were triage-skipped (leaving 0 evidence) are now correctly exempted from the evidence gate. Commit d2b4d23.

**How to apply:** If a future build fails Step 4 with "N category with 0 test evidence" and the build log shows triage skipped tests in that category (verdict `'mixed'`), the category should have been exempted. Verify the commit is deployed. If the issue recurs, check whether `report.skipped_tests` is being populated and whether the batch label matches the category name used in the gate check.

---

## Lesson 123 — 0/0 no-snapshot early-exit in per-category fix loop

**Source:** Pipeline build observation (commit 15f9c70)

**Pattern:** When a category batch has `passed === 0 && failed === 0 && !bestHtmlSnapshot` (no tests ever passed, no snapshot of working HTML captured), the per-category fix loop was allowed to continue for up to 2 additional iterations even though there was no recoverable state. The fix LLM had nothing to improve — no passing test baseline, no snapshot to revert to. These iterations wasted ~6 minutes per affected category with zero probability of recovery.

**Root cause:** The early-exit condition inside `runBatchFixLoop` only checked `passed === 0 && failed === 0` for the "page likely broken by last fix" case (which also restores `bestHtmlSnapshot`). There was no check for the distinct case where `bestHtmlSnapshot` was never set — meaning the category never passed a single test across ALL prior iterations.

**Fix:** Added an explicit early-exit before the fix LLM call: if `passed === 0 && failed === 0 && !bestHtmlSnapshot`, log "category never passed — no recovery path, breaking" and `break` out of the loop immediately. This eliminates all remaining fix iterations for categories that were broken from the start. Commit 15f9c70.

**How to apply:** If a build shows a category running 3 fix iterations with all returning 0/0 and no progress events indicating snapshot capture, this was the gap. With the fix deployed, the fix loop exits on the first 0/0+no-snapshot result — no LLM calls, no wasted time.

---

## Lesson 124 — Test-gen rules M10-M12: runtime selectors, multi-sub-phase, counter tests

**Source:** Commit 26d1cf6 — mechanics test generation rules

**M10 — Runtime-undefined selectors built from gameState at gen-time:**
Test generators sometimes build selectors like `[data-value="${gameState.rounds[0].answer}"]` using gameState values that exist at generation time but are dynamic at runtime. The game resets between rounds; the static value baked into the test string no longer matches the live DOM. Fix: never interpolate gameState property values directly into selectors at gen-time — use `page.evaluate()` to read the current value at runtime, then construct the selector.

**M11 — Multi-sub-phase games: assert phase2 after completing ALL phase1 sub-steps:**
For games with sub-phases within a phase (e.g., a "memorize" → "recall" split inside the playing phase), tests that assert the phase2 state after only partial phase1 completion will time out. The transition only triggers after ALL sub-steps in phase1 are complete. Fix: ensure the test loop completes the full phase1 round count before asserting the phase2 transition.

**M12 — Counter tests must startGame() first to zero counters:**
Tests asserting counter values (score, lives, round number) that read the DOM before calling `startGame()` may see stale counter state from a previous test or from the initial page load. Fix: always call `startGame()` before asserting any counter starting state. Harness `startGame()` resets the game; counter assertions on initial values are only valid immediately after `startGame()` returns.

**How to apply:** When mechanics tests fail with selector timeouts after a game round, check for gen-time interpolated selectors (M10). When phase-transition tests time out, check whether all sub-steps were completed (M11). When counter assertions fail on the first test run, check whether `startGame()` was called first (M12).

---

## Lesson 125 — Test-gen rules GF3-GF5: game-flow timing and selector constraints

**Source:** Commit 6d16090 — game-flow test generation rules

**GF3 — waitForPhase('gameover', 15000) after lives reach 0:**
Game-over transitions after the last life is lost are not instantaneous. The game may play a sound effect, animate a death sequence, or defer the phase change via `setTimeout`. Using the default `waitForPhase` timeout (5s) causes false failures. Fix: always pass an explicit 15000ms timeout to `waitForPhase(page, 'gameover', 15000)` after the last wrong answer.

**GF4 — waitForPhase('results', 20000) after skipToEnd/endGame:**
The results screen transition (triggered by `skipToEnd()` or `window.__ralph.endGame()`) may involve CDN TransitionScreen animation which takes up to 10s. The default 5s timeout will miss this. Fix: use `waitForPhase(page, 'results', 20000)` after any end-game trigger.

**GF5 — Never use #mathai-transition-slot button in game-flow tests:**
Game-flow tests describe what happens DURING gameplay — wrong answers, lives loss, game-over. They must not interact with `#mathai-transition-slot` (the CDN level-transition slot) because that button only appears between levels/rounds in specific game types, not during core gameplay. Using it in game-flow tests causes timeout failures on every game that doesn't show a transition between individual answer rounds.

**How to apply:** If game-flow tests fail with `waitForPhase('gameover') timeout`, add the 15000ms explicit timeout (GF3). If results screen is not reached after `skipToEnd()`, use 20000ms (GF4). If game-flow tests fail with transition-slot timeouts, remove the slot interaction from game-flow tests (GF5).

---

## Lesson 126 — Test-gen rules CT3-CT5: contract test constraints

**Source:** Commit 310c928 — contract test generation rules

**CT3 — Never use #mathai-transition-slot button in contract tests:**
Contract tests assert postMessage payload correctness. They must not interact with the CDN transition slot — the contract test's `endGame()` path should be triggered via `window.__ralph.endGame()` or `skipToEnd()`, not via UI button clicks that may or may not be present depending on game type.

**CT4 — Always waitForPhase('results', 20000) before getLastPostMessage():**
The postMessage payload is sent during the results phase transition. `getLastPostMessage()` reads the last captured message — but if the results phase hasn't arrived yet, the capture may be empty or stale. Always `await waitForPhase(page, 'results', 20000)` before calling `getLastPostMessage()`.

**CT5 — Assert nested payload (msg.data.metrics.score, not msg.score):**
The postMessage payload structure is nested: `{ type: 'GAME_COMPLETE', data: { metrics: { score, stars, lives, ... } } }`. Test generators sometimes flatten this into `msg.score` or `msg.metrics.score` — both wrong. The correct path is always `msg.data.metrics.score` (and similar for other metrics fields). Always verify the full path against the `signalPayload` structure in the spec.

**How to apply:** If contract tests fail because `getLastPostMessage()` returns null, check that `waitForPhase('results', 20000)` precedes the call (CT4). If contract assertions fail with "undefined is not a number", check whether the assertion uses the full nested path `msg.data.metrics.*` (CT5).

---

## Lesson 127 — Test-gen rules EC1-EC3: edge-case test constraints

**Source:** Commit 2d7e78f — edge-case test generation rules

**EC1 — gameover phase assertion needs waitForPhase (async 300-800ms):**
Edge-case tests that trigger game-over (via 0 lives or time expiry) must use `waitForPhase(page, 'gameover', 15000)` — NOT immediate DOM assertions. The game-over transition takes 300-800ms after the trigger event (animation, sound, state update sequence). Asserting `data-phase === 'gameover'` immediately after a click will fail because the transition hasn't completed.

**EC2 — Debounce/isProcessing guard race: await settle before rapid second click:**
Games with `isProcessing` guards or debounce logic reject rapid clicks. Edge-case tests that click two buttons quickly (e.g., to test double-submission prevention) must allow the game to complete processing the first click before firing the second. Minimum: `await page.waitForTimeout(100)` between clicks. Without this, both clicks may be processed (no debounce actually triggered) or both may be blocked (test fails because second click never registers).

**EC3 — Wrong start-button selector resolves to restart button on results screen:**
If an edge-case test uses a generic start-button selector (e.g., `button:has-text("Start")`) after a game-over, the same text may match the restart button on the results screen. The test successfully "starts" what it thinks is a new game, but actually restarts from the results screen — different game state, different DOM, different phase. Always use phase-specific selectors or precede the click with `waitForPhase(page, 'start')`.

**How to apply:** EC1 — add 15000ms timeout to gameover waitForPhase in edge-case tests. EC2 — add a short `waitForTimeout` between rapid-click sequences. EC3 — verify start-button selectors are phase-specific to avoid matching restart buttons.

---

## Lesson 128 — Test-gen rules LP4-LP6: level-progression test constraints

**Source:** Commit c76fde4 — level-progression test generation rules

**LP4 — #mathai-transition-slot button never renders for type='level-transition':**
`TransitionScreen.show()` with `type: 'level-transition'` renders into `#mathai-transition-slot` but does NOT render a button by default. The buttons array must be explicitly provided (e.g., `buttons: [{ text: "Next", type: "primary", action: () => nextLevel() }]`). Tests that poll for `#mathai-transition-slot button` without a configured button will always time out.

**LP5 — Stale getRound()/data-round: syncDOMState 500ms poll, await waitForFunction:**
`getRound(page)` reads `#app[data-round]` which is updated by `syncDOMState()` on a 500ms poll interval. After advancing to the next round, the DOM attribute may still show the previous round number for up to 500ms. Tests that read `getRound()` immediately after a round transition may get a stale value. Fix: use `await page.waitForFunction(() => parseInt(document.querySelector('#app')?.dataset?.round) >= expectedRound, { timeout: 5000 })` instead of polling `getRound()` directly.

**LP6 — Hardcoded spec-derived counts use toBe(N) but implementation uses >=N:**
Level-progression tests that assert exact counts (e.g., `expect(roundCount).toBe(5)`) fail when the game implementation allows more than the spec minimum. Spec language like "at least 3 rounds" or "3+ rounds" means the test should use `toBeGreaterThanOrEqual(3)` not `toBe(3)`. Hardcoded `toBe` assertions from spec-derived counts cause false failures on games that run bonus rounds.

**How to apply:** LP4 — check that `TransitionScreen.show()` includes a `buttons` array when tests expect a transition slot button. LP5 — replace `getRound()` with `waitForFunction` for round-number assertions after transitions. LP6 — prefer `toBeGreaterThanOrEqual(N)` over `toBe(N)` for round/level counts derived from spec language.

---

## Lesson 129 — CDN URL path normalization: unpkg.com/@mathai/* and cdn.homeworkapp.ai/cdn/components/ 404s

**Source:** Commit d06ad43

**Pattern:** LLMs hallucinate two CDN URL patterns that 404 at runtime:
1. `unpkg.com/@mathai/...` — treats the CDN package as an npm package on unpkg, which doesn't host it
2. `cdn.homeworkapp.ai/cdn/components/web/...` — wrong path prefix (`/cdn/components/web/` instead of the canonical storage.googleapis.com path)

Both patterns cause `waitForPackages()` to time out → blank page → all tests fail.

**Fix:** `fixCdnPathsInFile()` extended to detect and remove both patterns. When either is found, the canonical `storage.googleapis.com/test-dynamic-assets` CDN block is injected instead. `checkCdnScriptUrls()` extended to HEAD-check `unpkg.com/@mathai/` URLs (in addition to the existing storage.googleapis.com / cdn.homeworkapp.ai checks) — failures are surfaced as "BROKEN CDN SCRIPT URLS" in the smoke-regen prompt. Commit d06ad43.

**How to apply:** If a smoke-check failure shows `unpkg.com/@mathai/` or `cdn.homeworkapp.ai/cdn/components/web/` in the console error ("Failed to load resource"), this is the pattern. Post-fix, `fixCdnPathsInFile()` catches it after generation and after smoke-regen. If it recurs, verify the post-generation CDN path fix-pass is running.

---

## Lesson 131 — Global fix can unblock multiple categories simultaneously

**Source:** keep-track build #503 (2026-03-22)

**Pattern:** Per-category fix loops for mechanics (0/3) and level-progression (0/1) both maxed out without passing. Global fix 2 (a single 248s LLM call with full-HTML context) fixed mechanics 0/3→3/3 AND level-progression 0/1→1/1 in one shot, even though only mechanics was listed as the failing category. Root: both failures shared the same underlying bug in the HTML (isProcessing never reset in wrong-answer path). The category-scoped fix prompts did not have enough context to identify the shared root cause; the global fix prompt did.

**Lesson:** Do not give up on global fix just because per-category fix loops have maxed out. Global context often finds what category-scoped fixes miss, especially when two failing categories share a root cause. A single global fix call can unblock multiple categories simultaneously.

**How to apply:** After per-category fix loops exhaust their iterations with 0/N scores in 2+ categories, check whether the failing categories share a root cause in the HTML. If yes, run a global fix with full HTML context before declaring the build failed.

---

## Lesson 132 — Review rejection + targeted fix is normal for hard builds; kill criterion is 3/3 rejections with same reason

**Source:** keep-track build #503 (2026-03-22)

**Pattern:** Build #503 had 8/9 tests passing before review. Review rejected attempt 1/3 because a global fix that repaired mechanics/level-progression also regressed one edge-case test. The pipeline applied a targeted fix (158s LLM call) and resubmitted — review approved at attempt 2/3. Total build time ~99 minutes, iterations=3.

**Lesson:** Review rejection on attempt 1 is not a failure signal — it is the review-fix loop working as designed. The targeted fix after rejection is fast (typically 100–200s) and corrects the regression without touching passing categories. Kill criterion for the review loop is 3/3 rejections with the same reason (same test failing, same root cause unresolved).

**How to apply:** When a build enters the review loop, do not kill it on the first rejection. Confirm the targeted fix is being applied and the rejection reason is different each attempt. Only kill if all 3 review attempts reject with identical reasons.

---

## Lesson 130 — BullMQ/DB cancelled-build sync guard: worker pre-flight skips terminal-status jobs

**Source:** Commit 2274342

**Pattern:** When a build was cancelled via the Cancel API (`POST /api/cancel`), the DB record was marked `status='cancelled'` but the corresponding BullMQ job was not removed from Redis. On the next worker restart (e.g., after a code deploy), BullMQ redelivered the cancelled job. The worker picked it up, called `db.startBuild()`, overwrote `status='cancelled'` → `status='running'`, and ran the full pipeline on a job that was explicitly cancelled — wasting a full pipeline run and potentially interfering with a replacement build queued for the same game.

**Root cause (two parts):**
1. Cancel API called `db.failBuild()` (marking SQLite) but did not call `queue.remove(jobId)` to remove the Redis job.
2. Worker pre-flight (Lesson 73, commit b254482) checked for `['failed', 'approved', 'rejected']` terminal states but not `'cancelled'`.

**Fix:**
1. Cancel API now calls `await queue.remove(jobId)` after `db.failBuild()` — removes the BullMQ job from Redis atomically.
2. Worker pre-flight terminal state list extended to include `'cancelled'`: `['failed', 'approved', 'rejected', 'cancelled']`. If a cancelled job resurrects (e.g., via AOF replay), the worker logs a warning and skips it.

**Commit:** 2274342

**How to apply:** After cancelling a build, confirm the job is gone from BullMQ: `redis-cli LLEN bull:ralph-builds:wait` should decrease. If a cancelled build mysteriously restarts after a worker restart, check whether the Cancel API deployed with the `queue.remove()` call included. The worker terminal state guard is a safety net — the primary fix is removing the job from Redis on cancel.

---

## R&D Analysis Lesson 133 — Top remaining failure patterns (builds 480–515, 2026-03-22)

**Source:** DB query of last 50 builds with test_results on production server. Total: 102 failures across 36 approved + 11 failed builds.

**Failure distribution by spec file:**
- game-flow.spec.js: 28 failures (27%)
- mechanics.spec.js: 22 failures (22%)
- edge-cases.spec.js: 19 failures (19%)
- contract.spec.js: 17 failures (17%)
- level-progression.spec.js: 16 failures (16%)

**Error type distribution:**
- value-mismatch (Object.is equality): 30 occurrences — largest single category
- toHaveAttribute wrong phase: 23 occurrences
- element-not-visible: 22 occurrences
- wrong-class: 11 occurrences
- postMessage-null (contract): 8 occurrences

**Key finding: 70 of 102 failures appear in APPROVED builds (residual failures that survived the 70% pass threshold).** The majority of remaining failures are test quality issues (test gen assumptions that do not match game behavior), not HTML game logic bugs. Targeting test gen prompts is higher leverage than targeting HTML gen prompts.

---

### Pattern A — Custom sub-phases not handled: test uses `waitForPhase('playing')` but game phase is `'reveal'` or `'guess'`

**Evidence:** keep-track #503 — 5 failures all showing `Expected: "guess" Received: "reveal"` or `data-phase="reveal"` stuck. Test generator defaulted to `waitForPhase(page, 'playing')` as the intermediate active-game phase, but keep-track's phase sequence is `'start'`→`'reveal'`→`'guess'` — `'playing'` never appears.

**Root cause:** GF test-gen prompt instructs `waitForPhase(page, 'playing')` as the standard active-phase check. The DOM snapshot injects `gameStateShape.phase: string "reveal"` but the test generator ignores it in favor of the default. M6 (Lesson 102) handles `isActive===true` for shuffle games; the intermediate sub-phase path is a separate unaddressed gap.

**Proposed rule GF6:** Add to `buildTestGenCategoryPrompt()` in `lib/prompts.js`:
```
GF6. NEVER default to waitForPhase(page, 'playing') if the DOM snapshot gameStateShape shows a
     different active phase. Check gameStateShape.phase in the WINDOW.GAMESTATE SHAPE section.
     If it shows string "reveal", string "guess", string "memorize", etc., use THAT phase in
     waitForPhase() calls — NOT 'playing'. The 'playing' default only applies when gameStateShape
     explicitly shows phase: string "playing".
```

---

### Pattern B — `waitForPhase('gameover')` timeout: game stays on `'playing'` (5x match-the-cards, one-digit-doubles, disappearing-numbers, count-and-tap)

**Evidence:** `Expected: "gameover" Received: "playing"` with 15000ms timeout. GF3 (Lesson 125) already specifies `waitForPhase('gameover', 15000)`. These are in approved builds (accepted residual failures), indicating CDN cold-start + deferred `endGame()` call (via `setTimeout(..., 400)` after feedback animation).

**Root cause:** 15s is sometimes not enough when `endGame()` is deferred 400ms inside feedback animation AND CDN packages take >10s. The combined latency (`10s CDN + 2s animation + 400ms defer`) can exceed 15s on cold-start runs.

**Proposed amendment to GF3:** Change `waitForPhase(page, 'gameover', 15000)` → `waitForPhase(page, 'gameover', 20000)` in the GF3 rule text in `lib/prompts.js`. 5 extra seconds costs nothing if the game-over fires quickly; prevents false failures on cold-CDN runs.

---

### Pattern C — Contract postMessage null: `getLastPostMessage()` returns null (7x across disappearing-numbers, match-the-cards, keep-track)

**Evidence:** `expect(received).not.toBeNull() — Received: null`. CT4 (Lesson 126) states `waitForPhase('results', 20000)` must precede `getLastPostMessage()`. Yet 7 failures persist across multiple games, suggesting CT4 is not consistently applied in generated tests.

**Root cause:** Two sub-cases: (a) test calls `getLastPostMessage()` before `waitForPhase('results')` resolves — the message was captured but the test read it too early; (b) `endGame()` threw before reaching the `postMessage` call (e.g., `calcStars` crashed) — postMessage never fired.

**Proposed amendment CT4-AMENDED:** Strengthen CT4 in `buildTestGenCategoryPrompt()` lib/prompts.js:
```
CT4 (amended). ALWAYS structure contract tests as:
  1. skipToEnd(page) OR drive the game to completion via answer() calls
  2. await waitForPhase(page, 'results', 20000)  ← REQUIRED, 20s minimum
  3. const msg = await getLastPostMessage(page);
  4. expect(msg).not.toBeNull();  ← if null here, it is an HTML bug in endGame()
  NEVER call getLastPostMessage() before waitForPhase('results') resolves.
```

---

### Pattern D — getLives/getScore race against syncDOMState 500ms poll (30x total; 15x in approved builds)

**Evidence:** `Expected: 2 Received: 3` (lives not decremented yet), `Expected: 1 Received: 0` (round counter not updated yet). Pattern appears across mechanics, edge-cases, level-progression. 15 occurrences in approved builds = persistent test gen quality gap.

**Root cause:** `getLives(page)`, `getScore(page)`, `getRound(page)` all read `#app[data-lives]` / `#app[data-score]` / `#app[data-round]`. These attributes are written by `syncDOMState()` on a 500ms polling interval. A test that reads them immediately after an action (click, answer) may see a stale value — the attribute has not been updated yet in the 500ms window.

**Proposed rule M13:** Add to `buildTestGenCategoryPrompt()` in `lib/prompts.js`:
```
M13. NEVER read getLives(page), getScore(page), or getRound(page) immediately after an action.
     syncDOMState() writes data-* attributes on a 500ms poll. After a click/answer that changes
     these counters, wait for the expected value before asserting:
     await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(expectedLives);
     WRONG: const lives = await getLives(page); expect(lives).toBe(N);  // stale read
     RIGHT: await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(N);
```

---

### Pattern E — Strict-mode violation: duplicate data-testid resolves to 2 elements (1x expression-completer #511)

**Evidence:** `locator('[data-testid="option-1"]') resolved to 2 elements` — one visible in game screen, one hidden in a different screen, both sharing the same testid. Playwright strict mode throws.

**Root cause:** HTML generation reuses `data-testid` values across different screens. This is a gen-level HTML quality issue.

**Proposed rule RULE-DUP:** Add to `buildGenerationPrompt()` ADDITIONAL GENERATION RULES in `lib/prompts.js`:
```
RULE-DUP. data-testid values MUST be globally unique across the entire HTML. Never reuse the same
data-testid in different screens, overlays, or game states. Use screen-qualified IDs where needed:
game-option-1, results-option-1 — NOT both named option-1.
```

---

**Summary table:**

| Pattern | Occurrences | Approved/Failed | Proposed Fix | File |
|---------|-------------|-----------------|--------------|------|
| Custom sub-phase: waitForPhase defaults to 'playing' | 5 recent | approved | Add GF6 rule | prompts.js |
| gameover phase 15s timeout too short | 5 recent | approved | Amend GF3: 15000→20000 | prompts.js |
| Contract postMessage null (CT4 not applied) | 7 total | mixed | Amend CT4 | prompts.js |
| getLives/getScore syncDOMState race | 30 total | 15 approved | Add M13 rule | prompts.js |
| Duplicate data-testid strict-mode | 1 recent | approved | Add RULE-DUP | prompts.js |

All 5 are prompt-level fixes in `lib/prompts.js`. None requires pipeline architecture changes. Combined, these rules target approximately 45% of remaining residual test failures visible in production builds.

---

## Lesson 134 — Post-Lesson-133 gap analysis: GEN-109/M15/GF8/CT7/EC6 (2026-03-22)

**Source:** Pipeline iteration (builds 505-516 DB analysis + failure_patterns table)

**Pattern:** Five failure patterns confirmed in builds 505-516 not covered by Lessons 1-133:
1. **GEN-109**: `isProcessing` flag stays `true` after reveal animation — blocks next input. Affected: count-and-tap, face-memory, keep-track. Fix: explicit labeled rule in gen prompt CDN_CONSTRAINTS_BLOCK (underlying behavior was documented but unlabeled).
2. **M15**: CSS class assertions (`.correct`/`.wrong`/`.disabled`) fail because DOM class updates lag state changes by 1-2 frames inside setTimeouts or requestAnimationFrame. Fix: `expect.poll()` for class checks, or minimum 10s timeout. (Note: M14 already existed for wrong-answer path; CSS class timing is a distinct gap numbered M15.)
3. **GF8**: Screen visibility assertions race against phase transitions — `toBeVisible`/`toBeHidden` on screens fail if called before phase settles. Fix: `waitForPhase` before visibility check.
4. **CT7**: Gen prompt emits `type: 'game_complete'` but CT5/CT6/C2 test-gen examples asserted `msg.type === 'gameOver'` — latent type mismatch bug confirmed by validate-contract.js. Fix: all test-gen prompt examples updated to `'game_complete'` (the authoritative CDN contract value).
5. **EC6**: `page.locator(element)` instead of string — "expected string, got object" error. Fix: explicit rule that locator arg must always be a CSS selector string.

**CT7 Root Cause Detail:** `validate-contract.js` lines 95-127 confirm CDN games use `type: 'game_complete'`. The gen prompt (line 248) correctly says `type: 'game_complete'`. But CT5 (line 1128), CT6 (line 1138), C2 (line 1111), and line 954 all said `expect(msg.type).toBe('gameOver')` — the harness-normalized event name, not the raw postMessage payload type. Fixed in commit 4e6f5f6.

**Rules added:** GEN-109 (gen prompt), M15, GF8, CT7 (bug fix), EC6 in lib/prompts.js (commit 4e6f5f6).

**Strategic note:** 70% of remaining failures in builds 505-516 were in approved builds below the 70% pass threshold — pipeline was approving games despite residual failures. The bottleneck is LLM compliance with existing rules, not missing rules. These 5 cover the genuine gaps; all others are compliance/repetition issues.

## Lesson 136 — Test linter rule validation: 4 of 8 rules were dead; replaced with effective patterns
**Source:** Pipeline iteration lesson (2026-03-22, commit 7cd470a)

**Pattern:** After shipping linter rules, run an effectiveness check against the existing corpus before assuming rules work. Of 8 lint rules shipped in Lesson 135, 4 fired zero times across 664 test files and 145 builds — the regex patterns didn't match actual LLM output.

**Root cause per dead rule:**
- M15: Pattern checked for class names like 'active'/'correct' but LLM used specific game class names; widened to catch the structural pattern (`.toHaveClass(` after `await page.locator`)
- CT7/CT7_GAMEOVER: LLM already uses correct `game_complete` type names — these caught non-existent bugs. Replaced with HARDCODED_TIMEOUT and RAW_CLICK (real problems found in corpus)
- CT6_NULL: Multiline regex `[^}]*?(?!null)` never matches — negative lookahead after character class doesn't work as intended; replaced with simple direct-access pattern

**Fix:** After shipping any lint/static rule, immediately grep the existing corpus to confirm hit rate. Rules with 0 hits in 100+ files should be either fixed or retired.

**Effective rules (by corpus hit rate):** TRANSITION_SLOT 100%, GF8 64%, M13 45%, RULE-DUP 27%, M15/CT6_NULL/HARDCODED_TIMEOUT/RAW_CLICK (new — not yet measured)

## Lesson 135 — endGame() phase order (GEN-110) + T1 post-fix validation (2026-03-22)

**Source:** Pipeline iteration (consistent-failure RCA, docs/rnd-consistent-failures-rca.md, builds 400-515)

**Pattern 1 — gameState.phase stays 'playing' at game-over (11 occurrences, 7 builds, 5 games):**
`endGame()` called postMessage before setting `gameState.phase = 'game_over'`. syncDOMState() 500ms poll ran between the two calls — `data-phase` never updated, `waitForPhase('gameover')` timed out. Gen prompt rule 8 was too vague.
Fix: GEN-110 added to lib/prompts.js — mandates `gameState.phase = 'game_over'; syncDOMState()` as FIRST two lines of endGame(), before postMessage. Includes CORRECT/WRONG code examples.

**Pattern 2 — Fix loop introduces CDN init regression (15 occurrences, 8 builds, 5 games):**
Fix LLM modified CDN initialization (ScreenLayout.inject, waitForPackages) as collateral damage while fixing an unrelated bug. T1 static validation only ran on the initial generated HTML, not after fix iterations. A fix that broke CDN init would produce `#gameContent missing` at next test run — 2 wasted iterations before the build failed.
Fix: `runStaticValidationLocal()` added to lib/pipeline-fix-loop.js — runs T1 after every LLM fix, computes new error checks vs original. If new T1 errors appear, fix is discarded and bestHtmlSnapshot restored immediately. Saves 2 LLM calls per affected build.

**Pattern 3 — `game_complete` → `results` normalization (RCA finding):**
RCA initially said this was missing from syncDOMState. It was already present in lib/pipeline-utils.js line 722 (`.replace('game_complete', 'results')`). Documentation gap only — no code change needed. The actual root cause of results-screen failures in those 6 builds was Pattern 1 (phase not set before postMessage, so phase never reached 'game_complete').

**Rules added:** GEN-110 in lib/prompts.js. T1 post-fix guard in lib/pipeline-fix-loop.js. Commit 5d0cdb7. 629 tests pass.

**Strategic note:** Fix loop only rescued 3 of 9 builds with 3+ iterations. Pattern 1 + Pattern 2 together explain why: broken phase state + CDN regression from fix. Gen prompt is the primary reliability lever; fix loop is a safety net, not a repair tool.

## Lesson 137 — TRANSITION_SLOT root cause: global template actively advertised wrong selector
**Source:** Pipeline iteration lesson (2026-03-22, commit e87d8c9)

**Pattern:** The test-gen prompt's global "Transition slot selectors" section listed `#mathai-transition-slot button` as the canonical correct selector with no caveats — while per-category rules (GF5, LP4, CT3) buried in their own blocks said "never use it here." LLM followed the global positive instruction, ignoring the category-specific negatives. Result: 100% of 11 recent approved builds violated the TRANSITION_SLOT lint rule.

**Root cause:** Contradictory instructions at different priority levels. Global section said USE IT. Category sections said DON'T. Global wins in LLM attention.

**Fix:** (1) Added CRITICAL note to global section — use for clickNextLevel() only, never in assertions; (2) Added explicit GF9 rule to game-flow block with WRONG/RIGHT examples and the linter evidence ("11/11 builds violated this"). Now both global and category-specific instructions are aligned.

**Rule:** When a lint rule fires at 100% rate despite existing prohibitions, look for a contradictory POSITIVE instruction elsewhere in the prompt — not just missing prohibitions. Positive instructions outweigh negative ones in LLM attention.

**Expected outcome:** TRANSITION_SLOT violations drop from 100% → <20% on next builds.

## Lesson 138 — GF8 + M13 root causes: teaching examples were verbatim violations; lint had a bypass
**Source:** Pipeline iteration lesson (2026-03-22, commit 74eab2e)

**M13 pattern:** The "Helper usage" prompt section showed `expect(await getLives(page)).toBe(2)` as the canonical usage example — the exact pattern the M13 lint rule prohibits. LLM treated the positive example as ground truth and generated violations on every test. Fix: replaced all three helper examples with `expect.poll()` wrappers.

**GF8 pattern — two root causes:**
1. The R1/R4 "RIGHT" examples showed `await expect(locator).toBeVisible()` without a preceding `waitForPhase()` call — direct GF8 violations used as teaching examples.
2. The GF8 lint regex `/\.toBeVisible\(\)(?!.*waitForPhase)/` only matched bare `.toBeVisible()` — adding `{ timeout: 10000 }` bypassed the check. LLM was learning this escape from the R6 CDN example. Lint pattern widened to `/\.toBeVisible\(\s*(?:\{[^}]*\}\s*)?\)/`.

**General rule:** When a lint rule fires at >40% rate despite a prohibition, check THREE things: (1) Is there a positive example that teaches the wrong pattern? (2) Is the lint regex narrow enough that adding an argument bypasses it? (3) Is the positive example in a higher-priority section than the prohibition?

**Expected outcome:** M13 violations drop from 45% → <15%; GF8 violations drop from 64% → <25% on next builds.


## Lesson 139 — RULE-DUP root causes: gen prompt taught generic testids; lint threshold too low
**Source:** Pipeline iteration lesson (2026-03-22, commit 17a325a)

**Root cause 1 — gen prompt:** MANDATORY RULE #1 in test-gen prompt listed `data-testid="answer-input"`, `"btn-check"`, `"option-{index}"` as "required minimums." HTML gen LLM stamped these on every game; test-gen LLM saw them in DOM snapshot and used them in all 5 category files → RULE-DUP fired on every build. Fix: added CRITICAL note — NEVER invent testid values, only use values verbatim from DOM snapshot. Invented testids cause both locator-not-found failures AND cross-category duplication.

**Root cause 2 — lint threshold:** RULE-DUP fired when a testid appeared in any 2 categories. `answer-input` in game-flow + mechanics = legitimate (both categories interact with the answer input). Threshold raised to 3+ distinct category files to catch real invented-generic-testid contamination while allowing legitimate 2-category cross-references.

**Expected outcome:** RULE-DUP violations drop from 27% → near-0% false positives; true violations (testids invented by test LLM, not from DOM) now correctly caught at 3+ threshold.

## Lesson 140 — Gen prompt contradiction: GEN-110 CORRECT example taught 'game_over' phase (underscore) vs canonical 'gameover'
**Source:** Pipeline iteration lesson (2026-03-22, commit 0bc9b8d)

**Pattern:** The GEN-110 "CORRECT" endGame() example block showed `gameState.phase = reason === 'victory' ? 'results' : 'game_over'` — the `'game_over'` string (with underscore) being assigned to gameState.phase. But the canonical gameState.phase value for game-over is `'gameover'` (no underscore). Rules in CDN_CONSTRAINTS_BLOCK and Rule 21 correctly said `'gameover'`, but the positive CORRECT example in GEN-110 had higher LLM attention priority and taught the wrong string.

**Confusion source:** `'game_over'` (underscore) is legitimately correct in TWO contexts: (1) as the `reason` argument to `endGame('game_over')`, and (2) as the `outcome` argument to `calcStars('game_over')`. It is wrong only as the `gameState.phase` value. The CORRECT example conflated these — it used `game_over` in the phase assignment, which is the one place it should be `gameover`.

**Fix:** GEN-110 CORRECT/WRONG examples updated to use `'gameover'` (no underscore) for `gameState.phase`. Added explicit clarifying comment: "Note: reason='game_over' (underscore) but gameState.phase='gameover' (no underscore)." Same clarification added to CDN_CONSTRAINTS_BLOCK rule 100.

**Impact:** Any generated game with `gameState.phase = 'game_over'` would have syncDOMState() set `data-phase='game_over'` instead of `data-phase='gameover'` — all `waitForPhase('gameover')` calls would timeout. This was a silent bug in every build using GEN-110.

## Lesson 141 — Fix prompt audit: 5 contradictions — LESSON_PATTERNS taught wrong CDN domain, onComplete impossibility loop
**Source:** Pipeline iteration lesson (2026-03-22, commit 21d1479)

**CRITICAL — LESSON_PATTERNS wrong CDN domain (lib/pipeline-fix-loop.js:207):**
`LESSON_PATTERNS` entry for CDN domain failures said `"CDN domain MUST be cdn.homeworkapp.ai"` — the exact banned domain. When test failures mentioned CDN issues, the fix prompt injected this instruction, actively teaching the fix LLM to swap to another banned domain. Fixed: corrected to `storage.googleapis.com/test-dynamic-assets`.

**HIGH — onComplete impossibility loop:**
`REVIEW_SHARED_GUIDANCE` RULE-008 required `onComplete` callback to be wired, but `CDN_CONSTRAINTS_BLOCK` explicitly banned `onComplete` (it doesn't exist in TransitionScreenComponent API). Review would reject correct games for missing `onComplete`; fix prompt would tell LLM not to use it. Fixed: RULE-008 updated to reference the correct `buttons[].action callback` pattern.

**HIGH — Gen prompt Rule 25 showed onComplete in CORRECT example:**
Rule 25 (TransitionScreen await) had `onComplete` in the RIGHT example — high-priority positive signal overriding the prohibition two paragraphs later. Fixed to use `buttons: [{ text, type, action }]` pattern.

**HIGH — CDN_CONSTRAINTS_BLOCK internal contradiction:**
Line 109: "TransitionScreen ROUTING rule: onComplete MUST set gameState.phase". Line 111: "NEVER use onComplete". Two lines apart, directly contradicting each other. Fixed: line 109 updated to reference `buttons[].action callback`.

**MEDIUM — syncDOMState terminology:**
Multiple places described syncDOMState call-sites as "transitionScreen onComplete" — updated to "buttons[].action callback".

**General rule:** Audit `LESSON_PATTERNS` entries whenever CDN rules change — stale patterns actively inject wrong instructions into fix prompts. Lesson patterns can become the most trusted (and most dangerous) positive instructions.

## Lesson 142 — Per-category test-gen prompt audit: 10 contradictions (2026-03-22)

*Source: pipeline iteration — `lib/prompts.js` per-category audit*

**Context:** Applied the same positive-example-overrides-prohibition methodology from Lessons 136–141 to the per-category test-gen prompt blocks (mechanics, game-flow, contract, edge-cases, rendering rules, level-progression).

**Contradictions found and fixed (commit `ce2e3cd`):**

1. **#4 CRITICAL — beforeAll HARDCODED_TIMEOUT (blast: 100% of builds)**: The mandatory `test.beforeAll()` block stamped into every generated test contained `page.waitForTimeout(3000)`. This triggered the HARDCODED_TIMEOUT lint rule in 100% of generated test files. Fixed: replaced with a 30s polling loop inside `page.evaluate()` that exits as soon as `window.gameState` is defined.

2. **#8 CRITICAL — CT5 wrong `duration_data` path (silent undefined)**: CT5's RIGHT example asserted `msg.data.duration_data` but the gen prompt's postMessage template places `duration_data` inside `metrics`, making the actual path `msg.data.metrics.duration_data`. Every generated contract test's duration assertion was silently returning undefined, degrading contract coverage without any visible failure. Fixed: corrected path in both description text and RIGHT example.

3. **#1/#2 HIGH — M1/M5 RIGHT examples teach M13 violation**: M1 RIGHT showed `expect(await getLives(page)).toBe(...)` immediately after `answer()`. M5 RIGHT showed `const score = await getScore(page); expect(score).toBeGreaterThan(0)` after an answer loop. Both read DOM state without `expect.poll()`, racing the 500ms syncDOMState cycle — exactly what M13 bans. Fixed: both wrapped in `expect.poll(..., { timeout: 5000 })`.

4. **#3 HIGH — GF7 RIGHT reads getLives before first syncDOMState cycle**: `const lives = await getLives(page)` immediately after `startGame()` — syncDOMState needs one 500ms cycle after game_init before `data-lives` is set. If the read happens before that cycle, `getLives()` returns 0 and the "exhaust lives" loop is a no-op. Fixed: added `await expect.poll(() => getLives(page), { timeout: 5000 }).toBeGreaterThan(0)` before the read.

5. **#6 MEDIUM — R2 RIGHT shows banned `#mathai-transition-slot button` selector**: The R2 rendering rule's RIGHT example showed `expect(page.locator('#mathai-transition-slot button').first()).toBeVisible()` as the canonical post-level-completion check — directly contradicting GF9/GF5/LP4/CT3/TRANSITION_SLOT bans on that selector. Fixed: replaced with `waitForPhase('transition', 10000)`.

6. **#5 MEDIUM — CT4/CT6 teach `page.waitForTimeout(200)` for postMessage wait**: The "copy this exactly" CT4 mandatory block and the CT6 standalone example both used `page.waitForTimeout(200)` to wait for CDN async postMessage dispatch. Fixed: replaced with `expect.poll()` on `getLastPostMessage()` with 200ms intervals.

7. **#9 LOW — M15 offers banned toHaveClass as valid OR alternative**: M15 presented both `expect.poll(() => btn.getAttribute('class'))` AND `expect(btn).toHaveClass(/correct/, { timeout: 10000 })` as equally valid. The second form is exactly what the M15 lint rule bans. Fixed: removed the `OR` alternative entirely.

8. **#7 LOW — EC2 RIGHT hardcodes score assertion**: `expect(score).toBe(1)` violates M1's "never hardcode expected values." Fixed: `toBe(scoreBefore + 1)`.

9. **#10 LOW — CT6 null-guard uses silent `return` (false-pass)**: `if (msg === null) { console.warn(...); return; }` causes contract tests to pass silently when postMessage is never received. Fixed: `test.skip(true, '...')` makes the skip visible in test output.

**Pattern:** Positive examples propagate to 100% of generated tests for that category. Prohibition rules are advisory. This is why violation rates persist even after adding ban rules — the RIGHT examples are teaching the banned pattern.

**Next:** Measure violation rates on builds #518–521 (currently running) and the subsequent batch to verify HARDCODED_TIMEOUT and M13 rates drop. The beforeAll fix alone should eliminate HARDCODED_TIMEOUT from 100% of builds.

## Lesson 143 — Fix loop gets stuck on CDN cold-start timing failures (source: build #525 static analysis)

**Pattern:** Contract test reports "start button never appears" across 3+ fix iterations. HTML is architecturally correct (ScreenLayout.inject, transitionScreen.show, waitForPackages all present). LLM fix applies cosmetic changes (CSS stripping) because it cannot identify a logic bug — there is none.

**Root cause:** `waitForPackages()` timeout (120s) < GCP CDN cold-start latency (~150s). Contract test runs in a fresh Playwright page (CDN cold). waitForPackages times out before CDN loads → transitionScreen.show() never executes → #mathai-transition-slot never populated → start button never appears.

**Fix:** Increase waitForPackages timeout to ≥180s in gen prompt. Add as GEN rule for all CDN games.

**Diagnostic signal:** If fix loop sees identical "start button never appears" / "first UI element never appears" error across 2+ iterations AND static HTML analysis shows correct init structure, the root cause is CDN timing, not HTML. Stop fix loop iterations — they're useless. Mark for CDN-timing fix (prompt rule) instead.

**Related:** Lesson 91 (count-and-tap CDN cold-start, 2.5min CDN delay exceeding 50s beforeEach timeout).

**Proposed pipeline improvement:** Detect CDN timing failures early — if contract/game-flow first iteration fails with timeout-on-first-UI-element AND HTML has correct waitForPackages structure, skip remaining per-category iterations and go directly to global fix with CDN-timing hint. Saves 2-4 LLM fix calls per affected build.

## Lesson 144 — TimerComponent headless pattern: use null slot ID, not 'headless-timer' (source: build #527 static analysis)

**Pattern:** Game uses `new TimerComponent('headless-timer', {...})` for a background timer. The slot ID 'headless-timer' doesn't exist in the DOM (ScreenLayout only creates 'mathai-progress-bar-slot' and 'mathai-transition-slot'). The constructor throws "Container with id headless-timer not found", propagating through the action() callback, preventing TransitionScreenComponent from completing its teardown. The `#mathai-transition-slot` button stays visible. All game-flow tests fail at the post-click assertion.

**Fix:** Use `new TimerComponent(null, {...})` for headless timers. The `null` slot ID is the correct pattern when the timer has no visible DOM container. Added as WRONG/RIGHT example in gen prompt CDN_CONSTRAINTS_BLOCK.

**Signal:** If game-flow fails with "transition button remains visible after click" AND the game has a TimerComponent with a custom slot ID, check if that slot ID exists in the ScreenLayout slots configuration.

## Lesson 145 — E8 script-only fix can strip CDN <script src> tags (source: build #527 static analysis)

**Pattern:** E8 "script-only" fix extracts the game's `<script>` sections, sends them to the LLM for repair, then merges the fixed script back into the original HTML. The LLM sometimes responds with a script that omits the CDN `<script src>` load tags (packages/helpers/index.js, packages/components/index.js, packages/feedback-manager/index.js). The E8 merge then produces HTML with no CDN scripts loaded. `waitForPackages()` spins for 180s then throws. All tests fail with blank page.

**Fix:** Added T1 error check: if `waitForPackages()` is present (function definition OR call site) but no CDN `<script src>` tags found → CDN_SCRIPTS_MISSING error. T1 post-fix validation (Lesson 135) then discards this HTML before it reaches the test runner.

**Signal:** All tests fail simultaneously in a batch after an E8 fix was applied → suspect E8 stripped CDN scripts. Check GCP index-fixN.html for presence of CDN script tags.

## Lesson 146 — 100+ lint violations per build are partly FALSE POSITIVES from test boilerplate (source: builds #525-528 violation rate R&D)

**Source:** R&D — Post-Lesson-142 violation rate measurement, builds #525 (sequence-builder), #526 (rapid-challenge), #528 (visual-memory), #529 (word-pairs). 2026-03-22.

**Measurement:** All 4 approved builds had ~100-108 lint violations at Step 2c. Breakdown per build:
- HARDCODED_TIMEOUT: 40 violations
- TRANSITION_SLOT: 40 violations
- GF8 (toBeVisible without waitForPhase): 25 violations
- Total: ~105 violations per build

**Root cause — false positives from template (30-40 violations per build):**

The `startGame()` helper in the CDN test boilerplate template (`pipeline-test-gen.js` lines 270-290) legitimately uses `#mathai-transition-slot button` and `page.waitForTimeout(400/500)` to navigate CDN screens. The linter's TRANSITION_SLOT and HARDCODED_TIMEOUT rules flag these as violations in EVERY spec file because the linter has no function-context awareness — it fires on any match regardless of where it appears.

`clickNextLevel()` helper similarly has 1 TRANSITION_SLOT + 1 HARDCODED_TIMEOUT. With 5 spec files per build, the template alone contributes ~30 TRANSITION_SLOT + ~10 HARDCODED_TIMEOUT = ~40 false positive violations per build.

**Root cause — LLM-generated violations (~65 per build):**
- HARDCODED_TIMEOUT (30 LLM-generated): LLM defaults to `await page.waitForTimeout(300-500)` when it needs to wait for any state change, especially in contract.spec.js and edge-cases.spec.js
- TRANSITION_SLOT (10 LLM-generated): LLM sometimes copies the startGame/clickNextLevel pattern into test-case-level code
- GF8 (25): `toBeVisible()` assertions without prior `waitForPhase()`

**Lesson 142 fix impact:** The `beforeAll waitForTimeout` fix eliminated ~5 violations per spec file. But LLM-generated in-test violations remained unchanged.

**Build impact:** All 4 builds APPROVED despite 100+ violations. Violations are warn-only and do not block builds. The `builds_approved_with_violations: true` pattern suggests violations correlate with fragile test code (higher retry rate) rather than outright failures.

**Fix plan (in priority order):**
1. **Linter function-context exemption (highest leverage, eliminates ~40 false positives/build):** Track whether linter is inside a `startGame()` or `clickNextLevel()` function body. Suppress TRANSITION_SLOT and HARDCODED_TIMEOUT there — these are pre-approved uses. Implementation: track `insideHelper = true` when current line starts a function with those names.
2. **LLM HARDCODED_TIMEOUT (30 violations/build):** Per-category prompts need a stronger negative example: "NEVER `page.waitForTimeout(N)` in test cases — use `expect.poll()` with a timeout parameter instead." Current rules say this but positive examples don't consistently model it.
3. **GF8 (25 violations/build):** Add `waitForPhase()` requirement before ANY `toBeVisible()` assertion as a mandatory rule, not just advisory.

**Key insight:** The linter is firing on its own generated boilerplate, making violation metrics noisy. Fix the linter first before using violation count as a quality signal.

## Lesson 147 — T1 validator false-positive on window.components?.X causes blank-page cascade

**Source:** Static analysis of right-triangle-area builds #527 and #530. 2026-03-22.

**Root cause:** T1 static validator (`lib/validate-static.js` lines 378–392) checked for CDN component guards via bare-global pattern `/typeof TimerComponent/.test(html)`. CDN games correctly use `typeof window.components?.TimerComponent === 'undefined'` (optional chaining under `window.components`). The bare-global check did NOT match the namespace form, causing the validator to fire a false-positive error.

**Cascade of failures this caused:**
1. T1 fires false-positive → "TimerComponent used but not in waitForPackages"
2. Static-fix LLM reads error → adds bare global check `typeof TimerComponent === 'undefined'`
3. Bare global check is ALWAYS true (`TimerComponent` is undefined as a bare global in CDN games using `window.components`)
4. `waitForPackages()` loop spins for 120 seconds → throws timeout → `#gameContent` never created → blank page → smoke check fails
5. Smoke-regen also fails for same reason → build fails permanently at Step 1d

**Games affected:** right-triangle-area builds #527 and #530 — both failed at Step 1d smoke check despite valid HTML generation.

**Fix (commit 65aed12):** Updated all 3 component checks (TimerComponent, TransitionScreenComponent, ProgressBarComponent) in `lib/validate-static.js` to accept EITHER bare-global OR `window.components?.X` form:
```js
// Accepts EITHER:
typeof TimerComponent === 'undefined'                    // bare global (older pattern)
typeof window.components?.TimerComponent === 'undefined' // window.components (CDN namespace pattern)
```
Updated error messages to show both Option A and Option B so static-fix LLMs produce the correct output when a true positive is detected. Added 3 new test cases. Tests: 644 → 647 passing.

**How the RCA agent detected this:**
1. Read the final smoke-regen HTML and noticed `typeof ProgressBarComponent === 'undefined'` (bare global) placed next to `window.components?.ProgressBarComponent` usage (namespace form)
2. The two forms are contradictory — if components live under `window.components`, bare global checks never resolve
3. Traced back to the T1 error message telling the static-fix LLM to add the bare global form

**What to do from now on:** Whenever T1 validator fires a false-positive on a CDN game that correctly uses `window.components?.X`, the static-fix LLM introduces WORSE code, not better. The root issue is that T1 checks must be aware of both CDN usage patterns (bare globals vs. `window.components`). Always accept both forms when writing T1 validator component guard checks. If a CDN game fails the smoke check with "blank page" and the generated HTML had correct `window.components?.X` guards, check whether T1 fired on those guards and triggered a bad static fix.

## Lesson 148 — Worked-example game-flow start mechanic: transition slot stays visible after startGame() (source: soh-cah-toa build #531)

**Source:** Build #531 pipeline logs and per-batch test results. 2026-03-22.

**Game type:** New `worked-example-mcq` game using PART-036 WorkedExampleComponent — first game of this type in Ralph.

**What happened:** Per-batch test loops passed 6/7 categories: mechanics 3/3, level-progression 1/1, edge-cases 2/2. But game-flow went 0/5 with a pre-triage `toBeVisible` pattern detected on the `#mathai-transition-slot button` — the transition button remained visible after `startGame()`. The global fix loop (Step 3c) then attempted a cross-category fix; this fix regressed ALL previously passing batches to 0 in the Step 3b final re-test. Final score: 0/11 total. Build FAILED after 1 iteration.

**Root cause (game-flow):** Worked-example games have sub-phases within each round (example phase → faded phase → practice phase). The `startGame()` flow may not correctly dismiss the transition slot when sub-phases are involved — the transition slot button may remain for a sub-phase boundary rather than being dismissed by the game-flow test's `startGame()` helper. This is a novel interaction pattern not seen in simpler single-phase games.

**Root cause (global fix regression):** The global fix loop's "best HTML" (from mid-batch with 7 passing) was not actually the cleanest HTML — it was a partial mid-iteration state. When Step 3b re-tested it cleanly, ALL categories failed. The global fix loop's intermediate pass counts did not match the final deterministic re-test.

**What this means:**
- The spec quality for soh-cah-toa is good — 6/7 categories passed before the global fix touched anything
- The game mostly works; the gap is transition slot handling for worked-example sub-phase flows
- The global fix loop can actively WORSEN an otherwise-passing build when the "best" intermediate HTML is not actually stable

**Next steps:**
1. Queue a second build with learnings injected — learnings should include the transition slot behavior for sub-phase games
2. Add spec-level guidance on worked-example sub-phase transitions: `startGame()` must advance past ALL sub-phase transitions before the game-flow test proceeds
3. Consider suppressing the global fix loop for games where per-batch pass rate is ≥80% — the risk of regression outweighs the benefit
4. Investigate whether the Step 3b re-test failure (all 0) is a regression introduced by the global fix or a pre-existing issue in the "best" HTML

## Lesson 149 — signalCollector.trackEvent hallucination causes Step 1d smoke-check init failure (source: right-triangle-area builds #527, #530, #532)

**Source:** Build #532 Step 1d smoke-check log. Also present in #527, #530. 2026-03-22.

**What happened:** After the T1 validator false-positive was fixed (Lesson 147, commit 65aed12), build #532 made it past Step 1b to Step 1d — but then failed with a new error: `Init error: signalCollector.trackEvent is not a function`. This is a separate, independent bug from the T1 issue.

**Root cause:** The LLM generates code that calls `signalCollector.trackEvent(event)` — a generic event-tracking API that does NOT exist on the `signalCollector` CDN object (PART-011). The correct PART-011 API uses `.seal()`, `.getPayload()`, `.signalCorrect()`, `.signalWrong()` (or similar lifecycle methods). The LLM hallucinates a generic `.trackEvent()` method because it resembles common analytics/telemetry libraries.

**Why it's deterministic:** The same hallucination appeared across 3 consecutive builds (#527, #530, #532). Without an explicit prohibition in the gen prompt or a T1 check, the LLM will generate `.trackEvent()` every time for games that use signalCollector.

**Three-layer fix needed:**
1. **`classifySmokeErrors()` in `lib/pipeline.js`** — Add `signalCollector.trackEvent is not a function` as a fatal pattern with label `SIGNAL_COLLECTOR_TRACKEVENT_HALLUCINATION`. This allows smoke-regen to target the correct bug rather than treating it as a generic blank-page failure.
2. **Gen prompt `CDN_CONSTRAINTS_BLOCK`** — Add explicit prohibition: "`signalCollector` does NOT have a `.trackEvent()` method — never call it. Use the PART-011 lifecycle API: `.signalCorrect()`, `.signalWrong()`, `.seal()`, `.getPayload()`.'"
3. **T1 static validator (`lib/validate-static.js`)** — Add a check: if HTML contains `signalCollector.trackEvent`, emit ERROR. This catches the hallucination at Step 1b before any test runs.

**Priority:** High — affects every game using PART-011 signalCollector. All three builds of right-triangle-area failed at smoke check due to cascading issues that included this hallucination. Once T1 catches it, smoke-regen can fix it in Step 1d with a targeted prompt.

**What to do immediately before re-queuing right-triangle-area:** Implement the T1 check and gen prompt prohibition. Without these, build #533+ will fail at Step 1d for the same reason.

## Lesson 150 — startGame() must be synchronous: setTimeout(0) breaks CDN TransitionScreen auto-dismiss

**Source:** Pipeline build failure analysis (build #531, soh-cah-toa-worked-example). 2026-03-22.

**Symptom:** ALL game-flow tests (5/5) and most mechanics tests (3/3) fail at iteration 1 with `#mathai-transition-slot button` still visible after `startGame()` is called. The transition slot never dismisses, so every test that begins with the `startGame()` helper immediately fails the assertion that the slot is not visible.

**Root cause (detailed):** The LLM wraps the entire body of `startGame()` in `setTimeout(() => { ... }, 0)` as a defensive "safety" measure — it believes deferring execution to the next event loop tick avoids blocking the browser. However, the CDN `TransitionScreen` component auto-dismisses `#mathai-transition-slot` ONLY when the action callback (e.g. `action: () => startGame()`) returns a truthy synchronous value or completes synchronously. When `startGame()` wraps its body in `setTimeout`, the callback returns `undefined` immediately — the CDN interprets this as "nothing happened" and keeps the transition slot rendered. The slot button remains visible indefinitely. This is not a spec authoring error — it is a gen prompt failure: the LLM adds `setTimeout` thinking it is good practice, unaware of the CDN synchrony constraint.

**Cascade:**
1. LLM generates `startGame() { setTimeout(() => { /* all init code */ }, 0); }`
2. CDN `TransitionScreen` action callback returns `undefined` (synchronously) → slot stays rendered
3. `#mathai-transition-slot button` remains visible after `startGame()` call
4. Every game-flow test asserts slot is not visible → fails immediately (5/5 game-flow tests)
5. Mechanics tests that also call `startGame()` as setup → fail for same reason (3/3 mechanics)
6. Only categories that do not call `startGame()` (level-progression, edge-cases, contract) survive
7. Global fix loop fires → rewrites HTML → regresses all previously passing categories to 0 → build fails with 0/11

**Fix:**
- **Gen prompt (RULE-SYNC-1):** Added explicit rule: "`startGame()` MUST be synchronous. NEVER wrap its body or any part of it in `setTimeout`, `Promise`, or any async construct. The CDN `TransitionScreen` requires the action callback to complete synchronously to auto-dismiss the slot."
- **T1 static validator (`lib/validate-static.js`):** Added check — scan HTML for `setTimeout(` appearing inside the `startGame()` function body. If found, emit ERROR: `RULE-SYNC-1 violation: startGame() body wrapped in setTimeout — CDN TransitionScreen will not dismiss`.

**Prevention rule (RULE-SYNC-1):** `startGame()` must execute its full init logic synchronously. Any `setTimeout`, `setInterval`, `Promise`, or `async/await` wrapping the top-level function body is a T1 error. Games affected: any CDN game with `TransitionScreen` where the LLM added `setTimeout` in `startGame()`. Detection is reliable at T1 — fire before test generation so smoke-regen can fix it immediately.

**Measurement plan — build #535 (soh-cah-toa-worked-example):**

Build #535 is the first build with both RULE-SYNC-1 gen prompt rule and §5i T1 check active. It directly measures whether the fix eliminates the game-flow 0/5 failure from build #531.

| Metric | Build #531 (baseline) | Build #535 (target) |
|--------|-----------------------|---------------------|
| T1 RULE-SYNC-1 error at Step 1b | not checked | must be ABSENT (LLM obeyed gen rule) |
| game-flow iteration 1 pass rate | 0/5 (0%) | ≥3/5 (≥60%) |
| mechanics iteration 1 pass rate | 0/3 (0%) | ≥2/3 (≥67%) |
| Global fix loop triggered | yes (caused regression) | no (if game-flow passes) |
| Final build outcome | FAILED (0/11) | target: APPROVED |

**CONFIRMED if:** T1 RULE-SYNC-1 check is silent (no error emitted at Step 1b) AND game-flow ≥3/5 on first attempt.

**HYPOTHESIS WRONG — gen prompt insufficient if:** T1 RULE-SYNC-1 error fires at Step 1b (LLM still generated `setTimeout` despite explicit gen rule) → need stronger enforcement (static-fix must patch it before smoke check; smoke-regen prompt must include RULE-SYNC-1 fix instruction).

**HYPOTHESIS WRONG — different root cause if:** T1 is silent AND game-flow still 0/5 → the `setTimeout` was not the only failure mode; need fresh local diagnostic.js run against build #535 HTML to identify the new root cause.

**Secondary measurement — global fix loop regression guard:** If game-flow does pass (≥3/5), confirm the global fix loop does NOT fire (Step 3c should be skipped or fire with ≥80% categories already passing). If global fix fires and regresses categories, next R&D task is global fix loop suppression at high pass rate (planned in ROADMAP.md).

**Source:** R&D analysis 2026-03-22.

---

**Lesson 151 — T1 false positive: endGame/restartGame as arrow functions**
Source: pipeline iteration (build #534 right-triangle-area, 2026-03-22)
Pattern: T1 validator used `/function\s+endGame\s*\(/` — correctly requires endGame() to exist, but regex doesn't match `const endGame = async (reason) => {` (arrow function expression). Game still assigned `window.endGame = endGame` correctly. False positive caused build to fail T1, triggering fix loop and ultimately a blank-page regen.
Fix: Pattern updated to `/(?:function\s+endGame\s*\(|(?:const|let|var)\s+endGame\s*=)/` — accepts both function declarations and const/let/var arrow functions. Same fix applied to restartGame. Deployed in commit db38ede.
Prevention: When adding T1 patterns for function existence, always include both declaration (`function foo(`) and expression (`const foo =`) forms.

---

**Lesson 152 — T1 false positive: initSentry() matched inside HTML comment**
Source: pipeline iteration (build #535 soh-cah-toa-worked-example, 2026-03-22)
Pattern: T1 checks that `initSentry()` is called AFTER `waitForPackages()` by comparing string positions. But when LLM adds `<!-- STEP 2: initSentry() function definition -->` as a comment in `<head>`, the comment text at position ~9545 is textually before `waitForPackages` at ~46082. T1 fired on the comment, not the actual call. Actual call order was correct (initSentry after waitForPackages).
Fix: Strip HTML comments before position check: `html.replace(/<!--[\s\S]*?-->/g, '')`. Deployed in commit db38ede.
Prevention: Always strip comments before running string-position-based order checks in T1 validator.

---

**Lesson 153 — LLM uses transitionScreen.show() for results instead of showResults()**
Source: pipeline iteration (build #535 soh-cah-toa-worked-example, 2026-03-22)
Pattern: When the spec defines a custom `#results-screen` element and a `showResults()` function, the LLM sometimes implements `endGame()` by calling `transitionScreen.show({title:'Game Over',...})` instead. The CDN `TransitionScreen` is intended for phase transitions (start→game), not for displaying the final results DOM. All end-of-game Playwright tests that assert on `#results-screen`, `#stars-display`, etc. fail because the element is never made visible.
Fix: Added RULE-RESULTS-1 to gen prompt (Rule 28 in prompts.js): "showResults() MUST populate #results-screen directly via getElementById. Do NOT use transitionScreen.show() for results." Deployed in commit db38ede.
Prevention: Whenever a spec defines both `#results-screen` and `showResults()`, the gen prompt rule enforces direct DOM manipulation.

---

**Lesson 154 — RULE-SYNC-1 confirmed: startGame() synchronous in build #535**
Source: pipeline iteration (build #535 soh-cah-toa-worked-example, 2026-03-22)
Pattern: Build #531 failed because startGame() wrapped all logic in setTimeout(() => {...}, 0), preventing CDN TransitionScreen from dismissing the slot. RULE-SYNC-1 (ban setTimeout in startGame, T1 §5i + gen prompt Rule 27) was added in commit 7548048.
Result: Build #535 generated startGame() WITHOUT setTimeout — T1 §5i was silent (no violation). The build was rejected for a different reason (transitionScreen.show() in results, Lesson 153), NOT for RULE-SYNC-1. Hypothesis confirmed: T1 §5i + gen prompt rule successfully prevents the setTimeout pattern.
Lesson: RULE-SYNC-1 is working. When a T1 rule + gen prompt combination silences the violation in the very next build, that's confirmation the intervention is effective.

---

**Lesson 155 — SentryHelper is NOT a CDN global — causes silent waitForPackages() hang**
Source: Build #536/#537 RCA (2026-03-22)
- `window.SentryHelper` is not exported by any CDN bundle. The CDN sentry script exports `window.SentryConfig` (not SentryHelper). The CDN helpers bundle exports SignalCollector, VisibilityTracker — not SentryHelper.
- When LLMs include `typeof SentryHelper === 'undefined'` in `waitForPackages()`, the loop polls forever (SentryHelper is always undefined → the while-condition is always true).
- This causes Step 1d smoke check to fail with "Blank page: missing #gameContent element" — no JS error is logged because the try/catch is never reached (still inside waitForPackages poll loop).
- Fix: T1 §5h2 now bans `typeof SentryHelper` pattern; prompts.js corrected to remove SentryHelper from valid globals list and RULE-SENTRY-ORDER now explicitly bans it.
- Commit: 88b965d

---

**Lesson 156 — Silent waitForPackages() hang: no console error, no initError, just blank page**
Source: Build #536/#537 RCA (2026-03-22)
- When waitForPackages() hangs (any non-existent package in the while-condition), the smoke check times out after 8s and detects "Blank page: missing #gameContent element" with NO classifySmokeErrors() fatal patterns matched (no "Initialization Error", no "packages failed to load", no "is not defined").
- This is because the try/catch never executes — the await waitForPackages() call never resolves, so ScreenLayout.inject() and all subsequent code including the catch block are never reached.
- Diagnosis pattern: "Blank page" with no other classified error in server logs = waitForPackages() hanging. Check: does waitForPackages() include any non-existent globals? (SentryHelper, window.mira, any hallucinated class name)

---

**Lesson 157 — initSentry() is NOT a CDN function — must be defined by game code**
Source: Build #538 RCA (right-triangle-area, 2026-03-22)
- `initSentry()` is not provided by any CDN bundle. It is a game-defined function that wraps `SentryConfig.init()`. When PART-030 (Sentry) is included in the spec, the game code MUST define `function initSentry()` before calling it.
- Root cause: gen prompt said "initSentry() checks typeof SentryConfig internally" — implying it's a pre-existing function. The LLM followed RULE-SENTRY-ORDER (call initSentry() after waitForPackages), but since the spec code sections didn't provide a function body and the LLM thought it was CDN-provided, it called it without defining it → `ReferenceError: initSentry is not defined` at runtime → catch block → ScreenLayout.inject() never runs → blank page.
- Fix: (1) T1 §5f0 added: if initSentry() is called but function not defined → ERROR; (2) gen prompt RULE-SENTRY-ORDER now includes canonical function body template and explicitly says "initSentry() IS NOT A CDN FUNCTION"; (3) CDN INIT ORDER comment now says "ONLY if PART-030=YES — MUST define it yourself"
- Canonical implementation (include when PART-030=YES):
  ```js
  function initSentry() {
    try { if (typeof SentryConfig !== 'undefined') { SentryConfig.init(); } }
    catch(e) { console.error(JSON.stringify({error: e.message})); }
  }
  ```
- Commit: 13b7d7b

---

## Lesson 158: Canvas API does not resolve CSS variables (build #540 right-triangle-area)
**Source:** Pipeline iteration
**Pattern:** `ctx.createLinearGradient(...) → addColorStop(offset, 'var(--color-sky)')` → DOMException: "The value provided ('var(--color-sky)') could not be parsed as a color."
**Root cause:** Canvas2D API is a low-level graphics interface that bypasses the CSS cascade. It does not resolve CSS custom properties — only literal color strings work: `'#87CEEB'`, `'rgba(135,206,235,1)'`, `'skyblue'`.
**Fix:** In ALL Canvas gradient/fillStyle/strokeStyle calls, use literal color values. Never pass `var(--anything)` to Canvas API. If the spec defines colors via CSS variables, resolve them to hex/rgba at the point of canvas usage.
**T1 check:** §5f6 — detect `addColorStop\s*\(\s*[\d.]+\s*,\s*['"]var(` pattern and flag as error.
**Status:** T1 §5f6 + gen prompt rule shipped in commit cd04177. Build #541 queued.

---

## Lesson 159: ProgressBarComponent does not expose a .timer property (build #541 right-triangle-area)
**Source:** Pipeline iteration
**Pattern:** `progressBar = new ProgressBarComponent(...); timer = progressBar.timer; timer.start()` → TypeError: Cannot read properties of undefined (reading 'start')
**Root cause:** ProgressBarComponent tracks lives/hearts and round progress ONLY. It does NOT expose a `.timer` property — the LLM hallucinated this API. `progressBar.timer` is always `undefined`.
**Fix:** Always create TimerComponent separately: `const timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: N, endTime: 0, onEnd: handleTimeout }); timer.start();`
**T1 check:** §5f7 — detect `progressBar.timer` pattern and flag as ERROR.
**Status:** T1 §5f7 + gen prompt rule shipped in commit dd844f4. Build #542 queued.

---

## Lesson 160: TimerComponent slot must exist in ScreenLayout before construction (build #542 right-triangle-area)
**Source:** Pipeline iteration (build #542, 2026-03-22)
**Pattern:** `new TimerComponent('timer-container', {...})` → runtime error / blank page because the slot `'timer-container'` is never declared in the `ScreenLayout.inject()` call's `slots:` object — `#timer-container` is never injected into the DOM, so the TimerComponent constructor finds no target element.
**Root cause:** ScreenLayout.inject() creates the game DOM structure from a `slots:` map. Any slot name passed to a CDN component constructor (TimerComponent, ProgressBarComponent, TransitionScreenComponent) must appear in the `slots:` object BEFORE that constructor is called. If the slot name is absent from ScreenLayout.inject(), the element never exists, and the component initialization silently fails or throws.
**Fix:** Every CDN component slot must be explicitly declared in ScreenLayout.inject(): `ScreenLayout.inject(document.getElementById('gameContent'), { slots: { timer: 'timer-container', progressBar: 'progress-bar', ... } })`. The slot key/value in ScreenLayout must match the slot ID passed to the component constructor.
**T1 check:** §5f8 — detect TimerComponent/ProgressBarComponent constructor calls and verify that the slot ID argument appears in a `slots:` block in the same HTML. Flag as ERROR if the slot is not declared in ScreenLayout.inject().
**Status:** T1 §5f8 + gen prompt rule shipped in commits 8657a6d + ad4a15a. Build #543 queued. 762 tests pass.

---

## Lesson 161 — progressBar.timer undefined (Layer 5, right-triangle-area build #541)
**Source:** Build log + CDN source analysis
**Pattern:** Generated code did `timer = progressBar.timer; timer.start()`. ProgressBarComponent does NOT expose a `.timer` property → `progressBar.timer` is always `undefined` → `TypeError: Cannot read properties of undefined (reading 'start')` → DOMContentLoaded crash → blank page.
**Fix:** T1 §5f7 rejects the `progressBar.timer` pattern as ERROR. Gen prompt rule added: "ProgressBarComponent DOES NOT EXPOSE a .timer PROPERTY — always create TimerComponent separately via `new TimerComponent(...)`.". Commit dd844f4.
**Note:** This is a pure JS error (not CDN timing). The smoke-regen fix path targets CDN init sequence and could not fix this — gen prompt rule prevention is the only effective lever.

---

## Lesson 162 — TimerComponent 'mathai-timer-slot' not created by ScreenLayout (Layer 6, right-triangle-area build #542)
**Source:** Build log
**Pattern:** Generated code used `ScreenLayout.inject('app', { slots: { progressBar: true } })` and then `new TimerComponent('mathai-timer-slot', ...)`. The `mathai-timer-slot` div is only created by ScreenLayout when `timer: true` is included in the slots config. Without `timer: true`, `document.getElementById('mathai-timer-slot')` returns null → TimerComponent constructor throws `'Container with id "mathai-timer-slot" not found'` → DOMContentLoaded crash → blank page.
**Fix:** T1 §5f8 rejects `new TimerComponent('mathai-timer-slot', ...)` when `timer: true` is absent from the ScreenLayout slots call. Gen prompt rule: "If using TimerComponent with 'mathai-timer-slot', ScreenLayout slots MUST include `timer: true`." Smoke-regen BUG 5 catches residual cases. Commits 8657a6d + ad4a15a.
**Note:** Defense in depth — gen prompt prevents generation, T1 §5f8 catches if gen rule is ignored, smoke-regen BUG 5 repairs residual.

---

## Lesson 163 — progressBar.init() is not a function (Layer 7, right-triangle-area build #543)
**Source:** Build log (smoke check error at Step 1d)
**Pattern:** The early-review-fix step introduced `progressBar.init()` — calling a method that does not exist on ProgressBarComponent. ProgressBarComponent API is EXACTLY: constructor(slotId, config) + `.update(currentRound, totalRounds)` + `.destroy()`. There is NO `.init()`, `.start()`, `.reset()`, `.setLives()`, or any other method.
**Error:** `TypeError: progressBar.init is not a function` → caught by DOMContentLoaded catch → blank page.
**Fix:** T1 §5f9 (catches `progressBar.init(` pattern) + gen prompt rule (explicitly lists all 3 allowed methods) + smoke-regen BUG 6. Smoke-regen fixed it without BUG 6 in build #543 (general CDN init fix prompt handled it). Deploy: commit ede9df4, 764 tests.
**Milestone:** Smoke check PASSED for first time in 13 right-triangle-area builds. Build #543 entered test generation (Step 2a) at 10:27 — first time this game has reached tests.

----

## Lesson 164 — right-triangle-area APPROVED on build #543 after 13 consecutive failures (2026-03-22)
- Source: Build log
- Timeline: 7 CDN init error layers peeled across builds #534-#543. Each build revealed one new root cause. All 7 fixed with T1 checks + gen prompt rules + smoke-regen BUG patterns.
- Result: Build #543 APPROVED: 2 iterations, 1373 seconds (~23 min), 5/5 test batches passed (game-flow 3/3, mechanics 3/3 at iter 2, level-progression 1/1, edge-cases all pass, contract 1/1).

---

## Lesson 165 — soh-cah-toa-worked-example APPROVED (build #544): First Education Slot build (2026-03-22)
- Source: Pipeline log 2026-03-22
- Facts: APPROVED after 3 iterations, 1505 seconds (~25 min).
- Score: 4/5 batches passing — mechanics 4/4, level-progression 1/1, edge-cases 3/3, game-flow 2/4 (best kept), contract 0/2 at all 3 fix iterations.
- Pattern: contract tests failed 0/2 all 3 iterations (postMessage timing issue) but the review model approved the build because the review-fix loop had already resolved the waitForPackages hang and faded MCQ interaction issues. The game was functionally correct; only the test's timing assumption was violated.
- The pipeline's ≥80% suppression rule correctly prevented the global fix from regressing the other passing batches while contract iterated.
- Significance: validates PART-036 WorkedExampleComponent in CDN as a viable generation target. Establishes the worked-example spec template (sub-phases: example → faded → practice, MCQ scaffolding, skip-to-phase harness) as a proven pedagogical pattern for future algebra/geometry topics.

---

## Lesson 167 — §5fa: waitForPackages truthy-check anti-pattern (2026-03-22)
- Source: soh-cah-toa-worked-example build #544 review rejection + fix
- Pattern: LLMs sometimes generate `while (!FeedbackManager)` or `while (!window.FeedbackManager)` instead of `while (typeof FeedbackManager === 'undefined')`. The truthy check is unreliable — CDN packages are class constructors, not plain objects, and `!FeedbackManager` may evaluate unexpectedly.
- Root cause for soh-cah-toa review rejection: the truthy check caused a hang when waitForPackages resolved prematurely, preventing the game from initializing.
- Fix: T1 §5fa added — rejects `while (!X)` or `while (!window.X)` pattern for any known CDN package. Gen prompt rule added in PART-003 waitForPackages section. Both commits: f38bc2a + 2304570.
- Evidence: review-fix-1 corrected the pattern, game was approved on same build after fix.

---

## Lesson 168 — quadratic-formula-worked-example spec created (2026-03-22): Education Slot build #2
- Source: Education Slot work 2026-03-22
- Pattern: PART-036 algebra worked example (quadratic formula) — extends the soh-cah-toa-worked-example pedagogical pattern to algebra.
- Design: 3 rounds, each with 3 sub-phases (example → faded → practice). Round 1: x²−5x+6=0 (a=1), Round 2: 2x²+3x−2=0 (a≠1), Round 3: x²−4x+4=0 (double root Δ=0). Targets specific student misconceptions: sign traps when rewriting ax²+bx+c=0, forgetting ±√ in the ±branch, denominator errors (2a not 2).
- Spec: 1,841 lines, stored at specs/quadratic-formula-worked-example.md and warehouse/templates/quadratic-formula-worked-example/spec.md.
- Build #545 queued to verify PART-036 pattern holds for algebra (algebra-specific CDN interactions may differ from soh-cah-toa trig game).

---

## Lesson 169 — quadratic-formula-worked-example build #545 FAILED: CDN cold-start timing regression (2026-03-22)
- Source: Pipeline log 2026-03-22
- Pattern: Same HTML produced 10/12 passing in fix loop but only 5/12 in final retest. game-flow: 3/4 → 0/4 on same HTML. level-progression: 1/1 → 0/1 on same HTML. This is not an HTML bug — it's CDN cold-start timing (same pattern as count-and-tap Lesson 91, 2.5 min CDN cold-start exceeding beforeEach timeout).
- Fix loop results (per-category): game-flow 3/4 (3 tests passed confirming game logic works), mechanics 5/5 (100% — algebra MCQ logic correct), level-progression 1/1 (100%), edge-cases 1/2, contract 0/2 (both deleted by triage — wrong field names: game sends `livesRemaining` instead of `rounds_completed`, `time` instead of `duration_ms`).
- Root cause of CDN timing: Between fix-loop test runs and final retest, the CDN server went cold. The CDN packages (WorkedExampleComponent, FeedbackManager, ScreenLayout) take 2-3 minutes to warm up after first load. The final retest runs on a server that hasn't served CDN assets recently, causing timeouts in the 50s beforeEach period.
- Take: algebra worked-example (PART-036) game logic IS correct — mechanics and level-progression pass 100% in warm conditions. The failure is server-side CDN cold-start, not HTML logic. The build should be re-queued after running diagnostic.js locally to confirm the CDN timing hypothesis.
- Secondary issue: postMessage structure mismatch (contract 0/2 deleted). Game sends `{type: 'game_complete', data: {metrics: {livesRemaining, score, time, stars}}}` but spec requires `{metrics: {rounds_completed, wrong_in_practice, duration_ms, stars, accuracy}}`. This needs a separate fix in the gen prompt to enforce the correct postMessage schema for worked-example games.

---

## Lesson 166 — Contract test 0/2 persistent across 3 iterations but build still approved (2026-03-22)
- Source: Pipeline log 2026-03-22, build #544
- Pattern: contract tests can fail across all 3 fix iterations and the build still gets approved at final review if the reviewer determines the game logic is functionally correct.
- Root cause for contract 0/2: the review-fix loop changed game logic (waitForPackages + faded MCQ rendering) in ways that affected endGame/postMessage timing relative to the test's polling window. The game sends the correct postMessage — the test polls too early.
- Take: persistent contract test failures (0/2 for all iterations) are a signal that the generated test may be asserting a timing assumption that does not hold, not necessarily that the game is broken. Review model correctly disambiguates these cases.
- Pipeline behavior: the ≥80% suppression rule held — the global fix was blocked from regressing the other 3 passing batches (mechanics 4/4, level-progression 1/1, edge-cases 3/3), and the build reached final review with those batches intact.
- Lesson: CDN game failures almost always have multiple sequential layers. A systematic layer-by-layer approach (diagnose → T1 + prompt + smoke-regen → next build) is more reliable than trying to fix everything at once. The T1 validator's defense-in-depth strategy worked: §5h2 SentryHelper, §5f0 initSentry, §5f5 TimerComponent null, §5f6 Canvas CSS vars, §5f7 progressBar.timer, §5f8 timer slot, §5f9 progressBar.init — 7 checks preventing 7 blank-page crash patterns.

## Lesson 170 — contract test gen can produce invalid test logic (2026-03-22, build #546)
- Source: Pipeline log 2026-03-22, build #546 (quadratic-formula-worked-example)
- Pattern: Contract test gen produced `await expect.poll(...)` usage that returns undefined, causing TypeError when test tries to access `msg.type`. The tests used `await expect.poll(...)` inline as if it returned a value, but `expect.poll()` returns a Playwright expectation object, not the polled value. Accessing `.type` on the undefined result threw a TypeError and the test was never able to assert anything.
- Triage: correctly identified this as a test logic error (not an HTML bug) and deleted the 2 contract specs. Pipeline continued to review with 0 contract tests. Build still reached APPROVED at review attempt 2.
- Impact: contract score was 0/2 (all deleted by triage), but the game logic was correct — the postMessage field fix from prompts.js (9eff5e6) had already addressed the schema for new builds. The deletion masked whether the field fix helped in this specific build.
- Fix needed: contract test gen must be updated with a rule: "never use `await expect.poll(...)` inline to capture a value — assign to const first: `const msg = await page.evaluate(...)`, then assert on `msg`." Add this as a validation rule in the CT (contract test) gen prompt.
- Secondary finding: review-fix-1 successfully fixed both MCQ shuffle (correct answer was always first) and trackEvent firing at wrong points in 160s — review model correctly identified both issues and the fix loop resolved them in one pass.
- Take: when contract tests are deleted by triage on 0/2 evidence, always check if the deletion was for test logic errors (not HTML bugs). If so, the gen prompt needs a new rule. The game can still be approved without contract tests if review passes.

## Lesson 171 — MCQ games must set gameState.correctAnswer each round (GEN-111) (2026-03-22, build #546)
- Source: Pipeline log 2026-03-22, build #546 (quadratic-formula-worked-example) + review rejection analysis
- Pattern: MCQ games that shuffle answer options caused review rejection "correct answer not always first button". Root cause: test harness `answer()` uses `window.gameState.correctAnswer` for value-based lookup first; if not set, falls back to index 0. When options are shuffled, index 0 is wrong ~75% of the time → harness clicks wrong button → game-flow tests fail + review model sees incorrect interaction.
- Fix: GEN-111 rule added to gen prompt — MCQ games MUST assign `gameState.correctAnswer = <correct-value>` in the `loadRound()` (or equivalent) function each time a new round loads, BEFORE rendering the shuffled options. The value must be the actual answer string, matching exactly one of the shuffled option values.
- Secondary fix: REVIEW_SHARED_GUIDANCE updated — MCQ option shuffling is correct expected behavior. Review model must NOT reject a game solely because the correct answer is not always in the first button position.
- Mechanism: review-fix-1 (build #546) fixed both the shuffle (MCQ options now shuffled correctly) and a trackEvent firing issue in one pass. Build approved on review attempt 2.
- Evidence: build #546 failed review attempt 1 with "correct answer not always first button" — review-fix-1 added correctAnswer tracking + fixed shuffle, review attempt 2 approved.
- Take: any MCQ game that shuffles options without exposing `gameState.correctAnswer` will fail the harness. The GEN-111 rule is a prerequisite for any shuffle-enabled MCQ game.

## Lesson 172 — ProgressBarComponent wrong API causes 100% test failure (GEN-112) (2026-03-22, build #547)
- Source: Direct HTML inspection 2026-03-22, build #547 (find-triangle-side)
- Pattern: Same class of bug as Lesson 144 (TimerComponent wrong slot ID). LLM generated `new ProgressBarComponent('mathai-progress-bar-slot', { totalRounds, totalLives })` — wrong API. The correct API is `new ProgressBarComponent({ autoInject: true, totalRounds: N, totalLives: N, slotId: 'mathai-progress-slot' })`. Wrong positional arg causes component to fail silently. `renderRound()` then calls `progressBar.update(currentRound, totalRounds, lives)` — 3 args, no null guard — which throws. Error propagates through the `action: () => startGame()` callback in `transitionScreen.show()`, preventing TransitionScreenComponent from calling `hide()`. The "Let's go!" button never dismisses → ALL tests fail at the first `expect.not.toBeVisible()` assertion.
- Evidence: Build #547 mechanics.spec.js beforeEach looped for 8s clicking the button, final assertion still `Received: visible`. HTML line 191: `new ProgressBarComponent('mathai-progress-bar-slot', {...})`. HTML line 321: `progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives)` — 3 args, no null guard. Correct API from expression-completer build #511: `new ProgressBarComponent({ autoInject: true, slotId: 'mathai-progress-slot', ... })` and `if (progressBar) progressBar.update(currentRound, lives)`.
- Fix: GEN-112 rule added to CDN_CONSTRAINTS_BLOCK in prompts.js: WRONG/RIGHT examples for constructor API and update() call. T1 static checks added to validate-static.js: `PART-023-API` (rejects positional string arg) + `PART-023-UPDATE` (rejects 3-arg update call).
- Take: any CDN component init error in a try/catch that leaves the component null will cause silent failure at the NEXT call site. The pattern `if (component) component.method(...)` null guard is MANDATORY for all CDN components. T1 checks are the only reliable backstop since the error doesn't surface until `renderRound()` tries to use the component.

## Lesson 173 — T1 PART-023-API + static-fix is reliable defense-in-depth (2026-03-22, build #549)

**Source:** Pipeline iteration (build #549 find-triangle-side)

**Observation:** GEN-112 prompt rule (ProgressBarComponent options-object API) was in the gen prompt but LLM still generated wrong API on first pass. T1 §5f11 (PART-023-API check) correctly fired → static-fix LLM correctly patched to options-object form → pipeline continued to test gen → game tested and approved.

**Lesson:** T1 checks + static-fix LLM form a reliable defense-in-depth for CDN API mismatches. Even if the gen prompt rule is violated (as GEN-112 was in build #549), the T1 check catches it and the static-fix LLM reliably corrects it. This pattern (T1 check + static-fix) is more reliable than relying on gen prompt compliance alone for complex CDN API rules.

**Evidence:** Build #549 logs show `static-validation-failed` → `static-fix` → `static-validation-passed` sequence. Final HTML (line 508): `new ProgressBarComponent({ slotId: 'mathai-progress-bar-slot', ... })` — correct options-object form.

**Action:** Continue adding T1 checks for all CDN API misuse patterns. Each T1 check + static-fix is more reliable than prompt compliance alone.

## Lesson 174 — `window.loadRound` missing → `__ralph.jumpToRound()` silent no-op → mechanics 0/6 (GEN-114) (2026-03-22, build #550 name-the-sides)

**Source:** HTML analysis of `/tmp/name-the-sides-550/index.html`

**Pattern:** CDN gen prompt lists `window.endGame`, `window.restartGame`, `window.nextRound` as required window exposures but does NOT include `window.loadRound`. The test harness `__ralph.jumpToRound(n)` checks `window.loadRound || window.jumpToRound || window.loadQuestion || window.goToRound` — if ALL absent, it sets `gameState.currentRound = n` directly but skips `nextRound()` and `renderRound()`, leaving phase stale.

**Consequence:** When a mechanics test drives the game to `phase = 'results'` (via `endGame()`), the next test's `beforeEach` starts fresh but any call to `jumpToRound()` is a silent no-op. `waitForPhase(page, 'playing')` then times out. Result: mechanics 0/6 across all 3 fix iterations — the fix loop cannot remedy this because the HTML itself is missing the exposure and T1 does not flag it.

**Evidence:** Build #550 mechanics tests failed with `data-phase: results` at every `waitForPhase('playing')` assertion. HTML confirmed `window.loadRound` absent (lines 591–593 expose only `endGame/restartGame/nextRound`). `gameState.gameEnded` guard at line 470 also prevents `nextRound()` from firing even if called indirectly.

**Fix:** GEN-114 rule in `CDN_CONSTRAINTS_BLOCK` (prompts.js) requiring `window.loadRound` for any round-based game. T1 PART-021-LOADROUND warning when `currentRound`/`totalRounds` present in HTML but `window.loadRound` absent. Required exposure:

```js
window.loadRound = function(n) {
  gameState.currentRound = n - 1;
  gameState.gameEnded = false;
  nextRound();
};
```

**Take:** Any round-based CDN game missing `window.loadRound` will produce mechanics 0% no matter how many fix iterations run. The fix loop iterates on the symptom (timeout) but cannot diagnose or fix a missing window exposure. T1 check + static-fix is the correct backstop — same defense-in-depth pattern as GEN-112/PART-023-API (Lesson 172–173).

## Lesson 175 — FeedbackManager.playDynamicFeedback namespace fix verified; timer expiry phase edge case (2026-03-22, build #551 count-and-tap)

**Source:** Build #551 test results

FeedbackManager.playDynamicFeedback namespace fix (prompts.js rule at line 81: "NEVER use FeedbackManager.sound.playDynamicFeedback") verified working in count-and-tap build #551 (APPROVED, 11/12 iter 1). Round lifecycle does NOT deadlock — `scheduleNextRound()` fires correctly after `showFeedback()`. PART-011-SOUND T1 check (commit 26fcfb6) adds defense-in-depth for future builds.

Edge-case finding: count-and-tap timer expiry sends game to `results` phase instead of `gameover` phase — caught and fixed by fix loop iter 2. If timer expires with 0 lives, game_over should fire with phase=gameover (not results). Future gen prompt: clarify that game_over via timer expiry at lives=0 sets phase='gameover', not 'results'.

## Lesson 176 — contract auto-fix (Step 1b) is destructive: strips max-width CSS + breaks signalPayload spread (2026-03-22, build #552 name-the-sides)

**Source:** Build #552 early-review rejection diagnosis

When the contract auto-fix LLM rewrites the HTML at Step 1b, it sometimes performs a destructive rewrite that:
1. Strips the `max-width` CSS constraint (T1 error: no 480px/max-width constraint)
2. Breaks `...signalPayload` spread in `postMessage`, replacing it with manually enumerated fields that omit `signals:` and `metadata:`

The pipeline already detects T1 regressions from the contract-fix (`"Contract-fix introduced N T1 error(s) — logged for fix loop"`), but proceeds to early-review with the T1-broken HTML anyway. The early reviewer correctly rejects it. With two consecutive rejections, the build fails at iter=0 — wasting ~8 minutes with no tests run.

**Fix:** When contract-fix introduces new T1 errors, those errors must be carried into iteration 1's fix prompt so the fix loop can handle them. The pipeline should NOT proceed to early-review with a T1-broken HTML.

**Pattern:** contract-fix LLM is less precise than the generation LLM — it tends to "simplify" what it doesn't understand, stripping CSS and flattening spread operators. The T1 regression detection already exists; the gap is the downstream handling.

## Lesson 177 — GEN-116: interaction type false-positive on drag prohibition text (2026-03-22, build #553 name-the-sides) [pipeline-utils, 2026-03-22, #553]

**Source:** Build #553 failure analysis

**Symptom:** name-the-sides build #553 — 0 passing tests across all batches (game-flow 0p/3f, mechanics 0p/5f, edge-cases 0p/2f, contract 0p/1f). Global best had 0 passing after 2 global fix rounds.

**Root cause:** `extractSpecMetadata()` regex `/drag[\s-]?(?:and[\s-]?drop|drop)|draggable/i` matched prohibition text "Do NOT use drag-and-drop" in spec.md → `interactionType=drag` → DOM snapshot metadata, test harness, AND test generator all assumed drag interaction → game uses MCQ buttons → all drag-specific assertions fail.

The spec (line 681) contained the explicit prohibition: "Do NOT use drag-and-drop". The regex had no guard for negation context — it classified the game as drag-based solely because the word appeared, regardless of whether it was prescribed or prohibited.

**Fix:** Added `dragProhibited` guard in `pipeline-utils.js` line 441. Pattern: `\b(?:do\s+not|avoid|no|without)\s+(?:use\s+)?drag/i`. Only classify as drag if drag is present AND not prohibited. Deployed as commit 39814bf.

**Impact:** Any spec that says "Do NOT use drag-and-drop" (a common safety instruction in CDN game specs) was silently misclassified as a drag game. This poisoned the DOM snapshot metadata, test harness answer() routing, and test generator category prompts simultaneously. All 3 affected builds for name-the-sides (#550, #552, #553) had this bug active; #550 and #552 failed for other primary reasons, but #553's 100% failure across all 4 batches is entirely attributable to GEN-116.

**Rule:** When writing specs, avoid including the literal phrase "drag-and-drop" even in prohibition context — prefer "avoid drag mechanics" or "use MCQ buttons only". The GEN-116 pipeline fix makes this robust regardless, but clear spec language avoids any future edge cases.

**Build #554** queued to verify GEN-116 fix.

## Lesson 178 — Build #554 — GEN-117: startGame() must call transitionScreen.hide() (2026-03-22, name-the-sides)

**Tag:** CDN_CONSTRAINTS_BLOCK, T1_CHECK, HTML_BUG

**Problem:** `startGame()` never called `transitionScreen.hide()`. ScreenLayout.inject() sets `#gameContent` to `display:none` as part of transition slot setup. CDN TransitionScreenComponent does NOT auto-reveal `#gameContent` when a button fires — the caller must call `transitionScreen.hide()` explicitly. Without it, `#gameContent` remains hidden for the entire game, causing every `isVisible()` check to fail.

**Evidence:** Build #554 HTML — `grep -c "transitionScreen.hide" index.html` = 0. Diagnostic agent confirmed `#gameContent` bounding rect `{width:0, height:0}` throughout game.

**Why other games worked:** Other approved CDN games (soh-cah-toa-worked-example, find-triangle-side) happened to generate `transitionScreen.hide()` correctly. The gen prompt line 128 ROUTING rule example previously showed the WRONG pattern without hide(), so compliance was probabilistic.

**Fix:**
- GEN-117 rule at `lib/prompts.js` line 128: explicit WRONG/RIGHT example with `await transitionScreen.hide()` as first call in action callback
- CORRECT PATTERN example at line 369: also updated to show hide()
- T1 check PART-025-HIDE in `lib/validate-static.js` line 209: if `transitionScreen.show(` present but `transitionScreen.hide(` absent → ERROR

**Lesson:** CDN component auto-hide/show behavior cannot be assumed. Every component that visually hides an element must be explicitly revealed by the caller. Document the FULL sequence in gen prompt rules.

## Lesson 179 — GEN-118: transitionScreen.hide() Does NOT Auto-Show #gameContent

**Build:** #556 (name-the-sides) | **Date:** 2026-03-22 | **Source:** diagnostic + build failure

**Root Cause:** `startGame()` called `transitionScreen.hide()` but never called `document.getElementById('gameContent').style.display = 'block'`. ScreenLayout.inject() sets `#gameContent` to `display:none` on init. `transitionScreen.hide()` dismisses the overlay UI but has no effect on the visibility of `#gameContent`. Without the explicit show call, the game renders invisibly — Playwright sees 0/3 game-flow passes because all interaction elements are hidden.

**Why GEN-117 Alone Was Insufficient:** GEN-117 mandated `transitionScreen.hide()` in `startGame()` — correct. But the WRONG example in the prompt showed `startGame()` without any #gameContent show call, which the model interpreted as: "call hide(), then nextRound() is enough." GEN-118 makes the explicit show call mandatory by adding it to both the ROUTING rule and the startGame() CORRECT PATTERN.

**Fix:** In `lib/prompts.js`, updated the TransitionScreen ROUTING rule and the startGame() CORRECT PATTERN to require the full 4-step sequence: `transitionScreen.hide()` → `document.getElementById('gameContent').style.display = 'block'` → `gameState.phase = 'playing'` → `nextRound()`. Added note: "transitionScreen.hide() does NOT auto-show #gameContent (GEN-118)".

**T1 Check:** `lib/validate-static.js` PART-026-GAMECONTENT (WARNING) — if transitionScreen.show() is present but no #gameContent visibility restore pattern found.

**Verified:** Build #557 queued (2026-03-22). Prior builds #550-#556 all failed due to this class of bug (various iterations of the same invisible-gameContent root cause).

**Rule:** After every `transitionScreen.hide()` call that transitions into gameplay, the caller MUST immediately call `document.getElementById('gameContent').style.display = 'block'` (or equivalent class removal). The transition screen hiding and the game content revealing are two independent DOM operations.

## Lesson 180 — GEN-119: fallbackContent Closing Brace Must Be on Its Own Line

**Build:** #558 (which-ratio) | **Date:** 2026-03-22 | **Source:** diagnostic

**Root Cause:** gemini-2.5-pro generated `fallbackContent` with the object's closing `}` squashed inline at the end of the `rounds` array line (no newline separator). This produced `SyntaxError: Unexpected token '}'` in the inline script. The error prevented DOMContentLoaded from firing, so `waitForPackages()` never ran, `ScreenLayout.inject()` never ran, and `#gameContent` was never created in the DOM. Smoke check reported "Blank page: missing #gameContent element".

**Why Smoke-Regen Didn't Fix It:** The CDN smoke-regen prompt (`buildSmokeRegenFixPrompt`) diagnoses CDN URL bugs, `slots:` wrapper bugs, and Sentry order bugs. It does not look for JS syntax errors in `fallbackContent`. The LLM re-examined CDN init (which was correct) and missed the syntax error.

**Why Static Validation Didn't Catch It:** `validate-static.js` had no JavaScript syntax validation — only structural HTML pattern checks. T1 check PART-027-JS-SYNTAX added: runs `new vm.Script()` on each inline script block; any SyntaxError → ERROR.

**Fix:** GEN-119 rule added to `CDN_CONSTRAINTS_BLOCK` in `lib/prompts.js`: the `fallbackContent` closing `}` MUST be on its own line. Never append the closing `}` inline at the end of the last property value. T1 PART-027-JS-SYNTAX check added to `lib/validate-static.js`.

**Rule:** `fallbackContent` must always be formatted with its closing `}` on its own line. Any inline script containing a JavaScript syntax error will be caught at T1 before smoke check.

## Lesson 181 — Post-Approval EACCES: Warehouse Dirs Created as root:root

**Source:** Builds #555, #559 (name-the-sides, which-ratio) | **Date:** 2026-03-22

**Pattern:** After a build is approved, the pipeline copies the final HTML to `warehouse/templates/<game>/game/`. If this directory was created by a previous deploy or server operation as `root:root`, the worker (running as `the-hw-app`) fails with `EACCES: permission denied`. The game status stays `approved` in the DB but no file is written.

**Fix:**
```bash
# Fix one game
sudo chown -R the-hw-app:the-hw-app /opt/ralph/warehouse/templates/<game>/game/
sudo chmod -R 775 /opt/ralph/warehouse/templates/<game>/

# Audit all warehouse dirs (run after any batch server operation)
ls -la /opt/ralph/warehouse/templates/ | grep "^d" | awk '{print $3, $9}' | grep -v "the-hw-app"
```

**Prevention:** After any `sudo`-run server operation touching `/opt/ralph/warehouse/`, immediately re-audit ownership. The pipeline does not retry post-approval copy on EACCES — the build must be re-queued manually (reset game status + queue new build).

**Affected dirs found 2026-03-22:** which-ratio, soh-cah-toa-worked-example, count-and-tap, right-triangle-area — all fixed proactively.

## Lesson 182 — Test Gen: Contract category 30.8% pass rate — two root causes, one persisting post-CT8

**Source:** Test Gen slot analysis | **Date:** 2026-03-23

**Pattern:** The `contract` batch has the lowest pass rate of all categories (30.8% across last 50 builds; 45.1% for game-flow, 53.3% for level-progression, 65.7% for edge-cases, 67.2% for mechanics). Two root causes account for all 20 contract failures analyzed:

**Root Cause A — expect.poll() return value misuse (11 occurrences, all pre-build-546):**
`TypeError: Cannot read properties of undefined (reading 'type')` — generated test assigned `const msg = await expect.poll(...)` which returns an Expect object, not the polled value. Triage correctly deleted these tests. CT8 rule was added in build #546 to address this. Post-CT8 contract pass rate is 66.7% (6/9 tests), confirming CT8 was effective.

**Root Cause B — #mathai-transition-slot button .not.toBeVisible() assertion as precondition (5 occurrences, builds #547 and #553, both post-CT8):**
Contract tests assert `expect(page.locator('#mathai-transition-slot button')).not.toBeVisible()` AFTER calling skipToEnd(), as a precondition check before reading postMessage. This is distinct from CT3 (which bans CLICKING through the slot to reach game completion). The slot button IS visible in some games after skipToEnd() because the game triggers a 'game-over' transition screen. This causes the `.not.toBeVisible()` assertion to fail. CT3 covers the navigation case but not the assertion-as-precondition case.

**Evidence:**
- Overall contract pass rate: 30.8% (12 passed, 27 failed out of 39 total across last 50 builds)
- Root Cause A: 11 contract failure entries with `TypeError: Cannot read properties of undefined (reading 'type')` — builds #526, #528, #531, #544, #545, all pre-CT8
- Root Cause B: 5 contract failure entries with `locator('#mathai-transition-slot button').not.toBeVisible() failed` — builds #547 (find-triangle-side iter 1) and #553 (name-the-sides iters 1+2), both post-CT8; build #553 stuck all 3 iterations
- Post-CT8 contract improvement: 30.8% → 66.7% confirms CT8 eliminated Root Cause A

**Proposed fix — add CT9 rule to lib/prompts.js contract section:**
```
CT9. NEVER assert '#mathai-transition-slot button' visibility (toBeVisible OR not.toBeVisible) anywhere in a contract test — not as a precondition, not as a navigation step, not as a state check. The transition slot state after skipToEnd() is undefined — it may show a game-over screen with a visible button, or it may be absent. Use ONLY waitForPhase(page, 'results', 20000) to verify game completion before reading postMessage. Pattern:
    WRONG: await skipToEnd(page, 'victory'); await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible(); const msg = ...
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000); const msg = ...
    (find-triangle-side #547, name-the-sides #553 — .not.toBeVisible() on slot button after skipToEnd() failed because game-over transition screen was showing)
```

Also fix timeout inconsistency: C1 rule uses `waitForPhase('results', 10000)` but CT4 mandates 20000ms. C1's 10s example must be updated to 20s to avoid generated tests using the shorter timeout seen in C1 example.

**Status:** Proposed — needs implementation in lib/prompts.js contract section + verification build

## Lesson 184 (build #557 name-the-sides, 2026-03-23) — CSS stripping is systemic, not game-specific

Both name-the-sides (#557) and which-ratio (#560) had their entire `<style>` block replaced with a comment by a targeted fix LLM. The triangle diagram in name-the-sides is completely invisible without CSS (CSS border-trick shape — 0×0px without styles). PART-028 T1 check + FIX-001 gen rule now prevent this. Both games need re-queue. Pattern: any build that went through a targeted fix before PART-028 was deployed (2026-03-23) should be considered potentially CSS-stripped and audited.

## Lesson 185 — New game first-build: warehouse template directory must be created on server (Build 563, 2026-03-23)

**Symptom:** Build fails immediately (iterations=0) with error_message "Spec file not found".

**Root cause:** The pipeline reads the spec from `warehouse/templates/<gameId>/spec.md` on the server. For a brand-new game that has never been built, this directory does not exist. git pull creates `games/<gameId>/spec.md` but does NOT create `warehouse/templates/<gameId>/` or its symlink (symlinks require git to be on a commit that includes them).

**Fix:**
```bash
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "sudo mkdir -p /opt/ralph/warehouse/templates/<gameId> && sudo chown the-hw-app:the-hw-app /opt/ralph/warehouse/templates/<gameId>"
scp -i ~/.ssh/google_compute_engine games/<gameId>/spec.md the-hw-app@34.93.153.206:/tmp/spec.md
ssh -i ~/.ssh/google_compute_engine the-hw-app@34.93.153.206 "cp /tmp/spec.md /opt/ralph/warehouse/templates/<gameId>/spec.md"
```
Then re-queue the build.

**Prevention:** Before queuing any new game that hasn't been built before, run the mkdir+SCP sequence above. Add to pre-queue checklist.

## Lesson 183 — CT9 + C1 + RULE-003: Contract test gen rules shipped 2026-03-23

**Source:** prompts.js fix | **Date:** 2026-03-23

**CT9 (contract transition-slot visibility ban):** Lesson 182's proposed CT9 fix has been shipped. `lib/prompts.js` contract section now has CT9 rule banning all `#mathai-transition-slot button` visibility assertions (toBeVisible OR not.toBeVisible) in contract tests — both as precondition checks and as state assertions. Use ONLY `waitForPhase(page, 'results', 20000)` to verify game completion. Addresses Root Cause B of the 30.8% contract pass rate (5 occurrences in builds #547 and #553 post-CT8).

**C1 timeout fix (10000→20000ms):** C1 and C2 rules in the contract section were using `waitForPhase('results', 10000)` as the example timeout — inconsistent with CT4's mandated 20000ms. Both C1 and C2 examples updated to 20000ms so LLM follows the correct value when generating new contract tests.

**RULE-003 TRANSITION (transitionScreen try/catch):** `transitionScreen.hide()` and `transitionScreen.show()` calls without try/catch cause uncaught promise rejections during game-over transition. Both CDN_CONSTRAINTS_BLOCK (gen prompt) and REVIEW_SHARED_GUIDANCE (review prompt) updated with explicit WRONG/RIGHT examples. Root cause: build #560 review rejection for unguarded transitionScreen calls.

**Commit:** 4e8fca8 — deployed to server, ralph-worker restarted.


## Lesson 186 — Cross-batch fix regression: per-batch fixes can conflict when shared state is involved (Build #565, 2026-03-23)

**Source:** real-world-problem build #565 | **Date:** 2026-03-23

**Pattern observed:** Both edge-cases and contract per-batch fixes independently regressed mechanics from 6/6 → 5/6. The pipeline cross-batch guard correctly detected both regressions and rolled back both fixes. The global fix loop (Step 3c) was triggered with 3 batches still failing.

**Root cause:** The real-world-problem step-panel state machine is shared across test categories. Level-progression tests check "panel hides between rounds". Edge-cases tests check "input not prematurely visible". Mechanics tests check "step 3 panel only shows after answer submit". Fixes that touch the panel reset path to fix one category inadvertently change the timing invariant that mechanics depends on.

**Lesson:** Per-batch fix loops have tunnel vision — they optimize for one batch at the cost of others when the same HTML state machine element is tested from multiple angles. When cross-batch regressions occur, the global fix loop is correct — it sees all failing tests simultaneously. Do NOT kill builds in the cross-batch regression + rollback phase; it is the pipeline working correctly.

**Prevention:** Complex step-based games (multi-part interactions with per-step panel visibility) are more susceptible to cross-batch fix conflicts. The gen prompt should explicitly state the invariants that must hold simultaneously: (1) panel N only visible when gameState.step >= N, (2) panel hidden at round start, (3) answer input hidden until step N complete.

**Action taken:** Global fix loop started — monitoring outcome for lesson on whether holistic fix resolves all 3 batches simultaneously.

## Lesson 187 — Global fix loop resolved cross-batch regression; review approved 12/14 (Build #565, 2026-03-23)

**Source:** real-world-problem build #565 | **Date:** 2026-03-23

**Outcome:** Build approved with 12/14 tests passing (game-flow 3/3, mechanics 6/6, contract 1/1; level-progression 0/1, edge-cases 2/3 failing). Review model (gemini-3.1-pro-preview) approved because core gameplay is fully functional.

**Global fix loop effectiveness:** Global fix 1 improved score from 9→10, global fix 2 achieved 11→12/14. The per-batch cross-batch regressions (see Lesson 186) were resolved by the holistic global fix approach. Both global fixes together brought mechanics from 5/6 → 6/6, edge-cases from 0/3 → 2/3, contract from 0/1 → 1/1.

**Persistent bug (GEN-STEP-001):** The level-progression test (step 3 panel visible from previous round at new round start) failed across ALL 5 fix attempts (3 per-batch + 2 global). Root cause: step-based games need explicit panel-hide-all at round start. Will become gen rule GEN-STEP-001: "At the start of each new round in a step-based game, ALL step panels must be explicitly set to hidden before showing step1."

**Review threshold:** 12/14 (85.7%) approved. game-flow, mechanics, and contract all passing = game is completable and functionally correct. Review approved despite 1 level-progression failure.

**Worker restart:** Worker restarts after #565 completion. All new gen rules now active: GEN-PM-001, GEN-RESTART-001, GEN-PHASE-001, GEN-GAMEID, GEN-WINDOW-EXPOSE. Next queued build is the first true test of combined gen rules.

## Lesson 188 — First complete trig session: all 5 games approved (2026-03-23)

**Source:** games/index.md | **Date:** 2026-03-23

**Milestone:** The SOH-CAH-TOA Trigonometry session (5 games, Bloom L2→L4) is now fully approved:
1. name-the-sides — #562, iter=3 (L2 Understand — label triangle sides)
2. which-ratio — #561, iter=3 (L2 Understand — identify SOH/CAH/TOA ratio)
3. soh-cah-toa-worked-example — #544, iter=1 (L2 Understand — worked example scaffold)
4. find-triangle-side — #549, iter=1 (L3 Apply — two-step: ratio MCQ + typed computation)
5. real-world-problem — #564, iter=2 (L4 Analyze — step-based real-world word problem)

This is the first complete Bloom L2→L4 learning session produced by the Ralph pipeline. The session covers the full NCERT Class 10 Ch 8 trigonometry curriculum from prerequisite identification through real-world application.

**What made it possible:** 
- Warehouse hygiene gate (eliminated generation bypass)
- CDN constraint rules (ARIA, progressBar, transitionScreen)
- Per-game spec improvements from UI/UX audits
- Per-batch fix loop with cross-batch guard
- Global fix loop for holistic correction

**Next:** Session Planner can now produce Session 2 (Statistics) using the same pipeline — 5 specs written, Session Planner architecture validated.

## Lesson 189 — PAGEERROR listener in sharedBoilerplate catches silent JS errors (2026-03-23)

**Source:** TE slot 2026-03-23, commit 1b783f1 | **Build:** multiple (progressBar.update(-9) pattern)

**Problem:** `progressBar.update(-9)` fires `RangeError: Invalid count value` every round but tests still pass — the error is logged to console but not caught by any assertion. A game can be "approved" while generating a JS error on every round.

**Fix:** Added `page.on('pageerror')` listener to sharedBoilerplate in `lib/pipeline-test-gen.js`. Errors accumulate in `pageErrors[]`. `test.afterEach()` throws if array is non-empty: `"Page JS errors during test: ..."`. Now any unhandled JS error during a test causes an immediate test failure.

**Impact:** Eliminates silent-pass games with runtime errors. progressBar.update() wrong-args (GEN-112) now produces visible test failures rather than invisible console noise. Every future game must have zero JS errors during gameplay.

## Lesson 190 — Gen rules confirmed already-shipped via grep (2026-03-23)

**Source:** Gen Quality slot 2026-03-23 | **Batch:** 8221ae2

**Finding:** Several "pending" ROADMAP entries (GEN-GAMEID, GEN-INPUT-001/Enter-key, GEN-UX-002-EXT/.choice-btn/.option-btn, GEN-WINDOW-EXPOSE) were already shipped in prior commits but not marked done in ROADMAP. Before implementing a gen rule, grep CDN_CONSTRAINTS_BLOCK and buildGenerationPrompt() for the key concept. Running the grep takes 10 seconds; re-implementing a shipped rule wastes agent budget.

**Process:** Always check prompts.js before adding a new rule. Check for: the rule concept (e.g., "Enter" for keyboard input, "gameId" for gameState field, "choice-btn" for touch target), not just the exact rule name (names evolve between commits).

## Lesson 191 — Browser audit reveals issues invisible to static analysis (quadratic-formula #546, 2026-03-23)

**Source:** UI/UX slot 2026-03-23, full Playwright browser playthrough | **Build:** #546

**Why static analysis misses these:**

1. **P0 — results screen off-screen via flex layout:** `#results-screen { position: static }` + body's CDN-injected `display: flex; flex-direction: row` renders results as a horizontal flex sibling to `#app`, pushed to the right edge at 208px computed width. Static analysis sees valid CSS on the element; browser sees the stacking context created by ScreenLayout CDN component. No static check can detect this — only a live render confirms the overlap/overflow.

2. **P1 — restartGame() doesn't reset all gameState fields:** Static analysis checks for function presence. Browser confirms that after game 1, `data-lives="2"` and `data-round="3"` remain set at game 2 start — gameState.lives and gameState.currentRound were never reset. The omission is not detectable from HTML structure.

**Rule added:** GEN-RESTART-RESET — restartGame() must reset ALL gameState fields. Two existing confirmed patterns also missed by static: ARIA live regions (ariaLive:null only visible in computed style) and ProgressBar slotId errors (slot-injection failure visible only in rendered DOM).

**Process implication:** Every approved game needs a browser playthrough. "Static analysis only" audits miss the class of bugs that require a live DOM/CSS interaction. Prioritize browser audits over static-only audits when choosing audit targets.

## Lesson 192 — signalCollector.reset() now exists in CDN SignalCollector API (2026-04-11, updated)

**Source:** CR-030 code review, CDN source update | **Build:** multiple

**Update (2026-04-11):** `reset()` has been added to the CDN SignalCollector API. It flushes buffered events via sendBeacon, clears the buffer, and continues with the same listeners and batch numbering. The old pattern of `seal()` + `new SignalCollector()` in restartGame caused GCS batch-number collision (new instance resets `_batchNumber` to 0, overwriting previous play's batches at the same path).

**Correct pattern for restartGame():**
```js
signalCollector.reset();
```

**Rule:** GEN-SIGNAL-RESET (rule 50) updated to use `reset()` instead of seal + re-instantiation.

## Lesson 193 — syncDOMState sets data attributes on #app, not body — confirmed in 2+ games (2026-03-23)

**Source:** UI/UX browser audits count-and-tap #551 + real-world-problem #564 | **Build:** #551, #564

**Problem:** Gen produces `document.getElementById('app').dataset.phase = gameState.phase` instead of `document.body.dataset.phase = gameState.phase`. PART-003 spec requires body. All contract/game-flow test assertions on `body[data-phase]` return null when the game writes to `#app[data-phase]`.

**Impact:** Every game-flow test that checks `body[data-phase]` fails silently or returns incorrect state — the game appears to be in the wrong phase during test execution even when rendering correctly for a human player.

**Fix:** Gen rule GEN-SYNC-TARGET added — explicitly bans `#app.dataset.phase` with a WRONG/RIGHT example. T1 static check added to `validate-static.js` to catch `getElementById('app').dataset` at build time.

## Lesson 194 — ProgressBar shows "N-1 of N" at victory — off-by-one on final round (2026-03-23)

**Source:** count-and-tap #551 browser audit | **Build:** #551

**Problem:** `renderRound(index)` calls `progressBar.update(index, lives)` where `index` is 0-based. After the player answers the last round, `endGame()` is called without a terminal `progressBar.update(totalRounds, lives)`. Victory screen shows "4/5 rounds completed" even when all 5 rounds were answered correctly.

**Classification:** Gen rule gap — `endGame()` must call `progressBar.update(gameState.totalRounds, gameState.lives)` before `transitionScreen.show()`.

**Affected scope:** Any game where `endGame()` is called immediately after the last round answer without a final progressBar sync. Pattern is present across multiple approved games.

## Lesson 196 — LP-4 FALSE ALARM: syncDOMState #app is consistent with test harness (2026-03-23)

**Source:** LP-4 cross-session investigation | **Commits:** 93290bf (revert), 3138f43 (wrong rule)

**Problem:** UI/UX audits confirmed games write `data-phase` to `#app` via syncDOMState(). This was classified as a HIGH test gap, assuming tests read from `document.body`. A GEN-SYNC-TARGET rule was committed (3138f43) telling the LLM to use `document.body` instead.

**Why it was WRONG:** Investigation of pipeline-test-gen.js (lines 323, 328, 336) confirmed:
- `waitForPhase()` → `page.locator('#app').toHaveAttribute('data-phase', phase)`
- `getLives()` → `page.locator('#app').getAttribute('data-lives')`
- `getRound()` → `page.locator('#app').getAttribute('data-round')`

Both games AND the test harness use `#app`. The pattern is CONSISTENT — no bug, no rule needed.

**Danger:** The wrong GEN-SYNC-TARGET rule would have instructed all future LLM generations to write to `document.body` while tests read from `#app` → 100% game-flow failures on all subsequent builds.

**Rule:** Before classifying any "#app vs body" finding as a test gap, verify BOTH sides: what element the game writes to (syncDOMState in HTML) AND what element the test harness reads from (pipeline-test-gen.js waitForPhase/getLives/getRound). Never ship a gen rule based on only one side.

## Lesson 195 — CSS strip in build #551 — confirmed first style block replaced with comment (2026-03-23)

**Source:** count-and-tap #551 browser audit | **Build:** #551

**Problem:** First `<style>` block replaced with `/* [CSS stripped — 59 chars, not relevant to JS fix] */` during a fix iteration. The game's custom layout CSS is removed.

**Why it still passes tests:** CDN `ScreenLayout` and `ProgressBar` components inject their own CSS via CDN at runtime. Interactive elements fall back to browser defaults — correct behavior but wrong visual presentation (no min-height, incorrect colors, unpolished touch targets).

**Root cause:** Static validator in a fix iteration strips the style block, judging it irrelevant to the JS-only fix being applied. This is a recurring pattern — see also Lesson 156 (CSS stripped in fix loop).

**Rule:** Fix-loop prompt must explicitly state: "Never remove or comment out `<style>` blocks. Preserve all CSS exactly as-is unless the fix specifically targets a CSS rule."

## Lesson 197 — endGame() guard using !isActive blocks results screen on perfect playthrough (2026-03-23)

**Source:** visual-memory #528 browser audit | **Build:** #528

**Problem:** `endGame()` had guard `if (gameState.gameEnded || !gameState.isActive) return;`. On a perfect playthrough, the correct-answer handler sets `gameState.isActive = false` before the `setTimeout(() => nextRound())` fires. When `nextRound()` calls `endGame()`, the guard trips (`isActive=false`) and endGame() returns without showing the results screen. `gameEnded` stays `false`. Game is permanently stuck.

**Cascade P0:** The `nextRound()` logic then shows a "Continue" transition screen for the "next round" that doesn't exist. The Continue button calls `setupRound()` which accesses `rounds[5]` (undefined) → `TypeError: Cannot read properties of undefined (reading 'gridSize')`.

**Root cause:** `isActive` is a "currently processing answer" flag, not an "endGame allowed" flag. Using it as an endGame guard conflates two different state concepts.

**Rule:** `endGame()` guard must use ONLY `gameEnded`: `if (gameState.gameEnded) return;`. Never use `!isActive` as an endGame guard. Use a separate `isProcessing` flag for answer double-click protection. (GEN-ENDGAME-GUARD, Rule 53)

## Lesson 198 — Results screen position:static clips content on mobile (2026-03-23)

**Source:** UI/UX audits — 6 confirmed instances (quadratic-formula, soh-cah-toa, right-triangle-area, word-pairs, name-the-sides, find-triangle-side) | **Pattern across session**

**Problem:** Results screen uses `position: static` (default), causing it to stack in document flow. On `#app` containers with `overflow: hidden`, the results screen is clipped below the visible area. On mobile, the "Play Again" button is unreachable without scrolling. Tests still pass because the element exists in DOM — but user cannot interact with it.

**Root cause:** LLMs default to hiding/showing elements with `display: none → block`, inheriting whatever position the element has in DOM flow. The `#app` container is typically `height: 100vh; overflow: hidden`, clipping any child that overflows.

**Rule:** Results screen MUST use `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100`. Never `position: static` for the results screen. (GEN-RESULTS-FIXED, Rule 54). Playwright assertion TE-RES-002: `checkResultsScreenViewport()` guards against this — checks `position:fixed OR (coversViewport AND rectTop <= 10)`.

## Lesson 199 — LP-2 banned-selector substitution misses .first().click() form (2026-03-23)

**Source:** Code Review CR-052 of pipeline-test-gen.js | **Build pattern: all test-gen builds**

**Problem:** The LP-2 substitution regex correctly handles `page.locator('#mathai-transition-slot button').click()` and `page.locator('#mathai-transition-slot button').first().toBeVisible()` — but NOT `page.locator('#mathai-transition-slot button').first().click()`. The `.first()` group is present in the `.toBeVisible()` regex but not in the `.click()` regex. The banned selector escapes post-processing and appears in emitted contract/game-flow tests → test timeouts.

**Rule:** LP-2 regex for click substitution must handle both `button.click()` AND `button.first().click()`. Asymmetric regex coverage is a common bug when adding `.first()` support — always check BOTH the click and the visibility assertion variants.

## Lesson 200 — progressBar.destroy() + null assignment inside setTimeout crashes restartGame() (2026-03-23)

**Source:** right-triangle-area #543 browser audit P0 | **Build:** #543

**Problem:** endGame() ran `setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000)` (10s after game ends). restartGame() called `progressBar.update(...)` unconditionally. User clicks Play Again after 10s → crash: TypeError: Cannot read properties of null (reading 'update').

**Root cause:** CDN components don't need to be destroyed. The game treated ProgressBarComponent like a DOM element (remove after use), but it's a CDN wrapper that persists in the slot. The setTimeout destroy serves no purpose and creates a null-trap.

**Rule:** Never use setTimeout to destroy ProgressBarComponent (or any CDN component). In endGame(), call .update() to show "Game Over" state — never .destroy() or null-assignment. restartGame() can safely call .update() to reset. (GEN-PROGRESSBAR-DESTROY)

## Lesson 201 — resolveFailurePattern() called with wrong args in handleFixJob (2026-03-23)

**Source:** Code Review CR-066 of worker.js | **Fix:** commit 3f29d2d

**Problem:** CR-055 added `resolveFailurePattern()` call to the handleFixJob APPROVED path, but passed `pattern.id` (a numeric row ID) as the first arg. The function signature is `(gameId, pattern)` — two strings matched by `WHERE game_id = ? AND pattern = ?`. The SQL `WHERE game_id = <number> AND pattern = undefined` matched nothing. Fix-loop approved builds never resolved failure patterns.

**Root cause:** The APPROVED path in handleJob (line 1286) correctly calls `db.resolveFailurePattern(gameId, fp.pattern)`. The handleFixJob path was copy-pasted with an incorrect arg shape.

**Rule:** When adding resolveFailurePattern() calls, always pass `(gameId, pattern.pattern)` not `(pattern.id)`. The resolve key is `(game_id, pattern)` — a text match — not a row ID.

## Lesson 202 — waitForPackages typeof check must match loaded scripts (GEN-WAITFOR-MATCH) (2026-03-23)

**Source:** T1 static validation GEN-WAITFOR-MATCH — 4 checks added | **Fix:** commit ab0c3fe

**Problem:** If the generated HTML checks `typeof FeedbackManager === 'undefined'` in waitForPackages() but `feedback-manager/index.js` is NOT in `<head>`, waitForPackages() waits 180 seconds before throwing — ALL tests fail. Similarly, if `new TimerComponent()` is used but `typeof TimerComponent` is absent from the while-loop condition, the game crashes with ReferenceError at instantiation.

**Root cause:** The gen prompt rule "include typeof X for every CDN component you instantiate" existed but had no T1 backstop. The LLM occasionally added FeedbackManager check without the script, or forgot to add TimerComponent.

**Rule:** T1 GEN-WAITFOR-MATCH enforces cross-validation: Check A (ERROR) — `typeof FeedbackManager` in waitForPackages without feedback-manager script in `<head>`; Checks B/C/D (WARNING) — `new X()` used without matching `typeof X` guard in waitForPackages. Any CHECK A violation guarantees 180s timeout → 0% on all categories.

## Lesson 203 — syncDOMState() must write data-lives for lives games (GEN-DATA-LIVES-SYNC) (2026-03-23)

**Source:** UI/UX audit addition-mcq-lives F7 | **Fix:** commit 0cbb269

**Problem:** Games with `totalLives > 0` that only track `gameState.lives` in JS — but never write `data-lives` to the DOM — cause `getLives()` in the test harness to return `undefined`. `getLives()` reads `parseInt(app.getAttribute('data-lives'), 10)`. If `data-lives` is never set, all mechanics assertions on life decrements fail silently.

**Root cause:** `syncDOMState()` only set `data-phase`, `data-round`, `data-score`. `data-lives` was absent — games tracked lives in JS state only.

**Rule:** `syncDOMState()` must include `if (gameState.totalLives > 0) { app.dataset.lives = String(gameState.lives); }`. Non-lives games (totalLives=0) skip this — test gen GEN-DATA-LIVES-GUARD already skips getLives() assertions for those games. T1 check W15 warns if this is absent.

## Lesson 204 — Spec validation errors missing writeReport() left no diagnostic artifact (2026-03-23)

**Source:** Code Review CR-067 of lib/pipeline.js | **Fix:** commit 91e430d

**Problem:** When `validateSpec()` found errors in Step 0, the pipeline threw `new Error(...)`. The worker.js catch block called `db.failBuild()` — DB was correct — but `ralph-report.json` was never written. No artifact for diagnosis, unlike spec-not-found and spec-too-small paths which both call `writeReport()` before returning.

**Rule:** All early-exit paths in pipeline.js must: (1) push errors to `report.errors`, (2) call `writeReport()`, (3) return `report` (not throw). The default `report.status = 'FAILED'` is picked up correctly by worker.js without needing an exception.

## Lesson 205 — Fix loop never called fixCdnDomainsInFile after LLM HTML writes (CR-070) (2026-03-23)

**Source:** Code Review CR-070 | **Fix:** commit b87189a

**Problem:** `fixCdnDomainsInFile` and `fixCdnPathsInFile` are defined in `pipeline.js` and called after every LLM HTML write there, but were never passed to `runFixLoop` via `ctx`. Two paths in `pipeline-fix-loop.js` were affected: (1) the warehouse-regen path (stale-init-failure recovery, ~line 891) wrote LLM-regenerated HTML and called `injectHarnessToFile` but not the CDN domain fixers — regenerated HTML could land on disk with wrong CDN domains; (2) the main per-iteration fix write (~line 1450) similarly skipped CDN cleanup after every LLM fix application.

**Rule:** Any new LLM HTML write path added to `pipeline-fix-loop.js` must call `ctx.fixCdnDomainsInFile` and `ctx.fixCdnPathsInFile` (with guards) immediately after `fs.writeFileSync`, before `injectHarnessToFile`. Rollback/snapshot-restore paths are safe (they restore from already-CDN-fixed snapshots). Add functions to `ctx` in `pipeline.js` at the `runFixLoop` call site.


## Lesson 206 — timer.getTime() is a hallucinated CDN method — blocks game_complete postMessage (2026-03-23)

**Source:** associations #578 — contract 0/2 all 3 iterations | **Fix:** commit c68ef5a (GEN-TIMER-GETTIME T1 ERROR)

**Problem:** LLM generated `const totalTime = timer ? timer.getTime() / 1000 : (Date.now() - gameState.startTime) / 1000` in endGame(). `timer.getTime()` is not a method on CDN TimerComponent — throws `TypeError: timer.getTime is not a function`. The null-guard (`timer ? ... : ...`) does NOT protect against this because `timer` IS a valid non-null object (a TimerComponent instance); the method just doesn't exist. The TypeError fires BEFORE `window.parent.postMessage`, so game_complete is never sent to the parent app. The build was approved (7/9 tests passing) but the game never signals completion in production.

**Valid CDN timer methods:** `timer.start()`, `timer.stop()`, `timer.pause()`, `timer.resume()`, `timer.reset()`, `timer.destroy()`.

**Pattern for elapsed time:** `(Date.now() - gameState.startTime) / 1000` — use startTime tracked in gameState.

**Rule:** T1 ERROR [GEN-TIMER-GETTIME] now bans timer.getTime(), timer.getCurrentTime(), timer.getElapsed() etc. in all generated HTML. Any build using these hallucinated methods fails static validation before tests run.

## Lesson 207 — 52% game-flow failure rate root cause: gameState.correctAnswer never set (2026-03-23)

**Source:** stats-identify-class #581 root cause diagnosis | **Fix:** commit 0dd9186 (GEN-CORRECT-ANSWER-EXPOSURE)

**Problem:** Games that store the correct answer in a round object field (e.g. `round.correctOption`, `round.correctAnswer`, `round.correctValue`) but never assign it to `gameState.correctAnswer`. The test harness `answer(page, true)` reads `gameState.correctAnswer` to find which button to click — if undefined, it falls back through `gameState.answer → round.correctIndex → round.correct → 0` (button index 0). Since most rounds have the correct answer at a different index, this submits the wrong answer every round → game stays stuck at `data-phase='playing'` → 0% correct submissions → all 3 game-flow tests timeout.

**Rule:** Gen prompt rule 62 (GEN-CORRECT-ANSWER-EXPOSURE): Every game that stores the correct answer as a string field on the round object MUST also assign `gameState.correctAnswer = round.correctOption` (or the appropriate field name) BEFORE calling `syncDOMState()` in `renderRound()` / `loadRound()`. T1 WARNING fires if the pattern is detected but assignment is absent.

**Carve-out:** Text-input games that set `gameState.answer = round.answer` are exempt — harness uses `gameState.answer` as the fallback for typed-input games.

**Optional chaining:** T1 regex updated to match `round?.correctOption` in addition to `round.correctOption` (initial regex missed the `?.` form).

## Lesson 208 — GF-ROUND-START test bug: getRound() > 0 fails because data-round is 0-indexed (2026-03-23)

**Source:** stats-identify-class #581 start-transition test failure | **Fix:** commit a0e00ed (GF-ROUND-START)

**Problem:** The test harness writes `data-round` as a 0-indexed value derived from `currentRound` (e.g. `currentRound=0` at round 1 → `data-round="0"`). Generated start-transition tests that assert `expect(await getRound()).toBeGreaterThan(0)` immediately after `startGame()` fail on a working game — the harness returns 0 (correct), but the assertion requires >0.

**Rule:** Test-gen rule (GF-ROUND-START): Start-transition tests MUST NOT assert `getRound() > 0`, `getScore() > 0`, or `getLives() > 0` immediately after `startGame()`. Round 1 is represented as 0 in the data-round attribute. Use `toBeGreaterThanOrEqual(0)` or skip initial round assertions. Only assert that `data-phase` transitioned to `'playing'`.

## Lesson 209 — Custom lives / hearts DOM duplicates ProgressBar's built-in hearts strip (2026-04-17)

**Source:** scale-it-up-ratios (user-reported, local file) | **Fix:** validator rule `5e0-LIVES-DUP-FORBIDDEN` + PART-023 / PART-026 anti-pattern 33 + prompt rule GEN-LIVES-DUP

**Problem:** The game injected `<div class="lives-row" id="lives-row" data-testid="lives-row">` into `#gameContent`, painted per-heart `<span class="heart">` glyphs via a `renderLivesRow()` loop, AND called `progressBar.update(roundsCompleted, lives)`. `ProgressBarComponent` with `totalLives >= 1` already renders a hearts strip inside `#mathai-progress-slot`, so the student saw **two rows of hearts** (one in the header, one above the question). Both updated in lockstep from `gameState.lives`, so the duplication was permanently visible.

**Why the LLM did it:** Two reinforcing cues.
1. `lib/prompts.js` line 569 lists `data-testid="lives-display"` as a "required minimum" data-testid. The LLM read "required minimum" as "you must create an element carrying a lives-related data-testid," rather than "the element holding lives (which is inside the CDN ProgressBar) should carry this data-testid."
2. The pre-existing rule only forbade a custom `updateLivesDisplay()` **function** — it said nothing about a custom DOM container or `<span class="heart">` glyphs, so the LLM bypassed by renaming the function (`renderLivesRow`) and rendering hearts from a plain innerHTML string.

**Rules:**
- Prompt (`lib/prompts.js`): new bullet GEN-LIVES-DUP expands the existing "NEVER define updateLivesDisplay()" rule to forbid any class/id matching `lives-*` / `hearts-*` / bare `heart`, any function named `renderLives*` / `updateLives*` / `renderHearts*` / `updateHearts*` / `buildLives` / `injectLives`, and any heart glyph (❤ 🤍 🩷 ♡ ♥) emitted via innerHTML strings. Data-testid `lives-display` refers to the CDN ProgressBar's lives element, never a new custom container.
- Validator (`lib/validate-static.js`): `5e0-LIVES-DUP-FORBIDDEN` fires on any of the above when `new ProgressBarComponent({ ..., totalLives: N })` exists with `N >= 1` (or totalLives is non-literal — default is lives-enabled).
- Tests: `test/content-match.test.js` adds a per-fixture assertion.
- Docs: `warehouse/parts/PART-023-progress-bar.md` gains a "ProgressBar Owns the Lives Display" section + checklist item; `warehouse/parts/PART-026-anti-patterns.md` adds Anti-Pattern 33; `alfred/parts/PART-023.md` gains a Verification Checklist (was absent) with matching drift-guard tokens.

**Heart-break animation guidance:** target the CDN-rendered heart class with a one-shot CSS class — do NOT replicate the hearts in your own DOM just to animate them.

## Lesson 210 — TransitionScreen button uses `onClick` instead of `action` → CTA is a silent no-op (2026-04-17)

**Source:** match-up-equivalent-ratios (user-reported, local file) | **Fix:** validator rule `5e1-TS-BTN-ONCLICK-FORBIDDEN` + prompt rule GEN-TS-BTN-ACTION + code-patterns.md example fix

**Problem:** The game's welcome transition screen was functionally dead — tapping "I'm ready!" did nothing. Game stuck on welcome screen forever. All 5 `transitionScreen.show({...})` call sites in the game (welcome, round-intro, victory, game-over, motivation) used `onClick: function() {...}` in their button objects. The CDN `TransitionScreenComponent` (`warehouse/packages/components/transition-screen/index.js` line 305) reads `btn.action()` verbatim; `onClick` is simply never called. No error, no warning — the click fires, the button is highlighted, nothing happens.

**Why the LLM did it:** Two in-repo examples in `alfred/skills/game-building/reference/code-patterns.md` (lines 348 and 362) showed commented placeholders `{ text: '<exact label>', onClick: () => ... }` — the LLM copied the `onClick` key literally. The prompt guidance in `lib/prompts.js` was split across multiple rules (lines 65, 289, 721, 738, 802, 846, 855 all correctly use `action`) but none explicitly forbade `onClick`, so the copy-from-example form won.

**Rules:**
- Docs (`alfred/skills/game-building/reference/code-patterns.md`): both placeholder examples rewritten to `{ text: '<label>', type: 'primary', action: () => {...} }`.
- Prompt (`lib/prompts.js`): new bullet GEN-TS-BTN-ACTION explicitly forbids `onClick` on any TransitionScreen button, with symptom description (dead CTA → game stalls), CDN line-number citation, and WRONG/RIGHT examples.
- Validator (`lib/validate-static.js`): `5e1-TS-BTN-ONCLICK-FORBIDDEN` — proximity check flags any `onClick:` within 300 chars after a `text:` property in files using `transitionScreen`. Survives nested braces (the handler body's try/catch blocks).
- Tests: `test/content-match.test.js` adds a per-fixture assertion with the same proximity check.

## Lesson 211 — TransitionScreen.show() promise resolves immediately → welcome/victory screens auto-skipped (2026-04-17)

**Source:** scale-it-up-ratios (user-reported, local file) | **Fix:** prompt rule GEN-TS-PERSIST-FALLTHROUGH + validator rule `5e2-TS-PERSIST-FALLTHROUGH` + docs correction (PART-024, code-patterns.md, flow-implementation.md)

**Problem:** The welcome screen ("Let's go! ⚡ / I'm ready! 🙌") flashed for one frame then was immediately replaced by the Round 1 intro. The student never saw it. Same pattern would affect victory, game-over, and motivation screens.

**Root cause:** CDN `TransitionScreenComponent.show()` returns a promise that resolves **immediately** (next `requestAnimationFrame` after `onMounted` fires). It does NOT wait for a button tap, and `duration` / `persist` options are documented but **not implemented** in the CDN code — `show()` never reads them. The game put `showRoundIntro(1)` after `await transitionScreen.show({buttons: [...], persist: true})`, expecting the `await` to block until the student tapped the button. It didn't — the code fell through instantly.

**Why the LLM did it:** Three mutually-reinforcing doc errors taught "await blocks until interaction":
1. `alfred/parts/PART-024.md` line 14: "await the transitionScreen.show(...) Promise (resolves when buttons tap or duration elapses)" — **wrong**.
2. `alfred/skills/game-building/reference/code-patterns.md` line 125: "the show Promise resolves when a button is tapped" — **wrong**.
3. `alfred/skills/game-building/reference/flow-implementation.md` line 31: "TransitionScreen has no duration / persist flags" — contradicted by PART-024 and code-patterns which showed `persist: true` in examples.

The LLM reasonably concluded: "await blocks, so continuation goes after await." Every tap-dismiss screen in every generated game followed this pattern — welcome, motivation, victory, game-over.

**Rules:**
- Prompt (`lib/prompts.js`): GEN-TS-PERSIST-FALLTHROUGH — explains the immediate-resolve behavior, bans game-flow calls after `await show()` when buttons are present, provides WRONG/RIGHT examples.
- Docs corrected: `alfred/parts/PART-024.md`, `warehouse/parts/PART-024-transition-screen.md`, `alfred/skills/game-building/reference/code-patterns.md`, `alfred/skills/game-building/reference/flow-implementation.md` — all now state show() resolves immediately.
- Validator (`lib/validate-static.js`): `5e2-TS-PERSIST-FALLTHROUGH` detects game-flow function calls in the ~200 chars after `await transitionScreen.show(...)` when `buttons:` is present in the call body.
- Tests: `test/content-match.test.js` per-fixture assertion.
- Warehouse PART-024 gains a "show() Promise Resolves IMMEDIATELY" section with WRONG/RIGHT examples + verification checklist item.

**Correct patterns:**
- Tap-dismiss (welcome, victory, game-over): all continuation goes inside the button `action` callback.
- Auto-dismiss (round intro, stars collected): fire audio + `hide()` + continuation inside the `onMounted` IIFE, OR immediately after `await show()` (since it resolves instantly anyway).

**Initial regex attempt failed the reverse test.** First pass used `/\{[^{}]*\}/g` to find button-object literals — this matched only innermost `{}`, which in practice means the empty `catch (e) {}` blocks inside the handler body. The outer `{ text, onClick, function(){ try {...} catch {} } }` block contained nested braces, so the regex never saw it. Replaced with a proximity heuristic that looks 300 chars backward from every `onClick:` occurrence for a `text:` property — works for button literals and `buttons.push({...})` alike.

### Lesson 212 — Answer-feedback audio cut short: sound.play() resolves before audio finishes (make-x, 2026-04-17)

**Symptom:** Incorrect feedback audio (`sound_life_lost`) was partially playing — the game proceeded to the next action (tile reset, allowing user to select correct answer and advance to next round) while the life-lost sound/sticker was still audible.

**Root cause:** `FeedbackManager.sound.play()` can resolve its Promise BEFORE the audio finishes playing. Any code after `await FeedbackManager.sound.play(...)` (round advance, tile reset, `isProcessing = false`, game-over check) executes while the audio/sticker is still active. This is related to the `Promise.race` ban (Anti-Pattern 32) but is a different manifestation: plain `await` without `Promise.race` ALSO suffers from early resolution.

**Why the LLM did it:** PART-017 documentation stated "sound.play resolves within audio-duration + 1.5s guard," implying the await would naturally block until audio finishes. The LLM trusted this and used bare `await FeedbackManager.sound.play(...)` followed immediately by state changes. In practice, the CDN's internal guard is unreliable — the promise resolves early.

**Fix — pipeline level (Anti-Pattern 34):** ALL answer-feedback `sound.play()` calls MUST be wrapped in `Promise.all` with a 1500ms minimum delay floor:
```javascript
await Promise.all([
  FeedbackManager.sound.play('sound_life_lost', { sticker }),
  new Promise(function(r) { setTimeout(r, 1500); })
]);
```
This guarantees at least 1500ms AND waits for the sound promise, whichever is longer.

**Applies to:** `sound_life_lost`, `sound_correct`, `wrong_tap`, `correct_tap`, `sound_incorrect`, `all_correct`, `all_incorrect_*`, `partial_correct_*`.

**Does NOT apply to:** VO (`vo_game_start`, `vo_level_start_*`) or transition audio (`sound_game_complete`, `sound_game_over`, `sound_game_victory`) — these play during transition screens with no immediate state change.

**Rules:**
- Prompt (`lib/prompts.js`): GEN-FEEDBACK-MIN-DURATION — explains early resolution, mandates Promise.all wrapper for feedback sounds.
- Validator (`lib/validate-static.js`): `5e0-FEEDBACK-MIN-DURATION` — detects answer-feedback sound IDs not preceded by `Promise.all([` within 80 chars.
- Docs: PART-017 "Minimum Feedback Duration" section + PART-026 Anti-Pattern 34 + code-patterns.md updated.
- Tests: `test/content-match.test.js` per-fixture assertion.

### Lesson 213 — Last-life wrong answer must play incorrect SFX before game over (make-x, geo-quad-match, 2026-04-17)

**Symptom:** When the student had 1 life remaining and answered incorrectly, the game jumped instantly to the game-over screen without playing the incorrect feedback audio/sticker. The student had no feedback that their answer was wrong — just an abrupt game over.

**Root cause:** Pipeline rule "CASE 8" in `alfred/skills/feedback/SKILL.md` explicitly instructed: "Wrong-answer SFX is skipped entirely — game goes straight to Game Over." This was an intentional design choice that turned out to be wrong pedagogically — the student needs to hear/see the incorrect feedback before game over.

**Why the LLM did it:** The LLM correctly followed CASE 8 as documented. The pattern `if (gameState.lives <= 0) { endGame(false); return; }` was placed BEFORE the feedback audio block, so the early return skipped the SFX entirely.

**Fix — pipeline level:** Reversed CASE 8 across all pipeline docs. Wrong-answer SFX now ALWAYS plays (awaited with Promise.all 1500ms minimum per GEN-FEEDBACK-MIN-DURATION), including on last life. The lives<=0 check + endGame call goes AFTER the feedback audio block, never before it.

**Correct pattern:**
```javascript
// 1. Decrement lives, update progress bar
gameState.lives--;
if (progressBar) progressBar.update(round, Math.max(0, gameState.lives));
// 2. ALWAYS play wrong SFX (even on last life)
try {
  await Promise.all([
    FeedbackManager.sound.play('wrong_tap', { sticker }),
    new Promise(function(r) { setTimeout(r, 1500); })
  ]);
} catch(e) {}
// 3. THEN check if game over
if (gameState.lives <= 0) { endGame(false); return; }
```

**Rules:**
- Prompt (`lib/prompts.js`): GEN-LASTLIFE-FEEDBACK — mandates wrong SFX before endGame on last life.
- Validator (`lib/validate-static.js`): `5e0-LASTLIFE-SKIP-FORBIDDEN` — detects endGame inside lives<=0 block without preceding FeedbackManager.sound.play.
- Docs: feedback/SKILL.md CASE 8 reversed, feedback-summary.md, code-patterns.md, plan-formats.md, game-building/SKILL.md rule 3, eval.md Case 3 all updated.

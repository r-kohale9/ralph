# Same Rule?

**Game ID:** `same-rule`
**Session:** Ratio Intuition (Game 1 of 3) · **Position:** Game 1
**Bloom Level:** L2 Understand
**Interaction Type:** scene-compare-then-state-rule

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | 🟢 BUILT + VERIFIED LOCALLY — CDN deploy blocked on mathai-core MCP outage |
| **UI/UX Audit** | Informal pass — welcome, round 1 (correct), round 4 (trap/wrong judge), victory screen all render as designed |
| **Test Coverage** | Manual — 3 flows exercised via Claude Preview MCP |
| **Local path** | `/Users/sammitbadodekar/Documents/claude/same-rule/index.html` (1100+ lines) |
| **CDN URL** | ⏳ Pending mathai-core recovery |

### Next Action

> When mathai-core MCP is back up, run `upload_game_folder` + `register_game` + `create_content_set`. All payload shapes are documented in [spec.md](spec.md) under Content Structure and in the original build brief.

### Verification Evidence

| Flow | Expected | Observed |
|---|---|---|
| Welcome screen | Title, intro copy, Start button | ✓ |
| Round 1 (easy, Type A) | 2 cookies + 1 milk / 4 cookies + 2 milk, Same/Different buttons | ✓ |
| Judge correct (round 1) | Both scenes get `.grouped` (animation fires), Same button turns green | ✓ |
| Rule step (round 1) | +/− steppers initialized at 1; "For every __ cookies, there are __ glass of milk." sentence | ✓ |
| Round 1 complete → Round 2 | Progress bar advances, new scenes (roses + sunflowers) render | ✓ |
| Round 4 (additive trap, wrong judge) | `MISC-RATIO-01 additive-thinking-instead-of-multiplicative` captured in `gameState.misconceptionTags`; correct answer highlighted; insight callout persists through rule-builder mount | ✓ |
| Victory screen (9/10, 4/4 traps) | 3 stars, "You spotted the 'for every' rule 9 out of 10 times!", "Trap rounds solved: 4 of 4" | ✓ |

---

## Concept Summary

Grade-5 ratio intuition game. Student compares two real-world scenes (emoji scene tokens) stacked vertically, decides if both follow the same "for every A, there are B" rule, then states the rule by tapping two +/− steppers. 10 rounds across 3 stages:

- **Stage 1 (R1–3):** Easy matches — build confidence with "for every" language
- **Stage 2 (R4–7):** Additive trap — break "same difference = same rule" habit
- **Stage 3 (R8–10):** Kid leads — state the rule BEFORE Scene B appears

No lives, no timer, star rating with trap-aware 3-star gate.

---

## Key Design Choices

1. **No-Penalty Explorer archetype with two-step composite interaction** — non-canonical but justified by Bloom L2 + exploratory framing.
2. **Emoji scene tokens, not illustrated SVGs** — avoids asset pipeline blocker for v0.
3. **+/− steppers, not scroll wheels** — more Playwright-testable per game-testing/SKILL.md.
4. **Stage 3 flips step order via `ruleFirst: true` flag** — same components, rearranged per-round. No separate archetype.
5. **Joint-correct scoring** — +1 only when BOTH Judge and Rule are correct on first attempt. Ensures the sentence-building (the real skill anchor) is never skipped.
6. **6 new MISC-RATIO-* misconception tags** — pedagogy/reference/misconceptions.md must be extended before analytics can attribute student errors.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| L1 | 2026-04-16 | 🟢 LOCAL | 3 | — | ~30 min | Built + verified | Sub-agent build + 3 orchestrator fixes (TTS API, 403 audio URLs, insight callout wipe) |

## Bug Fixes Applied Post-Build

1. **Hallucinated `FeedbackManager.playDynamicFeedback` API** — sub-agent invented this; swapped to the documented generate-audio endpoint + `FeedbackManager.sound.preload` / `FeedbackManager.stream.addFromResponse` pattern per [correct-patterns.md](../../alfred/skills/game-building/reference/code-patterns.md) Pattern 3.
2. **403 errors from `cdn.homeworkapp.ai/sets-gamify-assets/...` URLs** — these URLs don't exist. Removed SFX/sticker presets entirely; game now relies on dynamic TTS only (still silent if TTS endpoint fails — safeTry protects flow).
3. **Insight callout wiped by rule-builder mount** — `mountRuleBuilder()` cleared `feedbackHost.innerHTML`, erasing the additive-trap explanation. Moved callout to dedicated persistent `insightHost` div that survives rule-builder render.

---

## Source Material

- Concept note: [data/poc/game-design-same-rule (1).md](../../data/poc/game-design-same-rule%20(1).md)
- Platform reference: [alfred/README.md](../../alfred/README.md)

## Related Docs

- [spec.md](spec.md) — canonical spec (read by pipeline via warehouse symlink)
- rca.md — (to be created after first build failure)
- ui-ux.md — (to be created after first approved build)

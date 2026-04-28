# PART-051: Answer Component (Correct Answers carousel)

> **⚠ Canonical doc lives at [`alfred/parts/PART-051.md`](../../alfred/parts/PART-051.md).**
> The Alfred pipeline reads only from `alfred/` + `lib/` — it does NOT read this warehouse copy. This file is kept for consistency with the rest of `warehouse/parts/` but is NOT authoritative. Make all substantive edits in `alfred/parts/PART-051.md`.

**Category:** CONDITIONAL | **Condition:** Every game with at least one evaluated answer to display UNLESS the spec sets `answerComponent: false` (CREATOR-ONLY opt-out — no LLM step may auto-default this flag) | **Dependencies:** PART-002, PART-008, PART-017 (FeedbackManager), PART-050 (FloatingButton)

See [`alfred/parts/PART-051.md`](../../alfred/parts/PART-051.md) for the full contract: creator-only opt-out trust model, ScreenLayout config, instantiation, public API, lifecycle (multi-round + standalone), invariants, FeedbackManager integration, validator rules, and verification checklist.

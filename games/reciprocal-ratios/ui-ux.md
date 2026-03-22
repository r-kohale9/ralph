# UI/UX Audit — reciprocal-ratios

**Audit date:** 2026-03-23
**Auditor:** UI/UX Slot (mandatory active slot — CLAUDE.md Rule 16)
**Audit type:** Attempted spec-only — BLOCKED
**Spec:** games/reciprocal-ratios/spec.md — DOES NOT EXIST

---

## Status: Blocked — No Spec

The `reciprocal-ratios` game directory, spec.md, build history, and games/index.md entry are all absent as of 2026-03-23.

**Evidence of absence:**
- `games/reciprocal-ratios/` directory did not exist (created as stub by UI/UX auditor)
- `glob games/**/reciprocal*` → no results
- Server: `ls /opt/ralph/warehouse/templates/` → no `reciprocal-ratios` entry
- DB: `SELECT * FROM builds WHERE game_id='reciprocal-ratios'` → empty result set
- `games/index.md` → no row for reciprocal-ratios
- `ROADMAP.md` → no mention of reciprocal-ratios

**Only reference:** `docs/education/session-planner-v1.md` line 257 lists `reciprocal-ratios` as one of "6 approved trig specs as templates" — but no spec has been written. This appears to be a forward-looking/aspirational listing.

**No 16-item checklist possible.** All 16 checklist items require a spec to evaluate. None can be assessed without one.

---

## Action Required

Before this audit can proceed, the Education slot must:

1. Write `games/reciprocal-ratios/spec.md` — covering game mechanics, CDN parts, state machine, inputSchema, interaction flow.
2. Add `reciprocal-ratios` to `games/index.md` (Status: TBD, Build #: —).
3. Deploy spec to server: `mkdir /opt/ralph/warehouse/templates/reciprocal-ratios && cp spec.md` (see CLAUDE.md first-build sequence).
4. Notify UI/UX slot — audit can then proceed as spec-only or after first build, whichever comes first.

---

## Routing Table

| Finding | Classification | Destination | Action |
|---------|---------------|-------------|--------|
| No spec exists | Blocker | Education slot | Write spec.md before any UI/UX or build work |
| Not in games/index.md | Blocker | Education slot | Add index entry when spec is written |
| session-planner-v1.md listing premature | Documentation gap | Education slot | Update line 257 to mark as "planned" not "exists" |

---

## Positive Observations

None — no spec to evaluate.

---

## Pre-Build Checklist

Cannot be generated until spec exists. Re-run full 16-item audit after spec is written.

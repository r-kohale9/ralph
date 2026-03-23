# Games Index

*Human entry point for all Ralph pipeline games. Each row links to the per-game decision dashboard.*

| Game | Session | Bloom | Status | Build # | Iter | Build Time | UI/UX | Next Action |
|------|---------|-------|--------|---------|------|------------|-------|-------------|
| [stats-identify-class](stats-identify-class/index.md) | Stats 1/4 | L1 Remember | 📝 Spec ready | — | — | — | ✅ 6 findings | Human review before queuing |
| [stats-mean-direct](stats-mean-direct/index.md) | Stats 2/4 | L2-L3 Apply | 📝 Spec ready | — | — | — | ✅ 2 findings | Human review before queuing |
| [stats-median](stats-median/index.md) | Stats 3/4 | L3 Apply | 📝 Spec ready | — | — | — | ✅ 3 findings | Human review before queuing |
| [stats-mode](stats-mode/index.md) | Stats 4/4 | L3 Apply | 📝 Spec ready | — | — | — | ⏳ Auditing | Human review before queuing |
| [name-the-sides](name-the-sides/index.md) | Trig 1/5 | L2 Understand | ✅ Approved | #562 | 3 | ~35 min | ❌ Pending | — |
| [which-ratio](which-ratio/index.md) | Trig 2/5 | L2 Understand | ✅ Approved | #561 | 3 | ~28 min | ⚠️ 8 issues | — |
| [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | Trig 3/5 | L2 Understand | ✅ Approved | #544 | 1 | ~28 min | ❌ Pending | — |
| [find-triangle-side](find-triangle-side/index.md) | Trig 4/5 | L3 Apply | ✅ Approved | #549 | 1 | ~28 min | ❌ Pending | — |
| [real-world-problem](real-world-problem/index.md) | Trig 5/5 | L4 Analyze | ✅ Approved | #564 | 2 | ~32 min | ❌ Pending | #565 running (gen rules test) |
| [associations](associations/index.md) | Standalone | TBD | ✅ Approved | #472 | 2 | ~29 min | ❌ Pending | — |
| [count-and-tap](count-and-tap/index.md) | Standalone | L1 Remember | ✅ Approved | #551 | 2 | ~30 min | ❌ Pending | — |
| [quadratic-formula-worked-example](quadratic-formula-worked-example/index.md) | Standalone | L2 Understand | ✅ Approved | #546 | 2 | ~38 min | ❌ Pending | — |
| [addition-mcq](addition-mcq/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-blitz](addition-mcq-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-lives](addition-mcq-lives/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [adjustment-strategy](adjustment-strategy/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [math-cross-grid](math-cross-grid/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [math-mcq-quiz](math-mcq-quiz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [mcq-addition-blitz](mcq-addition-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ⚠️ 9 issues | Audited 2026-03-23 (6a 2b 1d) |

*Updated: 2026-03-23 — Statistics Session 2 all 4 specs written (stats-identify-class, stats-mean-direct, stats-median, stats-mode); real-world-problem #564 APPROVED; name-the-sides re-approved #562; which-ratio APPROVED #561*

---

## Sessions

### Statistics (4 games, Bloom L1→L3) — 📝 Specs written (2026-03-23)

*Session goal: learner progresses from identifying measures of central tendency (L1) through computing mean (L2-L3) → median (L3) → mode for grouped data (L3).*
*All 4 specs written with research citations. Awaiting human review before first builds.*

| # | Game | Bloom | Status | Notes |
|---|------|-------|--------|-------|
| 1 | [stats-identify-class](stats-identify-class/index.md) | L1 Remember | 📝 Spec ready | MCQ: identify mean/median/mode from description; GAME_COMPLETE fixed pre-build |
| 2 | [stats-mean-direct](stats-mean-direct/index.md) | L2-L3 Apply | 📝 Spec ready | Compute mean of small dataset; 4 misconception distractors; timer 45s |
| 3 | [stats-median](stats-median/index.md) | L3 Apply | 📝 Spec ready | Find median (odd/even n, sort-first); M-no-sort primary distractor |
| 4 | [stats-mode](stats-mode/index.md) | L3 Apply | 📝 Spec ready | Ungrouped single/bimodal + grouped NCERT formula; dual display mode |

---

### SOH-CAH-TOA Trigonometry (5 games, Bloom L2→L4) — ✅ COMPLETE (2026-03-23)

*Session goal: learner progresses from side-labeling (L2) through definition recall (L2) → scaffolded worked example (L2) → application (L3) → real-world analysis (L4).*
*All 5 games approved. First complete Bloom L2→L4 session in Ralph pipeline.*

| # | Game | Bloom | Status | Notes |
|---|------|-------|--------|-------|
| 1 | [name-the-sides](name-the-sides/index.md) | L2 Understand | ✅ Approved | label-assignment; prerequisite for all others; re-approved #562 |
| 2 | [which-ratio](which-ratio/index.md) | L2 Understand | ✅ Approved | APPROVED #561 (iter=3, re-queue after CSS fix) |
| 3 | [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | L2 Understand | ✅ Approved | worked-example→faded→practice scaffold |
| 4 | [find-triangle-side](find-triangle-side/index.md) | L3 Apply | ✅ Approved | two-step: ratio MCQ + typed computation |
| 5 | [real-world-problem](real-world-problem/index.md) | L4 Analyze | ✅ Approved | APPROVED #564 (iter=2); first L4 Bloom game |

---

### Standalone Games

| Game | Bloom | Status | Notes |
|------|-------|--------|-------|
| [associations](associations/index.md) | TBD | ✅ Approved | Unlimited-lives accuracy; emoji/name pairs |
| [count-and-tap](count-and-tap/index.md) | L1 Remember | ✅ Approved | Subitizing / dot counting with timer |
| [quadratic-formula-worked-example](quadratic-formula-worked-example/index.md) | L2 Understand | ✅ Approved | Worked-example-mcq; algebra |
| [addition-mcq](addition-mcq/index.md) | TBD | TBD | Check DB for build history |
| [addition-mcq-blitz](addition-mcq-blitz/index.md) | TBD | TBD | Check DB for build history |
| [addition-mcq-lives](addition-mcq-lives/index.md) | TBD | TBD | Check DB for build history |
| [adjustment-strategy](adjustment-strategy/index.md) | TBD | TBD | Check DB for build history |
| [math-cross-grid](math-cross-grid/index.md) | TBD | TBD | Check DB for build history |
| [math-mcq-quiz](math-mcq-quiz/index.md) | TBD | TBD | Check DB for build history |
| [mcq-addition-blitz](mcq-addition-blitz/index.md) | TBD | TBD | Check DB for build history |

---

## Structure

Each game directory contains:

| File | Purpose |
|------|---------|
| `index.md` | Human decision dashboard — status, build history, action required |
| `spec.md` | Canonical spec (pipeline reads via symlink from `warehouse/templates/<game>/spec.md`) |
| `rca.md` | Root cause analysis — failure history, evidence, POC fixes |
| `ui-ux.md` | UI/UX audit — visual issues, gen prompt rules, spec additions |
| `build-log.md` | Build history stub (full data in DB on server) |

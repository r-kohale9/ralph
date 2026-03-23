# Games Index

*Human entry point for all Ralph pipeline games. Each row links to the per-game decision dashboard.*

| Game | Session | Bloom | Status | Build # | Iter | Build Time | UI/UX | Next Action |
|------|---------|-------|--------|---------|------|------------|-------|-------------|
| [name-the-sides](name-the-sides/index.md) | Trig 1/5 | L2 Understand | ✅ Approved | #557 | 3 | ~35 min | ❌ Pending | — |
| [which-ratio](which-ratio/index.md) | Trig 2/5 | L2 Understand | ⚠️ Re-queue | #560 | 1 | ~28 min | ⚠️ 8 issues | Re-queue — CSS stripped |
| [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | Trig 3/5 | L2 Understand | ✅ Approved | #544 | 1 | ~28 min | ❌ Pending | — |
| [find-triangle-side](find-triangle-side/index.md) | Trig 4/5 | L3 Apply | ✅ Approved | #549 | 1 | ~28 min | ❌ Pending | — |
| [real-world-problem](real-world-problem/index.md) | Trig 5/5 | L4 Analyze | 📋 Spec ready | — | — | — | ❌ Pending | Queue after which-ratio |
| [associations](associations/index.md) | Standalone | TBD | ✅ Approved | #472 | 2 | ~29 min | ❌ Pending | — |
| [count-and-tap](count-and-tap/index.md) | Standalone | L1 Remember | ✅ Approved | #551 | 2 | ~30 min | ❌ Pending | — |
| [quadratic-formula-worked-example](quadratic-formula-worked-example/index.md) | Standalone | L2 Understand | ✅ Approved | #546 | 2 | ~38 min | ❌ Pending | — |
| [addition-mcq](addition-mcq/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-blitz](addition-mcq-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-lives](addition-mcq-lives/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [adjustment-strategy](adjustment-strategy/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [math-cross-grid](math-cross-grid/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [math-mcq-quiz](math-mcq-quiz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [mcq-addition-blitz](mcq-addition-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |

*Updated: 2026-03-23*

---

## Sessions

### SOH-CAH-TOA Trigonometry (5 games, Bloom L2→L4)

*Session goal: learner progresses from side-labeling (L2) through definition recall (L2) → scaffolded worked example (L2) → application (L3) → real-world analysis (L4).*

| # | Game | Bloom | Status | Notes |
|---|------|-------|--------|-------|
| 1 | [name-the-sides](name-the-sides/index.md) | L2 Understand | ✅ Approved | label-assignment; prerequisite for all others |
| 2 | [which-ratio](which-ratio/index.md) | L2 Understand | ⚠️ Re-queue | CSS stripped; re-queue pending |
| 3 | [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | L2 Understand | ✅ Approved | worked-example→faded→practice scaffold |
| 4 | [find-triangle-side](find-triangle-side/index.md) | L3 Apply | ✅ Approved | two-step: ratio MCQ + typed computation |
| 5 | [real-world-problem](real-world-problem/index.md) | L4 Analyze | 📋 Spec ready | word-problem-three-step; queue after #2 |

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

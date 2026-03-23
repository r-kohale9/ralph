# Adjustment Strategy

**Game ID:** `adjustment-strategy`
**Session:** Standalone
**Bloom Level:** TBD
**Interaction Type:** Number adjuster + sum input

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ✅ Approved — Build #385 (2026-03-20) |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | Low — CDN init failures masking real pass rate |
| **GCP URL** | https://storage.googleapis.com/mathai-temp-assets/games/adjustment-strategy/builds/385/index.html |

### Action Required

> Gen Quality: reinforce `waitForPackages()` timeout (120000ms) and `await transitionScreen.show()` rules before re-queuing. Do not queue speculatively — see RCA.

---

## Build History

| Build # | Date | Status | Iterations | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|---------|-------|
| #385 | 2026-03-20 | ✅ Approved | 0 | ~30 min | APPROVED | CDN warm from prior runs; 3 static errors still present |
| #383 | 2026-03-20 | ❌ Killed | 0 | ~29 min | Killed | Pipeline bug: skip_test corrupted HTML across all 5 categories (CODE-001) |
| #381 | 2026-03-20 | ❌ Failed | 0 | ~40 min | 0% pass rate | 7 static errors; CDN timeout 10s; missing typeof guards; unawaited show() |
| #380 | 2026-03-20 | ❌ Killed | 0 | ~20 min | Killed | Worker auth config error (claude-opus-4-6 unavailable) |
| #376–378 | 2026-03-20 | ❌ Failed | 0 | — | 0% pass rate | test_results=[] — CDN never loaded (10s timeout expired in beforeEach) |
| #488 | 2026-03-21 | Cancelled | 0 | — | Cancelled | Scale run — game already approved |

*Total: 68 builds, 6 approved (8.8% — lowest approval rate in DB)*

---

## Step-Level Failure Analysis (Builds #376–381)

**Root cause:** `waitForPackages()` timeout = 10000ms (must be 120000ms). CDN cold-start in Playwright takes 30–120s. Timeout fires → "Packages failed to load" → `beforeEach` throws → every test in every batch fails with `toBeVisible` before any game interaction.

**Compounding:** `transitionScreen.show()` calls not awaited (3/3) → CDN state machine corruption → button stays `visibility:hidden` → `#mathai-transition-slot button` timeout in mechanics tests.

**Build #381 — specific failure evidence:**
- `game-flow`: `data-phase="game_init"` received, expected `"start_screen"` — page mid-init
- `mechanics`: `locator('#mathai-transition-slot button')` timeout 15000ms — transition screen button never visible
- `contract`, `level-progression`, `edge-cases`: all 0 pass

→ Full RCA: [`rca.md`](rca.md)

---

## UI/UX Audit

| Date | Critical | High | Medium | Low | Status |
|------|----------|------|--------|-----|--------|
| — | — | — | — | — | ❌ Not audited |

**Top open issues:** Audit not yet performed. Requires browser playthrough via `diagnostic.js` after gen rule fixes.

→ Full audit details: [`ui-ux.md`](ui-ux.md)

---

## Log Paths

| Artifact | Path |
|----------|------|
| Spec | [`spec.md`](spec.md) |
| RCA | [`rca.md`](rca.md) |
| UI/UX Audit | [`ui-ux.md`](ui-ux.md) |
| Build History | [`build-log.md`](build-log.md) |
| GCP HTML (approved #385) | https://storage.googleapis.com/mathai-temp-assets/games/adjustment-strategy/builds/385/index.html |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #385 | 2026-03-20 | Automated (LLM review) | iterations=0; CDN was warm from prior builds; 3 static errors still present in approved HTML |

---

## Design Rationale

*See [`spec.md`](spec.md) for full game design and part selections.*

Two numbers shown with independent +/− buttons. User adjusts to make mental addition easier (e.g., 47+33 → 50+30), then types the sum and taps Check. 9 rounds, 3 levels, 3 lives. Stars based on average time per level.

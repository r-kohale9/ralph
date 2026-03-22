# RCA: sequence-builder

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|-----------|--------|
| #522 | iter=0 failed | Claude CLI OAuth blocked on server — build never ran | Fixed (switched to Gemini gen model) |
| #525 | Contract failed 3×; global fix loop likely failing | CDN cold-start timing — waitForPackages() 120s timeout races against ~150s CDN cold-start | In progress |

## 1. Root Cause

Build #525 contract test fails because `#mathai-transition-slot` never gets populated with the "Let's go!" start button. The DOMContentLoaded handler calls `waitForPackages()` with a 120s timeout. On GCP server, CDN cold-start takes ~150s. `waitForPackages()` times out after 120s, throws "Packages failed to load within 120s", sets `window.__initError`, and the `transitionScreen.show()` call (which injects the start button) is never reached. The Playwright contract test's `beforeEach` polls for `#mathai-transition-slot button` for 160s, finds nothing, and times out.

Identical pattern to Lesson 91 (count-and-tap: both tests pass locally, server failure was CDN cold-start exceeding 50s beforeEach timeout).

## 2. Evidence of Root Cause

- Contract triage message: "start button never appears, indicating critical initialization failure"
- Fix loop applied 3 contract iterations: fix1 and fix2 have byte-for-byte identical DOMContentLoaded init logic — only CSS was stripped
- HTML is architecturally correct: `ScreenLayout.inject()` with slots wrapper (Rule 008), `await transitionScreen.show()` with button, `waitForPackages()` checking all 6 CDN packages
- The fix loop cannot fix CDN timing — the HTML is not the bug
- GCP CDN cold-start measured at ~150s (Lesson 91, count-and-tap build #457)
- Symptom: "start button never appears" = waitForPackages() timeout fires before CDN loads → transitionScreen.show() never called

## 3. POC Fix Verification

PENDING — local test not yet run. To verify:
1. `curl -s "https://storage.googleapis.com/mathai-temp-assets/games/sequence-builder/builds/525/index.html" -o /tmp/sequence-builder.html`
2. Run `node diagnostic.js` — if start button appears within 5s locally, root cause is confirmed as server CDN cold-start (not HTML)
3. If start button appears locally: same fix as count-and-tap applies (CDN warm-up issue on server)

Hypothesis: start button WILL appear locally within 2-3s (CDN already warm on local connection or different CDN routing).

## 4. Reliability Reasoning

CDN cold-start is a server-environment issue, not an HTML determinism issue. Once CDN is warm (subsequent builds), the game should pass. This explains the sequence:
- Build #522: failed at iter=0 (Claude CLI auth — unrelated)
- Build #525: passed smoke check (CDN was warm enough for #gameContent), but contract tests run in a fresh Playwright page → CDN cold-start again

Fix: increase `waitForPackages()` timeout from 120s → 180s (matches or exceeds CDN cold-start window). This is a gen prompt rule change: GEN rule for CDN games — waitForPackages timeout must be ≥180s.

## 5. Go/No-Go for E2E

NOT READY — POC not yet run. Blocker: local diagnostic test pending.

However: a re-queue after waitForPackages timeout increase (prompt rule) is reasonable given the clear CDN timing root cause.

## Manual Run Findings

Pending — analysis was static HTML read only (not browser run). Local diagnostic needed to confirm CDN timing hypothesis.

## Targeted Fix Summary

Build #525 global fix loop will likely fail (same CDN timing root cause, LLM cannot increase a timeout it doesn't know is the problem).

Recommended next action after #525 fails:
1. Add gen prompt rule: CDN games must use `waitForPackages()` timeout ≥ 180000ms (180s)
2. Re-queue sequence-builder — with 180s timeout, CDN cold-start should complete within window
3. Run local diagnostic to confirm start button appears in <5s locally

# Per-Spec RCA Template

Each file (`docs/spec_rca/<game-id>.md`) covers one game's full failure history.
A full E2E pipeline run costs ~30 min and ~$0.50 — never queue one until all 5 sections below are complete.

---

## 1. Root Cause

One-paragraph explanation of exactly why the game fails. Must be specific and falsifiable.

## 2. Evidence of Root Cause

Concrete artifacts proving the root cause — NOT reading the HTML alone:
- Error messages / stack traces from console or journalctl
- Playwright screenshots showing the actual browser state
- DB query results (gameStateShape, test_results JSON, error_message)
- Network tab: which URLs 404'd, which loaded
- node -p outputs showing exact return values

## 3. POC Fix Verification (REQUIRED before E2E)

How you verified the fix WITHOUT running the full E2E pipeline:
- Script that reproduces and then eliminates the failure locally
- diagnostic.js output before/after the fix
- node -e snippet that demonstrates the fix works
- Unit test that proves the fixed behavior

## 4. Reliability Reasoning

Why this fix will hold across multiple builds — not just the one you tested:
- Is the fix deterministic or probabilistic?
- What could cause it to regress?
- What edge cases remain unhandled?

## 5. Go/No-Go for E2E

Decision: READY FOR E2E or NOT READY + what's blocking.
Must show: evidence of root cause (§2) + POC verification (§3) both complete.

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|

## Manual Run Findings

(browser screenshots, console, network)

## Targeted Fix Summary

(what was tried, what failed, what worked)

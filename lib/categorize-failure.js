'use strict';

// ─── Failure categorization ────────────────────────────────────────────────
// Maps a free-text failure description to a canonical category string.
// Used by worker.js to tag learnings and failure patterns in the DB.
// Extracted here so tests can import it without loading the full worker.

function categorizeFailure(failureDesc) {
  const desc = failureDesc.toLowerCase();
  if (/render|dom|element|visible|display/.test(desc)) return 'rendering';
  if (/gamestate|state|init/.test(desc)) return 'state';
  if (/score|star|progress/.test(desc)) return 'scoring';
  if (/timer|timeout|countdown/.test(desc)) return 'timing';
  if (/click|input|touch|interact/.test(desc)) return 'interaction';
  if (/postmessage|message|event/.test(desc)) return 'messaging';
  if (/layout|responsive|width|480/.test(desc)) return 'layout';
  if (/endgame|complete|finish/.test(desc)) return 'completion';
  // CT8: expect.poll() returns Expect object, not callback value — .type throws TypeError
  // Fix: replace `await expect.poll(...)` with waitForFunction + page.evaluate pattern
  if (/Cannot read properties of undefined \(reading 'type'\)/i.test(failureDesc)) return 'state';
  if (/undefined|null|cannot read prop|typeerror/.test(desc)) return 'state';
  if (/lives|wrong answer|correct answer|retry|interaction/.test(desc)) return 'interaction';
  if (/victory|game over|out of lives|completion/.test(desc)) return 'completion';
  if (/cannot find module|module not found|require/.test(desc)) return 'infra';
  // Playwright assertion failures — content/text mismatch → rendering
  if (/tohavetext|tocontaintext|tobevisible|tohidden|tohavetitle/.test(desc)) return 'rendering';
  // Playwright locator failures — element not found
  if (/locator\.|locator\(|expect\(locator/.test(desc)) return 'rendering';
  // Generic Playwright expect failures (toBe, toEqual, toStrictEqual, etc.)
  // Only match expect(received) — Playwright's own assertion diff format.
  // Broader "expect(" would mis-classify natural English like "Expected round counter to increment".
  if (/expect\(received\)/.test(desc)) return 'rendering';
  if (/expected:\s*\d.*received:\s*\d/i.test(desc)) return 'rendering';  // Playwright short-form numeric diff
  if (/expected:\s*[\d"'][\s\S]*?received:\s*[\d"']/i.test(failureDesc)) return 'rendering';  // CR-058: multi-line Playwright numeric diff
  // page.evaluate errors → state inspection failure
  if (/page\.evaluate|evaluate:/.test(desc)) return 'state';
  // Missing test file → infra
  if (/\.spec\.js|spec file|test file/.test(desc)) return 'infra';
  // Playwright navigation/load failures
  if (/navigation|net::err|failed to load|page.*crash|browsercontext/.test(desc)) return 'infra';
  // Life / answer / round interaction patterns (short test names without error bodies)
  if (/life loss|wrong answer|correct answer|round|level transition|answer submission/.test(desc)) return 'interaction';
  // Victory / completion short patterns
  if (/victory flow|game over|out of lives|completion flow/.test(desc)) return 'completion';
  // Adjustment / reset / game mechanic patterns
  if (/adjustment|reset button|restart button|check button/.test(desc)) return 'interaction';
  // LP-1: RangeError from progressBar.update(totalRounds) — page crashes → rendering failure
  if (/rangeerror|invalid count value/.test(desc)) return 'rendering';
  // Fallback: any remaining Playwright error type strings
  if (/error:|typeerror:|timeouterror:|assertionerror:/.test(desc)) return 'state';
  return 'unknown';
}

module.exports = { categorizeFailure };

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lintGeneratedTests() in lib/pipeline-test-gen.js
//
// Validates that each lint rule fires on matching content and is silent on
// clean content. Each test constructs a minimal fake test file and asserts
// the expected violation count and rule IDs.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lintGeneratedTests } = require('../lib/pipeline-test-gen');

// Silence lint WARN output during tests
const silentLog = () => {};

describe('lintGeneratedTests — M13: immediate getLives/getScore/getRound assertion', () => {
  it('flags getLives() directly chained to .toBe()', () => {
    const content = `
test('lives check', async ({ page }) => {
  const lives = await getLives(page);
  expect(lives).toBe(3);
});
`;
    // M13 regex checks for getLives(...).toBe — this pattern has the value extracted first,
    // then asserted. The lint rule catches the chained form: getLives(page).toBe(...)
    const chainedContent = `
test('lives check', async ({ page }) => {
  expect(await getLives(page)).toBe(3);
});
`;
    // The pattern requires the method call directly followed by .toBe on the same line
    const directContent = `  expect(getLives(page)).toBe(3);`;
    const { violations } = lintGeneratedTests({ mechanics: directContent }, silentLog);
    const m13 = violations.filter((v) => v.rule === 'M13');
    assert.equal(m13.length, 1, 'Should flag M13 for immediate getLives().toBe()');
    assert.equal(m13[0].category, 'mechanics');
  });

  it('does not flag getLives inside expect.poll()', () => {
    const content = `
test('lives check', async ({ page }) => {
  await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(3);
});
`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const m13 = violations.filter((v) => v.rule === 'M13');
    assert.equal(m13.length, 0, 'Should not flag M13 when inside expect.poll()');
  });
});

describe('lintGeneratedTests — M15: immediate .toHaveClass on await page.locator()', () => {
  it('flags expect(await page.locator(...)).toHaveClass()', () => {
    const content = `  expect(await page.locator('.answer-btn')).toHaveClass('correct');`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const m15 = violations.filter((v) => v.rule === 'M15');
    assert.equal(m15.length, 1, 'Should flag M15 for expect(await page.locator()).toHaveClass()');
  });

  it('flags expect(await page.locator(...)).toHaveClass() for any class name', () => {
    const content = `  expect(await page.locator('#option-0')).toHaveClass('active');`;
    const { violations } = lintGeneratedTests({ 'edge-cases': content }, silentLog);
    const m15 = violations.filter((v) => v.rule === 'M15');
    assert.equal(m15.length, 1, 'Should flag M15 for .toHaveClass() on awaited locator');
    assert.equal(m15[0].category, 'edge-cases');
  });

  it('does not flag expect.poll() with class check — already wrapped', () => {
    const content = `  await expect.poll(() => page.locator('.btn').getAttribute('class')).toContain('active');`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const m15 = violations.filter((v) => v.rule === 'M15');
    assert.equal(m15.length, 0, 'Should not flag M15 when using expect.poll()');
  });

  it('does not flag expect(locator).toHaveClass() without await — Playwright auto-retries', () => {
    const content = `  await expect(page.locator('.btn')).toHaveClass('active');`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const m15 = violations.filter((v) => v.rule === 'M15');
    assert.equal(m15.length, 0, 'Should not flag M15 when locator is not awaited');
  });
});

describe('lintGeneratedTests — HARDCODED_TIMEOUT: page.waitForTimeout(N)', () => {
  it('flags page.waitForTimeout(1000)', () => {
    const content = `  await page.waitForTimeout(1000);`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ht = violations.filter((v) => v.rule === 'HARDCODED_TIMEOUT');
    assert.equal(ht.length, 1, 'Should flag HARDCODED_TIMEOUT for page.waitForTimeout(1000)');
  });

  it('flags page.waitForTimeout(500) in mechanics', () => {
    const content = `  await page.waitForTimeout(500);`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const ht = violations.filter((v) => v.rule === 'HARDCODED_TIMEOUT');
    assert.equal(ht.length, 1, 'Should flag HARDCODED_TIMEOUT for page.waitForTimeout(500)');
  });

  it('does not flag waitForPhase() — correct approach', () => {
    const content = `  await waitForPhase(page, 'gameover');`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ht = violations.filter((v) => v.rule === 'HARDCODED_TIMEOUT');
    assert.equal(ht.length, 0, 'Should not flag HARDCODED_TIMEOUT for waitForPhase()');
  });
});

describe('lintGeneratedTests — RAW_CLICK: page.click() old API', () => {
  it('flags await page.click("selector")', () => {
    const content = `  await page.click('#submit-btn');`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const rc = violations.filter((v) => v.rule === 'RAW_CLICK');
    assert.equal(rc.length, 1, 'Should flag RAW_CLICK for await page.click()');
  });

  it('flags await page.click() with any selector', () => {
    const content = `  await page.click('.answer-option');`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const rc = violations.filter((v) => v.rule === 'RAW_CLICK');
    assert.equal(rc.length, 1, 'Should flag RAW_CLICK for page.click() with class selector');
  });

  it('does not flag page.locator().click() — correct modern API', () => {
    const content = `  await page.locator('#submit-btn').click();`;
    const { violations } = lintGeneratedTests({ mechanics: content }, silentLog);
    const rc = violations.filter((v) => v.rule === 'RAW_CLICK');
    assert.equal(rc.length, 0, 'Should not flag RAW_CLICK for page.locator().click()');
  });
});

describe('lintGeneratedTests — CT6_NULL: getLastPostMessage() direct property access without null-guard', () => {
  it('flags getLastPostMessage(page).type — direct access without null-guard', () => {
    const content = `  const type = getLastPostMessage(page).type;`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ct6 = violations.filter((v) => v.rule === 'CT6_NULL');
    assert.equal(ct6.length, 1, 'Should flag CT6_NULL for getLastPostMessage().type without null-guard');
  });

  it('flags getLastPostMessage(page).payload direct access', () => {
    const content = `  expect(getLastPostMessage(page).score).toBe(10);`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ct6 = violations.filter((v) => v.rule === 'CT6_NULL');
    assert.equal(ct6.length, 1, 'Should flag CT6_NULL for getLastPostMessage().score without null-guard');
  });

  it('does not flag getLastPostMessage(page)?.type — optional chaining is safe', () => {
    const content = `  const type = getLastPostMessage(page)?.type;`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ct6 = violations.filter((v) => v.rule === 'CT6_NULL');
    assert.equal(ct6.length, 0, 'Should not flag CT6_NULL when using optional chaining (?.)');
  });

  it('does not flag getLastPostMessage(page) assigned to variable — no direct access on same line', () => {
    const content = `  const msg = getLastPostMessage(page);`;
    const { violations } = lintGeneratedTests({ contract: content }, silentLog);
    const ct6 = violations.filter((v) => v.rule === 'CT6_NULL');
    assert.equal(ct6.length, 0, 'Should not flag CT6_NULL when result is assigned to variable');
  });
});

describe('lintGeneratedTests — TRANSITION_SLOT: #mathai-transition-slot button selector in non-CDN context', () => {
  it('flags #mathai-transition-slot button selector', () => {
    const content = `  await page.locator('#mathai-transition-slot button').click();`;
    const { violations } = lintGeneratedTests({ 'level-progression': content }, silentLog);
    const ts = violations.filter((v) => v.rule === 'TRANSITION_SLOT');
    assert.equal(ts.length, 1, 'Should flag TRANSITION_SLOT rule');
    assert.equal(ts[0].category, 'level-progression');
  });

  it('does not flag #mathai-transition-slot alone (without button)', () => {
    const content = `  const slot = page.locator('#mathai-transition-slot');`;
    const { violations } = lintGeneratedTests({ 'game-flow': content }, silentLog);
    const ts = violations.filter((v) => v.rule === 'TRANSITION_SLOT');
    assert.equal(ts.length, 0, 'Should not flag #mathai-transition-slot without button');
  });
});

describe('lintGeneratedTests — RULE-DUP: duplicate data-testid across categories', () => {
  it('flags duplicate data-testid values across two categories', () => {
    const mechanics = `  await page.locator('[data-testid="answer-btn"]').click();`;
    const contract = `  const btn = page.locator('[data-testid="answer-btn"]');`;
    const { violations } = lintGeneratedTests({ mechanics, contract }, silentLog);
    const dups = violations.filter((v) => v.rule === 'RULE-DUP');
    assert.equal(dups.length, 1, 'Should flag one RULE-DUP violation for duplicate testid');
  });

  it('does not flag unique data-testid values', () => {
    const mechanics = `  await page.locator('[data-testid="submit-btn"]').click();`;
    const contract = `  const btn = page.locator('[data-testid="answer-btn"]');`;
    const { violations } = lintGeneratedTests({ mechanics, contract }, silentLog);
    const dups = violations.filter((v) => v.rule === 'RULE-DUP');
    assert.equal(dups.length, 0, 'Should not flag unique data-testid values');
  });
});

describe('lintGeneratedTests — warningCount and return shape', () => {
  it('returns zero violations for clean test content', () => {
    const clean = `
test.describe('Clean mechanics', () => {
  test('answers correctly', async ({ page }) => {
    await startGame(page);
    await answer(page, true);
    await expect.poll(() => getScore(page), { timeout: 3000 }).toBeGreaterThan(0);
  });
});
`;
    const { violations, warningCount } = lintGeneratedTests({ mechanics: clean }, silentLog);
    assert.equal(warningCount, 0, 'Clean content should produce no violations');
    assert.deepEqual(violations, []);
  });

  it('warningCount matches violations array length', () => {
    const bad = `
  expect(btn).toHaveClass('correct');
  await waitForPhase(page, 'game_over');
`;
    const { violations, warningCount } = lintGeneratedTests({ mechanics: bad }, silentLog);
    assert.equal(warningCount, violations.length, 'warningCount must equal violations.length');
  });

  it('handles empty testFiles map gracefully', () => {
    const { violations, warningCount } = lintGeneratedTests({}, silentLog);
    assert.equal(warningCount, 0);
    assert.deepEqual(violations, []);
  });

  it('handles null/undefined content gracefully', () => {
    const { violations, warningCount } = lintGeneratedTests({ mechanics: null, contract: undefined }, silentLog);
    assert.equal(warningCount, 0);
    assert.deepEqual(violations, []);
  });
});

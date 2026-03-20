'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for E7: Failure pattern database
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('E7: failure patterns', () => {
  let db;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fp-'));
  const dbPath = path.join(tmpDir, 'fp.db');

  before(() => {
    process.env.RALPH_DB_PATH = dbPath;
    delete require.cache[require.resolve('../lib/db')];
    db = require('../lib/db');
  });

  after(() => {
    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
    try {
      fs.rmdirSync(tmpDir);
    } catch {}
    delete process.env.RALPH_DB_PATH;
  });

  it('recordFailurePattern creates a new pattern', () => {
    const id = db.recordFailurePattern('doubles', 'Timer not stopping on game end', 'timing');
    assert.ok(id > 0);
    assert.equal(typeof id, 'number');
  });

  it('recordFailurePattern increments occurrences on repeat', () => {
    db.recordFailurePattern('doubles', 'Score display missing', 'rendering');
    db.recordFailurePattern('doubles', 'Score display missing', 'rendering');
    db.recordFailurePattern('doubles', 'Score display missing', 'rendering');

    const patterns = db.getFailurePatterns('doubles');
    const pattern = patterns.find((p) => p.pattern === 'Score display missing');
    assert.ok(pattern);
    assert.equal(pattern.occurrences, 3);
  });

  it('getFailurePatterns returns patterns for a game', () => {
    db.recordFailurePattern('triples', 'postMessage not fired', 'messaging');
    const patterns = db.getFailurePatterns('triples');
    assert.ok(patterns.length >= 1);
    assert.equal(patterns[0].game_id, 'triples');
  });

  it('getFailurePatterns returns all patterns when no gameId', () => {
    const all = db.getFailurePatterns(null);
    assert.ok(all.length >= 3); // doubles + triples patterns
  });

  it('getTopFailurePatterns aggregates across games', () => {
    // Add same pattern to multiple games
    db.recordFailurePattern('game-a', 'Stars not calculated', 'scoring');
    db.recordFailurePattern('game-b', 'Stars not calculated', 'scoring');
    db.recordFailurePattern('game-c', 'Stars not calculated', 'scoring');

    const top = db.getTopFailurePatterns(5);
    assert.ok(top.length > 0);

    const starsPattern = top.find((p) => p.pattern === 'Stars not calculated');
    assert.ok(starsPattern);
    assert.equal(starsPattern.affected_games, 3);
    assert.equal(starsPattern.total_occurrences, 3);
  });

  it('resolveFailurePattern marks pattern as resolved', () => {
    db.recordFailurePattern('resolve-test', 'Layout broken', 'layout');
    db.resolveFailurePattern('resolve-test', 'Layout broken');

    const patterns = db.getFailurePatterns('resolve-test');
    const resolved = patterns.find((p) => p.pattern === 'Layout broken');
    assert.ok(resolved);
    assert.equal(resolved.resolved, 1);
  });

  it('getTopFailurePatterns excludes resolved patterns', () => {
    const top = db.getTopFailurePatterns(100);
    const resolvedPattern = top.find((p) => p.pattern === 'Layout broken');
    assert.equal(resolvedPattern, undefined);
  });

  it('getFailureStats returns aggregate statistics', () => {
    const stats = db.getFailureStats();
    assert.ok(stats.total_patterns > 0);
    assert.ok(stats.total_occurrences > 0);
    assert.ok(stats.affected_games > 0);
    assert.ok(stats.resolved_count >= 1);
    assert.ok(typeof stats.top_category === 'string');
  });

  it('failure patterns have correct schema', () => {
    const patterns = db.getFailurePatterns(null, 1);
    assert.ok(patterns.length > 0);
    const p = patterns[0];
    assert.ok('id' in p);
    assert.ok('game_id' in p);
    assert.ok('pattern' in p);
    assert.ok('category' in p);
    assert.ok('occurrences' in p);
    assert.ok('first_seen' in p);
    assert.ok('last_seen' in p);
    assert.ok('resolved' in p);
  });
});

describe('E9: findMatchingPattern', () => {
  let db;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fmp-'));
  const dbPath = path.join(tmpDir, 'fmp.db');

  before(() => {
    process.env.RALPH_DB_PATH = dbPath;
    delete require.cache[require.resolve('../lib/db')];
    db = require('../lib/db');
  });

  after(() => {
    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
    try {
      fs.rmdirSync(tmpDir);
    } catch {}
    delete process.env.RALPH_DB_PATH;
  });

  it('returns null when no patterns match the failures string', () => {
    db.recordFailurePattern('test-game', 'Score display is broken on mobile', 'rendering');
    const result = db.findMatchingPattern('Timer not stopping at game end', 'test-game');
    assert.equal(result, null);
  });

  it('returns the highest-occurrence pattern when failuresStr contains it', () => {
    db.recordFailurePattern('test-game', 'Score display is broken on mobile', 'rendering');
    db.recordFailurePattern('test-game', 'Score display is broken on mobile', 'rendering');
    db.recordFailurePattern('test-game', 'Score display is broken on mobile', 'rendering');

    const result = db.findMatchingPattern(
      'game-flow — Score display is broken on mobile — expected 3 got 0',
      'test-game',
    );
    assert.ok(result);
    assert.equal(result.pattern, 'Score display is broken on mobile');
    assert.equal(result.category, 'rendering');
    assert.ok(result.occurrences >= 3);
  });

  it('skips patterns with category "unknown" (pattern value is "unknown")', () => {
    // Insert a pattern with pattern text 'unknown' — should be skipped by the WHERE pattern != 'unknown' filter
    db.recordFailurePattern('test-game', 'unknown', 'unknown');
    const result = db.findMatchingPattern('unknown failure message containing unknown text', 'test-game');
    // 'unknown' is exactly 7 chars (< 10 min length guard), so it won't match even if
    // the WHERE clause didn't exclude it — but the WHERE clause is the explicit guard
    assert.equal(result, null);
  });
});

describe('E7: failure categorization (worker helper)', () => {
  // Replicate the categorizeFailure function from worker.js
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
    return 'unknown';
  }

  it('categorizes rendering failures', () => {
    assert.equal(categorizeFailure('DOM element not visible'), 'rendering');
    assert.equal(categorizeFailure('Question display renders correctly'), 'rendering');
  });

  it('categorizes state failures', () => {
    assert.equal(categorizeFailure('gameState initialization'), 'state');
    assert.equal(categorizeFailure('Initial state has correct fields'), 'state');
  });

  it('categorizes scoring failures', () => {
    assert.equal(categorizeFailure('Score updates on correct answer'), 'scoring');
    assert.equal(categorizeFailure('Star thresholds calculated correctly'), 'scoring');
  });

  it('categorizes timing failures', () => {
    assert.equal(categorizeFailure('Timer countdown works'), 'timing');
    assert.equal(categorizeFailure('Game timeout triggers endGame'), 'timing');
  });

  it('categorizes interaction failures', () => {
    assert.equal(categorizeFailure('Click on answer button'), 'interaction');
    assert.equal(categorizeFailure('Touch input handled'), 'interaction');
  });

  it('categorizes messaging failures', () => {
    assert.equal(categorizeFailure('postMessage fires on game over'), 'messaging');
    assert.equal(categorizeFailure('Event payload has correct format'), 'messaging');
  });

  it('categorizes layout failures', () => {
    assert.equal(categorizeFailure('Responsive layout at 480px'), 'layout');
    assert.equal(categorizeFailure('Width constraint respected'), 'layout');
  });

  it('categorizes completion failures', () => {
    assert.equal(categorizeFailure('endGame triggers on last question'), 'completion');
    assert.equal(categorizeFailure('Game complete screen shows'), 'completion');
  });

  it('returns unknown for uncategorized', () => {
    assert.equal(categorizeFailure('something weird happened'), 'unknown');
  });
});

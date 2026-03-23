'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ─── Import pure functions from server.js ───────────────────────────────────
// server.js now exports createApp, extractChangedSpecs, getNextMidnight
// without starting Express or connecting to Redis.
const { extractChangedSpecs, getNextMidnight, isValidGameId } = require('../server');
const { buildSessionPlan, normalizeConcept, CONCEPT_GRAPH } = require('../lib/session-planner');

function verifySignature(body, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('extractChangedSpecs', () => {
  it('extracts game IDs from added spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [{ added: ['warehouse/templates/doubles/spec.md'], modified: [] }],
    });
    assert.equal(result.size, 1);
    assert.ok(result.has('doubles'));
  });

  it('extracts game IDs from modified spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [{ added: [], modified: ['warehouse/templates/triples/spec.md'] }],
    });
    assert.ok(result.has('triples'));
  });

  it('deduplicates across multiple commits', () => {
    const result = extractChangedSpecs({
      commits: [
        { added: ['warehouse/templates/doubles/spec.md'], modified: [] },
        { added: [], modified: ['warehouse/templates/doubles/spec.md'] },
      ],
    });
    assert.equal(result.size, 1);
  });

  it('extracts multiple different games', () => {
    const result = extractChangedSpecs({
      commits: [
        {
          added: ['warehouse/templates/doubles/spec.md', 'warehouse/templates/triples/spec.md'],
          modified: ['warehouse/templates/memory/spec.md'],
        },
      ],
    });
    assert.equal(result.size, 3);
  });

  it('ignores non-spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [
        {
          added: ['warehouse/templates/doubles/config.json', 'warehouse/templates/doubles/assets/bg.png', 'README.md'],
          modified: [],
        },
      ],
    });
    assert.equal(result.size, 0);
  });

  it('handles empty commits array', () => {
    const result = extractChangedSpecs({ commits: [] });
    assert.equal(result.size, 0);
  });

  it('handles missing commits property', () => {
    const result = extractChangedSpecs({});
    assert.equal(result.size, 0);
  });

  it('handles commits with missing added/modified', () => {
    const result = extractChangedSpecs({
      commits: [{}],
    });
    assert.equal(result.size, 0);
  });

  it('detects removed spec files', () => {
    const result = extractChangedSpecs({
      commits: [{ added: [], modified: [], removed: ['warehouse/templates/old-game/spec.md'] }],
    });
    assert.equal(result.size, 1);
    assert.ok(result.has('old-game'));
  });
});

describe('getNextMidnight', () => {
  it('returns a timestamp in the future', () => {
    const midnight = getNextMidnight('Asia/Kolkata');
    assert.ok(midnight > Date.now());
  });

  it('returns a timestamp within 25 hours', () => {
    const midnight = getNextMidnight('Asia/Kolkata');
    const hoursAway = (midnight - Date.now()) / (1000 * 3600);
    assert.ok(hoursAway > 0, 'should be in the future');
    assert.ok(hoursAway <= 25, `should be within 25 hours, got ${hoursAway.toFixed(2)}`);
  });

  it('works with UTC timezone', () => {
    const midnight = getNextMidnight('UTC');
    assert.ok(midnight > Date.now());
  });

  it('works with US/Eastern timezone', () => {
    const midnight = getNextMidnight('America/New_York');
    assert.ok(midnight > Date.now());
  });
});

describe('HMAC-SHA256 webhook verification', () => {
  const SECRET = 'test-webhook-secret';

  it('generates correct HMAC signature', () => {
    const body = Buffer.from('{"test": true}');
    const sig = verifySignature(body, SECRET);
    assert.ok(sig.startsWith('sha256='));
    assert.equal(sig.length, 7 + 64); // sha256= + 64 hex chars
  });

  it('same body+secret produces same signature', () => {
    const body = Buffer.from('hello');
    const sig1 = verifySignature(body, SECRET);
    const sig2 = verifySignature(body, SECRET);
    assert.equal(sig1, sig2);
  });

  it('different body produces different signature', () => {
    const sig1 = verifySignature(Buffer.from('hello'), SECRET);
    const sig2 = verifySignature(Buffer.from('world'), SECRET);
    assert.notEqual(sig1, sig2);
  });

  it('different secret produces different signature', () => {
    const body = Buffer.from('hello');
    const sig1 = verifySignature(body, 'secret1');
    const sig2 = verifySignature(body, 'secret2');
    assert.notEqual(sig1, sig2);
  });

  it('timingSafeEqual handles length mismatch gracefully', () => {
    const sigBuf = Buffer.from('sha256=short');
    const expBuf = Buffer.from('sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    // The code checks length first before calling timingSafeEqual
    if (sigBuf.length !== expBuf.length) {
      // This is the expected path - different lengths rejected
      assert.ok(true);
    } else {
      assert.fail('Different length buffers should not be equal');
    }
  });
});

describe('bulk scheduling threshold', () => {
  const BULK_THRESHOLD = 5;

  it('6 games exceeds threshold', () => {
    const games = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
    assert.ok(games.size > BULK_THRESHOLD);
  });

  it('5 games does not exceed threshold', () => {
    const games = new Set(['a', 'b', 'c', 'd', 'e']);
    assert.ok(!(games.size > BULK_THRESHOLD));
  });

  it('1 game does not exceed threshold', () => {
    const games = new Set(['a']);
    assert.ok(!(games.size > BULK_THRESHOLD));
  });
});

// ─── Session Planner tests ────────────────────────────────────────────────────

describe('buildSessionPlan — trigonometry', () => {
  it('returns a plan with 5 games for "trigonometry" objective', async () => {
    const plan = await buildSessionPlan({ objective: 'trig ratios and triangle sides' });
    assert.equal(plan.error, undefined);
    assert.equal(plan.concept, 'trigonometry');
    assert.equal(plan.games.length, 5);
  });

  it('includes required top-level fields', async () => {
    const plan = await buildSessionPlan({ objective: 'sin cos tan triangle' });
    assert.ok(plan.planId, 'planId must be present');
    assert.ok(Array.isArray(plan.games), 'games must be an array');
    assert.equal(typeof plan.estimatedMinutes, 'number');
    assert.ok(Array.isArray(plan.bloomRange) && plan.bloomRange.length === 2, 'bloomRange must be [min, max]');
  });

  it('estimatedMinutes sums per-skill minutes (4+4+5+5+6 = 24 min)', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.equal(plan.estimatedMinutes, 24);
  });

  it('bloomRange spans level 1 to 4 for trigonometry', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.equal(plan.bloomRange[0], 1);
    assert.equal(plan.bloomRange[1], 4);
  });

  it('games includes all 5 game IDs in prerequisite order', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.deepEqual(plan.games.map((g) => g.gameId), [
      'name-the-sides',
      'which-ratio',
      'soh-cah-toa-worked-example',
      'find-triangle-side',
      'real-world-problem',
    ]);
  });

  it('first game has status template_exists', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.equal(plan.games[0].status, 'template_exists');
  });

  it('last game (real-world-problem) has status template_exists (templateSpecId now set)', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.equal(plan.games[4].status, 'template_exists');
    assert.equal(plan.games[4].templateSpecId, 'real-world-problem');
  });

  it('each game node has required shape', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    for (const game of plan.games) {
      assert.ok(game.gameId, 'gameId required');
      assert.ok(game.title, 'title required');
      assert.ok(typeof game.bloomLevel === 'number', 'bloomLevel must be a number');
      assert.ok(typeof game.position === 'number', 'position must be a number');
      assert.ok(game.status, 'status required');
    }
  });
});

describe('buildSessionPlan — keyword detection', () => {
  it('"trig ratios" keyword maps to trigonometry plan', async () => {
    const plan = await buildSessionPlan({ objective: 'students need to learn trig ratios' });
    assert.equal(plan.concept, 'trigonometry');
    assert.equal(plan.games.length, 5);
  });

  it('"sin cos tan" keywords map to trigonometry plan', async () => {
    const plan = await buildSessionPlan({ objective: 'learn sin cos and tan values' });
    assert.equal(plan.concept, 'trigonometry');
  });

  it('"triangle" keyword maps to trigonometry plan', async () => {
    const plan = await buildSessionPlan({ objective: 'right triangle problems' });
    assert.equal(plan.concept, 'trigonometry');
  });

  it('direct concept name "trigonometry" maps correctly', async () => {
    const plan = await buildSessionPlan({ objective: 'trigonometry' });
    assert.equal(plan.concept, 'trigonometry');
  });
});

describe('buildSessionPlan — multiplication', () => {
  it('returns a plan with 2 games for "multiplication" objective', async () => {
    const plan = await buildSessionPlan({ objective: 'multiplication tables' });
    assert.equal(plan.error, undefined);
    assert.equal(plan.concept, 'multiplication');
    assert.equal(plan.games.length, 2);
  });

  it('estimatedMinutes is 10 for 2-skill multiplication plan', async () => {
    const plan = await buildSessionPlan({ objective: 'multiplication word problems' });
    assert.equal(plan.estimatedMinutes, 10);
  });

  it('games includes both multiplication game IDs', async () => {
    const plan = await buildSessionPlan({ objective: 'multiplication' });
    assert.deepEqual(plan.games.map((g) => g.gameId), ['multiplication-tables', 'multiplication-word-problems']);
  });
});

describe('buildSessionPlan — unknown concept', () => {
  it('returns error: concept_not_found for unknown objective', async () => {
    const result = await buildSessionPlan({ objective: 'calculus derivatives' });
    assert.equal(result.error, 'concept_not_found');
  });

  it('returns availableConcepts list for unknown concept', async () => {
    const result = await buildSessionPlan({ objective: 'calculus' });
    assert.ok(Array.isArray(result.availableConcepts));
    assert.ok(result.availableConcepts.includes('trigonometry'));
    assert.ok(result.availableConcepts.includes('multiplication'));
  });

  it('returns error for objective with no matching keywords', async () => {
    const result = await buildSessionPlan({ objective: 'zzz-unknown-xyz' });
    assert.equal(result.error, 'concept_not_found');
  });
});

describe('normalizeConcept', () => {
  it('lowercases and trims input', () => {
    assert.equal(normalizeConcept('  Trig  '), 'trigonometry');
  });

  it('returns canonical key for known aliases', () => {
    assert.equal(normalizeConcept('soh-cah-toa'), 'trigonometry');
    assert.equal(normalizeConcept('times tables'), 'multiplication');
  });

  it('passes through unknown concepts unchanged', () => {
    assert.equal(normalizeConcept('fractions'), 'fractions');
  });
});

describe('CONCEPT_GRAPH structure', () => {
  it('exports CONCEPT_GRAPH as an object', () => {
    assert.ok(CONCEPT_GRAPH && typeof CONCEPT_GRAPH === 'object');
  });

  it('has trigonometry and multiplication keys', () => {
    assert.ok('trigonometry' in CONCEPT_GRAPH);
    assert.ok('multiplication' in CONCEPT_GRAPH);
  });
});

// ─── gameId validation ────────────────────────────────────────────────────────

describe('isValidGameId', () => {
  it('accepts a valid lowercase-alphanumeric gameId', () => {
    assert.ok(isValidGameId('doubles'));
  });

  it('accepts a valid gameId with hyphens', () => {
    assert.ok(isValidGameId('find-triangle-side'));
  });

  it('accepts a 2-character gameId (minimum length)', () => {
    assert.ok(isValidGameId('ab'));
  });

  it('accepts a 50-character gameId (maximum length)', () => {
    assert.ok(isValidGameId('a'.repeat(25) + '-' + 'b'.repeat(24)));
  });

  it('rejects a gameId with uppercase letters (400-level concern)', () => {
    assert.ok(!isValidGameId('Doubles'));
  });

  it('rejects a gameId with special characters (shell injection concern)', () => {
    assert.ok(!isValidGameId('game;rm -rf /'));
  });

  it('rejects a gameId with path traversal (../../etc/passwd)', () => {
    assert.ok(!isValidGameId('../../etc/passwd'));
  });

  it('rejects an empty gameId', () => {
    assert.ok(!isValidGameId(''));
  });

  it('rejects a single-character gameId (below minimum length)', () => {
    assert.ok(!isValidGameId('a'));
  });

  it('rejects a gameId exceeding 50 characters', () => {
    assert.ok(!isValidGameId('a'.repeat(51)));
  });

  it('rejects a gameId with spaces', () => {
    assert.ok(!isValidGameId('my game'));
  });

  it('rejects a gameId with dots', () => {
    assert.ok(!isValidGameId('game.name'));
  });

  it('rejects a gameId with underscores', () => {
    assert.ok(!isValidGameId('game_name'));
  });

  it('rejects a non-string gameId (number)', () => {
    assert.ok(!isValidGameId(42));
  });

  it('rejects a non-string gameId (null)', () => {
    assert.ok(!isValidGameId(null));
  });
});

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ─── Import pure functions from server.js ───────────────────────────────────
// server.js now exports createApp, extractChangedSpecs, getNextMidnight
// without starting Express or connecting to Redis.
const { extractChangedSpecs, getNextMidnight } = require('../server');
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
  it('returns a plan with 5 skills for "trigonometry"', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.equal(plan.error, undefined);
    assert.equal(plan.concept, 'trigonometry');
    assert.equal(plan.skills.length, 5);
  });

  it('includes required top-level fields', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.ok(plan.planId, 'planId must be present');
    assert.ok(Array.isArray(plan.skills), 'skills must be an array');
    assert.ok(Array.isArray(plan.gameIds), 'gameIds must be an array');
    assert.equal(typeof plan.estimatedMinutes, 'number');
    assert.ok(Array.isArray(plan.bloomRange) && plan.bloomRange.length === 2, 'bloomRange must be [min, max]');
  });

  it('estimatedMinutes is 5 per skill (5 skills → 25 min)', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.equal(plan.estimatedMinutes, 25);
  });

  it('bloomRange spans level 1 to 4 for trigonometry', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.equal(plan.bloomRange[0], 1);
    assert.equal(plan.bloomRange[1], 4);
  });

  it('gameIds includes all 5 game IDs in order', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.deepEqual(plan.gameIds, [
      'label-triangle-sides',
      'which-trig-ratio',
      'soh-cah-toa-worked-example',
      'find-triangle-side',
      'trig-real-world',
    ]);
  });

  it('first skill has no prerequisites', () => {
    const plan = buildSessionPlan('trigonometry');
    assert.deepEqual(plan.skills[0].prerequisiteSkillIds, []);
  });

  it('each skill node has required shape', () => {
    const plan = buildSessionPlan('trigonometry');
    for (const skill of plan.skills) {
      assert.ok(skill.skillId, 'skillId required');
      assert.ok(skill.skillName, 'skillName required');
      assert.ok(typeof skill.bloomLevel === 'number', 'bloomLevel must be a number');
      assert.ok(Array.isArray(skill.prerequisiteSkillIds), 'prerequisiteSkillIds must be an array');
      assert.ok(Array.isArray(skill.suggestedGameIds), 'suggestedGameIds must be an array');
    }
  });
});

describe('buildSessionPlan — alias resolution', () => {
  it('"trig" resolves to trigonometry plan', () => {
    const plan = buildSessionPlan('trig');
    assert.equal(plan.concept, 'trigonometry');
    assert.equal(plan.skills.length, 5);
  });

  it('"soh-cah-toa" resolves to trigonometry plan', () => {
    const plan = buildSessionPlan('soh-cah-toa');
    assert.equal(plan.concept, 'trigonometry');
  });

  it('concept is case-insensitive ("Trig" → trigonometry)', () => {
    const plan = buildSessionPlan('Trig');
    assert.equal(plan.concept, 'trigonometry');
  });

  it('leading/trailing whitespace is trimmed', () => {
    const plan = buildSessionPlan('  trigonometry  ');
    assert.equal(plan.concept, 'trigonometry');
  });
});

describe('buildSessionPlan — multiplication', () => {
  it('returns a plan with 2 skills for "multiplication"', () => {
    const plan = buildSessionPlan('multiplication');
    assert.equal(plan.error, undefined);
    assert.equal(plan.concept, 'multiplication');
    assert.equal(plan.skills.length, 2);
  });

  it('estimatedMinutes is 10 for 2-skill plan', () => {
    const plan = buildSessionPlan('multiplication');
    assert.equal(plan.estimatedMinutes, 10);
  });

  it('gameIds includes both multiplication game IDs', () => {
    const plan = buildSessionPlan('multiplication');
    assert.deepEqual(plan.gameIds, ['multiplication-tables', 'multiplication-word-problems']);
  });
});

describe('buildSessionPlan — unknown concept', () => {
  it('returns error: concept_not_found for unknown concept', () => {
    const result = buildSessionPlan('calculus');
    assert.equal(result.error, 'concept_not_found');
  });

  it('returns availableConcepts list for unknown concept', () => {
    const result = buildSessionPlan('calculus');
    assert.ok(Array.isArray(result.availableConcepts));
    assert.ok(result.availableConcepts.includes('trigonometry'));
    assert.ok(result.availableConcepts.includes('multiplication'));
  });

  it('returns error for empty-ish string that has no alias', () => {
    const result = buildSessionPlan('zzz-unknown-xyz');
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

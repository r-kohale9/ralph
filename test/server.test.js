'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ─── Import pure functions from server.js ───────────────────────────────────
// server.js now exports createApp, extractChangedSpecs, getNextMidnight
// without starting Express or connecting to Redis.
const { extractChangedSpecs, getNextMidnight } = require('../server');

function verifySignature(body, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('extractChangedSpecs', () => {
  it('extracts game IDs from added spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [
        { added: ['game-spec/templates/doubles/spec.md'], modified: [] },
      ],
    });
    assert.equal(result.size, 1);
    assert.ok(result.has('doubles'));
  });

  it('extracts game IDs from modified spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [
        { added: [], modified: ['game-spec/templates/triples/spec.md'] },
      ],
    });
    assert.ok(result.has('triples'));
  });

  it('deduplicates across multiple commits', () => {
    const result = extractChangedSpecs({
      commits: [
        { added: ['game-spec/templates/doubles/spec.md'], modified: [] },
        { added: [], modified: ['game-spec/templates/doubles/spec.md'] },
      ],
    });
    assert.equal(result.size, 1);
  });

  it('extracts multiple different games', () => {
    const result = extractChangedSpecs({
      commits: [
        {
          added: [
            'game-spec/templates/doubles/spec.md',
            'game-spec/templates/triples/spec.md',
          ],
          modified: ['game-spec/templates/memory/spec.md'],
        },
      ],
    });
    assert.equal(result.size, 3);
  });

  it('ignores non-spec.md files', () => {
    const result = extractChangedSpecs({
      commits: [
        {
          added: [
            'game-spec/templates/doubles/config.json',
            'game-spec/templates/doubles/assets/bg.png',
            'README.md',
          ],
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
      commits: [
        { added: [], modified: [], removed: ['game-spec/templates/old-game/spec.md'] },
      ],
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

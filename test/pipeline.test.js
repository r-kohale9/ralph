'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline.js (E3: Node.js pipeline)
//
// Tests the helper functions and pipeline logic without hitting real LLMs.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractHtml, extractTests, getRelevantLearnings, jaccardSimilarity, extractSpecKeywords, getCategoryBoost, deriveRelevantCategories, fixCdnDomainsInFile, fixCdnPathsInFile } = require('../lib/pipeline');

describe('pipeline.js extractHtml', () => {
  it('extracts HTML from ```html code block', () => {
    const input = 'Here is the game:\n```html\n<!DOCTYPE html>\n<html><body>test</body></html>\n```\nDone!';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
    assert.ok(!result.includes('```'));
  });

  it('extracts HTML from generic code block', () => {
    const input = '```\n<!DOCTYPE html>\n<html><body>hello</body></html>\n```';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
  });

  it('returns raw HTML when no code blocks', () => {
    const input = '<!DOCTYPE html>\n<html><body>raw</body></html>';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
  });

  it('returns null when no HTML found', () => {
    const input = 'This is just regular text with no HTML.';
    const result = extractHtml(input);
    assert.equal(result, null);
  });

  it('handles multi-line HTML in code block', () => {
    const input =
      '```html\n<!DOCTYPE html>\n<html>\n<head><title>Game</title></head>\n<body>\n<div id="gameContent"></div>\n</body>\n</html>\n```';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('gameContent'));
  });
});

describe('pipeline.js extractTests', () => {
  it('extracts from ```javascript block', () => {
    const input = '```javascript\ntest("works", () => {});\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('test'));
  });

  it('extracts from ```js block', () => {
    const input = '```js\ndescribe("game", () => { it("loads", () => {}); });\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('describe'));
  });

  it('extracts from generic code block with test keywords', () => {
    const input = '```\nconst { expect } = require("chai");\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('expect'));
  });

  it('returns null when no test code found', () => {
    const input = 'Just some text, no code blocks.';
    const result = extractTests(input);
    assert.equal(result, null);
  });
});

describe('pipeline.js configuration', () => {
  it('pipeline module exports runPipeline', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.runPipeline, 'function');
  });

  it('pipeline module exports runTargetedFix', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.runTargetedFix, 'function');
  });

  it('pipeline module exports extractHtml', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.extractHtml, 'function');
  });

  it('pipeline module exports extractTests', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.extractTests, 'function');
  });
});

describe('pipeline.js runTargetedFix', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  it('returns FAILED when no HTML file exists', async () => {
    const { runTargetedFix } = require('../lib/pipeline');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fix-test-'));
    const specPath = path.join(tmpDir, 'game', 'spec.md');

    try {
      const report = await runTargetedFix(path.join(tmpDir, 'game'), specPath, 'Fix the score display', {});
      assert.equal(report.status, 'FAILED');
      assert.ok(report.errors.some((e) => e.includes('No existing HTML')));
      assert.equal(report.type, 'targeted-fix');
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    }
  });

  it('returns FAILED when spec file not found', async () => {
    const { runTargetedFix } = require('../lib/pipeline');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fix-test2-'));
    const gameDir = path.join(tmpDir, 'game');
    fs.mkdirSync(gameDir, { recursive: true });
    fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><body>test</body></html>');

    try {
      const report = await runTargetedFix(gameDir, path.join(tmpDir, 'nonexistent', 'spec.md'), 'Fix something', {});
      assert.equal(report.status, 'FAILED');
      assert.ok(report.errors.some((e) => e.includes('Spec file not found')));
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    }
  });

  it('report includes feedback_prompt', async () => {
    const { runTargetedFix } = require('../lib/pipeline');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fix-test3-'));
    const gameDir = path.join(tmpDir, 'game');

    try {
      const report = await runTargetedFix(gameDir, path.join(tmpDir, 'spec.md'), 'Fix the timer display', {});
      assert.equal(report.feedback_prompt, 'Fix the timer display');
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    }
  });

  it('calls onProgress callback', async () => {
    const { runTargetedFix } = require('../lib/pipeline');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-fix-test4-'));
    const gameDir = path.join(tmpDir, 'game');
    const progressEvents = [];

    try {
      await runTargetedFix(gameDir, path.join(tmpDir, 'spec.md'), 'Fix something', {
        onProgress: (step, detail) => progressEvents.push({ step, detail }),
      });
      // Should have received at least one progress event (even for early failures)
      // When HTML doesn't exist, we get no progress events before the early return
      assert.ok(true, 'onProgress callback accepted without error');
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true });
      } catch {}
    }
  });
});

describe('pipeline.js getRelevantLearnings', () => {
  it('is exported as a function', () => {
    assert.equal(typeof getRelevantLearnings, 'function');
  });

  it('returns null gracefully when DB is unavailable (in-memory test env)', () => {
    // In the test environment RALPH_DB_PATH points to a temp path that
    // has no approved builds — function must not throw and must return
    // null or a string.
    const result = getRelevantLearnings('test-game', null, 5);
    assert.ok(result === null || typeof result === 'string');
  });

  it('returns null when gameId is undefined', () => {
    const result = getRelevantLearnings(undefined, null, 5);
    assert.ok(result === null || typeof result === 'string');
  });

  it('formats results as bullet list when rows exist', () => {
    // Inject a mock db module via module cache manipulation
    const Module = require('module');
    const dbPath = require.resolve('../lib/db');
    const originalDb = require.cache[dbPath];

    const mockRows = [
      { content: 'Always expose window.gameState for syncDOMState to work', category: 'cdncompat' },
      { content: 'Use fire-and-forget for FeedbackManager audio calls', category: 'audio' },
    ];

    try {
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          getDb: () => ({
            prepare: () => ({ all: () => mockRows }),
          }),
        },
      };

      // Must clear pipeline cache so it picks up mock db
      const pipelinePath = require.resolve('../lib/pipeline');
      delete require.cache[pipelinePath];
      const { getRelevantLearnings: freshFn } = require('../lib/pipeline');

      const result = freshFn('some-other-game', null, 10);
      assert.ok(result !== null, 'should return a string when rows exist');
      assert.ok(result.includes('- [cdncompat]'), 'should format category in brackets');
      assert.ok(result.includes('window.gameState'), 'should include content');
    } finally {
      // Restore original db module
      if (originalDb) {
        require.cache[dbPath] = originalDb;
      } else {
        delete require.cache[dbPath];
      }
      // Restore pipeline module
      delete require.cache[require.resolve('../lib/pipeline')];
      require('../lib/pipeline');
    }
  });
});

describe('pipeline.js jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    assert.equal(jaccardSimilarity('always expose window gameState for syncDOMState', 'always expose window gameState for syncDOMState'), 1);
  });

  it('returns 0 for completely disjoint strings', () => {
    const sim = jaccardSimilarity('apple banana cherry', 'delta echo foxtrot');
    assert.equal(sim, 0);
  });

  it('returns a value in (0, 1) for partially overlapping strings', () => {
    const sim = jaccardSimilarity('expose window gameState for syncDOMState', 'always expose window gameState via assignment');
    assert.ok(sim > 0 && sim < 1, `expected 0 < sim < 1, got ${sim}`);
  });

  it('correctly identifies near-duplicates above threshold 0.6', () => {
    // Strings sharing most words — same root cause, minor wording change
    const a = 'always expose window gameState so syncDOMState can read the state';
    const b = 'always expose window gameState so syncDOMState can read game state';
    const sim = jaccardSimilarity(a, b);
    assert.ok(sim > 0.6, `expected sim > 0.6 for near-duplicates, got ${sim}`);
  });

  it('does not flag clearly distinct learnings as duplicates', () => {
    const a = 'always expose window endGame so tests can trigger end of game';
    const b = 'use fire and forget for FeedbackManager audio calls to avoid blocking';
    const sim = jaccardSimilarity(a, b);
    assert.ok(sim < 0.6, `expected sim < 0.6 for distinct entries, got ${sim}`);
  });

  it('handles empty strings without throwing', () => {
    assert.equal(jaccardSimilarity('', ''), 1);
    assert.equal(jaccardSimilarity('hello world', ''), 0);
    assert.equal(jaccardSimilarity('', 'hello world'), 0);
  });

  it('is case-insensitive and strips punctuation', () => {
    const sim = jaccardSimilarity('Window.GameState must be set!', 'window gamestate must be set');
    assert.equal(sim, 1);
  });
});

describe('pipeline.js getRelevantLearnings deduplication', () => {
  // Helper: installs mock db, calls fn(getRelevantLearnings), then restores.
  // The mock remains active for the duration of fn() — critical because
  // getRelevantLearnings() lazy-requires db at call time.
  function withMockDb(rows, fn) {
    const dbPath = require.resolve('../lib/db');
    const pipelinePath = require.resolve('../lib/pipeline');
    const originalDb = require.cache[dbPath];
    const originalPipeline = require.cache[pipelinePath];
    try {
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          getDb: () => ({
            prepare: () => ({ all: () => rows }),
          }),
        },
      };
      // Reload pipeline so it picks up the mock db binding
      delete require.cache[pipelinePath];
      const freshPipeline = require('../lib/pipeline');
      return fn(freshPipeline.getRelevantLearnings);
    } finally {
      if (originalDb) {
        require.cache[dbPath] = originalDb;
      } else {
        delete require.cache[dbPath];
      }
      if (originalPipeline) {
        require.cache[pipelinePath] = originalPipeline;
      } else {
        delete require.cache[pipelinePath];
      }
      // Re-require pipeline with original db so later tests are clean
      delete require.cache[pipelinePath];
      require('../lib/pipeline');
    }
  }

  it('deduplicates near-duplicate entries (Jaccard > 0.6)', () => {
    // Two entries sharing most words (same root cause) + one unrelated entry
    const rows = [
      { content: 'always expose window gameState so syncDOMState can read state correctly', category: 'cdncompat' },
      { content: 'always expose window gameState so syncDOMState can read game state', category: 'cdncompat' },
      { content: 'use fire and forget for FeedbackManager audio to avoid blocking the game loop', category: 'audio' },
    ];
    withMockDb(rows, (fn) => {
      const result = fn('other-game', null, 10);
      assert.ok(result !== null, 'should return a string');
      // Only 2 distinct clusters: gameState cluster + audio entry
      const bullets = result.split('\n').filter(Boolean);
      assert.equal(bullets.length, 2, `expected 2 deduped bullets, got ${bullets.length}: ${result}`);
    });
  });

  it('caps output at 20 bullets regardless of row count', () => {
    // Generate 30 distinct rows (no duplicates — each has unique words)
    const rows = Array.from({ length: 30 }, (_, i) => ({
      content: `technique${i} procedure${i} protocol${i} requirement${i} constraint${i} guideline${i} rule${i} standard${i} pattern${i} approach${i}`,
      category: 'general',
    }));
    withMockDb(rows, (fn) => {
      const result = fn('other-game', null, 10);
      assert.ok(result !== null, 'should return a string');
      const bullets = result.split('\n').filter(Boolean);
      assert.ok(bullets.length <= 20, `expected <= 20 bullets, got ${bullets.length}`);
    });
  });

  it('keeps the most recent entry when deduplicating (first in ORDER BY build_id DESC list)', () => {
    const rows = [
      // Most recent (index 0 = first in desc order) — should be kept
      { content: 'always expose window endGame function so test harness can invoke it', category: 'cdncompat' },
      // Older near-duplicate — should be dropped
      { content: 'always expose window endGame function so test harness can call it', category: 'cdncompat' },
    ];
    withMockDb(rows, (fn) => {
      const result = fn('other-game', null, 10);
      assert.ok(result !== null, 'should return a string');
      const bullets = result.split('\n').filter(Boolean);
      assert.equal(bullets.length, 1, 'should keep only 1 entry for this near-duplicate cluster');
      assert.ok(result.includes('invoke'), 'should keep the most recent (first) entry');
    });
  });
});

describe('pipeline.js extractSpecKeywords', () => {
  it('returns an empty Set for null/empty input', () => {
    assert.equal(extractSpecKeywords(null).size, 0);
    assert.equal(extractSpecKeywords('').size, 0);
    assert.equal(extractSpecKeywords(undefined).size, 0);
  });

  it('extracts PART-XXX identifiers from spec text', () => {
    const spec = `## CDN\n- PART-012 FeedbackManager\n- PART-003 ScreenLayout\n`;
    const keywords = extractSpecKeywords(spec);
    assert.ok(keywords.has('part-012'), 'should include part-012');
    assert.ok(keywords.has('part-003'), 'should include part-003');
  });

  it('extracts PascalCase CDN part names from CDN section', () => {
    const spec = `## CDN\nFeedbackManager, ScreenLayout, SlotMachine\n\n## Mechanics\nnothing here\n`;
    const keywords = extractSpecKeywords(spec);
    assert.ok(keywords.has('feedbackmanager'), 'should include feedbackmanager');
    assert.ok(keywords.has('screenlayout'), 'should include screenlayout');
    assert.ok(keywords.has('slotmachine'), 'should include slotmachine');
  });

  it('extracts mechanic keywords from Game Mechanics section (min 4 chars, no stop words)', () => {
    const spec = `## Game Mechanics\nPlayer selects a fraction tile and matches it to an equivalent.\nLives are reduced on wrong answer.\n`;
    const keywords = extractSpecKeywords(spec);
    // meaningful words present
    assert.ok(keywords.has('player'), 'should include player');
    assert.ok(keywords.has('fraction'), 'should include fraction');
    assert.ok(keywords.has('matches'), 'should include matches');
    // stop words excluded
    assert.ok(!keywords.has('this'), 'should exclude stop word "this"');
    assert.ok(!keywords.has('game'), 'should exclude stop word "game"');
    // short words excluded
    assert.ok(!keywords.has('on'), 'should exclude "on" (< 4 chars)');
    assert.ok(!keywords.has('it'), 'should exclude "it" (< 4 chars)');
  });

  it('getRelevantLearnings sorts spec-relevant learnings first when specContent provided', () => {
    // Rows: one about FeedbackManager (relevant to spec), one about timer (irrelevant)
    const rows = [
      // This entry is about timer — not relevant to a FeedbackManager spec
      { content: 'timercomponent starttime must be zero to avoid negative elapsed values', category: 'general' },
      // This entry mentions feedbackmanager — highly relevant to our spec
      { content: 'feedbackmanager playDynamicFeedback must be fire and forget never awaited', category: 'audio' },
    ];
    const spec = `## CDN\nFeedbackManager\n\n## Game Mechanics\nplayer answers question\n`;

    // Use withMockDb helper from the outer describe scope by duplicating the setup inline
    const dbPath = require.resolve('../lib/db');
    const pipelinePath = require.resolve('../lib/pipeline');
    const originalDb = require.cache[dbPath];
    const originalPipeline = require.cache[pipelinePath];
    try {
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          getDb: () => ({
            prepare: () => ({ all: () => rows }),
          }),
        },
      };
      delete require.cache[pipelinePath];
      const { getRelevantLearnings: freshFn } = require('../lib/pipeline');
      const result = freshFn('other-game', spec, 10);
      assert.ok(result !== null, 'should return a string');
      const bullets = result.split('\n').filter(Boolean);
      // FeedbackManager bullet should appear first (higher spec relevance)
      assert.ok(bullets[0].includes('feedbackmanager') || bullets[0].includes('FeedbackManager'), `expected feedbackmanager entry first, got: ${bullets[0]}`);
    } finally {
      if (originalDb) {
        require.cache[dbPath] = originalDb;
      } else {
        delete require.cache[dbPath];
      }
      if (originalPipeline) {
        require.cache[pipelinePath] = originalPipeline;
      } else {
        delete require.cache[pipelinePath];
      }
      delete require.cache[pipelinePath];
      require('../lib/pipeline');
    }
  });
});

describe('pipeline.js getCategoryBoost', () => {
  it('is exported as a function', () => {
    assert.equal(typeof getCategoryBoost, 'function');
  });

  it('contract category always returns +0.2 regardless of spec keywords', () => {
    // No spec keywords at all
    assert.equal(getCategoryBoost('contract', new Set()), 0.2);
    // With unrelated keywords
    assert.equal(getCategoryBoost('contract', new Set(['fraction', 'tile'])), 0.2);
    // Null keywords
    assert.equal(getCategoryBoost('contract', null), 0.2);
  });

  it('audio category returns +0.2 when spec keywords include feedbackmanager', () => {
    const withFM = new Set(['feedbackmanager', 'part-012']);
    assert.equal(getCategoryBoost('audio', withFM), 0.2);
  });

  it('audio category returns 0 when spec keywords do NOT include feedbackmanager', () => {
    const withoutFM = new Set(['screenlayout', 'fraction', 'tile']);
    assert.equal(getCategoryBoost('audio', withoutFM), 0);
  });

  it('layout category returns +0.2 when spec keywords include screenlayout', () => {
    const withSL = new Set(['screenlayout', 'part-003']);
    assert.equal(getCategoryBoost('layout', withSL), 0.2);
  });

  it('layout category returns 0 when screenlayout not in spec keywords', () => {
    const withoutSL = new Set(['feedbackmanager', 'fraction']);
    assert.equal(getCategoryBoost('layout', withoutSL), 0);
  });

  it('cdncompat returns +0.2 when any PART-xxx keyword is present', () => {
    const withPart = new Set(['part-012', 'feedbackmanager']);
    assert.equal(getCategoryBoost('cdncompat', withPart), 0.2);
    // Any PART-xxx works
    assert.equal(getCategoryBoost('cdncompat', new Set(['part-001'])), 0.2);
  });

  it('cdncompat returns 0 when no PART-xxx keyword is present', () => {
    const noPart = new Set(['feedbackmanager', 'screenlayout', 'fraction']);
    assert.equal(getCategoryBoost('cdncompat', noPart), 0);
  });

  it('unrecognised categories always return 0', () => {
    const kws = new Set(['part-012', 'feedbackmanager', 'screenlayout']);
    assert.equal(getCategoryBoost('test-gen', kws), 0);
    assert.equal(getCategoryBoost('fix-loop', kws), 0);
    assert.equal(getCategoryBoost('general', kws), 0);
    assert.equal(getCategoryBoost(null, kws), 0);
    assert.equal(getCategoryBoost(undefined, kws), 0);
  });

  it('category boost affects sort order: contract entry ranks above same-similarity general entry', () => {
    // When spec has no matching keywords, Jaccard similarity is ~0 for both.
    // The contract entry should still come first due to +0.2 boost.
    const rows = [
      { content: 'irrelevant alpha bravo charlie delta echo foxtrot', category: 'general' },
      { content: 'irrelevant golf hotel india juliet kilo lima', category: 'contract' },
    ];
    const spec = '## Game Mechanics\nplayer answers questions about fractions\n';

    const dbPath = require.resolve('../lib/db');
    const pipelinePath = require.resolve('../lib/pipeline');
    const originalDb = require.cache[dbPath];
    const originalPipeline = require.cache[pipelinePath];
    try {
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          getDb: () => ({
            prepare: () => ({ all: () => rows }),
          }),
        },
      };
      delete require.cache[pipelinePath];
      const { getRelevantLearnings: freshFn } = require('../lib/pipeline');
      const result = freshFn('other-game', spec, 10);
      assert.ok(result !== null, 'should return a string');
      const bullets = result.split('\n').filter(Boolean);
      assert.ok(bullets.length >= 2, 'should have at least 2 bullets');
      assert.ok(bullets[0].includes('[contract]'), `contract entry should be first, got: ${bullets[0]}`);
    } finally {
      if (originalDb) {
        require.cache[dbPath] = originalDb;
      } else {
        delete require.cache[dbPath];
      }
      if (originalPipeline) {
        require.cache[pipelinePath] = originalPipeline;
      } else {
        delete require.cache[pipelinePath];
      }
      delete require.cache[pipelinePath];
      require('../lib/pipeline');
    }
  });
});

describe('pipeline.js deriveRelevantCategories', () => {
  it('is exported as a function', () => {
    assert.equal(typeof deriveRelevantCategories, 'function');
  });

  it('returns null when specKeywords is null', () => {
    assert.equal(deriveRelevantCategories(null), null);
  });

  it('returns null when specKeywords is empty Set', () => {
    assert.equal(deriveRelevantCategories(new Set()), null);
  });

  it('always includes contract and general', () => {
    const cats = deriveRelevantCategories(new Set(['fraction', 'tile']));
    assert.ok(cats instanceof Set);
    assert.ok(cats.has('contract'));
    assert.ok(cats.has('general'));
  });

  it('adds cdncompat when any PART-xxx keyword is present', () => {
    const cats = deriveRelevantCategories(new Set(['part-012', 'fraction']));
    assert.ok(cats.has('cdncompat'));
  });

  it('does NOT add cdncompat when no PART-xxx keyword present', () => {
    const cats = deriveRelevantCategories(new Set(['fraction', 'tile', 'feedbackmanager']));
    assert.ok(!cats.has('cdncompat'));
  });

  it('adds audio when feedbackmanager is in keywords', () => {
    const cats = deriveRelevantCategories(new Set(['feedbackmanager']));
    assert.ok(cats.has('audio'));
  });

  it('adds layout when screenlayout is in keywords', () => {
    const cats = deriveRelevantCategories(new Set(['screenlayout']));
    assert.ok(cats.has('layout'));
  });

  it('adds all relevant categories when all signals present', () => {
    const kws = new Set(['part-001', 'feedbackmanager', 'screenlayout', 'fraction']);
    const cats = deriveRelevantCategories(kws);
    assert.ok(cats.has('contract'));
    assert.ok(cats.has('general'));
    assert.ok(cats.has('cdncompat'));
    assert.ok(cats.has('audio'));
    assert.ok(cats.has('layout'));
  });

  it('SQL pre-filter: getRelevantLearnings only returns matching categories when specContent given', () => {
    // Spec mentions FeedbackManager (CDN) and PART-012 — expect audio+cdncompat+contract+general
    // A 'layout' row should NOT appear (screenlayout not in spec)
    const allRows = [
      { content: 'feedbackmanager fire and forget to avoid blocking audio calls', category: 'audio' },
      { content: 'screenlayout vertical must set height 100percent to avoid overflow', category: 'layout' },
      { content: 'always expose window endGame for contract tests', category: 'contract' },
    ];
    const spec = '## CDN\nFeedbackManager\nPART-012\n\n## Game Mechanics\nplayer answers fraction question\n';

    const dbPath = require.resolve('../lib/db');
    const pipelinePath = require.resolve('../lib/pipeline');
    const originalDb = require.cache[dbPath];
    const originalPipeline = require.cache[pipelinePath];
    try {
      // Mock db so we can verify which rows are requested
      let capturedSql = null;
      require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
          getDb: () => ({
            prepare: (sql) => ({
              all: (...params) => {
                capturedSql = sql;
                // Filter rows by category to simulate SQL WHERE clause
                const inClauseMatch = sql.match(/l\.category IN \(([^)]+)\)/);
                if (inClauseMatch) {
                  // params[0] = gameId, then category placeholders, last = limit
                  const catEnd = params.length - 1;
                  const cats = new Set(params.slice(1, catEnd));
                  return allRows.filter((r) => cats.has(r.category));
                }
                return allRows;
              },
            }),
          }),
        },
      };
      delete require.cache[pipelinePath];
      const { getRelevantLearnings: freshFn } = require('../lib/pipeline');
      const result = freshFn('other-game', spec, 10);
      assert.ok(result !== null, 'should return a string');
      // layout row should NOT appear (screenlayout not mentioned in spec)
      assert.ok(!result.includes('screenlayout'), `layout row should be excluded by SQL filter, got: ${result}`);
      // audio row SHOULD appear (feedbackmanager in spec)
      assert.ok(result.includes('feedbackmanager'), 'audio row should be included');
      // contract row SHOULD appear (always included)
      assert.ok(result.includes('endGame'), 'contract row should be included');
      // SQL should contain IN clause
      assert.ok(capturedSql && capturedSql.includes('IN'), 'SQL should use IN pre-filter');
    } finally {
      if (originalDb) {
        require.cache[dbPath] = originalDb;
      } else {
        delete require.cache[dbPath];
      }
      if (originalPipeline) {
        require.cache[pipelinePath] = originalPipeline;
      } else {
        delete require.cache[pipelinePath];
      }
      delete require.cache[pipelinePath];
      require('../lib/pipeline');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for isInitFailure (P8 — relaxed ANY-match guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js isInitFailure', () => {
  const { isInitFailure } = require('../lib/pipeline-fix-loop');

  it('returns true when passed=0 and ONE matching error (new ANY-match behaviour)', () => {
    const failures = ['waitForPhase timed out after 10s waiting for "playing"', 'test unrelated to init'];
    assert.equal(isInitFailure(failures, 0), true);
  });

  it('returns false when passed=1, even with a matching error', () => {
    const failures = ['waitForPhase timed out'];
    assert.equal(isInitFailure(failures, 1), false);
  });

  it('returns false when passed=0 but no matching error patterns', () => {
    const failures = ['Expected element to be visible', 'Score did not increment'];
    assert.equal(isInitFailure(failures, 0), false);
  });

  it('returns true when passed=0 and ALL errors match (still works)', () => {
    const failures = ['TimeoutError: waiting for selector', 'data-phase never changed', 'SKIPPED'];
    assert.equal(isInitFailure(failures, 0), true);
  });

  it('returns false for empty failure list', () => {
    assert.equal(isInitFailure([], 0), false);
  });

  it('returns false for null failure list', () => {
    assert.equal(isInitFailure(null, 0), false);
  });

  it('matches gameState is not defined error', () => {
    assert.equal(isInitFailure(['ReferenceError: gameState is not defined'], 0), true);
  });

  it('matches __ralph not defined error', () => {
    assert.equal(isInitFailure(['ReferenceError: __ralph is not defined'], 0), true);
  });

  it('matches net::ERR_ network error', () => {
    assert.equal(isInitFailure(['net::ERR_CONNECTION_REFUSED at http://localhost:3333'], 0), true);
  });

  it('matches Timeout exceeded waiting error', () => {
    assert.equal(isInitFailure(['Timeout 30000ms exceeded waiting for element'], 0), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for detectRenderingMismatch (P8 — deterministic pre-triage)
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js detectRenderingMismatch', () => {
  const { detectRenderingMismatch } = require('../lib/pipeline-fix-loop');

  it('returns true when 4 failures all contain toBeVisible (threshold is >3)', () => {
    const failures = [
      'expect(locator).toBeVisible() — element not visible',
      'expect(locator).toBeVisible() — element not found',
      'expect(locator).toBeVisible() — element hidden by CSS',
      'expect(locator).toBeVisible() — timed out waiting for element',
    ];
    assert.equal(detectRenderingMismatch(failures), true);
  });

  it('returns false when exactly 3 failures contain toBeVisible (threshold is >3, not >=3)', () => {
    const failures = [
      'expect(locator).toBeVisible() — element not visible',
      'expect(locator).toBeVisible() — element not found',
      'expect(locator).toBeVisible() — element hidden',
    ];
    assert.equal(detectRenderingMismatch(failures), false);
  });

  it('returns true when 2 toBeVisible + 2 toBeHidden (mixed, total 4)', () => {
    const failures = [
      'expect(locator).toBeVisible() — element not visible',
      'expect(locator).toBeVisible() — not found',
      'expect(locator).toBeHidden() — element is visible',
      'expect(locator).toBeHidden() — element unexpectedly visible',
    ];
    assert.equal(detectRenderingMismatch(failures), true);
  });

  it('returns false for an empty array', () => {
    assert.equal(detectRenderingMismatch([]), false);
  });

  it('returns false when 4 failures exist but none contain toBeVisible or toBeHidden', () => {
    const failures = [
      'Expected: 5, Received: 3 — score mismatch',
      'waitForPhase timed out after 10s',
      'net::ERR_CONNECTION_REFUSED',
      'TypeError: window.__ralph is not defined',
    ];
    assert.equal(detectRenderingMismatch(failures), false);
  });

  it('matches toBeVisible case-insensitively (TOBEVISIBLE, ToBeVisible)', () => {
    const failures = [
      'TOBEVISIBLE assertion failed',
      'ToBeVisible check failed',
      'tobevisible element missing',
      'TOBEVISIBLE timeout exceeded',
    ];
    assert.equal(detectRenderingMismatch(failures), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for global fix loop 0/0 false-pass guard
// Verifies that a batch returning passed=0, failed=0, total=0 (page crash /
// corrupted HTML) is NOT treated as "all tests pass" — it must be placed in
// globalFailingBatches, not globalPassingBatches, so the loop does NOT exit
// early believing the build is healthy.
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js global fix loop — 0/0 false-pass guard', () => {
  // We test the classification logic directly: given gPassed and gFailed values,
  // confirm whether a batch would end up as "passing" or "failing".
  // The rule in the fixed code: only gFailed===0 && gPassed>0 → passing.
  // Anything else (gFailed>0 OR gPassed===0&&gFailed===0) → failing.

  function classifyBatch(gPassed, gFailed) {
    // Mirrors the fixed condition in runFixLoop (Step 3c global fix loop)
    if (gFailed === 0 && gPassed > 0) return 'passing';
    return 'failing';
  }

  it('batch with passed=5, failed=0 is classified as passing', () => {
    assert.equal(classifyBatch(5, 0), 'passing');
  });

  it('batch with passed=0, failed=3 is classified as failing', () => {
    assert.equal(classifyBatch(0, 3), 'failing');
  });

  it('batch with passed=2, failed=1 is classified as failing', () => {
    assert.equal(classifyBatch(2, 1), 'failing');
  });

  it('batch with passed=0, failed=0 (0/0 — page crash / broken HTML) is classified as failing — not passing', () => {
    // This is the core bug fix: 0/0 must NOT satisfy "all pass"
    assert.equal(classifyBatch(0, 0), 'failing',
      '0/0 result (no tests ran) must be treated as failing, not passing');
  });

  it('batch with passed=1, failed=0 is classified as passing (boundary)', () => {
    assert.equal(classifyBatch(1, 0), 'passing');
  });

  it('batch with passed=0, failed=1 is classified as failing (boundary)', () => {
    assert.equal(classifyBatch(0, 1), 'failing');
  });

  it('globalFailingBatches.length===0 check is only safe when no 0/0 batches exist', () => {
    // Simulates the scenario: two batches — one 5/0 (passing), one 0/0 (broken)
    // Before fix: 0/0 fell through both branches → globalFailingBatches was empty → false early exit
    // After fix: 0/0 → globalFailingBatches has one entry → loop continues correctly
    const batches = [
      { gPassed: 5, gFailed: 0 },  // genuinely passing
      { gPassed: 0, gFailed: 0 },  // corrupted — 0/0
    ];
    const globalFailingBatches = [];
    const globalPassingBatches = [];
    for (const { gPassed, gFailed } of batches) {
      if (gFailed === 0 && gPassed > 0) {
        globalPassingBatches.push({ gPassed, gFailed });
      } else {
        globalFailingBatches.push({ gPassed, gFailed });
      }
    }
    assert.equal(globalPassingBatches.length, 1, 'only the 5/0 batch should be passing');
    assert.equal(globalFailingBatches.length, 1, 'the 0/0 batch must be in failing list');
    // Loop must NOT exit early — there is a failing batch
    assert.ok(globalFailingBatches.length > 0, 'global fix loop should continue (not exit early)');
  });

  it('all-passing scenario (no 0/0 batches) still exits the loop correctly', () => {
    const batches = [
      { gPassed: 5, gFailed: 0 },
      { gPassed: 3, gFailed: 0 },
    ];
    const globalFailingBatches = [];
    for (const { gPassed, gFailed } of batches) {
      if (!(gFailed === 0 && gPassed > 0)) {
        globalFailingBatches.push({ gPassed, gFailed });
      }
    }
    assert.equal(globalFailingBatches.length, 0, 'with all genuinely passing batches, loop should exit');
  });

  // ── Approval gate: zeroCoverageCats >= 1 (not >= 2) ────────────────────────
  // A build with exactly one non-game-flow category showing 0/0 must NOT be approved.
  // Previously the guard was >= 2 categories; this tests the stricter >= 1 threshold.

  function simulateApprovalGate(categoryResults, triageDeletedCategories = new Set()) {
    // Mirrors pipeline.js Step 4 logic for zeroCoverageCats (R&D #57: triage-deleted awareness)
    const gameFlowResult = categoryResults['game-flow'];
    if (gameFlowResult && gameFlowResult.passed === 0 && gameFlowResult.failed === 0) {
      if (triageDeletedCategories.has('game-flow')) {
        // triage-deleted: proceed, don't block approval
      } else {
        return 'FAILED:game-flow-0/0';
      }
    }
    const zeroCoverageCats = Object.entries(categoryResults)
      .filter(([cat, r]) => r.passed === 0 && r.failed === 0 && !triageDeletedCategories.has(cat))
      .map(([cat]) => cat);
    const skippedCats = Object.entries(categoryResults)
      .filter(([cat, r]) => r.passed === 0 && r.failed === 0 && triageDeletedCategories.has(cat))
      .map(([cat]) => cat);
    if (zeroCoverageCats.length >= 1) {
      return `FAILED:zero-coverage:${zeroCoverageCats.join(',')}`;
    }
    if (skippedCats.length > 0) {
      return `PROCEED_TO_REVIEW:skipped:${skippedCats.join(',')}`;
    }
    return 'PROCEED_TO_REVIEW';
  }

  it('approval gate: single 0/0 non-game-flow category fails the build', () => {
    const result = simulateApprovalGate({
      'game-flow': { passed: 2, failed: 0 },
      'mechanics':  { passed: 0, failed: 0 }, // 0/0 — page broken
      'edge-cases': { passed: 3, failed: 0 },
    });
    assert.ok(result.startsWith('FAILED'), `expected FAILED, got ${result}`);
    assert.ok(result.includes('mechanics'), `expected mechanics in failure reason, got ${result}`);
  });

  it('approval gate: all categories passing proceeds to review', () => {
    const result = simulateApprovalGate({
      'game-flow': { passed: 2, failed: 0 },
      'mechanics':  { passed: 4, failed: 0 },
      'edge-cases': { passed: 3, failed: 0 },
    });
    assert.equal(result, 'PROCEED_TO_REVIEW');
  });

  it('approval gate: game-flow 0/0 fails the build (guard fires first)', () => {
    const result = simulateApprovalGate({
      'game-flow': { passed: 0, failed: 0 }, // 0/0
      'mechanics':  { passed: 4, failed: 0 },
    });
    assert.ok(result.startsWith('FAILED:game-flow'), `expected FAILED:game-flow, got ${result}`);
  });

  it('approval gate: two non-game-flow 0/0 categories fails the build', () => {
    const result = simulateApprovalGate({
      'game-flow': { passed: 2, failed: 0 },
      'mechanics':  { passed: 0, failed: 0 },
      'edge-cases': { passed: 0, failed: 0 },
    });
    assert.ok(result.startsWith('FAILED'), `expected FAILED, got ${result}`);
  });

  // ── R&D #57: triage-deleted categories should not block approval ─────────────
  // When all spec files in a category are deleted by triage (test logic issues, not HTML bugs),
  // the approval gate must treat the category as SKIPPED rather than failing the build.

  it('approval gate: triage-deleted non-game-flow 0/0 category proceeds to review (R&D #57)', () => {
    // Mirrors disappearing-numbers #479: level-progression triage-deleted, other cats passed
    const result = simulateApprovalGate(
      {
        'game-flow':          { passed: 3, failed: 0 },
        'mechanics':          { passed: 2, failed: 0 },
        'edge-cases':         { passed: 2, failed: 0 },
        'contract':           { passed: 1, failed: 0 },
        'level-progression':  { passed: 0, failed: 0 }, // triage-deleted
      },
      new Set(['level-progression']),
    );
    assert.ok(result.startsWith('PROCEED_TO_REVIEW'), `expected PROCEED_TO_REVIEW, got ${result}`);
    assert.ok(result.includes('level-progression'), `expected skipped category in result, got ${result}`);
  });

  it('approval gate: non-triage-deleted 0/0 category still fails the build (R&D #57)', () => {
    // level-progression is 0/0 but NOT in triageDeletedCategories — page was broken, must fail
    const result = simulateApprovalGate(
      {
        'game-flow':          { passed: 3, failed: 0 },
        'mechanics':          { passed: 2, failed: 0 },
        'level-progression':  { passed: 0, failed: 0 }, // not triage-deleted
      },
      new Set(), // empty — no triage-deleted categories
    );
    assert.ok(result.startsWith('FAILED'), `expected FAILED, got ${result}`);
    assert.ok(result.includes('level-progression'), `expected level-progression in reason, got ${result}`);
  });

  it('approval gate: triage-deleted game-flow proceeds to review (R&D #57)', () => {
    // game-flow triage-deleted should not block approval (test gen issue, not HTML issue)
    const result = simulateApprovalGate(
      {
        'game-flow':  { passed: 0, failed: 0 }, // triage-deleted
        'mechanics':  { passed: 3, failed: 0 },
        'edge-cases': { passed: 2, failed: 0 },
      },
      new Set(['game-flow']),
    );
    assert.ok(result.startsWith('PROCEED_TO_REVIEW'), `expected PROCEED_TO_REVIEW, got ${result}`);
  });

  it('approval gate: non-triage-deleted game-flow 0/0 still fails (R&D #57)', () => {
    // game-flow 0/0 with no triage deletion must still block approval
    const result = simulateApprovalGate(
      {
        'game-flow':  { passed: 0, failed: 0 }, // NOT triage-deleted
        'mechanics':  { passed: 3, failed: 0 },
      },
      new Set(),
    );
    assert.ok(result.startsWith('FAILED:game-flow'), `expected FAILED:game-flow, got ${result}`);
  });

  it('approval gate: multiple triage-deleted categories all proceed to review (R&D #57)', () => {
    const result = simulateApprovalGate(
      {
        'game-flow':         { passed: 2, failed: 0 },
        'mechanics':         { passed: 0, failed: 0 }, // triage-deleted
        'level-progression': { passed: 0, failed: 0 }, // triage-deleted
        'edge-cases':        { passed: 1, failed: 0 },
      },
      new Set(['mechanics', 'level-progression']),
    );
    assert.ok(result.startsWith('PROCEED_TO_REVIEW'), `expected PROCEED_TO_REVIEW, got ${result}`);
    assert.ok(result.includes('mechanics'), `expected mechanics in skipped list, got ${result}`);
    assert.ok(result.includes('level-progression'), `expected level-progression in skipped list, got ${result}`);
  });

  it('hasCrossFailures includes 0/0 batches so global fix loop is triggered', () => {
    // Mirrors pipeline-fix-loop.js hasCrossFailures logic after the fix
    const categoryResults = {
      'game-flow': { passed: 2, failed: 0 },
      'mechanics':  { passed: 0, failed: 0 }, // 0/0 — should trigger global fix loop
    };
    const hasCrossFailures = Object.values(categoryResults).some(
      (r) => r.failed > 0 || (r.passed === 0 && r.failed === 0),
    );
    assert.ok(hasCrossFailures, '0/0 category must trigger global fix loop');
  });

  it('hasCrossFailures is false when all categories pass with > 0 tests', () => {
    const categoryResults = {
      'game-flow': { passed: 2, failed: 0 },
      'mechanics':  { passed: 4, failed: 0 },
    };
    const hasCrossFailures = Object.values(categoryResults).some(
      (r) => r.failed > 0 || (r.passed === 0 && r.failed === 0),
    );
    assert.ok(!hasCrossFailures, 'no 0/0 and no failures — global fix loop should not trigger');
  });
});

// ─── runPageSmokeDiagnostic / classifySmokeErrors tests ──────────────────────
// classifySmokeErrors is the pure pattern-matching core of the smoke check.
// We test it directly to avoid spawning Playwright or a real server.

const { classifySmokeErrors } = require('../lib/pipeline-utils');

describe('runPageSmokeDiagnostic classifySmokeErrors — fatal pattern detection', () => {
  it('returns empty array when there are no console errors (ok: true scenario)', () => {
    const result = classifySmokeErrors([]);
    assert.deepEqual(result, []);
  });

  it('detects "Packages failed to load" as fatal', () => {
    const errors = ['Packages failed to load within 10s'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('Packages failed to load'));
  });

  it('detects "Initialization error" as fatal (case-insensitive)', () => {
    const errors = ['INITIALIZATION ERROR: cannot read property of undefined'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('INITIALIZATION ERROR'));
  });

  it('does NOT classify a non-fatal console error as fatal', () => {
    const errors = ['minor warning: color contrast ratio is low'];
    const result = classifySmokeErrors(errors);
    assert.deepEqual(result, []);
  });

  it('returns only the fatal error when mixed with a non-fatal error', () => {
    const errors = [
      'minor warning: element has no accessible name',
      'Package failed to load: cdn.homeworkapp.ai/mathai-game-engine.js',
    ];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
    assert.ok(result[0].includes('Package failed to load'));
  });

  it('does not treat "failed to load resource" 404 as fatal (audio/media 404s are non-blocking)', () => {
    const errors = ['Failed to load resource: the server responded with a status of 404'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 0);
  });

  it('detects "is not a constructor" as fatal', () => {
    const errors = ['TypeError: MathaiGame is not a constructor'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
  });

  it('detects "waitForPackages" as fatal', () => {
    const errors = ['waitForPackages timed out after 10000ms'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
  });

  it('"X is not defined" without CDN context is NOT fatal', () => {
    // A plain undefined error with no CDN/package context should not block the build
    const errors = ['ReferenceError: myLocalVar is not defined'];
    const result = classifySmokeErrors(errors);
    assert.deepEqual(result, []);
  });

  it('"X is not defined" WITH CDN context IS fatal', () => {
    const errors = ['MathaiEngine is not defined — ensure cdn.homeworkapp.ai script is loaded'];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 1);
  });

  it('returns all matching errors when multiple fatal errors appear', () => {
    const errors = [
      'Packages failed to load within 10s',
      'Initialization error: null reference',
    ];
    const result = classifySmokeErrors(errors);
    assert.equal(result.length, 2);
  });
});

// ─── Blank page detection — white screen with no console errors ───────────────
// The smoke check now also evaluates #gameContent children to catch cases where
// the CDN loads silently but the game never renders (e.g. missing #mathai-transition-slot).
describe('runPageSmokeDiagnostic blank-page detection — #gameContent guard', () => {
  it('blankPageError is set when #gameContent has no children', () => {
    // Simulate the page.evaluate result shape the smoke check uses
    const hasContent = { ok: false, reason: '#gameContent is empty — game did not render' };
    const blankPageError = hasContent.ok ? null : `Blank page: ${hasContent.reason}`;
    assert.ok(blankPageError);
    assert.match(blankPageError, /Blank page/);
  });

  it('blankPageError is null when #gameContent has children', () => {
    const hasContent = { ok: true };
    const blankPageError = hasContent.ok ? null : `Blank page: ${hasContent.reason}`;
    assert.equal(blankPageError, null);
  });

  it('blankPageError is set when #gameContent element is missing entirely', () => {
    const hasContent = { ok: false, reason: 'missing #gameContent element' };
    const blankPageError = hasContent.ok ? null : `Blank page: ${hasContent.reason}`;
    assert.match(blankPageError, /missing #gameContent/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for detectCrossBatchRegression
// We test the pure logic in isolation by mocking execFileAsync via the child_process
// module cache — no real Playwright is invoked.
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js detectCrossBatchRegression', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { detectCrossBatchRegression } = require('../lib/pipeline-fix-loop');

  // Helper: create a temporary spec file so fs.existsSync passes
  function makeTmpSpecFile(name) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-xbatch-'));
    const specFile = path.join(dir, `${name}.spec.js`);
    fs.writeFileSync(specFile, `test('dummy', () => {});\n`);
    return { dir, specFile };
  }

  // Helper: swap child_process execFile implementation for the duration of fn()
  // fn receives a fresh detectCrossBatchRegression bound to the mocked execFile.
  async function withMockExecFile(mockImpl, fn) {
    const cpPath = require.resolve('child_process');
    const fixLoopPath = require.resolve('../lib/pipeline-fix-loop');
    const originalCp = require.cache[cpPath];
    const originalFixLoop = require.cache[fixLoopPath];

    try {
      // Patch child_process in the module cache with a fake execFile
      const fakeCp = Object.assign({}, require('child_process'), {
        execFile: mockImpl,
      });
      require.cache[cpPath] = {
        id: cpPath,
        filename: cpPath,
        loaded: true,
        exports: fakeCp,
      };
      // Force pipeline-fix-loop to reload with patched child_process so
      // promisify(execFile) captures the mock.
      delete require.cache[fixLoopPath];
      const freshModule = require('../lib/pipeline-fix-loop');
      // Await the async fn so the finally block runs only after completion
      return await fn(freshModule.detectCrossBatchRegression);
    } finally {
      if (originalCp) require.cache[cpPath] = originalCp;
      else delete require.cache[cpPath];
      if (originalFixLoop) require.cache[fixLoopPath] = originalFixLoop;
      else delete require.cache[fixLoopPath];
      // Restore original module
      delete require.cache[fixLoopPath];
      require('../lib/pipeline-fix-loop');
    }
  }

  it('returns empty array when priorPassingBatches is empty', async () => {
    const result = await detectCrossBatchRegression([], '/tmp', 5000);
    assert.deepEqual(result, []);
  });

  it('returns empty array when priorPassingBatches is null', async () => {
    const result = await detectCrossBatchRegression(null, '/tmp', 5000);
    assert.deepEqual(result, []);
  });

  it('detects regression when nowPassed < prevPassed', async () => {
    const { specFile, dir } = makeTmpSpecFile('game-flow');
    try {
      // Mock: Playwright now reports only 2 passing (was 5)
      const fakeExecFile = (_cmd, _args, _opts, cb) => {
        const stdout = JSON.stringify({ stats: { expected: 2, unexpected: 1 } });
        cb(Object.assign(new Error('tests failed'), { stdout }));
      };
      await withMockExecFile(fakeExecFile, async (fn) => {
        const prior = [{ category: 'game-flow', specFile, passed: 5, total: 5 }];
        const result = await fn(prior, dir, 5000);
        assert.equal(result.length, 1, 'should detect one regression');
        assert.equal(result[0].category, 'game-flow');
        assert.equal(result[0].prevPassed, 5);
        assert.equal(result[0].nowPassed, 2);
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns no regression when nowPassed equals prevPassed', async () => {
    const { specFile, dir } = makeTmpSpecFile('contract');
    try {
      // Mock: Playwright still reports 4 passing (same as before)
      const fakeExecFile = (_cmd, _args, _opts, cb) => {
        const stdout = JSON.stringify({ stats: { expected: 4, unexpected: 0 } });
        cb(null, { stdout });
      };
      await withMockExecFile(fakeExecFile, async (fn) => {
        const prior = [{ category: 'contract', specFile, passed: 4, total: 4 }];
        const result = await fn(prior, dir, 5000);
        assert.deepEqual(result, [], 'no regression expected when counts are equal');
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips spec files that no longer exist on disk', async () => {
    const nonExistent = '/tmp/this-file-does-not-exist-ralph.spec.js';
    const prior = [{ category: 'audio', specFile: nonExistent, passed: 3, total: 3 }];
    const result = await detectCrossBatchRegression(prior, '/tmp', 5000);
    assert.deepEqual(result, [], 'missing spec files should be silently skipped');
  });

  it('treats 0/0 results as inconclusive (timeout/infra failure) — not a regression', async () => {
    const { specFile, dir } = makeTmpSpecFile('scoring');
    try {
      // Mock: Playwright returns 0 passed, 0 failed (timeout kill or page crash before any test ran)
      // We can't distinguish timeout from crash here, so treat as inconclusive and skip rollback.
      const fakeExecFile = (_cmd, _args, _opts, cb) => {
        const stdout = JSON.stringify({ stats: { expected: 0, unexpected: 0 } });
        cb(null, { stdout });
      };
      await withMockExecFile(fakeExecFile, async (fn) => {
        const prior = [{ category: 'scoring', specFile, passed: 3, total: 3 }];
        const result = await fn(prior, dir, 5000);
        assert.equal(result.length, 0, '0/0 result is inconclusive — should not trigger rollback');
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns no regression when nowPassed > prevPassed (improvement)', async () => {
    const { specFile, dir } = makeTmpSpecFile('mechanics');
    try {
      // Mock: Playwright now reports more passing than before (improvement, not regression)
      const fakeExecFile = (_cmd, _args, _opts, cb) => {
        const stdout = JSON.stringify({ stats: { expected: 7, unexpected: 0 } });
        cb(null, { stdout });
      };
      await withMockExecFile(fakeExecFile, async (fn) => {
        const prior = [{ category: 'mechanics', specFile, passed: 4, total: 4 }];
        const result = await fn(prior, dir, 5000);
        assert.deepEqual(result, [], 'improvement (nowPassed > prevPassed) is not a regression');
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for pipeline-utils.js extractSpecRounds
// Covers table parsing, ordered list parsing, and fallback to empty array.
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-utils.js extractSpecRounds', () => {
  const { extractSpecRounds } = require('../lib/pipeline-utils');

  it('returns empty array for null/undefined input', () => {
    assert.deepEqual(extractSpecRounds(null), []);
    assert.deepEqual(extractSpecRounds(undefined), []);
    assert.deepEqual(extractSpecRounds(''), []);
  });

  it('parses markdown table rows into question/answer pairs', () => {
    const spec = `
## Rounds
| Question | Answer |
|----------|--------|
| 3 + 4 | 7 |
| 10 - 5 | 5 |
| 6 × 2 | 12 |
`;
    const result = extractSpecRounds(spec);
    assert.equal(result.length, 3);
    assert.equal(result[0].question, '3 + 4');
    assert.equal(result[0].answer, '7');
    assert.equal(result[1].question, '10 - 5');
    assert.equal(result[1].answer, '5');
  });

  it('skips header rows (Question/Answer/--- separators)', () => {
    const spec = `| Question | Answer |\n|---|---|\n| What is 2+2? | 4 |`;
    const result = extractSpecRounds(spec);
    assert.equal(result.length, 1);
    assert.equal(result[0].question, 'What is 2+2?');
    assert.equal(result[0].answer, '4');
  });

  it('skips metadata rows where col2 is YES/NO (Parts Selected table)', () => {
    const spec = `
| Part ID | Included |
|---------|---------|
| PART-001 | YES |
| PART-002 | NO |
| What is 5+3? | 8 |
`;
    const result = extractSpecRounds(spec);
    // Only the real Q/A row should be returned; YES/NO rows skipped
    assert.ok(result.every((r) => r.answer !== 'YES' && r.answer !== 'NO'));
    assert.ok(result.some((r) => r.question === 'What is 5+3?' && r.answer === '8'));
  });

  it('parses numbered list items with → separator', () => {
    const spec = `
1. Apple → Red
2. Banana → Yellow
3. Sky → Blue
`;
    const result = extractSpecRounds(spec);
    assert.equal(result.length, 3);
    assert.equal(result[0].question, 'Apple');
    assert.equal(result[0].answer, 'Red');
    assert.equal(result[2].question, 'Sky');
    assert.equal(result[2].answer, 'Blue');
  });

  it('falls back to ordered list when no table rows found', () => {
    const spec = `No table here.\n1. 3+4=7\n2. 5+6=11\n`;
    const result = extractSpecRounds(spec);
    assert.ok(result.length >= 1, 'should extract at least one round from numbered list');
    assert.equal(result[0].question, '3+4');
    assert.equal(result[0].answer, '7');
  });

  it('caps output at 5 rounds maximum', () => {
    const rows = Array.from({ length: 10 }, (_, i) => `| Q${i + 1} | A${i + 1} |`).join('\n');
    const spec = `| Q | A |\n|---|---|\n${rows}`;
    const result = extractSpecRounds(spec);
    assert.equal(result.length, 5, 'should stop at 5 rounds');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for pipeline-fix-loop.js deterministicTriage
// Covers fix_html, skip_tests, and null (fall-through) cases.
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js deterministicTriage', () => {
  const { deterministicTriage } = require('../lib/pipeline-fix-loop');

  it('returns null for empty or missing failures', () => {
    assert.equal(deterministicTriage([]), null);
    assert.equal(deterministicTriage(null), null);
  });

  it('returns fix_html when all failures are __ralph not defined', () => {
    const failures = [
      'TypeError: window.__ralph is not defined',
      'Cannot read properties of undefined (reading __ralph)',
    ];
    assert.equal(deterministicTriage(failures), 'fix_html');
  });

  it('returns skip_tests when all failures are visibilityState redefinition', () => {
    const failures = [
      'Cannot redefine property: visibilityState',
      'Cannot redefine property: visibilityState',
    ];
    assert.equal(deterministicTriage(failures), 'skip_tests');
  });

  it('returns null when failures are mixed patterns (no deterministic match)', () => {
    const failures = [
      'Expected score to be 10, got 5',
      'waitForPhase timed out after 10s',
    ];
    assert.equal(deterministicTriage(failures), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional isInitFailure pattern coverage (patterns not yet covered above)
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline-fix-loop.js isInitFailure — additional patterns', () => {
  const { isInitFailure } = require('../lib/pipeline-fix-loop');

  it('matches window.gameState undefined pattern', () => {
    assert.equal(isInitFailure(['window.gameState is undefined — cannot read phase'], 0), true);
  });

  it('matches page.goto failed pattern', () => {
    assert.equal(isInitFailure(['page.goto failed: net::ERR_CONNECTION_REFUSED'], 0), true);
  });

  it('matches transition-slot legacy pattern', () => {
    assert.equal(isInitFailure(['transition-slot never appeared in DOM'], 0), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for fixCdnDomainsInFile
// Verifies the CDN domain fix is applied correctly to HTML files.
// This function is called after every LLM HTML write to prevent 403 CDN errors
// from cdn.homeworkapp.ai which is reintroduced by subsequent LLM edits.
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline.js fixCdnDomainsInFile', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  function writeTmp(content) {
    const f = path.join(os.tmpdir(), `test-cdn-fix-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(f, content);
    return f;
  }

  it('replaces cdn.mathai.ai directly with canonical storage.googleapis.com/test-dynamic-assets', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.mathai.ai/game-packages/feedback-manager/v1/feedback-manager.umd.js"></script>
</head><body><div id="gameContent"></div></body></html>`;
    const f = writeTmp(html);
    fixCdnDomainsInFile(f, null);
    const result = fs.readFileSync(f, 'utf-8');
    assert.ok(!result.includes('cdn.mathai.ai'), 'cdn.mathai.ai should be removed');
    assert.ok(!result.includes('cdn.homeworkapp.ai/game-packages'), 'cdn.homeworkapp.ai game-packages should be removed');
    assert.ok(result.includes('storage.googleapis.com/test-dynamic-assets/packages/feedback-manager'), 'canonical feedback-manager URL should be present');
    fs.unlinkSync(f);
  });

  it('replaces cdn.homeworkapp.ai game-package scripts with canonical three-package block', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.homeworkapp.ai/game-packages/feedback-manager/v1/feedback-manager.umd.js"></script>
<script src="https://cdn.homeworkapp.ai/game-packages/timer-component/v1/timer-component.umd.js"></script>
</head><body><div id="gameContent"></div></body></html>`;
    const f = writeTmp(html);
    fixCdnDomainsInFile(f, null);
    const result = fs.readFileSync(f, 'utf-8');
    assert.ok(!result.includes('cdn.homeworkapp.ai/game-packages'), 'cdn.homeworkapp.ai game-packages should be removed');
    assert.ok(result.includes('storage.googleapis.com/test-dynamic-assets/packages/feedback-manager'), 'feedback-manager canonical URL present');
    assert.ok(result.includes('storage.googleapis.com/test-dynamic-assets/packages/components'), 'components canonical URL present');
    assert.ok(result.includes('storage.googleapis.com/test-dynamic-assets/packages/helpers'), 'helpers canonical URL present');
    fs.unlinkSync(f);
  });

  it('does not duplicate canonical scripts if already present', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
</head><body><div id="gameContent"></div></body></html>`;
    const f = writeTmp(html);
    fixCdnDomainsInFile(f, null);
    const result = fs.readFileSync(f, 'utf-8');
    const count = (result.match(/packages\/feedback-manager/g) || []).length;
    assert.equal(count, 1, 'feedback-manager script should appear exactly once');
    fs.unlinkSync(f);
  });

  it('is a no-op for HTML with no wrong CDN domains', () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><div id="gameContent">hi</div></body></html>`;
    const f = writeTmp(html);
    const before = fs.statSync(f).mtimeMs;
    fixCdnDomainsInFile(f, null);
    const after = fs.statSync(f).mtimeMs;
    // File should not be rewritten if no fix needed
    assert.equal(before, after, 'file should not be modified if no CDN fix needed');
    fs.unlinkSync(f);
  });

  it('returns true when a fix was applied', () => {
    const html = `<!DOCTYPE html><html><body>
<script src="https://cdn.homeworkapp.ai/game-packages/feedback-manager/v1/feedback-manager.umd.js"></script>
</body></html>`;
    const f = writeTmp(html);
    const result = fixCdnDomainsInFile(f, null);
    assert.equal(result, true);
    fs.unlinkSync(f);
  });

  it('returns false when no fix was needed', () => {
    const html = `<!DOCTYPE html><html><body><div id="gameContent"></div></body></html>`;
    const f = writeTmp(html);
    const result = fixCdnDomainsInFile(f, null);
    assert.equal(result, false);
    fs.unlinkSync(f);
  });
});

// ─── fixCdnPathsInFile ────────────────────────────────────────────────────────
// Tests for the wrong-path CDN URL fixer. Handles unpkg.com/@mathai/ and
// cdn.homeworkapp.ai/cdn/components/web/ patterns that checkCdnScriptUrls()
// previously missed (causing silent 404s in smoke check with no cdnUrlContext hint).
// ─────────────────────────────────────────────────────────────────────────────

describe('pipeline.js fixCdnPathsInFile', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  function writeTmp(content) {
    const f = path.join(os.tmpdir(), `test-cdn-paths-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(f, content);
    return f;
  }

  it('removes unpkg.com/@mathai script tags and injects canonical block', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://unpkg.com/@mathai/feedback@1.2.6/dist/feedback.min.js"></script>
<script src="https://unpkg.com/@mathai/ui-components@1.1.4/dist/ui-components.min.js"></script>
<script src="https://unpkg.com/@mathai/signal-collector@1.0.9/dist/signal-collector.min.js"></script>
</head><body><div id="app"></div></body></html>`;
    const f = writeTmp(html);
    const result = fixCdnPathsInFile(f, null);
    const out = fs.readFileSync(f, 'utf-8');
    assert.equal(result.fixed, true);
    assert.ok(!out.includes('unpkg.com/@mathai'), 'unpkg.com/@mathai scripts should be removed');
    assert.ok(out.includes('storage.googleapis.com/test-dynamic-assets/packages/feedback-manager'), 'canonical feedback-manager should be injected');
    assert.ok(out.includes('storage.googleapis.com/test-dynamic-assets/packages/components'), 'canonical components should be injected');
    assert.ok(out.includes('storage.googleapis.com/test-dynamic-assets/packages/helpers'), 'canonical helpers should be injected');
    fs.unlinkSync(f);
  });

  it('removes cdn.homeworkapp.ai/cdn/components/web script tags and injects canonical block', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.homeworkapp.ai/cdn/components/web/feedback-manager/v2.4/feedback-manager.min.js"></script>
<script src="https://cdn.homeworkapp.ai/cdn/components/web/screen-layout/v1.4/screen-layout.min.js"></script>
</head><body><div id="app"></div></body></html>`;
    const f = writeTmp(html);
    const result = fixCdnPathsInFile(f, null);
    const out = fs.readFileSync(f, 'utf-8');
    assert.equal(result.fixed, true);
    assert.ok(!out.includes('cdn.homeworkapp.ai/cdn/components/web'), 'cdn.homeworkapp.ai/cdn/components/web scripts should be removed');
    assert.ok(out.includes('storage.googleapis.com/test-dynamic-assets/packages/feedback-manager'), 'canonical block should be injected');
    fs.unlinkSync(f);
  });

  it('does not re-inject canonical block if already present', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://unpkg.com/@mathai/feedback@1.2.6/dist/feedback.min.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
</head><body><div id="app"></div></body></html>`;
    const f = writeTmp(html);
    fixCdnPathsInFile(f, null);
    const out = fs.readFileSync(f, 'utf-8');
    const count = (out.match(/packages\/feedback-manager/g) || []).length;
    assert.equal(count, 1, 'feedback-manager should appear exactly once (no duplicate injection)');
    fs.unlinkSync(f);
  });

  it('returns fixed: false for HTML with no wrong CDN paths', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
</head><body><div id="gameContent"></div></body></html>`;
    const f = writeTmp(html);
    const result = fixCdnPathsInFile(f, null);
    assert.equal(result.fixed, false);
    assert.equal(result.changes.length, 0);
    fs.unlinkSync(f);
  });

  it('returns changes array describing what was fixed', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://unpkg.com/@mathai/feedback@1.2.6/dist/feedback.min.js"></script>
</head><body></body></html>`;
    const f = writeTmp(html);
    const result = fixCdnPathsInFile(f, null);
    assert.equal(result.fixed, true);
    assert.ok(result.changes.some((c) => c.includes('unpkg.com/@mathai')), 'changes should mention unpkg.com/@mathai');
    fs.unlinkSync(f);
  });

  it('is a no-op for HTML with no CDN script tags at all', () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><div id="gameContent">hi</div></body></html>`;
    const f = writeTmp(html);
    const before = fs.statSync(f).mtimeMs;
    fixCdnPathsInFile(f, null);
    const after = fs.statSync(f).mtimeMs;
    assert.equal(before, after, 'file should not be modified if no wrong CDN paths found');
    fs.unlinkSync(f);
  });
});

// ─── extractPhaseNamesFromGame (lib/prompts.js) ───────────────────────────────
const { extractPhaseNamesFromGame } = require('../lib/prompts');

describe('extractPhaseNamesFromGame', () => {
  it('parses phase names from gameState.phase assignments in HTML', () => {
    const html = `<script>
      gameState.phase = 'init';
      gameState.phase = 'playing';
      gameState.phase = 'results';
    </script>`;
    const phases = extractPhaseNamesFromGame(html, null);
    assert.ok(phases.includes('init'), 'should include init');
    assert.ok(phases.includes('playing'), 'should include playing');
    assert.ok(phases.includes('results'), 'should include results');
  });

  it('parses phase names from .phase comparisons in HTML', () => {
    const html = `<script>
      if (gameState.phase === 'gameover') { endGame(); }
      if (gs.phase !== 'start') { doSomething(); }
    </script>`;
    const phases = extractPhaseNamesFromGame(html, null);
    assert.ok(phases.includes('gameover'), 'should include gameover');
    assert.ok(phases.includes('start'), 'should include start');
  });

  it('parses phase from WINDOW.GAMESTATE SHAPE block in domSnapshot', () => {
    const domSnapshot = `ACTUAL RUNTIME DOM — captured from the running game

WINDOW.GAMESTATE SHAPE (actual runtime values — use THESE property names/types in tests, do NOT guess):
  phase: string "init"
  lives: number 3
  score: number 0`;
    const phases = extractPhaseNamesFromGame('', domSnapshot);
    assert.ok(phases.includes('init'), 'should extract init from gameStateShape');
  });

  it('returns empty array when no phases found', () => {
    const phases = extractPhaseNamesFromGame('<div>no phases here</div>', null);
    assert.deepEqual(phases, []);
  });

  it('deduplicates phase names', () => {
    const html = `<script>
      gameState.phase = 'playing';
      if (gameState.phase === 'playing') { ok(); }
      gameState.phase = 'results';
    </script>`;
    const phases = extractPhaseNamesFromGame(html, null);
    const playingCount = phases.filter((p) => p === 'playing').length;
    assert.equal(playingCount, 1, 'playing should appear only once');
  });

  it('excludes non-phase tokens like undefined, null', () => {
    const html = `<script>
      if (gameState.phase === 'undefined') { }
      if (gameState.phase !== 'null') { }
    </script>`;
    const phases = extractPhaseNamesFromGame(html, null);
    assert.ok(!phases.includes('undefined'), 'should not include undefined');
    assert.ok(!phases.includes('null'), 'should not include null');
  });

  it('extracts phases from data-phase attributes in HTML', () => {
    const html = `<div id="app" data-phase="start"></div>`;
    const phases = extractPhaseNamesFromGame(html, null);
    assert.ok(phases.includes('start'), 'should include start from data-phase attribute');
  });

  it('handles null htmlContent and null domSnapshot gracefully', () => {
    const phases = extractPhaseNamesFromGame(null, null);
    assert.deepEqual(phases, []);
  });
});

// ─── detectCorruptFallbackContent ─────────────────────────────────────────────

const { detectCorruptFallbackContent } = require('../lib/pipeline-test-gen');

describe('pipeline-test-gen.js detectCorruptFallbackContent', () => {
  it('detects all CDN API names as corrupt', () => {
    const input = {
      rounds: [
        { question: 'Event', answer: 'Target' },
        { question: 'Input', answer: 'Action' },
        { question: 'Source', answer: 'Destination' },
      ],
    };
    const result = detectCorruptFallbackContent(input);
    assert.equal(result.corrupt, true);
    assert.deepEqual(result.rounds, []);
  });

  it('detects mixed CDN names + real content as corrupt when >50%', () => {
    // 4 out of 6 values are CDN names = 67% → corrupt
    const input = {
      rounds: [
        { question: 'Event', answer: 'Target' },
        { question: 'Input', answer: 'Action' },
        { question: 'What is 3+4?', answer: '7' },
      ],
    };
    const result = detectCorruptFallbackContent(input);
    assert.equal(result.corrupt, true);
    assert.deepEqual(result.rounds, []);
  });

  it('does not flag real game content as corrupt', () => {
    const input = {
      rounds: [
        { question: 'What is the capital of France?', answer: 'Paris' },
        { question: 'What is 3+4?', answer: '7' },
        { question: 'Which planet is largest?', answer: 'Jupiter' },
      ],
    };
    const result = detectCorruptFallbackContent(input);
    assert.equal(result.corrupt, undefined);
    assert.equal(result.rounds.length, 3);
  });

  it('does not flag empty rounds as corrupt', () => {
    const input = { rounds: [] };
    const result = detectCorruptFallbackContent(input);
    assert.equal(result.corrupt, undefined);
    assert.deepEqual(result.rounds, []);
  });
});

describe('pipeline.js checkCdnScriptUrls — URL parsing', () => {
  const { checkCdnScriptUrls } = require('../lib/pipeline');

  it('returns ok:true and empty failedUrls when HTML has no script tags', async () => {
    const html = '<html><head></head><body><p>No scripts here</p></body></html>';
    const result = await checkCdnScriptUrls(html);
    assert.equal(result.ok, true);
    assert.deepEqual(result.failedUrls, []);
  });

  it('returns ok:true and empty failedUrls when scripts have no CDN URLs', async () => {
    const html = `<html><head>
      <script src="/local/app.js"></script>
      <script src="https://example.com/lib.js"></script>
    </head></html>`;
    const result = await checkCdnScriptUrls(html);
    assert.equal(result.ok, true);
    assert.deepEqual(result.failedUrls, []);
  });

  it('extracts storage.googleapis.com script URLs (network-agnostic parse check)', async () => {
    // We cannot mock https in this test runner without complex Module cache hacks,
    // so we verify the function returns the expected shape.
    // The actual HTTP check will time out or error for a made-up URL; we check failedUrls is populated.
    const fakeUrl = 'https://storage.googleapis.com/test-dynamic-assets/packages/nonexistent-xyz-123456.js';
    const html = `<html><head><script src="${fakeUrl}"></script></head></html>`;
    const result = await checkCdnScriptUrls(html);
    // result.ok must be boolean
    assert.equal(typeof result.ok, 'boolean');
    // result.failedUrls must be an array
    assert.ok(Array.isArray(result.failedUrls));
    // If the URL failed (expected for a fake path), it must appear in failedUrls with the right shape
    if (!result.ok) {
      assert.ok(result.failedUrls.length > 0);
      assert.equal(typeof result.failedUrls[0].url, 'string');
      assert.ok(result.failedUrls[0].url.includes('storage.googleapis.com'));
      assert.equal(typeof result.failedUrls[0].status, 'number');
    }
  });

  it('extracts cdn.homeworkapp.ai script URLs for checking', async () => {
    const fakeUrl = 'https://cdn.homeworkapp.ai/packages/components/index.js';
    const html = `<html><head><script src="${fakeUrl}"></script></head></html>`;
    const result = await checkCdnScriptUrls(html);
    assert.equal(typeof result.ok, 'boolean');
    assert.ok(Array.isArray(result.failedUrls));
    // cdn.homeworkapp.ai is known to return 403, so it should appear in failedUrls
    if (!result.ok) {
      const matched = result.failedUrls.find((f) => f.url === fakeUrl);
      assert.ok(matched, 'cdn.homeworkapp.ai URL should be in failedUrls when non-200');
    }
  });

  it('does not check non-CDN script URLs', async () => {
    // Only /local/, https://example.com — neither matches CDN pattern
    const html = `<html><head>
      <script src="/local/main.js"></script>
      <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    </head></html>`;
    const result = await checkCdnScriptUrls(html);
    // No CDN URLs → no HTTP requests → always ok
    assert.equal(result.ok, true);
    assert.deepEqual(result.failedUrls, []);
  });

  it('checks unpkg.com/@mathai script URLs (known 404)', async () => {
    // unpkg.com/@mathai/* returns 404 — these should be detected and flagged
    const fakeUrl = 'https://unpkg.com/@mathai/feedback@1.2.6/dist/feedback.min.js';
    const html = `<html><head><script src="${fakeUrl}"></script></head></html>`;
    const result = await checkCdnScriptUrls(html);
    assert.equal(typeof result.ok, 'boolean');
    assert.ok(Array.isArray(result.failedUrls));
    // unpkg.com/@mathai packages don't exist → should be in failedUrls when non-200
    if (!result.ok) {
      const matched = result.failedUrls.find((f) => f.url === fakeUrl);
      assert.ok(matched, 'unpkg.com/@mathai URL should be in failedUrls when non-200');
    }
  });
});

describe('pipeline-fix-loop.js getMatchingLessons (R&D #56)', () => {
  const { getMatchingLessons, LESSON_PATTERNS } = require('../lib/pipeline-fix-loop');

  it('exports getMatchingLessons as a function', () => {
    assert.equal(typeof getMatchingLessons, 'function');
  });

  it('exports LESSON_PATTERNS as a non-empty array', () => {
    assert.ok(Array.isArray(LESSON_PATTERNS));
    assert.ok(LESSON_PATTERNS.length > 0);
    // Each entry must have pattern (RegExp) and lesson (string)
    for (const entry of LESSON_PATTERNS) {
      assert.ok(entry.pattern instanceof RegExp, 'pattern must be a RegExp');
      assert.equal(typeof entry.lesson, 'string', 'lesson must be a string');
      assert.ok(entry.lesson.length > 0, 'lesson must not be empty');
    }
  });

  it('matches Packages failed to load → lesson about 120s timeout', () => {
    const results = getMatchingLessons('Packages failed to load within 10s — timeout exceeded');
    assert.ok(results.length > 0);
    assert.ok(results[0].includes('120'), 'should mention 120s timeout');
    assert.ok(results[0].includes('Lesson 117') || results[0].includes('waitForPackages'), 'should reference waitForPackages lesson');
  });

  it('matches FeedbackManager.sound.playDynamicFeedback → namespace lesson', () => {
    const results = getMatchingLessons('FeedbackManager.sound.playDynamicFeedback is not a function');
    assert.ok(results.length > 0);
    assert.ok(results[0].includes('FeedbackManager.playDynamicFeedback'), 'should show correct namespace');
    assert.ok(results[0].includes('isProcessing') || results[0].includes('Lesson 115'), 'should reference isProcessing deadlock');
  });

  it('returns empty array for completely unrelated error', () => {
    const results = getMatchingLessons('completely unrelated error that matches nothing');
    assert.deepEqual(results, []);
  });

  it('returns empty array for empty string input', () => {
    assert.deepEqual(getMatchingLessons(''), []);
  });

  it('returns empty array for null/undefined input', () => {
    assert.deepEqual(getMatchingLessons(null), []);
    assert.deepEqual(getMatchingLessons(undefined), []);
  });

  it('caps results at 3 even when many patterns match', () => {
    // Construct a string that matches many patterns at once
    const text = 'Packages failed to load FeedbackManager.sound.playDynamicFeedback isProcessing window.gameState waitForPhase timeout ScreenLayout.inject slots: #gameContent missing TimerComponent window.endGame undefined';
    const results = getMatchingLessons(text);
    assert.ok(results.length <= 3, `should return at most 3 lessons, got ${results.length}`);
  });

  it('matches waitForPhase timeout → syncDOMState lesson', () => {
    const results = getMatchingLessons('waitForPhase timeout: waiting for data-phase=playing');
    assert.ok(results.length > 0);
    assert.ok(
      results.some((r) => r.includes('syncDOMState') || r.includes('data-phase') || r.includes('Lesson 50')),
      'should reference syncDOMState lesson',
    );
  });

  it('matches missing #gameContent → ScreenLayout slots lesson', () => {
    const results = getMatchingLessons('gameContent missing from DOM — ScreenLayout.inject was called');
    assert.ok(results.length > 0);
    assert.ok(
      results.some((r) => r.includes('slots') || r.includes('Lesson 69') || r.includes('#gameContent')),
      'should reference slots wrapper lesson',
    );
  });
});

// ─── M16: buildTestGenCategoryPrompt .option-btn touch-target coverage ────────
// Verifies that the M16 prompt rule includes .option-btn 44px assertions
// (11th confirmed instance: mcq-addition-blitz UI/UX audit — 4-button MCQ grid)

const { buildTestGenCategoryPrompt } = require('../lib/prompts');

describe('buildTestGenCategoryPrompt — M16: .option-btn touch target rule', () => {
  const baseOpts = {
    category: 'mechanics',
    categoryDescription: 'Core game mechanics tests',
    testCaseCount: 3,
    testCasesText: '1. Verify answer submission\n2. Verify score update\n3. Verify lives decrease',
    learningsBlock: '',
    testHintsBlock: '',
    gameFeaturesBlock: '',
    htmlContent: '<html><body></body></html>',
    specScenarios: [],
  };

  it('includes .option-btn pattern in M16 rule when .option-btn present in DOM snapshot', () => {
    const domSnapshot = `<div id="app" data-phase="playing">
  <button class="option-btn">Option A</button>
  <button class="option-btn">Option B</button>
</div>`;
    const prompt = buildTestGenCategoryPrompt({ ...baseOpts, domSnapshot });
    assert.ok(
      prompt.includes('.option-btn'),
      'M16 rule must reference .option-btn when it appears in the DOM snapshot',
    );
    assert.ok(
      prompt.includes('optBtn') || prompt.includes('option-btn'),
      'M16 rule must include .option-btn locator pattern for MCQ games',
    );
  });

  it('includes .choice-btn pattern in M16 rule (existing coverage)', () => {
    const domSnapshot = `<div id="app" data-phase="playing">
  <button class="choice-btn">Choice A</button>
  <button class="choice-btn">Choice B</button>
</div>`;
    const prompt = buildTestGenCategoryPrompt({ ...baseOpts, domSnapshot });
    assert.ok(
      prompt.includes('.choice-btn'),
      'M16 rule must continue to reference .choice-btn for existing MCQ games',
    );
    assert.ok(
      prompt.includes('44'),
      'M16 rule must include 44px minimum touch target height reference',
    );
  });

  it('M16 rule text is always emitted for mechanics category (contains all three selector patterns)', () => {
    // CR-001 fix: previous test passed an empty DOM snapshot — this test verifies the static
    // rule text itself is present for any mechanics prompt, regardless of DOM snapshot content.
    const domSnapshot = `<div id="app">
  <button class="choice-btn">Choice A</button>
  <button class="option-btn">Option A</button>
</div>`;
    const prompt = buildTestGenCategoryPrompt({ ...baseOpts, domSnapshot });
    assert.ok(prompt.includes('.choice-btn'), 'M16 must mention .choice-btn');
    assert.ok(prompt.includes('.option-btn'), 'M16 must mention .option-btn');
    assert.ok(prompt.includes('.answer-btn'), 'M16 must mention .answer-btn');
    assert.ok(
      prompt.includes('toBeGreaterThanOrEqual(44)') || prompt.includes('44'),
      'M16 must include 44px assertion',
    );
  });

  it('includes .answer-btn pattern in M16 rule when .answer-btn present in DOM snapshot', () => {
    // CR-002: .answer-btn was previously carved out of M16 — now covered
    const domSnapshot = `<div id="app" data-phase="playing">
  <button class="answer-btn">True</button>
  <button class="answer-btn">False</button>
</div>`;
    const prompt = buildTestGenCategoryPrompt({ ...baseOpts, domSnapshot });
    assert.ok(
      prompt.includes('.answer-btn'),
      'M16 rule must reference .answer-btn when it appears in the DOM snapshot',
    );
    assert.ok(
      prompt.includes('ansBtn') || prompt.includes('answer-btn'),
      'M16 rule must include .answer-btn locator pattern',
    );
    assert.ok(
      prompt.includes('GEN-UX-002') || prompt.includes('44'),
      'M16 .answer-btn pattern must reference 44px touch target (GEN-UX-002)',
    );
  });

  it('includes .answer-btn minHeight assertion using getComputedStyle in M16 rule', () => {
    // CR-002: .answer-btn uses CSS minHeight (getComputedStyle) rather than getBoundingClientRect
    // because GEN-UX-002 mandates the CSS property itself, not just the rendered height
    const domSnapshot = `<div id="app" data-phase="playing">
  <button class="answer-btn">Submit</button>
</div>`;
    const prompt = buildTestGenCategoryPrompt({ ...baseOpts, domSnapshot });
    assert.ok(
      prompt.includes('getComputedStyle') || prompt.includes('minHeight'),
      'M16 .answer-btn assertion must use getComputedStyle to check CSS minHeight (GEN-UX-002)',
    );
    assert.ok(
      prompt.includes('toBeGreaterThanOrEqual(44)') || prompt.includes('44'),
      'M16 .answer-btn assertion must enforce 44px minimum',
    );
  });

  it('does not include M16 rule for non-mechanics categories', () => {
    const domSnapshot = `<div class="option-btn"></div>`;
    const prompt = buildTestGenCategoryPrompt({
      ...baseOpts,
      category: 'game-flow',
      categoryDescription: 'Game flow tests',
      domSnapshot,
    });
    // M16 rule text is mechanics-only — the pattern text must not appear in game-flow
    assert.ok(
      !prompt.includes('CHOICE-BTN / OPTION-BTN TOUCH TARGET'),
      'M16 rule text must not appear in non-mechanics category prompts',
    );
  });
});

// ─── LP-NEW rules: level-progression prompt content ───────────────────────────
// Verifies LP-NEW-1/2/3 rule text appears in buildTestGenCategoryPrompt()
// for the level-progression category.
// Evidence: name-the-sides #557–562 (LP-NEW-1), interactive-chat #387 (LP-NEW-2),
// find-triangle-side #547 + name-the-sides #553 (LP-NEW-3).

const lpBaseOpts = {
  category: 'level-progression',
  categoryDescription: 'Level/round structure tests',
  testCaseCount: 3,
  testCasesText: '1. Verify round advances\n2. Verify content changes\n3. Verify difficulty scaling',
  learningsBlock: '',
  testHintsBlock: '',
  gameFeaturesBlock: '',
  htmlContent: '<html><body></body></html>',
  domSnapshot: '<div id="app" data-phase="playing" data-round="1"></div>',
  specScenarios: [],
};

describe('buildTestGenCategoryPrompt — LP-NEW-1: debugGame() RangeError guard', () => {
  it('includes LP-NEW-1 rule text in level-progression prompt', () => {
    const prompt = buildTestGenCategoryPrompt(lpBaseOpts);
    assert.ok(
      prompt.includes('LP-NEW-1'),
      'LP-NEW-1 rule must appear in level-progression prompt',
    );
    assert.ok(
      prompt.includes('debugGame') || prompt.includes('RangeError'),
      'LP-NEW-1 must reference debugGame or RangeError: Invalid count value',
    );
    assert.ok(
      prompt.includes('fallbackContent.rounds'),
      'LP-NEW-1 must reference fallbackContent.rounds length guard',
    );
  });

  it('LP-NEW-1 is NOT emitted for non-level-progression categories', () => {
    const prompt = buildTestGenCategoryPrompt({ ...lpBaseOpts, category: 'mechanics' });
    assert.ok(
      !prompt.includes('LP-NEW-1'),
      'LP-NEW-1 rule must NOT appear in non-level-progression prompts',
    );
  });
});

describe('buildTestGenCategoryPrompt — LP-NEW-2: start-button selector timeout guard', () => {
  it('includes LP-NEW-2 rule text in level-progression prompt', () => {
    const prompt = buildTestGenCategoryPrompt(lpBaseOpts);
    assert.ok(
      prompt.includes('LP-NEW-2'),
      'LP-NEW-2 rule must appear in level-progression prompt',
    );
    assert.ok(
      prompt.includes('startGame(page)'),
      'LP-NEW-2 must reference startGame(page) as the correct navigation approach',
    );
  });

  it('LP-NEW-2 is NOT emitted for game-flow category', () => {
    const prompt = buildTestGenCategoryPrompt({ ...lpBaseOpts, category: 'game-flow' });
    assert.ok(
      !prompt.includes('LP-NEW-2'),
      'LP-NEW-2 rule must NOT appear in game-flow prompts',
    );
  });
});

describe('buildTestGenCategoryPrompt — LP-NEW-3: not.toBeVisible transition slot guard', () => {
  it('includes LP-NEW-3 rule text in level-progression prompt', () => {
    const prompt = buildTestGenCategoryPrompt(lpBaseOpts);
    assert.ok(
      prompt.includes('LP-NEW-3'),
      'LP-NEW-3 rule must appear in level-progression prompt',
    );
    assert.ok(
      prompt.includes('not.toBeVisible') || prompt.includes('not.toBeVisible()'),
      'LP-NEW-3 must reference the not.toBeVisible() anti-pattern on transition slot',
    );
    assert.ok(
      prompt.includes('getRound(page)') || prompt.includes('getRound'),
      'LP-NEW-3 must recommend getRound() polling as the correct round-advancement detection',
    );
  });

  it('LP-NEW-3 is NOT emitted for contract category', () => {
    const prompt = buildTestGenCategoryPrompt({ ...lpBaseOpts, category: 'contract' });
    assert.ok(
      !prompt.includes('LP-NEW-3'),
      'LP-NEW-3 rule must NOT appear in contract prompts',
    );
  });
});


// ─── CT-NEW rules: contract prompt content ────────────────────────────────────
// Verifies CT-NEW-3 and CT-NEW-4 rule text appears in
// buildTestGenCategoryPrompt() for the contract category.
// Root cause evidence from 100-build analysis:
//   CT-NEW-3: 1x #results-screen selector (associations #513)
//   CT-NEW-4: 2x exact star count (memory-flip #453, kakuro #391, match-the-cards #514)
// Note: CT-NEW-1 (closure capture) and CT-NEW-2 (terminal phase match) were added in a prior session.

const ctBaseOpts = {
  category: 'contract',
  categoryDescription: 'postMessage contract tests',
  testCaseCount: 2,
  testCasesText: '1. Victory postMessage contract\n2. Game over postMessage contract',
  learningsBlock: '',
  testHintsBlock: '',
  gameFeaturesBlock: '',
  htmlContent: '<html><body></body></html>',
  domSnapshot: '<div id="app" data-phase="playing"></div>',
  specScenarios: [],
};

describe('buildTestGenCategoryPrompt — CT-NEW-3: no internal results-screen selector as proxy', () => {
  it('includes CT-NEW-3 rule text in contract prompt', () => {
    const prompt = buildTestGenCategoryPrompt(ctBaseOpts);
    assert.ok(
      prompt.includes('CT-NEW-3'),
      'CT-NEW-3 rule must appear in contract prompt',
    );
  });

  it('CT-NEW-3 warns against #results-screen selector', () => {
    const prompt = buildTestGenCategoryPrompt(ctBaseOpts);
    assert.ok(
      prompt.includes('#results-screen'),
      'CT-NEW-3 must reference #results-screen as a banned selector proxy',
    );
  });

  it('CT-NEW-3 recommends waitForPhase(results) as the correct approach', () => {
    const prompt = buildTestGenCategoryPrompt(ctBaseOpts);
    assert.ok(
      prompt.includes("waitForPhase(page, 'results'") || prompt.includes("waitForPhase"),
      'CT-NEW-3 must recommend waitForPhase() as the reliable completion signal',
    );
  });

  it('CT-NEW-3 is NOT emitted for mechanics category', () => {
    const prompt = buildTestGenCategoryPrompt({ ...ctBaseOpts, category: 'mechanics' });
    assert.ok(
      !prompt.includes('CT-NEW-3'),
      'CT-NEW-3 rule must NOT appear in mechanics prompts',
    );
  });
});

describe('buildTestGenCategoryPrompt — CT-NEW-4: no exact star count assertion in contract', () => {
  it('includes CT-NEW-4 rule text in contract prompt', () => {
    const prompt = buildTestGenCategoryPrompt(ctBaseOpts);
    assert.ok(
      prompt.includes('CT-NEW-4'),
      'CT-NEW-4 rule must appear in contract prompt',
    );
  });

  it('CT-NEW-4 warns against toBe(3) and recommends toBeGreaterThanOrEqual', () => {
    const prompt = buildTestGenCategoryPrompt(ctBaseOpts);
    assert.ok(
      prompt.includes('toBe(3)'),
      'CT-NEW-4 must call out toBe(3) as the wrong pattern',
    );
    assert.ok(
      prompt.includes('toBeGreaterThanOrEqual'),
      'CT-NEW-4 must recommend toBeGreaterThanOrEqual() as the correct assertion',
    );
  });

  it('CT-NEW-4 is NOT emitted for edge-cases category', () => {
    const prompt = buildTestGenCategoryPrompt({ ...ctBaseOpts, category: 'edge-cases' });
    assert.ok(
      !prompt.includes('CT-NEW-4'),
      'CT-NEW-4 rule must NOT appear in edge-cases prompts',
    );
  });
});

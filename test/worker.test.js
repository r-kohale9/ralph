'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Test the runRalph function logic in isolation by replicating path resolution logic

describe('worker path resolution', () => {
  const REPO_DIR = '/mock/repo';

  function resolveGameDir(gameId, specPath) {
    return specPath
      ? path.join(path.dirname(specPath), '..', 'game')
      : path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game');
  }

  function resolveSpecFile(gameId, specPath) {
    return specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');
  }

  it('resolves default game dir from gameId', () => {
    const dir = resolveGameDir('doubles', null);
    assert.equal(dir, '/mock/repo/warehouse/templates/doubles/game');
  });

  it('resolves default spec file from gameId', () => {
    const spec = resolveSpecFile('doubles', null);
    assert.equal(spec, '/mock/repo/warehouse/templates/doubles/spec.md');
  });

  it('resolves custom game dir from specPath', () => {
    const dir = resolveGameDir('doubles', '/custom/path/templates/doubles/spec.md');
    assert.equal(dir, path.join('/custom/path/templates', 'game'));
  });

  it('uses specPath directly when provided', () => {
    const spec = resolveSpecFile('doubles', '/custom/spec.md');
    assert.equal(spec, '/custom/spec.md');
  });
});

describe('worker report parsing', () => {
  it('parses valid ralph-report.json', () => {
    const report = {
      status: 'APPROVED',
      iterations: 2,
      generation_time_s: 30.5,
      total_time_s: 47.3,
      test_results: [
        { iteration: 1, passed: 8, failures: 2 },
        { iteration: 2, passed: 10, failures: 0 },
      ],
      review_result: 'Approved - all checks pass',
      models: { generation: 'claude-opus-4-6', review: 'claude-sonnet-4-6' },
    };

    // Simulate what worker does: write then read
    const tmpFile = path.join(os.tmpdir(), 'ralph-report-test.json');
    fs.writeFileSync(tmpFile, JSON.stringify(report));
    const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    fs.unlinkSync(tmpFile);

    assert.equal(parsed.status, 'APPROVED');
    assert.equal(parsed.iterations, 2);
    assert.equal(parsed.total_time_s, 47.3);
    assert.equal(parsed.test_results.length, 2);
    assert.equal(parsed.models.generation, 'claude-opus-4-6');
  });

  it('handles FAILED report', () => {
    const report = {
      status: 'FAILED',
      iterations: 5,
      generation_time_s: 120,
      total_time_s: 180,
      test_results: [{ iteration: 5, passed: 7, failures: 3 }],
      review_result: null,
      models: { generation: 'claude-sonnet-4-6' },
    };

    const tmpFile = path.join(os.tmpdir(), 'ralph-report-fail.json');
    fs.writeFileSync(tmpFile, JSON.stringify(report));
    const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    fs.unlinkSync(tmpFile);

    assert.equal(parsed.status, 'FAILED');
    assert.equal(parsed.iterations, 5);
    assert.equal(parsed.review_result, null);
  });

  it('handles REJECTED report', () => {
    const report = {
      status: 'REJECTED',
      iterations: 1,
      generation_time_s: 25,
      total_time_s: 35,
      test_results: [{ iteration: 1, passed: 10, failures: 0 }],
      review_result: 'Code quality issues found: excessive global variables',
      models: { generation: 'claude-opus-4-6', review: 'claude-sonnet-4-6' },
    };

    const tmpFile = path.join(os.tmpdir(), 'ralph-report-reject.json');
    fs.writeFileSync(tmpFile, JSON.stringify(report));
    const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    fs.unlinkSync(tmpFile);

    assert.equal(parsed.status, 'REJECTED');
    assert.ok(parsed.review_result.includes('Code quality'));
  });
});

describe('worker error handling patterns', () => {
  it('iterations fallback to 0 when undefined', () => {
    const report = { status: 'FAILED' };
    const iterations = report.iterations || 0;
    assert.equal(iterations, 0);
  });

  it('error message normalisation: real Error with message', () => {
    const err = new Error('pipeline crashed');
    const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
    assert.equal(errMsg, 'pipeline crashed');
  });

  it('error message normalisation: Error with empty message falls back to toString()', () => {
    const err = new Error('');
    // err.message is '' (falsy), toString() gives 'Error'
    const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
    assert.ok(errMsg.length > 0, 'should not produce empty string');
    assert.ok(errMsg.includes('Error'), 'should include Error class name');
  });

  it('error message normalisation: string thrown (non-Error)', () => {
    const err = 'something bad happened';
    const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
    assert.equal(errMsg, 'something bad happened');
  });

  it('error message normalisation: null error falls back to sentinel message', () => {
    const err = null;
    const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
    assert.equal(errMsg, 'worker-level failure: no error message captured');
  });

  it('error message normalisation: undefined error falls back to sentinel message', () => {
    const err = undefined;
    const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
    assert.equal(errMsg, 'worker-level failure: no error message captured');
  });

  it('models fallback object has no crash on .generation access', () => {
    // This simulates the failed-job handler path where models = {}
    const failedReport = {
      status: 'FAILED',
      iterations: 0,
      total_time_s: 0,
      test_results: [],
      review_result: null,
      models: {},
    };
    const model = failedReport.models?.generation || 'unknown';
    assert.equal(model, 'unknown');
  });

  it('optional chaining protects against null models', () => {
    const report = { status: 'APPROVED', models: null };
    const model = report.models?.generation || 'unknown';
    assert.equal(model, 'unknown');
  });

  it('optional chaining protects against undefined models', () => {
    const report = { status: 'APPROVED' };
    const model = report.models?.generation || 'unknown';
    assert.equal(model, 'unknown');
  });
});

describe('worker fetchSpec (URL-based spec)', () => {
  // Replicate fetchSpec logic for unit testing
  async function fetchSpec(url, destPath) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch spec from ${url}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    if (text.length < 100) {
      throw new Error(`Fetched spec is too small (${text.length} chars) — likely not a valid spec`);
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, text, 'utf-8');
    return destPath;
  }

  const originalFetch = global.fetch;

  it('downloads spec and saves to disk', async () => {
    const specContent =
      '# Game Spec\n\n' + 'A'.repeat(200) + '\n\nThis is a valid spec with enough content for testing purposes.';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => specContent,
    });

    const destPath = path.join(os.tmpdir(), 'ralph-fetch-test', 'spec.md');
    try {
      const result = await fetchSpec('https://example.com/spec.md', destPath);
      assert.equal(result, destPath);
      assert.ok(fs.existsSync(destPath));
      assert.equal(fs.readFileSync(destPath, 'utf-8'), specContent);
    } finally {
      try {
        fs.unlinkSync(destPath);
      } catch {}
      try {
        fs.rmdirSync(path.dirname(destPath));
      } catch {}
      global.fetch = originalFetch;
    }
  });

  it('throws on HTTP error', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    try {
      await fetchSpec('https://example.com/missing.md', '/tmp/nope.md');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('404'));
      assert.ok(err.message.includes('Not Found'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws on spec too small', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => 'tiny',
    });

    try {
      await fetchSpec('https://example.com/tiny.md', '/tmp/nope.md');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('too small'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('creates parent directories if needed', async () => {
    const specContent = '# Spec\n' + 'B'.repeat(200) + '\nContent for directory creation test.';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => specContent,
    });

    const deepPath = path.join(os.tmpdir(), 'ralph-fetch-deep', 'a', 'b', 'spec.md');
    try {
      await fetchSpec('https://example.com/deep.md', deepPath);
      assert.ok(fs.existsSync(deepPath));
    } finally {
      try {
        fs.unlinkSync(deepPath);
      } catch {}
      try {
        fs.rmdirSync(path.join(os.tmpdir(), 'ralph-fetch-deep', 'a', 'b'));
      } catch {}
      try {
        fs.rmdirSync(path.join(os.tmpdir(), 'ralph-fetch-deep', 'a'));
      } catch {}
      try {
        fs.rmdirSync(path.join(os.tmpdir(), 'ralph-fetch-deep'));
      } catch {}
      global.fetch = originalFetch;
    }
  });
});

describe('worker concurrency and rate limit config', () => {
  it('default concurrency is 2', () => {
    const concurrency = parseInt(process.env.RALPH_CONCURRENCY || '2', 10);
    assert.equal(concurrency, 2);
  });

  it('default rate limit is 10 per hour', () => {
    const max = parseInt(process.env.RALPH_RATE_MAX || '10', 10);
    const duration = parseInt(process.env.RALPH_RATE_DURATION || '3600000', 10);
    assert.equal(max, 10);
    assert.equal(duration, 3600000);
  });
});

describe('queue-sync auto-requeue logic', () => {
  // Replicate the requeueQueueSyncBuilds candidate-selection and skip logic for unit testing

  function selectCandidates(builds) {
    return builds.filter(
      (b) => b.status === 'failed' && b.error_message && b.error_message.includes('queue-sync') && (b.retry_count == null || b.retry_count < 1),
    );
  }

  function hasActiveBuilds(builds, gameId) {
    return builds.some((b) => b.game_id === gameId && (b.status === 'queued' || b.status === 'running'));
  }

  it('selects builds with queue-sync error and retry_count=0', () => {
    const builds = [
      { id: 10, game_id: 'doubles', status: 'failed', error_message: 'queue-sync: BullMQ job lost after worker restart', retry_count: 0 },
      { id: 11, game_id: 'fractions', status: 'failed', error_message: 'pipeline crashed', retry_count: 0 },
      { id: 12, game_id: 'doubles', status: 'approved', error_message: null, retry_count: 0 },
    ];
    const candidates = selectCandidates(builds);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, 10);
  });

  it('does not select builds where retry_count is already 1', () => {
    const builds = [
      { id: 20, game_id: 'doubles', status: 'failed', error_message: 'queue-sync: BullMQ job lost after worker restart', retry_count: 1 },
      { id: 21, game_id: 'fractions', status: 'failed', error_message: 'queue-sync: BullMQ job lost', retry_count: 0 },
    ];
    const candidates = selectCandidates(builds);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, 21);
  });

  it('treats null retry_count as eligible (equivalent to 0)', () => {
    const builds = [
      { id: 30, game_id: 'doubles', status: 'failed', error_message: 'queue-sync: job lost', retry_count: null },
    ];
    const candidates = selectCandidates(builds);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].id, 30);
  });

  it('skips requeue when game already has a queued build', () => {
    const allBuilds = [
      { id: 40, game_id: 'doubles', status: 'failed', error_message: 'queue-sync: job lost', retry_count: 0 },
      { id: 41, game_id: 'doubles', status: 'queued', error_message: null, retry_count: 0 },
    ];
    const candidates = selectCandidates(allBuilds);
    assert.equal(candidates.length, 1);
    // Simulate the skip check
    const shouldSkip = hasActiveBuilds(allBuilds, candidates[0].game_id);
    assert.ok(shouldSkip, 'should skip when queued build exists');
  });

  it('skips requeue when game already has a running build', () => {
    const allBuilds = [
      { id: 50, game_id: 'fractions', status: 'failed', error_message: 'queue-sync: job lost', retry_count: 0 },
      { id: 51, game_id: 'fractions', status: 'running', error_message: null, retry_count: 0 },
    ];
    const candidates = selectCandidates(allBuilds);
    assert.equal(candidates.length, 1);
    const shouldSkip = hasActiveBuilds(allBuilds, candidates[0].game_id);
    assert.ok(shouldSkip, 'should skip when running build exists');
  });

  it('allows requeue when game has no active builds', () => {
    const allBuilds = [
      { id: 60, game_id: 'multiplication', status: 'failed', error_message: 'queue-sync: BullMQ job lost', retry_count: 0 },
      { id: 59, game_id: 'multiplication', status: 'failed', error_message: 'pipeline error', retry_count: 0 },
    ];
    const candidates = selectCandidates(allBuilds);
    assert.equal(candidates.length, 1);
    const shouldSkip = hasActiveBuilds(allBuilds, candidates[0].game_id);
    assert.ok(!shouldSkip, 'should not skip when no active build exists');
  });

  it('handles empty builds table gracefully', () => {
    const candidates = selectCandidates([]);
    assert.equal(candidates.length, 0);
  });
});

describe('orphan-queue-sync logic (requeueOrphanedQueuedBuilds)', () => {
  // Replicate the orphan-queue-sync decision logic for unit testing

  function shouldReenqueue(dbQueuedCount, bullmqTotal) {
    return bullmqTotal < dbQueuedCount;
  }

  it('triggers re-enqueue when BullMQ has fewer jobs than DB-queued builds', () => {
    assert.ok(shouldReenqueue(37, 0), '37 queued in DB, 0 in BullMQ — must re-enqueue');
    assert.ok(shouldReenqueue(10, 5), '10 in DB, 5 in BullMQ — must re-enqueue');
  });

  it('skips re-enqueue when BullMQ count matches DB-queued count', () => {
    assert.ok(!shouldReenqueue(5, 5), 'counts match — no action needed');
    assert.ok(!shouldReenqueue(5, 7), 'BullMQ has more — no action needed');
  });

  it('skips re-enqueue when DB has no queued builds', () => {
    assert.ok(!shouldReenqueue(0, 0), 'both zero — no action needed');
  });

  it('re-enqueues all queued builds when BullMQ is empty', () => {
    const queuedBuilds = [
      { id: 305, game_id: 'matching-doubles' },
      { id: 306, game_id: 'zip' },
      { id: 307, game_id: 'connect' },
    ];
    const bullmqTotal = 0;
    const toReenqueue = shouldReenqueue(queuedBuilds.length, bullmqTotal) ? queuedBuilds : [];
    assert.equal(toReenqueue.length, 3);
    assert.deepEqual(toReenqueue.map((b) => b.id), [305, 306, 307]);
  });

  it('uses build-{id} as jobId for idempotent re-enqueue', () => {
    // Verify the jobId format prevents duplicates
    const buildId = 305;
    const jobId = `build-${buildId}`;
    assert.equal(jobId, 'build-305');
  });
});

describe('worker pre-flight: skip cancelled builds', () => {
  // Replicate the terminal-state guard logic from the worker job handler
  function shouldSkipJob(build) {
    if (!build) return false;
    return ['failed', 'approved', 'rejected', 'cancelled'].includes(build.status);
  }

  it('skips job when DB build status is cancelled', () => {
    const build = { id: 100, game_id: 'doubles', status: 'cancelled' };
    assert.ok(shouldSkipJob(build), 'must skip cancelled build');
  });

  it('skips job when DB build status is failed', () => {
    const build = { id: 101, game_id: 'doubles', status: 'failed' };
    assert.ok(shouldSkipJob(build), 'must skip failed build');
  });

  it('skips job when DB build status is approved', () => {
    const build = { id: 102, game_id: 'doubles', status: 'approved' };
    assert.ok(shouldSkipJob(build), 'must skip approved build');
  });

  it('skips job when DB build status is rejected', () => {
    const build = { id: 103, game_id: 'doubles', status: 'rejected' };
    assert.ok(shouldSkipJob(build), 'must skip rejected build');
  });

  it('does NOT skip job when DB build status is queued', () => {
    const build = { id: 104, game_id: 'doubles', status: 'queued' };
    assert.ok(!shouldSkipJob(build), 'must not skip queued build');
  });

  it('does NOT skip job when DB build status is running', () => {
    const build = { id: 105, game_id: 'doubles', status: 'running' };
    assert.ok(!shouldSkipJob(build), 'must not skip running build');
  });

  it('does NOT skip job when DB build record is missing (no record = proceed)', () => {
    assert.ok(!shouldSkipJob(null), 'must not skip when build record is null');
    assert.ok(!shouldSkipJob(undefined), 'must not skip when build record is undefined');
  });
});

describe('E7: categorizeFailure — all 22 branches (TE-CR-002)', () => {
  // Import directly from lib/categorize-failure.js — no local copy.
  // worker.js requires the same module, so tests exercise the real implementation.
  const { categorizeFailure } = require('../lib/categorize-failure');

  // ── Branch 1: render|dom|element|visible|display → 'rendering' ──────────
  it('branch 1 — render keyword → rendering', () => {
    assert.equal(categorizeFailure('render failed'), 'rendering');
  });
  it('branch 1 — DOM element not visible → rendering', () => {
    assert.equal(categorizeFailure('DOM element not visible'), 'rendering');
  });
  it('branch 1 — display issue → rendering', () => {
    assert.equal(categorizeFailure('display issue detected'), 'rendering');
  });

  // ── Branch 2: gamestate|state|init → 'state' ────────────────────────────
  it('branch 2 — gamestate keyword → state', () => {
    assert.equal(categorizeFailure('gameState initialization failed'), 'state');
  });
  it('branch 2 — init keyword → state', () => {
    assert.equal(categorizeFailure('init sequence error'), 'state');
  });

  // ── Branch 3: score|star|progress → 'scoring' ───────────────────────────
  it('branch 3 — score keyword → scoring', () => {
    assert.equal(categorizeFailure('Score not updated'), 'scoring');
  });
  it('branch 3 — star threshold → scoring', () => {
    assert.equal(categorizeFailure('Star thresholds wrong'), 'scoring');
  });

  // ── Branch 4: timer|timeout|countdown → 'timing' ────────────────────────
  it('branch 4 — timer keyword → timing', () => {
    assert.equal(categorizeFailure('timer countdown works'), 'timing');
  });
  it('branch 4 — timeout keyword → timing', () => {
    assert.equal(categorizeFailure('timeout waiting for response'), 'timing');
  });

  // ── Branch 5: click|input|touch|interact → 'interaction' ────────────────
  it('branch 5 — click keyword → interaction', () => {
    assert.equal(categorizeFailure('click on answer button'), 'interaction');
  });
  it('branch 5 — touch input → interaction', () => {
    assert.equal(categorizeFailure('touch input not handled'), 'interaction');
  });

  // ── Branch 6: postmessage|message|event → 'messaging' ───────────────────
  it('branch 6 — postMessage keyword → messaging', () => {
    assert.equal(categorizeFailure('postMessage fires on game over'), 'messaging');
  });
  it('branch 6 — event payload → messaging', () => {
    assert.equal(categorizeFailure('event payload has correct format'), 'messaging');
  });

  // ── Branch 7: layout|responsive|width|480 → 'layout' ────────────────────
  it('branch 7 — layout keyword → layout', () => {
    assert.equal(categorizeFailure('layout broken at mobile'), 'layout');
  });
  it('branch 7 — 480px width → layout', () => {
    assert.equal(categorizeFailure('width 480 constraint not respected'), 'layout');
  });

  // ── Branch 8: endgame|complete|finish → 'completion' ────────────────────
  it('branch 8 — endgame keyword → completion', () => {
    assert.equal(categorizeFailure('endGame not triggered'), 'completion');
  });
  it('branch 8 — finish keyword → completion', () => {
    assert.equal(categorizeFailure('finish screen missing'), 'completion');
  });

  // ── Branch 9: undefined|null|cannot read prop|typeerror → 'state' ───────
  it('branch 9 — TypeError: Cannot read properties of undefined → state', () => {
    assert.equal(categorizeFailure('TypeError: Cannot read properties of undefined'), 'state');
  });
  it('branch 9 — null dereference → state', () => {
    assert.equal(categorizeFailure('null reference in game loop'), 'state');
  });
  it('branch 9 — cannot read prop → state', () => {
    assert.equal(categorizeFailure('cannot read prop of undefined'), 'state');
  });

  // ── Branch 10: lives|wrong answer|correct answer|retry|interaction → 'interaction'
  it('branch 10 — lives keyword → interaction', () => {
    assert.equal(categorizeFailure('Expected lives to update after wrong answer'), 'interaction');
  });
  it('branch 10 — retry button → interaction', () => {
    assert.equal(categorizeFailure('retry button not functional'), 'interaction');
  });

  // ── Branch 11: victory|game over|out of lives|completion → 'completion' ─
  it('branch 11 — game over keyword → completion', () => {
    assert.equal(categorizeFailure('game over screen not shown'), 'completion');
  });
  it('branch 11 — victory keyword → completion', () => {
    assert.equal(categorizeFailure('victory screen missing'), 'completion');
  });

  // ── Branch 12: cannot find module|module not found|require → 'infra' ────
  it('branch 12 — Cannot find module → infra', () => {
    assert.equal(categorizeFailure("Cannot find module './game-utils'"), 'infra');
  });
  it('branch 12 — module not found → infra', () => {
    assert.equal(categorizeFailure('module not found: ./helpers'), 'infra');
  });

  // ── Branch 13 (NEW): toHaveText / toContainText / toBeVisible / toHidden / toHaveTitle → 'rendering'
  it('branch 13 (new) — toHaveText assertion failure → rendering', () => {
    assert.equal(categorizeFailure('expect(locator).toHaveText failed'), 'rendering');
  });
  it('branch 13 (new) — toBeVisible assertion failure → rendering', () => {
    assert.equal(categorizeFailure('toBeVisible check did not pass'), 'rendering');
  });
  it('branch 13 (new) — toHaveTitle assertion → rendering', () => {
    assert.equal(categorizeFailure('toHaveTitle expected "Math Game"'), 'rendering');
  });
  it('branch 13 (new) — toContainText assertion → rendering', () => {
    assert.equal(categorizeFailure('toContainText mismatch'), 'rendering');
  });

  // ── Branch 14 (NEW): locator. / locator( / expect(locator → 'rendering' ─
  it('branch 14 (new) — locator. pattern → rendering', () => {
    assert.equal(categorizeFailure('locator.nth(0) not found'), 'rendering');
  });
  it('branch 14 (new) — expect(locator pattern → rendering', () => {
    assert.equal(categorizeFailure('expect(locator).toBeVisible()'), 'rendering');
  });

  // ── Branch 15 (GEN-CR-002): expect(received) only → 'rendering' ───────────
  // Only Playwright's own assertion diff format string "expect(received)" maps to rendering.
  // Generic "expect(" in natural English (e.g. "Expected round counter to increment") must NOT match.
  it('branch 15 — expect(received) Playwright format → rendering', () => {
    assert.equal(categorizeFailure('expect(received).toBe(expected)'), 'rendering');
  });
  it('branch 15 — generic expect( without "received" → unknown (GEN-CR-002 narrowed)', () => {
    assert.equal(categorizeFailure('expect(value).toEqual(0)'), 'unknown');
  });

  // ── Branch 15b (CR-058): multi-line Playwright numeric diff → 'rendering' ─
  it('branch 15b (CR-058) — multi-line Expected:/Received: numeric diff → rendering', () => {
    assert.equal(categorizeFailure('Expected: 2\nReceived: 1'), 'rendering');
  });
  it('branch 15b (CR-058) — multi-line with extra context lines → rendering', () => {
    assert.equal(categorizeFailure('AssertionError\nExpected: 5\nReceived: 3\n    at ...'), 'rendering');
  });

  // ── Branch 16 (NEW): page.evaluate / evaluate: → 'state' ────────────────
  it('branch 16 (new) — page.evaluate error → state', () => {
    assert.equal(categorizeFailure('page.evaluate threw an error'), 'state');
  });
  it('branch 16 (new) — evaluate: prefix → state', () => {
    assert.equal(categorizeFailure('evaluate: window.gameState is undefined'), 'state');
  });

  // ── Branch 17 (NEW): .spec.js / spec file / test file → 'infra' ─────────
  it('branch 17 (new) — .spec.js missing → infra', () => {
    assert.equal(categorizeFailure('game.spec.js not found'), 'infra');
  });
  it('branch 17 (new) — spec file missing → infra', () => {
    assert.equal(categorizeFailure('spec file does not exist'), 'infra');
  });
  it('branch 17 (new) — test file missing → infra', () => {
    assert.equal(categorizeFailure('test file could not be loaded'), 'infra');
  });

  // ── Branch 18 (NEW): navigation|net::err|failed to load|page.*crash|browsercontext → 'infra'
  it('branch 18 (new) — net::err network error → infra', () => {
    assert.equal(categorizeFailure('net::ERR_CONNECTION_REFUSED'), 'infra');
  });
  it('branch 18 (new) — navigation failure → infra', () => {
    assert.equal(categorizeFailure('navigation to URL failed'), 'infra');
  });
  it('branch 18 (new) — failed to load → infra', () => {
    assert.equal(categorizeFailure('failed to load page'), 'infra');
  });
  it('branch 18 (new) — page crash → infra', () => {
    assert.equal(categorizeFailure('page crash detected'), 'infra');
  });
  it('branch 18 (new) — browsercontext error → infra', () => {
    assert.equal(categorizeFailure('browserContext closed unexpectedly'), 'infra');
  });

  // ── Branch 19 (NEW): life loss|wrong answer|correct answer|round|level transition|answer submission → 'interaction'
  it('branch 19 (new) — life loss pattern → interaction', () => {
    assert.equal(categorizeFailure('life loss not registered'), 'interaction');
  });
  it('branch 19 (new) — level transition → interaction', () => {
    assert.equal(categorizeFailure('level transition did not fire'), 'interaction');
  });
  it('branch 19 (new) — answer submission → interaction', () => {
    assert.equal(categorizeFailure('answer submission handler missing'), 'interaction');
  });
  it('branch 19 (new) — round boundary → interaction', () => {
    assert.equal(categorizeFailure('round boundary not triggered'), 'interaction');
  });

  // ── Branch 20 (NEW): victory flow|game over|out of lives|completion flow → 'completion'
  // Note: 'victory' and 'game over' are caught by branch 11; 'out of lives' by branch 10 ('lives').
  // Branch 20 is reachable via 'victory flow only' and 'completion flow'.
  it('branch 20 (new) — victory flow only → completion', () => {
    assert.equal(categorizeFailure('victory flow only'), 'completion');
  });
  it('branch 20 (new) — completion flow → completion', () => {
    assert.equal(categorizeFailure('completion flow skipped'), 'completion');
  });
  it('branch 20 (new) — out of lives shadowed by branch 10 → interaction', () => {
    // 'out of lives' contains 'lives' which branch 10 catches first
    assert.equal(categorizeFailure('out of lives flow not shown'), 'interaction');
  });

  // ── Branch 21 (NEW): adjustment|reset button|restart button|check button → 'interaction'
  it('branch 21 (new) — adjustment pattern → interaction', () => {
    assert.equal(categorizeFailure('adjustment-strategy check button missing'), 'interaction');
  });
  it('branch 21 (new) — reset button → interaction', () => {
    assert.equal(categorizeFailure('reset button not found'), 'interaction');
  });
  it('branch 21 (new) — restart button shadowed by star (branch 3) → scoring', () => {
    // 'restart' contains 'star' which branch 3 catches first; branch 21 is unreachable for 'restart'
    assert.equal(categorizeFailure('restart button missing'), 'scoring');
  });
  it('branch 21 (new) — check button → interaction', () => {
    assert.equal(categorizeFailure('check button handler absent'), 'interaction');
  });

  // ── Branch 22 (NEW): error:|typeerror:|timeouterror:|assertionerror: → 'state'
  it('branch 22 (new) — error: prefix → state', () => {
    assert.equal(categorizeFailure('error: game loop crashed'), 'state');
  });
  it('branch 22 (new) — typeerror: prefix (also caught by branch 9) → state', () => {
    assert.equal(categorizeFailure('typeerror: x is not a function'), 'state');
  });
  it('branch 22 (new) — timeouterror: shadowed by timeout (branch 4) → timing', () => {
    // 'timeouterror:' contains 'timeout' which branch 4 catches first
    assert.equal(categorizeFailure('timeouterror: exceeded 30000ms'), 'timing');
  });
  it('branch 22 (new) — assertionerror: prefix → state', () => {
    assert.equal(categorizeFailure('assertionerror: expected true got false'), 'state');
  });

  // ── Fallback: unknown ────────────────────────────────────────────────────
  it('fallback — unrecognized string → unknown', () => {
    // Must not contain any keyword from any of the 22 branches
    assert.equal(categorizeFailure('xqz no matching pattern here'), 'unknown');
  });
});

describe('E7: recordFailurePattern guard — unknown filter (Fix A)', () => {
  it('does NOT call recordFailurePattern when failures array contains only "unknown"', () => {
    // Replicate the E7 recording logic from worker.js
    function recordPatterns(testResults, recordFn) {
      if (!Array.isArray(testResults)) return;
      const lastResult = testResults.reduce((worst, r) =>
        (r.failed || 0) > (worst?.failed || 0) ? r : worst, null);
      if (lastResult && lastResult.failures) {
        const failures = lastResult.failures.split(', ').filter(f => Boolean(f) && f !== 'unknown');
        if (failures.length > 0) {
          for (const failure of failures) {
            recordFn(failure);
          }
        }
      }
    }

    let callCount = 0;
    recordPatterns([{ failed: 1, failures: 'unknown' }], () => { callCount++; });
    assert.equal(callCount, 0, 'recordFailurePattern must not be called for "unknown" failures');
  });

  it('does NOT call recordFailurePattern when failures string is empty', () => {
    function recordPatterns(testResults, recordFn) {
      if (!Array.isArray(testResults)) return;
      const lastResult = testResults.reduce((worst, r) =>
        (r.failed || 0) > (worst?.failed || 0) ? r : worst, null);
      if (lastResult && lastResult.failures) {
        const failures = lastResult.failures.split(', ').filter(f => Boolean(f) && f !== 'unknown');
        if (failures.length > 0) {
          for (const failure of failures) {
            recordFn(failure);
          }
        }
      }
    }

    let callCount = 0;
    recordPatterns([{ failed: 1, failures: '' }], () => { callCount++; });
    assert.equal(callCount, 0, 'recordFailurePattern must not be called for empty failures');
  });

  it('calls recordFailurePattern for real failure strings', () => {
    function recordPatterns(testResults, recordFn) {
      if (!Array.isArray(testResults)) return;
      const lastResult = testResults.reduce((worst, r) =>
        (r.failed || 0) > (worst?.failed || 0) ? r : worst, null);
      if (lastResult && lastResult.failures) {
        const failures = lastResult.failures.split(', ').filter(f => Boolean(f) && f !== 'unknown');
        if (failures.length > 0) {
          for (const failure of failures) {
            recordFn(failure);
          }
        }
      }
    }

    const recorded = [];
    recordPatterns([{ failed: 2, failures: 'TypeError: Cannot read props, game over not shown' }], (f) => { recorded.push(f); });
    assert.equal(recorded.length, 2);
    assert.ok(recorded[0].includes('TypeError'));
  });
});

describe('E7: worst-result selection (Fix C)', () => {
  // Replicate the reduce logic from worker.js
  function pickWorstResult(testResults) {
    return testResults.reduce((worst, r) =>
      (r.failed || 0) > (worst?.failed || 0) ? r : worst, null);
  }

  it('picks the entry with the highest failed count', () => {
    const results = [
      { iteration: 1, failed: 2, failures: 'render error' },
      { iteration: 2, failed: 5, failures: 'TypeError: Cannot read props' },
      { iteration: 3, failed: 1, failures: 'game over missing' },
    ];
    const worst = pickWorstResult(results);
    assert.equal(worst.failed, 5);
    assert.ok(worst.failures.includes('TypeError'));
  });

  it('returns null for empty array', () => {
    const worst = pickWorstResult([]);
    assert.equal(worst, null);
  });

  it('handles all-zero failed counts (picks first entry or last with equal)', () => {
    const results = [
      { iteration: 1, failed: 0, failures: 'none' },
      { iteration: 2, failed: 0, failures: 'none2' },
    ];
    // With all zeros, reduce stays on the initial null since 0 > 0 is false — null returned
    const worst = pickWorstResult(results);
    // (0 || 0) > (null?.failed || 0) => 0 > 0 => false, so stays null
    assert.equal(worst, null);
  });
});

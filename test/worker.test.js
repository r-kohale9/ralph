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

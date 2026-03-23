'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('db', () => {
  let db;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-test-'));
  const dbPath = path.join(tmpDir, 'test.db');

  before(() => {
    process.env.RALPH_DB_PATH = dbPath;
    // Clear cached module
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

  it('createBuild returns a number (not BigInt)', () => {
    const id = db.createBuild('doubles', 'abc123');
    assert.equal(typeof id, 'number');
    assert.ok(id > 0);
  });

  it('createBuild id is JSON-serializable', () => {
    const id = db.createBuild('triples', null);
    // This would throw "Do not know how to serialize a BigInt" if id were BigInt
    const json = JSON.stringify({ buildId: id });
    assert.ok(json.includes(String(id)));
  });

  it('getBuild retrieves a created build', () => {
    const id = db.createBuild('test-game', 'sha456');
    const build = db.getBuild(id);
    assert.equal(build.game_id, 'test-game');
    assert.equal(build.commit_sha, 'sha456');
    assert.equal(build.status, 'queued');
  });

  it('startBuild updates status to running', () => {
    const id = db.createBuild('runner', null);
    db.startBuild(id);
    const build = db.getBuild(id);
    assert.equal(build.status, 'running');
    assert.ok(build.started_at);
  });

  it('completeBuild stores report data', () => {
    const id = db.createBuild('complete-test', null);
    db.startBuild(id);
    db.completeBuild(id, {
      status: 'APPROVED',
      iterations: 2,
      generation_time_s: 30.5,
      total_time_s: 47.3,
      test_results: [{ passed: 10, failures: 0 }],
      review_result: 'Looks good',
      models: { generation: 'claude-opus-4-6', review: 'claude-sonnet-4-6' },
    });
    const build = db.getBuild(id);
    assert.equal(build.status, 'approved');
    assert.equal(build.iterations, 2);
    assert.ok(build.completed_at);
    // Float timing values are stored correctly despite INTEGER type declaration
    assert.equal(build.total_time_s, 47.3);
    // JSON fields are stored as strings
    const testResults = JSON.parse(build.test_results);
    assert.equal(testResults[0].passed, 10);
    const models = JSON.parse(build.models);
    assert.equal(models.generation, 'claude-opus-4-6');
  });

  it('failBuild records error message', () => {
    const id = db.createBuild('fail-test', null);
    db.failBuild(id, 'ralph.sh crashed');
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.equal(build.error_message, 'ralph.sh crashed');
  });

  it('failBuild with null errorMessage stores sentinel (never NULL)', () => {
    const id = db.createBuild('fail-null-msg', null);
    db.failBuild(id, null);
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.ok(build.error_message, 'error_message must not be null even when caller passes null');
    assert.ok(build.error_message.length > 0, 'error_message must be a non-empty string');
  });

  it('failBuild with undefined errorMessage stores sentinel (never NULL)', () => {
    const id = db.createBuild('fail-undef-msg', null);
    db.failBuild(id, undefined);
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.ok(build.error_message, 'error_message must not be null even when caller passes undefined');
  });

  it('failBuild with empty string errorMessage stores sentinel (never NULL)', () => {
    const id = db.createBuild('fail-empty-msg', null);
    db.failBuild(id, '');
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.ok(build.error_message, 'error_message must not be null even when caller passes empty string');
  });

  it('completeBuild sets error_message from report.errors for failed builds', () => {
    const id = db.createBuild('fail-with-errors', null);
    db.completeBuild(id, {
      status: 'FAILED',
      iterations: 0,
      generation_time_s: 5,
      total_time_s: 10,
      test_results: [],
      review_result: null,
      models: {},
      errors: ['HTML generation failed: claude -p exited with code 1'],
    });
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.ok(build.error_message, 'error_message should not be null for failed builds with errors');
    assert.ok(build.error_message.includes('HTML generation failed'));
  });

  it('completeBuild sets error_message from test results when errors array is empty', () => {
    const id = db.createBuild('fail-no-errors', null);
    db.completeBuild(id, {
      status: 'FAILED',
      iterations: 0,
      generation_time_s: 30,
      total_time_s: 120,
      test_results: [
        { batch: 'game-flow', iteration: 1, passed: 1, failed: 3 },
        { batch: 'mechanics', iteration: 1, passed: 0, failed: 2 },
      ],
      review_result: 'SKIPPED',
      models: {},
      errors: [],
    });
    const build = db.getBuild(id);
    assert.equal(build.status, 'failed');
    assert.ok(build.error_message, 'error_message should be derived from test results');
    assert.ok(build.error_message.includes('passed'));
  });

  it('completeBuild does not overwrite existing error_message (COALESCE)', () => {
    const id = db.createBuild('fail-existing-err', null);
    db.failBuild(id, 'pre-existing error');
    db.completeBuild(id, {
      status: 'FAILED',
      iterations: 0,
      generation_time_s: 5,
      total_time_s: 10,
      test_results: [],
      review_result: null,
      models: {},
      errors: ['new error from completeBuild'],
    });
    const build = db.getBuild(id);
    // COALESCE: existing error_message should not be overwritten
    assert.equal(build.error_message, 'pre-existing error');
  });

  it('completeBuild does not set error_message for approved builds', () => {
    const id = db.createBuild('approved-no-err', null);
    db.completeBuild(id, {
      status: 'APPROVED',
      iterations: 3,
      generation_time_s: 30,
      total_time_s: 120,
      test_results: [{ batch: 'game-flow', iteration: 3, passed: 5, failed: 0 }],
      review_result: 'APPROVED',
      models: {},
      errors: [],
    });
    const build = db.getBuild(id);
    assert.equal(build.status, 'approved');
    assert.equal(build.error_message, null, 'approved builds should not have error_message');
  });

  it('getRecentBuilds returns builds in order', () => {
    const builds = db.getRecentBuilds(5);
    assert.ok(Array.isArray(builds));
    assert.ok(builds.length > 0);
    // Should have duration_s alias
    assert.ok('duration_s' in builds[0]);
  });

  it('getBuildsByGame filters by game_id', () => {
    db.createBuild('unique-game-xyz', null);
    const builds = db.getBuildsByGame('unique-game-xyz');
    assert.ok(builds.length >= 1);
    assert.ok(builds.every((b) => b.game_id === 'unique-game-xyz'));
  });

  it('getBuildStats returns aggregate stats', () => {
    const stats = db.getBuildStats();
    assert.ok(typeof stats.total === 'number');
    assert.ok('approved' in stats);
    assert.ok('failed' in stats);
    assert.ok('running' in stats);
    assert.ok('queued' in stats);
  });

  it('getBuild returns undefined for non-existent id', () => {
    const build = db.getBuild(99999);
    assert.equal(build, undefined);
  });

  it('getRunningBuilds returns builds with running status', () => {
    const id = db.createBuild('orphan-test', null);
    db.startBuild(id);
    const running = db.getRunningBuilds();
    assert.ok(Array.isArray(running));
    const found = running.find((b) => b.id === id);
    assert.ok(found, 'newly started build should appear in getRunningBuilds()');
    assert.equal(found.status, 'running');
    assert.equal(found.game_id, 'orphan-test');
  });

  it('updateBuildSpecKeywords stores keywords as JSON array', () => {
    const id = db.createBuild('kw-test', null);
    db.updateBuildSpecKeywords(id, ['part-012', 'feedbackmanager', 'screenlayout']);
    const build = db.getBuild(id);
    assert.ok(build.spec_keywords, 'spec_keywords should be set');
    const kws = JSON.parse(build.spec_keywords);
    assert.ok(Array.isArray(kws), 'spec_keywords should parse to an array');
    assert.ok(kws.includes('part-012'));
    assert.ok(kws.includes('feedbackmanager'));
    assert.ok(kws.includes('screenlayout'));
  });

  it('updateBuildSpecKeywords stores empty array when called with no keywords', () => {
    const id = db.createBuild('kw-empty-test', null);
    db.updateBuildSpecKeywords(id, []);
    const build = db.getBuild(id);
    const kws = JSON.parse(build.spec_keywords);
    assert.ok(Array.isArray(kws));
    assert.equal(kws.length, 0);
  });

  it('updateBuildSpecKeywords is idempotent — second call overwrites first', () => {
    const id = db.createBuild('kw-overwrite-test', null);
    db.updateBuildSpecKeywords(id, ['part-001', 'oldkeyword']);
    db.updateBuildSpecKeywords(id, ['part-002', 'newkeyword']);
    const build = db.getBuild(id);
    const kws = JSON.parse(build.spec_keywords);
    assert.ok(kws.includes('newkeyword'), 'second call should overwrite');
    assert.ok(!kws.includes('oldkeyword'), 'first call values should be gone');
  });
});

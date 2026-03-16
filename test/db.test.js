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
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
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
    assert.equal(build.status, 'APPROVED');
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
    assert.equal(build.status, 'FAILED');
    assert.equal(build.error_message, 'ralph.sh crashed');
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
    assert.ok(builds.every(b => b.game_id === 'unique-game-xyz'));
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
});

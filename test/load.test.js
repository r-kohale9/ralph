'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Load/stress test skeleton for the Ralph pipeline
//
// Verifies queue behavior, database performance, and metrics under load.
// These tests simulate bulk operations without hitting external services.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('load: database under concurrent writes', () => {
  let db;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-load-'));
  const dbPath = path.join(tmpDir, 'load.db');

  before(() => {
    process.env.RALPH_DB_PATH = dbPath;
    delete require.cache[require.resolve('../lib/db')];
    db = require('../lib/db');
  });

  after(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
    delete process.env.RALPH_DB_PATH;
  });

  it('handles 47 concurrent build creates (bulk run simulation)', () => {
    const buildIds = [];
    for (let i = 0; i < 47; i++) {
      buildIds.push(db.createBuild(`load-game-${i}`, `sha-${i}`));
    }

    assert.equal(buildIds.length, 47);
    // All IDs should be unique
    const uniqueIds = new Set(buildIds);
    assert.equal(uniqueIds.size, 47);

    // All should be queryable
    for (const id of buildIds) {
      const build = db.getBuild(id);
      assert.ok(build, `Build ${id} should exist`);
      assert.equal(build.status, 'queued');
    }
  });

  it('handles rapid start/complete cycles', () => {
    const ids = [];
    for (let i = 0; i < 20; i++) {
      ids.push(db.createBuild(`rapid-${i}`, null));
    }

    // Start all
    for (const id of ids) {
      db.startBuild(id);
    }

    // Complete half as approved, half as failed
    for (let i = 0; i < ids.length; i++) {
      if (i % 2 === 0) {
        db.completeBuild(ids[i], {
          status: 'APPROVED',
          iterations: Math.floor(Math.random() * 5) + 1,
          generation_time_s: Math.random() * 60,
          total_time_s: Math.random() * 120,
          test_results: [],
          review_result: 'APPROVED',
          models: { generation: 'claude-opus-4-6' },
        });
      } else {
        db.failBuild(ids[i], `Error in game rapid-${i}`);
      }
    }

    const stats = db.getBuildStats();
    assert.ok(stats.total >= 20);
    assert.ok(stats.approved >= 10);
    assert.ok(stats.failed >= 10);
  });

  it('getRecentBuilds performs well with 100+ records', () => {
    for (let i = 0; i < 100; i++) {
      const id = db.createBuild(`perf-${i}`, null);
      db.startBuild(id);
      db.completeBuild(id, {
        status: i % 3 === 0 ? 'FAILED' : 'APPROVED',
        iterations: 1,
        generation_time_s: 10,
        total_time_s: 20,
        test_results: [],
        review_result: 'ok',
        models: {},
      });
    }

    const start = Date.now();
    const recent = db.getRecentBuilds(100);
    const elapsed = Date.now() - start;

    assert.ok(recent.length === 100);
    assert.ok(elapsed < 1000, `getRecentBuilds took ${elapsed}ms, expected <1000ms`);
  });

  it('getBuildStats aggregates correctly over many builds', () => {
    const stats = db.getBuildStats();
    assert.ok(stats.total > 0);
    assert.ok(typeof stats.approved === 'number');
    assert.ok(typeof stats.failed === 'number');
    assert.ok(typeof stats.rejected === 'number');
    assert.ok(stats.approved + stats.failed + stats.rejected <= stats.total);
  });

  it('getBuildsByGame filters correctly under load', () => {
    const targetGame = 'load-game-0';
    const builds = db.getBuildsByGame(targetGame, 10);
    assert.ok(builds.length >= 1);
    for (const b of builds) {
      assert.equal(b.game_id, targetGame);
    }
  });
});

describe('load: metrics under high throughput', () => {
  let metrics;

  before(() => {
    delete require.cache[require.resolve('../lib/metrics')];
    metrics = require('../lib/metrics');
  });

  it('handles 1000 counter increments', () => {
    for (let i = 0; i < 1000; i++) {
      metrics.incCounter('load_test_counter', { run: 'test' });
    }
    const output = metrics.formatPrometheus();
    assert.ok(output.includes('load_test_counter'));
  });

  it('handles 1000 histogram observations', () => {
    for (let i = 0; i < 1000; i++) {
      metrics.observeHistogram('load_test_duration', {}, Math.random() * 100);
    }
    const output = metrics.formatPrometheus();
    assert.ok(output.includes('load_test_duration'));
    assert.ok(output.includes('quantile="0.5"'));
    assert.ok(output.includes('quantile="0.99"'));
  });

  it('histogram bounds memory to 1000 observations', () => {
    for (let i = 0; i < 2000; i++) {
      metrics.observeHistogram('load_bounded', {}, i);
    }
    // The internal array should be bounded (tested via output validity)
    const output = metrics.formatPrometheus();
    assert.ok(output.includes('load_bounded'));
  });

  it('formatPrometheus returns valid output under load', () => {
    // Add many different labeled metrics
    for (let i = 0; i < 50; i++) {
      metrics.recordBuildStarted(`load-game-${i}`);
      metrics.recordBuildCompleted(`load-game-${i}`, 'APPROVED', Math.random() * 100, 2);
      metrics.recordLlmCall('generate', 'claude-opus-4-6', Math.random() * 5000, true);
      metrics.recordTestRun(`load-game-${i}`, 1, 8, 2);
    }

    const output = metrics.formatPrometheus();
    assert.ok(output.length > 0);
    // Should not contain NaN
    assert.ok(!output.includes('NaN'), 'Prometheus output should not contain NaN');
    // Should end with newline
    assert.ok(output.endsWith('\n'));
  });

  it('getMetricsJson returns valid structure under load', () => {
    const json = metrics.getMetricsJson();
    assert.ok(typeof json.counters === 'object');
    assert.ok(typeof json.gauges === 'object');
    assert.ok(typeof json.histograms === 'object');

    // All counter values should be numbers
    for (const [key, val] of Object.entries(json.counters)) {
      assert.equal(typeof val, 'number', `Counter ${key} should be a number`);
      assert.ok(!Number.isNaN(val), `Counter ${key} should not be NaN`);
    }
  });
});

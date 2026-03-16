'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// We need a fresh metrics module for each test to reset state.
// Since metrics uses module-level state, we re-require it each time.
function freshMetrics() {
  delete require.cache[require.resolve('../lib/metrics')];
  return require('../lib/metrics');
}

describe('metrics', () => {
  let metrics;

  beforeEach(() => {
    metrics = freshMetrics();
  });

  it('incCounter increments correctly', () => {
    metrics.incCounter('test_counter', { a: '1' });
    metrics.incCounter('test_counter', { a: '1' });
    metrics.incCounter('test_counter', { a: '1' }, 5);
    const json = metrics.getMetricsJson();
    assert.equal(json.counters['test_counter{a="1"}'], 7);
  });

  it('setGauge sets value', () => {
    metrics.setGauge('test_gauge', {}, 42);
    const json = metrics.getMetricsJson();
    assert.equal(json.gauges['test_gauge'], 42);
  });

  it('observeHistogram tracks observations', () => {
    metrics.observeHistogram('test_hist', {}, 10);
    metrics.observeHistogram('test_hist', {}, 20);
    metrics.observeHistogram('test_hist', {}, 30);
    const json = metrics.getMetricsJson();
    assert.equal(json.histograms['test_hist'].count, 3);
    assert.equal(json.histograms['test_hist'].sum, 60);
    assert.equal(json.histograms['test_hist'].avg, 20);
  });

  it('recordBuildStarted increments counter and gauge', () => {
    metrics.recordBuildStarted('doubles');
    metrics.recordBuildStarted('doubles');
    const json = metrics.getMetricsJson();
    assert.equal(json.counters['ralph_builds_started_total{game_id="doubles"}'], 2);
    assert.equal(json.gauges['ralph_builds_active'], 2);
  });

  it('recordBuildCompleted decrements active gauge', () => {
    metrics.recordBuildStarted('doubles');
    metrics.recordBuildStarted('doubles');
    metrics.recordBuildCompleted('doubles', 'APPROVED', 47.3, 2);
    const json = metrics.getMetricsJson();
    assert.equal(json.gauges['ralph_builds_active'], 1);
    assert.equal(json.counters['ralph_builds_completed_total{game_id="doubles",status="APPROVED"}'], 1);
  });

  it('active gauge does not go below 0', () => {
    metrics.recordBuildCompleted('doubles', 'APPROVED', 10, 1);
    const json = metrics.getMetricsJson();
    assert.equal(json.gauges['ralph_builds_active'], 0);
  });

  it('formatPrometheus produces valid exposition format', () => {
    metrics.recordBuildStarted('test');
    metrics.recordBuildCompleted('test', 'APPROVED', 10, 1);
    const output = metrics.formatPrometheus();
    assert.ok(output.includes('# TYPE ralph_builds_started_total counter'));
    assert.ok(output.includes('# TYPE ralph_builds_active gauge'));
    assert.ok(output.includes('# TYPE ralph_build_duration_seconds summary'));
  });

  it('metricsMiddleware sets correct content type', () => {
    let headers = {};
    let body = '';
    const mockReq = {};
    const mockRes = {
      set(key, val) { headers[key] = val; },
      send(data) { body = data; },
    };
    metrics.metricsMiddleware(mockReq, mockRes);
    assert.equal(headers['Content-Type'], 'text/plain; version=0.0.4; charset=utf-8');
    assert.ok(body.length > 0);
  });

  it('guards against undefined values in observeHistogram', () => {
    metrics.recordBuildCompleted('test', 'FAILED', 5, undefined);
    const json = metrics.getMetricsJson();
    // undefined is now rejected by observeHistogram guard, so no histogram entry
    const iterHist = json.histograms['ralph_build_iterations{status="FAILED"}'];
    assert.equal(iterHist, undefined, 'undefined values should be rejected');
    // But the duration histogram should still be recorded
    const durHist = json.histograms['ralph_build_duration_seconds{status="FAILED"}'];
    assert.equal(durHist.count, 1);
    assert.equal(durHist.sum, 5);
  });
});

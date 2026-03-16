'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// metrics.js — Prometheus-compatible metrics and telemetry
//
// Exposes a /metrics endpoint in Prometheus exposition format.
// Tracks build counts, durations, LLM call metrics, and system health.
// ─────────────────────────────────────────────────────────────────────────────

// ─── In-memory metric stores ────────────────────────────────────────────────
const counters = {};
const histograms = {};
const gauges = {};

// ─── Counter ────────────────────────────────────────────────────────────────
function incCounter(name, labels = {}, value = 1) {
  const key = metricKey(name, labels);
  counters[key] = (counters[key] || { name, labels, value: 0 });
  counters[key].value += value;
}

// ─── Gauge ──────────────────────────────────────────────────────────────────
function setGauge(name, labels = {}, value) {
  const key = metricKey(name, labels);
  gauges[key] = { name, labels, value };
}

// ─── Histogram (stores raw observations for percentile calculation) ─────────
function observeHistogram(name, labels = {}, value) {
  if (value == null || Number.isNaN(value)) return; // guard against NaN corruption
  const key = metricKey(name, labels);
  if (!histograms[key]) {
    histograms[key] = { name, labels, values: [], sum: 0, count: 0 };
  }
  histograms[key].values.push(value);
  histograms[key].sum += value;
  histograms[key].count += 1;

  // Keep only last 1000 observations to bound memory
  if (histograms[key].values.length > 1000) {
    histograms[key].values = histograms[key].values.slice(-1000);
  }
}

// ─── Metric key builder ─────────────────────────────────────────────────────
function metricKey(name, labels) {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
}

// ─── Predefined pipeline metrics ────────────────────────────────────────────

function recordBuildStarted(gameId) {
  incCounter('ralph_builds_started_total', { game_id: gameId });
  setGauge('ralph_builds_active', {}, (gauges['ralph_builds_active']?.value || 0) + 1);
}

function recordBuildCompleted(gameId, status, durationS, iterations) {
  incCounter('ralph_builds_completed_total', { game_id: gameId, status });
  observeHistogram('ralph_build_duration_seconds', { status }, durationS);
  observeHistogram('ralph_build_iterations', { status }, iterations);
  setGauge('ralph_builds_active', {}, Math.max(0, (gauges['ralph_builds_active']?.value || 0) - 1));
}

function recordLlmCall(step, model, durationMs, success) {
  incCounter('ralph_llm_calls_total', { step, model, success: String(success) });
  observeHistogram('ralph_llm_call_duration_ms', { step, model }, durationMs);
}

function recordLlmRateLimit(model) {
  incCounter('ralph_llm_rate_limits_total', { model });
}

function recordTestRun(gameId, iteration, passed, failed) {
  incCounter('ralph_test_runs_total', { game_id: gameId });
  observeHistogram('ralph_test_passed_count', {}, passed);
  observeHistogram('ralph_test_failed_count', {}, failed);
}

function recordStaticValidation(gameId, passed) {
  incCounter('ralph_static_validations_total', { passed: String(passed) });
}

function recordQueueDepth(waiting, active) {
  setGauge('ralph_queue_waiting', {}, waiting);
  setGauge('ralph_queue_active', {}, active);
}

// ─── Prometheus exposition format ───────────────────────────────────────────

function formatPrometheus() {
  const lines = [];
  const seen = new Set();

  // Counters
  for (const [key, metric] of Object.entries(counters)) {
    if (!seen.has(metric.name)) {
      lines.push(`# TYPE ${metric.name} counter`);
      seen.add(metric.name);
    }
    lines.push(`${key} ${metric.value}`);
  }

  // Gauges
  for (const [key, metric] of Object.entries(gauges)) {
    if (!seen.has(metric.name)) {
      lines.push(`# TYPE ${metric.name} gauge`);
      seen.add(metric.name);
    }
    lines.push(`${key} ${metric.value}`);
  }

  // Histograms (as summary with count/sum)
  for (const [key, metric] of Object.entries(histograms)) {
    if (!seen.has(metric.name)) {
      lines.push(`# TYPE ${metric.name} summary`);
      seen.add(metric.name);
    }
    const baseKey = metricKey(metric.name, metric.labels);
    lines.push(`${baseKey}_count ${metric.count}`);
    lines.push(`${baseKey}_sum ${metric.sum}`);

    // p50 and p99
    if (metric.values.length > 0) {
      const sorted = [...metric.values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const labelStr = Object.entries(metric.labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const quantileBase = labelStr
        ? `${metric.name}{${labelStr},`
        : `${metric.name}{`;
      lines.push(`${quantileBase}quantile="0.5"} ${p50}`);
      lines.push(`${quantileBase}quantile="0.99"} ${p99}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── Express middleware to expose /metrics ───────────────────────────────────
function metricsMiddleware(req, res) {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(formatPrometheus());
}

// ─── JSON format for API consumers ──────────────────────────────────────────
function getMetricsJson() {
  return {
    counters: Object.fromEntries(
      Object.entries(counters).map(([k, v]) => [k, v.value])
    ),
    gauges: Object.fromEntries(
      Object.entries(gauges).map(([k, v]) => [k, v.value])
    ),
    histograms: Object.fromEntries(
      Object.entries(histograms).map(([k, v]) => [k, {
        count: v.count,
        sum: v.sum,
        avg: v.count ? v.sum / v.count : 0,
      }])
    ),
  };
}

module.exports = {
  incCounter,
  setGauge,
  observeHistogram,
  recordBuildStarted,
  recordBuildCompleted,
  recordLlmCall,
  recordLlmRateLimit,
  recordTestRun,
  recordStaticValidation,
  recordQueueDepth,
  formatPrometheus,
  metricsMiddleware,
  getMetricsJson,
};

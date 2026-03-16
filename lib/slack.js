'use strict';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function notify(message) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[slack] No SLACK_WEBHOOK_URL configured, skipping notification');
    console.log('[slack] Would send:', message);
    return;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) {
      console.error(`[slack] Webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[slack] Failed to send notification: ${err.message}`);
  }
}

async function notifyBuildResult(gameId, report, commitSha) {
  const sha = commitSha ? ` · Commit: ${commitSha.slice(0, 7)}` : '';

  if (report.status === 'APPROVED') {
    const llmCalls = report.llm_calls || report.iterations || 0;
    await notify(
      `✅ ${gameId} — APPROVED (${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}, ${report.total_time_s}s, ${llmCalls} calls)${sha}`
    );
  } else if (report.status === 'REJECTED') {
    await notify(
      `🔸 ${gameId} — REJECTED by review\n   ${report.review_result}${sha}`
    );
  } else {
    const lastResult = Array.isArray(report.test_results)
      ? report.test_results[report.test_results.length - 1]
      : null;
    const failures = lastResult ? lastResult.failures : 'unknown';
    await notify(
      `❌ ${gameId} — FAILED after ${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}\n   Failures: ${failures}${sha}`
    );
  }
}

async function notifyRateLimited(gameId) {
  await notify(
    `⚠️ ${gameId} — RATE LIMITED (all accounts exhausted, retrying in 30m)`
  );
}

async function notifyBulkQueued(count) {
  await notify(
    `📋 ${count} games queued for overnight build`
  );
}

module.exports = {
  notify,
  notifyBuildResult,
  notifyRateLimited,
  notifyBulkQueued,
};

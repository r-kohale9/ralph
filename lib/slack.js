'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// slack.js — Dual-mode Slack integration (Web API + webhook fallback)
//
// Web API mode: threading, Block Kit, events handling (requires @slack/web-api)
// Webhook mode: simple notifications via incoming webhook URL (original behavior)
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

let WebClient;
try {
  ({ WebClient } = require('@slack/web-api'));
} catch {
  // @slack/web-api not installed — Web API features disabled
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

let webClient;
let initialized = false;

function init() {
  if (initialized) return !!webClient;

  initialized = true;

  if (!WebClient) {
    console.log('[slack] @slack/web-api not installed — Web API disabled, webhook fallback only');
    return false;
  }

  if (!SLACK_BOT_TOKEN) {
    console.log('[slack] SLACK_BOT_TOKEN not configured — Web API disabled, webhook fallback only');
    return false;
  }

  try {
    webClient = new WebClient(SLACK_BOT_TOKEN);
    console.log(`[slack] Web API initialized — channel: ${SLACK_CHANNEL_ID || '(not set)'}`);
    return true;
  } catch (err) {
    console.error(`[slack] Failed to initialize Web API: ${err.message}`);
    return false;
  }
}

function isWebApiEnabled() {
  return !!webClient;
}

// ─── Webhook fallback (original behavior) ────────────────────────────────────

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

// ─── Web API: Thread management ──────────────────────────────────────────────

async function createGameThread(gameId, { title, buildId } = {}) {
  if (!webClient || !SLACK_CHANNEL_ID) {
    console.log(`[slack] Would create thread for ${gameId}`);
    return null;
  }

  try {
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🎮 ${title || gameId}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Game:* ${gameId}` },
          { type: 'mrkdwn', text: `*Build:* #${buildId || 'pending'}` },
          { type: 'mrkdwn', text: '*Status:* 🔄 Building...' },
        ],
      },
    ];

    const result = await webClient.chat.postMessage({
      channel: SLACK_CHANNEL_ID,
      text: `🎮 Building ${gameId}...`,
      blocks,
    });

    return { ts: result.ts, channel: result.channel };
  } catch (err) {
    console.error(`[slack] Failed to create thread: ${err.message}`);
    return null;
  }
}

async function postThreadUpdate(threadTs, channelId, message, { blocks } = {}) {
  if (!webClient) {
    console.log(`[slack] Would post thread update: ${message}`);
    return;
  }

  try {
    await webClient.chat.postMessage({
      channel: channelId || SLACK_CHANNEL_ID,
      thread_ts: threadTs,
      text: message,
      blocks: blocks || undefined,
    });
  } catch (err) {
    console.error(`[slack] Failed to post thread update: ${err.message}`);
  }
}

async function updateThreadOpener(threadTs, channelId, gameId, report, { gcpUrl } = {}) {
  if (!webClient) return;

  const statusEmoji = report.status === 'APPROVED' ? '✅' : report.status === 'REJECTED' ? '🔸' : '❌';
  const fields = [
    { type: 'mrkdwn', text: `*Game:* ${gameId}` },
    { type: 'mrkdwn', text: `*Status:* ${statusEmoji} ${report.status}` },
    { type: 'mrkdwn', text: `*Iterations:* ${report.iterations || 0}` },
    { type: 'mrkdwn', text: `*Time:* ${report.total_time_s || 0}s` },
  ];
  if (gcpUrl) {
    fields.push({ type: 'mrkdwn', text: `*Preview:* <${gcpUrl}|Open Game>` });
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `🎮 ${gameId}`, emoji: true } },
    { type: 'section', fields },
  ];

  try {
    await webClient.chat.update({
      channel: channelId || SLACK_CHANNEL_ID,
      ts: threadTs,
      text: `${statusEmoji} ${gameId} — ${report.status}`,
      blocks,
    });
  } catch (err) {
    console.error(`[slack] Failed to update opener: ${err.message}`);
  }
}

async function postThreadResult(threadTs, channelId, gameId, report, { gcpUrl } = {}) {
  if (!webClient) {
    // Fall back to webhook notification
    await notifyBuildResult(gameId, report);
    return;
  }

  const channel = channelId || SLACK_CHANNEL_ID;
  const statusEmoji = report.status === 'APPROVED' ? '✅' : report.status === 'REJECTED' ? '🔸' : '❌';
  const iterations = report.iterations || 0;
  const llmCalls = report.llm_calls || iterations;

  const fields = [
    { type: 'mrkdwn', text: `*Status:* ${statusEmoji} ${report.status}` },
    { type: 'mrkdwn', text: `*Iterations:* ${iterations}` },
    { type: 'mrkdwn', text: `*LLM Calls:* ${llmCalls}` },
    { type: 'mrkdwn', text: `*Time:* ${report.total_time_s || 0}s` },
  ];

  if (gcpUrl) {
    fields.push({ type: 'mrkdwn', text: `*Preview:* <${gcpUrl}|Open Game>` });
  }

  const blocks = [
    {
      type: 'section',
      fields,
    },
  ];

  if (report.status === 'FAILED' && Array.isArray(report.errors) && report.errors.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Errors:*\n${report.errors.map((e) => `• ${e}`).join('\n').slice(0, 1000)}` },
    });
  }

  if (report.status === 'REJECTED' && report.review_result) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Review:* ${report.review_result.slice(0, 500)}` },
    });
  }

  if (report.status === 'APPROVED') {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '💬 Reply to this thread with feedback to trigger a targeted fix' }],
    });
  }

  try {
    await webClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `${statusEmoji} ${gameId} — ${report.status}`,
      blocks,
    });
  } catch (err) {
    console.error(`[slack] Failed to post thread result: ${err.message}`);
    // Fall back to webhook
    await notifyBuildResult(gameId, report);
  }
}

// ─── Original notification functions (webhook fallback) ─────────────────────

async function notifyBuildResult(gameId, report, commitSha, gcpUrl) {
  const sha = commitSha ? ` · Commit: ${commitSha.slice(0, 7)}` : '';
  const preview = gcpUrl ? `\n   Preview: ${gcpUrl}` : '';

  if (report.status === 'APPROVED') {
    const llmCalls = report.llm_calls || report.iterations || 0;
    await notify(
      `✅ ${gameId} — APPROVED (${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}, ${report.total_time_s}s, ${llmCalls} calls)${sha}${preview}`,
    );
  } else if (report.status === 'REJECTED') {
    await notify(`🔸 ${gameId} — REJECTED by review\n   ${report.review_result}${sha}${preview}`);
  } else {
    const lastResult = Array.isArray(report.test_results) ? report.test_results[report.test_results.length - 1] : null;
    const failures = lastResult ? lastResult.failures : 'unknown';
    const errors = Array.isArray(report.errors) && report.errors.length > 0 ? `\n   Error: ${report.errors[0]}` : '';
    await notify(
      `❌ ${gameId} — FAILED after ${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}\n   Failures: ${failures}${errors}${sha}${preview}`,
    );
  }
}

async function notifyRateLimited(gameId) {
  await notify(`⚠️ ${gameId} — RATE LIMITED (all accounts exhausted, retrying in 30m)`);
}

async function notifyBulkQueued(count) {
  await notify(`📋 ${count} games queued for overnight build`);
}

// ─── Slack Events API helpers ────────────────────────────────────────────────

function verifySlackSignature(signingSecret, timestamp, body, signature) {
  if (!signingSecret) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

function createEventsHandler(onFeedback) {
  return async (req, res) => {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];

    if (SLACK_SIGNING_SECRET && !verifySlackSignature(SLACK_SIGNING_SECRET, timestamp, rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;

    // URL verification challenge
    if (payload.type === 'url_verification') {
      return res.json({ challenge: payload.challenge });
    }

    // Event callback
    if (payload.type === 'event_callback') {
      const event = payload.event;

      // Only handle messages in threads (replies)
      if (event && event.type === 'message' && event.thread_ts && !event.bot_id && !event.subtype) {
        if (onFeedback) {
          try {
            await onFeedback({
              threadTs: event.thread_ts,
              channelId: event.channel,
              text: event.text,
              userId: event.user,
            });
          } catch (err) {
            console.error(`[slack] Feedback handler error: ${err.message}`);
          }
        }
      }

      return res.json({ ok: true });
    }

    res.json({ ok: true });
  };
}

module.exports = {
  init,
  isWebApiEnabled,
  notify,
  createGameThread,
  postThreadUpdate,
  updateThreadOpener,
  postThreadResult,
  notifyBuildResult,
  notifyRateLimited,
  notifyBulkQueued,
  verifySlackSignature,
  createEventsHandler,
};

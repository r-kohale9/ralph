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

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format a URL as a Slack mrkdwn link.
 * @param {string} url
 * @param {string} text
 * @returns {string} e.g. `<https://example.com|View HTML>`
 */
function formatLink(url, text) {
  if (!url) return text || '';
  return `<${url}|${text || url}>`;
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

async function createGameThread(gameId, {
  title,
  buildId,
  openerText,
  requestedBy,
  startedAt,
  currentStep,
  llmCalls,
  specLink,
  specGithubUrl,
  pipelineDocsLink,
  pipelineDocsUrl,
} = {}) {
  if (!webClient || !SLACK_CHANNEL_ID) {
    console.log(`[slack] Would create thread for ${gameId} (webClient=${!!webClient}, channelId=${SLACK_CHANNEL_ID || 'unset'})`);
    return null;
  }

  try {
    // Use buildParentBlocks for a consistent layout; fall back to openerText section if no block opts
    let blocks;
    if (requestedBy !== undefined || startedAt !== undefined || specGithubUrl || pipelineDocsUrl || specLink || pipelineDocsLink) {
      blocks = buildParentBlocks({
        gameId,
        gameTitle: title,
        buildId,
        status: 'running',
        requestedBy,
        startedAt,
        currentStep: currentStep || 'Queued',
        llmCalls,
        specLink,
        specGithubUrl,
        pipelineDocsLink,
        pipelineDocsUrl,
      });
    } else if (openerText) {
      blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🎮 ${title || gameId}`, emoji: true },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: openerText },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: '💬 Reply with feedback to trigger a targeted fix' }],
        },
      ];
    } else {
      blocks = buildParentBlocks({
        gameId,
        gameTitle: title,
        buildId,
        status: 'running',
        currentStep: 'Queued',
      });
    }

    const fallbackText = `🎮 Building ${title || gameId}${buildId ? ` #${buildId}` : ''}...`;

    const result = await webClient.chat.postMessage({
      channel: SLACK_CHANNEL_ID,
      text: fallbackText,
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

// ─── Block Kit composable helpers ────────────────────────────────────────────

/**
 * Build the identity + status fields for the parent build message.
 *
 * @param {string} status       — 'running' | 'APPROVED' | 'REJECTED' | 'FAILED'
 * @param {string} requestedBy  — Slack user ID or null/undefined
 * @param {number} [buildId]    — build number (optional)
 * @returns {Array} mrkdwn field objects for a Block Kit section
 */
function buildStatusField(status, requestedBy, buildId) {
  const statusMap = {
    running: '🔄 Running',
    APPROVED: '✅ Approved',
    REJECTED: '🔸 Rejected',
    FAILED: '❌ Failed',
  };
  const statusText = statusMap[status] || `🔄 ${status || 'Running'}`;

  const fields = [
    { type: 'mrkdwn', text: `*Status*\n${statusText}` },
    { type: 'mrkdwn', text: `*Requested by*\n${requestedBy ? `<@${requestedBy}>` : 'system'}` },
  ];
  if (buildId != null) {
    fields.push({ type: 'mrkdwn', text: `*Build*\n#${buildId}` });
  }
  return fields;
}

/**
 * Build the progress fields for the parent build message.
 *
 * @param {object} opts
 * @param {string}  [opts.currentStep]        — e.g. "Step 3 · game-flow · iter 2/5"
 * @param {string}  [opts.pipelineElapsedStr] — pre-computed elapsed string (e.g. "3m")
 * @param {string}  [opts.stepElapsedMin]     — elapsed in current step (e.g. "1m")
 * @param {number}  [opts.llmCalls]           — running count of LLM calls
 * @param {number}  [opts.iterations]         — total fix iterations completed
 * @returns {Array} mrkdwn field objects for a Block Kit section, may be empty
 */
function buildProgressFields({ currentStep, pipelineElapsedStr, stepElapsedMin, llmCalls, iterations } = {}) {
  const fields = [];
  if (currentStep) {
    fields.push({ type: 'mrkdwn', text: `*Step*\n${currentStep}` });
  }
  if (pipelineElapsedStr) {
    fields.push({ type: 'mrkdwn', text: `*Pipeline time*\n${pipelineElapsedStr}` });
  }
  if (stepElapsedMin) {
    fields.push({ type: 'mrkdwn', text: `*Step time*\n${stepElapsedMin}` });
  }
  if (llmCalls != null) {
    fields.push({ type: 'mrkdwn', text: `*LLM calls*\n${llmCalls}` });
  }
  if (iterations != null && iterations > 0) {
    fields.push({ type: 'mrkdwn', text: `*Iterations*\n${iterations}` });
  }
  return fields;
}

/**
 * Build the links section block for the parent build message.
 *
 * @param {object} opts
 * @param {string}  [opts.latestHtmlUrl]    — GCP URL of most recent HTML snapshot
 * @param {string}  [opts.specLink]         — pre-formatted mrkdwn spec link
 * @param {string}  [opts.specGithubUrl]    — raw spec GitHub URL (used if specLink absent)
 * @param {string}  [opts.pipelineDocsLink] — pre-formatted mrkdwn pipeline docs link
 * @param {string}  [opts.pipelineDocsUrl]  — raw pipeline docs URL (used if pipelineDocsLink absent)
 * @returns {object|null} a Block Kit section block, or null if no links present
 */
function buildLinksRow({ latestHtmlUrl, specLink, specGithubUrl, pipelineDocsLink, pipelineDocsUrl } = {}) {
  const linkParts = [];

  if (latestHtmlUrl) {
    linkParts.push(`<${latestHtmlUrl}|🎮 Latest HTML>`);
  }

  if (specLink) {
    linkParts.push(specLink);
  } else if (specGithubUrl) {
    linkParts.push(`<${specGithubUrl}|📄 Spec>`);
  }

  if (pipelineDocsLink) {
    linkParts.push(pipelineDocsLink);
  } else if (pipelineDocsUrl) {
    linkParts.push(`<${pipelineDocsUrl}|📖 Pipeline Docs>`);
  }

  if (linkParts.length === 0) return null;
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: linkParts.join('  ·  ') },
  };
}

/**
 * Build Block Kit blocks for the parent build message.
 *
 * Used by both the initial thread opener (status=running) and the final update.
 *
 * @param {object} opts
 * @param {string}  opts.gameId
 * @param {string}  [opts.gameTitle]           — display title (falls back to gameId)
 * @param {number}  [opts.buildId]
 * @param {string}  opts.status                — 'running' | 'APPROVED' | 'REJECTED' | 'FAILED'
 * @param {string}  [opts.requestedBy]         — Slack user ID or null
 * @param {number}  [opts.startedAt]           — epoch ms (Date.now()) when build started (used to compute pipelineElapsed if not provided)
 * @param {string}  [opts.currentStep]         — e.g. "Step 3 · game-flow · iter 2/5"
 * @param {number}  [opts.llmCalls]            — running count of LLM calls
 * @param {number}  [opts.iterations]          — total fix iterations completed
 * @param {string}  [opts.latestHtmlUrl]       — GCP URL of most recent HTML snapshot
 * @param {string}  [opts.specLink]            — pre-formatted mrkdwn spec link
 * @param {string}  [opts.specGithubUrl]       — raw spec GitHub URL (used if specLink absent)
 * @param {string}  [opts.pipelineDocsLink]    — pre-formatted mrkdwn pipeline docs link
 * @param {string}  [opts.pipelineDocsUrl]     — raw pipeline docs URL (used if pipelineDocsLink absent)
 * @param {string}  [opts.pipelineElapsedMin]  — total elapsed since build start (e.g. "3m")
 * @param {string}  [opts.stepElapsedMin]      — elapsed in current step (e.g. "1m"), resets on step change
 * @returns {Array} Slack Block Kit blocks array
 */
function buildParentBlocks({
  gameId,
  gameTitle,
  buildId,
  status,
  requestedBy,
  startedAt,
  currentStep,
  llmCalls,
  iterations,
  latestHtmlUrl,
  specLink,
  specGithubUrl,
  pipelineDocsLink,
  pipelineDocsUrl,
  pipelineElapsedMin,
  stepElapsedMin,
} = {}) {
  const title = gameTitle || gameId || 'Unknown Game';
  const buildLabel = buildId ? ` #${buildId}` : '';

  // Pipeline elapsed time — use explicit value if provided, else compute from startedAt
  let pipelineElapsedStr = pipelineElapsedMin || '';
  if (!pipelineElapsedStr && startedAt) {
    const elapsedMin = Math.round((Date.now() - startedAt) / 60000);
    pipelineElapsedStr = elapsedMin < 1 ? '<1m' : `${elapsedMin}m`;
  }

  // ── Header block ─────────────────────────────────────────────────────────
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🎮 ${title}${buildLabel}`, emoji: true },
    },
  ];

  // ── Identity + status row ─────────────────────────────────────────────────
  blocks.push({ type: 'section', fields: buildStatusField(status, requestedBy, buildId) });

  // ── Progress row ──────────────────────────────────────────────────────────
  const progressFields = buildProgressFields({ currentStep, pipelineElapsedStr, stepElapsedMin, llmCalls, iterations });
  if (progressFields.length > 0) {
    blocks.push({ type: 'section', fields: progressFields });
  }

  // ── Links row ─────────────────────────────────────────────────────────────
  const linksBlock = buildLinksRow({ latestHtmlUrl, specLink, specGithubUrl, pipelineDocsLink, pipelineDocsUrl });
  if (linksBlock) {
    blocks.push(linksBlock);
  }

  // ── Usage tip (context block) ─────────────────────────────────────────────
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: '💬 Reply with feedback to trigger a targeted fix' },
    ],
  });

  return blocks;
}

async function updateThreadOpener(threadTs, channelId, gameId, report, {
  gcpUrl,
  specLink,
  specGithubUrl,
  pipelineDocsLink,
  pipelineDocsUrl,
  requestedBy,
  startedAt,
  llmCalls,
  currentStep,
  gameTitle,
  pipelineElapsedMin,
  stepElapsedMin,
} = {}) {
  if (!webClient) return;

  const statusEmoji = report.status === 'APPROVED' ? '✅' : report.status === 'REJECTED' ? '🔸' : '❌';

  // Use the latest HTML URL from iteration_html_urls if available, else fall back to gcpUrl
  let latestHtmlUrl = gcpUrl;
  if (report.publish && report.publish.gameLink) {
    latestHtmlUrl = report.publish.gameLink;
  } else if (report.iteration_html_urls && typeof report.iteration_html_urls === 'object') {
    const urls = Object.values(report.iteration_html_urls);
    if (urls.length > 0) latestHtmlUrl = urls[urls.length - 1];
  }

  const blocks = buildParentBlocks({
    gameId,
    gameTitle,
    buildId: report.buildId,
    status: report.status,
    requestedBy,
    startedAt,
    currentStep: currentStep || (report.status === 'APPROVED' ? 'Complete' : report.status === 'REJECTED' ? 'Complete (rejected)' : null),
    llmCalls: llmCalls != null ? llmCalls : (report.llm_calls || null),
    iterations: report.iterations || 0,
    latestHtmlUrl,
    specLink,
    specGithubUrl,
    pipelineDocsLink,
    pipelineDocsUrl,
    pipelineElapsedMin,
    stepElapsedMin,
  });

  const mentionPrefix = '<@U0242GULG48> ';
  try {
    await webClient.chat.update({
      channel: channelId || SLACK_CHANNEL_ID,
      ts: threadTs,
      text: `${mentionPrefix}${statusEmoji} ${gameId} — ${report.status}`,
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
    { type: 'mrkdwn', text: `*Est. cost:* $${(report.total_cost_usd || 0).toFixed(3)}` },
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

  // Per-category test results
  if (report.category_results && Object.keys(report.category_results).length > 0) {
    const catLines = Object.entries(report.category_results).map(([cat, res]) => {
      const p = res.passed || 0;
      const f = res.failed || 0;
      const emoji = f === 0 ? '✅' : p === 0 ? '❌' : '⚠️';
      return `${emoji} *${cat}:* ${p}/${p + f}`;
    });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Test results:*\n${catLines.join('\n')}` },
    });
  }

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
    // Add publish links if available
    const publish = report.publish;
    if (publish && publish.gameId) {
      const linkLines = [];
      if (publish.gameLink) {
        linkLines.push(`*🎮 Play:* <${publish.gameLink}|Open Game>`);
      }
      if (Array.isArray(publish.contentSets) && publish.contentSets.length > 0) {
        const csLinks = publish.contentSets.map((cs) => {
          const url = `https://learn.mathai.ai/game/${publish.gameId}/${cs.id}`;
          const label = cs.name || cs.difficulty.charAt(0).toUpperCase() + cs.difficulty.slice(1);
          return `<${url}|${label}>`;
        });
        linkLines.push(`*Content Sets (${publish.contentSets.length}):*\n${csLinks.join('\n')}`);
      }
      if (linkLines.length > 0) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: linkLines.join('\n') },
        });
      }
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '💬 Reply to this thread with feedback to trigger a targeted fix' }],
    });
  }

  const iterUrlCount = report.iteration_html_urls ? Object.keys(report.iteration_html_urls).length : 0;
  if (iterUrlCount > 0) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `🗂 ${iterUrlCount} iteration snapshot${iterUrlCount !== 1 ? 's' : ''} available` }],
    });
  }

  const mentionPrefix = '<@U0242GULG48> ';
  try {
    await webClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `${mentionPrefix}${statusEmoji} ${gameId} — ${report.status}`,
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
  const gameLink = report.publish && report.publish.gameLink ? `\n   Play: ${report.publish.gameLink}` : '';
  const preview = gcpUrl ? `\n   Preview: ${gcpUrl}` : '';
  const mention = '<@U0242GULG48> ';

  if (report.status === 'APPROVED') {
    const llmCalls = report.llm_calls || report.iterations || 0;
    await notify(
      `${mention}✅ ${gameId} — APPROVED (${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}, ${report.total_time_s}s, ${llmCalls} calls)${sha}${gameLink}${preview}`,
    );
  } else if (report.status === 'REJECTED') {
    await notify(`${mention}🔸 ${gameId} — REJECTED by review\n   ${report.review_result}${sha}${preview}`);
  } else {
    const lastResult = Array.isArray(report.test_results) ? report.test_results[report.test_results.length - 1] : null;
    const failures = lastResult ? lastResult.failures : 'unknown';
    const errors = Array.isArray(report.errors) && report.errors.length > 0 ? `\n   Error: ${report.errors[0]}` : '';
    await notify(
      `${mention}❌ ${gameId} — FAILED after ${report.iterations} iteration${report.iterations !== 1 ? 's' : ''}\n   Failures: ${failures}${errors}${sha}${preview}`,
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
  if (!signingSecret || !timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const baseString = `v0:${timestamp}:${Buffer.isBuffer(body) ? body.toString('utf8') : body}`;
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
  formatLink,
  buildStatusField,
  buildProgressFields,
  buildLinksRow,
  buildParentBlocks,
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

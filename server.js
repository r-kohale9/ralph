'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('./lib/db');
const slack = require('./lib/slack');
const logger = require('./lib/logger');
const sentry = require('./lib/sentry');
const metrics = require('./lib/metrics');

// ─── Configuration ──────────────────────────────────────────────────────────
const BULK_THRESHOLD = parseInt(process.env.RALPH_BULK_THRESHOLD || '5', 10);

// ─── Extract changed spec game IDs from push event ──────────────────────────
function extractChangedSpecs(payload) {
  const gameIds = new Set();
  const commits = payload.commits || [];

  for (const commit of commits) {
    const files = [
      ...(commit.added || []),
      ...(commit.modified || []),
      ...(commit.removed || []),
    ];
    for (const file of files) {
      // Match warehouse/templates/{game-id}/spec.md
      const match = file.match(/warehouse\/templates\/([^/]+)\/spec\.md$/);
      if (match) {
        gameIds.add(match[1]);
      }
    }
  }

  return gameIds;
}

// ─── Get next midnight in timezone for overnight scheduling ─────────────────
function getNextMidnight(timezone) {
  // Get current date parts in the target timezone
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  const h = get('hour'), m = get('minute'), s = get('second');

  // Milliseconds remaining until midnight in that timezone
  const msUntilMidnight = ((23 - h) * 3600 + (59 - m) * 60 + (60 - s)) * 1000;

  // If we're within 1 minute of midnight, schedule for tomorrow midnight instead
  return now.getTime() + (msUntilMidnight < 60000 ? msUntilMidnight + 86400000 : msUntilMidnight);
}

// ─── Create Express app (testable without Redis) ────────────────────────────
function createApp(deps = {}) {
  const queue = deps.queue || null;
  const connection = deps.connection || null;
  const webhookSecret = deps.webhookSecret !== undefined ? deps.webhookSecret : process.env.GITHUB_WEBHOOK_SECRET;

  const app = express();

  // Raw body for webhook signature verification, then JSON parse
  app.use('/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // ─── GitHub webhook signature verification ────────────────────────────────
  function verifyGitHubSignature(req, res, next) {
    if (!webhookSecret) {
      console.warn('[webhook] No GITHUB_WEBHOOK_SECRET configured — skipping verification');
      try {
        req.body = JSON.parse(req.body.toString());
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
      return next();
    }

    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const expected = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      req.body = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    next();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── GitHub webhook endpoint ──────────────────────────────────────────────
  // Express 5: async errors are caught automatically — no try/catch needed
  app.post('/webhook/github', verifyGitHubSignature, async (req, res) => {
    const event = req.headers['x-github-event'];

    if (event !== 'push') {
      return res.json({ ignored: true, reason: `event type: ${event}` });
    }

    const ref = req.body.ref || '';
    if (!ref.endsWith('/c_code') && !ref.endsWith('/main')) {
      return res.json({ ignored: true, reason: `branch: ${ref}` });
    }

    const changedSpecs = extractChangedSpecs(req.body);

    if (changedSpecs.size === 0) {
      return res.json({ queued: 0, reason: 'no spec changes detected' });
    }

    const commitSha = req.body.after || null;

    if (changedSpecs.size > BULK_THRESHOLD) {
      // Bulk — schedule overnight
      const midnight = getNextMidnight('Asia/Kolkata');
      const delay = midnight - Date.now();

      for (const gameId of changedSpecs) {
        const buildId = db.createBuild(gameId, commitSha);
        await queue.add('build-game', { gameId, commitSha, buildId }, { delay });
      }

      await slack.notifyBulkQueued(changedSpecs.size);
      logger.info(`${changedSpecs.size} games queued for overnight build`, { event: 'bulk_queue' });
      return res.json({ queued: changedSpecs.size, scheduled: 'overnight' });
    }

    // Small batch — run now
    for (const gameId of changedSpecs) {
      const buildId = db.createBuild(gameId, commitSha);
      await queue.add('build-game', { gameId, commitSha, buildId });
    }

    logger.info(`${changedSpecs.size} games queued for immediate build`, { event: 'immediate_queue' });
    return res.json({ queued: changedSpecs.size, scheduled: 'immediate' });
  });

  // ─── Manual build trigger ─────────────────────────────────────────────────
  app.post('/api/build', async (req, res) => {
    const { gameId, all, specPath, specUrl } = req.body;

    if (all) {
      const fs = require('fs');
      const path = require('path');
      const repoDir = process.env.RALPH_REPO_DIR || path.join(__dirname, 'repo');
      const templatesDir = path.join(repoDir, 'warehouse', 'templates');

      if (!fs.existsSync(templatesDir)) {
        return res.status(400).json({ error: `Templates directory not found: ${templatesDir}` });
      }

      const gameIds = fs.readdirSync(templatesDir).filter(d => {
        const specFile = path.join(templatesDir, d, 'spec.md');
        return fs.statSync(path.join(templatesDir, d)).isDirectory() && fs.existsSync(specFile);
      });

      if (gameIds.length === 0) {
        return res.json({ queued: 0, reason: 'no templates with spec.md found' });
      }

      const midnight = getNextMidnight('Asia/Kolkata');
      const delay = midnight - Date.now();

      for (const gId of gameIds) {
        const buildId = db.createBuild(gId, null);
        await queue.add('build-game', { gameId: gId, buildId }, { delay });
      }

      await slack.notifyBulkQueued(gameIds.length);
      logger.info(`${gameIds.length} games queued for overnight rebuild (all:true)`, { event: 'bulk_rebuild' });
      return res.json({ queued: gameIds.length, scheduled: 'overnight', gameIds });
    }

    if (!gameId) {
      return res.status(400).json({ error: 'gameId is required' });
    }

    if (specUrl && specPath) {
      return res.status(400).json({ error: 'Provide specPath or specUrl, not both' });
    }

    if (specUrl) {
      try { new URL(specUrl); } catch {
        return res.status(400).json({ error: 'specUrl must be a valid URL' });
      }
    }

    const buildId = db.createBuild(gameId, null);
    await queue.add('build-game', {
      gameId,
      buildId,
      specPath: specPath || null,
      specUrl: specUrl || null,
    });

    logger.info(`Build queued for ${gameId}`, { gameId, buildId, event: 'manual_build' });
    return res.json({ queued: true, buildId, gameId });
  });

  // ─── Build status and history ─────────────────────────────────────────────
  app.get('/api/builds', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const builds = db.getRecentBuilds(limit);
    const stats = db.getBuildStats();
    res.json({ stats, builds });
  });

  app.get('/api/builds/:id', (req, res) => {
    const build = db.getBuild(parseInt(req.params.id, 10));
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }
    try { if (build.test_results) build.test_results = JSON.parse(build.test_results); } catch { /* keep raw */ }
    try { if (build.models) build.models = JSON.parse(build.models); } catch { /* keep raw */ }
    res.json(build);
  });

  app.get('/api/games/:gameId/builds', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const builds = db.getBuildsByGame(req.params.gameId, limit);
    res.json(builds);
  });

  // ─── Failure patterns API (E7) ─────────────────────────────────────────────
  app.get('/api/failure-patterns', (req, res) => {
    const gameId = req.query.gameId || null;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const patterns = db.getFailurePatterns(gameId, limit);
    const stats = db.getFailureStats();
    const top = db.getTopFailurePatterns(10);
    res.json({ stats, top_patterns: top, patterns });
  });

  // ─── Metrics endpoint (Prometheus) ────────────────────────────────────────
  app.get('/metrics', metrics.metricsMiddleware);

  // ─── Metrics JSON endpoint ────────────────────────────────────────────────
  app.get('/api/metrics', (req, res) => {
    res.json(metrics.getMetricsJson());
  });

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async (req, res) => {
    const stats = db.getBuildStats();
    let redisOk = false;
    let queueCounts = {};
    try {
      if (connection) await connection.ping();
      redisOk = !!connection;
      if (queue) queueCounts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    } catch { /* Redis down — report degraded */ }

    res.json({
      status: redisOk ? 'ok' : 'degraded',
      redis: redisOk,
      queue: queueCounts,
      builds: stats,
    });
  });

  // ─── Error handler (Express 5: catches async rejections automatically) ────
  app.use(sentry.expressErrorHandler());
  app.use((err, _req, res, _next) => {
    logger.error(`Unhandled error: ${err.message}`, { event: 'unhandled_error' });
    sentry.captureException(err, { step: 'express_error_handler' });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// ─── Start server (only when run directly, not when required by tests) ──────
if (require.main === module) {
  const IORedis = require('ioredis');
  const { Queue } = require('bullmq');

  const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  // Initialize observability
  sentry.init('ralph-server');
  logger.initCloudLogging();

  // Enforce webhook secret in production
  if (!GITHUB_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
    console.error('[FATAL] GITHUB_WEBHOOK_SECRET must be set in production. Refusing to start.');
    process.exit(1);
  }

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue('ralph-builds', { connection });

  const app = createApp({ queue, connection, webhookSecret: GITHUB_WEBHOOK_SECRET });

  const server = app.listen(PORT, () => {
    console.log(`[ralph-server] Listening on port ${PORT}`);
    console.log(`[ralph-server] Webhook: POST /webhook/github`);
    console.log(`[ralph-server] API:     POST /api/build`);
    console.log(`[ralph-server] Status:  GET  /api/builds`);
    console.log(`[ralph-server] Health:  GET  /health`);
  });

  async function shutdown() {
    console.log('[ralph-server] Shutting down...');
    server.close();
    await queue.close();
    await connection.quit();
    db.close();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createApp, extractChangedSpecs, getNextMidnight };

'use strict';

try { require('dotenv').config(); } catch { /* dotenv optional */ }

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
    const files = [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])];
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const h = get('hour'),
    m = get('minute'),
    s = get('second');

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

  // Raw body for webhook/slack signature verification, then JSON parse
  app.use('/webhook', express.raw({ type: 'application/json' }));
  app.use(
    '/slack',
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
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

    const expected = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');

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

    // Helper: check spec hash to decide if webhook build should be skipped
    function shouldSkipWebhookBuild(gameId) {
      const existing = db.getDb().prepare(
        "SELECT id, status FROM builds WHERE game_id = ? AND status IN ('queued', 'running') ORDER BY id DESC LIMIT 1",
      ).get(gameId);
      return !!existing;
    }

    if (changedSpecs.size > BULK_THRESHOLD) {
      // Bulk — schedule overnight
      const midnight = getNextMidnight('Asia/Kolkata');
      const delay = midnight - Date.now();

      let queued = 0;
      const skipped = [];
      for (const gameId of changedSpecs) {
        if (shouldSkipWebhookBuild(gameId)) {
          skipped.push(gameId);
          continue;
        }
        const buildId = db.createBuild(gameId, commitSha);
        await queue.add('build-game', { gameId, commitSha, buildId }, { delay });
        queued++;
      }

      if (queued > 0) await slack.notifyBulkQueued(queued);
      logger.info(`${queued} games queued for overnight build (${skipped.length} deduplicated)`, { event: 'bulk_queue' });
      return res.json({ queued, scheduled: 'overnight', deduplicated: skipped.length });
    }

    // Small batch — run now
    let queued = 0;
    const skipped = [];
    for (const gameId of changedSpecs) {
      if (shouldSkipWebhookBuild(gameId)) {
        skipped.push(gameId);
        continue;
      }
      const buildId = db.createBuild(gameId, commitSha);
      await queue.add('build-game', { gameId, commitSha, buildId });
      queued++;
    }

    logger.info(`${queued} games queued for immediate build (${skipped.length} deduplicated)`, { event: 'immediate_queue' });
    return res.json({ queued, scheduled: 'immediate', deduplicated: skipped.length });
  });

  // ─── Manual build trigger ─────────────────────────────────────────────────
  app.post('/api/build', async (req, res) => {
    const { gameId, all, specPath, specUrl, requestedBy: bodyRequestedBy } = req.body;
    const requestedBy = bodyRequestedBy || process.env.RALPH_SLACK_USER_ID || null;

    if (all) {
      const repoDir = process.env.RALPH_REPO_DIR || path.join(__dirname, 'repo');
      const templatesDir = path.join(repoDir, 'warehouse', 'templates');

      if (!fs.existsSync(templatesDir)) {
        return res.status(400).json({ error: `Templates directory not found: ${templatesDir}` });
      }

      const gameIds = fs.readdirSync(templatesDir).filter((d) => {
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
      try {
        new URL(specUrl);
      } catch {
        return res.status(400).json({ error: 'specUrl must be a valid URL' });
      }
    }

    const { force } = req.body;

    if (!force) {
      // Check for an already queued or running build for this game
      const existing = db.getDb().prepare(
        "SELECT id, status FROM builds WHERE game_id = ? AND status IN ('queued', 'running') ORDER BY id DESC LIMIT 1",
      ).get(gameId);
      if (existing) {
        logger.info(`Build deduplicated for ${gameId} — existing build #${existing.id} is ${existing.status}`, { gameId, buildId: existing.id, event: 'build_deduplicated' });
        return res.json({ buildId: existing.id, status: existing.status, deduplicated: true, queued: false, gameId });
      }

      // Skip if the game is already approved (force is required to rebuild approved games)
      const game = db.getGame(gameId);
      if (game && game.status === 'approved') {
        logger.info(`Build skipped for ${gameId} — game already approved`, { gameId, event: 'build_skipped_approved' });
        return res.json({ buildId: null, skipped: true, reason: 'game already approved', gameId });
      }
    }

    const buildId = db.createBuild(gameId, null, { requestedBy: requestedBy || null });
    await queue.add('build-game', {
      gameId,
      buildId,
      specPath: specPath || null,
      specUrl: specUrl || null,
      requestedBy: requestedBy || null,
    });

    logger.info(`Build queued for ${gameId}`, { gameId, buildId, event: 'manual_build' });
    return res.json({ queued: true, buildId, gameId });
  });

  // ─── Publish game to claude-core ───────────────────────────────────────────
  app.post('/api/publish', async (req, res) => {
    const { gameId, version, buildId, force } = req.body;

    if (!gameId) {
      return res.status(400).json({ error: 'gameId is required' });
    }

    const gameVersion = version || '1.0.0';
    const repoDir = process.env.RALPH_REPO_DIR || path.join(__dirname, 'repo');
    // Try repoDir first, then fall back to repo/ subdirectory
    let gameDir = path.join(repoDir, 'data', 'games', gameId);
    if (!fs.existsSync(gameDir)) {
      gameDir = path.join(__dirname, 'repo', 'data', 'games', gameId);
    }
    const htmlFile = path.join(gameDir, 'index.html');
    const reportFile = path.join(gameDir, 'ralph-report.json');
    const specFile = req.body.specPath
      || path.join(repoDir, 'warehouse', 'templates', gameId, 'spec.md');

    // Validate HTML exists
    if (!fs.existsSync(htmlFile)) {
      return res.status(404).json({ error: `No HTML found for ${gameId}. Run a build first.` });
    }

    // Check build status (unless force=true)
    if (!force && fs.existsSync(reportFile)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
        if (report.status !== 'APPROVED') {
          return res.status(400).json({
            error: `Build status is "${report.status}", not APPROVED. Use force=true to publish anyway.`,
          });
        }
      } catch { /* ignore parse errors */ }
    }

    // Read HTML content
    const artifactContent = fs.readFileSync(htmlFile, 'utf-8');

    // Read spec for metadata (best-effort)
    let metadata = {
      title: gameId,
      description: `${gameId} game`,
      concepts: [],
      difficulty: 'medium',
      estimatedTime: 300,
      minGrade: 1,
      maxGrade: 12,
      type: 'practice',
    };

    if (fs.existsSync(specFile)) {
      try {
        const specContent = fs.readFileSync(specFile, 'utf-8');
        // Extract title from spec (first # heading)
        const titleMatch = specContent.match(/^#\s+(.+)/m);
        if (titleMatch) metadata.title = titleMatch[1].trim();
        // Extract description from spec
        const descMatch = specContent.match(/(?:description|overview)[:\s]*([^\n]+)/i);
        if (descMatch) metadata.description = descMatch[1].trim();
      } catch { /* use defaults */ }
    }

    // Build registration payload for claude-core
    const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:4000';
    const CORE_API_TOKEN = process.env.CORE_API_TOKEN;

    if (!CORE_API_TOKEN) {
      return res.status(500).json({
        error: 'CORE_API_TOKEN not configured. Set the Bearer token for claude-core API.',
      });
    }

    // Extract fallback content from the HTML early — used for both inputSchema and content set
    let defaultContent = null;
    const fallbackMatch = artifactContent.match(
      /(?:const|var|let)\s+fallbackContent\s*=\s*(\{[\s\S]*?\});/
    );
    if (fallbackMatch) {
      try {
        defaultContent = new Function(`return ${fallbackMatch[1]}`)();
      } catch { /* ignore parse errors */ }
    }

    // Generate inputSchema from fallback content structure (so validation passes)
    function inferSchema(obj) {
      if (Array.isArray(obj)) {
        return { type: 'array', items: obj.length > 0 ? inferSchema(obj[0]) : {} };
      }
      if (obj !== null && typeof obj === 'object') {
        const properties = {};
        for (const [k, v] of Object.entries(obj)) {
          properties[k] = inferSchema(v);
        }
        return { type: 'object', properties, required: Object.keys(properties) };
      }
      return { type: typeof obj };
    }

    let inputSchema = { type: 'object', properties: {}, required: [] };
    // Priority: inputSchema.json file > inferred from fallback content > generic default
    const schemaFile = path.join(gameDir, 'inputSchema.json');
    if (fs.existsSync(schemaFile)) {
      try {
        inputSchema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
      } catch { /* use inferred */ }
    } else if (defaultContent) {
      inputSchema = inferSchema(defaultContent);
    }

    const gameName = gameId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const registerPayload = {
      name: gameName,
      version: gameVersion,
      metadata,
      capabilities: {
        tracks: ['accuracy', 'time', 'stars'],
        provides: ['score', 'stars'],
      },
      inputSchema,
      artifactContent,
      publishedBy: 'ralph-pipeline',
    };

    try {
      const coreRes = await fetch(`${CORE_API_URL}/api/games/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CORE_API_TOKEN}`,
        },
        body: JSON.stringify(registerPayload),
      });

      const coreBody = await coreRes.json();

      if (!coreRes.ok) {
        return res.status(coreRes.status).json({
          error: 'Failed to register game with claude-core',
          detail: coreBody,
        });
      }

      const registeredGameId = coreBody.data?.id;
      const artifactUrl = coreBody.data?.artifactUrl;

      // Create a default content set so the game is playable on learn.mathai.ai
      let contentSetId = null;
      try {
        if (defaultContent) {
          const contentSetRes = await fetch(`${CORE_API_URL}/api/content-sets/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CORE_API_TOKEN}`,
            },
            body: JSON.stringify({
              gameId: registeredGameId,
              name: `${metadata.title} — Default`,
              description: 'Default content set extracted from game fallback content',
              grade: metadata.minGrade || 3,
              difficulty: metadata.difficulty || 'medium',
              concepts: metadata.concepts.length > 0 ? metadata.concepts : ['general'],
              content: defaultContent,
              createdBy: 'ralph-pipeline',
            }),
          });

          if (contentSetRes.ok) {
            const csBody = await contentSetRes.json();
            contentSetId = csBody.data?.id;
            logger.info(`Created default content set ${contentSetId} for ${registeredGameId}`, {
              gameId: registeredGameId,
              contentSetId,
              event: 'content_set_created',
            });
          } else {
            const csError = await contentSetRes.text();
            logger.warn(`Failed to create content set for ${registeredGameId}: ${csError}`, {
              gameId: registeredGameId,
              event: 'content_set_error',
            });
          }
        } else {
          logger.info(`No fallbackContent found in HTML for ${gameId}, skipping content set creation`, {
            gameId,
            event: 'no_fallback_content',
          });
        }
      } catch (csErr) {
        logger.warn(`Content set creation failed for ${registeredGameId}: ${csErr.message}`, {
          gameId: registeredGameId,
          event: 'content_set_error',
        });
      }

      // Build the learn.mathai.ai game link (include contentSetId if available)
      const gameLink = contentSetId
        ? `https://learn.mathai.ai/game/${registeredGameId}/${contentSetId}`
        : `https://learn.mathai.ai/game/${registeredGameId}`;

      logger.info(`Published ${gameId} to claude-core`, {
        gameId,
        registeredGameId,
        version: gameVersion,
        artifactUrl,
        contentSetId,
        event: 'game_published',
      });

      return res.json({
        published: true,
        gameId: registeredGameId,
        version: gameVersion,
        artifactUrl,
        contentSetId,
        gameLink,
      });
    } catch (err) {
      logger.error(`Failed to publish ${gameId}: ${err.message}`, { gameId, event: 'publish_error' });
      return res.status(502).json({
        error: `Failed to connect to claude-core API at ${CORE_API_URL}`,
        detail: err.message,
      });
    }
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
    try {
      if (build.test_results) build.test_results = JSON.parse(build.test_results);
    } catch {
      /* keep raw */
    }
    try {
      if (build.models) build.models = JSON.parse(build.models);
    } catch {
      /* keep raw */
    }
    res.json(build);
  });

  // ─── Cancel a running build ────────────────────────────────────────────────
  app.post('/api/builds/:id/cancel', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const build = db.getBuild(id);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }
    if (build.status !== 'running') {
      return res.status(400).json({ error: 'Build is not running' });
    }
    db.failBuild(id, 'Cancelled by user');
    logger.info(`Build ${id} cancelled`, { buildId: id, event: 'build_cancelled' });
    // Fire-and-forget Slack notification (optional)
    if (process.env.SLACK_WEBHOOK_URL) {
      slack.notify(`Build #${id} cancelled by user`).catch(() => {});
    }
    res.json({ success: true, buildId: id, status: 'FAILED' });
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

  // ─── Games API ─────────────────────────────────────────────────────────────
  app.get('/api/games', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const games = db.listGames(limit);
    res.json(games);
  });

  app.post('/api/games', (req, res) => {
    const { gameId, title, description, specContent } = req.body;
    if (!gameId) {
      return res.status(400).json({ error: 'gameId is required' });
    }
    const specHash = specContent ? crypto.createHash('sha256').update(specContent).digest('hex').slice(0, 16) : null;
    db.createGame(gameId, { title, description, specContent, specHash });
    logger.info(`Game created: ${gameId}`, { gameId, event: 'game_created' });
    res.json({ gameId, created: true });
  });

  app.get('/api/games/:gameId', (req, res) => {
    const game = db.getGame(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  });

  // ─── Learnings API ─────────────────────────────────────────────────────────
  app.get('/api/learnings', (req, res) => {
    const learnings = db.getLearnings({
      gameId: req.query.gameId || null,
      category: req.query.category || null,
      level: req.query.level || null,
      includeResolved: req.query.includeResolved === 'true',
    });
    const stats = db.getLearningStats();
    res.json({ stats, learnings });
  });

  app.post('/api/learnings', (req, res) => {
    const { gameId, buildId, content, category, level, source } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }
    const id = db.addLearning(gameId || null, { buildId, category, level, content, source });
    logger.info(`Learning added: ${id}`, { learningId: id, event: 'learning_added' });
    res.json({ id, created: true });
  });

  // ─── Targeted fix API ──────────────────────────────────────────────────────
  app.post('/api/fix', async (req, res) => {
    const { gameId, feedbackPrompt, buildId } = req.body;
    if (!gameId || !feedbackPrompt) {
      return res.status(400).json({ error: 'gameId and feedbackPrompt are required' });
    }

    const newBuildId = db.createBuild(gameId, null);
    db.updateBuildFeedback(newBuildId, feedbackPrompt);

    if (queue) {
      await queue.add('build-game', {
        type: 'fix',
        gameId,
        buildId: newBuildId,
        parentBuildId: buildId || null,
        feedbackPrompt,
      });
    }

    logger.info(`Targeted fix queued for ${gameId}`, { gameId, buildId: newBuildId, event: 'fix_queued' });
    res.json({ queued: true, buildId: newBuildId, gameId });
  });

  // ─── Slack Events API ──────────────────────────────────────────────────────
  app.post(
    '/slack/events',
    slack.createEventsHandler(async (feedback) => {
      // Look up game by thread_ts
      const games = db.listGames(200);
      const game = games.find((g) => g.slack_thread_ts === feedback.threadTs);

      if (!game) {
        console.log(`[slack-events] No game found for thread ${feedback.threadTs}`);
        return;
      }

      // Queue a targeted fix
      const buildId = db.createBuild(game.game_id, null, { requestedBy: feedback.userId || null });
      db.updateBuildFeedback(buildId, feedback.text);

      if (queue) {
        await queue.add('build-game', {
          type: 'fix',
          gameId: game.game_id,
          buildId,
          feedbackPrompt: feedback.text,
        });
      }

      // Post acknowledgment in thread
      await slack.postThreadUpdate(
        feedback.threadTs,
        feedback.channelId,
        `🔧 Targeted fix queued (build #${buildId}) based on your feedback.`,
      );

      logger.info(`Slack feedback triggered fix for ${game.game_id}`, {
        gameId: game.game_id,
        buildId,
        event: 'slack_feedback_fix',
      });
    }),
  );

  // ─── MCP Streamable HTTP endpoint ──────────────────────────────────────────
  const mcpSessions = new Map();

  function getMcpServer() {
    try {
      const { createMcpServer } = require('./lib/mcp');
      return createMcpServer({ db, queue, logger, repoDir: process.env.RALPH_REPO_DIR || '.' });
    } catch (err) {
      console.warn(`[mcp] MCP unavailable: ${err.message}`);
      return null;
    }
  }

  app.post('/mcp', async (req, res) => {
    const mcpServer = getMcpServer();
    if (!mcpServer) {
      return res.status(501).json({ error: 'MCP not available — install @modelcontextprotocol/sdk' });
    }

    try {
      const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && mcpSessions.has(sessionId)) {
        transport = mcpSessions.get(sessionId);
      } else {
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
        await mcpServer.connect(transport);
        transport.onclose = () => {
          if (transport.sessionId) mcpSessions.delete(transport.sessionId);
        };
      }

      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId && !mcpSessions.has(transport.sessionId)) {
        mcpSessions.set(transport.sessionId, transport);
      }
    } catch (err) {
      logger.error(`MCP error: ${err.message}`, { event: 'mcp_error' });
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP request failed' });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? mcpSessions.get(sessionId) : null;
    if (!transport) {
      return res.status(400).json({ error: 'No active MCP session — send POST /mcp first' });
    }

    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP SSE connection failed' });
      }
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? mcpSessions.get(sessionId) : null;
    if (transport) {
      try {
        await transport.close();
      } catch {
        /* ignore */
      }
      mcpSessions.delete(sessionId);
    }
    res.json({ ok: true });
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
    } catch {
      /* Redis down — report degraded */
    }

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

  // Initialize Slack Web API
  slack.init();

  const server = app.listen(PORT, () => {
    console.log(`[ralph-server] Listening on port ${PORT}`);
    console.log(`[ralph-server] Webhook: POST /webhook/github`);
    console.log(`[ralph-server] API:     POST /api/build`);
    console.log(`[ralph-server] Status:  GET  /api/builds`);
    console.log(`[ralph-server] MCP:     POST /mcp`);
    console.log(`[ralph-server] Games:   GET  /api/games`);
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

'use strict';

// Load .env from project root
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch { /* dotenv optional */ }

/**
 * Pipeline V2 — Express server
 *
 * Minimal server with only the endpoints needed for the V2 pipeline.
 * Uses BullMQ for job queue and the Agent SDK-based pipeline.
 *
 * Endpoints:
 *   POST /api/build          — Trigger a build
 *   POST /api/fix            — Trigger a targeted fix
 *   POST /api/builds/:id/cancel — Cancel a queued build
 *   GET  /api/builds         — List builds
 *   GET  /api/builds/:id     — Get build details
 *   GET  /health             — Health check
 *   POST /slack/events       — Slack Events API handler
 */

const express = require('express');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { runPipeline, runTargetedFix } = require('./pipeline');
const slack = require('./slack');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Optional V1 modules (reuse for GCS, publishing, etc.) ──────────────────

let gcp;
try {
  gcp = require('../lib/gcp');
  gcp.init();
} catch (err) {
  console.warn(`[server-v2] GCP module not available: ${err.message}`);
  gcp = { isEnabled: () => false, uploadGameArtifact: async () => null, uploadContent: async () => null };
}

// ─── Redis & Queue ──────────────────────────────────────────────────────────

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const QUEUE_NAME = 'ralph-v2-builds';
const queue = new Queue(QUEUE_NAME, { connection });

// ─── Database (reuse from v1) ───────────────────────────────────────────────

let db;
try {
  db = require('../lib/db');
} catch (err) {
  console.warn(`[server-v2] DB module not available: ${err.message}`);
  // Stub DB for standalone operation
  db = {
    createBuild: () => Math.floor(Math.random() * 100000),
    startBuild: () => {},
    completeBuild: () => {},
    failBuild: () => {},
    getBuild: () => null,
    getGame: () => null,
    getRunningBuilds: () => [],
    getRecentBuilds: () => [],
    getBuildsByGame: () => [],
    updateGameThread: () => {},
    updateGameStatus: () => {},
    updateBuildGcpUrl: () => {},
    updateGameGcpUrl: () => {},
    getFailurePatterns: () => [],
    resolveFailurePattern: () => {},
    recordFailurePattern: () => {},
    getDb: null, // No DB handle in stub mode
  };
}

// ─── Express app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── POST /api/build ─────────────────────────────────────────────────────────
app.post('/api/build', async (req, res) => {
  try {
    const { gameId, specPath, force = false, requestedBy: bodyRequestedBy } = req.body;
    const requestedBy = bodyRequestedBy || process.env.RALPH_SLACK_USER_ID || null;

    if (!gameId || !specPath) {
      return res.status(400).json({ error: 'gameId and specPath are required' });
    }

    if (!fs.existsSync(specPath)) {
      return res.status(400).json({ error: `Spec not found: ${specPath}` });
    }

    // Skip if game already approved (unless force=true)
    if (!force) {
      const gameRecord = db.getGame(gameId);
      if (gameRecord?.status === 'approved') {
        return res.status(409).json({ error: `${gameId} is already approved. Use force=true to rebuild.` });
      }
    }

    // Check for active builds of the same game
    const activeJobs = await queue.getJobs(['active', 'waiting']);
    const existingJob = activeJobs.find((j) => j.data.gameId === gameId);
    if (existingJob && !force) {
      return res.status(409).json({ error: `Build already in progress for ${gameId} (job ${existingJob.id})` });
    }

    // Determine game output directory
    const gameDir = path.join(config.WAREHOUSE_DIR, gameId);

    // Create build record (V1 DB signature: createBuild(gameId, commitSha, { requestedBy }))
    const buildId = db.createBuild(gameId, null, { requestedBy });

    // Queue the job
    await queue.add('build-game', {
      gameId,
      specPath,
      gameDir,
      buildId,
      requestedBy,
      pipeline: 'v2',
    }, {
      jobId: `v2-${gameId}-${buildId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    console.log(`[server-v2] Queued build #${buildId} for ${gameId}`);
    res.json({ ok: true, buildId, gameId, pipeline: 'v2' });

  } catch (err) {
    console.error(`[server-v2] Build error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/fix ───────────────────────────────────────────────────────────
app.post('/api/fix', async (req, res) => {
  try {
    const { gameId, specPath, gameDir, feedback, requestedBy: bodyRequestedBy } = req.body;
    const requestedBy = bodyRequestedBy || process.env.RALPH_SLACK_USER_ID || null;

    if (!gameId || !feedback) {
      return res.status(400).json({ error: 'gameId and feedback are required' });
    }

    const resolvedGameDir = gameDir || path.join(config.WAREHOUSE_DIR, gameId);
    const resolvedSpecPath = specPath || path.join(config.DATA_DIR, 'game-specs', gameId, 'spec.md');

    const buildId = db.createBuild(gameId, null, { requestedBy });

    await queue.add('build-game', {
      type: 'fix',
      gameId,
      specPath: resolvedSpecPath,
      gameDir: resolvedGameDir,
      buildId,
      feedback,
      requestedBy,
      pipeline: 'v2',
    }, {
      jobId: `v2-fix-${gameId}-${buildId}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    res.json({ ok: true, buildId, gameId, type: 'fix' });

  } catch (err) {
    console.error(`[server-v2] Fix error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/builds/:id/cancel ─────────────────────────────────────────────
app.post('/api/builds/:id/cancel', async (req, res) => {
  try {
    const buildId = parseInt(req.params.id, 10);
    const build = db.getBuild(buildId);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    if (build.status !== 'queued') {
      return res.status(400).json({ error: `Cannot cancel build in ${build.status} state` });
    }

    db.failBuild(buildId, 'Cancelled by user');

    // Try to remove from queue
    const jobs = await queue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.buildId === buildId) {
        await job.remove();
        break;
      }
    }

    res.json({ ok: true, buildId, status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/builds ─────────────────────────────────────────────────────────
app.get('/api/builds', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const builds = db.getRecentBuilds(limit);
    res.json(builds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/builds/:id ─────────────────────────────────────────────────────
app.get('/api/builds/:id', async (req, res) => {
  try {
    const build = db.getBuild(parseInt(req.params.id, 10));
    if (!build) return res.status(404).json({ error: 'Build not found' });
    res.json(build);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /health ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  res.json({
    status: 'ok',
    pipeline: 'v2',
    queue: { waiting, active },
    uptime: process.uptime(),
  });
});

// ── POST /slack/events ──────────────────────────────────────────────────────
const slackCoreModule = (() => {
  try { return require('../lib/slack'); } catch { return null; }
})();

if (slackCoreModule) {
  app.post('/slack/events', express.raw({ type: '*/*' }), slackCoreModule.createEventsHandler(
    async ({ threadTs, channelId, text, userId }) => {
      // Look up game by thread_ts → trigger fix job
      console.log(`[server-v2] Slack feedback from <@${userId}>: ${text.slice(0, 100)}`);

      // Find game associated with this thread (would need DB lookup)
      // For now, queue a generic feedback event
      try {
        const game = db.getGameByThread?.(threadTs);
        if (game) {
          const buildId = db.createBuild(game.game_id, null, { requestedBy: userId });

          await queue.add('build-game', {
            type: 'fix',
            gameId: game.game_id,
            specPath: path.join(config.DATA_DIR, 'game-specs', game.game_id, 'spec.md'),
            gameDir: path.join(config.WAREHOUSE_DIR, game.game_id),
            buildId,
            feedback: text,
            requestedBy: userId,
            pipeline: 'v2',
          });

          console.log(`[server-v2] Queued fix #${buildId} for ${game.game_id} from Slack feedback`);
        }
      } catch (err) {
        console.error(`[server-v2] Slack feedback error: ${err.message}`);
      }
    },
  ));
}

// ─── LLM client for content set generation ──────────────────────────────────
// Uses callLlm (proxy) with automatic fallback to callClaude (CLI) when proxy
// is unavailable (fetch failed / connection refused).

let _callLlmDirect, _callClaude;
try {
  const llmModule = require('../lib/llm');
  _callLlmDirect = llmModule.callLlm;
  _callClaude = llmModule.callClaude;
} catch (err) {
  console.warn(`[server-v2] LLM module not available: ${err.message}`);
}

/**
 * Resilient LLM caller: tries proxy first, falls back to Claude CLI.
 * This avoids hard dependency on the proxy server running.
 */
const callLlm = (_callLlmDirect || _callClaude) ? async function callLlmWithFallback(stepName, prompt, model, options = {}) {
  // 1) Try proxy-based callLlm first
  if (_callLlmDirect) {
    try {
      return await _callLlmDirect(stepName, prompt, model, options);
    } catch (err) {
      const isFetchError = err.message && (
        err.message.includes('fetch failed') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('socket hang up')
      );
      if (!isFetchError) throw err; // non-connection error → propagate
      console.warn(`[server-v2] callLlm proxy failed (${err.message}) — falling back to Claude CLI`);
    }
  }

  // 2) Fallback: Claude CLI (no proxy needed)
  if (_callClaude) {
    // Map API model names to CLI short names (claude -p uses short names)
    const cliModel = (model || 'sonnet')
      .replace(/^claude-/, '')           // claude-opus-4-6 → opus-4-6
      .replace(/-\d+-\d+$/, '')          // opus-4-6 → opus  (strip version)
      .replace(/^(opus|sonnet|haiku).*/, '$1'); // keep just the tier
    return await _callClaude(stepName, prompt, {
      model: cliModel || 'sonnet',
      timeout: options.timeout || 300000,
    });
  }

  throw new Error('No LLM backend available (proxy unreachable and Claude CLI not loaded)');
} : null;

// ─── Publish to core API ─────────────────────────────────────────────────────

/**
 * Extract the full `fallbackContent = {...};` block from HTML, handling nested braces.
 * The naive `\{[\s\S]*?\}` regex fails on nested objects — this counts braces properly.
 */
function _extractFallbackContent(htmlContent) {
  const startMatch = htmlContent.match(/(?:const|var|let)\s+fallbackContent\s*=\s*\{/);
  if (!startMatch) return null;

  const startIdx = htmlContent.indexOf('{', startMatch.index);
  let depth = 0;
  let i = startIdx;
  for (; i < htmlContent.length; i++) {
    if (htmlContent[i] === '{') depth++;
    else if (htmlContent[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return null;

  const objectLiteral = htmlContent.slice(startIdx, i + 1);
  return { objectLiteral, fullMatch: htmlContent.slice(startMatch.index, i + 2) }; // +2 for `};`
}

/**
 * Recursively infer JSON Schema from a JS value.
 */
function _inferSchema(obj) {
  if (Array.isArray(obj)) return { type: 'array', items: obj.length > 0 ? _inferSchema(obj[0]) : {} };
  if (obj !== null && typeof obj === 'object') {
    const props = {};
    for (const [k, v] of Object.entries(obj)) props[k] = _inferSchema(v);
    return { type: 'object', properties: props, required: Object.keys(props) };
  }
  return { type: typeof obj };
}

/**
 * Register an approved game with the core API and create content sets.
 * Mirrors V1 pipeline Step 6 — including:
 *   - LLM-driven inputSchema generation (V1 Step 1a)
 *   - Fallback to VM-based inference from fallbackContent
 *   - LLM-driven content set generation
 *
 * @param {string} gameId
 * @param {number} buildId
 * @param {string} gameDir
 * @param {object} report - Pipeline report (mutated with publish info)
 */
async function publishGame(gameId, buildId, gameDir, report, { specPath: externalSpecPath } = {}) {
  const CORE_API_URL = process.env.CORE_API_URL || '';
  const CORE_API_TOKEN = process.env.CORE_API_TOKEN || '';

  if (!CORE_API_URL || !CORE_API_TOKEN) {
    console.log('[publish] Skipped — CORE_API_URL + CORE_API_TOKEN not set');
    return;
  }

  const htmlFile = path.join(gameDir, 'index.html');
  if (!fs.existsSync(htmlFile)) {
    console.warn('[publish] Skipped — no index.html');
    return;
  }

  try {
    const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

    // Read spec for metadata — prefer the actual spec path passed from the worker,
    // fall back to warehouse convention path
    const specCandidates = [
      externalSpecPath,
      path.join(config.DATA_DIR, 'game-specs', gameId, 'spec.md'),
      path.join(gameDir, 'spec.md'),
    ].filter(Boolean);

    let specContent = '';
    let resolvedSpecPath = null;
    for (const sp of specCandidates) {
      try {
        specContent = fs.readFileSync(sp, 'utf-8');
        resolvedSpecPath = sp;
        console.log(`[publish] Spec loaded from: ${sp} (${specContent.length} chars)`);
        break;
      } catch {}
    }
    if (!specContent) {
      console.warn(`[publish] ⚠️  No spec found at any of: ${specCandidates.join(', ')}`);
    }

    const titleMatch = specContent.match(/^#\s+(.+)/m);
    const gameTitle = titleMatch ? titleMatch[1].trim() : gameId;
    const gameName = gameId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const gameVersion = `${process.env.RALPH_GAME_VERSION || '1.0.0'}-b${buildId}`;

    // ── Step A: Load inputSchema ──────────────────────────────────────────
    // Priority: 1) file from pipeline's content-gen step  2) VM inference from fallbackContent
    // No separate LLM call — the Agent SDK session generates this in pipeline.js
    const inputSchemaFile = path.join(gameDir, 'inputSchema.json');
    let inputSchema = { type: 'object', properties: {}, required: [] };
    let inputSchemaSource = 'empty';

    // 1) Check for inputSchema.json (generated by pipeline content-gen step or prior build)
    if (fs.existsSync(inputSchemaFile)) {
      try {
        inputSchema = JSON.parse(fs.readFileSync(inputSchemaFile, 'utf-8'));
        inputSchemaSource = report.generatedInputSchema ? 'agent-session' : 'file';
        console.log(`[publish] inputSchema loaded from ${inputSchemaSource} (${Object.keys(inputSchema.properties || {}).length} props)`);
      } catch (e) {
        console.warn(`[publish] inputSchema.json exists but invalid: ${e.message}`);
      }
    }

    // 2) Fallback: infer from fallbackContent using brace-matched extraction + VM
    if (inputSchemaSource === 'empty') {
      const fb = _extractFallbackContent(htmlContent);
      if (fb) {
        try {
          const vm = require('vm');
          const fbContent = vm.runInNewContext(`(${fb.objectLiteral})`, Object.create(null));
          inputSchema = _inferSchema(fbContent);
          inputSchemaSource = 'vm-inference';
          console.log(`[publish] inputSchema inferred from fallbackContent (${Object.keys(inputSchema.properties || {}).length} props)`);

          // Save for future builds
          fs.writeFileSync(inputSchemaFile, JSON.stringify(inputSchema, null, 2) + '\n');
        } catch (e) {
          console.warn(`[publish] fallbackContent VM inference failed: ${e.message}`);
        }
      } else {
        console.warn('[publish] No fallbackContent found in HTML — inputSchema will be empty');
      }
    }

    const schemaProps = Object.keys(inputSchema.properties || {}).length;
    console.log(`[publish] inputSchema: source=${inputSchemaSource}, properties=${schemaProps}, required=${(inputSchema.required || []).length}`);
    if (schemaProps === 0) {
      console.warn('[publish] ⚠️  inputSchema has ZERO properties — content sets will likely fail validation');
    }

    // ── Step B: Register game ───────────────────────────────────────────────
    console.log(`[publish] Registering ${gameId} at ${CORE_API_URL}...`);
    const registerBody = {
      name: gameName,
      version: gameVersion,
      metadata: { title: gameTitle, description: `${gameTitle} game`, concepts: [], difficulty: 'medium', estimatedTime: 300, minGrade: 1, maxGrade: 12, type: 'practice' },
      capabilities: { tracks: ['accuracy', 'time', 'stars'], provides: ['score', 'stars'] },
      inputSchema,
      artifactContent: htmlContent,
      publishedBy: 'ralph-pipeline-v2',
    };

    const registerRes = await fetch(`${CORE_API_URL}/api/games/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CORE_API_TOKEN}` },
      body: JSON.stringify(registerBody),
    });

    if (!registerRes.ok) {
      const errBody = await registerRes.text();
      console.error(`[publish] Game registration failed: HTTP ${registerRes.status} — ${errBody.slice(0, 500)}`);
      return;
    }

    const regBody = await registerRes.json();
    const publishedGameId = regBody.data?.id;
    const artifactUrl = regBody.data?.artifactUrl;
    console.log(`[publish] ✅ Game registered: ${publishedGameId} (artifact: ${artifactUrl || 'n/a'})`);

    // ── Step C: Create content sets from pipeline-generated data ────────────
    // The Agent SDK session generates content sets in the content-gen step
    // (pipeline.js). We just read them from report.generatedContentSets
    // or from content-*.json files on disk — no separate LLM call needed.
    const contentSets = [];
    const generatedSets = report.generatedContentSets || [];

    // Fallback: load content sets from disk if pipeline data missing
    if (generatedSets.length === 0) {
      try {
        // Check for a single content-sets.json (array of sets — agent's preferred format)
        const bulkFile = path.join(gameDir, 'content-sets.json');
        if (fs.existsSync(bulkFile)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(bulkFile, 'utf-8'));
            const sets = Array.isArray(parsed) ? parsed : [parsed];
            for (const cs of sets) {
              if (cs.content && typeof cs.content === 'object') {
                generatedSets.push({
                  name: cs.name || 'Default',
                  difficulty: cs.difficulty || 'medium',
                  grade: cs.grade || 5,
                  concepts: cs.concepts || [],
                  content: cs.content,
                });
              }
            }
            if (generatedSets.length > 0) {
              console.log(`[publish] Loaded ${generatedSets.length} content set(s) from content-sets.json`);
            }
          } catch (e) {
            console.warn(`[publish] content-sets.json exists but could not be parsed: ${e.message}`);
          }
        }
      } catch {}

      // Also check for individual content-N.json / content-set-N.json files
      if (generatedSets.length === 0) {
        try {
          const files = fs.readdirSync(gameDir).filter((f) => /^content-(?:set-)?\d+(?:-\w+)?\.json$/i.test(f)).sort();
          for (const f of files) {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(gameDir, f), 'utf-8'));
              const diffMatch = f.match(/content-(?:set-)?\d+-(\w+)\.json/);
              generatedSets.push({
                name: f.replace('.json', ''),
                difficulty: diffMatch ? diffMatch[1] : 'medium',
                grade: 4,
                concepts: [],
                content,
              });
            } catch {}
          }
          if (generatedSets.length > 0) {
            console.log(`[publish] Loaded ${generatedSets.length} content set(s) from disk files`);
          }
        } catch {}
      }
    }

    // Fallback: if no content sets from agent or disk, create a default from fallbackContent
    if (generatedSets.length === 0) {
      console.warn('[publish] No content sets from agent/disk — creating default from fallbackContent');
      const fb = _extractFallbackContent(htmlContent);
      if (fb) {
        try {
          const vm = require('vm');
          const fbContent = vm.runInNewContext(`(${fb.objectLiteral})`, Object.create(null));
          generatedSets.push({
            name: 'Default',
            difficulty: 'medium',
            grade: 5,
            concepts: [],
            content: fbContent,
          });
          console.log(`[publish] ✅ Created default content set from fallbackContent`);
        } catch (e) {
          console.warn(`[publish] ⚠️  Could not parse fallbackContent for default set: ${e.message}`);
        }
      } else {
        console.warn('[publish] ⚠️  No fallbackContent found — cannot create default content set');
      }
    }

    if (generatedSets.length === 0) {
      console.warn('[publish] ⚠️  No content sets available at all — game will not be playable via link');
    } else {
      console.log(`[publish] Creating ${generatedSets.length} content set(s) via core API...`);

      for (let i = 0; i < generatedSets.length; i++) {
        const cs = generatedSets[i];
        const csReqBody = {
          gameId: publishedGameId,
          name: `${gameTitle} — ${cs.name}`,
          description: `Auto-generated: ${cs.name}`,
          grade: cs.grade || 4,
          difficulty: cs.difficulty || 'medium',
          concepts: cs.concepts || [],
          content: cs.content,
          createdBy: 'ralph-pipeline-v2',
        };

        try {
          const csRes = await fetch(`${CORE_API_URL}/api/content-sets/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CORE_API_TOKEN}` },
            body: JSON.stringify(csReqBody),
          });

          if (csRes.ok) {
            const csBody = await csRes.json();
            const csId = csBody.data?.id;
            const csValid = csBody.data?.isValid;
            if (csValid) {
              console.log(`[publish] ✅ Content set ${i + 1} (${cs.name}): ${csId} [${cs.difficulty}]`);
              contentSets.push({ id: csId, name: cs.name, difficulty: cs.difficulty, grade: cs.grade });
            } else {
              const valErrors = (csBody.data?.validationErrors || []).join(', ');
              console.warn(`[publish] ⚠️  Content set ${i + 1} (${cs.name}): created but INVALID — ${valErrors}`);
              if (csId) contentSets.push({ id: csId, name: cs.name, difficulty: cs.difficulty, grade: cs.grade, valid: false });
            }
          } else {
            const errText = await csRes.text().catch(() => '');
            console.warn(`[publish] ❌ Content set ${i + 1} (${cs.name}): HTTP ${csRes.status} — ${errText.slice(0, 300)}`);
          }
        } catch (csErr) {
          console.warn(`[publish] ❌ Content set ${i + 1} (${cs.name}): ${csErr.message}`);
        }
      }

      console.log(`[publish] Content sets created: ${contentSets.length}/${generatedSets.length}`);
    }

    // Build game link — prefer medium difficulty set, then first set, then bare game
    const mediumCs = contentSets.find((cs) => cs.difficulty === 'medium');
    const gameLink = mediumCs
      ? `https://learn.mathai.ai/game/${publishedGameId}/${mediumCs.id}`
      : contentSets.length > 0
        ? `https://learn.mathai.ai/game/${publishedGameId}/${contentSets[0].id}`
        : `https://learn.mathai.ai/game/${publishedGameId}`;

    report.publish = { gameId: publishedGameId, artifactUrl, gameLink, contentSets, publishedAt: new Date().toISOString().slice(0, 10), inputSchemaSource, schemaProps };

    console.log(`[publish] 🎮 Game link: ${gameLink}`);
    for (const cs of contentSets) {
      console.log(`[publish]   ${cs.name}: https://learn.mathai.ai/game/${publishedGameId}/${cs.id}`);
    }

    // Save publish info
    fs.writeFileSync(path.join(gameDir, 'publish-info.json'), JSON.stringify(report.publish, null, 2) + '\n');

  } catch (err) {
    console.error(`[publish] ❌ Publish failed: ${err.message}`);
    console.error(`[publish]   Stack: ${err.stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ─── Config for auto-retry and warehouse ────────────────────────────────────

const AUTO_RETRY = process.env.RALPH_AUTO_RETRY === '1';
const WAREHOUSE_TEMPLATES_DIR = process.env.RALPH_WAREHOUSE_TEMPLATES_DIR
  || path.join(__dirname, '..', 'warehouse', 'templates');

// ─── Worker ─────────────────────────────────────────────────────────────────

const worker = new Worker(QUEUE_NAME, async (job) => {
  const { gameId, specPath, gameDir, buildId, type, feedback, requestedBy } = job.data;

  // ── Build log capture: intercept console output for this build ──────
  const buildLogLines = [];
  const _origLog = console.log;
  const _origWarn = console.warn;
  const _origError = console.error;
  const _origInfo = console.info;
  const _captureLog = (level, args) => {
    const line = `[${new Date().toISOString()}] [${level}] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
    buildLogLines.push(line);
  };
  console.log = (...args) => { _captureLog('LOG', args); _origLog(...args); };
  console.warn = (...args) => { _captureLog('WARN', args); _origWarn(...args); };
  console.error = (...args) => { _captureLog('ERROR', args); _origError(...args); };
  console.info = (...args) => { _captureLog('INFO', args); _origInfo(...args); };

  // Restore console at the end of this job (even on error)
  const _restoreConsole = () => {
    console.log = _origLog;
    console.warn = _origWarn;
    console.error = _origError;
    console.info = _origInfo;
  };

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`[worker-v2] Processing ${type === 'fix' ? 'fix' : 'build'} #${buildId} for ${gameId}`);
  console.log(`${'═'.repeat(70)}`);

  const startTime = Date.now();

  // ── Terminal state guard: skip stale/cancelled BullMQ jobs ────────────
  // db.failBuild() on a queued build does NOT remove it from BullMQ; on worker
  // restart the job is redelivered. Guard prevents cancelled builds from resurrecting.
  if (buildId) {
    const existingBuild = db.getBuild(buildId);
    if (existingBuild && ['failed', 'approved', 'rejected', 'cancelled'].includes(existingBuild.status)) {
      console.warn(`[worker-v2] Build #${buildId} (${gameId}) already in terminal state '${existingBuild.status}' — skipping stale job`);
      _restoreConsole();
      return { status: existingBuild.status, skipped: true };
    }
  }

  // Mark as running
  db.startBuild(buildId, { workerId: `worker-v2-${process.pid}` });

  // ── Warehouse hygiene: delete stale HTML for non-approved games ───────
  // Prevents agent from reusing broken HTML from prior failed builds.
  if (type !== 'fix') {
    const warehouseHtmlPath = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game', 'index.html');
    if (fs.existsSync(warehouseHtmlPath)) {
      const gameRecord = db.getGame(gameId);
      if (!gameRecord || gameRecord.status !== 'approved') {
        try {
          fs.unlinkSync(warehouseHtmlPath);
          console.log(`[worker-v2] Deleted stale warehouse HTML for ${gameId} (status: ${gameRecord?.status ?? 'unknown'})`);
        } catch {}
      }
    }
  }

  // ── Preflight: verify output directory is writable ────────────────────
  try {
    fs.mkdirSync(gameDir, { recursive: true });
    const testFile = path.join(gameDir, '.preflight');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
  } catch (preflightErr) {
    const msg = `pre-pipeline preflight: output directory not writable (${gameDir}): ${preflightErr.message}`;
    db.failBuild(buildId, msg);
    throw new Error(msg);
  }

  // Upload spec to GCS so Slack thread can link to it (V1 parity)
  let specLink = null;
  if (gcp.isEnabled() && specPath && fs.existsSync(specPath)) {
    try {
      const specContent = fs.readFileSync(specPath, 'utf-8');
      const gcpSpecUrl = await gcp.uploadContent(
        specContent,
        `games/${gameId}/builds/${buildId}/spec.md`,
        { contentType: 'text/markdown' },
      );
      if (gcpSpecUrl) {
        specLink = `<${gcpSpecUrl}|📄 Spec>`;
        console.log(`[worker-v2] Spec uploaded to GCS: ${gcpSpecUrl}`);
      }
    } catch (e) {
      console.warn(`[worker-v2] Spec GCS upload failed (non-fatal): ${e.message}`);
    }
  }

  // Create Slack thread
  const thread = await slack.createBuildThread(gameId, {
    buildId,
    requestedBy,
    specPath,
    specLink,
    model: config.GEN_MODEL,
  });

  if (thread) {
    db.updateGameThread(gameId, thread.ts, thread.channel);
  }

  // ── Heartbeat: update job progress every 2 min for monitoring ─────────
  const heartbeatInterval = setInterval(async () => {
    await job.updateProgress({ heartbeat: true, gameId, elapsed: ((Date.now() - startTime) / 1000).toFixed(0) }).catch(() => {});
  }, 2 * 60 * 1000);

  let latestGcpUrl = null; // Track latest GCS upload URL across steps

  const onProgress = async (event) => {
    // Upload HTML to GCS after each step completes (so preview link is available early)
    if (event.type === 'pipeline-step' && event.status === 'done') {
      const htmlFile = path.join(gameDir, 'index.html');
      if (gcp.isEnabled() && fs.existsSync(htmlFile)) {
        try {
          const stepSuffix = event.step || 'latest';
          const url = await gcp.uploadGameArtifact(gameId, buildId, htmlFile, { suffix: stepSuffix });
          if (url) {
            latestGcpUrl = url;
            db.updateBuildGcpUrl(buildId, url);
            db.updateGameGcpUrl(gameId, url);
            console.log(`[worker-v2] GCS upload (${stepSuffix}): ${url}`);
          }
        } catch (e) {
          console.warn(`[worker-v2] GCS step upload failed: ${e.message}`);
        }
      }
    }

    // Upload human-readable test report to GCS after test-fix step (V1-style)
    if (event.type === 'pipeline-step' && event.status === 'done' && event.step === 'test-fix' && gcp.isEnabled()) {
      try {
        const catResults = event.categoryResults || {};
        const CATS = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
        const reportLines = [
          `# Test Report: ${gameId} (Build #${buildId})`,
          `_Generated: ${new Date().toISOString()}_`,
          '',
        ];

        // Summary table
        let totalP = 0, totalT = 0;
        reportLines.push('## Summary');
        reportLines.push('| Category | Passed | Total | Status |');
        reportLines.push('|----------|--------|-------|--------|');
        for (const cat of CATS) {
          const r = catResults[cat];
          if (!r) { reportLines.push(`| ${cat} | - | - | ⏭️ Skipped |`); continue; }
          const p = r.passed || 0;
          const t = r.total || 0;
          totalP += p; totalT += t;
          const emoji = p === t ? '✅' : p === 0 ? '❌' : '⚠️';
          reportLines.push(`| ${cat} | ${p} | ${t} | ${emoji} ${p === t ? 'All Pass' : `${t - p} Failed`} |`);
        }
        reportLines.push(`| **TOTAL** | **${totalP}** | **${totalT}** | ${totalP === totalT ? '✅' : '⚠️'} |`);
        reportLines.push('');

        // Per-category details
        for (const cat of CATS) {
          const r = catResults[cat];
          if (!r || !r.details || r.details.length === 0) continue;
          reportLines.push(`## ${cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`);
          reportLines.push('');
          for (const d of r.details) {
            const icon = d.status === 'pass' ? '✅' : d.status === 'fail' ? '❌' : '⏭️';
            reportLines.push(`${icon} ${d.description}`);
          }
          reportLines.push('');
        }

        // Issues fixed
        if (event.issueDescriptions && event.issueDescriptions.length > 0) {
          reportLines.push('## Issues Fixed');
          reportLines.push('');
          for (const desc of event.issueDescriptions) {
            reportLines.push(`🔧 ${desc}`);
          }
          reportLines.push('');
        }

        const reportMd = reportLines.join('\n');
        const dest = `games/${gameId}/builds/${buildId}/test-report.md`;
        const reportUrl = await gcp.uploadContent(reportMd, dest, { contentType: 'text/markdown' });

        // Also save locally
        fs.writeFileSync(path.join(gameDir, `test-report-${buildId}.md`), reportMd);
        console.log(`[worker-v2] Test report saved locally and uploaded to GCS: ${reportUrl || 'n/a'}`);

        // Attach to event so Slack can show the link
        if (reportUrl) event.testReportUrl = reportUrl;
      } catch (e) {
        console.warn(`[worker-v2] Test report upload failed: ${e.message}`);
      }
    }

    // Update Slack thread with step progress
    if (thread) {
      // Attach GCS link to step-done events so Slack shows it
      if (event.type === 'pipeline-step' && event.status === 'done' && latestGcpUrl) {
        event.gcpUrl = latestGcpUrl;
      }
      await slack.postStepUpdate(thread.ts, thread.channel, event);
      await sleep(1000);

      // Post transcript summary for the completed step
      if (event.type === 'pipeline-step' && event.status === 'done' && event.step) {
        const transcriptFile = path.join(gameDir, `transcript-b${buildId}.jsonl`);
        await slack.postTranscriptUpdate(thread.ts, thread.channel, transcriptFile, event.step);
        await sleep(1000);
      }

      // Update parent message periodically
      if (event.type === 'pipeline-step' && event.status === 'running') {
        await slack.updateParentMessage(thread.ts, thread.channel, gameId, {
          status: 'running',
          totalTurns: 0,
          totalToolUses: 0,
        }, {
          buildId,
          requestedBy,
          startedAt: startTime,
          currentStep: event.step,
        });
      }
    }

    // Update job progress
    await job.updateProgress({
      step: event.step,
      status: event.status || event.type,
      elapsed: event.elapsed,
    });
  };

  let report;
  try {
    if (type === 'fix') {
      // Notify Slack about targeted fix start
      if (thread) {
        await slack.postTargetedFixStart(thread.ts, thread.channel, buildId, feedback);
      }
      report = await runTargetedFix({
        gameId,
        gameDir,
        specPath,
        feedback,
        model: config.GEN_MODEL,
        log: undefined, // Use default console
        onProgress,
      });
    } else {
      report = await runPipeline({
        gameId,
        specPath,
        gameDir,
        buildId,
        model: config.GEN_MODEL,
        log: undefined,
        onProgress,
      });
    }

    report.buildId = buildId;

    // ── Post-build steps (mirrors V1 worker) ─────────────────────────────

    // 1. Update DB with build results
    db.completeBuild(buildId, {
      status: report.status,
      iterations: report.totalTurns || 0,
      llm_calls: report.totalToolUses || 0,
      test_results: report.stepResults || [],
      models: { gen: config.GEN_MODEL },
      total_time_s: report.totalTimeS,
      total_cost_usd: report.totalCost || 0,
      errors: report.errors || [],
    });

    // 2. Write report to disk
    try {
      const reportPath = path.join(gameDir, 'ralph-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`[worker-v2] Report saved: ${reportPath}`);
    } catch (e) {
      console.warn(`[worker-v2] Could not write report: ${e.message}`);
    }

    // 2b. Write build log to disk (captures all console output for this build)
    try {
      const logLines = buildLogLines || [];
      if (logLines.length > 0) {
        const logPath = path.join(gameDir, `build-${buildId}.log`);
        fs.writeFileSync(logPath, logLines.join('\n') + '\n');
        console.log(`[worker-v2] Build log saved: ${logPath} (${logLines.length} lines)`);
      }
    } catch (e) {
      console.warn(`[worker-v2] Could not write build log: ${e.message}`);
    }

    // 2c. Write test results file (from test-fix step output)
    try {
      const testResults = {
        buildId,
        gameId,
        timestamp: new Date().toISOString(),
        status: report.status,
        steps: {},
      };

      // Extract test-fix step text (contains test case table/results)
      if (report.steps?.testFix) {
        testResults.steps.testFix = {
          turns: report.steps.testFix.turns,
          toolUses: report.steps.testFix.toolUses,
          issuesFound: report.steps.testFix.issuesFound || 0,
          issuesFixed: report.steps.testFix.issuesFixed || 0,
          totalPassed: report.steps.testFix.totalPassed || 0,
          totalTests: report.steps.testFix.totalTests || 0,
          output: report.steps.testFix.text || '',
        };
      }

      // Per-category test results (game-flow, mechanics, etc.)
      if (report.categoryResults && Object.keys(report.categoryResults).length > 0) {
        testResults.categoryResults = {};
        for (const [cat, res] of Object.entries(report.categoryResults)) {
          testResults.categoryResults[cat] = {
            passed: res.passed,
            total: res.total,
            details: (res.details || []).map((d) => ({
              status: d.status,
              description: d.description,
            })),
          };
        }
      }

      // Extract validate step text
      if (report.steps?.validate) {
        testResults.steps.validate = {
          turns: report.steps.validate.turns,
          toolUses: report.steps.validate.toolUses,
          output: report.steps.validate.text || '',
        };
      }

      // Extract visual review
      if (report.steps?.visualReview) {
        testResults.steps.visualReview = {
          turns: report.steps.visualReview.turns,
          toolUses: report.steps.visualReview.toolUses,
          output: report.steps.visualReview.text || '',
          verdict: report.visualVerdict || null,
        };
      }

      // Extract final review
      if (report.steps?.finalReview) {
        testResults.steps.finalReview = {
          turns: report.steps.finalReview.turns,
          toolUses: report.steps.finalReview.toolUses,
          output: report.steps.finalReview.text || '',
          verdict: report.finalVerdict || null,
        };
      }

      // Tool log (full list of tools called during the build)
      if (report.toolLog && report.toolLog.length > 0) {
        testResults.toolLog = report.toolLog;
      }

      const testResultsPath = path.join(gameDir, `test-results-${buildId}.json`);
      fs.writeFileSync(testResultsPath, JSON.stringify(testResults, null, 2) + '\n');
      console.log(`[worker-v2] Test results saved: ${testResultsPath}`);
    } catch (e) {
      console.warn(`[worker-v2] Could not write test results: ${e.message}`);
    }

    // 3. GCS upload — final index.html (no suffix) for canonical preview URL
    let gcpUrl = latestGcpUrl || null;
    if (gcp.isEnabled()) {
      const htmlFile = path.join(gameDir, 'index.html');
      if (fs.existsSync(htmlFile)) {
        try {
          const finalUrl = await gcp.uploadGameArtifact(gameId, buildId, htmlFile);
          if (finalUrl) {
            gcpUrl = finalUrl;
            db.updateBuildGcpUrl(buildId, finalUrl);
            db.updateGameGcpUrl(gameId, finalUrl);
            console.log(`[worker-v2] GCS final upload: ${finalUrl}`);
          }
        } catch (gcpErr) {
          console.warn(`[worker-v2] GCS final upload failed: ${gcpErr.message}`);
        }
      }
    }
    if (gcpUrl) report.gcpUrl = gcpUrl;

    // 4. Update game status
    db.updateGameStatus(gameId, report.status === 'APPROVED' ? 'approved' : report.status.toLowerCase());

    // 5. Record failure patterns on FAILED builds
    if (report.status === 'FAILED' && report.errors && report.errors.length > 0) {
      try {
        for (const err of report.errors.slice(0, 5)) {
          const pattern = err.slice(0, 500);
          const category = pattern.includes('Session') ? 'session' :
            pattern.includes('timeout') ? 'timeout' :
              pattern.includes('index.html') ? 'generation' : 'pipeline';
          if (db.recordFailurePattern) {
            db.recordFailurePattern(gameId, pattern, category);
          }
        }
      } catch (e) {
        console.warn(`[worker-v2] Could not record failure patterns: ${e.message}`);
      }
    }

    // 6. On approval: resolve failure patterns + warehouse sync + publish
    if (report.status === 'APPROVED') {
      // Resolve open failure patterns so pattern DB stays clean
      try {
        const openPatterns = db.getFailurePatterns(gameId).filter((p) => !p.resolved);
        if (openPatterns.length > 0) {
          for (const fp of openPatterns) {
            db.resolveFailurePattern(gameId, fp.pattern);
          }
          console.log(`[worker-v2] Resolved ${openPatterns.length} failure pattern(s) for ${gameId}`);
        }
      } catch (e) {
        console.warn(`[worker-v2] Could not resolve failure patterns: ${e.message}`);
      }

      // Warehouse sync: copy approved HTML back so future builds start from known-good base
      try {
        const approvedHtml = path.join(gameDir, 'index.html');
        if (fs.existsSync(approvedHtml)) {
          const warehouseGameDir = path.join(WAREHOUSE_TEMPLATES_DIR, gameId, 'game');
          fs.mkdirSync(warehouseGameDir, { recursive: true });
          fs.copyFileSync(approvedHtml, path.join(warehouseGameDir, 'index.html'));
          console.log(`[worker-v2] Synced approved HTML to warehouse for ${gameId}`);
        }
      } catch (e) {
        console.warn(`[worker-v2] Warehouse sync failed: ${e.message}`);
      }

      // Publish to core API — agent session handles this in the content-gen step.
      // Fallback to server-side publishGame() if the agent didn't publish.
      if (report.publish) {
        console.log(`[worker-v2] Agent already published: ${report.publish.gameLink}`);
      } else {
        await publishGame(gameId, buildId, gameDir, report, { specPath });
      }

      // Slack: publish notification with content sets, game links
      if (thread && report.publish) {
        await slack.postPublishUpdate(thread.ts, thread.channel, gameId, {
          ...report.publish,
          inputSchemaSource: report.publish.inputSchemaSource || 'file',
          schemaProps: report.publish.schemaProps || report.publish.inputSchemaProps || 0,
        });
        await sleep(1000);
      }
    }

    // 6b. Extract cross-game learnings (on failures or rejection, like V1 Step 5)
    const hadFailures = report.status === 'FAILED' || report.status === 'REJECTED';
    if (hadFailures && callLlm) {
      try {
        const failureSummary = (report.errors || []).join('\n');
        const rejectionNote = report.status === 'REJECTED' && report.rejectionReasons
          ? `\nREJECTION REASONS:\n${report.rejectionReasons.join('\n')}`
          : '';
        const issuesSummary = report.finalVerdict?.issues?.map((i) => `[${i.severity}] ${i.description}`).join('\n') || '';

        if (failureSummary || rejectionNote || issuesSummary) {
          const learningsPrompt = `You are analyzing a failed/rejected game build to extract generalizable lessons for future builds.

BUILD OUTCOME: ${report.status}
GAME: ${gameId}

ERRORS:
${failureSummary}
${rejectionNote}

ISSUES FOUND:
${issuesSummary}

Extract 1-4 short, actionable learnings that would help avoid this failure in future game builds.
Each learning should be a single sentence, specific and actionable (not generic).
Focus on patterns that would apply to OTHER games, not just this specific game.

Output each learning on its own line, as a bullet point starting with "- ".`;

          const learningsOutput = await callLlm('extract-learnings', learningsPrompt, config.REVIEW_MODEL || config.GEN_MODEL, { timeout: 60000 });
          const bullets = learningsOutput
            .split('\n')
            .map((l) => l.replace(/^[\s\-*•]+/, '').trim())
            .filter((l) => l.length > 20 && l.length < 300);

          if (bullets.length > 0) {
            // Append to global learnings file
            const learningsFile = path.join(config.DATA_DIR, 'global-learnings.md');
            const header = `\n## ${gameId} (${report.status}) — ${new Date().toISOString().slice(0, 10)}\n`;
            const content = bullets.slice(0, 4).map((b) => `- ${b}`).join('\n') + '\n';
            fs.appendFileSync(learningsFile, header + content);
            console.log(`[worker-v2] Extracted ${bullets.length} cross-game learning(s)`);

            report.learnings = bullets.slice(0, 4);

            // Slack: learnings notification
            if (thread) {
              await slack.postLearningsUpdate(thread.ts, thread.channel, bullets.slice(0, 4));
              await sleep(1000);
            }
          }
        }
      } catch (e) {
        console.warn(`[worker-v2] Learnings extraction failed: ${e.message}`);
      }
    }

    // 7. Auto-retry: requeue on FAILED if RALPH_AUTO_RETRY=1 and not already retried
    if (AUTO_RETRY && report.status === 'FAILED') {
      try {
        const currentBuild = db.getBuild(buildId);
        if ((currentBuild?.retry_count || 0) === 0) {
          const retryBuildId = db.createBuild(gameId, null, { requestedBy: requestedBy || 'auto-retry' });
          await queue.add('build-game', {
            gameId,
            specPath,
            gameDir,
            buildId: retryBuildId,
            requestedBy: 'auto-retry',
            pipeline: 'v2',
            retryOf: buildId,
          }, {
            jobId: `v2-retry-${gameId}-${retryBuildId}`,
            removeOnComplete: 100,
            removeOnFail: 50,
          });
          // Mark original as retried
          try { db.getDb().prepare('UPDATE builds SET retry_count = 1 WHERE id = ?').run(buildId); } catch {}
          console.log(`[worker-v2] Auto-retry queued: build #${retryBuildId} (retry of #${buildId})`);
          if (thread) {
            const coreSlack = (() => { try { return require('../lib/slack'); } catch { return null; } })();
            if (coreSlack) {
              await coreSlack.postThreadUpdate(thread.ts, thread.channel,
                `🔄 Auto-retry queued — build #${buildId} failed. Starting fresh build #${retryBuildId}...`,
              ).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn(`[worker-v2] Auto-retry failed: ${e.message}`);
      }
    }

    // 8. Post final Slack result (includes GCS link + publish links)
    if (thread) {
      await slack.postBuildResult(thread.ts, thread.channel, gameId, report);
    }

    return report;

  } catch (err) {
    console.error(`[worker-v2] Fatal error: ${err.message}`);

    // Guard: only write error if not already recorded by inner pipeline code
    try {
      const existing = db.getBuild(buildId);
      if (!existing?.error_message) {
        db.failBuild(buildId, err.message);
      }
    } catch (_dbErr) {
      // DB write failed — BullMQ will fire worker.on('failed')
    }

    if (thread) {
      await slack.postBuildResult(thread.ts, thread.channel, gameId, {
        gameId,
        status: 'FAILED',
        errors: [err.message],
        totalTimeS: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
        totalTurns: 0,
        totalToolUses: 0,
        totalCost: 0,
      });
    }

    throw err;
  } finally {
    clearInterval(heartbeatInterval);

    // Save build log even on error
    try {
      if (buildLogLines.length > 0) {
        fs.mkdirSync(gameDir, { recursive: true });
        const logPath = path.join(gameDir, `build-${buildId}.log`);
        fs.writeFileSync(logPath, buildLogLines.join('\n') + '\n');
        _origLog(`[worker-v2] Build log saved: ${logPath} (${buildLogLines.length} lines)`);
      }
    } catch (_logErr) {
      _origWarn(`[worker-v2] Could not save build log: ${_logErr.message}`);
    }

    // Restore console interceptors
    _restoreConsole();
  }
}, {
  connection,
  concurrency: config.CONCURRENCY,
  // ── BullMQ lock tuning for long Agent SDK builds ──────────────────────
  // Agent SDK sessions can run 2-3 hours (Opus × 5 steps). Default BullMQ
  // settings (30s lockDuration, 15s stalled check) would mark these as stalled.
  lockDuration: 5 * 60 * 60 * 1000,     // 5 hours — well above longest build
  lockRenewTime: 60 * 60 * 1000,         // renew every 60 min
  stalledInterval: 5 * 60 * 1000,        // check for stalled jobs every 5 min
  maxStalledCount: 0,                     // never declare a job stalled
});

worker.on('completed', (job, result) => {
  console.log(`[worker-v2] ✅ Job ${job.id} completed: ${result?.status || 'ok'}${result?.skipped ? ' (skipped)' : ''}`);
});

// ── worker.on('failed'): write to DB + update Slack (mirrors V1) ────────────
worker.on('failed', async (job, err) => {
  const { gameId, buildId } = job?.data || {};
  const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
  console.error(`[worker-v2] ❌ Job ${job?.id} failed: ${errMsg}`);

  // Write to DB if not already written by inner catch
  if (buildId) {
    try {
      const existing = db.getBuild(buildId);
      if (!existing?.error_message) {
        db.failBuild(buildId, errMsg);
      }
    } catch {}
  }

  // Update Slack thread opener to FAILED status
  if (gameId) {
    const gameRow = db.getGame(gameId);
    if (gameRow?.slack_thread_ts && gameRow?.slack_channel_id) {
      const coreSlack = (() => { try { return require('../lib/slack'); } catch { return null; } })();
      if (coreSlack) {
        await coreSlack.updateThreadOpener(
          gameRow.slack_thread_ts, gameRow.slack_channel_id, gameId,
          { status: 'FAILED', buildId, iterations: 0 },
          { startedAt: null, currentStep: 'Failed ❌' },
        ).catch(() => {});
      }
    }
  }
});

// ── worker.on('error'): handle BullMQ state sync errors gracefully ──────────
worker.on('error', (err) => {
  // "Missing key for job N. moveToFinished" happens after worker SIGKILL + restart.
  // The pipeline DB write already succeeded — this is BullMQ bookkeeping only.
  if (err.message && err.message.includes('Missing key for job') && err.message.includes('moveToFinished')) {
    console.warn(`[worker-v2] BullMQ state sync error (DB write already complete): ${err.message}`);
    return;
  }
  console.error(`[worker-v2] Worker error: ${err.message}`);
});

// ─── Startup routines ───────────────────────────────────────────────────────

/**
 * Mark orphaned builds (still 'running' in DB from a prior crash) as failed.
 */
async function cleanupOrphanedBuilds() {
  try {
    const orphans = db.getRunningBuilds ? db.getRunningBuilds() : [];
    if (orphans.length === 0) return;
    console.warn(`[server-v2] Found ${orphans.length} orphaned build(s) in 'running' state — marking failed`);
    for (const build of orphans) {
      db.failBuild(build.id, `orphaned: worker restarted while build was running (worker_id: ${build.worker_id || 'unknown'})`);
      console.warn(`[server-v2] Marked build ${build.id} (${build.game_id}) as failed (was running)`);
    }
  } catch (e) {
    console.warn(`[server-v2] Orphan cleanup warning: ${e.message}`);
  }
}

/**
 * Re-enqueue DB-queued builds whose BullMQ jobs were lost (e.g. Redis flush, worker crash-loop).
 */
async function requeueOrphanedQueuedBuilds() {
  try {
    const getDb = db.getDb;
    if (!getDb) return; // stub DB, nothing to requeue
    const queuedBuilds = getDb().prepare("SELECT id, game_id FROM builds WHERE status = 'queued' ORDER BY id ASC").all();
    if (queuedBuilds.length === 0) return;

    const [waiting, active] = await Promise.all([queue.getWaitingCount(), queue.getActiveCount()]);
    const bullmqTotal = waiting + active;

    if (bullmqTotal >= queuedBuilds.length) {
      console.log(`[server-v2] Orphan queue sync: ${queuedBuilds.length} queued builds, BullMQ has ${bullmqTotal} — OK`);
      return;
    }

    console.warn(`[server-v2] Orphan queue sync: DB has ${queuedBuilds.length} queued builds but BullMQ has ${bullmqTotal} — re-enqueuing`);
    for (const build of queuedBuilds) {
      const specPath = path.join(config.DATA_DIR, 'game-specs', build.game_id, 'spec.md');
      const gameDir = path.join(config.WAREHOUSE_DIR, build.game_id);
      await queue.add('build-game', {
        gameId: build.game_id,
        specPath,
        gameDir,
        buildId: build.id,
        pipeline: 'v2',
      }, {
        jobId: `v2-${build.game_id}-${build.id}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    }
    console.log(`[server-v2] Re-enqueued ${queuedBuilds.length} orphaned builds`);
  } catch (e) {
    console.warn(`[server-v2] Orphan queue sync warning: ${e.message}`);
  }
}

async function start() {
  // ── Startup cleanup ────────────────────────────────────────────────────
  // 1. Mark orphaned 'running' builds as failed
  await cleanupOrphanedBuilds();

  // 2. Clean up stale BullMQ jobs from previous crashed processes
  try {
    const staleActive = await queue.getJobs(['active']);
    if (staleActive.length > 0) {
      console.log(`[server-v2] Found ${staleActive.length} stale active job(s) — cleaning up`);
      await queue.obliterate({ force: true });
      console.log('[server-v2] Queue obliterated');
    }
  } catch (e) {
    console.warn(`[server-v2] Queue cleanup warning: ${e.message}`);
  }

  // 3. Re-enqueue orphaned queued builds
  await requeueOrphanedQueuedBuilds();

  const port = config.PORT;
  app.listen(port, () => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  Ralph Pipeline V2 — Agent SDK`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Server:       http://localhost:${port}`);
    console.log(`  Queue:        ${QUEUE_NAME}`);
    console.log(`  Model:        ${config.GEN_MODEL}`);
    console.log(`  Concurrency:  ${config.CONCURRENCY}`);
    console.log(`  Redis:        ${config.REDIS_URL}`);
    console.log(`  Warehouse:    ${config.WAREHOUSE_DIR}`);
    console.log(`  Auto-retry:   ${AUTO_RETRY ? 'ON' : 'OFF'}`);
    console.log(`${'═'.repeat(70)}\n`);
  });
}

// Allow both require() and direct execution
if (require.main === module) {
  start();
}

module.exports = { app, queue, worker, start };

'use strict';

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const slack = require('./lib/slack');
const gcp = require('./lib/gcp');
const logger = require('./lib/logger');
const sentry = require('./lib/sentry');
const metrics = require('./lib/metrics');

// ─── Initialize observability + integrations ─────────────────────────────────
sentry.init('ralph-worker');
logger.initCloudLogging();
slack.init();
gcp.init();

const execFileAsync = promisify(execFile);

// ─── Configuration ──────────────────────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENCY = parseInt(process.env.RALPH_CONCURRENCY || '2', 10);
const REPO_DIR = process.env.RALPH_REPO_DIR || path.join(__dirname, 'repo');
const RALPH_SCRIPT = path.join(__dirname, 'ralph.sh');
const USE_NODE_PIPELINE = process.env.RALPH_USE_NODE_PIPELINE === '1';

// Rate limiter: max 10 builds per hour
const RATE_LIMIT_MAX = parseInt(process.env.RALPH_RATE_MAX || '10', 10);
const RATE_LIMIT_DURATION = parseInt(process.env.RALPH_RATE_DURATION || '3600000', 10);

// ─── E7: Failure categorization ───────────────────────────────────────────────
function categorizeFailure(failureDesc) {
  const desc = failureDesc.toLowerCase();
  if (/render|dom|element|visible|display/.test(desc)) return 'rendering';
  if (/gamestate|state|init/.test(desc)) return 'state';
  if (/score|star|progress/.test(desc)) return 'scoring';
  if (/timer|timeout|countdown/.test(desc)) return 'timing';
  if (/click|input|touch|interact/.test(desc)) return 'interaction';
  if (/postmessage|message|event/.test(desc)) return 'messaging';
  if (/layout|responsive|width|480/.test(desc)) return 'layout';
  if (/endgame|complete|finish/.test(desc)) return 'completion';
  return 'unknown';
}

// ─── Learning extraction from pipeline events ────────────────────────────────
function extractLearnings(gameId, buildId, report) {
  // Extract learnings from diagnosis mode (iteration 3+)
  if (Array.isArray(report.test_results)) {
    for (const result of report.test_results) {
      if (result.iteration >= 3 && result.failures && result.failures !== 'unknown') {
        const failures = result.failures.split(', ').filter(Boolean);
        for (const failure of failures) {
          db.addLearning(gameId, {
            buildId,
            level: 'game',
            category: categorizeFailure(failure),
            content: `Persistent failure in iteration ${result.iteration}: ${failure}`,
            source: 'pipeline',
          });
        }
      }
    }
  }

  // Extract learnings from review rejections
  if (report.status === 'REJECTED' && report.review_result) {
    db.addLearning(gameId, {
      buildId,
      level: 'game',
      category: 'general',
      content: `Review rejection: ${report.review_result.slice(0, 500)}`,
      source: 'review',
    });
  }
}

// ─── Fetch spec from URL ────────────────────────────────────────────────────
async function fetchSpec(url, destPath) {
  console.log(`[worker] Downloading spec from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec from ${url}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (text.length < 100) {
    throw new Error(`Fetched spec is too small (${text.length} chars) — likely not a valid spec`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, text, 'utf-8');
  console.log(`[worker] Spec saved to ${destPath} (${text.length} chars)`);
  return destPath;
}

// ─── Write spec content to file ──────────────────────────────────────────────
function writeSpecContent(gameId, specContent) {
  const specDir = path.join(REPO_DIR, 'warehouse', 'templates', gameId);
  const specPath = path.join(specDir, 'spec.md');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(specPath, specContent, 'utf-8');
  console.log(`[worker] Spec content written to ${specPath} (${specContent.length} chars)`);
  return specPath;
}

// ─── Redis connection ───────────────────────────────────────────────────────
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ─── Run Ralph pipeline for a single game ───────────────────────────────────
async function runRalph(gameId, specPath, _buildId) {
  // Resolve paths
  const gameDir = specPath
    ? path.join(path.dirname(specPath), '..', 'game')
    : path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game');

  const specFile = specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');

  // Ensure game directory exists
  fs.mkdirSync(gameDir, { recursive: true });

  console.log(`[worker] Running ralph.sh for ${gameId}`);
  console.log(`[worker]   game-dir: ${gameDir}`);
  console.log(`[worker]   spec:     ${specFile}`);

  const reportFile = path.join(gameDir, 'ralph-report.json');

  try {
    // Execute ralph.sh with timeout (30 minutes max per game)
    await execFileAsync(RALPH_SCRIPT, [gameDir, specFile], {
      timeout: 30 * 60 * 1000,
      env: {
        ...process.env,
        RALPH_REPORT_DIR: gameDir,
      },
      cwd: __dirname,
    });
  } catch (err) {
    // ralph.sh exits non-zero for FAILED/REJECTED — that's expected
    // Only treat as error if no report was produced
    if (!fs.existsSync(reportFile)) {
      throw new Error(`ralph.sh crashed without producing a report: ${err.message}`);
    }
  }

  // Read the report
  if (!fs.existsSync(reportFile)) {
    throw new Error('No ralph-report.json produced');
  }

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
  return report;
}

// ─── Handle targeted fix job ────────────────────────────────────────────────
async function handleFixJob(job) {
  const { gameId, buildId, feedbackPrompt } = job.data;
  logger.info(`Processing targeted fix for ${gameId}`, { gameId, buildId, event: 'fix_start' });

  if (buildId) db.startBuild(buildId);

  const gameDir = path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game');
  const specFile = path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');

  if (!fs.existsSync(specFile)) {
    // Try to get spec from games table
    const game = db.getGame(gameId);
    if (game && game.spec_content) {
      writeSpecContent(gameId, game.spec_content);
    } else {
      throw new Error(`No spec found for ${gameId}`);
    }
  }

  const { runTargetedFix } = require('./lib/pipeline');

  // Create Slack thread update
  const game = db.getGame(gameId);
  if (game && game.slack_thread_ts) {
    await slack.postThreadUpdate(
      game.slack_thread_ts,
      game.slack_channel_id,
      `🔧 Applying targeted fix (build #${buildId})...\n> ${feedbackPrompt.slice(0, 200)}`,
    );
  }

  const report = await runTargetedFix(gameDir, specFile, feedbackPrompt, {
    metrics,
    logger,
    onProgress: (step, detail) => {
      console.log(`[worker] fix progress: ${step}`, detail);
    },
  });

  if (buildId) db.completeBuild(buildId, report);

  // GCP upload on approval
  if (report.status === 'APPROVED' && gcp.isEnabled()) {
    const htmlFile = path.join(gameDir, 'index.html');
    const gcpUrl = await gcp.uploadGameArtifact(gameId, buildId, htmlFile);
    if (gcpUrl) {
      db.updateBuildGcpUrl(buildId, gcpUrl);
      db.updateGameGcpUrl(gameId, gcpUrl);
    }
  }

  // Post result to Slack thread
  if (game && game.slack_thread_ts) {
    const gcpUrl = db.getGame(gameId)?.gcp_url;
    await slack.postThreadResult(game.slack_thread_ts, game.slack_channel_id, gameId, report, { gcpUrl });
  } else {
    await slack.notifyBuildResult(gameId, report);
  }

  // Update game status
  db.updateGameStatus(gameId, report.status === 'APPROVED' ? 'approved' : 'fix-failed');

  return report;
}

// ─── Worker ─────────────────────────────────────────────────────────────────
const worker = new Worker(
  'ralph-builds',
  async (job) => {
    // Handle targeted fix jobs
    if (job.data.type === 'fix') {
      return handleFixJob(job);
    }

    const { gameId, commitSha, buildId, specUrl, specContent } = job.data;
    let { specPath } = job.data;

    logger.info(`Processing job ${job.id}: ${gameId}`, { gameId, buildId, event: 'build_start' });
    metrics.recordBuildStarted(gameId);
    const buildStartTime = Date.now();

    // Start Sentry transaction for this build
    const transaction = sentry.startBuildTransaction(gameId, buildId);

    // Update DB: build started
    if (buildId) {
      db.startBuild(buildId);
    }

    // Create Slack thread for this build
    let threadInfo = null;
    const game = db.getGame(gameId);
    if (game && game.slack_thread_ts) {
      // Use existing thread
      threadInfo = { ts: game.slack_thread_ts, channel: game.slack_channel_id };
      await slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, `🔄 Build #${buildId} started...`);
    } else {
      // Create new thread
      threadInfo = await slack.createGameThread(gameId, {
        title: game?.title || gameId,
        buildId,
      });
      if (threadInfo && threadInfo.ts) {
        db.updateGameThread(gameId, threadInfo.ts, threadInfo.channel);
      }
    }

    // Progress callback for Slack thread updates
    const onProgress = (step, detail) => {
      console.log(`[worker] progress: ${step}`, detail);
      if (threadInfo) {
        const messages = {
          'validate-spec': '📋 Validating spec...',
          'generate-html': `🏗️ Generating HTML (model: ${detail?.model || 'unknown'})...`,
          'static-validation': '🔍 Running static validation...',
          'generate-tests': '🧪 Generating tests...',
          'test-fix-loop': `🔄 Starting test/fix loop (max ${detail?.maxIterations || 5} iterations)...`,
          'test-result': `📊 Iteration ${detail?.iteration}: ${detail?.passed || 0} passed, ${detail?.failed || 0} failed`,
          review: '📝 Running review...',
        };
        const msg = messages[step];
        if (msg) {
          slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, msg).catch(() => {});
        }
      }
    };

    // Pull latest code
    if (fs.existsSync(REPO_DIR) && fs.existsSync(path.join(REPO_DIR, '.git'))) {
      try {
        await execFileAsync('git', ['pull', 'origin', 'c_code'], {
          cwd: REPO_DIR,
          timeout: 60000,
        });
        console.log(`[worker] Git pull completed`);
      } catch (err) {
        console.warn(`[worker] Git pull failed (continuing): ${err.message}`);
      }
    }

    // Write spec content from MCP registration if provided
    if (specContent && !specPath && !specUrl) {
      specPath = writeSpecContent(gameId, specContent);
    }

    // Download spec from URL if provided
    if (specUrl && !specPath) {
      const tmpSpecDir = path.join(REPO_DIR, 'warehouse', 'templates', gameId);
      const tmpSpecPath = path.join(tmpSpecDir, 'spec.md');
      await fetchSpec(specUrl, tmpSpecPath);
      specPath = tmpSpecPath;
    }

    // Run Ralph — E3: choose between bash (ralph.sh) and Node.js (pipeline.js)
    let report;
    try {
      if (USE_NODE_PIPELINE) {
        const { runPipeline } = require('./lib/pipeline');
        const gameDir = specPath
          ? path.join(path.dirname(specPath), '..', 'game')
          : path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game');
        const specFile = specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');
        fs.mkdirSync(gameDir, { recursive: true });
        console.log(`[worker] Running Node.js pipeline (E3) for ${gameId}`);
        report = await runPipeline(gameDir, specFile, { metrics, logger, onProgress });
      } else {
        report = await runRalph(gameId, specPath, buildId);
      }
    } catch (err) {
      // Record metrics even on failure
      const buildDuration = (Date.now() - buildStartTime) / 1000;
      metrics.recordBuildCompleted(gameId, 'CRASHED', buildDuration, 0);
      transaction.setStatus && transaction.setStatus('error');
      transaction.finish && transaction.finish();
      throw err;
    }

    // Update DB: build completed
    if (buildId) {
      db.completeBuild(buildId, report);
    }

    // E7: Record failure patterns for analysis
    if (report.status === 'FAILED' && Array.isArray(report.test_results)) {
      const lastResult = report.test_results[report.test_results.length - 1];
      if (lastResult && lastResult.failures) {
        const failures = lastResult.failures.split(', ').filter(Boolean);
        for (const failure of failures) {
          const category = categorizeFailure(failure);
          db.recordFailurePattern(gameId, failure, category);
        }
      }
    }

    // Extract learnings from diagnosis mode and rejections
    extractLearnings(gameId, buildId, report);

    // GCP upload on approval
    if (report.status === 'APPROVED' && gcp.isEnabled()) {
      const gameDir = specPath
        ? path.join(path.dirname(specPath), '..', 'game')
        : path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game');
      const htmlFile = path.join(gameDir, 'index.html');
      const gcpUrl = await gcp.uploadGameArtifact(gameId, buildId, htmlFile);
      if (gcpUrl) {
        if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
        db.updateGameGcpUrl(gameId, gcpUrl);
      }
    }

    // Record metrics
    const buildDuration = (Date.now() - buildStartTime) / 1000;
    metrics.recordBuildCompleted(gameId, report.status, buildDuration, report.iterations || 0);
    transaction.setStatus && transaction.setStatus(report.status === 'APPROVED' ? 'ok' : 'error');
    transaction.finish && transaction.finish();

    // Post result to Slack thread or webhook
    if (threadInfo) {
      const gcpUrl = db.getGame(gameId)?.gcp_url;
      await slack.postThreadResult(threadInfo.ts, threadInfo.channel, gameId, report, { gcpUrl });
    } else {
      await slack.notifyBuildResult(gameId, report, commitSha);
    }

    // Update game status
    db.updateGameStatus(gameId, report.status === 'APPROVED' ? 'approved' : report.status.toLowerCase());

    logger.info(`${gameId}: ${report.status}`, {
      gameId,
      buildId,
      status: report.status,
      iterations: report.iterations || 0,
      duration_s: report.total_time_s,
      event: 'build_complete',
    });

    return report;
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: RATE_LIMIT_MAX,
      duration: RATE_LIMIT_DURATION,
    },
  },
);

// ─── Event handlers ─────────────────────────────────────────────────────────
worker.on('completed', (job, result) => {
  console.log(`[worker] Job ${job.id} completed: ${result.status}`);
});

worker.on('failed', async (job, err) => {
  const { gameId, buildId, commitSha } = job.data;
  logger.error(`Job ${job.id} failed: ${err.message}`, { gameId, buildId, event: 'build_failed' });
  sentry.captureException(err, { gameId, buildId, step: 'worker' });

  if (buildId) {
    db.failBuild(buildId, err.message);
  }

  await slack.notifyBuildResult(
    gameId,
    { status: 'FAILED', iterations: 0, total_time_s: 0, test_results: [], review_result: null, models: {} },
    commitSha,
  );
});

worker.on('error', (err) => {
  logger.error(`Worker error: ${err.message}`, { event: 'worker_error' });
  sentry.captureException(err, { step: 'worker_process' });
});

// ─── Startup ────────────────────────────────────────────────────────────────
console.log(`[ralph-worker] Started with concurrency=${CONCURRENCY}`);
console.log(`[ralph-worker] Rate limit: ${RATE_LIMIT_MAX} builds per ${RATE_LIMIT_DURATION / 1000}s`);
console.log(`[ralph-worker] Repo: ${REPO_DIR}`);
console.log(`[ralph-worker] Script: ${RALPH_SCRIPT}`);
console.log(`[ralph-worker] Slack Web API: ${slack.isWebApiEnabled() ? 'enabled' : 'disabled (webhook fallback)'}`);
console.log(`[ralph-worker] GCP uploads: ${gcp.isEnabled() ? 'enabled' : 'disabled'}`);

// ─── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown() {
  logger.info('Worker shutting down...', { event: 'shutdown' });
  await sentry.flush();
  await worker.close();
  await connection.quit();
  db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

'use strict';

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const slack = require('./lib/slack');
const logger = require('./lib/logger');
const sentry = require('./lib/sentry');
const metrics = require('./lib/metrics');

// ─── Initialize observability ───────────────────────────────────────────────
sentry.init('ralph-worker');
logger.initCloudLogging();

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

// ─── Redis connection ───────────────────────────────────────────────────────
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ─── Run Ralph pipeline for a single game ───────────────────────────────────
async function runRalph(gameId, specPath, buildId) {
  // Resolve paths
  const gameDir = specPath
    ? path.join(path.dirname(specPath), '..', 'game')
    : path.join(REPO_DIR, 'game-spec', 'templates', gameId, 'game');

  const specFile = specPath
    || path.join(REPO_DIR, 'game-spec', 'templates', gameId, 'spec.md');

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

// ─── Worker ─────────────────────────────────────────────────────────────────
const worker = new Worker(
  'ralph-builds',
  async (job) => {
    const { gameId, commitSha, buildId, specPath } = job.data;

    logger.info(`Processing job ${job.id}: ${gameId}`, { gameId, buildId, event: 'build_start' });
    metrics.recordBuildStarted(gameId);
    const buildStartTime = Date.now();

    // Start Sentry transaction for this build
    const transaction = sentry.startBuildTransaction(gameId, buildId);

    // Update DB: build started
    if (buildId) {
      db.startBuild(buildId);
    }

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

    // Run Ralph — E3: choose between bash (ralph.sh) and Node.js (pipeline.js)
    let report;
    try {
      if (USE_NODE_PIPELINE) {
        const { runPipeline } = require('./lib/pipeline');
        const gameDir = specPath
          ? path.join(path.dirname(specPath), '..', 'game')
          : path.join(REPO_DIR, 'game-spec', 'templates', gameId, 'game');
        const specFile = specPath
          || path.join(REPO_DIR, 'game-spec', 'templates', gameId, 'spec.md');
        fs.mkdirSync(gameDir, { recursive: true });
        console.log(`[worker] Running Node.js pipeline (E3) for ${gameId}`);
        report = await runPipeline(gameDir, specFile, { metrics, logger });
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

    // Record metrics
    const buildDuration = (Date.now() - buildStartTime) / 1000;
    metrics.recordBuildCompleted(gameId, report.status, buildDuration, report.iterations || 0);
    transaction.setStatus && transaction.setStatus(report.status === 'APPROVED' ? 'ok' : 'error');
    transaction.finish && transaction.finish();

    // Send Slack notification
    await slack.notifyBuildResult(gameId, report, commitSha);

    logger.info(`${gameId}: ${report.status}`, {
      gameId, buildId, status: report.status,
      iterations: report.iterations || 0, duration_s: report.total_time_s,
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
  }
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
    commitSha
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

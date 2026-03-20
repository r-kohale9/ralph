'use strict';

const { Worker, Queue } = require('bullmq');
try {
  require('dotenv').config();
} catch {
  /* dotenv optional */
}

const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { execFile } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { runPipeline, runTargetedFix } = require('./lib/pipeline');
const db = require('./lib/db');
const slack = require('./lib/slack');
const gcp = require('./lib/gcp');
const logger = require('./lib/logger');
const sentry = require('./lib/sentry');
const metrics = require('./lib/metrics');
const { getSystemStats, startSystemMetrics } = metrics;

const WORKER_ID = process.env.RALPH_WORKER_ID || crypto.randomUUID().slice(0, 8);

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

// Auto-retry: requeue builds that score 0/total tests (gated, max 1 retry per build)
const AUTO_RETRY = process.env.RALPH_AUTO_RETRY === '1';

// Rate limiter: max 10 builds per hour
const RATE_LIMIT_MAX = parseInt(process.env.RALPH_RATE_MAX || '10', 10);
const RATE_LIMIT_DURATION = parseInt(process.env.RALPH_RATE_DURATION || '3600000', 10);

// Resource gate thresholds
const CPU_GATE_PCT = parseFloat(process.env.RALPH_CPU_GATE || '85');
const RAM_GATE_MB = parseFloat(process.env.RALPH_RAM_GATE_MB || '512');

// GitHub repo URL for spec links (e.g. https://github.com/org/repo)
const RALPH_GITHUB_REPO = process.env.RALPH_GITHUB_REPO || '';

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

// ─── Pipeline docs generator ─────────────────────────────────────────────────
function buildPipelineDocsMarkdown({ gameId, buildId, genModel, testModel, fixModel, maxIterations }) {
  return [
    `# Ralph Pipeline — Build #${buildId} (${gameId})`,
    '',
    '## Overview',
    'Ralph takes a game specification (Markdown) and generates a validated HTML5 educational game through an automated multi-stage pipeline.',
    '',
    '## Pipeline Steps',
    '',
    `### 1. HTML Generation — \`${genModel}\``,
    'Generates a complete single-file HTML5 game from the spec.',
    'Includes: MatHai CDN integration, game state management, scoring logic, Playwright-compatible selectors.',
    '',
    '### 2. Static Validation',
    'Checks the generated HTML for required structural elements: `initGame()` function, star thresholds (80%/50%), no inline handlers, required DOM selectors.',
    'Auto-fixes failures using the fix model before proceeding.',
    '',
    '### 3. Contract Validation',
    'Validates runtime contracts: gameState object, postMessage events, scoring.',
    '',
    `### 4. Test Generation — \`${testModel}\``,
    'Generates categorized Playwright tests from the spec + DOM snapshot.',
    '**Categories:** game-flow · mechanics · level-progression · edge-cases · contract',
    '',
    `### 5. Test → Fix Loop — \`${fixModel}\` (max ${maxIterations} iterations/category)`,
    'Runs tests per category. On failure:',
    '1. **Triage** — LLM determines root cause (fix_html / skip_tests / add_assertions)',
    '2. **Fix** — LLM patches the HTML for the specific failures',
    '3. **Re-run** — Tests run again; best-passing HTML snapshot is tracked per batch',
    '4. **Rollback** — If a fix regresses, best snapshot is restored automatically',
    '',
    `### 6. Review — \`${testModel}\``,
    'Final LLM review of the game against the spec. Outputs: **APPROVED** / **REJECTED**.',
    '',
    '## CDN Components (MatHai)',
    '| Component | DOM Slot | Purpose |',
    '|-----------|----------|---------|',
    '| FeedbackManager | — | Audio feedback for correct/incorrect answers |',
    '| ScreenLayout | — | Responsive layout injection |',
    '| ProgressBar | `#mathai-progress-slot` | Lives display |',
    '| Timer | `#mathai-timer-slot` | Countdown |',
    '| VisibilityTracker | — | Pause on tab blur |',
    '',
    '**Init order (immutable):** `await FeedbackManager.init()` → `ScreenLayout.inject()` → `initGame()`',
    '',
    '## Key Constraints',
    '- `FeedbackManager.playDynamicFeedback()` must be fire-and-forget (`.catch(() => {})`)',
    '- Never call `progressBar.destroy()` / `timer.destroy()` in `endGame()` — tests check slots after game over',
    '- `isProcessing=true` silently blocks clicks (early return), does NOT hide/show elements',
    '- Star display must update in BOTH victory AND game-over paths',
  ].join('\n');
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
  const gameDir = path.join(REPO_DIR, 'data', 'games', gameId);

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
    // critical: ralph.sh exits non-zero for FAILED/REJECTED — that's expected; only rethrow if no report was produced
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

  if (buildId) db.startBuild(buildId, { workerId: WORKER_ID });

  // Resolve latest build dir — targeted fix patches the most recent generated HTML
  const gameBase = path.join(REPO_DIR, 'data', 'games', gameId);
  const latestFile = path.join(gameBase, '.latest');
  const latestBuildId = fs.existsSync(latestFile) ? fs.readFileSync(latestFile, 'utf-8').trim() : null;
  const gameDir = latestBuildId ? path.join(gameBase, 'builds', latestBuildId) : gameBase; // fallback for legacy flat structure
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

  // GCP upload — always upload for preview link regardless of status
  if (gcp.isEnabled()) {
    const htmlFile = path.join(gameDir, 'index.html');
    if (fs.existsSync(htmlFile)) {
      const gcpUrl = await gcp.uploadGameArtifact(gameId, buildId, htmlFile);
      if (gcpUrl) {
        db.updateBuildGcpUrl(buildId, gcpUrl);
        db.updateGameGcpUrl(gameId, gcpUrl);
      }
    }
  }

  // Post result to Slack thread
  const fixGcpUrl = db.getGame(gameId)?.gcp_url;
  if (game && game.slack_thread_ts) {
    await slack.postThreadResult(game.slack_thread_ts, game.slack_channel_id, gameId, report, { gcpUrl: fixGcpUrl });
  } else {
    await slack.notifyBuildResult(gameId, report, null, fixGcpUrl);
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

    const { gameId, commitSha, buildId, specUrl, specContent, requestedBy } = job.data;
    let { specPath } = job.data;

    // ─── Resource gate ────────────────────────────────────────────────────────
    const stats = await getSystemStats();
    if (stats.cpuPct > CPU_GATE_PCT || stats.freeMemMb < RAM_GATE_MB) {
      logger.warn(
        `[worker] Resource gate: CPU=${stats.cpuPct.toFixed(1)}% RAM_FREE=${stats.freeMemMb.toFixed(0)}MB — delaying 30s`,
      );
      await new Promise((r) => setTimeout(r, 30000));
      // re-check once after delay (don't loop — just delay once and proceed)
    }

    logger.info(`Processing job ${job.id}: ${gameId}`, { gameId, buildId, event: 'build_start' });
    if (job.data.retryOf) {
      logger.info(`[worker] This is an auto-retry of build #${job.data.retryOf}`);
    }
    metrics.recordBuildStarted(gameId);
    const buildStartTime = Date.now();

    // Start Sentry transaction for this build
    const transaction = sentry.startBuildTransaction(gameId, buildId);

    // Update DB: build started
    if (buildId) {
      db.startBuild(buildId, { workerId: WORKER_ID });
    }

    // Pipeline model constants (mirror pipeline.js defaults)
    const pipelineGenModel = process.env.RALPH_GEN_MODEL || 'claude-opus-4-6';
    const pipelineTestModel = process.env.RALPH_TEST_MODEL || 'gemini-2.5-pro';
    const pipelineFixModel = process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
    const pipelineMaxIterations = parseInt(process.env.RALPH_MAX_ITERATIONS || '5', 10);

    // Create Slack thread for this build
    let threadInfo = null;
    let specLink = '';
    let pipelineDocsLink = '';
    // Build a GitHub spec URL if RALPH_GITHUB_REPO is configured
    const specGithubUrl = RALPH_GITHUB_REPO
      ? `${RALPH_GITHUB_REPO}/blob/main/warehouse/templates/${gameId}/spec.md`
      : '';
    // Link to pipeline architecture doc on GitHub
    const pipelineDocsGithubUrl = RALPH_GITHUB_REPO
      ? `${RALPH_GITHUB_REPO}/blob/main/docs/pipeline-architecture.md`
      : '';

    // Live build progress tracking (for parent message updates)
    let llmCallCount = 0;
    let currentBuildStep = 'Starting';
    let stepStartedAt = buildStartTime; // resets whenever currentBuildStep changes

    const game = db.getGame(gameId);
    // Always create a fresh Slack thread for each new build — never reuse an existing thread.
    // Upload spec to GCP for a hosted link (preferred over GitHub raw link)
    const specFilePath = specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');
    if (gcp.isEnabled() && fs.existsSync(specFilePath)) {
      const gcpSpecUrl = await gcp
        .uploadContent(fs.readFileSync(specFilePath, 'utf-8'), `games/${gameId}/builds/${buildId}/spec.md`, {
          contentType: 'text/markdown',
        })
        .catch(() => null); // cosmetic: spec link in Slack is optional; GCP failure must not abort thread creation
      if (gcpSpecUrl) specLink = slack.formatLink(gcpSpecUrl, '📄 Spec');
    }

    // Upload pipeline docs to GCP
    if (gcp.isEnabled()) {
      const docsUrl = await gcp
        .uploadContent(
          buildPipelineDocsMarkdown({
            gameId,
            buildId,
            genModel: pipelineGenModel,
            testModel: pipelineTestModel,
            fixModel: pipelineFixModel,
            maxIterations: pipelineMaxIterations,
          }),
          `games/${gameId}/builds/${buildId}/pipeline-docs.md`,
          { contentType: 'text/markdown' },
        )
        .catch(() => null); // cosmetic: pipeline docs link in Slack is optional; GCP failure must not abort thread creation
      if (docsUrl) pipelineDocsLink = slack.formatLink(docsUrl, '📖 Pipeline Docs');
    }

    threadInfo = await slack.createGameThread(gameId, {
      title: game?.title || gameId,
      buildId,
      requestedBy: requestedBy || null,
      startedAt: buildStartTime,
      currentStep: 'Step 1 · Generating HTML',
      llmCalls: 0,
      specLink: specLink || null,
      specGithubUrl: !specLink ? specGithubUrl : null,
      pipelineDocsLink: pipelineDocsLink || null,
      pipelineDocsUrl: !pipelineDocsLink ? pipelineDocsGithubUrl : null,
    });
    if (threadInfo && threadInfo.ts) {
      // Ensure game row exists before updating thread (game may not be pre-created via /api/games)
      if (!game) db.createGame(gameId, {});
      db.updateGameThread(gameId, threadInfo.ts, threadInfo.channel);
      // First reply: build plan
      const planText = [
        `📋 *Build Plan — Build #${buildId}*`,
        `1️⃣ Generate HTML — ${pipelineGenModel}`,
        `2️⃣ Static + contract validation`,
        `3️⃣ Generate Playwright tests — ${pipelineTestModel}`,
        `4️⃣ Test → fix loop — 5 categories × max ${pipelineMaxIterations} iterations — ${pipelineFixModel}`,
        `   Categories: game-flow · mechanics · level-progression · edge-cases · contract`,
        `5️⃣ LLM review — ${pipelineTestModel}`,
      ].join('\n');
      await slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, planText);
    }

    // ── Block Kit helpers ────────────────────────────────────────────────────
    function divider() {
      return { type: 'divider' };
    }
    function mrkdwn(text) {
      return { type: 'section', text: { type: 'mrkdwn', text } };
    }
    function nextStep(text) {
      return { type: 'context', elements: [{ type: 'mrkdwn', text: `→ *Next:* ${text}` }] };
    }

    // Progress callback for Slack thread updates
    const phaseStarts = {};
    const onProgress = (step, detail) => {
      const _logParts = [step];
      if (detail?.model) _logParts.push(`model=${detail.model}`);
      if (detail?.time != null) _logParts.push(`elapsed=${detail.time}s`);
      if (detail?.gameId) _logParts.push(`game=${detail.gameId}`);
      if (detail?.passed != null && detail?.total != null) _logParts.push(`${detail.passed}/${detail.total}`);
      if (detail?.iteration != null) _logParts.push(`iter=${detail.iteration}`);
      console.log(`[worker] ${_logParts.join(' | ')}`);

      // Renew BullMQ lock on every progress event to prevent stalled-job failures
      // during long LLM/Playwright calls that block event loop renewToken().
      const progressData = { step, ...(detail || {}) };
      job.updateProgress(progressData).catch(() => {}); // cosmetic: lock renewal failure must not abort the job

      // ── Track LLM call count and current step (used in parent message updates) ──
      if (detail?.llmCalls != null) llmCallCount = detail.llmCalls;
      else if (
        step === 'html-ready' ||
        step === 'tests-generated' ||
        step === 'html-fixed' ||
        step === 'review-complete'
      ) {
        llmCallCount += 1;
      }

      const now = Date.now();

      // Map progress steps to human-readable current step labels
      const stepLabels = {
        'generate-html': 'Step 1 · Generating HTML',
        'html-ready': 'Step 1 · HTML Generated',
        'static-validation-failed': 'Step 1a · Static Fix',
        'static-validation-fixed': 'Step 1a · Static Fixed',
        'early-review': 'Step 1c · Early Review',
        'generate-tests': 'Step 2 · Generating Tests',
        'tests-generated': 'Step 2 · Tests Ready',
        'test-fix-loop': 'Step 3 · Test → Fix Loop',
        review: 'Step 4 · Review',
        'review-complete': 'Step 4 · Review Complete',
      };
      const prevBuildStep = currentBuildStep;
      if (stepLabels[step]) {
        currentBuildStep = stepLabels[step];
      } else if (step === 'batch-start' && detail?.batch) {
        currentBuildStep = `Step 3 · ${detail.batch} · iter 1/${detail.maxIterations || pipelineMaxIterations}`;
      } else if (step === 'test-result' && detail?.batch) {
        currentBuildStep = `Step 3 · ${detail.batch} · iter ${detail.iteration}/${detail.maxIterations || pipelineMaxIterations}`;
      } else if (step === 'html-fixed' && detail?.batch) {
        currentBuildStep = `Step 3 · ${detail.batch} · fix ${detail.iteration}`;
      }
      // Reset step timer whenever the step label changes
      if (currentBuildStep !== prevBuildStep) {
        stepStartedAt = now;
      }

      if (!threadInfo) return;
      if (!phaseStarts[step]) phaseStarts[step] = now;

      // ── generate-html — suppress; post happens on html-ready ───────────────
      if (step === 'generate-html') {
        phaseStarts['generate-html'] = now;
        return;
      }

      // ── html-ready ──────────────────────────────────────────────────────────
      if (step === 'html-ready' && detail?.htmlFile) {
        const sizeKb = detail.size ? `${Math.round(detail.size / 1024)}KB` : '?KB';
        const timeStr = detail.time != null ? `+${detail.time}s` : '';
        const model = detail.model || pipelineGenModel;
        const headerText = `✅ *Step 1 — HTML Generated*${timeStr ? ` · ${timeStr}` : ''}`;
        const bodyText = `Model: \`${model}\` · Size: ${sizeKb}`;
        if (gcp.isEnabled()) {
          gcp
            .uploadGameArtifact(gameId, buildId, detail.htmlFile, { suffix: 'generated' })
            .then((gcpUrl) => {
              if (gcpUrl) {
                if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
                db.updateGameGcpUrl(gameId, gcpUrl);
              }
              const blocks = [
                divider(),
                mrkdwn(
                  `${headerText}\n${bodyText}${gcpUrl ? `\n${slack.formatLink(gcpUrl, 'View generated HTML')}` : ''}`,
                ),
                nextStep('Static + contract validation'),
              ];
              slack
                .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
                .catch(() => {});
            })
            .catch(() => {});
        } else {
          const blocks = [divider(), mrkdwn(`${headerText}\n${bodyText}`), nextStep('Static + contract validation')];
          slack
            .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
            .catch(() => {});
        }
        return;
      }

      // ── static-validation-failed ────────────────────────────────────────────
      if (step === 'static-validation-failed') {
        phaseStarts['static-fix'] = now;
        const fixModel = detail?.fixModel || pipelineFixModel;
        const errLines = detail?.errors
          ? detail.errors.split('\n').filter((l) => l.trim().startsWith('✗') || l.trim().startsWith('MISSING'))
          : [];
        const issueList = errLines
          .slice(0, 3)
          .map((e) => `• ${e.trim()}`)
          .join('\n');
        const more = errLines.length > 3 ? `\n…(${errLines.length - 3} more)` : '';
        const bodyText = `⚠️ *Step 1a — Static Validation Failed* — auto-fixing with \`${fixModel}\`\n${issueList || 'see logs'}${more}`;
        const blocks = [divider(), mrkdwn(bodyText), nextStep('Apply static fix then continue')];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── static-validation-fixed ─────────────────────────────────────────────
      if (step === 'static-validation-fixed') {
        const elapsed = phaseStarts['static-fix'] ? `+${Math.round((now - phaseStarts['static-fix']) / 1000)}s` : '';
        const bodyText = `✅ *Step 1a — Static Validation Fixed*${elapsed ? ` · ${elapsed}` : ''}`;
        const blocks = [divider(), mrkdwn(bodyText), nextStep('Contract validation')];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── static-validation-passed ────────────────────────────────────────────
      // Suppress — already covered by html-ready or static-validation-fixed context
      if (step === 'static-validation-passed') return;

      // ── early-review-approved (NEW) ─────────────────────────────────────────
      if (step === 'early-review-approved') {
        const elapsed = phaseStarts['generate-html'] ? Math.round((now - phaseStarts['generate-html']) / 1000) : null;
        const elapsedStr = elapsed != null ? ` · total: ${elapsed}s` : '';
        const bodyText = `✅ *Step 1c — Early Review: APPROVED*${elapsedStr}`;
        const blocks = [divider(), mrkdwn(bodyText), nextStep('Generating test cases from spec')];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── early-review-rejected (NEW/updated) ─────────────────────────────────
      if (step === 'early-review-rejected') {
        const elapsed = phaseStarts['generate-html'] ? Math.round((now - phaseStarts['generate-html']) / 1000) : null;
        const elapsedStr = elapsed != null ? ` · total: ${elapsed}s` : '';
        const fixModel = detail?.fixModel || pipelineFixModel;
        const bodyText = `🔸 *Step 1c — Early Review: REJECTED*${elapsedStr}\nApplying fix with \`${fixModel}\`...`;
        const blocks = [divider(), mrkdwn(bodyText), nextStep('Re-review after fix')];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── generate-tests — suppress; post on tests-generated ─────────────────
      if (step === 'generate-tests') {
        phaseStarts['generate-tests'] = now;
        return;
      }

      // ── tests-generated ─────────────────────────────────────────────────────
      if (step === 'tests-generated') {
        const elapsed = phaseStarts['generate-tests']
          ? `+${Math.round((now - phaseStarts['generate-tests']) / 1000)}s`
          : '';
        const model = detail?.model || pipelineTestModel;
        const total = detail?.totalTests ?? '?';
        const cats = detail?.categories || {};
        const catLine = Object.entries(cats)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ');
        const batches = pipelineMaxIterations;
        const headerText = `🧪 *Step 2 — Tests Generated*${elapsed ? ` · ${elapsed}` : ''}`;
        const bodyText = `Model: \`${model}\` · ${total} test cases${catLine ? `\n${catLine}` : ''}`;
        const blocks = [
          divider(),
          mrkdwn(`${headerText}\n${bodyText}`),
          nextStep(
            `Test → fix loop · ${Object.keys(cats).length || 5} categories · max ${pipelineMaxIterations} iterations`,
          ),
        ];
        slack
          .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
          .catch(() => {});

        // Also upload test cases to GCP if available via test-cases-ready (handled separately)
        return;
      }

      // ── batch-start ─────────────────────────────────────────────────────────
      if (step === 'batch-start') {
        phaseStarts[`batch-${detail?.batch}`] = now;
        phaseStarts[`iter-${detail?.batch}-1`] = now;
        // Suppress noisy batch-start messages — test-result tells the story
        return;
      }

      // ── test-result ─────────────────────────────────────────────────────────
      if (step === 'test-result') {
        const {
          batch = 'unknown',
          iteration = '?',
          passed = 0,
          failed = 0,
          failures = [],
          maxIterations = pipelineMaxIterations,
        } = detail || {};
        const iterKey = `iter-${batch}-${iteration}`;
        const batchElapsed = phaseStarts[iterKey]
          ? `+${Math.round((now - phaseStarts[iterKey]) / 1000)}s`
          : detail?.time != null
            ? `+${detail.time}s`
            : null;
        phaseStarts[`iter-${batch}-${Number(iteration) + 1}`] = now;
        const allPass = failed === 0 && passed > 0;
        const statusEmoji = allPass ? '✅' : iteration === maxIterations ? '❌' : '🔄';
        const headerText = `${statusEmoji} *${batch}* iter ${iteration}/${maxIterations} · ${passed}/${passed + failed} passed${batchElapsed ? ` · ${batchElapsed}` : ''}`;

        const blocks = [divider()];
        if (failed > 0 && failures.length > 0) {
          const failList = failures
            .map((f) => {
              const clean = f
                .replace(/\x1B\[[0-9;]*m/g, '')
                .replace(/\s+/g, ' ')
                .trim();
              return `• ${clean.slice(0, 200)}`;
            })
            .join('\n');
          blocks.push(mrkdwn(`${headerText}\n*Failures:*\n${failList}`));
          blocks.push(nextStep(`Fix attempt ${Number(iteration) + 1} with \`${pipelineFixModel}\``));
        } else {
          blocks.push(mrkdwn(allPass ? `${headerText}\nAll ${passed} tests passed ✓` : headerText));
          if (!allPass) blocks.push(nextStep(`Continue to next category`));
        }
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, headerText, { blocks }).catch(() => {});
        return;
      }

      // ── html-fixed ──────────────────────────────────────────────────────────
      if (step === 'html-fixed' && detail?.htmlFile) {
        const {
          iteration: iter = '?',
          passed: p = 0,
          total: t = 0,
          batch: batchName = 'unknown',
          model: fixedModel = pipelineFixModel,
          prevSizeKb = '?',
          newSizeKb: newKb = '?',
        } = detail;
        const fixKey = `fix-${batchName}-${iter}`;
        const elapsed = phaseStarts[fixKey] ? `+${Math.round((now - phaseStarts[fixKey]) / 1000)}s` : null;
        phaseStarts[`iter-${batchName}-${Number(iter) + 1}`] = now;
        const headerText = `🔧 *${batchName} — Fix ${iter}*${elapsed ? ` · ${elapsed}` : ''}`;
        const bodyMeta = `Model: \`${fixedModel}\` · Before: ${p}/${t} · Size: ${prevSizeKb}KB → ${newKb}KB`;
        if (gcp.isEnabled()) {
          gcp
            .uploadGameArtifact(gameId, buildId, detail.htmlFile, { suffix: `fix${iter}` })
            .then((gcpUrl) => {
              if (gcpUrl) {
                if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
                db.updateGameGcpUrl(gameId, gcpUrl);
                if (buildId) {
                  const key = `${batchName}-fix${iter}`;
                  db.updateBuildIterationUrl(buildId, key, gcpUrl);
                }
              }
              const blocks = [
                divider(),
                mrkdwn(
                  `${headerText}\n${bodyMeta}${gcpUrl ? `\n${slack.formatLink(gcpUrl, 'View patched HTML')}` : ''}`,
                ),
                nextStep(`Re-running ${batchName} tests`),
              ];
              slack
                .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyMeta}`, { blocks })
                .catch(() => {});
            })
            .catch(() => {});
        } else {
          const blocks = [divider(), mrkdwn(`${headerText}\n${bodyMeta}`), nextStep(`Re-running ${batchName} tests`)];
          slack
            .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyMeta}`, { blocks })
            .catch(() => {});
        }
        return;
      }

      // ── review-complete ─────────────────────────────────────────────────────
      if (step === 'review-complete') {
        const {
          status = '?',
          reviewResult = '',
          categoryResults = {},
          model: reviewModel = pipelineTestModel,
          time: reviewTime,
        } = detail || {};
        const emoji = status === 'APPROVED' ? '✅' : status === 'REJECTED' ? '🔸' : '❌';
        const elapsed = reviewTime != null ? ` · ${reviewTime}s` : '';

        // Build per-category scorecard
        const catLines = Object.entries(categoryResults).map(([cat, res]) => {
          const p = res.passed || 0;
          const f = res.failed || 0;
          const catEmoji = f === 0 ? '✅' : p === 0 ? '❌' : '⚠️';
          return `${catEmoji} ${cat}: ${p}/${p + f}`;
        });

        const headerText = `${emoji} *Step 4 — Review: ${status}*${elapsed}`;
        const catSummary = catLines.length > 0 ? catLines.join('  ·  ') : '';
        let bodyText = `Model: \`${reviewModel}\`${catSummary ? `\n${catSummary}` : ''}`;

        if (status === 'REJECTED' && reviewResult) {
          const snippet = reviewResult.slice(0, 400);
          bodyText += `\n\`\`\`\n${snippet}${reviewResult.length > 400 ? '…' : ''}\n\`\`\``;
        }

        // Upload review report to GCP and add link
        if (gcp.isEnabled() && reviewResult) {
          gcp
            .uploadContent(reviewResult, `games/${gameId}/builds/${buildId}/review-report.md`, {
              contentType: 'text/markdown',
            })
            .then((url) => {
              const linkLine = url ? `\n${slack.formatLink(url, 'Full review report')}` : '';
              const blocks = [divider(), mrkdwn(`${headerText}\n${bodyText}${linkLine}`)];
              if (status === 'APPROVED') blocks.push(nextStep('Build complete — game deployed'));
              slack
                .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
                .catch(() => {});
            })
            .catch(() => {
              const blocks = [divider(), mrkdwn(`${headerText}\n${bodyText}`)];
              slack
                .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
                .catch(() => {});
            });
        } else {
          const blocks = [divider(), mrkdwn(`${headerText}\n${bodyText}`)];
          if (status === 'APPROVED') blocks.push(nextStep('Build complete — game deployed'));
          slack
            .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyText}`, { blocks })
            .catch(() => {});
        }
        return;
      }

      // ── global-fix-start (NEW) ──────────────────────────────────────────────
      if (step === 'global-fix-start') {
        const elapsed = phaseStarts['test-fix-loop'] ? Math.round((now - phaseStarts['test-fix-loop']) / 1000) : null;
        const elapsedStr = elapsed != null ? ` · total: ${elapsed}s` : '';
        const failingCats = detail?.failingCategories || [];
        const globalModel = detail?.model || pipelineGenModel;
        const maxGlobal = detail?.maxGlobalIterations || 2;
        const bodyText = `🌐 *Step 3c — Global Fix Loop*${elapsedStr}\n${failingCats.length} categories still failing: ${failingCats.join(', ')}\nCross-category root cause analysis with \`${globalModel}\``;
        const blocks = [divider(), mrkdwn(bodyText), nextStep(`Global fix iter 1/${maxGlobal}`)];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── global-fix-applied (NEW) ────────────────────────────────────────────
      if (step === 'global-fix-applied') {
        const { globalIter = '?', failingBatches = [], htmlFile: globalHtmlFile } = detail || {};
        const maxGlobal = 2; // MAX_GLOBAL_FIX_ITERATIONS default
        const failingStr = Array.isArray(failingBatches) ? failingBatches.join(', ') : String(failingBatches);
        const headerText = `🔧 *Global Fix ${globalIter}/${maxGlobal} Applied*`;
        const bodyMeta = `Targeting: ${failingStr}`;
        if (gcp.isEnabled() && globalHtmlFile) {
          gcp
            .uploadGameArtifact(gameId, buildId, globalHtmlFile, { suffix: `global-fix${globalIter}` })
            .then((gcpUrl) => {
              if (gcpUrl) {
                if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
                db.updateGameGcpUrl(gameId, gcpUrl);
              }
              const blocks = [
                divider(),
                mrkdwn(`${headerText}\n${bodyMeta}${gcpUrl ? `\n${slack.formatLink(gcpUrl, 'View HTML')}` : ''}`),
                nextStep('Re-testing all categories'),
              ];
              slack
                .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyMeta}`, { blocks })
                .catch(() => {});
            })
            .catch(() => {});
        } else {
          const blocks = [divider(), mrkdwn(`${headerText}\n${bodyMeta}`), nextStep('Re-testing all categories')];
          slack
            .postThreadUpdate(threadInfo.ts, threadInfo.channel, `${headerText}\n${bodyMeta}`, { blocks })
            .catch(() => {});
        }
        return;
      }

      // ── html-fix-rolled-back ────────────────────────────────────────────────
      if (step === 'html-fix-rolled-back') {
        const { batch: b = 'unknown', iteration: iter = '?', reason = '' } = detail || {};
        const bodyText = `↩️ *${b} fix ${iter} rolled back* (${reason}) — restoring previous HTML`;
        const blocks = [divider(), mrkdwn(bodyText)];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── review ──────────────────────────────────────────────────────────────
      if (step === 'review') {
        phaseStarts['review'] = now;
        const model = detail?.model || pipelineTestModel;
        const bodyText = `📝 *Step 4 — Running Review* · \`${model}\``;
        const blocks = [divider(), mrkdwn(bodyText)];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── test-fix-loop ────────────────────────────────────────────────────────
      if (step === 'test-fix-loop') {
        phaseStarts['test-fix-loop'] = now;
        const batches = detail?.batches || 5;
        const bodyText = `🔄 *Step 3 — Test → Fix Loop* · ${batches} categories × max ${detail?.maxIterations || pipelineMaxIterations} iterations`;
        const blocks = [divider(), mrkdwn(bodyText)];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── spec-validated ───────────────────────────────────────────────────────
      if (step === 'spec-validated') {
        if (detail?.warnings > 0) {
          const warningList = (detail.warningList || []).map((w) => `• ${w}`).join('\n');
          const bodyText = `⚠️ *Spec warnings (${detail.warnings})*\n${warningList}`;
          const blocks = [divider(), mrkdwn(bodyText)];
          slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        }
        return;
      }

      // ── suppress noisy low-value steps ──────────────────────────────────────
      const silentSteps = new Set([
        'validate-spec',
        'static-validation',
        'generate-test-cases',
        'dom-snapshot',
        'dom-snapshot-ready',
        'early-review',
        'contract-static-fix',
        'global-fix-prompt',
        'global-fix-rolled-back',
        'review-fix',
        'review-fix-applied',
      ]);
      if (silentSteps.has(step)) return;

      if (step === 'static-validation-fix-failed') {
        const bodyText = '❌ *Static validation fix failed* — build may be unstable';
        const blocks = [divider(), mrkdwn(bodyText)];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── contract-validation-issues ──────────────────────────────────────────
      if (step === 'contract-validation-issues' && detail?.errors?.length) {
        const snippet =
          detail.errors.slice(0, 5).join('\n') +
          (detail.errors.length > 5 ? `\n…(${detail.errors.length - 5} more)` : '');
        const bodyText = `⚠️ *Contract validation: ${detail.count} issue(s)*\n\`\`\`\n${snippet}\n\`\`\``;
        const blocks = [divider(), mrkdwn(bodyText), nextStep('Auto-fix contract issues')];
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, bodyText, { blocks }).catch(() => {});
        return;
      }

      // ── test-cases-ready ────────────────────────────────────────────────────
      if (step === 'test-cases-ready' && Array.isArray(detail?.testCases) && detail.testCases.length > 0) {
        (async () => {
          try {
            // Group by category
            const byCategory = {};
            for (const tc of detail.testCases) {
              const cat = tc.category || 'general';
              if (!byCategory[cat]) byCategory[cat] = [];
              byCategory[cat].push(tc);
            }

            if (gcp.isEnabled()) {
              const links = [];
              for (const [cat, cases] of Object.entries(byCategory)) {
                const md = [`# Test Cases: ${cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`, '']
                  .concat(
                    cases.map((tc, i) =>
                      [
                        `## ${i + 1}. ${tc.name}`,
                        `**Description:** ${tc.description}`,
                        '**Steps:**',
                        tc.steps.map((s, j) => `${j + 1}. ${s}`).join('\n'),
                        '',
                      ].join('\n'),
                    ),
                  )
                  .join('\n');

                const dest = `games/${gameId}/builds/${buildId}/test-cases/${cat}.md`;
                const url = await gcp.uploadContent(md, dest, { contentType: 'text/markdown' });
                if (url) links.push({ cat, url });
              }

              if (links.length > 0) {
                const linkText = links.map(({ cat, url }) => slack.formatLink(url, cat)).join('  ·  ');
                slack
                  .postThreadUpdate(
                    threadInfo.ts,
                    threadInfo.channel,
                    `📋 *Test cases (${detail.testCases.length} total)* — ${linkText}`,
                  )
                  .catch(() => {});
              }
            } else {
              // No GCP — just post count summary
              slack
                .postThreadUpdate(
                  threadInfo.ts,
                  threadInfo.channel,
                  `📋 *Test cases generated* (${detail.testCases.length} total, ${Object.keys(byCategory).join(', ')})`,
                )
                .catch(() => {});
            }
          } catch (err) {
            // degraded: test case GCP upload is for Slack preview only; failure must not affect build outcome
            console.warn(`[worker] Failed to upload test cases: ${err.message}`);
          }
        })();
      }
    };

    // Pull latest code; if HEAD changed, clear require() cache for pipeline modules
    // so the next job runs the updated code rather than the stale in-memory copy.
    if (fs.existsSync(REPO_DIR) && fs.existsSync(path.join(REPO_DIR, '.git'))) {
      try {
        const { stdout: headBefore } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
          cwd: REPO_DIR,
        }).catch(() => ({ stdout: '' }));
        await execFileAsync('git', ['pull', 'origin', 'main'], {
          cwd: REPO_DIR,
          timeout: 60000,
        });
        const { stdout: headAfter } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
          cwd: REPO_DIR,
        }).catch(() => ({ stdout: '' }));
        if (headBefore.trim() !== headAfter.trim() && headAfter.trim()) {
          // Code changed — bust require() cache for all local lib/ modules so this
          // job (and all subsequent jobs in this process) use the updated source.
          const libDir = path.join(REPO_DIR, 'lib');
          Object.keys(require.cache).forEach((key) => {
            if (key.startsWith(libDir)) delete require.cache[key];
          });
          console.log(
            `[worker] Git pull: code updated ${headBefore.trim().slice(0, 7)} → ${headAfter.trim().slice(0, 7)}, lib/ cache cleared`,
          );
        } else {
          console.log(`[worker] Git pull completed (no change)`);
        }
      } catch (err) {
        // degraded: git pull is an optional hot-reload; network or repo errors must not block the build
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

    // Warehouse hygiene gate: delete stale HTML if game not approved.
    // Prevents pipeline from reusing broken HTML from prior failed builds.
    // pipeline.js checks fs.existsSync(htmlFile) && size > 5000 — if true, it skips
    // HTML generation entirely, causing every build to reuse the same broken output.
    const warehouseHtmlPath = path.join(
      process.env.RALPH_WAREHOUSE_DIR || path.join(__dirname, 'warehouse', 'templates'),
      gameId,
      'game',
      'index.html',
    );
    if (fs.existsSync(warehouseHtmlPath)) {
      const gameRecord = db.getGame(gameId);
      if (!gameRecord || gameRecord.status !== 'approved') {
        fs.unlinkSync(warehouseHtmlPath);
        logger.info(
          `[worker] Deleted stale warehouse HTML for ${gameId} (game status: ${gameRecord?.status ?? 'unknown'})`,
        );
      }
    }

    // Run Ralph — E3: choose between bash (ralph.sh) and Node.js (pipeline.js)
    let report;
    // Heartbeat: renew BullMQ lock every 2 min during long builds (LLM/Playwright calls
    // can block the event loop long enough for the 30-min lock to expire without renewal).
    const heartbeatInterval = setInterval(
      async () => {
        await job.updateProgress({ heartbeat: true, gameId }).catch(() => {});
      },
      2 * 60 * 1000,
    );
    try {
      if (USE_NODE_PIPELINE) {
        const gameDir = path.join(REPO_DIR, 'data', 'games', gameId, 'builds', String(buildId));
        const specFile = specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');
        fs.mkdirSync(gameDir, { recursive: true });
        // Write a pointer to this build so targeted fix can find the latest HTML
        fs.writeFileSync(path.join(REPO_DIR, 'data', 'games', gameId, '.latest'), String(buildId));
        // Copy pre-built HTML from warehouse if available (skips LLM generation in pipeline)
        const prebuiltHtml = path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'game', 'index.html');
        if (fs.existsSync(prebuiltHtml) && !fs.existsSync(path.join(gameDir, 'index.html'))) {
          fs.copyFileSync(prebuiltHtml, path.join(gameDir, 'index.html'));
          console.log(`[worker] Using pre-built HTML from warehouse for ${gameId} (skipping generation)`);
        }
        console.log(`[worker] Running Node.js pipeline (E3) for ${gameId}, build dir: ${gameDir}`);
        report = await runPipeline(gameDir, specFile, { metrics, logger, onProgress, buildId });
      } else {
        report = await runRalph(gameId, specPath, buildId);
      }
    } catch (err) {
      // critical: pipeline crash — record metrics + DB failure, then rethrow so BullMQ marks the job failed
      const buildDuration = (Date.now() - buildStartTime) / 1000;
      metrics.recordBuildCompleted(gameId, 'CRASHED', buildDuration, 0);
      transaction.setStatus && transaction.setStatus('error');
      transaction.finish && transaction.finish();
      // Ensure error_message is always recorded — worker.on('failed') is the outer
      // safety net, but err.message may be empty/undefined if a non-Error was thrown
      // or the Error was constructed without a message.  Write it here first so the
      // DB always has a descriptive message even if the outer handler loses context.
      if (buildId) {
        const errMsg = (err && (err.message || err.toString())) || 'pipeline crashed without a message';
        db.failBuild(buildId, errMsg);
      }
      throw err;
    } finally {
      clearInterval(heartbeatInterval);
    }

    // Merge iteration HTML URLs from DB into report (populated async by html-fixed handler)
    if (buildId) {
      const buildRecord = db.getBuild(buildId);
      if (buildRecord?.iteration_html_urls) {
        try {
          report.iteration_html_urls = JSON.parse(buildRecord.iteration_html_urls);
        } catch (_) {
          // cosmetic: iteration URL map is optional report enrichment; malformed JSON must not crash post-build steps
        }
      }
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

    // GCP upload — always upload so a preview link is available regardless of status
    if (gcp.isEnabled()) {
      const gameBuildDir = path.join(REPO_DIR, 'data', 'games', gameId, 'builds', String(buildId));
      const htmlFile = path.join(gameBuildDir, 'index.html');
      if (fs.existsSync(htmlFile)) {
        const gcpUrl = await gcp.uploadGameArtifact(gameId, buildId, htmlFile);
        if (gcpUrl) {
          if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
          db.updateGameGcpUrl(gameId, gcpUrl);
        }
      }
    }

    // Record metrics
    const buildDuration = (Date.now() - buildStartTime) / 1000;
    metrics.recordBuildCompleted(gameId, report.status, buildDuration, report.iterations || 0);
    transaction.setStatus && transaction.setStatus(report.status === 'APPROVED' ? 'ok' : 'error');
    transaction.finish && transaction.finish();

    // Post result to Slack thread or webhook
    const gcpUrl = db.getGame(gameId)?.gcp_url;
    if (threadInfo) {
      // Update opener with final status + post summary reply
      const finalPipelineMs = Date.now() - buildStartTime;
      const finalPipelineMin = Math.round(finalPipelineMs / 60000);
      const finalPipelineElapsedMin = finalPipelineMin < 1 ? '<1m' : `${finalPipelineMin}m`;
      const finalStepMs = Date.now() - stepStartedAt;
      const finalStepMin = Math.round(finalStepMs / 60000);
      const finalStepElapsedMin = finalStepMin < 1 ? '<1m' : `${finalStepMin}m`;
      await slack.updateThreadOpener(threadInfo.ts, threadInfo.channel, gameId, report, {
        gcpUrl,
        specLink: specLink || null,
        specGithubUrl: !specLink ? specGithubUrl : null,
        pipelineDocsLink: pipelineDocsLink || null,
        pipelineDocsUrl: !pipelineDocsLink ? pipelineDocsGithubUrl : null,
        requestedBy: requestedBy || null,
        startedAt: buildStartTime,
        llmCalls: llmCallCount || report.llm_calls || null,
        currentStep: currentBuildStep,
        gameTitle: game?.title || null,
        pipelineElapsedMin: finalPipelineElapsedMin,
        stepElapsedMin: finalStepElapsedMin,
      });
      await slack.postThreadResult(threadInfo.ts, threadInfo.channel, gameId, report, { gcpUrl });
    } else {
      await slack.notifyBuildResult(gameId, report, commitSha, gcpUrl);
    }

    // Auto-retry: requeue if build scored 0/total tests and hasn't been retried yet
    if (AUTO_RETRY && report && report.summary) {
      const { passed, total } = report.summary;
      const isCompleteFailure = total > 0 && passed === 0;
      if (isCompleteFailure) {
        const currentBuild = db.getBuild(buildId);
        if ((currentBuild?.retry_count || 0) === 0) {
          const buildQueue = worker.opts.connection
            ? new Queue('ralph-builds', { connection: worker.opts.connection })
            : null;
          if (buildQueue) {
            const newJob = await buildQueue.add('build', { gameId, retryOf: buildId });
            logger.info(
              `[worker] Auto-retry queued for ${gameId} (build #${buildId} scored 0/${total}) → new job ${newJob.id}`,
            );
            db.getDb().prepare('UPDATE builds SET retry_count = 1 WHERE id = ?').run(buildId);
            const retryThread =
              threadInfo ||
              (db.getGame(gameId)?.slack_thread_ts
                ? { ts: db.getGame(gameId).slack_thread_ts, channel: db.getGame(gameId).slack_channel_id }
                : null);
            if (retryThread) {
              await slack.postThreadUpdate(
                retryThread.ts,
                retryThread.channel,
                `🔄 Auto-retry queued — build #${buildId} scored 0/${total} tests. Starting fresh build...`,
              );
            }
            await buildQueue.close();
          }
        } else {
          logger.warn(`[worker] Auto-retry skipped for ${gameId} — already retried once (build #${buildId})`);
        }
      }
    }

    // Update game status
    db.updateGameStatus(gameId, report.status === 'APPROVED' ? 'approved' : report.status.toLowerCase());

    // Post-approval: sync approved HTML back to warehouse so future builds start from known-good base
    if (report.status === 'APPROVED') {
      const approvedHtmlSrc = path.join(REPO_DIR, 'data', 'games', gameId, 'builds', String(buildId), 'index.html');
      const warehouseTemplatesDir = process.env.RALPH_WAREHOUSE_DIR || path.join(__dirname, 'warehouse', 'templates');
      const warehouseGameDir = path.join(warehouseTemplatesDir, gameId, 'game');
      const warehouseHtmlDst = path.join(warehouseGameDir, 'index.html');
      if (fs.existsSync(approvedHtmlSrc)) {
        fs.mkdirSync(warehouseGameDir, { recursive: true });
        fs.copyFileSync(approvedHtmlSrc, warehouseHtmlDst);
        logger.info(`[worker] Synced approved HTML to warehouse for ${gameId}`);
      }
    }

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
    lockDuration: 30 * 60 * 1000, // 30 minutes — pipeline jobs take up to 25min
    lockRenewTime: 10 * 60 * 1000, // renew every 10 minutes (lockDuration / 3)
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
  // Normalise the error message: err may be a non-Error object or have an empty
  // message (which would store NULL in SQLite).  Always record something useful.
  const errMsg = (err && (err.message || err.toString())) || 'worker-level failure: no error message captured';
  logger.error(`Job ${job.id} failed: ${errMsg}`, { gameId, buildId, event: 'build_failed' });
  sentry.captureException(err, { gameId, buildId, step: 'worker' });

  if (buildId) {
    // Only write if the build does not already have an error_message (the inner
    // catch block writes first when the pipeline itself crashes).
    const existing = db.getBuild(buildId);
    if (!existing?.error_message) {
      db.failBuild(buildId, errMsg);
    }
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

// At startup: fail any builds still in 'running' state from a prior worker crash
async function cleanupOrphanedBuilds() {
  const orphans = db.getRunningBuilds();
  if (orphans.length === 0) return;
  logger.warn(`[worker] Found ${orphans.length} orphaned build(s) in 'running' state — marking failed`);
  for (const build of orphans) {
    db.failBuild(
      build.id,
      `orphaned: worker restarted while build was running (worker_id: ${build.worker_id || 'unknown'})`,
    );
    logger.warn(`[worker] Marked build ${build.id} (${build.game_id}) as failed (was running)`);
  }
}
cleanupOrphanedBuilds().catch((err) => logger.error('[worker] Orphan cleanup failed:', err));

// At startup: requeue any failed builds with queue-sync error that haven't been retried yet
async function requeueQueueSyncBuilds() {
  const candidates = db
    .getDb()
    .prepare(
      "SELECT * FROM builds WHERE status = 'failed' AND error_message LIKE '%queue-sync%' AND (retry_count IS NULL OR retry_count < 1) ORDER BY id ASC",
    )
    .all();

  if (candidates.length === 0) {
    logger.info('[worker] queue-sync requeue: found 0 builds to requeue');
    return;
  }

  logger.info(`[worker] queue-sync requeue: found ${candidates.length} build(s) to requeue`);

  const buildQueue = new Queue('ralph-builds', { connection });

  for (const build of candidates) {
    const gameId = build.game_id;

    // Skip if this game already has a queued or running build
    const active = db
      .getDb()
      .prepare("SELECT id FROM builds WHERE game_id = ? AND status IN ('queued', 'running') LIMIT 1")
      .get(gameId);
    if (active) {
      logger.info(`[worker] queue-sync requeue: skipping ${gameId} — already has active build #${active.id}`);
      db.getDb().prepare('UPDATE builds SET retry_count = 1 WHERE id = ?').run(build.id);
      continue;
    }

    await buildQueue.add('build', { gameId, requeueOf: build.id });
    db.getDb().prepare('UPDATE builds SET retry_count = 1 WHERE id = ?').run(build.id);
    logger.info(`[worker] queue-sync auto-requeue: ${gameId} (was build #${build.id})`);
  }

  await buildQueue.close();
}
requeueQueueSyncBuilds().catch((err) => logger.error('[worker] queue-sync requeue failed:', err));

startSystemMetrics();
logger.info(`[worker] Worker ID: ${WORKER_ID}`);
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

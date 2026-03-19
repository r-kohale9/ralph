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
const { getSystemStats, startSystemMetrics } = metrics;

const WORKER_ID = process.env.RALPH_WORKER_ID || require('crypto').randomUUID().slice(0, 8);

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

// Resource gate thresholds
const CPU_GATE_PCT = parseFloat(process.env.RALPH_CPU_GATE || '85');
const RAM_GATE_MB = parseFloat(process.env.RALPH_RAM_GATE_MB || '512');

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

  if (buildId) db.startBuild(buildId, { workerId: WORKER_ID });

  // Resolve latest build dir — targeted fix patches the most recent generated HTML
  const gameBase = path.join(REPO_DIR, 'data', 'games', gameId);
  const latestFile = path.join(gameBase, '.latest');
  const latestBuildId = fs.existsSync(latestFile) ? fs.readFileSync(latestFile, 'utf-8').trim() : null;
  const gameDir = latestBuildId
    ? path.join(gameBase, 'builds', latestBuildId)
    : gameBase; // fallback for legacy flat structure
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

    const { gameId, commitSha, buildId, specUrl, specContent } = job.data;
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
    const game = db.getGame(gameId);
    if (game && game.slack_thread_ts) {
      // Use existing thread
      threadInfo = { ts: game.slack_thread_ts, channel: game.slack_channel_id };
      await slack.postThreadUpdate(
        threadInfo.ts, threadInfo.channel,
        `🔄 *Build #${buildId} started* — ${gameId}\nGen=${pipelineGenModel} | Test=${pipelineTestModel} | Fix=${pipelineFixModel}`,
      );
    } else {
      // Upload spec (await so link is ready for opener)
      const specFilePath = specPath || path.join(REPO_DIR, 'warehouse', 'templates', gameId, 'spec.md');
      if (gcp.isEnabled() && fs.existsSync(specFilePath)) {
        const specUrl = await gcp.uploadContent(
          fs.readFileSync(specFilePath, 'utf-8'),
          `games/${gameId}/builds/${buildId}/spec.md`,
          { contentType: 'text/markdown' },
        ).catch(() => null);
        if (specUrl) specLink = slack.formatLink(specUrl, '📄 Spec');
      }

      // Upload pipeline docs
      if (gcp.isEnabled()) {
        const docsUrl = await gcp.uploadContent(
          buildPipelineDocsMarkdown({ gameId, buildId, genModel: pipelineGenModel, testModel: pipelineTestModel, fixModel: pipelineFixModel, maxIterations: pipelineMaxIterations }),
          `games/${gameId}/builds/${buildId}/pipeline-docs.md`,
          { contentType: 'text/markdown' },
        ).catch(() => null);
        if (docsUrl) pipelineDocsLink = slack.formatLink(docsUrl, '📖 Pipeline Docs');
      }

      const linksLine = [specLink, pipelineDocsLink].filter(Boolean).join('  ·  ');
      const openerText = [
        `🎮 *${game?.title || gameId}* — Build #${buildId || 'pending'}`,
        `*Status:* 🔄 Building...`,
        `*Models:* Gen=${pipelineGenModel} | Test=${pipelineTestModel} | Fix=${pipelineFixModel}`,
        linksLine || null,
      ].filter(Boolean).join('\n');

      threadInfo = await slack.createGameThread(gameId, {
        title: game?.title || gameId,
        buildId,
        openerText,
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
    }

    // Progress callback for Slack thread updates
    const phaseStarts = {};
    const onProgress = (step, detail) => {
      console.log(`[worker] progress: ${step}`, detail);
      if (!threadInfo) return;
      const now = Date.now();
      if (!phaseStarts[step]) phaseStarts[step] = now;

      // ── html-ready ──────────────────────────────────────────────────────────
      if (step === 'html-ready' && detail?.htmlFile) {
        const sizeKb = detail.size ? `${Math.round(detail.size / 1024)}KB` : '?KB';
        const timeStr = detail.time != null ? `${detail.time}s` : '?s';
        const model = detail.model || pipelineGenModel;
        if (gcp.isEnabled()) {
          gcp.uploadGameArtifact(gameId, buildId, detail.htmlFile, { suffix: 'generated' }).then((gcpUrl) => {
            if (gcpUrl) {
              if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
              db.updateGameGcpUrl(gameId, gcpUrl);
              slack.postThreadUpdate(
                threadInfo.ts, threadInfo.channel,
                `✅ *HTML generated* — ${sizeKb} | ${timeStr} | ${model}\n${slack.formatLink(gcpUrl, 'View HTML')}`,
              ).catch(() => {});
            } else {
              slack.postThreadUpdate(
                threadInfo.ts, threadInfo.channel,
                `✅ *HTML generated* — ${sizeKb} | ${timeStr} | ${model}`,
              ).catch(() => {});
            }
          }).catch(() => {});
        } else {
          slack.postThreadUpdate(
            threadInfo.ts, threadInfo.channel,
            `✅ *HTML generated* — ${sizeKb} | ${timeStr} | ${model}`,
          ).catch(() => {});
        }
        return;
      }

      // ── static-validation-failed ────────────────────────────────────────────
      if (step === 'static-validation-failed') {
        phaseStarts['static-fix'] = now;
        const fixModel = detail?.fixModel || pipelineFixModel;
        const errLines = detail?.errors ? detail.errors.split('\n').filter((l) => l.trim().startsWith('✗') || l.trim().startsWith('MISSING')) : [];
        const issueList = errLines.slice(0, 3).map((e) => `• ${e.trim()}`).join('\n');
        const more = errLines.length > 3 ? `\n…(${errLines.length - 3} more)` : '';
        slack.postThreadUpdate(
          threadInfo.ts, threadInfo.channel,
          `⚠️ *Static validation failed* — auto-fixing | ${fixModel}\n${issueList || 'see logs'}${more}`,
        ).catch(() => {});
        return;
      }

      // ── static-validation-fixed ─────────────────────────────────────────────
      if (step === 'static-validation-fixed') {
        const elapsed = phaseStarts['static-fix'] ? `${Math.round((now - phaseStarts['static-fix']) / 1000)}s` : '';
        slack.postThreadUpdate(
          threadInfo.ts, threadInfo.channel,
          `✅ *Static validation fixed*${elapsed ? ` — ${elapsed}` : ''}`,
        ).catch(() => {});
        return;
      }

      // ── generate-tests ──────────────────────────────────────────────────────
      if (step === 'generate-tests') {
        phaseStarts['generate-tests'] = now;
        const model = detail?.model || pipelineTestModel;
        slack.postThreadUpdate(
          threadInfo.ts, threadInfo.channel,
          `🧪 *Generating tests* — ${model}`,
        ).catch(() => {});
        return;
      }

      // ── batch-start ─────────────────────────────────────────────────────────
      if (step === 'batch-start') {
        phaseStarts[`batch-${detail?.batch}`] = now;
        const batchNum = (detail?.batchIdx ?? 0) + 1;
        const total = detail?.totalBatches || '?';
        const batchName = detail?.batch || 'unknown';
        slack.postThreadUpdate(
          threadInfo.ts, threadInfo.channel,
          `▶️ *${batchName}* [${batchNum}/${total}] — running tests`,
        ).catch(() => {});
        return;
      }

      // ── test-result ─────────────────────────────────────────────────────────
      if (step === 'test-result') {
        const { batch = 'unknown', iteration = '?', passed = 0, failed = 0, failures = [], maxIterations = pipelineMaxIterations } = detail || {};
        const batchElapsed = phaseStarts[`iter-${batch}-${iteration}`]
          ? `${Math.round((now - phaseStarts[`iter-${batch}-${iteration}`]) / 1000)}s`
          : detail?.time != null ? `${detail.time}s` : null;
        phaseStarts[`iter-${batch}-${Number(iteration) + 1}`] = now;
        const timeStr = batchElapsed ? ` | ${batchElapsed}` : '';
        const allPass = failed === 0;
        const statusEmoji = allPass ? '✅' : iteration === maxIterations ? '❌' : '🔄';
        let msg = `${statusEmoji} *${batch}* iter ${iteration}/${maxIterations} — ${passed}/${passed + failed} passed${timeStr}`;
        if (failed > 0 && failures.length > 0) {
          const failList = failures.slice(0, 3).map((f) => {
            // Strip ANSI and truncate
            const clean = f.replace(/\x1B\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
            return `• ${clean.slice(0, 120)}`;
          }).join('\n');
          const moreF = failures.length > 3 ? `\n…(${failures.length - 3} more)` : '';
          msg += `\n${failList}${moreF}`;
        }
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, msg).catch(() => {});
        return;
      }

      // ── html-fixed ──────────────────────────────────────────────────────────
      if (step === 'html-fixed' && detail?.htmlFile) {
        const { iteration: iter = '?', passed: p = 0, total: t = 0, batch: batchName = 'unknown', model: fixModel = pipelineFixModel } = detail;
        const fixKey = `fix-${batchName}-${iter}`;
        const elapsed = phaseStarts[fixKey] ? `${Math.round((now - phaseStarts[fixKey]) / 1000)}s` : null;
        phaseStarts[`iter-${batchName}-${Number(iter) + 1}`] = now;
        const timeStr = elapsed ? ` | ${elapsed}` : '';
        if (gcp.isEnabled()) {
          gcp.uploadGameArtifact(gameId, buildId, detail.htmlFile, { suffix: `fix${iter}` }).then((gcpUrl) => {
            if (gcpUrl) {
              if (buildId) db.updateBuildGcpUrl(buildId, gcpUrl);
              db.updateGameGcpUrl(gameId, gcpUrl);
              slack.postThreadUpdate(
                threadInfo.ts, threadInfo.channel,
                `🔧 *${batchName}* fix ${iter} — ${fixModel}${timeStr} | before: ${p}/${t}\n${slack.formatLink(gcpUrl, 'View fix')}`,
              ).catch(() => {});
            } else {
              slack.postThreadUpdate(
                threadInfo.ts, threadInfo.channel,
                `🔧 *${batchName}* fix ${iter} — ${fixModel}${timeStr} | before: ${p}/${t}`,
              ).catch(() => {});
            }
          }).catch(() => {});
        } else {
          slack.postThreadUpdate(
            threadInfo.ts, threadInfo.channel,
            `🔧 *${batchName}* fix ${iter} — ${fixModel}${timeStr} | before: ${p}/${t}`,
          ).catch(() => {});
        }
        return;
      }

      // ── review-complete ─────────────────────────────────────────────────────
      if (step === 'review-complete') {
        const { status = '?', reviewResult = '', categoryResults = {} } = detail || {};
        const emoji = status === 'APPROVED' ? '✅' : status === 'REJECTED' ? '🔸' : '❌';

        // Build per-category summary
        const catLines = Object.entries(categoryResults).map(([cat, res]) => {
          const p = res.passed || 0;
          const f = res.failed || 0;
          const catEmoji = f === 0 ? '✅' : p === 0 ? '❌' : '⚠️';
          return `${catEmoji} ${cat}: ${p}/${p + f}`;
        });

        let msg = `${emoji} *Review: ${status}*`;
        if (catLines.length > 0) msg += `\n${catLines.join('  ·  ')}`;

        if (status === 'REJECTED' && reviewResult) {
          const snippet = reviewResult.slice(0, 400);
          msg += `\n\`\`\`\n${snippet}${reviewResult.length > 400 ? '…' : ''}\n\`\`\``;
        }

        // Upload review report to GCP and add link
        if (gcp.isEnabled() && reviewResult) {
          gcp.uploadContent(
            reviewResult,
            `games/${gameId}/builds/${buildId}/review-report.md`,
            { contentType: 'text/markdown' },
          ).then((url) => {
            if (url) msg += `\n${slack.formatLink(url, 'Full review report')}`;
            slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, msg).catch(() => {});
          }).catch(() => {
            slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, msg).catch(() => {});
          });
        } else {
          slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, msg).catch(() => {});
        }
        return;
      }

      // ── html-fix-rolled-back ────────────────────────────────────────────────
      if (step === 'html-fix-rolled-back') {
        const { batch: b = 'unknown', iteration: iter = '?', reason = '' } = detail || {};
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel,
          `↩️ ${b} fix ${iter} rolled back (${reason}) — restoring previous HTML`).catch(() => {});
        return;
      }

      // ── simple mapped messages ───────────────────────────────────────────────
      if (step === 'generate-html') {
        phaseStarts['generate-html'] = now;
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, `🏗️ *Generating HTML* — ${detail?.model || pipelineGenModel}`).catch(() => {});
        return;
      }
      if (step === 'review') {
        phaseStarts['review'] = now;
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, `📝 *Running review* — ${detail?.model || pipelineTestModel}`).catch(() => {});
        return;
      }
      if (step === 'test-fix-loop') {
        const batches = detail?.batches || 5;
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, `🔄 *Test → fix loop* — ${batches} categories × max ${detail?.maxIterations || pipelineMaxIterations} iterations`).catch(() => {});
        return;
      }
      const silentSteps = new Set(['validate-spec', 'static-validation', 'generate-test-cases', 'html-ready', 'dom-snapshot', 'dom-snapshot-ready']);
      if (silentSteps.has(step)) return; // suppress noisy low-value messages
      if (step === 'static-validation-fix-failed') {
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel, '❌ *Static validation fix failed* — build may be unstable').catch(() => {});
        return;
      }

      // ── contract-validation-issues ──────────────────────────────────────────
      if (step === 'contract-validation-issues' && detail?.errors?.length) {
        const snippet = detail.errors.slice(0, 5).join('\n') + (detail.errors.length > 5 ? `\n…(${detail.errors.length - 5} more)` : '');
        slack.postThreadUpdate(threadInfo.ts, threadInfo.channel,
          `⚠️ *Contract validation: ${detail.count} issue(s)*\n\`\`\`\n${snippet}\n\`\`\``).catch(() => {});
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
                  .concat(cases.map((tc, i) => [
                    `## ${i + 1}. ${tc.name}`,
                    `**Description:** ${tc.description}`,
                    '**Steps:**',
                    tc.steps.map((s, j) => `${j + 1}. ${s}`).join('\n'),
                    '',
                  ].join('\n')))
                  .join('\n');

                const dest = `games/${gameId}/builds/${buildId}/test-cases/${cat}.md`;
                const url = await gcp.uploadContent(md, dest, { contentType: 'text/markdown' });
                if (url) links.push({ cat, url });
              }

              if (links.length > 0) {
                const linkText = links.map(({ cat, url }) => slack.formatLink(url, cat)).join('  ·  ');
                slack.postThreadUpdate(threadInfo.ts, threadInfo.channel,
                  `📋 *Test cases (${detail.testCases.length} total)* — ${linkText}`).catch(() => {});
              }
            } else {
              // No GCP — just post count summary
              slack.postThreadUpdate(threadInfo.ts, threadInfo.channel,
                `📋 *Test cases generated* (${detail.testCases.length} total, ${Object.keys(byCategory).join(', ')})`).catch(() => {});
            }
          } catch (err) {
            console.warn(`[worker] Failed to upload test cases: ${err.message}`);
          }
        })();
      }
    };

    // Pull latest code
    if (fs.existsSync(REPO_DIR) && fs.existsSync(path.join(REPO_DIR, '.git'))) {
      try {
        await execFileAsync('git', ['pull', 'origin', 'main'], {
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
      await slack.updateThreadOpener(threadInfo.ts, threadInfo.channel, gameId, report, { gcpUrl, specLink, pipelineDocsLink });
      await slack.postThreadResult(threadInfo.ts, threadInfo.channel, gameId, report, { gcpUrl });
    } else {
      await slack.notifyBuildResult(gameId, report, commitSha, gcpUrl);
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
    lockDuration: 30 * 60 * 1000,   // 30 minutes — pipeline jobs take up to 25min
    lockRenewTime: 10 * 60 * 1000,  // renew every 10 minutes (lockDuration / 3)
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

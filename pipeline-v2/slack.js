'use strict';

/**
 * Pipeline V2 — Slack integration
 *
 * Full-featured Slack notifications matching V1 pipeline output.
 * Uses Block Kit for rich formatting with per-category test results,
 * visual review verdicts, and publish links.
 *
 * Wraps the existing lib/slack.js Web API + webhook fallback system.
 */

const config = require('./config');

// Reuse the existing Slack module
let coreSlack;
try {
  coreSlack = require('../lib/slack');
  coreSlack.init();
} catch (err) {
  console.warn(`[slack-v2] Could not load core slack module: ${err.message}`);
  coreSlack = null;
}

// ─── Block Kit helpers ─────────────────────────────────────────────────────

function divider() {
  return { type: 'divider' };
}

function mrkdwn(text) {
  return { type: 'section', text: { type: 'mrkdwn', text: text.slice(0, 3000) } };
}

function contextBlock(text) {
  return { type: 'context', elements: [{ type: 'mrkdwn', text: text.slice(0, 3000) }] };
}

function nextStep(label) {
  return contextBlock(`→ Next: ${label}`);
}

// ─── Step metadata ─────────────────────────────────────────────────────────

const STEP_META = {
  'spec-validation':  { icon: '📝', name: 'Spec Validation', num: '0' },
  'pre-generation':   { icon: '🧠', name: 'Pre-Generation Analysis', num: '0.5' },
  'generate':         { icon: '🏗️', name: 'Generate HTML', num: '1' },
  'validate':        { icon: '🔍', name: 'Validate & Smoke Check', num: '1a' },
  'test-fix':        { icon: '🧪', name: 'Test & Fix', num: '2' },
  'visual-review':   { icon: '👁️', name: 'Visual Review', num: '3' },
  'final-review':    { icon: '📋', name: 'Final Review', num: '4' },
  'rejection-fix':   { icon: '🔄', name: 'Rejection Fix', num: '4a' },
  'content-gen':     { icon: '📦', name: 'Content Generation', num: '5' },
  'fix':             { icon: '🔧', name: 'Targeted Fix', num: '-' },
};

function _getStepMeta(step) {
  const baseStep = step?.replace(/-\d+$/, '') || step;
  return STEP_META[baseStep] || STEP_META[step] || { icon: '📌', name: step, num: '?' };
}

function _formatStepName(step) {
  return _getStepMeta(step).name;
}

function _specGithubUrl(gameId) {
  const repo = process.env.RALPH_GITHUB_REPO;
  if (!repo) return undefined;
  return `${repo}/blob/main/data/game-specs/${gameId}/spec.md`;
}

// ─── V2 Build thread management ─────────────────────────────────────────────

/**
 * Create a Slack thread for a V2 build.
 */
async function createBuildThread(gameId, {
  buildId,
  requestedBy,
  specPath,
  specLink,
  model,
} = {}) {
  if (!coreSlack) return null;

  try {
    const result = await coreSlack.createGameThread(gameId, {
      title: gameId,
      buildId,
      requestedBy,
      currentStep: 'Starting (V2 Agent SDK)',
      specLink,
      specGithubUrl: specPath ? _specGithubUrl(gameId) : undefined,
    });

    if (result) {
      // Post pipeline plan to thread (matches V1 format)
      const planBlocks = [
        divider(),
        mrkdwn([
          `🤖 *Pipeline V2* — Single-session Agent SDK`,
          `Model: \`${model || config.GEN_MODEL}\``,
          ``,
          `*Pipeline plan:*`,
          `0️⃣ Spec pre-validation`,
          `🧠 Pre-generation analysis — spec flow & interactions`,
          `1️⃣ Generate HTML — \`${model || config.GEN_MODEL}\``,
          `1️⃣a Validate & smoke check (auto-fix)`,
          `2️⃣ Test → fix — 5 categories: game-flow · mechanics · level-progression · edge-cases · contract`,
          `3️⃣ Visual UI/UX review — screenshots + fix`,
          `4️⃣ Final spec compliance review`,
          `4️⃣a Rejection fix loop (up to 2 attempts)`,
          `5️⃣ Content generation — inputSchema + content sets (if approved)`,
        ].join('\n')),
        contextBlock('💬 Reply with feedback to trigger a targeted fix'),
      ];
      await coreSlack.postThreadUpdate(result.ts, result.channel, 'Pipeline V2 plan', { blocks: planBlocks });
    }

    return result;
  } catch (err) {
    console.error(`[slack-v2] Failed to create thread: ${err.message}`);
    return null;
  }
}

// ─── Transcript formatting ──────────────────────────────────────────────────

const fs = require('fs');

/**
 * Format tool input the same way as agent.js console logs.
 */
function _fmtToolInput(name, input) {
  if (!input) return '';
  switch (name) {
    case 'Write': return `path=${input.file_path || '?'} (${(input.content || '').length} chars)`;
    case 'Edit': return `path=${input.file_path || '?'} Δ${(input.old_string || '').length}→${(input.new_string || '').length}`;
    case 'Read': return `path=${input.file_path || '?'}`;
    case 'Bash': return `$ ${(input.command || '').replace(/\n/g, ' ').slice(0, 120)}`;
    case 'Glob': return `${input.pattern || '?'}`;
    case 'Grep': return `/${input.pattern || '?'}/`;
    default: {
      const s = JSON.stringify(input);
      return s.length > 120 ? s.slice(0, 120) + '...' : s;
    }
  }
}

/**
 * Format transcript messages for a specific step into console-style logs.
 * Matches the exact format that agent.js prints to the terminal.
 *
 * @param {string} transcriptPath - Path to the JSONL transcript file
 * @param {string} step - The pipeline step name to filter for
 * @returns {string|null} Formatted text for Slack, or null if no messages
 */
function _formatTranscriptForStep(transcriptPath, step) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;

  try {
    const lines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n');
    const formatted = [];
    let turnCount = 0;

    // Find the step-boundary to get the starting turn count
    for (const line of lines) {
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg._type === 'step-boundary' && msg.step === step) {
        // totalTurns at start of this step = totalTurns - turns for this step
        turnCount = (msg.totalTurns || 0) - (msg.turns || 0);
        break;
      }
    }

    for (const line of lines) {
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg._step !== step) continue;

      if (msg.type === 'system' && msg.subtype === 'init') {
        formatted.push(`Session: ${(msg.session_id || '').slice(0, 8)}...`);
        const mcpNames = (msg.mcp_servers || []).map((s) => s.name).join(', ') || 'none';
        formatted.push(`Init: model=${msg.model}, tools=${(msg.tools || []).length}, mcp=${mcpNames}`);
      } else if (msg.type === 'assistant') {
        const content = msg.message?.content || [];

        // Collect text and tools from this turn
        const textBlocks = content.filter((b) => b.type === 'text');
        const thinkingBlocks = content.filter((b) => b.type === 'thinking');
        const toolBlocks = content.filter((b) => b.type === 'tool_use');

        // Text turns
        if (textBlocks.length > 0) {
          turnCount++;
          const text = textBlocks.map((b) => b.text).join('\n');
          const preview = text.replace(/\n/g, ' ').slice(0, 250);
          formatted.push(`Turn ${turnCount}: ${preview}${text.length > 250 ? '...' : ''}`);
        } else if (thinkingBlocks.length > 0 && toolBlocks.length === 0) {
          turnCount++;
          const thinking = thinkingBlocks.map((b) => b.thinking).join(' ');
          const preview = thinking.replace(/\n/g, ' ').slice(0, 200);
          formatted.push(`Turn ${turnCount}: 💭 ${preview}${thinking.length > 200 ? '...' : ''}`);
        }

        // Tool uses
        for (const t of toolBlocks) {
          if (!textBlocks.length && !thinkingBlocks.length) {
            turnCount++;
          }
          formatted.push(`  🔧 ${t.name} ${_fmtToolInput(t.name, t.input)}`);
        }
      } else if (msg.type === 'result') {
        const status = msg.subtype === 'success' ? '✅' : '❌';
        const cost = msg.total_cost_usd ? `$${msg.total_cost_usd.toFixed(4)}` : '';
        formatted.push(`${status} Step result: ${msg.subtype} | ${cost}`);
      }
    }

    if (formatted.length === 0) return null;
    return formatted.join('\n');
  } catch (err) {
    console.warn(`[slack-v2] Transcript format error: ${err.message}`);
    return null;
  }
}

/**
 * Post a transcript summary to the build thread for a specific step.
 * Splits into multiple messages if the transcript exceeds Slack's block limit.
 *
 * @param {string} threadTs - Thread timestamp
 * @param {string} channelId - Slack channel
 * @param {string} transcriptPath - Path to the JSONL transcript file
 * @param {string} step - The pipeline step name
 */
async function postTranscriptUpdate(threadTs, channelId, transcriptPath, step) {
  if (!coreSlack || !threadTs) return;

  const transcript = _formatTranscriptForStep(transcriptPath, step);
  if (!transcript) return;

  try {
    const meta = _getStepMeta(step);

    // Slack code block limit: ~2900 chars (3000 block limit minus header)
    const MAX_CODE_BLOCK = 2900;
    const chunks = [];
    let current = '';

    for (const line of transcript.split('\n')) {
      if (current.length + line.length + 1 > MAX_CODE_BLOCK) {
        chunks.push(current);
        current = line;
      } else {
        current += (current ? '\n' : '') + line;
      }
    }
    if (current) chunks.push(current);

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000));
      const pageLabel = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      const header = `${meta.icon} *${meta.name} — Transcript${pageLabel}*`;
      const blocks = [
        mrkdwn(header),
        mrkdwn(`\`\`\`\n${chunks[i]}\n\`\`\``),
      ];
      await coreSlack.postThreadUpdate(threadTs, channelId, `${meta.name} transcript${pageLabel}`, { blocks });
    }
  } catch (err) {
    console.warn(`[slack-v2] Transcript post error: ${err.message}`);
  }
}

// ─── Step progress updates ──────────────────────────────────────────────────

/**
 * Post a step progress update to the build thread.
 * Uses Block Kit matching V1 format: divider + body + next step hint.
 */
async function postStepUpdate(threadTs, channelId, event) {
  if (!coreSlack || !threadTs) return;

  try {
    // ── Pipeline-level errors ──────────────────────────────────────────
    if (event.type === 'pipeline-error') {
      const blocks = [
        divider(),
        mrkdwn(`🚨 *Pipeline Error*\n\`\`\`${(event.error || 'Unknown error').slice(0, 500)}\`\`\``),
      ];
      await coreSlack.postThreadUpdate(threadTs, channelId, `🚨 Pipeline Error: ${(event.error || '').slice(0, 200)}`, { blocks });
      return;
    }

    if (event.type !== 'pipeline-step') return;

    const meta = _getStepMeta(event.step);
    const baseStep = event.step?.replace(/-\d+$/, '') || event.step;

    // ── Step started ─────────────────────────────────────────────────
    if (event.status === 'running') {
      let bodyText = `${meta.icon} *Step ${meta.num} — ${meta.name}*`;
      if (event.attempt) bodyText += ` (#${event.attempt})`;

      // Add context about what this step does
      const nextHints = {
        'spec-validation': 'Checking spec structure',
        'pre-generation': 'Analyzing spec flow & interactions',
        'generate': `Generating with \`${config.GEN_MODEL}\``,
        'validate': 'Static checks + browser smoke test',
        'test-fix': '5 categories × comprehensive browser testing',
        'visual-review': 'Screenshots + UI/UX analysis',
        'final-review': 'Spec compliance check',
        'rejection-fix': 'Fixing rejection issues',
      };
      if (nextHints[baseStep]) bodyText += `\n${nextHints[baseStep]}`;

      const blocks = [divider(), mrkdwn(bodyText)];
      await coreSlack.postThreadUpdate(threadTs, channelId, bodyText, { blocks });
      return;
    }

    // ── Step done ────────────────────────────────────────────────────
    if (event.status !== 'done') return;

    const elapsed = event.elapsed ? `+${event.elapsed}s` : '';
    let headerText = `${meta.icon} *Step ${meta.num} — ${meta.name}*`;
    if (event.attempt) headerText += ` (#${event.attempt})`;
    if (elapsed) headerText += ` · ${elapsed}`;
    if (event.turns) headerText += ` · ${event.turns} turns, ${event.toolUses || 0} tools`;

    const blocks = [divider()];

    // ──────────────────────────────────────────────────────────────────
    // SPEC VALIDATION
    // ──────────────────────────────────────────────────────────────────
    if (event.step === 'spec-validation') {
      if (event.valid) {
        if (event.warnings && event.warnings.length > 0) {
          const warningList = event.warnings.map((w) => `• ${w}`).join('\n');
          blocks.push(mrkdwn(`${headerText}\n⚠️ *Spec warnings (${event.warnings.length})*\n${warningList}`));
        } else {
          blocks.push(mrkdwn(`${headerText}\n✅ Spec structure OK`));
        }
        blocks.push(nextStep('Pre-Generation Analysis'));
      } else {
        const errorList = (event.errors || []).map((e) => `• ${e}`).join('\n');
        blocks.push(mrkdwn(`${headerText}\n❌ *Spec validation FAILED*\n${errorList}`));
      }
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // PRE-GENERATION ANALYSIS
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'pre-generation') {
      if (event.chars) headerText += ` · ${event.chars} chars`;
      let bodyText = headerText;
      if (event.preGenSections && event.preGenSections.length > 0) {
        bodyText += '\n';
        for (const sec of event.preGenSections) {
          bodyText += `\n• <${sec.url}|${sec.name}>`;
        }
      }
      if (event.status === 'failed') {
        bodyText += `\n⚠️ Skipped — proceeding without pre-generation`;
      }
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Generate HTML'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // GENERATE HTML
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'generate') {
      if (event.htmlSize) headerText += ` · ${(event.htmlSize / 1024).toFixed(1)}KB`;
      let bodyText = headerText;
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Validate & smoke check'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // VALIDATE & SMOKE CHECK
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'validate') {
      let bodyText = headerText;
      if (event.summary) bodyText += `\n${event.summary.slice(0, 300)}`;
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Test & fix (5 categories)'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // TEST & FIX — with per-category results (V1-style)
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'test-fix') {
      let bodyText = headerText;

      // Per-category results table (key V1 feature)
      if (event.categoryResults && Object.keys(event.categoryResults).length > 0) {
        const catLines = [];
        const CATS = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
        for (const cat of CATS) {
          const res = event.categoryResults[cat];
          if (!res) continue;
          const p = res.passed || 0;
          const t = res.total || 0;
          const emoji = p === t ? '✅' : p === 0 ? '❌' : '⚠️';
          catLines.push(`${emoji} *${cat}:* ${p}/${t}`);
        }
        if (catLines.length > 0) {
          bodyText += `\n\n*Test results:*\n${catLines.join('\n')}`;
        }

        // Total
        if (event.totalPassed != null && event.totalTests != null) {
          const allPass = event.totalPassed === event.totalTests;
          bodyText += `\n\n${allPass ? '✅' : '⚠️'} *Total: ${event.totalPassed}/${event.totalTests} passed*`;
        }
      }

      // Issues found/fixed
      if (event.issuesFound > 0) {
        bodyText += `\n🐛 ${event.issuesFound} issue(s) found, ${event.issuesFixed || 0} fixed`;
        if (event.issueDescriptions && event.issueDescriptions.length > 0) {
          const MAX_DESC = 5;
          for (const desc of event.issueDescriptions.slice(0, MAX_DESC)) {
            bodyText += `\n  • ${desc.slice(0, 200)}`;
          }
          if (event.issueDescriptions.length > MAX_DESC) {
            bodyText += `\n  _…+${event.issueDescriptions.length - MAX_DESC} more_`;
          }
        }
      }

      if (event.testReportUrl) bodyText += `\n<${event.testReportUrl}|📋 Full Test Report>`;
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Visual review'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // VISUAL REVIEW
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'visual-review') {
      let bodyText = headerText;
      if (event.verdict) {
        const v = event.verdict;
        const vIcon = v.verdict === 'APPROVED' ? '✅' : v.issues?.length > 0 ? '🔸' : '✅';
        bodyText += `\n${vIcon} *${v.verdict}*`;
        if (v.issues && v.issues.length > 0) {
          for (const iss of v.issues.slice(0, 5)) {
            const sev = iss.severity === 'critical' ? '🔴' : '⚠️';
            bodyText += `\n${sev} ${iss.description.slice(0, 200)}`;
          }
          if (v.issues.length > 5) bodyText += `\n_…+${v.issues.length - 5} more_`;
        } else {
          bodyText += '\nNo critical UI/UX issues found ✓';
        }
      }
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Final spec compliance review'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // FINAL REVIEW
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'final-review') {
      let bodyText = headerText;
      if (event.verdict) {
        const v = event.verdict;
        const vIcon = v.verdict === 'APPROVED' ? '✅' : '🔸';
        bodyText += `\n${vIcon} *Review: ${v.verdict}*`;
        if (v.score != null) bodyText += ` · Score: ${v.score}%`;
        if (v.issues && v.issues.length > 0) {
          for (const iss of v.issues.slice(0, 3)) {
            const sev = iss.severity === 'critical' ? '🔴' : '⚠️';
            bodyText += `\n${sev} ${iss.description.slice(0, 200)}`;
          }
          if (v.issues.length > 3) bodyText += `\n_…+${v.issues.length - 3} more_`;
        }
      }
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));

      if (event.verdict?.verdict === 'APPROVED') {
        blocks.push(nextStep('Build complete — publishing'));
      } else {
        blocks.push(nextStep('Rejection fix'));
      }
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // REJECTION FIX
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'rejection-fix') {
      let bodyText = headerText;
      if (event.issuesFound > 0) {
        bodyText += `\n🐛 ${event.issuesFound} issue(s) addressed`;
      }
      if (event.summary) bodyText += `\n${event.summary.slice(0, 300)}`;
      if (event.error) bodyText += `\n❌ Error: \`${event.error.slice(0, 200)}\``;
      if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Re-review'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // CONTENT GENERATION (inputSchema + content sets)
    // ──────────────────────────────────────────────────────────────────
    if (baseStep === 'content-gen') {
      let bodyText = headerText;
      if (event.inputSchemaProps != null) {
        bodyText += `\n📐 inputSchema: ${event.inputSchemaProps} properties`;
      }
      if (event.contentSetsCount != null) {
        bodyText += `\n📚 ${event.contentSetsCount} content set(s) generated`;
      }
      if (event.error) bodyText += `\n⚠️ ${event.error.slice(0, 200)}`;
      if (event.summary) bodyText += `\n${event.summary.slice(0, 300)}`;
      blocks.push(mrkdwn(bodyText));
      blocks.push(nextStep('Publishing to Core API'));
      await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // GENERIC FALLBACK (targeted fix, unknown steps)
    // ──────────────────────────────────────────────────────────────────
    let bodyText = headerText;
    if (event.summary) bodyText += `\n${event.summary.slice(0, 300)}`;
    if (event.error) bodyText += `\n❌ Error: \`${event.error.slice(0, 300)}\``;
    if (event.gcpUrl) bodyText += `\n<${event.gcpUrl}|🎮 View HTML>`;
    blocks.push(mrkdwn(bodyText));
    await coreSlack.postThreadUpdate(threadTs, channelId, headerText, { blocks });

  } catch (err) {
    console.warn(`[slack-v2] Step update error: ${err.message}`);
  }
}

// ─── Parent message management ──────────────────────────────────────────────

/**
 * Update the parent thread message with current status.
 */
async function updateParentMessage(threadTs, channelId, gameId, report, opts = {}) {
  if (!coreSlack || !threadTs) return;

  try {
    await coreSlack.updateThreadOpener(threadTs, channelId, gameId, {
      status: report.status,
      buildId: opts.buildId,
      iterations: report.totalTurns || 0,
      llm_calls: report.totalToolUses || 0,
      publish: report.publish,
    }, {
      requestedBy: opts.requestedBy,
      startedAt: opts.startedAt,
      currentStep: opts.currentStep || report.status,
      gameTitle: gameId,
    });
  } catch (err) {
    console.warn(`[slack-v2] Parent update error: ${err.message}`);
  }
}

// ─── Final build result ─────────────────────────────────────────────────────

/**
 * Post final build result to the thread (V1-style Block Kit).
 */
async function postBuildResult(threadTs, channelId, gameId, report) {
  if (!coreSlack || !threadTs) return;

  try {
    const statusEmoji = report.status === 'APPROVED' ? '✅' :
      report.status === 'REJECTED' ? '🔸' : '❌';

    // ── Summary stats fields ─────────────────────────────────────────
    const fields = [
      { type: 'mrkdwn', text: `*Status:* ${statusEmoji} ${report.status}` },
      { type: 'mrkdwn', text: `*Turns:* ${report.totalTurns || 0}` },
      { type: 'mrkdwn', text: `*Tool uses:* ${report.totalToolUses || 0}` },
      { type: 'mrkdwn', text: `*Time:* ${report.totalTimeS || 0}s` },
      { type: 'mrkdwn', text: `*Cost:* $${(report.totalCost || 0).toFixed(4)}` },
    ];
    if (report.finalHtmlSize) {
      fields.push({ type: 'mrkdwn', text: `*HTML:* ${(report.finalHtmlSize / 1024).toFixed(1)}KB` });
    }
    if (report.gcpUrl) {
      fields.push({ type: 'mrkdwn', text: `*Preview:* <${report.gcpUrl}|🎮 Open>` });
    }

    const blocks = [
      { type: 'section', fields },
    ];

    // ── Per-category test results (V1-style) ─────────────────────────
    if (report.categoryResults && Object.keys(report.categoryResults).length > 0) {
      const catLines = [];
      const CATS = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];
      for (const cat of CATS) {
        const res = report.categoryResults[cat];
        if (!res) continue;
        const p = res.passed || 0;
        const t = res.total || 0;
        const emoji = p === t ? '✅' : p === 0 ? '❌' : '⚠️';
        catLines.push(`${emoji} *${cat}:* ${p}/${t}`);
      }
      if (catLines.length > 0) {
        blocks.push(mrkdwn(`*Test results:*\n${catLines.join('\n')}`));
      }
    }

    // ── Step breakdown ───────────────────────────────────────────────
    if (report.stepResults && report.stepResults.length > 0) {
      const stepLines = report.stepResults.map((s) => {
        const m = _getStepMeta(s.step);
        return `${m.icon} ${m.name}: ${s.turns} turns, ${s.toolUses} tools, ${s.elapsed}s`;
      });
      blocks.push(mrkdwn(`*Step Breakdown:*\n${stepLines.join('\n')}`));
    }

    // ── Visual review issues ─────────────────────────────────────────
    if (report.visualVerdict && report.visualVerdict.issues && report.visualVerdict.issues.length > 0) {
      const criticals = report.visualVerdict.issues.filter((i) => i.severity === 'critical');
      const warnings = report.visualVerdict.issues.filter((i) => i.severity !== 'critical');
      let vizText = '*Visual Review Issues:*\n';
      if (criticals.length > 0) {
        vizText += `🔴 *Critical (${criticals.length}):*\n`;
        vizText += criticals.slice(0, 3).map((i) => `  • ${i.description.slice(0, 200)}`).join('\n') + '\n';
      }
      if (warnings.length > 0) {
        vizText += `⚠️ *Warnings (${warnings.length}):*\n`;
        vizText += warnings.slice(0, 3).map((i) => `  • ${i.description.slice(0, 200)}`).join('\n');
      }
      blocks.push(mrkdwn(vizText));
    }

    // ── Final verdict ────────────────────────────────────────────────
    if (report.finalVerdict) {
      let verdictText = '';
      if (report.finalVerdict.score != null) {
        verdictText += `*Spec Compliance:* ${report.finalVerdict.score}%\n`;
      }
      if (report.rejectionReasons && report.rejectionReasons.length > 0) {
        verdictText += `*Rejection Reasons:*\n`;
        verdictText += report.rejectionReasons.slice(0, 5).map((r) => `• ${r.slice(0, 300)}`).join('\n');
      }
      if (verdictText) blocks.push(mrkdwn(verdictText));
    }

    // ── Errors ───────────────────────────────────────────────────────
    if (report.errors && report.errors.length > 0) {
      blocks.push(mrkdwn(`*Errors:*\n${report.errors.slice(0, 3).map((e) => `• ${e.slice(0, 300)}`).join('\n')}`));
    }

    // ── Publish links (V1-style) ─────────────────────────────────────
    if (report.status === 'APPROVED' && report.publish) {
      const linkLines = [];
      if (report.publish.gameLink) {
        linkLines.push(`*🎮 Play:* <${report.publish.gameLink}|Open Game>`);
      }
      if (Array.isArray(report.publish.contentSets) && report.publish.contentSets.length > 0) {
        const csLinks = report.publish.contentSets.map((cs) => {
          const url = `https://learn.mathai.ai/game/${report.publish.gameId}/${cs.id}`;
          const label = cs.name || cs.difficulty;
          const validIcon = cs.valid === false ? ' ⚠️' : '';
          return `<${url}|${label}>${validIcon}`;
        });
        linkLines.push(`*Content Sets (${report.publish.contentSets.length}):*\n${csLinks.join('\n')}`);
      }
      if (linkLines.length > 0) {
        blocks.push(mrkdwn(linkLines.join('\n')));
      }
      blocks.push(contextBlock('💬 Reply to this thread with feedback to trigger a targeted fix'));
    }

    // ── Token usage ──────────────────────────────────────────────────
    if (report.usage) {
      blocks.push(contextBlock(`Tokens: ${report.usage.input || 0} in / ${report.usage.output || 0} out / ${report.usage.cacheRead || 0} cache`));
    }

    const fallbackText = `${statusEmoji} ${gameId} — ${report.status}`;
    await coreSlack.postThreadUpdate(threadTs, channelId, fallbackText, { blocks });

    // Also update parent message to final state
    await updateParentMessage(threadTs, channelId, gameId, report, {
      buildId: report.buildId,
      currentStep: report.status === 'APPROVED' ? 'Complete ✅' :
        report.status === 'REJECTED' ? 'Complete (rejected) 🔸' : 'Failed ❌',
    });

  } catch (err) {
    console.error(`[slack-v2] Failed to post result: ${err.message}`);
    // Try webhook fallback
    if (coreSlack) {
      await coreSlack.notifyBuildResult(gameId, {
        status: report.status,
        iterations: report.totalTurns || 0,
        total_time_s: report.totalTimeS || 0,
        total_cost_usd: report.totalCost || 0,
        errors: report.errors || [],
        publish: report.publish,
      }).catch(() => {});
    }
  }
}

// ─── Publish notification ───────────────────────────────────────────────────

/**
 * Post publish step notification to the build thread.
 */
async function postPublishUpdate(threadTs, channelId, gameId, publishInfo) {
  if (!coreSlack || !threadTs || !publishInfo) return;

  try {
    const blocks = [divider()];
    const lines = [];
    lines.push(`📦 *Publish to Core API*`);

    // Schema source
    if (publishInfo.inputSchemaSource) {
      const srcLabel = { 'llm': '🤖 LLM-generated', 'file': '📄 From file', 'vm-inference': '⚙️ Inferred from fallbackContent', 'empty': '⚠️ Empty' };
      lines.push(`  Schema: ${srcLabel[publishInfo.inputSchemaSource] || publishInfo.inputSchemaSource} (${publishInfo.schemaProps || 0} properties)`);
    }

    // Game registration
    if (publishInfo.gameId) {
      lines.push(`  ✅ Game registered: \`${publishInfo.gameId}\``);
    }

    // Content sets
    if (publishInfo.contentSets && publishInfo.contentSets.length > 0) {
      lines.push(`  📚 *${publishInfo.contentSets.length} content set(s) created:*`);
      for (const cs of publishInfo.contentSets.slice(0, 5)) {
        const validIcon = cs.valid === false ? ' ⚠️' : '';
        lines.push(`    • ${cs.name} [${cs.difficulty}]${validIcon} — <https://learn.mathai.ai/game/${publishInfo.gameId}/${cs.id}|Play>`);
      }
      if (publishInfo.contentSets.length > 5) {
        lines.push(`    _…+${publishInfo.contentSets.length - 5} more_`);
      }
    } else {
      lines.push(`  ⚠️ No content sets created`);
    }

    // Game link
    if (publishInfo.gameLink) {
      lines.push(`  🕹️ *Game link:* <${publishInfo.gameLink}|Play Game>`);
    }

    blocks.push(mrkdwn(lines.join('\n')));
    await coreSlack.postThreadUpdate(threadTs, channelId, lines[0], { blocks });
  } catch (err) {
    console.warn(`[slack-v2] Publish update error: ${err.message}`);
  }
}

// ─── Learnings notification ─────────────────────────────────────────────────

/**
 * Post learnings extraction notification to the build thread.
 */
async function postLearningsUpdate(threadTs, channelId, learnings) {
  if (!coreSlack || !threadTs || !learnings || learnings.length === 0) return;

  try {
    const lines = [`📖 *Cross-game learnings extracted:*`];
    for (const l of learnings.slice(0, 4)) {
      lines.push(`  • ${l.slice(0, 200)}`);
    }
    const blocks = [divider(), mrkdwn(lines.join('\n'))];
    await coreSlack.postThreadUpdate(threadTs, channelId, lines[0], { blocks });
  } catch (err) {
    console.warn(`[slack-v2] Learnings update error: ${err.message}`);
  }
}

// ─── Targeted fix notification ──────────────────────────────────────────────

/**
 * Post targeted fix start notification.
 */
async function postTargetedFixStart(threadTs, channelId, buildId, feedback) {
  if (!coreSlack || !threadTs) return;

  try {
    const text = `🔧 Applying targeted fix (build #${buildId})...\n> ${(feedback || '').slice(0, 200)}`;
    const blocks = [divider(), mrkdwn(text)];
    await coreSlack.postThreadUpdate(threadTs, channelId, text, { blocks });
  } catch (err) {
    console.warn(`[slack-v2] Targeted fix notification error: ${err.message}`);
  }
}

module.exports = {
  createBuildThread,
  postStepUpdate,
  postTranscriptUpdate,
  updateParentMessage,
  postBuildResult,
  postPublishUpdate,
  postLearningsUpdate,
  postTargetedFixStart,
};

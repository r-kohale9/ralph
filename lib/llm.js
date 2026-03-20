'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// llm.js — Node.js LLM client for CLIProxyAPI
//
// STATUS: Currently used by contract/proxy tests; ralph.sh calls the proxy
// directly via curl. This module is the intended replacement for curl calls
// when E3 (API migration) is implemented.
//
// E3 migration plan: Replace ralph.sh curl calls with this module by
// having worker.js call callLlm() directly instead of spawning ralph.sh.
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8317';
const PROXY_KEY = process.env.PROXY_KEY || 'ralph-pipeline-key-change-this';
const LLM_TIMEOUT = parseInt(process.env.RALPH_LLM_TIMEOUT || '300', 10) * 1000;

// ─── Token usage accumulator ─────────────────────────────────────────────────
let _sessionTokens = { input: 0, output: 0, calls: 0 };

/**
 * Resets the in-process session token accumulator to zero (call at pipeline start).
 */
function resetTokens() {
  _sessionTokens = { input: 0, output: 0, calls: 0 };
}

/**
 * Returns a snapshot of accumulated token usage for the current session.
 * @returns {{input: number, output: number, calls: number}}
 */
function getTokenUsage() {
  return { ..._sessionTokens };
}

// Per-model concurrency limiting — prevents quota storms when multiple builds run in parallel
const MODEL_CONCURRENCY = parseInt(process.env.RALPH_MODEL_CONCURRENCY || '4', 10);
const modelActiveRequests = new Map();
const modelQueues = new Map();

async function withModelConcurrency(model, fn) {
  const active = modelActiveRequests.get(model) || 0;
  if (active >= MODEL_CONCURRENCY) {
    // Queue this request
    await new Promise((resolve) => {
      const queue = modelQueues.get(model) || [];
      queue.push(resolve);
      modelQueues.set(model, queue);
    });
  }
  modelActiveRequests.set(model, (modelActiveRequests.get(model) || 0) + 1);
  try {
    return await fn();
  } finally {
    const newActive = (modelActiveRequests.get(model) || 1) - 1;
    modelActiveRequests.set(model, newActive);
    const queue = modelQueues.get(model) || [];
    if (queue.length > 0) {
      const next = queue.shift();
      modelQueues.set(model, queue);
      next(); // unblock next waiter
    }
  }
}

/**
 * Provider-agnostic LLM call through CLIProxyAPI.
 * Handles both Claude format (.content[0].text) and OpenAI format (.choices[0].message.content).
 *
 * @param {string} stepName - Identifier for logging
 * @param {string} prompt - The prompt to send
 * @param {string} [model] - Model name (routed by proxy to correct provider)
 * @param {object} [options] - Additional options
 * @param {number} [options.maxTokens=16000] - Max output tokens
 * @param {number} [options.timeout] - Timeout in ms
 * @returns {Promise<string>} The LLM response text
 */
const MAX_RETRIES = parseInt(process.env.RALPH_LLM_MAX_RETRIES || '5', 10);

async function callLlm(stepName, prompt, model, options = {}) {
  const { maxTokens = 128000, timeout = LLM_TIMEOUT, _retryCount = 0 } = options;
  model = model || process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';

  const _llmStart = Date.now();
  console.log(`  [${stepName}] model=${model} ...`);

  return withModelConcurrency(model, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${PROXY_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PROXY_KEY,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        if (_retryCount >= MAX_RETRIES) {
          throw new Error(`Rate limited after ${MAX_RETRIES} retries for step ${stepName}`);
        }
        // Use Retry-After header if provided, otherwise exponential backoff
        const retryAfterHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
        const retryAfterSecs = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;
        const delay = !isNaN(retryAfterSecs) && retryAfterSecs > 0
          ? Math.min(retryAfterSecs * 1000, 300000)
          : Math.min(30000 * Math.pow(2, _retryCount), 300000);
        console.warn(`  [${stepName}] rate limited — retry ${_retryCount + 1}/${MAX_RETRIES} in ${delay / 1000}s${retryAfterHeader ? ` (Retry-After: ${retryAfterHeader})` : ''}`);
        await new Promise((r) => setTimeout(r, delay));
        return callLlm(stepName, prompt, model, { ...options, _retryCount: _retryCount + 1 });
      }

      if (!res.ok) {
        throw new Error(`Proxy returned HTTP ${res.status}: ${await res.text()}`);
      }

      const body = await res.json();

      // Extract token usage (supports both Claude and OpenAI field names)
      const usage = body?.usage || {};
      const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
      const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
      _sessionTokens.input += inputTokens;
      _sessionTokens.output += outputTokens;
      _sessionTokens.calls += 1;

      // Handle both Claude and OpenAI response formats
      const text = body.content?.[0]?.text || body.choices?.[0]?.message?.content || null;

      if (!text) {
        throw new Error('No text content in response');
      }

      console.log(`  ✓ [${stepName}] completed elapsed=${((Date.now() - _llmStart) / 1000).toFixed(1)}s`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  });
}

/**
 * Call Claude CLI (claude -p) with auto-loaded CLAUDE.md context.
 * Runs from a specified working directory so Claude Code picks up
 * the skill's CLAUDE.md and has access to reference files.
 *
 * @param {string} stepName - Identifier for logging
 * @param {string} prompt - The prompt to send
 * @param {object} [options] - Additional options
 * @param {string} [options.cwd] - Working directory (for CLAUDE.md context)
 * @param {string} [options.model] - Model to use (default: sonnet)
 * @param {number} [options.timeout] - Timeout in ms
 * @param {string[]} [options.allowedTools] - Tools to allow (default: none)
 * @param {string[]} [options.addDirs] - Additional directories to allow access to
 * @returns {Promise<string>} The Claude response text
 */
async function callClaude(stepName, prompt, options = {}) {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);

  const {
    cwd,
    model = 'sonnet',
    timeout = LLM_TIMEOUT,
    allowedTools = [],
    addDirs = [],
  } = options;

  const { spawn } = require('child_process');
  const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';

  const args = ['-p', '--output-format', 'text', '--model', model, '--no-session-persistence'];

  if (allowedTools.length > 0) {
    args.push('--allowedTools', ...allowedTools);
  }

  if (addDirs.length > 0) {
    for (const dir of addDirs) {
      args.push('--add-dir', dir);
    }
  }

  // Pass prompt via stdin to avoid CLI arg size limits
  console.log(`  [${stepName}] claude -p model=${model} cwd=${cwd || '.'} (stdin, ${prompt.length} chars) ...`);

  return new Promise((resolve, reject) => {
    const child = spawn(claudePath, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude -p timed out after ${timeout / 1000}s for step ${stepName}`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p exited with code ${code} for ${stepName}: ${stderr.slice(0, 500)}`));
        return;
      }
      if (!stdout || stdout.trim().length === 0) {
        reject(new Error(`Empty response from claude -p for ${stepName}`));
        return;
      }
      console.log(`  ✓ [${stepName}] completed (${stdout.length} chars)`);
      resolve(stdout);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`claude -p failed for ${stepName}: ${err.message}`));
    });

    // Write prompt to stdin and close
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

module.exports = { callLlm, callClaude, resetTokens, getTokenUsage };

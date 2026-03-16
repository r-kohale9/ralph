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

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8080';
const PROXY_KEY = process.env.PROXY_KEY || 'ralph-pipeline-key';
const LLM_TIMEOUT = parseInt(process.env.RALPH_LLM_TIMEOUT || '300', 10) * 1000;

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
  const { maxTokens = 16000, timeout = LLM_TIMEOUT, _retryCount = 0 } = options;
  model = model || process.env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';

  console.log(`  [${stepName}] model=${model} ...`);

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
      const delay = Math.min(30000 * Math.pow(2, _retryCount), 300000);
      console.warn(`  [${stepName}] rate limited — retry ${_retryCount + 1}/${MAX_RETRIES} in ${delay / 1000}s`);
      await new Promise(r => setTimeout(r, delay));
      return callLlm(stepName, prompt, model, { ...options, _retryCount: _retryCount + 1 });
    }

    if (!res.ok) {
      throw new Error(`Proxy returned HTTP ${res.status}: ${await res.text()}`);
    }

    const body = await res.json();

    // Handle both Claude and OpenAI response formats
    const text =
      body.content?.[0]?.text ||
      body.choices?.[0]?.message?.content ||
      null;

    if (!text) {
      throw new Error('No text content in response');
    }

    console.log(`  ✓ [${stepName}] completed`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callLlm };

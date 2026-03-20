'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// config.js — Centralised environment variable reads + startup validation
//
// All RALPH_* and related env vars used by the pipeline sub-modules are read
// here once at require-time, validated, and exported as a frozen object.
//
// Files that rely on per-test require-cache invalidation to change env vars
// (db.js, gcp.js, slack.js, llm.js) continue to read process.env directly so
// that existing test patterns keep working without modification.
// ─────────────────────────────────────────────────────────────────────────────

function loadConfig() {
  const env = process.env;
  const isProd = (env.NODE_ENV || 'development') === 'production';

  // ── Critical vars — throw in production if missing ────────────────────────
  if (isProd) {
    if (!env.GITHUB_WEBHOOK_SECRET) {
      throw new Error('Missing required env var: GITHUB_WEBHOOK_SECRET (required in production)');
    }
    if (!env.PROXY_URL) {
      throw new Error('Missing required env var: PROXY_URL (required in production)');
    }
    if (!env.PROXY_KEY) {
      throw new Error('Missing required env var: PROXY_KEY (required in production)');
    }
  }

  // ── Optional vars — warn in production if empty ───────────────────────────
  if (isProd) {
    if (!env.SLACK_BOT_TOKEN) {
      // eslint-disable-next-line no-console
      console.warn('[config] WARNING: SLACK_BOT_TOKEN is not set — Slack Web API threading disabled');
    }
    if (!env.RALPH_GCP_BUCKET) {
      // eslint-disable-next-line no-console
      console.warn('[config] WARNING: RALPH_GCP_BUCKET is not set — GCP uploads disabled');
    }
  }

  // ── Model selection ───────────────────────────────────────────────────────
  const GEN_MODEL = env.RALPH_GEN_MODEL || 'claude-opus-4-6';
  const FIX_MODEL = env.RALPH_FIX_MODEL || 'claude-sonnet-4-6';
  const TEST_MODEL = env.RALPH_TEST_MODEL || 'gemini-2.5-pro';

  return Object.freeze({
    // Node environment
    NODE_ENV: env.NODE_ENV || 'development',

    // ── Proxy / LLM credentials ─────────────────────────────────────────────
    PROXY_URL: env.PROXY_URL || 'http://localhost:8317',
    PROXY_KEY: env.PROXY_KEY || 'ralph-pipeline-key-change-this',

    // ── GitHub webhook ───────────────────────────────────────────────────────
    GITHUB_WEBHOOK_SECRET: env.GITHUB_WEBHOOK_SECRET || '',

    // ── Redis / queue ────────────────────────────────────────────────────────
    REDIS_URL: env.REDIS_URL || 'redis://localhost:6379',
    PORT: parseInt(env.PORT || '3000', 10),

    // ── Pipeline model selection ─────────────────────────────────────────────
    RALPH_GEN_MODEL: GEN_MODEL,
    RALPH_TEST_MODEL: TEST_MODEL,
    RALPH_TEST_CASES_MODEL: env.RALPH_TEST_CASES_MODEL || TEST_MODEL,
    RALPH_FIX_MODEL: FIX_MODEL,
    RALPH_REVIEW_MODEL: env.RALPH_REVIEW_MODEL || 'gemini-2.5-pro',
    RALPH_LEARNINGS_MODEL: env.RALPH_LEARNINGS_MODEL || FIX_MODEL,
    RALPH_FALLBACK_MODEL: env.RALPH_FALLBACK_MODEL || 'gpt-4.1',
    RALPH_TRIAGE_MODEL: env.RALPH_TRIAGE_MODEL || FIX_MODEL,
    RALPH_GLOBAL_FIX_MODEL: env.RALPH_GLOBAL_FIX_MODEL || GEN_MODEL,

    // ── Pipeline iteration / timeout ─────────────────────────────────────────
    RALPH_MAX_ITERATIONS: parseInt(env.RALPH_MAX_ITERATIONS || '5', 10),
    RALPH_MAX_GLOBAL_FIX_ITERATIONS: parseInt(env.RALPH_MAX_GLOBAL_FIX_ITERATIONS || '2', 10),
    RALPH_CATEGORY_BATCH_SIZE: parseInt(env.RALPH_CATEGORY_BATCH_SIZE || '1', 10),
    RALPH_LLM_TIMEOUT: parseInt(env.RALPH_LLM_TIMEOUT || '300', 10) * 1000,
    RALPH_TEST_TIMEOUT: parseInt(env.RALPH_TEST_TIMEOUT || '120', 10) * 1000,

    // ── Claude CLI settings ───────────────────────────────────────────────────
    RALPH_CLAUDE_MODEL: env.RALPH_CLAUDE_MODEL || 'sonnet',
    RALPH_CLI_LLM_TIMEOUT: parseInt(env.RALPH_LLM_TIMEOUT || '600', 10) * 1000,

    // ── Pipeline feature flags ────────────────────────────────────────────────
    RALPH_USE_CLAUDE_CLI: env.RALPH_USE_CLAUDE_CLI === '1',
    RALPH_USE_NODE_PIPELINE: env.RALPH_USE_NODE_PIPELINE === '1',
    RALPH_SKIP_DOM_SNAPSHOT: env.RALPH_SKIP_DOM_SNAPSHOT === '1',
    RALPH_ENABLE_CACHE: env.RALPH_ENABLE_CACHE === '1',
    RALPH_DEPLOY_ENABLED: env.RALPH_DEPLOY_ENABLED === '1',
    RALPH_AUTO_RETRY: env.RALPH_AUTO_RETRY === '1',

    // ── Paths / directories ───────────────────────────────────────────────────
    RALPH_REPO_DIR: env.RALPH_REPO_DIR || '.',
    RALPH_DB_PATH: env.RALPH_DB_PATH || '',
    RALPH_WAREHOUSE_DIR: env.RALPH_WAREHOUSE_DIR || '',
    RALPH_DEPLOY_DIR: env.RALPH_DEPLOY_DIR || '',

    // ── LLM concurrency / retries ─────────────────────────────────────────────
    RALPH_MODEL_CONCURRENCY: parseInt(env.RALPH_MODEL_CONCURRENCY || '4', 10),
    RALPH_LLM_MAX_RETRIES: parseInt(env.RALPH_LLM_MAX_RETRIES || '5', 10),

    // ── Worker settings ───────────────────────────────────────────────────────
    RALPH_CONCURRENCY: parseInt(env.RALPH_CONCURRENCY || '2', 10),
    RALPH_BULK_THRESHOLD: parseInt(env.RALPH_BULK_THRESHOLD || '5', 10),
    RALPH_RATE_MAX: parseInt(env.RALPH_RATE_MAX || '10', 10),
    RALPH_RATE_DURATION: parseInt(env.RALPH_RATE_DURATION || '3600000', 10),
    RALPH_CPU_GATE: parseFloat(env.RALPH_CPU_GATE || '85'),
    RALPH_RAM_GATE_MB: parseFloat(env.RALPH_RAM_GATE_MB || '512'),
    RALPH_GITHUB_REPO: env.RALPH_GITHUB_REPO || '',
    RALPH_SLACK_USER_ID: env.RALPH_SLACK_USER_ID || null,

    // ── Slack ─────────────────────────────────────────────────────────────────
    SLACK_WEBHOOK_URL: env.SLACK_WEBHOOK_URL || '',
    SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN || '',
    SLACK_CHANNEL_ID: env.SLACK_CHANNEL_ID || '',
    SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET || '',

    // ── GCP ───────────────────────────────────────────────────────────────────
    RALPH_GCP_BUCKET: env.RALPH_GCP_BUCKET || '',
    RALPH_GCP_PROJECT: env.RALPH_GCP_PROJECT || '',
    GOOGLE_CLOUD_PROJECT: env.GOOGLE_CLOUD_PROJECT || '',

    // ── Logging / monitoring ──────────────────────────────────────────────────
    LOG_LEVEL: env.LOG_LEVEL || 'info',
    RALPH_LOG_NAME: env.RALPH_LOG_NAME || 'ralph-pipeline',
    RALPH_VERSION: env.RALPH_VERSION || '1.0.0',
    SENTRY_DSN: env.SENTRY_DSN || '',
    CLAUDE_CLI_PATH: env.CLAUDE_CLI_PATH || 'claude',
  });
}

module.exports = loadConfig();

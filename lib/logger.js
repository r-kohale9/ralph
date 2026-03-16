'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// logger.js — Structured logging with Google Cloud Logging integration
//
// When GOOGLE_CLOUD_PROJECT is set, logs are sent to Google Cloud Logging.
// Otherwise, logs are written to stdout in structured JSON format (which
// Cloud Logging auto-ingests when running on GCE/GKE/Cloud Run).
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOG_NAME = process.env.RALPH_LOG_NAME || 'ralph-pipeline';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Severity levels (compatible with Google Cloud Logging)
const LEVELS = {
  debug: 100,
  info: 200,
  warning: 400,
  error: 500,
  critical: 600,
};

const CURRENT_LEVEL = LEVELS[LOG_LEVEL] || LEVELS.info;

let cloudLogger = null;

// Initialize Google Cloud Logging client if configured
async function initCloudLogging() {
  if (!GOOGLE_CLOUD_PROJECT) return;

  try {
    const { Logging } = require('@google-cloud/logging');
    const logging = new Logging({ projectId: GOOGLE_CLOUD_PROJECT });
    cloudLogger = logging.log(LOG_NAME);
    console.log(`[logger] Google Cloud Logging initialized (project: ${GOOGLE_CLOUD_PROJECT})`);
  } catch (err) {
    console.warn(`[logger] Could not initialize Google Cloud Logging: ${err.message}`);
    console.warn('[logger] Falling back to structured stdout logging');
  }
}

// Format a structured log entry
function formatEntry(severity, message, metadata = {}) {
  return {
    severity,
    message,
    timestamp: new Date().toISOString(),
    'logging.googleapis.com/labels': {
      service: 'ralph-pipeline',
      ...metadata.labels,
    },
    ...metadata,
  };
}

// Write a log entry
async function writeLog(severity, message, metadata = {}) {
  const level = LEVELS[severity] || LEVELS.info;
  if (level < CURRENT_LEVEL) return;

  const entry = formatEntry(severity.toUpperCase(), message, metadata);

  // Send to Google Cloud Logging if available
  if (cloudLogger) {
    try {
      const cloudEntry = cloudLogger.entry(
        {
          severity: severity.toUpperCase(),
          labels: entry['logging.googleapis.com/labels'],
          resource: { type: 'global' },
        },
        { message, ...metadata }
      );
      await cloudLogger.write(cloudEntry);
    } catch (err) {
      // Fall back to stdout on Cloud Logging failure
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  } else {
    // Structured JSON to stdout — auto-ingested by Cloud Logging on GCP
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

function debug(message, meta) { return writeLog('debug', message, meta); }
function info(message, meta) { return writeLog('info', message, meta); }
function warn(message, meta) { return writeLog('warning', message, meta); }
function error(message, meta) { return writeLog('error', message, meta); }
function critical(message, meta) { return writeLog('critical', message, meta); }

// Build-specific structured log
function buildLog(gameId, buildId, severity, message, extra = {}) {
  return writeLog(severity, message, {
    gameId,
    buildId,
    labels: { game_id: gameId, build_id: String(buildId) },
    ...extra,
  });
}

module.exports = {
  initCloudLogging,
  debug,
  info,
  warn,
  error,
  critical,
  buildLog,
};

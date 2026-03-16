'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// sentry.js — Sentry error monitoring integration
//
// Set SENTRY_DSN to enable. Captures unhandled exceptions, unhandled
// rejections, and provides manual error/transaction reporting for the pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'production';
const RELEASE = process.env.RALPH_VERSION || '1.0.0';

let Sentry = null;

function init(serviceName) {
  if (!SENTRY_DSN) {
    console.log(`[sentry] No SENTRY_DSN configured — error monitoring disabled`);
    return;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      release: `ralph-pipeline@${RELEASE}`,
      serverName: serviceName || 'ralph',
      tracesSampleRate: 1.0,
      profilesSampleRate: 0.1,
      integrations: [
        Sentry.httpIntegration(),
      ],
      beforeSend(event) {
        // Scrub sensitive data
        if (event.request?.headers) {
          delete event.request.headers['x-api-key'];
          delete event.request.headers['authorization'];
        }
        return event;
      },
    });

    console.log(`[sentry] Initialized (env: ${ENVIRONMENT}, release: ralph-pipeline@${RELEASE})`);
  } catch (err) {
    console.warn(`[sentry] Could not initialize: ${err.message}`);
    Sentry = null;
  }
}

function captureException(err, context = {}) {
  if (!Sentry) {
    console.error(`[sentry-stub] ${err.message}`, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.gameId) scope.setTag('game_id', context.gameId);
    if (context.buildId) scope.setTag('build_id', String(context.buildId));
    if (context.step) scope.setTag('pipeline_step', context.step);
    if (context.model) scope.setTag('model', context.model);
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(err);
  });
}

function captureMessage(message, level = 'info', context = {}) {
  if (!Sentry) {
    console.log(`[sentry-stub] [${level}] ${message}`, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.gameId) scope.setTag('game_id', context.gameId);
    if (context.buildId) scope.setTag('build_id', String(context.buildId));
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureMessage(message, level);
  });
}

// Start a Sentry transaction for a pipeline build
function startBuildTransaction(gameId, buildId) {
  if (!Sentry) {
    return {
      startChild: () => ({ finish: () => {} }),
      setStatus: () => {},
      setData: () => {},
      finish: () => {},
    };
  }

  const span = Sentry.startInactiveSpan({
    name: `ralph.build.${gameId}`,
    op: 'pipeline.build',
    attributes: {
      game_id: gameId,
      build_id: String(buildId),
    },
  });

  // Normalize v8 Span to match v7 Transaction interface used by worker.js
  return {
    setStatus(status) {
      if (span.setStatus) {
        span.setStatus(status === 'ok' ? { code: 1 } : { code: 2, message: status });
      } else if (span.setAttribute) {
        span.setAttribute('ralph.status', status);
      }
    },
    setData(key, value) {
      if (span.setAttribute) span.setAttribute(key, value);
    },
    startChild(opts) {
      return Sentry.startInactiveSpan({ ...opts, parentSpan: span });
    },
    finish() {
      if (span.end) span.end();
      else if (span.finish) span.finish();
    },
  };
}

async function flush(timeout = 5000) {
  if (Sentry) {
    await Sentry.flush(timeout);
  }
}

// Express error handler middleware
function expressErrorHandler() {
  if (Sentry) {
    return Sentry.expressErrorHandler();
  }
  // Fallback error handler
  return (err, _req, res, _next) => {
    console.error('[error-handler]', err);
    res.status(500).json({ error: 'Internal server error' });
  };
}

module.exports = {
  init,
  captureException,
  captureMessage,
  startBuildTransaction,
  flush,
  expressErrorHandler,
};

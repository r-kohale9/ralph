'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// gcp.js — GCP Cloud Storage upload module (optional dependency)
//
// Uses @google-cloud/storage if available, otherwise gracefully skips uploads.
// Follows the same optional dependency pattern as sentry.js and logger.js.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');

let Storage;
try {
  ({ Storage } = require('@google-cloud/storage'));
} catch {
  // @google-cloud/storage not installed — uploads will be skipped
}

const BUCKET_NAME = process.env.RALPH_GCP_BUCKET || '';
const PROJECT_ID = process.env.RALPH_GCP_PROJECT || '';

let storage;
let bucket;
let initialized = false;

function init() {
  if (initialized) return !!bucket;

  initialized = true;

  if (!Storage) {
    console.log('[gcp] @google-cloud/storage not installed — uploads disabled');
    return false;
  }

  if (!BUCKET_NAME) {
    console.log('[gcp] RALPH_GCP_BUCKET not configured — uploads disabled');
    return false;
  }

  try {
    const opts = {};
    if (PROJECT_ID) opts.projectId = PROJECT_ID;
    storage = new Storage(opts);
    bucket = storage.bucket(BUCKET_NAME);
    console.log(`[gcp] Initialized — bucket: ${BUCKET_NAME}`);
    return true;
  } catch (err) {
    console.error(`[gcp] Failed to initialize: ${err.message}`);
    return false;
  }
}

async function uploadGameArtifact(gameId, buildId, htmlPath) {
  if (!bucket) {
    console.log('[gcp] Skipping upload — not initialized');
    return null;
  }

  if (!fs.existsSync(htmlPath)) {
    console.warn(`[gcp] File not found: ${htmlPath}`);
    return null;
  }

  const destination = `games/${gameId}/builds/${buildId}/index.html`;

  try {
    await bucket.upload(htmlPath, {
      destination,
      metadata: {
        contentType: 'text/html',
        metadata: {
          gameId,
          buildId: String(buildId),
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const url = getArtifactUrl(gameId, buildId);
    console.log(`[gcp] Uploaded ${destination} → ${url}`);
    return url;
  } catch (err) {
    console.error(`[gcp] Upload failed: ${err.message}`);
    return null;
  }
}

function getArtifactUrl(gameId, buildId) {
  return `https://storage.googleapis.com/${BUCKET_NAME}/games/${gameId}/builds/${buildId}/index.html`;
}

function isEnabled() {
  return !!bucket;
}

module.exports = {
  init,
  uploadGameArtifact,
  getArtifactUrl,
  isEnabled,
};

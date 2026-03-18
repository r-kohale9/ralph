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

async function uploadGameArtifact(gameId, buildId, htmlPath, { suffix } = {}) {
  if (!bucket) {
    console.log('[gcp] Skipping upload — not initialized');
    return null;
  }

  if (!fs.existsSync(htmlPath)) {
    console.warn(`[gcp] File not found: ${htmlPath}`);
    return null;
  }

  const filename = suffix ? `index-${suffix}.html` : 'index.html';
  const destination = `games/${gameId}/builds/${buildId}/${filename}`;

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

    const url = getArtifactUrl(gameId, buildId, suffix);
    console.log(`[gcp] Uploaded ${destination} → ${url}`);
    return url;
  } catch (err) {
    console.error(`[gcp] Upload failed: ${err.message}`);
    return null;
  }
}

function getArtifactUrl(gameId, buildId, suffix) {
  const filename = suffix ? `index-${suffix}.html` : 'index.html';
  return `https://storage.googleapis.com/${BUCKET_NAME}/games/${gameId}/builds/${buildId}/${filename}`;
}

async function uploadContent(content, destination, { contentType = 'text/plain' } = {}) {
  if (!bucket) return null;

  try {
    const file = bucket.file(destination);
    await file.save(content, {
      metadata: {
        contentType,
        cacheControl: 'no-cache',
      },
    });
    const url = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    console.log(`[gcp] Uploaded ${destination} → ${url}`);
    return url;
  } catch (err) {
    console.error(`[gcp] Content upload failed: ${err.message}`);
    return null;
  }
}

function isEnabled() {
  return !!bucket;
}

module.exports = {
  init,
  uploadGameArtifact,
  uploadContent,
  getArtifactUrl,
  isEnabled,
};

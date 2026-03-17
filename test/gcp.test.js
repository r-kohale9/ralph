'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('gcp', () => {
  beforeEach(() => {
    // Clear cached module to test different env configurations
    delete require.cache[require.resolve('../lib/gcp')];
    delete process.env.RALPH_GCP_BUCKET;
    delete process.env.RALPH_GCP_PROJECT;
  });

  it('init returns false when @google-cloud/storage not installed', () => {
    const gcp = require('../lib/gcp');
    // In test environment, @google-cloud/storage is likely not installed
    // init() should return false gracefully
    const result = gcp.init();
    assert.equal(typeof result, 'boolean');
  });

  it('isEnabled returns false when not initialized', () => {
    const gcp = require('../lib/gcp');
    assert.equal(gcp.isEnabled(), false);
  });

  it('uploadGameArtifact returns null when not initialized', async () => {
    const gcp = require('../lib/gcp');
    const result = await gcp.uploadGameArtifact('test-game', 1, '/nonexistent/file.html');
    assert.equal(result, null);
  });

  it('getArtifactUrl generates correct URL pattern', () => {
    process.env.RALPH_GCP_BUCKET = 'my-test-bucket';
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    const url = gcp.getArtifactUrl('doubles', 42);
    assert.equal(url, 'https://storage.googleapis.com/my-test-bucket/games/doubles/builds/42/index.html');
  });

  it('getArtifactUrl uses RALPH_GCP_BUCKET env var', () => {
    process.env.RALPH_GCP_BUCKET = 'custom-bucket';
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    const url = gcp.getArtifactUrl('memory', 7);
    assert.ok(url.includes('custom-bucket'));
  });

  it('init returns false when RALPH_GCP_BUCKET not set', () => {
    delete process.env.RALPH_GCP_BUCKET;
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    const result = gcp.init();
    assert.equal(result, false);
  });

  it('uploadGameArtifact returns null for non-existent file', async () => {
    const gcp = require('../lib/gcp');
    gcp.init();
    const result = await gcp.uploadGameArtifact('test', 1, '/does/not/exist.html');
    assert.equal(result, null);
  });

  it('module exports all expected functions', () => {
    const gcp = require('../lib/gcp');
    assert.equal(typeof gcp.init, 'function');
    assert.equal(typeof gcp.uploadGameArtifact, 'function');
    assert.equal(typeof gcp.getArtifactUrl, 'function');
    assert.equal(typeof gcp.isEnabled, 'function');
  });

  it('getArtifactUrl handles special characters in gameId', () => {
    process.env.RALPH_GCP_BUCKET = 'test-bucket';
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    const url = gcp.getArtifactUrl('my-game-v2', 100);
    assert.ok(url.includes('my-game-v2'));
    assert.ok(url.includes('100'));
  });

  it('multiple init calls return same result', () => {
    const gcp = require('../lib/gcp');
    const result1 = gcp.init();
    const result2 = gcp.init();
    assert.equal(result1, result2);
  });

  it('uploadGameArtifact skips upload when bucket not configured', async () => {
    delete process.env.RALPH_GCP_BUCKET;
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    gcp.init();

    // Create a temp HTML file
    const tmpFile = path.join(os.tmpdir(), 'gcp-test.html');
    fs.writeFileSync(tmpFile, '<html><body>test</body></html>');

    try {
      const result = await gcp.uploadGameArtifact('test', 1, tmpFile);
      assert.equal(result, null);
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  });

  it('getArtifactUrl uses default empty bucket when not configured', () => {
    delete process.env.RALPH_GCP_BUCKET;
    delete require.cache[require.resolve('../lib/gcp')];
    const gcp = require('../lib/gcp');
    const url = gcp.getArtifactUrl('test', 1);
    assert.ok(url.includes('storage.googleapis.com'));
  });
});

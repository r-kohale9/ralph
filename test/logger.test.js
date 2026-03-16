'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('logger', () => {
  let logger;

  beforeEach(() => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete require.cache[require.resolve('../lib/logger')];
    logger = require('../lib/logger');
  });

  it('exports all severity level functions', () => {
    assert.equal(typeof logger.debug, 'function');
    assert.equal(typeof logger.info, 'function');
    assert.equal(typeof logger.warn, 'function');
    assert.equal(typeof logger.error, 'function');
    assert.equal(typeof logger.critical, 'function');
  });

  it('exports buildLog function', () => {
    assert.equal(typeof logger.buildLog, 'function');
  });

  it('exports initCloudLogging function', () => {
    assert.equal(typeof logger.initCloudLogging, 'function');
  });

  it('initCloudLogging returns without error when no GOOGLE_CLOUD_PROJECT', async () => {
    await logger.initCloudLogging();
    // Should not throw
  });

  it('info writes structured JSON to stdout', async () => {
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output += chunk; return true; };

    try {
      await logger.info('test message', { gameId: 'doubles' });
      const parsed = JSON.parse(output.trim());
      assert.equal(parsed.message, 'test message');
      assert.equal(parsed.severity, 'INFO');
      assert.ok(parsed.timestamp);
      assert.equal(parsed.gameId, 'doubles');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('error writes with ERROR severity', async () => {
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output += chunk; return true; };

    try {
      await logger.error('something broke');
      const parsed = JSON.parse(output.trim());
      assert.equal(parsed.severity, 'ERROR');
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it('buildLog includes gameId and buildId in labels', async () => {
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output += chunk; return true; };

    try {
      await logger.buildLog('doubles', 42, 'info', 'build started');
      const parsed = JSON.parse(output.trim());
      assert.equal(parsed.gameId, 'doubles');
      assert.equal(parsed.buildId, 42);
      assert.equal(parsed.message, 'build started');
    } finally {
      process.stdout.write = origWrite;
    }
  });
});

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('sentry (disabled mode)', () => {
  let sentry;

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
    delete require.cache[require.resolve('../lib/sentry')];
    sentry = require('../lib/sentry');
  });

  it('init does not throw when SENTRY_DSN is not set', () => {
    sentry.init('test-service');
    // Should not throw
  });

  it('captureException does not throw when disabled', () => {
    sentry.init('test');
    sentry.captureException(new Error('test error'), { gameId: 'doubles' });
  });

  it('captureMessage does not throw when disabled', () => {
    sentry.init('test');
    sentry.captureMessage('test message', 'warning', { buildId: 1 });
  });

  it('startBuildTransaction returns stub with all methods', () => {
    sentry.init('test');
    const tx = sentry.startBuildTransaction('doubles', 1);
    assert.equal(typeof tx.setStatus, 'function');
    assert.equal(typeof tx.finish, 'function');
    assert.equal(typeof tx.startChild, 'function');
    assert.equal(typeof tx.setData, 'function');

    // Methods should not throw
    tx.setStatus('ok');
    tx.setStatus('error');
    tx.finish();
    const child = tx.startChild({ name: 'test-child' });
    assert.ok(child); // child might not have finish in stub, just verify no crash
    tx.setData('key', 'value');
  });

  it('flush resolves immediately when disabled', async () => {
    sentry.init('test');
    await sentry.flush();
  });

  it('expressErrorHandler returns fallback middleware when disabled', () => {
    sentry.init('test');
    const handler = sentry.expressErrorHandler();
    assert.equal(typeof handler, 'function');
    assert.equal(handler.length, 4); // Express error handlers have 4 params

    // Test the fallback handler
    let statusCode, responseBody;
    const mockErr = new Error('test');
    const mockReq = {};
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(body) { responseBody = body; },
    };
    handler(mockErr, mockReq, mockRes, () => {});
    assert.equal(statusCode, 500);
    assert.equal(responseBody.error, 'Internal server error');
  });
});

'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('slack', () => {
  let slack;

  beforeEach(() => {
    delete require.cache[require.resolve('../lib/slack')];
  });

  it('notify skips when SLACK_WEBHOOK_URL not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    slack = require('../lib/slack');
    // Should not throw
    await slack.notify('test message');
  });

  it('notify sends POST when SLACK_WEBHOOK_URL is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let capturedUrl, capturedOpts;
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return { ok: true };
    };

    try {
      await slack.notify('hello slack');
      assert.equal(capturedUrl, 'https://hooks.slack.com/test');
      assert.equal(capturedOpts.method, 'POST');
      const body = JSON.parse(capturedOpts.body);
      assert.equal(body.text, 'hello slack');
    } finally {
      global.fetch = originalFetch;
      delete process.env.SLACK_WEBHOOK_URL;
    }
  });

  it('notify handles fetch errors gracefully', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error('network down'); };

    try {
      // Should not throw
      await slack.notify('test');
    } finally {
      global.fetch = originalFetch;
      delete process.env.SLACK_WEBHOOK_URL;
    }
  });

  it('notifyBuildResult formats APPROVED correctly with call count', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => { sentMessage = args.join(' '); };

    await slack.notifyBuildResult('doubles', {
      status: 'APPROVED',
      iterations: 2,
      total_time_s: 47,
      llm_calls: 5,
      models: { generation: 'claude-opus-4-6' },
    }, 'abc1234567');

    console.log = origLog;
    assert.ok(sentMessage.includes('doubles'));
    assert.ok(sentMessage.includes('APPROVED'));
    assert.ok(sentMessage.includes('2 iterations'));
    assert.ok(sentMessage.includes('5 calls'));
    assert.ok(!sentMessage.includes('gen='), 'Should show call count, not model name');
  });

  it('notifyBuildResult formats FAILED correctly', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => { sentMessage = args.join(' '); };

    await slack.notifyBuildResult('doubles', {
      status: 'FAILED',
      iterations: 5,
      total_time_s: 120,
      test_results: [{ passed: 3, failures: 2 }],
      models: {},
    }, null);

    console.log = origLog;
    assert.ok(sentMessage.includes('FAILED'));
    assert.ok(sentMessage.includes('Failures: 2'));
  });

  it('notifyBuildResult handles null models safely (uses optional chaining)', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    // Should not throw even with null models
    await slack.notifyBuildResult('test', {
      status: 'APPROVED',
      iterations: 1,
      total_time_s: 10,
      models: null,
    }, null);
  });

  it('notifyRateLimited includes warning emoji', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => { sentMessage = args.join(' '); };

    await slack.notifyRateLimited('doubles');
    console.log = origLog;
    assert.ok(sentMessage.includes('RATE LIMITED'));
  });

  it('notifyBulkQueued includes count', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => { sentMessage = args.join(' '); };

    await slack.notifyBulkQueued(15);
    console.log = origLog;
    assert.ok(sentMessage.includes('15'));
    assert.ok(sentMessage.includes('overnight'));
  });
});

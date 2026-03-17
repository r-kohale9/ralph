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
    global.fetch = async () => {
      throw new Error('network down');
    };

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
    console.log = (...args) => {
      sentMessage = args.join(' ');
    };

    await slack.notifyBuildResult(
      'doubles',
      {
        status: 'APPROVED',
        iterations: 2,
        total_time_s: 47,
        llm_calls: 5,
        models: { generation: 'claude-opus-4-6' },
      },
      'abc1234567',
    );

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
    console.log = (...args) => {
      sentMessage = args.join(' ');
    };

    await slack.notifyBuildResult(
      'doubles',
      {
        status: 'FAILED',
        iterations: 5,
        total_time_s: 120,
        test_results: [{ passed: 3, failures: 2 }],
        models: {},
      },
      null,
    );

    console.log = origLog;
    assert.ok(sentMessage.includes('FAILED'));
    assert.ok(sentMessage.includes('Failures: 2'));
  });

  it('notifyBuildResult handles null models safely (uses optional chaining)', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    // Should not throw even with null models
    await slack.notifyBuildResult(
      'test',
      {
        status: 'APPROVED',
        iterations: 1,
        total_time_s: 10,
        models: null,
      },
      null,
    );
  });

  it('notifyRateLimited includes warning emoji', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => {
      sentMessage = args.join(' ');
    };

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
    console.log = (...args) => {
      sentMessage = args.join(' ');
    };

    await slack.notifyBulkQueued(15);
    console.log = origLog;
    assert.ok(sentMessage.includes('15'));
    assert.ok(sentMessage.includes('overnight'));
  });

  // ─── New: Web API + threading tests ──────────────────────────────────────

  it('module exports all expected functions', () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    assert.equal(typeof slack.init, 'function');
    assert.equal(typeof slack.isWebApiEnabled, 'function');
    assert.equal(typeof slack.notify, 'function');
    assert.equal(typeof slack.createGameThread, 'function');
    assert.equal(typeof slack.postThreadUpdate, 'function');
    assert.equal(typeof slack.postThreadResult, 'function');
    assert.equal(typeof slack.notifyBuildResult, 'function');
    assert.equal(typeof slack.notifyRateLimited, 'function');
    assert.equal(typeof slack.notifyBulkQueued, 'function');
    assert.equal(typeof slack.verifySlackSignature, 'function');
    assert.equal(typeof slack.createEventsHandler, 'function');
  });

  it('init returns false when SLACK_BOT_TOKEN not set', () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');
    const result = slack.init();
    assert.equal(result, false);
  });

  it('isWebApiEnabled returns false without initialization', () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');
    assert.equal(slack.isWebApiEnabled(), false);
  });

  it('createGameThread returns null without webClient', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');
    const result = await slack.createGameThread('test-game', { title: 'Test', buildId: 1 });
    assert.equal(result, null);
  });

  it('postThreadUpdate does not throw without webClient', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');
    // Should not throw
    await slack.postThreadUpdate('1234.5678', 'C123', 'Test message');
  });

  it('postThreadResult falls back to webhook when no webClient', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    // Should not throw — falls back to webhook (which also skips since no URL)
    await slack.postThreadResult('1234.5678', 'C123', 'test-game', {
      status: 'APPROVED',
      iterations: 1,
      total_time_s: 30,
      llm_calls: 3,
    });
  });

  // ─── Slack signature verification ──────────────────────────────────────

  it('verifySlackSignature returns false for missing secret', () => {
    slack = require('../lib/slack');
    const result = slack.verifySlackSignature(null, '12345', 'body', 'v0=sig');
    assert.equal(result, false);
  });

  it('verifySlackSignature returns false for old timestamp', () => {
    slack = require('../lib/slack');
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const result = slack.verifySlackSignature('secret', oldTimestamp, 'body', 'v0=sig');
    assert.equal(result, false);
  });

  it('verifySlackSignature validates correct signature', () => {
    slack = require('../lib/slack');
    const crypto = require('crypto');
    const secret = 'test-signing-secret';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"test": true}';
    const baseString = `v0:${timestamp}:${body}`;
    const signature = 'v0=' + crypto.createHmac('sha256', secret).update(baseString).digest('hex');

    const result = slack.verifySlackSignature(secret, timestamp, body, signature);
    assert.equal(result, true);
  });

  it('verifySlackSignature rejects wrong signature', () => {
    slack = require('../lib/slack');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const result = slack.verifySlackSignature('secret', timestamp, 'body', 'v0=wrong');
    assert.equal(result, false);
  });

  // ─── Events handler ────────────────────────────────────────────────────

  it('createEventsHandler returns a function', () => {
    slack = require('../lib/slack');
    const handler = slack.createEventsHandler(() => {});
    assert.equal(typeof handler, 'function');
  });

  it('events handler responds to url_verification challenge', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    const handler = slack.createEventsHandler(() => {});
    let responseData;
    const mockReq = {
      headers: {},
      body: { type: 'url_verification', challenge: 'test-challenge-token' },
    };
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        responseData = data;
        return mockRes;
      },
    };

    await handler(mockReq, mockRes);
    assert.deepEqual(responseData, { challenge: 'test-challenge-token' });
  });

  it('events handler calls onFeedback for thread replies', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let feedbackReceived = null;
    const handler = slack.createEventsHandler(async (feedback) => {
      feedbackReceived = feedback;
    });

    const mockReq = {
      headers: {},
      body: {
        type: 'event_callback',
        event: {
          type: 'message',
          thread_ts: '1234567890.123456',
          channel: 'C12345',
          text: 'Fix the score display',
          user: 'U12345',
        },
      },
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    await handler(mockReq, mockRes);
    assert.ok(feedbackReceived);
    assert.equal(feedbackReceived.threadTs, '1234567890.123456');
    assert.equal(feedbackReceived.text, 'Fix the score display');
    assert.equal(feedbackReceived.userId, 'U12345');
  });

  it('events handler ignores bot messages', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let feedbackReceived = false;
    const handler = slack.createEventsHandler(async () => {
      feedbackReceived = true;
    });

    const mockReq = {
      headers: {},
      body: {
        type: 'event_callback',
        event: {
          type: 'message',
          thread_ts: '1234.5678',
          channel: 'C123',
          text: 'Bot message',
          bot_id: 'B12345',
        },
      },
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    await handler(mockReq, mockRes);
    assert.equal(feedbackReceived, false);
  });

  it('events handler ignores non-thread messages', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let feedbackReceived = false;
    const handler = slack.createEventsHandler(async () => {
      feedbackReceived = true;
    });

    const mockReq = {
      headers: {},
      body: {
        type: 'event_callback',
        event: {
          type: 'message',
          channel: 'C123',
          text: 'Top-level message, no thread_ts',
          user: 'U123',
        },
      },
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    await handler(mockReq, mockRes);
    assert.equal(feedbackReceived, false);
  });

  it('events handler handles feedback callback errors gracefully', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    const handler = slack.createEventsHandler(async () => {
      throw new Error('callback failed');
    });

    const mockReq = {
      headers: {},
      body: {
        type: 'event_callback',
        event: {
          type: 'message',
          thread_ts: '1234.5678',
          channel: 'C123',
          text: 'feedback',
          user: 'U123',
        },
      },
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    // Should not throw
    await handler(mockReq, mockRes);
  });

  it('notifyBuildResult handles REJECTED status', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let sentMessage;
    const origLog = console.log;
    console.log = (...args) => {
      sentMessage = args.join(' ');
    };

    await slack.notifyBuildResult(
      'test-game',
      {
        status: 'REJECTED',
        iterations: 1,
        total_time_s: 30,
        review_result: 'Missing score display',
        test_results: [],
        models: {},
      },
      null,
    );

    console.log = origLog;
    assert.ok(sentMessage.includes('REJECTED'));
    assert.ok(sentMessage.includes('Missing score display'));
  });

  it('events handler responds ok for unknown event types', async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    delete require.cache[require.resolve('../lib/slack')];
    slack = require('../lib/slack');

    let responseData;
    const handler = slack.createEventsHandler(() => {});
    const mockReq = {
      headers: {},
      body: { type: 'unknown_type' },
    };
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        responseData = data;
        return mockRes;
      },
    };

    await handler(mockReq, mockRes);
    assert.deepEqual(responseData, { ok: true });
  });
});

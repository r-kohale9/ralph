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

  // ─── updateThreadOpener tests ──────────────────────────────────────────

  /**
   * Helper: load slack.js with a mock WebClient injected into the require cache.
   * Returns { slack, mockChatUpdate } so callers can inspect calls.
   */
  function loadSlackWithMockWebClient() {
    // Build a mock WebClient whose chat.update we can spy on
    const calls = [];
    function MockWebClient() {
      this.chat = {
        update: async (opts) => {
          calls.push(opts);
          return { ok: true };
        },
        postMessage: async (opts) => {
          calls.push(opts);
          return { ts: '9999.0001', channel: opts.channel };
        },
      };
    }

    // Inject the mock into the require cache under the @slack/web-api key
    const apiKey = require.resolve('@slack/web-api');
    require.cache[apiKey] = {
      id: apiKey,
      filename: apiKey,
      loaded: true,
      exports: { WebClient: MockWebClient },
      children: [],
      paths: [],
    };

    // Ensure slack.js is freshly loaded so it picks up the mock
    delete require.cache[require.resolve('../lib/slack')];
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_CHANNEL_ID = 'C_DEFAULT';

    const slackMod = require('../lib/slack');
    slackMod.init(); // wires up webClient = new MockWebClient(token)

    return { slack: slackMod, calls };
  }

  function cleanupMockWebClient() {
    try {
      delete require.cache[require.resolve('@slack/web-api')];
    } catch {
      // module may not be resolvable in test env — ignore
    }
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL_ID;
    delete require.cache[require.resolve('../lib/slack')];
  }

  it('updateThreadOpener: no-op when webClient is absent', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete require.cache[require.resolve('../lib/slack')];
    const s = require('../lib/slack');
    // Should resolve without error — returns undefined
    const result = await s.updateThreadOpener('1234.0', 'C123', 'mygame', { status: 'APPROVED' });
    assert.equal(result, undefined);
  });

  it('updateThreadOpener: status=running uses 🔄 emoji and Running label', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('1111.0', 'C123', 'doubles', {
        status: 'running',
        buildId: 42,
        iterations: 0,
      }, { currentStep: 'Step 2 · game-flow' });

      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.channel, 'C123');
      assert.equal(call.ts, '1111.0');
      assert.ok(call.text.includes('🔄'), `Expected 🔄 in text, got: ${call.text}`);
      assert.ok(call.text.includes('Running'), `Expected "Running" in text, got: ${call.text}`);
      assert.ok(call.text.includes('doubles'), `Expected gameId in text, got: ${call.text}`);
      assert.ok(Array.isArray(call.blocks), 'blocks should be an array');
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: status=APPROVED uses ✅ emoji and APPROVED label', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('2222.0', 'C456', 'find-triangle-side', {
        status: 'APPROVED',
        buildId: 99,
        iterations: 1,
      });

      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.channel, 'C456');
      assert.equal(call.ts, '2222.0');
      assert.ok(call.text.includes('✅'), `Expected ✅ in text, got: ${call.text}`);
      assert.ok(call.text.includes('APPROVED'), `Expected "APPROVED" in text, got: ${call.text}`);
      assert.ok(Array.isArray(call.blocks), 'blocks should be an array');
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: status=REJECTED uses 🔸 emoji and REJECTED label', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('3333.0', 'C789', 'count-and-tap', {
        status: 'REJECTED',
        buildId: 77,
        iterations: 3,
      });

      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.channel, 'C789');
      assert.equal(call.ts, '3333.0');
      assert.ok(call.text.includes('🔸'), `Expected 🔸 in text, got: ${call.text}`);
      assert.ok(call.text.includes('REJECTED'), `Expected "REJECTED" in text, got: ${call.text}`);
      assert.ok(Array.isArray(call.blocks), 'blocks should be an array');
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: status=FAILED uses ❌ emoji and FAILED label', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('4444.0', 'CFAIL', 'which-ratio', {
        status: 'FAILED',
        buildId: 55,
        iterations: 5,
        errors: ['timeout after 5 iterations'],
      });

      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.channel, 'CFAIL');
      assert.equal(call.ts, '4444.0');
      assert.ok(call.text.includes('❌'), `Expected ❌ in text, got: ${call.text}`);
      assert.ok(call.text.includes('FAILED'), `Expected "FAILED" in text, got: ${call.text}`);
      assert.ok(Array.isArray(call.blocks), 'blocks should be an array');
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: falls back to default channel when channelId is null', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('5555.0', null, 'mygame', {
        status: 'APPROVED',
        buildId: 1,
        iterations: 0,
      });

      assert.equal(calls.length, 1);
      // SLACK_CHANNEL_ID is set to 'C_DEFAULT' by loadSlackWithMockWebClient
      assert.equal(calls[0].channel, 'C_DEFAULT');
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: uses publish.gameLink as latestHtmlUrl when present', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('6666.0', 'CTEST', 'doubles', {
        status: 'APPROVED',
        buildId: 10,
        iterations: 0,
        publish: { gameLink: 'https://cdn.example.com/games/doubles/index.html', gameId: 'doubles' },
      });

      assert.equal(calls.length, 1);
      // The blocks should include the publish gameLink somewhere
      const blocksStr = JSON.stringify(calls[0].blocks);
      assert.ok(blocksStr.includes('cdn.example.com'), `Expected publish gameLink in blocks, got: ${blocksStr}`);
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: handles chat.update errors gracefully', async () => {
    const calls = [];
    function MockWebClientThrows() {
      this.chat = {
        update: async () => { throw new Error('Slack API error'); },
        postMessage: async (opts) => { calls.push(opts); return { ts: '0', channel: opts.channel }; },
      };
    }

    let apiKey;
    try {
      apiKey = require.resolve('@slack/web-api');
    } catch {
      // @slack/web-api not installed in test env; skip this sub-test
      return;
    }

    require.cache[apiKey] = {
      id: apiKey, filename: apiKey, loaded: true,
      exports: { WebClient: MockWebClientThrows }, children: [], paths: [],
    };
    delete require.cache[require.resolve('../lib/slack')];
    process.env.SLACK_BOT_TOKEN = 'xoxb-error-test';
    process.env.SLACK_CHANNEL_ID = 'C_ERR';

    const s = require('../lib/slack');
    s.init();

    try {
      // Should not throw — error is caught and logged internally
      await s.updateThreadOpener('7777.0', 'C_ERR', 'mygame', { status: 'FAILED', buildId: 1 });
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: running status label includes currentStep', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('8888.0', 'CSTEP', 'doubles', {
        status: 'running',
        buildId: 3,
        iterations: 0,
      }, { currentStep: 'Step 3 · accessibility · iter 1/5' });

      assert.equal(calls.length, 1);
      assert.ok(
        calls[0].text.includes('Step 3 · accessibility · iter 1/5'),
        `Expected currentStep in text, got: ${calls[0].text}`,
      );
    } finally {
      cleanupMockWebClient();
    }
  });

  it('updateThreadOpener: running status with no currentStep defaults to "in progress"', async () => {
    const { slack, calls } = loadSlackWithMockWebClient();
    try {
      await slack.updateThreadOpener('9999.0', 'CNOPROG', 'doubles', {
        status: 'running',
        buildId: 5,
        iterations: 0,
      });

      assert.equal(calls.length, 1);
      assert.ok(
        calls[0].text.includes('in progress'),
        `Expected "in progress" in text when no currentStep, got: ${calls[0].text}`,
      );
    } finally {
      cleanupMockWebClient();
    }
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

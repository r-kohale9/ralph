'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Contract tests for CLIProxyAPI
//
// Validates request/response format between ralph pipeline and the CLI proxy.
// These tests verify the contract without hitting a real proxy — they validate
// the shapes of requests we send and responses we expect.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('CLIProxyAPI contract', () => {
  let llm;
  let originalFetch;
  let capturedRequest;

  beforeEach(() => {
    originalFetch = global.fetch;
    capturedRequest = null;
    delete require.cache[require.resolve('../lib/llm')];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockProxy(responseBody, status = 200) {
    global.fetch = async (url, opts) => {
      capturedRequest = {
        url,
        method: opts.method,
        headers: opts.headers,
        body: JSON.parse(opts.body),
      };
      return {
        ok: status === 200,
        status,
        json: async () => responseBody,
        text: async () => JSON.stringify(responseBody),
      };
    };
    llm = require('../lib/llm');
  }

  describe('request format', () => {
    it('sends POST to /v1/messages endpoint', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello');
      assert.equal(capturedRequest.method, 'POST');
      assert.ok(capturedRequest.url.endsWith('/v1/messages'));
    });

    it('sends Content-Type application/json header', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello');
      assert.equal(capturedRequest.headers['Content-Type'], 'application/json');
    });

    it('sends x-api-key header', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello');
      assert.ok(capturedRequest.headers['x-api-key'], 'x-api-key header must be present');
    });

    it('sends model field in body', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello', 'claude-opus-4-6');
      assert.equal(capturedRequest.body.model, 'claude-opus-4-6');
    });

    it('sends max_tokens field in body', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello', 'model', { maxTokens: 8000 });
      assert.equal(capturedRequest.body.max_tokens, 8000);
    });

    it('sends messages array with user role', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello world');
      assert.ok(Array.isArray(capturedRequest.body.messages));
      assert.equal(capturedRequest.body.messages.length, 1);
      assert.equal(capturedRequest.body.messages[0].role, 'user');
      assert.equal(capturedRequest.body.messages[0].content, 'hello world');
    });

    it('sends default max_tokens of 16000', async () => {
      mockProxy({ content: [{ text: 'ok' }] });
      await llm.callLlm('test', 'hello');
      assert.equal(capturedRequest.body.max_tokens, 16000);
    });
  });

  describe('response format: Claude', () => {
    it('parses Claude API response format (.content[0].text)', async () => {
      mockProxy({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Generated HTML' }],
        model: 'claude-opus-4-6',
        usage: { input_tokens: 100, output_tokens: 200 },
      });
      const result = await llm.callLlm('test', 'hello');
      assert.equal(result, 'Generated HTML');
    });

    it('handles multi-block Claude response (takes first text block)', async () => {
      mockProxy({
        content: [
          { type: 'text', text: 'First block' },
          { type: 'text', text: 'Second block' },
        ],
      });
      const result = await llm.callLlm('test', 'hello');
      assert.equal(result, 'First block');
    });
  });

  describe('response format: OpenAI', () => {
    it('parses OpenAI API response format (.choices[0].message.content)', async () => {
      mockProxy({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'OpenAI response' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });
      const result = await llm.callLlm('test', 'hello');
      assert.equal(result, 'OpenAI response');
    });
  });

  describe('error handling', () => {
    it('throws on HTTP 500 with error message', async () => {
      mockProxy({ error: 'Internal Server Error' }, 500);
      await assert.rejects(
        () => llm.callLlm('test', 'hello', 'model', { timeout: 1000 }),
        /Proxy returned HTTP 500/
      );
    });

    it('throws when response has empty content array', async () => {
      mockProxy({ content: [] });
      await assert.rejects(
        () => llm.callLlm('test', 'hello'),
        /No text content/
      );
    });

    it('throws when response has null content', async () => {
      mockProxy({ content: null });
      await assert.rejects(
        () => llm.callLlm('test', 'hello'),
        /No text content/
      );
    });

    it('throws when response has no recognized format', async () => {
      mockProxy({ data: 'unrecognized' });
      await assert.rejects(
        () => llm.callLlm('test', 'hello'),
        /No text content/
      );
    });
  });

  describe('rate limiting (429)', () => {
    it('retries on 429 with exponential backoff', async () => {
      let callCount = 0;
      global.fetch = async (url, opts) => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 429, text: async () => 'Rate limited' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ text: 'Success after retry' }] }),
        };
      };

      llm = require('../lib/llm');
      const result = await llm.callLlm('test', 'hello', 'model', { timeout: 60000 });
      assert.equal(result, 'Success after retry');
      assert.equal(callCount, 2);
    });
  });
});

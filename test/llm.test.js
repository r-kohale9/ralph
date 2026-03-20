'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('llm', () => {
  let llm;
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    delete require.cache[require.resolve('../lib/llm')];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends correct request to proxy', async () => {
    let capturedUrl, capturedBody, capturedHeaders;
    global.fetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      capturedHeaders = opts.headers;
      return {
        ok: true,
        json: async () => ({
          content: [{ text: 'Generated code here' }],
        }),
      };
    };

    llm = require('../lib/llm');
    const result = await llm.callLlm('generate', 'Write a game', 'claude-opus-4-6');

    assert.ok(capturedUrl.includes('/v1/messages'));
    assert.equal(capturedBody.model, 'claude-opus-4-6');
    assert.equal(capturedBody.messages[0].role, 'user');
    assert.equal(capturedBody.messages[0].content, 'Write a game');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
    assert.ok(capturedHeaders['x-api-key']);
    assert.equal(result, 'Generated code here');
  });

  it('handles OpenAI response format', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI response' } }],
      }),
    });

    llm = require('../lib/llm');
    const result = await llm.callLlm('fix', 'Fix bug');
    assert.equal(result, 'OpenAI response');
  });

  it('throws on non-ok response (not 429)', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    llm = require('../lib/llm');
    await assert.rejects(() => llm.callLlm('test', 'prompt', 'model', { timeout: 1000 }), /Proxy returned HTTP 500/);
  });

  it('throws when no text in response', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ content: [] }),
    });

    llm = require('../lib/llm');
    await assert.rejects(() => llm.callLlm('test', 'prompt'), /No text content/);
  });

  it('uses default model from env or fallback', async () => {
    let capturedModel;
    global.fetch = async (url, opts) => {
      capturedModel = JSON.parse(opts.body).model;
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'ok' }] }),
      };
    };

    llm = require('../lib/llm');
    await llm.callLlm('test', 'prompt'); // no model specified
    assert.equal(capturedModel, 'claude-sonnet-4-6'); // default
  });

  it('uses maxTokens from options', async () => {
    let capturedMaxTokens;
    global.fetch = async (url, opts) => {
      capturedMaxTokens = JSON.parse(opts.body).max_tokens;
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'ok' }] }),
      };
    };

    llm = require('../lib/llm');
    await llm.callLlm('test', 'prompt', 'model', { maxTokens: 4000 });
    assert.equal(capturedMaxTokens, 4000);
  });

  it('default maxTokens is 128000', async () => {
    let capturedMaxTokens;
    global.fetch = async (url, opts) => {
      capturedMaxTokens = JSON.parse(opts.body).max_tokens;
      return {
        ok: true,
        json: async () => ({ content: [{ text: 'ok' }] }),
      };
    };

    llm = require('../lib/llm');
    await llm.callLlm('test', 'prompt');
    assert.equal(capturedMaxTokens, 128000);
  });
});

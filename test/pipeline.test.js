'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Tests for lib/pipeline.js (E3: Node.js pipeline)
//
// Tests the helper functions and pipeline logic without hitting real LLMs.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractHtml, extractTests } = require('../lib/pipeline');

describe('pipeline.js extractHtml', () => {
  it('extracts HTML from ```html code block', () => {
    const input = 'Here is the game:\n```html\n<!DOCTYPE html>\n<html><body>test</body></html>\n```\nDone!';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
    assert.ok(!result.includes('```'));
  });

  it('extracts HTML from generic code block', () => {
    const input = '```\n<!DOCTYPE html>\n<html><body>hello</body></html>\n```';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
  });

  it('returns raw HTML when no code blocks', () => {
    const input = '<!DOCTYPE html>\n<html><body>raw</body></html>';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('<!DOCTYPE html>'));
  });

  it('returns null when no HTML found', () => {
    const input = 'This is just regular text with no HTML.';
    const result = extractHtml(input);
    assert.equal(result, null);
  });

  it('handles multi-line HTML in code block', () => {
    const input = '```html\n<!DOCTYPE html>\n<html>\n<head><title>Game</title></head>\n<body>\n<div id="gameContent"></div>\n</body>\n</html>\n```';
    const result = extractHtml(input);
    assert.ok(result);
    assert.ok(result.includes('gameContent'));
  });
});

describe('pipeline.js extractTests', () => {
  it('extracts from ```javascript block', () => {
    const input = '```javascript\ntest("works", () => {});\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('test'));
  });

  it('extracts from ```js block', () => {
    const input = '```js\ndescribe("game", () => { it("loads", () => {}); });\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('describe'));
  });

  it('extracts from generic code block with test keywords', () => {
    const input = '```\nconst { expect } = require("chai");\n```';
    const result = extractTests(input);
    assert.ok(result);
    assert.ok(result.includes('expect'));
  });

  it('returns null when no test code found', () => {
    const input = 'Just some text, no code blocks.';
    const result = extractTests(input);
    assert.equal(result, null);
  });
});

describe('pipeline.js configuration', () => {
  it('pipeline module exports runPipeline', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.runPipeline, 'function');
  });

  it('pipeline module exports extractHtml', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.extractHtml, 'function');
  });

  it('pipeline module exports extractTests', () => {
    const pipeline = require('../lib/pipeline');
    assert.equal(typeof pipeline.extractTests, 'function');
  });
});

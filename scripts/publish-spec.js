#!/usr/bin/env node
// publish-spec.js — Register a game spec via MCP and queue a build
//
// Usage:
//   node scripts/publish-spec.js <gameId>
//   node scripts/publish-spec.js <gameId> --spec path/to/spec.md
//   node scripts/publish-spec.js <gameId> --dry-run
//
// Examples:
//   node scripts/publish-spec.js adjust-to-add
//   node scripts/publish-spec.js geo-quad-match --spec games/geo-quad-match/spec.md

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');

// ─── Config ────────────────────────────────────────────────────────────────

require('dotenv').config();

const SERVER     = process.env.RALPH_SERVER;
const MCP_SECRET = process.env.RALPH_MCP_SECRET;
const SLACK_USER = process.env.RALPH_SLACK_USER;

if (!SERVER || !MCP_SECRET || !SLACK_USER) {
  const missing = ['RALPH_SERVER', 'RALPH_MCP_SECRET', 'RALPH_SLACK_USER']
    .filter(k => !process.env[k]);
  console.error(`✗ Missing required env vars: ${missing.join(', ')}`);
  console.error('  Add them to .env (see .env.example)');
  process.exit(1);
}

// ─── Args ──────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const gameId = args.find(a => !a.startsWith('--'));
const specFlagIdx = args.indexOf('--spec');
const specArg     = specFlagIdx !== -1 ? args[specFlagIdx + 1] : null;
const dryRun      = args.includes('--dry-run');

if (!gameId) {
  console.error('Usage: node scripts/publish-spec.js <gameId> [--spec path/to/spec.md] [--dry-run]');
  process.exit(1);
}

// ─── Resolve spec path ─────────────────────────────────────────────────────

const repoRoot = path.resolve(__dirname, '..');
const specPath = specArg
  ? path.resolve(specArg)
  : path.join(repoRoot, 'games', gameId, 'spec.md');

if (!fs.existsSync(specPath)) {
  console.error(`✗ Spec not found: ${specPath}`);
  console.error(`  Create it first or pass --spec <path>`);
  process.exit(1);
}

const specContent = fs.readFileSync(specPath, 'utf-8');

// Validate first line has a heading
if (!specContent.trimStart().startsWith('#')) {
  console.error('✗ Spec must start with a top-level heading (# Title)');
  process.exit(1);
}

const titleMatch = specContent.match(/^#\s+(.+)/m);
const title = titleMatch ? titleMatch[1].trim() : gameId;

console.log(`\n📋 Publishing spec`);
console.log(`   Game ID : ${gameId}`);
console.log(`   Title   : ${title}`);
console.log(`   Spec    : ${specPath}`);
console.log(`   Server  : ${SERVER}`);
console.log(`   Dry run : ${dryRun}\n`);

if (dryRun) {
  console.log('✓ Dry run — spec looks valid. Remove --dry-run to publish.');
  process.exit(0);
}

// ─── HTTP helper ───────────────────────────────────────────────────────────

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data   = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || 80,
      path:     parsed.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: raw }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // 1. Initialize MCP session
  process.stdout.write('→ Initializing MCP session ... ');
  const initRes = await post(
    `${SERVER}/mcp`,
    { Authorization: `Bearer ${MCP_SECRET}` },
    { jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'publish-spec', version: '1.0' } }, id: 1 },
  );

  if (initRes.status !== 200) {
    console.error(`\n✗ MCP init failed (HTTP ${initRes.status}): ${initRes.body}`);
    process.exit(1);
  }

  const sessionId = initRes.headers['mcp-session-id'];
  if (!sessionId) {
    console.error('\n✗ No mcp-session-id in response headers');
    process.exit(1);
  }
  console.log(`ok (session: ${sessionId.slice(0, 8)}...)`);

  // 2. Call register_spec
  process.stdout.write('→ Registering spec and queuing build ... ');
  const callRes = await post(
    `${SERVER}/mcp`,
    { Authorization: `Bearer ${MCP_SECRET}`, 'mcp-session-id': sessionId },
    {
      jsonrpc: '2.0',
      method:  'tools/call',
      params:  {
        name:      'register_spec',
        arguments: {
          game_id:          gameId,
          title,
          spec_content:     specContent,
          skip_review:      true,
          notify_slack_user: SLACK_USER,
        },
      },
      id: 2,
    },
  );

  if (callRes.status !== 200) {
    console.error(`\n✗ register_spec failed (HTTP ${callRes.status}): ${callRes.body}`);
    process.exit(1);
  }

  // Parse SSE response (event: message\ndata: {...})
  const dataLine = callRes.body.split('\n').find(l => l.startsWith('data:'));
  if (!dataLine) {
    console.error(`\n✗ Unexpected response format:\n${callRes.body}`);
    process.exit(1);
  }

  const envelope = JSON.parse(dataLine.replace('data:', '').trim());
  if (envelope.error) {
    console.error(`\n✗ MCP error: ${JSON.stringify(envelope.error)}`);
    process.exit(1);
  }

  const result = JSON.parse(envelope.result.content[0].text);

  if (!result.success) {
    console.error(`\n✗ register_spec returned error: ${JSON.stringify(result)}`);
    process.exit(1);
  }

  console.log('ok\n');
  console.log(`✓ Build queued successfully!`);
  console.log(`   Build ID : #${result.build_id}`);
  console.log(`   Status   : ${result.status}`);
  console.log(`   Spec hash: ${result.spec_hash}`);
  console.log(`\n   Track    : ${SERVER}/api/builds/${result.build_id}`);
  console.log(`   All builds: ${SERVER}/api/builds\n`);
}

main().catch(err => {
  console.error(`\n✗ Unexpected error: ${err.message}`);
  process.exit(1);
});

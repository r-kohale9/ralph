'use strict';

// Stdio transport entrypoint for Claude Desktop / local MCP testing
const path = require('path');
const fs = require('fs');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./lib/mcp');
const db = require('./lib/db');

async function main() {
  // Ensure data directory exists for SQLite
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Connect to Redis queue if available (enables full pipeline via worker)
  let queue = null;
  try {
    const { Queue } = require('bullmq');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    queue = new Queue('ralph-builds', { connection: { url: redisUrl } });
    // Verify connection
    await queue.client;
  } catch {
    queue = null; // Redis not available — registration works but builds won't be queued
  }

  const server = createMcpServer({
    db,
    queue,
    logger: null,
    repoDir: process.env.RALPH_REPO_DIR || __dirname,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

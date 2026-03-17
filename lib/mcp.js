'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// mcp.js — MCP server factory with 5 tool definitions
//
// Uses @modelcontextprotocol/sdk for Streamable HTTP transport.
// Tools: register_spec, get_build_status, list_games, add_learning, get_learnings
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

let McpServer, z;
try {
  ({ McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js'));
  z = require('zod');
} catch {
  // MCP SDK not installed — MCP features disabled
}

function createMcpServer(deps = {}) {
  const { db, queue, logger } = deps;

  if (!McpServer) {
    throw new Error('@modelcontextprotocol/sdk is not installed — MCP features unavailable');
  }

  const server = new McpServer({
    name: 'ralph-pipeline',
    version: '1.0.0',
  });

  // ─── Tool: register_spec ───────────────────────────────────────────────────
  server.tool(
    'register_spec',
    'Register a game spec for building. Creates/updates the game entry and queues a build.',
    {
      game_id: z.string().describe('Unique game identifier (e.g. "doubles", "memory-match")'),
      title: z.string().optional().describe('Human-readable game title'),
      description: z.string().optional().describe('Brief description of the game'),
      spec_content: z.string().describe('Full markdown spec content'),
    },
    async ({ game_id, title, description, spec_content }) => {
      const specHash = crypto.createHash('sha256').update(spec_content).digest('hex').slice(0, 16);

      // Create/update game record
      db.createGame(game_id, {
        title: title || game_id,
        description: description || null,
        specContent: spec_content,
        specHash,
      });
      db.updateGameStatus(game_id, 'building');

      // Create build and queue it
      const buildId = db.createBuild(game_id, null);

      if (queue) {
        await queue.add('build-game', {
          gameId: game_id,
          buildId,
          specContent: spec_content,
        });
      }

      if (logger) {
        logger.info(`Game registered via MCP: ${game_id}`, { gameId: game_id, buildId, event: 'mcp_register' });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                game_id,
                build_id: buildId,
                spec_hash: specHash,
                status: 'queued',
                message: `Game "${title || game_id}" registered and build #${buildId} queued.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Tool: get_build_status ────────────────────────────────────────────────
  server.tool(
    'get_build_status',
    'Get the status of a specific build or the latest build for a game.',
    {
      build_id: z.number().optional().describe('Specific build ID to check'),
      game_id: z.string().optional().describe('Game ID to get latest build for'),
    },
    async ({ build_id, game_id }) => {
      let build;
      if (build_id) {
        build = db.getBuild(build_id);
      } else if (game_id) {
        const builds = db.getBuildsByGame(game_id, 1);
        build = builds[0] || null;
      } else {
        return {
          content: [{ type: 'text', text: 'Provide either build_id or game_id' }],
          isError: true,
        };
      }

      if (!build) {
        return {
          content: [{ type: 'text', text: 'Build not found' }],
          isError: true,
        };
      }

      // Parse JSON fields
      try {
        if (build.test_results) build.test_results = JSON.parse(build.test_results);
      } catch {
        /* keep raw */
      }
      try {
        if (build.models) build.models = JSON.parse(build.models);
      } catch {
        /* keep raw */
      }

      const game = db.getGame(build.game_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ...build,
                gcp_url: game?.gcp_url || build.gcp_url || null,
                slack_thread_ts: game?.slack_thread_ts || null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Tool: list_games ──────────────────────────────────────────────────────
  server.tool(
    'list_games',
    'List all registered games with their current status.',
    {
      limit: z.number().optional().describe('Max number of games to return (default: 50)'),
    },
    async ({ limit }) => {
      const games = db.listGames(limit || 50);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              games.map((g) => ({
                game_id: g.game_id,
                title: g.title,
                status: g.status,
                gcp_url: g.gcp_url,
                updated_at: g.updated_at,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ─── Tool: add_learning ────────────────────────────────────────────────────
  server.tool(
    'add_learning',
    'Record a learning/insight from a build or manual observation.',
    {
      game_id: z.string().optional().describe('Game this learning applies to (omit for global)'),
      content: z.string().describe('The learning content — what was discovered'),
      category: z
        .string()
        .optional()
        .describe('Category: rendering, state, scoring, timing, interaction, messaging, layout, completion, general'),
      level: z.string().optional().describe('Level: game (specific to one game) or global (applies broadly)'),
      source: z.string().optional().describe('Source: manual, pipeline, feedback, review'),
    },
    async ({ game_id, content, category, level, source }) => {
      const id = db.addLearning(game_id || null, {
        category: category || 'general',
        level: level || (game_id ? 'game' : 'global'),
        content,
        source: source || 'manual',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id, message: 'Learning recorded successfully' }, null, 2),
          },
        ],
      };
    },
  );

  // ─── Tool: get_learnings ───────────────────────────────────────────────────
  server.tool(
    'get_learnings',
    'Retrieve accumulated learnings, optionally filtered by game or category.',
    {
      game_id: z.string().optional().describe('Filter by game ID'),
      category: z.string().optional().describe('Filter by category'),
      level: z.string().optional().describe('Filter by level: game or global'),
      include_resolved: z.boolean().optional().describe('Include resolved learnings (default: false)'),
    },
    async ({ game_id, category, level, include_resolved }) => {
      const learnings = db.getLearnings({
        gameId: game_id || null,
        category: category || null,
        level: level || null,
        includeResolved: include_resolved || false,
      });
      const stats = db.getLearningStats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ stats, learnings }, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

module.exports = { createMcpServer };

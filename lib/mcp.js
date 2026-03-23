'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// mcp.js — MCP server factory with MCP tools + resources
//
// Uses @modelcontextprotocol/sdk for Streamable HTTP transport.
// Tools: register_spec, get_build_status, list_games, add_learning, get_learnings
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let McpServer, z;
try {
  ({ McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js'));
  z = require('zod');
} catch {
  // MCP SDK not installed — MCP features disabled
}

function createMcpServer(deps = {}) {
  const { db, queue, logger, repoDir } = deps;

  if (!McpServer) {
    throw new Error('@modelcontextprotocol/sdk is not installed — MCP features unavailable');
  }

  const server = new McpServer({
    name: 'ralph-pipeline',
    version: '1.0.0',
  });

  const REPO = repoDir || process.env.RALPH_REPO_DIR || '.';
  const warehouseDir = path.join(REPO, 'warehouse');

  // ─── Helper: read warehouse file safely ──────────────────────────────────
  function readWarehouseFile(relativePath) {
    const fullPath = path.join(warehouseDir, relativePath);
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(warehouseDir))) {
      return null; // path traversal guard
    }
    try {
      return fs.readFileSync(resolved, 'utf-8');
    } catch {
      return null;
    }
  }

  // ─── Resource: warehouse spec router ─────────────────────────────────────
  server.resource('warehouse-spec', 'warehouse://spec', {
    description: 'The main SPEC.md router — explains the two-stage generation process and how to navigate the warehouse. READ THIS FIRST when building a game.',
    mimeType: 'text/markdown',
  }, async () => {
    const content = readWarehouseFile('SPEC.md');
    return { contents: [{ uri: 'warehouse://spec', text: content || 'SPEC.md not found', mimeType: 'text/markdown' }] };
  });

  // ─── Resource: parts manifest ────────────────────────────────────────────
  server.resource('warehouse-parts-manifest', 'warehouse://parts/manifest', {
    description: 'Registry of all 37 warehouse parts with capability matrix. Shows which parts are MANDATORY vs CONDITIONAL and maps game features to required parts.',
    mimeType: 'application/json',
  }, async () => {
    const content = readWarehouseFile('parts/manifest.json');
    return { contents: [{ uri: 'warehouse://parts/manifest', text: content || '{}', mimeType: 'application/json' }] };
  });

  // ─── Resource: template schema ───────────────────────────────────────────
  server.resource('warehouse-template-schema', 'warehouse://templates/template-schema', {
    description: 'The assembly book format — 15 required sections that every game spec must include. Use this as the output format when generating a spec.',
    mimeType: 'text/markdown',
  }, async () => {
    const content = readWarehouseFile('templates/template-schema.md');
    return { contents: [{ uri: 'warehouse://templates/template-schema', text: content || 'Not found', mimeType: 'text/markdown' }] };
  });

  // ─── Resource: rules manifest ────────────────────────────────────────────
  server.resource('warehouse-rules-manifest', 'warehouse://rules/manifest', {
    description: 'Registry of universal rules (7 rules). All rules must be followed by every game.',
    mimeType: 'application/json',
  }, async () => {
    const content = readWarehouseFile('rules/manifest.json');
    return { contents: [{ uri: 'warehouse://rules/manifest', text: content || '{}', mimeType: 'application/json' }] };
  });

  // ─── Resource: example spec ──────────────────────────────────────────────
  server.resource('warehouse-example-spec', 'warehouse://templates/adjustment-strategy/spec', {
    description: 'A complete example game spec (Adjustment Strategy). Use this as a reference for the format and level of detail expected.',
    mimeType: 'text/markdown',
  }, async () => {
    const content = readWarehouseFile('templates/adjustment-strategy/spec.md');
    return { contents: [{ uri: 'warehouse://templates/adjustment-strategy/spec', text: content || 'Not found', mimeType: 'text/markdown' }] };
  });

  // ─── Resource template: individual parts ─────────────────────────────────
  server.resource('warehouse-part', 'warehouse://parts/{partId}', {
    description: 'Read a specific warehouse part by ID (e.g. PART-006-timer). Each part contains code blocks, rules, and anti-patterns.',
    mimeType: 'text/markdown',
  }, async (uri, { partId }) => {
    // Try exact filename first, then scan directory
    let content = readWarehouseFile(`parts/${partId}.md`);
    if (!content) {
      // Try matching by part number prefix
      try {
        const files = fs.readdirSync(path.join(warehouseDir, 'parts'));
        const match = files.find((f) => f.startsWith(partId) || f.startsWith(`PART-${partId}`));
        if (match) content = readWarehouseFile(`parts/${match}`);
      } catch { /* ignore */ }
    }
    return { contents: [{ uri: uri.href, text: content || `Part ${partId} not found`, mimeType: 'text/markdown' }] };
  });

  // ─── Resource template: individual rules ─────────────────────────────────
  server.resource('warehouse-rule', 'warehouse://rules/{ruleId}', {
    description: 'Read a specific warehouse rule by ID (e.g. RULE-001-global-scope).',
    mimeType: 'text/markdown',
  }, async (uri, { ruleId }) => {
    let content = readWarehouseFile(`rules/${ruleId}.md`);
    if (!content) {
      try {
        const files = fs.readdirSync(path.join(warehouseDir, 'rules'));
        const match = files.find((f) => f.startsWith(ruleId) || f.startsWith(`RULE-${ruleId}`));
        if (match) content = readWarehouseFile(`rules/${match}`);
      } catch { /* ignore */ }
    }
    return { contents: [{ uri: uri.href, text: content || `Rule ${ruleId} not found`, mimeType: 'text/markdown' }] };
  });

  // ─── Resource template: contracts ────────────────────────────────────────
  server.resource('warehouse-contract', 'warehouse://contracts/{contractName}', {
    description: 'Read a contract schema (e.g. game-state, attempt, metrics, postmessage-in, postmessage-out, duration-data, html-structure).',
    mimeType: 'application/json',
  }, async (uri, { contractName }) => {
    let content = readWarehouseFile(`contracts/${contractName}.schema.json`);
    if (!content) content = readWarehouseFile(`contracts/${contractName}.json`);
    return { contents: [{ uri: uri.href, text: content || `Contract ${contractName} not found`, mimeType: 'application/json' }] };
  });

  // ─── Tool: get_warehouse_guide ────────────────────────────────────────────
  server.tool(
    'get_warehouse_guide',
    'Get a quick guide for building game specs. Returns the SPEC.md router, parts manifest capability matrix, and list of all rules. Call this FIRST before generating any spec.',
    {},
    async () => {
      const spec = readWarehouseFile('SPEC.md') || '';
      const manifest = readWarehouseFile('parts/manifest.json');
      const rulesManifest = readWarehouseFile('rules/manifest.json');

      let capabilityMatrix = '';
      if (manifest) {
        try {
          const parsed = JSON.parse(manifest);
          capabilityMatrix = JSON.stringify(parsed.capability_matrix, null, 2);
        } catch { /* ignore */ }
      }

      let rulesList = '';
      if (rulesManifest) {
        try {
          const parsed = JSON.parse(rulesManifest);
          rulesList = (parsed.rules || []).map((r) => `- ${r.id}: ${r.name} — ${r.summary || r.condition || ''}`).join('\n');
        } catch { /* ignore */ }
      }

      return {
        content: [{
          type: 'text',
          text: [
            '# Warehouse Guide\n',
            '## SPEC.md (Router)\n',
            spec,
            '\n\n## Capability Matrix\n',
            'Use this to determine which parts a game needs based on its features:\n```json\n',
            capabilityMatrix,
            '\n```\n',
            '\n## Universal Rules\n',
            rulesList || 'No rules manifest found',
            '\n\n## Next Steps\n',
            '1. Read the resources: warehouse://parts/manifest, warehouse://templates/template-schema, warehouse://templates/adjustment-strategy/spec (example)',
            '2. For each part you need, read warehouse://parts/{partId} (e.g. warehouse://parts/PART-006-timer)',
            '3. For each rule, read warehouse://rules/{ruleId}',
            '4. For contracts, read warehouse://contracts/{name} (e.g. warehouse://contracts/game-state)',
            '5. Generate the spec following the template-schema format',
            '6. Create the spec as an artifact/document titled "[Game Title] — Spec v1". NEVER paste the full spec inline in chat.',
            '7. In chat, say: "I\'ve created the spec document — please review it and let me know if you\'d like to register."',
            '8. STOP and WAIT. Do NOT call register_spec. Only call register_spec when the user explicitly says "register".',
          ].join('\n'),
        }],
      };
    },
  );

  // ─── Tool: list_warehouse_parts ──────────────────────────────────────────
  server.tool(
    'list_warehouse_parts',
    'List all available warehouse parts with their categories and conditions. Use this to see what components are available for game specs.',
    {},
    async () => {
      const manifest = readWarehouseFile('parts/manifest.json');
      if (!manifest) {
        return { content: [{ type: 'text', text: 'Parts manifest not found' }], isError: true };
      }
      try {
        const parsed = JSON.parse(manifest);
        const parts = (parsed.parts || []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          condition: p.condition,
          file: p.file,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(parts, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Failed to parse manifest: ${err.message}` }], isError: true };
      }
    },
  );

  // ─── Tool: read_warehouse_part ───────────────────────────────────────────
  server.tool(
    'read_warehouse_part',
    'Read the full content of a specific warehouse part. Pass the part ID (e.g. "PART-006-timer" or "006").',
    {
      part_id: z.string().describe('Part ID — e.g. "PART-006-timer", "PART-006", or just "006"'),
    },
    async ({ part_id }) => {
      // Normalize: accept "006", "PART-006", or "PART-006-timer"
      let content = readWarehouseFile(`parts/${part_id}.md`);
      if (!content) {
        try {
          const files = fs.readdirSync(path.join(warehouseDir, 'parts'));
          const normalized = part_id.replace(/^PART-?/i, '');
          const match = files.find((f) => {
            const fNorm = f.replace(/^PART-/, '');
            return f === `${part_id}.md` || fNorm.startsWith(normalized);
          });
          if (match) content = readWarehouseFile(`parts/${match}`);
        } catch { /* ignore */ }
      }
      if (!content) {
        return { content: [{ type: 'text', text: `Part "${part_id}" not found. Use list_warehouse_parts to see available parts.` }], isError: true };
      }
      return { content: [{ type: 'text', text: content }] };
    },
  );

  // ─── Tool: read_warehouse_rule ───────────────────────────────────────────
  server.tool(
    'read_warehouse_rule',
    'Read the full content of a specific warehouse rule.',
    {
      rule_id: z.string().describe('Rule ID — e.g. "RULE-001-global-scope" or "001"'),
    },
    async ({ rule_id }) => {
      let content = readWarehouseFile(`rules/${rule_id}.md`);
      if (!content) {
        try {
          const files = fs.readdirSync(path.join(warehouseDir, 'rules')).filter((f) => f.endsWith('.md'));
          const normalized = rule_id.replace(/^RULE-?/i, '');
          const match = files.find((f) => f === `${rule_id}.md` || f.replace(/^RULE-/, '').startsWith(normalized));
          if (match) content = readWarehouseFile(`rules/${match}`);
        } catch { /* ignore */ }
      }
      if (!content) {
        return { content: [{ type: 'text', text: `Rule "${rule_id}" not found.` }], isError: true };
      }
      return { content: [{ type: 'text', text: content }] };
    },
  );

  // ─── Tool: register_spec ───────────────────────────────────────────────────
  server.tool(
    'register_spec',
    `Register a game spec for building. ONLY call when the user EXPLICITLY says "register", "register game", or "register spec". NEVER call automatically after generating a spec.

First call (without skip_review): returns a review prompt. Execute the review, then:
- 0 Critical/Warning findings → call again with skip_review: true
- Has findings → show to user and STOP

After findings shown, user may say:
- "fix N issues" → fix in the SAME spec artifact, wait for user to say "register"
- "fix all" → fix all, re-call without skip_review. Max 5 cycles. Then ask user to confirm.
- "fix all and register" → fix all + register automatically when clean
- "skip review" → call with skip_review: true`,
    {
      game_id: z.string().describe('Unique game identifier (e.g. "doubles", "memory-match")'),
      title: z.string().optional().describe('Human-readable game title'),
      description: z.string().optional().describe('Brief description of the game'),
      spec_content: z.string().describe('Full markdown spec content'),
      skip_review: z.boolean().optional().describe('Set to true to skip review_spec gate — only when review already passed or user explicitly skipped'),
    },
    async ({ game_id, title, description, spec_content, skip_review }) => {
      if (!skip_review) {
        return {
          content: [{
            type: 'text',
            text: `REVIEW GATE: You MUST now call review_spec with game_id="${game_id}" and the same spec_content. Do NOT skip this step. Do NOT register without completing the review. After review_spec returns, follow its instructions.`,
          }],
        };
      }

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
          requestedBy: process.env.RALPH_SLACK_USER_ID || null,
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

  // ─── Tool: review_spec (INTERNAL — only called via register_spec) ────────
  server.tool(
    'review_spec',
    'INTERNAL TOOL — Do NOT call directly. Only call when register_spec instructs you to. Reviews a game spec for concept correctness, interaction flaws, broken promises, and completeness.',
    {
      game_id: z.string().describe('Game ID being reviewed'),
      spec_content: z.string().describe('Full markdown spec content to review'),
      auto_register: z.boolean().optional().describe('If true, auto-call register_spec when review is clean. Set to true only for "fix all and register" re-review cycles. Default: false — always wait for user to say "register".'),
    },
    async ({ game_id, spec_content, auto_register }) => {
      const reviewPrompt = readWarehouseFile('SPEC-REVIEW-PROMPT.md');
      if (!reviewPrompt) {
        return {
          content: [{ type: 'text', text: 'SPEC-REVIEW-PROMPT.md not found in warehouse.' }],
          isError: true,
        };
      }

      const cleanAction = auto_register
        ? `call register_spec with game_id="${game_id}", skip_review=true, and the same spec_content to complete registration.`
        : `STOP. Do NOT call register_spec. Tell the user the spec is clean and ready — wait for user to say "register".`;

      return {
        content: [{
          type: 'text',
          text: [
            '⚠️ OUTPUT RULE: Your findings MUST go into an artifact/document. NEVER output review findings as inline chat text.\n\n',
            '---\n\n',
            reviewPrompt,
            '\n---\n\n# Spec to Review\n\n',
            spec_content,
            '\n\n---\n\n',
            '## MANDATORY OUTPUT FORMAT (follow these steps in exact order)\n\n',
            `1. Create an artifact/document titled "[Game Title] — Review Findings" containing ALL findings as markdown. Do this FIRST before writing any chat text. NEVER paste findings inline in chat.\n`,
            '2. Execute the review internally and write the findings INTO the artifact — severity, category, what the spec says, the problem, and a suggested fix for each.\n',
            '3. After the artifact, write a short chat summary only: verdict + one line per finding. Under 10 lines. Do NOT repeat full findings in chat.\n\n',
            '## NEXT STEPS (execute immediately after presenting the artifact)\n\n',
            `- 0 Critical/Warning findings → ${cleanAction}\n`,
            '- Has Critical/Warning findings → show the artifact + chat summary, then STOP. Do NOT call register_spec.\n',
            '- Info-level findings do not block registration.\n\n',
            'After the user sees the findings, they may say:\n',
            `- "fix N issues" → fix those issues in the SAME spec artifact (update the spec artifact content with the fixes applied, never create a new one), then STOP and wait for user to say "register"\n`,
            `- "fix all" → fix ALL issues in the SAME spec artifact (update the spec artifact content with the fixes applied), then call review_spec again with game_id="${game_id}", auto_register=false, and the updated spec_content. Repeat until clean (max 5 cycles). When clean, STOP and wait for user to say "register".\n`,
            `- "fix all and register" → fix ALL issues in the SAME spec artifact (update the spec artifact content with the fixes applied), then call review_spec again with game_id="${game_id}", auto_register=true, and the updated spec_content. Repeat until clean (max 5 cycles). Auto-register when clean.\n`,
            '- "skip review" → call register_spec with skip_review=true\n',
          ].join('\n'),
        }],
      };
    },
  );

  return server;
}

module.exports = { createMcpServer };

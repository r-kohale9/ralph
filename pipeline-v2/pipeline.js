'use strict';

/**
 * Pipeline V2 — Main Orchestrator
 *
 * Uses a single Agent SDK session per build. The agent retains full context
 * across all steps: generate → validate → test → fix → visual review → final review.
 *
 * The agent has access to file tools (Read/Write/Edit/Bash/Glob/Grep) and
 * Playwright MCP for browser-based testing and visual verification.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createSession } = require('./agent');
const { buildPreGenerationPrompt } = require('../lib/prompts');
const { validateContract } = require('../lib/validate-contract');

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = {
  SPEC_VALIDATION: 'spec-validation',
  PRE_GENERATION: 'pre-generation',
  GENERATE: 'generate',
  VALIDATE: 'validate',
  TEST_FIX: 'test-fix',
  VISUAL_REVIEW: 'visual-review',
  FINAL_REVIEW: 'final-review',
  REJECTION_FIX: 'rejection-fix',
  CONTENT_GEN: 'content-gen',
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemContext(specContent, gameId, gameDir) {
  return `You are an expert HTML game developer working on a mobile educational game.

GAME ID: ${gameId}
WORKING DIRECTORY: ${gameDir}

You have access to:
- File tools (Read, Write, Edit, Bash, Glob, Grep) for creating and modifying files
- Playwright MCP for browser testing (navigate, screenshot, click, fill, evaluate console logs)

IMPORTANT RULES:
- ALL files you create or modify must be inside the working directory: ${gameDir}
- NEVER write files outside the working directory
- Do NOT write Playwright test script files. Use the Playwright MCP tools directly (browser_navigate, browser_screenshot, browser_click, browser_console_messages, etc.) to test the game interactively.
- Do NOT use any external CDN dependencies (no Google Fonts, no Bootstrap CDN, no Font Awesome CDN, no unpkg, no cdnjs). Everything must be inline in the single HTML file. LLMs frequently hallucinate CDN URLs that 404 — avoid them entirely.

MOBILE-FIRST RULES:
- Target viewport: ${config.VIEWPORT.width}×${config.VIEWPORT.height} (mobile)
- All CSS/JS must be inline in a single index.html file
- Touch targets: minimum 44px
- Font sizes: minimum 14px body, 16px+ for game text
- Use modern CSS (flexbox/grid), no external CDN dependencies
- Game states: start screen → gameplay → results screen
- All game logic, scoring, rounds, transitions must be fully functional

GAME SPECIFICATION:
<spec>
${specContent}
</spec>`;
}

function buildGeneratePrompt(gameDir) {
  return `Generate the complete single-file HTML game based on the specification above.

Write the output to: ${path.join(gameDir, 'index.html')}

Requirements:
1. Single index.html file with all CSS and JS inline
2. Fully playable on mobile (${config.VIEWPORT.width}×${config.VIEWPORT.height})
3. Visually polished with smooth transitions and animations
4. All game mechanics from the spec must work correctly
5. Proper game states: start screen → gameplay → results screen
6. Handle edge cases (no duplicate questions, proper reset between rounds)
7. Include scoring, lives/attempts, and round progression as specified
8. Touch-friendly with proper tap targets (44px minimum)

After writing the file, verify it exists and report its size.`;
}

function buildValidatePrompt(gameDir) {
  return `Validate the generated HTML game at ${path.join(gameDir, 'index.html')}.

Do the following checks:
1. Read the HTML file and verify it's valid HTML5
2. Check that all required game states exist (start, gameplay, results)
3. Verify no external CDN dependencies (everything must be inline)
4. Check for common issues: missing event listeners, undefined variables, syntax errors
5. Use Playwright MCP to open the file in the browser:
   - Navigate to file://${path.join(gameDir, 'index.html')}
   - Take a screenshot of the initial state
   - Check the browser console for any JavaScript errors
   - Verify the page loads without errors

If you find any issues, fix them immediately in the HTML file.
Report what you found and fixed.`;
}

function buildTestFixPrompt(gameDir) {
  const preGenDir = path.join(gameDir, 'pre-generation');
  const preGenHint = fs.existsSync(preGenDir)
    ? `\nPRE-GENERATION REFERENCE (read ONLY when you need to understand intended behavior for a fix):
${preGenDir}/ contains: game-flow.md, screens.md, round-flow.md, feedback.md, scoring.md.
The spec is authoritative — use pre-gen docs only to understand INTENT, not as a code source.\n`
    : '';
  return `Now thoroughly test the game using Playwright MCP tools and fix any issues you find.
${preGenHint}
IMPORTANT: Use the Playwright MCP tools directly (browser_navigate, browser_screenshot, browser_click, browser_console_messages, etc.) to interact with the game in the browser. Do NOT write Playwright test script files.

The game is at: file://${path.join(gameDir, 'index.html')}

You MUST test ALL 5 categories below. For EVERY issue you find, fix it immediately then re-test.

══════════════════════════════════════
CATEGORY 1: game-flow
══════════════════════════════════════
Test the full user journey from start to finish:
- Page loads without JS errors
- Start screen renders with title, instructions, start button
- Click start → game transitions to gameplay state
- Round/level transitions work (if multi-round)
- Play through to results screen
- Results screen shows score/stars/play-again
- Play Again button resets game to fresh state
- Timer starts/stops correctly (if applicable)

══════════════════════════════════════
CATEGORY 2: mechanics
══════════════════════════════════════
Test the core game interaction specified in the spec:
- Correct answer/action: visual feedback + score update + sound trigger
- Wrong answer/action: visual feedback + life/attempt deduction + sound trigger
- Score displays correctly and updates in real-time
- Points/progress calculation matches spec formula
- Difficulty changes between rounds/levels (if spec requires it)
- Game elements (grid, cards, bubbles, etc.) render correctly
- Content from fallbackContent loads and displays properly

══════════════════════════════════════
CATEGORY 3: level-progression
══════════════════════════════════════
Test the round/level/progression system:
- Round counter increments correctly
- Transition screens between rounds show correct info
- Lives/hearts system works (lose life on wrong, display updates)
- Game Over triggers when lives reach 0
- Star calculation on results screen matches spec thresholds
- Total rounds match spec (e.g. 5 rounds, 10 questions)
- Content changes between rounds (not identical)

══════════════════════════════════════
CATEGORY 4: edge-cases
══════════════════════════════════════
Test boundary conditions and error handling:
- Rapid clicking same element multiple times (should not double-count)
- Click disabled/already-answered elements (should be no-op)
- Browser resize: game fits 320px and 414px widths
- Touch targets are ≥44px
- No JS errors in console during full playthrough
- Game doesn't break if user clicks during transitions
- Memory: no runaway setInterval/setTimeout after game ends

══════════════════════════════════════
CATEGORY 5: contract
══════════════════════════════════════
Test the platform integration contract:
- window.gameState exists and is accessible
- gameState has required fields: phase, isActive, score/points, attempts[]
- postMessage handler for 'game_init' works (sends content, game receives it)
- recordAttempt creates properly shaped attempt objects with:
  attempt_timestamp, time_since_start_of_game, input_of_user, attempt_number, correct, metadata
- trackEvent fires game_start and game_end events
- Debug functions exist: debugGame(), debugAudio()
- FeedbackManager integration: sound.preload(), sound.register(), playDynamicFeedback
- SubtitleComponent.show() called for correct/wrong feedback
- syncDOMState updates data-* attributes on #app
- game_complete postMessage schema (CRITICAL):
  - postMessage({ type: 'game_complete', data: { metrics: {...}, completedAt: Date.now() } })
  - metrics MUST include: accuracy (0-100), time (seconds), stars (0-3), attempts (array), duration_data
  - metrics SHOULD include: totalLives (integer, default 1), tries (per-round attempt counts)
  - data MUST include: completedAt (timestamp)
  - Payload must NOT be flat (score/stars at top level) — must be nested in data.metrics
- SignalCollector integration (if signalCollector is used):
  - window.signalCollector is accessible
  - signalCollector.startFlushing() called after game_init config sets flushUrl from signalConfig
  - signalCollector.recordViewEvent() called on screen transitions and DOM changes
  - signalCollector.seal() called in endGame before postMessage
  - game_complete data includes signal_event_count and signal_metadata (NOT raw signal events)

══════════════════════════════════════
OUTPUT FORMAT (MANDATORY)
══════════════════════════════════════

After all testing is complete, output your results in EXACTLY this format:

TEST_RESULTS:
game-flow: <passed>/<total>
mechanics: <passed>/<total>
level-progression: <passed>/<total>
edge-cases: <passed>/<total>
contract: <passed>/<total>

Then for each category, list what you tested:
CATEGORY_DETAIL: game-flow
- [PASS] Page loads without JS errors
- [PASS] Start screen renders correctly
- [FAIL] Timer does not stop on game over (FIXED)
- [PASS] Results screen shows correct stars

CATEGORY_DETAIL: mechanics
- [PASS] Correct tap highlights green and adds points
...etc for all 5 categories.

ISSUES_FIXED:
- <description of each issue fixed>`;
}

function buildVisualReviewPrompt(gameDir) {
  const preGenDir = path.join(gameDir, 'pre-generation');
  const preGenHint = fs.existsSync(preGenDir)
    ? `\nPRE-GENERATION REFERENCE (read screens.md and game-flow.md to understand intended layout):
${preGenDir}/ contains: game-flow.md, screens.md, round-flow.md, feedback.md, scoring.md.
The spec is authoritative — use pre-gen docs only to verify visual intent matches implementation.\n`
    : '';
  return `Perform a visual UI/UX review of the game using Playwright MCP.
${preGenHint}
Navigate to: file://${path.join(gameDir, 'index.html')}

REVIEW CHECKLIST:
1. **Layout & Spacing**
   - Is content properly centered and aligned?
   - Are margins/padding consistent?
   - Does nothing overflow or get cut off on ${config.VIEWPORT.width}×${config.VIEWPORT.height}?
   - Take a full-page screenshot

2. **Typography**
   - Are fonts readable at mobile size?
   - Is there proper hierarchy (headings vs body)?
   - Are text colors contrasting enough against backgrounds?

3. **Touch Targets**
   - Are all interactive elements at least 44px?
   - Is there enough spacing between tap targets?
   - Are buttons clearly styled as interactive?

4. **Visual Polish**
   - Are colors harmonious and appealing?
   - Are transitions/animations smooth?
   - Does the game look professional?
   - Is feedback clear (correct/incorrect responses)?

5. **Game States**
   - Screenshot and review: start screen
   - Screenshot and review: mid-gameplay
   - Screenshot and review: results screen
   - Are transitions between states smooth?

6. **Accessibility**
   - Color contrast ratios
   - Text readability
   - Clear visual feedback for interactions

For each issue found:
- Classify as CRITICAL (must fix) or WARNING (nice to fix)
- Fix CRITICAL issues immediately in the HTML
- Re-test after fixes

Provide your final verdict using EXACTLY this format on its own line:
VERDICT: APPROVED
or
VERDICT: NEEDS_FIX

List all issues found, one per line, using this format:
ISSUE: [critical] description here
ISSUE: [warning] description here`;
}

function buildFinalReviewPrompt(gameDir) {
  const preGenDir = path.join(gameDir, 'pre-generation');
  const preGenHint = fs.existsSync(preGenDir)
    ? `\nPRE-GENERATION REFERENCE (read to verify intended flows match implementation):
${preGenDir}/ contains: game-flow.md, screens.md, round-flow.md, feedback.md, scoring.md.
The spec is authoritative — use pre-gen docs to cross-check visual layout and interaction intent.\n`
    : '';
  return `Perform a final comprehensive review of the game.
${preGenHint}
Game file: ${path.join(gameDir, 'index.html')}

Compare the implemented game against the original specification provided at the start of this session.

REVIEW CRITERIA:
1. **Spec Compliance** — Does the game implement ALL requirements from the spec?
   - Game mechanics (interaction type, rules, progression)
   - Scoring system (points, stars, thresholds)
   - Round/level structure
   - Lives/attempts system
   - Content/questions as specified
   - Visual theme and styling requirements

2. **Functionality** — Open the game in Playwright and verify:
   - Complete playthrough works end-to-end
   - All game states function correctly
   - No console errors
   - Scoring is accurate
   - Results screen shows correct data

3. **Quality** — Is the game production-ready?
   - Professional visual appearance
   - Smooth user experience
   - No bugs or glitches
   - Responsive on mobile viewport

Fix any final issues you find.

Provide your output using EXACTLY these formats:

Spec compliance score on its own line:
SCORE: 85%

Any remaining issues, one per line:
ISSUE: [critical] description here
ISSUE: [warning] description here

Your final verdict on its own line:
VERDICT: APPROVED
or
VERDICT: REJECTED`;
}

function buildFeedbackFixPrompt(gameDir, feedback) {
  return `A user has provided feedback about the game. Please address their feedback.

Game file: ${path.join(gameDir, 'index.html')}

USER FEEDBACK:
${feedback}

Instructions:
1. Read the current game HTML
2. Understand the feedback and identify what needs to change
3. Make the necessary fixes/improvements
4. Use Playwright MCP to verify your changes work:
   - Open the game in the browser
   - Test the specific areas mentioned in the feedback
   - Take screenshots to confirm the fix
   - Check console for errors
5. Report what you changed and how it addresses the feedback`;
}

function buildRejectionFixPrompt(gameDir, rejectionReasons, issues, score) {
  let context = `The final review REJECTED this game.`;
  if (score != null) context += ` Spec compliance score: ${score}%.`;
  context += `\n\nREJECTION REASONS:\n`;
  for (const r of rejectionReasons) {
    context += `- ${r}\n`;
  }
  if (issues && issues.length > 0) {
    context += `\nISSUES TO FIX:\n`;
    for (const iss of issues) {
      context += `- [${iss.severity}] ${iss.description}\n`;
    }
  }

  return `${context}
Game file: ${path.join(gameDir, 'index.html')}

Instructions:
1. Read the current game HTML
2. Address EVERY rejection reason and issue listed above
3. Focus on fixing CRITICAL issues first, then warnings
4. Use Playwright MCP to verify each fix works:
   - Open the game in the browser
   - Test the specific areas that were flagged
   - Take screenshots to confirm fixes
   - Check console for errors
5. After all fixes, do a final playthrough to confirm the game works end-to-end

Report what you changed and confirm each rejection reason is addressed.`;
}

function buildReReviewPrompt(gameDir) {
  return `Re-review the game after fixes were applied.

Game file: ${path.join(gameDir, 'index.html')}

The game was previously REJECTED and fixes have been applied. Perform a focused review:

1. Open the game in Playwright and do a complete playthrough
2. Verify the previously reported issues are now fixed
3. Check for any new issues introduced by the fixes
4. Verify spec compliance

Provide your output using EXACTLY these formats:

Spec compliance score on its own line:
SCORE: 85%

Any remaining issues, one per line:
ISSUE: [critical] description here
ISSUE: [warning] description here

Your final verdict on its own line:
VERDICT: APPROVED
or
VERDICT: REJECTED`;
}

function buildContentGenPrompt(gameDir, { gameId, buildId } = {}) {
  const gameVersion = `${process.env.RALPH_GAME_VERSION || '1.0.0'}-b${buildId || 0}`;
  return `The game has been APPROVED. Now generate content sets, register the game, and upload everything via the Core API.

You already know this game inside-out — you built it, tested it, and reviewed it.

Game file: ${path.join(gameDir, 'index.html')}
Game ID: ${gameId || path.basename(gameDir)}

═══════════════════════════════════════
STEP 1: Extract inputSchema (JSON Schema draft-07)
═══════════════════════════════════════
Read the game's HTML and extract the EXACT content structure it expects via postMessage game_init.

Look at:
1. The fallbackContent object — this IS the canonical shape
2. The handlePostMessage / game_init handler — what fields it reads from event.data.data.content

Generate a JSON Schema (draft-07) that matches fallbackContent exactly:
- Every top-level field → required property
- Arrays → describe item schema from actual objects
- Preserve types, nesting, and field names exactly

Save to: ${path.join(gameDir, 'inputSchema.json')}

═══════════════════════════════════════
STEP 2: Register the game via Core API
═══════════════════════════════════════
Use a node script (via Bash) to register the game. The API credentials are in environment variables.

\`\`\`javascript
// Run via: node -e '<this script>'
const fs = require('fs');
const CORE_API_URL = process.env.CORE_API_URL;
const CORE_API_TOKEN = process.env.CORE_API_TOKEN;
const htmlContent = fs.readFileSync('${path.join(gameDir, 'index.html')}', 'utf-8');
const inputSchema = JSON.parse(fs.readFileSync('${path.join(gameDir, 'inputSchema.json')}', 'utf-8'));

const res = await fetch(CORE_API_URL + '/api/games/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CORE_API_TOKEN },
  body: JSON.stringify({
    name: '${(gameId || '').replace(/'/g, "\\'")}',
    version: '${gameVersion}',
    metadata: {
      title: '<game title from spec>',
      description: '<game title> game',
      concepts: [],
      difficulty: 'medium',
      estimatedTime: 300,
      minGrade: 1,
      maxGrade: 12,
      type: 'practice',
    },
    capabilities: { tracks: ['accuracy', 'time', 'stars'], provides: ['score', 'stars'] },
    inputSchema,
    artifactContent: htmlContent,
    publishedBy: 'ralph-pipeline-v2',
  }),
});

const body = await res.json();
console.log(JSON.stringify(body, null, 2));
// body.data.id = publishedGameId
// body.data.artifactUrl = CDN URL
\`\`\`

Extract publishedGameId and artifactUrl from the response.
If registration fails (non-2xx), log the error and stop.

═══════════════════════════════════════
STEP 3: Generate 2-6 content sets
═══════════════════════════════════════
CRITICAL: You MUST create at least ONE content set. Without content sets, the game link is useless — nothing will render.

**Default content set (MANDATORY):**
First, create a "Default" content set using the EXACT fallbackContent from the HTML file. This is your guaranteed-working baseline:
- Read the fallbackContent object from the game HTML
- Use it directly as the content JSON (it's already in the correct format)
- Set difficulty: "medium", give it a descriptive name like "<Game Title> — Default"
- This set is guaranteed to work since the game already runs with it

**Additional content sets (2-5 more):**
Generate varied content sets beyond the default:
- Consider axes of variation: difficulty, target numbers, grid size, theme, grade level, speed, etc.
- Each set: descriptive name, difficulty (easy/medium/hard), grade (1-12), concept tags, and the content JSON
- Content must be mathematically correct and educationally sound
- Each content JSON must conform to the inputSchema you generated
- Vary content meaningfully — don't just change one number

IMPORTANT: Validate each content set actually works by loading it in the game via Playwright/browser test.

═══════════════════════════════════════
STEP 4: Upload each content set via Core API
═══════════════════════════════════════
For each content set, POST to the Core API:

\`\`\`javascript
const res = await fetch(CORE_API_URL + '/api/content-sets/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CORE_API_TOKEN },
  body: JSON.stringify({
    gameId: '<publishedGameId from step 2>',
    name: '<game title> — <set name>',
    description: 'Auto-generated: <set name>',
    grade: <integer>,
    difficulty: '<easy|medium|hard>',
    concepts: ['<tag1>', '<tag2>'],
    content: <the content JSON object>,
    createdBy: 'ralph-pipeline-v2',
  }),
});
// Response: body.data.id = contentSetId, body.data.isValid = true/false
\`\`\`

Log each content set creation result. If a set fails validation (isValid=false), log the validationErrors.

═══════════════════════════════════════
STEP 5: Output the final result
═══════════════════════════════════════
The game link format is: https://learn.mathai.ai/game/<publishedGameId>/<contentSetId>
Prefer a medium-difficulty content set for the primary link.

After ALL API calls are done, output this EXACT block at the end:

PUBLISH_RESULT:
\`\`\`json
{
  "publishedGameId": "<id from registration>",
  "artifactUrl": "<CDN URL from registration>",
  "gameLink": "https://learn.mathai.ai/game/<publishedGameId>/<bestContentSetId>",
  "contentSets": [
    { "id": "<contentSetId>", "name": "<set name>", "difficulty": "<easy|medium|hard>", "grade": <N>, "valid": <true|false> }
  ],
  "inputSchemaProps": <number of schema properties>
}
\`\`\`

This PUBLISH_RESULT block is CRITICAL — it's how the pipeline knows what was published.`;
}

/**
 * Parse PUBLISH_RESULT from the agent's content-gen step output.
 * The agent registers the game, generates + uploads content sets, and returns
 * a single JSON block with all publish info.
 *
 * @returns {{ publish: object|null }}
 */
function _parsePublishResult(text) {
  if (!text) return { publish: null };

  // Match PUBLISH_RESULT: ```json { ... } ``` — flexible with markdown variations
  const match = text.match(/\*{0,2}PUBLISH_RESULT\*{0,2}:?\s*```json\s*\n([\s\S]*?)```/);
  if (!match) return { publish: null };

  try {
    const data = JSON.parse(match[1].trim());
    // Validate required fields
    if (!data.publishedGameId) return { publish: null };
    return {
      publish: {
        gameId: data.publishedGameId,
        artifactUrl: data.artifactUrl || null,
        gameLink: data.gameLink || `https://learn.mathai.ai/game/${data.publishedGameId}`,
        contentSets: (data.contentSets || []).map((cs) => ({
          id: cs.id,
          name: cs.name || 'unnamed',
          difficulty: cs.difficulty || 'medium',
          grade: cs.grade || 4,
          valid: cs.valid !== false,
        })),
        inputSchemaProps: data.inputSchemaProps || 0,
        publishedAt: new Date().toISOString().slice(0, 10),
        inputSchemaSource: 'agent-session',
      },
    };
  } catch {
    // Try extracting just the JSON object
    try {
      const jsonMatch = match[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.publishedGameId) {
          return {
            publish: {
              gameId: data.publishedGameId,
              artifactUrl: data.artifactUrl || null,
              gameLink: data.gameLink || `https://learn.mathai.ai/game/${data.publishedGameId}`,
              contentSets: data.contentSets || [],
              inputSchemaProps: data.inputSchemaProps || 0,
              publishedAt: new Date().toISOString().slice(0, 10),
              inputSchemaSource: 'agent-session',
            },
          };
        }
      }
    } catch {}
    return { publish: null };
  }
}

// ─── Spec validation ──────────────────────────────────────────────────────────

/**
 * Validate spec structure before expensive pipeline steps.
 * Returns { valid, warnings, errors }.
 */
function _validateSpec(specContent) {
  const errors = [];
  const warnings = [];

  if (!specContent || specContent.length < 200) {
    errors.push('Spec too short (< 200 chars) — likely truncated or empty');
    return { valid: false, warnings, errors };
  }

  // Must have a title (H1)
  if (!/^#\s+.+/m.test(specContent)) {
    errors.push('Missing H1 title (# Game Title)');
  }

  // Should describe game mechanics
  const mechanicsPatterns = [
    /game\s*mechanic/i,
    /gameplay/i,
    /interaction/i,
    /how\s*(?:to|it)\s*(?:play|work)/i,
    /click|tap|drag|swipe|select|choose|match|sort|arrange/i,
  ];
  if (!mechanicsPatterns.some((p) => p.test(specContent))) {
    warnings.push('No game mechanics description found — agent may guess incorrectly');
  }

  // Should mention scoring or progression
  if (!/scor|point|star|round|level|progress|attempt|lives/i.test(specContent)) {
    warnings.push('No scoring/progression system described');
  }

  // Should have some structure (headers or sections)
  const headerCount = (specContent.match(/^#{1,3}\s+/gm) || []).length;
  if (headerCount < 2) {
    warnings.push(`Only ${headerCount} section header(s) — spec may lack detail`);
  }

  // Check for handlePostMessage implementation (PART-008/010 critical pattern)
  if (!/handlePostMessage/i.test(specContent) && !/signalConfig/i.test(specContent)) {
    warnings.push(
      'Spec does not include handlePostMessage or signalConfig — verify signalCollector setup in generated HTML',
    );
  }

  return { valid: errors.length === 0, warnings, errors };
}

// ─── Main pipeline runner ─────────────────────────────────────────────────────

/**
 * Run the full V2 pipeline for a single game.
 *
 * @param {object} opts
 * @param {string}  opts.gameId         — unique game identifier
 * @param {string}  opts.specPath       — path to the game spec markdown
 * @param {string}  opts.gameDir        — output directory for the game
 * @param {string}  [opts.model]        — Claude model to use
 * @param {string[]} [opts.additionalDirectories] — extra dirs for agent access
 * @param {object}  [opts.log]          — logger { info, warn, error }
 * @param {function} [opts.onProgress]  — progress callback
 * @returns {Promise<object>} Pipeline report
 */
async function runPipeline({ gameId, specPath, gameDir, buildId, model, additionalDirectories = [], log, onProgress }) {
  const logger = log || { info: console.log, warn: console.warn, error: console.error };
  const startTime = Date.now();

  // Ensure output directory exists
  fs.mkdirSync(gameDir, { recursive: true });

  // Read the spec
  const specContent = fs.readFileSync(specPath, 'utf-8');
  logger.info(`[pipeline] Game: ${gameId} | Spec: ${specPath} (${specContent.length} chars)`);

  const report = {
    gameId,
    status: 'running',
    steps: {},
    errors: [],
    startTime: new Date().toISOString(),
  };

  const progress = async (event) => {
    if (onProgress) {
      try {
        await onProgress({ ...event, gameId, elapsed: ((Date.now() - startTime) / 1000).toFixed(1) });
      } catch (e) {
        logger.warn(`[pipeline] Progress callback error: ${e.message}`);
      }
    }
  };

  // ── Step 0: Spec pre-validation ───────────────────────────────────────────
  await progress({ type: 'pipeline-step', step: STEPS.SPEC_VALIDATION, status: 'running' });

  const specCheck = _validateSpec(specContent);
  report.specValidation = specCheck;

  if (!specCheck.valid) {
    logger.error(`[pipeline] Spec validation FAILED: ${specCheck.errors.join('; ')}`);
    report.status = 'FAILED';
    report.errors.push(`Spec validation failed: ${specCheck.errors.join('; ')}`);
    await progress({
      type: 'pipeline-step',
      step: STEPS.SPEC_VALIDATION,
      status: 'done',
      valid: false,
      errors: specCheck.errors,
      warnings: specCheck.warnings,
    });
    await progress({ type: 'pipeline-error', error: `Spec validation: ${specCheck.errors.join('; ')}` });
    return report;
  }

  if (specCheck.warnings.length > 0) {
    for (const w of specCheck.warnings) logger.warn(`[pipeline] Spec warning: ${w}`);
  }
  logger.info(`[pipeline] Spec validation passed (${specCheck.warnings.length} warning(s))`);
  await progress({
    type: 'pipeline-step',
    step: STEPS.SPEC_VALIDATION,
    status: 'done',
    valid: true,
    errors: [],
    warnings: specCheck.warnings,
  });

  // ── Step 0.5: Pre-Generation Analysis ───────────────────────────────────
  // Produces a visual flow document for human review (Slack/GCS).
  // NOT injected into the agent session — purely for human consumption.
  const preGenDir = path.join(gameDir, 'pre-generation');

  // Section definitions — order matters for concatenation
  const PRE_GEN_SECTIONS = [
    { id: 'game-flow', emoji: '🗺️', name: 'Game Flow', header: '## 🗺️' },
    { id: 'screens', emoji: '📱', name: 'Screens', header: '## 📱' },
    { id: 'round-flow', emoji: '🔄', name: 'Round Flow', header: '## 🔄' },
    { id: 'feedback', emoji: '⚡', name: 'Feedback Moments', header: '## ⚡' },
    { id: 'scoring', emoji: '📊', name: 'Scoring', header: '## 📊' },
  ];

  /**
   * Split the full pre-generation markdown into sections by H2 emoji headers.
   * Returns an array of { id, emoji, name, content } objects.
   */
  function splitPreGenSections(fullText) {
    const sections = [];
    // Extract title + one-liner (everything before the first known section header)
    const firstSectionIdx = PRE_GEN_SECTIONS.reduce((min, s) => {
      const idx = fullText.indexOf(s.header);
      return idx >= 0 && idx < min ? idx : min;
    }, fullText.length);
    const preamble = fullText.slice(0, firstSectionIdx).trim();

    for (let i = 0; i < PRE_GEN_SECTIONS.length; i++) {
      const sec = PRE_GEN_SECTIONS[i];
      const startIdx = fullText.indexOf(sec.header);
      if (startIdx < 0) continue;

      // Find next section start or end of text
      let endIdx = fullText.length;
      for (let j = i + 1; j < PRE_GEN_SECTIONS.length; j++) {
        const nextIdx = fullText.indexOf(PRE_GEN_SECTIONS[j].header);
        if (nextIdx >= 0) {
          endIdx = nextIdx;
          break;
        }
      }

      let content = fullText.slice(startIdx, endIdx).trim();
      // Prepend preamble (title + one-liner) to the first section
      if (sections.length === 0 && preamble) {
        content = preamble + '\n\n' + content;
      }
      sections.push({ ...sec, content });
    }

    // Fallback: if no sections were found, save everything as game-flow
    if (sections.length === 0 && fullText.trim().length > 0) {
      sections.push({ id: 'game-flow', emoji: '🗺️', name: 'Game Flow', content: fullText.trim() });
    }

    return sections;
  }

  // Backward compat: migrate old single-file pre-generation.md to directory format
  const oldPreGenFile = path.join(gameDir, 'pre-generation.md');
  if (fs.existsSync(oldPreGenFile) && !fs.existsSync(preGenDir)) {
    const oldContent = fs.readFileSync(oldPreGenFile, 'utf-8');
    if (oldContent.length > 500) {
      logger.info('[pipeline] Step 0.5: Migrating old pre-generation.md to directory format');
      const sections = splitPreGenSections(oldContent);
      if (!fs.existsSync(preGenDir)) fs.mkdirSync(preGenDir, { recursive: true });
      for (const sec of sections) {
        fs.writeFileSync(path.join(preGenDir, `${sec.id}.md`), sec.content);
      }
    }
  }

  // Check for cached section files
  if (fs.existsSync(preGenDir) && fs.readdirSync(preGenDir).filter((f) => f.endsWith('.md')).length > 0) {
    const mdFiles = fs
      .readdirSync(preGenDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    const totalChars = mdFiles.reduce((sum, f) => sum + fs.statSync(path.join(preGenDir, f)).size, 0);
    const sectionNames = mdFiles.map((f) => f.replace('.md', ''));
    logger.info(`[pipeline] Step 0.5: Loaded ${mdFiles.length} cached pre-generation sections (${totalChars} chars)`);
    await progress({
      type: 'pipeline-step',
      step: STEPS.PRE_GENERATION,
      status: 'done',
      chars: totalChars,
      cached: true,
      sections: sectionNames,
    });
  } else {
    await progress({ type: 'pipeline-step', step: STEPS.PRE_GENERATION, status: 'running' });
    const preGenStart = Date.now();
    try {
      // Use a one-shot agent session (no tools needed) to generate the pre-generation analysis
      const preGenSession = await createSession({
        gameDir,
        specPath,
        model: model || config.GEN_MODEL,
        additionalDirectories: [],
        log: logger,
        onProgress: null,
      });
      const preGenPrompt = buildPreGenerationPrompt(specContent);
      const preGenResult = await preGenSession.send('pre-generation', preGenPrompt);
      if (preGenResult.text && preGenResult.text.length > 200) {
        const fullText = preGenResult.text;
        const sections = splitPreGenSections(fullText);

        // Create pre-generation directory and save each section
        if (!fs.existsSync(preGenDir)) fs.mkdirSync(preGenDir, { recursive: true });
        const sectionNames = [];
        for (const sec of sections) {
          const filePath = path.join(preGenDir, `${sec.id}.md`);
          fs.writeFileSync(filePath, sec.content);
          sectionNames.push(sec.id);
        }
        logger.info(
          `[pipeline] Step 0.5: Pre-generation complete — ${sections.length} sections (${fullText.length} chars, ${Math.round((Date.now() - preGenStart) / 1000)}s)`,
        );
        await progress({
          type: 'pipeline-step',
          step: STEPS.PRE_GENERATION,
          status: 'done',
          chars: fullText.length,
          elapsed: Math.round((Date.now() - preGenStart) / 1000),
          sections: sectionNames,
        });
      } else {
        logger.warn('[pipeline] Step 0.5: Pre-generation returned insufficient text — proceeding without it');
        await progress({
          type: 'pipeline-step',
          step: STEPS.PRE_GENERATION,
          status: 'done',
          chars: 0,
          elapsed: Math.round((Date.now() - preGenStart) / 1000),
          sections: [],
        });
      }
    } catch (err) {
      // degraded: pre-generation is optional enrichment — pipeline can proceed without it
      logger.warn(`[pipeline] Step 0.5: Pre-generation failed: ${err.message} — proceeding without it`);
      await progress({ type: 'pipeline-step', step: STEPS.PRE_GENERATION, status: 'failed', error: err.message });
    }
  }

  // ── Create single agent session ─────────────────────────────────────────
  let session;
  try {
    session = await createSession({
      gameDir,
      specPath,
      model: model || config.GEN_MODEL,
      additionalDirectories,
      log: logger,
      onProgress: progress,
    });
  } catch (err) {
    logger.error(`[pipeline] Failed to create session: ${err.message}`);
    report.status = 'FAILED';
    report.errors.push(`Session creation failed: ${err.message}`);
    return report;
  }

  // Enable per-step transcript saving — captures every raw SDK message
  const transcriptFile = path.join(gameDir, `transcript-b${buildId || 0}.jsonl`);
  session.setTranscriptPath(transcriptFile);

  try {
    // ── Step 1: Generate HTML ───────────────────────────────────────────────
    await progress({ type: 'pipeline-step', step: STEPS.GENERATE, status: 'running' });

    const systemPrompt = buildSystemContext(specContent, gameId, gameDir);
    const generatePrompt = `${systemPrompt}\n\n${buildGeneratePrompt(gameDir)}`;

    const genResult = await session.send(STEPS.GENERATE, generatePrompt);
    report.steps.generate = { turns: genResult.turns, toolUses: genResult.toolUses, error: genResult.error };

    if (genResult.error || genResult.done) {
      throw new Error(genResult.error || 'Session ended during generation');
    }

    // Verify HTML was created
    const htmlPath = path.join(gameDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('Agent did not create index.html');
    }
    const htmlSize = fs.statSync(htmlPath).size;
    logger.info(`[pipeline] Generated HTML: ${(htmlSize / 1024).toFixed(1)}KB`);
    report.htmlSize = htmlSize;

    await progress({
      type: 'pipeline-step',
      step: STEPS.GENERATE,
      status: 'done',
      htmlSize,
      turns: genResult.turns,
      toolUses: genResult.toolUses,
      toolNames: genResult.toolNames,
    });

    // ── Step 1.5: Deterministic contract validation ─────────────────────────
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const contractErrors = validateContract(htmlContent);
    if (contractErrors.length > 0) {
      logger.warn(`[pipeline] Contract validation: ${contractErrors.length} issue(s)`);
      report.contractValidation = { errors: contractErrors };
      const errorList = contractErrors.map((e) => `- ${e}`).join('\n');
      await session.send(
        'deterministic-fix',
        `DETERMINISTIC VALIDATION found ${contractErrors.length} contract error(s) in the generated HTML. Fix ALL of these before proceeding:\n\n${errorList}\n\nRead ${htmlPath}, fix each issue, and save.`,
      );
      logger.info('[pipeline] Deterministic fix step completed');
    }

    // ── Step 2: Validate ────────────────────────────────────────────────────
    await progress({ type: 'pipeline-step', step: STEPS.VALIDATE, status: 'running' });

    const validateResult = await session.send(STEPS.VALIDATE, buildValidatePrompt(gameDir));
    report.steps.validate = {
      turns: validateResult.turns,
      toolUses: validateResult.toolUses,
      text: validateResult.text?.slice(0, 5000),
    };

    if (validateResult.done) {
      throw new Error(validateResult.error || 'Session ended during validation');
    }

    await progress({
      type: 'pipeline-step',
      step: STEPS.VALIDATE,
      status: 'done',
      turns: validateResult.turns,
      toolUses: validateResult.toolUses,
      toolNames: validateResult.toolNames,
      summary: _extractSummary(validateResult.text),
    });

    // ── Step 3: Test & Fix ──────────────────────────────────────────────────
    await progress({ type: 'pipeline-step', step: STEPS.TEST_FIX, status: 'running' });

    const testResult = await session.send(STEPS.TEST_FIX, buildTestFixPrompt(gameDir));
    report.steps.testFix = {
      turns: testResult.turns,
      toolUses: testResult.toolUses,
      text: testResult.text?.slice(0, 8000),
    };

    if (testResult.done) {
      throw new Error(testResult.error || 'Session ended during testing');
    }

    // Parse structured per-category test results
    const categoryResults = _parseCategoryResults(testResult.text);
    report.categoryResults = categoryResults.categories;
    report.steps.testFix.categoryResults = categoryResults.categories;
    report.steps.testFix.totalPassed = categoryResults.totalPassed;
    report.steps.testFix.totalTests = categoryResults.totalTests;

    // Count issues found/fixed from agent output
    const testIssues = _countIssues(testResult.text);
    report.steps.testFix.issuesFound = testIssues.found || categoryResults.issuesFixed.length;
    report.steps.testFix.issuesFixed = testIssues.fixed || categoryResults.issuesFixed.length;
    report.steps.testFix.issuesFixedDescriptions = categoryResults.issuesFixed;

    const testIssueDescriptions = _extractIssueDescriptions(testResult.text);
    if (testIssueDescriptions.length === 0 && categoryResults.issuesFixed.length > 0) {
      testIssueDescriptions.push(...categoryResults.issuesFixed);
    }

    await progress({
      type: 'pipeline-step',
      step: STEPS.TEST_FIX,
      status: 'done',
      turns: testResult.turns,
      toolUses: testResult.toolUses,
      toolNames: testResult.toolNames,
      issuesFound: report.steps.testFix.issuesFound,
      issuesFixed: report.steps.testFix.issuesFixed,
      issueDescriptions: testIssueDescriptions,
      categoryResults: categoryResults.categories,
      totalPassed: categoryResults.totalPassed,
      totalTests: categoryResults.totalTests,
      summary: _extractSummary(testResult.text),
    });

    // ── Step 4: Visual Review ───────────────────────────────────────────────
    await progress({ type: 'pipeline-step', step: STEPS.VISUAL_REVIEW, status: 'running' });

    const visualResult = await session.send(STEPS.VISUAL_REVIEW, buildVisualReviewPrompt(gameDir));
    report.steps.visualReview = {
      turns: visualResult.turns,
      toolUses: visualResult.toolUses,
      text: visualResult.text?.slice(0, 5000),
    };

    // Parse visual review verdict
    const visualVerdict = _parseVerdict(visualResult.text);
    report.visualVerdict = visualVerdict;

    if (visualResult.done) {
      throw new Error(visualResult.error || 'Session ended during visual review');
    }

    await progress({
      type: 'pipeline-step',
      step: STEPS.VISUAL_REVIEW,
      status: 'done',
      turns: visualResult.turns,
      toolUses: visualResult.toolUses,
      toolNames: visualResult.toolNames,
      verdict: visualVerdict,
      summary: _extractSummary(visualResult.text),
    });

    // ── Step 5: Final Review ────────────────────────────────────────────────
    await progress({ type: 'pipeline-step', step: STEPS.FINAL_REVIEW, status: 'running' });

    const finalResult = await session.send(STEPS.FINAL_REVIEW, buildFinalReviewPrompt(gameDir));
    report.steps.finalReview = {
      turns: finalResult.turns,
      toolUses: finalResult.toolUses,
      text: finalResult.text?.slice(0, 5000),
    };

    // Parse final verdict
    let finalVerdict = _parseVerdict(finalResult.text);
    report.finalVerdict = finalVerdict;
    report.status = finalVerdict.verdict === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    if (finalVerdict.verdict === 'REJECTED' && finalVerdict.issues.length > 0) {
      report.rejectionReasons = finalVerdict.issues.map((i) => i.description);
    }

    await progress({
      type: 'pipeline-step',
      step: STEPS.FINAL_REVIEW,
      status: 'done',
      turns: finalResult.turns,
      toolUses: finalResult.toolUses,
      toolNames: finalResult.toolNames,
      verdict: finalVerdict,
      summary: _extractSummary(finalResult.text),
    });

    // ── Step 6: Rejection Fix Loop (up to 2 attempts) ─────────────────────
    const MAX_REJECTION_FIX_ATTEMPTS = 2;
    let rejectionFixAttempt = 0;

    while (report.status === 'REJECTED' && rejectionFixAttempt < MAX_REJECTION_FIX_ATTEMPTS) {
      rejectionFixAttempt++;
      const rejReasons = report.rejectionReasons || ['Review rejected without specific reasons'];
      const rejIssues = finalVerdict.issues || [];

      logger.info(`[pipeline] Rejection fix attempt ${rejectionFixAttempt}/${MAX_REJECTION_FIX_ATTEMPTS}`);
      await progress({
        type: 'pipeline-step',
        step: STEPS.REJECTION_FIX,
        status: 'running',
        attempt: rejectionFixAttempt,
      });

      // Fix
      const fixResult = await session.send(
        `${STEPS.REJECTION_FIX}-${rejectionFixAttempt}`,
        buildRejectionFixPrompt(gameDir, rejReasons, rejIssues, finalVerdict.score),
      );

      if (fixResult.error || fixResult.done) {
        logger.warn(`[pipeline] Rejection fix ${rejectionFixAttempt} failed: ${fixResult.error || 'session ended'}`);
        await progress({
          type: 'pipeline-step',
          step: STEPS.REJECTION_FIX,
          status: 'done',
          attempt: rejectionFixAttempt,
          turns: fixResult.turns,
          toolUses: fixResult.toolUses,
          toolNames: fixResult.toolNames,
          error: fixResult.error,
          summary: 'Fix attempt failed — stopping',
        });
        break;
      }

      await progress({
        type: 'pipeline-step',
        step: STEPS.REJECTION_FIX,
        status: 'done',
        attempt: rejectionFixAttempt,
        turns: fixResult.turns,
        toolUses: fixResult.toolUses,
        toolNames: fixResult.toolNames,
        summary: _extractSummary(fixResult.text),
      });

      // Re-review
      logger.info(`[pipeline] Re-review after rejection fix ${rejectionFixAttempt}`);
      await progress({
        type: 'pipeline-step',
        step: STEPS.FINAL_REVIEW,
        status: 'running',
        attempt: rejectionFixAttempt + 1,
      });

      const reReviewResult = await session.send(
        `${STEPS.FINAL_REVIEW}-${rejectionFixAttempt + 1}`,
        buildReReviewPrompt(gameDir),
      );

      finalVerdict = _parseVerdict(reReviewResult.text);
      report.finalVerdict = finalVerdict;
      report.status = finalVerdict.verdict === 'APPROVED' ? 'APPROVED' : 'REJECTED';

      if (finalVerdict.verdict === 'REJECTED' && finalVerdict.issues.length > 0) {
        report.rejectionReasons = finalVerdict.issues.map((i) => i.description);
      } else if (finalVerdict.verdict === 'APPROVED') {
        report.rejectionReasons = [];
      }

      await progress({
        type: 'pipeline-step',
        step: STEPS.FINAL_REVIEW,
        status: 'done',
        attempt: rejectionFixAttempt + 1,
        turns: reReviewResult.turns,
        toolUses: reReviewResult.toolUses,
        toolNames: reReviewResult.toolNames,
        verdict: finalVerdict,
        summary: _extractSummary(reReviewResult.text),
      });

      if (reReviewResult.error || reReviewResult.done) break;
    }

    if (rejectionFixAttempt > 0) {
      report.rejectionFixAttempts = rejectionFixAttempt;
      logger.info(`[pipeline] After ${rejectionFixAttempt} rejection fix attempt(s): ${report.status}`);
    }

    // ── Step 7: Content Gen + Publish (only if APPROVED) ───────────────────
    // The agent generates inputSchema, registers the game, creates content sets,
    // and uploads everything via the Core API — all within the same session.
    if (report.status === 'APPROVED') {
      try {
        await progress({ type: 'pipeline-step', step: STEPS.CONTENT_GEN, status: 'running' });
        logger.info('[pipeline] Generating content sets + publishing via agent session...');

        const contentResult = await session.send(
          STEPS.CONTENT_GEN,
          buildContentGenPrompt(gameDir, { gameId, buildId }),
        );
        report.steps.contentGen = {
          turns: contentResult.turns,
          toolUses: contentResult.toolUses,
          text: contentResult.text?.slice(0, 8000),
        };

        const { publish } = _parsePublishResult(contentResult.text);
        if (publish) {
          report.publish = publish;
          logger.info(`[pipeline] ✅ Published: ${publish.gameId} — ${publish.contentSets.length} content set(s)`);
          logger.info(`[pipeline] 🎮 Game link: ${publish.gameLink}`);
          for (const cs of publish.contentSets) {
            logger.info(
              `[pipeline]   ${cs.name}: https://learn.mathai.ai/game/${publish.gameId}/${cs.id}${cs.valid ? '' : ' [INVALID]'}`,
            );
          }
          // Save publish info to disk
          fs.writeFileSync(path.join(gameDir, 'publish-info.json'), JSON.stringify(publish, null, 2) + '\n');
        } else {
          logger.warn('[pipeline] No PUBLISH_RESULT found in agent output — publishGame will handle it');
        }

        await progress({
          type: 'pipeline-step',
          step: STEPS.CONTENT_GEN,
          status: 'done',
          turns: contentResult.turns,
          toolUses: contentResult.toolUses,
          toolNames: contentResult.toolNames,
          inputSchemaProps: publish?.inputSchemaProps || 0,
          contentSetsCount: publish?.contentSets?.length || 0,
          published: !!publish,
          gameLink: publish?.gameLink,
          summary: publish
            ? `Published: ${publish.contentSets.length} content set(s) — ${publish.gameLink}`
            : 'Content gen completed but publish result not parsed',
        });
      } catch (contentErr) {
        logger.warn(`[pipeline] Content gen + publish step failed (non-fatal): ${contentErr.message}`);
        await progress({ type: 'pipeline-step', step: STEPS.CONTENT_GEN, status: 'done', error: contentErr.message });
        // Non-fatal — game is still approved, server.js publishGame() will handle as fallback
      }
    }
  } catch (err) {
    logger.error(`[pipeline] Pipeline error: ${err.message}`);
    report.status = 'FAILED';
    report.errors.push(err.message);
    await progress({ type: 'pipeline-error', error: err.message });
  }

  // ── Collect summary ───────────────────────────────────────────────────────
  const summary = session.getSummary();
  report.totalTurns = summary.totalTurns;
  report.totalToolUses = summary.totalToolUses;
  report.totalCost = summary.totalCost;
  report.sessionStatus = summary.status;
  report.usage = summary.usage;
  report.stepResults = summary.steps;
  report.toolLog = summary.toolLog;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  report.totalTimeS = parseFloat(elapsed);
  report.completedAt = new Date().toISOString();

  // Check final HTML
  const htmlPath = path.join(gameDir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    report.finalHtmlSize = fs.statSync(htmlPath).size;
  }

  logger.info(`\n${'═'.repeat(70)}`);
  logger.info(
    `[pipeline] ${report.status === 'APPROVED' ? '✅' : report.status === 'REJECTED' ? '🔸' : '❌'} ${gameId} — ${report.status}`,
  );
  logger.info(
    `[pipeline] ${elapsed}s | ${summary.totalTurns} turns | ${summary.totalToolUses} tools | $${summary.totalCost.toFixed(4)}`,
  );
  logger.info(`${'═'.repeat(70)}\n`);

  // Close session gracefully
  try {
    await session.close();
  } catch (e) {
    logger.warn(`[pipeline] Session close error: ${e.message}`);
  }

  // Record transcript path in report (already saved incrementally after each step)
  if (session.getTranscriptPath()) {
    report.transcriptPath = session.getTranscriptPath();
  }

  return report;
}

// ─── Targeted fix (feedback-driven) ─────────────────────────────────────────

/**
 * Run a targeted fix on an existing game using user feedback.
 * Creates a new session focused on the fix.
 *
 * @param {object} opts
 * @param {string}  opts.gameId
 * @param {string}  opts.gameDir
 * @param {string}  opts.specPath
 * @param {string}  opts.feedback    — user feedback text
 * @param {object}  [opts.log]
 * @param {function} [opts.onProgress]
 * @returns {Promise<object>} Fix report
 */
async function runTargetedFix({ gameId, gameDir, specPath, feedback, model, log, onProgress }) {
  const logger = log || { info: console.log, warn: console.warn, error: console.error };
  const startTime = Date.now();

  const specContent = fs.readFileSync(specPath, 'utf-8');
  const report = { gameId, type: 'fix', status: 'running', errors: [] };

  let session;
  try {
    session = await createSession({
      gameDir,
      specPath,
      model: model || config.GEN_MODEL,
      log: logger,
      onProgress,
    });
  } catch (err) {
    report.status = 'FAILED';
    report.errors.push(err.message);
    return report;
  }

  // Enable per-step transcript saving
  const transcriptFile = path.join(gameDir, `transcript-fix-${Date.now()}.jsonl`);
  session.setTranscriptPath(transcriptFile);

  try {
    const systemPrompt = buildSystemContext(specContent, gameId, gameDir);
    const fixPrompt = `${systemPrompt}\n\n${buildFeedbackFixPrompt(gameDir, feedback)}`;

    const result = await session.send('fix', fixPrompt);
    report.steps = { fix: { turns: result.turns, toolUses: result.toolUses, text: result.text?.slice(0, 500) } };

    if (result.error) {
      report.status = 'FAILED';
      report.errors.push(result.error);
    } else {
      report.status = 'APPROVED';
    }
  } catch (err) {
    report.status = 'FAILED';
    report.errors.push(err.message);
  }

  const summary = session.getSummary();
  report.totalTurns = summary.totalTurns;
  report.totalToolUses = summary.totalToolUses;
  report.totalCost = summary.totalCost;
  report.totalTimeS = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

  try {
    await session.close();
  } catch (e) {
    /* ignore */
  }

  if (session.getTranscriptPath()) {
    report.transcriptPath = session.getTranscriptPath();
  }

  return report;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a short summary from agent output (last meaningful paragraph or sentence).
 */
function _extractSummary(text) {
  if (!text) return null;
  // Look for common summary patterns the agent uses
  const patterns = [
    /(?:summary|conclusion|overall)[:\s]*(.+?)(?:\n\n|\n(?=[A-Z]))/is,
    /(?:all tests?\s+pass|no (?:issues?|errors?|bugs?) (?:found|detected|remaining)).*$/im,
    /(?:fixed|resolved|addressed)\s+\d+\s+(?:issues?|bugs?|problems?).*$/im,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] || m[0]).trim().slice(0, 300);
  }
  // Fallback: last non-empty line
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1].slice(0, 300) : null;
}

/**
 * Count issues found/fixed from agent test output.
 */
function _countIssues(text) {
  if (!text) return { found: 0, fixed: 0 };
  // Count "issue", "bug", "fix", "error" mentions
  const foundMatches =
    text.match(/(?:found|discovered|identified|detected)\s+(\d+)\s+(?:issue|bug|problem|error)/gi) || [];
  const fixedMatches =
    text.match(/(?:fixed|resolved|addressed|corrected)\s+(\d+)\s+(?:issue|bug|problem|error)/gi) || [];
  // Also count ISSUE: lines
  const issueLines = (text.match(/^ISSUE:/gim) || []).length;
  // Extract numbers
  const extractNum = (matches) =>
    matches.reduce((sum, m) => {
      const n = m.match(/(\d+)/);
      return sum + (n ? parseInt(n[1], 10) : 1);
    }, 0);
  return {
    found: Math.max(extractNum(foundMatches), issueLines),
    fixed: extractNum(fixedMatches),
  };
}

/**
 * Extract actual issue descriptions from agent output.
 * Looks for patterns like "ISSUE: ...", "- Fixed: ...", "- Found: ...", bullet-point issues, etc.
 */
function _extractIssueDescriptions(text) {
  if (!text) return [];
  const descriptions = [];

  // ISSUE: [severity] description
  const issueLines = text.matchAll(/ISSUE:\s*\[?\w*\]?\s*(.+?)(?:\n|$)/gi);
  for (const m of issueLines) descriptions.push(m[1].trim());

  // "- Fixed: ..." or "- Found: ..." or "- Bug: ..." patterns
  const bulletFixes = text.matchAll(
    /[-•]\s*(?:Fixed|Found|Bug|Error|Issue|Problem|Resolved|Corrected)[:\s]+(.+?)(?:\n|$)/gi,
  );
  for (const m of bulletFixes) descriptions.push(m[1].trim());

  // "\d. ..." numbered issue lists that mention fix/issue/error
  const numbered = text.matchAll(
    /\d+\.\s*\*{0,2}(.+?(?:fix|issue|error|bug|broken|incorrect|missing).+?)\*{0,2}(?:\n|$)/gi,
  );
  for (const m of numbered) descriptions.push(m[1].trim());

  // Deduplicate (case-insensitive) and limit
  const seen = new Set();
  return descriptions.filter((d) => {
    const key = d.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse structured per-category test results from agent output.
 * Looks for TEST_RESULTS: block and CATEGORY_DETAIL: blocks.
 *
 * @returns {{ categories: {[cat]: {passed, total, details}}, totalPassed, totalTests, issuesFixed }}
 */
function _parseCategoryResults(text) {
  if (!text) return { categories: {}, totalPassed: 0, totalTests: 0, issuesFixed: [] };

  const categories = {};
  const CATS = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];

  // Parse "game-flow: 5/5" lines from TEST_RESULTS block
  for (const cat of CATS) {
    const scoreMatch = text.match(new RegExp(`${cat}[:\\s]+(\\d+)\\s*/\\s*(\\d+)`, 'i'));
    if (scoreMatch) {
      categories[cat] = {
        passed: parseInt(scoreMatch[1], 10),
        total: parseInt(scoreMatch[2], 10),
        details: [],
      };
    }
  }

  // Parse CATEGORY_DETAIL blocks for each category
  for (const cat of CATS) {
    const detailRegex = new RegExp(
      `CATEGORY_DETAIL:\\s*${cat}\\s*\\n([\\s\\S]*?)(?=CATEGORY_DETAIL:|ISSUES_FIXED:|TEST_RESULTS:|$)`,
      'i',
    );
    const detailMatch = text.match(detailRegex);
    if (detailMatch) {
      const lines = detailMatch[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('-') || l.startsWith('•'));

      const details = lines
        .map((line) => {
          const passMatch = line.match(/\[PASS\]\s*(.+)/i);
          const failMatch = line.match(/\[FAIL\]\s*(.+)/i);
          const skipMatch = line.match(/\[SKIP\]\s*(.+)/i);
          if (passMatch) return { status: 'pass', description: passMatch[1].trim() };
          if (failMatch) return { status: 'fail', description: failMatch[1].trim() };
          if (skipMatch) return { status: 'skip', description: skipMatch[1].trim() };
          return { status: 'unknown', description: line.replace(/^[-•]\s*/, '').trim() };
        })
        .filter((d) => d.description.length > 0);

      if (!categories[cat]) {
        const passed = details.filter((d) => d.status === 'pass').length;
        categories[cat] = { passed, total: details.length, details };
      } else {
        categories[cat].details = details;
      }
    }
  }

  // Parse ISSUES_FIXED block
  const issuesFixed = [];
  const fixedMatch = text.match(/ISSUES_FIXED:\s*\n([\s\S]*?)(?=TEST_RESULTS:|CATEGORY_DETAIL:|$)/i);
  if (fixedMatch) {
    const lines = fixedMatch[1]
      .split('\n')
      .map((l) => l.replace(/^[-•]\s*/, '').trim())
      .filter((l) => l.length > 5);
    issuesFixed.push(...lines);
  }

  // Totals
  let totalPassed = 0;
  let totalTests = 0;
  for (const cat of Object.values(categories)) {
    totalPassed += cat.passed || 0;
    totalTests += cat.total || 0;
  }

  return { categories, totalPassed, totalTests, issuesFixed };
}

function _parseVerdict(text) {
  if (!text) return { verdict: 'APPROVED', issues: [], score: null };

  // Match VERDICT: APPROVED/REJECTED/NEEDS_FIX (flexible whitespace, optional bold/quotes)
  const verdictMatch = text.match(/VERDICT[:\s]*\*{0,2}\s*(APPROVED|REJECTED|NEEDS_FIX)\s*\*{0,2}/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'APPROVED';
  // Normalize NEEDS_FIX → REJECTED for pipeline status
  const normalizedVerdict = verdict === 'NEEDS_FIX' ? 'REJECTED' : verdict;

  // Parse issues — match "ISSUE: [severity] description" format
  const issues = [];
  const issueRegex = /ISSUE:\s*\[?(critical|warning|info)\]?\s*(.+?)(?:\n|$)/gi;
  let match;
  while ((match = issueRegex.exec(text)) !== null) {
    issues.push({
      severity: match[1].toLowerCase(),
      description: match[2].trim(),
    });
  }

  // Parse spec compliance score — match "SCORE: 85%" or "compliance: 85%" or "score: 85%"
  const scoreMatch = text.match(/(?:SCORE|compliance)[:\s]*(\d+)\s*%/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

  return { verdict: normalizedVerdict, issues, score };
}

module.exports = {
  runPipeline,
  runTargetedFix,
  STEPS,
  // Exported for server.js consumption
  _parseCategoryResults,
};

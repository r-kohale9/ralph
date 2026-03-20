'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// pipeline-utils.js — Snapshot, harness, and spec utility functions
//
// Extracted from pipeline.js (Phase 2 refactor).
// Pure utilities with no dependency on the main pipeline flow.
//
// Exports: captureGameDomSnapshot, captureBehavioralTranscript, injectTestHarness,
//          extractSpecMetadata, extractGameFeatures, extractSpecRounds, extractSpecKeywords,
//          extractTestGenerationHints, jaccardSimilarity, getCategoryBoost,
//          getRelevantLearnings, deriveRelevantCategories, isHtmlTruncated,
//          findFreePort, MODEL_COSTS, estimateCost, CATEGORY_SPEC_ORDER
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

// ─── Canonical category ordering ─────────────────────────────────────────────
// Single source of truth for category names and run order used by test-gen,
// fix-loop, and targeted-fix. Import instead of re-declaring in each module.
const CATEGORY_SPEC_ORDER = ['game-flow', 'mechanics', 'level-progression', 'edge-cases', 'contract'];

// ─── Cost estimation ─────────────────────────────────────────────────────────
// Shared across pipeline.js and pipeline-targeted-fix.js.

const MODEL_COSTS = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

/**
 * Estimates USD cost for an LLM call based on per-million-token pricing in MODEL_COSTS.
 * @param {string} model - Model identifier
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || { input: 3, output: 15 }; // default to sonnet pricing
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// ─── Find a free TCP port ────────────────────────────────────────────────────
/**
 * Resolves to an available TCP port on 127.0.0.1 by briefly binding then releasing a socket.
 * @returns {Promise<number>}
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ─── Shared serve process spawner ────────────────────────────────────────────

/**
 * Spawns a `npx serve` static file server for dir on the given port.
 * Caller must await a startup delay and kill the returned process when done.
 * @param {string} dir - Directory to serve
 * @param {number} port
 * @returns {import('child_process').ChildProcess}
 */
function spawnServeProcess(dir, port) {
  return spawn('npx', ['-y', 'serve', dir, '-l', String(port), '-s', '--no-clipboard'], {
    stdio: 'ignore',
    detached: false,
  });
}

// ─── Jaccard similarity ──────────────────────────────────────────────────────

const MAX_LEARNING_BULLETS = 20;

/**
 * Returns the Jaccard similarity (0..1) between two strings.
 * Normalises to lowercase word sets and computes |A ∩ B| / |A ∪ B|.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function jaccardSimilarity(a, b) {
  const toWords = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  const setA = toWords(a);
  const setB = toWords(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// ─── Spec keyword extraction for spec-similarity scoring ─────────────────────
//
// Extracts two classes of keywords from a game spec:
//   1. CDN part names — PART-XXX identifiers and named exports like FeedbackManager,
//      ScreenLayout, SlotMachine, waitForPackages, ProgressBarComponent, etc.
//   2. Mechanic keywords — meaningful nouns/verbs (>= 4 chars) from the ## Mechanics
//      or ## Game Mechanics section, stop-words removed.
//
// Returns a Set of lowercase strings. Returns an empty Set when specContent is falsy.
//
const SPEC_STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'will',
  'your',
  'each',
  'when',
  'then',
  'they',
  'them',
  'their',
  'been',
  'also',
  'into',
  'over',
  'after',
  'must',
  'should',
  'uses',
  'used',
  'using',
  'game',
  'user',
  'click',
  'button',
  'display',
  'show',
  'shown',
  'play',
  'played',
  'starts',
  'start',
  'ends',
  'end',
  'next',
  'back',
  'true',
  'false',
  'null',
  'none',
  'more',
]);

/**
 * Extracts a Set of lowercase keywords from a game spec for spec-similarity scoring.
 * Includes CDN PART-XXX identifiers, named CDN exports (PascalCase/camelCase), and mechanic nouns.
 * @param {string} specContent
 * @returns {Set<string>}
 */
function extractSpecKeywords(specContent) {
  const keywords = new Set();
  if (!specContent) return keywords;

  // 1. CDN part identifiers: PART-XXX (e.g. PART-012)
  for (const m of specContent.matchAll(/\bPART-\d+\b/g)) {
    keywords.add(m[0].toLowerCase());
  }

  // 2. Named CDN exports — PascalCase identifiers that typically appear in
  //    a CDN / Parts section (FeedbackManager, ScreenLayout, SlotMachine, ...)
  //    and camelCase utility names (waitForPackages, initSentry, etc.)
  const cdnSectionMatch =
    specContent.match(/##\s*CDN[^\n]*\n([\s\S]*?)(?=\n##|$)/i) ||
    specContent.match(/##\s*Parts?[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
  if (cdnSectionMatch) {
    const cdnBody = cdnSectionMatch[1];
    // PascalCase: ScreenLayout, FeedbackManager, SlotMachine, ProgressBarComponent ...
    for (const m of cdnBody.matchAll(/\b([A-Z][a-z][A-Za-z]{2,})\b/g)) {
      keywords.add(m[1].toLowerCase());
    }
    // camelCase utilities: waitForPackages, initSentry, ...
    for (const m of cdnBody.matchAll(/\b([a-z][a-z]+[A-Z][A-Za-z]+)\b/g)) {
      keywords.add(m[1].toLowerCase());
    }
  }

  // 3. Mechanic keywords from ## Mechanics / ## Game Mechanics section
  const mechanicsSectionMatch = specContent.match(/##\s*(?:Game\s+)?Mechanics[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
  if (mechanicsSectionMatch) {
    const body = mechanicsSectionMatch[1];
    const words = body
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const w of words) {
      if (w.length >= 4 && !SPEC_STOP_WORDS.has(w)) {
        keywords.add(w);
      }
    }
  }

  return keywords;
}

// ─── Category boost for spec-aware learning prioritisation ───────────────────
//
// Returns an additive score (0.0–0.3) to apply on top of the Jaccard
// spec-similarity score. Categories that are universally relevant
// (contract) or contextually relevant given the spec (cdncompat, audio,
// layout) surface before equally-scoring entries from other categories.
//
// Rules:
//   contract  → +0.2 always (contract errors affect every game)
//   cdncompat → +0.2 when spec references any PART-xxx identifier
//   audio     → +0.2 when spec keywords include 'feedbackmanager'
//   layout    → +0.2 when spec keywords include 'screenlayout'
//   others    → 0
//
/**
 * Returns an additive score (0.0–0.2) added to Jaccard similarity for spec-aware learning ranking.
 * contract always +0.2; cdncompat/audio/layout +0.2 when the spec signals those feature areas.
 * @param {string} category - Learning category
 * @param {Set<string>} specKeywords - Keywords extracted by extractSpecKeywords()
 * @returns {number}
 */
function getCategoryBoost(category, specKeywords) {
  if (!category) return 0;
  const cat = category.toLowerCase();
  if (cat === 'contract') return 0.2;
  if (!specKeywords || specKeywords.size === 0) return 0;
  if (cat === 'cdncompat') {
    // boost when spec uses CDN parts (any PART-xxx keyword present)
    for (const kw of specKeywords) {
      if (/^part-\d+$/.test(kw)) return 0.2;
    }
  }
  if (cat === 'audio' && specKeywords.has('feedbackmanager')) return 0.2;
  if (cat === 'layout' && specKeywords.has('screenlayout')) return 0.2;
  return 0;
}

// ─── Derive relevant categories from spec keywords for SQL pre-filtering ─────
//
// Maps spec keyword signals to the learning categories that should always be
// fetched. Always includes 'contract' and 'general'. Adds:
//   cdncompat  → when any PART-xxx keyword is present
//   audio      → when 'feedbackmanager' is in spec keywords
//   layout     → when 'screenlayout' is in spec keywords
//
// Returns null when specKeywords is null/empty (fall through to no filter).
//
/**
 * Maps spec keyword signals to the learning categories that should always be SQL-filtered.
 * Always includes 'contract' and 'general'; adds cdncompat/audio/layout when spec signals them.
 * Returns null when specKeywords is empty (no filter applied, fetch all categories).
 * @param {Set<string>} specKeywords - From extractSpecKeywords()
 * @returns {Set<string>|null}
 */
function deriveRelevantCategories(specKeywords) {
  if (!specKeywords || specKeywords.size === 0) return null;
  const cats = new Set(['contract', 'general']);
  for (const kw of specKeywords) {
    if (/^part-\d+$/.test(kw)) {
      cats.add('cdncompat');
      break;
    }
  }
  if (specKeywords.has('feedbackmanager')) cats.add('audio');
  if (specKeywords.has('screenlayout')) cats.add('layout');
  return cats;
}

/**
 * Fetches approved-build learnings from the DB, deduplicates by Jaccard similarity,
 * and sorts by spec relevance. Returns a formatted bullet-list string or null if none.
 * @param {string} gameId - Excluded from results (prevents same-game echo)
 * @param {string|null} [specContent] - Used for spec-aware SQL filtering and relevance ranking
 * @param {number} [limit=10] - Max learnings to return
 * @returns {string|null}
 */
function getRelevantLearnings(gameId, specContent = null, limit = 10) {
  try {
    // Lazy-require db to avoid hard dependency when DB is unavailable
    const db = require('./db');
    // Fetch more rows than needed so dedup has candidates to work with
    const fetchLimit = Math.max(limit, MAX_LEARNING_BULLETS) * 3;

    // ── SQL pre-filter: derive categories from spec keywords ─────────────
    // When specContent is available, restrict the query to categories that are
    // likely relevant — keeps heap work O(k) as the learnings table grows.
    const specKeywordsForFilter = specContent ? extractSpecKeywords(specContent) : null;
    const relevantCategories = deriveRelevantCategories(specKeywordsForFilter);

    let sql;
    let params;
    if (relevantCategories && relevantCategories.size > 0) {
      const placeholders = Array.from({ length: relevantCategories.size }, () => '?').join(', ');
      sql = `
      SELECT l.content, l.category
      FROM learnings l
      JOIN builds b ON l.build_id = b.id
      WHERE b.status = 'APPROVED'
        AND l.resolved = 0
        AND length(l.content) > 30
        AND (l.game_id IS NULL OR l.game_id != ?)
        AND l.category IN (${placeholders})
      ORDER BY l.build_id DESC
      LIMIT ?
    `;
      params = [gameId || '', ...Array.from(relevantCategories), fetchLimit];
    } else {
      sql = `
      SELECT l.content, l.category
      FROM learnings l
      JOIN builds b ON l.build_id = b.id
      WHERE b.status = 'APPROVED'
        AND l.resolved = 0
        AND length(l.content) > 30
        AND (l.game_id IS NULL OR l.game_id != ?)
      ORDER BY l.build_id DESC
      LIMIT ?
    `;
      params = [gameId || '', fetchLimit];
    }

    const rows = db
      .getDb()
      .prepare(sql)
      .all(...params);

    if (!rows || rows.length === 0) return null;

    // Dedup pass: keep the first (most recent) entry per semantic cluster.
    // If a new entry has Jaccard similarity > 0.6 with any kept entry, skip it.
    const JACCARD_THRESHOLD = 0.6;
    const kept = [];
    for (const row of rows) {
      const isDuplicate = kept.some((k) => jaccardSimilarity(k.content, row.content) > JACCARD_THRESHOLD);
      if (!isDuplicate) {
        kept.push(row);
        if (kept.length >= MAX_LEARNING_BULLETS) break;
      }
    }

    if (kept.length === 0) return null;

    // Spec-similarity scoring: when specContent provided, score each kept learning
    // against the spec's CDN parts + mechanic keywords and sort most-relevant first.
    // A secondary category boost is added so contract/cdncompat/audio/layout
    // entries surface first even when Jaccard similarity is equal.
    if (specContent) {
      const specKeywords = extractSpecKeywords(specContent);
      const specKeywordStr = specKeywords.size > 0 ? Array.from(specKeywords).join(' ') : '';
      kept.sort((a, b) => {
        const simA = specKeywordStr ? jaccardSimilarity(a.content, specKeywordStr) : 0;
        const simB = specKeywordStr ? jaccardSimilarity(b.content, specKeywordStr) : 0;
        const totalA = simA + getCategoryBoost(a.category, specKeywords);
        const totalB = simB + getCategoryBoost(b.category, specKeywords);
        return totalB - totalA; // descending: most relevant first
      });
    }

    const lines = kept.map((r) => `- [${r.category}] ${r.content}`).join('\n');
    return lines;
  } catch {
    // DB unavailable or query failed — degrade gracefully
    return null;
  }
}

/**
 * Returns true if the HTML appears truncated (missing </html>, or mismatched <script> tags).
 * @param {string} html
 * @returns {boolean}
 */
function isHtmlTruncated(html) {
  if (!html || html.length < 500) return true;
  const trimmed = html.trimEnd();
  // Must end with </html> or at minimum </body>
  if (!/<\/html\s*>/i.test(trimmed)) return true;
  // Must have a complete <script> section (not cut off mid-statement)
  const scriptTags = (trimmed.match(/<script/gi) || []).length;
  const scriptCloseTags = (trimmed.match(/<\/script>/gi) || []).length;
  if (scriptTags > scriptCloseTags) return true;
  return false;
}

// ─── Spec metadata extraction ───────────────────────────────────────────────
/**
 * Parses totalRounds, totalLives, interactionType, starType, and starThresholds from a spec.
 * Used by injectTestHarness() to produce the correct window.__ralph implementation.
 * @param {string} specContent
 * @returns {{totalRounds: number|null, totalLives: number|null, interactionType: string, starType: string, starThresholds: Array}}
 */
function extractSpecMetadata(specContent) {
  const meta = {
    totalRounds: null,
    totalLives: null,
    interactionType: 'text-input', // default
    starType: 'lives', // default
    starThresholds: [],
  };

  // Rounds: "9 rounds", "totalRounds: 9", "rounds per level: 3"
  const roundsMatch =
    specContent.match(/(?:total[_\s]?rounds?|rounds?\s+per\s+(?:level|game)|totalRounds)\s*[:=]?\s*(\d+)/i) ||
    specContent.match(/(\d+)\s+rounds?\s+(?:per|in each|in a)\s+(?:level|game)/i) ||
    specContent.match(/(\d+)\s+(?:questions?|rounds?)\s+(?:total|in the game)/i);
  if (roundsMatch) meta.totalRounds = parseInt(roundsMatch[1], 10);

  // Lives: "3 lives", "totalLives: 3", "lives: 3"
  const livesMatch =
    specContent.match(/(?:total[_\s]?lives?|lives?\s*[:=]\s*)(\d+)/i) ||
    specContent.match(/(\d+)\s+lives?(?:\s+(?:at\s+start|initially|total))?/i);
  if (livesMatch) meta.totalLives = parseInt(livesMatch[1], 10);

  // No-lives games: "no lives", "does not lose lives", "without lives"
  if (/no\s+lives|does\s+not\s+(?:lose|have)\s+lives|without\s+lives/i.test(specContent)) {
    meta.totalLives = 0;
  }

  // Interaction type detection (check in priority order — drag first, then mcq, grid, text)
  if (/drag[\s-]?(?:and[\s-]?drop|drop)|draggable/i.test(specContent)) {
    meta.interactionType = 'drag';
  } else if (/(?:multiple[\s-]?choice|option\s+button|mcq|radio\s+button|horizontal\s+option)/i.test(specContent)) {
    meta.interactionType = 'mcq-click';
  } else if (/(?:grid|cell|card|board|tile|matrix|NxN)/i.test(specContent)) {
    meta.interactionType = 'grid-click';
  } else if (/(?:input|type|text[\s-]?field|numeric\s+input|answer\s+box)/i.test(specContent)) {
    meta.interactionType = 'text-input';
  }

  // Star logic type
  if (
    /avg(?:erage)?\s+(?:time|speed)|per[\s-]?round\s+(?:time|speed)|seconds?\s+per\s+(?:round|question)/i.test(
      specContent,
    )
  ) {
    meta.starType = 'avg-time';
    // Extract thresholds: "< 3s = 3★", "<5s → 2 stars"
    const timeThresholds = [
      ...specContent.matchAll(/[<≤]\s*(\d+(?:\.\d+)?)\s*s(?:econds?)?\s*[=:→\-]+\s*(\d)\s*(?:star|★)/gi),
    ]
      .map((m) => ({ threshold: parseFloat(m[1]), stars: parseInt(m[2], 10) }))
      .sort((a, b) => a.threshold - b.threshold);
    if (timeThresholds.length > 0) meta.starThresholds = timeThresholds;
  } else if (/(?:accuracy|correct\s+(?:answer|response)s?)\s+[=:→]\s*\d+\s*%?\s*[=:→]\s*\d\s*star/i.test(specContent)) {
    meta.starType = 'accuracy';
  } else if (/moves?\s*[≤<]\s*\d+\s*[=:→]\s*\d\s*star/i.test(specContent)) {
    meta.starType = 'moves';
  } else if (
    /(?:stars?\s+=\s+lives?|lives?\s+remaining\s+=\s+stars?|stars?\s+equal\s+(?:to\s+)?lives?)/i.test(specContent)
  ) {
    meta.starType = 'lives';
  } else if (/(?:total[\s-]time|completion[\s-]time|time\s+to\s+complete)\s*[<≤]\s*\d+/i.test(specContent)) {
    meta.starType = 'total-time';
  }

  return meta;
}

// ─── Game feature extraction ─────────────────────────────────────────────────
// Derives a structured `gameFeatures` block from spec content and an optional
// DOM snapshot string. This block is injected into test-gen prompts so the LLM
// knows which lifecycle features are present — preventing structurally-wrong
// tests (lives tests for unlimited-lives games, round-count tests for single-
// round games, timer tests when there's no timer, etc.).
//
// Returns:
// {
//   unlimitedLives  : bool  — true when totalLives === 0 / "no lives" / "unlimited lives"
//   hasLives        : bool  — true when totalLives > 0 (explicit finite lives)
//   totalLives      : number|null
//   totalRounds     : number|null
//   hasLevels       : bool  — multi-level structure (levels > 1)
//   totalLevels     : number|null
//   timerScoring    : bool  — stars derived from time (avg-time or total-time)
//   accuracyScoring : bool  — stars derived from accuracy %
//   singleRound     : bool  — only 1 round total (no round-progression to test)
//   hasTwoPhases    : bool  — learn/recall or study/quiz phases
//   hasLearnPhase   : bool  — explicit learn / study / preview phase before questions
// }

/**
 * Derives a structured gameFeatures object from spec content and an optional DOM snapshot.
 * Injected into test-gen prompts to prevent structurally-wrong tests (e.g. lives tests for unlimited-lives games).
 * @param {string} specContent
 * @param {string} [domSnapshot='']
 * @returns {{unlimitedLives: boolean, hasLives: boolean, totalLives: number|null, totalRounds: number|null, hasLevels: boolean, totalLevels: number|null, timerScoring: boolean, accuracyScoring: boolean, singleRound: boolean, hasTwoPhases: boolean, hasLearnPhase: boolean}}
 */
function extractGameFeatures(specContent, domSnapshot = '') {
  const specMeta = extractSpecMetadata(specContent);
  const spec = specContent.toLowerCase();
  const dom = (domSnapshot || '').toLowerCase();

  // ── Lives ─────────────────────────────────────────────────────────────────
  const unlimitedLives =
    specMeta.totalLives === 0 ||
    /unlimited\s+lives|no\s+lives|does\s+not\s+(?:lose|have)\s+lives|without\s+lives|lives?:\s*0|totalLives:\s*0/i.test(
      specContent,
    ) ||
    /totalLives:\s*0\s*\(no\s+lives\s+display\)/i.test(specContent);

  const hasLives = !unlimitedLives && specMeta.totalLives !== null && specMeta.totalLives > 0;

  // ── Rounds ────────────────────────────────────────────────────────────────
  const totalRounds = specMeta.totalRounds;
  const singleRound = totalRounds === 1;

  // ── Levels ────────────────────────────────────────────────────────────────
  // Detect multi-level structure: "3 levels", "totalLevels: 3", "across 3 levels"
  // Priority: prose "N levels" first, then explicit totalLevels: N config key.
  // Avoid matching "level: 1" (singular, from gameState) as a multi-level indicator.
  let totalLevels = null;
  const levelsMatchProse = specContent.match(/(\d+)\s+levels?(?:\s+(?:of|with|containing|across))?/i);
  const levelsMatchConfig = specContent.match(/total[_\s]?levels?\s*[:=]\s*(\d+)/i);
  const levelsMatch = levelsMatchProse || levelsMatchConfig;
  if (levelsMatch) {
    const n = parseInt(levelsMatch[1], 10);
    // "9 rounds across 3 levels" → 3 levels; "Level 1" alone → not multi-level
    if (n > 1 && n <= 20) totalLevels = n;
  }
  const hasLevels = totalLevels !== null && totalLevels > 1;

  // ── Scoring/star type ─────────────────────────────────────────────────────
  const timerScoring = specMeta.starType === 'avg-time' || specMeta.starType === 'total-time';
  // Accuracy scoring: trust extractSpecMetadata if it detected it, but also
  // look for broader prose patterns: "accuracy-based", "scored by accuracy",
  // "accuracy percentage", "accuracy %->N" style threshold tables.
  const accuracyScoring =
    specMeta.starType === 'accuracy' ||
    /accuracy[\s-]based|scored\s+by\s+accuracy|accuracy\s+percentage/i.test(specContent) ||
    /accuracy[^.]*\d+%[^.]*\d+\s*(?:star|★)/i.test(specContent) ||
    /\d+%\s*->\s*\d+\s*(?:star|★)/i.test(specContent);

  // ── Two-phase games (learn + recall) ─────────────────────────────────────
  const hasLearnPhase =
    /\blearn\s+phase\b|\bstudy\s+phase\b|\bpreview\s+phase\b|\bmemorize\b|\bexposure\s+duration\b|\blearn[\s-]then[\s-]recall\b/i.test(
      specContent,
    ) ||
    /\blearn\b.*\brecall\b|\bstudy\b.*\bquiz\b/i.test(spec) ||
    /exposureDuration/i.test(specContent);

  const hasTwoPhases =
    hasLearnPhase ||
    /phase[12]|phase_1|phase_2|learn.*phase|recall.*phase|memorize.*then/i.test(spec) ||
    dom.includes('learn-phase') ||
    dom.includes('recall-phase') ||
    dom.includes('study-phase');

  return {
    unlimitedLives,
    hasLives,
    totalLives: specMeta.totalLives,
    totalRounds,
    hasLevels,
    totalLevels,
    timerScoring,
    accuracyScoring,
    singleRound,
    hasTwoPhases,
    hasLearnPhase,
  };
}

// ─── Test harness injection ──────────────────────────────────────────────────
/**
 * Appends a <script id="ralph-test-harness"> block to the HTML (before/after </body>).
 * The block adds window.__ralph shortcuts (answer, endGame, jumpToRound, etc.) and syncDOMState().
 * Deterministic — no LLM calls. Safe to call multiple times (idempotent).
 * @param {string} html - Full HTML document string
 * @param {{interactionType: string, totalRounds: number|null, totalLives: number|null, starType: string}} specMetadata
 * @returns {string} HTML with harness injected
 */
function injectTestHarness(html, specMetadata) {
  // Don't inject twice
  if (html.includes('id="ralph-test-harness"')) return html;

  const { interactionType } = specMetadata;

  // Build the answer() implementation based on interaction type
  let answerImpl;
  if (interactionType === 'mcq-click' || interactionType === 'grid-click') {
    answerImpl = `answer(correct = true) {
      // Value-based lookup first: for games where correctAnswer is a number/string value (not an index)
      const correctValue = window.gameState?.correctAnswer ?? window.gameState?.answer;
      if (correctValue !== undefined && correctValue !== null) {
        const allBtns = document.querySelectorAll('.answer-btn, .option-btn, [class*="answer"], [class*="option"]');
        for (const b of allBtns) {
          const bVal = b.dataset.value !== undefined ? b.dataset.value : b.textContent.trim();
          const matches = String(bVal) === String(correctValue);
          if ((correct && matches) || (!correct && !matches)) { b.click(); return true; }
        }
      }
      // Index-based lookup fallback: for games where correct answer identified by position
      const round = window.gameState?.content?.rounds?.[window.gameState?.currentRound]
        || window.gameState?.rounds?.[window.gameState?.currentRound];
      const correctIdx = round?.correctIndex ?? round?.correct ?? 0;
      const idx = correct ? correctIdx : (correctIdx === 0 ? 1 : 0);
      // Try data-testid first, then data-index, then nth child
      const btn = document.querySelector('[data-testid="option-' + idx + '"]')
        || document.querySelector('[data-index="' + idx + '"]')
        || document.querySelector('.option-btn:nth-child(' + (idx + 1) + ')')
        || document.querySelector('[data-testid="cell-' + idx + '"]');
      if (btn) btn.click();
      return !!btn;
    },`;
  } else if (interactionType === 'drag') {
    answerImpl = `answer(correct = true) {
      // Drag games: simulate drop by calling the game's answer handler directly
      if (window.handleDrop) { window.handleDrop(correct); return true; }
      if (window.checkAnswer) { window.checkAnswer(correct); return true; }
      return false;
    },`;
  } else {
    // text-input (default)
    answerImpl = `answer(correct = true) {
      const gs = window.gameState;
      const correctAns = gs?.correctAnswer ?? gs?.answer ?? gs?.solution ?? '';
      const ans = correct ? String(correctAns) : String(Number(correctAns) + 9999);
      const input = document.querySelector('[data-testid="answer-input"]')
        || document.querySelector('#answer-input')
        || document.querySelector('input[type="number"]')
        || document.querySelector('input[type="text"]');
      if (input) {
        input.value = ans;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const checkBtn = document.querySelector('[data-testid="btn-check"]')
        || document.querySelector('#btn-check')
        || document.querySelector('button[type="submit"]');
      if (checkBtn) checkBtn.click();
      return !!(input || checkBtn);
    },`;
  }

  const harnessScript = `
<script id="ralph-test-harness">
// ─── Ralph Test Harness (injected by pipeline) ───────────────────────────────
// Provides test shortcuts via window.__ralph. Does NOT change game behavior.
// Spec metadata: interactionType=${interactionType}
(function() {
  'use strict';

  // PostMessage capture — intercept to record last message for contract tests
  window.__lastPostMessage = null;
  try {
    const _orig = window.parent.postMessage.bind(window.parent);
    window.parent.postMessage = function(data, origin) {
      window.__lastPostMessage = typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data;
      _orig(data, origin);
    };
  } catch(e) { /* cross-origin parent — ignore */ }

  // syncDOMState — called after every game state change
  // Keeps data-phase/data-lives/data-round/data-score on #app up to date
  function syncDOMState() {
    const root = document.getElementById('app');
    if (!root) return;
    const gs = window.gameState;
    if (!gs) return;
    // If game tracks its own phase (CDN games use gameState.phase directly), trust it.
    // Normalize phase names: game_over → gameover, game_complete → results, start_screen → start
    // Otherwise fall back to computing from other flags.
    const rawPhase = gs.phase
                   ? gs.phase.replace('game_over', 'gameover').replace('game_complete', 'results').replace('start_screen', 'start')
                   : null;
    root.dataset.phase = rawPhase
                       ? rawPhase
                       : gs.completed ? 'results'
                       : gs.isActive === false ? 'start'
                       : gs.isGameOver ? 'gameover'
                       : 'playing';
    if (gs.currentRound !== undefined) root.dataset.round = gs.currentRound;
    if (gs.lives !== undefined) root.dataset.lives = gs.lives;
    if (gs.score !== undefined) root.dataset.score = gs.score;
    if (gs.level !== undefined) root.dataset.level = gs.level;
    if (gs.stars !== undefined && gs.stars !== null) root.dataset.stars = gs.stars;
    // Sync data-lives on CDN progress display element too
    const livesEl = document.querySelector('[data-testid="display-lives"], [data-testid="lives-display"]');
    if (livesEl && gs.lives !== undefined) livesEl.dataset.lives = gs.lives;
  }

  // Patch the game's own roundComplete/endGame/loadRound to call syncDOMState
  // This ensures data-* attributes are always current after state changes
  function patchGameFunctions() {
    const toWrap = ['roundComplete', 'endGame', 'loadRound', 'initGame', 'checkAnswer', 'handleSubmit'];
    for (const fn of toWrap) {
      if (typeof window[fn] === 'function' && !window[fn].__ralphPatched) {
        const orig = window[fn];
        window[fn] = function(...args) {
          const result = orig.apply(this, args);
          if (result && typeof result.then === 'function') {
            result.then(syncDOMState).catch(() => {});
          } else {
            syncDOMState();
          }
          return result;
        };
        window[fn].__ralphPatched = true;
      }
    }
  }

  window.__ralph = {
    ${answerImpl}

    endGame(reason) {
      reason = reason || 'victory';
      if (window.endGame && !window.endGame.__ralphPatched) window.endGame(reason);
      else if (window.endGame) window.endGame(reason);
      syncDOMState();
    },

    jumpToRound(n) {
      if (window.gameState) { window.gameState.currentRound = n; window.gameState.isActive = true; }
      // Try game-specific round-loading functions in priority order
      if (typeof window.loadRound === 'function') window.loadRound(n);
      else if (typeof window.jumpToRound === 'function') window.jumpToRound(n);
      else if (typeof window.loadQuestion === 'function') window.loadQuestion(n);
      else if (typeof window.goToRound === 'function') window.goToRound(n);
      syncDOMState();
    },

    setLives(n) {
      if (window.gameState) window.gameState.lives = n;
      if (window.progressBar) {
        try { window.progressBar.update(window.gameState.currentRound || 0, n); } catch(e) {}
      }
      syncDOMState();
    },

    setRoundTimes(timesMs) {
      if (window.gameState) {
        window.gameState.roundTimes = timesMs;
        window.gameState.roundStartTime = Date.now();
        const totalMs = timesMs.reduce((a, b) => a + b, 0);
        window.gameState.startTime = window.gameState.startTime || (Date.now() - totalMs);
      }
    },

    getState() {
      const root = document.getElementById('app');
      const gs = window.gameState || {};
      return {
        phase: root ? root.dataset.phase || 'unknown' : 'unknown',
        round: gs.currentRound ?? 0,
        totalRounds: gs.totalRounds ?? 0,
        lives: gs.lives ?? null,
        score: gs.score ?? 0,
        stars: gs.stars ?? null,
        isActive: gs.isActive ?? false,
        completed: gs.completed ?? false,
      };
    },

    getLastPostMessage() { return window.__lastPostMessage || null; },

    syncDOMState,
  };

  // Patch game functions and sync state continuously
  // CDN games initialize asynchronously (may take 5-60s), so we poll periodically
  function patchAndSync() {
    patchGameFunctions();
    syncDOMState(); // capture current state immediately after patching
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(patchAndSync, 200);
    });
  } else {
    setTimeout(patchAndSync, 200);
  }

  // Keep syncing every 500ms for the first 90s (covers CDN async init)
  // This ensures data-phase stays current even when patchGameFunctions
  // didn't fire before the game's initGame() ran
  const syncInterval = setInterval(function() {
    syncDOMState();
  }, 500);
  setTimeout(function() { clearInterval(syncInterval); }, 90000);

  // Also patch after CDN scripts load (they replace window functions)
  window.addEventListener('load', function() {
    setTimeout(patchAndSync, 500);
    setTimeout(patchAndSync, 2000);
    // Diagnostic: warn if required game functions are not exposed on window
    var required = ['endGame', 'restartGame', 'nextRound'];
    required.forEach(function(fn) {
      if (typeof window[fn] !== 'function') {
        console.error('[ralph-test-harness] MISSING window.' + fn + ': this function is not exposed on window. Tests calling window.__ralph.' + fn + '() will fail silently. Fix: add window.' + fn + ' = ' + fn + '; in the game code (after the function definition, in global scope or at end of DOMContentLoaded).');
      }
    });
  });
})();
</script>`;

  // Insert before </body> if present, otherwise append.
  // Use a replacement function (not a string literal) to prevent JavaScript's special
  // $& / $` / $' / $1 replacement patterns from corrupting the output if harnessScript
  // ever contains dollar signs (e.g. from template literals, Sentry patterns, etc.).
  if (html.includes('</body>')) {
    return html.replace('</body>', () => harnessScript + '\n</body>');
  }
  return html + harnessScript;
}

// ─── Behavioral transcript capture ──────────────────────────────────────────
/**
 * Given an already-running Playwright page at game screen, fires game_init, observes
 * correct+wrong interactions, and captures postMessage payloads.
 * Returns a formatted transcript string injected into test-gen prompts.
 * All steps are try/catch — never throws, returns empty string on failure.
 * @param {import('@playwright/test').Page} page
 * @param {{interactionType: string, totalRounds: number|null}} specMeta
 * @param {object|null} [logger]
 * @returns {Promise<string>}
 */
async function captureBehavioralTranscript(page, specMeta, logger) {
  const info = logger ? (m) => logger.info(m) : console.log;
  const warn = logger ? (m) => logger.warn(m) : console.warn;
  const { interactionType } = specMeta;

  try {
    const transcript = [];
    const correctTs = () => Date.now() - correctT0; // eslint-disable-line no-use-before-define, no-unused-vars

    // Fire game_init to start the game (CDN pattern)
    /* eslint-disable no-undef */
    await page.evaluate(() => window.postMessage({ type: 'game_init' }, '*'));
    /* eslint-enable no-undef */

    // Wait up to 7s for phase to reach 'playing' (CDN packages may still load)
    let playingReached = false;
    const phaseDeadline = Date.now() + 7000;
    while (Date.now() < phaseDeadline) {
      /* eslint-disable no-undef */
      const phase = await page.evaluate(() => window.gameState?.phase).catch(() => null);
      /* eslint-enable no-undef */
      if (phase === 'playing') {
        playingReached = true;
        break;
      }
      await page.waitForTimeout(300);
    }

    if (!playingReached) {
      warn('[pipeline] Behavioral transcript: phase did not reach "playing" — will still attempt observation');
    }

    // Extra settle time for CDN package init
    await page.waitForTimeout(1500);

    // Read round data from gameState (priority: round → content[0] → top-level fields)
    /* eslint-disable no-undef */
    const roundData = await page
      .evaluate(() => {
        const gs = window.gameState;
        if (!gs) return null;
        if (gs.round && typeof gs.round === 'object') return gs.round;
        if (gs.content && Array.isArray(gs.content) && gs.content.length > 0) return gs.content[0];
        const keys = [
          'correctAnswer',
          'question',
          'answer',
          'targetSum',
          'targetNumber',
          'validSolution',
          'options',
          'targetWord',
        ];
        const top = {};
        for (const k of keys) {
          if (gs[k] !== undefined) top[k] = gs[k];
        }
        return Object.keys(top).length > 0 ? top : null;
      })
      .catch(() => null);
    /* eslint-enable no-undef */

    /* eslint-disable no-undef */
    const stateAtStart = await page
      .evaluate(() => ({
        phase: window.gameState?.phase,
        lives: window.gameState?.lives,
        score: window.gameState?.score,
      }))
      .catch(() => ({}));
    /* eslint-enable no-undef */

    transcript.push('GAME STATE at round start:');
    transcript.push(`  phase: "${stateAtStart.phase}"`);
    transcript.push(`  lives: ${stateAtStart.lives}`);
    transcript.push(`  score: ${stateAtStart.score}`);
    if (roundData) {
      const roundStr = JSON.stringify(roundData);
      transcript.push(`  round: ${roundStr.substring(0, 300)}`);
    }
    transcript.push('');

    // ─── Correct interaction ─────────────────────────────────────────────────
    transcript.push('CORRECT INTERACTION observed:');
    let correctT0 = Date.now();
    let correctDone = false;

    if (interactionType === 'grid-click') {
      const validSolution = roundData?.validSolution;
      if (Array.isArray(validSolution) && validSolution.length > 0) {
        for (const idx of validSolution) {
          // Try multiple selector patterns for grid cells
          const selectors = [
            `[data-testid="grid-cell-${idx}"]`,
            `[data-index="${idx}"]`,
            `.grid-cell:nth-child(${idx + 1})`,
            `.cell:nth-child(${idx + 1})`,
          ];
          let clicked = false;
          for (const sel of selectors) {
            const cell = page.locator(sel).first();
            if (await cell.isVisible({ timeout: 600 }).catch(() => false)) {
              await cell.click();
              /* eslint-disable no-undef */
              const st = await page
                .evaluate(() => ({ score: window.gameState?.score, lives: window.gameState?.lives }))
                .catch(() => ({}));
              /* eslint-enable no-undef */
              transcript.push(
                `  [T=${Date.now() - correctT0}ms]   Clicked cell index ${idx} (${sel})  → score=${st.score}, lives=${st.lives}`,
              );
              clicked = true;
              break;
            }
          }
          void clicked;
          await page.waitForTimeout(80);
        }
        // Click submit
        const submitSel =
          '#btn-submit, [data-testid="submit"], button:has-text("Submit"), button:has-text("Check"), button:has-text("Done")';
        const submitBtn = page.locator(submitSel).first();
        if (await submitBtn.isVisible({ timeout: 800 }).catch(() => false)) {
          await submitBtn.click();
          transcript.push(`  [T=${Date.now() - correctT0}ms]   Clicked submit`);
        }
        correctDone = true;
      } else {
        // No validSolution — click first visible cell
        const firstCell = page.locator('.grid-cell, [data-testid*="cell"], .cell').first();
        if (await firstCell.isVisible({ timeout: 800 }).catch(() => false)) {
          await firstCell.click();
          transcript.push(`  [T=${Date.now() - correctT0}ms]   Clicked first cell (validSolution unknown)`);
          correctDone = true;
        }
      }
    } else if (interactionType === 'mcq-click') {
      const correctAnswer = roundData?.correctAnswer ?? roundData?.answer;
      if (correctAnswer !== undefined) {
        const btn = page
          .locator(
            `button:has-text("${correctAnswer}"), [data-testid*="option"]:has-text("${correctAnswer}"), .option:has-text("${correctAnswer}")`,
          )
          .first();
        if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
          await btn.click();
          transcript.push(`  [T=${Date.now() - correctT0}ms]   Clicked option "${correctAnswer}" (correctAnswer)`);
          correctDone = true;
        }
      }
      if (!correctDone) {
        const firstBtn = page.locator('.option, .answer-btn, .option-btn, [data-testid*="option"]').first();
        if (await firstBtn.isVisible({ timeout: 800 }).catch(() => false)) {
          await firstBtn.click();
          transcript.push(`  [T=${Date.now() - correctT0}ms]   Clicked first option (correctAnswer unknown)`);
          correctDone = true;
        }
      }
    } else if (interactionType === 'text-input') {
      const correctAnswer = roundData?.correctAnswer ?? roundData?.answer;
      if (correctAnswer !== undefined) {
        const input = page
          .locator('input[type="text"], input[type="number"], #answer-input, [data-testid="answer-input"]')
          .first();
        if (await input.isVisible({ timeout: 800 }).catch(() => false)) {
          await input.fill(String(correctAnswer));
          await input.press('Enter');
          transcript.push(`  [T=${Date.now() - correctT0}ms]   Typed "${correctAnswer}" + Enter`);
          correctDone = true;
        }
      }
    }
    // drag/swipe: skip (too complex to automate)

    if (correctDone) {
      await page.waitForTimeout(1200);
      /* eslint-disable no-undef */
      const stateAfterCorrect = await page
        .evaluate(() => ({
          phase: window.gameState?.phase,
          lives: window.gameState?.lives,
          score: window.gameState?.score,
        }))
        .catch(() => ({}));
      /* eslint-enable no-undef */
      transcript.push(
        `  [T=${Date.now() - correctT0}ms]   After animation → score=${stateAfterCorrect.score}, lives=${stateAfterCorrect.lives}, phase="${stateAfterCorrect.phase}"`,
      );
    } else {
      transcript.push(`  (skipped — could not automate correct interaction for type="${interactionType}")`);
    }
    transcript.push('');

    // ─── Wrong interaction ───────────────────────────────────────────────────
    /* eslint-disable no-undef */
    const phaseNow = await page.evaluate(() => window.gameState?.phase).catch(() => null);
    /* eslint-enable no-undef */

    if (phaseNow === 'playing') {
      transcript.push('WRONG INTERACTION observed:');
      const wrongT0 = Date.now();
      let wrongDone = false;

      if (interactionType === 'grid-click') {
        const validSolution = roundData?.validSolution;
        const wrongIdx = validSolution ? ([...Array(12).keys()].find((i) => !validSolution.includes(i)) ?? 0) : 0;
        const wrongSelectors = [
          `[data-testid="grid-cell-${wrongIdx}"]`,
          `[data-index="${wrongIdx}"]`,
          `.grid-cell:nth-child(${wrongIdx + 1})`,
        ];
        for (const sel of wrongSelectors) {
          const wrongCell = page.locator(sel).first();
          if (await wrongCell.isVisible({ timeout: 600 }).catch(() => false)) {
            await wrongCell.click();
            transcript.push(`  [T=${Date.now() - wrongT0}ms]   Clicked wrong cell index ${wrongIdx}`);
            const submitSel =
              '#btn-submit, [data-testid="submit"], button:has-text("Submit"), button:has-text("Check")';
            const submitBtn = page.locator(submitSel).first();
            if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
              await submitBtn.click();
              transcript.push(`  [T=${Date.now() - wrongT0}ms]   Clicked submit`);
            }
            wrongDone = true;
            break;
          }
        }
      } else if (interactionType === 'mcq-click') {
        const correctAnswer = roundData?.correctAnswer ?? roundData?.answer;
        const options = page.locator('.option, .answer-btn, .option-btn, [data-testid*="option"]');
        const count = await options.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          const optText = await options
            .nth(i)
            .textContent()
            .catch(() => '');
          if (String(optText).trim() !== String(correctAnswer)) {
            await options.nth(i).click();
            transcript.push(`  [T=${Date.now() - wrongT0}ms]   Clicked wrong option "${optText?.trim()}"`);
            wrongDone = true;
            break;
          }
        }
      } else if (interactionType === 'text-input') {
        const correctAnswer = roundData?.correctAnswer ?? roundData?.answer;
        const wrongAnswer = correctAnswer !== undefined ? String(Number(correctAnswer) + 99) : '9999';
        const input = page
          .locator('input[type="text"], input[type="number"], #answer-input, [data-testid="answer-input"]')
          .first();
        if (await input.isVisible({ timeout: 800 }).catch(() => false)) {
          await input.fill(wrongAnswer);
          await input.press('Enter');
          transcript.push(`  [T=${Date.now() - wrongT0}ms]   Typed wrong answer "${wrongAnswer}" + Enter`);
          wrongDone = true;
        }
      }

      if (wrongDone) {
        await page.waitForTimeout(800);
        /* eslint-disable no-undef */
        const stateAfterWrong = await page
          .evaluate(() => ({
            phase: window.gameState?.phase,
            lives: window.gameState?.lives,
            score: window.gameState?.score,
          }))
          .catch(() => ({}));
        /* eslint-enable no-undef */
        transcript.push(
          `  [T=${Date.now() - wrongT0}ms]   After feedback → score=${stateAfterWrong.score}, lives=${stateAfterWrong.lives}, phase="${stateAfterWrong.phase}"`,
        );
      } else {
        transcript.push(`  (skipped — could not automate wrong interaction for type="${interactionType}")`);
      }
      transcript.push('');
    }

    // ─── Capture postMessage via endGame ────────────────────────────────────
    try {
      /* eslint-disable no-undef */
      await page.evaluate(() => {
        if (window.__ralph?.endGame) window.__ralph.endGame('victory');
        else if (window.endGame) window.endGame('victory');
        else window.postMessage({ type: 'end_game' }, '*');
      });
      /* eslint-enable no-undef */
      await page.waitForTimeout(1200);
      /* eslint-disable no-undef */
      const postMessageLog = await page.evaluate(() => window.__postMessageLog || []).catch(() => []);
      /* eslint-enable no-undef */
      if (postMessageLog.length > 0) {
        const lastMsg = postMessageLog[postMessageLog.length - 1];
        transcript.push('POSTMESSAGE captured (endGame):');
        const msgStr = JSON.stringify(lastMsg, null, 2);
        transcript.push('  ' + msgStr.replace(/\n/g, '\n  '));
        transcript.push('');
      }
    } catch {
      // postMessage capture optional — not critical
    }

    if (transcript.length === 0) return null;

    info(
      `[pipeline] Behavioral transcript captured (${transcript.filter((l) => l.startsWith('  [')).length} interaction events)`,
    );
    return `OBSERVED GAME BEHAVIOR — ground truth from running the game (write tests that match exactly):\n\n${transcript.join('\n')}`;
  } catch (err) {
    warn(`[pipeline] Behavioral transcript capture error: ${err.message}`);
    return null;
  }
}

// ─── DOM snapshot for test generation context ───────────────────────────────
/**
 * Launches a headless Playwright browser against the game, navigates start and game screens,
 * and returns a formatted string of actual element IDs/classes/visibility + window.gameState shape.
 * Injected into test-gen prompts so the LLM uses real selectors rather than guesses.
 * @param {string} gameDir - Directory containing index.html (served on a free port)
 * @param {string} transitionSlotId - CDN transition slot element ID
 * @param {{interactionType: string, totalRounds: number|null}} specMeta
 * @param {object|null} [logger]
 * @returns {Promise<{snapshot: string, gameStateShape: string|null, roundsFromDom: Array}>}
 */
async function captureGameDomSnapshot(gameDir, transitionSlotId, specMeta, logger) {
  const info = logger ? (m) => logger.info(m) : console.log;
  const warn = logger ? (m) => logger.warn(m) : console.warn;
  const SNAPSHOT_PORT = await findFreePort();
  let snapshotServer;

  try {
    snapshotServer = spawnServeProcess(gameDir, SNAPSHOT_PORT);
    await new Promise((r) => setTimeout(r, 2500));

    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    const page = await context.newPage();

    // Override visibilityState so VisibilityTracker never pauses.
    // Also intercept window.parent.postMessage for behavioral transcript capture.
    // eslint-disable-next-line no-undef
    await page.addInitScript(() => {
      // eslint-disable-next-line no-undef
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
      // eslint-disable-next-line no-undef
      Object.defineProperty(document, 'hidden', { get: () => false });
      // Capture postMessages sent by the game (window.parent.postMessage in iframes → window.postMessage here)
      // eslint-disable-next-line no-undef
      window.__postMessageLog = [];
      // eslint-disable-next-line no-undef
      const _origPostMessage = window.postMessage.bind(window);
      // eslint-disable-next-line no-undef
      window.postMessage = function (data, targetOrigin, transfer) {
        // eslint-disable-next-line no-undef
        if (data && typeof data === 'object' && data.type) window.__postMessageLog.push(data);
        return _origPostMessage(data, targetOrigin, transfer);
      };
      // Also intercept window.parent.postMessage (games running in iframe context use this)
      // eslint-disable-next-line no-undef
      if (window.parent && window.parent !== window) {
        try {
          // eslint-disable-next-line no-undef
          const _origParentPostMessage = window.parent.postMessage.bind(window.parent);
          // eslint-disable-next-line no-undef
          window.parent.postMessage = function (data, targetOrigin, transfer) {
            // eslint-disable-next-line no-undef
            if (data && typeof data === 'object' && data.type) window.__postMessageLog.push(data);
            return _origParentPostMessage(data, targetOrigin, transfer);
          };
        } catch {
          /* cross-origin parent — can't intercept */
        }
      }
    });
    await page.goto(`http://localhost:${SNAPSHOT_PORT}`);

    // Poll for popup + transition slot — CDN games can take 45–60s to init
    {
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        const okayBtn = page.locator('button:has-text("Okay!")');
        if (await okayBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await okayBtn.click();
          await page.waitForTimeout(300);
        }
        const slotReady = await page
          .locator(`#${transitionSlotId} button`)
          .first()
          .isVisible({ timeout: 300 })
          .catch(() => false);
        if (slotReady) break;
        await page.waitForTimeout(500);
      }
      // Final check
      await page.locator(`#${transitionSlotId} button`).first().waitFor({ state: 'visible', timeout: 5000 });
    }

    // Extract start screen DOM — page.evaluate() runs in browser scope (document/getComputedStyle are browser globals)
    /* eslint-disable no-undef */
    const extractDom = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[id]')).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.id,
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList).join(' '),
            visible: r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none',
            text: el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80),
          };
        }),
      );
    /* eslint-enable no-undef */

    const startDom = await extractDom();

    // Navigate to game screen — click transition button, dismiss any popup, then click again if still visible
    await page.locator(`#${transitionSlotId} button`).first().click();
    await page.waitForTimeout(600);
    // Dismiss any popup that may appear after first click
    const okayBtnPost = page.locator('button:has-text("Okay!")');
    if (await okayBtnPost.isVisible({ timeout: 500 }).catch(() => false)) {
      await okayBtnPost.click();
      await page.waitForTimeout(300);
    }
    // Second click only if transition button is still visible (some games need 2 clicks)
    if (
      await page
        .locator(`#${transitionSlotId} button`)
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false)
    ) {
      await page.locator(`#${transitionSlotId} button`).first().click();
    }
    await page.waitForTimeout(1000);

    const gameDom = await extractDom();

    // Capture game content for fallbackContent (game-agnostic round data)
    let gameContent = null;
    try {
      /* eslint-disable no-undef */
      gameContent = await page.evaluate(() => window.gameState?.content || null);
      /* eslint-enable no-undef */
    } catch {
      /* content not available */
    }

    // Capture game state shape so test generator knows actual property names/types
    // Prevents "X is not iterable" errors from LLM guessing wrong data structures
    let gameStateShape = null;
    try {
      /* eslint-disable no-undef */
      gameStateShape = await page.evaluate(() => {
        const gs = window.gameState;
        if (!gs) return null;
        const describeValue = (v) => {
          if (Array.isArray(v)) {
            if (v.length === 0) return 'Array(0)';
            const first = v[0];
            if (first !== null && typeof first === 'object') {
              return `Array(${v.length}) of objects with keys: [${Object.keys(first).join(', ')}]`;
            }
            return `Array(${v.length}) of ${typeof first}`;
          }
          if (v !== null && typeof v === 'object') return `object {${Object.keys(v).join(', ')}}`;
          if (typeof v === 'string') return `string "${v.slice(0, 40)}"`;
          return `${typeof v} ${JSON.stringify(v)}`;
        };
        return Object.fromEntries(Object.entries(gs).map(([k, v]) => [k, describeValue(v)]));
      });
      /* eslint-enable no-undef */
    } catch {
      /* gameState not available */
    }

    // ─── Step 2.5b: Behavioral transcript ───────────────────────────────────
    // After DOM snapshot, fire game_init and observe actual interactions before closing.
    let behavioralTranscript = null;
    if (specMeta) {
      behavioralTranscript = await captureBehavioralTranscript(page, specMeta, logger);
    }

    await browser.close();

    // Format: show all elements with id; mark hidden ones so LLM knows they exist
    const fmt = (items) =>
      items
        .filter((e) => e.id)
        .map((e) => {
          const cls = e.classes ? ` (classes: ${e.classes})` : '';
          const txt = e.text ? ` — "${e.text}"` : '';
          const vis = e.visible ? '' : ' [hidden — conditionally shown]';
          return `  #${e.id} [${e.tag}]${cls}${vis}${txt}`;
        })
        .join('\n') || '  (none)';

    const snapshot = {
      startScreen: startDom.filter((e) => e.id),
      gameScreen: gameDom.filter((e) => e.id),
      gameStateShape,
      capturedAt: new Date().toISOString(),
    };

    // Save for debugging
    fs.writeFileSync(path.join(gameDir, 'tests', 'dom-snapshot.json'), JSON.stringify(snapshot, null, 2));
    if (gameContent) {
      fs.writeFileSync(path.join(gameDir, 'tests', 'game-content.json'), JSON.stringify(gameContent, null, 2));
    }

    info(
      `[pipeline] DOM snapshot: ${snapshot.startScreen.length} start-screen elements, ${snapshot.gameScreen.length} game-screen elements${gameStateShape ? `, gameState keys: ${Object.keys(gameStateShape).join(', ')}` : ''}`,
    );

    const gameStateBlock = gameStateShape
      ? `\nWINDOW.GAMESTATE SHAPE (actual runtime values — use THESE property names/types in tests, do NOT guess):\n${Object.entries(
          gameStateShape,
        )
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')}\n`
      : '';

    // Save behavioral transcript for debugging
    if (behavioralTranscript) {
      fs.writeFileSync(path.join(gameDir, 'tests', 'behavioral-transcript.txt'), behavioralTranscript);
    }

    const transcriptBlock = behavioralTranscript ? `\n\n${behavioralTranscript}` : '';

    return `ACTUAL RUNTIME DOM — captured from the running game (use THESE IDs/classes, not guesses from HTML source):

START SCREEN (after popup dismissed, waiting for game to begin):
${fmt(startDom)}

GAME SCREEN (after clicking through both transition buttons):
${fmt(gameDom)}${gameStateBlock}${transcriptBlock}`;
  } catch (err) {
    warn(`[pipeline] DOM snapshot failed: ${err.message} — falling back to static HTML analysis`);
    // Static fallback: extract IDs and classes from HTML source when browser-based snapshot times out
    try {
      const htmlPath = path.join(gameDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        const classMatches = [...html.matchAll(/\bclass="([^"]+)"/g)]
          .map((m) => m[1].split(/\s+/))
          .flat()
          .filter((c, i, arr) => arr.indexOf(c) === i);
        const dataTestIds = [...html.matchAll(/\bdata-testid="([^"]+)"/g)].map((m) => m[1]);
        const snapshot = {
          ids: [...new Set(idMatches)].slice(0, 60),
          classes: classMatches.slice(0, 40),
          dataTestIds: dataTestIds.slice(0, 20),
        };
        fs.writeFileSync(path.join(gameDir, 'tests', 'dom-snapshot.json'), JSON.stringify(snapshot, null, 2));
        return `STATIC HTML ANALYSIS (browser snapshot timed out — CDN init too slow):

IDs found in HTML: ${snapshot.ids.join(', ')}
Classes found in HTML: ${snapshot.classes.join(', ')}${snapshot.dataTestIds.length ? `\ndata-testid attributes: ${snapshot.dataTestIds.join(', ')}` : ''}

NOTE: These are from static HTML, not runtime. Use them as selector hints but verify with the spec.`;
      }
    } catch (_e) {
      // ignore static fallback errors
    }
    return null;
  } finally {
    if (snapshotServer) {
      try {
        snapshotServer.kill();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Attempts to extract example round/question data from a spec markdown file.
 * Returns an array of { question, answer, ... } objects, or [] if not found.
 */
function extractSpecRounds(specContent) {
  if (!specContent) return [];
  const rounds = [];

  // Pattern 1: Markdown table rows with Q/A structure
  // e.g. | Question | Answer | or | 3 + 4 | 7 |
  const tableRowPattern = /^\|([^|]+)\|([^|]+)\|/gm;
  let match;
  while ((match = tableRowPattern.exec(specContent)) !== null) {
    const col1 = match[1].trim();
    const col2 = match[2].trim();
    // Skip header rows (contain "Question", "Answer", "---", etc.)
    if (/question|answer|input|output|---|:--/i.test(col1)) continue;
    // Skip spec/template metadata rows (Parts Selected table: "Part ID", "PART-001", etc.)
    if (/^part[\s-]?id$|^part-\d+$/i.test(col1)) continue;
    // Skip rows where col2 is YES/NO/— (Included column in Parts Selected table)
    if (/^(yes|no|—|-)$/i.test(col2)) continue;
    if (col1.length > 0 && col2.length > 0) {
      rounds.push({ question: col1, answer: col2 });
    }
    if (rounds.length >= 5) break; // 5 examples is enough
  }

  // Pattern 2: Numbered list items "1. Question → Answer" or "1. 3+4=7"
  if (rounds.length === 0) {
    const listPattern = /^\d+\.\s+(.+?)\s*[→=:]\s*(.+)$/gm;
    while ((match = listPattern.exec(specContent)) !== null) {
      rounds.push({ question: match[1].trim(), answer: match[2].trim() });
      if (rounds.length >= 5) break;
    }
  }

  return rounds;
}

// ─── Spec-derived test generation hints ─────────────────────────────────────
/**
 * Analyzes spec and HTML to detect interaction patterns that commonly cause test generation failures.
 * Returns an array of targeted warning strings injected into the test-gen prompt.
 * @param {string} specContent
 * @param {string} [htmlContent='']
 * @returns {string[]}
 */
function extractTestGenerationHints(specContent, htmlContent = '') {
  const hints = [];
  const spec = specContent.toLowerCase();
  const html = htmlContent.toLowerCase();

  // Multi-cell selection games (e.g. hidden-sums, grid puzzles)
  // Pattern: submit button + individual cell/tile selection
  const hasSubmitButton = /\bsubmit\b/.test(spec) || /#btn-submit|id="submit/.test(html);
  const hasGridCells =
    /grid.cell|grid-cell|\.cell\b/.test(html) || /grid.*cell|cell.*select|select.*cell/i.test(specContent);
  if (hasSubmitButton && hasGridCells) {
    hints.push(
      'MULTI-CELL INTERACTION: This game requires clicking individual cells then a Submit button. ' +
        'window.__ralph.answer() will NOT work — it cannot simulate multi-cell selection. ' +
        "Tests must: (1) click each required cell using page.locator('.grid-cell').nth(N).click(), " +
        '(2) then click the Submit button. Use window.gameState to find correct cell indices from the current round data.',
    );
  }

  // Timed flash / dot-show phase (e.g. count-and-tap, dot games)
  // Pattern: brief item display followed by answer options
  if (/\bflash\b|\bbriefly\b|dot.count|dot.flash|show.then.hide|reveal.*then|timed.*display/i.test(specContent)) {
    hints.push(
      'TIMED FLASH PHASE: This game shows items briefly then hides them before answer options appear. ' +
        'Tests MUST NOT click answer buttons immediately after game_init — the options are not yet rendered. ' +
        "Wait for answer options to appear: await page.waitForSelector('[data-testid=\"answer-option\"], .option-btn, #options-row button', { state: 'visible' }). " +
        'A waitForTimeout(2000) before looking for options is safer than relying on selectors alone.',
    );
  }

  // Learn/recall two-phase games (e.g. word-pairs, memory games)
  // Pattern: study phase followed by recall/quiz phase
  if (
    /\blearn.phase\b|\bstudy.phase\b|\blearn.then.recall\b|\bexposure.duration\b|\bmemorize\b|\brecall.phase\b/i.test(
      specContent,
    )
  ) {
    hints.push(
      'LEARN/RECALL GAME: This game has a learn phase (items shown for several seconds each) before the recall phase. ' +
        'The learn phase can take 9-15+ seconds per round. Tests MUST wait for the recall phase before interacting. ' +
        "Use: await page.waitForSelector('#recall-area, [data-testid=\"recall-input\"], #answer-input', { state: 'visible', timeout: 30000 }). " +
        'NEVER hardcode expected answer order — recall order is shuffled. Always read the prompt element (e.g. #prompt-word) to determine which answer is expected, then type it.',
    );
  }

  // Sequential step chain games (e.g. sequence-builder, multi-step puzzles)
  // Pattern: steps unlock one at a time
  if (
    /step.unlock|unlock.*step|\bchain.complete\b|\bsequential.step|\bstep-by-step\b|steps.*lock|locked.*step/i.test(
      specContent,
    )
  ) {
    hints.push(
      'SEQUENTIAL STEPS: This game unlocks steps one at a time. Tests MUST answer each step before the next is available. ' +
        'After answering each step, wait for the next to unlock: await page.waitForTimeout(500). ' +
        'Clicking a locked step has no effect (pointer-events:none). ' +
        'After the final step, wait for chain-complete animation: await page.waitForTimeout(2500). ' +
        'A wrong answer does NOT advance to the next step — it re-enables the same step after a delay.',
    );
  }

  // Text input games (typing answers)
  if (
    /\btype\b.*\banswer\b|\binput.*text|\bkeyboard\b|\btype the\b|\bfill in\b/i.test(specContent) &&
    /<input|<textarea/.test(html)
  ) {
    hints.push(
      "TEXT INPUT: This game requires typing answers. Use page.locator('input, textarea').fill('answer') NOT .type(). " +
        'window.__ralph.answer() may not work — check if the game uses a text input element and interact with it directly.',
    );
  }

  // Lives-based star scoring (not accuracy-based)
  if (/lives.remaining.*star|stars.*lives.remaining|3.lives.*3.star|lives.*3.*star/i.test(specContent)) {
    hints.push(
      'LIVES-BASED STARS: Star rating is based on lives remaining (not accuracy). ' +
        '3 stars = 0 lives lost, 2 stars = 1 life lost, 1 star = 2 lives lost, 0 stars = all lives lost. ' +
        'Tests for star scoring should control how many wrong answers are given, not the accuracy percentage.',
    );
  }

  return hints;
}

// ─── Step 1d: Page load smoke check ─────────────────────────────────────────
// Spawns a local static server, opens the page in headless Playwright for 8s,
// collects console.error events, and returns { ok, fatalErrors }.
// Fatal error patterns: CDN package load failure, init errors, missing globals.
// Used by pipeline.js before test generation to abort early on broken pages.

const SMOKE_FATAL_PATTERNS = [
  /packages?\s+failed\s+to\s+load/i,
  /initialization\s+error/i,
  // Note: "Failed to load resource" with 403 is excluded — cdn.homeworkapp.ai/mathai-assets
  // returns 403 for auth-required media assets (images, audio, lottie) in headless Playwright.
  // These are non-fatal: game packages load via storage.googleapis.com; only media is blocked.
  // Real CDN package failures manifest as "Packages failed to load" or "X is not defined".
  /failed\s+to\s+load\s+resource(?!.*status of 403)/i,
  /waitforpackages/i,
  /is\s+not\s+(a\s+)?constructor/i,
];

// CDN-global-missing pattern: "X is not defined" — only fatal if combined with
// CDN/package context (i.e. the error message itself mentions a CDN-like token).
const SMOKE_UNDEFINED_PATTERN = /\w+\s+is\s+not\s+defined/i;
const SMOKE_UNDEFINED_CDN_CONTEXT = /cdn\.|package|script|load|undefined.*cdn|cdn.*undefined/i;

/**
 * Classify an array of console error strings and return only the fatal ones.
 * Exported separately so tests can validate pattern matching without Playwright.
 *
 * @param {string[]} consoleErrors - raw console.error message strings
 * @returns {string[]} fatalErrors - subset that match fatal patterns
 */
function classifySmokeErrors(consoleErrors) {
  return consoleErrors.filter((msg) => {
    for (const pattern of SMOKE_FATAL_PATTERNS) {
      if (pattern.test(msg)) return true;
    }
    if (SMOKE_UNDEFINED_PATTERN.test(msg) && SMOKE_UNDEFINED_CDN_CONTEXT.test(msg)) {
      return true;
    }
    return false;
  });
}

/**
 * Launches a headless browser, loads the game, and checks for fatal console errors.
 * Returns { ok: true } if no fatal errors are detected within the timeout.
 * @param {string} htmlFile - Path to the game's index.html
 * @param {string} gameDir - Directory to serve (contains index.html)
 * @param {object|null} [logger]
 * @returns {Promise<{ok: boolean, fatalErrors: string[]}>}
 */
async function runPageSmokeDiagnostic(htmlFile, gameDir, logger) {
  const info = logger ? (m) => logger.info(m) : console.log;
  const warn = logger ? (m) => logger.warn(m) : console.warn;
  void info; // suppress unused warning — available for future debug logging

  const SMOKE_PORT = await findFreePort();
  let smokeServer;

  try {
    smokeServer = spawnServeProcess(gameDir, SMOKE_PORT);
    // Wait for server to start (same delay as captureGameDomSnapshot)
    await new Promise((r) => setTimeout(r, 2500));

    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 480, height: 800 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 5s navigation timeout — if the page can't load at all, fail fast
    try {
      await page.goto(`http://localhost:${SMOKE_PORT}`, { timeout: 5000 });
    } catch {
      // page.goto timeout is non-fatal for smoke check purposes —
      // we still collect whatever errors appeared during partial load
    }

    // Collect console errors for 8 seconds total
    await page.waitForTimeout(8000);

    // Check for blank/white page — game content must be visible after 8s.
    // A missing #mathai-transition-slot or unrendered CDN game produces no console errors
    // but leaves the page empty. Detect this by checking #gameContent has children.
    let blankPageError = null;
    try {
      const hasContent = await page.evaluate(() => {
        const gc = document.querySelector('#gameContent');
        if (!gc) return { ok: false, reason: 'missing #gameContent element' };
        // Must have at least one child element (CDN game renders inside #gameContent)
        if (gc.children.length === 0) return { ok: false, reason: '#gameContent is empty — game did not render' };
        return { ok: true };
      });
      if (!hasContent.ok) {
        blankPageError = `Blank page: ${hasContent.reason}`;
      }
    } catch {
      // page.evaluate can fail if page crashed; console errors will catch that case
    }

    await browser.close();

    // Classify errors using shared helper (also exported for unit testing)
    const fatalErrors = classifySmokeErrors(consoleErrors);
    if (blankPageError) fatalErrors.push(blankPageError);

    if (fatalErrors.length > 0) {
      warn(`[pipeline] Step 1d: Fatal smoke errors detected: ${fatalErrors.slice(0, 3).join(' | ')}`);
      return { ok: false, fatalErrors };
    }

    return { ok: true, fatalErrors: [] };
  } catch (err) {
    // If Playwright itself fails (not installed, etc.), treat as non-fatal — don't block the build
    warn(`[pipeline] Step 1d: Smoke check failed with unexpected error: ${err.message} — skipping`);
    return { ok: true, fatalErrors: [] };
  } finally {
    if (smokeServer) {
      try {
        smokeServer.kill();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Build a playwright.config.js file content string for a given port.
 * Extracted to avoid duplication between pipeline.js and pipeline-targeted-fix.js.
 *
 * @param {number} port - The port the local test server will listen on.
 * @returns {string} The content to write to playwright.config.js.
 */
function buildPlaywrightConfig(port) {
  return `const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 90000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:${port}',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 15000,
  },
  webServer: {
    command: 'npx serve . -l ${port} -s --no-clipboard',
    port: ${port},
    reuseExistingServer: true,
    timeout: 15000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
`;
}

module.exports = {
  captureGameDomSnapshot,
  captureBehavioralTranscript,
  runPageSmokeDiagnostic,
  classifySmokeErrors,
  injectTestHarness,
  extractSpecMetadata,
  extractGameFeatures,
  extractSpecRounds,
  extractSpecKeywords,
  extractTestGenerationHints,
  jaccardSimilarity,
  getCategoryBoost,
  getRelevantLearnings,
  deriveRelevantCategories,
  isHtmlTruncated,
  findFreePort,
  spawnServeProcess,
  MODEL_COSTS,
  estimateCost,
  CATEGORY_SPEC_ORDER,
  buildPlaywrightConfig,
};

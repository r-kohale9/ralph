'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.RALPH_DB_PATH || path.join(__dirname, '..', 'data', 'builds.db');

let db;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      commit_sha TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      iterations INTEGER DEFAULT 0,
      generation_time_s INTEGER DEFAULT 0,
      total_time_s INTEGER DEFAULT 0,
      test_results TEXT,
      review_result TEXT,
      error_message TEXT,
      models TEXT,
      feedback_prompt TEXT,
      gcp_url TEXT,
      queued_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      requested_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_builds_game_id ON builds(game_id);
    CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
    CREATE INDEX IF NOT EXISTS idx_builds_completed ON builds(completed_at);

    CREATE TABLE IF NOT EXISTS failure_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'unknown',
      occurrences INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_fp_game_id ON failure_patterns(game_id);
    CREATE INDEX IF NOT EXISTS idx_fp_pattern ON failure_patterns(pattern);
    CREATE INDEX IF NOT EXISTS idx_fp_category ON failure_patterns(category);

    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      spec_content TEXT,
      spec_hash TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      slack_thread_ts TEXT,
      slack_channel_id TEXT,
      gcp_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    CREATE INDEX IF NOT EXISTS idx_games_spec_hash ON games(spec_hash);

    CREATE TABLE IF NOT EXISTS learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT,
      build_id INTEGER,
      level TEXT NOT NULL DEFAULT 'game',
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_learnings_game_id ON learnings(game_id);
    CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
    CREATE INDEX IF NOT EXISTS idx_learnings_level ON learnings(level);
    CREATE INDEX IF NOT EXISTS idx_learnings_cat_build ON learnings(category, build_id DESC);
    CREATE INDEX IF NOT EXISTS idx_builds_approved ON builds(id) WHERE status='approved';
  `);

  // ─── Versioned migrations (user_version pragma) ───────────────────────────
  // Each entry is applied exactly once: only when user_version < its index+1.
  // To add a migration: append to MIGRATIONS and increment DB_VERSION.
  const MIGRATIONS = [
    'ALTER TABLE builds ADD COLUMN feedback_prompt TEXT',
    'ALTER TABLE builds ADD COLUMN gcp_url TEXT',
    'ALTER TABLE builds ADD COLUMN skipped_tests TEXT',
    'ALTER TABLE builds ADD COLUMN worker_id TEXT',
    'ALTER TABLE builds ADD COLUMN retry_count INTEGER DEFAULT 0',
    'ALTER TABLE builds ADD COLUMN iteration_html_urls TEXT',
    'ALTER TABLE builds ADD COLUMN total_cost_usd REAL',
    'ALTER TABLE builds ADD COLUMN requested_by TEXT',
    'ALTER TABLE builds ADD COLUMN spec_keywords TEXT',
  ];
  const DB_VERSION = MIGRATIONS.length;

  const currentVersion = db.pragma('user_version', { simple: true });
  for (let i = currentVersion; i < DB_VERSION; i++) {
    try {
      db.exec(MIGRATIONS[i]);
    } catch {
      /* column already exists in pre-versioned DB — safe to ignore */
    }
  }
  if (currentVersion < DB_VERSION) {
    db.pragma(`user_version = ${DB_VERSION}`);
  }

  return db;
}

/**
 * Inserts a new build record with status 'queued' and returns its numeric ID.
 * @param {string} gameId
 * @param {string|null} commitSha
 * @param {{workerId?: string, requestedBy?: string}} [opts]
 * @returns {number} The new build ID
 */
function createBuild(gameId, commitSha, { workerId, requestedBy } = {}) {
  const stmt = getDb().prepare(
    'INSERT INTO builds (game_id, commit_sha, status, worker_id, requested_by) VALUES (?, ?, ?, ?, ?)',
  );
  const result = stmt.run(gameId, commitSha || null, 'queued', workerId || null, requestedBy || null);
  return Number(result.lastInsertRowid);
}

/**
 * Marks a build as 'running' and records started_at timestamp.
 * @param {number} buildId
 * @param {{workerId?: string}} [opts]
 */
function startBuild(buildId, { workerId } = {}) {
  if (workerId) {
    getDb()
      .prepare("UPDATE builds SET status = 'running', started_at = datetime('now'), worker_id = ? WHERE id = ?")
      .run(workerId, buildId);
  } else {
    getDb().prepare("UPDATE builds SET status = 'running', started_at = datetime('now') WHERE id = ?").run(buildId);
  }
}

/**
 * Updates a build with final report fields (status, iterations, test_results, etc.) and sets completed_at.
 * When status is 'failed' and report.errors is non-empty, the first error is stored as error_message
 * so the DB always has a descriptive failure reason (not NULL) for diagnostic queries.
 * @param {number} buildId
 * @param {{status: string, iterations: number, generation_time_s: number, total_time_s: number, test_results: Array, review_result?: string, models: object, skipped_tests?: Array, total_cost_usd?: number, errors?: string[]}} report
 */
function completeBuild(buildId, report) {
  const statusLower = report.status.toLowerCase();
  // Derive error_message from report.errors for failed builds so the DB never has NULL
  // error_message when we know the failure reason. Only set for failed builds — approved
  // builds should not have error_message.
  let errorMessage = null;
  if (statusLower === 'failed' && Array.isArray(report.errors) && report.errors.length > 0) {
    errorMessage = report.errors.join('; ').slice(0, 1000);
  } else if (statusLower === 'failed' && (!report.errors || report.errors.length === 0)) {
    // Failed with no explicit error — derive from test_results summary
    if (Array.isArray(report.test_results) && report.test_results.length > 0) {
      const maxIter = Math.max(...report.test_results.map((r) => r.iteration || 1));
      const lastIterResults = report.test_results.filter((r) => r.iteration === maxIter);
      const totalPassed = lastIterResults.reduce((s, r) => s + (r.passed || 0), 0);
      const totalFailed = lastIterResults.reduce((s, r) => s + (r.failed || 0), 0);
      // Include per-category breakdown so error_message is diagnostic without a DB join.
      // Identify categories that had 0/0 (page broken) vs actual failures.
      const categoryBreakdown = lastIterResults
        .map((r) => {
          const cat = r.category || r.batch || 'unknown';
          if ((r.passed || 0) === 0 && (r.failed || 0) === 0) return `${cat}:0/0(broken)`;
          return `${cat}:${r.passed || 0}p/${r.failed || 0}f`;
        })
        .join(', ');
      errorMessage = `Tests failed: ${totalPassed}/${totalPassed + totalFailed} passed after ${maxIter} iteration(s)${categoryBreakdown ? ` [${categoryBreakdown}]` : ''}. Review: ${report.review_result || 'SKIPPED'}`;
    } else {
      errorMessage = `Build failed with status=${statusLower}, iterations=${report.iterations || 0}, no test results recorded`;
    }
  }

  getDb()
    .prepare(
      `
    UPDATE builds SET
      status = ?,
      iterations = ?,
      generation_time_s = ?,
      total_time_s = ?,
      test_results = ?,
      review_result = ?,
      error_message = COALESCE(error_message, ?),
      models = ?,
      skipped_tests = ?,
      total_cost_usd = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `,
    )
    .run(
      statusLower,
      report.iterations,
      report.generation_time_s,
      report.total_time_s,
      JSON.stringify(report.test_results),
      report.review_result || null,
      errorMessage,
      JSON.stringify(report.models),
      JSON.stringify(report.skipped_tests || []),
      report.total_cost_usd || 0,
      buildId,
    );
}

/**
 * Marks a build as 'failed' with an error message and sets completed_at.
 * Always stores a non-null error_message so diagnostic queries never see NULL
 * for failed builds (root cause of count-and-tap null error_message pattern).
 * @param {number} buildId
 * @param {string} errorMessage
 */
function failBuild(buildId, errorMessage) {
  // Normalise: null / undefined / empty string all become a sentinel so the DB
  // column is never NULL for a failed build.  Any caller that passes a real
  // message is unaffected.
  const msg =
    (errorMessage && String(errorMessage).trim()) || 'build failed: no error message recorded';
  getDb()
    .prepare(
      `
    UPDATE builds SET
      status = 'failed',
      error_message = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `,
    )
    .run(msg, buildId);
}

function cancelBuild(buildId, reason) {
  getDb()
    .prepare(
      `
    UPDATE builds SET
      status = 'cancelled',
      error_message = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `,
    )
    .run(reason || 'Cancelled by user', buildId);
}

function getRecentBuilds(limit = 20) {
  return getDb()
    .prepare('SELECT *, total_time_s AS duration_s FROM builds ORDER BY COALESCE(completed_at, queued_at) DESC LIMIT ?')
    .all(limit);
}

function getBuildsByGame(gameId, limit = 10) {
  return getDb()
    .prepare('SELECT * FROM builds WHERE game_id = ? ORDER BY COALESCE(completed_at, queued_at) DESC LIMIT ?')
    .all(gameId, limit);
}

function getBuild(buildId) {
  return getDb().prepare('SELECT * FROM builds WHERE id = ?').get(buildId);
}

function getRunningBuilds() {
  return getDb().prepare("SELECT * FROM builds WHERE status = 'running'").all();
}

function getBuildStats() {
  return getDb()
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      ROUND(AVG(CASE WHEN status = 'approved' THEN total_time_s END), 1) as avg_approved_time_s,
      ROUND(AVG(CASE WHEN status = 'approved' THEN iterations END), 1) as avg_iterations
    FROM builds
  `,
    )
    .get();
}

// ─── E7: Failure pattern tracking ───────────────────────────────────────────

/**
 * Upserts a failure pattern: increments occurrences if it already exists, otherwise inserts it.
 * @param {string} gameId
 * @param {string} pattern - Short string description of the failure pattern
 * @param {string} [category] - Failure category (default 'unknown')
 * @returns {number} The failure_patterns row ID
 */
function recordFailurePattern(gameId, pattern, category) {
  const existing = getDb()
    .prepare('SELECT id, occurrences FROM failure_patterns WHERE game_id = ? AND pattern = ?')
    .get(gameId, pattern);

  if (existing) {
    getDb()
      .prepare(
        `
      UPDATE failure_patterns SET
        occurrences = occurrences + 1,
        last_seen = datetime('now')
      WHERE id = ?
    `,
      )
      .run(existing.id);
    return existing.id;
  }

  const result = getDb()
    .prepare('INSERT INTO failure_patterns (game_id, pattern, category) VALUES (?, ?, ?)')
    .run(gameId, pattern, category || 'unknown');
  return Number(result.lastInsertRowid);
}

function getFailurePatterns(gameId, limit = 20) {
  if (gameId) {
    return getDb()
      .prepare('SELECT * FROM failure_patterns WHERE game_id = ? ORDER BY occurrences DESC LIMIT ?')
      .all(gameId, limit);
  }
  return getDb().prepare('SELECT * FROM failure_patterns ORDER BY occurrences DESC LIMIT ?').all(limit);
}

function getTopFailurePatterns(limit = 10) {
  return getDb()
    .prepare(
      `
    SELECT pattern, category,
      SUM(occurrences) as total_occurrences,
      COUNT(DISTINCT game_id) as affected_games,
      MAX(last_seen) as last_seen
    FROM failure_patterns
    WHERE resolved = 0
    GROUP BY pattern
    ORDER BY total_occurrences DESC
    LIMIT ?
  `,
    )
    .all(limit);
}

/**
 * Searches failure_patterns for a known pattern that appears in failuresStr.
 * Prefers game-specific patterns; falls back to cross-game patterns seen in 2+ games.
 * @param {string} failuresStr - Concatenated failure messages to search within
 * @param {string} gameId
 * @returns {{pattern: string, category: string, occurrences: number}|null}
 */
function findMatchingPattern(failuresStr, gameId) {
  // Primary: look for matching patterns from this game's history
  const gamePatterns = getDb()
    .prepare(
      `SELECT pattern, category, occurrences
       FROM failure_patterns
       WHERE game_id = ? AND pattern != 'unknown' AND resolved = 0
       ORDER BY occurrences DESC
       LIMIT 10`,
    )
    .all(gameId);

  for (const p of gamePatterns) {
    if (p.pattern.length > 10 && failuresStr.includes(p.pattern)) {
      return p;
    }
  }

  // Fallback: cross-game patterns seen in 2+ games with 3+ total occurrences
  const crossGamePatterns = getDb()
    .prepare(
      `SELECT pattern, category, SUM(occurrences) AS total_occ, COUNT(DISTINCT game_id) AS games
       FROM failure_patterns
       WHERE pattern != 'unknown' AND resolved = 0
       GROUP BY pattern
       HAVING games >= 2 AND total_occ >= 3
       ORDER BY total_occ DESC
       LIMIT 5`,
    )
    .all();

  for (const p of crossGamePatterns) {
    if (p.pattern.length > 10 && failuresStr.includes(p.pattern)) {
      return { pattern: p.pattern, category: p.category, occurrences: p.total_occ };
    }
  }

  return null;
}

function resolveFailurePattern(gameId, pattern) {
  getDb().prepare('UPDATE failure_patterns SET resolved = 1 WHERE game_id = ? AND pattern = ?').run(gameId, pattern);
}

function getFailureStats() {
  return getDb()
    .prepare(
      `
    SELECT
      COUNT(*) as total_patterns,
      SUM(occurrences) as total_occurrences,
      COUNT(DISTINCT game_id) as affected_games,
      SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_count,
      (SELECT category FROM failure_patterns
       GROUP BY category ORDER BY SUM(occurrences) DESC LIMIT 1) as top_category
    FROM failure_patterns
  `,
    )
    .get();
}

// ─── Build extensions: feedback_prompt, gcp_url ─────────────────────────────

function updateBuildFeedback(buildId, feedbackPrompt) {
  getDb().prepare('UPDATE builds SET feedback_prompt = ? WHERE id = ?').run(feedbackPrompt, buildId);
}

function updateBuildGcpUrl(buildId, gcpUrl) {
  getDb().prepare('UPDATE builds SET gcp_url = ? WHERE id = ?').run(gcpUrl, buildId);
}

function updateBuildIterationUrl(buildId, key, url) {
  const build = getBuild(buildId);
  const urls = JSON.parse(build.iteration_html_urls || '{}');
  urls[key] = url;
  getDb().prepare('UPDATE builds SET iteration_html_urls = ? WHERE id = ?').run(JSON.stringify(urls), buildId);
}

function updateBuildSpecKeywords(buildId, keywords) {
  getDb()
    .prepare('UPDATE builds SET spec_keywords = ? WHERE id = ?')
    .run(JSON.stringify(keywords || []), buildId);
}

// ─── Games CRUD ──────────────────────────────────────────────────────────────

/**
 * Inserts or updates a game record (upsert on game_id).
 * @param {string} gameId
 * @param {{title?: string, description?: string, specContent?: string, specHash?: string}} [opts]
 * @returns {string} The gameId
 */
function createGame(gameId, { title, description, specContent, specHash } = {}) {
  getDb()
    .prepare(
      `
    INSERT INTO games (game_id, title, description, spec_content, spec_hash)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      spec_content = excluded.spec_content,
      spec_hash = excluded.spec_hash,
      updated_at = datetime('now')
  `,
    )
    .run(gameId, title || null, description || null, specContent || null, specHash || null);
  return gameId;
}

function getGame(gameId) {
  return getDb().prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
}

function listGames(limit = 50) {
  return getDb().prepare('SELECT * FROM games ORDER BY updated_at DESC LIMIT ?').all(limit);
}

function updateGameStatus(gameId, status) {
  getDb().prepare("UPDATE games SET status = ?, updated_at = datetime('now') WHERE game_id = ?").run(status, gameId);
}

function updateGameThread(gameId, threadTs, channelId) {
  getDb()
    .prepare(
      "UPDATE games SET slack_thread_ts = ?, slack_channel_id = ?, updated_at = datetime('now') WHERE game_id = ?",
    )
    .run(threadTs, channelId, gameId);
}

function updateGameGcpUrl(gameId, gcpUrl) {
  getDb().prepare("UPDATE games SET gcp_url = ?, updated_at = datetime('now') WHERE game_id = ?").run(gcpUrl, gameId);
}

function deleteGame(gameId) {
  getDb().prepare('DELETE FROM games WHERE game_id = ?').run(gameId);
}

// ─── Learnings CRUD ──────────────────────────────────────────────────────────

/**
 * Inserts a learning record tied to a game and optional build.
 * @param {string|null} gameId
 * @param {{buildId?: number, level?: string, category?: string, content: string, source?: string}} opts
 * @returns {number} The new learning ID
 */
function addLearning(gameId, { buildId, level, category, content, source } = {}) {
  const result = getDb()
    .prepare(
      `
    INSERT INTO learnings (game_id, build_id, level, category, content, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(gameId || null, buildId || null, level || 'game', category || 'general', content, source || 'manual');
  return Number(result.lastInsertRowid);
}

/**
 * Returns learnings matching optional filters, ordered by created_at DESC.
 * @param {{gameId?: string, category?: string, level?: string, includeResolved?: boolean}} [filters]
 * @returns {Array<object>}
 */
function getLearnings({ gameId, category, level, includeResolved } = {}) {
  let sql = 'SELECT * FROM learnings WHERE 1=1';
  const params = [];

  if (gameId) {
    sql += ' AND game_id = ?';
    params.push(gameId);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }
  if (!includeResolved) {
    sql += ' AND resolved = 0';
  }

  sql += ' ORDER BY created_at DESC';
  return getDb()
    .prepare(sql)
    .all(...params);
}

function resolveLearning(learningId) {
  getDb().prepare('UPDATE learnings SET resolved = 1 WHERE id = ?').run(learningId);
}

// ─── E4: Per-game learnings for context injection ─────────────────────────────

/**
 * Returns unresolved learnings for a specific game, most recent first.
 * Used by the pipeline to inject prior-build context into gen/fix prompts.
 *
 * @param {string} gameId
 * @param {number} limit - Max learnings to return (default 10)
 * @returns {Array<{level: string, category: string, content: string}>}
 */
function getGameLearnings(gameId, limit = 10) {
  return getDb()
    .prepare(
      `SELECT level, category, content FROM learnings
       WHERE game_id = ? AND resolved = 0
       ORDER BY id DESC LIMIT ?`,
    )
    .all(gameId, limit);
}

function getLearningStats() {
  return getDb()
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved,
      COUNT(DISTINCT game_id) as affected_games,
      (SELECT category FROM learnings
       GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1) as top_category
    FROM learnings
  `,
    )
    .get();
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  createBuild,
  startBuild,
  completeBuild,
  failBuild,
  cancelBuild,
  getRecentBuilds,
  getBuildsByGame,
  getBuild,
  getRunningBuilds,
  getBuildStats,
  updateBuildFeedback,
  updateBuildGcpUrl,
  updateBuildIterationUrl,
  updateBuildSpecKeywords,
  recordFailurePattern,
  getFailurePatterns,
  getTopFailurePatterns,
  findMatchingPattern,
  resolveFailurePattern,
  getFailureStats,
  createGame,
  getGame,
  listGames,
  updateGameStatus,
  updateGameThread,
  updateGameGcpUrl,
  deleteGame,
  addLearning,
  getLearnings,
  getGameLearnings,
  resolveLearning,
  getLearningStats,
  close,
};

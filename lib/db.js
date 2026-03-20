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
      completed_at TEXT
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
  `);

  // Migration: add columns to existing builds table if missing
  try {
    db.exec('ALTER TABLE builds ADD COLUMN feedback_prompt TEXT');
  } catch {
    /* column exists */
  }
  try {
    db.exec('ALTER TABLE builds ADD COLUMN gcp_url TEXT');
  } catch {
    /* column exists */
  }
  try {
    db.exec('ALTER TABLE builds ADD COLUMN skipped_tests TEXT');
  } catch {
    /* column exists */
  }
  try {
    db.exec('ALTER TABLE builds ADD COLUMN worker_id TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE builds ADD COLUMN retry_count INTEGER DEFAULT 0');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE builds ADD COLUMN iteration_html_urls TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE builds ADD COLUMN total_cost_usd REAL');
  } catch (_) {}

  return db;
}

function createBuild(gameId, commitSha, { workerId } = {}) {
  const stmt = getDb().prepare('INSERT INTO builds (game_id, commit_sha, status, worker_id) VALUES (?, ?, ?, ?)');
  const result = stmt.run(gameId, commitSha || null, 'queued', workerId || null);
  return Number(result.lastInsertRowid);
}

function startBuild(buildId, { workerId } = {}) {
  if (workerId) {
    getDb()
      .prepare("UPDATE builds SET status = 'running', started_at = datetime('now'), worker_id = ? WHERE id = ?")
      .run(workerId, buildId);
  } else {
    getDb().prepare("UPDATE builds SET status = 'running', started_at = datetime('now') WHERE id = ?").run(buildId);
  }
}

function completeBuild(buildId, report) {
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
      models = ?,
      skipped_tests = ?,
      total_cost_usd = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `,
    )
    .run(
      report.status,
      report.iterations,
      report.generation_time_s,
      report.total_time_s,
      JSON.stringify(report.test_results),
      report.review_result || null,
      JSON.stringify(report.models),
      JSON.stringify(report.skipped_tests || []),
      report.total_cost_usd || 0,
      buildId,
    );
}

function failBuild(buildId, errorMessage) {
  getDb()
    .prepare(
      `
    UPDATE builds SET
      status = 'FAILED',
      error_message = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `,
    )
    .run(errorMessage, buildId);
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
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      ROUND(AVG(CASE WHEN status = 'APPROVED' THEN total_time_s END), 1) as avg_approved_time_s,
      ROUND(AVG(CASE WHEN status = 'APPROVED' THEN iterations END), 1) as avg_iterations
    FROM builds
  `,
    )
    .get();
}

// ─── E7: Failure pattern tracking ───────────────────────────────────────────

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

// ─── Games CRUD ──────────────────────────────────────────────────────────────

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
  getRecentBuilds,
  getBuildsByGame,
  getBuild,
  getRunningBuilds,
  getBuildStats,
  updateBuildFeedback,
  updateBuildGcpUrl,
  updateBuildIterationUrl,
  recordFailurePattern,
  getFailurePatterns,
  getTopFailurePatterns,
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
  resolveLearning,
  getLearningStats,
  close,
};

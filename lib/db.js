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
  `);

  return db;
}

function createBuild(gameId, commitSha) {
  const stmt = getDb().prepare(
    'INSERT INTO builds (game_id, commit_sha, status) VALUES (?, ?, ?)'
  );
  const result = stmt.run(gameId, commitSha || null, 'queued');
  return Number(result.lastInsertRowid);
}

function startBuild(buildId) {
  getDb().prepare(
    "UPDATE builds SET status = 'running', started_at = datetime('now') WHERE id = ?"
  ).run(buildId);
}

function completeBuild(buildId, report) {
  getDb().prepare(`
    UPDATE builds SET
      status = ?,
      iterations = ?,
      generation_time_s = ?,
      total_time_s = ?,
      test_results = ?,
      review_result = ?,
      models = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(
    report.status,
    report.iterations,
    report.generation_time_s,
    report.total_time_s,
    JSON.stringify(report.test_results),
    report.review_result || null,
    JSON.stringify(report.models),
    buildId
  );
}

function failBuild(buildId, errorMessage) {
  getDb().prepare(`
    UPDATE builds SET
      status = 'FAILED',
      error_message = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(errorMessage, buildId);
}

function getRecentBuilds(limit = 20) {
  return getDb().prepare(
    'SELECT *, total_time_s AS duration_s FROM builds ORDER BY COALESCE(completed_at, queued_at) DESC LIMIT ?'
  ).all(limit);
}

function getBuildsByGame(gameId, limit = 10) {
  return getDb().prepare(
    'SELECT * FROM builds WHERE game_id = ? ORDER BY COALESCE(completed_at, queued_at) DESC LIMIT ?'
  ).all(gameId, limit);
}

function getBuild(buildId) {
  return getDb().prepare('SELECT * FROM builds WHERE id = ?').get(buildId);
}

function getBuildStats() {
  return getDb().prepare(`
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
  `).get();
}

// ─── E7: Failure pattern tracking ───────────────────────────────────────────

function recordFailurePattern(gameId, pattern, category) {
  const existing = getDb().prepare(
    'SELECT id, occurrences FROM failure_patterns WHERE game_id = ? AND pattern = ?'
  ).get(gameId, pattern);

  if (existing) {
    getDb().prepare(`
      UPDATE failure_patterns SET
        occurrences = occurrences + 1,
        last_seen = datetime('now')
      WHERE id = ?
    `).run(existing.id);
    return existing.id;
  }

  const result = getDb().prepare(
    'INSERT INTO failure_patterns (game_id, pattern, category) VALUES (?, ?, ?)'
  ).run(gameId, pattern, category || 'unknown');
  return Number(result.lastInsertRowid);
}

function getFailurePatterns(gameId, limit = 20) {
  if (gameId) {
    return getDb().prepare(
      'SELECT * FROM failure_patterns WHERE game_id = ? ORDER BY occurrences DESC LIMIT ?'
    ).all(gameId, limit);
  }
  return getDb().prepare(
    'SELECT * FROM failure_patterns ORDER BY occurrences DESC LIMIT ?'
  ).all(limit);
}

function getTopFailurePatterns(limit = 10) {
  return getDb().prepare(`
    SELECT pattern, category,
      SUM(occurrences) as total_occurrences,
      COUNT(DISTINCT game_id) as affected_games,
      MAX(last_seen) as last_seen
    FROM failure_patterns
    WHERE resolved = 0
    GROUP BY pattern
    ORDER BY total_occurrences DESC
    LIMIT ?
  `).all(limit);
}

function resolveFailurePattern(gameId, pattern) {
  getDb().prepare(
    'UPDATE failure_patterns SET resolved = 1 WHERE game_id = ? AND pattern = ?'
  ).run(gameId, pattern);
}

function getFailureStats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) as total_patterns,
      SUM(occurrences) as total_occurrences,
      COUNT(DISTINCT game_id) as affected_games,
      SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved_count,
      (SELECT category FROM failure_patterns
       GROUP BY category ORDER BY SUM(occurrences) DESC LIMIT 1) as top_category
    FROM failure_patterns
  `).get();
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
  getBuildStats,
  recordFailurePattern,
  getFailurePatterns,
  getTopFailurePatterns,
  resolveFailurePattern,
  getFailureStats,
  close,
};

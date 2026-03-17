'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('games and learnings tables', () => {
  let db;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gl-test-'));
  const dbPath = path.join(tmpDir, 'test-gl.db');

  before(() => {
    process.env.RALPH_DB_PATH = dbPath;
    delete require.cache[require.resolve('../lib/db')];
    db = require('../lib/db');
  });

  after(() => {
    db.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {}
    try {
      fs.unlinkSync(dbPath + '-wal');
    } catch {}
    try {
      fs.unlinkSync(dbPath + '-shm');
    } catch {}
    try {
      fs.rmdirSync(tmpDir);
    } catch {}
    delete process.env.RALPH_DB_PATH;
  });

  // ─── Games CRUD ──────────────────────────────────────────────────────────

  describe('games CRUD', () => {
    it('createGame creates a new game', () => {
      const id = db.createGame('test-game', {
        title: 'Test Game',
        description: 'A test game',
        specContent: '# Test Spec\nContent here',
        specHash: 'abc123',
      });
      assert.equal(id, 'test-game');
    });

    it('getGame retrieves a created game', () => {
      const game = db.getGame('test-game');
      assert.ok(game);
      assert.equal(game.game_id, 'test-game');
      assert.equal(game.title, 'Test Game');
      assert.equal(game.description, 'A test game');
      assert.equal(game.spec_hash, 'abc123');
      assert.equal(game.status, 'registered');
    });

    it('createGame upserts on conflict', () => {
      db.createGame('test-game', {
        title: 'Updated Title',
        description: 'Updated description',
        specContent: '# Updated Spec',
        specHash: 'def456',
      });
      const game = db.getGame('test-game');
      assert.equal(game.title, 'Updated Title');
      assert.equal(game.spec_hash, 'def456');
    });

    it('listGames returns all games', () => {
      db.createGame('game-2', { title: 'Game Two' });
      db.createGame('game-3', { title: 'Game Three' });
      const games = db.listGames();
      assert.ok(games.length >= 3);
    });

    it('listGames respects limit', () => {
      const games = db.listGames(2);
      assert.equal(games.length, 2);
    });

    it('updateGameStatus changes status', () => {
      db.updateGameStatus('test-game', 'building');
      const game = db.getGame('test-game');
      assert.equal(game.status, 'building');
    });

    it('updateGameThread sets thread info', () => {
      db.updateGameThread('test-game', '1234567890.123456', 'C12345');
      const game = db.getGame('test-game');
      assert.equal(game.slack_thread_ts, '1234567890.123456');
      assert.equal(game.slack_channel_id, 'C12345');
    });

    it('updateGameGcpUrl sets GCP URL', () => {
      db.updateGameGcpUrl('test-game', 'https://storage.googleapis.com/bucket/game.html');
      const game = db.getGame('test-game');
      assert.equal(game.gcp_url, 'https://storage.googleapis.com/bucket/game.html');
    });

    it('getGame returns undefined for non-existent game', () => {
      const game = db.getGame('non-existent');
      assert.equal(game, undefined);
    });

    it('deleteGame removes a game', () => {
      db.createGame('to-delete', { title: 'Delete Me' });
      assert.ok(db.getGame('to-delete'));
      db.deleteGame('to-delete');
      assert.equal(db.getGame('to-delete'), undefined);
    });

    it('createGame handles null optional fields', () => {
      db.createGame('minimal-game', {});
      const game = db.getGame('minimal-game');
      assert.equal(game.game_id, 'minimal-game');
      assert.equal(game.title, null);
      assert.equal(game.description, null);
    });

    it('game has created_at and updated_at timestamps', () => {
      const game = db.getGame('test-game');
      assert.ok(game.created_at);
      assert.ok(game.updated_at);
    });
  });

  // ─── Learnings CRUD ────────────────────────────────────────────────────────

  describe('learnings CRUD', () => {
    it('addLearning creates a learning and returns id', () => {
      const id = db.addLearning('test-game', {
        content: 'Star calculation should use spec formula',
        category: 'scoring',
        level: 'game',
        source: 'pipeline',
      });
      assert.equal(typeof id, 'number');
      assert.ok(id > 0);
    });

    it('addLearning id is JSON-serializable (not BigInt)', () => {
      const id = db.addLearning('test-game', { content: 'test learning' });
      const json = JSON.stringify({ id });
      assert.ok(json.includes(String(id)));
    });

    it('getLearnings returns learnings for a game', () => {
      const learnings = db.getLearnings({ gameId: 'test-game' });
      assert.ok(learnings.length >= 1);
      assert.ok(learnings.every((l) => l.game_id === 'test-game'));
    });

    it('getLearnings filters by category', () => {
      db.addLearning('test-game', { content: 'Rendering issue', category: 'rendering', source: 'pipeline' });
      const learnings = db.getLearnings({ gameId: 'test-game', category: 'scoring' });
      assert.ok(learnings.every((l) => l.category === 'scoring'));
    });

    it('getLearnings filters by level', () => {
      db.addLearning(null, { content: 'Global insight', level: 'global', source: 'manual' });
      const globals = db.getLearnings({ level: 'global' });
      assert.ok(globals.length >= 1);
      assert.ok(globals.every((l) => l.level === 'global'));
    });

    it('getLearnings excludes resolved by default', () => {
      const id = db.addLearning('test-game', { content: 'Resolved issue', source: 'pipeline' });
      db.resolveLearning(id);
      const learnings = db.getLearnings({ gameId: 'test-game' });
      assert.ok(learnings.every((l) => l.resolved === 0));
    });

    it('getLearnings includes resolved when requested', () => {
      const learnings = db.getLearnings({ gameId: 'test-game', includeResolved: true });
      assert.ok(learnings.some((l) => l.resolved === 1));
    });

    it('resolveLearning marks a learning as resolved', () => {
      const id = db.addLearning('test-game', { content: 'To resolve', source: 'manual' });
      db.resolveLearning(id);
      const learnings = db.getLearnings({ gameId: 'test-game', includeResolved: true });
      const resolved = learnings.find((l) => l.id === id);
      assert.equal(resolved.resolved, 1);
    });

    it('getLearningStats returns aggregate stats', () => {
      const stats = db.getLearningStats();
      assert.ok(typeof stats.total === 'number');
      assert.ok('active' in stats);
      assert.ok('resolved' in stats);
      assert.ok('affected_games' in stats);
    });

    it('addLearning with buildId stores build reference', () => {
      const buildId = db.createBuild('test-game', null);
      const id = db.addLearning('test-game', {
        buildId,
        content: 'Build-specific learning',
        source: 'pipeline',
      });
      const learnings = db.getLearnings({ gameId: 'test-game' });
      const found = learnings.find((l) => l.id === id);
      assert.equal(found.build_id, buildId);
    });

    it('addLearning defaults level to game when gameId provided', () => {
      const id = db.addLearning('test-game', { content: 'Default level test' });
      const learnings = db.getLearnings({ gameId: 'test-game' });
      const found = learnings.find((l) => l.id === id);
      assert.equal(found.level, 'game');
    });

    it('addLearning defaults source to manual', () => {
      const id = db.addLearning('test-game', { content: 'Default source test' });
      const learnings = db.getLearnings({ gameId: 'test-game', includeResolved: true });
      const found = learnings.find((l) => l.id === id);
      assert.equal(found.source, 'manual');
    });

    it('learning has created_at timestamp', () => {
      const learnings = db.getLearnings({ gameId: 'test-game' });
      assert.ok(learnings[0].created_at);
    });
  });

  // ─── Build extensions ──────────────────────────────────────────────────────

  describe('build extensions (feedback_prompt, gcp_url)', () => {
    it('updateBuildFeedback stores feedback prompt', () => {
      const buildId = db.createBuild('test-game', null);
      db.updateBuildFeedback(buildId, 'Fix the score display');
      const build = db.getBuild(buildId);
      assert.equal(build.feedback_prompt, 'Fix the score display');
    });

    it('updateBuildGcpUrl stores GCP URL', () => {
      const buildId = db.createBuild('test-game', null);
      db.updateBuildGcpUrl(buildId, 'https://storage.googleapis.com/bucket/game.html');
      const build = db.getBuild(buildId);
      assert.equal(build.gcp_url, 'https://storage.googleapis.com/bucket/game.html');
    });

    it('builds table has feedback_prompt column', () => {
      const buildId = db.createBuild('test-game', null);
      const build = db.getBuild(buildId);
      assert.ok('feedback_prompt' in build);
    });

    it('builds table has gcp_url column', () => {
      const buildId = db.createBuild('test-game', null);
      const build = db.getBuild(buildId);
      assert.ok('gcp_url' in build);
    });
  });
});

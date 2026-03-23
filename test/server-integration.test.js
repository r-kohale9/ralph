'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for Express HTTP routes with mocked queue/Redis
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set up temp DB before requiring server
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-si-'));
const dbPath = path.join(tmpDir, 'si.db');
process.env.RALPH_DB_PATH = dbPath;

// Clear DB module cache so it uses our temp path
delete require.cache[require.resolve('../lib/db')];

const { createApp } = require('../server');
const db = require('../lib/db');

// ─── Mock queue ─────────────────────────────────────────────────────────────
function createMockQueue() {
  const jobs = [];
  return {
    jobs,
    add: async (name, data, opts) => {
      jobs.push({ name, data, opts });
      return { id: jobs.length };
    },
    getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 }),
  };
}

function createMockConnection() {
  return {
    ping: async () => 'PONG',
  };
}

// ─── HTTP helper ────────────────────────────────────────────────────────────
function request(server, method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opts = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: urlPath,
      method,
      headers: { ...headers },
    };

    let payload;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['content-type'] = opts.headers['content-type'] || 'application/json';
      opts.headers['content-length'] = Buffer.byteLength(payload);
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Webhook helper ─────────────────────────────────────────────────────────
function signPayload(payload, secret) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Server integration: health & metrics', () => {
  let server, mockQueue, mockConn;

  before((_, done) => {
    mockQueue = createMockQueue();
    mockConn = createMockConnection();
    const app = createApp({ queue: mockQueue, connection: mockConn });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('GET /health returns ok when Redis is up', async () => {
    const res = await request(server, 'GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.redis, true);
    assert.ok('builds' in res.body);
    assert.ok('queue' in res.body);
  });

  it('GET /health returns degraded when connection fails', async () => {
    const failConn = {
      ping: async () => {
        throw new Error('Connection refused');
      },
    };
    const failQueue = {
      getJobCounts: async () => {
        throw new Error('nope');
      },
    };
    const app2 = createApp({ queue: failQueue, connection: failConn });
    const server2 = await new Promise((resolve) => {
      const s = app2.listen(0, () => resolve(s));
    });

    const res = await request(server2, 'GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'degraded');
    assert.equal(res.body.redis, false);
    server2.close();
  });

  it('GET /metrics returns Prometheus format', async () => {
    const res = await request(server, 'GET', '/metrics');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/plain'));
  });

  it('GET /api/metrics returns JSON', async () => {
    const res = await request(server, 'GET', '/api/metrics');
    assert.equal(res.status, 200);
    assert.ok(res.body);
  });
});

describe('Server integration: builds API', () => {
  let server, mockQueue;

  before((_, done) => {
    mockQueue = createMockQueue();
    const app = createApp({ queue: mockQueue, connection: createMockConnection() });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('GET /api/builds returns builds list and stats', async () => {
    const res = await request(server, 'GET', '/api/builds');
    assert.equal(res.status, 200);
    assert.ok('stats' in res.body);
    assert.ok('builds' in res.body);
    assert.ok(Array.isArray(res.body.builds));
  });

  it('GET /api/builds?limit=2 respects limit', async () => {
    // Create some builds first
    db.createBuild('game-a', null);
    db.createBuild('game-b', null);
    db.createBuild('game-c', null);

    const res = await request(server, 'GET', '/api/builds?limit=2');
    assert.equal(res.status, 200);
    assert.ok(res.body.builds.length <= 2);
  });

  it('GET /api/builds/:id returns a specific build', async () => {
    const id = db.createBuild('test-get', 'sha123');
    const res = await request(server, 'GET', `/api/builds/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.game_id, 'test-get');
  });

  it('GET /api/builds/:id returns 404 for missing build', async () => {
    const res = await request(server, 'GET', '/api/builds/99999');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Build not found');
  });

  it('GET /api/games/:gameId/builds returns warehouseific builds', async () => {
    db.createBuild('specific-game', null);
    const res = await request(server, 'GET', '/api/games/specific-game/builds');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /api/build queues a build job', async () => {
    const beforeLen = mockQueue.jobs.length;
    const res = await request(server, 'POST', '/api/build', { gameId: 'my-game' });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, true);
    assert.equal(res.body.gameId, 'my-game');
    assert.ok(res.body.buildId > 0);
    assert.equal(mockQueue.jobs.length, beforeLen + 1);
    assert.equal(mockQueue.jobs[mockQueue.jobs.length - 1].data.gameId, 'my-game');
  });

  it('POST /api/build returns 400 without gameId', async () => {
    const res = await request(server, 'POST', '/api/build', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'gameId is required');
  });

  it('POST /api/build passes specPath when provided', async () => {
    const res = await request(server, 'POST', '/api/build', {
      gameId: 'custom-path',
      specPath: '/some/spec.md',
    });
    assert.equal(res.status, 200);
    const job = mockQueue.jobs[mockQueue.jobs.length - 1];
    assert.equal(job.data.specPath, '/some/spec.md');
  });

  it('POST /api/build passes specUrl when provided', async () => {
    const res = await request(server, 'POST', '/api/build', {
      gameId: 'url-game',
      specUrl: 'https://example.com/specs/my-game.md',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, true);
    const job = mockQueue.jobs[mockQueue.jobs.length - 1];
    assert.equal(job.data.specUrl, 'https://example.com/specs/my-game.md');
    assert.equal(job.data.specPath, null);
  });

  it('POST /api/build rejects both specPath and specUrl', async () => {
    const res = await request(server, 'POST', '/api/build', {
      gameId: 'conflict-game',
      specPath: '/some/spec.md',
      specUrl: 'https://example.com/spec.md',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('not both'));
  });

  it('POST /api/build rejects invalid specUrl', async () => {
    const res = await request(server, 'POST', '/api/build', {
      gameId: 'bad-url-game',
      specUrl: 'not-a-url',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('valid URL'));
  });
});

describe('Server integration: failure patterns API', () => {
  let server;

  before((_, done) => {
    const app = createApp({ queue: createMockQueue(), connection: createMockConnection() });
    server = app.listen(0, done);

    // Seed some failure patterns
    db.recordFailurePattern('fp-game', 'DOM not visible', 'rendering');
    db.recordFailurePattern('fp-game', 'Timer stuck', 'timing');
  });

  after((_, done) => {
    server.close(done);
  });

  it('GET /api/failure-patterns returns stats, top, and patterns', async () => {
    const res = await request(server, 'GET', '/api/failure-patterns');
    assert.equal(res.status, 200);
    assert.ok('stats' in res.body);
    assert.ok('top_patterns' in res.body);
    assert.ok('patterns' in res.body);
    assert.ok(Array.isArray(res.body.patterns));
  });

  it('GET /api/failure-patterns?gameId=fp-game filters by game', async () => {
    const res = await request(server, 'GET', '/api/failure-patterns?gameId=fp-game');
    assert.equal(res.status, 200);
    assert.ok(res.body.patterns.length >= 2);
    for (const p of res.body.patterns) {
      assert.equal(p.game_id, 'fp-game');
    }
  });
});

describe('Server integration: webhook endpoint', () => {
  const SECRET = 'test-webhook-secret-123';
  let server, mockQueue;

  before((_, done) => {
    mockQueue = createMockQueue();
    const app = createApp({
      queue: mockQueue,
      connection: createMockConnection(),
      webhookSecret: SECRET,
    });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('rejects webhook without signature', async () => {
    const res = await request(server, 'POST', '/webhook/github', '{}', {
      'x-github-event': 'push',
      'content-type': 'application/json',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Missing signature');
  });

  it('rejects webhook with wrong signature', async () => {
    const payload = JSON.stringify({ ref: 'refs/heads/main', commits: [] });
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      'content-type': 'application/json',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid signature');
  });

  it('ignores non-push events', async () => {
    const payload = JSON.stringify({});
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'pull_request',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, true);
    assert.ok(res.body.reason.includes('pull_request'));
  });

  it('ignores pushes to non-tracked branches', async () => {
    const payload = JSON.stringify({ ref: 'refs/heads/feature-branch', commits: [] });
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, true);
    assert.ok(res.body.reason.includes('feature-branch'));
  });

  it('returns queued:0 when no spec changes', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      commits: [{ added: ['README.md'], modified: [], removed: [] }],
    });
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 0);
  });

  it('queues immediate build for small batch', async () => {
    const beforeLen = mockQueue.jobs.length;
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abc123',
      commits: [
        {
          added: ['warehouse/templates/doubles/spec.md'],
          modified: ['warehouse/templates/triples/spec.md'],
          removed: [],
        },
      ],
    });
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 2);
    assert.equal(res.body.scheduled, 'immediate');
    // Verify jobs were actually added to the queue
    assert.equal(mockQueue.jobs.length, beforeLen + 2);
    // Jobs should NOT have delay for immediate scheduling
    const lastJob = mockQueue.jobs[mockQueue.jobs.length - 1];
    assert.equal(lastJob.opts, undefined);
  });

  it('queues overnight build for bulk batch (>5)', async () => {
    const beforeLen = mockQueue.jobs.length;
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'def456',
      commits: [
        {
          added: [
            'warehouse/templates/g1/spec.md',
            'warehouse/templates/g2/spec.md',
            'warehouse/templates/g3/spec.md',
            'warehouse/templates/g4/spec.md',
            'warehouse/templates/g5/spec.md',
            'warehouse/templates/g6/spec.md',
          ],
          modified: [],
          removed: [],
        },
      ],
    });
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 6);
    assert.equal(res.body.scheduled, 'overnight');
    // Verify jobs have delay option
    const lastJob = mockQueue.jobs[mockQueue.jobs.length - 1];
    assert.ok(lastJob.opts.delay > 0);
  });

  it('accepts webhook on c_code branch', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/c_code',
      after: 'xyz789',
      commits: [
        {
          added: ['warehouse/templates/cc-game/spec.md'],
          modified: [],
          removed: [],
        },
      ],
    });
    const sig = signPayload(payload, SECRET);
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'x-hub-signature-256': sig,
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 1);
    assert.equal(res.body.scheduled, 'immediate');
  });
});

describe('Server integration: webhook without secret', () => {
  let server, mockQueue;

  before((_, done) => {
    mockQueue = createMockQueue();
    // No webhookSecret — skips verification
    const app = createApp({
      queue: mockQueue,
      connection: createMockConnection(),
      webhookSecret: null,
    });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('accepts webhook without signature when no secret configured', async () => {
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'nosecret123',
      commits: [
        {
          added: ['warehouse/templates/no-secret-game/spec.md'],
          modified: [],
          removed: [],
        },
      ],
    });
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 1);
  });
});

describe('Server integration: build deduplication', () => {
  let server, mockQueue;

  before((_, done) => {
    mockQueue = createMockQueue();
    const app = createApp({ queue: mockQueue, connection: createMockConnection() });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('POST /api/build returns existing build when game already has a queued build', async () => {
    // First build — should succeed
    const res1 = await request(server, 'POST', '/api/build', { gameId: 'dedup-queued-game' });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.queued, true);
    const firstBuildId = res1.body.buildId;
    assert.ok(firstBuildId > 0);

    const beforeLen = mockQueue.jobs.length;

    // Second build for same game — should be deduplicated
    const res2 = await request(server, 'POST', '/api/build', { gameId: 'dedup-queued-game' });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.deduplicated, true);
    assert.equal(res2.body.queued, false);
    assert.equal(res2.body.buildId, firstBuildId);
    assert.equal(res2.body.status, 'queued');

    // No new job should have been added to the queue
    assert.equal(mockQueue.jobs.length, beforeLen);
  });

  it('POST /api/build with force:true bypasses deduplication when game is queued', async () => {
    // First build — queued
    const res1 = await request(server, 'POST', '/api/build', { gameId: 'dedup-force-game' });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.queued, true);
    const firstBuildId = res1.body.buildId;

    const beforeLen = mockQueue.jobs.length;

    // Force a second build — should create new build despite existing queued one
    const res2 = await request(server, 'POST', '/api/build', { gameId: 'dedup-force-game', force: true });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.queued, true);
    assert.ok(res2.body.buildId > firstBuildId, 'force build should create a new build ID');
    assert.equal(res2.body.deduplicated, undefined);

    // A new job should have been added
    assert.equal(mockQueue.jobs.length, beforeLen + 1);
  });

  it('POST /api/build skips approved game without force flag', async () => {
    // Create a game and mark it approved
    db.createGame('dedup-approved-game', { title: 'Approved Game' });
    db.updateGameStatus('dedup-approved-game', 'approved');

    const beforeLen = mockQueue.jobs.length;

    const res = await request(server, 'POST', '/api/build', { gameId: 'dedup-approved-game' });
    assert.equal(res.status, 200);
    assert.equal(res.body.skipped, true);
    assert.equal(res.body.buildId, null);
    assert.ok(res.body.reason.includes('approved'));

    // No new job should have been added
    assert.equal(mockQueue.jobs.length, beforeLen);
  });

  it('POST /api/build with force:true rebuilds an approved game', async () => {
    // Create a game and mark it approved
    db.createGame('dedup-approved-force-game', { title: 'Approved Force Game' });
    db.updateGameStatus('dedup-approved-force-game', 'approved');

    const beforeLen = mockQueue.jobs.length;

    const res = await request(server, 'POST', '/api/build', {
      gameId: 'dedup-approved-force-game',
      force: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, true);
    assert.ok(res.body.buildId > 0);

    // A new job should have been added
    assert.equal(mockQueue.jobs.length, beforeLen + 1);
  });

  it('webhook deduplicates game already in queued state', async () => {
    // Pre-create a queued build for the game
    db.createBuild('dedup-webhook-game', null);

    const beforeLen = mockQueue.jobs.length;

    // Webhook push for the same game
    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'webhooksha',
      commits: [{ added: ['warehouse/templates/dedup-webhook-game/spec.md'], modified: [], removed: [] }],
    });
    const res = await request(server, 'POST', '/webhook/github', payload, {
      'x-github-event': 'push',
      'content-type': 'application/json',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, 0);
    assert.equal(res.body.deduplicated, 1);

    // No new job added
    assert.equal(mockQueue.jobs.length, beforeLen);
  });
});

// ─── CR-062: MCP endpoint Bearer token authentication ───────────────────────
describe('Server integration: MCP endpoint authentication (CR-062)', () => {
  const MCP_SECRET = 'test-mcp-secret-cr062';
  let server;

  before((_, done) => {
    process.env.MCP_SECRET = MCP_SECRET;
    const app = createApp({ queue: createMockQueue(), connection: createMockConnection() });
    server = app.listen(0, done);
  });

  after((_, done) => {
    delete process.env.MCP_SECRET;
    server.close(done);
  });

  it('POST /mcp with correct Bearer token passes auth check (returns non-401)', async () => {
    // The MCP SDK may not be installed in test env, so we expect 501 (not available)
    // rather than 401. What matters is that auth passes and the request proceeds.
    const res = await request(server, 'POST', '/mcp', {}, {
      'authorization': `Bearer ${MCP_SECRET}`,
    });
    assert.notEqual(res.status, 401, 'Should not return 401 with correct Bearer token');
  });

  it('POST /mcp with missing/wrong token returns 401', async () => {
    const resMissing = await request(server, 'POST', '/mcp', {});
    assert.equal(resMissing.status, 401);
    assert.equal(resMissing.body.error, 'Unauthorized');

    const resWrong = await request(server, 'POST', '/mcp', {}, {
      'authorization': 'Bearer wrong-secret',
    });
    assert.equal(resWrong.status, 401);
    assert.equal(resWrong.body.error, 'Unauthorized');
  });
});

// ─── CR-063: Rate limiting on POST /api/build and /api/fix ──────────────────
describe('Server integration: rate limiting (CR-063)', () => {
  let server, mockQueue;

  before((_, done) => {
    // Use BUILD_RATE_LIMIT_MAX=5 (default). Each createApp() gets its own Map,
    // so this suite's requests do not share state with other describe blocks.
    mockQueue = createMockQueue();
    const app = createApp({ queue: mockQueue, connection: createMockConnection() });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('first POST /api/build request is allowed (200)', async () => {
    const res = await request(server, 'POST', '/api/build', { gameId: 'rl-game-1' });
    assert.equal(res.status, 200);
    assert.equal(res.body.queued, true);
  });

  it('fifth POST /api/build request in same window is still allowed (200)', async () => {
    // First request was in previous test. Send 4 more to reach max=5.
    for (let i = 2; i <= 4; i++) {
      const res = await request(server, 'POST', '/api/build', { gameId: `rl-game-${i}` });
      assert.equal(res.status, 200, `Request ${i} should be allowed`);
    }
    // 5th request (counter is now at 5, which equals RATE_LIMIT_MAX=5)
    const res5 = await request(server, 'POST', '/api/build', { gameId: 'rl-game-5' });
    assert.equal(res5.status, 200, 'Fifth request should be allowed (at the limit, not over)');
  });

  it('sixth POST /api/build request in same window returns 429', async () => {
    // Previous tests consumed 5 slots for the same IP (127.0.0.1 / ::1).
    const res = await request(server, 'POST', '/api/build', { gameId: 'rl-game-6' });
    assert.equal(res.status, 429);
    assert.ok(res.body.error.includes('Rate limit exceeded'));
  });
});

// ─── CR-064: queue.add() catch block in /api/fix ─────────────────────────────
describe('Server integration: /api/fix queue error handling (CR-064)', () => {
  let server, failQueue;

  before((_, done) => {
    // Queue that throws on add() to simulate Redis being down
    failQueue = {
      add: async () => { throw new Error('Redis connection refused'); },
      getJobCounts: async () => ({ waiting: 0, active: 0, completed: 0, failed: 0 }),
    };
    const app = createApp({ queue: failQueue, connection: createMockConnection() });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('POST /api/fix returns 503 when queue.add() throws', async () => {
    const res = await request(server, 'POST', '/api/fix', {
      gameId: 'cr064-game',
      feedbackPrompt: 'Fix the scoring bug',
    });
    assert.equal(res.status, 503);
    assert.ok(res.body.error.includes('Queue unavailable'), `Expected 'Queue unavailable' in: ${res.body.error}`);
  });

  it('POST /api/fix rolls back DB record when queue.add() throws', async () => {
    const res = await request(server, 'POST', '/api/fix', {
      gameId: 'cr064-rollback-game',
      feedbackPrompt: 'Another fix attempt',
    });
    assert.equal(res.status, 503);

    // The DB record should have been failed (not left as 'queued')
    const builds = db.getDb()
      .prepare("SELECT status FROM builds WHERE game_id = ? ORDER BY id DESC LIMIT 1")
      .get('cr064-rollback-game');
    assert.ok(builds, 'A build record should have been created');
    assert.equal(builds.status, 'failed', `Expected status='failed', got '${builds.status}'`);
  });
});

// ─── /api/session endpoint ───────────────────────────────────────────────────
describe('Server integration: /api/session', () => {
  const stubSession = {
    parsedGoal: { topic: 'trigonometry', gradeLevel: 9, skillIds: [] },
    sessionPlan: { sessionId: 'sess-001', games: [] },
    sessionId: 'sess-001',
    outputPath: '/tmp/sess-001',
    filesWritten: [],
  };

  let server;

  before((_, done) => {
    const mockPlanSessionFromObjective = async (objectiveText) => {
      if (objectiveText === 'throw-error') throw new Error('LLM unavailable');
      return stubSession;
    };
    const app = createApp({
      queue: createMockQueue(),
      connection: createMockConnection(),
      planSessionFromObjective: mockPlanSessionFromObjective,
    });
    server = app.listen(0, done);
  });

  after((_, done) => {
    server.close(done);
  });

  it('POST /api/session returns 200 and session JSON for valid objective', async () => {
    const res = await request(server, 'POST', '/api/session', {
      objective: 'Teach students to find missing sides of right triangles',
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.sessionId, 'response must include sessionId');
    assert.ok(res.body.parsedGoal, 'response must include parsedGoal');
    assert.ok(res.body.sessionPlan, 'response must include sessionPlan');
  });

  it('POST /api/session returns 400 when objective is missing', async () => {
    const res = await request(server, 'POST', '/api/session', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'objective is required');
  });

  it('POST /api/session returns 400 when objective is empty string', async () => {
    const res = await request(server, 'POST', '/api/session', { objective: '   ' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'objective is required');
  });

  it('POST /api/session returns 400 when objective is not a string', async () => {
    const res = await request(server, 'POST', '/api/session', { objective: 42 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'objective is required');
  });

  it('POST /api/session returns 500 when planSessionFromObjective throws', async () => {
    const res = await request(server, 'POST', '/api/session', { objective: 'throw-error' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'LLM unavailable');
  });
});

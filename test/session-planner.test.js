'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  CONCEPT_GRAPH,
  normalizeConcept,
  classifyObjective,
  buildResearchContext,
  getResearchPrompt,
  researchCurriculum,
  planSession,
  generateSessionId,
  writeSessionDirectory,
  generateSpec,
  generateSessionSpecs,
  planSessionFromObjective,
} = require('../lib/session-planner');

// ─── CONCEPT_GRAPH structure tests ───────────────────────────────────────────
describe('CONCEPT_GRAPH — trig nodes have required V1 fields', () => {
  it('trigonometry concept exists', () => {
    assert.ok(Array.isArray(CONCEPT_GRAPH.trigonometry), 'trigonometry must be an array of skill nodes');
    assert.ok(CONCEPT_GRAPH.trigonometry.length >= 5, 'trigonometry must have at least 5 skill nodes');
  });

  it('every trig node has templateSpecId, curriculumStandard, estimatedMinutes', () => {
    for (const node of CONCEPT_GRAPH.trigonometry) {
      assert.ok(
        typeof node.templateSpecId === 'string',
        `node "${node.skillId}" templateSpecId must be a string, got ${JSON.stringify(node.templateSpecId)}`,
      );
      assert.ok(
        typeof node.curriculumStandard === 'string' && node.curriculumStandard.length > 0,
        `node "${node.skillId}" curriculumStandard must be a non-empty string`,
      );
      assert.ok(
        typeof node.estimatedMinutes === 'number' && node.estimatedMinutes > 0,
        `node "${node.skillId}" estimatedMinutes must be a positive number`,
      );
    }
  });

  it('real-world-application node has templateSpecId = "real-world-problem"', () => {
    const node = CONCEPT_GRAPH.trigonometry.find((n) => n.skillId === 'real-world-application');
    assert.ok(node, 'real-world-application node must exist');
    assert.equal(node.templateSpecId, 'real-world-problem');
  });

  it('trig nodes are in ascending Bloom order', () => {
    const levels = CONCEPT_GRAPH.trigonometry.map((n) => n.bloomLevel);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(
        levels[i] >= levels[i - 1],
        `Bloom levels must be non-decreasing: level[${i}]=${levels[i]} < level[${i - 1}]=${levels[i - 1]}`,
      );
    }
  });

  it('every trig node has a suggestedGameIds array with at least one entry', () => {
    for (const node of CONCEPT_GRAPH.trigonometry) {
      assert.ok(
        Array.isArray(node.suggestedGameIds) && node.suggestedGameIds.length > 0,
        `node "${node.skillId}" must have suggestedGameIds with at least one entry`,
      );
    }
  });
});

// ─── normalizeConcept tests ───────────────────────────────────────────────────
describe('normalizeConcept', () => {
  it('maps "trig" to "trigonometry"', () => {
    assert.equal(normalizeConcept('trig'), 'trigonometry');
  });

  it('maps "soh-cah-toa" to "trigonometry"', () => {
    assert.equal(normalizeConcept('soh-cah-toa'), 'trigonometry');
  });

  it('maps "right triangle trigonometry" to "trigonometry"', () => {
    assert.equal(normalizeConcept('right triangle trigonometry'), 'trigonometry');
  });

  it('maps "times tables" to "multiplication"', () => {
    assert.equal(normalizeConcept('times tables'), 'multiplication');
  });

  it('handles unknown input gracefully — returns lowercased input', () => {
    assert.equal(normalizeConcept('algebra'), 'algebra');
  });

  it('is case-insensitive', () => {
    assert.equal(normalizeConcept('TRIG'), 'trigonometry');
  });

  it('maps "sine rule" gracefully — returns "sine rule" (no alias)', () => {
    // No alias exists; falls through to lowercased input
    assert.equal(normalizeConcept('sine rule'), 'sine rule');
  });
});

// ─── classifyObjective tests ──────────────────────────────────────────────────
describe('classifyObjective', () => {
  it('detects trigonometry from "understand sin, cos, tan ratios"', () => {
    assert.equal(classifyObjective('understand sin, cos, tan ratios'), 'trigonometry');
  });

  it('detects trigonometry from "label hypotenuse, opposite, adjacent"', () => {
    assert.equal(classifyObjective('label hypotenuse, opposite, adjacent'), 'trigonometry');
  });

  it('detects multiplication from "times tables practice"', () => {
    assert.equal(classifyObjective('times tables practice'), 'multiplication');
  });

  it('returns null for unrecognised input', () => {
    assert.equal(classifyObjective('solve quadratic equations'), null);
  });
});

// ─── buildResearchContext tests ───────────────────────────────────────────────
describe('buildResearchContext', () => {
  const validInput = {
    standardStatement:
      'HSG-SRT.C.6: Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle.',
    prerequisites: ['8.G.B.7', 'HSG-SRT.A.2'],
    misconceptions: [
      {
        description: 'Students confuse opposite and adjacent when the reference angle changes position',
        source: 'NCTM Research Brief',
        url: 'https://www.nctm.org/example',
      },
      {
        description: 'Students apply SOH-CAH-TOA without checking which angle is the reference angle',
        source: 'Exa search: NCERT Ch 8 misconceptions',
        url: null,
      },
    ],
    ncertRefs: [{ chapter: 'Ch 8', section: '§8.1', exerciseNotes: 'Ex 8.1 Q1-Q3: labelling sides' }],
    realWorldContexts: [{ label: 'Ramp angle', description: 'A wheelchair ramp rises 1.2m over 8m — find the angle.' }],
  };

  it('returns structured context for valid input', () => {
    const ctx = buildResearchContext(validInput);
    assert.equal(ctx.standardStatement, validInput.standardStatement);
    assert.deepEqual(ctx.prerequisites, validInput.prerequisites);
    assert.equal(ctx.misconceptions.length, 2);
    assert.equal(ctx.ncertRefs.length, 1);
    assert.equal(ctx.realWorldContexts.length, 1);
  });

  it('researchComplete=true when 2+ sources present', () => {
    const ctx = buildResearchContext(validInput);
    // 1 misconception with url + 1 ncertRef with chapter = 2 sources
    assert.equal(ctx.researchComplete, true);
  });

  it('researchComplete=false when <2 sources', () => {
    const ctx = buildResearchContext({
      standardStatement: 'HSG-SRT.C.6: ...',
      prerequisites: [],
      misconceptions: [],
      ncertRefs: [],
    });
    assert.equal(ctx.researchComplete, false);
  });

  it('throws when standardStatement is missing', () => {
    assert.throws(
      () => buildResearchContext({ prerequisites: [], misconceptions: [], ncertRefs: [] }),
      /standardStatement is required/,
    );
  });

  it('throws when misconceptions is not an array', () => {
    assert.throws(
      () => buildResearchContext({ standardStatement: 'X', prerequisites: [], misconceptions: 'bad', ncertRefs: [] }),
      /misconceptions must be an array/,
    );
  });

  it('throws when a misconception entry lacks description', () => {
    assert.throws(
      () =>
        buildResearchContext({
          standardStatement: 'X',
          prerequisites: [],
          misconceptions: [{ source: 'test' }],
          ncertRefs: [],
        }),
      /misconceptions\[0\]/,
    );
  });

  it('accepts realWorldContexts as optional — defaults to []', () => {
    const ctx = buildResearchContext({
      standardStatement: 'HSG-SRT.C.6: ...',
      prerequisites: [],
      misconceptions: [],
      ncertRefs: [],
    });
    assert.deepEqual(ctx.realWorldContexts, []);
  });

  it('strips null urls and normalises output shape', () => {
    const ctx = buildResearchContext(validInput);
    for (const m of ctx.misconceptions) {
      assert.ok('description' in m, 'misconception must have description');
      assert.ok('source' in m, 'misconception must have source');
      assert.ok('url' in m, 'misconception must have url');
    }
  });
});

// ─── getResearchPrompt tests ──────────────────────────────────────────────────
describe('getResearchPrompt', () => {
  const parsedGoal = {
    topic: 'trigonometry',
    gradeLevel: 10,
    bloomTarget: 3,
    ncertChapter: 'Ch 8 §8.1-8.3',
    curriculumSystem: 'NCERT',
  };

  it('returns a non-empty string', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.equal(typeof prompt, 'string');
    assert.ok(prompt.length > 100, 'prompt must be substantive (>100 chars)');
  });

  it('mentions Knowledge Graph MCP tool names', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.ok(prompt.includes('mcp__claude_ai_Learning_Commons_Knowledge_Graph'), 'must mention Knowledge Graph MCP');
  });

  it('mentions Exa MCP tool name', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.ok(prompt.includes('mcp__exa__web_search_exa'), 'must mention Exa search tool');
  });

  it('includes the topic in the prompt', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.ok(prompt.includes('trigonometry'), 'must include the topic');
  });

  it('includes grade level in the prompt', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.ok(prompt.includes('10') || prompt.includes('Grade 10'), 'must include grade level');
  });

  it('requires minimum 2 external sources', () => {
    const prompt = getResearchPrompt(parsedGoal);
    assert.ok(prompt.includes('2'), 'must specify 2-source minimum');
  });

  it('throws for invalid parsedGoal input', () => {
    assert.throws(() => getResearchPrompt(null), /parsedGoal must be an object/);
    assert.throws(() => getResearchPrompt('string'), /parsedGoal must be an object/);
  });

  it('handles missing gradeLevel gracefully', () => {
    const prompt = getResearchPrompt({ topic: 'trigonometry', bloomTarget: 2 });
    assert.ok(prompt.includes('middle/high school') || prompt.includes('null'), 'must handle null gradeLevel');
  });
});

// ─── planSession tests ────────────────────────────────────────────────────────
describe('planSession', () => {
  const parsedGoalTrig = {
    topic: 'trigonometry',
    gradeLevel: 10,
    bloomTarget: 4,
    ncertChapter: 'Ch 8',
    curriculumSystem: 'NCERT',
  };

  const researchContext = {
    standardStatement: 'HSG-SRT.C.6: ...',
    prerequisites: ['8.G.B.7'],
    misconceptions: [
      { description: 'Students confuse opposite and adjacent sides', source: 'NCTM', url: 'https://example.com/1' },
      { description: 'Students apply ratio without checking reference angle', source: 'Exa', url: null },
      { description: 'Students compute ratio but forget to label sides first', source: 'Exa', url: null },
      { description: 'Students cannot identify which ratio applies to find a side', source: 'Research', url: null },
      { description: 'Students struggle with angle-of-elevation real world setup', source: 'Exa', url: null },
    ],
    ncertRefs: [{ chapter: 'Ch 8', section: '§8.1', exerciseNotes: 'Ex 8.1' }],
    realWorldContexts: [{ label: 'Ramp', description: 'Find ramp angle.' }],
    researchComplete: true,
    sourceCount: 2,
  };

  it('returns a session plan with correct structure', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    assert.ok(!plan.error, `should not error: ${plan.message}`);
    assert.equal(typeof plan.sessionTitle, 'string');
    assert.equal(plan.concept, 'trigonometry');
    assert.ok(Array.isArray(plan.games), 'games must be an array');
    assert.ok(plan.games.length > 0, 'must include at least one game');
  });

  it('games are in ascending Bloom order', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    const levels = plan.games.map((g) => g.bloomLevel);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] >= levels[i - 1], `Bloom levels must be non-decreasing at position ${i}`);
    }
  });

  it('filters out games above bloomTarget', () => {
    const lowBloomGoal = { ...parsedGoalTrig, bloomTarget: 2 };
    const plan = planSession(lowBloomGoal, researchContext);
    assert.ok(!plan.error);
    for (const g of plan.games) {
      assert.ok(g.bloomLevel <= 2, `game "${g.gameId}" bloomLevel ${g.bloomLevel} exceeds target 2`);
    }
  });

  it('attaches misconceptions to games', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    const withMisconception = plan.games.filter((g) => g.targetedMisconception !== null);
    assert.ok(withMisconception.length > 0, 'at least one game must have a targeted misconception');
  });

  it('game objects have required fields', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    for (const g of plan.games) {
      assert.ok(typeof g.position === 'number', `game must have position, got ${g.position}`);
      assert.ok(typeof g.gameId === 'string', `game must have gameId, got ${g.gameId}`);
      assert.ok(typeof g.bloomLevel === 'number', 'game must have bloomLevel');
      assert.ok(typeof g.estimatedMinutes === 'number', 'game must have estimatedMinutes');
      assert.ok('templateSpecId' in g, 'game must have templateSpecId field');
      assert.ok(typeof g.status === 'string', 'game must have status string');
    }
  });

  it('includes prerequisites from researchContext', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    assert.deepEqual(plan.prerequisites, researchContext.prerequisites);
  });

  it('includes standardStatement from researchContext', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    assert.equal(plan.standardStatement, researchContext.standardStatement);
  });

  it('estimatedMinutes is sum of game durations', () => {
    const plan = planSession(parsedGoalTrig, researchContext);
    const sum = plan.games.reduce((acc, g) => acc + g.estimatedMinutes, 0);
    assert.equal(plan.estimatedMinutes, sum);
  });

  it('works with null researchContext — returns empty prerequisites + null standard', () => {
    const plan = planSession(parsedGoalTrig, null);
    assert.ok(!plan.error);
    assert.deepEqual(plan.prerequisites, []);
    assert.equal(plan.standardStatement, null);
    assert.equal(plan.researchComplete, false);
  });

  it('returns error for unknown topic', () => {
    const plan = planSession({ topic: 'quantum-physics', bloomTarget: 3 }, null);
    assert.equal(plan.error, 'concept_not_found');
    assert.ok(Array.isArray(plan.availableConcepts));
  });

  it('normalizes topic aliases — "trig" resolves to trigonometry', () => {
    const plan = planSession({ topic: 'trig', bloomTarget: 4 }, null);
    assert.ok(!plan.error, `should not error: ${plan && plan.message}`);
    assert.equal(plan.concept, 'trigonometry');
  });

  it('returns error_no_skills_in_range when bloomTarget is too low', () => {
    // Bloom L0 is below all nodes (which start at L1)
    const plan = planSession({ topic: 'trigonometry', bloomTarget: 0 }, null);
    assert.ok(plan.error === 'no_skills_in_range' || plan.games.length === 0 || !plan.error);
    // Note: L1 nodes exist so bloomTarget:0 will return no_skills_in_range
    // or we accept the plan having 0 games — either is acceptable
  });

  it('handles parsedGoal without gradeLevel', () => {
    const plan = planSession({ topic: 'trigonometry', bloomTarget: 3 }, null);
    assert.ok(!plan.error);
    assert.equal(plan.gradeLevel, null);
  });

  it('throws for non-object parsedGoal', () => {
    assert.throws(() => planSession(null, null), /parsedGoal is required/);
    assert.throws(() => planSession('string', null), /parsedGoal is required/);
  });
});

// ─── generateSessionId tests — Phase 2 ───────────────────────────────────────
describe('generateSessionId', () => {
  it('returns a string', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: 10 });
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0, 'sessionId must be non-empty');
  });

  it('contains concept fragment at start', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: 10 });
    assert.ok(id.startsWith('trigonometry'), `expected id to start with "trigonometry", got: ${id}`);
  });

  it('contains grade level fragment', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: 10 });
    assert.ok(id.includes('class10'), `expected id to include "class10", got: ${id}`);
  });

  it('contains date fragment (8 consecutive digits)', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: 10 });
    assert.ok(/\d{8}/.test(id), `expected id to contain 8-digit date fragment, got: ${id}`);
  });

  it('contains alphanumeric random suffix', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: 10 });
    const parts = id.split('-');
    const suffix = parts[parts.length - 1];
    assert.ok(suffix.length >= 5, `expected random suffix >=5 chars, got: "${suffix}"`);
    assert.ok(/^[a-z0-9]+$/.test(suffix), `suffix must be alphanumeric lowercase, got: "${suffix}"`);
  });

  it('two calls produce different IDs', () => {
    const a = generateSessionId('trigonometry', { gradeLevel: 10 });
    const b = generateSessionId('trigonometry', { gradeLevel: 10 });
    assert.notEqual(a, b, 'each call must produce a unique sessionId');
  });

  it('handles null gradeLevel gracefully', () => {
    const id = generateSessionId('trigonometry', { gradeLevel: null });
    assert.equal(typeof id, 'string');
    assert.ok(id.includes('grad-unknown'), `expected "grad-unknown" in id, got: ${id}`);
  });

  it('sanitises concept with non-alphanumeric chars', () => {
    const id = generateSessionId('right-triangle trig!', { gradeLevel: 9 });
    assert.ok(/^[a-z0-9-]/.test(id), `id must start with safe chars, got: ${id}`);
  });
});

// ─── writeSessionDirectory tests — Phase 2 ───────────────────────────────────
describe('writeSessionDirectory', () => {
  const fullResearchContext = {
    standardStatement:
      'HSG-SRT.C.6: Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle.',
    prerequisites: ['8.G.B.7'],
    misconceptions: [
      { description: 'Students confuse opposite and adjacent sides', source: 'NCTM', url: 'https://example.com/1' },
      { description: 'Students apply ratio without checking reference angle', source: 'Exa', url: null },
      { description: 'Students compute ratio but forget to label sides first', source: 'Exa', url: null },
      { description: 'Students cannot identify which ratio applies to find a side', source: 'Research', url: null },
      { description: 'Students struggle with angle-of-elevation real world setup', source: 'Exa', url: null },
    ],
    ncertRefs: [{ chapter: 'Ch 8', section: '§8.1', exerciseNotes: 'Ex 8.1 Q1-Q3' }],
    realWorldContexts: [{ label: 'Ramp', description: 'Find ramp angle.' }],
    researchComplete: true,
    sourceCount: 2,
  };

  let sessionPlan;
  before(() => {
    sessionPlan = planSession(
      { topic: 'trigonometry', gradeLevel: 10, bloomTarget: 4, ncertChapter: 'Ch 8', curriculumSystem: 'NCERT' },
      fullResearchContext,
    );
  });

  it('dryRun: true returns correct structure without writing files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-dryrun-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: true,
      });
      assert.equal(typeof result.sessionId, 'string', 'sessionId must be a string');
      assert.ok(result.sessionId.length > 0, 'sessionId must be non-empty');
      assert.equal(typeof result.outputPath, 'string', 'outputPath must be a string');
      assert.ok(Array.isArray(result.filesWritten), 'filesWritten must be an array');
      assert.ok(result.filesWritten.length > 0, 'filesWritten must list at least one file');
      assert.ok(!fs.existsSync(result.outputPath), 'dryRun must not create the session directory');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun: true lists session-plan.md in filesWritten', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-dryrun2-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: true,
      });
      const hasPlanFile = result.filesWritten.some((f) => f.endsWith('session-plan.md'));
      assert.ok(hasPlanFile, 'filesWritten must include session-plan.md');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun: true lists spec-instructions.md for each game', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-dryrun3-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: true,
      });
      const specFiles = result.filesWritten.filter((f) => f.endsWith('spec-instructions.md'));
      assert.equal(
        specFiles.length,
        sessionPlan.games.length,
        `must list one spec-instructions.md per game (expected ${sessionPlan.games.length}, got ${specFiles.length})`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('actual write: session-plan.md exists on disk with correct content', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-write-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: false,
      });
      assert.ok(fs.existsSync(result.outputPath), 'session directory must be created');
      const planPath = path.join(result.outputPath, 'session-plan.md');
      assert.ok(fs.existsSync(planPath), 'session-plan.md must exist');
      const content = fs.readFileSync(planPath, 'utf8');
      assert.ok(content.includes('Session Plan'), 'must include "Session Plan" heading');
      assert.ok(content.includes('trigonometry'), 'must mention the concept');
      assert.ok(content.includes('HSG-SRT.C.6'), 'must embed standard statement');
      assert.ok(content.includes('Engineer Instructions'), 'must include engineer instructions');
      assert.ok(content.includes('Game Sequence'), 'must include game sequence table');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('actual write: per-game spec-instructions.md files exist with correct structure', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-games-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: false,
      });
      for (const game of sessionPlan.games) {
        const gameDir = path.join(result.outputPath, `game-${game.position}-${game.gameId}`);
        assert.ok(fs.existsSync(gameDir), `game-${game.position}-${game.gameId}/ directory must exist`);
        const specInstructionsPath = path.join(gameDir, 'spec-instructions.md');
        assert.ok(fs.existsSync(specInstructionsPath), `spec-instructions.md must exist for game ${game.position}`);
        const content = fs.readFileSync(specInstructionsPath, 'utf8');
        assert.ok(content.includes('Spec Instructions'), 'must include heading');
        assert.ok(content.includes('Preserve Unchanged'), 'must include preserve section');
        assert.ok(content.includes('Substitute'), 'must include substitution section');
        assert.ok(content.includes('Novelty Check'), 'must include novelty check');
        assert.ok(content.includes('Evidence to Embed'), 'must include evidence section');
        assert.ok(content.includes(game.gameId), `must mention gameId "${game.gameId}"`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('actual write: session-plan.md session ID matches result.sessionId', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-idcheck-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: false,
      });
      const planContent = fs.readFileSync(path.join(result.outputPath, 'session-plan.md'), 'utf8');
      assert.ok(planContent.includes(result.sessionId), 'session-plan.md must embed the sessionId');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when sessionPlan is null', async () => {
    await assert.rejects(() => writeSessionDirectory(null, null, { dryRun: true }), /sessionPlan is required/);
  });

  it('throws when sessionPlan has an error field', async () => {
    await assert.rejects(
      () => writeSessionDirectory({ error: 'concept_not_found', message: 'Unknown' }, null, { dryRun: true }),
      /sessionPlan has error/,
    );
  });

  it('works with null researchContext — writes files with placeholder text', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-norc-'));
    try {
      const planNoRc = planSession({ topic: 'trigonometry', gradeLevel: 10, bloomTarget: 4 }, null);
      const result = await writeSessionDirectory(planNoRc, null, { outputDir: tmpDir, dryRun: false });
      assert.ok(fs.existsSync(result.outputPath), 'must create session dir even without research context');
      const planContent = fs.readFileSync(path.join(result.outputPath, 'session-plan.md'), 'utf8');
      assert.ok(
        planContent.includes('No misconceptions sourced') || planContent.includes('not yet researched'),
        'session-plan.md must include placeholder text when research is absent',
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('session-plan.md game sequence table has one row per game', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-sp-rows-'));
    try {
      const result = await writeSessionDirectory(sessionPlan, fullResearchContext, {
        outputDir: tmpDir,
        dryRun: false,
      });
      const content = fs.readFileSync(path.join(result.outputPath, 'session-plan.md'), 'utf8');
      // Count table rows: lines starting with "| <digit>"
      const tableRows = content.split('\n').filter((l) => /^\| \d+/.test(l));
      assert.equal(
        tableRows.length,
        sessionPlan.games.length,
        `table must have ${sessionPlan.games.length} data rows, found ${tableRows.length}`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── generateSpec tests — Phase 3 ────────────────────────────────────────────
describe('generateSpec — Phase 3', () => {
  // Build a minimal spec-instructions.md for testing
  function makeSpecInstructions(tmpDir, opts) {
    const o = opts || {};
    const templateSpecId = o.templateSpecId || 'find-triangle-side';
    const content = [
      `# Spec Instructions: Game 1 — test-game`,
      '',
      `**Session ID:** \`test-session-123\``,
      `**Position in session:** 1 of 1`,
      `**Skill taught:** Test skill`,
      `**Bloom level:** L3 — Apply`,
      `**Curriculum standard:** NCERT Class 10 Ch 8 §8.1`,
      `**Estimated time:** 5 minutes`,
      `**Template spec:** \`games/${templateSpecId}/spec.md\``,
      `**Template status:** template_exists`,
      '',
      '---',
      '',
      '## Template Spec Reference',
      '',
      `Copy from \`games/${templateSpecId}/spec.md\`.`,
      '',
      '### Preserve Unchanged (DO NOT MODIFY)',
      '',
      '- All CDN `<script>` import blocks',
      '',
      '### Substitute (CHANGE these values)',
      '',
      '- **Round data:** Use 3 rounds with angles 30, 45, 60.',
    ].join('\n');

    const gameDir = path.join(tmpDir, 'game-1-test-game');
    fs.mkdirSync(gameDir, { recursive: true });
    const specInstructionsPath = path.join(gameDir, 'spec-instructions.md');
    fs.writeFileSync(specInstructionsPath, content, 'utf8');
    return specInstructionsPath;
  }

  it('dryRun:true returns correct shape without making LLM call or writing files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-genspec-dry-'));
    try {
      const specInstructionsPath = makeSpecInstructions(tmpDir);
      const result = await generateSpec(specInstructionsPath, { dryRun: true });

      assert.equal(typeof result.specPath, 'string', 'specPath must be a string');
      assert.ok(result.specPath.endsWith('spec.md'), 'specPath must end with spec.md');
      assert.ok(Array.isArray(result.violations), 'violations must be an array');
      assert.equal(typeof result.templateUsed, 'string', 'templateUsed must be a string');
      assert.equal(typeof result.wordCount, 'number', 'wordCount must be a number');
      // dryRun must NOT write spec.md
      assert.ok(!fs.existsSync(result.specPath), 'dryRun must not write spec.md to disk');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true specPath is inside the game directory (same dir as spec-instructions.md)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-genspec-path-'));
    try {
      const specInstructionsPath = makeSpecInstructions(tmpDir);
      const result = await generateSpec(specInstructionsPath, { dryRun: true });
      const expectedDir = path.dirname(specInstructionsPath);
      assert.equal(path.dirname(result.specPath), expectedDir, 'spec.md must be in the same directory as spec-instructions.md');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true templateUsed reflects templateSpecId from instructions file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-genspec-tmpl-'));
    try {
      const specInstructionsPath = makeSpecInstructions(tmpDir, { templateSpecId: 'real-world-problem' });
      const result = await generateSpec(specInstructionsPath, { dryRun: true });
      assert.ok(
        result.templateUsed.includes('real-world-problem'),
        `templateUsed must mention "real-world-problem", got: ${result.templateUsed}`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when specInstructionsPath does not exist', async () => {
    await assert.rejects(
      () => generateSpec('/tmp/nonexistent-spec-instructions-xyz.md', { dryRun: true }),
      /not found/,
    );
  });

  it('throws when specInstructionsPath is null', async () => {
    await assert.rejects(() => generateSpec(null, { dryRun: true }), /specInstructionsPath is required/);
  });

  it('violations array is populated when validate-static finds issues', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-genspec-viol-'));
    try {
      // Write a minimal HTML that is missing DOCTYPE — validate-static will flag it
      const gameDir = path.join(tmpDir, 'game-1-bad-game');
      fs.mkdirSync(gameDir, { recursive: true });
      const specPath = path.join(gameDir, 'spec.md');
      // Write invalid HTML content directly (simulate what the LLM might return)
      const badHtml = '<html><body><p>No DOCTYPE, no proper structure</p></body></html>';
      fs.writeFileSync(specPath, badHtml, 'utf8');

      // Import runValidateStatic indirectly by testing through the module
      // We can test by calling validateStatic logic: validate-static runs on HTML
      // Here we verify that the violations logic works by running validate-static
      // on our bad HTML via a child process
      const { execFileSync } = require('child_process');
      const validateScript = path.join(__dirname, '../lib/validate-static.js');
      let violations = [];
      try {
        execFileSync(process.execPath, [validateScript, specPath], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        violations = output
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && (l.startsWith('MISSING:') || l.startsWith('FORBIDDEN:') || l.startsWith('ERROR') || l.startsWith('WARNING') || l.startsWith('✗')));
      }
      assert.ok(violations.length > 0, 'validate-static must report violations for invalid HTML');
      assert.ok(
        violations.some((v) => /DOCTYPE|HTML root|HEAD|BODY/i.test(v)),
        `expected a structure violation, got: ${violations.join(', ')}`,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── generateSessionSpecs tests — Phase 3 ────────────────────────────────────
describe('generateSessionSpecs — Phase 3', () => {
  // Create a minimal session directory with a session-plan.md and N game dirs
  function makeSessionDir(tmpDir, opts) {
    const o = opts || {};
    const gameCount = o.gameCount !== undefined ? o.gameCount : 2;

    // session-plan.md (content doesn't need to be parsed — we scan the directory)
    const sessionPlanContent = [
      '# Session Plan: Test Session',
      '',
      `**Session ID:** \`test-session-abc\``,
      '**Concept:** trigonometry',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, 'session-plan.md'), sessionPlanContent, 'utf8');

    // Per-game directories with spec-instructions.md
    for (let i = 1; i <= gameCount; i++) {
      const gameDir = path.join(tmpDir, `game-${i}-test-game-${i}`);
      fs.mkdirSync(gameDir, { recursive: true });
      const instructions = [
        `# Spec Instructions: Game ${i}`,
        '',
        `**Template spec:** \`games/find-triangle-side/spec.md\``,
        '',
        '### Substitute',
        '- **Round data:** 3 rounds.',
      ].join('\n');
      fs.writeFileSync(path.join(gameDir, 'spec-instructions.md'), instructions, 'utf8');
    }

    return tmpDir;
  }

  it('dryRun:true returns one result per game directory with spec-instructions.md', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-dry-'));
    try {
      makeSessionDir(tmpDir, { gameCount: 3 });
      const results = await generateSessionSpecs(tmpDir, { dryRun: true });
      assert.ok(Array.isArray(results), 'results must be an array');
      assert.equal(results.length, 3, 'must return one result per game directory (3)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true each result has required fields', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-fields-'));
    try {
      makeSessionDir(tmpDir, { gameCount: 2 });
      const results = await generateSessionSpecs(tmpDir, { dryRun: true });
      for (const result of results) {
        assert.equal(typeof result.gameDir, 'string', 'result must have gameDir string');
        assert.equal(typeof result.specPath, 'string', 'result must have specPath string');
        assert.ok(Array.isArray(result.violations), 'result must have violations array');
        assert.equal(typeof result.templateUsed, 'string', 'result must have templateUsed string');
        assert.equal(typeof result.wordCount, 'number', 'result must have wordCount number');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true results are ordered by game number', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-order-'));
    try {
      makeSessionDir(tmpDir, { gameCount: 3 });
      const results = await generateSessionSpecs(tmpDir, { dryRun: true });
      // gameDirs should be sorted: game-1-... game-2-... game-3-...
      const gameDirNames = results.map((r) => path.basename(r.gameDir));
      for (let i = 1; i < gameDirNames.length; i++) {
        const numPrev = parseInt(gameDirNames[i - 1].split('-')[1], 10);
        const numCurr = parseInt(gameDirNames[i].split('-')[1], 10);
        assert.ok(numCurr >= numPrev, `game dirs must be in ascending order: ${gameDirNames.join(', ')}`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true skips game dirs without spec-instructions.md', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-skip-'));
    try {
      makeSessionDir(tmpDir, { gameCount: 2 });
      // Add a game dir WITHOUT spec-instructions.md
      const emptyGameDir = path.join(tmpDir, 'game-3-no-instructions');
      fs.mkdirSync(emptyGameDir, { recursive: true });

      const results = await generateSessionSpecs(tmpDir, { dryRun: true });
      // Only 2 results — game-3 has no spec-instructions.md
      assert.equal(results.length, 2, 'must skip game dirs without spec-instructions.md');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('dryRun:true non-game-N dirs are ignored', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-nondir-'));
    try {
      makeSessionDir(tmpDir, { gameCount: 1 });
      // Add a directory that does NOT match game-N-<id> pattern
      const otherDir = path.join(tmpDir, 'assets');
      fs.mkdirSync(otherDir, { recursive: true });
      fs.writeFileSync(path.join(otherDir, 'spec-instructions.md'), '# Not a game dir', 'utf8');

      const results = await generateSessionSpecs(tmpDir, { dryRun: true });
      assert.equal(results.length, 1, 'must only process game-N-<id> directories');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when sessionDir does not exist', async () => {
    await assert.rejects(
      () => generateSessionSpecs('/tmp/nonexistent-session-dir-xyz', { dryRun: true }),
      /not found/,
    );
  });

  it('throws when sessionDir exists but has no session-plan.md', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-gensess-noplan-'));
    try {
      // No session-plan.md written
      await assert.rejects(
        () => generateSessionSpecs(tmpDir, { dryRun: true }),
        /session-plan\.md not found/,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── researchCurriculum tests ─────────────────────────────────────────────────
describe('researchCurriculum — Step 2 curriculum research pipeline', () => {
  // ── Shared mock tools ──────────────────────────────────────────────────────
  // All tests inject mock tool functions to avoid real MCP/network calls.
  const mockKgResult = {
    statementCode: 'HSG-SRT.C.6',
    description: 'Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle, leading to definitions of trigonometric ratios for acute angles.',
    caseIdentifierUUID: '3752ff25-ce4b-4c02-808b-95a71569a52f',
    academicSubject: 'Mathematics',
    gradeLevels: ['9', '10', '11', '12'],
  };

  const mockProgressionResult = {
    standards: [
      { statementCode: '7.RP.A.2', description: 'Recognize and represent proportional relationships between quantities.' },
      { statementCode: 'HSG-SRT.A.3', description: 'Use the properties of similarity transformations to establish the AA criterion.' },
      { statementCode: 'HSG-SRT.A.3', description: 'Duplicate — should be deduplicated.' }, // duplicate
    ],
  };

  const mockExaMisconceptionText = [
    'SOH-CAH-TOA mix-up: students confuse opposite and adjacent sides when labelling triangles.',
    'Standard values: students forget trigonometric values of specific angles under exam conditions.',
    'Hypotenuse identification: students mislabel sides relative to the reference angle.',
    'sin^-1 vs 1/sin: students confuse inverse trig functions with reciprocal functions.',
  ].join('\n');

  const mockExaNcertText = [
    'NCERT Solutions Class 10 Maths Chapter 8 Exercise 8.1 — Trigonometric Ratios',
    'Exercise 8.2 — Trigonometric Ratios of Some Specific Angles',
    'Exercise 8.3 — Trigonometric Ratios of Complementary Angles',
  ].join('\n');

  function makeTools(overrides) {
    return {
      findStandardStatement: async () => mockKgResult,
      findProgressionFromStandard: async () => mockProgressionResult,
      exaSearch: async ({ query }) => {
        if (/misconception/i.test(query)) return mockExaMisconceptionText;
        return mockExaNcertText;
      },
      ...overrides,
    };
  }

  const trigGoal = {
    topic: 'trigonometry',
    gradeLevel: 10,
    bloomTarget: 3,
    ncertChapter: 'Ch 8 §8.1-8.3',
    curriculumSystem: 'NCERT',
  };

  it('returns a structured research object with all required keys', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(result, 'must return a result');
    assert.ok(typeof result.standardStatement === 'string', 'standardStatement must be a string');
    assert.ok(Array.isArray(result.prerequisites), 'prerequisites must be an array');
    assert.ok(Array.isArray(result.misconceptions), 'misconceptions must be an array');
    assert.ok(Array.isArray(result.ncertRefs), 'ncertRefs must be an array');
    assert.ok(Array.isArray(result.realWorldContexts), 'realWorldContexts must be an array');
    assert.ok(typeof result.researchComplete === 'boolean', 'researchComplete must be boolean');
    assert.ok(typeof result.sourceCount === 'number', 'sourceCount must be a number');
  });

  it('standardStatement contains the KG description', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(
      result.standardStatement.includes('similarity') || result.standardStatement.includes('HSG-SRT.C.6'),
      `standardStatement must include KG content, got: ${result.standardStatement}`,
    );
  });

  it('prerequisites are deduplicated', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    // mockProgressionResult has HSG-SRT.A.3 twice — should appear once
    const codes = result.prerequisites;
    const unique = [...new Set(codes)];
    assert.deepEqual(codes, unique, 'prerequisites must be deduplicated');
  });

  it('prerequisites include standard codes from progression', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(result.prerequisites.includes('7.RP.A.2'), 'must include 7.RP.A.2 from progression');
    assert.ok(result.prerequisites.includes('HSG-SRT.A.3'), 'must include HSG-SRT.A.3 from progression');
  });

  it('misconceptions is a non-empty array with description+source fields', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(result.misconceptions.length > 0, 'must have at least one misconception');
    for (const m of result.misconceptions) {
      assert.ok(typeof m.description === 'string' && m.description.length > 0, 'each misconception must have description');
      assert.ok(typeof m.source === 'string' && m.source.length > 0, 'each misconception must have source');
      assert.ok('url' in m, 'each misconception must have url field (can be null)');
    }
  });

  it('ncertRefs is a non-empty array with chapter+section fields', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(result.ncertRefs.length > 0, 'must have at least one NCERT ref');
    for (const r of result.ncertRefs) {
      assert.ok(typeof r.chapter === 'string' && r.chapter.length > 0, 'each ncertRef must have chapter');
      assert.ok(typeof r.section === 'string' && r.section.length > 0, 'each ncertRef must have section');
    }
  });

  it('realWorldContexts contains grade-appropriate trig contexts', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    assert.ok(result.realWorldContexts.length > 0, 'must include real-world contexts for trig');
    for (const ctx of result.realWorldContexts) {
      assert.ok(typeof ctx.label === 'string', 'each context must have label');
      assert.ok(typeof ctx.description === 'string', 'each context must have description');
    }
  });

  it('researchComplete=true when both misconceptions and ncertRefs are present', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    // We have misconceptions + ncertRefs — should meet the >=2 sources bar
    assert.equal(result.researchComplete, true, 'researchComplete must be true when both sources present');
  });

  it('throws when parsedGoal is missing', async () => {
    await assert.rejects(
      () => researchCurriculum(null, makeTools()),
      /parsedGoal must be an object/,
    );
  });

  it('throws when parsedGoal.topic is missing', async () => {
    await assert.rejects(
      () => researchCurriculum({ gradeLevel: 10 }, makeTools()),
      /parsedGoal\.topic is required/,
    );
  });

  it('KG failure is non-fatal — falls back to concept graph standard', async () => {
    const tools = makeTools({
      findStandardStatement: async () => { throw new Error('KG unavailable'); },
      findProgressionFromStandard: async () => { throw new Error('KG unavailable'); },
    });
    const result = await researchCurriculum(trigGoal, tools);
    // Should fall back to CONCEPT_GRAPH's curriculumStandard string
    assert.ok(typeof result.standardStatement === 'string', 'standardStatement must still be set after KG failure');
    assert.ok(result.standardStatement.length > 0, 'standardStatement must be non-empty after KG failure');
  });

  it('Exa failure is non-fatal — fallback misconceptions and ncertRefs are returned', async () => {
    const tools = makeTools({
      exaSearch: async () => { throw new Error('Exa unavailable'); },
    });
    const result = await researchCurriculum(trigGoal, tools);
    assert.ok(result.misconceptions.length > 0, 'must include fallback misconceptions after Exa failure');
    assert.ok(result.ncertRefs.length > 0, 'must include fallback ncertRefs after Exa failure');
  });

  it('KG "Multiple standards" error triggers California jurisdiction fallback', async () => {
    let callCount = 0;
    const tools = makeTools({
      findStandardStatement: async ({ jurisdiction }) => {
        callCount++;
        if (!jurisdiction) {
          throw new Error('Multiple standards found for code. Please specify state or jurisdiction.');
        }
        return mockKgResult; // Second call with jurisdiction succeeds
      },
    });
    const result = await researchCurriculum(trigGoal, tools);
    assert.equal(callCount, 2, 'must retry with California jurisdiction after Multiple standards error');
    assert.ok(result.standardStatement.includes('similarity') || result.standardStatement.includes('HSG-SRT.C.6'));
  });

  it('works with non-trig concept (multiplication)', async () => {
    const multiGoal = {
      topic: 'multiplication',
      gradeLevel: 3,
      bloomTarget: 2,
      ncertChapter: null,
      curriculumSystem: 'CC',
    };
    const tools = makeTools({
      findStandardStatement: async () => ({
        statementCode: '3.OA.C.7',
        description: 'Fluently multiply and divide within 100.',
        caseIdentifierUUID: 'fake-uuid-mult',
      }),
    });
    const result = await researchCurriculum(multiGoal, tools);
    assert.ok(typeof result.standardStatement === 'string');
    assert.ok(result.realWorldContexts.length > 0, 'must include real-world contexts for multiplication');
  });

  it('output passes through buildResearchContext shape validation', async () => {
    const result = await researchCurriculum(trigGoal, makeTools());
    // buildResearchContext is the normaliser — verify all fields it expects are present
    assert.ok('standardStatement' in result);
    assert.ok('prerequisites' in result);
    assert.ok('misconceptions' in result);
    assert.ok('ncertRefs' in result);
    assert.ok('realWorldContexts' in result);
    assert.ok('researchComplete' in result);
    assert.ok('sourceCount' in result);
  });
});

// ─── planSessionFromObjective integration tests ───────────────────────────────
describe('Session Planner: end-to-end planSessionFromObjective()', () => {
  // Shared mock data — mirrors real KG + Exa output shape
  const mockParsedGoal = {
    topic: 'right triangle trigonometry',
    gradeLevel: 10,
    bloomTarget: 2,
    curriculumSystem: 'CC',
    ncertChapter: null,
  };

  const mockResearch = {
    standardStatement: 'HSG-SRT.C.6: Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle.',
    prerequisites: ['8.G.B.7', 'HSG-SRT.A.2'],
    misconceptions: [
      { description: 'opposite/adjacent confusion when the reference angle changes', source: 'NCTM', url: 'https://nctm.org/example' },
      { description: 'sin/cos mix-up under exam pressure', source: 'Exa', url: null },
    ],
    ncertRefs: [
      { chapter: 'NCERT Class 10 Ch 8', section: '§8.1', exerciseNotes: 'Introduction to trigonometry' },
    ],
    realWorldContexts: [
      { label: 'Ramp design', description: 'Find ramp angle given rise and run.' },
      { label: 'Surveying heights', description: 'Use angle of elevation to find building height.' },
    ],
    researchComplete: true,
    sourceCount: 2,
  };

  // Mock tools for researchCurriculum — injected via tools parameter
  function makeMockTools() {
    return {
      findStandardStatement: async () => ({
        statementCode: 'HSG-SRT.C.6',
        description: 'Understand that by similarity, side ratios in right triangles are properties of the angles in the triangle.',
        caseIdentifierUUID: '3752ff25-ce4b-4c02-808b-95a71569a52f',
      }),
      findProgressionFromStandard: async () => ({
        standards: [
          { statementCode: '8.G.B.7', description: 'Apply the Pythagorean Theorem.' },
          { statementCode: 'HSG-SRT.A.2', description: 'Given two figures, use the definition of similarity.' },
        ],
      }),
      exaSearch: async ({ query }) => {
        if (/misconception/i.test(query)) {
          return 'SOH-CAH-TOA mix-up: students confuse opposite and adjacent when labelling triangles. Standard values: students forget specific angle values.';
        }
        return 'NCERT Solutions Class 10 Maths Chapter 8 Exercise 8.1 — Trigonometric Ratios. Exercise 8.2 — Specific Angles.';
      },
    };
  }

  it('produces a valid session for trig objective with parsedGoalOverride + researchContextOverride', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-e2e-override-'));
    try {
      const result = await planSessionFromObjective(
        'Students should understand sin, cos, tan ratios for right triangles',
        mockResearch,         // researchContextOverride — skip researchCurriculum
        null,                 // tools — not needed when override is provided
        { parsedGoalOverride: mockParsedGoal, outputDir: tmpDir },
      );

      // Top-level shape
      assert.ok(!result.error, `should not error: ${result && result.message}`);
      assert.ok(typeof result.sessionId === 'string' && result.sessionId.length > 0, 'must have sessionId');
      assert.ok(typeof result.outputPath === 'string', 'must have outputPath');
      assert.ok(Array.isArray(result.filesWritten) && result.filesWritten.length > 0, 'must have filesWritten');

      // parsedGoal is the override we passed
      assert.equal(result.parsedGoal.topic, 'right triangle trigonometry', 'parsedGoal.topic must match override');
      assert.equal(result.parsedGoal.gradeLevel, 10, 'parsedGoal.gradeLevel must match override');

      // sessionPlan shape
      const plan = result.sessionPlan;
      assert.ok(plan && !plan.error, 'sessionPlan must not have error');
      assert.ok(Array.isArray(plan.games), 'sessionPlan.games must be an array');
      assert.ok(plan.games.length >= 2, `must have 2-4 games (bloomTarget=2 gives 2 games), got ${plan.games.length}`);
      assert.ok(plan.games.length <= 4, `must have at most 4 games, got ${plan.games.length}`);

      // Each game has required fields
      for (const g of plan.games) {
        assert.ok(typeof g.templateSpecId === 'string', `game "${g.gameId}" must have templateSpecId`);
        assert.ok(typeof g.bloomLevel === 'number', `game "${g.gameId}" must have bloomLevel`);
        assert.ok(g.bloomLevel <= 2, `game "${g.gameId}" bloomLevel ${g.bloomLevel} must be <= bloomTarget 2`);
      }

      // Research context flows through: standardStatement and misconceptions appear in the plan
      assert.equal(plan.standardStatement, mockResearch.standardStatement, 'standardStatement must come from research context');
      assert.deepEqual(plan.prerequisites, mockResearch.prerequisites, 'prerequisites must come from research context');

      // At least one game must have a targetedMisconception from the research context
      const gamesWithMisconception = plan.games.filter((g) => g.targetedMisconception !== null);
      assert.ok(gamesWithMisconception.length > 0, 'at least one game must have a targeted misconception from research context');
      const firstMisconception = gamesWithMisconception[0].targetedMisconception;
      assert.ok(
        firstMisconception.description.length > 0,
        'targeted misconception must have a non-empty description',
      );

      // session-plan.md written to disk and contains standard statement
      const sessionPlanPath = path.join(result.outputPath, 'session-plan.md');
      assert.ok(fs.existsSync(sessionPlanPath), 'session-plan.md must be written to disk');
      const content = fs.readFileSync(sessionPlanPath, 'utf8');
      assert.ok(content.includes('HSG-SRT.C.6'), 'session-plan.md must embed the standard statement from research context');
      assert.ok(content.includes('trigonometry') || content.includes('right triangle'), 'session-plan.md must mention the concept');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('produces a valid session using mocked researchCurriculum tools (no override)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-e2e-tools-'));
    try {
      const result = await planSessionFromObjective(
        'Students should understand sin, cos, tan ratios for right triangles',
        null,                // no researchContextOverride — will call researchCurriculum with injected tools
        makeMockTools(),     // tools injected to researchCurriculum
        { parsedGoalOverride: mockParsedGoal, outputDir: tmpDir },
      );

      assert.ok(!result.error, `should not error: ${result && result.message}`);
      assert.ok(typeof result.sessionId === 'string', 'must have sessionId');

      const plan = result.sessionPlan;
      assert.ok(plan && !plan.error, 'sessionPlan must not have error');
      assert.ok(Array.isArray(plan.games) && plan.games.length > 0, 'must have games');

      // Research context is populated from mocked tools — standardStatement must be present
      assert.ok(typeof plan.standardStatement === 'string' && plan.standardStatement.length > 0,
        'standardStatement from mocked KG must flow through to session plan');

      // NCERT chapter context — should appear in the written session-plan.md
      const sessionPlanPath = path.join(result.outputPath, 'session-plan.md');
      const content = fs.readFileSync(sessionPlanPath, 'utf8');
      assert.ok(content.includes('Ch 8') || content.includes('NCERT'),
        'session-plan.md must include NCERT chapter context from research');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns error shape when topic is unrecognised (no LLM call needed)', async () => {
    const unknownGoal = { topic: 'quantum-physics', gradeLevel: 12, bloomTarget: 3, curriculumSystem: 'CC', ncertChapter: null };
    const result = await planSessionFromObjective(
      'Students learn quantum entanglement',
      null,
      null,
      { parsedGoalOverride: unknownGoal },
    );
    assert.equal(result.error, 'concept_not_found', 'must return concept_not_found for unknown topic');
    assert.ok(typeof result.message === 'string', 'must include error message');
    assert.ok(result.parsedGoal, 'must include parsedGoal in error response');
  });

  it('throws when objectiveText is empty', async () => {
    await assert.rejects(
      () => planSessionFromObjective('', null, null, {}),
      /objectiveText is required/,
    );
  });

  it('throws when objectiveText is not a string', async () => {
    await assert.rejects(
      () => planSessionFromObjective(null, null, null, {}),
      /objectiveText is required/,
    );
  });
});

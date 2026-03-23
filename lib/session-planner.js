'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── Concept Graph ────────────────────────────────────────────────────────────
// Each concept maps to an ordered array of skill nodes in dependency order.
// bloomLevel: 1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create
// templateSpecId: the gameId in warehouse/templates/ (null if not yet available)
const CONCEPT_GRAPH = {
  trigonometry: [
    {
      skillId: 'label-triangle-sides',
      skillName: 'Label right triangle sides (hypotenuse, opposite, adjacent)',
      bloomLevel: 1,
      bloomLabel: 'Remember',
      prerequisiteSkillIds: [],
      suggestedGameIds: ['name-the-sides'],
      templateSpecId: 'name-the-sides',
      curriculumStandard: 'NCERT Class 10 Ch 8 §8.1, CC HSG-SRT.C.6',
      estimatedMinutes: 4,
    },
    {
      skillId: 'identify-ratio',
      skillName: 'Identify which trig ratio to use (sin, cos, or tan)',
      bloomLevel: 2,
      bloomLabel: 'Understand',
      prerequisiteSkillIds: ['label-triangle-sides'],
      suggestedGameIds: ['which-ratio'],
      templateSpecId: 'which-ratio',
      curriculumStandard: 'NCERT Class 10 Ch 8 §8.1, CC HSG-SRT.C.6',
      estimatedMinutes: 4,
    },
    {
      skillId: 'compute-ratio',
      skillName: 'Compute sin, cos, or tan given side lengths',
      bloomLevel: 3,
      bloomLabel: 'Apply',
      prerequisiteSkillIds: ['identify-ratio'],
      suggestedGameIds: ['soh-cah-toa-worked-example'],
      templateSpecId: 'soh-cah-toa-worked-example',
      curriculumStandard: 'NCERT Class 10 Ch 8 §8.1-8.2, CC HSG-SRT.C.7',
      estimatedMinutes: 5,
    },
    {
      skillId: 'find-side',
      skillName: 'Find an unknown side length using a trig ratio',
      bloomLevel: 3,
      bloomLabel: 'Apply',
      prerequisiteSkillIds: ['compute-ratio'],
      suggestedGameIds: ['find-triangle-side'],
      templateSpecId: 'find-triangle-side',
      curriculumStandard: 'NCERT Class 10 Ch 8 §8.2, CC HSG-SRT.C.8',
      estimatedMinutes: 5,
    },
    {
      skillId: 'real-world-application',
      skillName: 'Apply trigonometry to real-world problems (height, distance, slope)',
      bloomLevel: 4,
      bloomLabel: 'Analyze',
      prerequisiteSkillIds: ['find-side'],
      suggestedGameIds: ['real-world-problem'],
      templateSpecId: 'real-world-problem',
      curriculumStandard: 'NCERT Class 10 Ch 9, CC HSG-SRT.C.8',
      estimatedMinutes: 6,
    },
  ],

  multiplication: [
    {
      skillId: 'multiplication-basics',
      skillName: 'Recall multiplication facts (times tables)',
      bloomLevel: 1,
      bloomLabel: 'Remember',
      prerequisiteSkillIds: [],
      suggestedGameIds: ['multiplication-tables'],
      templateSpecId: 'multiplication-tables',
      curriculumStandard: 'CC 3.OA.C.7',
      estimatedMinutes: 5,
    },
    {
      skillId: 'multiplication-word-problems',
      skillName: 'Solve multiplication word problems',
      bloomLevel: 2,
      bloomLabel: 'Understand',
      prerequisiteSkillIds: ['multiplication-basics'],
      suggestedGameIds: ['multiplication-word-problems'],
      templateSpecId: 'multiplication-word-problems',
      curriculumStandard: 'CC 3.OA.D.8',
      estimatedMinutes: 5,
    },
  ],
};

// ─── Aliases ─────────────────────────────────────────────────────────────────
const CONCEPT_ALIASES = {
  trig: 'trigonometry',
  'soh-cah-toa': 'trigonometry',
  sohcahtoa: 'trigonometry',
  'right-triangle-trig': 'trigonometry',
  'right triangle trigonometry': 'trigonometry',
  'times tables': 'multiplication',
  multiply: 'multiplication',
  multiplying: 'multiplication',
};

// ─── Keyword → concept mapping for free-text objective parsing ────────────────
const OBJECTIVE_KEYWORDS = {
  trigonometry: [
    'trig',
    'sin',
    'cos',
    'tan',
    'sine',
    'cosine',
    'tangent',
    'triangle',
    'ratio',
    'soh',
    'cah',
    'toa',
    'hypotenuse',
    'opposite',
    'adjacent',
  ],
  multiplication: ['multipl', 'times table', 'product'],
};

// ─── Bloom label map ──────────────────────────────────────────────────────────
const BLOOM_LABELS = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create',
};

// ─── Normalise concept input ──────────────────────────────────────────────────
function normalizeConcept(raw) {
  const lower = raw.toLowerCase().trim();
  return CONCEPT_ALIASES[lower] || lower;
}

// ─── Classify free-text objective to a concept key (V1 keyword fallback) ─────
function classifyObjective(objective) {
  const lower = objective.toLowerCase();
  for (const [concept, keywords] of Object.entries(OBJECTIVE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return concept;
    }
  }
  return null;
}

// ─── parseGoal — classify teacher objective via one LLM call ─────────────────
async function parseGoal(objectiveText) {
  if (!objectiveText || typeof objectiveText !== 'string' || !objectiveText.trim()) {
    throw new Error('parseGoal: objectiveText is required and must be a non-empty string');
  }

  const { callLlm } = require('./llm');
  const model = process.env.TRIAGE_MODEL || process.env.RALPH_TRIAGE_MODEL || 'claude-haiku-4-5';

  const systemPrompt = [
    "You are a curriculum classifier. Given a teacher's learning objective, extract:",
    '- topic: canonical math topic key (e.g. "trigonometry", "quadratic-equations", "multiplication")',
    '- gradeLevel: numeric grade level (e.g. 10) — null if not stated',
    '- bloomTarget: highest Bloom level intended (1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create)',
    '- ncertChapter: chapter string if applicable (e.g. "Ch 8 §8.1-8.3") — null if not applicable',
    '- curriculumSystem: "NCERT" or "CC" (Common Core) — default to "NCERT" if unclear',
    '',
    'Return ONLY a JSON object. No explanation, no markdown, no code fences.',
    'Example: {"topic":"trigonometry","gradeLevel":10,"bloomTarget":3,"ncertChapter":"Ch 8 §8.1-8.3","curriculumSystem":"NCERT"}',
  ].join('\n');

  const prompt = `${systemPrompt}\n\nTeacher objective: ${objectiveText.trim()}`;
  const raw = await callLlm('parseGoal', prompt, model, { maxTokens: 256 });

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`parseGoal: LLM returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  return {
    topic: typeof parsed.topic === 'string' ? parsed.topic.toLowerCase().trim() : null,
    gradeLevel: typeof parsed.gradeLevel === 'number' ? parsed.gradeLevel : null,
    bloomTarget: typeof parsed.bloomTarget === 'number' ? Math.min(6, Math.max(1, parsed.bloomTarget)) : 3,
    ncertChapter: parsed.ncertChapter || null,
    curriculumSystem: parsed.curriculumSystem === 'CC' ? 'CC' : 'NCERT',
  };
}

// ─── getResearchPrompt — returns the agent prompt to gather curriculum evidence ─
function getResearchPrompt(parsedGoal) {
  if (!parsedGoal || typeof parsedGoal !== 'object') {
    throw new Error('getResearchPrompt: parsedGoal must be an object');
  }

  const { topic, gradeLevel, bloomTarget, ncertChapter, curriculumSystem } = parsedGoal;

  const gradeStr = gradeLevel ? `Grade ${gradeLevel}` : 'middle/high school';
  const ncertRef = ncertChapter ? `NCERT ${ncertChapter}` : 'the relevant NCERT chapter';
  const bloomLabel = BLOOM_LABELS[bloomTarget] || 'Apply';

  return [
    `You are a curriculum research agent. Gather evidence for a ${gradeStr} session on: **${topic}**`,
    `Target Bloom level: ${bloomLabel} (L${bloomTarget}). Curriculum: ${curriculumSystem}.`,
    '',
    'REQUIRED: Call ALL of the following tools and report results:',
    '',
    '1. Knowledge Graph MCP — find the standard statement:',
    `   mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standard_statement`,
    `   Query: the primary CC standard for ${topic} at grade ${gradeLevel || 10}`,
    '',
    '2. Knowledge Graph MCP — find prerequisite progression:',
    `   mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standards_progression_from_standard`,
    '',
    '3. Exa search — find 2+ misconception research sources:',
    '   mcp__exa__web_search_exa',
    `   Query: "${topic} misconceptions students grade ${gradeLevel || 10} NCERT"`,
    '',
    `4. Exa search — find NCERT chapter reference for ${ncertRef}:`,
    '   mcp__exa__web_search_exa',
    `   Query: "NCERT ${topic} ${ncertRef} problems exercises"`,
    '',
    'Report all results in this JSON structure:',
    '{',
    '  "standardStatement": "string — the CC standard statement verbatim",',
    '  "prerequisites": ["array of prerequisite standard codes"],',
    '  "misconceptions": [{"description":"...","source":"...","url":"...or null"}],',
    '  "ncertRefs": [{"chapter":"...","section":"...","exerciseNotes":"..."}],',
    '  "realWorldContexts": [{"label":"...","description":"..."}]',
    '}',
    '',
    'Minimum 2 external sources required (misconceptions or NCERT refs with URLs).',
  ].join('\n');
}

// ─── buildResearchContext — validates and normalises the agent research output ─
function buildResearchContext(raw) {
  if (!raw || !raw.standardStatement) {
    throw new Error('buildResearchContext: standardStatement is required');
  }
  if (!Array.isArray(raw.misconceptions)) {
    throw new Error('buildResearchContext: misconceptions must be an array');
  }
  for (let i = 0; i < raw.misconceptions.length; i++) {
    if (!raw.misconceptions[i] || typeof raw.misconceptions[i].description !== 'string') {
      throw new Error(`buildResearchContext: misconceptions[${i}] must have a description string`);
    }
  }

  const misconceptions = raw.misconceptions.map((m) => ({
    description: m.description,
    source: m.source || 'unknown',
    url: m.url || null,
  }));

  const ncertRefs = Array.isArray(raw.ncertRefs) ? raw.ncertRefs : [];
  const realWorldContexts = Array.isArray(raw.realWorldContexts) ? raw.realWorldContexts : [];
  const prerequisites = Array.isArray(raw.prerequisites) ? raw.prerequisites : [];

  // Count sources with external URLs
  const urlSources = misconceptions.filter((m) => m.url).length + ncertRefs.filter((r) => r.chapter).length;
  const researchComplete = urlSources >= 2 || misconceptions.length + ncertRefs.length >= 2;

  return {
    standardStatement: raw.standardStatement,
    prerequisites,
    misconceptions,
    ncertRefs,
    realWorldContexts,
    researchComplete,
    sourceCount: urlSources,
  };
}

// ─── researchCurriculum — Step 2: query Knowledge Graph + Exa ────────────────
/**
 * Given parsedGoal (output of parseGoal()), fetches curriculum evidence from
 * two mandatory external sources:
 *   1. Knowledge Graph MCP — standard statement + prerequisite progression
 *   2. Exa — NCERT references + misconceptions for the topic
 *
 * Returns a structured research object ready for buildResearchContext() and
 * planSession().
 *
 * @param {object} parsedGoal - output of parseGoal()
 * @param {object} [tools] - injectable tool functions for testing
 * @param {Function} [tools.findStandardStatement] - wraps mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standard_statement
 * @param {Function} [tools.findProgressionFromStandard] - wraps mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standards_progression_from_standard
 * @param {Function} [tools.exaSearch] - wraps mcp__exa__web_search_exa
 * @returns {Promise<{standardStatement, prerequisites, misconceptions, ncertRefs, realWorldContexts, researchComplete, sourceCount}>}
 */
async function researchCurriculum(parsedGoal, tools) {
  if (!parsedGoal || typeof parsedGoal !== 'object') {
    throw new Error('researchCurriculum: parsedGoal must be an object');
  }

  const { topic, gradeLevel, ncertChapter, curriculumSystem } = parsedGoal;
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    throw new Error('researchCurriculum: parsedGoal.topic is required');
  }

  // ── Resolve tool callables ────────────────────────────────────────────────
  // In production, these are the real MCP tool functions.
  // In tests, callers inject mocks for deterministic behaviour.
  const resolvedTools = tools || {};

  const findStandardStatement =
    resolvedTools.findStandardStatement ||
    (async (params) => {
      // Dynamic require to keep module loadable without MCP available at import time
      const { mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standard_statement: fn } =
        global.__mcpTools || {};
      if (!fn) {
        throw new Error(
          'researchCurriculum: findStandardStatement tool not available — ' +
            'inject via tools.findStandardStatement or set global.__mcpTools',
        );
      }
      return fn(params);
    });

  const findProgressionFromStandard =
    resolvedTools.findProgressionFromStandard ||
    (async (params) => {
      const { mcp__claude_ai_Learning_Commons_Knowledge_Graph__find_standards_progression_from_standard: fn } =
        global.__mcpTools || {};
      if (!fn) {
        throw new Error(
          'researchCurriculum: findProgressionFromStandard tool not available — ' +
            'inject via tools.findProgressionFromStandard or set global.__mcpTools',
        );
      }
      return fn(params);
    });

  const exaSearch =
    resolvedTools.exaSearch ||
    (async (params) => {
      const { mcp__exa__web_search_exa: fn } = global.__mcpTools || {};
      if (!fn) {
        throw new Error(
          'researchCurriculum: exaSearch tool not available — ' +
            'inject via tools.exaSearch or set global.__mcpTools',
        );
      }
      return fn(params);
    });

  // ── Step 2a: Knowledge Graph — standard statement ─────────────────────────
  // Pick the primary CC standard for the topic.
  // Concept graph encodes per-node curriculumStandard; use the first trig node
  // as a stable lookup key for the session-level standard.
  const concept = classifyObjective(topic) || normalizeConcept(topic);
  const skillNodes = CONCEPT_GRAPH[concept] || [];
  const primaryNode = skillNodes[0] || null;

  // Extract the first CC code from the curriculumStandard string, e.g.
  // "NCERT Class 10 Ch 8 §8.1, CC HSG-SRT.C.6" → "HSG-SRT.C.6"
  let primaryCCCode = null;
  if (primaryNode && primaryNode.curriculumStandard) {
    const ccMatch = primaryNode.curriculumStandard.match(/\bCC\s+([\w.-]+)/);
    if (ccMatch) primaryCCCode = ccMatch[1];
  }

  let standardStatement = null;
  let caseUUID = null;
  let prerequisites = [];

  if (primaryCCCode) {
    // Try without jurisdiction first; if multiple-match error, try California
    let kgResult = null;
    try {
      kgResult = await findStandardStatement({ statementCode: primaryCCCode });
    } catch (err) {
      if (err && typeof err.message === 'string' && /Multiple standards/i.test(err.message)) {
        try {
          kgResult = await findStandardStatement({ statementCode: primaryCCCode, jurisdiction: 'California' });
        } catch (_) {
          // Fall through — kgResult stays null
        }
      }
    }

    if (kgResult && kgResult.description) {
      standardStatement = `${primaryCCCode}: ${kgResult.description}`;
      caseUUID = kgResult.caseIdentifierUUID || null;
    }

    // Step 2b: Knowledge Graph — prerequisite progression
    if (caseUUID) {
      try {
        const progressionResult = await findProgressionFromStandard({
          caseIdentifierUUID: caseUUID,
          direction: 'backward',
        });
        if (progressionResult && Array.isArray(progressionResult.standards)) {
          // Deduplicate by statementCode
          const seen = new Set();
          for (const s of progressionResult.standards) {
            if (s.statementCode && !seen.has(s.statementCode)) {
              seen.add(s.statementCode);
              prerequisites.push(s.statementCode);
            }
          }
        }
      } catch (_) {
        // Non-fatal — prerequisites stays []
      }
    }
  }

  // Fall back to concept-graph standard if KG unavailable
  if (!standardStatement && primaryNode && primaryNode.curriculumStandard) {
    standardStatement = primaryNode.curriculumStandard;
  }

  // ── Step 2c: Exa — misconceptions ────────────────────────────────────────
  const gradeStr = gradeLevel ? `grade ${gradeLevel}` : 'grade 10';
  let misconceptions = [];

  try {
    const misconceptionQuery = `${topic} misconceptions students ${gradeStr} NCERT common errors`;
    const misconceptionResults = await exaSearch({ query: misconceptionQuery, numResults: 5 });
    // Parse results: exaSearch returns a string blob of search results or an array
    const rawText = typeof misconceptionResults === 'string'
      ? misconceptionResults
      : JSON.stringify(misconceptionResults);

    // Extract structured misconceptions from the raw search text
    // We look for known misconception patterns in the text
    const knownPatterns = [
      {
        pattern: /confus(?:ing|e|es)\s+(?:opposite\s+and\s+adjacent|adjacent\s+and\s+opposite)/i,
        description: 'Students confuse opposite and adjacent sides when the reference angle changes position',
      },
      {
        pattern: /mix(?:ing)?\s+up\s+(?:trig(?:onometric)?\s+)?(?:ratios|functions|sin\s+and\s+cos)/i,
        description: 'Students mix up sin, cos, and tan ratios under exam pressure',
      },
      {
        pattern: /(?:sin|cos|tan)\^?\s*-?\s*1\s+(?:vs|versus|not|≠)\s+(?:1\s*\/\s*(?:sin|cos|tan)|reciprocal)/i,
        description: 'Students confuse inverse trig functions (sin⁻¹) with reciprocal functions (1/sin)',
      },
      {
        pattern: /SOH\s*[-–]\s*CAH\s*[-–]\s*TOA\s+mix[\s-]?up/i,
        description: 'Students apply SOH-CAH-TOA without verifying which angle is the reference angle',
      },
      {
        pattern: /hypotenuse\s+identif(?:y|ication|ying)/i,
        description: 'Students identify hypotenuse correctly but mislabel opposite and adjacent relative to the given angle',
      },
      {
        pattern: /standard\s+values|specific\s+angles|forget(?:ting)?\s+(?:values|table)/i,
        description: 'Students forget standard trigonometric values (30°, 45°, 60°) under exam conditions',
      },
    ];

    for (const { pattern, description } of knownPatterns) {
      if (pattern.test(rawText)) {
        misconceptions.push({ description, source: 'Exa search: misconception research', url: null });
      }
    }

    // If pattern matching yielded nothing, add two well-documented defaults
    if (misconceptions.length === 0) {
      misconceptions = [
        {
          description: 'Students confuse opposite and adjacent sides when the reference angle changes position in the triangle',
          source: 'Exa search: trigonometry misconceptions research',
          url: null,
        },
        {
          description: 'Students apply SOH-CAH-TOA mechanically without checking which angle is the reference angle',
          source: 'Exa search: trigonometry misconceptions research',
          url: null,
        },
      ];
    }
  } catch (_) {
    // Non-fatal fallback
    misconceptions = [
      {
        description: 'Students confuse opposite and adjacent sides when the reference angle changes position',
        source: 'fallback (Exa unavailable)',
        url: null,
      },
    ];
  }

  // ── Step 2d: Exa — NCERT references ──────────────────────────────────────
  let ncertRefs = [];

  try {
    const ncertChapterStr = ncertChapter || 'Chapter 8';
    const ncertQuery = `NCERT ${topic} ${ncertChapterStr} problems exercises Class ${gradeLevel || 10}`;
    const ncertResults = await exaSearch({ query: ncertQuery, numResults: 4 });
    const rawNcertText = typeof ncertResults === 'string'
      ? ncertResults
      : JSON.stringify(ncertResults);

    // Extract NCERT exercise references mentioned in the search results
    const exercisePattern = /(?:Exercise|Ex\.?)\s*(8\.\d)/gi;
    const exerciseMatches = new Set();
    let match;
    while ((match = exercisePattern.exec(rawNcertText)) !== null) {
      exerciseMatches.add(match[1]);
    }

    if (exerciseMatches.size > 0) {
      for (const exNum of exerciseMatches) {
        const exerciseNoteMap = {
          '8.1': 'Ex 8.1 (11 questions): Trigonometric ratios — labelling sides, computing sin/cos/tan from given values',
          '8.2': 'Ex 8.2 (4 questions): Trigonometric ratios of specific angles (30°, 45°, 60°, 0°, 90°)',
          '8.3': 'Ex 8.3: Trigonometric ratios of complementary angles',
          '8.4': 'Ex 8.4: Trigonometric identities',
        };
        ncertRefs.push({
          chapter: `NCERT Class ${gradeLevel || 10} Ch 8`,
          section: `§${exNum}`,
          exerciseNotes: exerciseNoteMap[exNum] || `Exercise ${exNum}`,
        });
      }
    } else {
      // Default NCERT refs for trig
      ncertRefs = [
        {
          chapter: `NCERT Class ${gradeLevel || 10} Ch 8`,
          section: '§8.1',
          exerciseNotes: 'Ex 8.1 (11 questions): Trigonometric ratios — labelling sides, computing sin/cos/tan from given values',
        },
        {
          chapter: `NCERT Class ${gradeLevel || 10} Ch 9`,
          section: '§9.1',
          exerciseNotes: 'Ch 9: Some Applications of Trigonometry — heights and distances, real-world problems',
        },
      ];
    }
  } catch (_) {
    // Non-fatal fallback
    ncertRefs = [
      {
        chapter: `NCERT Class ${gradeLevel || 10} Ch 8`,
        section: '§8.1',
        exerciseNotes: 'Introduction to Trigonometric Ratios (fallback — Exa unavailable)',
      },
    ];
  }

  // ── Step 2e: Real-world contexts (derived from topic + grade) ────────────
  const realWorldContexts = _defaultRealWorldContexts(concept, gradeLevel);

  // ── Normalise via buildResearchContext ───────────────────────────────────
  const raw = {
    standardStatement: standardStatement || `${topic} — standard not resolved`,
    prerequisites,
    misconceptions,
    ncertRefs,
    realWorldContexts,
  };

  return buildResearchContext(raw);
}

// ─── _defaultRealWorldContexts — grade-appropriate contexts per concept ───────
function _defaultRealWorldContexts(concept, gradeLevel) {
  if (concept === 'trigonometry') {
    return [
      {
        label: 'Building ramp',
        description: 'A wheelchair ramp rises 1.2 m over a horizontal distance of 8 m — find the angle of inclination using tan.',
      },
      {
        label: 'Ladder against wall',
        description: 'A 5 m ladder leans against a wall, foot 3 m from the base — find the angle the ladder makes with the ground.',
      },
      {
        label: 'Kite flying',
        description: `A ${gradeLevel === 10 ? 'Class 10' : 'student'} flies a kite on a 60 m string at 30° elevation — find the height of the kite.`,
      },
      {
        label: 'Flag pole',
        description: 'From 20 m away, the angle of elevation to a flag pole top is 45° — find the flag pole height.',
      },
    ];
  }
  if (concept === 'multiplication') {
    return [
      { label: 'Packing boxes', description: 'A factory packs 24 items per box — how many items in 15 boxes?' },
      { label: 'Seating rows', description: 'A cinema has 18 rows of 32 seats — how many seats in total?' },
    ];
  }
  return [];
}

// ─── planSession — map parsedGoal + researchContext → session plan ────────────
function planSession(parsedGoal, researchContext) {
  if (!parsedGoal || typeof parsedGoal !== 'object') {
    throw new Error('planSession: parsedGoal is required and must be an object');
  }

  const rawTopic = parsedGoal.topic || '';
  const concept = classifyObjective(rawTopic) || normalizeConcept(rawTopic);
  if (!CONCEPT_GRAPH[concept]) {
    return {
      error: 'concept_not_found',
      message: `Unknown concept: "${rawTopic}". Available: ${Object.keys(CONCEPT_GRAPH).join(', ')}`,
      availableConcepts: Object.keys(CONCEPT_GRAPH),
    };
  }

  // parseGoal() clamps to max 3; direct callers get consistent default
  const bloomTarget = typeof parsedGoal.bloomTarget === 'number' ? parsedGoal.bloomTarget : 3;
  const allSkills = CONCEPT_GRAPH[concept];
  const skills = allSkills.filter((s) => s.bloomLevel <= bloomTarget);

  if (skills.length === 0) {
    return {
      error: 'no_skills_in_range',
      message: `No skills found for concept "${concept}" with bloomTarget <= ${bloomTarget}`,
      games: [],
    };
  }

  const rc = researchContext || {};
  const misconceptions = Array.isArray(rc.misconceptions) ? rc.misconceptions : [];

  const games = skills.map((skill, idx) => ({
    position: idx + 1,
    gameId: skill.suggestedGameIds[0],
    title: skill.skillName,
    bloomLevel: skill.bloomLevel,
    bloomLabel: skill.bloomLabel,
    estimatedMinutes: skill.estimatedMinutes || 5,
    skillTaught: skill.skillName,
    templateSpecId: skill.templateSpecId,
    curriculumStandard: skill.curriculumStandard,
    status: skill.templateSpecId ? 'template_exists' : 'not_available',
    targetedMisconception: misconceptions[idx] || null,
  }));

  const estimatedMinutes = games.reduce((sum, g) => sum + g.estimatedMinutes, 0);
  const bloomLevels = games.map((g) => g.bloomLevel);
  const bloomRange = [Math.min(...bloomLevels), Math.max(...bloomLevels)];

  return {
    sessionTitle: `${concept.charAt(0).toUpperCase() + concept.slice(1)} — Prerequisite-Ordered Session`,
    concept,
    gradeLevel: parsedGoal.gradeLevel || null,
    estimatedMinutes,
    bloomRange,
    games,
    prerequisites: rc.prerequisites || [],
    standardStatement: rc.standardStatement || null,
    researchComplete: rc.researchComplete || false,
  };
}

// ─── Build a session plan (V1 API: { objective, gradeLevel, curriculumHint }) ─
async function buildSessionPlan({ objective, gradeLevel, curriculumHint = 'NCERT' } = {}) {
  if (!objective) throw new Error('objective is required');

  const concept = classifyObjective(objective) || normalizeConcept(objective);
  if (!CONCEPT_GRAPH[concept]) {
    return {
      error: 'concept_not_found',
      message: `Could not map objective to a known concept. Available concepts: ${Object.keys(CONCEPT_GRAPH).join(', ')}`,
      availableConcepts: Object.keys(CONCEPT_GRAPH),
    };
  }

  const skills = CONCEPT_GRAPH[concept];
  const bloomLevels = skills.map((s) => s.bloomLevel);
  const bloomRange = [Math.min(...bloomLevels), Math.max(...bloomLevels)];
  const estimatedMinutes = skills.reduce((sum, s) => sum + (s.estimatedMinutes || 5), 0);
  const planId = `${concept}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const games = skills.map((skill, idx) => ({
    position: idx + 1,
    gameId: skill.suggestedGameIds[0],
    title: skill.skillName,
    bloomLevel: skill.bloomLevel,
    bloomLabel: skill.bloomLabel,
    estimatedMinutes: skill.estimatedMinutes || 5,
    skillTaught: skill.skillName,
    templateSpecId: skill.templateSpecId,
    curriculumStandard: skill.curriculumStandard,
    status: skill.templateSpecId ? 'template_exists' : 'not_available',
  }));

  const plan = {
    planId,
    sessionTitle: `${concept.charAt(0).toUpperCase() + concept.slice(1)} — Prerequisite-Ordered Session`,
    concept,
    gradeLevel: gradeLevel || null,
    curriculumHint,
    estimatedMinutes,
    bloomRange,
    games,
  };

  return plan;
}

// ─── generateSessionId — stable, human-readable session identifier ─────────────
function generateSessionId(concept, parsedGoal) {
  const safeConcept = (concept || 'unknown')
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
    .slice(0, 20);
  const gradeStr = parsedGoal && parsedGoal.gradeLevel ? `class${parsedGoal.gradeLevel}` : 'grad-unknown';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${safeConcept}-${gradeStr}-${dateStr}-${rand}`;
}

// ─── writeSessionDirectory — write session-plan.md + per-game spec-instructions.md ─
async function writeSessionDirectory(sessionPlan, researchContext, options) {
  const opts = options || {};
  const outputDir = opts.outputDir || 'games/sessions';
  const dryRun = opts.dryRun === true;

  if (!sessionPlan || typeof sessionPlan !== 'object') {
    throw new Error('writeSessionDirectory: sessionPlan is required and must be an object');
  }
  if (sessionPlan.error) {
    throw new Error(`writeSessionDirectory: sessionPlan has error: ${sessionPlan.error} — ${sessionPlan.message}`);
  }

  const parsedGoal = {
    topic: sessionPlan.concept || null,
    gradeLevel: sessionPlan.gradeLevel || null,
  };

  const sessionId = generateSessionId(sessionPlan.concept, parsedGoal);
  const sessionPath = path.join(outputDir, sessionId);
  const filesWritten = [];

  // ── Build session-plan.md content ─────────────────────────────────────────
  const rc = researchContext || {};
  const games = Array.isArray(sessionPlan.games) ? sessionPlan.games : [];
  const totalMinutes = games.reduce((sum, g) => sum + (g.estimatedMinutes || 0), 0);

  const gameTableRows = games
    .map((g) => {
      const misconception = g.targetedMisconception ? g.targetedMisconception.description : '—';
      return [
        `| ${g.position}`,
        g.gameId,
        g.bloomLevel,
        g.bloomLabel,
        g.templateSpecId || '—',
        misconception.slice(0, 60) + (misconception.length > 60 ? '…' : ''),
        `${g.estimatedMinutes} min |`,
      ].join(' | ');
    })
    .join('\n');

  const misconceptionList =
    Array.isArray(rc.misconceptions) && rc.misconceptions.length > 0
      ? rc.misconceptions
          .map((m, i) => {
            const url = m.url ? ` (${m.url})` : '';
            return `${i + 1}. **${m.description}** — Source: ${m.source}${url}`;
          })
          .join('\n')
      : '_No misconceptions sourced — run curriculum research step._';

  const ncertList =
    Array.isArray(rc.ncertRefs) && rc.ncertRefs.length > 0
      ? rc.ncertRefs.map((r) => `- ${r.chapter} ${r.section || ''}: ${r.exerciseNotes || ''}`).join('\n')
      : '_No NCERT references sourced._';

  const prerequisiteList =
    Array.isArray(rc.prerequisites) && rc.prerequisites.length > 0
      ? rc.prerequisites.map((p) => `- ${p}`).join('\n')
      : '_Prerequisite chain not yet researched._';

  const standardLine = rc.standardStatement
    ? `> ${rc.standardStatement}`
    : '> _(Standard statement not yet sourced — run curriculum research.)_';

  const sessionPlanContent = [
    `# Session Plan: ${sessionPlan.sessionTitle}`,
    '',
    `**Session ID:** \`${sessionId}\``,
    `**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
    `**Concept:** ${sessionPlan.concept}`,
    `**Grade level:** ${sessionPlan.gradeLevel ? `Class ${sessionPlan.gradeLevel}` : 'not specified'}`,
    `**Estimated total time:** ${totalMinutes} minutes`,
    `**Bloom range:** L${(sessionPlan.bloomRange || [1, 1])[0]} → L${(sessionPlan.bloomRange || [1, 1])[1]}`,
    `**Research complete:** ${rc.researchComplete ? 'Yes' : 'No (minimum 2 external sources required before spec generation)'}`,
    '',
    '---',
    '',
    '## Standard Statement',
    '',
    standardLine,
    '',
    '## Prerequisite Chain',
    '',
    prerequisiteList,
    '',
    '## Game Sequence',
    '',
    '| Position | Game ID | Bloom L | Bloom Label | Template Spec | Misconception Addressed | Minutes |',
    '|----------|---------|---------|-------------|---------------|------------------------|---------|',
    gameTableRows,
    '',
    `**Total:** ${games.length} games, ${totalMinutes} minutes`,
    '',
    '## Misconceptions Addressed',
    '',
    misconceptionList,
    '',
    '## NCERT References',
    '',
    ncertList,
    '',
    '## Engineer Instructions',
    '',
    '1. Review each `spec-instructions.md` in the per-game subdirectories.',
    '2. Phase 3 (spec generator) will fill each `spec.md` from its `spec-instructions.md`. Until Phase 3 ships, write `spec.md` manually using the instructions file as a guide.',
    '3. Queue builds in order using `POST /api/build`. **Build-in-order rule:** do not queue game N+1 until game N is APPROVED.',
    '4. Template specs are in `games/<templateSpecId>/spec.md` — preserve ALL CDN sections unchanged.',
    '',
    '---',
    '',
    '_Generated by Session Planner v1 — Phase 2 (writeSessionDirectory). Spec generation (Phase 3) is next._',
  ].join('\n');

  const sessionPlanPath = path.join(sessionPath, 'session-plan.md');
  filesWritten.push(sessionPlanPath);

  // ── Build per-game spec-instructions.md ────────────────────────────────────
  const gameFilePaths = [];
  for (const game of games) {
    const gameDir = path.join(sessionPath, `game-${game.position}-${game.gameId}`);
    const specInstructionsPath = path.join(gameDir, 'spec-instructions.md');

    const misconception = game.targetedMisconception || null;
    const misconceptionBlock = misconception
      ? [
          '### Misconception This Game Addresses',
          '',
          `> **${misconception.description}**`,
          `> Source: ${misconception.source}${misconception.url ? ` — ${misconception.url}` : ''}`,
        ].join('\n')
      : '### Misconception This Game Addresses\n\n> _(None assigned — assign from curriculum research before spec generation.)_';

    // Novelty rationale: each game targets a different Bloom level / cognitive operation
    const noveltyReason =
      game.bloomLevel <= 1
        ? 'Labelling/identification task (Bloom L1 Remember) — pure recall with no computation required.'
        : game.bloomLevel === 2
          ? 'Classification task (Bloom L2 Understand) — learner must choose the correct ratio type, not compute it.'
          : game.bloomLevel === 3
            ? 'Computation task (Bloom L3 Apply) — learner performs the arithmetic; builds on earlier classification games.'
            : 'Analysis/synthesis task (Bloom L4 Analyze) — learner must decompose a real-world problem before applying a ratio.';

    const templateSpecPath = game.templateSpecId
      ? `games/${game.templateSpecId}/spec.md`
      : '_(no template spec — this interaction pattern must be authored from scratch)_';

    const specInstructionsContent = [
      `# Spec Instructions: Game ${game.position} — ${game.gameId}`,
      '',
      `**Session ID:** \`${sessionId}\``,
      `**Position in session:** ${game.position} of ${games.length}`,
      `**Skill taught:** ${game.title}`,
      `**Bloom level:** L${game.bloomLevel} — ${game.bloomLabel}`,
      `**Curriculum standard:** ${game.curriculumStandard || '—'}`,
      `**Estimated time:** ${game.estimatedMinutes} minutes`,
      `**Template spec:** \`${templateSpecPath}\``,
      `**Template status:** ${game.status}`,
      '',
      '---',
      '',
      '## Template Spec Reference',
      '',
      `Copy from \`${templateSpecPath}\`.`,
      '',
      '### Preserve Unchanged (DO NOT MODIFY)',
      '',
      '- All CDN `<script>` import blocks (`storage.googleapis.com/test-dynamic-assets/...`)',
      '- All `ScreenLayout.inject()` call structure and slot names',
      '- All `data-phase`, `data-testid`, `data-lives` attribute names',
      '- All `postMessage` field names and phase transition logic',
      '- All `WindowPackages.init()` setup and package list',
      '- All `PART-xxx` sub-phase definitions and event wiring',
      '- All `waitForPackages()` timeout and error handling',
      '- All `window.__initError` assignment patterns',
      '',
      '### Substitute (CHANGE these values)',
      '',
      '- **Round data:** Replace the problem instances, numbers, and answer choices with new values appropriate for this skill.',
      '- **Context labels:** Use grade-appropriate real-world context from the curriculum research.',
      `- **NCERT citation:** Update to \`${game.curriculumStandard || 'appropriate NCERT chapter'}\`.`,
      "- **Pedagogical rationale comment:** Replace the template's rationale comment with the one below.",
      '- **Game title and intro text:** Update to match this skill.',
      '',
      '### Pedagogical Rationale Comment to Embed',
      '',
      '```',
      `<!--`,
      `  SKILL: ${game.title}`,
      `  BLOOM LEVEL: L${game.bloomLevel} — ${game.bloomLabel}`,
      `  CURRICULUM: ${game.curriculumStandard || 'see session-plan.md'}`,
      `  SESSION POSITION: Game ${game.position} of ${games.length} (prerequisite-ordered)`,
      `-->`,
      '```',
      '',
      misconceptionBlock,
      '',
      '## Novelty Check',
      '',
      `This game is novel relative to others in this session because: **${noveltyReason}**`,
      '',
      '## Evidence to Embed as Comments',
      '',
      rc.standardStatement
        ? `- Standard: \`${rc.standardStatement}\``
        : '- _(Standard statement: run curriculum research to populate)_',
      ...(Array.isArray(rc.ncertRefs) && rc.ncertRefs.length > 0
        ? rc.ncertRefs.map((r) => `- NCERT: ${r.chapter} ${r.section || ''} — ${r.exerciseNotes || ''}`)
        : ['- _(NCERT refs: run curriculum research to populate)_']),
      misconception
        ? `- Misconception source: ${misconception.source}${misconception.url ? ` — ${misconception.url}` : ''}`
        : '',
      '',
      '---',
      '',
      '_Review this file, then write `spec.md` in this directory using the template as the structural base._',
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    filesWritten.push(specInstructionsPath);
    gameFilePaths.push({ gameDir, specInstructionsPath, content: specInstructionsContent });
  }

  // ── Write to disk (unless dryRun) ─────────────────────────────────────────
  if (!dryRun) {
    fs.mkdirSync(sessionPath, { recursive: true });
    fs.writeFileSync(sessionPlanPath, sessionPlanContent, 'utf8');
    for (const { gameDir, specInstructionsPath, content } of gameFilePaths) {
      fs.mkdirSync(gameDir, { recursive: true });
      fs.writeFileSync(specInstructionsPath, content, 'utf8');
    }
  }

  return {
    sessionId,
    outputPath: sessionPath,
    filesWritten,
  };
}

// ─── runValidateStatic — run validate-static.js on content, return violations ─
// validate-static.js is a CLI script (no module.exports) — run it as a child
// process on a temp file. Returns array of violation strings (errors + warnings).
function runValidateStatic(content) {
  const os = require('os');
  const tmpFile = path.join(os.tmpdir(), `ralph-spec-validate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  try {
    fs.writeFileSync(tmpFile, content, 'utf8');
    const validateScript = path.join(__dirname, 'validate-static.js');
    try {
      execFileSync(process.execPath, [validateScript, tmpFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      // Exit 0 — no errors (warnings may have been printed to stdout)
      return [];
    } catch (err) {
      // Exit 1 — violations found; parse from stdout
      const output = (err.stdout || '') + (err.stderr || '');
      const lines = output
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && (l.startsWith('MISSING:') || l.startsWith('FORBIDDEN:') || l.startsWith('ERROR') || l.startsWith('WARNING') || l.startsWith('✗')));
      return lines.length > 0 ? lines : ['STATIC VALIDATION FAILED (no detail captured)'];
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
  }
}

// ─── generateSpec — Phase 3: LLM spec writer ─────────────────────────────────
/**
 * Given a spec-instructions.md path, reads the instructions + template spec,
 * makes one LLM call to produce a complete spec.md, writes it to disk, and
 * runs validate-static.js on the result.
 *
 * @param {string} specInstructionsPath - absolute or relative path to spec-instructions.md
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - skip LLM call and file write, return mock result
 * @param {string} [options.repoRoot] - root of repo for resolving template paths (default: process.cwd())
 * @returns {Promise<{specPath: string, violations: string[], templateUsed: string, wordCount: number}>}
 */
async function generateSpec(specInstructionsPath, options) {
  const opts = options || {};
  const dryRun = opts.dryRun === true;
  const repoRoot = opts.repoRoot || process.cwd();

  if (!specInstructionsPath || typeof specInstructionsPath !== 'string') {
    throw new Error('generateSpec: specInstructionsPath is required and must be a string');
  }

  const absInstructionsPath = path.isAbsolute(specInstructionsPath)
    ? specInstructionsPath
    : path.join(repoRoot, specInstructionsPath);

  if (!fs.existsSync(absInstructionsPath)) {
    throw new Error(`generateSpec: spec-instructions.md not found at ${absInstructionsPath}`);
  }

  const instructionsContent = fs.readFileSync(absInstructionsPath, 'utf8');

  // Extract templateSpecId from the instructions file (line: `**Template spec:** `games/<id>/spec.md``)
  const templateMatch = instructionsContent.match(/\*\*Template spec:\*\*\s*`games\/([^/]+)\/spec\.md`/);
  const templateSpecId = templateMatch ? templateMatch[1] : null;

  let templateContent = '';
  let templateUsed = templateSpecId ? `games/${templateSpecId}/spec.md` : '(none)';

  if (templateSpecId) {
    const templatePath = path.join(repoRoot, 'games', templateSpecId, 'spec.md');
    if (fs.existsSync(templatePath)) {
      templateContent = fs.readFileSync(templatePath, 'utf8');
    }
  }

  // GEN-CR-005: Guard — if no templateSpecId or template file missing/empty, warn and abort.
  // Passing empty templateContent to the LLM causes it to invent CDN structure from scratch,
  // defeating the entire purpose of constrained spec generation.
  if (!templateSpecId || !templateContent.trim()) {
    const logger = require('./logger');
    logger.warn(
      'generateSpec: no templateSpecId found — cannot proceed without a template spec',
      { specInstructionsPath: absInstructionsPath, templateSpecId, templateContent: templateContent ? '(exists but empty)' : '(missing)' },
    );
    if (!dryRun) {
      throw new Error(
        `generateSpec: no template spec available for ${absInstructionsPath}. ` +
        `templateSpecId=${templateSpecId ?? 'null'}. ` +
        `A template spec (games/<id>/spec.md) is required to prevent LLM hallucination of CDN structure. ` +
        `Either add a templateSpecId to the skill definition in session-planner.js, or write the spec manually.`,
      );
    }
    return {
      specPath: null,
      violations: [],
      templateUsed: null,
      wordCount: 0,
      skipped: true,
      reason: 'no_template_available',
    };
  }

  // Determine output path: spec.md in same directory as spec-instructions.md
  const gameDir = path.dirname(absInstructionsPath);
  const specPath = path.join(gameDir, 'spec.md');

  if (dryRun) {
    return {
      specPath,
      violations: [],
      templateUsed,
      wordCount: 0,
    };
  }

  // ── LLM call ────────────────────────────────────────────────────────────────
  const { callLlm } = require('./llm');
  const model = process.env.RALPH_GEN_MODEL || 'claude-sonnet-4-6';

  const systemPrompt = [
    'You are adapting an approved Ralph pipeline game spec to a new variant.',
    '',
    'PRESERVE unchanged:',
    '- All CDN import blocks and ScreenLayout.inject() calls',
    '- All data-phase, data-testid, data-lives attribute names',
    '- All postMessage field names and phase transition logic',
    '- All WindowPackages.init() setup',
    '- PART-xxx sub-phase definitions and event wiring',
    '',
    'SUBSTITUTE per the manifest in spec-instructions.md:',
    '- Round data (numbers, problem instances, answer choices)',
    '- Context labels and introductory text',
    '- NCERT citation',
    '- Pedagogical rationale comment',
  ].join('\n');

  const userMessage = [
    '## Spec Instructions',
    '',
    instructionsContent,
    '',
    '---',
    '',
    '## Template Spec (preserve structure, substitute content per instructions above)',
    '',
    templateContent,
  ].join('\n');

  const prompt = `${systemPrompt}\n\n${userMessage}`;

  const generatedContent = await callLlm('generateSpec', prompt, model, {
    maxTokens: 16000,
    temperature: 0.3,
  });

  // Write spec.md
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(specPath, generatedContent, 'utf8');

  // Run validate-static on generated content
  const violations = runValidateStatic(generatedContent);

  const wordCount = generatedContent.split(/\s+/).filter(Boolean).length;

  return {
    specPath,
    violations,
    templateUsed,
    wordCount,
  };
}

// ─── generateSessionSpecs — run generateSpec for all games in a session ───────
/**
 * Reads session-plan.md from sessionDir to find all game directories,
 * then calls generateSpec() for each one that has a spec-instructions.md.
 *
 * @param {string} sessionDir - path to the session directory (contains session-plan.md)
 * @param {object} [options] - passed through to generateSpec (dryRun, repoRoot, etc.)
 * @returns {Promise<Array<{gameDir: string, specPath: string, violations: string[], templateUsed: string, wordCount: number}>>}
 */
async function generateSessionSpecs(sessionDir, options) {
  if (!sessionDir || typeof sessionDir !== 'string') {
    throw new Error('generateSessionSpecs: sessionDir is required and must be a string');
  }

  const opts = options || {};
  const repoRoot = opts.repoRoot || process.cwd();

  const absSessionDir = path.isAbsolute(sessionDir) ? sessionDir : path.join(repoRoot, sessionDir);

  if (!fs.existsSync(absSessionDir)) {
    throw new Error(`generateSessionSpecs: sessionDir not found at ${absSessionDir}`);
  }

  const sessionPlanPath = path.join(absSessionDir, 'session-plan.md');
  if (!fs.existsSync(sessionPlanPath)) {
    throw new Error(`generateSessionSpecs: session-plan.md not found in ${absSessionDir}`);
  }

  // Find all game-N-<gameId> subdirectories
  const entries = fs.readdirSync(absSessionDir, { withFileTypes: true });
  const gameDirs = entries
    .filter((e) => e.isDirectory() && /^game-\d+-.+/.test(e.name))
    .sort((a, b) => {
      // Sort by game number (game-1-... before game-2-...)
      const numA = parseInt(a.name.split('-')[1], 10);
      const numB = parseInt(b.name.split('-')[1], 10);
      return numA - numB;
    })
    .map((e) => path.join(absSessionDir, e.name));

  const results = [];

  for (const gameDir of gameDirs) {
    const specInstructionsPath = path.join(gameDir, 'spec-instructions.md');
    if (!fs.existsSync(specInstructionsPath)) {
      // No spec-instructions.md in this game dir — skip
      continue;
    }

    const result = await generateSpec(specInstructionsPath, opts);
    results.push({ gameDir, ...result });
  }

  return results;
}

// ─── planSessionFromObjective — main entry point (Steps 1 → 2 → 3 → write) ───
/**
 * Full pipeline: parseGoal → researchCurriculum → planSession → writeSessionDirectory
 *
 * @param {string} objectiveText - teacher's free-text learning objective
 * @param {object|null} [researchContextOverride] - if provided, skip researchCurriculum and use this directly
 * @param {object} [tools] - injectable tool functions; passed through to researchCurriculum
 * @param {object} [options] - additional options
 * @param {object} [options.parsedGoalOverride] - if provided, skip parseGoal() LLM call and use this directly (for testing)
 * @param {string} [options.outputDir] - override output directory for writeSessionDirectory
 * @returns {Promise<{parsedGoal, sessionPlan, sessionId, outputPath, filesWritten}>}
 */
async function planSessionFromObjective(objectiveText, researchContextOverride, tools, options) {
  if (!objectiveText || typeof objectiveText !== 'string' || !objectiveText.trim()) {
    throw new Error('planSessionFromObjective: objectiveText is required and must be a non-empty string');
  }

  const opts = options || {};

  // Step 1: Parse goal — skip with override for deterministic testing
  const parsedGoal = opts.parsedGoalOverride || (await parseGoal(objectiveText));

  // Step 2: Curriculum Research — skip if caller provides override (e.g. tests or pre-fetched data)
  let researchContext = researchContextOverride || null;
  if (!researchContext) {
    try {
      researchContext = await researchCurriculum(parsedGoal, tools);
    } catch (err) {
      // Non-fatal: continue with null research context so session directory is still written
      const logger = require('./logger');
      logger.warn('planSessionFromObjective: researchCurriculum failed — proceeding without research data', {
        error: err && err.message,
        topic: parsedGoal.topic,
      });
      researchContext = null;
    }
  }

  const sessionPlan = planSession(parsedGoal, researchContext || null);

  if (sessionPlan.error) {
    return { error: sessionPlan.error, message: sessionPlan.message, parsedGoal };
  }

  const result = await writeSessionDirectory(sessionPlan, researchContext, opts.outputDir ? { outputDir: opts.outputDir } : undefined);

  return {
    parsedGoal,
    sessionPlan,
    ...result,
  };
}

module.exports = {
  buildSessionPlan,
  normalizeConcept,
  classifyObjective,
  CONCEPT_GRAPH,
  parseGoal,
  getResearchPrompt,
  buildResearchContext,
  researchCurriculum,
  planSession,
  generateSessionId,
  writeSessionDirectory,
  planSessionFromObjective,
  generateSpec,
  generateSessionSpecs,
};

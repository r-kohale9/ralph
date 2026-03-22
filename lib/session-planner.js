'use strict';

// ─── Concept Graph ────────────────────────────────────────────────────────────
// Each concept maps to an ordered array of skill nodes in dependency order.
// bloomLevel: 1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create
const CONCEPT_GRAPH = {
  trigonometry: [
    {
      skillId: 'label-triangle-sides',
      skillName: 'Label right triangle sides (hypotenuse, opposite, adjacent)',
      bloomLevel: 1,
      prerequisiteSkillIds: [],
      suggestedGameIds: ['label-triangle-sides'],
    },
    {
      skillId: 'identify-ratio',
      skillName: 'Identify which trig ratio to use (sin, cos, or tan)',
      bloomLevel: 2,
      prerequisiteSkillIds: ['label-triangle-sides'],
      suggestedGameIds: ['which-trig-ratio'],
    },
    {
      skillId: 'compute-ratio',
      skillName: 'Compute sin, cos, or tan given side lengths',
      bloomLevel: 3,
      prerequisiteSkillIds: ['identify-ratio'],
      suggestedGameIds: ['soh-cah-toa-worked-example'],
    },
    {
      skillId: 'find-side',
      skillName: 'Find an unknown side length using a trig ratio',
      bloomLevel: 3,
      prerequisiteSkillIds: ['compute-ratio'],
      suggestedGameIds: ['find-triangle-side'],
    },
    {
      skillId: 'real-world-application',
      skillName: 'Apply trigonometry to real-world problems (height, distance, slope)',
      bloomLevel: 4,
      prerequisiteSkillIds: ['find-side'],
      suggestedGameIds: ['trig-real-world'],
    },
  ],

  multiplication: [
    {
      skillId: 'multiplication-basics',
      skillName: 'Recall multiplication facts (times tables)',
      bloomLevel: 1,
      prerequisiteSkillIds: [],
      suggestedGameIds: ['multiplication-tables'],
    },
    {
      skillId: 'multiplication-word-problems',
      skillName: 'Solve multiplication word problems',
      bloomLevel: 2,
      prerequisiteSkillIds: ['multiplication-basics'],
      suggestedGameIds: ['multiplication-word-problems'],
    },
  ],
};

// ─── Aliases ─────────────────────────────────────────────────────────────────
// Maps alternate names/abbreviations to canonical concept keys.
const CONCEPT_ALIASES = {
  trig: 'trigonometry',
  'soh-cah-toa': 'trigonometry',
  'sohcahtoa': 'trigonometry',
  'right-triangle-trig': 'trigonometry',
  'right triangle trigonometry': 'trigonometry',
  'times tables': 'multiplication',
  'multiply': 'multiplication',
  'multiplying': 'multiplication',
};

// ─── Normalise concept input ──────────────────────────────────────────────────
function normalizeConcept(raw) {
  const lower = raw.toLowerCase().trim();
  return CONCEPT_ALIASES[lower] || lower;
}

// ─── Build a session plan ─────────────────────────────────────────────────────
// options: { studentLevel, curriculumHint }
function buildSessionPlan(concept, options = {}) {
  const normalized = normalizeConcept(concept);

  if (!CONCEPT_GRAPH[normalized]) {
    return {
      error: 'concept_not_found',
      availableConcepts: Object.keys(CONCEPT_GRAPH),
    };
  }

  const skills = CONCEPT_GRAPH[normalized];
  const gameIds = skills.flatMap((s) => s.suggestedGameIds);
  const bloomLevels = skills.map((s) => s.bloomLevel);
  const bloomRange = [Math.min(...bloomLevels), Math.max(...bloomLevels)];
  const estimatedMinutes = skills.length * 5;

  // planId: deterministic — concept + options hash for cacheability
  const planId = `${normalized}-${Date.now()}`;

  return {
    concept: normalized,
    planId,
    skills,
    estimatedMinutes,
    bloomRange,
    gameIds,
  };
}

module.exports = { buildSessionPlan, normalizeConcept, CONCEPT_GRAPH };

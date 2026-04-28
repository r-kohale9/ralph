# Skill: Gauge

## Purpose

Query gameplay data via the Gameplay Data MCP, analyze student performance on a deployed game, and produce a structured insight report with specific, actionable recommendations -- answering "how are students doing?" and "what should change?"

## When to use

After students have played a deployed game. Creator wants to understand what's working.

## Owner

**Maintainer:** Analytics slot
**Deletion trigger:** When a real-time analytics dashboard replaces manual gauge reports for all 5 key questions.

## Reads

- `skills/data-contract.md` -- schemas for recordAttempt, game_complete, trackEvent (what fields exist to query) — **ALWAYS**
- `skills-taxonomy.md` sections 9.1 (attempt schema), 9.2 (session-level data), 9.3 (abandonment), 9.4 (cross-game) — **ON-DEMAND** (only for cross-game comparisons)
- `skills/deployment.md` output -- `publishedGameId` and `contentSets` (what to query) — **ALWAYS**

## Input

- Published game ID (`publishedGameId` from deployment)
- Content set ID(s) to analyze (or "all" for cross-set comparison)
- Time range (default: last 7 days)
- Minimum sample size threshold (default: 30 sessions)

## Output

A structured GAUGE_REPORT with findings for each of the 5 key questions, plus a prioritized recommendation list. Consumed by the creator (human) and by `iteration.md` (next skill in the chain).

```json
{
  "gameId": "<publishedGameId>",
  "contentSetId": "<analyzed set or 'all'>",
  "period": "2026-03-28 to 2026-04-04",
  "totalSessions": 142,
  "questions": {
    "lowestAccuracyRound": { ... },
    "topMisconception": { ... },
    "learningVsGuessing": { ... },
    "difficultyCurve": { ... },
    "abandonmentRate": { ... }
  },
  "recommendations": [ ... ]
}
```

## Procedure

### Prerequisites

Before running any queries, check data sufficiency:

1. Query total session count for the game + content set + time range.
2. If total sessions < minimum sample size (default 30), report "Insufficient data" with the actual count. Do not draw conclusions from small samples -- they are noise, not signal.
3. If data is sufficient, proceed with the 5 key questions below.

---

### Question 1: Which round has the lowest accuracy?

**Why it matters:** A single hard round can cause cascading failure -- students lose lives, lose confidence, and abandon. Identifying the accuracy floor pinpoints where content needs adjustment.

**MCP query:**

```
Query: Per-round accuracy for game <publishedGameId>, content set <contentSetId>, last 7 days.

SELECT
  a.round_number,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN a.correct = true THEN 1 ELSE 0 END) as correct_count,
  ROUND(100.0 * SUM(CASE WHEN a.correct = true THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy_pct,
  AVG(a.response_time_ms) as avg_response_time_ms
FROM attempts a
JOIN sessions s ON a.session_id = s.id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY a.round_number
ORDER BY a.round_number;
```

**How to interpret:**

| Accuracy | Interpretation | Action |
|----------|---------------|--------|
| > 80% | Round is well-calibrated. Students get it. | No change needed. |
| 60-80% | Appropriately challenging. Some struggle is healthy. | Monitor. If it is the last round, this is fine. If early round, may be a difficulty spike. |
| 40-60% | Too hard for this position. Students are failing more than succeeding. | If early/mid round: swap in easier content. If final round: acceptable as a stretch challenge. |
| < 40% | Broken. Either the question is unfair, the content is ambiguous, or a misconception is not addressed by prior rounds. | Immediate action: inspect the question, check for ambiguity, check if prerequisite knowledge was scaffolded. |

**Also check:** If accuracy is high (>90%) on ALL rounds, the game may be too easy. Students are not being challenged. Consider deploying the "hard" content set.

**Key signal:** Compare the lowest-accuracy round to the rounds before and after it. A sudden drop (e.g., round 4 at 35% when rounds 3 and 5 are at 75%) indicates a difficulty spike -- the round is too hard for its position in the sequence, not necessarily too hard overall.

**Set-aware analytics:** When a game uses round-set cycling (see code-patterns.md `getRounds` + `restartGame`), round `id` values are prefixed by set letter (`A_r1_…`, `B_r1_…`, `C_r1_…`). To segment per-round accuracy by set, group attempts on the prefix of `question_id`. No query changes are required for existing analytics — segmentation is an optional refinement. A student who played Set A on their first attempt and Set B on retry will have attempts for both sets in the same session; `setIndex` is not in the attempt payload, so the prefix is the only signal.

---

### Question 2: Which misconception is most common?

**Why it matters:** If 70% of wrong answers on round 7 map to "additive-reasoning," the game is revealing a specific gap in understanding. This is the most actionable data point -- it tells you exactly what to teach differently.

**MCP query:**

```
Query: Top misconceptions for game <publishedGameId>, content set <contentSetId>, last 7 days.

SELECT
  a.misconception_tag,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT s.id) as affected_sessions,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct_of_all_wrong,
  ARRAY_AGG(DISTINCT a.round_number ORDER BY a.round_number) as rounds_affected
FROM attempts a
JOIN sessions s ON a.session_id = s.id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days'
  AND a.correct = false
  AND a.misconception_tag IS NOT NULL
GROUP BY a.misconception_tag
ORDER BY occurrence_count DESC
LIMIT 10;
```

**How to interpret:**

| Pattern | Interpretation | Action |
|---------|---------------|--------|
| One misconception dominates (>50% of wrong answers) | A single gap is driving most failures. Focused intervention will have high impact. | Add scaffolding before the first round that triggers this misconception. Or add a worked example. |
| Misconceptions spread evenly across many tags | No single gap dominates. Students are making varied errors. | The content may be generally too hard, or the game is testing multiple concepts and students are shaky on all of them. |
| Same misconception appears across many rounds | The game is not correcting the misconception -- feedback is not working. | Improve the wrong-answer feedback for this misconception. Make it explanation-specific, not generic ("Try again"). |
| `misconception_tag` is mostly null | The game is not tagging wrong answers with misconceptions. | This is a game bug (data-contract violation). The game needs to map wrong-answer choices to misconception tags from the spec. Fix the game, not the content. |

---

### Question 3: Are students learning or guessing?

**Why it matters:** High accuracy + fast response time could mean mastery. Or it could mean the distractors are obviously wrong and students are picking the only plausible answer without thinking. This question separates real learning from pattern-matching.

**MCP query:**

```
Query: Response time vs accuracy correlation for game <publishedGameId>, content set <contentSetId>, last 7 days.

SELECT
  a.round_number,
  AVG(CASE WHEN a.correct = true THEN a.response_time_ms END) as avg_correct_time_ms,
  AVG(CASE WHEN a.correct = false THEN a.response_time_ms END) as avg_wrong_time_ms,
  ROUND(100.0 * SUM(CASE WHEN a.correct = true THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy_pct,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a.response_time_ms) as median_response_ms
FROM attempts a
JOIN sessions s ON a.session_id = s.id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY a.round_number
ORDER BY a.round_number;
```

**How to interpret:**

| Pattern | Interpretation | Action |
|---------|---------------|--------|
| Correct answers take longer than wrong answers | Students are thinking when they get it right, and guessing when they get it wrong. This is healthy learning. | No change needed. The game is working. |
| Correct answers are very fast (<2s) AND accuracy is high (>85%) | Students may be guessing or the distractors are too obvious. The correct answer stands out without thinking. | Improve distractors. Make wrong options more plausible. This is a content-only change. |
| Correct answers are very fast AND accuracy decreases over rounds | Students are rushing. Early rounds feel easy so they build a fast-clicking habit, then fail on harder rounds. | Add a minimum response delay or slow-down mechanic. Or reorder content so difficulty ramps from round 1. |
| All response times are very long (>10s) AND accuracy is low | Students are stuck. They are spending time but not finding the answer. | Questions may be ambiguous or too hard. Check the specific questions in the low-accuracy rounds. |
| Response times decrease across rounds for correct answers | Students are learning the pattern and getting faster. This is the ideal signal. | The game is working as intended. Consider adding a timed challenge mode for advanced students. |

**Also check:** If median response time is under 1 second across the board, the game may have a UI issue where students are accidentally tapping (double-tap, misfire on mobile). This is a game bug, not a content issue.

---

### Question 4: Is the difficulty curve right?

**Why it matters:** Games should get progressively harder. If round 2 is harder than round 8, the difficulty curve is broken -- students hit a wall early and never recover.

**MCP query:**

```
Query: Per-round accuracy trend for game <publishedGameId>, content set <contentSetId>, last 7 days.

-- Reuse the per-round accuracy from Question 1, but analyze the TREND.
SELECT
  a.round_number,
  ROUND(100.0 * SUM(CASE WHEN a.correct = true THEN 1 ELSE 0 END) / COUNT(*), 1) as accuracy_pct,
  a.difficulty_level,
  AVG(a.response_time_ms) as avg_response_time_ms
FROM attempts a
JOIN sessions s ON a.session_id = s.id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY a.round_number, a.difficulty_level
ORDER BY a.round_number;
```

**How to interpret:**

Plot accuracy_pct by round_number. The ideal curve is:

```
Round:    1    2    3    4    5    6    7    8    9    10
Ideal:   95%  90%  85%  80%  75%  70%  65%  60%  55%  50%
```

A gradual decline is healthy -- each round is slightly harder. What to look for:

| Pattern | Interpretation | Action |
|---------|---------------|--------|
| Smooth downward slope | Difficulty is well-calibrated. Students are challenged progressively. | No change needed. |
| Flat line (all rounds ~same accuracy) | No difficulty progression. The game is equally hard (or easy) throughout. | Reorder content: put easier questions first, harder ones last. This is a content-only change. |
| Sudden cliff (e.g., round 5 drops 30% from round 4) | A difficulty spike. The jump between rounds is too large. | Insert a bridge question between the easy and hard sections. Or swap the hard question to a later position. |
| U-shape (high-low-high) | Middle rounds are hardest, end rounds are easiest. Inverted difficulty at the end. | Reorder content to put the hard middle rounds at the end. |
| Accuracy INCREASES over rounds | Later rounds are easier than earlier rounds. The game gets easier as it goes. | Reverse the content order, or regenerate content with proper difficulty staging. |

**Key check:** Compare `difficulty_level` from the content set with actual `accuracy_pct`. If `difficulty_level: 3` (hard) rounds have higher accuracy than `difficulty_level: 1` (easy) rounds, the difficulty labels are wrong -- the content creator's idea of "hard" does not match what students find hard. Relabel or regenerate.

---

### Question 5: What percentage of students abandon before finishing?

**Why it matters:** A student who quits at round 5 of 10 had a bad experience. If 40% of students abandon, the game is failing at its core job. Abandonment is the strongest signal of a broken game -- stronger than low accuracy (students can fail and still finish).

**MCP query:**

```
Query: Completion rate and abandonment distribution for game <publishedGameId>, content set <contentSetId>, last 7 days.

-- Completion rate
SELECT
  COUNT(*) as total_sessions,
  SUM(CASE WHEN m.rounds_played = m.total_rounds THEN 1 ELSE 0 END) as completed_sessions,
  ROUND(100.0 * SUM(CASE WHEN m.rounds_played = m.total_rounds THEN 1 ELSE 0 END) / COUNT(*), 1) as completion_rate_pct,
  SUM(CASE WHEN m.rounds_played < m.total_rounds THEN 1 ELSE 0 END) as abandoned_sessions
FROM sessions s
JOIN session_metrics m ON s.id = m.session_id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days';

-- Where do they abandon? (last round played)
SELECT
  m.rounds_played as last_round_played,
  COUNT(*) as abandon_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct_of_abandonments,
  AVG(m.accuracy) as avg_accuracy_at_abandon
FROM sessions s
JOIN session_metrics m ON s.id = m.session_id
WHERE s.game_id = '<publishedGameId>'
  AND s.content_set_id = '<contentSetId>'
  AND s.created_at >= NOW() - INTERVAL '7 days'
  AND m.rounds_played < m.total_rounds
GROUP BY m.rounds_played
ORDER BY m.rounds_played;
```

**How to interpret:**

| Completion rate | Interpretation | Action |
|----------------|---------------|--------|
| > 85% | Healthy. Most students finish. | No action needed. |
| 70-85% | Some attrition. Acceptable if it correlates with lives-based game-over (intended mechanic). | Check: are abandonments game-over exits or voluntary quits? If game-over, the lives system is working. If voluntary, investigate the round where they quit. |
| 50-70% | Concerning. Half the students are not finishing. | Cross-reference with Question 1 (lowest-accuracy round). If most abandon at or after the hardest round, the content is the problem. If they abandon evenly, the game itself is not engaging enough. |
| < 50% | Critical. The game is broken or deeply unengaging. | Immediate investigation. Play the game yourself at the deployed URL. Look for: UI bugs, confusing instructions, broken feedback, impossibly hard content, or a flow that gets stuck. |

**Key signal:** The `last_round_played` distribution reveals WHERE students give up. If most abandon at round 1-2, the problem is onboarding (confusing start screen, unclear instructions, broken UI). If most abandon mid-game, the problem is difficulty or engagement. If most abandon at the final round, there may be a bug preventing game completion.

**Also cross-reference with accuracy at abandonment:** If `avg_accuracy_at_abandon` is low (<30%), students are quitting because they are failing. If it is moderate (50-70%), students are quitting because they are bored or the game is too long. Different root causes require different fixes.

---

### Synthesis: Produce the GAUGE_REPORT

After answering all 5 questions, synthesize findings into a prioritized recommendation list.

**Priority framework:**

| Priority | Criteria | Example |
|----------|---------|---------|
| P0 -- Fix now | Abandonment > 50%, OR accuracy < 30% on any round, OR game-breaking bug found | "Round 3 has 22% accuracy and is causing 60% of abandonments" |
| P1 -- Fix soon | Difficulty curve broken, OR dominant misconception not addressed, OR completion < 70% | "Additive-reasoning misconception accounts for 65% of wrong answers but feedback does not explain it" |
| P2 -- Improve | Guessing signals, flat difficulty, minor curve issues | "Response times suggest students are not thinking on rounds 1-3 -- distractors too obvious" |
| P3 -- Monitor | Metrics are acceptable but worth watching | "Completion rate is 78% -- healthy but trending down from 85% last week" |

---

## When to Recommend Each Change Type

The gauge report must end with a specific recommendation type for each finding. There are three types, and choosing the wrong one wastes time (rebuilding when a content swap would suffice) or fails to fix the problem (swapping content when the game logic is broken).

### Content-only change (fast -- minutes, no rebuild)

**When:** The game mechanics work. The HTML is fine. The problem is what questions are being asked, not how the game works.

| Signal | Content change |
|--------|---------------|
| One round has low accuracy but surrounding rounds are fine | Swap that round's question for an easier one |
| Difficulty curve is flat or inverted | Reorder rounds by difficulty |
| Dominant misconception not addressed | Add scaffolding questions before the hard rounds |
| Distractors are too obvious (guessing signal) | Improve distractors with more plausible wrong answers |
| Game is too easy (all rounds >90%) | Deploy the "hard" content set |
| Game is too hard (all rounds <50%) | Deploy the "easy" content set |

**How:** Create a new content set via Core API. The game HTML stays the same. Students get the new content next time they play.

### Spec change (medium -- hours, requires rebuild)

**When:** The game structure, mechanics, or flow need to change. Content alone cannot fix the problem.

| Signal | Spec change |
|--------|------------|
| Students abandon at round 1-2 (onboarding failure) | Rewrite start screen instructions, add tutorial round |
| Wrong-answer feedback is generic ("Try again") for a misconception that needs explanation | Add misconception-specific feedback rules to spec |
| Lives system is too punitive (3 lives, hard game = game-over by round 4) | Change to 5 lives or no-penalty mode |
| Timer is too short for the complexity of questions | Remove timer or increase time limit |
| Game needs a hint system that does not exist | Add hint mechanic to spec |

**How:** Update `spec.md`, go back to Phase 1 (spec review + plan + build + test + deploy). The full pipeline runs again.

### Full rebuild (slow -- hours, new HTML)

**When:** The game has fundamental issues that cannot be fixed by changing content or tweaking the spec.

| Signal | Full rebuild |
|--------|-------------|
| Game has JS errors on load (health check failing) | Rebuild with updated CDN packages |
| Game-over path does not send game_complete (data-contract violation) | Rebuild -- this is a code bug |
| Interaction type is wrong (spec says drag-and-drop but game is MCQ) | Rebuild from corrected spec |
| Game is fundamentally unengaging despite correct content | Rebuild with different archetype |

**How:** Full Phase 1 + Phase 2 cycle. This is the most expensive option. Only recommend when the other two cannot work.

---

## Output Format

```
GAUGE_REPORT:
{
  "gameId": "scale-it-up",
  "contentSetId": "cs-medium-456",
  "period": "2026-03-28 to 2026-04-04",
  "totalSessions": 142,
  "sampleSufficient": true,
  "questions": {
    "lowestAccuracyRound": {
      "round": 7,
      "accuracy": 34,
      "avgResponseTimeMs": 8200,
      "context": "Rounds 6 and 8 are at 72% and 68%. Round 7 is a 38-point cliff."
    },
    "topMisconception": {
      "tag": "additive-reasoning",
      "occurrences": 89,
      "pctOfAllWrong": 62,
      "roundsAffected": [5, 7, 9],
      "context": "Students are adding instead of multiplying in ratio problems. Feedback says 'Incorrect' without explaining the multiplicative relationship."
    },
    "learningVsGuessing": {
      "verdict": "learning",
      "correctAvgTimeMs": 4200,
      "wrongAvgTimeMs": 2100,
      "context": "Correct answers take 2x longer than wrong answers -- students are thinking when they get it right and guessing when they get it wrong. Healthy pattern."
    },
    "difficultyCurve": {
      "shape": "cliff-at-7",
      "description": "Smooth decline rounds 1-6 (95% to 72%), cliff at round 7 (34%), partial recovery rounds 8-9 (68%, 55%).",
      "context": "Round 7 introduces three-digit ratios with no bridge from the two-digit ratios in round 6."
    },
    "abandonmentRate": {
      "completionPct": 61,
      "totalAbandoned": 55,
      "peakAbandonRound": 7,
      "avgAccuracyAtAbandon": 28,
      "context": "55 of 142 students quit. 38 of those quit at or after round 7. They had 28% accuracy at the point of quitting -- they were failing and giving up."
    }
  },
  "recommendations": [
    {
      "priority": "P0",
      "finding": "Round 7 has 34% accuracy and causes 69% of abandonments",
      "action": "Replace round 7 with an easier bridge question (two-digit to three-digit ratio with a worked hint)",
      "changeType": "content-only",
      "effort": "minutes"
    },
    {
      "priority": "P1",
      "finding": "Additive-reasoning misconception is 62% of all wrong answers but feedback is generic",
      "action": "Update spec to add misconception-specific feedback: 'You added the numbers. In a ratio, we multiply. If the ratio is 1:3, multiply by 3, not add 3.'",
      "changeType": "spec-change",
      "effort": "hours"
    },
    {
      "priority": "P2",
      "finding": "Difficulty curve has a cliff at round 7 with no bridge",
      "action": "Insert a medium-difficulty bridge question at position 6 and move current round 7 to position 8",
      "changeType": "content-only",
      "effort": "minutes"
    }
  ]
}
```

## Constraints

- **CRITICAL — Never draw conclusions from fewer than 30 sessions.** Small samples produce noise that looks like signal. Report "Insufficient data" and wait.
- **CRITICAL — Never recommend a full rebuild when a content change would fix it.** Rebuilds cost hours. Content swaps cost minutes. Always try the cheapest fix first.
- **CRITICAL — Never ignore abandonment data.** A game with 90% accuracy but 40% completion is worse than a game with 60% accuracy and 95% completion. Students who quit learned nothing.
- **STANDARD — Always cross-reference questions.** Low accuracy on round 7 (Q1) + additive-reasoning misconception on round 7 (Q2) + abandonment spike at round 7 (Q5) = one root cause, one fix. Do not list these as three separate problems.
- **STANDARD — Always report the data, not just the interpretation.** The creator makes the final decision. Give them the numbers so they can disagree with your interpretation.
- **STANDARD — misconception_tag=null on wrong answers is a data gap, not a finding.** If most wrong answers lack a misconception tag, the game is not tagging them. Flag this as a game bug to fix before gauging again.

## Defaults

- Time range: last 7 days.
- Minimum sample size: 30 sessions.
- If no content set ID is specified: analyze the default content set (from deployment step 3).
- If multiple content sets are specified: produce one GAUGE_REPORT per set, then a comparison summary.
- Star threshold for "game is too easy": average stars > 2.7 across all sessions.
- Star threshold for "game is too hard": average stars < 1.0 across all sessions.

## Anti-patterns

- **Running gauge queries on day 1 with 5 sessions and drawing conclusions.**

  **Bad:** 5 sessions played. Round 3 has 20% accuracy. Report says "Round 3 is broken, replace the question immediately."

  **Good:** 5 sessions played. Report says "Insufficient data (5/30 minimum sessions). No conclusions drawn. Re-run gauge after more students have played."

- **Treating all low-accuracy rounds as content problems.**

  **Bad:** Round 7 has 25% accuracy. Recommendation: "Replace round 7 with an easier question."

  **Good:** Inspecting round 7's actual question first. Discovering the correct answer option's click handler is broken (game bug). Recommendation: "Fix the option button event handler in the HTML, then re-gauge."

- **Recommending spec changes for every finding.**

  **Bad:** Distractors are too obvious on rounds 1-3. Recommendation: "Update spec to add better misconception design and rebuild."

  **Good:** Recommendation: "Create a new content set with more plausible distractors for rounds 1-3. This is a content-only change -- no rebuild needed."

- **Ignoring response time data.** Accuracy alone does not distinguish learning from guessing. A round with 85% accuracy and 800ms average response time is probably too easy (students are not thinking). A round with 85% accuracy and 6000ms average response time is well-calibrated (students are working for the answer).

- **Gauging a game that failed health check.** If the deployment health check failed, fix the game first. Gauging a broken game produces garbage data.

- **Reporting raw numbers without context.**

  **Bad:** "Round 7 accuracy is 34%."

  **Good:** "Round 7 accuracy is 34% -- a 38-point drop from round 6 (72%) -- and 69% of abandonments happen at or after round 7."

# Skill: Deployment

## Purpose

Upload a tested, approved game to GCP, register it with the Core API, create content sets, run a health check on the live URL, and output the game link and content set links so the creator can share with students.

## When to use

After game passes testing and review. Uploads, registers, creates content sets, verifies.

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When deployment is fully automated via CI/CD pipeline that handles registration, content sets, and health checks without LLM involvement.

## Reads

- `skills/data-contract.md` -- schemas for game_ready, game_init, game_complete (health check criteria) — **ALWAYS**
- `skills-taxonomy.md` sections 7.1 (upload + registration), 7.2 (health check), 7.3 (versioning) — **ON-DEMAND** (only for non-standard deployment flows)
- Legacy pipeline publish flow (previously `pipeline-v2/pipeline.js` `buildContentGenPrompt`) — **ON-DEMAND** (only when debugging API call failures; code lives outside alfred/)

## Input

- Approved game HTML file (`index.html`) -- must have passed game-testing and game-review
- Game spec (`spec.md`) -- for metadata (title, description, concepts, grade, difficulty)
- Game ID (slug, e.g. `scale-it-up`)
- Build ID (for versioning)

## Output

A PUBLISH_RESULT block containing:

```json
{
  "publishedGameId": "<id from Core API registration>",
  "artifactUrl": "<CDN URL where HTML is hosted>",
  "gameLink": "https://learn.mathai.ai/game/<publishedGameId>/<primaryContentSetId>",
  "contentSets": [
    { "id": "<contentSetId>", "name": "<set name>", "difficulty": "easy|medium|hard", "grade": 5, "valid": true }
  ],
  "inputSchemaProps": 4,
  "healthCheck": { "passed": true, "checks": { "pageLoads": true, "noJsErrors": true, "gameReadyFires": true, "viewportCorrect": true } }
}
```

The next skill in the chain (`gauge.md`) reads `publishedGameId` and `contentSets` to know what to query.

## Procedure

### Step 1: Extract inputSchema from HTML

Read the game's `index.html` and extract the content structure the game expects via `postMessage` `game_init`.

1. Find the `fallbackContent` object in the HTML source. This is the canonical shape.
2. Find the `handlePostMessage` / `game_init` handler to confirm what fields it reads from `event.data.data.content`.
3. Generate a JSON Schema (draft-07) that matches `fallbackContent` exactly:
   - Every top-level field becomes a required property.
   - Arrays describe their item schema from the actual objects in fallbackContent.
   - Preserve types, nesting, and field names exactly.
4. Save to `inputSchema.json` alongside the game HTML.

**Validation:** The fallbackContent object itself must validate against the generated schema. If it does not, the schema is wrong.

### Step 1.5: Author the `llm_readable` game brief

Write a JSON brief that lets **any LLM fully understand this game and its
questions without ever seeing its HTML** — detailed enough that, reading only
your brief, it could **reconstruct a faithful, representative question/round** of
the game. This is general-purpose game understanding: report generation, content
generation, tutoring, analytics, and evaluation are all consumers, so don't tune
the brief to any single one. Derive it from the spec (`spec.md`) and the game
HTML. It is stored on the game row (`core.games.llm_readable`, JSONB) and
surfaced by the worksheet `syncState` API (`worksheet_llm_readable_json`).

**There is no fixed schema.** Pick whatever JSON structure best describes *this*
game — invent the keys and nesting that fit its mechanics. Do not force every
game into the same shape; a drag-and-drop sorting game and a timed mental-math
drill should look different.

Be exhaustive and concrete. Whatever structure you choose, the brief should make
the following recoverable:

- **What it is** — the game in 1–2 sentences and the concepts/skills it teaches.
- **What the player sees and does** — the core interaction, screens, rounds,
  lives, timers, hints.
- **How questions are generated** — the rules a new round obeys: number ranges
  and constraints, how pairs/options/distractors are chosen, difficulty
  progression across rounds/levels/sets. This is what makes reconstruction
  possible — be precise about the generation logic, not just the surface.
- **Scoring** — how stars/score are earned and what separates a high score from
  a low one.
- **Misconceptions / error types** the game tracks, if any (e.g. the `kind` tags
  on distractors).
- **At least one fully worked example round** — actual numbers, the correct
  answer, and why the distractors are wrong.

**Hard rules:** describe only what the game *actually* does — never invent
mechanics it doesn't have. **Litmus test:** a competent LLM reading only this
object should be able to author a new round indistinguishable from the game's
real ones. This object is passed as `llmReadable` in the register call below.
(It is optional on the API, but every normal pipeline run must generate it.)

### Step 2: Register the game via Core API

Call the Core API to register the game. This creates the game entity, uploads the HTML artifact, and returns a publishedGameId + artifactUrl.

```javascript
const res = await fetch(CORE_API_URL + '/api/games/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + CORE_API_TOKEN
  },
  body: JSON.stringify({
    name: '<gameId>',
    version: '<version>-b<buildId>',
    metadata: {
      title: '<from spec>',
      description: '<from spec>',
      concepts: ['<concept tags from spec>'],
      difficulty: 'medium',
      estimatedTime: 300,
      minGrade: '<from spec>',
      maxGrade: '<from spec>',
      type: 'practice',
      maxStars: '<from spec — the Star denominator (y); default 3>'
    },
    capabilities: {
      tracks: ['accuracy', 'time', 'stars'],
      provides: ['score', 'stars']
    },
    inputSchema: '<generated schema from step 1>',
    llmReadable: '<llm_readable object from step 1.5>',
    artifactContent: '<full HTML string>',
    publishedBy: 'alfred-pipeline'
  })
});

const body = await res.json();
// body.data.id = publishedGameId
// body.data.artifactUrl = CDN URL
```

Extract `publishedGameId` and `artifactUrl` from the response.

`maxStars` is REQUIRED by `register_game` (the Core API rejects with `400 MISSING_MAXSTARS` when it's missing or not a non-negative number). Source it from the spec's "Star denominator (`y`)" line — default 3 when the spec doesn't declare a non-default value (per spec-creation rule for `y`). It is read back by `create_worksheet`/`edit_worksheet` to default any block referencing this gameId, so a wrong value here silently caps every future worksheet that uses this game.

**On failure:** If registration returns non-2xx, stop deployment. Log the full error response. Do not proceed to content set creation -- without a registered game, content sets have nowhere to attach. Report the failure to the creator with the exact API error.

### Step 2.5: Patch preview audio (TTS)

Per PART-039 § Audio URL Sources layer 1, the deployment pipeline is the owner of the build-time preview audio patch. Before creating content sets:

1. Read `previewAudioText` from the HTML's `fallbackContent`.
2. Call the TTS API to generate an mp3; upload to CDN; record the resulting URL.
3. Patch `fallbackContent.previewAudio` in the HTML with that CDN URL (overwrite `null` or prior value).
4. Re-upload the patched HTML to GCP Storage (same deploy path).
5. Also patch the `previewAudio` field in any content set payload created in Steps 3–4 so runtime `game_init` sends the same URL.

If `previewAudioText` is missing, log a WARN and leave `previewAudio: null` — the PreviewScreen component falls back to runtime TTS, and failing that, a 5s silent timer. Do not block deployment on missing audio text, but flag it back to spec-review.

### Step 3: Create default content set from fallbackContent

The default content set is MANDATORY. It uses the exact `fallbackContent` from the HTML, which is guaranteed to work because the game already runs with it.

```javascript
const res = await fetch(CORE_API_URL + '/api/content-sets/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + CORE_API_TOKEN
  },
  body: JSON.stringify({
    gameId: '<publishedGameId>',
    name: '<Game Title> -- Default',
    description: 'Baseline content set from fallbackContent',
    grade: '<from spec>',
    difficulty: 'medium',
    concepts: ['<from spec>'],
    content: '<exact fallbackContent object>',
    createdBy: 'alfred-pipeline'
  })
});
// Response: body.data.id = contentSetId, body.data.isValid = true/false
```

If `isValid` is false, something is fundamentally wrong -- the fallbackContent that the game already uses does not match the inputSchema. This means step 1 produced a bad schema. Go back and fix the inputSchema.

### Step 4: Create 2-5 additional content sets

Generate varied content sets beyond the default. Each must conform to the inputSchema from step 1.

**Three axes of variation:**

| Axis | How to vary | Example |
|------|------------|---------|
| **Difficulty** | Change number ranges, complexity, number of steps, distractor sophistication | Easy: single-digit numbers. Hard: three-digit with decimals. |
| **Theme** | Change surface context while keeping the same math | Cooking ratios vs sports statistics vs map scales |
| **Grade** | Adjust to different grade levels within the game's range | Grade 4: simpler vocabulary + smaller numbers. Grade 7: word problems + multi-step. |

**Rules for content set generation:**

1. Every content set must have at least as many rounds as `totalRounds` in the game (typically 9-10).
2. Every round must have all fields that the inputSchema requires -- no partial rounds.
3. `question_id` values must be unique and stable (e.g., `easy_r1_add_3_5`).
4. `misconception_tag` values on wrong-answer options must come from the spec's misconception taxonomy.
5. `correct_answer` / `correctOption` must be mathematically correct. Double-check every answer.
6. Difficulty must increase across rounds within a set (easy rounds first, hard rounds last).
7. Each set must be meaningfully different -- not just one number changed.

**Round sets within each content set**

Each uploaded content set must ALSO provide rounds for at least 3 `set` values matching the game's rotation expectation. Content sets and round sets are orthogonal: a host picks a content set (Easy/Hard/Themed) via URL; the runtime cycles through THAT content set's internal round sets on retry. Example: the "Cooking Theme" content set has its own Sets A/B/C (cooking-themed), and a student retrying inside that content set cycles A→B→C→A within cooking.

**Standalone games (`totalRounds: 1`) are exempt.** Each content set may contain a single round with no `set` key — there is no in-session rotation to seed.

Step 1's `inputSchema` derivation needs NO change — the schema is inferred directly from `fallbackContent`, so the new per-round `set` field is auto-included without any manual schema edits.

**Validation:** For each content set, validate it against the inputSchema before uploading. If it fails schema validation, fix it before calling the API.

**Recommended set distribution:**

| Set | Difficulty | Grade | Purpose |
|-----|-----------|-------|---------|
| Default | Medium | Spec grade | Baseline (from fallbackContent) |
| Set 2 | Easy | Spec grade - 1 | Scaffolding / struggling students |
| Set 3 | Hard | Spec grade + 1 | Challenge / advanced students |
| Set 4 | Medium | Spec grade | Different theme / surface context |
| Set 5 (optional) | Mixed | Spec grade | Assessment: random difficulty order |

Upload each via the same `/api/content-sets/create` endpoint as step 3.

**On failure:** If a content set fails validation (`isValid: false`), log the `validationErrors` from the response. Fix the content JSON and retry. Do not skip failed sets -- every planned set should either succeed or be reported as failed with a reason.

### Step 5: Run health check on deployed URL

After registration, the game is live at its `artifactUrl`. Verify it actually works using Playwright MCP.

**Health check procedure:**

1. **Page loads:** Navigate to `artifactUrl`. Expect HTTP 200 and a non-empty HTML document.
2. **No JS errors:** Listen for `console.error` and `pageerror` events. Zero errors expected during load.
3. **game_ready fires:** The game should emit `postMessage({ type: 'game_ready' })` within 10 seconds of page load. Listen for it.
4. **Correct viewport:** Verify `<meta name="viewport" content="width=device-width, initial-scale=1">` is present and the rendered viewport is mobile-sized (375x667 or similar).
5. **CDN packages load:** No "Packages failed to load" error in console. No white screen after 5 seconds.
6. **Start screen renders:** Take a screenshot. The start screen should be visible with game title, start button, and topic description.

**Health check result:**

```json
{
  "passed": true,
  "checks": {
    "pageLoads": true,
    "noJsErrors": true,
    "gameReadyFires": true,
    "viewportCorrect": true,
    "cdnPackagesLoad": true,
    "startScreenRenders": true
  },
  "screenshot": "<path to screenshot>",
  "errors": []
}
```

**On health check failure:**

| Failure | Likely cause | Action |
|---------|-------------|--------|
| Page does not load (non-200) | Registration failed silently, or CDN propagation delay | Wait 30 seconds and retry. If still failing, check `artifactUrl` manually. |
| JS errors on load | CDN package incompatibility or missing dependency | Do NOT deploy content sets. Return to game-building with the error. This is a game bug, not a deployment bug. |
| game_ready does not fire | Listener not registered, init crash before `game_ready`, OR boot-order violation (see [PART-008 § Boot ordering](../../parts/PART-008.md#boot-ordering)) — harness sends `game_init` against undefined refs and `setupGame()` crashes silently | Do NOT deploy content sets. Return to game-building. Verify validators in the `GEN-PM-READY*` family passed in Step 5. |
| Viewport wrong | Missing or malformed viewport meta tag | Minor issue. Log as warning. Game is playable but may render incorrectly on mobile. |
| White screen / CDN failure | CDN package URL changed or is down | Check CDN status. If CDN is down, this is not a game bug -- wait and retry. If URL changed, update the game HTML. |

### Step 6: Output game link + content set links

Produce the final PUBLISH_RESULT block.

The primary game link uses the medium-difficulty content set: `https://learn.mathai.ai/game/<publishedGameId>/<contentSetId>`

List all content sets with their individual links so the creator can:
- Share the easy set with struggling students
- Share the hard set with advanced students
- Share specific themed sets for different classroom contexts

Format:

```
PUBLISH_RESULT:
{
  "publishedGameId": "abc123",
  "artifactUrl": "https://storage.googleapis.com/.../index.html",
  "gameLink": "https://learn.mathai.ai/game/abc123/cs-medium-456",
  "contentSets": [
    { "id": "cs-default-001", "name": "Scale It Up -- Default", "difficulty": "medium", "grade": 5, "valid": true },
    { "id": "cs-easy-002", "name": "Scale It Up -- Easy", "difficulty": "easy", "grade": 4, "valid": true },
    { "id": "cs-hard-003", "name": "Scale It Up -- Hard", "difficulty": "hard", "grade": 6, "valid": true },
    { "id": "cs-theme-004", "name": "Scale It Up -- Cooking Theme", "difficulty": "medium", "grade": 5, "valid": true }
  ],
  "inputSchemaProps": 5,
  "healthCheck": { "passed": true, "checks": { "pageLoads": true, "noJsErrors": true, "gameReadyFires": true, "viewportCorrect": true, "cdnPackagesLoad": true, "startScreenRenders": true } }
}
```

## Updating an already-registered game (iteration / re-deploy)

When a game **already has a `publishedGameId`** (a prior deploy, or the iteration skill handing back a fixed build), do **not** call `register_game` again — that creates a second game entity. Use `update_game`, and **keep the `llm_readable` brief in sync with the change**.

### The golden rule

`llm_readable` is the only description of the game that downstream consumers (report generation, content generation, tutoring, analytics, evaluation) ever see — they never read the HTML. So **whenever the served game changes, the brief must change with it.** The Core API now enforces this on the two paths that change the served game: a version bump and an in-place `artifactUrl` swap both **reject without a fresh `llmReadable`**. Honour it as a process rule, not just an API constraint.

### `llm_readable` is replaced wholesale — read before you write

`update_game` does **not** merge the brief. It overwrites `core.games.llm_readable` with exactly the object you send, so a partial object silently drops every field you omit. To change one part of the brief you must send the **complete** updated object. That means the update is always **read → modify → write**:

1. **READ** — call `get_game` with the `gameId`. It returns the game's current `llmReadable` (plus `metadata`, `version`, `artifactUrl`). This is how you know the existing brief.

   ```
   mcp__mathai-core__get_game({ gameId: "<publishedGameId>" })
   // → { id, name, version, metadata, tags, isActive, artifactUrl, llmReadable }
   ```

2. **MODIFY** — diff what actually changed in the game (the rebuilt HTML / the spec edit that triggered this iteration) against the brief you just read, then edit that JSON object:
   - **No change** to what the brief describes (e.g. a tag or `isActive` flip, a copy tweak that doesn't touch mechanics/content rules) → leave the brief alone; don't pass `llmReadable` at all.
   - **Minimal change** (e.g. a number range widened, one distractor rule adjusted) → edit just those fields in the object you read; keep everything else byte-for-byte.
   - **Drastic change** (new mechanic, new round generation logic, changed scoring) → rewrite the affected sections. Re-apply the Step 1.5 litmus test: a competent LLM reading only the new brief could author a round indistinguishable from the game's real ones.

   Describe only what the game *actually* does now — never carry forward a mechanic the edit removed, and never invent one it didn't add.

3. **WRITE** — call `update_game` with the **complete** edited brief. Pick the mode that matches the change:

   | What changed | Call |
   |---|---|
   | Brief only (no code change), or metadata/tags | `update_game({ gameId, llmReadable, /* + metadata/tags if any */ })` — in-place |
   | Game code rebuilt to a new HTML file | `update_game({ gameId, newVersion, gameArtifactPath, changelog, llmReadable })` — version bump; **`llmReadable` required** |
   | Pointing at a different already-hosted HTML | `update_game({ gameId, artifactUrl, llmReadable })` — **`llmReadable` required** |

### Rules and edge cases

- **`null` / omitted both mean "no change."** Passing `llmReadable: null` does **not** clear the brief — the existing one is left untouched. A brief cannot be cleared via `update_game`; that's intentional (you should never have a registered game with no brief).
- **A version bump or `artifactUrl` change without `llmReadable` is rejected** (`400 MISSING_LLM_READABLE`). If you hit this, you skipped the READ/MODIFY steps — go back and refresh the brief.
- **`upload_game_folder` is the one path the API can't gate.** Re-uploading `index.html` to an already-registered game's path changes the served game with no `update_game` call. The response returns a `warning` when this happens; treat it as a hard prompt to run the read-modify-write flow above and `update_game` with a refreshed brief.
- **Content sets** are orthogonal to the brief. If the *content generation rules* changed, update the brief; if you also need new content, regenerate content sets per Steps 3–4. A pure content-set change with an unchanged game usually needs **no** brief update.

## Constraints

- **CRITICAL — Never deploy a game that has not passed game-testing and game-review.** Deployment is the final step, not a shortcut.
- **CRITICAL — On a re-deploy, never call `register_game` for an existing `publishedGameId`.** Use `update_game`, and refresh `llm_readable` via the read-modify-write flow whenever the served game changes.
- **CRITICAL — Never skip the default content set.** It is the only guaranteed-working content. Without it, the game link may render nothing.
- **CRITICAL — Never skip the health check.** A registered game that does not load is worse than no game -- it erodes trust.
- **CRITICAL — All content must be mathematically correct.** A content set with a wrong answer is worse than no content set. Double-check every `correct_answer` field.
- **CRITICAL — inputSchema must match fallbackContent exactly.** If the schema is looser or stricter than what the game actually reads, content sets will silently fail at runtime.
- **STANDARD — Content sets must have stable question_ids.** The gauge skill uses `question_id` to track per-question performance across sessions. Random IDs break cross-session analysis.

## Defaults

- If the spec does not specify grade range: use `minGrade: 1, maxGrade: 12`.
- If the spec does not specify estimated time: use `estimatedTime: 300` (5 minutes).
- If the spec does not specify concepts: use an empty array `[]` and log a warning.
- If the spec does not specify difficulty tiers for content sets: generate easy (numbers halved), medium (as-is), hard (numbers doubled or additional steps).
- Number of additional content sets: 3 (easy + hard + themed) unless the spec explicitly requests more or fewer.

## Anti-patterns

- **Deploying without a health check and assuming the URL works.**

  **Bad:** Calling `/api/games/register`, getting a 200 response, and reporting "Deployed successfully" without navigating to the `artifactUrl`.

  **Good:** After registration, navigating to `artifactUrl` with Playwright MCP, checking for JS errors, verifying `game_ready` fires, and screenshotting the start screen.

- **Creating content sets that are just the default with one number changed.**

  **Bad:** Default set has `3 + 5 = ?`. "Easy" set has `2 + 5 = ?`. All other questions identical.

  **Good:** Easy set uses single-digit addition with visual aids. Hard set uses three-digit addition with carrying. Themed set uses cooking measurements.

- **Generating an inputSchema by hand instead of deriving it from fallbackContent.** The schema must match what the game actually consumes. Manual schemas drift from reality.

- **Uploading content sets without validating against the schema first.** A content set that fails schema validation at upload time wastes an API call. Validate locally before uploading.

- **Setting all content sets to the same difficulty.** The whole point of multiple sets is to serve different student needs. Vary the difficulty axis at minimum.

- **Ignoring `validationErrors` from the Core API.**

  **Bad:** API returns `{ isValid: false, validationErrors: ["missing field: misconception_tag"] }`. Deployer logs it and moves on.

  **Good:** Deployer reads the validation errors, fixes the content set JSON to include `misconception_tag` on every distractor, re-validates locally, and retries the upload.

- **Deploying a game with zero content sets.** The game link format requires a contentSetId. Without at least one valid content set, the link goes nowhere.

- **Sending a partial `llm_readable` to `update_game`, expecting a merge.**

  **Bad:** The round count changed from 9 to 10, so you call `update_game({ gameId, llmReadable: { scoring: { rounds: 10 } } })`. The brief is overwritten with just that fragment — the concepts, generation rules, worked example, and everything else are gone.

  **Good:** `get_game` the current brief, change the rounds field inside the object you read, then pass the **whole** updated object back to `update_game`.

- **Re-running the build and `upload_game_folder` without refreshing the brief.**

  **Bad:** You fix a mechanic, overwrite `index.html` via `upload_game_folder`, see the success response, and move on. The served game changed; `llm_readable` still describes the old mechanic, and downstream consumers now lie about the game.

  **Good:** Heed the `warning` in the upload response (or prefer a version bump): `get_game` → edit the brief for the new mechanic → `update_game` with the refreshed `llmReadable`.

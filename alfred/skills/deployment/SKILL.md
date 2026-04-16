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
      type: 'practice'
    },
    capabilities: {
      tracks: ['accuracy', 'time', 'stars'],
      provides: ['score', 'stars']
    },
    inputSchema: '<generated schema from step 1>',
    artifactContent: '<full HTML string>',
    publishedBy: 'alfred-pipeline'
  })
});

const body = await res.json();
// body.data.id = publishedGameId
// body.data.artifactUrl = CDN URL
```

Extract `publishedGameId` and `artifactUrl` from the response.

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
| game_ready does not fire | postMessage listener not registered, or init crash before game_ready | Do NOT deploy content sets. Return to game-building. Check for errors that crash before the listener is set up. |
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

## Constraints

- **CRITICAL — Never deploy a game that has not passed game-testing and game-review.** Deployment is the final step, not a shortcut.
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

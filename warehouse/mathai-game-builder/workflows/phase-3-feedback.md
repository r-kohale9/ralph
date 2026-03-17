# Phase 3: Feedback Integration

Add audio, subtitles, and stickers using unified FeedbackManager API.

## Prerequisites

- [ ] Phase 1 approved (packages loaded, FeedbackManager.init() called)
- [ ] Phase 2 approved (validation working)

## Critical Rule

⚠️ **ALL feedback uses:** `FeedbackManager.sound.play(id, { subtitle, sticker })`

## Workflow

### Change Requests After Phase Approval

**MANDATORY WORKFLOW:** (Triggered automatically by [prompt-dispatch.md](prompt-dispatch.md) before you reach this section.)

1. **Analyze the new user prompt.** If it requests _any_ change after Phase 3 (or earlier phases) was approved, treat it as a change request.
2. **STOP** – do **not** edit game files yet.
3. **Reset every checklist through Phase 3** (including `feedback-plan.md`) so all `[✅]` become `[ ]` using `replaceAll: true` edits.
4. **Then** make the requested feedback updates.
5. **Re-verify** every reset checklist until each item returns to `[✅]`.
6. **Request approval** only after verification passes.

Run the sequence in [checklist-reset-strategy.md](checklist-reset-strategy.md) immediately before making changes.

```javascript
const gameDirectory = `games/${gameId}`;

for (const file of [
  "phase-1-checklists.md",
  "phase-2-checklist.md",
  "phase-3-checklist.md",
  "feedback-plan.md",
]) {
  Edit({
    path: `${gameDirectory}/checklists/${file}`,
    edits: [
      {
        oldText: "[✅]",
        newText: "[ ]",
        replaceAll: true,
      },
    ],
  });
}

for (const file of [
  "phase-1-checklists.md",
  "phase-2-checklist.md",
  "phase-3-checklist.md",
  "feedback-plan.md",
]) {
  Read({
    path: `${gameDirectory}/checklists/${file}`,
  });
}
```

> Skipping the reset step breaks the workflow. Resume integration only after all reset checklists show `[✅]` again.

### Step 0: Present Checklist & Initialize Plan File

**Action:** Display checklist AND prepare to track feedback plan iterations.

**User Requirements:**

```
📋 Phase 3 - User Requirements

[ ] Button tap sounds identified
[ ] Correct answer feedback defined
[ ] Incorrect answer feedback defined
[ ] Progress feedback requirements clear
[ ] Completion feedback requirements clear
[ ] Dynamic audio needs identified (static preload OR streaming)
[ ] Subtitle text requirements clear
[ ] Sticker requirements clear

Ready to present feedback plan? (Reply "start")
```

**Pattern Requirements (Internal):**

```
📋 Phase 3 - Pattern Requirements

[ ] Create phase-3-checklist.md locally (without marks, just list)
[ ] Present feedback PLAN table with Content, Audio URL, Audio Type, Exists in DB, and Testing Instruction columns (NO database search yet)
[ ] Audio Type column: "static" (preload), "dynamic-cached" (preload at runtime), or "dynamic-streaming" (stream)
[ ] Audio URL column: "yet to generate" for static, "will generate at run-time" for dynamic
[ ] Exists in DB column: "pending" for static, "N/A" for dynamic
[ ] Testing Instruction column: Exact steps to test each feedback case
[ ] Track plan iterations (initial, modifications, final)
[ ] Get explicit user approval
[ ] **IF** user provides feedback assets folder → Process user assets (Step 1.5: filesystem:directory_tree, categorize files, create_feedback for .txt, upload_feedback for files, build assets array with URLs)
[ ] **IF** user provides feedback assets folder → VERIFY: All audio_*.txt generated, all files uploaded, subtitles mapped correctly, final array has CDN URLs only
[ ] **ELSE** → Search feedback library using mathai-feedback MCP
[ ] Save approved plan to checklists/feedback-plan.md with placeholder Audio URLs and "pending" DB status
[ ] After DB search OR folder processing: Update "yet to generate" with actual URLs and "pending" with "yes"/"no" for static audio
[ ] Search feedback library using mathai-feedback MCP
[ ] Integrate via filesystem:edit_file
[ ] **IF subjective evaluation generates feedback:** Use dynamic-streaming with TTS API for audio feedback (see checklists/subjective-evaluation.md for integration)
[ ] **URL Source Verification - VERIFY: Every audio/sticker URL came from MCP tool (search_feedback, create_feedback, upload_feedback) or user - NO fabricated/placeholder/guessed URLs**
[ ] Static feedback - VERIFY: FeedbackManager.sound.play(id, {subtitle, sticker}) signature, options object present (see checklists/feedback-integration.md)
[ ] Dynamic-cached feedback - VERIFY: FeedbackManager.sound.play(id, {subtitle, sticker}) signature, options object present (see checklists/feedback-integration.md)
[ ] Dynamic-streaming - VERIFY: Uses FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}) for dynamic audio (see checklists/feedback-integration.md)
[ ] VisibilityTracker integration - VERIFY: Calls sound.pause()/resume() AND stream.pauseAll()/resumeAll() in callbacks (see checklists/feedback-integration.md)
[ ] Sticker format - VERIFY: Object with type:"IMAGE_GIF", image, alignment (NOT string) (see checklists/feedback-integration.md)
[ ] Audio feedback emits view events - VERIFY: `signalCollector.recordViewEvent('feedback_display', { screen, content_snapshot: { feedback_type, message, audio_id } })` called before/during FeedbackManager.sound.play() (see examples/signal-capture-patterns.md Pattern 9)
[ ] Debug functions - VERIFY: window.testAudioUrls(), window.testAudio(id), window.debugAudio() included (see checklists/feedback-integration.md)
```

**Write Phase 3 Checklists to Disk:**

- Reuse the absolute `gameDirectory` path captured earlier (for example, `const gameDirectory = \`games/${gameId}\``)
- Make sure the checklist text reflects any user modifications or dynamic rows before writing
- Persist BOTH checklists exactly as presented using `Write tool`

```javascript
const gameDirectory = `games/${gameId}`; // saved in previous phases

Bash({command: "mkdir -p ${gameDirectory}/checklists", description: "Create checklists directory"}); //
  path: `${gameDirectory}/checklists`,
});

Write({
  path: `${gameDirectory}/checklists/phase-3-checklist.md`,
  content: `📋 Phase 3 - User Requirements

[ ] Button tap sounds identified
[ ] Correct answer feedback defined
[ ] Incorrect answer feedback defined
[ ] Progress feedback requirements clear
[ ] Completion feedback requirements clear
[ ] Dynamic audio needs identified (static preload OR streaming)
[ ] Subtitle text requirements clear
[ ] Sticker requirements clear

📋 Phase 3 - Pattern Requirements

[ ] Create phase-3-checklist.md locally (without marks, just list)
[ ] Present feedback PLAN table with Audio Type column
[ ] Get explicit user approval
[ ] **IF** user provides feedback assets folder → Process user assets (categorize, create_feedback/.txt, upload_feedback/files, verify URLs)
[ ] **ELSE** → Search feedback library using mathai-feedback MCP
[ ] Integrate via filesystem:edit_file
[ ] **IF subjective evaluation generates feedback:** Use dynamic-streaming with TTS API for audio feedback (see checklists/subjective-evaluation.md for integration)
[ ] **URL Source Verification - VERIFY: Every audio/sticker URL came from MCP tool (search_feedback, create_feedback, upload_feedback) or user - NO fabricated/placeholder/guessed URLs**
[ ] Static feedback - VERIFY: FeedbackManager.sound.play(id, {subtitle, sticker}) signature, options object present (see checklists/feedback-integration.md)
[ ] Dynamic-cached feedback - VERIFY: FeedbackManager.sound.play(id, {subtitle, sticker}) signature, options object present (see checklists/feedback-integration.md)
[ ] Dynamic-streaming - VERIFY: Uses FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}) for dynamic audio (see checklists/feedback-integration.md)
[ ] VisibilityTracker integration - VERIFY: Calls sound.pause()/resume() AND stream.pauseAll()/resumeAll() in callbacks (see checklists/feedback-integration.md)
[ ] Sticker format - VERIFY: Object with type:"IMAGE_GIF", image, alignment (NOT string) (see checklists/feedback-integration.md)
[ ] Audio feedback emits view events - VERIFY: recordViewEvent('feedback_display', ...) called before/during FeedbackManager.sound.play()
[ ] Debug functions - VERIFY: window.testAudioUrls(), window.testAudio(id), window.debugAudio() included (see checklists/feedback-integration.md)
`,
});
```

> Include any extra rows you gathered during the requirements discussion, and keep this file updated via `Edit tool` as checklist items move to `[✅]` or `[❌]`.

**Checklist Communication Pattern:**

**TO USER (Simple status only):**

- ✅ "All checklist items completed" (when all ✅)
- ⏳ "Some checklist items remaining" (when any ❌ or [ ])

**INTERNAL (Detailed tracking with SPECIFIC details):**

- Create checklist file locally with `Write tool`
- Update with `Edit tool` as items complete
- Mark items: `[ ]` → `[✅]` (done) or `[❌]` (needs fix)
- **CRITICAL: When marking [✅], add SPECIFIC implementation details:**

**❌ BAD (Ambiguous):**

```
[✅] All feedback integrated
[✅] Dynamic audio working
```

**✅ GOOD (Specific, Verifiable):**

```
[✅] Static audio: FeedbackManager.sound.play("tap", {subtitle:null, sticker:null}) - VERIFIED against feedback-integration.md
[✅] Dynamic audio: FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}) - VERIFIED simplified method used
[✅] VisibilityTracker: onInactive calls sound.pause() AND stream.pauseAll(), onResume calls sound.resume() AND stream.resumeAll() - VERIFIED both sound and stream
[✅] Options: ALL sound.play() calls have {subtitle:value, sticker:value} object - VERIFIED no missing options
```

**Template for marking feedback complete:**

```
[✅] Audio type: FeedbackManager.method("id", {exact params}) - VERIFIED against feedback-integration.md
[✅] Dynamic API: exact URL with query params - VERIFIED API endpoint
[✅] Integration: specific methods called with params - VERIFIED signature
```

- Verify ALL items `[✅]` before user notification
- Fix ALL `[❌]` items immediately

**NEVER show checklist marks to user. Only show simple status.**

---

### Step 0.5: Verify Local Files (AUTOMATIC)

**Action:** Verify local game files are up-to-date with CDN before making changes

**This step is MANDATORY when continuing work in a different chat session.**

```javascript
// 1. Read local metadata to get gameId
const localMeta = Read({
  path: `games/${gameId}/metadata.json`
});

// 2. Fetch CDN metadata
const cdnMeta = mathai-core:resource_manifest({
  gameId: gameId
});

// 3. Compare versions
if (cdnMeta.version > localMeta.version) {
  // CDN has newer version - download it
  // See game-resumption.md for download steps
}
```

**Status Messages:**

✅ **Local up-to-date:**

```
✅ Local files verified (v${localVersion})
Proceeding with Phase 3...
```

📥 **Downloading from CDN:**

```
📥 Updating from CDN (v${cdnVersion} > v${localVersion})
Downloaded ${fileCount} files
Proceeding with Phase 3...
```

**See:** [workflows/game-resumption.md](game-resumption.md) for complete verification workflow

---

### Step 1: Analyze Feedback Needs

Identify ALL feedback cases with content:

- Interaction sounds (taps, transitions) - What sound?
- Correct/incorrect answer feedback - What message?
- Progress feedback (milestones, level completion) - What message?
- Completion feedback (final score, achievements) - What message with dynamic values?

**Track plan iterations:**

- Initial plan timestamp
- Each modification with reason
- Final approved version

### Step 1.5: Process User-Provided Feedback Assets (If User Provides Folder Path)

**When user provides a folder path with feedback assets:**

**🚨 CRITICAL: Media Asset Upload Rule**

When user provides a local folder containing media assets (audio, sticker, subtitle, etc.):

**CORRECT Workflow:**
1. Read audio/media files from user's folder
2. Upload EACH file using `mathai-feedback:upload_feedback` MCP tool
3. Get CDN URL from the upload response
4. Use the CDN URL in the game code
5. **DO NOT copy/move audio files to game folder**

**FORBIDDEN Actions:**
- ❌ **DO NOT copy audio files to game folder** (e.g., NO `cp audio.mp3 games/gameId/audio.mp3`)
- ❌ **DO NOT use Bash to copy/move media files**
- ❌ **DO NOT try to upload audio via `upload_game_folder`** (that tool only handles text files like HTML, JSON, MD)
- ❌ **DO NOT use any file operations to store media in game directory**

**Why:** `upload_game_folder` only uploads text content and cannot make audio files playable. Media files MUST be uploaded via `mathai-feedback:upload_feedback` to get proper CDN URLs for playback.

#### Asset Naming Convention

Files must follow this pattern: `<asset_type>_<name>.<extension>`

**Examples:**

- `audio_correct.txt` → Audio text to generate
- `audio_tap.mp3` → Pre-generated audio file
- `subtitle_correct.txt` → Subtitle text (optional)
- `sticker_correct.gif` → Sticker image

#### Processing Checklist

**Step 1: Get directory tree**

- [ ] Call `filesystem:directory_tree` on user-provided folder path
- [ ] Examine all files in the tree result

**Step 2: Read each file and categorize**

For EACH file in tree:

**IF** filename matches `audio_*.txt`:

- [ ] Read file contents with `filesystem:read_text_file`
- [ ] Store: `{ name: "name_part", text: "file_contents", needsGeneration: true }`

**IF** filename matches `audio_*.mp3` OR `audio_*.wav`:

- [ ] Note file path
- [ ] Store: `{ name: "name_part", filePath: "path", needsUpload: true }`

**IF** filename matches `subtitle_*.txt`:

- [ ] Read file contents with `filesystem:read_text_file`
- [ ] Store in subtitles map: `subtitles["name_part"] = "file_contents"`

**IF** filename matches `sticker_*.gif` OR `sticker_*.png` OR `sticker_*.jpg`:

- [ ] Note file path
- [ ] Store: `{ name: "name_part", filePath: "path", needsUpload: true }`

**Step 3: Generate audio from text files**

For EACH audio with `needsGeneration: true`:

- [ ] Call `mathai-feedback:create_feedback({ text: "audio_text", category: "custom", tags: ["name"] })`
- [ ] Store returned `audioUrl`
- [ ] Mark as processed: `{ name: "name", audioUrl: "url", text: "original_text" }`

**Step 4: Upload audio files**

For EACH audio with `needsUpload: true`:

- [ ] Call `mathai-feedback:upload_feedback({ filePath: "path", category: "custom", tags: ["name"] })`
- [ ] Store returned `audioUrl` from the response
- [ ] Mark as processed: `{ name: "name", audioUrl: "url" }`
- [ ] **VERIFY:** audioUrl is a valid CDN URL (starts with https://)
- [ ] **CRITICAL:** Do NOT copy the audio file to game folder
- [ ] **CRITICAL:** Do NOT try to upload via `upload_game_folder`

**Step 5: Upload sticker files**

For EACH sticker with `needsUpload: true`:

- [ ] Call `mathai-feedback:upload_feedback({ filePath: "path", category: "stickers", tags: ["name"] })`
- [ ] Store returned `url` from the response
- [ ] Mark as processed: `{ name: "name", stickerUrl: "url" }`
- [ ] **VERIFY:** stickerUrl is a valid CDN URL (starts with https://)
- [ ] **CRITICAL:** Do NOT copy the sticker file to game folder
- [ ] **CRITICAL:** Do NOT try to upload via `upload_game_folder`

**Step 6: Build feedback assets array**

For EACH processed audio:

- [ ] Create asset object: `{ id: "name", url: "audioUrl" }`
- [ ] **IF** `subtitles["name"]` exists → Add: `subtitle: "subtitle_text"`
- [ ] **IF** no subtitle exists BUT audio has `text` field → Add: `subtitle: "audio_text"`
- [ ] **IF** matching sticker exists → Add: `sticker: { type: "IMAGE_GIF", image: "stickerUrl", alignment: "CENTER" }`
- [ ] Add to feedbackAssets array

#### Verification Checklist

**After processing folder:**

- [ ] All `audio_*.txt` files called `mathai-feedback:create_feedback` and got audioUrl
- [ ] All `audio_*.mp3/.wav` files called `mathai-feedback:upload_feedback` and got audioUrl
- [ ] All `sticker_*` files called `mathai-feedback:upload_feedback` and got url
- [ ] All `subtitle_*.txt` files read and stored in map
- [ ] Each audio has subtitle:
  - **IF** `subtitle_<name>.txt` exists → Use that text
  - **ELSE IF** audio was generated from `.txt` → Use audio generation text
  - **ELSE** → Subtitle is null
- [ ] Each audio has sticker (if matching `sticker_<name>.*` file exists)
- [ ] Final feedbackAssets array has correct structure: `[{ id, url, subtitle, sticker }]`
- [ ] All URLs are valid CDN URLs (https://...)
- [ ] NO file paths in final array (only URLs)
- [ ] **CRITICAL:** NO audio/sticker files copied to game folder
- [ ] **CRITICAL:** NO audio/sticker files in game directory (only HTML, JSON, MD files allowed)
- [ ] **CRITICAL:** When uploading game folder, ONLY include HTML, JSON, MD files (NO audio/media files)

#### Example Mapping

**Files in folder:**

```
audio_correct.txt        → "Great job!"
subtitle_correct.txt     → "Well done!"
sticker_correct.gif      → (image file)
audio_tap.mp3            → (audio file)
```

**Expected result:**

```
feedbackAssets = [
  {
    id: "correct",
    url: "https://cdn.mathai.ai/.../correct.mp3",  // from create_feedback
    subtitle: "Well done!",                         // from subtitle_correct.txt
    sticker: {
      type: "IMAGE_GIF",
      image: "https://cdn.mathai.ai/.../correct.gif",  // from upload_feedback
      alignment: "CENTER"
    }
  },
  {
    id: "tap",
    url: "https://cdn.mathai.ai/.../tap.mp3",      // from upload_feedback
    subtitle: null,                                 // no subtitle file
    sticker: null                                   // no sticker file
  }
]
```

### Step 2: Present Feedback PLAN

**🚨 CRITICAL: URL Source Rules**

Before creating the feedback plan, understand URL sources:

**Valid URL Sources (ONLY these):**
1. **`mathai-feedback:search_feedback`** - Returns URLs from feedback library
2. **`mathai-feedback:create_feedback`** - Generates audio and returns URL
3. **`mathai-feedback:upload_feedback`** - Uploads files and returns CDN URL
4. **User-provided URLs** - Explicit URLs given by the user

**In the Plan:**
- Use `"yet to generate"` for static audio (before DB search)
- Use `"will generate at run-time"` for dynamic audio
- **NEVER use placeholder URLs** like `https://cdn.mathai.ai/.../tap.mp3` or `https://example.com/...`
- **NEVER fabricate or guess URLs**

**After MCP Search/Upload:**
- Replace `"yet to generate"` with **actual URLs returned by MCP tools**
- If audio not found, use `"not found"` (not a fabricated URL)

**DO NOT search database yet. Present plan first:**

```
Feedback Plan:

| Case | Type | Content | Audio Type | Audio URL | Exists in DB | Testing Instruction | Needed For | Subtitle | Sticker |
|------|------|---------|------------|-----------|--------------|---------------------|------------|----------|---------|
| Button tap | Static | Click sound | static | yet to generate | pending | Tap on any button | All clicks | - | - |
| Correct | Static | "Great job!" | static | yet to generate | pending | Give correct answer (e.g., answer 15 in first question) | Right answers | "Great job!" | success.gif |
| Incorrect | Static | "Try again" | static | yet to generate | pending | Give incorrect answer (e.g., answer 10 in first question) | Wrong answers | "Try again" | - |
| Complete | Dynamic | "You scored {score} points!" | dynamic-streaming | will generate at run-time | N/A | Complete all questions | End of game | "You scored {score} points!" | trophy.gif |

Type 'modify' to change or 'approve' to proceed.
```

**Note:**

- Audio Type: `static` (preload), `dynamic-cached` (preload at runtime), `dynamic-streaming` (stream)
- Audio URL: `yet to generate` (static, before search) → actual URL (static, after search) → `will generate at run-time` (dynamic)
- Exists in DB: `pending` (static, before search) → `yes`/`no` (static, after search) → `N/A` (dynamic)

**After approval, save initial plan to file:**

```javascript
// First create the checklists directory
Bash({command: "mkdir -p games/${gameId}/checklists", description: "Create checklists directory"}); // Note: adjusted
  path: `games/${gameId}/checklists`
});

// Then write the feedback plan
Write({
  path: `games/${gameId}/checklists/feedback-plan.md`,
  content: `# Phase 3: Feedback Plan

## Approved Plan (Initial)

| Case | Type | Content | Audio Type | Audio URL | Exists in DB | Testing Instruction | Needed For | Subtitle | Sticker |
|------|------|---------|------------|-----------|--------------|---------------------|------------|----------|---------|
| Button tap | Static | Click sound | static | yet to generate | pending | Tap on any button | All clicks | - | - |
| Correct | Static | "Great job!" | static | yet to generate | pending | Give correct answer | Right answers | "Great job!" | success.gif |
| Complete | Dynamic | "You scored {score} points!" | dynamic-streaming | will generate at run-time | N/A | Complete all questions | End of game | ... | trophy.gif |
| ... (full table)

**Note:**
- Audio Type: "static" (preload), "dynamic-cached" (preload at runtime), "dynamic-streaming" (stream)
- Audio URL: "yet to generate" (static, before search) → actual URL (static, after search) → "will generate at run-time" (dynamic)
- Exists in DB: "pending" (static, before search) → "yes"/"no" (static, after search) → "N/A" (dynamic)

## Iterations

### Initial Plan (${new Date().toLocaleString()})
[Original plan with "yet to generate" placeholders]

### Modification 1 (if any) (Date/Time)
[User requested changes]

### Final Approved Plan (${new Date().toLocaleString()})
[Final approved version with placeholders]
`
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
const gameDirectory = `games/${gameId}`;
const treeResult = Glob({pattern: "**/*", path: `games/${gameId}`});

// Manually list ALL files from tree (should include feedback-plan.md now)
const files = [
  { filePath: `${gameDirectory}/index.html`, targetPath: "index.html" },
  { filePath: `${gameDirectory}/metadata.json`, targetPath: "metadata.json" },
  { filePath: `${gameDirectory}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" }
  // Add any other checklist files you see in tree
];

mathai-core:upload_game_folder({ gameId: gameId, files: files });
```

**After DB search in Step 3, update the plan file with actual URLs:**

```javascript
Edit({
  path: "games/${gameId}/checklists/feedback-plan.md",
  edits: [
    {
      oldText: "## Approved Plan (Initial)",
      newText: `## Approved Plan (With Audio URLs - ${new Date().toLocaleString()})

| Case | Type | Content | Audio Type | Audio URL | Exists in DB | Testing Instruction | Needed For | Subtitle | Sticker |
|------|------|---------|------------|-----------|--------------|---------------------|------------|----------|---------|
| Button tap | Static | Click sound | static | https://cdn.mathai.ai/.../tap.mp3 | yes | Tap on any button | All clicks | - | - |
| Correct | Static | "Great job!" | static | https://cdn.mathai.ai/.../correct.mp3 | yes | Give correct answer | Right answers | "Great job!" | success.gif |
| Complete | Dynamic | "You scored {score} points!" | dynamic-streaming | will generate at run-time | N/A | Complete all questions | End of game | ... | trophy.gif |
| ... (full table with actual URLs and DB status)

## Approved Plan (Initial)`,
    },
  ],
});
```

**WAIT for approval before Step 3.**

### Step 3: Search & Integrate

**🚨 CRITICAL: URL Verification Before Integration**

Before writing ANY audio or sticker URL to the game file:

1. **Verify URL Source:** Every URL must come from:
   - `mathai-feedback:search_feedback` result
   - `mathai-feedback:create_feedback` result
   - `mathai-feedback:upload_feedback` result
   - Explicit user-provided URL

2. **NEVER use:**
   - Fabricated URLs (e.g., `https://cdn.mathai.ai/audio/tap.mp3` without MCP confirmation)
   - Placeholder URLs (e.g., `https://example.com/...`)
   - Guessed CDN paths
   - Any URL not explicitly returned by MCP tools or user

3. **If audio not found:** Mark as "not found" in plan, do NOT create a fake URL

**🚨 MANDATORY: Read Feedback Integration Checklist First**

Before integrating ANY feedback, you MUST read the detailed checklist:

```javascript
// Read feedback integration checklist to understand correct API methods
Read: workflows / checklists / feedback - integration.md;
// Verify: FeedbackManager.sound.play() signature, stream API, VisibilityTracker integration
```

**After reading checklist and approval:**

1. Read metadata.json to get game info
2. Search mathai-feedback MCP for audio URLs
3. **Update checklists/feedback-plan.md with Audio URLs** (for static audio only)
4. Edit game file using Edit tool - USE EXACT METHODS FROM CHECKLIST
5. Update metadata.json (increment version, update phase, add checklist files)

**Search pattern:**

```javascript
// Search for static audio
const tapAudio = await search_feedback({
  category: "effects",
  tags: ["click", "tap"],
  query: "button click sound"
});

const correctAudio = await search_feedback({
  category: "encouragement",
  tags: ["correct", "positive"],
  query: "Great job!"
});

// Update plan file with actual URLs and DB status
Edit({
  path: "games/${gameId}/checklists/feedback-plan.md",
  edits: [{
    oldText: "| Button tap | Static | Click sound | yet to generate | pending | Tap on any button |",
    newText: `| Button tap | Static | Click sound | ${tapAudio.url} | yes | Tap on any button |`
  }, {
    oldText: "| Correct | Static | \"Great job!\" | yet to generate | pending | Give correct answer |",
    newText: `| Correct | Static | "Great job!" | ${correctAudio.url} | yes | Give correct answer |`
  }]
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
const gameDirectory = `games/${gameId}`;
const treeResult = Glob({pattern: "**/*", path: `games/${gameId}`});

// Manually list ALL files from tree (with updated feedback-plan.md)
const files = [
  { filePath: `${gameDirectory}/index.html`, targetPath: "index.html" },
  { filePath: `${gameDirectory}/metadata.json`, targetPath: "metadata.json" },
  { filePath: `${gameDirectory}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" }
  // Add any other checklist files you see in tree
];

mathai-core:upload_game_folder({ gameId: gameId, files: files });

// Note:
// - Dynamic audio rows keep "will generate at run-time" and "N/A" (no change needed)
// - If audio not found in DB, change "pending" to "no" and "yet to generate" to "not found"
```

**See detailed integration:** [checklists/feedback-integration.md](checklists/feedback-integration.md)

**Quick integration pattern:**

```javascript
// 1. Define assets (from approved plan)
const feedbackAssets = [
  { id: "tap", url: "https://.../tap.mp3" },
  { id: "correct", url: "https://.../correct.mp3" },
];

// 2. Preload (already in DOMContentLoaded)
await FeedbackManager.sound.preload(feedbackAssets);

// 3. Play static feedback (matching plan's Content, Subtitle, Sticker)
await FeedbackManager.sound.play("correct", {
  subtitle: "Great job!",
  sticker: {
    type: "IMAGE_GIF",
    image: "https://example.com/success.gif",
    alignment: "RIGHT",
  },
});

// 4. Play dynamic audio (simplified method handles everything)
await FeedbackManager.playDynamicFeedback({
  audio_content: `You scored ${score} points!`,
  subtitle: `You scored ${score} points!`,
  sticker: "https://example.com/trophy.gif",
});
```

**Use Edit tool:**

```javascript
Edit({
  path: "games/${gameId}/index.html",
  edits: [
    {
      oldText: "// TODO: Add feedback",
      newText: "const feedbackAssets = [...];",
    },
  ],
});

// Update metadata.json
Edit({
  path: "games/${gameId}/metadata.json",
  edits: [{
    oldText: '"version": "0.0.2"',
    newText: '"version": "0.0.3"'
  }, {
    oldText: '"current_phase": "phase-2"',
    newText: '"current_phase": "phase-3"'
  }, {
    oldText: '"/metadata.json"\n  ]',
    newText: '"/metadata.json",\n    "/checklists/feedback-plan.md"\n  ]'
  }]
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
const gameDirectory = `games/${gameId}`;
const treeResult = Glob({pattern: "**/*", path: `games/${gameId}`});

// Manually list ALL files from tree (with integrated feedback)
const files = [
  { filePath: `${gameDirectory}/index.html`, targetPath: "index.html" },
  { filePath: `${gameDirectory}/metadata.json`, targetPath: "metadata.json" }
    { filePath: `${gameDirectory}/checklists/*`, targetPath: "checklists/*" }
];

// Step 3: If checklists directory exists in tree, add checklist files
// Check tree result - if you see checklists/phase-1-checklists.md, add:
// files.push({ filePath: `${gameDirectory}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" });
// files.push({ filePath: `${gameDirectory}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" });

// Step 4: Upload
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**Verify if all files in game directory are uploaded to CDN (Including checklists and any other files)**

**Full checklist:** [checklists/feedback-integration.md](checklists/feedback-integration.md)

### Step 4: Verify Checklists

**🚨 MANDATORY: Re-read Feedback Checklist for Verification**

Before marking feedback integration complete, MUST verify against checklist:

```javascript
// Re-read feedback integration checklist
Read: workflows / checklists / feedback - integration.md;

// Verify ALL these items from the checklist:
// 1. FeedbackManager.sound.play(id, { subtitle, sticker }) - EXACT signature
// 2. Options object ALWAYS present (even if null values)
// 3. Sticker is object with type:"IMAGE_GIF", image, alignment (NOT string)
// 4. Dynamic streaming uses FeedbackManager.stream.addFromResponse() and stream.play()
// 5. Dynamic audio uses FeedbackManager.playDynamicFeedback() method
// 6. NO wrong APIs: No /api/generate-audio, no OpenAI, no custom endpoints
// 7. VisibilityTracker handles BOTH sound.pause/resume AND stream.pauseAll/resumeAll
// 8. NO new Audio(), NO SubtitleComponent.show(), NO StickerComponent.show()
```

**After re-reading checklist, verify against its requirements:**

```
URL Source Verification (CRITICAL - CHECK FIRST):
[✅/❌] **Every audio URL** came from mathai-feedback MCP tool (search_feedback, create_feedback, or upload_feedback)
[✅/❌] **Every sticker URL** came from mathai-feedback:upload_feedback or user-provided URL
[✅/❌] **NO fabricated URLs** (NO https://cdn.mathai.ai/audio/tap.mp3 without MCP confirmation)
[✅/❌] **NO placeholder URLs** (NO https://example.com/... or https://.../file.mp3)
[✅/❌] **NO guessed CDN paths** - every URL explicitly returned by MCP or user

User Requirements:
[✅/❌] All feedback cases integrated
[✅/❌] Subtitles match plan
[✅/❌] Stickers match plan

Pattern Requirements (VERIFIED against feedback-integration.md):
[✅/❌] ALL static audio uses FeedbackManager.sound.play(id, { subtitle, sticker }) - EXACT signature
[✅/❌] Options object ALWAYS present
[✅/❌] Sticker is OBJECT (not string) with type:"IMAGE_GIF", image, alignment
[✅/❌] Dynamic streaming uses stream.addFromResponse() and stream.play()
[✅/❌] **Dynamic audio uses:** FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})
[✅/❌] **NO wrong APIs:** No /api/generate-audio, no OpenAI, no custom endpoints
[✅/❌] VisibilityTracker pauses/resumes sound AND stream
[✅/❌] NO new Audio() anywhere in code
[✅/❌] NO SubtitleComponent.show() anywhere in code
[✅/❌] NO StickerComponent.show() anywhere in code
[✅/❌] Debug functions added (testAudio, testStream, debugAudio)
```

**If ANY ❌, fix immediately.**

### Step 5: User Testing

```
📁 File updated at: games/${gameId}/index.html

🌐 Refresh Chrome:
   1. Press Cmd+Shift+R (hard refresh)
   2. Test feedback:
      - Click buttons → hear tap sound
      - Answer correctly → hear audio + see subtitle + see sticker
      - Answer incorrectly → hear audio + see subtitle
      - Complete game → hear dynamic message

Debug commands:
- testAudio("tap") - Test specific audio
- debugAudio() - Check audio state
```

### Step 6: Request Approval

```
✅ Phase 3 complete!

🆔 Game ID: [gameId]
📦 Version: 0.0.3
🌐 Test: file://$(pwd)/games/[gameId]/index.html


📁 Location: games/${gameId}/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [PENDING APPROVAL] Feedback ← Test and approve
4. [ ] Registration
5. [ ] Testing
```

**Wait for explicit approval before Phase 4.**

## Feedback Checklist

**Detailed integration guide:** [checklists/feedback-integration.md](checklists/feedback-integration.md)

**Quick reminders:**

- All feedback via `FeedbackManager.sound.play(id, { subtitle, sticker })`
- NO `new Audio()`, NO `SubtitleComponent.show()`, NO `StickerComponent.show()`
- Options object ALWAYS present (even if `{ subtitle: null, sticker: null }`)

## Reference

- [Feedback Integration](checklists/feedback-integration.md) - **Full guide**
- [FeedbackManager API](../components/feedback-manager.md)
- [MCP Integration](../reference/mcp-integration.md)
- [Correct Patterns](../examples/correct-patterns.md)

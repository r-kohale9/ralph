#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// validate-feedback.js — FeedbackManager audio/subtitle/sticker static checks
//
// Verifies that FeedbackManager is correctly initialised, preloaded,
// and used throughout a generated game HTML file.
//
// Usage: node validate-feedback.js <path-to-index.html> [path-to-spec.md]
// Exit 0 = pass, Exit 1 = failures found (printed to stdout)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2];
const specPath = process.argv[3] || null;

if (!htmlPath) {
  console.error('Usage: node validate-feedback.js <path-to-index.html> [path-to-spec.md]');
  process.exit(2);
}

if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(2);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const spec = specPath && fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf-8') : '';
const errors = [];
const warnings = [];

// Quick check: does this game use FeedbackManager at all?
const usesFeedbackManager = /FeedbackManager/.test(html);
if (!usesFeedbackManager) {
  console.log('Game does not use FeedbackManager — skipping feedback validation');
  process.exit(0);
}

// ─── 1. FeedbackManager.init() exists and is awaited ─────────────────────────
{
  const hasInit = /FeedbackManager\s*\.\s*init\s*\(/.test(html);
  const hasAwaitedInit = /await\s+FeedbackManager\s*\.\s*init\s*\(/.test(html);

  if (!hasInit) {
    errors.push('MISSING: FeedbackManager.init() call — FeedbackManager must be initialised before use');
  } else if (!hasAwaitedInit) {
    errors.push('MISSING AWAIT: FeedbackManager.init() is called but not awaited — must use "await FeedbackManager.init()"');
  }
}

// ─── 2. sound.preload() exists, not sound.register() ────────────────────────
{
  const hasPreload = /(?:FeedbackManager\s*\.\s*)?sound\s*\.\s*preload\s*\(/.test(html);
  const hasRegister = /sound\s*\.\s*register\s*\(/.test(html);

  // Only require preload if there are sound.play() calls
  const hasPlayCalls = /sound\s*\.\s*play\s*\(/.test(html);

  if (hasPlayCalls && !hasPreload) {
    errors.push('MISSING: sound.preload([{id, url}]) — sounds must be preloaded before playing');
  }

  if (hasRegister) {
    errors.push('FORBIDDEN: sound.register() found — use sound.preload([{id, url}]) instead');
  }
}

// ─── 3. All sound.play() IDs appear in preload array ────────────────────────
{
  // Extract preload IDs: look for {id: 'xxx'} or {id: "xxx"} patterns within preload calls
  const preloadIds = new Set();

  // Match the full preload call and extract IDs from within
  const preloadBlockMatch = html.match(/sound\s*\.\s*preload\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  if (preloadBlockMatch) {
    const preloadBlock = preloadBlockMatch[1];
    const idMatches = preloadBlock.matchAll(/id\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of idMatches) {
      preloadIds.add(m[1]);
    }
  }

  // Also handle variable-based preload: var preloadList = [...]; sound.preload(preloadList)
  const preloadVarMatch = html.match(/(?:var|let|const)\s+(\w+)\s*=\s*\[([\s\S]*?)\]\s*;[\s\S]*?sound\s*\.\s*preload\s*\(\s*\1\s*\)/);
  if (preloadVarMatch) {
    const varBlock = preloadVarMatch[2];
    const idMatches = varBlock.matchAll(/id\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of idMatches) {
      preloadIds.add(m[1]);
    }
  }

  // Extract all sound.play() IDs — both static and dynamic (concatenated) patterns
  const playIdsStatic = new Set();   // exact IDs like 'correct_sound_effect'
  const playIdPrefixes = new Set();  // dynamic prefixes like 'round_' from 'round_' + n

  // Static: sound.play('exact_id')  — string literal is the full argument
  const staticPlayMatches = html.matchAll(/sound\s*\.\s*play\s*\(\s*['"]([^'"]+)['"]\s*[),]/g);
  for (const m of staticPlayMatches) {
    playIdsStatic.add(m[1]);
  }

  // Dynamic: sound.play('prefix_' + expr) — string literal followed by concatenation
  const dynamicPlayMatches = html.matchAll(/sound\s*\.\s*play\s*\(\s*['"]([^'"]+)['"]\s*\+/g);
  for (const m of dynamicPlayMatches) {
    playIdPrefixes.add(m[1]);
  }

  // Helper: check if a preload ID is "claimed" by either a static play or a dynamic prefix
  function isPreloadClaimed(preloadId) {
    if (playIdsStatic.has(preloadId)) return true;
    for (const prefix of playIdPrefixes) {
      if (preloadId.startsWith(prefix) && preloadId.length > prefix.length) return true;
    }
    return false;
  }

  // Helper: check if a static play ID is covered by preload (exact match)
  // Dynamic prefixes are checked separately below
  function isPlayCovered(playId) {
    if (preloadIds.has(playId)) return true;
    return false;
  }

  // Check for mismatches
  if (preloadIds.size > 0) {
    // Verify static play IDs exist in preload
    for (const playId of playIdsStatic) {
      if (!isPlayCovered(playId)) {
        errors.push(`MISSING PRELOAD: sound.play('${playId}') called but '${playId}' not found in sound.preload() array`);
      }
    }

    // Verify dynamic prefixes have at least one matching preload ID
    for (const prefix of playIdPrefixes) {
      const hasMatch = [...preloadIds].some((id) => id.startsWith(prefix) && id.length > prefix.length);
      if (!hasMatch) {
        errors.push(`MISSING PRELOAD: sound.play('${prefix}' + ...) called but no preloaded ID starts with '${prefix}'`);
      }
    }

    // Warn about preloaded but unused sounds
    for (const preloadId of preloadIds) {
      if (!isPreloadClaimed(preloadId)) {
        // Check if used in playDynamicFeedback or other patterns — only warn, don't error
        warnings.push(`WARNING [UNUSED-PRELOAD]: '${preloadId}' is preloaded but never passed to sound.play() — may be unused`);
      }
    }
  } else if (playIdsStatic.size > 0) {
    warnings.push('WARNING [PRELOAD-PARSE]: Could not parse preload array — unable to verify sound IDs match');
  }
}

// ─── 4. No new Audio() usage ────────────────────────────────────────────────
{
  if (/new\s+Audio\s*\(/.test(html)) {
    errors.push('FORBIDDEN: new Audio() found — all audio must go through FeedbackManager');
  }
}

// ─── 4b. Preview screen audio must use FeedbackManager ──────────────────────
{
  const hasPreviewScreen = /PreviewScreenComponent|previewScreen/.test(html);
  if (hasPreviewScreen && /previewAudio|preview.*audio/i.test(html)) {
    if (!/FeedbackManager/.test(html)) {
      errors.push(
        'MISSING: Preview screen references audio but FeedbackManager not found — ' +
          'preview audio must use FeedbackManager.sound.preload() and .play(), not new Audio()'
      );
    }
  }
}

// ─── 5. playDynamicFeedback if spec mentions TTS/dynamic audio ──────────────
{
  const specMentionsTTS = spec && (
    /playDynamicFeedback/i.test(spec) ||
    /dynamic.*audio/i.test(spec) ||
    /TTS/i.test(spec) ||
    /audio_content/i.test(spec) ||
    /text.to.speech/i.test(spec)
  );

  const hasDynamicFeedback = /FeedbackManager\s*\.\s*playDynamicFeedback\s*\(/.test(html);
  const hasBadDynamicFeedback = /FeedbackManager\s*\.\s*sound\s*\.\s*playDynamicFeedback\s*\(/.test(html);

  if (specMentionsTTS && !hasDynamicFeedback) {
    errors.push('MISSING: FeedbackManager.playDynamicFeedback() — spec requires dynamic/TTS audio but no playDynamicFeedback call found');
  }

  if (hasBadDynamicFeedback) {
    errors.push('FORBIDDEN: FeedbackManager.sound.playDynamicFeedback() — use FeedbackManager.playDynamicFeedback() directly (it is NOT on the sound object)');
  }
}

// ─── 6. VisibilityTracker uses sound.pause()/resume(), not stopAll() ────────
{
  const hasVisibilityTracker = /[Vv]isibility[Tt]racker/.test(html);

  if (hasVisibilityTracker) {
    const hasSoundPause = /sound\s*\.\s*pause\s*\(/.test(html);
    const hasSoundResume = /sound\s*\.\s*resume\s*\(/.test(html);
    const hasStreamPauseAll = /stream\s*\.\s*pauseAll\s*\(/.test(html);
    const hasStreamResumeAll = /stream\s*\.\s*resumeAll\s*\(/.test(html);
    const hasStopAll = /sound\s*\.\s*stopAll\s*\(/.test(html);

    if (!hasSoundPause) {
      errors.push('MISSING: sound.pause() — VisibilityTracker onInactive must call FeedbackManager.sound.pause()');
    }
    if (!hasSoundResume) {
      errors.push('MISSING: sound.resume() — VisibilityTracker onResume must call FeedbackManager.sound.resume()');
    }
    if (!hasStreamPauseAll) {
      warnings.push('WARNING [STREAM-PAUSE]: stream.pauseAll() not found — VisibilityTracker onInactive should call FeedbackManager.stream.pauseAll()');
    }
    if (!hasStreamResumeAll) {
      warnings.push('WARNING [STREAM-RESUME]: stream.resumeAll() not found — VisibilityTracker onResume should call FeedbackManager.stream.resumeAll()');
    }
    if (hasStopAll) {
      errors.push('FORBIDDEN: sound.stopAll() found — VisibilityTracker must use sound.pause()/resume(), NOT stopAll()');
    }
  }
}

// ─── 7. sound.play() must be awaited before screen transitions ──────────────
{
  // Check for common anti-pattern: sound.play() without await before showScreen/endGame
  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Detect sound.play() without await
    if (/sound\.play\s*\(/.test(line) && !/await\s/.test(line) && !/\/\//.test(line.split('sound.play')[0])) {
      // Check if it's in a fire-and-forget context (assigned to variable or standalone)
      // Only warn — some fire-and-forget calls are intentional
      warnings.push(`WARNING [UNAWAITED-PLAY] (line ${i + 1}): sound.play() called without await — verify this is intentional`);
    }
  }
}

// ─── 8. No onComplete callback on sound.play() ─────────────────────────────
{
  if (/sound\s*\.\s*play\s*\([^)]*onComplete/.test(html)) {
    errors.push('FORBIDDEN: onComplete callback passed to sound.play() — sound.play() returns a Promise, use await instead');
  }
}

// ─── Output results ─────────────────────────────────────────────────────────
if (warnings.length > 0) {
  warnings.forEach((w) => console.log(w));
}

if (errors.length > 0) {
  console.log(`\nFEEDBACK VALIDATION FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log(`Feedback validation passed (${warnings.length} warning(s))`);
  process.exit(0);
}

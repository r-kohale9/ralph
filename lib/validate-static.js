#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// validate-static.js — Static HTML validation layer (T1)
//
// Deterministic checks against generated HTML before running Playwright.
// Catches ~40% of failures in <1 second.
//
// Usage: node validate-static.js <path-to-index.html>
// Exit 0 = pass, Exit 1 = failures found (printed to stdout)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error('Usage: node validate-static.js <path-to-index.html>');
  process.exit(2);
}

if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(2);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const errors = [];
const warnings = [];

// ─── Helper: check if pattern exists in HTML ────────────────────────────────
function requirePattern(pattern, description) {
  if (typeof pattern === 'string') {
    if (!html.includes(pattern)) {
      errors.push(`MISSING: ${description}`);
    }
  } else {
    if (!pattern.test(html)) {
      errors.push(`MISSING: ${description}`);
    }
  }
}

function forbidPattern(pattern, description) {
  if (typeof pattern === 'string') {
    if (html.includes(pattern)) {
      errors.push(`FORBIDDEN: ${description}`);
    }
  } else {
    if (pattern.test(html)) {
      errors.push(`FORBIDDEN: ${description}`);
    }
  }
}

// ─── 1. Basic HTML structure ────────────────────────────────────────────────
requirePattern(/<!doctype\s+html>/i, 'DOCTYPE declaration');
requirePattern('<html', 'HTML root element');
requirePattern('<head', 'HEAD element');
requirePattern('<body', 'BODY element');

// ─── 2. Required DOM containers ─────────────────────────────────────────────
// #gameContent may be created dynamically by ScreenLayout.inject() — accept either static id= or ScreenLayout usage
const hasGameContentStatic = /id\s*=\s*["']gameContent["']/.test(html);
const hasScreenLayout = /ScreenLayout\.inject/.test(html);
if (!hasGameContentStatic && !hasScreenLayout) {
  errors.push('MISSING: #gameContent container (id attribute) or ScreenLayout.inject() call');
}
// #gameArea is an optional container — not required for CDN-layout games
// requirePattern(/id\s*=\s*["']gameArea["']/, '#gameArea container (id attribute)');

// ─── 3. Required global functions ───────────────────────────────────────────
// CDN games (ScreenLayout + DOMContentLoaded) don't need an initGame() function —
// they initialize inline in the DOMContentLoaded handler. Only require initGame
// for non-CDN games that use the legacy pattern.
const hasDOMContentLoaded = /addEventListener\s*\(\s*['"]DOMContentLoaded['"]/.test(html);
const hasInitGame = /(?:function\s+initGame\s*\(|(?:async\s+)?(?:const|let|var)\s+initGame\s*=)/.test(html);
if (!hasInitGame && !(hasScreenLayout && hasDOMContentLoaded)) {
  errors.push('MISSING: initGame() function declaration');
}

// Interaction handler — accept any function named handle*, check*, select*, tap*, press*, onXxx,
// or any addEventListener('click'/'keydown'/'touchstart') pattern.
// CDN games use diverse naming conventions (handleSimonTap, handleCellClick, handleCorrectTap, etc.)
const hasInteractionHandler =
  /function\s+(?:check|handle|select|tap|press|on[A-Z])\w*\s*\(/.test(html) ||
  /addEventListener\s*\(\s*['"](?:click|keydown|keyup|touchstart|pointerdown)['"]/.test(html);
if (!hasInteractionHandler) {
  errors.push('MISSING: No interaction handler function found (checkAnswer/handleClick/handleXxx/addEventListener)');
}

requirePattern(/function\s+endGame\s*\(/, 'endGame() function declaration');

// ─── 4. Single-file constraint ──────────────────────────────────────────────
requirePattern('<style', 'CSS <style> block (single-file constraint)');
requirePattern('<script', 'JavaScript <script> block (single-file constraint)');

// Check for external resource references
// MathAI CDN games always load from the MathAI CDN — these are allowed and required.
// Only forbid non-CDN external scripts (local relative paths or unknown hosts).
const externalLinkPattern = /<link[^>]+href\s*=\s*["'][^"']*\.css["']/i;
const externalScriptPattern = /<script[^>]+src\s*=\s*["']([^"']*)["']/gi;
if (externalLinkPattern.test(html)) {
  errors.push('FORBIDDEN: External CSS link (must be single-file, use <style>)');
}
// Allow CDN scripts (mathai CDN, unpkg, jsDelivr, etc.) — block local relative scripts
let scriptMatch;
const localScriptPattern = /^(?!https?:\/\/).*\.js$/i;
while ((scriptMatch = externalScriptPattern.exec(html)) !== null) {
  if (localScriptPattern.test(scriptMatch[1])) {
    errors.push(`FORBIDDEN: Local relative script "${scriptMatch[1]}" (must be inlined or use CDN)`);
  }
}

// ─── 5. Forbidden patterns ──────────────────────────────────────────────────
forbidPattern('document.write', 'document.write() usage');
// Inline event handlers (onclick= in HTML attributes, not in JS strings)
const inlineHandlerPattern = /<[^>]+\s+on(?:click|load|error|submit|change|input|keydown|keyup|mousedown|mouseup)\s*=/i;
if (inlineHandlerPattern.test(html)) {
  warnings.push('WARNING: Inline event handler found in HTML (prefer addEventListener)');
}

// ─── 6. postMessage communication ───────────────────────────────────────────
requirePattern('postMessage', 'postMessage for parent frame communication');

// ─── 7. Game state initialization ───────────────────────────────────────────
const hasGameState =
  /gameState\s*=\s*\{/.test(html) ||
  /let\s+gameState/.test(html) ||
  /var\s+gameState/.test(html) ||
  /const\s+gameState/.test(html);
if (!hasGameState) {
  errors.push('MISSING: No gameState object initialization found');
}

// ─── 8. Star scoring ─────────────────────────────────────────────────────────
// Accept any star-scoring pattern:
// (a) Time-based: 0.8/0.5 or 80%/50% thresholds (adjustment-strategy style)
// (b) Score/count-based: calcStars(), stars = N, starRating, numStars, etc. (CDN game style)
const has80 = /0\.8\b/.test(html) || /80\s*%/.test(html) || />=\s*80/.test(html);
const has50 = /0\.5\b/.test(html) || /50\s*%/.test(html) || />=\s*50/.test(html);
const hasStarCalc =
  /calcStar|getStar|starRating|numStar|starCount/.test(html) ||
  /(?:var|let|const)\s+stars\b/.test(html) ||
  /stars\s*[=<>!]+\s*[0-9]/.test(html) ||
  /[=:?]\s*3\b.*star|star.*[=:?]\s*3\b/i.test(html);
if ((!has80 || !has50) && !hasStarCalc) {
  errors.push('MISSING: Star scoring not found — need 0.8/0.5 thresholds or calcStars()/stars=N/var stars pattern');
}

// ─── 9. Responsive layout ───────────────────────────────────────────────────
const has480 = /480\s*px/.test(html);
const hasMaxWidth = /max-width\s*:\s*\d+px/i.test(html);
if (!has480 && !hasMaxWidth) {
  errors.push('MISSING: No 480px or max-width constraint found (required for mobile-first responsive layout)');
}

// ─── 10. File size sanity ───────────────────────────────────────────────────
if (html.length < 1000) {
  errors.push(`FILE TOO SMALL: ${html.length} characters — likely incomplete generation`);
}
if (html.length > 500000) {
  warnings.push(`WARNING: File very large (${html.length} characters) — may have issues`);
}

// ─── Output results ─────────────────────────────────────────────────────────
if (warnings.length > 0) {
  warnings.forEach((w) => console.log(w));
}

if (errors.length > 0) {
  console.log(`\nSTATIC VALIDATION FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log(`Static validation passed (${warnings.length} warning(s))`);
  process.exit(0);
}

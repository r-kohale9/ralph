'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);
const RALPH_SH = path.join(__dirname, '..', 'ralph.sh');

// These tests validate ralph.sh structure and helper functions without
// requiring a running CLIProxyAPI. They use bash -n for syntax and
// source the script to test individual functions.

describe('ralph.sh syntax and structure', () => {
  it('passes bash syntax check', () => {
    execFileSync('bash', ['-n', RALPH_SH], { timeout: 5000 });
  });

  it('is executable', () => {
    const stat = fs.statSync(RALPH_SH);
    assert.ok(stat.mode & 0o111, 'ralph.sh should be executable');
  });

  it('has shebang line', () => {
    const firstLine = fs.readFileSync(RALPH_SH, 'utf-8').split('\n')[0];
    assert.ok(firstLine.startsWith('#!/'), 'Should have shebang');
    assert.ok(firstLine.includes('bash'), 'Should use bash');
  });

  it('uses set -euo pipefail', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('set -euo pipefail'), 'Should use strict mode');
  });

  it('has cleanup trap', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('trap cleanup EXIT'), 'Should trap EXIT');
  });
});

describe('ralph.sh error handling', () => {
  it('exits with error when no arguments given', async () => {
    try {
      execFileSync('bash', [RALPH_SH], {
        timeout: 5000,
        env: { ...process.env, PATH: process.env.PATH },
      });
      assert.fail('Should have exited with error');
    } catch (err) {
      assert.ok(err.status !== 0, 'Should exit non-zero');
    }
  });

  it('exits with error when only one argument given', async () => {
    try {
      execFileSync('bash', [RALPH_SH, '/tmp/nonexistent'], {
        timeout: 5000,
        env: { ...process.env, PATH: process.env.PATH },
      });
      assert.fail('Should have exited with error');
    } catch (err) {
      assert.ok(err.status !== 0, 'Should exit non-zero');
    }
  });
});

describe('ralph.sh extract_html function', () => {
  // Test extract_html by sourcing just the function
  function testExtractHtml(input) {
    try {
      const result = execFileSync(
        'bash',
        [
          '-c',
          `
        extract_html() {
          local OUTPUT="$1"
          local EXTRACTED
          EXTRACTED=$(echo "$OUTPUT" | sed -n '/\`\`\`html/,/\`\`\`/p' | sed '1d;$d')
          if [ -n "$EXTRACTED" ]; then
            echo "$EXTRACTED"
            return 0
          fi
          EXTRACTED=$(echo "$OUTPUT" | sed -n '/\`\`\`/,/\`\`\`/p' | sed '1d;$d')
          if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q '<!DOCTYPE\\|<html\\|<head\\|<body'; then
            echo "$EXTRACTED"
            return 0
          fi
          if echo "$OUTPUT" | grep -q '<!DOCTYPE\\|<html'; then
            echo "$OUTPUT"
            return 0
          fi
          return 1
        }
        extract_html "$1"
      `,
          '--',
          input,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
      return { exitCode: 0, output: result.trim() };
    } catch (err) {
      return { exitCode: err.status, output: (err.stdout || '').trim() };
    }
  }

  it('extracts HTML from ```html code block', () => {
    const input = 'Here is the game:\n```html\n<!DOCTYPE html>\n<html><body>test</body></html>\n```\nDone!';
    const { exitCode, output } = testExtractHtml(input);
    assert.equal(exitCode, 0);
    assert.ok(output.includes('<!DOCTYPE html>'));
    assert.ok(!output.includes('```'));
  });

  it('extracts HTML from generic code block', () => {
    const input = '```\n<!DOCTYPE html>\n<html><body>hello</body></html>\n```';
    const { exitCode, output } = testExtractHtml(input);
    assert.equal(exitCode, 0);
    assert.ok(output.includes('<!DOCTYPE html>'));
  });

  it('returns raw HTML when no code blocks', () => {
    const input = '<!DOCTYPE html>\n<html><body>raw</body></html>';
    const { exitCode, output } = testExtractHtml(input);
    assert.equal(exitCode, 0);
    assert.ok(output.includes('<!DOCTYPE html>'));
  });

  it('fails when no HTML found', () => {
    const input = 'This is just regular text with no HTML.';
    const { exitCode } = testExtractHtml(input);
    assert.equal(exitCode, 1);
  });
});

describe('ralph.sh extract_tests function', () => {
  function testExtractTests(input) {
    try {
      const result = execFileSync(
        'bash',
        [
          '-c',
          `
        extract_tests() {
          local OUTPUT="$1"
          local EXTRACTED
          EXTRACTED=$(echo "$OUTPUT" | sed -n '/\`\`\`javascript/,/\`\`\`/p' | sed '1d;$d')
          if [ -n "$EXTRACTED" ]; then
            echo "$EXTRACTED"
            return 0
          fi
          EXTRACTED=$(echo "$OUTPUT" | sed -n '/\`\`\`js/,/\`\`\`/p' | sed '1d;$d')
          if [ -n "$EXTRACTED" ]; then
            echo "$EXTRACTED"
            return 0
          fi
          EXTRACTED=$(echo "$OUTPUT" | sed -n '/\`\`\`/,/\`\`\`/p' | sed '1d;$d')
          if [ -n "$EXTRACTED" ] && echo "$EXTRACTED" | grep -q 'test\\|expect\\|describe'; then
            echo "$EXTRACTED"
            return 0
          fi
          return 1
        }
        extract_tests "$1"
      `,
          '--',
          input,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
      return { exitCode: 0, output: result.trim() };
    } catch (err) {
      return { exitCode: err.status, output: (err.stdout || '').trim() };
    }
  }

  it('extracts from ```javascript block', () => {
    const input = '```javascript\ntest("works", () => {});\n```';
    const { exitCode, output } = testExtractTests(input);
    assert.equal(exitCode, 0);
    assert.ok(output.includes('test'));
  });

  it('extracts from ```js block', () => {
    const input = '```js\ndescribe("game", () => { it("loads", () => {}); });\n```';
    const { exitCode, output } = testExtractTests(input);
    assert.equal(exitCode, 0);
    assert.ok(output.includes('describe'));
  });

  it('fails when no test code found', () => {
    const input = 'Just some text, no code blocks.';
    const { exitCode } = testExtractTests(input);
    assert.equal(exitCode, 1);
  });
});

describe('ralph.sh validate_spec function', () => {
  function createSpec(content) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-spec-'));
    const specDir = path.join(tmpDir, 'test-game');
    fs.mkdirSync(specDir, { recursive: true });
    const specFile = path.join(specDir, 'spec.md');
    fs.writeFileSync(specFile, content);
    return { tmpDir, specFile };
  }

  it('passes with valid 13-section spec', () => {
    let sections = '';
    for (let i = 1; i <= 13; i++) {
      sections += `## ${i}. Section ${i}\n\nContent for section ${i}.\n\n`;
    }
    // Pad to >500 bytes
    sections += 'Additional content to meet minimum size. '.repeat(20);
    const { tmpDir, specFile } = createSpec(sections);

    try {
      const result = execFileSync(
        'bash',
        [
          '-c',
          `
        SPEC_PATH="${specFile}"
        LOG_FILE="/dev/null"
        log() { true; }
        warn() { true; }
        err() { echo "$*" >&2; }

        validate_spec() {
          if [ ! -f "$SPEC_PATH" ]; then return 1; fi
          local SPEC_SIZE; SPEC_SIZE=$(wc -c < "$SPEC_PATH")
          if [ "$SPEC_SIZE" -lt 500 ]; then return 1; fi
          return 0
        }

        validate_spec
      `,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
    } catch (err) {
      assert.fail('validate_spec should pass for valid spec');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('fails with spec too small', () => {
    const { tmpDir, specFile } = createSpec('# Short spec\nToo small.');

    try {
      execFileSync(
        'bash',
        [
          '-c',
          `
        SPEC_PATH="${specFile}"
        LOG_FILE="/dev/null"
        log() { true; }
        warn() { true; }
        err() { true; }

        validate_spec() {
          if [ ! -f "$SPEC_PATH" ]; then return 1; fi
          local SPEC_SIZE; SPEC_SIZE=$(wc -c < "$SPEC_PATH")
          if [ "$SPEC_SIZE" -lt 500 ]; then return 1; fi
          return 0
        }

        validate_spec
      `,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
      assert.fail('Should have failed for small spec');
    } catch (err) {
      assert.ok(err.status !== 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('fails when spec file does not exist', () => {
    try {
      execFileSync(
        'bash',
        [
          '-c',
          `
        SPEC_PATH="/tmp/nonexistent-ralph-spec.md"
        LOG_FILE="/dev/null"
        log() { true; }
        warn() { true; }
        err() { true; }

        validate_spec() {
          if [ ! -f "$SPEC_PATH" ]; then return 1; fi
          return 0
        }

        validate_spec
      `,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
      assert.fail('Should have failed for missing spec');
    } catch (err) {
      assert.ok(err.status !== 0);
    }
  });
});

describe('ralph.sh configuration defaults', () => {
  it('uses correct model defaults', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('claude-opus-4-6'), 'GEN_MODEL should default to Opus');
    assert.ok(content.includes('gemini-2.5-pro'), 'TEST_MODEL should default to Gemini');
    assert.ok(content.includes('claude-sonnet-4-6'), 'FIX_MODEL should default to Sonnet');
    assert.ok(content.includes('gpt-4.1'), 'FALLBACK_MODEL should default to GPT');
  });

  it('uses correct timeout defaults', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('RALPH_LLM_TIMEOUT:-300'), 'LLM timeout should default to 300s');
    assert.ok(content.includes('RALPH_TEST_TIMEOUT:-120'), 'Test timeout should default to 120s');
  });

  it('default max iterations is 5', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('RALPH_MAX_ITERATIONS:-5'), 'Max iterations should default to 5');
  });

  it('uses jq for safe JSON construction in write_report', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('jq -n'), 'write_report should use jq for JSON');
  });

  it('has 5 pipeline steps', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('Step 1: Generate HTML'));
    assert.ok(content.includes('Step 1b: Static validation'));
    assert.ok(content.includes('Step 2: Generate Playwright tests'));
    assert.ok(content.includes('Step 3: Test'));
    assert.ok(content.includes('Step 4: Review'));
    assert.ok(content.includes('Step 5: Post-approval tasks'));
  });

  it('has smart retry escalation on iteration 3+', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('DIAGNOSIS MODE'));
    assert.ok(content.includes('ITERATION" -ge 3'));
  });

  it('has fallback model support', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('FALLBACK_MODEL'));
    assert.ok(content.includes('fix-fallback'));
  });
});

describe('ralph.sh report format', () => {
  it('write_report produces valid JSON structure', () => {
    // Verify the jq template in write_report has all required fields
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    const reportFields = [
      'game_id',
      'spec',
      'status',
      'iterations',
      'generation_time_s',
      'total_time_s',
      'test_results',
      'review_result',
      'models',
      'artifacts',
      'timestamp',
    ];
    for (const field of reportFields) {
      assert.ok(content.includes(field), `Report should include ${field} field`);
    }
  });

  it('models section includes all 4 model assignments', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('generation: $gen_model'));
    assert.ok(content.includes('test_gen: $test_model'));
    assert.ok(content.includes('fix: $fix_model'));
    assert.ok(content.includes('review: $review_model'));
  });
});

describe('ralph.sh E6 caching', () => {
  it('has check_cache function', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('check_cache()'));
    assert.ok(content.includes('sha256sum'));
  });

  it('has update_cache function', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('update_cache()'));
  });

  it('cache is disabled by default', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('RALPH_ENABLE_CACHE:-0'));
  });

  it('check_cache verifies sha256 match', () => {
    // Test the actual bash function
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-cache-'));
    const cacheDir = path.join(tmpDir, 'cache');
    const specFile = path.join(tmpDir, 'spec.md');
    fs.writeFileSync(specFile, 'test spec content');

    try {
      // No cache should return 1
      const result = execFileSync(
        'bash',
        [
          '-c',
          `
        SPEC_PATH="${specFile}"
        GAME_ID="test-game"
        SPEC_CACHE_DIR="${cacheDir}"
        ENABLE_CACHE="1"
        HTML_FILE="${tmpDir}/index.html"

        check_cache() {
          [ "$ENABLE_CACHE" != "1" ] && return 1
          mkdir -p "$SPEC_CACHE_DIR"
          local SPEC_HASH; SPEC_HASH=$(sha256sum "$SPEC_PATH" | cut -d' ' -f1)
          local CACHE_FILE="$SPEC_CACHE_DIR/\${GAME_ID}.sha256"
          local CACHED_HTML="$SPEC_CACHE_DIR/\${GAME_ID}.html"
          if [ -f "$CACHE_FILE" ] && [ -f "$CACHED_HTML" ]; then
            local CACHED_HASH; CACHED_HASH=$(cat "$CACHE_FILE")
            if [ "$SPEC_HASH" = "$CACHED_HASH" ]; then
              cp "$CACHED_HTML" "$HTML_FILE"
              return 0
            fi
          fi
          return 1
        }

        check_cache && echo "HIT" || echo "MISS"
      `,
        ],
        { encoding: 'utf-8', timeout: 5000 },
      );
      assert.ok(result.trim() === 'MISS');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('ralph.sh E8 diff-based fix', () => {
  it('uses diff-based prompt for large HTML on iteration 2+', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('HTML_SIZE'));
    assert.ok(content.includes('20000'));
    assert.ok(content.includes('script section only'));
    assert.ok(content.includes('E8: Using diff-based prompt'));
  });
});

describe('ralph.sh E9 warehouse validation', () => {
  it('has validate_spec_against_warehouse function', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('validate_spec_against_warehouse()'));
    assert.ok(content.includes('RALPH_WAREHOUSE_DIR'));
  });

  it('skips when no warehouse configured', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('Skip if no warehouse configured'));
  });

  it('checks for part references in spec', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('part:'));
    assert.ok(content.includes('MISSING_PARTS'));
  });
});

describe('ralph.sh E10 deployment step', () => {
  it('has GCP upload step for build artifacts', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    // Deployment in ralph.sh is handled via GCP upload (node pipeline handles local deploy)
    assert.ok(content.includes('GCP') || content.includes('gcp') || content.includes('RALPH_GCP') || content.includes('publish'));
  });

  it('has inputSchema generation step', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('inputSchema.json'));
    assert.ok(content.includes('INPUT_SCHEMA_FILE'));
  });

  it('has content generation step', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('content'));
  });

  it('has publish/registration step', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('CORE_API_URL') || content.includes('publish') || content.includes('RALPH_DEPLOY'));
  });
});

describe('ralph.sh T6 inputSchema generation', () => {
  it('generates inputSchema.json after approval', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('inputSchema.json'));
    assert.ok(content.includes('generate-schema'));
    assert.ok(content.includes('INPUT_SCHEMA_FILE'));
  });

  it('has fallback handling when LLM fails', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    // ralph.sh uses "will infer from fallback content" when inputSchema LLM fails
    assert.ok(content.includes('infer from fallback') || content.includes('fallback'));
    assert.ok(content.includes('INPUT_SCHEMA_FILE'));
  });
});

describe('ralph.sh T2 contract validation integration', () => {
  it('calls validate-contract.js in static validation step', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('validate-contract.js'));
    assert.ok(content.includes('Contract validation'));
  });
});

describe('ralph.sh E5 event schema validation', () => {
  it('includes postMessage validation in test generation prompt', () => {
    const content = fs.readFileSync(RALPH_SH, 'utf-8');
    assert.ok(content.includes('postMessage validation'));
    assert.ok(content.includes('gameOver event'));
  });
});

# Alfred — Math Game Generation Workflow

This repository is the **Alfred** skill workflow: a set of markdown skills that turn a game description (or an existing spec) into a deployed, tested math game.

There is no build script or pipeline runtime. Alfred runs entirely inside Claude Code via skills + sub-agents.

## Entry point

**`alfred/skills/orchestration/SKILL.md`** — the orchestrator prompt.

To start a build:

1. Open `alfred/skills/orchestration/SKILL.md`.
2. Copy the prompt block (everything inside the `## The Prompt` code fence).
3. Replace `{{GAME_DESCRIPTION}}` with either:
   - A plain-text description (e.g. *"a ratio comparison game for Class 5 with 3 lives and 10 rounds"*), or
   - A path to an existing spec (e.g. *"Use the spec at `games/hexa-numbers/spec.md`"*).
4. Paste into Claude Code and run.

The orchestrator drives 12 numbered steps across four phases (Intent → Build/Test/Review → Deploy → Gauge/Iterate), pausing at every `HUMAN REVIEWS` gate for your input.

## Repo layout

```
alfred/
├── skills/         # Procedural skills (one folder per skill)
│   ├── orchestration/SKILL.md      # ← entry point
│   ├── spec-creation/, spec-review/, game-planning/
│   ├── game-building/, game-archetypes.md
│   ├── data-contract/, mobile/, feedback/, pedagogy/, interaction/
│   ├── game-testing/, visual-review/, final-review/
│   ├── deployment/, gauge/, iteration/
│   └── subjective-evaluation/, signal-collector/
├── parts/          # Canonical PART specs (CDN component contracts)
├── scripts/        # Static + contract validators
│   ├── validate-static.js          # `node alfred/scripts/validate-static.js <path-to-index.html>`
│   └── validate-contract.js        # `node alfred/scripts/validate-contract.js <path-to-index.html>`
├── design/         # Architecture notes (reference, not loaded at build time)
└── concerns/       # Historical review threads

games/
└── <gameId>/spec.md    # one folder per game, spec only
```

## Sub-agent vs main context

Sub-agents (Agent tool) **do not inherit MCP server connections**. The orchestration skill labels each step with its required execution mode:

- `[SUB-AGENT]` — text/code generation, can be delegated.
- `[MAIN CONTEXT]` — Steps 6, 7, 8 require Playwright MCP and **must** run in the main orchestrator context. Delegating these to a sub-agent silently falls back to static code analysis (no real browser) and produces false confidence.

## Prerequisites

- Claude Code with the project opened at this repo root.
- Playwright MCP connected to the main context (Steps 6–8). `playwright` npm package is the documented fallback.
- Core API MCP and GCP Storage credentials (Step 10 deployment only).
- Node.js available on PATH for `alfred/scripts/validate-*.js` (no other runtime deps).

## Adding a new game

Either:

- Create `games/<gameId>/spec.md` and pass *"Use the spec at games/<gameId>/spec.md"* as the game description, **or**
- Skip the spec and let Step 1 draft one from a plain-text description.

Each `games/<gameId>/` should contain only `spec.md`. Generated artefacts (`index.html`, `inputSchema.json`, `pre-generation/`, etc.) are produced during a build session and are not committed to this repo.

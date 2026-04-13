### PART-026: Anti-Patterns
**Purpose:** Verification checklist of common LLM mistakes. Not a code-generating part.
**Critical anti-patterns:**
- Never create manual timers (`setInterval`) — use TimerComponent
- Never use `new Audio()` — use FeedbackManager
- Never invent script URLs — copy exact CDN URLs from PART-002
- Never define inline SignalCollector stub — shadows real CDN class (PART-042)
- Never use `slots` API — use `sections` (PART-025 v2)
- Never place play area HTML in `<body>` — inject into `#gameContent` after ScreenLayout

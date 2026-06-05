### PART-031: API Helper & Session Tracking
**Purpose:** Submit completed game sessions to MathAI backend.
**Condition:** Game submits results to backend API.
**API:** `new MathAIHelpers.APIHelper()` -> `.configure({ baseUrl, timeout, headers })` -> `.submitResults({ session_id, game_id, ... })`
**Key rules:**
- Available via Helpers package (`MathAIHelpers.APIHelper`)
- Default baseUrl: `https://c.c.mathai.ai/cc-public`

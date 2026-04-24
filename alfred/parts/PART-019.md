### PART-019: Results Screen (via TransitionScreen)
**Purpose:** Show end-of-game results using TransitionScreen's content slot.
**API:** `transitionScreen.show({ stars, title, content: metricsHTML, buttons: [{ text, type, action }], persist: true })`
**Key rules:**
- A standalone `#results-screen` div MUST NOT be used — TransitionScreen hides `#gameContent` and renders the results card.
- Build metrics HTML string with accuracy, time, avg speed
- Use `persist: true` so results screen stays visible

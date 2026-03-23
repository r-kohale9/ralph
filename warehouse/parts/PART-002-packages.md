# PART-002: Package Scripts

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** None

---

## Canonical Script URLs (copy exactly — never invent URLs)

| Package | Exact URL |
|---------|-----------|
| SentryConfig | `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js` |
| FeedbackManager | `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js` |
| Components | `https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js` |
| Helpers | `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js` |

Game packages load in this order (AFTER Sentry — see PART-030 for full block):

```html
<!-- 1. FeedbackManager MUST load FIRST -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load SECOND -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load THIRD -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## Rules

- Order is non-negotiable: FeedbackManager -> Components -> Helpers
- No other scripts between these three
- These go in `<body>`, AFTER Sentry SDK scripts (see PART-030 for full loading order)

**Why this order:** FeedbackManager loads SubtitleComponent. If Components loads first, SubtitleComponent gets registered twice -> duplicate registration errors.

## Anti-Patterns

```html
<!-- WRONG: Wrong order -->
<script src=".../components/index.js"></script>
<script src=".../feedback-manager/index.js"></script>

<!-- WRONG: Missing packages -->
<script src=".../feedback-manager/index.js"></script>
<!-- Missing Components and Helpers -->

<!-- WRONG: Hallucinated URLs — these domains do NOT exist -->
<script src="https://cdn.homeworkapp.ai/packages/FeedbackManager.js"></script>
<script src="https://cdn.homeworkapp.ai/packages/Components.js"></script>
<script src="https://cdn.homeworkapp.ai/packages/Helpers.js"></script>
<script src="https://cdn.homeworkapp.ai/sentry/helpers/sentry/index.js"></script>

<!-- CORRECT: Only these exact URLs are valid -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

## Verification

- [ ] FeedbackManager script tag is FIRST
- [ ] Components script tag is SECOND
- [ ] Helpers script tag is THIRD
- [ ] No other scripts between these three
- [ ] All three use exact URLs from code block above

## Source Code

Package source is available in `warehouse/packages/` for debugging during fix iterations:
- `packages/feedback-manager/index.js` — FeedbackManager (SoundManager, StreamManager, Subtitle/Sticker integration)
- `packages/components/index.js` — Bundle loader for ScreenLayout, ProgressBar, TransitionScreen, Timer, Stories
- `packages/helpers/index.js` — Bundle loader for VisibilityTracker, InteractionManager, SignalCollector, etc.
- `packages/README.md` — Full package index with API quick reference

## Deep Reference

`mathai-game-builder/workflows/checklists/package-loading.md`

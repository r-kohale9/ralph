# PART-002: Package Scripts

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** None

---

## Code

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
- These go in `<head>`, before `<style>`

**Why this order:** FeedbackManager loads SubtitleComponent. If Components loads first, SubtitleComponent gets registered twice -> duplicate registration errors.

## Anti-Patterns

```html
<!-- WRONG: Wrong order -->
<script src=".../components/index.js"></script>
<script src=".../feedback-manager/index.js"></script>

<!-- WRONG: Missing packages -->
<script src=".../feedback-manager/index.js"></script>
<!-- Missing Components and Helpers -->
```

## Verification

- [ ] FeedbackManager script tag is FIRST
- [ ] Components script tag is SECOND
- [ ] Helpers script tag is THIRD
- [ ] No other scripts between these three
- [ ] All three use exact URLs from code block above

## Deep Reference

`mathai-game-builder/workflows/checklists/package-loading.md`

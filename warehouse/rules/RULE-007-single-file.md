# RULE-007: Single File Architecture

**Severity:** REQUIRED

---

Everything in one `index.html` file.

## Structure

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Package CDN scripts (PART-002) — only external files allowed -->
  <script src="...feedback-manager..."></script>
  <script src="...components..."></script>
  <script src="...helpers..."></script>

  <style>
    /* ALL CSS here */
  </style>
</head>
<body>
  <!-- ALL HTML here -->

  <script>
    // ALL JavaScript here
  </script>
</body>
</html>
```

## Rules

- One `<style>` block in `<head>` — no external CSS
- One `<script>` block at end of `<body>` — no external JS (except PART-002 packages)
- No `<link rel="stylesheet">` tags
- No `<script src="game.js">` tags

## Why

- Games are deployed as single files to CDN
- Eliminates missing file errors
- Simplifies upload and versioning

## Verification

- [ ] Exactly one `<style>` block
- [ ] Exactly one game `<script>` block (inline, no src)
- [ ] No external CSS links
- [ ] No external JS files (except PART-002 CDN packages)

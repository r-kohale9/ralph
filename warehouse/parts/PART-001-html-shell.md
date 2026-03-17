# PART-001: HTML Shell

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** None

---

## Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{GAME_TITLE}}</title>

  {{PART-002: Package Scripts}}

  <style>
    {{GAME_STYLES}}
  </style>
</head>
<body>
  {{GAME_HTML_SCREENS}}

  <script>
    {{GAME_JAVASCRIPT}}
  </script>
</body>
</html>
```

## Rules

- All CSS in a single `<style>` block in `<head>`
- All JS in a single `<script>` block at end of `<body>`
- No external CSS/JS files (except CDN package scripts from PART-002)
- Package scripts go in `<head>` before `<style>`
- Game-specific HTML goes inside `<body>` before `<script>`

## Verification

- [ ] `<!DOCTYPE html>` present
- [ ] `<meta charset="UTF-8">` present
- [ ] `<meta name="viewport">` present
- [ ] Exactly one `<style>` block in `<head>`
- [ ] Exactly one `<script>` block in `<body>` (game code)
- [ ] No external CSS `<link>` tags
- [ ] No external JS `<script src>` tags except PART-002 packages

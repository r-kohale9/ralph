# PART-019: Results Screen UI

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-011

---

## HTML

```html
<div id="results-screen" style="display:none;">
  <div class="results-container">
    <h2 id="results-title">Game Complete!</h2>
    <div id="stars-display" class="stars-display"></div>
    <div class="results-metrics">
      <div class="metric-row">
        <span class="metric-label">Score</span>
        <span id="result-score" class="metric-value">0%</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Time</span>
        <span id="result-time" class="metric-value">0s</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Correct</span>
        <span id="result-correct" class="metric-value">0/0</span>
      </div>
    </div>
    <button onclick="location.reload()">Play Again</button>
  </div>
</div>
```

## JavaScript

```javascript
function showResults(metrics) {
  document.getElementById('result-score').textContent = metrics.accuracy + '%';
  document.getElementById('result-time').textContent = metrics.time + 's';
  document.getElementById('result-correct').textContent =
    gameState.attempts.filter(a => a.correct).length + '/' + gameState.attempts.length;
  document.getElementById('stars-display').textContent =
    '⭐'.repeat(metrics.stars) + '☆'.repeat(3 - metrics.stars);
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'block';
}
```

## Placement

- HTML: Inside `<body>`, after game screen, hidden by default
- JS: `showResults` in global scope (RULE-001), called from `endGame()` (PART-011)

## Customization

Add game-specific metrics as additional `metric-row` elements:

```html
<div class="metric-row">
  <span class="metric-label">Streak</span>
  <span id="result-streak" class="metric-value">0</span>
</div>
```

## Verification

- [ ] `#results-screen` element exists, hidden by default
- [ ] `#result-score`, `#result-time`, `#result-correct` elements exist
- [ ] `#stars-display` element exists
- [ ] `showResults` function exists in global scope
- [ ] `showResults` populates all metric elements
- [ ] `showResults` hides game screen, shows results screen
- [ ] Play Again button reloads page

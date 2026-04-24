# PART-019: Results Screen UI

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-011, PART-024

---

Results MUST be shown via the TransitionScreen `content` slot (PART-024). A standalone `#results-screen` div is NOT valid — TransitionScreen hides `#gameContent` when shown, so any results div inside `#gameContent` would be hidden. Using the `content` slot avoids this entirely.

## Usage

```javascript
function showResults(metrics, reason) {
  // Build metrics HTML for the TransitionScreen content slot
  var metricsHTML =
    '<div class="results-metrics">' +
      '<div class="metric-row">' +
        '<span class="metric-label">Time</span>' +
        '<span class="metric-value">' + metrics.time + 's</span>' +
      '</div>' +
      '<div class="metric-row">' +
        '<span class="metric-label">Avg. Speed</span>' +
        '<span class="metric-value">' + metrics.avgTimePerRound + 's/round</span>' +
      '</div>' +
      '<div class="metric-row">' +
        '<span class="metric-label">Accuracy</span>' +
        '<span class="metric-value">' + metrics.accuracy + '%</span>' +
      '</div>' +
    '</div>';

  transitionScreen.show({
    stars: metrics.stars,
    title: reason === 'victory' ? 'Great Job!' : 'Game Over',
    content: metricsHTML,
    buttons: [{
      text: 'Play Again',
      type: 'primary',
      action: function() { restartGame(); }
    }],
    persist: true,
    styles: {
      title: { fontSize: '36px', color: '#2D1448' }
    }
  });
}
```

## Required CSS for Metrics

```css
.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 8px;
  text-align: left;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-label {
  color: var(--mathai-gray);
  font-size: var(--mathai-font-size-label);
}

.metric-value {
  font-weight: 700;
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-black);
}
```

## Customization

Add game-specific metrics as additional `metric-row` elements in the HTML string:

```javascript
var metricsHTML =
  '<div class="results-metrics">' +
    // ... standard metrics ...
    '<div class="metric-row">' +
      '<span class="metric-label">Streak</span>' +
      '<span class="metric-value">' + metrics.streak + '</span>' +
    '</div>' +
  '</div>';
```

## Why NOT a separate `#results-screen` div

TransitionScreen toggles `#gameContent` visibility:
- `show()` sets `#gameContent.style.display = 'none'`
- `hide()` sets `#gameContent.style.display = 'block'`

If `#results-screen` is inside `#gameContent`, it gets hidden when TransitionScreen shows — defeating the purpose. Using the `content` slot of TransitionScreen avoids this entirely.

## Audio on Results (MANDATORY)

Results must be shown AFTER playing the appropriate sound:

```javascript
// Victory
await FeedbackManager.sound.play('sound_game_complete', {
  sticker: { image: 'URL.gif', duration: 3000, type: 'IMAGE_GIF' }
});
showResults(metrics, 'victory');

// Game Over
await FeedbackManager.sound.play('sound_game_over');
showResults(metrics, 'game_over');
```

## Verification

- [ ] NOT using a standalone `#results-screen` div
- [ ] Results shown via `transitionScreen.show({ content: metricsHTML, persist: true })`
- [ ] Stars passed to TransitionScreen (`stars: metrics.stars`)
- [ ] "Play Again" button calls `restartGame()` (not `location.reload()`)
- [ ] Audio played BEFORE showing results screen
- [ ] Metrics HTML includes all relevant game stats
- [ ] `.results-metrics` CSS defined for layout

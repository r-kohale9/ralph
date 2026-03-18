# PART-032: AnalyticsManager

**Category:** CONDITIONAL | **Condition:** Game requires multi-platform analytics (Mixpanel, Amplitude, CleverTap) | **Dependencies:** PART-002, PART-004

---

## Purpose

Unified analytics tracking that sends events to Mixpanel, Amplitude, and CleverTap simultaneously. All events automatically include `harness: true`.

## Package Loading

```html
<!-- Analytics Config MUST load before Analytics Manager -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/config.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**CRITICAL: `config.js` MUST load before `index.js`.** AnalyticsManager reads `window.AnalyticsConfig` on construction. Without the config script, credentials and platform settings will be missing.

**Note:** AnalyticsManager is a separate package — it is NOT part of the Helpers bundle (`helpers/index.js`). It requires its own script tags.

## waitForPackages (with Analytics)

```javascript
async function waitForPackages() {
  const timeout = 10000;
  const start = Date.now();

  // ... wait for FeedbackManager, TimerComponent, VisibilityTracker ...

  // Wait for AnalyticsManager
  while (typeof AnalyticsManager === 'undefined') {
    if (Date.now() - start > timeout) {
      throw new Error('Package loading timeout: AnalyticsManager');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('All packages loaded');
}
```

## Initialization

```javascript
let analytics = null;

window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Initialize analytics
  analytics = new AnalyticsManager();
  await analytics.init();
  window.analyticsManager = analytics; // Global for StoriesComponent

  analytics.track('page_opened', { page: 'game' });

  setupGame();
});
```

## User Identification

Call after receiving `game_init` with student data:

```javascript
analytics.identify({
  id: config.studentId,      // REQUIRED
  mobile: config.mobile,
  name: config.name,
  email: config.email
});
```

## 7 Mandatory Game Events

Track these during gameplay:

```javascript
// 1. User submits answer (BEFORE validation)
analytics.track('question_submitted', {
  question_number: currentRound + 1,
  user_answer: userAnswer,
  attempt_number: attemptCount,
  time_taken: Date.now() - questionStartTime,
  has_timer: !!timer
});

// 2. Validation completes (AFTER validation)
analytics.track('question_evaluation_complete', {
  question_number: currentRound + 1,
  is_correct: isCorrect,
  user_answer: userAnswer,
  correct_answer: correctAnswer,
  validation_type: 'exact_match', // or 'function', 'subjective'
  attempt_number: attemptCount
});

// 3. Timer expires (in timer onEnd callback)
analytics.track('question_timed_out', {
  question_number: currentRound + 1,
  timer_duration: timerDuration,
  attempts_made: attemptCount
});

// 4. Submit button shown/enabled
analytics.track('show_submit_button', {
  question_number: currentRound + 1,
  trigger: 'input_provided'
});

// 5. Submit button hidden/disabled
analytics.track('hide_submit_button', {
  question_number: currentRound + 1,
  trigger: 'answer_submitted',
  was_correct: isCorrect
});

// 6. Next button clicked
analytics.track('next_btn_clicked', {
  question_number: currentRound + 1,
  was_correct: wasCorrect,
  attempts_used: attemptCount,
  time_spent: Date.now() - questionStartTime
});

// 7. Image load failure (in img.onerror)
analytics.track('show_image_not_loaded_popup', {
  question_number: currentRound + 1,
  image_url: img.src,
  image_type: 'question_image'
});
```

## Game Lifecycle Events

```javascript
// Game started
analytics.track('game_started', {
  difficulty: difficulty,
  total_questions: totalRounds
});

// Game paused (from VisibilityTracker)
analytics.track('game_paused', { time_elapsed: elapsedTime });

// Game resumed
analytics.track('game_resumed', { time_elapsed: elapsedTime });

// Game completed
analytics.track('game_completed', {
  score: accuracy * 100,
  stars: stars,
  correct_answers: correctCount,
  total_questions: totalRounds,
  time_taken: totalTime
});
```

## Additional Methods

### `reset()`

Logs out the user and clears identity across all platforms. Call on user logout.

```javascript
analytics.reset();
```

### `appendToUserTraits(key, value)`

Appends a value to an array-type user trait across all platforms:

```javascript
analytics.appendToUserTraits('completed_games', 'game_001');
```

## Auto-Enrichment

All `track()` calls automatically include:
- `harness: true`
- `mathai_platform` — `'web'`, `'ios'`, or `'android'` (from user agent)
- `region` — from AnalyticsConfig (default: `'in'`)
- `current_href` — `window.location.href`

All `identify()` calls automatically include:
- `profile_id` — same as `traits.id`
- `profile_id_with_region` — `{id}_{region}`
- `region` and `mathai_platform`

## Distinct ID Generation

Three-level fallback priority:
1. `traits.distinct_id` (if provided explicitly)
2. `{mobile}_{name_lowercase}_{id}` (if all three present; name lowercased, spaces → underscores)
3. `{id}_{region}` (default fallback)

## Fallback Mode

If all SDKs fail to load during `init()`, AnalyticsManager enables **fallback mode** and sends events to a server-side endpoint via `navigator.sendBeacon()` (or `fetch` with `keepalive`). This ensures analytics are not lost even when CDN scripts fail.

## SDK Init Retry Logic

Each SDK (Mixpanel, Amplitude, CleverTap) is loaded with up to 3 retry attempts and exponential backoff (1s, 2s). Failures are captured to Sentry.

## Best Practices

- Always check `if (analytics)` before tracking (graceful degradation)
- Use consistent snake_case event names
- Include question_number (1-based) in all question events
- Track submission BEFORE validation, evaluation AFTER
- Don't over-track — meaningful events only, not mouse moves

## Verification

- [ ] **Both** `config.js` AND `index.js` script tags included (config FIRST)
- [ ] `waitForPackages()` checks `AnalyticsManager`
- [ ] `analytics.init()` called after `FeedbackManager.init()`
- [ ] `window.analyticsManager` set for StoriesComponent integration
- [ ] `analytics.identify()` called after `game_init` with student data (requires `id`)
- [ ] All 7 mandatory events tracked at correct trigger points
- [ ] Game lifecycle events (started, paused, resumed, completed) tracked
- [ ] Graceful degradation if analytics not available

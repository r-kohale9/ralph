# Pattern 7: Text/Number Input

### Description

Student types an answer and submits via Enter key or Submit button.

### Identification

- "type your answer", "enter the number", "fill in the blank"

### Event Handling

```javascript
function renderInput() {
  var html = '<input type="text" inputmode="numeric" pattern="[0-9]*" '
    + 'id="answer-input" placeholder="Type your answer" '
    + 'autocomplete="off" style="font-size: 16px;">'
    + '<button class="game-btn btn-primary" id="submit-btn">Submit</button>';
  document.getElementById('input-area').innerHTML = html;

  document.getElementById('answer-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  document.getElementById('submit-btn').addEventListener('click', function() {
    handleSubmit();
  });

  // Keyboard visibility — keep question visible
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      var input = document.activeElement;
      if (input && input.tagName === 'INPUT') {
        var question = document.querySelector('.question-text');
        if (question) {
          question.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }
}

async function handleSubmit() {
  var input = document.getElementById('answer-input');
  var value = input.value.trim();
  if (!value) return;
  if (!gameState.isActive || gameState.isProcessing || gameState.gameEnded) return;

  gameState.isProcessing = true;
  input.blur(); // Dismiss keyboard

  var round = getRounds()[gameState.currentRound];
  var isCorrect = value === String(round.answer);

  // Visual feedback
  input.classList.add(isCorrect ? 'input-correct' : 'input-wrong');

  // State + data
  if (isCorrect) gameState.score++;
  else if (gameState.totalLives > 0) gameState.lives--;
  syncDOM();
  if (progressBar) progressBar.update(gameState.progress, Math.max(0, gameState.lives));

  recordAttempt({ /* 12 fields */ });
  trackEvent('answer_submitted', { round: gameState.currentRound, isCorrect: isCorrect });

  // Audio — SINGLE-STEP: SFX → TTS, both awaited
  try {
    if (isCorrect) {
      await FeedbackManager.sound.play('correct_sound_effect', { sticker: CORRECT_STICKER });
      await FeedbackManager.playDynamicFeedback({
        audio_content: round.feedbackCorrect,
        subtitle: round.feedbackCorrect,
        sticker: CORRECT_STICKER
      });
    } else {
      if (gameState.totalLives > 0 && gameState.lives <= 0) {
        gameState.isProcessing = false;
        endGame('game_over');
        return;
      }
      await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: INCORRECT_STICKER });
      await FeedbackManager.playDynamicFeedback({
        audio_content: round.feedbackWrong || 'The answer is ' + round.answer,
        subtitle: round.feedbackWrong || 'The answer is ' + round.answer,
        sticker: INCORRECT_STICKER
      });
    }
  } catch (e) {}

  gameState.isProcessing = false;
  input.value = '';
  input.classList.remove('input-correct', 'input-wrong');

  gameState.currentRound++;
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame('victory');
  } else {
    loadRound();
  }
}
```

### CSS

```css
#answer-input {
  font-size: 16px; /* Prevents iOS zoom */
  padding: 12px 16px;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 8px;
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
}
#answer-input:focus { border-color: var(--mathai-blue); outline: none; }
.input-correct { border-color: var(--mathai-green); background: var(--mathai-light-green); }
.input-wrong { border-color: var(--mathai-red); background: var(--mathai-light-red); }
```

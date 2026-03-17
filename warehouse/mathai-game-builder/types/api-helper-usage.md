# APIHelper Usage Guide

Complete guide for using APIHelper - MathAI Core API communication system.

## What is APIHelper?

**APIHelper** handles all communication between MathAI games and the backend API. It provides methods for submitting game session results, configuring API endpoints, and managing error handling.

## Why Use APIHelper?

- **Backend Communication**: Send game results to the MathAI Core API
- **Session Tracking**: Store complete game session data for analytics
- **Error Handling**: Graceful handling of network issues and API errors
- **Configurable**: Flexible endpoint and header configuration

## 🚨 MANDATORY Usage

**APIHelper is MANDATORY for ALL games.** Every game must submit session data to the backend.

## Installation

Load Helpers package via CDN (includes APIHelper):

```html
<!-- MANDATORY: Load Helpers package -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**What's included in Helpers package:**
- APIHelper
- VisibilityTracker
- Automatic package loading and initialization

**Available globally:**
- `APIHelper` - Direct class access
- `MathAIHelpers.APIHelper` - Namespaced access

## Quick Start

### Basic Usage

```javascript
// Create APIHelper instance
const api = new APIHelper({
  timeout: 10000
});

// Set up error handling
api.onError((error) => {
  console.error('API Error:', error);
  // Show user-friendly error message
});

// Submit game results (uses default endpoint from config)
const gameResults = {
  session_id: 'session_1234567890',
  game_id: 'math_quiz_game',
  metrics: {
    score: 85,
    time: 240,
    accuracy: 85,
    completed: true
  },
  attempts: [
    { question_id: 1, correct: true, time: 12, answer: '8' },
    { question_id: 2, correct: false, time: 18, answer: '6' },
    { question_id: 3, correct: true, time: 8, answer: '12' }
  ],
  completed_at: Date.now(),
  user_id: 'user_123',
  content_set_id: 'math_basics'
};

api.submitResults(gameResults)
  .then(response => console.log('Results submitted:', response))
  .catch(error => console.error('Submission failed:', error));

// Submit game results to the standard game sessions endpoint
api.submitResults(gameResults)
  .then(response => console.log('Game results submitted:', response))
  .catch(error => console.error('Submission failed:', error));

// Get current user's student data
api.getStudentData()
  .then(studentData => console.log('Student data:', studentData))
  .catch(error => console.error('Failed to get student data:', error));

// Get specific student's data by user ID
api.getStudentData('user_12345')
  .then(studentData => console.log('Specific student data:', studentData))
  .catch(error => console.error('Failed to get student data:', error));
```

### Complete Game Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>MathAI Game</title>
</head>
<body>
  <!-- Game content -->

  <!-- Load MathAI packages -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

  <script>
    // Global API instance
    let api = null;

    // Wait for packages and initialize
    async function initializeGame() {
      // Wait for helpers package
      await waitForPackages();

      // Initialize API
      api = new APIHelper();

      api.onError((error) => {
        console.error('🚨 API Error:', error);
        // Show error to user
        showErrorMessage('Failed to save game results. Please try again.');
      });

      // Start game
      startGame();
    }

    function submitGameResults(finalScore, attempts, timeTaken) {
      const payload = {
        session_id: generateSessionId(),
        game_id: 'my_math_game',
        metrics: {
          score: finalScore,
          time: timeTaken,
          accuracy: calculateAccuracy(attempts),
          completed: true
        },
        attempts: attempts,
        completed_at: Date.now()
      };

      return api.submitResults(payload);
    }

    // Initialize when page loads
    window.addEventListener('load', initializeGame);
  </script>
</body>
</html>
```

## Configuration Options

### APIHelperConfig

```typescript
interface APIHelperConfig {
  baseUrl?: string;        // API base URL
  timeout?: number;        // Request timeout in ms (default: 10000)
  headers?: Record<string, string>;  // Default headers for all requests
  endpoint?: string;       // API endpoint path (default: '/api/analytics/game-sessions')
}
```

### Dynamic Configuration

```javascript
const api = new APIHelper();

// Update configuration
api.configure({
  baseUrl: 'https://api.production.mathai.com',
  headers: {
    'Authorization': 'Bearer ' + authToken,
    'X-API-Key': 'your-api-key'
  },
  timeout: 15000
});

// Get current configuration
const config = api.getConfig();
console.log('Current config:', config);
```

## Game Session Payload

### Required Structure

```typescript
interface GameSessionPayload {
  session_id: string;      // Unique session identifier
  game_id: string;         // Game identifier
  metrics: GameMetrics;    // Final game metrics
  attempts: AttemptRecord[]; // Attempt history
  completed_at: number;    // Completion timestamp (ms)
  user_id?: string;        // Optional: User identifier
  content_set_id?: string; // Optional: Content set identifier
}
```

### GameMetrics

```typescript
interface GameMetrics {
  score?: number;          // Final score (0-100, etc.)
  time?: number;           // Total time taken (seconds)
  accuracy?: number;       // Accuracy percentage (0-100)
  completed?: boolean;     // Whether game was completed
  retries?: number;        // Number of retries/attempts
  [key: string]: any;      // Custom metrics
}
```

### AttemptRecord

```typescript
interface AttemptRecord {
  question_id?: string | number;  // Question identifier
  correct: boolean;               // Whether answer was correct
  time: number;                   // Time taken for attempt (seconds)
  answer?: any;                   // User's answer
  [key: string]: any;             // Additional metadata
}
```

## Error Handling

### Setting Up Error Callbacks

```javascript
const api = new APIHelper();

// Register error handler
api.onError((error) => {
  console.error('API Error occurred:', error);

  // Show user-friendly message
  if (error.message.includes('timeout')) {
    showMessage('Request timed out. Please check your connection.');
  } else if (error.message.includes('network')) {
    showMessage('Network error. Please try again.');
  } else {
    showMessage('An error occurred. Please try again.');
  }
});
```

### Common Error Scenarios

```javascript
// Handle submission errors gracefully
async function submitResults(payload) {
  try {
    const response = await api.submitResults(payload);
    console.log('✅ Results submitted successfully');
    return response;
  } catch (error) {
    console.error('❌ Failed to submit results:', error);

    // Store locally for retry later
    localStorage.setItem('pendingResults', JSON.stringify(payload));

    // Show retry option to user
    showRetryButton();

    throw error;
  }
}
```

## Methods Reference

### constructor(config?: APIHelperConfig)

Create a new APIHelper instance.

```javascript
const api = new APIHelper({
  timeout: 10000
});
```

### submitResults(payload: GameSessionPayload): Promise<any>

Submit game session results to the backend.

```javascript
const response = await api.submitResults({
  session_id: 'session_123',
  game_id: 'math_game',
  metrics: { score: 95, time: 120 },
  attempts: [],
  completed_at: Date.now()
});
```

### getStudentData(): Promise<any>

Get student data from backend (TODO: implement when endpoint available).

```javascript
// Currently returns null - placeholder for future implementation
const studentData = await api.getStudentData();
```

### onError(callback: (error: Error) => void): void

Register an error callback function.

```javascript
api.onError((error) => {
  console.error('API Error:', error);
  // Handle error (show message, retry, etc.)
});
```

### configure(newConfig: Partial<APIHelperConfig>): void

Update API configuration.

```javascript
api.configure({
  baseUrl: 'https://new-api.mathai.com',
  headers: { 'Authorization': 'Bearer token123' }
});
```

### getConfig(): APIHelperConfig

Get current API configuration.

```javascript
const config = api.getConfig();
console.log('Base URL:', config.baseUrl);
console.log('Timeout:', config.timeout);
```

## Integration Examples

### With Game Completion

```javascript
class MathGame {
  constructor() {
    this.api = null;
    this.attempts = [];
    this.startTime = null;
  }

  async initialize() {
    // Wait for packages
    await this.waitForPackages();

    // Initialize API
    this.api = new APIHelper();
    this.api.onError((error) => this.handleAPIError(error));
  }

  startGame() {
    this.startTime = Date.now();
    this.attempts = [];
  }

  recordAttempt(questionId, correct, time, answer) {
    this.attempts.push({
      question_id: questionId,
      correct: correct,
      time: time,
      answer: answer
    });
  }

  async endGame(finalScore) {
    const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);

    const payload = {
      session_id: this.generateSessionId(),
      game_id: 'math_quiz',
      metrics: {
        score: finalScore,
        time: timeTaken,
        accuracy: this.calculateAccuracy(),
        completed: true
      },
      attempts: this.attempts,
      completed_at: Date.now()
    };

    try {
      await this.api.submitResults(payload);
      console.log('🎉 Game results submitted successfully!');
      this.showSuccessMessage();
    } catch (error) {
      console.error('❌ Failed to submit results');
      this.showErrorMessage();
    }
  }

  calculateAccuracy() {
    if (this.attempts.length === 0) return 0;
    const correct = this.attempts.filter(a => a.correct).length;
    return Math.round((correct / this.attempts.length) * 100);
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  handleAPIError(error) {
    // Show user-friendly error
    this.showErrorMessage('Failed to save your progress. Please try again.');
  }
}
```

### With Retry Logic

```javascript
class ResilientAPIHelper {
  constructor(baseConfig = {}) {
    this.api = new APIHelper(baseConfig);
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second

    this.api.onError((error) => {
      console.error('API Error:', error);
    });
  }

  async submitWithRetry(payload, attempt = 1) {
    try {
      return await this.api.submitResults(payload);
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(`Retry ${attempt}/${this.maxRetries} in ${this.retryDelay}ms...`);

        await this.delay(this.retryDelay);
        this.retryDelay *= 2; // Exponential backoff

        return this.submitWithRetry(payload, attempt + 1);
      } else {
        console.error('All retry attempts failed');
        throw error;
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const resilientAPI = new ResilientAPIHelper();
await resilientAPI.submitWithRetry(gamePayload);
```

## Best Practices

### Session ID Generation

```javascript
function generateSessionId() {
  // Format: session_{timestamp}_{random}
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `session_${timestamp}_${random}`;
}

// Example: session_1640995200000_abc123def
const sessionId = generateSessionId();
```

### Payload Validation

```javascript
function validateGamePayload(payload) {
  const required = ['session_id', 'game_id', 'metrics', 'attempts', 'completed_at'];

  for (const field of required) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(payload.attempts)) {
    throw new Error('attempts must be an array');
  }

  if (typeof payload.completed_at !== 'number') {
    throw new Error('completed_at must be a timestamp number');
  }

  return true;
}

// Use before submission
if (validateGamePayload(payload)) {
  await api.submitResults(payload);
}
```

### Error Recovery

```javascript
class GameSessionManager {
  constructor() {
    this.pendingSubmissions = [];
    this.loadPendingSubmissions();
  }

  // Store failed submissions for retry
  storePendingSubmission(payload) {
    this.pendingSubmissions.push({
      payload,
      timestamp: Date.now(),
      attempts: 0
    });
    localStorage.setItem('pendingSubmissions', JSON.stringify(this.pendingSubmissions));
  }

  // Retry pending submissions
  async retryPendingSubmissions() {
    const successful = [];
    const failed = [];

    for (const item of this.pendingSubmissions) {
      try {
        await api.submitResults(item.payload);
        successful.push(item);
      } catch (error) {
        item.attempts++;
        if (item.attempts < 3) {
          // Keep for another retry
        } else {
          failed.push(item);
        }
      }
    }

    // Update storage
    this.pendingSubmissions = this.pendingSubmissions.filter(item => !successful.includes(item));
    localStorage.setItem('pendingSubmissions', JSON.stringify(this.pendingSubmissions));

    console.log(`Retried: ${successful.length} successful, ${failed.length} failed`);
  }

  loadPendingSubmissions() {
    const stored = localStorage.getItem('pendingSubmissions');
    if (stored) {
      this.pendingSubmissions = JSON.parse(stored);
    }
  }
}
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| APIHelper is undefined | Helpers package not loaded | Ensure helpers/index.js is loaded before using APIHelper |
| submitResults fails | Network error | Check network connection, retry with exponential backoff |
| Timeout errors | Slow network | Increase timeout in configuration |
| Invalid payload | Missing required fields | Validate payload before submission |
| CORS errors | Wrong baseUrl | Ensure baseUrl matches API server |

## Testing

### Unit Testing APIHelper

```javascript
// Mock fetch for testing
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true })
  })
);

describe('APIHelper', () => {
  let api;

  beforeEach(() => {
    api = new APIHelper({ baseUrl: 'http://test.com' });
  });

  test('submits results successfully', async () => {
    const payload = {
      session_id: 'test_session',
      game_id: 'test_game',
      metrics: { score: 100 },
      attempts: [],
      completed_at: Date.now()
    };

    const response = await api.submitResults(payload);
    expect(response.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://test.com/api/analytics/game-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload)
      })
    );
  });
});
```

### Integration Testing

```javascript
describe('Game Integration', () => {
  test('completes full game flow', async () => {
    // Mock API
    const mockAPI = {
      submitResults: jest.fn().mockResolvedValue({ id: 'session_123' })
    };

    // Create game instance
    const game = new MathGame();
    game.api = mockAPI;

    // Simulate game play
    game.startGame();
    game.recordAttempt(1, true, 10, '42');
    game.recordAttempt(2, false, 15, '43');
    await game.endGame(85);

    // Verify API was called correctly
    expect(mockAPI.submitResults).toHaveBeenCalledWith(
      expect.objectContaining({
        game_id: 'math_quiz',
        metrics: expect.objectContaining({
          score: 85,
          accuracy: 50 // 1 out of 2 correct
        }),
        attempts: expect.arrayContaining([
          expect.objectContaining({ question_id: 1, correct: true }),
          expect.objectContaining({ question_id: 2, correct: false })
        ])
      })
    );
  });
});
```

## Migration from Local API Helper

If migrating from the old local `api-helper.js`:

### Before (old way):
```javascript
// Local api-helper.js
const api = (function() {
  // Local implementation
})();

// Usage
api.submitResults(payload);
```

### After (new way):
```javascript
// Load helpers package
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

// Initialize after packages load
let api = null;

async function initialize() {
  await waitForPackages();
  api = new APIHelper();
  // Now use api.submitResults(payload)
}

function waitForPackages() {
  return new Promise(resolve => {
    const check = () => {
      if (window.MathAIHelpers && window.APIHelper) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
```

## Related Documentation

- **FeedbackManager**: `feedback-manager-usage.md` - Audio and visual feedback
- **VisibilityTracker**: `visibility-tracker-usage.md` - Tab visibility tracking
- **TimerComponent**: `timer-component-usage.md` - Game timing
- **Main Guide**: `../SKILL.md` - Complete game development workflow

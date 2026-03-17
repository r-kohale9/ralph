# Case Converter

## Overview

The Case Converter Helper provides utilities to convert between JavaScript's camelCase and database snake_case naming conventions. This ensures seamless data exchange between frontend games and the backend database.

**Location:** `/assets/game-template/helpers/case-converter.js`

## Why It's Critical

**Frontend (JavaScript):** Uses `camelCase` for variable names
```javascript
const userData = {
  firstName: "John",
  lastName: "Doe",
  userId: 123
};
```

**Backend (Database):** Uses `snake_case` for column names
```sql
CREATE TABLE users (
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  user_id INT
);
```

**Without conversion:**
- Backend receives `{ firstName: "John" }` but expects `{ first_name: "John" }`
- Frontend receives `{ first_name: "John" }` but expects `{ firstName: "John" }`
- **Result:** Data doesn't map correctly, errors occur

**With Case Converter:**
- Automatically converts data format in both directions
- Games send camelCase, converter changes to snake_case
- Backend sends snake_case, converter changes to camelCase
- **Result:** Seamless data flow

## Methods

### `toSnakeCase(obj)`

Convert camelCase to snake_case recursively.

**Parameters:**
- `obj: any` - Object, array, or primitive to convert

**Returns:** `any` - Converted object with snake_case keys

**Example:**
```javascript
const frontendData = {
  userName: "Alice",
  userId: 456,
  scoreData: {
    totalScore: 95,
    maxScore: 100
  }
};

const backendData = toSnakeCase(frontendData);
console.log(backendData);
// {
//   user_name: "Alice",
//   user_id: 456,
//   score_data: {
//     total_score: 95,
//     max_score: 100
//   }
// }
```

**Handles:**
- Nested objects (recursive)
- Arrays (maps over items)
- Primitives (returned as-is)
- Date objects (preserved)
- null/undefined (returned as-is)

### `toCamelCase(obj)`

Convert snake_case to camelCase recursively.

**Parameters:**
- `obj: any` - Object, array, or primitive to convert

**Returns:** `any` - Converted object with camelCase keys

**Example:**
```javascript
const backendData = {
  user_name: "Bob",
  user_id: 789,
  game_results: {
    total_questions: 10,
    correct_answers: 8
  }
};

const frontendData = toCamelCase(backendData);
console.log(frontendData);
// {
//   userName: "Bob",
//   userId: 789,
//   gameResults: {
//     totalQuestions: 10,
//     correctAnswers: 8
//   }
// }
```

**Handles:**
- Nested objects (recursive)
- Arrays (maps over items)
- Primitives (returned as-is)
- Date objects (preserved)
- null/undefined (returned as-is)

### `logTransformation(label, before, after)`

Log object transformation for debugging.

**Parameters:**
- `label: string` - Description of the transformation
- `before: any` - Object before conversion
- `after: any` - Object after conversion

**Example:**
```javascript
const original = { userName: "Charlie", userId: 999 };
const converted = toSnakeCase(original);

logTransformation("Preparing data for API", original, converted);

// Console output:
// 🔄 Preparing data for API
// Before: {
//   "userName": "Charlie",
//   "userId": 999
// }
// After: {
//   "user_name": "Charlie",
//   "user_id": 999
// }
```

## Usage Examples

### Sending Data to Backend

```javascript
async function submitGameResults() {
  // Game data in camelCase
  const results = {
    gameId: "math-quiz-001",
    studentId: "student_123",
    sessionData: {
      totalQuestions: 10,
      correctAnswers: 8,
      timeTaken: 245,
      attemptList: [
        { questionNumber: 1, isCorrect: true, timeSpent: 15 },
        { questionNumber: 2, isCorrect: false, timeSpent: 30 }
      ]
    }
  };

  // Convert to snake_case for backend
  const backendFormat = toSnakeCase(results);

  // Now ready to send
  await api.submitResults(backendFormat);
  // Backend receives:
  // {
  //   game_id: "math-quiz-001",
  //   student_id: "student_123",
  //   session_data: {
  //     total_questions: 10,
  //     correct_answers: 8,
  //     time_taken: 245,
  //     attempt_list: [...]
  //   }
  // }
}
```

### Receiving Data from Backend

```javascript
async function loadStudentProfile() {
  // Fetch from backend
  const response = await fetch('/api/student/profile');
  const backendData = await response.json();

  // Backend sends snake_case:
  // {
  //   student_id: "student_123",
  //   first_name: "Emma",
  //   last_name: "Wilson",
  //   grade_level: 5,
  //   recent_scores: [85, 90, 88]
  // }

  // Convert to camelCase for frontend
  const studentProfile = toCamelCase(backendData);

  // Now can use with JavaScript conventions
  console.log(`Welcome ${studentProfile.firstName}!`);
  console.log(`Average: ${calculateAverage(studentProfile.recentScores)}`);
}
```

### Round-Trip Conversion

```javascript
// Frontend creates data
const gameState = {
  currentLevel: 3,
  playerScore: 250,
  itemsCollected: ["star", "coin", "gem"]
};

// Save to backend (convert to snake_case)
const saveData = toSnakeCase(gameState);
await api.saveGame(saveData);

// Later, load from backend
const loadedData = await api.loadGame();

// Convert back to camelCase
const restoredState = toCamelCase(loadedData);

// State is restored in frontend format
console.log(restoredState.currentLevel);  // 3
console.log(restoredState.playerScore);   // 250
```

### Debugging Transformations

```javascript
// Before sending important data, verify conversion
const attemptData = {
  questionNumber: 5,
  userAnswer: "42",
  correctAnswer: "42",
  isCorrect: true,
  timeSpent: 12
};

const converted = toSnakeCase(attemptData);

// Log to verify conversion is correct
logTransformation("Submitting attempt", attemptData, converted);

// Send only after verification
await api.recordAttempt(converted);
```

## How It Works

### toSnakeCase Algorithm

```javascript
function toSnakeCase(obj) {
  // 1. Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // 2. Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item));
  }

  // 3. Handle Date objects (don't convert)
  if (obj instanceof Date) {
    return obj;
  }

  // 4. Handle plain objects
  return Object.keys(obj).reduce((acc, key) => {
    // Convert key: myVarName → my_var_name
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

    // Recursively convert value
    acc[snakeKey] = toSnakeCase(obj[key]);

    return acc;
  }, {});
}
```

**Key Conversion Examples:**
- `userName` → `user_name`
- `totalScore` → `total_score`
- `isCorrect` → `is_correct`
- `APIKey` → `a_p_i_key`

### toCamelCase Algorithm

```javascript
function toCamelCase(obj) {
  // 1. Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // 2. Handle arrays recursively
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  }

  // 3. Handle Date objects (don't convert)
  if (obj instanceof Date) {
    return obj;
  }

  // 4. Handle plain objects
  return Object.keys(obj).reduce((acc, key) => {
    // Convert key: my_var_name → myVarName
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    // Recursively convert value
    acc[camelKey] = toCamelCase(obj[key]);

    return acc;
  }, {});
}
```

**Key Conversion Examples:**
- `user_name` → `userName`
- `total_score` → `totalScore`
- `is_correct` → `isCorrect`
- `a_p_i_key` → `aPIKey`

## Edge Cases Handled

### Arrays

```javascript
const data = {
  players: [
    { playerName: "Alice", playerId: 1 },
    { playerName: "Bob", playerId: 2 }
  ]
};

toSnakeCase(data);
// {
//   players: [
//     { player_name: "Alice", player_id: 1 },
//     { player_name: "Bob", player_id: 2 }
//   ]
// }
```

### Nested Objects

```javascript
const nested = {
  gameData: {
    userInfo: {
      firstName: "Charlie",
      lastName: "Brown"
    }
  }
};

toSnakeCase(nested);
// {
//   game_data: {
//     user_info: {
//       first_name: "Charlie",
//       last_name: "Brown"
//     }
//   }
// }
```

### Primitives and Special Values

```javascript
toSnakeCase(null);        // null
toSnakeCase(undefined);   // undefined
toSnakeCase(42);          // 42
toSnakeCase("hello");     // "hello"
toSnakeCase(true);        // true
toSnakeCase(new Date());  // Date object (unchanged)
```

### Mixed Arrays

```javascript
const mixed = {
  values: [1, "text", { itemName: "Star" }, null]
};

toSnakeCase(mixed);
// {
//   values: [1, "text", { item_name: "Star" }, null]
// }
```

## Best Practices

1. **Convert at API boundary** - Not throughout the code
   ```javascript
   // ✅ Good
   const data = prepareGameData();
   await api.send(toSnakeCase(data));

   // ❌ Bad (don't convert everywhere)
   const snakeData = toSnakeCase(prepareGameData());
   const moreSnakeData = toSnakeCase(snakeData);  // Already converted!
   ```

2. **Log conversions during debugging**
   ```javascript
   const converted = toSnakeCase(data);
   logTransformation("API Request", data, converted);
   await api.send(converted);
   ```

3. **Verify both directions**
   ```javascript
   const original = { userName: "Test" };
   const snake = toSnakeCase(original);      // { user_name: "Test" }
   const restored = toCamelCase(snake);      // { userName: "Test" }
   console.log(restored);  // Should match original
   ```

4. **Handle API responses consistently**
   ```javascript
   async function fetchData() {
     const response = await api.get('/data');
     return toCamelCase(response);  // Always convert responses
   }
   ```

## Module Exports

The helper works in both browser and Node.js:

```javascript
// Browser (global scope)
console.log(typeof toSnakeCase);  // "function"

// Node.js (CommonJS)
const { toSnakeCase, toCamelCase } = require('./case-converter');
```

## Related Documentation

- [API Helper](./api-helper.md) - Uses case conversion for API calls
- [Tracker Helper](./tracker-helper.md) - Data format for tracking
- [Architecture](../reference/architecture.md) - System overview

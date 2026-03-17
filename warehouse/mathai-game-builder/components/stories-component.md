# StoriesComponent v2.0.0

A comprehensive component for building sequential story-based experiences with GraphQL integration, fullscreen mode, edge navigation, and compute functions.

## Overview

**StoriesComponent v2.0.0** is a powerful component for creating interactive story sequences with:

- **GraphQL Integration**: Automatically fetches story data from Hasura by story block ID
- **Fullscreen Mode**: Immersive experience (100vw × 100vh, max-width: 480px, centered)
- **Edge Navigation**: Instagram/Snapchat-style left/right edge tap to navigate (120px × 70% height)
- **Sequential Navigation**: Compute-based branching with dynamic story flow
- **Story JSON Format**: v2_story format with data.children array structure
- **Global Context**: Shared variables across stories (value_map)
- **Compute Functions**: JavaScript functions for dynamic navigation logic
- **Interactive Elements**: Buttons, inputs, avatars, images, videos, rich text
- **Button Actions**: Internal (compute function) and external (URL navigation)
- **Duration Tracking**: Per-story time tracking with tab visibility handling
- **Responsive Positioning**: 412×732 reference canvas with automatic scaling
- **Event Callbacks**: All interactions trigger callbacks

Perfect for educational content, interactive tutorials, branching narratives, onboarding flows, and dynamic story experiences.

---

## Installation

Load the component via CDN:

```html
<!-- Load Components package (includes StoriesComponent) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

The component will be available via `window.MathAIComponents.StoriesComponent`.

## GraphQL Configuration

The component uses hardcoded GraphQL settings:

- **Endpoint**: `https://qa.graphql.sets.hmwrk.app/v1/graphql`
- **Secret**: `ultimate` (via `x-hasura-admin-secret` header)

Story blocks are fetched using:

```graphql
query GetStoryBlock($id: Int!) {
  blocks: worksheet_block_by_pk(id: $id) {
    id
    backend
    data
    type
    __typename
    parent_id
  }
}
```

---

## Story JSON Format

The component fetches story data automatically from GraphQL. The returned format follows the v2_story structure:

### Story Block Structure

```javascript
{
  "data": {
    "children": [
      {
        "id": "story_1",
        "data": {
          "v2_story": {
            "name": "intro",
            "background": {
              "type": "VIDEO",        // VIDEO, IMAGE, or SOLID_COLOR
              "value": "url",         // URL for video/image or color hex
              "loop": false           // Loop video/audio
            },
            "logic": {
              "compute_functions": [
                {
                  "name": "getNextStory",
                  "output": "function getNextStory(history, inputs, global_context_variables) { return 'next'; }"
                }
              ]
            }
          },
          "children": [
            // Story elements (buttons, inputs, etc.)
          ],
          "other": {
            "audio": "",
            "duration": -1
          }
        },
        "type": "v2_story"
      }
    ]
  }
}
```

### v2_story.background Object

Background configuration for the story:

```javascript
{
  "background": {
    "type": "VIDEO",              // VIDEO, IMAGE, or SOLID_COLOR
    "value": "https://...",       // URL or hex color (#667eea)
    "loop": false,                // Whether to loop video (default: true)
    "default": ""                 // Fallback color while loading
  }
}
```

### v2_story.logic.compute_functions Array

Compute functions for dynamic navigation:

```javascript
{
  "logic": {
    "compute_functions": [
      {
        "name": "getNextStory",
        "label": "Get Next Story",
        "output": "function getNextStory(history, inputs, global_context_variables) { return 'next'; }",
        "params": [],
        "isGlobal": true
      }
    ]
  }
}
```

The `getNextStory` function receives:
- `history`: Array of visited story names
- `inputs`: Object with button/input values (e.g., `{ button_name: true }`)
- `global_context_variables`: Shared state across stories

### data.children Array

Elements use a nested structure with positioning via `other.position` and `other.size`:

#### Button Element

```javascript
{
  "type": "button",
  "data": {
    "name": "next_btn",
    "button": {
      "text": "Continue",
      "color": "#ffffff",
      "background_color": "#3927ff",
      "font_size": "18",
      "font_weight": "600",
      "action": {
        "type": "internal",      // "internal" or "external"
        "value": "",             // URL for external actions
        "open_in_same_tab": true // Only for external actions
      }
    }
  },
  "other": {
    "position": { "top": 648, "left": 0 },    // Position on 412×732 canvas
    "size": { "width": 412, "height": 84 }    // Size on 412×732 canvas
  }
}
```

**Button Actions:**
- `type: "internal"` → Calls `getNextStory` compute function with `{ [button_name]: true }`
- `type: "external"` → Navigates to URL
  - If `open_in_same_tab: true` → Same tab navigation (`window.location.href`)
  - Otherwise → New tab (`window.open(..., '_blank')`)

#### Input Element

```javascript
{
  "type": "input",
  "data": {
    "name": "user_email",
    "input": {
      "placeholder": "Enter email",
      "input_type": "email",
      "font_size": "16",
      "color": "#333333",
      "background_color": "#ffffff"
    }
  },
  "other": {
    "position": { "top": 200, "left": 50 },
    "size": { "width": 312, "height": 50 }
  }
}
```

Input values are automatically stored in `global_context_variables` and accessible in compute functions.

### Positioning System

All elements use a **412 × 732px reference canvas** that automatically scales to the viewport:

- **position**: `{ top, left }` in pixels from top-left corner
- **size**: `{ width, height }` in pixels
- Component automatically converts to percentages based on actual viewport size

---

## Basic Usage

### Minimal Example

The component automatically fetches story data from GraphQL using the story block ID:

```html
<div id="story-container"></div>

<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<script>
  const { StoriesComponent } = window.MathAIComponents;

  // Initialize with story block ID
  const stories = new StoriesComponent('story-container', {
    storyBlockId: 273291,  // Story block ID (required)
    showProgress: true,
    trackDuration: true,
    onComplete: (data) => {
      console.log('Stories complete!', data);
      stories.destroy();
    }
  });
</script>
```

### Fullscreen Behavior

When initialized, the component automatically:
- Takes over entire viewport (100vw × 100vh)
- Centers with max-width of 480px
- Applies `position: fixed` with `z-index: 9999`
- Hides on `destroy()`

### Edge Navigation

Users can navigate between stories by tapping the screen edges:
- **Left edge**: 120px × 70% height (starting at 20vh) → Previous story
- **Right edge**: 120px × 70% height (starting at 20vh) → Next story

Navigation areas are transparent and do not interfere with buttons or other interactive elements.

### Full Example with All Features

```javascript
const { StoriesComponent } = window.MathAIComponents;

const stories = new StoriesComponent('story-container', {
  storyBlockId: 273291,              // Required: Story block ID

  // Initial global context (optional)
  globalContext: {
    value_map: {
      player_name: "Alex",
      score: 0
    }
  },

  // Configuration
  trackDuration: true,               // Track time per story
  pauseOnTabSwitch: true,            // Pause when tab hidden
  enableAudio: true,                 // Enable audio playback
  showProgress: true,                // Show progress indicator

  // Callbacks
  onStoryChange: (index, direction, story) => {
    console.log(`Now on story: ${story.name}, direction: ${direction}`);
  },
  onComplete: (data) => {
    console.log("All stories completed!", data);
  },
  onButtonClick: (name, action, storyIndex) => {
    console.log(`Button ${name} clicked on story ${storyIndex}`);
  },
  onInputChange: (name, value, storyIndex) => {
    console.log(`Input ${name} changed to: ${value}`);
  },
  onError: (error) => {
    console.error("Story error:", error);
  }
});
```

---

## Configuration Options

| Option              | Type       | Default | Description                                      |
| ------------------- | ---------- | ------- | ------------------------------------------------ |
| `storyBlockId`      | `Number`   | `null`  | Story block ID to fetch from GraphQL (required)  |
| `globalContext`     | `Object`   | `{}`    | Initial global variables (value_map format)      |
| `analyticsContext`  | `Object`   | `{}`    | Analytics properties (activity_type, parent_id, etc.) |
| `analytics`         | `Object`   | `null`  | AnalyticsManager instance (or use window.analyticsManager) |
| `trackDuration`     | `Boolean`  | `true`  | Track time spent per story and total             |
| `pauseOnTabSwitch`  | `Boolean`  | `true`  | Pause when user switches tabs                    |
| `preloadAssets`     | `Boolean`  | `true`  | Preload video/audio durations                    |
| `enableAudio`       | `Boolean`  | `true`  | Enable audio integration with FeedbackManager    |
| `showProgress`      | `Boolean`  | `true`  | Display progress bar (always `true`, cannot be disabled) |
| `onStoryChange`     | `Function` | `null`  | `(index, direction, story) => {}`                |
| `onComplete`        | `Function` | `null`  | `(data) => {}`                                   |
| `onButtonClick`     | `Function` | `null`  | `(name, action, storyIndex) => {}`               |
| `onInputChange`     | `Function` | `null`  | `(name, value, storyIndex) => {}`                |
| `onError`           | `Function` | `null`  | `(error) => {}`                                  |

---

## Story Structure Deep Dive

### 1. data.v2_story Configuration

#### Duration Types

```javascript
{
  "duration_type": "manual",  // User controls when to advance
  "duration": null
}

{
  "duration_type": "video",   // Auto-advance after video ends
  "background_video": "video.mp4"
}

{
  "duration_type": "audio",   // Auto-advance after audio ends
  "audio": "audio.mp3"
}

{
  "duration_type": "max",     // Use longest asset duration
  "background_video": "video.mp4",
  "audio": "audio.mp3"
}
```

#### Background Configuration

```javascript
{
  "background_color": "#F5F5F5",
  "background_image": "https://example.com/bg.jpg",
  "background_video": "https://example.com/bg.mp4",
  "background_audio": "https://example.com/ambient.mp3"
}
```

### 2. data.children Elements

Each child element must have a `data` object with:
- `type`: Element type (text, image, video, button, input, container, html)
- `positioning`: Position and size configuration
- Type-specific properties

### 3. data.other Metadata

Store any custom data:

```javascript
{
  "other": {
    "difficulty": "medium",
    "points": 100,
    "tags": ["math", "algebra"],
    "custom_data": {
      "nested": "value"
    }
  }
}
```

---

## Element Types

### 1. Text Element

Display text content with styling.

```javascript
{
  "data": {
    "type": "text",
    "id": "text_1",
    "name": "title",
    "text": "Welcome to the Adventure!",
    "style": {
      "fontSize": "32px",
      "fontWeight": "bold",
      "color": "#333333",
      "textAlign": "center"
    },
    "positioning": {
      "position": "absolute",
      "top": "10%",
      "left": "10%",
      "width": "80%"
    }
  }
}
```

### 2. Image Element

Display images with positioning and styling.

```javascript
{
  "data": {
    "type": "image",
    "id": "img_1",
    "name": "character",
    "src": "https://example.com/character.png",
    "alt": "Character",
    "style": {
      "borderRadius": "10px",
      "boxShadow": "0 4px 8px rgba(0,0,0,0.2)"
    },
    "positioning": {
      "position": "absolute",
      "top": "30%",
      "left": "40%",
      "width": "200px",
      "height": "200px"
    }
  }
}
```

### 3. Video Element

Embed video content with autoplay and loop options.

```javascript
{
  "data": {
    "type": "video",
    "id": "video_1",
    "name": "tutorial_video",
    "src": "https://example.com/tutorial.mp4",
    "autoplay": true,
    "loop": false,
    "muted": false,
    "positioning": {
      "position": "absolute",
      "top": "20%",
      "left": "20%",
      "width": "60%",
      "height": "400px"
    }
  }
}
```

### 4. Button Element

Interactive buttons with actions.

```javascript
{
  "data": {
    "type": "button",
    "id": "btn_1",
    "name": "next_button",
    "text": "Continue",
    "action": {
      "type": "next"    // "next", "prev", "jump", "url", "submit"
    },
    "style": {
      "backgroundColor": "#000FFF",
      "color": "#FFFFFF",
      "fontSize": "18px",
      "fontWeight": "bold",
      "borderRadius": "8px",
      "padding": "12px 24px",
      "cursor": "pointer"
    },
    "positioning": {
      "position": "absolute",
      "bottom": "10%",
      "left": "50%",
      "transform": "translateX(-50%)"
    }
  }
}
```

#### Button Actions

```javascript
// Navigate to next story (uses getNextStory if available)
{ "type": "next" }

// Navigate to previous story
{ "type": "prev" }

// Jump to specific story
{ "type": "jump", "target": "story_name_or_index" }

// Open URL
{ "type": "url", "url": "https://example.com", "target": "_blank" }

// Submit form inputs
{ "type": "submit" }
```

### 5. Input Element

Text input fields for user data.

```javascript
{
  "data": {
    "type": "input",
    "id": "input_1",
    "name": "user_answer",
    "inputType": "text",
    "placeholder": "Enter your answer...",
    "value": "",
    "style": {
      "fontSize": "16px",
      "padding": "12px",
      "border": "2px solid #CCCCCC",
      "borderRadius": "4px"
    },
    "positioning": {
      "position": "absolute",
      "top": "50%",
      "left": "25%",
      "width": "50%",
      "height": "50px"
    }
  }
}
```

### 6. Container Element

Group multiple elements together.

```javascript
{
  "data": {
    "type": "container",
    "id": "container_1",
    "name": "question_box",
    "style": {
      "backgroundColor": "#F5F5F5",
      "padding": "20px",
      "borderRadius": "12px"
    },
    "positioning": {
      "position": "absolute",
      "top": "30%",
      "left": "10%",
      "width": "80%"
    },
    "children": [
      {
        "data": {
          "type": "text",
          "text": "Question 1:"
        }
      },
      {
        "data": {
          "type": "input",
          "name": "answer"
        }
      }
    ]
  }
}
```

### 7. HTML Element

Raw HTML content for custom layouts.

```javascript
{
  "data": {
    "type": "html",
    "id": "html_1",
    "name": "custom_content",
    "html": `
      <div class="custom-layout">
        <h2>Custom HTML Content</h2>
        <p>You can include any HTML here.</p>
      </div>
    `,
    "style": {
      "padding": "20px"
    },
    "positioning": {
      "position": "absolute",
      "top": "10%",
      "left": "10%",
      "width": "80%"
    }
  }
}
```

### 8. Avatar Element

Display avatar images or videos (typically circular).

```javascript
{
  "data": {
    "type": "avatar",
    "id": "avatar_1",
    "name": "teacher_avatar",
    "src": "https://example.com/avatar.png",
    // or for video avatar:
    // "src": "https://example.com/avatar.mp4",
    "style": {
      "border": "3px solid #FFFFFF",
      "boxShadow": "0 2px 8px rgba(0,0,0,0.2)"
    },
    "positioning": {
      "position": "absolute",
      "top": "5%",
      "left": "5%",
      "width": "100px",
      "height": "100px"
    }
  }
}
```

---

## Compute Functions

### getNextStory

The `get_next_story` compute function determines dynamic navigation based on user input and context.

#### Function Signature

```javascript
function(history, inputs, global_context_variables, publishEvent) {
  // Your logic here
  return storyNameOrIndex;
}
```

#### Parameters

- `history`: Array of navigation history with inputs and context at each step
- `inputs`: Object containing all input values from the current story
- `global_context_variables`: Object with all global context variables
- `publishEvent`: Function to publish custom events `publishEvent(name, data)`

#### Return Values

The function can return:
- `string`: Story name (e.g., `"story_2"`)
- `number`: Story index (e.g., `2`)
- `object`: `{ story: "name_or_index" }`
- `null`/`undefined`: Proceeds to next sequential story

#### Examples

**Simple Branching:**

```javascript
{
  "get_next_story": `
    if (inputs.choice === 'A') {
      return 'path_a';
    } else if (inputs.choice === 'B') {
      return 'path_b';
    } else {
      return 'default_path';
    }
  `
}
```

**Score-Based Navigation:**

```javascript
{
  "get_next_story": `
    const score = global_context_variables.score || 0;

    if (score >= 90) {
      return 'expert_level';
    } else if (score >= 70) {
      return 'advanced_level';
    } else if (score >= 50) {
      return 'intermediate_level';
    } else {
      return 'beginner_level';
    }
  `
}
```

**Validation-Based Navigation:**

```javascript
{
  "get_next_story": `
    const answer = inputs.user_answer;
    const correctAnswer = global_context_variables.correct_answer;

    if (answer === correctAnswer) {
      // Update global context
      global_context_variables.score = (global_context_variables.score || 0) + 10;
      publishEvent('answer_correct', { answer, score: global_context_variables.score });
      return 'correct_feedback';
    } else {
      publishEvent('answer_incorrect', { answer, correctAnswer });
      return 'try_again';
    }
  `
}
```

**History-Based Navigation:**

```javascript
{
  "get_next_story": `
    // Check if user has visited certain stories
    const visitedStories = history.map(h => h.index);

    if (visitedStories.includes(5)) {
      return 'alternate_ending';
    }

    // Check number of attempts
    if (history.length > 10) {
      return 'hint_story';
    }

    return null; // Continue to next sequential story
  `
}
```

**Complex Multi-Condition Logic:**

```javascript
{
  "get_next_story": `
    const { difficulty, topic } = global_context_variables;
    const { quiz_score, time_spent } = inputs;

    // Determine next topic based on performance
    if (quiz_score >= 80 && time_spent < 60) {
      // Fast and accurate - advance
      return difficulty === 'easy' ? 'medium_' + topic : 'hard_' + topic;
    } else if (quiz_score < 50) {
      // Struggling - review
      return 'review_' + topic;
    } else {
      // Normal progress
      return 'practice_' + topic;
    }
  `
}
```

---

## Global Context (value_map)

The global context provides shared state across all stories.

### Initialization

```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  globalContext: {
    value_map: {
      player_name: "Alex",
      score: 0,
      level: 1,
      inventory: []
    }
  }
});
```

### Accessing in Compute Functions

```javascript
{
  "get_next_story": `
    // Read global context
    const score = global_context_variables.score || 0;
    const level = global_context_variables.level || 1;

    // Update global context
    global_context_variables.score = score + 10;
    global_context_variables.level = level + 1;

    return 'next_story';
  `
}
```

### Updating Programmatically

```javascript
// Update global context from outside
stories.updateGlobalContext({
  score: 100,
  achievements: ["first_win", "speed_demon"]
});

// Get current global context
const context = stories.getGlobalContext();
console.log(context.value_map);
```

### Use Cases

- **Player Progress**: Track score, level, achievements
- **Game State**: Inventory, unlocked items, flags
- **User Preferences**: Settings, selected difficulty
- **Session Data**: Start time, visited stories, choices made

---

## Navigation Methods

### next(inputs = {})

Navigate to the next story. Executes `getNextStory` compute function if defined.

```javascript
// Simple navigation
stories.next();

// With input data
stories.next({
  user_choice: "A",
  timestamp: Date.now()
});

// With button click (automatic)
{
  "type": "button",
  "action": { "type": "next" }
}
```

### prev()

Navigate to the previous story from history.

```javascript
stories.prev();

// With button
{
  "type": "button",
  "action": { "type": "prev" }
}
```

### jumpTo(storyNameOrIndex, inputs = {})

Jump to a specific story by name or index.

```javascript
// Jump by name
stories.jumpTo("story_quiz");

// Jump by index
stories.jumpTo(5);

// With data
stories.jumpTo("results", {
  score: 95,
  time: 120
});

// With button
{
  "type": "button",
  "action": {
    "type": "jump",
    "target": "story_name"
  }
}
```

---

## Button Actions

### Internal Actions

#### 1. Next Action

```javascript
{
  "type": "button",
  "name": "continue",
  "text": "Continue",
  "action": {
    "type": "next"
  }
}
```

#### 2. Previous Action

```javascript
{
  "type": "button",
  "name": "back",
  "text": "Go Back",
  "action": {
    "type": "prev"
  }
}
```

#### 3. Jump Action

```javascript
{
  "type": "button",
  "name": "skip",
  "text": "Skip to Quiz",
  "action": {
    "type": "jump",
    "target": "story_quiz"  // name or index
  }
}
```

#### 4. Submit Action

```javascript
{
  "type": "button",
  "name": "submit",
  "text": "Submit Answer",
  "action": {
    "type": "submit"  // Calls next() with all current inputs
  }
}
```

### External Actions

#### 5. URL Action

```javascript
{
  "type": "button",
  "name": "learn_more",
  "text": "Learn More",
  "action": {
    "type": "url",
    "url": "https://example.com/help",
    "target": "_blank"  // or "_self", "_parent", "_top"
  }
}
```

---

## Audio Integration

StoriesComponent integrates seamlessly with FeedbackManager for audio playback.

### Story Audio Configuration

```javascript
{
  "v2_story": {
    "audio": "https://example.com/narration.mp3",
    "audio_id": "story_intro",  // Reference to preloaded audio
    "duration_type": "audio"     // Auto-advance after audio ends
  }
}
```

### Preloading Audio

```javascript
// Initialize FeedbackManager
await FeedbackManager.init();

// Preload story audio
await FeedbackManager.sound.preload([
  { id: "story_intro", url: "intro.mp3" },
  { id: "story_quiz", url: "quiz.mp3" },
  { id: "story_end", url: "end.mp3" }
]);

// Initialize StoriesComponent
const stories = new StoriesComponent("container", {
  storyBlock: data,
  enableAudio: true  // Enable audio integration
});
```

### Audio Callbacks

```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  onStoryChange: (index, direction, story) => {
    // Audio automatically plays if story has audio/audio_id

    // You can also manually trigger audio
    if (story.name === "special_story") {
      FeedbackManager.sound.play("special_audio");
    }
  }
});
```

### Audio Control

The component automatically:
- Plays audio when story loads
- Stops audio when navigating away
- Pauses audio when tab is hidden (if `pauseOnTabSwitch: true`)
- Resumes audio when tab is visible

---

## Analytics Integration

StoriesComponent automatically tracks story events when analytics is available.

### Setup

```javascript
// Initialize analytics
const analytics = new AnalyticsManager();
await analytics.init();
window.analyticsManager = analytics;

// Identify user
analytics.identify({
  id: 1554,
  mobile: '7875158990',
  name: 'Rishabh',
  email: 'user@example.com'
});

// Initialize StoriesComponent with analytics context
const stories = new StoriesComponent('container', {
  storyBlockId: 293273,
  analyticsContext: {
    activity_type: 'CHALLENGE',
    parent_id: 293273,
    parent_name: 'Math Quiz',
    logged_session_id: 'session_123',
    user_came_from: ['direct'],
    user_is_currently_on: 'direct'
  }
});
```

### Tracked Events

StoriesComponent automatically tracks the following events:

| Event                     | Trigger                          | Properties                          |
| ------------------------- | -------------------------------- | ----------------------------------- |
| `story_started`           | When each slide opens            | story_type, name_of_the_story, etc. |
| `story_ended`             | When leaving a slide             | story_type, name_of_the_story, etc. |
| `story_skip_tapped`       | User taps next/prev button       | story_type, name_of_the_story, etc. |
| `story_go_to_prev_tapped` | User taps previous button        | story_type, name_of_the_story, etc. |
| `story_paused`            | User long-press (200ms)          | story_type, name_of_the_story, etc. |
| `story_input_stated`      | User starts typing in input      | data_of_input                       |
| `story_input_filled`      | User submits input               | data_of_input, button_name          |
| `story_cleanup_video`     | Component destroyed with video   | story_type, name_of_the_story, etc. |

### Event Properties

All story events include:

```javascript
{
  // Auto-added by StoriesComponent
  story_type: 'story_block',
  name_of_the_story: '1',
  id_of_the_level: 'story_uuid',
  story_number: 0,
  prev_story_name: '',
  current_stars: 0,
  total_stars_to_crack_the_level: 10,

  // From analyticsContext config
  activity_type: 'CHALLENGE',
  parent_id: 293273,
  parent_name: 'Math Quiz',
  logged_session_id: 'session_123',
  user_came_from: ['direct'],
  user_is_currently_on: 'direct',

  // Auto-added by AnalyticsManager
  harness: true,
  mathai_platform: 'web',
  region: 'IN',
  current_href: 'https://...',
  id: 1554,
  mobile: '7875158990',
  name: 'Rishabh',
  // ... other user properties
}
```

### Without Analytics

If analytics is not available, StoriesComponent works normally without tracking:

```javascript
// No analytics - component works fine
const stories = new StoriesComponent('container', {
  storyBlockId: 293273
  // No analytics, no tracking
});
```

### Analytics Integration Checklist (MANDATORY)

When using StoriesComponent in games, **always** verify:

```
[ ] Analytics package loaded in Phase 1
[ ] AnalyticsManager initialized before StoriesComponent
[ ] window.analyticsManager set globally
[ ] User identified from postMessage data
[ ] analyticsContext passed to StoriesComponent config
[ ] analyticsContext includes all required properties:
    - activity_type
    - parent_id
    - parent_name
    - logged_session_id
    - user_came_from
    - user_is_currently_on
[ ] Story events tracked automatically (verify in console/network tab)
```

**Complete Integration Pattern:**

```javascript
// Phase 1: Initialize analytics FIRST
const analytics = new AnalyticsManager();
await analytics.init();
window.analyticsManager = analytics;

// Identify user from postMessage
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GAME_DATA' && event.data.student) {
    analytics.identify({
      id: event.data.student.id,
      mobile: event.data.student.mobile,
      name: event.data.student.name,
      email: event.data.student.email
    });
  }
});

// THEN initialize StoriesComponent with analyticsContext
const stories = new StoriesComponent('container', {
  storyBlockId: 293273,
  analyticsContext: {
    activity_type: 'CHALLENGE',
    parent_id: 293273,
    parent_name: 'Story Game',
    logged_session_id: generateSessionId(),
    user_came_from: ['direct'],
    user_is_currently_on: 'direct'
  }
});
```

---

## Duration Tracking

StoriesComponent provides comprehensive duration tracking.

### Configuration

```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  trackDuration: true,       // Enable duration tracking
  pauseOnTabSwitch: true     // Pause tracking when tab hidden
});
```

### Per-Story Duration

The component tracks:
- Time spent on each story (excluding inactive time)
- Tab visibility state
- Inactive duration when user switches tabs

```javascript
stories.onStoryChange = (index, direction, story) => {
  // Get duration for previous story
  const previousStoryDuration = stories.getStoryDurationData(index - 1);
  console.log(`Previous story duration: ${previousStoryDuration}s`);
};
```

### Total Duration

```javascript
stories.onComplete = (data) => {
  const durations = stories.getAllDurationData();

  console.log('Per-story durations:', durations.perStory);
  // { 0: 5.2, 1: 8.7, 2: 3.1 }

  console.log('Total active time:', durations.total);
  console.log('Total inactive time:', durations.inactive);
  console.log('Net active time:', durations.active);
};
```

### Duration Data Structure

```javascript
{
  perStory: {
    0: 5.2,    // Story 0: 5.2 seconds
    1: 8.7,    // Story 1: 8.7 seconds
    2: 3.1     // Story 2: 3.1 seconds
  },
  total: 17.0,      // Total elapsed time
  inactive: 2.3,    // Time when tab was hidden
  active: 14.7      // Total - inactive
}
```

---

## Event Callbacks

### onStoryChange

Called whenever the story changes.

```javascript
onStoryChange: (index, direction, story) => {
  console.log(`Story changed to index ${index}`);
  console.log(`Direction: ${direction}`); // 'next', 'prev', 'jump', 'initial', 'resize'
  console.log(`Story data:`, story);

  // Access story properties
  console.log(`Story name: ${story.name}`);
  console.log(`Story elements:`, story.elements);

  // Update UI based on story
  if (story.name === "quiz") {
    showQuizControls();
  }

  // Track analytics
  trackEvent("story_view", {
    story_name: story.name,
    story_index: index
  });
}
```

### onComplete

Called when all stories are completed.

```javascript
onComplete: (data) => {
  console.log("Stories completed!");
  console.log("History:", data.history);
  console.log("Final inputs:", data.inputs);
  console.log("Global context:", data.globalContext);
  console.log("Duration data:", data.durations);

  // Process completion
  const totalTime = data.durations.total;
  const accuracy = calculateAccuracy(data.history);

  // Show results screen
  showResults({
    time: totalTime,
    accuracy: accuracy
  });

  // Submit to backend
  submitResults(data);
}
```

**Completion Data Structure:**

```javascript
{
  history: [
    {
      index: 0,
      inputs: { user_name: "Alex" },
      globalContext: { score: 0 },
      timestamp: 1234567890
    },
    // ... more history entries
  ],
  inputs: {
    // Final input values
    user_name: "Alex",
    answer_1: "42"
  },
  globalContext: {
    value_map: {
      score: 100,
      level: 5
    }
  },
  durations: {
    perStory: { 0: 5.2, 1: 8.7 },
    total: 17.0,
    inactive: 2.3,
    active: 14.7
  }
}
```

### onButtonClick

Called when a button is clicked.

```javascript
onButtonClick: (name, action, storyIndex) => {
  console.log(`Button "${name}" clicked`);
  console.log(`Action:`, action);
  console.log(`Current story index: ${storyIndex}`);

  // Track button clicks
  trackEvent("button_click", {
    button_name: name,
    story_index: storyIndex,
    timestamp: Date.now()
  });

  // Play button sound
  FeedbackManager.sound.play("button_tap");

  // Custom button handling
  if (name === "hint_button") {
    showHint();
  }
}
```

### onInputChange

Called when an input value changes.

```javascript
onInputChange: (name, value, storyIndex) => {
  console.log(`Input "${name}" changed to: ${value}`);
  console.log(`Current story index: ${storyIndex}`);

  // Validate input in real-time
  if (name === "email" && !validateEmail(value)) {
    showError("Invalid email format");
  }

  // Auto-save
  saveToLocalStorage(name, value);

  // Track input changes
  trackEvent("input_change", {
    input_name: name,
    value_length: value.length
  });
}
```

### onError

Called when an error occurs.

```javascript
onError: (error) => {
  console.error("StoriesComponent error:", error);

  // Log to error tracking service
  logError({
    component: "StoriesComponent",
    error: error.message,
    stack: error.stack,
    timestamp: Date.now()
  });

  // Show user-friendly error message
  showErrorDialog({
    title: "Something went wrong",
    message: "Please refresh the page and try again."
  });
}
```

---

## API Reference

### Control Methods

| Method                    | Parameters                | Returns    | Description                           |
| ------------------------- | ------------------------- | ---------- | ------------------------------------- |
| `next(inputs)`            | `Object`                  | `Promise`  | Navigate to next story                |
| `prev()`                  | -                         | `Promise`  | Navigate to previous story            |
| `jumpTo(target, inputs)`  | `String/Number`, `Object` | `Promise`  | Jump to specific story                |
| `pause()`                 | -                         | `void`     | Pause component                       |
| `resume()`                | -                         | `void`     | Resume component                      |
| `reset()`                 | -                         | `void`     | Reset to initial state                |
| `destroy()`               | -                         | `void`     | Clean up and remove event listeners   |

### State Access Methods

| Method                      | Parameters | Returns    | Description                        |
| --------------------------- | ---------- | ---------- | ---------------------------------- |
| `getCurrentStory()`         | -          | `Object`   | Get current story object           |
| `getCurrentIndex()`         | -          | `Number`   | Get current story index            |
| `getHistory()`              | -          | `Array`    | Get navigation history             |
| `getAllDurationData()`      | -          | `Object`   | Get all duration data              |
| `getGlobalContext()`        | -          | `Object`   | Get global context                 |

### Update Methods

| Method                       | Parameters | Returns | Description                   |
| ---------------------------- | ---------- | ------- | ----------------------------- |
| `updateGlobalContext(data)`  | `Object`   | `void`  | Update global context values  |

---

## Advanced Examples

### Example 1: Educational Quiz with Branching

```javascript
const quizStoryBlock = {
  data: {
    children: [
      {
        id: "intro",
        data: {
          v2_story: {
            name: "intro",
            audio_id: "welcome",
            background_color: "#F5F5F5"
          },
          children: [
            {
              data: {
                type: "text",
                text: "Welcome to the Math Quiz!",
                positioning: { position: "absolute", top: "20%", left: "10%" }
              }
            },
            {
              data: {
                type: "button",
                name: "start",
                text: "Start Quiz",
                action: { type: "next" },
                positioning: { position: "absolute", top: "50%", left: "40%" }
              }
            }
          ]
        }
      },
      {
        id: "question_1",
        data: {
          v2_story: {
            name: "q1",
            get_next_story: `
              const answer = inputs.answer_q1;
              const correct = global_context_variables.q1_answer;

              if (answer === correct) {
                global_context_variables.score = (global_context_variables.score || 0) + 10;
                return 'correct_q1';
              } else {
                return 'incorrect_q1';
              }
            `
          },
          children: [
            {
              data: {
                type: "text",
                text: "What is 2 + 2?",
                positioning: { position: "absolute", top: "30%", left: "10%" }
              }
            },
            {
              data: {
                type: "input",
                name: "answer_q1",
                placeholder: "Enter answer",
                positioning: { position: "absolute", top: "50%", left: "30%" }
              }
            },
            {
              data: {
                type: "button",
                name: "submit",
                text: "Submit",
                action: { type: "submit" },
                positioning: { position: "absolute", top: "65%", left: "40%" }
              }
            }
          ]
        }
      }
    ]
  }
};

const stories = new StoriesComponent("quiz-container", {
  storyBlock: quizStoryBlock,
  globalContext: {
    value_map: {
      score: 0,
      q1_answer: "4"
    }
  },
  onComplete: (data) => {
    const finalScore = data.globalContext.value_map.score;
    alert(`Quiz complete! Score: ${finalScore}`);
  }
});
```

### Example 2: Interactive Tutorial with Progress Tracking

```javascript
const tutorialStoryBlock = {
  data: {
    children: [
      {
        id: "step_1",
        data: {
          v2_story: {
            name: "step1",
            duration: 10,
            background_video: "https://example.com/tutorial1.mp4",
            audio_id: "tutorial_1"
          },
          children: [
            {
              data: {
                type: "text",
                text: "Step 1: Getting Started",
                style: { fontSize: "28px", fontWeight: "bold" },
                positioning: { position: "absolute", top: "10%", left: "10%" }
              }
            },
            {
              data: {
                type: "container",
                positioning: { position: "absolute", bottom: "10%", left: "10%", width: "80%" },
                children: [
                  {
                    data: {
                      type: "button",
                      name: "skip",
                      text: "Skip Tutorial",
                      action: { type: "jump", target: "tutorial_end" }
                    }
                  },
                  {
                    data: {
                      type: "button",
                      name: "next",
                      text: "Next",
                      action: { type: "next" }
                    }
                  }
                ]
              }
            }
          ],
          other: {
            tutorial_step: 1,
            required: true
          }
        }
      }
    ]
  }
};

const stories = new StoriesComponent("tutorial-container", {
  storyBlock: tutorialStoryBlock,
  trackDuration: true,
  onStoryChange: (index, direction, story) => {
    // Update progress indicator
    updateProgressBar(index, stories.stories.length);

    // Track which steps are viewed
    trackTutorialProgress(story.name, story.other);
  }
});
```

### Example 3: Branching Narrative Game

```javascript
const gameStoryBlock = {
  data: {
    children: [
      {
        id: "forest_entrance",
        data: {
          v2_story: {
            name: "forest",
            background_image: "forest.jpg",
            audio_id: "ambient_forest",
            get_next_story: `
              const choice = inputs.forest_choice;

              if (choice === 'left') {
                global_context_variables.path = 'treasure';
                return 'left_path';
              } else if (choice === 'right') {
                global_context_variables.path = 'monster';
                return 'right_path';
              } else {
                return 'stay_path';
              }
            `
          },
          children: [
            {
              data: {
                type: "text",
                text: "You stand at the edge of a dark forest. Three paths lie ahead.",
                positioning: { position: "absolute", top: "20%", left: "10%", width: "80%" }
              }
            },
            {
              data: {
                type: "button",
                name: "choice_left",
                text: "Take the left path",
                action: { type: "next" },
                positioning: { position: "absolute", top: "50%", left: "10%" }
              }
            },
            {
              data: {
                type: "button",
                name: "choice_right",
                text: "Take the right path",
                action: { type: "next" },
                positioning: { position: "absolute", top: "50%", left: "50%" }
              }
            }
          ]
        }
      }
    ]
  }
};

const stories = new StoriesComponent("game-container", {
  storyBlock: gameStoryBlock,
  globalContext: {
    value_map: {
      inventory: [],
      health: 100,
      path: null
    }
  },
  onButtonClick: (name, action, storyIndex) => {
    // Store choice in inputs for getNextStory
    if (name.startsWith('choice_')) {
      stories.inputs.forest_choice = name.replace('choice_', '');
    }
  }
});
```

---

## Integration with Other Components

### With FeedbackManager

```javascript
// Initialize FeedbackManager first
await FeedbackManager.init();

// Preload audio
await FeedbackManager.sound.preload([
  { id: "story_1", url: "narration1.mp3" },
  { id: "story_2", url: "narration2.mp3" },
  { id: "button_click", url: "click.mp3" },
  { id: "success", url: "success.mp3" }
]);

// Initialize StoriesComponent
const stories = new StoriesComponent("container", {
  storyBlock: data,
  enableAudio: true,
  onStoryChange: (index, direction, story) => {
    // Audio plays automatically if story has audio_id

    // Show subtitle
    if (story.subtitle) {
      FeedbackManager.subtitle.show(story.subtitle);
    }
  },
  onButtonClick: (name) => {
    // Play button sound
    FeedbackManager.sound.play("button_click");
  },
  onComplete: (data) => {
    // Play success sound
    FeedbackManager.sound.play("success");

    // Show sticker
    FeedbackManager.sticker.show({
      type: "success",
      duration: 2000
    });
  }
});
```

### With TimerComponent

```javascript
// Initialize timer
const timer = new TimerComponent("timer-container", {
  mode: "countdown",
  duration: 300, // 5 minutes
  label: "Time Remaining"
});

// Initialize stories
const stories = new StoriesComponent("stories-container", {
  storyBlock: data,
  onStoryChange: (index, direction, story) => {
    // Start timer on first story
    if (index === 0 && direction === "initial") {
      timer.start();
    }
  },
  onComplete: (data) => {
    // Stop timer when stories complete
    timer.stop();
    const timeTaken = timer.getTimeTaken();
    console.log(`Completed in ${timeTaken} seconds`);
  }
});
```

### With VisibilityTracker

```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  pauseOnTabSwitch: true  // Built-in pause on tab switch
});

// Additional VisibilityTracker for coordinated pausing
const tracker = new VisibilityTracker({
  onInactive: () => {
    stories.pause();
    timer.pause();
    FeedbackManager.sound.pause();
  },
  onResume: () => {
    stories.resume();
    timer.resume();
    FeedbackManager.sound.resume();
  },
  popupProps: {
    title: "Paused",
    description: "Click Resume to continue.",
    primaryText: "Resume"
  }
});
```

---

## Best Practices

### 1. Story Design

**Keep stories focused:**
- One concept per story
- Clear and concise content
- Consistent visual style

**Use appropriate durations:**
```javascript
{
  "duration_type": "manual",  // For text-heavy content
  "duration_type": "audio",   // For narrated content
  "duration_type": "video"    // For video content
}
```

**Provide navigation hints:**
```javascript
{
  "children": [
    {
      "data": {
        "type": "text",
        "text": "Click 'Next' to continue →"
      }
    }
  ]
}
```

### 2. Performance

**Preload assets:**
```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  preloadAssets: true  // Preload video/audio durations
});
```

**Optimize media files:**
- Use compressed images (WebP format)
- Use optimized videos (H.264 codec)
- Use compressed audio (MP3 or AAC)
- Specify appropriate dimensions

**Clean up when done:**
```javascript
stories.onComplete = (data) => {
  // Process completion
  handleCompletion(data);

  // Clean up component
  stories.destroy();
};
```

### 3. User Experience

**Show progress:**
```javascript
const stories = new StoriesComponent("container", {
  showProgress: true  // Show progress bar
});
```

**Handle tab switching:**
```javascript
const stories = new StoriesComponent("container", {
  pauseOnTabSwitch: true  // Auto-pause when user switches tabs
});
```

**Provide feedback:**
```javascript
onButtonClick: (name, action) => {
  // Visual feedback
  FeedbackManager.sticker.show({ type: "tap" });

  // Audio feedback
  FeedbackManager.sound.play("button_tap");
};
```

### 4. Error Handling

**Always provide onError callback:**
```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  onError: (error) => {
    console.error("Story error:", error);

    // Show user-friendly message
    showErrorDialog({
      title: "Something went wrong",
      message: "Please refresh the page."
    });

    // Log to error tracking
    logError(error);
  }
});
```

**Validate story data:**
```javascript
function validateStoryBlock(storyBlock) {
  if (!storyBlock.data || !storyBlock.data.children) {
    throw new Error("Invalid story block structure");
  }

  if (storyBlock.data.children.length === 0) {
    throw new Error("Story block has no stories");
  }

  return true;
}

// Use validation
try {
  validateStoryBlock(myStoryBlock);
  const stories = new StoriesComponent("container", {
    storyBlock: myStoryBlock
  });
} catch (error) {
  console.error("Validation failed:", error);
}
```

### 5. Accessibility

**Provide text alternatives:**
```javascript
{
  "data": {
    "type": "image",
    "src": "diagram.png",
    "alt": "Flow diagram showing the process"  // Always include alt text
  }
}
```

**Use semantic HTML in html elements:**
```javascript
{
  "data": {
    "type": "html",
    "html": `
      <section role="region" aria-label="Quiz Question">
        <h2>Question 1</h2>
        <p>What is the capital of France?</p>
      </section>
    `
  }
}
```

**Ensure keyboard navigation:**
- Buttons are automatically keyboard accessible
- Ensure tab order makes sense
- Test with keyboard-only navigation

---

## Troubleshooting

### Issue: Stories not loading

**Symptoms:** Component initializes but no content appears

**Solutions:**

1. Check container exists:
```javascript
const container = document.getElementById("my-stories");
if (!container) {
  console.error("Container not found!");
}
```

2. Validate story block structure:
```javascript
console.log("Story block:", JSON.stringify(storyBlock, null, 2));

// Check for required fields
if (!storyBlock.data || !storyBlock.data.children) {
  console.error("Invalid story block structure");
}
```

3. Check console for errors:
```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  onError: (error) => {
    console.error("StoriesComponent error:", error);
  }
});
```

### Issue: Compute functions not executing

**Symptoms:** Navigation doesn't respect getNextStory logic

**Solutions:**

1. Check function syntax:
```javascript
// CORRECT
{
  "get_next_story": "return 'next_story';"
}

// INCORRECT - Missing return statement
{
  "get_next_story": "'next_story';"
}
```

2. Test function in isolation:
```javascript
const testFunction = new Function(
  'history',
  'inputs',
  'global_context_variables',
  'publishEvent',
  storyData.get_next_story
);

const result = testFunction([], {}, {}, () => {});
console.log("Compute result:", result);
```

3. Add logging to compute function:
```javascript
{
  "get_next_story": `
    console.log('Inputs:', inputs);
    console.log('Global context:', global_context_variables);

    if (inputs.choice === 'A') {
      console.log('Returning path A');
      return 'path_a';
    }

    console.log('Returning default path');
    return null;
  `
}
```

### Issue: Audio not playing

**Symptoms:** Story loads but audio doesn't play

**Solutions:**

1. Initialize FeedbackManager first:
```javascript
// CORRECT order
await FeedbackManager.init();
await FeedbackManager.sound.preload(audioAssets);

const stories = new StoriesComponent("container", {
  storyBlock: data,
  enableAudio: true
});

// INCORRECT - StoriesComponent before FeedbackManager
const stories = new StoriesComponent("container", { enableAudio: true });
await FeedbackManager.init();  // Too late!
```

2. Check audio is preloaded:
```javascript
const isPreloaded = FeedbackManager.sound.has("story_audio_id");
console.log("Audio preloaded:", isPreloaded);
```

3. Check browser autoplay policy:
```javascript
// Some browsers require user interaction before playing audio
document.addEventListener('click', () => {
  // Initialize audio context on first user interaction
  FeedbackManager.sound.play("welcome");
}, { once: true });
```

### Issue: Duration tracking inaccurate

**Symptoms:** Reported durations don't match actual time

**Solutions:**

1. Enable pauseOnTabSwitch:
```javascript
const stories = new StoriesComponent("container", {
  trackDuration: true,
  pauseOnTabSwitch: true  // Required for accurate tracking
});
```

2. Check duration data structure:
```javascript
stories.onComplete = (data) => {
  console.log("Duration data:", data.durations);
  console.log("Active time:", data.durations.active);
  console.log("Inactive time:", data.durations.inactive);
  console.log("Total time:", data.durations.total);
};
```

### Issue: Elements not positioned correctly

**Symptoms:** Elements appear in wrong locations or overlapping

**Solutions:**

1. Check positioning format:
```javascript
// CORRECT - Use percentages or pixels
{
  "positioning": {
    "position": "absolute",
    "top": "10%",      // Percentage of container height
    "left": "20px",    // Fixed pixels
    "width": "80%"
  }
}

// INCORRECT - Missing units
{
  "positioning": {
    "top": 10,         // Missing unit!
    "left": 20
  }
}
```

2. Verify container has dimensions:
```javascript
const container = document.getElementById("container");
console.log("Container dimensions:", {
  width: container.offsetWidth,
  height: container.offsetHeight
});

// Ensure container has explicit height
container.style.height = "600px";
```

3. Check element type renderer:
```javascript
// Ensure correct element type
{
  "data": {
    "type": "text",  // Must match available renderer
    // Not "Text" or "TEXT"
  }
}
```

### Issue: Inputs not captured

**Symptoms:** Input values not available in compute functions

**Solutions:**

1. Check input name attribute:
```javascript
{
  "data": {
    "type": "input",
    "name": "user_answer",  // Required for capturing value
    "placeholder": "Enter answer"
  }
}
```

2. Access inputs correctly in compute function:
```javascript
{
  "get_next_story": `
    // Access by input name
    const answer = inputs.user_answer;

    console.log('All inputs:', inputs);

    if (answer === 'correct') {
      return 'correct_story';
    }

    return 'incorrect_story';
  `
}
```

3. Use onInputChange to debug:
```javascript
const stories = new StoriesComponent("container", {
  storyBlock: data,
  onInputChange: (name, value, storyIndex) => {
    console.log(`Input captured: ${name} = ${value}`);
  }
});
```

---

## Migration Guide

### From v1 to v2

StoriesComponent v2.0.0 introduces significant changes:

#### Major Changes

1. **Story Format**
   - v1: Simple story objects
   - v2: Structured JSON with `data.children` array

2. **Configuration**
   - v1: `stories` array
   - v2: `storyBlock` object

3. **Elements**
   - v1: Limited element types
   - v2: 8 element types with full positioning control

#### Migration Steps

**Step 1: Update story structure**

v1 format:
```javascript
{
  stories: [
    {
      name: "intro",
      title: "Welcome",
      content: "Hello World"
    }
  ]
}
```

v2 format:
```javascript
{
  storyBlock: {
    data: {
      children: [
        {
          id: "intro",
          data: {
            v2_story: {
              name: "intro"
            },
            children: [
              {
                data: {
                  type: "text",
                  text: "Welcome",
                  positioning: { position: "absolute", top: "10%", left: "10%" }
                }
              },
              {
                data: {
                  type: "text",
                  text: "Hello World",
                  positioning: { position: "absolute", top: "30%", left: "10%" }
                }
              }
            ]
          }
        }
      ]
    }
  }
}
```

**Step 2: Update configuration**

v1:
```javascript
const stories = new StoriesComponent("container", {
  stories: storyArray,
  currentIndex: 0
});
```

v2:
```javascript
const stories = new StoriesComponent("container", {
  storyBlock: storyBlockData,
  globalContext: { value_map: {} }
});
```

**Step 3: Update element definitions**

v1:
```javascript
{
  html: '<button onclick="next()">Next</button>'
}
```

v2:
```javascript
{
  data: {
    type: "button",
    name: "next_btn",
    text: "Next",
    action: { type: "next" },
    positioning: { position: "absolute", bottom: "10%", left: "50%" }
  }
}
```

**Step 4: Update callbacks**

v1:
```javascript
onStoryChange: (index, direction, story) => {
  console.log(story.title);
}
```

v2:
```javascript
onStoryChange: (index, direction, story) => {
  console.log(story.name);
  console.log(story.elements); // Access child elements
}
```

---

## TypeScript Support

For TypeScript projects, here are the type definitions:

```typescript
interface StoriesComponentConfig {
  storyBlock: StoryBlock;
  globalContext?: GlobalContext;
  trackDuration?: boolean;
  pauseOnTabSwitch?: boolean;
  preloadAssets?: boolean;
  enableAudio?: boolean;
  showProgress?: boolean;
  onStoryChange?: (index: number, direction: string, story: Story) => void;
  onComplete?: (data: CompletionData) => void;
  onButtonClick?: (name: string, action: any, storyIndex: number) => void;
  onInputChange?: (name: string, value: any, storyIndex: number) => void;
  onError?: (error: Error) => void;
}

interface StoryBlock {
  data: {
    children: StoryChild[];
  };
}

interface StoryChild {
  id: string;
  data: {
    v2_story: V2Story;
    children: ElementChild[];
    other?: Record<string, any>;
  };
}

interface V2Story {
  name?: string;
  id?: string;
  duration?: number;
  duration_type?: 'manual' | 'video' | 'audio' | 'max';
  background_color?: string;
  background_image?: string;
  background_video?: string;
  background_audio?: string;
  audio?: string;
  audio_id?: string;
  get_next_story?: string;
}

interface ElementChild {
  data: {
    type: 'text' | 'image' | 'video' | 'button' | 'input' | 'container' | 'html' | 'avatar';
    id?: string;
    name?: string;
    style?: Record<string, string>;
    positioning?: Positioning;
    [key: string]: any;
  };
}

interface Positioning {
  position?: string;
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  width?: string | number;
  height?: string | number;
  transform?: string;
  zIndex?: number;
}

interface GlobalContext {
  value_map: Record<string, any>;
}

interface CompletionData {
  history: HistoryEntry[];
  inputs: Record<string, any>;
  globalContext: GlobalContext;
  durations: DurationData;
}

interface DurationData {
  perStory: Record<number, number>;
  total: number;
  inactive: number;
  active: number;
}
```

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Additional Resources

- [Story-Only Games Workflow](../workflows/story-only-games.md)
- [Story Component Loading Checklist](../workflows/checklists/story-component-loading.md)

---

## Version History

**v2.0.0** (Current)
- Story JSON format support (data.children array)
- Compute functions (getNextStory)
- Global context management (value_map)
- 8 element types with full positioning control
- Enhanced audio integration
- Improved duration tracking
- Responsive positioning system

**v1.0.0** (Legacy)
- Simple story array format
- Basic navigation
- Limited element types

---

**Version:** 2.0.0
**Last Updated:** 2025-11-11
**Component Package:** `@mathai/components`

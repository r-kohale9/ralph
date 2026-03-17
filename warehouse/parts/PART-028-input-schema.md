# PART-028: InputSchema Patterns

**Category:** MANDATORY | **Condition:** Every game (defines content structure) | **Dependencies:** PART-008

---

## Purpose

Define the content structure a game template expects via postMessage. One game template + unlimited content variations = reusable games.

## Concept

- Games are **templates** receiving runtime content via `game_init` postMessage
- `inputSchema` defines what shape that content must be
- Backend validates content against schema before sending
- Content is selected based on student grade/difficulty

## Common Patterns

### Simple Question List

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operand1: { type: 'number' },
          operand2: { type: 'number' },
          answer: { type: 'number' }
        },
        required: ['operand1', 'operand2', 'answer']
      }
    }
  },
  required: ['questions']
};
```

### Multiple Choice

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'number' },
          options: { type: 'array', items: { type: 'number' } }
        },
        required: ['question', 'answer', 'options']
      }
    }
  },
  required: ['questions']
};
```

### Text-Based Questions

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' }
        },
        required: ['question', 'answer']
      }
    }
  },
  required: ['questions']
};
```

### Grid/Puzzle Games

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    grid: {
      type: 'array',
      items: { type: 'array', items: { type: 'number' } }
    },
    solution: {
      type: 'array',
      items: { type: 'array', items: { type: 'number' } }
    }
  },
  required: ['grid', 'solution']
};
```

### Word Problems

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          question: { type: 'string' },
          answer: { type: 'number' },
          unit: { type: 'string' }
        },
        required: ['text', 'question', 'answer']
      }
    }
  },
  required: ['problems']
};
```

### Nested Levels

```javascript
const inputSchema = {
  type: 'object',
  properties: {
    levels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'number' }
              }
            }
          }
        }
      }
    }
  },
  required: ['levels']
};
```

## Supported Types

- `string` — Text values
- `number` — Integers or decimals
- `boolean` — True/false
- `array` — Lists (define `items` for element type)
- `object` — Nested structures (define `properties`)

## Fallback Content Rule

Every game MUST include fallback test content matching its schema so it works standalone:

```javascript
const fallbackContent = {
  questions: [
    { operand1: 2, operand2: 3, answer: 6 },
    { operand1: 5, operand2: 4, answer: 20 },
    { operand1: 7, operand2: 3, answer: 21 }
  ]
};

// In setupGame:
function setupGame() {
  const content = gameState.content || fallbackContent;
  // Use content...
}
```

## Best Practices

1. **Keep it simple** — Only include fields you actually need
2. **Use required fields** — Mark essential fields as required
3. **Provide at least 3 rounds** of fallback content
4. **Design for reuse** — Generic schemas enable more content variations
5. **Match field names** between schema and game code exactly

## Verification

- [ ] InputSchema defined with correct JSON Schema format
- [ ] All field types specified (string, number, array, object)
- [ ] Required fields marked
- [ ] Fallback content provided with at least 3 rounds
- [ ] Fallback content matches schema structure exactly
- [ ] Game code references correct field names from schema

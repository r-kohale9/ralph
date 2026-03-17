# InputSchema Guide

## Overview

The `inputSchema` defines what content structure your game expects from the platform. It uses JSON Schema format to validate content before it's sent to your game.

**Key Concepts:**
- Games are templates that receive runtime content via postMessage
- One game → unlimited content variations
- Backend validates all content against schema before sending
- Content is automatically selected based on student grade/difficulty

## Schema Definition

Basic structure:

```javascript
inputSchema: {
  type: 'object',
  properties: {
    // Define your content structure here
  },
  required: ['fieldName'] // List required fields
}
```

## Common Patterns

### Simple Question List

For games with a single array of questions:

```javascript
inputSchema: {
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
}
```

**Example Content:**
```javascript
{
  questions: [
    { operand1: 2, operand2: 3, answer: 6 },
    { operand1: 3, operand2: 4, answer: 12 },
    { operand1: 5, operand2: 2, answer: 10 }
  ]
}
```

### Multiple Choice Questions

For games with questions and answer options:

```javascript
inputSchema: {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'number' },
          options: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        required: ['question', 'answer', 'options']
      }
    }
  },
  required: ['questions']
}
```

**Example Content:**
```javascript
{
  questions: [
    {
      question: "What is 2 + 3?",
      answer: 5,
      options: [3, 4, 5, 6]
    },
    {
      question: "What is 10 - 4?",
      answer: 6,
      options: [4, 5, 6, 7]
    }
  ]
}
```

### Text-Based Questions

For games with text answers:

```javascript
inputSchema: {
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
}
```

**Example Content:**
```javascript
{
  questions: [
    {
      question: "What is the capital of France?",
      answer: "Paris"
    },
    {
      question: "What is 2 + 2?",
      answer: "4"
    }
  ]
}
```

### Puzzle/Grid Games

For games with grid-based layouts:

```javascript
inputSchema: {
  type: 'object',
  properties: {
    grid: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number' }
      }
    },
    solution: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number' }
      }
    }
  },
  required: ['grid', 'solution']
}
```

**Example Content:**
```javascript
{
  grid: [
    [1, 0, 3],
    [0, 2, 0],
    [3, 0, 1]
  ],
  solution: [
    [1, 2, 3],
    [3, 2, 1],
    [3, 1, 1]
  ]
}
```

## Validation Rules

### Type Definitions

**Supported types:**
- `string` - Text values
- `number` - Numeric values (integers or decimals)
- `boolean` - True/false values
- `array` - Lists of items
- `object` - Nested structures

### Required Fields

Mark fields as required to ensure content always includes them:

```javascript
{
  type: 'object',
  properties: {
    questions: { type: 'array' },
    timeLimit: { type: 'number' }
  },
  required: ['questions'] // timeLimit is optional
}
```

### Array Items

Define the structure of items in arrays:

```javascript
{
  questions: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        value: { type: 'number' }
      },
      required: ['value']
    }
  }
}
```

### Nested Objects

Support complex structures with nested objects:

```javascript
{
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
  }
}
```

## Examples by Game Type

### Multiplication Quiz

```javascript
inputSchema: {
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
}
```

### Fraction Comparison

```javascript
inputSchema: {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fraction1: {
            type: 'object',
            properties: {
              numerator: { type: 'number' },
              denominator: { type: 'number' }
            }
          },
          fraction2: {
            type: 'object',
            properties: {
              numerator: { type: 'number' },
              denominator: { type: 'number' }
            }
          },
          comparison: { type: 'string' } // '<', '>', or '='
        }
      }
    }
  }
}
```

### Word Problems

```javascript
inputSchema: {
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
          unit: { type: 'string' } // 'apples', 'meters', etc.
        }
      }
    }
  }
}
```

### Geometry Challenge

```javascript
inputSchema: {
  type: 'object',
  properties: {
    shapes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' }, // 'triangle', 'rectangle', etc.
          dimensions: {
            type: 'object',
            properties: {
              width: { type: 'number' },
              height: { type: 'number' }
            }
          },
          question: { type: 'string' },
          answer: { type: 'number' }
        }
      }
    }
  }
}
```

## Validation Before Registration

Always validate your schema with sample content before registering:

```javascript
// Test schema with sample content
await validate_input_schema({
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          operand1: { type: "number" },
          operand2: { type: "number" },
        },
      },
    },
  },
  sampleContent: {
    questions: [{ operand1: 5, operand2: 3 }],
  },
});
// Returns: "✅ Schema is valid!" or validation errors
```

## Backend Flow

1. **Content Creator** generates variations matching inputSchema
2. **Backend** validates content against schema
3. **Backend** selects appropriate content for student (grade/difficulty)
4. **Backend** sends validated content via `game_init` message
5. **Game** receives and uses content

**Example Backend Validation:**

```javascript
// Content creator generates variations
[
  {
    questions: [
      /* grade 3 problems */
    ],
  },
  {
    questions: [
      /* grade 4 problems */
    ],
  },
  {
    questions: [
      /* grade 5 problems */
    ],
  },
];

// Backend selects appropriate content for student
// Validates against inputSchema
// Sends via game_init message
```

## Best Practices

1. **Keep it simple** - Only include fields you actually need
2. **Use required fields** - Mark essential fields as required
3. **Document your schema** - Add comments explaining each field
4. **Validate early** - Test schema with sample content before registration
5. **Consider variations** - Design schema to support multiple difficulty levels
6. **Think reusability** - Generic schemas enable more content variations

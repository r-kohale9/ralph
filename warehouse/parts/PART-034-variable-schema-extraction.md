# PART-034: Variable Schema Serialization

**Category:** POST_GEN | **Condition:** Every game (post-generation step — serializes template Section 4 to JSON) | **Dependencies:** PART-008, PART-028

---

## Purpose

Serialize the **Input Schema** (authored in the game-specific template, Section 4) into a standalone `inputSchema.json` file. This file is consumed by the content creation system to generate valid content variations.

**Important:** The schema is *authored* during Stage 1 (template generation) — not derived from generated HTML. Stage 3 only serializes it to JSON and enriches it with field_mapping from the generated code.

## When

This runs as a **post-generation step** — after Stage 2 produces the HTML file.

## Instructions for LLM

### Step 1 — Copy the schema from the game-specific template

The game-specific template (Section 4: Input Schema) already contains the full schema definition and fallback content. Use that as the source of truth.

### Step 2 — Build field_mapping from generated HTML

Scan the generated `index.html` to identify where each schema field is used:
- Which function accesses it
- Which HTML element displays it
- What purpose it serves

This is the only part that requires reading the generated HTML.

### Step 3 — Output inputSchema.json

Create `{game-directory}/inputSchema.json` with this structure:

```json
{
  "game_id": "{{game_id}}",
  "version": "1.0.0",
  "description": "{{1-line description of what content this game needs}}",

  "schema": {
    "type": "object",
    "properties": {
      "{{field}}": {
        "type": "{{type}}",
        "description": "{{what this field is}}"
      }
    },
    "required": ["{{field_list}}"]
  },

  "example_content": [
    {
      "_difficulty": "easy",
      "{{field}}": "{{value}}"
    },
    {
      "_difficulty": "medium",
      "{{field}}": "{{value}}"
    },
    {
      "_difficulty": "hard",
      "{{field}}": "{{value}}"
    }
  ],

  "field_mapping": {
    "{{schema_field}}": {
      "used_in_function": "{{function_name}}",
      "html_element": "{{element_id or description}}",
      "purpose": "{{what this field controls in the game}}"
    }
  },

  "constraints": {
    "min_rounds": "{{N}}",
    "max_rounds": "{{N}}",
    "notes": "{{any content constraints}}"
  }
}
```

## Key Principle

The **schema** and **example_content** come from the template (Stage 1 output). Only **field_mapping** requires reading the generated HTML. This means:

- If the schema is wrong, fix it in the template — not in this step
- The schema is the contract between the game template and the content system
- `example_content` must have at least 3 entries at different difficulty levels

## Verification

- [ ] `inputSchema.json` created alongside `index.html`
- [ ] Schema matches what was defined in the game-specific template (Section 4)
- [ ] At least 3 example content entries at different difficulties
- [ ] `field_mapping` shows where every field is used in the generated HTML
- [ ] All required fields would break the game if missing

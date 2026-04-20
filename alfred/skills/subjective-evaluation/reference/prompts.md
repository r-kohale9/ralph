# Subjective Evaluation — Prompt Writing Guide

The quality of a subjective-evaluation question is determined almost entirely by its two prompts. This file describes how to write them.

## The two prompts

| Prompt | Purpose | Must include |
|--------|---------|--------------|
| `evaluation_prompt` | Classify the student's answer | Question, student answer, rubric, allowed output vocabulary |
| `feedback_prompt` | Produce student-facing feedback based on the classification | Question, student answer, `{{evaluation}}` variable, tone rules |

## Placeholders

- `{{evaluation}}` — the **only** placeholder the API substitutes. It is replaced with the `evaluation` string produced by `evaluation_prompt` before `feedback_prompt` is run.
- Any other `{{...}}` you write is literal text — the API will not substitute it. Interpolate at code-generation time using template literals instead:

```javascript
evaluation_prompt: `Question: "${question}"\nStudent answer: "${answer}"\nRubric: ${rubric}`
```

## Evaluation prompt — structure

A strong `evaluation_prompt` has four parts in this order:

1. **Role + task.** "You are a math tutor. Classify the student's answer."
2. **Question + student answer + rubric**, interpolated.
3. **Output vocabulary** — the exact set of allowed classifications (e.g. "Return one of: correct, incorrect, gibberish, idk"). The narrower the vocabulary, the easier it is to derive `correct: boolean`.
4. **Criteria per classification.** 1–3 bullet rules for each label.

### Template

```
You are a [subject] tutor. You will be given a question and the student's
response. Ignore all grammatical and spelling mistakes. Return one-word
response from these options: "correct", "incorrect", "gibberish", "idk".

Question: ${question}
Student's response: ${answer}

Criteria for correct:
1. [rule]
2. [rule]

Criteria for incorrect:
1. [rule]

Criteria for gibberish:
1. Response cannot be comprehended even after correcting spelling/grammar.
2. Response is irrelevant to the question.

Criteria for idk:
1. Responses like "I don't know", "idk", "no, I don't know".
```

### Good evaluation_prompt (from the variables example)

> Ignore all grammatical and spelling mistakes. Return one-word response from these options: "correct", "incorrect", "gibberish", "idk".
>
> Question: What do you know about variables?
> Student's response: ${answer}
>
> Criteria for correct: (1) comprehensible explanation after correcting errors; (2) partial explanations still count; (3) "yes, I know" counts.
> Criteria for incorrect: response has an explanation but it is wrong.
> Criteria for gibberish: (1) incomprehensible even after correction; (2) totally irrelevant.
> Criteria for idk: "I don't know", "idk", "no".

## Feedback prompt — structure

1. **Role + task.** "You are a math tutor. Give short feedback to the student."
2. **Question + student answer**, interpolated.
3. **`Evaluation: {{evaluation}}`** — so the model can branch on classification.
4. **Per-classification feedback rules.** One paragraph per label, with tone constraints.
5. **Hard "don'ts"** — never reveal the answer, never explain the solution, keep it short.

### Template

```
You are a [subject] tutor. You will be given a question, the student's
response, and an evaluation. Give short feedback.

Question: ${question}
Student's response: ${answer}
Evaluation: {{evaluation}}

For correct:
1. Acknowledge their understanding; do not add extra details.
2. End with "we'll deepen this together today."

For incorrect:
1. Acknowledge the attempt without revealing the answer.
2. Fallback: "That's an interesting answer!"
3. Never reveal the correct answer or steps.

For idk:
1. "It's alright if you don't know! We'll learn about this today."

For gibberish:
1. Treat as idk — reassuring, short.
```

## Tone rules (Bloom-aware)

From `skills/pedagogy/SKILL.md` and `skills/feedback/SKILL.md`:

- **L2 (Understand):** Feedback is warm and guiding. "That's a great start!" "You're on the right track."
- **L3 (Apply):** Feedback is corrective but never punitive. "Not quite — let's look again."
- **L4 (Analyze/Evaluate):** Feedback can reference the reasoning, still short.
- **Never** use the word "wrong" in student-facing feedback. Use "not quite", "close", "almost".
- **Never** reveal the answer. The game's next phase will teach it.

## Common mistakes

1. **Open-ended output vocabulary.** If you don't specify the allowed labels, the model returns long prose and `evaluation.includes('correct')` becomes unreliable.
2. **Missing rubric.** Without explicit criteria per label, the model drifts — two identical answers can get different classifications across rounds.
3. **Hardcoded question inside `evaluation_prompt`.** If the spec changes the question text, the prompt is stale. Always interpolate.
4. **Inventing placeholders.** Only `{{evaluation}}` is substituted. `{{student_answer}}`, `{{question}}`, `{{rubric}}` are literal strings — interpolate them yourself.
5. **Long feedback.** Feedback plays as TTS with a 60-char subtitle region. Keep under ~25 words per label.
6. **Revealing the answer in feedback.** The whole point of subjective evaluation is to assess prior knowledge before teaching. Feedback that gives away the answer undermines the lesson.

## Minimal viable prompts (for generic first draft)

Use these when the spec doesn't provide explicit rubrics. Treat as a placeholder that Education slot can refine.

```javascript
evaluation_prompt: `Question: "${question}"
Student answer: "${answer}"
Rubric: ${rubric}

Return one of: correct, incorrect, idk.
- correct: answer addresses the question with at least partial understanding, after correcting spelling/grammar.
- incorrect: answer is about the topic but the understanding is wrong.
- idk: student says they don't know, or response is blank/irrelevant/incomprehensible.`,

feedback_prompt: `Question: "${question}"
Student answer: "${answer}"
Evaluation: {{evaluation}}

Give short feedback (under 25 words). Do not reveal the correct answer.
- correct: acknowledge their understanding and say we'll go deeper today.
- incorrect: acknowledge the attempt ("interesting thought!") without correcting.
- idk: "That's okay — we'll learn about this together."`
```

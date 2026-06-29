# ADR 005: Clarification policy and customer involvement rules

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: HARNESS.md clarification rules, orchestrator clarifier module

## Context
The clarification loop must balance two goals: (1) gather enough data to proceed, (2) minimize customer friction. This ADR defines the policy.

## Rules

### 1. Extract first, ask later
Always run extraction before asking questions. The extractor may find answers to questions the clarifier would have asked.

### 2. Blocking vs nice-to-have
- **Blocking:** Without this data, the process cannot proceed safely (e.g., room type, dimensions for a layout).
- **Nice-to-have:** Improves quality but process can proceed without (e.g., style preference, budget range).

### 3. Maximum questions per round
- Text input: max 2 blocking questions per clarification round
- Audio/image: max 1 blocking question (simpler interaction)
- Mixed: max 2 blocking questions

### 4. Timeout policy
- Blocking question: 24h timeout → skip with default assumption + flag
- Nice-to-have: 48h timeout → skip silently
- After timeout: proceed with best available data, mark process as `timed_out` if all blocking questions timed out

### 5. No repeated questions
Never ask the same question twice. Track asked questions in process context.

### 6. Inference over questioning
If the extractor can reliably infer a value from context (e.g., "кухня" in text → roomType = kitchen), don't ask about it.

### 7. Format rules
- Questions must be short (1 sentence)
- Questions must be specific (not "what else?" but "what style?")
- Questions must be in the same language as the customer input
- Questions must include options when possible ("кухня, гостиная или спальня?")

## Implementation
The clarifier module (`clarifier.js`) enforces these rules through:
- `CLARIFICATION_PRIORITY.BLOCKING` / `NICE_TO_HAVE` on each question
- `generateClarificationQuestions(extractionResult)` — infers what's still missing
- `maxQuestions` parameter in clarification creation
- Timeout detection in process tracker (future: cron job)

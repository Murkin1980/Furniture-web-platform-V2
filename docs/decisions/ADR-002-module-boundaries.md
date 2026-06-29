# ADR 002: Module boundaries for orchestration, intake and extraction

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: Orchestrator modules, MVP modules, HARNESS.md

## Context
The orchestrator package has been created with four modules: intake, orchestration, extraction, clarification. Each module needs clear boundaries to avoid coupling and enable independent testing.

## Decision

### Intake Router (`packages/orchestrator/src/intake/intake-router.js`)
- **Owns:** input modality classification, initial routing decision
- **Input:** raw customer input (text, imageUrl, audioUrl, pdfUrl)
- **Output:** `{ action, modality, extractionType?, pipeline?, questions? }`
- **Depends on:** nothing (pure function, no DB)
- **Does NOT own:** actual extraction, DB persistence, MVP logic

### Process Tracker (`packages/orchestrator/src/orchestration/process-tracker.js`)
- **Owns:** process lifecycle, state transitions, step audit trail
- **Input:** processId, status, metadata
- **Output:** `{ id, status }` or `{ error }`
- **Depends on:** D1 DB (orchestration_processes, orchestration_steps tables)
- **Does NOT own:** extraction logic, clarification logic

### Extractor (`packages/orchestrator/src/extraction/extractor.js`)
- **Owns:** extraction pipeline definitions, extraction lifecycle (create/run/complete/fail)
- **Input:** processId, extractionType, input data
- **Output:** structured extraction result
- **Depends on:** D1 DB (orchestration_extractions table), handler functions injected at runtime
- **Does NOT own:** the actual extraction algorithms (those come from MVP or AI services)

### Clarifier (`packages/orchestrator/src/clarification/clarifier.js`)
- **Owns:** clarification lifecycle, question generation, response tracking
- **Input:** processId, extractionId, question, response
- **Output:** clarification status
- **Depends on:** D1 DB (orchestration_clarifications table)
- **Does NOT own:** the logic of what questions to ask (that's in extraction + clarification rules)

## Bridge to MVP
The orchestrator connects to MVP modules through injected handlers:
- `intake-router.js` → calls `classifyIntent` from `@furniture/shared` package-advisor
- `extractor.js` → receives handler functions that call MVP's `pdf-manifest.js`, `supplier-catalog.js`
- `clarifier.js` → receives question generators from extraction results

The orchestrator NEVER imports MVP modules directly. All connections are through:
1. Shared package exports (`@furniture/shared`)
2. Injected handler functions (dependency injection)
3. API route layer (functions/api/orchestration/)

## Consequences
- Each module can be tested independently with mock DB and handlers
- MVP modules don't need to know about orchestrator
- New extraction types can be added by creating new handlers without changing orchestrator core
- State machine is centralized in process-tracker, not scattered across modules

# ADR 004: Bridge strategy between MVP and orchestrator

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: Monorepo structure, HARNESS.md

## Context
The MVP and orchestrator packages need to communicate. The orchestrator routes customer intake to MVP modules (package-advisor, PDF intelligence, supplier pricing, proposal generation). This ADR defines how.

## Strategy: Dependency Injection + Shared Package

### Rule 1: Orchestrator NEVER imports MVP directly
The orchestrator package has no `import` from `packages/mvp/`. All MVP functionality is accessed through:
1. **Shared package** (`@furniture/shared`) — re-exports common types and pure functions
2. **Handler injection** — API routes pass MVP functions as callbacks to orchestrator modules
3. **API-to-API** — orchestrator calls MVP endpoints via internal fetch (future)

### Rule 2: MVP NEVER imports Orchestrator
The MVP package has no knowledge of the orchestrator. It continues to work as before. The orchestrator is an additive layer on top.

### Rule 3: Shared package is the contract boundary
`@furniture/shared` contains:
- `package-catalog.js` — PACKAGE_CODES, ENGAGEMENT_LEVELS, getPackageDefinition()
- `ai-observability.js` — createRun, startRun, completeRun, etc.
- `whatsapp/` — normalize-message, conversation-store

Both packages import from `@furniture/shared`. Neither imports the other.

### Rule 4: API routes are the glue
`functions/api/orchestration/` routes:
- Receive HTTP requests
- Create orchestrator processes
- Pass MVP handler functions to orchestrator modules
- Return results to caller

Example flow:
```
POST /api/orchestration/process
  → intake-router.classifyModality(input)
  → intake-router.routeIntake(input, context)
  → if action == "extract":
      extraction.createExtraction({ processId, extractionType, input })
      extraction.runExtraction({ extractionId, handler: mvpHandler })
  → if action == "clarify":
      clarification.createClarification({ processId, question })
  → if action == "route_downstream":
      call MVP module (package-advisor, PDF, etc.)
```

## Consequences
- Orchestrator can be tested without MVP (mock handlers)
- MVP can be tested without orchestrator (no dependency)
- New MVP modules don't require orchestrator changes
- New orchestration logic doesn't require MVP changes
- Shared package must be stable — breaking changes affect both packages

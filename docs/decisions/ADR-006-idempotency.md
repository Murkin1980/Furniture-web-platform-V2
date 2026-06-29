# ADR 006: Idempotency and deduplication policy

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: Architectural review, WhatsApp webhook behavior, Cloudflare retry semantics

## Context
WhatsApp/AI/webhook entries may be retried by upstream systems. Without idempotency, retries create duplicate processes, steps, extractions, and clarifications. This corrupts metrics and confuses operators.

## Decision

### 1. Idempotency key on all write operations
Every state-changing API endpoint accepts an optional `Idempotency-Key` header or `idempotencyKey` field in the request body.

### 2. Key derivation
- **Process creation:** `SHA256(clientId + inputModality + normalizedInputSummary)`
- **Extraction:** `SHA256(processId + extractionType + inputHash)`
- **Clarification:** `SHA256(processId + question)`
- **Clarification response:** `SHA256(clarificationId + response)`

### 3. Deduplication behavior
When a duplicate key is detected:
- **Create operations:** Return the existing record (200, not 201)
- **Transition operations:** If same transition → return existing state (200). If different transition → return 409 conflict.
- **Step logging:** Never log duplicate steps for the same transition

### 4. Storage
`idempotency_key` column added to orchestration_processes, orchestration_extractions, orchestration_clarifications. Unique index on each.

### 5. TTL
Idempotency records expire after 48 hours. A cron job or lazy cleanup removes stale keys.

## Consequences
- Retries from WhatsApp/AI become safe
- Operators see exactly one process per logical intake
- Metrics are accurate (no double-counting)
- Slight overhead for hash computation on each write

# Platform V2 — Review Document

**Date:** 2026-06-29 (updated)
**Repository:** https://github.com/Murkin1980/Furniture-web-platform-V2
**Branch:** main
**Latest commit:** 2af5390

---

## 1. What was built

AI-first furniture platform with multi-stage sales funnel, paid packages, visual deliverables, PDF intake, supplier pricing, WhatsApp inbound, and orchestration layer for heterogeneous customer inputs (text, sketches, audio, designer plans).

**Stack:** Cloudflare Pages Functions + D1 + R2, vanilla ESM, no build step, no TypeScript.

---

## 2. Monorepo structure

```
Platform V2/
├── packages/
│   ├── mvp/                    # Current MVP (Phases 1–4.6)
│   │   ├── src/                # 18 business logic modules
│   │   ├── functions/          # 16 API routes (Cloudflare Pages Functions)
│   │   ├── public/             # Admin UI, orchestration console, progress dashboard
│   │   ├── migrations/         # D1 migrations 0001–0008
│   │   └── scripts/            # 6 smoke test suites (619 assertions)
│   ├── shared/                 # Shared modules
│   │   └── src/                # package-catalog, ai-observability, whatsapp
│   └── orchestrator/           # AI-first orchestration layer
│       ├── src/
│       │   ├── intake/         # Input modality classification + routing
│       │   ├── orchestration/  # Process tracking, state machine, routing matrix
│       │   ├── extraction/     # Extraction pipelines
│       │   ├── clarification/  # Minimal question loop with metrics
│       │   ├── bridge/         # MVP bridge (dependency injection)
│       │   ├── handlers/       # Multi-modal adapters (image/audio/PDF)
│       │   ├── idempotency.js  # Deduplication for all write operations
│       │   ├── contracts.js    # DI contract definitions (JSDoc)
│       │   └── routing-matrix.js # Formal input → handler → output routing
│       ├── functions/          # 5 API routes
│       ├── migrations/         # D1 migrations 0009–0010
│       └── scripts/            # 3 smoke suites (145 assertions)
├── docs/decisions/             # ADR 001–007
├── scripts/build.mjs           # Build step assembly
├── HARNESS.md                  # Project rules
└── package.json                # npm workspaces root
```

---

## 3. ADR decisions

| ADR | Decision | Key point |
|---|---|---|
| 001 | Monorepo with workspaces | One repo, three packages, build step assembly for Cloudflare Pages |
| 002 | Module boundaries | Orchestrator never imports MVP directly; all connections via DI + shared package |
| 003 | D1 process event model | 4 tables: orchestration_processes, steps, extractions, clarifications |
| 004 | Bridge strategy | Dependency injection + @furniture/shared as contract boundary |
| 005 | Clarification policy | Extract first, blocking vs nice-to-have, max 2 questions per round, 24h timeout |
| 006 | Idempotency | SHA-256 keys on all writes, dedup returns existing record, 48h TTL, step dedup |
| 007 | Input routing policy | Formal matrix: 12 routing rules, 5 pipelines, per-modality handler requirements |

---

## 4. MVP modules (packages/mvp/src/)

| Module | File | What it does |
|---|---|---|
| Package catalog | `packages/package-catalog.js` | PACKAGE_CODES, ENGAGEMENT_LEVELS, CATALOG_SEED (4 packages incl. Package C), validators |
| Package store | `packages/package-store.js` | Engagement lifecycle, status machine, conversion events |
| Credit on order | `packages/credit-on-order.js` | Credit policy, computeCreditAmount, applyCreditToOrder |
| Message templates | `packages/message-templates.js` | 5 upsell templates |
| Package analytics | `packages/package-analytics.js` | Conversion funnel, package metrics |
| Payment store | `packages/payment-store.js` | Payment CRUD with auto-transition |
| Visual standards | `packages/visual-standards.js` | Deliverable types, specs per package |
| Deliverable store | `packages/deliverable-store.js` | Seed/lifecycle/artifact/revisions |
| PDF manifest | `pdf/pdf-manifest.js` | Manifest v2, 13 zone types, buildEstimate |
| PDF store | `pdf/pdf-store.js` | Upload/draft/review/estimate/dimensions/proposalLines |
| Supplier catalog | `suppliers/supplier-catalog.js` | Material tiers, resolveSupplierPricing (standard-preferring fallback) |
| Supplier store | `suppliers/supplier-store.js` | Supplier CRUD, versioned price lists, publishPriceList with auto-archive |
| Package advisor | `ai/package-advisor.js` | classifyIntent (4-tier keywords incl. Package C candidate), suggestClarifyingQuestions |
| AI observability | `ai/ai-observability.js` | AI_RUN_STATUS/AI_ACTION_TYPE/AI_FEEDBACK_TYPE, CRUD with status machine |
| WhatsApp normalize | `whatsapp/normalize-message.js` | normalizeIncomingMessage (phone, body, media extraction) |
| WhatsApp conversations | `whatsapp/conversation-store.js` | CONVERSATION_STATUS/MESSAGE_DIRECTION/MESSAGE_STATUS, CRUD, linkToOrder/Client |
| Project store | `projects/project-store.js` | SAFE_FILE_TYPES, registerFile (MIME filter), createShareLink (SHA-256 token) |
| Auth | `auth.js` | Scoped auth (READ/WRITE/OPS), Bearer + X-Admin-Token |

---

## 5. Orchestrator modules (packages/orchestrator/src/)

| Module | File | What it does |
|---|---|---|
| Intake router | `intake/intake-router.js` | classifyModality (text/image/audio/pdf/mixed), routeIntake → extract/clarify/route/reject |
| Process tracker | `orchestration/process-tracker.js` | State machine with idempotency, step dedup, clarification metrics |
| Routing matrix | `orchestration/routing-matrix.js` | 12 routing rules, 5 pipelines, resolveRoute, getHandlersForRoute |
| Extractor | `extraction/extractor.js` | Extraction pipelines for each modality, create/run/complete/fail lifecycle |
| Clarifier | `clarification/clarifier.js` | Question loop with idempotency, metrics (clarificationCount, timeoutCount, avg per process) |
| MVP bridge | `bridge/mvp-bridge.js` | DI handlers: createTextAnalysisHandler, createPdfIntelligenceHandler, createSupplierPricingHandler |
| Multi-modal handlers | `handlers/multi-modal.js` | createImageAnalysisHandler, createAudioTranscriptionHandler, createPdfExtractionHandler, createMultiModalFusionHandler |
| Idempotency | `idempotency.js` | deriveKey (SHA-256), checkIdempotent, storeIdempotent, 6 entity types, 48h TTL, cleanupStaleKeys |
| Contracts | `contracts.js` | JSDoc types for 8 handler interfaces, CONTRACT_SCHEMAS, validateContract |

---

## 6. API routes

### MVP (packages/mvp/functions/api/)

| Route | Method | What it does |
|---|---|---|
| `/api/packages` | GET | List package definitions |
| `/api/message-templates` | GET | List upsell templates |
| `/api/analytics` | GET | Package conversion analytics |
| `/api/payments` | POST | Create payment |
| `/api/payments/[pid]` | GET | Get payment status |
| `/api/deliverable-specs` | GET | List deliverable specs |
| `/api/deliverables/[did]` | GET | Get deliverable |
| `/api/orders/[id]/engagements` | POST | Create engagement |
| `/api/orders/[id]/engagements/[eid]` | GET | Get engagement |
| `/api/orders/[id]/engagements/[eid]/deliverables` | POST | Create deliverable |
| `/api/orders/[id]/pdf/uploads` | POST | Upload PDF |
| `/api/orders/[id]/pdf/drafts` | POST | Create draft |
| `/api/suppliers` | GET | List suppliers |
| `/api/suppliers/[sid]/price-lists` | POST | Create price list |
| `/api/whatsapp/webhook` | POST | WhatsApp inbound webhook |

### Orchestrator (packages/orchestrator/functions/api/)

| Route | Method | What it does |
|---|---|---|
| `/api/orchestration/process` | POST | Create process (idempotent, deduplicates on key) |
| `/api/orchestration/process/[pid]` | GET | Get process + steps + extractions + clarifications |
| `/api/orchestration/process/[pid]/clarify` | POST | Create clarification (idempotent) |
| `/api/orchestration/extraction/[eid]/run` | POST | Run extraction with injected handler |
| `/api/orchestration/clarification/[cid]/respond` | POST | Record response (idempotent) |

---

## 7. D1 schema

### Migrations 0001–0008 (MVP)

| Migration | Tables |
|---|---|
| 0001 | packages, engagements, orders |
| 0002 | package_payments |
| 0003 | deliverables |
| 0004 | pdf_uploads, pdf_drafts |
| 0005 | suppliers, supplier_price_lists |
| 0006 | ai_runs, ai_actions, ai_feedback |
| 0007 | whatsapp_conversations, whatsapp_messages |
| 0008 | project_files, project_share_links, project_share_comments |

### Migrations 0009–0010 (Orchestrator)

| Migration | Tables | Purpose |
|---|---|---|
| 0009 | orchestration_processes | Process lifecycle + clarification metrics (clarification_count, blocking_question_count, nice_to_have_question_count, last_clarification_at) |
| 0009 | orchestration_steps | Audit trail for state transitions |
| 0009 | orchestration_extractions | Extraction attempts (type, input, output, status) |
| 0009 | orchestration_clarifications | Questions + responses |
| 0010 | idempotency_keys | Deduplication store (key, entity_type, result_json, 48h TTL) |
| 0010 | + columns | idempotency_key on processes, extractions, clarifications (unique partial indexes) |

---

## 8. Smoke test totals

| Suite | File | Assertions | Status |
|---|---|---|---|
| Package lifecycle | `mvp/scripts/package-lifecycle-smoke.mjs` | 318 | ✅ |
| Suppliers | `mvp/scripts/supplier-smoke.mjs` | 79 | ✅ |
| Package advisor | `mvp/scripts/package-advisor-smoke.mjs` | 47 | ✅ |
| AI observability | `mvp/scripts/ai-observability-smoke.mjs` | 58 | ✅ |
| WhatsApp | `mvp/scripts/whatsapp-smoke.mjs` | 56 | ✅ |
| Project store | `mvp/scripts/project-store-smoke.mjs` | 61 | ✅ |
| Orchestrator | `orchestrator/scripts/orchestrator-smoke.mjs` | 44 | ✅ |
| E2E orchestration | `orchestrator/scripts/e2e-orchestration-smoke.mjs` | 33 | ✅ |
| **Hardening** | `orchestrator/scripts/hardening-smoke.mjs` | **68** | ✅ |
| **Total** | | **764** | **✅** |

### Hardening test coverage

| Category | Tests | What's covered |
|---|---|---|
| Idempotency | 10 | Key derivation (SHA-256), same input → same key, different input → different key, entity type validation |
| Routing matrix | 27 | 12 routing rules, 5 pipeline step counts, handler resolution, clarification allowed/denied |
| DI contracts | 17 | 8 handler schemas, required field validation, unknown handler rejection |
| Clarification metrics | 4 | Question generation, blocking/nice-to-have priority, partial data, full data |

---

## 9. Key design decisions

### Fail-closed architecture
- WhatsApp auto-send disabled by default (`WHATSAPP_SEND_ENABLED=false`)
- AI auto-send disabled (`AI_AUTO_SEND_ENABLED=false`)
- Package C public download blocked until paid
- Share links have mandatory expiry + revoke
- Dangerous MIME types blocked in project files

### Idempotency (ADR 006)
- Every write operation accepts optional `Idempotency-Key` header or `idempotencyKey` body field
- Key = SHA-256 of (entityType + normalized input)
- Duplicate create → return existing record (200, not 201)
- Duplicate step transition → skip logging (no double audit trail)
- 48h TTL with lazy cleanup

### Dependency injection over imports
- Orchestrator NEVER imports MVP modules directly
- All MVP functionality accessed through injected handler functions
- `@furniture/shared` is the only shared import boundary

### Routing matrix (ADR 007)
- 12 explicit routing rules across 5 modalities
- Each rule specifies: action, pipeline, handlers, clarificationAllowed
- New modalities must be added to matrix before implementation
- Tests cover each matrix row

### DI contracts (JSDoc)
- 8 handler interfaces defined with required/optional fields
- `validateContract(handlerName, result)` checks required fields at runtime
- Contract tests verify all schemas validate correctly

### Clarification metrics
- `clarification_count`, `blocking_question_count`, `nice_to_have_question_count`, `last_clarification_at` on each process
- Aggregate metrics: stuckClarifying, timedOut, clarificationTimeouts, avgClarificationsPerProcess
- Admin UI shows real-time metrics

### State machine with audit trail
- Process: created → classifying → extracting → clarifying → routing → completed/failed
- Every transition logged in orchestration_steps (deduplicated)
- Extraction lifecycle: pending → running → completed/failed
- Clarification lifecycle: pending → sent → responded/timed_out/skipped

### Clarification policy (ADR 005)
- Extract maximum meaning from existing input before asking
- Blocking vs nice-to-have priority
- Max 2 blocking questions per round (text), 1 for audio/image
- 24h timeout for blocking, 48h for nice-to-have
- Never ask the same question twice

---

## 10. Admin UI

### Orchestration Console (`public/orchestration.html`)
- **Metrics cards:** Total processes, Clarifying, Timed Out, Completed, Failed, Avg clarifications
- **Filterable process table:** Filter by status and modality
- **Detail panel:** Click "View" to see steps, extractions, clarifications for a process
- **Auto-refresh:** Metrics refresh every 30 seconds
- **Visual indicators:** Color-coded badges for status, highlighted rows for blocked/failed processes

---

## 11. How to verify

```bash
# Install
npm install

# Syntax check
npm run check

# All smoke tests (764 assertions)
npm run smoke:all

# Build
npm run build

# Individual suites
npm run smoke:packages     # 318
npm run smoke:suppliers    # 79
npm run smoke:advisor      # 47
npm run smoke:ai           # 58
npm run smoke:whatsapp     # 56
npm run smoke:project      # 61
npm run smoke:orchestrator # 44
npm run smoke:e2e          # 33
npm run smoke:hardening    # 68
```

---

## 12. What's next

1. Apply migrations 0009–0010 to D1 (local + remote)
2. Wire orchestrator API routes to real MVP handlers in production
3. End-to-end integration test with D1 (not pure modules)
4. Multi-modal handlers: connect to real vision/transcription services
5. Clarification timeout cron job
6. Phase 5: controlled 3D upgrade

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Migrations 0009–0010 not applied to remote D1 | Apply manually via `npm run db:migrate:remote` after review |
| Orchestrator handlers are mock/stub | Real AI services to be connected in next phase |
| Build step copies files (no dedup) | Shared package prevents logic duplication; file duplication is acceptable |
| Windows CRLF in git | `.gitattributes` should be added for consistent line endings |
| Idempotency keys rely on normalized input | Edge case: slightly different inputs with same normalized form → false dedup. Acceptable for v1. |

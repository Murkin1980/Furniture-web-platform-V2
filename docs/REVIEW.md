# Platform V2 — Review Document

**Date:** 2026-06-29
**Repository:** https://github.com/Murkin1980/Furniture-web-platform-V2
**Branch:** main
**Latest commit:** 9d2a36a

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
│   │   ├── public/             # Admin UI, progress dashboard
│   │   ├── migrations/         # D1 migrations 0001–0008
│   │   └── scripts/            # 6 smoke test suites (619 assertions)
│   ├── shared/                 # Shared modules
│   │   └── src/                # package-catalog, ai-observability, whatsapp
│   └── orchestrator/           # New AI-first orchestration layer
│       ├── src/
│       │   ├── intake/         # Input modality classification + routing
│       │   ├── orchestration/  # Process tracking, state machine
│       │   ├── extraction/     # Extraction pipelines
│       │   ├── clarification/  # Minimal question loop
│       │   ├── bridge/         # MVP bridge (dependency injection)
│       │   └── handlers/       # Multi-modal adapters (image/audio/PDF)
│       ├── functions/          # 5 API routes
│       ├── migrations/         # D1 migration 0009
│       └── scripts/            # 2 smoke suites (77 assertions)
├── docs/decisions/             # ADR 001–005
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

---

## 4. MVP modules (packages/mvp/src/)

| Module | File | Lines | What it does |
|---|---|---|---|
| Package catalog | `packages/package-catalog.js` | 203 | PACKAGE_CODES, ENGAGEMENT_LEVELS, CATALOG_SEED (4 packages including Package C), validators |
| Package store | `packages/package-store.js` | — | Engagement lifecycle, status machine, conversion events |
| Credit on order | `packages/credit-on-order.js` | — | Credit policy, computeCreditAmount, applyCreditToOrder |
| Message templates | `packages/message-templates.js` | — | 5 upsell templates |
| Package analytics | `packages/package-analytics.js` | — | Conversion funnel, package metrics |
| Payment store | `packages/payment-store.js` | — | Payment CRUD with auto-transition |
| Visual standards | `packages/visual-standards.js` | — | Deliverable types, specs per package |
| Deliverable store | `packages/deliverable-store.js` | — | Seed/lifecycle/artifact/revisions |
| PDF manifest | `pdf/pdf-manifest.js` | — | Manifest v2, 13 zone types, buildEstimate |
| PDF store | `pdf/pdf-store.js` | — | Upload/draft/review/estimate/dimensions/proposalLines |
| Supplier catalog | `suppliers/supplier-catalog.js` | — | Material tiers, resolveSupplierPricing (standard-preferring fallback) |
| Supplier store | `suppliers/supplier-store.js` | — | Supplier CRUD, versioned price lists, publishPriceList with auto-archive |
| Package advisor | `ai/package-advisor.js` | — | classifyIntent (4-tier keywords incl. Package C candidate), suggestClarifyingQuestions |
| AI observability | `ai/ai-observability.js` | 276 | AI_RUN_STATUS/AI_ACTION_TYPE/AI_FEEDBACK_TYPE, CRUD with status machine |
| WhatsApp normalize | `whatsapp/normalize-message.js` | — | normalizeIncomingMessage (phone, body, media extraction) |
| WhatsApp conversations | `whatsapp/conversation-store.js` | — | CONVERSATION_STATUS/MESSAGE_DIRECTION/MESSAGE_STATUS, CRUD, linkToOrder/Client |
| Project store | `projects/project-store.js` | — | SAFE_FILE_TYPES, registerFile (MIME filter), createShareLink (SHA-256 token) |
| Auth | `auth.js` | — | Scoped auth (READ/WRITE/OPS), Bearer + X-Admin-Token |

---

## 5. Orchestrator modules (packages/orchestrator/src/)

| Module | File | Lines | What it does |
|---|---|---|---|
| Intake router | `intake/intake-router.js` | 161 | classifyModality (text/image/audio/pdf/mixed), routeIntake → extract/clarify/route/reject |
| Process tracker | `orchestration/process-tracker.js` | — | State machine: created→classifying→extracting→clarifying→routing→completed/failed, step audit trail |
| Extractor | `extraction/extractor.js` | 142 | Extraction pipelines for each modality, create/run/complete/fail lifecycle |
| Clarifier | `clarification/clarifier.js` | — | Minimal question loop, blocking/nice-to-have priority, generateClarificationQuestions |
| MVP bridge | `bridge/mvp-bridge.js` | — | DI handlers: createTextAnalysisHandler, createPdfIntelligenceHandler, createSupplierPricingHandler |
| Multi-modal handlers | `handlers/multi-modal.js` | — | createImageAnalysisHandler, createAudioTranscriptionHandler, createPdfExtractionHandler, createMultiModalFusionHandler |

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
| `/api/orchestration/process` | POST | Create orchestration process from customer input |
| `/api/orchestration/process/[pid]` | GET | Get process status + steps + extractions + clarifications |
| `/api/orchestration/process/[pid]/clarify` | POST | Create clarification question |
| `/api/orchestration/extraction/[eid]/run` | POST | Run extraction with injected handler |
| `/api/orchestration/clarification/[cid]/respond` | POST | Record customer response to clarification |

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

### Migration 0009 (Orchestrator)

| Table | Purpose |
|---|---|
| orchestration_processes | Process lifecycle (status, input modality, context) |
| orchestration_steps | Audit trail for state transitions |
| orchestration_extractions | Extraction attempts (type, input, output, status) |
| orchestration_clarifications | Questions sent to customer + responses |

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
| **Total** | | **696** | **✅** |

---

## 9. Key design decisions

### Fail-closed architecture
- WhatsApp auto-send disabled by default (`WHATSAPP_SEND_ENABLED=false`)
- AI auto-send disabled (`AI_AUTO_SEND_ENABLED=false`)
- Package C public download blocked until paid
- Share links have mandatory expiry + revoke
- Dangerous MIME types blocked in project files

### Dependency injection over imports
- Orchestrator NEVER imports MVP modules directly
- All MVP functionality accessed through injected handler functions
- `@furniture/shared` is the only shared import boundary

### State machine with audit trail
- Process: created → classifying → extracting → clarifying → routing → completed/failed
- Every transition logged in orchestration_steps
- Extraction lifecycle: pending → running → completed/failed
- Clarification lifecycle: pending → sent → responded/timed_out/skipped

### Clarification policy
- Extract maximum meaning from existing input before asking
- Blocking vs nice-to-have priority
- Max 2 blocking questions per round (text), 1 for audio/image
- 24h timeout for blocking, 48h for nice-to-have
- Never ask the same question twice

---

## 10. How to verify

```bash
# Install
npm install

# Syntax check
npm run check

# All smoke tests (696 assertions)
npm run smoke:all

# Build
npm run build

# Individual suites
npm run smoke:packages    # 318
npm run smoke:suppliers   # 79
npm run smoke:advisor     # 47
npm run smoke:ai          # 58
npm run smoke:whatsapp    # 56
npm run smoke:project     # 61
npm run smoke:orchestrator # 44
npm run smoke:e2e          # 33
```

---

## 11. What's next

1. Apply migration 0009 to D1 (local + remote)
2. Wire orchestrator API routes to real MVP handlers in production
3. End-to-end integration test with D1 (not pure modules)
4. Multi-modal handlers: connect to real vision/transcription services
5. Clarification timeout cron job
6. Admin UI for orchestration monitoring
7. Phase 5: controlled 3D upgrade

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Migration 0009 not applied to remote D1 | Apply manually via `npm run db:migrate:remote` after review |
| Orchestrator handlers are mock/stub | Real AI services to be connected in next phase |
| Build step copies files (no dedup) | Shared package prevents logic duplication; file duplication is acceptable |
| Windows CRLF in git | `.gitattributes` should be added for consistent line endings |

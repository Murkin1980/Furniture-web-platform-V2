# SIMPLICITY_REVIEW.md — Furniture Platform V2, Phase 4.1

**Date:** 2026-07-11
**Branch:** `harden-v2-boundaries`
**Status:** Gate review before Phase 4.1 implementation

---

## Stage 1 — Define the actual result

**Who:** A furniture company manager in Kazakhstan who receives client requests via WhatsApp or direct contact.

**What action must become possible:**
1. Receive a client request (text describing furniture needs);
2. Classify it as Level 1, Package A, or Package B;
3. Create an engagement and record payment;
4. Prepare deliverables (BW preview, color views, dimensions, estimate);
5. Manager reviews and approves;
6. Hand the result to the client;
7. Convert to a furniture order with credit applied.

**Measurable result that proves the idea works:**
- 5 complete cases pass (2× Package A, 2× Package B, 1× Level 1 upgraded);
- credit-on-order is idempotent (cannot be applied twice);
- manager approval gates client handoff (impossible to skip);
- no dependency on Package C, orchestrator, WhatsApp automation, AI drafts, or 3D.

**Explicitly outside Phase 4.1:**
- Package C selling flow
- Independent orchestrator runtime
- Inbound WhatsApp production webhook
- AI draft replies
- Automatic OCR/AI/3D execution
- Public project share links
- GLB viewer
- Queues, schedulers, long-running workers
- Operational analytics dashboard
- Multi-city scaling

**Manual during validation:**
- Manager manually reviews each deliverable before approval
- Manager manually classifies requests (advisor suggests, manager confirms)
- Manager manually sends results to client via WhatsApp Web
- Manager manually runs smoke tests before deploy

---

## Stage 2 — Research simple approaches

### Approach A — Fully manual (spreadsheet + WhatsApp Web)

| Aspect | Detail |
|--------|--------|
| Setup effort | 0 minutes |
| Moving parts | 0 (browser only) |
| Maintenance | None |
| Cost | Free |
| Failure modes | Human error, no audit trail, slow |
| Vendor dependencies | None |
| Validates | Do clients want Package A/B? Is the pricing right? |

**Verdict:** Proves the business question but doesn't prove the platform works.

### Approach B — Current MVP (Cloudflare Pages + D1, single runtime)

| Aspect | Detail |
|--------|--------|
| Setup effort | `npm install && npm run dev` (2 min) |
| Moving parts | 1 Cloudflare Pages project, 1 D1 database |
| Maintenance | Low — serverless, no infrastructure to manage |
| Cost | Free tier (Cloudflare Pages + D1) |
| Failure modes | D1 limits, Cloudflare outages |
| Vendor dependencies | Cloudflare |
| Validates | The platform can run the full commercial flow |

**Verdict:** This is the right approach. Already partially implemented.

### Approach C — Full architecture (orchestrator + WhatsApp + AI + 3D)

| Aspect | Detail |
|--------|--------|
| Setup effort | Hours — multiple packages, bindings, migrations |
| Moving parts | 2+ runtimes, WhatsApp API, AI provider, 3D service |
| Maintenance | High — monitoring, retries, dead letters |
| Cost | WhatsApp API, AI API, possibly 3D tools |
| Failure modes | API rate limits, webhook issues, AI hallucinations |
| Vendor dependencies | Cloudflare, Meta, OpenAI, 3D provider |
| Validates | Everything — but overkill for first commercial proof |

**Verdict:** Deferred until measured bottleneck demands it.

**Choice: Approach B.** The platform already has 90% of the code. Phase 4.1 is about proving it works end-to-end, not building new infrastructure.

---

## Stage 3 — Simplification pass 1: remove speculative scope

**Removed from Phase 4.1 scope:**

| Item | Why removed |
|------|-----------|
| Package C engagement creation | Non-sellable, no confirmed clients |
| Orchestrator runtime | No queue/scheduler need at this volume |
| WhatsApp inbound webhook | Security verified, but activation is a separate decision |
| AI draft replies | Deterministic advisor is sufficient; AI drafts add risk |
| Automatic 3D execution | Manager can manually request 3D later |
| Public share links | No external viewers needed yet |
| GLB viewer | No 3D files in Package A/B |
| Operational analytics | Manual tracking via 5-case proof is enough |
| Multi-city support | Almaty-first validation |
| API key auth | Solo operator, admin token is enough |
| Prometheus metrics | Logs + smoke tests suffice |

**Kept in Phase 4.1 scope:**

| Item | Why kept |
|------|---------|
| Package A end-to-end flow | Core sellable product |
| Package B end-to-end flow | Core sellable product |
| Level 1 → Package A/B upgrade | Required for the 5-case proof |
| Credit-on-order idempotency | Required for financial correctness |
| Manager approval gate | Required for quality control |
| Supplier-aware estimate | Required for pricing accuracy |
| WhatsApp webhook security | Already implemented, just needs smoke test cases |
| DOM XSS prevention | Security hardening, zero new complexity |
| D1 update discipline | Code quality, zero new complexity |
| Store utility refactor | Cleanup, reduces duplication |

---

## Stage 4 — Simplification pass 2: combine components

| Question | Answer |
|----------|--------|
| Can engagement + payment + deliverable run in one runtime? | Yes — all in `packages/mvp` |
| Can we use 1 database for everything? | Yes — D1 with 8 migrations, ~20 tables |
| Can a synchronous API replace a queue? | Yes — Pages Functions are request/response, no queue needed |
| Can the admin UI be the main frontend? | Yes — no separate React/Vue app needed |
| Can smoke tests replace a monitoring dashboard? | Yes — for 5 manual cases, logs + smoke are enough |
| Can the deterministic advisor replace AI classification? | Yes — keyword-based classification works for Russian furniture requests |

**Target achieved:**
- 1 repository
- 1 deployed application (Cloudflare Pages)
- 1 production runtime (`packages/mvp`)
- 1 database (D1)
- 0 queues
- 0 independent workers
- 1 deployment target (Cloudflare Pages)

**Exception noted:** `packages/orchestrator` and `packages/shared` exist in the repo but are excluded from the production build. This is acceptable per Option C of the original review.

---

## Stage 5 — Simplification pass 3: remove dependencies

| Dependency | Keep? | Reason |
|------------|-------|--------|
| `wrangler` (Cloudflare CLI) | Yes | Required for Pages deployment and D1 |
| `@playwright/test` | Yes | Used in smoke tests |
| D1 (Cloudflare SQLite) | Yes | Production database |
| R2 (Cloudflare storage) | Postpone | Only needed for file uploads; not in Phase 4.1 core flow |
| WhatsApp Cloud API | Postpone | Webhook security is verified; actual sending is deferred |
| OpenAI API | No | Deterministic advisor replaces AI classification |
| Node.js | Yes | Runtime for smoke tests and build |

**No new dependencies added for Phase 4.1.** The existing stack is sufficient.

---

## Stage 6 — Simplification pass 4: operational reality

**How is it started locally?**
```bash
npm install
npm run dev
```
Starts Cloudflare Pages dev server with local D1. One command.

**How is it stopped?**
Ctrl+C. No background processes.

**How is it configured?**
Copy `.dev.vars.example` to `.dev.vars`, set `ADMIN_TOKEN`. Two values.

**How is a failure diagnosed?**
- Smoke test output shows exactly which step failed
- `npm run check` catches syntax errors
- `npm run build` catches build boundary violations
- Cloudflare dashboard shows function logs in production

**How is data backed up?**
D1 has automatic backups on Cloudflare. For local dev, the SQLite file is disposable.

**How is the system restored?**
`rm -rf .wrangler/state && npm run dev` — fresh local state.

**How many commands for a new operator?**
3: `npm install`, `cp .dev.vars.example .dev.vars`, `npm run dev`.

**How many services must be healthy?**
1: Cloudflare Pages (managed by Cloudflare). Locally: just Node.js.

---

## Stage 7 — Simplicity score

| Criterion | Score | Notes |
|-----------|-------|-------|
| One clear business outcome | 2 | "5 cases pass, credit is idempotent, manager gates handoff" |
| Minimal number of services | 2 | 1 Cloudflare Pages project + 1 D1 database |
| Minimal number of dependencies | 2 | wrangler + playwright, both essential |
| One obvious deployment path | 2 | `npm run build && npm run deploy` |
| Easy local start | 2 | `npm install && npm run dev` |
| Easy rollback | 2 | `git revert` + redeploy; local state is disposable |
| Manual fallback exists | 2 | Spreadsheet + WhatsApp Web (documented) |
| No speculative features | 1 | Some deferred code exists in repo (acceptable per Option C) |
| Understandable by one developer | 2 | Single monorepo, single stack, clear package boundaries |
| Testable end to end | 2 | 3 core smoke tests + 4 deferred; e2e scenarios defined |
| **Total** | **19/20** | Proceed |

**No item scores 0.** The only 1 is for deferred code existing in the repo, which is explicitly allowed by Option C and does not affect the production build.

---

## Stage 8 — Stop conditions check

| Condition | Status | Action |
|-----------|--------|--------|
| More than 1 repository | No — 1 monorepo | OK |
| More than 1 database | No — 1 D1 | OK |
| More than 1 queue technology | No — 0 queues | OK |
| More than 1 deployment platform | No — Cloudflare Pages only | OK |
| More than 1 worker | No — 0 workers (request/response) | OK |
| New service without immediate business value | No — all services support the core flow | OK |
| Architecture for hypothetical scale | No — designed for 5 manual cases | OK |
| Automated workflow with no manual version | No — manager does everything manually first | OK |
| Infrastructure longer to build than workflow | No — Cloudflare Pages is managed | OK |
| More than 8 env vars for core MVP | No — 2 in .dev.vars.example | OK |
| More than 5 runtime containers | No — 0 containers (serverless) | OK |

**All stop conditions clear.** No exceptions needed.

---

## Final MVP workflow (Phase 4.1)

```
1. npm install && npm run dev
2. Create test order via API or admin UI
3. Input client request text → package advisor classifies
4. Manager confirms classification
5. Create Package A or B engagement
6. Record payment (Package A — 10 000 тг, Package B — 20 000 тг)
7. Create deliverables (BW preview, color views, dimensions)
8. Build supplier-aware estimate
9. Manager reviews and approves
10. Mark client handoff
11. Convert to furniture order
12. Apply credit-on-order
13. Retry credit → prove idempotency
14. Record results in 5-case proof document
```

---

## Components kept

| Component | File/Module | Purpose |
|-----------|------------|---------|
| Package catalog | `packages/mvp/src/packages/package-catalog.js` | Enums, catalog seed, validators |
| Engagement lifecycle | `packages/mvp/src/packages/package-store.js` | CRUD + status transitions |
| Payment management | `packages/mvp/src/packages/payment-store.js` | CRUD + engagement binding |
| Deliverable workflow | `packages/mvp/src/packages/deliverable-store.js` | CRUD + revisions + artifacts |
| Credit-on-order | `packages/mvp/src/packages/credit-on-order.js` | Exactly-once enforcement |
| Package advisor | `packages/mvp/src/ai/package-advisor.js` | Deterministic intent classification |
| Visual standards | `packages/mvp/src/packages/visual-standards.js` | Deliverable specs per package |
| Supplier store | `packages/mvp/src/suppliers/supplier-store.js` | Supplier CRUD + price lists + estimates |
| Supplier catalog | `packages/mvp/src/suppliers/supplier-catalog.js` | Price list statuses + validators |
| PDF manifest | `packages/mvp/src/pdf/pdf-manifest.js` | Schema + zone types |
| PDF store | `packages/mvp/src/pdf/pdf-store.js` | Upload + draft management |
| Message templates | `packages/mvp/src/packages/message-templates.js` | Upgrade offer templates |
| Package analytics | `packages/mvp/src/packages/package-analytics.js` | Conversion funnel (manual tracking) |
| Auth | `packages/mvp/src/auth.js` | Scoped bearer tokens |
| Store utils | `packages/mvp/src/shared/store-utils.js` | Shared DB helpers |
| All API routes | `packages/mvp/functions/api/*` | 15 route handlers |
| Smoke tests | `packages/mvp/scripts/*-smoke.mjs` | 3 core + 4 deferred |
| Build script | `scripts/build.mjs` | MVP-only production build |

---

## Components postponed

| Component | When to activate |
|-----------|-----------------|
| Package C | After 3+ confirmed client requests with approved pricing |
| Orchestrator runtime | After measured need for queues/schedulers |
| WhatsApp inbound webhook | After explicit production decision + security review |
| AI draft replies | After manager approval workflow + quality evaluation |
| Automatic 3D | After visual preparation becomes the main bottleneck |
| GLB viewer | After 3D files exist in deliverables |
| Public share links | After production access policy is defined |
| R2 file storage | After file upload volume exceeds local storage needs |
| Operational analytics | After 5-case proof identifies what to measure |

---

## Components rejected

| Component | Why |
|-----------|-----|
| Microservices architecture | 1 Pages project is enough |
| Separate React/Vue frontend | Admin HTML panel works |
| Kubernetes / Docker | Serverless is simpler |
| Multi-tenant support | Solo operator |
| Real-time dashboards | Logs + smoke tests suffice |
| Event bus / message broker | Request/response is sufficient |
| Multiple databases | 1 D1 is enough |
| OpenAI for classification | Deterministic advisor works for Russian text |

---

## Risks and manual fallback

| Risk | Mitigation | Fallback |
|------|-----------|----------|
| Cloudflare Pages down | Check status.cloudflare.com | Run locally with `wrangler pages dev` |
| D1 write limit hit | Monitor via Cloudflare dashboard | Batch writes, optimize queries |
| Smoke test fails | Fix and re-run | Manual verification via admin UI |
| Package advisor misclassifies | Manager confirms/rejects suggestion | Manual classification |
| Supplier price list outdated | Manager updates before estimate | Use last known prices |
| Credit applied twice | Idempotency key enforced in code | Manual reversal via admin UI |
| No real client requests | Use test data from smoke tests | Manually create test orders |

---

## Criteria for adding complexity later

Complexity may be added ONLY when ALL of the following are true:

1. **Measured bottleneck:** The 5-case proof shows a specific step is the bottleneck (e.g., "visual preparation takes 2 hours per case").
2. **Explicit decision:** Manager decides the bottleneck justifies the complexity (e.g., "we need automated 3D to save 1 hour per case").
3. **Dedicated smoke test:** The new feature has its own smoke test that passes.
4. **Production boundary documented:** The feature is added to `docs/DEPLOYMENT_BOUNDARY.md`.
5. **Failure is non-blocking:** If the new feature fails, Package A/B order intake still works.
6. **No simultaneous activation:** Only one new module is activated at a time (per NEXT_STAGE_INSTRUCTIONS §13).

---

## Addendum — 2026-07-13 Salamat Mebel Landing Route

**Decision:** make the existing Cloudflare Worker `salamat-mebel-kz` the primary runtime for `https://www.salamat-mebel.kz/` by adding route `www.salamat-mebel.kz/* -> salamat-mebel-kz`.

**Why this is still the simplest path:** the Worker already hosted the current Liquid Glass landing design and already contained the updated intake API integration. Routing `www` to that Worker removes the split between Plesk live content and the updated landing, without adding a new backend, repository, database, queue, CRM, or automation layer.

**Manual fallback:** remove the Worker route in Cloudflare to return `www.salamat-mebel.kz` traffic to the existing Plesk origin.

**Stop boundary:** no new parked features are activated by this route change. The next single proof remains one real phone test that creates a saved order in `furniture-orders-mvp`.

**2026-07-13 follow-up:** deployed the same Worker route with `script.js?v=20260713-2` so the landing saves to `furniture-orders-mvp` before opening WhatsApp. This is a sequencing fix inside the existing landing, not a new service or automation layer. `workers.dev` preview is disabled by the Wrangler deploy defaults; the canonical production route remains `https://www.salamat-mebel.kz/`.

**2026-07-13 follow-up 2:** replaced visible direct WhatsApp CTAs on the Salamat landing with the existing intake-first flow. The floating button, mobile sticky WhatsApp button, contact WhatsApp action, and footer WhatsApp action now open a small lead form; WhatsApp opens only after `furniture-orders-mvp` confirms the saved lead. This removes a bypass without adding a backend, database, queue, or automation service.

**2026-07-13 follow-up 3:** added FontAwesome icons and hover/transition states to make the active intake CTAs visible and interactive. Chose FontAwesome CDN instead of Lucide React because the Salamat landing is static HTML/CSS/JS and adding React would create unnecessary build complexity. No new backend, database, queue, or data path was added.

**Examples of justified complexity additions (after Phase 4.1):**
- If visual preparation is the bottleneck → activate controlled 3D for Package B
- If communication handling is the bottleneck → activate manager-approved WhatsApp workflow
- If workflow losses are unclear → activate operational analytics

**Examples of NOT justified:**
- "We might need it later" → no
- "It's already coded" → no (code exists but is deferred)
- "Competitor has it" → no (prove your own flow first)

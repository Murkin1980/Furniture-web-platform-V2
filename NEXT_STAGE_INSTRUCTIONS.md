# Furniture Platform V2 — Instructions for the Next Stage

Created: 2026-07-11
Branch: `harden-v2-boundaries`
Current stage: **Phase 4.1 — Package A/B end-to-end commercial proof**

## 1. Goal

Prove that the production MVP can complete the full paid commercial flow without relying on Package C, a separate orchestrator, inbound WhatsApp automation, automatic AI replies, or automatic 3D execution.

The target flow is:

1. receive a client request;
2. classify the request as Level 1, Package A, or Package B;
3. create an engagement only for a sellable package;
4. record package payment;
5. prepare and review deliverables;
6. create a supplier-aware estimate;
7. approve the package as manager;
8. hand the approved result to the client;
9. convert the engagement into a furniture order;
10. apply credit-on-order exactly once.

## 2. Preconditions

Before feature work:

```bash
npm install
npm run check
npm run smoke:all
npm run smoke:deferred
npm run build
```

Expected production build boundary:

- `.wrangler/dist/functions` contains only `packages/mvp/functions`;
- `.wrangler/dist/src` contains only `packages/mvp/src`;
- `.wrangler/dist/migrations` contains only `packages/mvp/migrations`;
- no `packages/orchestrator` files are present in the production artifact.

Do not deploy if any command fails or if orchestrator files appear in `.wrangler/dist`.

## 3. Security verification

### 3.1 WhatsApp webhook

The webhook is deferred and disabled by default.

Required environment variables when it is intentionally enabled:

```text
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_APP_SECRET=<Meta app secret>
```

Required checks:

- disabled webhook returns `403 webhook_disabled`;
- enabled webhook without `WHATSAPP_APP_SECRET` returns `503 webhook_not_configured`;
- missing signature returns `401 invalid_signature`;
- malformed signature returns `401 invalid_signature`;
- valid HMAC SHA-256 signature allows normal processing;
- invalid JSON with a valid signature returns `400 invalid_json`;
- no database row is created before signature validation succeeds.

Add these cases to `packages/mvp/scripts/whatsapp-smoke.mjs`.

Do not add the real app secret to git. Configure it as a Cloudflare production secret only when inbound WhatsApp is activated by an explicit production decision.

### 3.2 DOM rendering

Search the admin frontend for these patterns:

```bash
grep -R "lastMessagePreview" packages/mvp/public packages/mvp/src
grep -R "innerHTML" packages/mvp/public packages/mvp/src
```

Rules:

- render `lastMessagePreview` with `textContent`;
- never interpolate inbound client text into HTML strings;
- keep plain text in D1;
- normalize control characters and length at the store boundary;
- add an XSS regression case using `<img src=x onerror=alert(1)>`.

## 4. D1 update discipline

For every table that has an `updated_at` column:

- every UPDATE must include `updated_at = CURRENT_TIMESTAMP`;
- dynamic SET clauses should use `withUpdatedAt()` from `packages/mvp/src/shared/store-utils.js`;
- do not add `updated_at` to SQL for tables that do not have that column;
- inspect the corresponding migration before changing an UPDATE statement.

Audit command:

```bash
grep -R "UPDATE " packages/mvp/src packages/mvp/functions
```

Document any intentional exception in code comments.

## 5. Package A end-to-end scenario

Create one repeatable smoke or integration scenario:

1. create or select a test order;
2. classify a request containing `КП`, `смета`, or `по позициям`;
3. verify advisor returns `package_a`;
4. create Package A engagement;
5. record the 10 000 тг payment;
6. create the Package A deliverables;
7. produce a supplier-aware estimate;
8. complete manager review;
9. mark client handoff;
10. convert to furniture order;
11. apply the 10 000 тг credit;
12. retry the credit operation and prove it is idempotent.

Acceptance:

- no Package C or orchestrator dependency;
- exact package price and payment status are visible;
- the estimate references a published supplier price-list version;
- client handoff is impossible before manager approval;
- credit-on-order cannot be applied twice.

## 6. Package B end-to-end scenario

Repeat the same flow for Package B with these additional requirements:

- advisor returns `package_b` for visual/color/layout intent;
- color multi-view deliverables exist;
- dimensions sheet exists;
- one revision round is tracked;
- the `what is included / not included` sheet exists;
- optional 3D remains off unless manually approved;
- no Package C engagement is created.

## 7. Five-case operational proof

Run at least five complete cases:

- two Package A cases;
- two Package B cases;
- one Level 1 case upgraded to Package A or B.

Record for each case:

- input source;
- advisor result;
- selected package;
- payment status;
- preparation time;
- number of manager actions;
- number of revisions;
- supplier price-list version;
- handoff status;
- furniture-order conversion;
- credit amount;
- errors or manual workarounds.

## 8. Metrics required before the next expansion

Do not activate another major module until these metrics are available:

- Package A completion rate;
- Package B completion rate;
- average preparation time by package;
- average number of manager actions;
- revision frequency;
- paid-package to furniture-order conversion;
- percentage of package payments credited to orders;
- failure rate by workflow step.

## 9. Deferred modules

The following code may remain in the repository but must stay outside the default production path:

- `packages/orchestrator`;
- Package C selling flow;
- public project share links;
- GLB viewer;
- inbound WhatsApp production webhook;
- AI draft replies;
- automatic OCR/AI/3D execution;
- queues, schedulers, and long-running workers.

Activation requires all of the following:

1. a measured business need from the five-case proof;
2. an explicit production-boundary decision;
3. documented bindings and migrations;
4. authentication and authorization review;
5. dedicated smoke tests;
6. failure must not block Package A/B order intake.

## 10. Store utility refactor

A shared MVP utility file now exists at:

`packages/mvp/src/shared/store-utils.js`

It currently provides:

- `positiveInteger()`;
- `okResult()`;
- `errorResult()`;
- `normalizePlainTextPreview()`;
- `withUpdatedAt()`.

In the next cleanup pass, migrate only modules whose local helper contracts are exactly identical:

- `src/ai/ai-observability.js`;
- `src/packages/package-store.js`;
- `src/packages/payment-store.js`;
- `src/packages/deliverable-store.js`.

Rules:

- compare helper behavior before replacing;
- migrate one module per commit;
- run the relevant smoke test after each migration;
- do not create a cross-runtime dependency on `packages/shared` for production Pages functions unless the deployment/build resolver is explicitly validated.

## 11. Documentation housekeeping

After Phase 4.1 passes:

- move long-form implementation documents into `docs/`;
- update every repository link in the same commit;
- keep `README.md`, `SIMPLICITY_REVIEW.md`, and this handoff file discoverable from the root;
- choose one source of truth for progress;
- either generate `PROJECT_PROGRESS.html` from Markdown or remove it from git;
- do not maintain two manual progress documents.

## 12. Completion gate

Phase 4.1 is complete only when:

- `npm run check` passes;
- `npm run smoke:all` passes;
- `npm run smoke:deferred` passes or every deferred failure is documented and confirmed non-production;
- `npm run build` produces an MVP-only artifact;
- Package A end-to-end test passes;
- Package B end-to-end test passes;
- five operational cases are recorded;
- credit-on-order idempotency is proven;
- manager approval gates client handoff;
- production deployment checklist is updated;
- PR review has no unresolved critical security findings.

## 13. Next decision after Phase 4.1

Choose exactly one expansion based on measured bottlenecks:

- Controlled 3D for Package B, if visual preparation is the main bottleneck;
- manager-approved WhatsApp workflow, if communication handling is the main bottleneck;
- operational analytics improvements, if workflow losses are unclear.

Do not activate Package C, a separate orchestrator, and WhatsApp automation simultaneously.

# Coder Instructions — Phase 4.1 Package A End-to-End Proof

Date: 2026-07-11
Branch: `harden-v2-boundaries`
Mode: implementation by coder, review by ChatGPT

## 1. Goal

Implement and prove one complete Package A commercial flow inside the current MVP production boundary.

Target flow:

1. Client request text is classified as `package_a`.
2. Manager confirms the package.
3. Package A engagement is created.
4. Payment of 10,000 KZT is recorded and confirmed.
5. Package A deliverables are seeded.
6. Supplier-aware estimate is generated from a published supplier price-list version.
7. Manager reviews and delivers every required deliverable.
8. Client handoff is blocked until all deliverables are delivered.
9. Engagement moves to `delivered` only after the gate passes.
10. Credit-on-order is applied exactly once.
11. A second credit attempt is rejected or returns an idempotent result without creating a second credit event.

Do not activate Package C, orchestrator runtime, WhatsApp automation, AI replies, queues, workers, or 3D.

## 2. Important current branch state

Before starting, inspect the latest branch state.

Two preliminary changes may already exist:

- `packages/mvp/src/packages/package-store.js` may contain a deliverable handoff gate and credit persistence logic.
- `packages/mvp/scripts/phase41-package-a-e2e-smoke.mjs` may already exist as a draft smoke scenario.

Do not duplicate these changes blindly. Review them, correct them where necessary, and make the implementation internally consistent.

## 3. Required implementation

### 3.1 Advisor classification

Use the existing deterministic advisor.

Input example:

```text
Нужно коммерческое предложение и смета по позициям для кухни
```

Expected:

```js
packageCode === PACKAGE_CODES.PACKAGE_A
```

No AI provider may be required.

### 3.2 Engagement lifecycle

Use the existing Package A lifecycle:

```text
offered -> accepted -> paid -> in_progress -> delivered -> credited
```

Requirements:

- Package A price is exactly `10000` KZT.
- `package_c` remains non-sellable.
- Invalid lifecycle shortcuts remain blocked.

### 3.3 Payment

Use the existing payment store.

Requirements:

- Create a 10,000 KZT payment.
- Confirm it.
- Engagement becomes `paid`.
- Double confirmation remains idempotent.

### 3.4 Deliverable gate

Package A deliverables must be seeded from visual standards.

Requirements:

- The engagement cannot move from `in_progress` to `delivered` while any required deliverable is not delivered.
- The gate must be implemented in production code, not only in the smoke test.
- The failure must return a stable `409` error code.
- Suggested errors:
  - `deliverables_not_seeded`
  - `deliverables_not_approved`

Each required deliverable must:

1. have an artifact attached;
2. move to `ready`;
3. move to `delivered` through manager action.

After all deliverables are delivered, engagement handoff may proceed.

### 3.5 Supplier-aware estimate

Create a complete in-memory test setup:

- client;
- order;
- PDF upload;
- reviewed PDF draft with one kitchen furniture zone;
- supplier;
- draft price list;
- kitchen price item;
- published price list;
- supplier-aware estimate.

Acceptance:

- estimate total is positive;
- estimate references the exact published `priceListId`;
- no unpublished price list is used.

### 3.6 Credit-on-order exactly once

Requirements:

- Package A delivered engagement credits exactly `10000` KZT.
- Persist `credited_amount_kzt` when status becomes `credited`.
- A second attempt must not create a second credit event or increase the credited amount.
- Final engagement state:

```text
status = credited
credited_amount_kzt = 10000
```

- Exactly one `status_credited` conversion event exists.

Do not implement a second database or separate credit service.

## 4. Smoke test

Create or finish:

```text
packages/mvp/scripts/phase41-package-a-e2e-smoke.mjs
```

The test must use in-memory SQLite through `node:sqlite` and load the required migrations.

It must verify the complete flow, not isolated functions only.

Suggested sections:

1. Advisor classification
2. Client and order creation
3. Engagement creation and acceptance
4. Payment confirmation
5. Deliverable seeding
6. Premature handoff rejection
7. Artifact attachment and manager delivery
8. Reviewed PDF setup
9. Published supplier price list
10. Supplier-aware estimate
11. Successful handoff
12. Credit application
13. Duplicate credit rejection/idempotency
14. Final database assertions

The script must exit non-zero when any assertion fails.

## 5. Package scripts

Add a workspace script:

```json
"smoke:phase41:a": "node --experimental-sqlite scripts/phase41-package-a-e2e-smoke.mjs"
```

Add a root script:

```json
"smoke:phase41:a": "npm run smoke:phase41:a -w @furniture/mvp"
```

Do not add this test to `smoke:deferred`.

It may be added to `smoke:core` only after it passes reliably and does not require external services.

## 6. Code quality constraints

- No new npm dependency.
- Keep production runtime inside `packages/mvp`.
- Do not import production code from `packages/orchestrator`.
- Do not enable WhatsApp webhook.
- Do not enable Package C.
- Every UPDATE on a table with `updated_at` must update it.
- Preserve existing API response contract:

```js
{ ok, status, body: { success, ... } }
```

- Do not weaken existing transition checks.
- Avoid broad refactors unrelated to Package A proof.

## 7. Required validation

Run:

```bash
npm install
npm run check
npm run smoke:packages
npm run smoke:suppliers
npm run smoke:advisor
npm run smoke:phase41:a
npm run smoke:all
npm run build
```

Also inspect `.wrangler/dist` and confirm it contains no orchestrator files.

## 8. Deliverables from coder

Provide:

1. commit SHA;
2. changed file list;
3. exact test command output;
4. any implementation deviations from this instruction;
5. confirmation that no external service was required;
6. confirmation that Package C and orchestrator remained deferred.

## 9. Review gate

Implementation is accepted only when all are true:

- advisor returns Package A;
- payment is 10,000 KZT;
- engagement cannot be handed off early;
- all deliverables must be delivered first;
- estimate references a published supplier price-list version;
- credit is exactly 10,000 KZT;
- duplicate credit does not create another event;
- all required commands pass;
- build remains MVP-only;
- no deferred module is activated.

After the coder pushes the result, ChatGPT must compare the repository against this file and report:

- compliant items;
- deviations;
- bugs;
- missing tests;
- final pass/fail decision.

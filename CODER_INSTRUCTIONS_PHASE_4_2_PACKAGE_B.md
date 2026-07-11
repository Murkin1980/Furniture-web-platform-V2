# Coder Instructions — Phase 4.2 Package B End-to-End Proof

Date: 2026-07-12
Branch: `harden-v2-boundaries`
Mode: implementation by coder, review by ChatGPT
Baseline commit before this instruction: `4b77a1c60adf717c625e14d7304d1526189e01c8`

## 1. Goal

Implement and prove one complete Package B commercial flow inside the accepted MVP production boundary.

Target flow:

1. Client request text is classified as `package_b`.
2. Manager confirms Package B.
3. Package B engagement is created.
4. Payment of exactly 20,000 KZT is recorded and confirmed.
5. Package B deliverables are seeded from the existing package definition and visual standards.
6. Colored multi-view visuals are attached.
7. A dimensions sheet is attached.
8. An inclusions/exclusions sheet is attached.
9. Exactly one revision round is allowed and recorded.
10. A second revision attempt is blocked.
11. Supplier-aware estimate is generated from an exact published supplier price-list version.
12. Every required deliverable passes a manager approval gate before client handoff.
13. Engagement moves to `delivered` only after all Package B gates pass.
14. Credit-on-order applies exactly 20,000 KZT once.
15. A repeated credit attempt is rejected or returns an idempotent result without creating a second credit event.

Do not activate Package C, orchestrator runtime, automatic WhatsApp webhook, AI replies, OCR/AI/3D automation, GLB viewer, public share links, queues, workers, or another database.

## 2. Accepted production boundary

Preserve the current architecture:

- one repository;
- one Cloudflare Pages project;
- `packages/mvp` is the only production runtime;
- one D1 database;
- no queue;
- no separate worker;
- no separate orchestrator runtime.

Package B proof must run fully inside `packages/mvp` and use local in-memory SQLite for the smoke scenario.

## 3. Inspect before changing

Before implementation, inspect at minimum:

- `CODER_INSTRUCTIONS_PHASE_4_1_PACKAGE_A.md`;
- `packages/mvp/src/packages/package-catalog.js`;
- `packages/mvp/src/packages/package-store.js`;
- payment store and payment smoke tests;
- deliverable/visual standards store and migrations;
- supplier price-list and estimate stores;
- `packages/mvp/scripts/phase41-package-a-e2e-smoke.mjs`;
- root and workspace `package.json` scripts.

Reuse the accepted Package A proof patterns. Do not duplicate lifecycle, credit, payment, deliverable, or estimate logic into a Package B-only service.

Correct shared production logic only where Package B exposes a real missing boundary. Avoid unrelated refactors.

## 4. Required Package B contract

Package B must remain:

```text
code = package_b
price_kzt = 20000
credited_on_order = true
max_revisions = 1
visual_state target = color_multi_view
proposal_depth = detailed
readiness = active
is_sellable = true
```

The engagement lifecycle remains:

```text
offered -> accepted -> paid -> in_progress -> delivered -> credited
```

Invalid shortcuts must remain blocked.

Package C must remain draft and non-sellable.

## 5. Advisor classification

Use the existing deterministic advisor. No AI provider may be required.

Use at least one explicit Package B request, for example:

```text
Нужны цветные виды кухни с размерами, комплектацией, исключениями и одной корректировкой
```

Expected:

```js
packageCode === PACKAGE_CODES.PACKAGE_B
```

The smoke test must also prove that the returned package definition is active and sellable and that its price is exactly `20000`.

Do not weaken Package A or Package C classification behavior to make this case pass.

## 6. Engagement and payment

Use the existing engagement and payment stores.

Requirements:

- engagement is created as Package B;
- engagement price is exactly 20,000 KZT;
- initial `revision_round` is `0`;
- `max_revisions` is `1`;
- create a payment for exactly 20,000 KZT;
- confirm payment;
- engagement becomes `paid`;
- duplicate payment confirmation remains idempotent;
- no external payment provider is required for the smoke test.

A payment with the wrong amount must not silently satisfy the Package B paid gate. If the current production contract already enforces this, prove it. If it does not, add the smallest shared production guard and a stable error response.

## 7. Required Package B deliverables

Seed Package B deliverables through the existing visual standards/deliverable mechanism.

The proof must include all deliverables currently required by the Package B catalog. At minimum, explicitly identify and validate:

- `color_multi_view_visual`;
- `commercial_proposal`;
- `detailed_dimensions`;
- `2_3_layout_variants`;
- `one_revision_round`;
- `inclusions_sheet`;
- `recommended_materials`.

Do not hard-code a second conflicting Package B deliverable list inside the smoke test. The catalog or existing visual standards must remain the source of truth.

### 7.1 Colored views

Attach an artifact representing colored multi-view visuals.

Acceptance:

- artifact is associated with the correct engagement and deliverable;
- deliverable reaches the existing ready/review state;
- visual state is updated consistently to `color_multi_view` when the existing contract requires it;
- the artifact is not treated as a GLB/3D viewer asset.

### 7.2 Dimensions sheet

Attach a dimensions-sheet artifact to the `detailed_dimensions` deliverable.

Acceptance:

- artifact is non-empty and linked to the correct deliverable;
- dimensions sheet is separately identifiable from the commercial proposal and visuals;
- manager approval is required before handoff.

### 7.3 Inclusions/exclusions sheet

Package B must provide a client-readable inclusions/exclusions artifact.

The current catalog contains `inclusions_sheet`. The proof must ensure exclusions are represented in the same artifact or in the existing accepted data contract without inventing a new commercial package.

Acceptance:

- included work/materials are present;
- excluded work/materials are present;
- artifact is linked to `inclusions_sheet` or the established equivalent;
- manager approval is required before handoff.

Do not rename existing catalog keys unless a migration and all dependent tests are updated safely. Prefer preserving `inclusions_sheet` and proving that its content covers both inclusions and exclusions.

## 8. One revision round only

Use the existing shared revision mechanism.

Required sequence:

1. engagement starts with `revision_round = 0`;
2. first revision request succeeds;
3. engagement becomes `revision_round = 1`;
4. second revision request fails with HTTP-style status `409`;
5. stable error code is `revision_limit_reached`;
6. database remains at `revision_round = 1` after the rejected attempt;
7. rejected attempt creates no duplicate revision event or side effect, if revision events exist.

The smoke test must call production code for both attempts. It must not simulate the limit with a test-only conditional.

Do not increase Package B `max_revisions` above `1`.

## 9. Manager approval gate

Client handoff must be blocked until every required Package B deliverable has been reviewed and approved/delivered through manager action.

Required negative proofs:

- handoff before deliverables are seeded is rejected;
- handoff with missing artifacts is rejected;
- handoff while at least one required deliverable is not manager-approved/delivered is rejected;
- handoff after the revision round but before the revised artifact is approved is rejected when the existing model represents a revised artifact/version;
- a non-manager path cannot bypass the approval gate if actor/role enforcement already exists.

Required positive proof:

- after every required deliverable has an artifact and reaches the accepted manager-approved/delivered state, transition to `delivered` succeeds.

Use stable `409` errors. Preserve existing errors where applicable:

- `deliverables_not_seeded`;
- `deliverables_not_approved`.

If a distinct missing-artifact error already exists, use it. Do not create many overlapping error codes without need.

The gate must exist in production code, not only in the smoke script.

## 10. Supplier-aware estimate

Build a complete in-memory supplier estimate setup using existing stores and migrations:

- client;
- order;
- source PDF upload;
- reviewed PDF draft with at least one furniture zone;
- supplier;
- draft supplier price list;
- at least one matching price item;
- published supplier price-list version;
- supplier-aware estimate linked to the Package B order/engagement context where supported.

Acceptance:

- estimate total is positive;
- estimate references the exact published `priceListId`;
- no draft or unpublished price list is used;
- Package B detailed deliverables do not replace the estimate source-of-truth rules;
- no external supplier API is required.

## 11. Credit-on-order exactly once

Requirements:

- only a delivered Package B engagement can be credited;
- credited amount is exactly `20000` KZT;
- persist `credited_amount_kzt = 20000`;
- final engagement status is `credited`;
- exactly one `status_credited` conversion event exists;
- a second credit attempt does not add another event;
- a second credit attempt does not increase or alter `credited_amount_kzt`;
- Package A credit behavior remains unchanged at 10,000 KZT.

Expected final Package B state:

```text
status = credited
credited_amount_kzt = 20000
revision_round = 1
max_revisions = 1
```

Do not add a separate credit service, database, queue, or worker.

## 12. End-to-end smoke test

Create:

```text
packages/mvp/scripts/phase42-package-b-e2e-smoke.mjs
```

Use in-memory SQLite through `node:sqlite` and load the required migrations in deterministic order.

The script must exercise production stores/functions and prove the complete flow, not isolated utility functions.

Required sections:

1. Package B advisor classification.
2. Package definition assertions.
3. Client and order creation.
4. Engagement creation and acceptance.
5. Exact 20,000 KZT payment and confirmation.
6. Package B deliverable seeding.
7. Premature handoff rejection.
8. Colored multi-view artifact.
9. Dimensions-sheet artifact.
10. Inclusions/exclusions artifact.
11. Remaining required Package B artifacts.
12. First revision succeeds.
13. Revised artifact/state is recorded where supported.
14. Second revision fails with `revision_limit_reached`.
15. Manager approval gate rejects incomplete approval.
16. Reviewed PDF setup.
17. Published supplier price list.
18. Supplier-aware estimate.
19. Manager approval/delivery of every required deliverable.
20. Successful handoff.
21. Credit application.
22. Duplicate credit rejection/idempotency.
23. Final database assertions.
24. Package C remains non-sellable.

The script must print clear assertion names and exit non-zero on any failure.

Do not use network access, secrets, Cloudflare credentials, AI providers, WhatsApp, or external services.

## 13. Package scripts

Add a workspace script:

```json
"smoke:phase42:b": "node --experimental-sqlite scripts/phase42-package-b-e2e-smoke.mjs"
```

Add a root script:

```json
"smoke:phase42:b": "npm run smoke:phase42:b -w @furniture/mvp"
```

Do not add this test to `smoke:deferred`.

Add it to the production/core aggregate only when it is deterministic, external-service-free, and all existing core tests still pass.

Do not remove or weaken `smoke:phase41:a`.

## 14. Regression requirements

The implementation must preserve all accepted Package A behavior:

- Package A remains 10,000 KZT;
- Package A has no revision round;
- Package A deliverable gate remains enforced;
- Package A supplier-aware estimate remains valid;
- Package A credit remains exactly once at 10,000 KZT.

It must also preserve:

- Level 1 behavior;
- Package C advisor detection as draft/non-sellable;
- Package C engagement creation rejection;
- MVP-only production build;
- no orchestrator in `.wrangler/dist`;
- current API response contract:

```js
{ ok, status, body: { success, ... } }
```

## 15. Code-quality constraints

- No new npm dependency unless absolutely unavoidable; default is no dependency.
- Keep production runtime inside `packages/mvp`.
- Do not import runtime code from `packages/orchestrator`.
- Do not add a second database.
- Do not introduce queues or background workers.
- Do not activate deferred modules.
- Every UPDATE on a table with `updated_at` must update it.
- Use parameterized SQL.
- Preserve existing error/result contracts.
- Avoid broad schema changes.
- Avoid broad refactors unrelated to Package B proof.
- Reuse shared payment, deliverable, revision, estimate, and credit logic.
- Test-only shortcuts are not acceptable for production gates.

## 16. Required validation

Run from repository root:

```bash
npm install
npm run check
npm run smoke:packages
npm run smoke:suppliers
npm run smoke:advisor
npm run smoke:phase41:a
npm run smoke:phase42:b
npm run smoke:all
npm run build
```

Record exact pass counts for every smoke command that prints counts.

Then inspect the production output and prove:

```bash
find .wrangler/dist -type f | sort
```

Acceptance:

- build passes;
- no orchestrator file/module is present in `.wrangler/dist`;
- no deferred worker bundle is present;
- no Package C runtime activation appears in production output.

If the repository has a documented equivalent command for Windows, it may be used, but provide the exact output or file list.

## 17. Deliverables from coder

Provide all of the following:

1. implementation commit SHA;
2. changed-file list;
3. concise explanation of shared production changes;
4. exact output of every required validation command;
5. Package B smoke assertion count;
6. proof that first revision succeeded and second revision failed;
7. proof that manager approval blocked premature handoff;
8. proof that estimate used an exact published price-list version;
9. proof that exactly one 20,000 KZT credit event exists;
10. confirmation that Package A still passes;
11. confirmation that Package C remains draft/non-sellable;
12. confirmation that no external service was required;
13. confirmation that production build contains no orchestrator;
14. list of any deviations from this instruction.

Push the implementation to:

```text
harden-v2-boundaries
```

Do not create a new production architecture or a separate PR unless explicitly instructed.

## 18. Review gate

ChatGPT will mark the implementation PASS only when all are true:

- advisor deterministically returns Package B for the test request;
- Package B is active and sellable;
- Package B price is exactly 20,000 KZT;
- payment confirmation results in the paid Package B engagement;
- colored multi-view visuals are represented by an attached artifact;
- dimensions sheet is represented by an attached artifact;
- inclusions and exclusions are represented in the client deliverable;
- all current Package B catalog deliverables are satisfied;
- exactly one revision round succeeds;
- second revision is blocked with `409 revision_limit_reached`;
- manager approval gate blocks premature handoff;
- supplier-aware estimate references an exact published price-list version;
- successful handoff occurs only after all gates pass;
- credit is exactly 20,000 KZT;
- duplicate credit creates no second event;
- Package A regression proof passes;
- Package C remains draft and non-sellable;
- all required commands pass;
- production build remains MVP-only;
- no deferred subsystem is activated.

After the coder pushes the implementation, ChatGPT must compare the exact commit and repository state against this file and report:

- compliant items;
- deviations;
- bugs;
- missing tests;
- regression risks;
- exact commands independently checked;
- final PASS or FAIL decision.

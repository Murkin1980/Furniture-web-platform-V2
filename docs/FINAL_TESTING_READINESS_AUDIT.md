# Furniture Platform V2 — Final Testing Readiness Audit

Date: 2026-07-12
Branch: `harden-v2-boundaries`
Audited head before this documentation update: `665aba11a3e4b5126afcc1bd203b79690730600d`
Audit status: complete
Testing readiness: **NOT READY**

## Summary

The MVP architecture remains within the accepted Simplicity First boundary, and the reported automated suite passes. However, the paid commercial workflow still contains payment-integrity bypasses that must be fixed before a controlled real-world test.

## Issue register

| ID | Category | Description | Severity | Evidence | File / area | Impact | Required fix | Status |
|---|---|---|---|---|---|---|---|---|
| PAY-001 | Payment integrity | `createPayment()` accepts any positive amount and does not compare it with `engagement.priceKzt`. | critical | Payment validation checks only positive integer and engagement status. | `packages/mvp/src/packages/payment-store.js` | Package A/B can be paid with an incorrect amount. | Require exact equality with engagement price and return `409 payment_amount_mismatch`. | open |
| PAY-002 | Payment confirmation | `confirmPayment()` confirms a pending payment and transitions the engagement to `paid` without re-checking the amount against the package price. | critical | Confirmation path updates payment and then calls `transitionEngagement(..., paid)`. | `packages/mvp/src/packages/payment-store.js` | An incorrect pending payment can activate the paid workflow. | Re-check exact amount before confirmation and leave payment/engagement unchanged on mismatch. | open |
| PAY-003 | Status bypass | `transitionEngagement()` permits direct `accepted → paid` without proving a confirmed payment exists. | critical | Status transition table explicitly allows the transition and the store has no payment gate. | `packages/mvp/src/packages/package-store.js` | API/UI callers can mark work paid without a confirmed payment record. | Add a confirmed-payment gate and stable `409 payment_confirmation_required`. | open |
| UI-001 | Admin UI | The engagement table exposes a direct `Paid` button that calls the generic status transition endpoint. | critical | Engagement action buttons include `Paid`. | `packages/mvp/public/admin.js` | Operator can bypass payment creation and confirmation. | Remove the direct `Paid` button; paid state must only result from payment confirmation. | open |
| UI-002 | Admin UI | Payment amount is editable in the payment modal. | high | Number input is populated with package price but remains editable. | `packages/mvp/public/admin.js` | Operator error or deliberate mismatch is easy. | Render amount read-only or as text; server validation remains mandatory. | open |
| TEST-001 | Regression coverage | No explicit negative test proves 19 999 and 20 001 KZT are rejected for a 20 000 KZT engagement. | high | Current reported totals do not establish these guards. | Phase 4.3 / payment smoke tests | Payment regression may reappear unnoticed. | Add mismatch tests for lower and higher amounts. | open |
| TEST-002 | Regression coverage | No explicit negative test proves direct `accepted → paid` is rejected without a confirmed payment. | high | Generic transition remains allowed. | Phase 4.3 / package smoke tests | Status bypass may reappear unnoticed. | Add direct-transition rejection test with stable error code. | open |
| OPS-001 | Operator validation | Full browser rehearsal has not been independently recorded with step-by-step result. | high | Automated rehearsal is not equivalent to browser interaction. | Admin UI / readiness documentation | Buttons or integrated UI flow may fail despite store-level tests. | Complete and document one full `PHASE43-REHEARSAL` Package B flow in browser. | open |
| DOC-001 | Documentation | Operational rehearsal report exists in both root `docs/` and `packages/mvp/docs/`. | medium | Both paths were introduced in Phase 4.3 commit. | Documentation tree | Two copies can drift. | Keep one source, preferably `docs/PHASE_4_3_OPERATIONAL_REHEARSAL_REPORT.md`. | open |
| DOC-002 | Documentation accuracy | `NEXT_STAGE_INSTRUCTIONS.md` states Phase 4.3 is complete and all gates passed despite open payment blockers. | high | Completion section reports 1 021 passing assertions and resolved gate. | `NEXT_STAGE_INSTRUCTIONS.md` | Repository communicates false readiness. | Change current status to remediation / NOT READY until audit blockers close. | open |
| DOC-003 | Progress reporting | `docs/PROJECT_PROGRESS.html` must be updated after the remediation commit and browser rehearsal. | medium | Current dashboard predates the required fix commit. | `docs/PROJECT_PROGRESS.html` | Visual status may show complete while readiness is blocked. | Mark testing readiness NOT READY now; later update commit/test totals and READY state after acceptance. | open |
| API-001 | Scope wording | Client and order additions are described as full CRUD although exposed routes primarily cover create/list/read. | low | Route set does not demonstrate update/delete for each entity. | Phase 4.3 reports | Documentation overstates current scope. | Use precise wording: create/list/read unless update/delete are added and needed. | open |

## Verified positive findings

- Package A and Package B remain the active paid packages.
- Package C remains non-sellable.
- New operator functionality stays inside `packages/mvp`.
- No new framework, queue, worker, orchestrator runtime, ORM, or database was introduced in Phase 4.3.
- Admin API routes use the existing authorization helper.
- UI support exists for client/order creation, advisor classification, revision resolution, supplier price items, supplier-aware estimate generation, delivery, and credit actions.
- The operational rehearsal clearly labels synthetic cases as non-real customers.
- Production configuration, migration, deployment, and rollback documentation exists.
- Reported automated result at the audited Phase 4.3 commit: 1 021 assertions, 0 failures.

## Required remediation scope

The next coder commit must be narrow and contain only readiness remediation:

1. add exact server-side payment amount validation;
2. add `payment_amount_mismatch`;
3. block direct paid transition without a confirmed matching payment;
4. add `payment_confirmation_required`;
5. remove the direct UI `Paid` button;
6. make the displayed payment amount non-editable;
7. add negative payment and transition tests;
8. remove the duplicate rehearsal report;
9. perform and document the full browser rehearsal;
10. correct `NEXT_STAGE_INSTRUCTIONS.md`;
11. update `docs/PROJECT_PROGRESS.html`;
12. update this audit with fixed statuses and evidence.

Do not add unrelated product features or architecture.

## READY gate

`Testing readiness: READY` is allowed only when:

- all `critical` issues are `fixed`;
- all `high` issues are `fixed` or explicitly accepted by the owner with documented rationale;
- payment mismatches are rejected server-side;
- direct paid transition is rejected without a confirmed matching payment;
- the browser rehearsal passes;
- all automated checks pass;
- the production artifact remains MVP-only;
- Package C and all deferred modules remain disabled;
- the visual progress dashboard is current.

## Required coder report

```text
Audit status: complete/incomplete
Commit SHA:
Audited branch:
Total issues found:
Critical:
High:
Medium:
Low:

Open blockers:
1.
2.
3.

Fixed in this commit:
1.
2.
3.

Tests added:
1.
2.
3.

Test results:
- check:
- smoke:all:
- build:
- production readiness:
- browser rehearsal:

Production boundary:
- MVP-only:
- Orchestrator absent:
- Package C deferred:
- WhatsApp automation disabled:
- AI/OCR/3D disabled:

Dashboard updated:
Audit file: docs/FINAL_TESTING_READINESS_AUDIT.md
Known remaining risks:
Testing readiness: READY / NOT READY
```

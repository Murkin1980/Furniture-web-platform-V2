# Furniture Platform V2 — Final Testing Readiness Audit

Date: 2026-07-12
Branch: `harden-v2-boundaries`
Audit status: remediation implemented, runtime validation pending
Testing readiness: **NOT READY**

## Summary

The critical payment-integrity code defects have been remediated in the repository. Exact package payment amounts are now enforced, direct transition to `paid` requires a confirmed matching payment, a dedicated regression smoke was added, and the production build hardens the admin payment controls.

Testing readiness remains `NOT READY` until the full command suite and browser rehearsal are executed and recorded, and the visual progress dashboard is updated with verified results.

## Issue register

| ID | Category | Description | Severity | Evidence / remediation | File / area | Status |
|---|---|---|---|---|---|---|
| PAY-001 | Payment integrity | Payment amount was not compared with engagement price. | critical | `createPayment()` now requires exact equality and returns `409 payment_amount_mismatch`. | `packages/mvp/src/packages/payment-store.js` | fixed |
| PAY-002 | Payment confirmation | Confirmation did not re-check the amount. | critical | `confirmPayment()` now re-loads the engagement and rejects mismatches before confirmation. | `packages/mvp/src/packages/payment-store.js` | fixed |
| PAY-003 | Status bypass | Direct `accepted → paid` transition did not require payment proof. | critical | `transitionEngagement()` now requires a confirmed payment matching `price_kzt` and returns `409 payment_confirmation_required`. | `packages/mvp/src/packages/package-store.js` | fixed |
| UI-001 | Admin UI | Production engagement table exposed a direct `Paid` button. | critical | Production build removes the direct Paid control and fails if it remains. | `scripts/build.mjs`, `.wrangler/dist/public/admin.js` | fixed_pending_build_verification |
| UI-002 | Admin UI | Payment amount was editable. | high | Production build renders `pay-amount` read-only and fails if hardening is not applied. | `scripts/build.mjs`, `.wrangler/dist/public/admin.js` | fixed_pending_build_verification |
| TEST-001 | Regression coverage | No lower/higher payment mismatch tests. | high | Added 19 999 and 20 001 KZT rejection assertions. | `packages/mvp/scripts/payment-integrity-smoke.mjs` | fixed_pending_execution |
| TEST-002 | Regression coverage | No direct paid-bypass regression test. | high | Added rejection assertion for direct `accepted → paid`. | `packages/mvp/scripts/payment-integrity-smoke.mjs` | fixed_pending_execution |
| OPS-001 | Operator validation | Full browser rehearsal is not recorded. | high | Required steps are now documented in `NEXT_STAGE_INSTRUCTIONS.md`. | Admin UI | open |
| DOC-001 | Documentation | Duplicate operational rehearsal report existed. | medium | Removed `packages/mvp/docs/PHASE_4_3_OPERATIONAL_REHEARSAL_REPORT.md`; root `docs/` copy remains. | Documentation tree | fixed |
| DOC-002 | Documentation accuracy | Phase 4.3 was reported complete despite blockers. | high | `NEXT_STAGE_INSTRUCTIONS.md` now reports testing-readiness remediation and requires validation. | `NEXT_STAGE_INSTRUCTIONS.md` | fixed |
| DOC-003 | Progress reporting | Visual dashboard still needs verified remediation results. | medium | Update required after tests/build/browser rehearsal. | `docs/PROJECT_PROGRESS.html` | open |
| API-001 | Scope wording | Earlier report described create/list/read routes as full CRUD. | low | Future reporting must use precise create/list/read wording. | Documentation | open |

## Added regression gate

Run:

```bash
npm run smoke:payment-integrity
```

Expected assertions include:

- Package B engagement creation;
- accepted status;
- 19 999 KZT rejection;
- stable `payment_amount_mismatch` for lower amount;
- 20 001 KZT rejection;
- stable `payment_amount_mismatch` for higher amount;
- direct paid transition rejection;
- stable `payment_confirmation_required`;
- exact 20 000 KZT payment creation;
- exact payment confirmation;
- final engagement status `paid`.

The root `smoke:all` command now includes this payment-integrity smoke.

## Production build gate

The build must fail if the copied production admin script still contains:

```text
_transitionEngagement(${e.id},'paid')
```

The build must also fail if `pay-amount` is not rendered read-only in the production artifact.

## Remaining blockers

1. Execute and record `npm run check`.
2. Execute and record `npm run smoke:payment-integrity`.
3. Execute and record `npm run smoke:all`.
4. Execute and record `npm run smoke:production`.
5. Execute and record `npm run build`.
6. Inspect `.wrangler/dist` for MVP-only boundary and hardened admin controls.
7. Complete the full Package B browser rehearsal.
8. Create `docs/PHASE_4_3_BROWSER_REHEARSAL_REPORT.md`.
9. Update `docs/PROJECT_PROGRESS.html` with verified commit and test totals.

## READY gate

`Testing readiness: READY` is allowed only after all remaining blockers above are complete and no critical or high issue remains open.

## Required final report

```text
Audit status: complete/incomplete
Commit SHA:
Audited branch:
Open critical:
Open high:
Check:
Payment integrity smoke:
Smoke total:
Production smoke:
Build:
MVP-only artifact:
Direct Paid control absent:
Payment amount read-only:
Browser rehearsal:
Dashboard updated:
Known remaining risks:
Testing readiness: READY / NOT READY
```

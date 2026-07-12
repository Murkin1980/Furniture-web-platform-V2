# Furniture Platform V2 — Next Stage Instructions

Date: 2026-07-12
Branch: `harden-v2-boundaries`
Current stage: **Testing-readiness remediation**

## Goal

Finish every remaining preparation before the first controlled real-world Package A or Package B test.

Do not add new product features. Work only on readiness, verification, and truthful reporting.

## Completed foundation

- Package A commercial flow implemented;
- Package B commercial flow implemented;
- five deterministic Phase 4.3 rehearsals implemented;
- operator client/order/advisor views implemented;
- supplier-aware estimates implemented;
- deployment, migration, configuration, and rollback documentation created;
- production boundary remains one Pages project, `packages/mvp`, and one D1 database;
- Package C and orchestrator remain deferred.

## Payment-integrity remediation

The repository now requires:

- exact payment amount equality with `engagement.priceKzt`;
- stable `409 payment_amount_mismatch` on lower or higher amounts;
- a confirmed matching payment before transition to `paid`;
- stable `409 payment_confirmation_required` on direct bypass attempts;
- production admin artifact without a direct `Paid` button;
- production payment amount rendered read-only;
- negative regression coverage through `smoke:payment-integrity`.

## Required validation

Run:

```bash
npm install
npm run check
npm run smoke:payment-integrity
npm run smoke:all
npm run smoke:production
npm run build
```

Then inspect `.wrangler/dist` and confirm:

- only MVP runtime files are present;
- no orchestrator files are present;
- direct `Paid` control is absent from `.wrangler/dist/public/admin.js`;
- `pay-amount` is read-only in `.wrangler/dist/public/admin.js`.

## Browser rehearsal gate

Complete one full browser rehearsal using test data labelled `PHASE43-REHEARSAL`:

1. create client;
2. create order;
3. classify a Package B request;
4. create and accept Package B engagement;
5. confirm that 19 999 and 20 001 KZT are rejected;
6. create and confirm exactly 20 000 KZT payment;
7. confirm there is no direct Paid button;
8. seed and complete deliverables;
9. request and resolve one revision;
10. confirm a second revision is blocked;
11. generate supplier-aware estimate from a published price list;
12. deliver all items;
13. transition engagement to delivered;
14. apply 20 000 KZT credit;
15. retry credit and confirm no duplicate credit event.

Record the result in:

`docs/PHASE_4_3_BROWSER_REHEARSAL_REPORT.md`

## Documentation gate

Update after validation:

- `docs/FINAL_TESTING_READINESS_AUDIT.md`;
- `docs/PROJECT_PROGRESS.html`;
- `docs/PHASE_4_3_BROWSER_REHEARSAL_REPORT.md`.

Do not report `Testing readiness: READY` until:

- all critical and high audit issues are fixed;
- all commands pass;
- browser rehearsal passes;
- production artifact is MVP-only;
- progress dashboard is current.

## Deferred scope

Keep disabled:

- Package C;
- orchestrator;
- queues and workers;
- inbound WhatsApp automation;
- AI replies;
- OCR/AI/3D automation;
- GLB viewer;
- public share links.

## Required final report

```text
Testing readiness: READY / NOT READY
Commit SHA:
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
Open blockers:
```

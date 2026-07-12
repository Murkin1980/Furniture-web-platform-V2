# Furniture Platform V2 — Testing Readiness Goal

Date: 2026-07-12
Branch: `harden-v2-boundaries`

## Goal

Finish every technical, operational, security, deployment, and documentation preparation required before the first controlled real-world test of Package A or Package B.

The current objective is not to add new product scope. The objective is to remove all blockers between the current repository state and a safe controlled customer test.

## Definition of READY

Testing readiness may be reported as `READY` only when all of the following are true:

- Package A price is exactly 10 000 KZT;
- Package B price is exactly 20 000 KZT;
- the server rejects any payment amount that differs from the engagement price;
- an engagement cannot transition to `paid` without a confirmed matching payment;
- the admin UI does not expose a direct manual `Paid` bypass;
- the payment amount is not freely editable in the operator UI;
- the complete operator workflow can be completed through the admin UI without SQL, Wrangler D1 console, browser developer tools, or manual HTTP requests;
- client, order, advisor, engagement, payment, deliverables, revisions, supplier price list, estimate, handoff, order conversion, and credit are all usable through the operator interface;
- Package B allows exactly one revision and blocks a second revision;
- duplicate credit application remains idempotent;
- Package C remains non-sellable;
- orchestrator, queues, workers, inbound WhatsApp automation, AI replies, OCR, AI processing, automatic 3D, GLB viewer, and public share links remain outside the production path;
- all required smoke tests pass;
- the production build contains only `packages/mvp` runtime files;
- Cloudflare Pages and D1 configuration, migration, backup, rollback, and post-deployment verification are documented;
- a complete browser rehearsal has been performed and recorded;
- `docs/PROJECT_PROGRESS.html` is current;
- `docs/FINAL_TESTING_READINESS_AUDIT.md` contains no open `critical` or `high` issues.

## Current status

`Testing readiness: NOT READY`

Open blockers are tracked in:

`docs/FINAL_TESTING_READINESS_AUDIT.md`

## Work rule

Do not add new product features until the readiness blockers are closed.

Allowed work:

- payment integrity fixes;
- status-transition guards;
- negative regression tests;
- operator-flow completion;
- browser rehearsal;
- documentation correction;
- progress-dashboard update;
- deployment-readiness verification.

Not allowed:

- Package C activation;
- orchestrator activation;
- new queues or workers;
- second database;
- new frontend framework;
- WhatsApp automation activation;
- AI, OCR, or 3D automation activation;
- speculative architecture expansion.

## Final completion report

The coder must report:

```text
Testing readiness: READY / NOT READY
Commit SHA:
Open critical issues:
Open high issues:
Check:
Smoke total:
Build:
MVP-only artifact:
Browser rehearsal:
Dashboard updated:
Known remaining risks:
```

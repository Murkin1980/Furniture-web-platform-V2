# Simplicity First Review — Furniture Web Platform V2

## 1. Business result

The current product must help a furniture company turn an incoming request into a paid, controlled commercial deliverable without forcing the team to operate several runtimes or unfinished automation systems.

The shortest sellable path is:

1. receive the client request;
2. offer Level 1, Package A, or Package B;
3. create the engagement and record payment/credit-on-order;
4. prepare the agreed deliverables;
5. calculate the order with supplier-aware pricing;
6. hand the result to the manager and client.

Anything that does not directly support this path is deferred by default.

## 2. Simplicity budget

For the current production phase:

- 1 repository;
- 1 deployed application: Cloudflare Pages;
- 1 production runtime: `packages/mvp`;
- 1 production D1 database;
- R2 only for reviewed files and artifacts;
- 0 independent orchestrator deployments;
- 0 production queues or schedulers;
- 0 automatic OCR/AI/3D execution without human review;
- 1 active commercial catalog: Level 1, Package A, Package B;
- Package C remains draft and non-sellable.

## 3. Three possible implementation paths

### Option A — Keep every existing module in the main production path

Rejected. It makes unfinished WhatsApp, project sharing, orchestrator, AI, and 3D work part of routine validation and increases the number of systems that appear production-ready.

### Option B — Delete all deferred modules now

Rejected for the current branch. It creates a risky rollback and discards useful experiments before the core commercial flow is stabilized.

### Option C — Keep deferred code, remove it from the default production path

Selected. The code may remain in the repository, but production build, deployment, migrations, smoke checks, and sellable product behavior must not depend on it.

## 4. Decisions applied

### Keep in the default path

- Level 1;
- Package A;
- Package B;
- package lifecycle and credit-on-order;
- managed deliverables;
- PDF intake with human review;
- supplier-aware pricing;
- deterministic package advisor;
- one Cloudflare Pages deployment;
- one D1 production boundary.

### Keep, but mark as deferred

- Package C;
- independent orchestrator runtime;
- WhatsApp inbound workflow and AI drafts;
- public project sharing;
- GLB viewer;
- automatic OCR/AI/3D execution;
- queues, schedulers, and long-running workers.

### Remove from the default validation path

The root `smoke:all` command now runs only the core commercial suite:

- package catalog and engagement flow;
- supplier-aware pricing;
- package advisor.

Deferred checks remain available through `npm run smoke:deferred` and can be run intentionally during experiments or before a future activation decision.

## 5. Rules for new features

A new feature may enter the production path only when all answers are yes:

1. Does it improve the current Level 1 / Package A / Package B customer path?
2. Is there a real user or operational need now?
3. Can it reuse the existing Pages + D1 runtime?
4. Can it work without a new queue, worker, service, or provider?
5. Is failure safe and non-blocking for order intake?
6. Is there a smoke check for the exposed behavior?
7. Is the feature documented in `docs/DEPLOYMENT_BOUNDARY.md`?

If any answer is no, the feature remains a draft or experiment.

## 6. Stop-doing list

Until the commercial core is proven:

- do not create another production runtime;
- do not deploy `packages/orchestrator` independently;
- do not sell Package C;
- do not apply orchestrator migrations to production;
- do not put deferred modules back into `smoke:all`;
- do not add infrastructure for hypothetical scale;
- do not automate a workflow that has not first been completed manually and measured.

## 7. Next simplest milestone

Complete and verify the paid Package A/B flow end to end:

1. client request;
2. package recommendation;
3. engagement creation;
4. payment record;
5. deliverable preparation;
6. supplier-aware estimate;
7. manager approval;
8. client handoff;
9. conversion to furniture order with package credit applied.

Only after this path is repeatedly successful should the project activate controlled 3D, inbound WhatsApp automation, or a separate orchestrator runtime.

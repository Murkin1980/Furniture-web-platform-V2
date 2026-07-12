# V2 Deployment Boundary

This document fixes the production boundary for Furniture Platform V2 before the next production deployment.

## Current production runtime

The current production runtime is a single Cloudflare Pages project:

- `furniture-platform-v2.pages.dev`

The MVP runtime is the production surface:

- `packages/mvp/functions/**`
- `packages/mvp/public/**`
- `packages/mvp/src/**`
- `packages/mvp/migrations/**`

## Orchestrator boundary

`packages/orchestrator` is present in the repository, but it is not an independently deployed production runtime until a separate deployment decision is recorded.

For the current phase:

- no separate orchestrator Pages project is defined;
- no separate orchestrator Worker is defined;
- no queue, scheduler, or long-running AI runner is enabled for orchestrator;
- orchestrator migrations must not be applied to production unless explicitly listed in a deployment checklist.

## D1 boundary

The current D1 database is:

- `furniture-platform-v2`

For the current phase, the MVP uses this D1 database. If orchestrator becomes a production runtime later, the team must decide explicitly whether it shares this D1 database or receives a separate database.

## R2 boundary

R2 usage is allowed only for reviewed file and artifact workflows. Public download behavior must be controlled by package access policy and explicit approval flags.

## Production rule

A feature is not part of production just because its code exists in the monorepo. A feature becomes production only when all are true:

1. the runtime surface is documented here;
2. required D1/R2 bindings are documented;
3. migrations are included in the release checklist;
4. auth behavior is documented;
5. smoke checks cover the exposed route or workflow.

## Deferred runtime decisions

The following require a new decision before production enablement:

- separate orchestrator deployment;
- WhatsApp inbound production webhook;
- AI draft replies;
- GLB viewer production access;
- Package C selling flow;
- public share viewer downloads;
- automated OCR/AI/3D execution.

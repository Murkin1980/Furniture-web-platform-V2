# V2 Auth Audit

This audit records the auth boundary check requested before V2 production deployment.

## Search performed

Repository-wide searches were performed for:

- `requireAdminToken`
- `ADMIN_TOKEN`
- `auth.js requireAuth authorizeAdmin admin token`

## Result

No repository search results were returned for `requireAdminToken` or direct `ADMIN_TOKEN` usage in the code search index.

This means the old inline `requireAdminToken` pattern from V1 was not detected in the indexed V2 code.

## Required rule

V2 must not reintroduce inline admin token checks in route files.

Admin or manager-only routes must use the shared scoped auth helper pattern. Public routes must be explicitly documented as public.

## Before production deploy

Run a local verification pass:

```bash
grep -R "requireAdminToken" packages/mvp/functions packages/orchestrator/functions || true
grep -R "ADMIN_TOKEN" packages/mvp/functions packages/orchestrator/functions || true
grep -R "Bearer" packages/mvp/functions packages/orchestrator/functions || true
```

If any route contains direct token parsing or direct environment token comparison, refactor it to the shared scoped auth helper before production.

## Acceptance criteria

- No inline `requireAdminToken` helpers in route files.
- No direct `env.ADMIN_TOKEN` comparisons in route files.
- Auth-sensitive routes are covered by smoke checks for unauthorized and authorized requests.
- Public routes are intentionally public and documented.

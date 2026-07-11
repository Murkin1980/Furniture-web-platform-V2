# Production Rollback Plan — Furniture Platform V2

Date: 2026-07-12

## How To Identify the Previously Working Commit

```bash
git log --oneline -10
# Find the last commit where smoke:all passed
git checkout <commit-sha> -- packages/mvp
```

## How To Redeploy the Previous Cloudflare Pages Version

Option 1 — Re-deploy from previous commit:
```bash
git checkout <previous-good-commit>
npm run build
npm run deploy
```

Option 2 — Use Cloudflare Dashboard:
1. Go to Cloudflare Pages → furniture-platform-v2 → Deployments
2. Find the last successful deployment
3. Click "..." → "Retry deployment"

## How To Handle a Failed Migration

- D1 migrations are idempotent (`CREATE TABLE IF NOT EXISTS`)
- Re-run: `wrangler d1 migrations apply furniture-platform-v2 --remote`
- If a migration has a defect: do NOT roll back D1 schema
- Instead: create a new forward-fix migration

## When Not To Roll Back D1 Data Automatically

- Never automatically delete data during rollback
- Existing orders, payments, and engagements must be preserved
- Rollback is a code revert, not a data revert
- If new schema columns are nullable, old code will ignore them safely

## How To Disable Commercial Intake Temporarily

Set all engagements to a manual-review state:
```sql
-- Run via wrangler d1 execute
UPDATE order_package_engagements SET status = 'offered' WHERE status IN ('accepted', 'paid');
```

Or simply remove the deployment (Pages will show 404).

## How To Preserve Existing Orders and Payments

- All data lives in D1 (not in code)
- Code rollback does not affect D1 data
- Orders, payments, engagements, deliverables are all preserved
- New code must be backward-compatible with existing data

## How To Confirm Rollback Success

1. `npm run check` passes
2. `npm run smoke:all` passes
3. Admin panel loads
4. Existing orders are still visible
5. No new errors in Cloudflare Pages logs

# Production Deployment Checklist — Furniture Platform V2

Date: 2026-07-12

## 1. Pre-deployment Repository State

```bash
git status
git log --oneline -5
```

- [ ] Working directory clean
- [ ] On branch `harden-v2-boundaries`
- [ ] Latest commit is the deployment target

## 2. Branch and Commit Confirmation

- [ ] Branch: `harden-v2-boundaries`
- [ ] Commit SHA: ____________
- [ ] No uncommitted changes

## 3. Cloudflare Pages Project Confirmation

```bash
wrangler pages project list
```

- [ ] Project `furniture-platform-v2` exists
- [ ] Correct Cloudflare account

## 4. D1 Database Confirmation

```bash
wrangler d1 list
```

- [ ] Database `furniture-platform-v2` exists
- [ ] Database ID matches wrangler.toml: `be4cf28f-45ad-4834-a5c3-453a7e8ff723`

## 5. Environment Variables

- [ ] `ADMIN_READ_TOKEN` set as Cloudflare Pages secret
- [ ] `ADMIN_WRITE_TOKEN` set as Cloudflare Pages secret
- [ ] `OPS_TOKEN` set as Cloudflare Pages secret (optional)

Set via:
```bash
wrangler pages secret put ADMIN_READ_TOKEN --project-name=furniture-platform-v2
wrangler pages secret put ADMIN_WRITE_TOKEN --project-name=furniture-platform-v2
wrangler pages secret put OPS_TOKEN --project-name=furniture-platform-v2
```

## 6. Secrets

- [ ] No secrets committed to git
- [ ] `.env` in `.gitignore`
- [ ] All secrets configured as Cloudflare Pages secrets

## 7. Migrations

```bash
wrangler d1 migrations apply furniture-platform-v2 --remote
```

- [ ] All 8 migrations applied (0001–0008)
- [ ] No migration errors

## 8. Build

```bash
npm install
npm run check
npm run smoke:all
npm run build
```

- [ ] `npm run check` passes (0 errors)
- [ ] `npm run smoke:all` passes (all assertions)
- [ ] `npm run build` succeeds

## 9. Deployment

```bash
npm run deploy
```

Or:
```bash
wrangler pages deploy .wrangler/dist/public --project-name=furniture-platform-v2
```

- [ ] Deployment succeeds
- [ ] No deployment errors

## 10. Post-deployment Verification

- [ ] Open deployed URL
- [ ] Admin panel loads at `/admin`
- [ ] Token prompt appears
- [ ] Packages view shows 3 packages (Level 1, A, B)
- [ ] Package C NOT in catalog
- [ ] Clients view loads
- [ ] Orders view loads
- [ ] Health endpoint responds

## 11. Rollback

See `docs/PRODUCTION_ROLLBACK.md`

## 12. Final Sign-off

- [ ] All checks passed
- [ ] Deployment verified
- [ ] Operator can complete Package A flow
- [ ] Operator can complete Package B flow
- [ ] Sign-off by: ____________
- [ ] Date: ____________

## Build Boundary Verification

```bash
# Verify MVP-only artifact
ls .wrangler/dist/functions/
# Should contain ONLY packages/mvp/functions

ls .wrangler/dist/src/
# Should contain ONLY packages/mvp/src

# Verify no orchestrator
find .wrangler/dist -name "*orchestrator*" -type f
# Should return empty
```

- [ ] `.wrangler/dist` contains no orchestrator code
- [ ] `.wrangler/dist` contains no packages/shared code
- [ ] Only `packages/mvp` files present

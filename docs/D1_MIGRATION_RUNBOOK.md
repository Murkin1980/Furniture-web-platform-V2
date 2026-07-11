# D1 Migration Runbook — Furniture Platform V2

Date: 2026-07-12

## Migration Order

| # | File | Tables Created | Additive | Reversible |
|---|------|---------------|----------|------------|
| 1 | 0001_packages.sql | clients, orders, service_package_catalog, order_package_engagements, package_conversion_events | Yes | No |
| 2 | 0002_package_payments.sql | package_payments | Yes | No |
| 3 | 0003_deliverables.sql | package_deliverables, deliverable_revisions | Yes | No |
| 4 | 0004_pdf_intake.sql | pdf_uploads, pdf_drafts, pdf_estimates | Yes | No |
| 5 | 0005_supplier_pricing.sql | suppliers, supplier_price_lists, supplier_price_items, supplier_estimate_links | Yes | No |
| 6 | 0006_ai_observability.sql | ai_runs, ai_actions, ai_feedback | Yes | No |
| 7 | 0007_whatsapp.sql | whatsapp_conversations, whatsapp_messages | Yes | No |
| 8 | 0008_package_c_and_share_links.sql | project_files, project_share_links, project_share_comments | Yes | No |

Total: 8 migrations, 22 tables, 53 indexes

## Production Binding Name

`DB` — configured in `wrangler.toml` as `[[d1_databases]]` binding

## Local Verification Command

```bash
wrangler d1 migrations apply furniture-platform-v2 --local
```

## Remote Application Command

```bash
wrangler d1 migrations apply furniture-platform-v2 --remote
```

## Verify Applied Migrations

```bash
wrangler d1 execute furniture-platform-v2 --remote --command "SELECT * FROM d1_migrations ORDER BY id"
```

## What Data Is Created By Each Migration

- 0001: 3 package catalog seed rows (level_1, package_a, package_b)
- 0002–0008: No seed data, schema only

## Whether Migrations Are Additive

Yes. All migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. No ALTER TABLE, no DROP TABLE, no destructive operations.

## Rollback Limitations

- No rollback scripts exist
- Tables are never dropped by migrations
- To "rollback": manually drop tables (WARNING: destroys all data)
- Prefer forward recovery over rollback

## Database Backup/Export Before Production Migration

```bash
# Export full database
wrangler d1 export furniture-platform-v2 --remote --output backup-$(date +%Y%m%d).sql

# Or export specific tables
wrangler d1 execute furniture-platform-v2 --remote --command "SELECT * FROM orders" --output orders-backup.json
```

## Failure Recovery Procedure

1. If migration fails midway: check which migrations applied with `d1_migrations` table
2. Re-run `wrangler d1 migrations apply` — it will skip already-applied migrations
3. If a specific migration has a defect: contact developer before re-running
4. Never manually modify the `d1_migrations` table
5. If data corruption suspected: restore from backup

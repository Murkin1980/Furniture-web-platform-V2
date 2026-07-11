# Production Configuration — Furniture Platform V2 MVP

Date: 2026-07-12

## Required Configuration

| Variable or binding | Required | Secret | Example format | Purpose | Failure if missing |
|---|---|---|---|---|---|
| `DB` (D1 binding) | yes | no | binding name `DB` | D1 database access | 500 on every request |
| `ADMIN_READ_TOKEN` | yes | yes | 32+ char hex string | Read-only admin API access | 401 on GET requests |
| `ADMIN_WRITE_TOKEN` | yes | yes | 32+ char hex string | Read+write admin API access | 401 on POST/PATCH requests |
| `OPS_TOKEN` | no | yes | 32+ char hex string | Full operations scope | Only needed for ops-scope actions |
| `ADMIN_TOKEN` | no (legacy) | yes | 32+ char hex string | Legacy all-scope token | Use scoped tokens instead |
| `ACCOUNT_ID` | yes | no | Cloudflare account ID | Pages deployment | Deployment fails |
| `PROJECT_NAME` | yes | no | `furniture-platform-v2` | Pages project identifier | Deployment fails |

## Optional and Disabled — Deferred

> **Deferred — do not configure for Phase 4.3**

| Variable | Required | Secret | Example format | Purpose | Failure if missing |
|---|---|---|---|---|---|
| `WHATSAPP_WEBHOOK_ENABLED` | no | no | `true` / `false` | Enable WhatsApp webhook | Webhook disabled (intentional) |
| `WHATSAPP_APP_SECRET` | no | yes | Meta app secret | WhatsApp HMAC verification | 503 if webhook enabled without secret |
| `WHATSAPP_SEND_ENABLED` | no | no | `true` / `false` | Enable outbound WhatsApp | Disabled (deferred) |
| `AI_AUTO_SEND_ENABLED` | no | no | `true` / `false` | Enable AI auto-send | Disabled (deferred) |
| `OPENAI_API_KEY` | no | yes | `sk-...` | OpenAI integration | Not used in MVP |
| `R2_BUCKET` | no | no | bucket name | File storage | Not used in MVP |

## Environment Names

- `local` — `wrangler pages dev` with local D1
- `preview` — Cloudflare Pages preview deployment
- `production` — Cloudflare Pages production deployment

## Binding Notes

- D1 binding name MUST be `DB` (matches wrangler.toml)
- No R2 binding required for Phase 4.3
- No AI binding required for Phase 4.3
- No queue binding required for Phase 4.3

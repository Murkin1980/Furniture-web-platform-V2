# OPENCODE INSTRUCTIONS — V2 Real Testing Plan

Project: `Murkin1980/Furniture-web-platform-V2`  
Target PR: `#2 — Harden V2 deployment, auth, and Package C boundaries`  
Main goal: prepare the platform for real-world testing of the paid furniture service packages without expanding scope.

---

## 0. Important rule

Do not merge or build from `simplify-v2-mvp` unless the user explicitly asks for a radical rollback.

The correct working direction is:

```txt
main <- harden-v2-boundaries
```

PR #2 is the intended hardening path. PR #1 is only a fallback comparison branch.

---

## 1. Current testing scope

Test only the commercial MVP flow:

```txt
lead / inquiry
→ Level 1 / Package A / Package B classification
→ paid package selection
→ payment tracking
→ proposal / estimate / visual deliverables
→ credit-on-order behavior
→ order continuation
```

Do not test or promote the following as sellable production features:

```txt
Package C
GLB viewer
SKP / OBJ / GLB handoff
360 tour
orchestrator as separate production runtime
automated WhatsApp replies
AI draft replies
automated OCR / AI / 3D execution
```

Package C may exist in the catalog, but it must remain:

```txt
readiness: draft
isSellable: false
viewer_link: plannedDeliverables only
```

---

## 2. First task: verify PR #2

Checkout PR #2 branch:

```bash
git fetch origin
git checkout harden-v2-boundaries
```

Install dependencies:

```bash
npm install
```

Run baseline checks:

```bash
npm run check
npm run smoke:packages
npm run smoke:advisor
npm run smoke:all
npm run build
```

Expected result:

```txt
All checks pass.
No Package C engagement can be created.
Package A and Package B still work.
Build succeeds.
```

If anything fails, fix only the minimum required issue. Do not add new architecture.

---

## 3. Auth verification

Run local grep checks:

```bash
grep -R "requireAdminToken" packages/mvp/functions packages/orchestrator/functions || true
grep -R "ADMIN_TOKEN" packages/mvp/functions packages/orchestrator/functions || true
grep -R "Bearer" packages/mvp/functions packages/orchestrator/functions || true
```

Expected:

```txt
No old inline requireAdminToken helper.
No direct env.ADMIN_TOKEN comparison inside route files.
Any Bearer/token handling must go through the shared scoped auth helper.
```

If inline auth is found:

1. List affected files.
2. Do not rewrite the whole auth system.
3. Replace only inline auth usage with the existing scoped auth helper pattern.
4. Add or update smoke coverage for unauthorized and authorized access.

---

## 4. Deployment boundary verification

Read:

```txt
docs/DEPLOYMENT_BOUNDARY.md
docs/AUTH_AUDIT.md
README.md
```

Confirm:

```txt
packages/mvp is the current production surface.
packages/orchestrator is present in the repo but is not an independent production runtime.
No orchestrator migration is applied to production unless explicitly listed in a release checklist.
No separate orchestrator Worker / Pages project / queue / scheduler is enabled.
```

If deployment config contradicts this, stop and report the contradiction before changing production config.

---

## 5. Package C guard test

Verify package catalog state in code:

```txt
Package C:
- readiness: draft
- isSellable: false
- deliverables does NOT include viewer_link
- plannedDeliverables includes viewer_link
```

Then test engagement creation behavior.

Expected:

```txt
Creating engagement for Package A succeeds.
Creating engagement for Package B succeeds.
Creating engagement for Package C fails with package_not_sellable.
```

If Package C can still be sold, fix immediately before real testing.

---

## 6. Manual test data

Create 10 internal test inquiries. Use realistic Russian/Kazakh-market wording.

### Test inquiry 1 — rough quote

```txt
Кухня примерно 3 метра, сколько будет стоить за погонный метр?
```

Expected:

```txt
Level 1
No paid package forced
No visual promise
```

### Test inquiry 2 — Package A

```txt
Нужна смета по кухне и коммерческое предложение по позициям.
```

Expected:

```txt
Package A
Price: 10 000 тг
Deliverables: КП + line-item estimate + BW preview
```

### Test inquiry 3 — Package B

```txt
Хочу увидеть как будет выглядеть кухня, нужен цветной визуал и размеры.
```

Expected:

```txt
Package B
Price: 20 000 тг
Deliverables: color visual + dimensions + proposal
```

### Test inquiry 4 — PDF intake

```txt
Есть PDF проект квартиры, надо вытащить мебель и подготовить КП.
```

Expected:

```txt
Package A or Package B depending on requested depth
PDF intake remains human-reviewed
No automatic production promise
```

### Test inquiry 5 — supplier pricing

```txt
Посчитайте шкаф с материалами подороже и подешевле.
```

Expected:

```txt
Supplier-aware pricing path works
Material tiers are reflected in estimate
```

### Test inquiry 6 — Package C intent

```txt
Мне нужны SKP, OBJ, GLB файлы и viewer link для дизайнера.
```

Expected:

```txt
Package C detected as draft / future handoff
No sellable engagement
Manager should offer Package B or mark future handoff
```

### Test inquiry 7 — WhatsApp expectation

```txt
Можно я отправлю фото и голосовое в WhatsApp, а бот сам всё посчитает?
```

Expected:

```txt
Do not promise auto-bot
Manual/gated workflow only
```

### Test inquiry 8 — Package B correction

```txt
Сделайте 2 варианта компоновки и один раунд правок.
```

Expected:

```txt
Package B
maxRevisions: 1
```

### Test inquiry 9 — budget uncertainty

```txt
Пока не знаю бюджет, хочу понять порядок цены.
```

Expected:

```txt
Level 1 first
Possible upsell to Package A
```

### Test inquiry 10 — production order

```txt
Если я оплачу визуал, потом эта сумма войдет в заказ?
```

Expected:

```txt
Credit-on-order behavior explained
Package A/B payment can be credited into order
```

---

## 7. Manual admin/API checklist

After smoke tests pass, manually verify:

```txt
/admin opens
/packages returns catalog
Package A is active and sellable
Package B is active and sellable
Package C is draft and not sellable
Engagement creation works for Package A
Engagement creation works for Package B
Engagement creation fails for Package C
Payment tracking works
Credit-on-order behavior works
Deliverable lifecycle works
PDF upload/draft/review flow works
Supplier pricing works
```

Do not proceed to real clients if any of these fail:

```txt
Package A cannot be created
Package B cannot be created
Package C can be sold
Payments are not tracked
Credit-on-order is broken
Build fails
```

---

## 8. Merge rule

Only merge PR #2 when all are true:

```txt
npm run check passes
npm run smoke:all passes
npm run build passes
Package C not sellable
Auth audit has no inline requireAdminToken issue
Deployment boundary is documented and consistent
```

After merge:

```bash
git checkout main
git pull origin main
```

Then deploy only according to the documented deployment boundary.

---

## 9. First real-world testing phase

Start real testing only after PR #2 is merged and smoke checks pass.

### Goal for week 1

```txt
10 real inquiries
3 serious package discussions
1 paid Package A or Package B
```

### Allowed real offer

Offer only:

```txt
Level 1 — free rough quote
Package A — 10 000 тг
Package B — 20 000 тг
```

Do not offer Package C as paid.

### Suggested wording for clients

```txt
Мы можем сначала дать быстрый ориентир бесплатно.
Если нужен нормальный расчёт по позициям и КП — есть Package A за 10 000 тг.
Если нужен цветной визуал, размеры и варианты компоновки — Package B за 20 000 тг.
Стоимость пакета потом зачтём в заказ мебели.
```

---

## 10. What to measure

For each real lead, record:

```txt
Lead source
Furniture type
Client asked for rough price / estimate / visual / 3D files
Recommended package
Accepted package or declined
Payment received
Time to prepare deliverable
Did package convert to order?
Reason for refusal
Manager notes
```

Use this simple table:

```txt
date | client | source | request | recommended_package | paid? | amount | delivered? | converted_to_order? | notes
```

---

## 11. Stop conditions

Stop real testing and fix before continuing if:

```txt
clients misunderstand Package A/B
manager cannot explain credit-on-order
Package C appears as sellable
PDF intake creates unreliable data without review
supplier pricing creates obviously wrong estimates
manual workflow takes too long
```

---

## 12. Do not build next features yet

Do not start these until after at least one paid Package A/B:

```txt
GLB viewer
Package C selling flow
360 viewer
auto WhatsApp replies
AI draft replies
orchestrator production runtime
advanced 3D pipeline
```

After the first paid package, review real feedback and only then decide the next slice.

---

## 13. Final success criteria

The platform is ready for the next development slice only when:

```txt
At least 10 real inquiries were processed
At least 1 Package A or Package B was paid
The manager could complete the workflow without developer help
Package C remained blocked
No production boundary confusion appeared
```

If these are not met, do not add features. Improve the sales flow, package wording, admin UX, or pricing explanation first.

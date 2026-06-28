# Phase 1.1 — Implementation Summary

## Цель

Спроектировать и реализовать product/package model и CRM states для V2:
сущности вовлечённости, каталог платных пакетов, зачёт стоимости пакета в заказ,
API для управления жизненным циклом engagement.

## Что сделано

### Миграция 0001_packages.sql
- `clients` — минимальная таблица клиентов
- `orders` — заказы с V2 CRM-полями: `engagement_level`, `service_package`
- `service_package_catalog` — каталог пакетов (seeded: level_1, package_a, package_b)
- `order_package_engagements` — жизненный цикл engagement со всеми V2-сущностями:
  `engagementLevel`, `status`, `creditedOnOrder`, `visualState`, `proposalDepth`,
  `revisionRound`, `maxRevisions`, `sourceMaterialType`, `upgradeOfferState`
- `package_conversion_events` — аналитика конверсии воронки

### Pure core модули (src/packages/)
- `package-catalog.js` — каталог пакетов, константы уровней/статусов/состояний,
  валидаторы, `buildEngagementDefaults()`, `normalizeCatalogRow()`
- `package-store.js` — D1 store: `listCatalog`, `createEngagement`,
  `transitionEngagement` (с машиной состояний), `incrementRevisionRound`,
  `listOrderEngagements`, `getEngagement`, запись conversion events
- `credit-on-order.js` — политика зачёта: `resolveCreditPolicy()`,
  `computeCreditAmount()`, `applyCreditToOrder()`, `describeCreditImpact()`

### API routes (functions/api/)
- `GET /api/packages` — список каталога пакетов
- `GET /api/orders/:id/engagements` — список engagements заказа
- `POST /api/orders/:id/engagements` — создание engagement
- `GET /api/orders/:id/engagements/:eid` — один engagement
- `PATCH /api/orders/:id/engagements/:eid` — переход статуса / revision round

### Scaffolding
- `package.json`, `wrangler.toml` (D1 binding, Pages project)
- `src/auth.js` — scoped auth (READ/WRITE/OPS), наследован из V1
- `public/index.html` — минимальная landing-страница с продуктовой линейкой
- `.dev.vars.example`, `.gitignore`
- D1 база `furniture-platform-v2` создана (id `be4cf28f-...`, region EEUR)

### Smoke
- `scripts/package-lifecycle-smoke.mjs` — 64 проверки: каталог, credit-on-order,
  машина состояний, D1 store (через `node:sqlite`), revision rounds, conversion events
- Результат: **64 passed, 0 failed**

## Архитектурные решения

- **Стек наследован от V1:** Cloudflare Pages Functions + D1 + R2, vanilla ESM, без build-шага
- **Pure core + injected sender:** все store-функции принимают `{ db, ... }` и возвращают `{ ok, status, body }`
- **Машина состояний engagement:** offered → accepted → paid → in_progress → delivered → credited
  (terminal); declined возможен из offered/accepted; повторный offer из declined
- **Credit-on-order:** зачитывается только для delivered/credited engagements с `creditedOnOrder: true`
- **Conversion events:** записываются автоматически при создании engagement и переходе статуса

## Проверки

| Проверка | Результат |
|---|---|
| `npm run check` (syntax) | ✅ все модули |
| `npm run smoke:packages` | ✅ 64/64 |
| D1 миграция local | ✅ 0001_packages.sql, 13 commands |

## Что не коммитить

Рабочие markdown-документы (handoff, coding brief, session notes) — исключены через `.gitignore`.
Этот implementation summary и progress-файлы коммитятся как часть документации проекта.

## Следующий шаг

Phase 1.2 — Коммерческая упаковка пакетов:
- шаблоны клиентских сообщений для upsell (rough quote → 10k → 20k → order)
- новые статусы в CRM для отслеживания пакетов
- менеджерский UI выбора платного пакета
- платёжная привязка пакета к заказу

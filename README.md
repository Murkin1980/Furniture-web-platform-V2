# Furniture web platform V2

Вторая версия платформы мебели — коммерческий конструктор глубины услуги:
от быстрого ответа «цена за метр» до оплачиваемого КП, визуала, проектной
детализации и подготовки к производству.

## Контекст

V1 (`furniture-orders-mvp`) — Cloudflare Pages Functions + D1 + R2, vanilla ESM,
без build-шага. Доведены до production: lead intake, калькуляторы, landing workflow,
native CRM, manual AI analysis, коммерческие предложения, безопасный контур для
OCR, SketchUp MCP и render artifact pipeline.

V2 строится не вокруг базовой автоматизации, а вокруг управляемой коммерциализации
проектной глубины. См. `v2-roadmap.md`.

## Продуктовая линейка V2

| Уровень | Цена | Состав |
|---|---|---|
| Level 1 | бесплатно | Ориентир по цене (погонный метр), без сметы и визуала |
| Package A | 10 000 тг | КП, смета по позициям, предварительный BW визуал |
| Package B | 20 000 тг | Цветной визуал в нескольких проекциях, КП, подробные размеры, 2–3 варианта компоновки, один раунд корректировок, лист «входит/не входит» |

Стоимость платного пакета зачитывается в стоимость заказа (credit-on-order).

## Фазы V2

1. **Коммерческая упаковка** — product/package entities, pricing с зачётом в заказ, шаблоны сообщений, CRM статусы, аналитика конверсии.
2. **Управляемый визуал** — стандарты BW preview и color multi-view deliverables.
3. **PDF intake** — полуавтоматическое проектирование из клиентских PDF с human review.
4. **Supplier-aware pricing** — versioned supplier catalog, controlled price-list workflow.
5. **Controlled 3D upgrade** — опциональное усиление Package B через локальный reviewed SketchUp/EasyKitchen adapter.

Чек-лист фаз: `STAGE_CHECKLIST.md`.

## Стек

- Cloudflare Pages Functions + D1 (SQLite) + R2
- Vanilla ESM, без build-шага
- Pure core + injected sender, все «опасные» фичи gated/manual по умолчанию
- Golos Text, AdminLTE-inspired admin shell (без runtime-зависимости Bootstrap/AdminLTE)

## Документы

- `v2-roadmap.md` — полный roadmap V2
- `STAGE_CHECKLIST.md` — чек-лист фаз
- `PROJECT_PROGRESS.md` / `PROJECT_PROGRESS.html` — текущий прогресс
- `AGENTS.md` (workspace) — ритуалы рабочего процесса

## Статус

Фаза 1 — Коммерческая упаковка: 1.1 Product/Package model завершён и задеплоен (20% фазы).
Production: https://furniture-platform-v2.pages.dev · API: `GET /api/packages` (200).
Миграция 0001 применена (local + remote D1), package lifecycle smoke 64/64.
Следующий шаг: 1.2 — менеджерский UI и шаблоны сообщений.
Подробности: `PROJECT_PROGRESS.md`.

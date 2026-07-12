# Furniture web platform V2

Вторая версия платформы мебели — коммерческий конструктор глубины услуги: от быстрого ответа «цена за метр» до оплачиваемого КП, визуала, проектной детализации и подготовки к производству.

## Контекст

V1 (`furniture-orders-mvp`) — Cloudflare Pages Functions + D1 + R2, vanilla ESM, без build-шага. Доведены до production: lead intake, калькуляторы, landing workflow, native CRM, manual AI analysis, коммерческие предложения, безопасный контур для OCR, SketchUp MCP и render artifact pipeline.

V2 строится не вокруг базовой автоматизации, а вокруг управляемой коммерциализации проектной глубины. См. `v2-roadmap.md`.

## Product line

| Уровень | Цена | Состав | Готовность |
|---|---:|---|---|
| Level 1 | бесплатно | Ориентир по цене, без сметы и визуала | active |
| Package A | 10 000 тг | КП, смета по позициям, предварительный BW визуал | active |
| Package B | 20 000 тг | Цветной визуал, КП, подробные размеры, 2–3 варианта компоновки, один раунд корректировок | active |
| Package C | configurable | Designer / 3D Handoff | draft, not sellable |

Стоимость платного пакета зачитывается в стоимость заказа (credit-on-order).

Package C остаётся в каталоге как draft. `viewer_link` относится к planned deliverables до завершения GLB viewer и отдельного production boundary decision.

## Фазы V2

1. **Коммерческая упаковка** — product/package entities, pricing с зачётом в заказ, шаблоны сообщений, CRM статусы, аналитика конверсии.
2. **Управляемый визуал** — стандарты BW preview и color multi-view deliverables.
3. **PDF intake** — полуавтоматическое проектирование из клиентских PDF с human review.
4. **Supplier-aware pricing** — versioned supplier catalog, controlled price-list workflow.
5. **Controlled 3D upgrade** — опциональное усиление Package B через локальный reviewed SketchUp/EasyKitchen adapter.

Чек-лист фаз: `STAGE_CHECKLIST.md`.

## Simplicity First

Текущий production путь ограничен одной Cloudflare Pages аппликацией, `packages/mvp` и одной D1 базой. Orchestrator, Package C, WhatsApp inbound, public project sharing и автоматический OCR/AI/3D остаются отложенными до отдельного решения.

Основная проверка:

```bash
npm run check
npm run smoke:all
npm run build
```

`smoke:all` проверяет только коммерческое ядро. Экспериментальные и отложенные контуры запускаются отдельно:

```bash
npm run smoke:deferred
```

Полное обоснование: `SIMPLICITY_REVIEW.md`.

## Deployment and auth boundary

Перед production деплоем V2 использовать:

- `docs/DEPLOYMENT_BOUNDARY.md` — граница Pages / D1 / orchestrator runtime.
- `docs/AUTH_AUDIT.md` — audit старого inline auth паттерна и правила scoped auth.

## Стек

- Cloudflare Pages Functions + D1 (SQLite) + R2
- Vanilla ESM
- Pure core + injected sender, все «опасные» фичи gated/manual по умолчанию
- Golos Text, AdminLTE-inspired admin shell (без runtime-зависимости Bootstrap/AdminLTE)

## Документы

- `SIMPLICITY_REVIEW.md` — правила Simplicity First и текущий stop-doing list
- `v2-roadmap.md` — полный roadmap V2
- `STAGE_CHECKLIST.md` — чек-лист фаз
- `PROJECT_PROGRESS.md` / `PROJECT_PROGRESS.html` — текущий прогресс
- `docs/DEPLOYMENT_BOUNDARY.md` — production boundary
- `docs/AUTH_AUDIT.md` — auth audit
- `AGENTS.md` (workspace) — ритуалы рабочего процесса

## Статус

Фаза 4 — Supplier-aware pricing: завершена и задеплоена. Следующий шаг — доказать end-to-end платный путь Package A/B до включения новых runtime и автоматизаций.

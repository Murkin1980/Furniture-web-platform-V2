# V2 Stage Checklist

Чек-лист фаз второй версии платформы мебели.
Порядок реализации соответствует приоритетам из `v2-roadmap.md`.

## Фаза 1 — Коммерческая упаковка (денежная, короткая)

Цель: платные проектные пакеты 10 000 тг и 20 000 тг становятся штатной частью sales flow.

**Статус: завершена ✅**

### 1.1 Product/Package model и CRM states
- [x] Спроектировать сущности `engagementLevel`, `servicePackage`, `creditedOnOrder`, `proposalDepth`, `revisionRound`, `sourceMaterialType`, `upgradeOfferState`, `visualState`
- [x] Миграция БД: таблицы пакетов, продуктовых уровней, зачёта в заказ
- [x] Backend: package catalog (Package A 10 000 тг, Package B 20 000 тг, Level 1 free rough quote)
- [x] Backend: credit-on-order policy (стоимость пакета зачитывается в заказ)

### 1.2 Коммерческая упаковка пакетов
- [x] Шаблоны клиентских сообщений для upsell (rough quote → 10k → 20k → order)
- [x] Новые статусы в CRM для отслеживания пакетов
- [x] Менеджерский UI выбора платного пакета вместо «сделать КП»
- [x] Платёжная привязка пакета к заказу (учёт оплаты пакета)

### 1.3 Аналитика конверсии пакетов
- [x] Метрики: rough quote → 10k, 10k → 20k, paid packages → order
- [x] Метрики: среднее время подготовки пакета, правок на пакет, доля зачтённых в заказ
- [x] Дашборд конверсии воронки вовлечения

### 1.4 Smoke и проверки фазы 1
- [x] Миграции применены (local + remote D1)
- [x] Package lifecycle smoke (create → pay → credit-on-order → order) — 104/104 passed
- [x] Production API smoke (packages, templates, analytics — 200)
- [x] Analytics pipeline smoke
- [x] README и PROJECT_PROGRESS обновлены

## Фаза 2 — Управляемый визуал

Цель: предсказуемые форматы результата — preview sheet, colored view set, dimensions sheet, revision round, package state.

**Статус: завершена ✅**

- [x] Стандарт BW preview (Package A): формат, ракурс, артефакт
- [x] Стандарт color multi-view (Package B): 2–3 варианта компоновки, ракурсы, лист «входит/не входит»
- [x] Dimensions sheet контракт
- [x] Revision round workflow (один раунд корректировок для Package B)
- [x] Финальный package state в CRM и order context
- [x] Smoke: полный deliverable lifecycle для каждого пакета

## Фаза 3 — PDF intake и полуавтоматическое проектирование

Цель: менеджер использует PDF intake как ускоритель подготовки proposal, размеров и визуала с human review.

**Статус: завершена ✅**

- [x] PDF upload workflow (manager-facing)
- [x] Draft proposal из PDF manifest + room/furniture-zone extraction
- [x] Размеры мебели из PDF в proposal
- [x] Human review gate перед коммерческим использованием
- [x] Smoke: PDF → draft proposal → review → publish

## Фаза 4 — Supplier-aware pricing

Цель: смета по позициям строится из актуализированных поставщиков, материалов и ценовых слоёв.

**Статус: завершена ✅**

- [x] Versioned supplier catalog (schema + миграции)
- [x] Controlled price-list workflow (импорт, версии, аудит)
- [x] Supplier-aware estimate builder
- [x] Supplier pricing влияет на Package A и B смету
- [x] Smoke: supplier version → estimate → proposal (318/318)

## Фаза 5 — Controlled 3D upgrade

Цель: Package B за 20 000 тг опционально усиливается более убедительным визуалом без разрушения fail-closed архитектуры.

- [ ] Geometry/render adapter во внешнем Windows/SketchUp контуре
- [ ] Integration с существующим sketchup-node-service (fail-closed, HMAC, dry-run по умолчанию)
- [ ] Optional 3D upgrade flag на Package B
- [ ] Render artifacts → package deliverable pipeline
- [ ] Smoke: package B → 3D upgrade request → artifact → package state

## Фаза 4.5 — Conversational Sales + AI Observability

Цель: WhatsApp/AI как безопасный слой продаж без автоответов.

- [ ] WhatsApp inbox (входящие, привязка к conversation)
- [ ] Conversation-to-order matching
- [ ] AI package advisor (deterministic + AI-ready)
- [ ] AI draft replies (без автоотправки)
- [ ] AI audit logs (ai_runs, ai_actions, ai_feedback)
- [ ] Manager feedback loop
- [ ] Package conversion analytics через WhatsApp
- [ ] Smoke: webhook → normalize → conversation → advisor → draft → manager approve

## Фаза 4.6 — Package C + Project Share Viewer

Цель: Designer/3D Handoff пакет + публичный viewer для клиента.

### 4.6a Package C model
- [ ] package_c_designer в catalog (price configurable, targetUserType)
- [ ] includedDeliverables: 3D formats (SKP/OBJ/GLB), dimensions, material_spec, viewer_link
- [ ] Новые поля: designerHandoffRequired, required3dFormats, fileAccessPolicy
- [ ] Smoke: package_c → engagement → deliverables seeded

### 4.6b Project files registry
- [ ] Таблица project_files (file_type, storage_key, mime_type, sha256, download_allowed)
- [ ] Валидация MIME (опасные типы отклоняются)
- [ ] Download control (без разрешения — denied)
- [ ] Smoke: register file → download denied → grant → download ok

### 4.6c Share links
- [ ] Таблица project_share_links (token_hash, expires_at, access_level)
- [ ] Endpoint-ы: POST create, GET view, POST comment, POST approve
- [ ] Package-based permissions (B: no 3D download, C: full download)
- [ ] Expiration + revoke
- [ ] Smoke: create link → view → comment → approve → expire → revoke

### 4.6d GLB viewer
- [ ] Загрузка .glb в браузере
- [ ] Rotate/zoom интерфейс
- [ ] Список файлов + download button (если разрешено)
- [ ] Smoke: upload GLB → viewer renders → download check

## Фаза 5.1 — Designer handoff files SKP/OBJ/GLB

- [ ] Генерация/регистрация SKP/OBJ/GLB файлов для Package C
- [ ] File roles и access control
- [ ] Smoke: Package C → file generation → download → access check

## Фаза 5.2 — GLB web viewer

- [ ] Продвинутый GLB viewer (материалы, освещение)
- [ ] File switching в viewer
- [ ] Smoke: multi-file viewer → material render

## Фаза 5.3 — Optional Kuula-like 360 tour

- [ ] 360° panorama viewer
- [ ] Hotspots на мебель
- [ ] Smoke: panorama → hotspot → file link

## Общие ритуалы (каждая фаза)

- [ ] Handoff-файл `<project>-stageN-wip-handoff.md` при риске обрыва
- [ ] Implementation summary `<project>-stageN-implementation-summary.md` после кодового прохода
- [ ] `PROJECT_PROGRESS.md` и `PROJECT_PROGRESS.html` актуальны
- [ ] `README.md` обновлён под фактическое состояние
- [ ] Smoke-скрипты прошли
- [ ] Рабочие markdown-документы отделены от кодовых коммитов

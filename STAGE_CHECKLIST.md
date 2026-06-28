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

- [ ] Versioned supplier catalog (schema + миграции)
- [ ] Controlled price-list workflow (импорт, версии, аудит)
- [ ] Supplier-aware estimate builder
- [ ] Supplier pricing влияет на Package A и B смету
- [ ] Smoke: supplier version → estimate → proposal

## Фаза 5 — Controlled 3D upgrade

Цель: Package B за 20 000 тг опционально усиливается более убедительным визуалом без разрушения fail-closed архитектуры.

- [ ] Geometry/render adapter во внешнем Windows/SketchUp контуре
- [ ] Integration с существующим sketchup-node-service (fail-closed, HMAC, dry-run по умолчанию)
- [ ] Optional 3D upgrade flag на Package B
- [ ] Render artifacts → package deliverable pipeline
- [ ] Smoke: package B → 3D upgrade request → artifact → package state

## Общие ритуалы (каждая фаза)

- [ ] Handoff-файл `<project>-stageN-wip-handoff.md` при риске обрыва
- [ ] Implementation summary `<project>-stageN-implementation-summary.md` после кодового прохода
- [ ] `PROJECT_PROGRESS.md` и `PROJECT_PROGRESS.html` актуальны
- [ ] `README.md` обновлён под фактическое состояние
- [ ] Smoke-скрипты прошли
- [ ] Рабочие markdown-документы отделены от кодовых коммитов

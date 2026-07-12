# V2 Stage Checklist

Чек-лист второй версии Furniture Web Platform после применения Simplicity First.

## Production boundary

- [x] Один Cloudflare Pages production project
- [x] `packages/mvp` — единственный production runtime
- [x] Одна production D1 база
- [x] Package C помечен как draft и non-sellable
- [x] Engagement для non-sellable package блокируется
- [x] Core и deferred smoke разделены
- [ ] Локально выполнить `npm run check`
- [ ] Локально выполнить `npm run smoke:all`
- [ ] Локально выполнить `npm run build`
- [ ] Обновить ветку относительно `main` и устранить merge conflict PR #2
- [ ] Merge PR #2 после успешной проверки

## Phase 1 — Коммерческая упаковка ✅

- [x] Level 1, Package A, Package B
- [x] Package catalog и engagement lifecycle
- [x] Payment binding
- [x] Credit-on-order
- [x] CRM states
- [x] Upsell templates
- [x] Package conversion analytics

## Phase 2 — Управляемые deliverables ✅

- [x] BW preview для Package A
- [x] Color multi-view для Package B
- [x] Dimensions sheet
- [x] Revision workflow
- [x] Deliverable lifecycle
- [x] Manager-facing package state

## Phase 3 — PDF intake ✅

- [x] Manager-facing PDF upload
- [x] PDF manifest и extraction contracts
- [x] Furniture zones и размеры
- [x] Proposal draft
- [x] Human review gate

## Phase 4 — Supplier-aware pricing ✅

- [x] Versioned supplier catalog
- [x] Controlled price-list workflow
- [x] Supplier price items
- [x] Supplier-aware estimate builder
- [x] Связь estimate с Package A/B

# Текущая активная стадия

## Phase 4.1 — End-to-end commercial proof Package A/B 🚧

### 4.1.1 Intake и рекомендация

- [ ] Создать тестовую входящую заявку Level 1
- [ ] Проверить deterministic package advisor
- [ ] Проверить ручное подтверждение рекомендации менеджером
- [ ] Убедиться, что AI не требуется для выбора пакета

### 4.1.2 Engagement и оплата

- [ ] Создать Package A engagement
- [ ] Зарегистрировать оплату Package A
- [ ] Создать Package B engagement
- [ ] Зарегистрировать оплату Package B
- [x] Заблокировать engagement для Package C/draft package

### 4.1.3 Подготовка результата

- [ ] Создать deliverables для Package A
- [ ] Создать deliverables для Package B
- [ ] Проверить revision workflow Package B
- [ ] Построить supplier-aware estimate
- [ ] Пройти manager approval
- [ ] Подготовить безопасную клиентскую выдачу

### 4.1.4 Конвертация в мебельный заказ

- [ ] Перевести Package A engagement в order
- [ ] Применить credit-on-order Package A
- [ ] Перевести Package B engagement в order
- [ ] Применить credit-on-order Package B
- [ ] Проверить итоговую сумму заказа

### 4.1.5 Сквозная проверка

- [ ] Добавить единый smoke/integration test Package A
- [ ] Добавить единый smoke/integration test Package B
- [ ] Проверить, что core flow работает без WhatsApp
- [ ] Проверить, что core flow работает без orchestrator
- [ ] Проверить, что core flow работает без AI provider
- [ ] Проверить, что клиент не получает internal/unapproved files

### Acceptance Phase 4.1

- [ ] Package A проходит end to end
- [ ] Package B проходит end to end
- [ ] Оплата корректно засчитывается в заказ
- [ ] Менеджер видит текущий статус и следующий шаг
- [ ] `npm run smoke:all` покрывает production commercial path
- [ ] Production build не зависит от deferred modules

## Phase 4.2 — Operational proof and measurement ⏳

Активируется после Phase 4.1.

- [ ] Провести не менее 5 полных тестовых или реальных кейсов
- [ ] Измерить conversion Level 1 → Package A
- [ ] Измерить conversion Package A → Package B
- [ ] Измерить conversion paid package → order
- [ ] Измерить среднее время подготовки
- [ ] Измерить количество ручных действий
- [ ] Измерить число правок
- [ ] Оценить маржинальность пакетов
- [ ] Выявить три самых дорогих ручных шага
- [ ] Выбрать одну следующую автоматизацию на основании данных

## Phase 5 — Controlled 3D upgrade Package B ⏳

Активируется только после Phase 4.2 и подтверждённого спроса.

- [ ] Optional 3D upgrade flag
- [ ] Reviewed SketchUp/EasyKitchen adapter
- [ ] Fail-closed integration
- [ ] Artifact registration
- [ ] Manager approval
- [ ] Graceful fallback на обычный Package B
- [ ] Smoke: Package B → optional 3D → approved artifact

## Deferred experiments — не production roadmap

### WhatsApp inbound

**Технический статус:** часть foundation реализована.
**Production status:** deferred / disabled.

- [x] Normalize message foundation
- [x] Conversation store foundation
- [x] Webhook endpoint foundation
- [ ] Activation gate approved
- [ ] Production webhook security verified
- [ ] Owner входящих сообщений назначен
- [ ] Failure не блокирует core sales flow

### AI observability и drafts

**Технический статус:** observability и advisor foundation существуют.
**Production status:** advisor deterministic; AI drafts deferred.

- [x] AI audit storage foundation
- [x] Deterministic package advisor
- [ ] AI draft replies
- [ ] Manager approval workflow
- [ ] Quality evaluation на реальных диалогах
- [ ] Activation gate approved

### Package C

**Технический статус:** model foundation существует.
**Production status:** draft, not sellable.

- [x] Catalog model
- [x] Readiness draft
- [x] `isSellable: false`
- [x] Engagement guard
- [ ] Минимум 3 подтверждённых клиентских запроса
- [ ] Утверждённая цена и состав
- [ ] Safe file access
- [ ] Рабочий viewer
- [ ] Отдельное решение об активации

### Project Share / GLB Viewer

**Технический статус:** часть registry/share foundation существует.
**Production status:** deferred.

- [x] Project files registry foundation
- [x] Share link foundation
- [ ] Production access policy
- [ ] Expiry/revoke production verification
- [ ] GLB browser viewer
- [ ] Public access smoke
- [ ] Activation gate approved

### Independent orchestrator

**Production status:** not deployed, not required.

- [ ] Измеримая необходимость queue/scheduler/long-running worker
- [ ] Отдельный deployment decision
- [ ] Auth and migration boundary
- [ ] Rollback plan
- [ ] Independent smoke

## Общие правила

- [ ] `PROJECT_PROGRESS.md` соответствует фактической стадии
- [ ] `README.md` соответствует production boundary
- [ ] `v2-roadmap.md` соответствует Simplicity First
- [ ] Smoke-скрипты пройдены перед merge/deploy
- [ ] Deferred code не считается production только из-за наличия в репозитории
- [ ] Новая инфраструктура добавляется только после измеримого ограничения текущего runtime

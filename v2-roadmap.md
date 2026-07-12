# Roadmap Furniture Web Platform V2

## 1. Цель проекта

Furniture Web Platform V2 должна превращать входящую мебельную заявку в управляемый коммерческий процесс:

1. клиент получает быстрый ориентир;
2. менеджер предлагает подходящий платный пакет;
3. пакет оплачивается;
4. команда готовит согласованный набор материалов;
5. рассчитывается реальная стоимость с учётом поставщиков;
6. результат передаётся клиенту;
7. при заказе мебели стоимость пакета засчитывается в заказ.

Главная цель V2 — не максимальная автоматизация, а повторяемая продажа проектной проработки через Level 1, Package A и Package B.

## 2. Текущая продуктовая линейка

| Уровень | Цена | Результат | Статус |
|---|---:|---|---|
| Level 1 | бесплатно | Быстрый ориентир по погонному метру без сметы и визуала | active |
| Package A | 10 000 тг | КП, смета по позициям, предварительный BW-визуал | active |
| Package B | 20 000 тг | Цветной визуал, подробные размеры, 2–3 компоновки, один раунд корректировок | active |
| Package C | configurable | Designer / 3D handoff | draft, not sellable |

Стоимость Package A и Package B засчитывается в стоимость мебельного заказа.

Package C не входит в текущую продаваемую линейку. Его модель хранится как экспериментальная заготовка. Создание engagement для Package C заблокировано, а 3D-файлы и viewer относятся к planned deliverables.

## 3. Production boundary

Текущий production-контур ограничен:

- одним GitHub-репозиторием;
- одним Cloudflare Pages-проектом;
- `packages/mvp` как единственным production runtime;
- одной production D1-базой;
- R2 только для проверенных файлов и артефактов;
- ручным подтверждением опасных и AI-assisted операций.

`packages/orchestrator`, WhatsApp inbound, AI drafts, public share viewer, GLB viewer и автоматический OCR/AI/3D не входят в production path без отдельного решения.

## 4. Завершённые фазы

### Phase 1 — Коммерческая упаковка ✅

Реализовано:

- package catalog;
- Level 1, Package A, Package B;
- engagement lifecycle;
- payment binding;
- credit-on-order;
- шаблоны upsell-сообщений;
- CRM-состояния;
- аналитика конверсии пакетов.

### Phase 2 — Управляемые deliverables ✅

Реализовано:

- стандарт BW preview для Package A;
- стандарт color multi-view для Package B;
- dimensions sheet;
- revision workflow;
- package state в CRM;
- lifecycle выдаваемых материалов.

### Phase 3 — PDF intake с human review ✅

Реализовано:

- manager-facing PDF upload;
- manifest и extraction contracts;
- room/furniture zone draft;
- размеры и proposal lines;
- обязательный human review перед коммерческим использованием.

### Phase 4 — Supplier-aware pricing ✅

Реализовано:

- versioned supplier catalog;
- controlled price-list workflow;
- supplier price items;
- supplier-aware estimate builder;
- связь расчёта с Package A и Package B.

## 5. Текущая стадия

# Phase 4.1 — End-to-end commercial proof для Package A/B

**Статус: текущая активная стадия.**

Технические блоки уже созданы, но проект ещё не считается завершённым коммерческим продуктом, пока полный путь не подтверждён как единый рабочий процесс.

Нужно доказать сценарий:

1. создать входящую заявку;
2. получить рекомендацию Level 1 / Package A / Package B;
3. вручную подтвердить пакет менеджером;
4. создать engagement;
5. зарегистрировать оплату;
6. подготовить deliverables;
7. построить supplier-aware estimate;
8. пройти manager approval;
9. сформировать клиентскую выдачу;
10. перевести клиента в мебельный заказ;
11. применить credit-on-order;
12. зафиксировать конверсию и время прохождения.

### Acceptance criteria Phase 4.1

- один сквозной smoke или integration test проходит весь путь;
- Package A и Package B проверены отдельно;
- нельзя создать engagement для draft/non-sellable пакета;
- отсутствие AI, WhatsApp или orchestrator не блокирует продажу;
- менеджер видит текущее состояние engagement и следующий ручной шаг;
- итоговая сумма заказа корректно учитывает оплату пакета;
- клиентская выдача не содержит внутренних или неподтверждённых файлов;
- production build зависит только от core runtime.

### Результат Phase 4.1

Платформа может реально использоваться для продажи Package A/B без дополнительной инфраструктуры и без незавершённых автоматизаций.

## 6. Следующая стадия

### Phase 4.2 — Operational proof and measurement

После успешного end-to-end сценария нужно измерить работу на реальных или тестовых заказах.

Метрики:

- конверсия Level 1 → Package A;
- конверсия Package A → Package B;
- конверсия платного пакета → мебельный заказ;
- среднее время подготовки Package A и B;
- количество ручных действий;
- количество правок;
- средняя маржинальность пакета;
- доля оплат, зачтённых в заказ;
- причины отказов.

### Acceptance criteria Phase 4.2

- проведено не менее 5 полных тестовых или реальных кейсов;
- выявлены три самых затратных ручных шага;
- подтверждено, что Package A/B имеют понятную ценность для клиента;
- принято решение, какой следующий шаг автоматизировать первым.

## 7. Phase 5 — Controlled 3D upgrade для Package B

Активируется только после Phase 4.1 и Phase 4.2.

Цель: усилить Package B более убедительным визуалом без превращения 3D в обязательную зависимость sales flow.

Состав:

- optional 3D upgrade flag;
- ручной reviewed SketchUp/EasyKitchen adapter;
- fail-closed integration;
- artifact registration;
- manager approval;
- graceful fallback на обычный Package B.

Не входит:

- полностью автономный генератор;
- обязательный Windows worker;
- публичная выдача исходных 3D;
- отдельный production orchestrator.

## 8. Deferred candidates

Следующие направления не являются очередными обязательными фазами. Они рассматриваются только после подтверждения коммерческого ядра.

### WhatsApp inbound

Может быть активирован, если ручной перенос заявок становится измеримой проблемой.

Activation gate:

- есть стабильный ручной sales flow;
- определён владелец входящих сообщений;
- настроена защита webhook;
- автоотправка выключена;
- сбой WhatsApp не блокирует основной продукт.

### AI draft replies

Может быть активирован только как помощник менеджера.

Activation gate:

- только draft;
- обязательное manager approval;
- audit log;
- отсутствие AI не блокирует работу;
- есть набор реальных диалогов для оценки качества.

### Package C

Остаётся draft до появления подтверждённого спроса на designer handoff.

Activation gate:

- минимум 3 подтверждённых запроса;
- утверждён состав и цена;
- определены форматы файлов;
- реализован безопасный file access;
- viewer_link реально работает;
- engagement guard изменяется отдельным решением.

### Project Share Viewer / GLB Viewer

Активируется только при доказанной необходимости выдачи файлов и согласования через браузер.

Activation gate:

- понятная роль viewer в Package B или C;
- access control;
- expiry и revoke;
- download policy;
- smoke для публичного доступа.

### Independent Orchestrator

Отдельный runtime допускается только если существующий Pages runtime объективно не справляется.

Activation gate:

- есть измеримая задача, требующая очереди, scheduler или long-running worker;
- Pages/D1 путь недостаточен;
- описан deployment boundary;
- отдельные миграции и auth policy;
- отдельный smoke и rollback plan.

## 9. Приоритеты реализации

1. Merge и проверить hardening/Simplicity First изменения.
2. Завершить Phase 4.1 — сквозной Package A/B commercial flow.
3. Провести Phase 4.2 — реальные кейсы и измерение.
4. Исправить самые дорогие ручные шаги без новой инфраструктуры.
5. Реализовать controlled 3D upgrade для Package B, если подтверждён спрос.
6. Рассматривать WhatsApp, AI drafts, Package C и viewer только через activation gates.
7. Рассматривать отдельный orchestrator последним.

## 10. Что не делать сейчас

- не продавать Package C;
- не делать отдельный orchestrator production runtime;
- не включать автоматическую отправку WhatsApp;
- не делать автономного AI-продавца;
- не делать customer-facing OCR без review;
- не делать автоматический SketchUp executor без fail-closed boundary;
- не добавлять очереди и scheduler для гипотетической нагрузки;
- не включать deferred-модули обратно в `smoke:all`;
- не считать наличие кода признаком production readiness.

## 11. Основные команды проверки

Production core:

```bash
npm run check
npm run smoke:all
npm run build
```

Отложенные экспериментальные модули:

```bash
npm run smoke:deferred
```

`smoke:deferred` не является production release gate.

## 12. Определение завершённости V2 Core

V2 Core считается завершённым, когда:

- Level 1, Package A и Package B работают end to end;
- оплата и credit-on-order подтверждены;
- deliverables проходят manager approval;
- supplier-aware estimate входит в клиентскую выдачу;
- система работает без orchestrator, WhatsApp и AI;
- smoke покрывает основной коммерческий путь;
- проведены реальные или тестовые коммерческие кейсы;
- метрики показывают, где автоматизация действительно нужна.

После этого проект переходит от построения платформы к улучшению доказанного коммерческого процесса.

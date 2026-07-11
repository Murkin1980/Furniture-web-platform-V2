# V2 Project Progress

Платформа мебели, вторая версия.
Репозиторий: `Furniture-web-platform-V2`.
Roadmap: `v2-roadmap.md`. Чек-лист: `STAGE_CHECKLIST.md`.

## Текущий статус

| Параметр | Значение |
|---|---|
| Текущая стадия | Phase 4.1 — End-to-end commercial proof Package A/B |
| Статус | В работе 🚧 |
| Core-фазы | Phase 1–4 завершены |
| Production runtime | `packages/mvp` |
| Deploy | https://furniture-platform-v2.pages.dev |
| Активные продукты | Level 1, Package A, Package B |
| Package C | draft, not sellable |
| Следующий результат | Сквозной подтверждённый путь Package A/B до заказа и credit-on-order |
| Активный PR | PR #2 — hardening + Simplicity First |

## Где мы сейчас

Техническое ядро уже собрано:

- коммерческие пакеты;
- engagement lifecycle;
- оплата и credit-on-order;
- стандартизированные deliverables;
- PDF intake;
- supplier-aware pricing;
- deterministic package advisor;
- production Cloudflare Pages + D1.

Но проект ещё не завершён как доказанный коммерческий продукт. Сейчас необходимо соединить готовые модули в один проверенный сценарий:

`заявка → рекомендация → выбор Package A/B → engagement → оплата → deliverables → supplier estimate → manager approval → клиентская выдача → мебельный заказ → credit-on-order`.

Именно это является текущей стадией, а не разработка Package C, WhatsApp или отдельного orchestrator.

## Оценка готовности

| Контур | Готовность | Комментарий |
|---|---:|---|
| Техническое core-ядро | 85% | Основные модули реализованы |
| Production hardening | 75% | Изменения подготовлены в PR #2, нужны локальные проверки и merge |
| Сквозной коммерческий flow | 55% | Отдельные части есть, единый Package A/B proof ещё не подтверждён |
| Operational proof | 0% | Нет серии из 5 полных реальных/тестовых кейсов |
| Controlled 3D | 0% production | Не является текущим приоритетом |
| WhatsApp/AI experiments | Foundation only | Deferred, не production path |
| Package C / Share Viewer | Foundation only | Draft/deferred, не продаётся |

Ориентировочная готовность **V2 Core как коммерчески доказанного продукта — около 70%**.

Ранее указывавшиеся 90% отражали количество написанных модулей, но не подтверждённость полного бизнес-процесса. После применения Simplicity First прогресс оценивается по работающему коммерческому пути, а не по объёму экспериментального кода.

## Завершённые фазы

### Phase 1 — Коммерческая упаковка ✅

- Level 1, Package A, Package B;
- package catalog;
- engagement lifecycle;
- payment binding;
- credit-on-order;
- CRM states;
- package analytics.

### Phase 2 — Управляемые deliverables ✅

- BW preview;
- color multi-view;
- dimensions sheet;
- revision workflow;
- deliverable lifecycle;
- manager-facing package state.

### Phase 3 — PDF intake ✅

- PDF upload;
- manifest/extraction;
- zones and dimensions;
- proposal draft;
- human review gate.

### Phase 4 — Supplier-aware pricing ✅

- supplier catalog;
- versioned price lists;
- supplier price items;
- supplier-aware estimate;
- связь estimate с Package A/B.

## Текущая Phase 4.1 — End-to-end commercial proof

### Что уже есть

- [x] Level 1 / Package A / Package B catalog
- [x] Engagement model
- [x] Payment model
- [x] Credit-on-order policy
- [x] Deliverable model
- [x] PDF intake
- [x] Supplier-aware estimate
- [x] Deterministic package advisor
- [x] Package C non-sellable guard
- [x] Core/deferred smoke separation подготовлено в PR #2

### Что осталось доказать

- [ ] Полный Package A flow
- [ ] Полный Package B flow
- [ ] Единый integration/smoke test для каждого пакета
- [ ] Manager approval перед клиентской выдачей
- [ ] Безопасная client handoff
- [ ] Конвертация engagement в furniture order
- [ ] Корректный credit-on-order в итоговой сумме
- [ ] Работа core flow без WhatsApp, AI provider и orchestrator
- [ ] Локальные `check`, `smoke:all`, `build`
- [ ] Устранение merge conflict и merge PR #2

## Следующая стадия — Phase 4.2

После завершения Phase 4.1:

- провести минимум 5 полных кейсов;
- измерить время подготовки;
- измерить конверсии;
- измерить число ручных действий и правок;
- оценить прибыльность Package A/B;
- выбрать следующую автоматизацию по фактическим данным.

## Deferred направления

Следующие модули могут существовать в коде, но не считаются текущим production roadmap:

- WhatsApp inbound;
- AI draft replies;
- AI feedback loop;
- Package C;
- Project Share Viewer;
- GLB Viewer;
- отдельный orchestrator runtime;
- автоматический OCR/AI/3D executor.

Они активируются только после отдельного решения и выполнения activation gates из `v2-roadmap.md`.

## Ближайшие действия

1. Локально выполнить:

```bash
npm run check
npm run smoke:all
npm run build
```

2. Обновить `harden-v2-boundaries` относительно `main`.
3. Устранить merge conflict PR #2.
4. Проверить и merge PR #2.
5. Реализовать единый Package A end-to-end smoke.
6. Реализовать единый Package B end-to-end smoke.
7. Провести первый полный тестовый коммерческий кейс.

## Production release gate

Перед следующим production deploy обязательны:

- `npm run check`;
- `npm run smoke:all`;
- `npm run build`;
- deployment boundary review;
- auth audit;
- отсутствие зависимости core flow от deferred modules;
- подтверждённый Package A/B end-to-end path.

`npm run smoke:deferred` является дополнительной проверкой экспериментов и не блокирует production release core-продукта.

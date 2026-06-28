# Roadmap второй версии платформы мебели

## Контекст

В текущей платформе уже доведены до production lead intake, калькуляторы, landing workflow, native CRM, manual AI analysis и коммерческие предложения, а также завершён безопасный платформенный контур для OCR, SketchUp MCP и render artifact pipeline.[file:111][file:112]

Это означает, что вторая версия может строиться не вокруг базовой автоматизации, а вокруг управляемой коммерциализации проектной глубины: от быстрого ответа по цене до платных пакетов КП, визуала и проектной подготовки.[file:111][file:112]

## Продуктовая цель V2

Главная цель V2 — превратить платформу из системы приёма заявок и менеджерского сопровождения в многоуровневую воронку вовлечения, где клиент покупает не только мебель, но и глубину проектной проработки.[file:111][file:112]

Вместо одного общего сценария нужно ввести продуктовые уровни вовлечённости, платные пакеты проработки и отдельный orchestration layer, который будет переводить клиента между уровнями на основе намерения, бюджета и готовности к заказу.[file:111]

## Новая продуктовая линейка

### Level 1 — быстрый ориентир

Первый уровень должен остаться максимально быстрым: клиент получает ориентир по цене без сметы и без визуала, а расчёт строится по погонному метру через уже существующий calculator path.[file:111]

Задача этого уровня — не проектирование, а быстрое закрытие первичного интереса и перевод клиента в следующий шаг.[file:112]

### Package A — 10 000 тг

Первый платный пакет стоит зафиксировать на уровне 10 000 тг. В него входят коммерческое предложение, смета по каждой позиции и предварительный чёрно-белый визуал.[file:111][file:112]

Это хорошо соответствует уже существующему proposal workflow, который умеет формировать versioned commercial proposals, preview, publish и approval flow с A4/PDF-oriented output.[file:111][file:109]

### Package B — 20 000 тг

Второй пакет стоит зафиксировать на уровне 20 000 тг. В него входят цветной визуал в нескольких проекциях, коммерческое предложение, подробные размеры мебели и расширенные материалы для согласования.[file:111][file:112]

Чтобы разница была ощутимой, в пакет также стоит включить 2–3 варианта компоновки, один раунд корректировок, лист «что входит / что не входит», а также блок рекомендуемых материалов или уровней исполнения.[file:111][file:109]

## Ключевые workstreams V2

| Направление | Что нужно сделать | Основание |
|---|---|---|
| Engagement orchestration | Ввести уровни вовлечённости, package codes, upsell logic, credited-on-order policy | Платформа уже поддерживает lead intake, calculators и CRM.[file:111][file:112] |
| Paid proposal products | Развести базовый и расширенный платные пакеты как отдельные сервисы | Commercial proposals уже production-ready.[file:112] |
| Visual packaging | Формализовать BW preview и color multi-view deliverables | 3D rendering pipeline на 86% и уже хранит render artifacts.[file:112] |
| Project PDF intake | Подключить PDF проектов как источник structured furniture zones и размеров | PDF Intelligence сейчас на 40% и уже имеет manifest, classification и extraction contracts.[file:112][file:109] |
| Supplier pricing | Ввести versioned supplier catalog и влияние на estimates | Этот workstream ещё запланирован, progress 0%.[file:112] |
| Commercial upgrade analytics | Измерять переходы rough quote → 10k → 20k → order | CRM и interaction history уже готовы для этого слоя.[file:111][file:112] |

## Фаза 1 — коммерческая упаковка

Первая фаза V2 должна быть короткой и денежной: без тяжёлой 3D-автоматизации платформа уже может продавать два платных пакета и учитывать их как отдельные сервисные продукты.[file:111][file:112]

В эту фазу входят: новые product/package entities, прайс-политика с зачётом в заказ, шаблоны клиентских сообщений, новые статусы в CRM и отдельная аналитика по конверсии пакетов.[file:111]

### Результат фазы 1

После завершения фазы платные проектные пакеты должны стать штатной частью sales flow, а менеджер должен выбирать не просто «сделать КП», а конкретный оплачиваемый пакет с понятным составом и дальнейшим credit-on-order поведением.[file:111][file:112]

## Фаза 2 — управляемый визуал

Во второй фазе нужно привести deliverables к ясному стандарту: что именно считается чёрно-белым превью, что считается цветным multi-view пакетом, сколько ракурсов даётся и в каком виде результат попадает в order/CRM context.[file:112][file:111]

Техническая база для render artifacts, guarded uploads и admin visibility уже есть, но V2 нужна не только инфраструктура хранения, а продуктовый стандарт выдачи результата.[file:112][file:109]

### Результат фазы 2

Клиент и менеджер должны видеть предсказуемые форматы результата: preview sheet, colored view set, dimensions sheet, revision round и финальный package state в CRM.[file:111][file:112]

## Фаза 3 — PDF и полуавтоматическое проектирование

Третья фаза должна соединить платные пакеты с реальными дизайнерскими входами: клиентский PDF, план помещения, спецификация, замеры и другие материалы.[file:112][file:109]

Так как Project PDF Intelligence уже умеет manifest, page classification и room/furniture-zone extraction, следующий шаг V2 — превратить эти pure contracts в manager-facing upload and draft workflow для ускорения подготовки КП и визуала.[file:112][file:109]

### Результат фазы 3

Менеджер сможет не собирать всё вручную, а использовать PDF intake как ускоритель подготовки proposal, размеров и визуала, сохраняя human review перед коммерческим использованием.[file:111][file:112]

## Фаза 4 — supplier-aware pricing

Четвёртая фаза нужна для того, чтобы платные КП были не только красивыми, но и ближе к производственной реальности. Для этого нужен versioned supplier catalog и controlled price-list workflow, который уже отмечен как отдельное планируемое направление платформы.[file:112]

После этого смета по позициям сможет строиться не только из общих шаблонов и менеджерского ввода, но и из актуализированных поставщиков, материалов и ценовых слоёв.[file:112][file:111]

### Результат фазы 4

Package A и Package B станут сильнее как коммерческий продукт, потому что их смета будет более доверительной, объяснимой и пригодной для дальнейшего заказа.[file:111][file:112]

## Фаза 5 — controlled 3D upgrade

Пятая фаза V2 — это не «полный автодизайн», а controlled upgrade от preview visuals к более реальной локальной SketchUp/EasyKitchen подготовке там, где это оправдано.[file:111][file:112]

Платформа уже завершила безопасный boundary для SketchUp MCP, render manifests, guarded uploads, file-queue contract и manual envelope scaffold; незавершённым остаётся реальный geometry/render adapter во внешнем Windows/SketchUp контуре.[file:111][file:112][file:109]

### Результат фазы 5

Расширенный пакет за 20 000 тг можно будет опционально усиливать более убедительным визуальным материалом без разрушения текущей fail-closed архитектуры.[file:112][file:109]

## Пост-фазовые направления (после Phase 5)

### Фаза 4.5 — Conversational Sales + AI Observability

Цель: добавить WhatsApp/AI как безопасный слой продаж, не включая автоответы.

Состав:
- **WhatsApp inbox** — входящие сообщения, привязка к conversation
- **Conversation-to-order matching** — сопоставление диалога с заказом
- **AI package advisor** — рекомендация пакета по намерению клиента
- **AI drafts** — черновики ответов (без автоотправки)
- **AI audit logs** — логирование всех AI-действий
- **Manager feedback** — обратная связь менеджера на AI-черновики
- **Package conversion analytics** — конверсия через WhatsApp
- **No auto-send by default** — только после ручного утверждения

### Фаза 4.6 — Package C + Project Share Viewer

#### Package C — Designer / 3D Handoff

| Пакет | Цена | Для кого | Состав |
|---|---|---|---|
| Package C | 50 000–100 000 тг | дизайнеры / сложные клиенты | 3D-файлы SKP/OBJ/GLB, PDF размеров, спецификация материалов, viewer link, 1–2 раунда правок |

**Важно:** Package C не является производственной деталировкой. Это проектная модель для согласования и вставки в интерьерный проект.

> 3D-файлы предназначены для визуального и проектного согласования. Производственная деталировка, карты распила, присадка и технические чертежи выполняются отдельно после утверждения заказа.

Добавить в package catalog:
- `package_c_designer` — price: configurable, targetUserType: interior_designer / customer / contractor
- includedDeliverables: color_visual, dimensions_sheet, material_spec, skp_model, obj_model, glb_model, viewer_link
- Новые поля: targetUserType, designerHandoffRequired, required3dFormats, fileAccessPolicy

#### Project Share Viewer

Состав:
- Share link для клиента/дизайнера
- GLB viewer
- Render gallery
- Download center
- Approval/comments
- View/download analytics
- Expiration and access control
- Package-based permissions

Минимально:
- **Package B:** ссылка на визуалы/PDF, без скачивания исходных 3D
- **Package C:** ссылка на 3D viewer, download SKP/OBJ/GLB/PDF, approval/comments

## Plan: Slices

### Slice 1 — Package C model

Добавить в package catalog: `package_c_designer`, price configurable, targetUserType, includedDeliverables (3D formats), designerHandoffRequired, required3dFormats, fileAccessPolicy. Не добавлять пока генерацию файлов — только модель и UI.

### Slice 2 — Project files registry

Таблица `project_files`: id, order_id, engagement_id, deliverable_id, file_type, file_role, storage_key, original_name, mime_type, size_bytes, sha256, download_allowed, created_at. Типы файлов: skp_model, obj_model, glb_model, fbx_model, dimensions_pdf, material_spec_pdf, render_image, preview_image, source_pdf.

Acceptance: можно зарегистрировать файл; нельзя зарегистрировать опасный MIME; нельзя скачать без разрешения; старые deliverables не ломаются.

### Slice 3 — Share links

Таблица `project_share_links`: id, order_id, engagement_id, token_hash, access_level, expires_at, download_enabled, comment_enabled, approval_enabled, revoked_at, created_at.

Endpoint-ы: POST /api/orders/:id/share-links, GET /share/:token, POST /share/:token/comments, POST /share/:token/approve.

Правила: token хранить как hash; срок действия обязателен; revoke обязателен; для Package B download исходников disabled; для Package C download enabled после оплаты.

### Slice 4 — GLB viewer

Простой viewer: загрузить .glb, показать в браузере, rotate/zoom, список файлов, кнопка download если разрешено. Без Kuula-like 360 tour — сначала практичный viewer.

### Slice 5 — AI observability foundation

Таблицы: ai_runs, ai_actions, ai_feedback. Логировать: module_code, provider, model, prompt_version, schema_version, input_summary_json, output_json, confidence, status, latency_ms, error_code, manager action. Без вызова реальной модели — только storage + tests.

### Slice 6 — Package Advisor

Pure module `src/ai/package-advisor.js` — deterministic + AI-ready:
- "примерно сколько" → Level 1
- "смета / КП / по позициям" → Package A
- "визуал / цвет / как будет" → Package B
- "SketchUp / 3D файл / дизайнер / obj / skp / glb" → Package C

Возвращает strict JSON.

### Slice 7 — WhatsApp foundation

Только inbound: `functions/api/whatsapp/webhook.js`, `src/whatsapp/normalize-message.js`, `src/whatsapp/conversation-store.js`. Флаги: WHATSAPP_WEBHOOK_ENABLED=true, WHATSAPP_SEND_ENABLED=false, AI_AUTO_SEND_ENABLED=false. Никакой автоотправки.

### Slice 8 — WhatsApp CRM inbox

В admin/CRM: inbox, unread, AI draft ready, package offered, waiting customer, link to order.

### Slice 9 — AI draft replies

AI создаёт только draft: Package A/B/C offer, missing info request, follow-up. Менеджер утверждает.

### Slice 10 — Manager-approved WhatsApp send

Endpoint: POST /api/whatsapp/messages/send. Правила: send disabled by default; manager approval required; outbound message сохраняется; status логируется; templates отдельно.

## Что не делать сейчас

Не делай в первом проходе:
- WhatsApp auto-send
- автономного AI-продавца
- customer OCR
- real SketchUp executor без отдельного review
- supplier auto-sync без ручного approval
- публичный download SKP/OBJ без оплаты Package C
- бессрочные share links
- незащищённые public URLs к файлам

## Приоритеты реализации (обновлённый порядок V2)

1. **Phase 0** — sync docs/checks (текущий шаг)
2. **Phase 4.5** — AI + WhatsApp + Observability foundation
3. **Phase 4.6** — Package C + Project Share Viewer
4. **Phase 5** — Controlled 3D upgrade
5. **Phase 5.1** — Designer handoff files SKP/OBJ/GLB
6. **Phase 5.2** — GLB web viewer
7. **Phase 5.3** — optional Kuula-like 360 tour

> Сначала коммерческий и коммуникационный слой, потом 3D.

## Изменения в CRM и оркестраторе

Для V2 в CRM нужно добавить новые сущности: `engagementLevel`, `servicePackage`, `creditedOnOrder`, `visualState`, `proposalDepth`, `revisionRound`, `sourceMaterialType` и `upgradeOfferState`.[file:111]

Оркестратор должен принимать решение не только о том, как ответить клиенту, но и о том, какой следующий пакет предложить: rough quote, 10k package, 20k package или полный производственный проект.[file:111][file:112]

## Метрики V2

V2 имеет смысл только если она улучшает деньги и скорость. Поэтому ключевые метрики должны быть не инженерные, а коммерческие.[file:111]

Нужно измерять:
- конверсию из быстрого расчёта в пакет 10 000 тг;
- конверсию из пакета 10 000 тг в пакет 20 000 тг;
- конверсию из платных пакетов в реальный заказ;
- среднее время подготовки пакета;
- количество правок на пакет;
- долю пакетов, зачтённых в заказ.[file:111][file:112]

## Приоритеты реализации

Лучший порядок реализации для V2 выглядит так:

1. Product/package model и CRM states.[file:111]
2. Коммерческая упаковка пакетов 10 000 и 20 000 тг.[file:111]
3. Стандартизация BW/Color deliverables.[file:112]
4. PDF upload and draft workflow.[file:112][file:109]
5. Supplier catalog and pricing versions.[file:112]
6. AI + WhatsApp + Observability foundation (Phase 4.5)
7. Package C + Project Share Viewer (Phase 4.6)
8. Controlled 3D upgrade через локальный reviewed adapter.[file:111][file:112]
9. Designer handoff files SKP/OBJ/GLB (Phase 5.1)
10. GLB web viewer (Phase 5.2)
11. Optional Kuula-like 360 tour (Phase 5.3)

Такой порядок позволяет сначала монетизировать уже имеющиеся возможности, потом выстроить коммуникационный и AI-слой, и только затем усиливать качество пакета за счёт 3D.[file:111][file:112]

## Целевой образ V2

Во второй версии платформа должна стать не просто CRM для мебельных заявок, а коммерческим конструктором глубины услуги: от ответа «цена за метр» до оплачиваемого КП, визуала, проектной детализации и подготовки к производству.[file:111][file:112]

Это логичное развитие текущего состояния платформы, потому что базовые контуры proposal workflow, AI assistance, CRM, PDF intelligence foundation и guarded 3D path уже существуют и готовы быть собраны в единую продуктовую модель второго поколения.[file:111][file:112][file:109]

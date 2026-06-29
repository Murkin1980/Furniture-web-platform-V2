# HARNESS.md

## Назначение проекта
Этот репозиторий содержит AI-first платформу для приёма и обработки мебельных заказов.
Главная цель системы — принимать разнородные входные данные от клиента (текст, голосовые сообщения, эскизы от руки, дизайнерские планы), извлекать из них максимум полезной информации, задавать только минимально необходимые уточнения и передавать структурированный результат в downstream-процессы: CRM, калькуляторы, КП, трекинг статусов и дальнейшую генерацию материалов.

Этот репозиторий не является общим sandbox для любых идей. Он предназначен для развития конкретного продуктового потока AI-first intake + orchestration layer поверх мебельного бизнес-процесса.

## Монорепозиторий — структура

Репозиторий организован как npm workspaces monorepo:

```
Platform V2/
├── package.json              # root workspaces config
├── HARNESS.md                # этот файл
├── wrangler.toml             # Cloudflare Pages config
├── scripts/build.mjs         # build step assembly для деплоя
├── docs/decisions/           # ADR лог
├── packages/
│   ├── mvp/                  # текущий MVP (packages, PDF, suppliers, AI, WhatsApp, projects)
│   │   ├── package.json
│   │   ├── src/              # business logic модули
│   │   ├── functions/        # Cloudflare Pages Functions (API routes)
│   │   ├── public/           # статические файлы и admin UI
│   │   ├── migrations/       # D1 SQL миграции (0001–0008)
│   │   └── scripts/          # smoke тесты MVP
│   ├── shared/               # общие модули (package-catalog, ai-observability, whatsapp)
│   │   ├── package.json
│   │   └── src/
│   └── orchestrator/         # новый AI-first orchestration layer
│       ├── package.json
│       ├── src/
│       │   ├── intake/       # multi-modal input handler + router
│       │   ├── orchestration/# process tracking, state machine
│       │   ├── extraction/   # structured data extraction pipelines
│       │   └── clarification/# minimal question loop
│       ├── functions/        # orchestrator API routes
│       ├── migrations/       # orchestration D1 tables (0009+)
│       └── scripts/          # orchestrator smoke тесты
```

## Архитектурный контекст
Текущий стек проекта:
- Cloudflare Pages Functions (vanilla ESM, без build step)
- Cloudflare D1 (SQLite)
- Cloudflare R2 (хранилище файлов)
- Vanilla JavaScript (ES modules, без TypeScript, без bundler)
- Node.js 22 + `node:sqlite` для smoke-тестов
- npm workspaces для монорепозитория

Система строится вокруг orchestration layer, который сначала классифицирует тип входа и определяет, какой инструмент платформы должен быть вызван дальше: AI extraction, PDF intelligence, calculators, proposal generation и другие специализированные модули.

## Пакеты

### @furniture/mvp
Текущий MVP с бизнес-логикой:
- `src/packages/` — пакеты услуг, кредитование, аналитика, шаблоны, статусы, deliverables
- `src/pdf/` — PDF intake, манифесты, черновики, размеры, КП из PDF
- `src/suppliers/` — каталог поставщиков, версионные прайс-листы, расчёт сметы
- `src/ai/` — AI package advisor, AI observability
- `src/whatsapp/` — WhatsApp inbound, нормализация, переписки
- `src/projects/` — project files, share links, comments

### @furniture/shared
Общие модули, переиспользуемые пакетами:
- `src/package-catalog.js` — каталог пакетов, типы, валидаторы
- `src/ai-observability.js` — AI runs, actions, feedback
- `src/whatsapp/` — normalize-message, conversation-store

### @furniture/orchestrator
Новый AI-first orchestration layer:
- `src/intake/` — classifyModality, routeIntake, INPUT_MODALITY, ROUTE_ACTION
- `src/orchestration/` — process tracking, state machine, steps audit
- `src/extraction/` — extraction pipelines (text, image, audio, PDF, multi-modal)
- `src/clarification/` — minimal question loop, priority, response handling

## Основные домены системы
Ключевые домены, которые нужно понимать перед изменениями:
- Intake — приём входных данных клиента (текст, аудио, изображения, PDF)
- Orchestration — маршрутизация, статусы, шаги процесса, policy принятия решений
- AI extraction — извлечение сущностей и структуры заказа
- Clarification — минимальный цикл уточнений при нехватке критичных данных
- CRM bridge — передача результата в CRM и бизнес-процессы
- Calculators — расчёты стоимости, сметы, параметров проекта
- Proposal/document generation — формирование КП и сопутствующих материалов
- Process tracking — отслеживание статусов, SLA, timeline и progress dashboard

## Разрешённая зона изменений
Без дополнительного подтверждения разрешено изменять только:
- `packages/mvp/src/**`
- `packages/mvp/functions/**`
- `packages/mvp/migrations/**`
- `packages/mvp/scripts/**`
- `packages/shared/src/**`
- `packages/orchestrator/src/**`
- `packages/orchestrator/functions/**`
- `packages/orchestrator/migrations/**`
- `packages/orchestrator/scripts/**`
- `docs/**`
- `scripts/build.mjs`

Только после явного подтверждения можно изменять:
- production deployment config
- `wrangler.toml` в части production-настроек
- billing / invoices / финконтур
- live CRM integrations
- destructive migrations
- старые production bridge-модули
- секреты, `.env*`, access tokens, ключи API

## Неразрешённые действия
Без явного запроса запрещено:
- выполнять production deploy;
- менять production secrets или шаблоны env;
- удалять таблицы, поля, бакеты или миграции с риском потери данных;
- переписывать архитектуру целиком ради локального удобства;
- вносить массовые рефакторы вне рамок поставленной задачи;
- менять публичные контракты API без фиксации этого в docs и tests.

## Рабочий режим AI-кодера
Для каждой задачи соблюдать порядок:
1. Кратко переформулировать задачу.
2. Изучить только релевантные файлы и текущие контракты.
3. Составить короткий план изменений.
4. Внести минимально достаточные правки.
5. Запустить проверки.
6. Кратко зафиксировать результат и риски.

Один сеанс — одна логическая задача, если явно не указано иное.

## Правила внесения изменений
- Делать минимальные, прицельные изменения.
- Не смешивать новую фичу, рефакторинг и косметические исправления в одном заходе.
- Предпочитать маленькие чистые функции для classification / extraction / routing logic.
- Избегать скрытой магии и неявных fallback-путей.
- Не вводить `any` без жёсткого основания.
- Называть сущности по бизнес-смыслу, а не по технической абстракции.
- Не создавать большие универсальные классы, если достаточно явных модулей и pure functions.
- Сохранять прозрачность decision flow: почему выбран этот route, этот статус, этот clarification step.

## Политика уточняющих вопросов
Это критический раздел проекта.

Правила:
- Сначала извлечь максимум смысла из уже полученного ввода.
- Не задавать вопросы по данным, которые можно надёжно вывести из текста, аудио, эскиза или плана.
- Задавать вопросы только по блокирующим данным, без которых нельзя безопасно продолжать маршрут процесса.
- Формулировать вопросы коротко и предметно.
- Приоритет — минимальная вовлечённость клиента при сохранении точности результата.

## Правила тестирования
Тесты обязательны при изменении:
- routing rules;
- classification logic;
- extraction schema;
- clarification policy;
- status transitions;
- process tracking;
- API contracts;
- D1 schema access logic.

Минимальный набор после изменений:
- lint
- typecheck
- релевантные unit tests
- релевантные integration tests

Если меняется orchestration flow, нужно добавить хотя бы один сценарный тест на новый маршрут.

## Команды проекта
Фактические команды репозитория:

Установка:
- `npm install` (устанавливает все workspaces)

Разработка:
- `npm run build` (assembles .wrangler/dist/ из packages/)
- `npm run dev` (build + wrangler pages dev)

Проверка синтаксиса всех модулей:
- `npm run check` ( delegates to @furniture/mvp check)

Smoke-тесты:
- `npm run smoke:packages` — lifecycle пакетов (318 assertions)
- `npm run smoke:suppliers` — поставщики и прайс-листы (79 assertions)
- `npm run smoke:advisor` — AI package advisor (47 assertions)
- `npm run smoke:ai` — AI observability (58 assertions)
- `npm run smoke:whatsapp` — WhatsApp inbound (56 assertions)
- `npm run smoke:project` — project files + share links (61 assertions)
- `npm run smoke:orchestrator` — intake routing, process tracking, extraction, clarification (44 assertions)

Деплой:
- `npm run deploy` (build + wrangler pages deploy)

Деплой миграций:
- `npm run db:migrate:local` — локальные миграции D1
- `npm run db:migrate:remote` — production миграции D1

## Definition of Done
Задача считается завершённой только если:
- реализовано требуемое поведение;
- не изменены нерелевантные файлы;
- lint проходит;
- typecheck проходит;
- релевантные тесты проходят;
- обновлены docs или session notes, если изменилось поведение системы;
- кратко зафиксированы ограничения, риски или следующий шаг.

## Документация и память проекта
Постоянный контекст проекта должен храниться в предсказуемых местах:
- `HARNESS.md` — постоянные правила и рамки проекта;
- `SESSION_NOTES.md` — накопленный рабочий контекст и свежие выводы;
- `docs/decisions/` — архитектурные решения;
- `docs/runbooks/` — операционные сценарии и внутренние инструкции.

Если в ходе задачи выявлено новое устойчивое правило проекта, его нужно поднимать из session-level заметок в постоянную документацию.

## Безопасность
- Никогда не выводить секреты в код, логи, фикстуры или документацию.
- Не выдумывать значения env-переменных.
- Не запускать destructive operations без явного подтверждения.
- Для тестов предпочитать mocks, fakes и локальные фикстуры, а не живые production-интеграции.

## Работа с Cloudflare-контуром
У проекта уже есть практический Cloudflare-контур и production-oriented инфраструктурное мышление, поэтому любые изменения в Workers, D1, R2 и публичных маршрутах должны быть осторожными, обратимыми и тестируемыми.

Предпочтения:
- сначала локальная/preview проверка;
- потом targeted validation;
- production deploy только вручную;
- миграции делать явными и читаемыми.

## Правила для pull request / change summary
После завершения каждой задачи нужно уметь кратко ответить:
- что изменено;
- зачем это изменено;
- какие файлы затронуты;
- какие проверки запускались;
- какие риски остались;
- какой следующий маленький шаг логичен.

## Стиль поведения агента
- Быть точным, а не избыточно креативным.
- Не додумывать бизнес-правила, если они не подтверждены кодом, документацией или задачей.
- При конфликте между «красивой архитектурой» и реальным workflow мебельной студии выбирать workflow.
- При неясности сначала локализовать неопределённость, а не переписывать систему целиком.
- Изменения должны помогать практической автоматизации заказов, а не только улучшать абстрактную инженерную чистоту.

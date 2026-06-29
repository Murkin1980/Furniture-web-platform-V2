# AI + WhatsApp + Observability Implementation Plan

Дата: 2026-06-28  
Проект: `Murkin1980/furniture-orders-mvp`  
Цель: безболезненно внедрить AI sales orchestration, WhatsApp-интеграцию, аудит AI-решений и аналитику улучшений без нарушения текущего launch-ready состояния платформы.

---

## 0. Главный принцип внедрения

Не строить автономного AI-продавца.

Строить управляемый слой:

```text
WhatsApp / заявка / CRM event
→ AI анализирует и предлагает следующий шаг
→ результат сохраняется в audit log
→ создаётся черновик действия
→ менеджер утверждает / редактирует / отклоняет
→ только после этого происходит отправка, смена статуса или коммерческое действие
```

AI должен быть copilot для менеджера, а не самостоятельный продавец.

---

## 1. Что нельзя сломать

Перед началом любых работ Codex обязан прочитать:

```text
PRODUCT.md
SESSION_NOTES.md
PROJECT_PROGRESS.md
LIVE_SITES.md
docs/runbooks/LAUNCH_SCOPE.md
docs/runbooks/GO_LIVE_GATE.md
docs/runbooks/API_ACCESS_MATRIX.md
docs/runbooks/LAUNCH_READINESS_CHECKLIST.md
```

Если какого-то launch-документа нет, не продолжать кодинг вслепую. Сначала создать или актуализировать недостающий документ.

Нельзя ломать:

- public order intake;
- admin panel;
- CRM pipeline;
- follow-up/history;
- calculators;
- commercial proposals;
- portfolio/media;
- landing/site builder;
- existing production smoke scripts;
- existing CI;
- launch gate.

После каждого slice обязательно:

```bash
npm run check
npm test
```

Если менялся конкретный модуль — сначала targeted tests, потом общие проверки.

---

## 2. Launch safety flags

Перед внедрением добавить или проверить env flags.

Рекомендуемые флаги:

```text
AI_ANALYSIS_ENABLED=true
AI_COMMUNICATION_DRAFTS_ENABLED=true
AI_AUTO_SEND_ENABLED=false

AI_OBSERVABILITY_ENABLED=true
AI_RAW_PAYLOAD_LOGGING_ENABLED=false
AI_COST_TRACKING_ENABLED=true
AI_MANAGER_FEEDBACK_ENABLED=true

WHATSAPP_WEBHOOK_ENABLED=false
WHATSAPP_SEND_ENABLED=false
WHATSAPP_MANAGER_APPROVAL_REQUIRED=true
WHATSAPP_TEMPLATE_SEND_ENABLED=false
WHATSAPP_AUTO_SEND_ENABLED=false

OCR_CUSTOMER_IMAGES_ENABLED=false
SKETCHUP_REAL_EXECUTOR_ENABLED=false
HERMES_AGENT_ENABLED=false
TWENTY_SYNC_ENABLED=false
```

Правило:

- inbound можно включать раньше;
- send включать только после manager approval UI;
- auto-send держать выключенным;
- customer OCR не включать;
- real SketchUp executor не включать;
- WhatsApp templates включать только после ручной проверки.

---

## 3. Архитектурная цель

Нужно добавить новый workstream:

```text
Conversational Sales + AI Observability Layer
```

Он включает:

- WhatsApp inbox;
- conversation-to-order matching;
- AI package advisor;
- AI reply drafts;
- missing info collector;
- follow-up suggestions;
- audit logs;
- manager feedback;
- analytics по конверсии;
- cost/latency/error tracking.

Этот слой должен поддерживать V2-воронку:

```text
rough quote
→ Package A 10 000 тг
→ Package B 20 000 тг
→ production order
```

При этом Package A/B должны быть коммерческими продуктами с зачётом в заказ, ограничением правок, сроком выполнения и delivery status.

---

## 4. Целевые AI-модули

### 4.1. Lead Qualification

Назначение: определить тип клиента и готовность.

Выходная схема:

```json
{
  "schemaVersion": "lead_qualification_result/v1",
  "furnitureType": "kitchen",
  "intent": "rough_quote",
  "budgetLevel": "unknown",
  "urgency": "medium",
  "readiness": "researching",
  "missingInfo": ["width", "height", "photos"],
  "leadScore": 62,
  "nextBestAction": "ask_missing_info",
  "confidence": 0.82,
  "riskFlags": []
}
```

### 4.2. Package Advisor

Назначение: рекомендовать следующий коммерческий шаг.

Возможные значения:

```text
rough_quote
package_a
package_b
measurement
contract
reject_or_low_priority
```

Выходная схема:

```json
{
  "schemaVersion": "package_recommendation/v1",
  "recommendedPackage": "package_a",
  "reason": "Client asks for itemized estimate but has not requested color visualization.",
  "creditedOnOrder": true,
  "managerScript": "Можем подготовить КП со сметой по позициям за 10 000 тг. Эта сумма засчитывается в заказ мебели.",
  "confidence": 0.82,
  "riskFlags": []
}
```

### 4.3. Missing Info Collector

Назначение: сформировать короткий вопрос клиенту.

Для кухни спрашивать:

- ширина стены;
- высота потолка;
- фото места;
- где мойка;
- где плита/газ;
- холодильник встроенный или отдельно;
- стиль/цвет;
- город/район;
- желаемый бюджет.

Для шкафа:

- ширина;
- высота;
- глубина;
- тип дверей;
- наполнение;
- фото места;
- материал/цвет;
- бюджет.

### 4.4. WhatsApp Reply Draft

Назначение: подготовить черновик ответа, но не отправлять автоматически.

Выходная схема:

```json
{
  "schemaVersion": "whatsapp_reply_draft/v1",
  "draftText": "Здравствуйте! Для точного расчёта отправьте, пожалуйста, ширину стены, высоту потолка и фото места.",
  "language": "ru",
  "tone": "friendly_professional",
  "requiresManagerApproval": true,
  "commercialClaims": [],
  "nextAction": "wait_for_customer_info",
  "riskFlags": []
}
```

### 4.5. Proposal Assistant

Назначение: помогать менеджеру при КП.

Разрешено:

- улучшать описание позиций;
- выявлять недостающие поля;
- предлагать структуру КП;
- предупреждать, что бюджет клиента не является ценой;
- предлагать Package A/B текст.

Запрещено:

- утверждать финальную цену;
- обещать сроки без manager approval;
- менять опубликованную версию КП;
- подставлять НДС/налоги без явных данных.

### 4.6. Visual Brief Builder

Назначение: собрать brief для Package B.

Выходная схема:

```json
{
  "schemaVersion": "visual_brief/v1",
  "style": "modern",
  "colors": ["white", "anthracite"],
  "materials": ["marble countertop", "matte facades"],
  "viewsRequired": ["front", "top", "perspective"],
  "revisionRoundIncluded": 1,
  "missingVisualInputs": ["wall photo", "ceiling height"],
  "riskFlags": []
}
```

### 4.7. Follow-up AI

Назначение: предлагать follow-up, но не отправлять автоматически.

Примеры триггеров:

- клиент не ответил 24 часа;
- клиент получил rough quote и пропал;
- Package A предложен, но не оплачен;
- Package B предложен, но клиент сомневается;
- КП готово, но нет реакции.

---

## 5. Deterministic rules поверх AI

AI не должен сам определять коммерческую политику. Должен быть простой rule engine.

Файл:

```text
src/ai/package-decision-rules.js
```

Правила:

```text
Если клиент спрашивает «примерно сколько»
→ rough_quote

Если клиент просит «смету», «по позициям», «КП»
→ Package A

Если клиент просит «визуал», «цвет», «как будет смотреться»
→ Package B

Если клиент просит «чертежи», «деталировку», «распил»
→ Package C или after contract

Если не хватает размеров
→ Missing Info Collector

Если клиент молчит после КП
→ Follow-up draft
```

AI может рекомендовать, но deterministic rules должны защищать коммерческую логику.

---

## 6. AI observability model

Любой AI-модуль считается production-ready только если есть:

1. structured output schema;
2. safe boundary / manager approval;
3. audit log;
4. analytics;
5. feedback loop.

---

## 7. D1 schema: AI logs

Создать migration:

```text
migrations/00XX_ai_observability.sql
```

### 7.1. `ai_runs`

```sql
CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_id INTEGER,
  conversation_id INTEGER,
  contact_id INTEGER,
  module_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  input_summary_json TEXT,
  output_json TEXT,
  confidence REAL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  estimated_cost REAL,
  trigger_source TEXT,
  manager_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_order_id ON ai_runs(order_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_conversation_id ON ai_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_module_code ON ai_runs(module_code);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created_at ON ai_runs(created_at);
```

### 7.2. `ai_actions`

```sql
CREATE TABLE IF NOT EXISTS ai_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ai_run_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  action_target TEXT,
  status TEXT NOT NULL,
  performed_by TEXT,
  notes TEXT,
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_actions_ai_run_id ON ai_actions(ai_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_action_type ON ai_actions(action_type);
```

### 7.3. `ai_feedback`

```sql
CREATE TABLE IF NOT EXISTS ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ai_run_id INTEGER NOT NULL,
  feedback_type TEXT NOT NULL,
  rating INTEGER,
  reason_code TEXT,
  manager_comment TEXT,
  created_by TEXT,
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_ai_run_id ON ai_feedback(ai_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_reason_code ON ai_feedback(reason_code);
```

### 7.4. `conversation_analytics`

```sql
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL UNIQUE,
  first_response_at TEXT,
  last_response_at TEXT,
  response_time_avg_ms INTEGER,
  ai_drafts_count INTEGER NOT NULL DEFAULT 0,
  approved_drafts_count INTEGER NOT NULL DEFAULT 0,
  rejected_drafts_count INTEGER NOT NULL DEFAULT 0,
  package_a_offered INTEGER NOT NULL DEFAULT 0,
  package_a_paid INTEGER NOT NULL DEFAULT 0,
  package_b_offered INTEGER NOT NULL DEFAULT 0,
  package_b_paid INTEGER NOT NULL DEFAULT 0,
  converted_to_order INTEGER NOT NULL DEFAULT 0,
  closed_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. D1 schema: WhatsApp

Создать migration:

```text
migrations/00XX_whatsapp_conversations.sql
```

### 8.1. `whatsapp_contacts`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phone TEXT NOT NULL,
  wa_id TEXT,
  profile_name TEXT,
  linked_order_id INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_linked_order_id ON whatsapp_contacts(linked_order_id);
```

### 8.2. `whatsapp_conversations`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  contact_id INTEGER NOT NULL,
  order_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TEXT,
  last_inbound_at TEXT,
  assigned_manager TEXT,
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (contact_id) REFERENCES whatsapp_contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contact_id ON whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_order_id ON whatsapp_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON whatsapp_conversations(status);
```

### 8.3. `whatsapp_messages`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  conversation_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL,
  wa_message_id TEXT,
  text TEXT,
  media_id TEXT,
  media_url TEXT,
  status TEXT,
  raw_payload_json TEXT,
  FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id ON whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);
```

### 8.4. `whatsapp_drafts`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  sent_at TEXT,
  conversation_id INTEGER NOT NULL,
  order_id INTEGER,
  ai_run_id INTEGER,
  draft_text TEXT NOT NULL,
  ai_reason TEXT,
  package_recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT 'ai',
  approved_by TEXT,
  FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id),
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_drafts_conversation_id ON whatsapp_drafts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_drafts_order_id ON whatsapp_drafts(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_drafts_status ON whatsapp_drafts(status);
```

### 8.5. `whatsapp_templates`

```sql
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  code TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  template_name TEXT NOT NULL,
  category TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_template_id TEXT
);
```

---

## 9. New source modules

### 9.1. AI modules

Добавить:

```text
src/ai/observability.js
src/ai/ai-run-store.js
src/ai/package-decision-rules.js
src/ai/package-advisor.js
src/ai/whatsapp-draft.js
src/ai/missing-info.js
src/ai/follow-up-advisor.js
src/ai/visual-brief.js
```

### 9.2. WhatsApp modules

Добавить:

```text
src/whatsapp/verify-webhook.js
src/whatsapp/normalize-message.js
src/whatsapp/contact-store.js
src/whatsapp/conversation-store.js
src/whatsapp/message-store.js
src/whatsapp/draft-store.js
src/whatsapp/send-message.js
src/whatsapp/templates.js
```

### 9.3. API endpoints

Добавить по slices:

```text
functions/api/whatsapp/webhook.js
functions/api/whatsapp/conversations.js
functions/api/whatsapp/conversations/[id].js
functions/api/whatsapp/conversations/[id]/drafts.js
functions/api/whatsapp/drafts/[id]/approve.js
functions/api/whatsapp/drafts/[id]/reject.js
functions/api/whatsapp/drafts/[id]/send.js
functions/api/ai/runs.js
functions/api/ai/runs/[id]/feedback.js
functions/api/ai/analytics.js
```

Не добавлять send endpoint до завершения inbox + draft approval.

---

## 10. Slice plan

## Slice 1 — AI observability pure model

### Цель

Добавить чистые нормализаторы и контракты без D1, API, UI, provider calls.

### Файлы

```text
src/ai/observability.js
tests/ai-observability.test.js
```

### Проверить

- normalizes module code;
- masks phone in input summary;
- rejects secret-looking keys;
- clamps confidence;
- validates status enum;
- serializes safe output;
- never stores API keys.

### Acceptance

```bash
node --test tests/ai-observability.test.js
npm run check
npm test
```

---

## Slice 2 — AI run D1 store

### Цель

Добавить migration и store для `ai_runs`, `ai_actions`, `ai_feedback`.

### Файлы

```text
migrations/00XX_ai_observability.sql
src/ai/ai-run-store.js
tests/ai-run-store.test.js
```

### Acceptance

- can create AI run;
- can create action linked to run;
- can create feedback;
- rejects invalid status;
- stores sanitized input only;
- does not require provider API.

---

## Slice 3 — Package decision rules

### Цель

Добавить deterministic rules без AI provider.

### Файлы

```text
src/ai/package-decision-rules.js
tests/package-decision-rules.test.js
```

### Acceptance

- “примерно сколько” → rough_quote;
- “КП / смета / по позициям” → package_a;
- “визуал / цвет / как будет смотреться” → package_b;
- “деталировка / распил / чертежи” → package_c_or_contract;
- missing dimensions → ask_missing_info.

---

## Slice 4 — Package Advisor AI wrapper

### Цель

Создать AI wrapper с injected sender, structured output и audit log.

### Файлы

```text
src/ai/package-advisor.js
tests/package-advisor.test.js
```

### Правила

- no global fetch;
- no real provider by default;
- injected sender only;
- deterministic rules applied before or after AI;
- invalid JSON falls back safely;
- AI run saved when store is injected;
- manager approval required.

---

## Slice 5 — WhatsApp draft builder

### Цель

AI генерирует черновик, не отправляет.

### Файлы

```text
src/ai/whatsapp-draft.js
tests/whatsapp-draft.test.js
```

### Acceptance

- creates short RU draft;
- supports KZ placeholder/extensibility;
- includes package A/B script;
- marks `requiresManagerApproval=true`;
- rejects commercial promises without explicit context;
- logs AI run when store injected.

---

## Slice 6 — WhatsApp message normalization

### Цель

Подготовить inbound parser без webhook endpoint.

### Файлы

```text
src/whatsapp/verify-webhook.js
src/whatsapp/normalize-message.js
tests/whatsapp-normalize-message.test.js
```

### Acceptance

- normalizes text message;
- normalizes image/document metadata;
- extracts wa_id;
- extracts profile name;
- handles unsupported message type;
- ignores malformed payload safely;
- signature verification is pure/testable.

---

## Slice 7 — WhatsApp D1 storage

### Цель

Добавить tables и stores для contacts/conversations/messages/drafts.

### Файлы

```text
migrations/00XX_whatsapp_conversations.sql
src/whatsapp/contact-store.js
src/whatsapp/conversation-store.js
src/whatsapp/message-store.js
src/whatsapp/draft-store.js
tests/whatsapp-store.test.js
```

### Acceptance

- upsert contact by phone;
- create conversation;
- match conversation to order;
- store inbound message;
- store draft;
- approve/reject draft;
- no sending yet.

---

## Slice 8 — WhatsApp webhook intake endpoint

### Цель

Добавить только inbound webhook. Никакой отправки.

### Файлы

```text
functions/api/whatsapp/webhook.js
tests/whatsapp-webhook.test.js
```

### Поведение

- GET verification для Meta challenge;
- POST inbound message;
- verify signature if configured;
- if `WHATSAPP_WEBHOOK_ENABLED=false`, return disabled state safely;
- store contact/conversation/message;
- optionally generate AI draft if `AI_COMMUNICATION_DRAFTS_ENABLED=true`;
- never send response to customer.

### Acceptance

- webhook disabled returns controlled response;
- verification works;
- inbound text stored;
- AI draft created only when enabled;
- invalid signature rejected.

---

## Slice 9 — CRM WhatsApp Inbox UI

### Цель

Добавить manager-facing inbox без отправки.

### Файлы

```text
public/crm.html
public/crm.js
public/crm-core.js
functions/api/whatsapp/conversations.js
functions/api/whatsapp/conversations/[id].js
```

### UI состояния

- unread;
- needs reply;
- AI draft ready;
- waiting customer;
- package offered;
- package paid;
- closed.

### Acceptance

- manager sees inbound messages;
- manager sees AI draft;
- manager can reject draft;
- manager can edit draft locally/save as draft;
- no send button until Slice 11.

---

## Slice 10 — AI feedback UI/API

### Цель

Менеджер может оценить AI draft/recommendation.

### Файлы

```text
functions/api/ai/runs/[id]/feedback.js
functions/api/ai/runs.js
public/admin-ai-analytics.js или existing admin module
```

### Feedback reason codes

```text
good_draft
wrong_package
missing_question
too_long
too_salesy
unclear
incorrect_claim
needs_manager_context
```

### Acceptance

- manager can thumbs up/down;
- manager can select reason;
- feedback linked to ai_run;
- analytics endpoint can count feedback.

---

## Slice 11 — Manager-approved WhatsApp send

### Цель

Разрешить отправку только утверждённого черновика.

### Файлы

```text
src/whatsapp/send-message.js
functions/api/whatsapp/drafts/[id]/approve.js
functions/api/whatsapp/drafts/[id]/send.js
tests/whatsapp-send.test.js
```

### Правила

- `WHATSAPP_SEND_ENABLED=true` required;
- `WHATSAPP_MANAGER_APPROVAL_REQUIRED=true` required;
- only approved draft can be sent;
- no auto-send;
- injected sender for tests;
- real sender behind explicit env;
- outbound message saved;
- ai_action saved: `message_sent`.

### Acceptance

- unapproved draft cannot be sent;
- disabled send returns controlled error;
- approved draft sends through injected sender;
- outbound message stored;
- delivery status placeholder stored.

---

## Slice 12 — WhatsApp templates

### Цель

Добавить шаблоны, но не включать массовые рассылки.

### Файлы

```text
src/whatsapp/templates.js
functions/api/whatsapp/templates.js
tests/whatsapp-templates.test.js
```

### Минимальные шаблоны

```text
package_a_offer_ru
package_b_offer_ru
missing_info_ru
follow_up_after_quote_ru
proposal_ready_ru
```

Позже добавить KZ-версии.

### Acceptance

- templates stored;
- only approved template status can be used;
- template send requires `WHATSAPP_TEMPLATE_SEND_ENABLED=true`;
- no bulk send.

---

## Slice 13 — Analytics aggregator

### Цель

Сделать business analytics по AI и пакетам.

### Файлы

```text
src/ai/analytics.js
functions/api/ai/analytics.js
tests/ai-analytics.test.js
```

### Метрики

- AI runs by module;
- error rate;
- avg latency;
- estimated cost;
- draft accepted rate;
- draft rejected rate;
- package A recommended;
- package A offered;
- package A paid;
- package B recommended;
- package B offered;
- Package B paid;
- package-to-order conversion;
- manager feedback reason counts.

### Acceptance

- analytics endpoint read-scoped;
- no PII leakage;
- phone masked;
- date range filter.

---

## Slice 14 — Admin AI review dashboard

### Цель

Добавить экран для разборов и улучшений.

### UI блоки

1. AI Operations
   - runs/day;
   - errors;
   - latency;
   - cost;
   - invalid JSON/schema failures.

2. AI Quality
   - accepted drafts;
   - rejected drafts;
   - edited drafts;
   - feedback reasons.

3. AI Revenue Impact
   - rough quote → Package A;
   - Package A → Package B;
   - Package A/B → order;
   - creditedOnOrder rate.

### Acceptance

- admin sees safe aggregate data;
- can open AI run detail with sanitized input/output;
- can filter by module/date/status;
- no secrets or raw customer images.

---

## Slice 15 — Weekly review workflow docs

### Создать файл

```text
docs/runbooks/AI_WEEKLY_REVIEW.md
```

### Содержание

Еженедельно разбирать:

- 20–30 AI runs;
- 10 rejected drafts;
- 10 accepted drafts;
- 10 package recommendations;
- 5 lost conversations.

Фиксировать:

- что изменить в prompt;
- что изменить в deterministic rules;
- какие вопросы клиентам работают лучше;
- какие package scripts дают конверсию;
- какие менеджеры чаще исправляют AI.

---

## 11. WhatsApp templates draft text

### `package_a_offer_ru`

```text
Здравствуйте! Можем подготовить КП со сметой по позициям за 10 000 тг. Эта сумма засчитывается в заказ мебели. Для подготовки нужны размеры, фото места и пожелания по материалам.
```

### `package_b_offer_ru`

```text
Здравствуйте! Можем подготовить расширенный пакет за 20 000 тг: цветной визуал в нескольких ракурсах, размеры, материалы и КП. Эта сумма засчитывается в заказ мебели.
```

### `missing_info_ru`

```text
Для точного расчёта отправьте, пожалуйста: размеры, фото места, желаемый материал/цвет и город. После этого подготовим ориентир или предложим подходящий пакет.
```

### `follow_up_after_quote_ru`

```text
Здравствуйте! Хотел уточнить, актуален ли ещё расчёт мебели? Если хотите точную смету по позициям, можем подготовить КП в рамках проектного пакета.
```

### `proposal_ready_ru`

```text
Ваше КП готово. Можете посмотреть его и написать, если нужно внести уточнения. После согласования можем перейти к замеру/договору.
```

---

## 12. Safety tests checklist

Перед включением WhatsApp send проверить:

- inbound работает;
- message сохраняется;
- contact создаётся;
- conversation создаётся;
- AI draft создаётся;
- draft можно отклонить;
- draft можно одобрить;
- unapproved draft cannot send;
- send disabled blocks send;
- approved draft can send only when env enabled;
- outbound message сохраняется;
- AI action сохраняется;
- analytics считает accepted/rejected/sent;
- no auto-send path exists.

---

## 13. Production enablement order

Включать строго по порядку:

### Step 1 — AI observability only

```text
AI_OBSERVABILITY_ENABLED=true
AI_COMMUNICATION_DRAFTS_ENABLED=false
WHATSAPP_WEBHOOK_ENABLED=false
WHATSAPP_SEND_ENABLED=false
```

Проверить, что старые AI-модули пишут safe logs.

### Step 2 — WhatsApp inbound sandbox

```text
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_SEND_ENABLED=false
```

Проверить входящие сообщения с test number.

### Step 3 — AI drafts

```text
AI_COMMUNICATION_DRAFTS_ENABLED=true
AI_AUTO_SEND_ENABLED=false
```

Проверить draft creation.

### Step 4 — Manager approval UI

Send всё ещё выключен.

### Step 5 — Manager-approved send

```text
WHATSAPP_SEND_ENABLED=true
WHATSAPP_MANAGER_APPROVAL_REQUIRED=true
WHATSAPP_AUTO_SEND_ENABLED=false
```

Проверить только на test contact.

### Step 6 — Templates

```text
WHATSAPP_TEMPLATE_SEND_ENABLED=true
```

Только после утверждения templates в Meta.

---

## 14. Что не делать в этом внедрении

Не делать:

- autonomous AI sending;
- массовые рассылки;
- customer OCR auto-run;
- SketchUp real executor from WhatsApp;
- auto proposal approval;
- auto price promises;
- supplier price auto-publish;
- storing secrets in DB/logs;
- storing raw customer media in analytics;
- rewriting historical orders.

---

## 15. Required docs updates after slices

После каждого завершённого slice обновить:

```text
SESSION_NOTES.md
PROJECT_PROGRESS.md
docs/runbooks/GO_LIVE_GATE.md
docs/runbooks/API_ACCESS_MATRIX.md
```

После WhatsApp webhook:

```text
docs/runbooks/WHATSAPP_OPERATIONS.md
```

После AI observability:

```text
docs/runbooks/AI_OBSERVABILITY.md
docs/runbooks/AI_WEEKLY_REVIEW.md
```

---

## 16. Definition of done

Внедрение считается завершённым только если:

- AI runs логируются;
- AI output schema валидируется;
- manager feedback сохраняется;
- analytics показывает usage/quality/revenue impact;
- WhatsApp inbound работает;
- WhatsApp messages сохраняются;
- AI drafts создаются;
- менеджер может approve/reject;
- send работает только после approval;
- auto-send выключен;
- no secrets in repo/logs;
- CI green;
- launch smoke green;
- 10 реальных/синтетических WhatsApp диалогов обработаны без developer help.

---

## 17. Final Codex instruction

Работай маленькими slices. Не смешивай AI, WhatsApp send, аналитику и UI в один огромный PR.

Правильный порядок:

1. AI observability pure contracts.
2. AI D1 logs.
3. Package decision rules.
4. Package advisor.
5. WhatsApp draft builder.
6. WhatsApp normalize/verify.
7. WhatsApp storage.
8. WhatsApp inbound webhook.
9. CRM inbox.
10. AI feedback.
11. Manager-approved send.
12. Templates.
13. Analytics.
14. Admin AI review dashboard.
15. Weekly review docs.

Не включай production send, пока нет:

- approval UI;
- audit log;
- send disabled test;
- unapproved draft rejection test;
- manager feedback path;
- rollback instruction.

Главная цель: получить AI + WhatsApp слой, который помогает продавать Package A/B, но сохраняет контроль менеджера и даёт данные для еженедельного улучшения.

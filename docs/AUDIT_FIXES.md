# Инструкции по исправлению аудита

> Создан: 2026-07-11  
> Источник: code review Furniture-web-platform-V2  
> Приоритеты: 🔴 Критично → 🟡 Среднее → 🟢 Мелкое

---

## 🔴 FIX-1: Семантический баг — `"package_c_candidate"` не совпадает с `PACKAGE_CODES.PACKAGE_C`

**Файл:** `packages/mvp/src/ai/package-advisor.js`

**Проблема:** В `INTENT_RULES` и в нескольких `if`-проверках используется хардкод-строка `"package_c_candidate"`, тогда как в `package-catalog.js` константа `PACKAGE_CODES.PACKAGE_C = "package_c"`. Advisor никогда не вернёт реальный Package C, а `getAdvisorSummary()` вернёт `undefined` для этого кода.

**Шаги:**

1. Открыть `packages/mvp/src/ai/package-advisor.js`

2. В начале файла убедиться, что импортируется `PACKAGE_CODES`:
   ```js
   import { PACKAGE_CODES } from "../packages/package-catalog.js";
   ```

3. В массиве `INTENT_RULES` найти объект с `packageCode: "package_c_candidate"` и заменить:
   ```js
   // БЫЛО:
   packageCode: "package_c_candidate",
   // СТАЛО:
   packageCode: PACKAGE_CODES.PACKAGE_C,
   ```

4. Найти все `if (intent.packageCode === "package_c_candidate")` — их две штуки — и заменить:
   ```js
   // БЫЛО:
   if (intent.packageCode === "package_c_candidate") {
   // СТАЛО:
   if (intent.packageCode === PACKAGE_CODES.PACKAGE_C) {
   ```

5. В функции `getAdvisorSummary()` добавить лейбл для Package C:
   ```js
   const labels = {
     [PACKAGE_CODES.LEVEL_1]:   "Level 1 — Быстрый ориентир (0 тг)",
     [PACKAGE_CODES.PACKAGE_A]: "Package A — КП + смета (10 000 тг)",
     [PACKAGE_CODES.PACKAGE_B]: "Package B — Визуал + размеры (20 000 тг)",
     // ДОБАВИТЬ:
     [PACKAGE_CODES.PACKAGE_C]: "Package C — Designer / 3D Handoff (договорная)"
   };
   ```

6. Проверить: `npm run smoke:advisor -w @furniture/mvp`

---

## 🔴 FIX-2: Верификация подписи WhatsApp webhook

**Файл:** `packages/mvp/functions/api/whatsapp/webhook.js`

**Проблема:** `onRequestPost` не проверяет подпись `X-Hub-Signature-256` от Meta. Любой POST на endpoint создаёт записи в БД.

**Шаги:**

1. В `packages/mvp/src/whatsapp/` создать новый файл `verify-signature.js`:
   ```js
   /**
    * Верифицирует подпись WhatsApp webhook от Meta.
    * @param {Request} request
    * @param {string} appSecret — значение env.WHATSAPP_APP_SECRET
    * @returns {Promise<boolean>}
    */
   export async function verifyWhatsAppSignature(request, appSecret) {
     const signature = request.headers.get("X-Hub-Signature-256") || "";
     if (!signature.startsWith("sha256=")) return false;

     const expected = signature.slice(7);
     const body = await request.clone().arrayBuffer();

     const key = await crypto.subtle.importKey(
       "raw",
       new TextEncoder().encode(appSecret),
       { name: "HMAC", hash: "SHA-256" },
       false,
       ["sign"]
     );
     const signatureBuffer = await crypto.subtle.sign("HMAC", key, body);
     const computed = Array.from(new Uint8Array(signatureBuffer))
       .map(b => b.toString(16).padStart(2, "0"))
       .join("");

     return computed === expected;
   }
   ```

2. В `webhook.js` добавить импорт и проверку сразу после проверки `WHATSAPP_WEBHOOK_ENABLED`:
   ```js
   import { verifyWhatsAppSignature } from "../../../src/whatsapp/verify-signature.js";

   export async function onRequestPost(context) {
     const { env } = context;

     if (env.WHATSAPP_WEBHOOK_ENABLED !== "true") {
       return json({ success: false, error: "webhook_disabled" }, 403);
     }

     // ДОБАВИТЬ:
     if (env.WHATSAPP_APP_SECRET) {
       const valid = await verifyWhatsAppSignature(context.request, env.WHATSAPP_APP_SECRET);
       if (!valid) {
         return json({ success: false, error: "invalid_signature", message: "Webhook signature mismatch." }, 401);
       }
     }

     // ... остальной код без изменений
   }
   ```

3. В `.dev.vars.example` добавить строку:
   ```
   WHATSAPP_APP_SECRET=your_meta_app_secret_here
   ```

4. В Cloudflare Dashboard → Pages → Settings → Environment Variables добавить `WHATSAPP_APP_SECRET` для production.

5. Проверить: `npm run smoke:whatsapp -w @furniture/mvp`

---

## 🟡 FIX-3: Вынести дублирующиеся утилиты в `packages/shared`

**Файлы с дубликатами:**
- `packages/mvp/src/ai/ai-observability.js`
- `packages/mvp/src/packages/package-store.js`
- `packages/mvp/src/packages/payment-store.js`
- `packages/mvp/src/packages/deliverable-store.js`
- `packages/mvp/src/whatsapp/conversation-store.js`

**Проблема:** Функции `positiveInteger()`, `okResult()`, `errorResult()` скопированы в каждом модуле.

**Шаги:**

1. Создать файл `packages/shared/src/store-utils.js`:
   ```js
   export function positiveInteger(value) {
     const number = Number(value);
     return Number.isInteger(number) && number > 0 ? number : null;
   }

   export function okResult(body, status = 200) {
     return { ok: true, status, body: { success: true, ...body } };
   }

   export function errorResult(status, error, message) {
     return { ok: false, status, body: { success: false, error, message } };
   }
   ```

2. Добавить экспорт в `packages/shared/src/index.js`:
   ```js
   export * from "./package-catalog.js";
   export * from "./ai-observability.js";
   // ДОБАВИТЬ:
   export * from "./store-utils.js";
   ```

3. В каждом из перечисленных файлов:
   - Удалить локальные объявления трёх функций в конце файла
   - Добавить импорт в начало файла (пример для `conversation-store.js`):
     ```js
     import { positiveInteger, okResult, errorResult } from "@furniture/shared";
     ```

4. Убедиться что `packages/mvp/package.json` содержит зависимость `"@furniture/shared": "*"`. Если нет — добавить в `dependencies`.

5. Прогнать все smoke-тесты: `npm run smoke:all`

---

## 🟡 FIX-4: Санитизация `lastMessagePreview` перед рендерингом

**Файл:** `packages/mvp/src/whatsapp/conversation-store.js`  
**Файл фронтенда:** найти место, где рендерится `lastMessagePreview`

**Проблема:** Поле обрезается до 200 символов при сохранении, но не экранируется. Если фронт рендерит через `innerHTML`, возможен XSS.

**Шаги:**

1. При сохранении в `addInboundMessage` заменить:
   ```js
   // БЫЛО:
   .bind((body || "").substring(0, 200), cid)
   // СТАЛО:
   .bind(sanitizePreview(body || ""), cid)
   ```

2. Добавить функцию `sanitizePreview` в тот же файл (или в `store-utils.js`):
   ```js
   function sanitizePreview(text) {
     return text
       .replace(/[<>"'&]/g, c => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" }[c]))
       .substring(0, 200);
   }
   ```

3. На фронте — проверить все места где `lastMessagePreview` вставляется в DOM, и использовать `textContent` вместо `innerHTML`.

---

## 🟡 FIX-5: Защита от пропуска `updated_at` в будущих UPDATE-запросах

**Проблема:** D1/SQLite не поддерживает триггеры `ON UPDATE CURRENT_TIMESTAMP`. Обновление `updated_at` делается вручную в каждом запросе — легко забыть при добавлении новых эндпоинтов.

**Шаги:**

1. В `packages/shared/src/store-utils.js` добавить хелпер:
   ```js
   /**
    * Гарантирует что строка SQL содержит `updated_at = CURRENT_TIMESTAMP`.
    * Используй в любом UPDATE через D1.
    * @param {string[]} setClauses — массив SET-выражений
    * @returns {string[]}
    */
   export function withUpdatedAt(setClauses) {
     if (!setClauses.includes("updated_at = CURRENT_TIMESTAMP")) {
       return [...setClauses, "updated_at = CURRENT_TIMESTAMP"];
     }
     return setClauses;
   }
   ```

2. При написании новых UPDATE-запросов использовать:
   ```js
   const updates = withUpdatedAt(["status = ?", "some_field = ?"]);
   await db.prepare(`UPDATE my_table SET ${updates.join(", ")} WHERE id = ?`)
     .bind(...values, id).run();
   ```

3. Добавить в AGENTS.md напоминание: **"Каждый UPDATE в D1 должен включать `updated_at = CURRENT_TIMESTAMP` или использовать `withUpdatedAt()`."**

---

## 🟢 FIX-6: Переместить документацию в `docs/`

**Проблема:** Корень репо захламлён `.md`-файлами, не связанными с кодом.

**Шаги:**

```bash
git mv AI_WHATSAPP_OBSERVABILITY_IMPLEMENTATION.md docs/
git mv HARNESS.md docs/
git mv STAGE_CHECKLIST.md docs/
git mv platform-v2-stage1-implementation-summary.md docs/
git mv v2-roadmap.md docs/
git mv PROJECT_PROGRESS.md docs/
git commit -m "docs: move documentation files into docs/ directory"
```

---

## 🟢 FIX-7: Убрать `PROJECT_PROGRESS.html` из git

**Файл:** `PROJECT_PROGRESS.html` в корне репо

**Шаги:**

1. Добавить в `.gitignore`:
   ```
   # Артефакты разработки
   PROJECT_PROGRESS.html
   *.progress.html
   ```

2. Удалить файл из git-трекинга (файл на диске не удаляется):
   ```bash
   git rm --cached PROJECT_PROGRESS.html
   git commit -m "chore: remove PROJECT_PROGRESS.html from git tracking"
   ```

---

## Порядок выполнения

| # | Fix | Усилие | Приоритет |
|---|-----|--------|-----------|
| 1 | FIX-1: package_c_candidate → PACKAGE_CODES.PACKAGE_C | 5 мин | 🔴 Сейчас |
| 2 | FIX-2: WhatsApp signature verification | 30 мин | 🔴 До деплоя |
| 3 | FIX-3: Вынести store-utils в shared | 1 час | 🟡 Следующий спринт |
| 4 | FIX-4: Санитизация preview | 15 мин | 🟡 Следующий спринт |
| 5 | FIX-5: withUpdatedAt helper | 20 мин | 🟡 Следующий спринт |
| 6 | FIX-6: Переместить docs | 5 мин | 🟢 Housekeeping |
| 7 | FIX-7: Убрать HTML из git | 3 мин | 🟢 Housekeeping |

---

## Проверка после всех исправлений

```bash
npm run smoke:all
npm run check
npm run build
```

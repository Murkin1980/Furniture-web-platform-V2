export const AI_RUN_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMEOUT: "timeout"
});

export const AI_ACTION_TYPE = Object.freeze({
  CLASSIFY: "classify",
  EXTRACT: "extract",
  CLARIFY: "clarify",
  ADVISE: "advise",
  DRAFT: "draft",
  ROUTE: "route"
});

export const AI_FEEDBACK_TYPE = Object.freeze({
  CORRECT: "correct",
  INCORRECT: "incorrect",
  PARTIAL: "partial",
  MANUALLY_OVERRIDE: "manually_override"
});

const VALID_RUN_STATUSES = new Set(Object.values(AI_RUN_STATUS));
const VALID_ACTION_TYPES = new Set(Object.values(AI_ACTION_TYPE));
const VALID_FEEDBACK_TYPES = new Set(Object.values(AI_FEEDBACK_TYPE));

export async function createRun({ db, moduleCode, provider, model, promptVersion, schemaVersion, inputSummary, orderId, engagementId }) {
  if (!moduleCode || typeof moduleCode !== "string") {
    return errorResult(400, "invalid_module_code", "moduleCode is required.");
  }

  const result = await db.prepare(
    `INSERT INTO ai_runs (module_code, provider, model, prompt_version, schema_version, input_summary_json, order_id, engagement_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    moduleCode,
    provider || null,
    model || null,
    promptVersion || null,
    schemaVersion || null,
    JSON.stringify(inputSummary || {}),
    orderId || null,
    engagementId || null,
    AI_RUN_STATUS.PENDING
  ).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, moduleCode, status: AI_RUN_STATUS.PENDING } }, 201);
}

export async function startRun({ db, runId }) {
  const id = positiveInteger(runId);
  if (!id) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");

  const existing = await db.prepare("SELECT id, status FROM ai_runs WHERE id = ?").bind(id).first();
  if (!existing) return errorResult(404, "run_not_found", "AI run not found.");
  if (existing.status !== AI_RUN_STATUS.PENDING) {
    return errorResult(409, "invalid_transition", `Cannot start run in status "${existing.status}".`);
  }

  await db.prepare(
    `UPDATE ai_runs SET status = ? WHERE id = ?`
  ).bind(AI_RUN_STATUS.RUNNING, id).run();

  return okResult({ item: { id, status: AI_RUN_STATUS.RUNNING } });
}

export async function completeRun({ db, runId, output, confidence, latencyMs }) {
  const id = positiveInteger(runId);
  if (!id) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");

  const existing = await db.prepare("SELECT id, status FROM ai_runs WHERE id = ?").bind(id).first();
  if (!existing) return errorResult(404, "run_not_found", "AI run not found.");
  if (existing.status !== AI_RUN_STATUS.RUNNING) {
    return errorResult(409, "invalid_transition", `Cannot complete run in status "${existing.status}".`);
  }

  await db.prepare(
    `UPDATE ai_runs SET status = ?, output_json = ?, confidence = ?, latency_ms = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(AI_RUN_STATUS.COMPLETED, JSON.stringify(output || {}), confidence || null, latencyMs || null, id).run();

  return okResult({ item: { id, status: AI_RUN_STATUS.COMPLETED } });
}

export async function failRun({ db, runId, errorCode, errorMessage }) {
  const id = positiveInteger(runId);
  if (!id) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");

  const existing = await db.prepare("SELECT id, status FROM ai_runs WHERE id = ?").bind(id).first();
  if (!existing) return errorResult(404, "run_not_found", "AI run not found.");
  if (existing.status === AI_RUN_STATUS.COMPLETED || existing.status === AI_RUN_STATUS.FAILED) {
    return errorResult(409, "invalid_transition", `Cannot fail run in status "${existing.status}".`);
  }

  await db.prepare(
    `UPDATE ai_runs SET status = ?, error_code = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(AI_RUN_STATUS.FAILED, errorCode || null, errorMessage || null, id).run();

  return okResult({ item: { id, status: AI_RUN_STATUS.FAILED } });
}

export async function getRun({ db, runId }) {
  const id = positiveInteger(runId);
  if (!id) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");

  const row = await db.prepare(
    `SELECT id, module_code AS moduleCode, provider, model, prompt_version AS promptVersion,
            schema_version AS schemaVersion, input_summary_json AS inputSummaryJson,
            output_json AS outputJson, confidence, status, latency_ms AS latencyMs,
            error_code AS errorCode, error_message AS errorMessage,
            order_id AS orderId, engagement_id AS engagementId,
            created_at AS createdAt, completed_at AS completedAt
     FROM ai_runs WHERE id = ?`
  ).bind(id).first();

  if (!row) return errorResult(404, "run_not_found", "AI run not found.");
  return okResult({ item: row });
}

export async function listRuns({ db, moduleCode, status, orderId, limit = 50, offset = 0 }) {
  let where = [];
  let params = [];

  if (moduleCode) { where.push("module_code = ?"); params.push(moduleCode); }
  if (status) { where.push("status = ?"); params.push(status); }
  if (orderId) { where.push("order_id = ?"); params.push(orderId); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, module_code AS moduleCode, status, confidence, latency_ms AS latencyMs,
            order_id AS orderId, created_at AS createdAt, completed_at AS completedAt
     FROM ai_runs ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

export async function createAction({ db, runId, actionType, actionCode, input }) {
  const rid = positiveInteger(runId);
  if (!rid) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");
  if (!actionType || !VALID_ACTION_TYPES.has(actionType)) {
    return errorResult(400, "invalid_action_type", `actionType must be one of: ${[...VALID_ACTION_TYPES].join(", ")}`);
  }
  if (!actionCode || typeof actionCode !== "string") {
    return errorResult(400, "invalid_action_code", "actionCode is required.");
  }

  const run = await db.prepare("SELECT id FROM ai_runs WHERE id = ?").bind(rid).first();
  if (!run) return errorResult(404, "run_not_found", "AI run not found.");

  const result = await db.prepare(
    `INSERT INTO ai_actions (run_id, action_type, action_code, input_json)
     VALUES (?, ?, ?, ?)`
  ).bind(rid, actionType, actionCode, JSON.stringify(input || {})).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, runId: rid, actionType, actionCode, status: "pending" } }, 201);
}

export async function completeAction({ db, actionId, output, managerOverride }) {
  const id = positiveInteger(actionId);
  if (!id) return errorResult(400, "invalid_action_id", "actionId must be a positive integer.");

  const existing = await db.prepare("SELECT id, status FROM ai_actions WHERE id = ?").bind(id).first();
  if (!existing) return errorResult(404, "action_not_found", "AI action not found.");

  await db.prepare(
    `UPDATE ai_actions SET status = 'completed', output_json = ?, manager_override = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(JSON.stringify(output || {}), managerOverride ? 1 : 0, id).run();

  return okResult({ item: { id, status: "completed" } });
}

export async function failAction({ db, actionId, errorCode }) {
  const id = positiveInteger(actionId);
  if (!id) return errorResult(400, "invalid_action_id", "actionId must be a positive integer.");

  const existing = await db.prepare("SELECT id, status FROM ai_actions WHERE id = ?").bind(id).first();
  if (!existing) return errorResult(404, "action_not_found", "AI action not found.");

  await db.prepare(
    `UPDATE ai_actions SET status = 'failed', error_code = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(errorCode || null, id).run();

  return okResult({ item: { id, status: "failed" } });
}

export async function listActions({ db, runId, actionType, limit = 100, offset = 0 }) {
  let where = [];
  let params = [];

  if (runId) { where.push("run_id = ?"); params.push(runId); }
  if (actionType) { where.push("action_type = ?"); params.push(actionType); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, run_id AS runId, action_type AS actionType, action_code AS actionCode,
            status, error_code AS errorCode, manager_override AS managerOverride,
            created_at AS createdAt, completed_at AS completedAt
     FROM ai_actions ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

export async function addFeedback({ db, runId, actionId, feedbackType, feedbackText, rating, managerId }) {
  const rid = positiveInteger(runId);
  if (!rid) return errorResult(400, "invalid_run_id", "runId must be a positive integer.");
  if (!feedbackType || !VALID_FEEDBACK_TYPES.has(feedbackType)) {
    return errorResult(400, "invalid_feedback_type", `feedbackType must be one of: ${[...VALID_FEEDBACK_TYPES].join(", ")}`);
  }

  const run = await db.prepare("SELECT id FROM ai_runs WHERE id = ?").bind(rid).first();
  if (!run) return errorResult(404, "run_not_found", "AI run not found.");

  const aid = positiveInteger(actionId);
  if (aid) {
    const action = await db.prepare("SELECT id FROM ai_actions WHERE id = ?").bind(aid).first();
    if (!action) return errorResult(404, "action_not_found", "AI action not found.");
  }

  const result = await db.prepare(
    `INSERT INTO ai_feedback (run_id, action_id, feedback_type, feedback_text, rating, manager_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(rid, aid || null, feedbackType, feedbackText || null, rating || null, managerId || null).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, runId: rid, actionId: aid, feedbackType } }, 201);
}

export async function listFeedback({ db, runId, feedbackType, limit = 100, offset = 0 }) {
  let where = [];
  let params = [];

  if (runId) { where.push("run_id = ?"); params.push(runId); }
  if (feedbackType) { where.push("feedback_type = ?"); params.push(feedbackType); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, run_id AS runId, action_id AS actionId, feedback_type AS feedbackType,
            feedback_text AS feedbackText, rating, manager_id AS managerId, created_at AS createdAt
     FROM ai_feedback ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function okResult(body, status = 200) {
  return { ok: true, status, body: { success: true, ...body } };
}

function errorResult(status, error, message) {
  return { ok: false, status, body: { success: false, error, message } };
}

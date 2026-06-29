/**
 * Clarifier — manages the minimal clarification loop with idempotency and metrics.
 *
 * Rules (ADR 005):
 * - Extract maximum meaning from existing input first
 * - Never ask about data that can be reliably inferred
 * - Ask only about blocking data needed to continue the route
 * - Keep questions short and specific
 * - Minimize customer involvement while maintaining accuracy
 *
 * Metrics tracked:
 * - clarificationCount per process
 * - blockingQuestionCount / niceToHaveQuestionCount
 * - timeoutCount
 * - lastClarificationAt
 */

import { deriveClarificationKey, deriveClarificationResponseKey, checkIdempotent, storeIdempotent } from "../idempotency.js";

export const CLARIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  RESPONDED: "responded",
  TIMED_OUT: "timed_out",
  SKIPPED: "skipped"
});

export const CLARIFICATION_PRIORITY = Object.freeze({
  BLOCKING: "blocking",
  NICE_TO_HAVE: "nice_to_have"
});

export async function createClarification({ db, processId, question, priority, extractionId, idempotencyKey }) {
  const key = idempotencyKey || deriveClarificationKey(processId, question);

  const existing = await checkIdempotent({ db, key, entityType: "clarification" });
  if (existing) {
    return { ...existing, deduplicated: true };
  }

  const result = await db.prepare(
    `INSERT INTO orchestration_clarifications (process_id, extraction_id, question, priority, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    processId,
    extractionId || null,
    question,
    priority || CLARIFICATION_PRIORITY.BLOCKING,
    CLARIFICATION_STATUS.PENDING,
    key
  ).run();

  const id = result.meta?.last_row_id;
  const clarificationResult = { id, status: CLARIFICATION_STATUS.PENDING };

  await storeIdempotent({ db, key, entityType: "clarification", result: clarificationResult });

  await updateProcessClarificationMetrics({ db, processId });

  return clarificationResult;
}

export async function sendClarification({ db, clarificationId }) {
  const id = Number(clarificationId);
  if (!id || id <= 0) return { error: "invalid_clarification_id" };

  const existing = await db.prepare(
    "SELECT id, status FROM orchestration_clarifications WHERE id = ?"
  ).bind(id).first();

  if (!existing) return { error: "clarification_not_found" };
  if (existing.status !== CLARIFICATION_STATUS.PENDING) {
    return { error: "already_sent" };
  }

  await db.prepare(
    `UPDATE orchestration_clarifications SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(CLARIFICATION_STATUS.SENT, id).run();

  return { id, status: CLARIFICATION_STATUS.SENT };
}

export async function respondToClarification({ db, clarificationId, response, idempotencyKey }) {
  const id = Number(clarificationId);
  if (!id || id <= 0) return { error: "invalid_clarification_id" };

  const key = idempotencyKey || deriveClarificationResponseKey(id, response);

  const existing = await checkIdempotent({ db, key, entityType: "clarification_response" });
  if (existing) {
    return { ...existing, deduplicated: true };
  }

  const row = await db.prepare(
    "SELECT id, status FROM orchestration_clarifications WHERE id = ?"
  ).bind(id).first();

  if (!row) return { error: "clarification_not_found" };
  if (row.status !== CLARIFICATION_STATUS.SENT) {
    return { error: "not_sent_yet" };
  }

  await db.prepare(
    `UPDATE orchestration_clarifications SET status = ?, response = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(CLARIFICATION_STATUS.RESPONDED, response, id).run();

  const result = { id, status: CLARIFICATION_STATUS.RESPONDED, response };
  await storeIdempotent({ db, key, entityType: "clarification_response", result });

  return result;
}

export async function getClarification({ db, clarificationId }) {
  const id = Number(clarificationId);
  if (!id || id <= 0) return { error: "invalid_clarification_id" };

  const row = await db.prepare(
    `SELECT id, process_id AS processId, extraction_id AS extractionId,
            question, priority, status, response,
            sent_at AS sentAt, responded_at AS respondedAt
     FROM orchestration_clarifications WHERE id = ?`
  ).bind(id).first();

  if (!row) return { error: "clarification_not_found" };
  return { item: row };
}

export async function listClarifications({ db, processId, status, limit = 50, offset = 0 }) {
  let where = [];
  let params = [];

  if (processId) { where.push("process_id = ?"); params.push(processId); }
  if (status) { where.push("status = ?"); params.push(status); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, process_id AS processId, question, priority, status,
            sent_at AS sentAt, responded_at AS respondedAt
     FROM orchestration_clarifications ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return { items: result?.results || [] };
}

export async function getClarificationMetrics({ db, processId }) {
  const id = Number(processId);
  if (!id || id <= 0) return { error: "invalid_process_id" };

  const row = await db.prepare(
    `SELECT
       COUNT(*) as totalClarifications,
       SUM(CASE WHEN priority = 'blocking' THEN 1 ELSE 0 END) as blockingCount,
       SUM(CASE WHEN priority = 'nice_to_have' THEN 1 ELSE 0 END) as niceToHaveCount,
       SUM(CASE WHEN status = 'timed_out' THEN 1 ELSE 0 END) as timeoutCount,
       SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as respondedCount,
       MAX(sent_at) as lastClarificationAt
     FROM orchestration_clarifications
     WHERE process_id = ?`
  ).bind(id).first();

  return {
    totalClarifications: row?.totalClarifications || 0,
    blockingCount: row?.blockingCount || 0,
    niceToHaveCount: row?.niceToHaveCount || 0,
    timeoutCount: row?.timeoutCount || 0,
    respondedCount: row?.respondedCount || 0,
    lastClarificationAt: row?.lastClarificationAt || null
  };
}

export async function getAggregateMetrics({ db, status, modality, packageCode }) {
  let where = [];
  let params = [];

  if (status) { where.push("p.status = ?"); params.push(status); }
  if (modality) { where.push("p.input_modality = ?"); params.push(modality); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const row = await db.prepare(
    `SELECT
       COUNT(DISTINCT p.id) as totalProcesses,
       SUM(CASE WHEN p.status = 'clarifying' THEN 1 ELSE 0 END) as stuckClarifying,
       SUM(CASE WHEN p.status = 'timed_out' THEN 1 ELSE 0 END) as timedOut,
       SUM(CASE WHEN c.status = 'timed_out' THEN 1 ELSE 0 END) as clarificationTimeouts,
       AVG(c.total) as avgClarificationsPerProcess
     FROM orchestration_processes p
     LEFT JOIN (
       SELECT process_id, COUNT(*) as total
       FROM orchestration_clarifications
       GROUP BY process_id
     ) c ON c.process_id = p.id
     ${whereClause}`
  ).bind(...params).first();

  return {
    totalProcesses: row?.totalProcesses || 0,
    stuckClarifying: row?.stuckClarifying || 0,
    timedOut: row?.timedOut || 0,
    clarificationTimeouts: row?.clarificationTimeouts || 0,
    avgClarificationsPerProcess: row?.avgClarificationsPerProcess || 0
  };
}

async function updateProcessClarificationMetrics({ db, processId }) {
  const metrics = await getClarificationMetrics({ db, processId });
  await db.prepare(
    `UPDATE orchestration_processes
     SET clarification_count = ?, blocking_question_count = ?, nice_to_have_question_count = ?, last_clarification_at = ?
     WHERE id = ?`
  ).bind(
    metrics.totalClarifications,
    metrics.blockingCount,
    metrics.niceToHaveCount,
    metrics.lastClarificationAt,
    processId
  ).run();
}

export function generateClarificationQuestions(extractionResult) {
  const questions = [];
  const data = extractionResult || {};

  if (!data.roomType && !data.rooms?.length) {
    questions.push({
      question: "Какое помещение вы хотите спроектировать? (кухня, гостиная, спальня, прихожая)",
      priority: CLARIFICATION_PRIORITY.BLOCKING,
      field: "roomType"
    });
  }

  if (!data.dimensions && !data.rooms?.[0]?.dimensions) {
    questions.push({
      question: "Какие размеры помещения? (длина × ширина × высота в метрах)",
      priority: CLARIFICATION_PRIORITY.BLOCKING,
      field: "dimensions"
    });
  }

  if (!data.budget && !data.budgetRange) {
    questions.push({
      question: "Какой примерный бюджет на мебель? (можно указать диапазон в тенге)",
      priority: CLARIFICATION_PRIORITY.NICE_TO_HAVE,
      field: "budget"
    });
  }

  if (!data.style && !data.preferences?.style) {
    questions.push({
      question: "Какой стиль предпочитаете? (современный, классический, минимализм, скандинавский)",
      priority: CLARIFICATION_PRIORITY.NICE_TO_HAVE,
      field: "style"
    });
  }

  return questions;
}

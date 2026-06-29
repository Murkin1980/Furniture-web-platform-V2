/**
 * Clarifier — manages the minimal clarification loop.
 *
 * Rules:
 * - Extract maximum meaning from existing input first
 * - Never ask about data that can be reliably inferred
 * - Ask only about blocking data needed to continue the route
 * - Keep questions short and specific
 * - Minimize customer involvement while maintaining accuracy
 */

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

export async function createClarification({ db, processId, question, priority, extractionId }) {
  const result = await db.prepare(
    `INSERT INTO orchestration_clarifications (process_id, extraction_id, question, priority, status)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    processId,
    extractionId || null,
    question,
    priority || CLARIFICATION_PRIORITY.BLOCKING,
    CLARIFICATION_STATUS.PENDING
  ).run();

  const id = result.meta?.last_row_id;
  return { id, status: CLARIFICATION_STATUS.PENDING };
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

export async function respondToClarification({ db, clarificationId, response }) {
  const id = Number(clarificationId);
  if (!id || id <= 0) return { error: "invalid_clarification_id" };

  const existing = await db.prepare(
    "SELECT id, status FROM orchestration_clarifications WHERE id = ?"
  ).bind(id).first();

  if (!existing) return { error: "clarification_not_found" };
  if (existing.status !== CLARIFICATION_STATUS.SENT) {
    return { error: "not_sent_yet" };
  }

  await db.prepare(
    `UPDATE orchestration_clarifications SET status = ?, response = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(CLARIFICATION_STATUS.RESPONDED, response, id).run();

  return { id, status: CLARIFICATION_STATUS.RESPONDED, response };
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

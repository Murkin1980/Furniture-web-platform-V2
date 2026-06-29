/**
 * Process Tracker — tracks the state of each intake process.
 *
 * Each intake creates a process record that follows a state machine:
 * created → classifying → extracting → clarifying → routing → completed | failed
 *
 * The tracker provides:
 * - Process creation with initial context and idempotency
 * - State transitions with validation
 * - Step logging for audit trail (deduplicated)
 * - Timeout detection
 * - SLA monitoring
 */

import { deriveProcessKey, deriveStepKey, checkIdempotent, storeIdempotent } from "../idempotency.js";

export const PROCESS_STATUS = Object.freeze({
  CREATED: "created",
  CLASSIFYING: "classifying",
  EXTRACTING: "extracting",
  CLARIFYING: "clarifying",
  ROUTING: "routing",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMED_OUT: "timed_out"
});

const VALID_TRANSITIONS = Object.freeze({
  [PROCESS_STATUS.CREATED]: [PROCESS_STATUS.CLASSIFYING, PROCESS_STATUS.FAILED],
  [PROCESS_STATUS.CLASSIFYING]: [PROCESS_STATUS.EXTRACTING, PROCESS_STATUS.CLARIFYING, PROCESS_STATUS.ROUTING, PROCESS_STATUS.FAILED],
  [PROCESS_STATUS.EXTRACTING]: [PROCESS_STATUS.CLARIFYING, PROCESS_STATUS.ROUTING, PROCESS_STATUS.COMPLETED, PROCESS_STATUS.FAILED],
  [PROCESS_STATUS.CLARIFYING]: [PROCESS_STATUS.EXTRACTING, PROCESS_STATUS.ROUTING, PROCESS_STATUS.COMPLETED, PROCESS_STATUS.FAILED],
  [PROCESS_STATUS.ROUTING]: [PROCESS_STATUS.COMPLETED, PROCESS_STATUS.FAILED],
  [PROCESS_STATUS.COMPLETED]: [],
  [PROCESS_STATUS.FAILED]: [],
  [PROCESS_STATUS.TIMED_OUT]: []
});

export function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export async function createProcess({ db, orderId, clientId, inputModality, inputSummary, context, idempotencyKey }) {
  const key = idempotencyKey || deriveProcessKey(clientId, inputModality, inputSummary);

  const existing = await checkIdempotent({ db, key, entityType: "process" });
  if (existing) {
    return { ...existing, deduplicated: true };
  }

  const result = await db.prepare(
    `INSERT INTO orchestration_processes (order_id, client_id, input_modality, input_summary_json, context_json, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    orderId || null,
    clientId || null,
    inputModality || "unknown",
    JSON.stringify(inputSummary || {}),
    JSON.stringify(context || {}),
    PROCESS_STATUS.CREATED,
    key
  ).run();

  const id = result.meta?.last_row_id;
  const processResult = { id, status: PROCESS_STATUS.CREATED };

  await storeIdempotent({ db, key, entityType: "process", result: processResult });

  return processResult;
}

export async function transitionProcess({ db, processId, toStatus, metadata }) {
  const id = Number(processId);
  if (!id || id <= 0) return { error: "invalid_process_id" };

  const existing = await db.prepare(
    "SELECT id, status FROM orchestration_processes WHERE id = ?"
  ).bind(id).first();

  if (!existing) return { error: "process_not_found" };

  if (!isValidTransition(existing.status, toStatus)) {
    return {
      error: "invalid_transition",
      from: existing.status,
      to: toStatus
    };
  }

  await db.prepare(
    `UPDATE orchestration_processes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(toStatus, id).run();

  if (metadata) {
    const stepKey = deriveStepKey(id, toStatus);
    const existingStep = await checkIdempotent({ db, key: stepKey, entityType: "step" });
    if (!existingStep) {
      await db.prepare(
        `INSERT INTO orchestration_steps (process_id, step_type, status, input_json, output_json)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        id,
        toStatus,
        "completed",
        JSON.stringify(metadata.input || {}),
        JSON.stringify(metadata.output || {})
      ).run();
      await storeIdempotent({ db, key: stepKey, entityType: "step", result: { logged: true } });
    }
  }

  return { id, status: toStatus };
}

export async function getProcess({ db, processId }) {
  const id = Number(processId);
  if (!id || id <= 0) return { error: "invalid_process_id" };

  const row = await db.prepare(
    `SELECT id, order_id AS orderId, client_id AS clientId, input_modality AS inputModality,
            input_summary_json AS inputSummaryJson, context_json AS contextJson,
            status, created_at AS createdAt, updated_at AS updatedAt
     FROM orchestration_processes WHERE id = ?`
  ).bind(id).first();

  if (!row) return { error: "process_not_found" };
  return { item: row };
}

export async function listProcesses({ db, status, orderId, limit = 50, offset = 0 }) {
  let where = [];
  let params = [];

  if (status) { where.push("status = ?"); params.push(status); }
  if (orderId) { where.push("order_id = ?"); params.push(orderId); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, order_id AS orderId, input_modality AS inputModality, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM orchestration_processes ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return { items: result?.results || [] };
}

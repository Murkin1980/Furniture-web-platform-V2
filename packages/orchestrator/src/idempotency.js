/**
 * Idempotency utility — deduplication for write operations.
 *
 * Usage:
 *   const key = deriveKey("process", { clientId: 1, modality: "text", input: "кухня" });
 *   const existing = await checkIdempotent({ db, key, entityType: "process" });
 *   if (existing) return existing; // return cached result
 *   await storeIdempotent({ db, key, entityType: "process", result: { id: 1 } });
 */

import { createHash } from "node:crypto";

const VALID_ENTITY_TYPES = new Set([
  "process",
  "extraction",
  "clarification",
  "clarification_response",
  "step",
  "extraction_input"
]);

export function deriveKey(entityType, data) {
  if (!VALID_ENTITY_TYPES.has(entityType)) {
    throw new Error(`Invalid entityType: ${entityType}`);
  }

  const payload = JSON.stringify({ entityType, ...data });
  return createHash("sha256").update(payload).digest("hex");
}

export async function checkIdempotent({ db, key, entityType }) {
  if (!db || !key) return null;

  const row = await db.prepare(
    `SELECT id, result_json, created_at FROM idempotency_keys
     WHERE key = ? AND entity_type = ?`
  ).bind(key, entityType).first();

  if (!row) return null;

  const age = Date.now() - new Date(row.created_at).getTime();
  const TTL_MS = 48 * 60 * 60 * 1000;
  if (age > TTL_MS) {
    await db.prepare("DELETE FROM idempotency_keys WHERE key = ?").bind(key).run();
    return null;
  }

  try {
    return JSON.parse(row.result_json);
  } catch {
    return null;
  }
}

export async function storeIdempotent({ db, key, entityType, result }) {
  if (!db || !key) return;

  await db.prepare(
    `INSERT OR REPLACE INTO idempotency_keys (key, entity_type, result_json)
     VALUES (?, ?, ?)`
  ).bind(key, entityType, JSON.stringify(result)).run();
}

export function deriveProcessKey(clientId, inputModality, inputSummary) {
  const normalized = {
    modality: inputModality,
    text: (inputSummary.text || "").trim().substring(0, 500),
    hasImage: Boolean(inputSummary.hasImage),
    hasAudio: Boolean(inputSummary.hasAudio),
    hasPdf: Boolean(inputSummary.hasPdf)
  };
  return deriveKey("process", { clientId, ...normalized });
}

export function deriveExtractionKey(processId, extractionType, input) {
  const inputHash = deriveKey("extraction_input", input || {});
  return deriveKey("extraction", { processId, extractionType, inputHash });
}

export function deriveClarificationKey(processId, question) {
  return deriveKey("clarification", { processId, question: question.trim().substring(0, 500) });
}

export function deriveClarificationResponseKey(clarificationId, response) {
  return deriveKey("clarification_response", { clarificationId, response: response.trim().substring(0, 500) });
}

export function deriveStepKey(processId, stepType) {
  return deriveKey("step", { processId, stepType });
}

export async function cleanupStaleKeys({ db, olderThanHours = 48 }) {
  if (!db) return { deleted: 0 };

  const result = await db.prepare(
    `DELETE FROM idempotency_keys
     WHERE created_at < datetime('now', '-' || ? || ' hours')`
  ).bind(olderThanHours).run();

  return { deleted: result.meta?.changes || 0 };
}

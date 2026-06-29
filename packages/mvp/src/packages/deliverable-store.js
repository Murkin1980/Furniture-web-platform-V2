import {
  DELIVERABLE_STATUS,
  buildDeliverableDefaults,
  isValidDeliverableStatus,
  isValidArtifactFormat,
  normalizeDeliverableRow,
  normalizeRevisionRow
} from "./visual-standards.js";
import { getEngagement, incrementRevisionRound } from "./package-store.js";

const DELIVERABLE_STATUS_TRANSITIONS = Object.freeze({
  [DELIVERABLE_STATUS.PENDING]: [DELIVERABLE_STATUS.IN_PROGRESS, DELIVERABLE_STATUS.READY],
  [DELIVERABLE_STATUS.IN_PROGRESS]: [DELIVERABLE_STATUS.READY, DELIVERABLE_STATUS.REVISION_REQUESTED],
  [DELIVERABLE_STATUS.READY]: [DELIVERABLE_STATUS.DELIVERED, DELIVERABLE_STATUS.REVISION_REQUESTED],
  [DELIVERABLE_STATUS.DELIVERED]: [DELIVERABLE_STATUS.REVISION_REQUESTED],
  [DELIVERABLE_STATUS.REVISION_REQUESTED]: [DELIVERABLE_STATUS.IN_PROGRESS]
});

export async function seedEngagementDeliverables({ db, engagementId }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const engagement = await getEngagement({ db, engagementId: id });
  if (!engagement.ok) return engagement;
  const item = engagement.body.item;

  const defaults = buildDeliverableDefaults(item.packageCode);
  if (!defaults.length) return okResult({ engagementId: id, seeded: 0, items: [] });

  const existing = await db.prepare(
    `SELECT id FROM package_deliverables WHERE engagement_id = ?`
  ).bind(id).all();
  if (existing?.results?.length) {
    return okResult({ engagementId: id, seeded: 0, items: [], message: "Deliverables already seeded." });
  }

  const inserted = [];
  try {
    for (const d of defaults) {
      const result = await db.prepare(
        `INSERT INTO package_deliverables (engagement_id, order_id, deliverable_type, label, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, item.orderId, d.deliverableType, d.label, d.status, d.sortOrder).run();
      const deliverableId = result?.meta?.last_row_id;
      if (positiveInteger(deliverableId)) {
        inserted.push({ id: deliverableId, engagementId: id, deliverableType: d.deliverableType, label: d.label, status: d.status, sortOrder: d.sortOrder });
      }
    }
    return okResult({ engagementId: id, seeded: inserted.length, items: inserted }, 201);
  } catch (error) {
    return storageFailure(error);
  }
}

export async function listEngagementDeliverables({ db, engagementId }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const result = await db.prepare(
    `SELECT id, engagement_id, order_id, deliverable_type, label, status, sort_order,
            artifact_url, artifact_format, metadata_json, created_at, updated_at, completed_at
     FROM package_deliverables
     WHERE engagement_id = ?
     ORDER BY sort_order ASC, id ASC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizeDeliverableRow) });
}

export async function getDeliverable({ db, deliverableId }) {
  const id = positiveInteger(deliverableId);
  if (!id) return errorResult(400, "invalid_deliverable_id", "deliverableId must be a positive integer.");

  const row = await findDeliverable(db, id);
  if (!row) return errorResult(404, "deliverable_not_found", "Package deliverable was not found.");
  return okResult({ item: normalizeDeliverableRow(row) });
}

export async function transitionDeliverableStatus({ db, deliverableId, toStatus, createdBy = "manager" }) {
  const id = positiveInteger(deliverableId);
  if (!id) return errorResult(400, "invalid_deliverable_id", "deliverableId must be a positive integer.");
  if (!isValidDeliverableStatus(toStatus)) {
    return errorResult(400, "invalid_status", "toStatus must be a known deliverable status.");
  }

  const current = await findDeliverable(db, id);
  if (!current) return errorResult(404, "deliverable_not_found", "Package deliverable was not found.");
  const currentStatus = current.status;

  if (!canTransitionDeliverable(currentStatus, toStatus)) {
    return errorResult(409, "invalid_status_transition",
      `Deliverable cannot transition from "${currentStatus}" to "${toStatus}".`);
  }

  const updates = [`status = ?`, `updated_at = CURRENT_TIMESTAMP`];
  const values = [toStatus];
  if (toStatus === DELIVERABLE_STATUS.READY || toStatus === DELIVERABLE_STATUS.DELIVERED) {
    updates.push(`completed_at = CURRENT_TIMESTAMP`);
  } else if (toStatus === DELIVERABLE_STATUS.IN_PROGRESS || toStatus === DELIVERABLE_STATUS.REVISION_REQUESTED) {
    updates.push(`completed_at = NULL`);
  }
  values.push(id);

  try {
    await db.prepare(
      `UPDATE package_deliverables SET ${updates.join(", ")} WHERE id = ? AND status = ?`
    ).bind(...values, currentStatus).run();

    if (toStatus === DELIVERABLE_STATUS.DELIVERED) {
      await checkAllDeliverablesDelivered(db, current.engagement_id);
    }

    return getDeliverable({ db, deliverableId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function attachArtifact({ db, deliverableId, artifactUrl, artifactFormat, metadata }) {
  const id = positiveInteger(deliverableId);
  if (!id) return errorResult(400, "invalid_deliverable_id", "deliverableId must be a positive integer.");
  if (!artifactUrl || typeof artifactUrl !== "string") {
    return errorResult(400, "invalid_artifact_url", "artifactUrl must be a non-empty string.");
  }
  const format = isValidArtifactFormat(artifactFormat) ? artifactFormat : null;
  const metaJson = metadata ? JSON.stringify(metadata) : "{}";

  try {
    const result = await db.prepare(
      `UPDATE package_deliverables
       SET artifact_url = ?, artifact_format = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(artifactUrl, format, metaJson, id).run();
    if (Number(result?.meta?.changes) === 0) {
      return errorResult(404, "deliverable_not_found", "Package deliverable was not found.");
    }
    return getDeliverable({ db, deliverableId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function requestRevision({ db, deliverableId, requestNote, requestedBy = "manager" }) {
  const id = positiveInteger(deliverableId);
  if (!id) return errorResult(400, "invalid_deliverable_id", "deliverableId must be a positive integer.");

  const current = await findDeliverable(db, id);
  if (!current) return errorResult(404, "deliverable_not_found", "Package deliverable was not found.");
  if (current.status !== DELIVERABLE_STATUS.READY && current.status !== DELIVERABLE_STATUS.DELIVERED) {
    return errorResult(409, "invalid_status_for_revision",
      "Revision can only be requested for ready or delivered deliverables.");
  }

  const revisionResult = await incrementRevisionRound({ db, engagementId: current.engagement_id });
  if (!revisionResult.ok) return revisionResult;

  try {
    const insert = await db.prepare(
      `INSERT INTO deliverable_revisions (deliverable_id, revision_number, requested_by, request_note)
       VALUES (?, ?, ?, ?)`
    ).bind(id, revisionResult.body.item.revisionRound, clean(requestedBy), clean(requestNote)).run();
    const revisionId = insert?.meta?.last_row_id;

    await db.prepare(
      `UPDATE package_deliverables SET status = 'revision_requested', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(id).run();

    return okResult({
      deliverableId: id,
      revisionId,
      revisionNumber: revisionResult.body.item.revisionRound,
      engagementRevisionRound: revisionResult.body.item.revisionRound
    }, 201);
  } catch (error) {
    return storageFailure(error);
  }
}

export async function resolveRevision({ db, deliverableId, revisionId, resolution }) {
  const id = positiveInteger(deliverableId);
  const revId = positiveInteger(revisionId);
  if (!id || !revId) return errorResult(400, "invalid_ids", "deliverableId and revisionId must be positive integers.");

  const deliverable = await findDeliverable(db, id);
  if (!deliverable) return errorResult(404, "deliverable_not_found", "Package deliverable was not found.");

  try {
    const result = await db.prepare(
      `UPDATE deliverable_revisions SET resolved_at = CURRENT_TIMESTAMP, resolution = ? WHERE id = ? AND deliverable_id = ? AND resolved_at IS NULL`
    ).bind(clean(resolution), revId, id).run();
    if (Number(result?.meta?.changes) === 0) {
      return errorResult(409, "revision_already_resolved", "Revision was already resolved or not found.");
    }

    await db.prepare(
      `UPDATE package_deliverables SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'revision_requested'`
    ).bind(id).run();

    return getDeliverable({ db, deliverableId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function listDeliverableRevisions({ db, deliverableId }) {
  const id = positiveInteger(deliverableId);
  if (!id) return errorResult(400, "invalid_deliverable_id", "deliverableId must be a positive integer.");

  const result = await db.prepare(
    `SELECT id, deliverable_id, revision_number, requested_by, request_note,
            requested_at, resolved_at, resolution
     FROM deliverable_revisions
     WHERE deliverable_id = ?
     ORDER BY revision_number DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizeRevisionRow) });
}

export async function getPackageDeliverableState({ db, engagementId }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const result = await db.prepare(
    `SELECT status, COUNT(*) AS count
     FROM package_deliverables
     WHERE engagement_id = ?
     GROUP BY status`
  ).bind(id).all();
  const counts = {};
  let total = 0;
  for (const row of result?.results || []) {
    counts[row.status] = Number(row.count);
    total += Number(row.count);
  }
  const allDelivered = total > 0 && (counts[DELIVERABLE_STATUS.DELIVERED] || 0) === total;
  const hasRevisionRequested = (counts[DELIVERABLE_STATUS.REVISION_REQUESTED] || 0) > 0;
  let packageState = "empty";
  if (total === 0) packageState = "not_seeded";
  else if (hasRevisionRequested) packageState = "revision_in_progress";
  else if (allDelivered) packageState = "all_delivered";
  else if ((counts[DELIVERABLE_STATUS.READY] || 0) > 0) packageState = "has_ready";
  else if ((counts[DELIVERABLE_STATUS.IN_PROGRESS] || 0) > 0) packageState = "in_progress";
  else packageState = "all_pending";

  return okResult({ engagementId: id, total, counts, packageState, allDelivered });
}

export function canTransitionDeliverable(fromStatus, toStatus) {
  const allowed = DELIVERABLE_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

async function checkAllDeliverablesDelivered(db, engagementId) {
  const result = await db.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered
     FROM package_deliverables WHERE engagement_id = ?`
  ).bind(engagementId).first();
  const total = Number(result?.total) || 0;
  const delivered = Number(result?.delivered) || 0;
  return total > 0 && delivered === total;
}

async function findDeliverable(db, id) {
  return db.prepare(
    `SELECT id, engagement_id, order_id, deliverable_type, label, status, sort_order,
            artifact_url, artifact_format, metadata_json, created_at, updated_at, completed_at
     FROM package_deliverables WHERE id = ?`
  ).bind(id).first();
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "deliverable_conflict", "Deliverable could not be saved.");
  }
  return errorResult(500, "deliverable_storage_failed", "Package deliverable could not be stored.");
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function okResult(body, status = 200) {
  return { ok: true, status, body: { success: true, ...body } };
}

function errorResult(status, error, message) {
  return { ok: false, status, body: { success: false, error, message } };
}

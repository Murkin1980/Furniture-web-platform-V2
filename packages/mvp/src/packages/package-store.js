import {
  ENGAGEMENT_STATUS,
  VISUAL_STATE,
  UPGRADE_OFFER_STATE,
  buildEngagementDefaults,
  getPackageDefinition,
  isValidEngagementStatus,
  isValidPackageCode,
  isValidSourceMaterialType,
  isValidUpgradeOfferState,
  isValidVisualState,
  normalizeCatalogRow
} from "./package-catalog.js";

const STATUS_TRANSITIONS = Object.freeze({
  [ENGAGEMENT_STATUS.OFFERED]: [ENGAGEMENT_STATUS.ACCEPTED, ENGAGEMENT_STATUS.DECLINED],
  [ENGAGEMENT_STATUS.ACCEPTED]: [ENGAGEMENT_STATUS.PAID, ENGAGEMENT_STATUS.DECLINED],
  [ENGAGEMENT_STATUS.PAID]: [ENGAGEMENT_STATUS.IN_PROGRESS],
  [ENGAGEMENT_STATUS.IN_PROGRESS]: [ENGAGEMENT_STATUS.DELIVERED],
  [ENGAGEMENT_STATUS.DELIVERED]: [ENGAGEMENT_STATUS.CREDITED],
  [ENGAGEMENT_STATUS.CREDITED]: [],
  [ENGAGEMENT_STATUS.DECLINED]: [ENGAGEMENT_STATUS.OFFERED]
});

export async function listCatalog({ db }) {
  const result = await db.prepare(
    `SELECT id, code, name, price_kzt, credited_on_order, deliverables_json, sort_order, is_active
     FROM service_package_catalog
     WHERE is_active = 1
     ORDER BY sort_order ASC, id ASC`
  ).all();
  const items = (result?.results || []).map(normalizeCatalogRow);
  return okResult({ items });
}

export async function listOrderEngagements({ db, orderId }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");

  const order = await db.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
  if (!order) return errorResult(404, "order_not_found", "Order was not found.");

  const result = await db.prepare(
    `SELECT id, order_id AS orderId, package_code AS packageCode, engagement_level AS engagementLevel,
            status, price_kzt AS priceKzt, credited_on_order AS creditedOnOrder,
            credited_amount_kzt AS creditedAmountKzt, visual_state AS visualState,
            proposal_depth AS proposalDepth, revision_round AS revisionRound,
            max_revisions AS maxRevisions, source_material_type AS sourceMaterialType,
            upgrade_offer_state AS upgradeOfferState,
            offered_at AS offeredAt, accepted_at AS acceptedAt, paid_at AS paidAt,
            delivered_at AS deliveredAt, credited_at AS creditedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM order_package_engagements
     WHERE order_id = ?
     ORDER BY created_at DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: result?.results || [] });
}

export async function getEngagement({ db, engagementId, status = 200 }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const row = await findEngagement(db, id);
  if (!row) return errorResult(404, "engagement_not_found", "Package engagement was not found.");
  return okResult({ item: row }, status);
}

export async function createEngagement({ db, orderId, packageCode, sourceMaterialType, createdBy = "manager" }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  if (!isValidPackageCode(packageCode)) {
    return errorResult(400, "invalid_package_code", "packageCode must be a known package code.");
  }

  const packageDefinition = getPackageDefinition(packageCode);
  if (!packageDefinition) return errorResult(400, "invalid_package_code", "Package definition is missing.");
  if (packageDefinition.isSellable === false) {
    return errorResult(
      409,
      "package_not_sellable",
      packageDefinition.readinessNote || "This package is not sellable in the current production boundary."
    );
  }

  const material = isValidSourceMaterialType(sourceMaterialType) ? sourceMaterialType : "manual";

  const order = await db.prepare("SELECT id, engagement_level AS engagementLevel FROM orders WHERE id = ?").bind(id).first();
  if (!order) return errorResult(404, "order_not_found", "Order was not found.");

  const defaults = buildEngagementDefaults(packageCode);
  if (!defaults) return errorResult(400, "invalid_package_code", "Package definition is missing.");

  try {
    const insert = await db.prepare(
      `INSERT INTO order_package_engagements
        (order_id, package_code, engagement_level, status, price_kzt, credited_on_order,
         visual_state, proposal_depth, revision_round, max_revisions,
         source_material_type, upgrade_offer_state, offered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      id, defaults.packageCode, defaults.engagementLevel, defaults.status,
      defaults.priceKzt, defaults.creditedOnOrder ? 1 : 0,
      defaults.visualState, defaults.proposalDepth, defaults.revisionRound,
      defaults.maxRevisions, material, defaults.upgradeOfferState
    ).run();
    const engagementId = insert?.meta?.last_row_id;
    if (!positiveInteger(engagementId)) throw new Error("Engagement insert did not return an id.");

    await db.prepare(
      `UPDATE orders SET service_package = ?, engagement_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(defaults.packageCode, defaults.engagementLevel, id).run();

    await recordConversionEvent(db, {
      orderId: id, engagementId, fromLevel: order.engagementLevel,
      toLevel: defaults.engagementLevel, eventType: "package_offered", amountKzt: defaults.priceKzt
    });

    return getEngagement({ db, engagementId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function transitionEngagement({ db, engagementId, toStatus, visualState, upgradeOfferState, createdBy = "manager" }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");
  if (!isValidEngagementStatus(toStatus)) {
    return errorResult(400, "invalid_status", "toStatus must be a known engagement status.");
  }

  const current = await findEngagement(db, id);
  if (!current) return errorResult(404, "engagement_not_found", "Package engagement was not found.");

  if (!canTransition(current.status, toStatus)) {
    return errorResult(409, "invalid_status_transition",
      `Engagement cannot transition from "${current.status}" to "${toStatus}".`);
  }

  const updates = [`status = ?`, `updated_at = CURRENT_TIMESTAMP`];
  const values = [toStatus];
  const timestampColumn = statusTimestampColumn(toStatus);
  if (timestampColumn) {
    updates.push(`${timestampColumn} = CURRENT_TIMESTAMP`);
  }
  if (isValidVisualState(visualState) && visualState !== current.visualState) {
    updates.push(`visual_state = ?`);
    values.push(visualState);
  }
  if (isValidUpgradeOfferState(upgradeOfferState) && upgradeOfferState !== current.upgradeOfferState) {
    updates.push(`upgrade_offer_state = ?`);
    values.push(upgradeOfferState);
  }

  values.push(id);

  try {
    await db.prepare(
      `UPDATE order_package_engagements SET ${updates.join(", ")} WHERE id = ? AND status = ?`
    ).bind(...values, current.status).run();

    await recordConversionEvent(db, {
      orderId: current.orderId, engagementId: id,
      fromLevel: current.engagementLevel, toLevel: current.engagementLevel,
      eventType: `status_${toStatus}`, amountKzt: current.priceKzt
    });

    return getEngagement({ db, engagementId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function incrementRevisionRound({ db, engagementId }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const current = await findEngagement(db, id);
  if (!current) return errorResult(404, "engagement_not_found", "Package engagement was not found.");
  if (current.revisionRound >= current.maxRevisions) {
    return errorResult(409, "revision_limit_reached",
      `Package allows ${current.maxRevisions} revision(s); ${current.revisionRound} already used.`);
  }

  const nextRound = current.revisionRound + 1;
  try {
    await db.prepare(
      `UPDATE order_package_engagements SET revision_round = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(nextRound, id).run();
    return getEngagement({ db, engagementId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export function canTransition(fromStatus, toStatus) {
  const allowed = STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function statusTimestampColumn(status) {
  switch (status) {
    case ENGAGEMENT_STATUS.ACCEPTED: return "accepted_at";
    case ENGAGEMENT_STATUS.PAID: return "paid_at";
    case ENGAGEMENT_STATUS.DELIVERED: return "delivered_at";
    case ENGAGEMENT_STATUS.CREDITED: return "credited_at";
    default: return null;
  }
}

async function findEngagement(db, id) {
  return db.prepare(
    `SELECT id, order_id AS orderId, package_code AS packageCode, engagement_level AS engagementLevel,
            status, price_kzt AS priceKzt, credited_on_order AS creditedOnOrder,
            credited_amount_kzt AS creditedAmountKzt, visual_state AS visualState,
            proposal_depth AS proposalDepth, revision_round AS revisionRound,
            max_revisions AS maxRevisions, source_material_type AS sourceMaterialType,
            upgrade_offer_state AS upgradeOfferState,
            offered_at AS offeredAt, accepted_at AS acceptedAt, paid_at AS paidAt,
            delivered_at AS deliveredAt, credited_at AS creditedAt,
            created_at AS createdAt, updated_at AS updatedAt
     FROM order_package_engagements WHERE id = ?`
  ).bind(id).first();
}

async function recordConversionEvent(db, { orderId, engagementId, fromLevel, toLevel, eventType, amountKzt }) {
  await db.prepare(
    `INSERT INTO package_conversion_events (order_id, engagement_id, from_level, to_level, event_type, amount_kzt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(orderId || null, engagementId || null, fromLevel || null, toLevel || null, eventType, amountKzt || null).run();
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "engagement_conflict", "Engagement could not be saved because of a constraint conflict.");
  }
  return errorResult(500, "engagement_storage_failed", "Package engagement could not be stored.");
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

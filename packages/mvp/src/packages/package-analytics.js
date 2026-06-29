import {
  ENGAGEMENT_LEVELS,
  ENGAGEMENT_STATUS,
  isValidEngagementStatus,
  isValidEngagementLevel
} from "./package-catalog.js";

export async function getConversionFunnel({ db, fromDate, toDate }) {
  const params = [];
  let dateFilter = "";
  if (fromDate) { dateFilter += " AND created_at >= ?"; params.push(fromDate); }
  if (toDate) { dateFilter += " AND created_at <= ?"; params.push(toDate); }

  const stages = [
    { level: ENGAGEMENT_LEVELS.ROUGH_QUOTE, label: "Быстрый ориентир", eventType: "package_offered" },
    { level: ENGAGEMENT_LEVELS.PACKAGE_A, label: "Package A (10 000 тг)", eventType: "package_offered" },
    { level: ENGAGEMENT_LEVELS.PACKAGE_B, label: "Package B (20 000 тг)", eventType: "package_offered" },
    { level: ENGAGEMENT_LEVELS.PRODUCTION_ORDER, label: "Заказ мебели", eventType: "status_credited" }
  ];

  const funnel = [];
  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    let count;
    if (stage.level === ENGAGEMENT_LEVELS.ROUGH_QUOTE) {
      const result = await db.prepare(
        `SELECT COUNT(DISTINCT id) AS count FROM orders WHERE 1=1${dateFilter.replace(/\be\./g, "orders.").replace(/created_at/g, "created_at")}`
      ).bind(...params).first();
      count = Number(result?.count) || 0;
    } else {
      const result = await db.prepare(
        `SELECT COUNT(DISTINCT order_id) AS count
         FROM package_conversion_events
         WHERE to_level = ? AND event_type = ?${dateFilter}`
      ).bind(stage.level, stage.eventType, ...params).first();
      count = Number(result?.count) || 0;
    }
    funnel.push({ level: stage.level, label: stage.label, count });
  }

  const transitions = [];
  for (let i = 0; i < funnel.length - 1; i += 1) {
    const from = funnel[i];
    const to = funnel[i + 1];
    const rate = from.count > 0 ? Math.round((to.count / from.count) * 1000) / 10 : 0;
    transitions.push({ from: from.label, to: to.label, fromCount: from.count, toCount: to.count, ratePercent: rate });
  }

  return okResult({ funnel, transitions });
}

export async function getPackageMetrics({ db, fromDate, toDate }) {
  const params = [];
  let dateFilter = "";
  if (fromDate) { dateFilter += " AND e.created_at >= ?"; params.push(fromDate); }
  if (toDate) { dateFilter += " AND e.created_at <= ?"; params.push(toDate); }

  const totals = await db.prepare(
    `SELECT
       COUNT(*) AS totalEngagements,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS offered,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS accepted,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS credited,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS declined,
       SUM(CASE WHEN credited_on_order = 1 AND status = ? THEN credited_amount_kzt ELSE 0 END) AS totalCreditedKzt,
       SUM(CASE WHEN status IN (?,?) THEN price_kzt ELSE 0 END) AS totalRevenueKzt,
       AVG(CASE WHEN delivered_at IS NOT NULL AND offered_at IS NOT NULL
           THEN (julianday(delivered_at) - julianday(offered_at)) * 24 ELSE NULL END) AS avgDeliveryHours,
       AVG(revision_round) AS avgRevisions
     FROM order_package_engagements e
     WHERE 1=1${dateFilter}`
  ).bind(
    ENGAGEMENT_STATUS.OFFERED, ENGAGEMENT_STATUS.ACCEPTED, ENGAGEMENT_STATUS.PAID,
    ENGAGEMENT_STATUS.DELIVERED, ENGAGEMENT_STATUS.CREDITED, ENGAGEMENT_STATUS.DECLINED,
    ENGAGEMENT_STATUS.CREDITED,
    ENGAGEMENT_STATUS.PAID, ENGAGEMENT_STATUS.CREDITED,
    ...params
  ).first();

  const byPackage = await db.prepare(
    `SELECT package_code AS packageCode,
       COUNT(*) AS count,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS credited,
       AVG(CASE WHEN delivered_at IS NOT NULL AND paid_at IS NOT NULL
           THEN (julianday(delivered_at) - julianday(paid_at)) * 24 ELSE NULL END) AS avgDeliveryHours,
       AVG(revision_round) AS avgRevisions
     FROM order_package_engagements
     WHERE 1=1${dateFilter.replace(/e\./g, "")}
     GROUP BY package_code`
  ).bind(
    ENGAGEMENT_STATUS.PAID, ENGAGEMENT_STATUS.CREDITED,
    ...params
  ).all();

  return okResult({
    totals: normalizeMetricsRow(totals),
    byPackage: (byPackage?.results || []).map(normalizeMetricsRow)
  });
}

export async function recordUpgradeOffer({ db, engagementId, toPackageCode, templateCode, createdBy = "manager" }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  try {
    await db.prepare(
      `UPDATE order_package_engagements
       SET upgrade_offer_state = 'offered', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(id).run();

    await db.prepare(
      `INSERT INTO package_conversion_events (order_id, engagement_id, event_type, amount_kzt)
       SELECT order_id, ?, 'upgrade_offered', NULL FROM order_package_engagements WHERE id = ?`
    ).bind(id, id).run();

    return okResult({ engagementId: id, toPackageCode, templateCode, offered: true });
  } catch (error) {
    return storageFailure(error);
  }
}

function normalizeMetricsRow(row) {
  if (!row) return null;
  const result = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === "number") {
      result[key] = Math.round(value * 100) / 100;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "analytics_conflict", "Analytics record could not be saved.");
  }
  return errorResult(500, "analytics_failed", "Analytics query failed.");
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

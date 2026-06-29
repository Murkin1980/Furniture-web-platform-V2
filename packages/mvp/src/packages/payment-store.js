import { ENGAGEMENT_STATUS } from "./package-catalog.js";
import { transitionEngagement, getEngagement } from "./package-store.js";

const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
});

const PAYMENT_METHODS = Object.freeze({
  MANUAL: "manual",
  CARD: "card",
  CASH: "cash",
  TRANSFER: "transfer",
  KASPI: "kaspi"
});

export async function listEngagementPayments({ db, engagementId }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");

  const result = await db.prepare(
    `SELECT id, engagement_id AS engagementId, order_id AS orderId,
            amount_kzt AS amountKzt, method, status, reference,
            created_by AS createdBy, created_at AS createdAt, confirmed_at AS confirmedAt
     FROM package_payments
     WHERE engagement_id = ?
     ORDER BY created_at DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: result?.results || [] });
}

export async function createPayment({ db, engagementId, amountKzt, method, reference, createdBy = "manager" }) {
  const id = positiveInteger(engagementId);
  if (!id) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");
  const amount = positiveInteger(amountKzt);
  if (amount === null || amount <= 0) {
    return errorResult(400, "invalid_amount", "amountKzt must be a positive integer.");
  }
  const resolvedMethod = isValidMethod(method) ? method : PAYMENT_METHODS.MANUAL;

  const engagement = await getEngagement({ db, engagementId: id });
  if (!engagement.ok) return engagement;
  const item = engagement.body.item;

  if (item.status !== ENGAGEMENT_STATUS.ACCEPTED && item.status !== ENGAGEMENT_STATUS.OFFERED) {
    return errorResult(409, "invalid_engagement_status",
      "Payment can only be recorded for accepted or offered engagements.");
  }

  try {
    const insert = await db.prepare(
      `INSERT INTO package_payments (engagement_id, order_id, amount_kzt, method, status, reference, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    ).bind(id, item.orderId, amount, resolvedMethod, clean(reference), clean(createdBy)).run();
    const paymentId = insert?.meta?.last_row_id;
    if (!positiveInteger(paymentId)) throw new Error("Payment insert did not return an id.");
    return getPayment({ db, paymentId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function confirmPayment({ db, paymentId, createdBy = "manager" }) {
  const id = positiveInteger(paymentId);
  if (!id) return errorResult(400, "invalid_payment_id", "paymentId must be a positive integer.");

  const payment = await findPayment(db, id);
  if (!payment) return errorResult(404, "payment_not_found", "Package payment was not found.");
  if (payment.status === PAYMENT_STATUS.CONFIRMED) {
    return okResult({ item: payment });
  }
  if (payment.status !== PAYMENT_STATUS.PENDING) {
    return errorResult(409, "invalid_payment_status", "Only pending payments can be confirmed.");
  }

  try {
    await db.prepare(
      `UPDATE package_payments SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`
    ).bind(id).run();

    const engagement = await getEngagement({ db, engagementId: payment.engagementId });
    if (engagement.ok && engagement.body.item.status === ENGAGEMENT_STATUS.OFFERED) {
      const accept = await transitionEngagement({
        db, engagementId: payment.engagementId, toStatus: ENGAGEMENT_STATUS.ACCEPTED
      });
      if (!accept.ok) {
        return errorResult(409, "payment_confirmed_but_accept_failed",
          `Payment confirmed but engagement accept failed: ${accept.body.message}`);
      }
    }

    const transition = await transitionEngagement({
      db, engagementId: payment.engagementId, toStatus: ENGAGEMENT_STATUS.PAID
    });
    if (!transition.ok) {
      return errorResult(409, "payment_confirmed_but_transition_failed",
        `Payment confirmed but engagement transition failed: ${transition.body.message}`);
    }

    return getPayment({ db, paymentId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function cancelPayment({ db, paymentId, createdBy = "manager" }) {
  const id = positiveInteger(paymentId);
  if (!id) return errorResult(400, "invalid_payment_id", "paymentId must be a positive integer.");

  const payment = await findPayment(db, id);
  if (!payment) return errorResult(404, "payment_not_found", "Package payment was not found.");
  if (payment.status === PAYMENT_STATUS.CONFIRMED) {
    return errorResult(409, "payment_already_confirmed", "Confirmed payments cannot be cancelled. Use refund instead.");
  }

  try {
    await db.prepare(
      `UPDATE package_payments SET status = 'cancelled' WHERE id = ? AND status = 'pending'`
    ).bind(id).run();
    return getPayment({ db, paymentId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getPayment({ db, paymentId, status = 200 }) {
  const id = positiveInteger(paymentId);
  if (!id) return errorResult(400, "invalid_payment_id", "paymentId must be a positive integer.");
  const row = await findPayment(db, id);
  if (!row) return errorResult(404, "payment_not_found", "Package payment was not found.");
  return okResult({ item: row }, status);
}

async function findPayment(db, id) {
  return db.prepare(
    `SELECT id, engagement_id AS engagementId, order_id AS orderId,
            amount_kzt AS amountKzt, method, status, reference,
            created_by AS createdBy, created_at AS createdAt, confirmed_at AS confirmedAt
     FROM package_payments WHERE id = ?`
  ).bind(id).first();
}

function isValidMethod(method) {
  return Object.values(PAYMENT_METHODS).includes(method);
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "payment_conflict", "Payment could not be saved.");
  }
  return errorResult(500, "payment_storage_failed", "Package payment could not be stored.");
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

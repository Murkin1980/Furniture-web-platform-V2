import { okResult, errorResult, positiveInteger, withUpdatedAt } from "../shared/store-utils.js";

export async function createOrder({ db, clientId, requestText, budgetKzt, note }) {
  const cid = positiveInteger(clientId);
  if (!cid) return errorResult(400, "invalid_client_id", "clientId must be a positive integer.");

  const client = await db.prepare("SELECT id FROM clients WHERE id = ?").bind(cid).first();
  if (!client) return errorResult(404, "client_not_found", "Client was not found.");

  const trimmedNote = note ? String(note).trim() : null;
  const combinedNote = requestText
    ? `Запрос клиента: ${String(requestText).trim()}${trimmedNote ? `\n\nПримечание: ${trimmedNote}` : ""}`
    : trimmedNote;

  const budget = budgetKzt != null ? positiveInteger(budgetKzt) : null;

  try {
    const result = await db.prepare(
      `INSERT INTO orders (client_id, status, budget_kzt, note) VALUES (?, 'new', ?, ?)`
    ).bind(cid, budget, combinedNote).run();
    const orderId = result?.meta?.last_row_id;
    if (!positiveInteger(orderId)) throw new Error("Order insert did not return an id.");
    return getOrder({ db, orderId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getOrder({ db, orderId, status = 200 }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");

  const row = await db.prepare(
    `SELECT id, client_id AS clientId, status, engagement_level AS engagementLevel,
            service_package AS servicePackage, budget_kzt AS budgetKzt, note,
            created_at AS createdAt, updated_at AS updatedAt
     FROM orders WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "order_not_found", "Order was not found.");
  return okResult({ item: row }, status);
}

export async function listOrders({ db, clientId, limit = 50, offset = 0 }) {
  let query = `SELECT id, client_id AS clientId, status, engagement_level AS engagementLevel,
                      service_package AS servicePackage, budget_kzt AS budgetKzt, note,
                      created_at AS createdAt, updated_at AS updatedAt
               FROM orders`;
  const params = [];
  if (clientId) {
    const cid = positiveInteger(clientId);
    if (cid) {
      query += ` WHERE client_id = ?`;
      params.push(cid);
    }
  }
  query += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db.prepare(query).bind(...params).all();
  return okResult({ items: result?.results || [] });
}

export async function updateOrder({ db, orderId, status, budgetKzt, note }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");

  const current = await db.prepare("SELECT id, status FROM orders WHERE id = ?").bind(id).first();
  if (!current) return errorResult(404, "order_not_found", "Order was not found.");

  const setClauses = [];
  const values = [];
  if (status !== undefined) { setClauses.push("status = ?"); values.push(String(status).trim()); }
  if (budgetKzt !== undefined) { setClauses.push("budget_kzt = ?"); values.push(budgetKzt != null ? positiveInteger(budgetKzt) : null); }
  if (note !== undefined) { setClauses.push("note = ?"); values.push(note ? String(note).trim() : null); }

  if (setClauses.length === 0) {
    return errorResult(400, "no_changes", "No fields to update.");
  }

  const updated = withUpdatedAt(setClauses);
  values.push(id);

  try {
    await db.prepare(
      `UPDATE orders SET ${updated.join(", ")} WHERE id = ?`
    ).bind(...values).run();
    return getOrder({ db, orderId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "order_conflict", "Order could not be saved because of a constraint conflict.");
  }
  return errorResult(500, "order_storage_failed", "Order could not be stored.");
}

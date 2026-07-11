import { okResult, errorResult, positiveInteger, withUpdatedAt } from "../shared/store-utils.js";

export async function createClient({ db, name, phone, email, note }) {
  if (!name || !String(name).trim()) {
    return errorResult(400, "invalid_name", "Client name is required.");
  }
  const trimmedName = String(name).trim();
  const trimmedPhone = phone ? String(phone).trim() : null;
  const trimmedEmail = email ? String(email).trim() : null;
  const trimmedNote = note ? String(note).trim() : null;

  try {
    const result = await db.prepare(
      `INSERT INTO clients (name, phone, email, note) VALUES (?, ?, ?, ?)`
    ).bind(trimmedName, trimmedPhone, trimmedEmail, trimmedNote).run();
    const clientId = result?.meta?.last_row_id;
    if (!positiveInteger(clientId)) throw new Error("Client insert did not return an id.");
    return getClient({ db, clientId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getClient({ db, clientId, status = 200 }) {
  const id = positiveInteger(clientId);
  if (!id) return errorResult(400, "invalid_client_id", "clientId must be a positive integer.");

  const row = await db.prepare(
    `SELECT id, name, phone, email, note, created_at AS createdAt, updated_at AS updatedAt
     FROM clients WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "client_not_found", "Client was not found.");
  return okResult({ item: row }, status);
}

export async function listClients({ db, limit = 50, offset = 0 }) {
  const result = await db.prepare(
    `SELECT id, name, phone, email, note, created_at AS createdAt, updated_at AS updatedAt
     FROM clients ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return okResult({ items: result?.results || [] });
}

export async function updateClient({ db, clientId, name, phone, email, note }) {
  const id = positiveInteger(clientId);
  if (!id) return errorResult(400, "invalid_client_id", "clientId must be a positive integer.");

  const current = await db.prepare("SELECT id FROM clients WHERE id = ?").bind(id).first();
  if (!current) return errorResult(404, "client_not_found", "Client was not found.");

  const setClauses = [];
  const values = [];
  if (name !== undefined) { setClauses.push("name = ?"); values.push(String(name).trim()); }
  if (phone !== undefined) { setClauses.push("phone = ?"); values.push(phone ? String(phone).trim() : null); }
  if (email !== undefined) { setClauses.push("email = ?"); values.push(email ? String(email).trim() : null); }
  if (note !== undefined) { setClauses.push("note = ?"); values.push(note ? String(note).trim() : null); }

  if (setClauses.length === 0) {
    return errorResult(400, "no_changes", "No fields to update.");
  }

  const updated = withUpdatedAt(setClauses);
  values.push(id);

  try {
    await db.prepare(
      `UPDATE clients SET ${updated.join(", ")} WHERE id = ?`
    ).bind(...values).run();
    return getClient({ db, clientId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "client_conflict", "Client could not be saved because of a constraint conflict.");
  }
  return errorResult(500, "client_storage_failed", "Client could not be stored.");
}

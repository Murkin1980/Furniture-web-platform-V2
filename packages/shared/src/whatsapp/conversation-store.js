export const CONVERSATION_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
  BLOCKED: "blocked"
});

export const MESSAGE_DIRECTION = Object.freeze({
  INBOUND: "inbound",
  OUTBOUND: "outbound"
});

export const MESSAGE_STATUS = Object.freeze({
  RECEIVED: "received",
  DRAFT: "draft",
  APPROVED: "approved",
  SENT: "sent",
  FAILED: "failed"
});

export async function findOrCreateConversation({ db, phoneNumber }) {
  if (!phoneNumber) {
    return errorResult(400, "missing_phone", "phoneNumber is required.");
  }

  const existing = await db.prepare(
    `SELECT id, phone_number AS phoneNumber, client_id AS clientId, order_id AS orderId,
            status, last_message_at AS lastMessageAt, unread_count AS unreadCount,
            ai_draft_ready AS aiDraftReady, package_offered AS packageOffered,
            created_at AS createdAt
     FROM whatsapp_conversations
     WHERE phone_number = ? AND status != 'blocked'
     ORDER BY created_at DESC LIMIT 1`
  ).bind(phoneNumber).first();

  if (existing) {
    return okResult({ item: existing, created: false });
  }

  const result = await db.prepare(
    `INSERT INTO whatsapp_conversations (phone_number, status)
     VALUES (?, ?)`
  ).bind(phoneNumber, CONVERSATION_STATUS.ACTIVE).run();

  const id = result.meta?.last_row_id;
  const created = await db.prepare(
    `SELECT id, phone_number AS phoneNumber, status, unread_count AS unreadCount,
            created_at AS createdAt
     FROM whatsapp_conversations WHERE id = ?`
  ).bind(id).first();

  return okResult({ item: created, created: true }, 201);
}

export async function getConversation({ db, conversationId }) {
  const id = positiveInteger(conversationId);
  if (!id) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");

  const row = await db.prepare(
    `SELECT id, phone_number AS phoneNumber, client_id AS clientId, order_id AS orderId,
            status, last_message_at AS lastMessageAt, last_message_preview AS lastMessagePreview,
            unread_count AS unreadCount, ai_draft_ready AS aiDraftReady,
            package_offered AS packageOffered,
            created_at AS createdAt, updated_at AS updatedAt
     FROM whatsapp_conversations WHERE id = ?`
  ).bind(id).first();

  if (!row) return errorResult(404, "conversation_not_found", "Conversation not found.");
  return okResult({ item: row });
}

export async function linkToOrder({ db, conversationId, orderId }) {
  const cid = positiveInteger(conversationId);
  const oid = positiveInteger(orderId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");
  if (!oid) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");

  const conv = await db.prepare("SELECT id FROM whatsapp_conversations WHERE id = ?").bind(cid).first();
  if (!conv) return errorResult(404, "conversation_not_found", "Conversation not found.");

  await db.prepare(
    `UPDATE whatsapp_conversations SET order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(oid, cid).run();

  return okResult({ item: { id: cid, orderId: oid } });
}

export async function linkToClient({ db, conversationId, clientId }) {
  const cid = positiveInteger(conversationId);
  const clid = positiveInteger(clientId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");
  if (!clid) return errorResult(400, "invalid_client_id", "clientId must be a positive integer.");

  const conv = await db.prepare("SELECT id FROM whatsapp_conversations WHERE id = ?").bind(cid).first();
  if (!conv) return errorResult(404, "conversation_not_found", "Conversation not found.");

  await db.prepare(
    `UPDATE whatsapp_conversations SET client_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(clid, cid).run();

  return okResult({ item: { id: cid, clientId: clid } });
}

export async function addInboundMessage({ db, conversationId, body, messageType, waMessageId, mediaUrl, mediaType }) {
  const cid = positiveInteger(conversationId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");

  const conv = await db.prepare("SELECT id FROM whatsapp_conversations WHERE id = ?").bind(cid).first();
  if (!conv) return errorResult(404, "conversation_not_found", "Conversation not found.");

  const result = await db.prepare(
    `INSERT INTO whatsapp_messages (conversation_id, direction, message_type, body, wa_message_id, media_url, media_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cid,
    MESSAGE_DIRECTION.INBOUND,
    messageType || "text",
    body || "",
    waMessageId || null,
    mediaUrl || null,
    mediaType || null,
    MESSAGE_STATUS.RECEIVED
  ).run();

  const id = result.meta?.last_row_id;

  await db.prepare(
    `UPDATE whatsapp_conversations
     SET last_message_at = CURRENT_TIMESTAMP, last_message_preview = ?, unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind((body || "").substring(0, 200), cid).run();

  return okResult({ item: { id, conversationId: cid, direction: MESSAGE_DIRECTION.INBOUND, status: MESSAGE_STATUS.RECEIVED } }, 201);
}

export async function addOutboundDraft({ db, conversationId, body, aiGenerated }) {
  const cid = positiveInteger(conversationId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");

  const conv = await db.prepare("SELECT id FROM whatsapp_conversations WHERE id = ?").bind(cid).first();
  if (!conv) return errorResult(404, "conversation_not_found", "Conversation not found.");

  const result = await db.prepare(
    `INSERT INTO whatsapp_messages (conversation_id, direction, message_type, body, ai_generated, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    cid,
    MESSAGE_DIRECTION.OUTBOUND,
    "text",
    body || "",
    aiGenerated ? 1 : 0,
    MESSAGE_STATUS.DRAFT
  ).run();

  const id = result.meta?.last_row_id;

  await db.prepare(
    `UPDATE whatsapp_conversations SET ai_draft_ready = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(cid).run();

  return okResult({ item: { id, conversationId: cid, direction: MESSAGE_DIRECTION.OUTBOUND, status: MESSAGE_STATUS.DRAFT } }, 201);
}

export async function approveMessage({ db, messageId }) {
  const id = positiveInteger(messageId);
  if (!id) return errorResult(400, "invalid_message_id", "messageId must be a positive integer.");

  const msg = await db.prepare("SELECT id, status FROM whatsapp_messages WHERE id = ?").bind(id).first();
  if (!msg) return errorResult(404, "message_not_found", "Message not found.");
  if (msg.status !== MESSAGE_STATUS.DRAFT) {
    return errorResult(409, "invalid_transition", `Cannot approve message in status "${msg.status}".`);
  }

  await db.prepare(
    `UPDATE whatsapp_messages SET manager_approved = 1, status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(MESSAGE_STATUS.APPROVED, id).run();

  return okResult({ item: { id, status: MESSAGE_STATUS.APPROVED } });
}

export async function markSent({ db, messageId }) {
  const id = positiveInteger(messageId);
  if (!id) return errorResult(400, "invalid_message_id", "messageId must be a positive integer.");

  await db.prepare(
    `UPDATE whatsapp_messages SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(MESSAGE_STATUS.SENT, id).run();

  return okResult({ item: { id, status: MESSAGE_STATUS.SENT } });
}

export async function markRead({ db, conversationId }) {
  const cid = positiveInteger(conversationId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");

  await db.prepare(
    `UPDATE whatsapp_conversations SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(cid).run();

  return okResult({ item: { id: cid, unreadCount: 0 } });
}

export async function listConversations({ db, status, limit = 50, offset = 0 }) {
  let where = [];
  let params = [];

  if (status) { where.push("status = ?"); params.push(status); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, phone_number AS phoneNumber, client_id AS clientId, order_id AS orderId,
            status, last_message_at AS lastMessageAt, last_message_preview AS lastMessagePreview,
            unread_count AS unreadCount, ai_draft_ready AS aiDraftReady,
            package_offered AS packageOffered, created_at AS createdAt
     FROM whatsapp_conversations ${whereClause}
     ORDER BY last_message_at DESC NULLS LAST, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

export async function listMessages({ db, conversationId, direction, limit = 100, offset = 0 }) {
  const cid = positiveInteger(conversationId);
  if (!cid) return errorResult(400, "invalid_conversation_id", "conversationId must be a positive integer.");

  let where = ["conversation_id = ?"];
  let params = [cid];

  if (direction) { where.push("direction = ?"); params.push(direction); }

  const whereClause = `WHERE ${where.join(" AND ")}`;
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, conversation_id AS conversationId, direction, message_type AS messageType,
            body, media_url AS mediaUrl, media_type AS mediaType, wa_message_id AS waMessageId,
            status, ai_generated AS aiGenerated, manager_approved AS managerApproved,
            sent_at AS sentAt, created_at AS createdAt
     FROM whatsapp_messages ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
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

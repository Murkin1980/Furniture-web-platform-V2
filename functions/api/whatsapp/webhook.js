import { normalizeIncomingMessage } from "../../../src/whatsapp/normalize-message.js";
import { findOrCreateConversation, addInboundMessage } from "../../../src/whatsapp/conversation-store.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function onRequestPost(context) {
  const { env } = context;

  if (env.WHATSAPP_WEBHOOK_ENABLED !== "true") {
    return json({ success: false, error: "webhook_disabled", message: "WhatsApp webhook is not enabled." }, 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  const normalized = normalizeIncomingMessage(body);
  if (!normalized.ok) {
    return json({ success: false, error: normalized.error, message: normalized.message }, 400);
  }

  const msg = normalized.item;
  const db = context.env.DB;

  const convResult = await findOrCreateConversation({ db, phoneNumber: msg.phoneNumber });
  if (!convResult.ok) {
    return json({ success: false, error: convResult.body.error, message: convResult.body.message }, convResult.status);
  }

  const conversationId = convResult.body.item.id;

  const msgResult = await addInboundMessage({
    db,
    conversationId,
    body: msg.body,
    messageType: msg.messageType,
    waMessageId: msg.waMessageId,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType
  });

  if (!msgResult.ok) {
    return json({ success: false, error: msgResult.body.error, message: msgResult.body.message }, msgResult.status);
  }

  return json({
    success: true,
    conversationId,
    messageId: msgResult.body.item.id,
    created: convResult.body.created
  }, msgResult.status);
}

export async function onRequestGet(context) {
  return json({ success: true, message: "WhatsApp webhook endpoint is active." });
}

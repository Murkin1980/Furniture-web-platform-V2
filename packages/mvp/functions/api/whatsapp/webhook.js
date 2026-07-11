import { normalizeIncomingMessage } from "../../../src/whatsapp/normalize-message.js";
import { findOrCreateConversation, addInboundMessage } from "../../../src/whatsapp/conversation-store.js";
import { verifyWhatsAppSignature } from "../../../src/whatsapp/verify-signature.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (env.WHATSAPP_WEBHOOK_ENABLED !== "true") {
    return json({ success: false, error: "webhook_disabled", message: "WhatsApp webhook is not enabled." }, 403);
  }

  if (!env.WHATSAPP_APP_SECRET) {
    return json({
      success: false,
      error: "webhook_not_configured",
      message: "WHATSAPP_APP_SECRET is required when the webhook is enabled."
    }, 503);
  }

  const signatureValid = await verifyWhatsAppSignature(request, env.WHATSAPP_APP_SECRET);
  if (!signatureValid) {
    return json({
      success: false,
      error: "invalid_signature",
      message: "Webhook signature mismatch."
    }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  const normalized = normalizeIncomingMessage(body);
  if (!normalized.ok) {
    return json({ success: false, error: normalized.error, message: normalized.message }, 400);
  }

  const msg = normalized.item;
  const db = env.DB;

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

export async function onRequestGet() {
  return json({ success: true, message: "WhatsApp webhook endpoint is active." });
}

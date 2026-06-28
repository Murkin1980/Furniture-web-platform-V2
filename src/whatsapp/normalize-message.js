export function normalizeIncomingMessage(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "invalid_payload", message: "Raw payload must be an object." };
  }

  const phone = extractPhone(raw);
  if (!phone) {
    return { ok: false, error: "missing_phone", message: "Could not extract phone number." };
  }

  const body = extractBody(raw);
  const messageType = extractMessageType(raw);
  const waMessageId = raw.message_id || raw.id || null;
  const mediaUrl = extractMediaUrl(raw);
  const mediaType = mediaUrl ? extractMediaType(raw) : null;

  return {
    ok: true,
    item: {
      phoneNumber: phone,
      body,
      messageType,
      waMessageId,
      mediaUrl,
      mediaType,
      timestamp: raw.timestamp || new Date().toISOString()
    }
  };
}

function extractPhone(raw) {
  if (raw.phone_number) return normalizePhone(raw.phone_number);
  if (raw.from) return normalizePhone(raw.from);
  if (raw.contact && raw.contact.phone_number) return normalizePhone(raw.contact.phone_number);
  if (raw.value && raw.field === "phone_number") return normalizePhone(raw.value);
  return null;
}

function extractBody(raw) {
  if (raw.text && typeof raw.text === "object" && raw.text.body) return raw.text.body;
  if (typeof raw.text === "string") return raw.text;
  if (raw.body) return raw.body;
  if (raw.message && typeof raw.message === "string") return raw.message;
  return "";
}

function extractMessageType(raw) {
  if (raw.type) return raw.type;
  if (raw.image) return "image";
  if (raw.video) return "video";
  if (raw.audio) return "audio";
  if (raw.document) return "document";
  if (raw.sticker) return "sticker";
  return "text";
}

function extractMediaUrl(raw) {
  if (raw.image && raw.image.link) return raw.image.link;
  if (raw.video && raw.video.link) return raw.video.link;
  if (raw.audio && raw.audio.link) return raw.audio.link;
  if (raw.document && raw.document.link) return raw.document.link;
  if (raw.sticker && raw.sticker.link) return raw.sticker.link;
  return null;
}

function extractMediaType(raw) {
  if (raw.image) return "image";
  if (raw.video) return "video";
  if (raw.audio) return "audio";
  if (raw.document) return "document";
  if (raw.sticker) return "sticker";
  return null;
}

function normalizePhone(phone) {
  if (typeof phone !== "string") return null;
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.length < 7) return null;
  return digits.startsWith("+") ? digits : "+" + digits;
}

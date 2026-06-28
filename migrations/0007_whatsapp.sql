-- 0007_whatsapp.sql
-- V2 Phase 4.5 Slice 7: WhatsApp inbound foundation — conversations, messages.

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  client_id INTEGER,
  order_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  last_message_at TEXT,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  ai_draft_ready INTEGER NOT NULL DEFAULT 0,
  package_offered TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT,
  wa_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  ai_generated INTEGER NOT NULL DEFAULT 0,
  manager_approved INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id)
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status ON whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_wa_conv_client ON whatsapp_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_order ON whatsapp_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_direction ON whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_wa_msg_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON whatsapp_messages(created_at);

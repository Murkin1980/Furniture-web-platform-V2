import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  normalizeIncomingMessage
} from "../src/whatsapp/normalize-message.js";
import {
  CONVERSATION_STATUS,
  MESSAGE_DIRECTION,
  MESSAGE_STATUS,
  findOrCreateConversation,
  getConversation,
  linkToOrder,
  linkToClient,
  addInboundMessage,
  addOutboundDraft,
  approveMessage,
  markSent,
  markRead,
  listConversations,
  listMessages
} from "../src/whatsapp/conversation-store.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  \u2713 ${message}`); }
  else { failed += 1; console.log(`  \u2717 ${message}`); }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function loadMigrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return [
    readFileSync(new URL("0001_packages.sql", dir), "utf8"),
    readFileSync(new URL("0002_package_payments.sql", dir), "utf8"),
    readFileSync(new URL("0003_deliverables.sql", dir), "utf8"),
    readFileSync(new URL("0004_pdf_intake.sql", dir), "utf8"),
    readFileSync(new URL("0005_supplier_pricing.sql", dir), "utf8"),
    readFileSync(new URL("0006_ai_observability.sql", dir), "utf8"),
    readFileSync(new URL("0007_whatsapp.sql", dir), "utf8")
  ].join("\n");
}

function makeD1(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return stmt.get(...values) || null; },
            async all() { return { results: stmt.all(...values) }; },
            async run() {
              const r = stmt.run(...values);
              return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
            }
          };
        },
        async first() { return stmt.get() || null; },
        async all() { return { results: stmt.all() }; },
        async run() {
          const r = stmt.run();
          return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
        }
      };
    }
  };
}

console.log("WhatsApp normalize-message");

{
  const n1 = normalizeIncomingMessage({
    phone_number: "+77001234567",
    text: { body: "Привет" },
    message_id: "msg-001",
    timestamp: "2026-06-28T12:00:00Z"
  });
  assert(n1.ok, "normalizes standard WhatsApp payload");
  assertEqual(n1.item.phoneNumber, "+77001234567", "phone extracted");
  assertEqual(n1.item.body, "Привет", "body extracted");
  assertEqual(n1.item.waMessageId, "msg-001", "message id extracted");
  assertEqual(n1.item.messageType, "text", "type is text");

  const n2 = normalizeIncomingMessage({ from: "77009876543", text: "Hello" });
  assert(n2.ok, "normalizes from field");
  assertEqual(n2.item.phoneNumber, "+77009876543", "from field normalized");

  const n3 = normalizeIncomingMessage({
    phone_number: "+77001112233",
    image: { link: "https://example.com/photo.jpg" }
  });
  assert(n3.ok, "normalizes image message");
  assertEqual(n3.item.messageType, "image", "type is image");
  assertEqual(n3.item.mediaUrl, "https://example.com/photo.jpg", "media url extracted");
  assertEqual(n3.item.mediaType, "image", "media type is image");

  const n4 = normalizeIncomingMessage(null);
  assert(!n4.ok, "rejects null payload");

  const n5 = normalizeIncomingMessage({});
  assert(!n5.ok, "rejects payload without phone");

  const n6 = normalizeIncomingMessage({ phone_number: "123" });
  assert(!n6.ok, "rejects too-short phone number");

  const n7 = normalizeIncomingMessage({ phone_number: "+77001112233", text: "test", audio: { link: "https://example.com/audio.mp3" } });
  assert(n7.ok, "normalizes audio message");
  assertEqual(n7.item.messageType, "audio", "type is audio");
}

console.log("\nWhatsApp conversation-store — findOrCreateConversation");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const c1 = await findOrCreateConversation({ db, phoneNumber: "+77001234567" });
  assert(c1.ok, "findOrCreate succeeds");
  assertEqual(c1.status, 201, "returns 201 for new conversation");
  assert(c1.body.created, "marked as created");
  assertEqual(c1.body.item.phoneNumber, "+77001234567", "phone stored");

  const c2 = await findOrCreateConversation({ db, phoneNumber: "+77001234567" });
  assert(c2.ok, "findOrCreate for existing succeeds");
  assert(!c2.body.created, "marked as not created");
  assertEqual(c2.body.item.id, c1.body.item.id, "same conversation returned");

  const c3 = await findOrCreateConversation({ db, phoneNumber: null });
  assert(!c3.ok, "rejects null phone");

  const c4 = await findOrCreateConversation({ db });
  assert(!c4.ok, "rejects missing phone");

  sqlite.close();
}

console.log("\nWhatsApp conversation-store — getConversation + linkToOrder + linkToClient");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const conv = await findOrCreateConversation({ db, phoneNumber: "+77001112233" });
  const convId = conv.body.item.id;

  const g1 = await getConversation({ db, conversationId: convId });
  assert(g1.ok, "getConversation succeeds");
  assertEqual(g1.body.item.phoneNumber, "+77001112233", "phone matches");

  const g2 = await getConversation({ db, conversationId: 99999 });
  assert(!g2.ok, "getConversation with invalid id fails");

  const l1 = await linkToOrder({ db, conversationId: convId, orderId: 42 });
  assert(l1.ok, "linkToOrder succeeds");
  assertEqual(l1.body.item.orderId, 42, "orderId linked");

  const l2 = await linkToClient({ db, conversationId: convId, clientId: 7 });
  assert(l2.ok, "linkToClient succeeds");
  assertEqual(l2.body.item.clientId, 7, "clientId linked");

  sqlite.close();
}

console.log("\nWhatsApp conversation-store — addInboundMessage + listMessages");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const conv = await findOrCreateConversation({ db, phoneNumber: "+77002223344" });
  const convId = conv.body.item.id;

  const m1 = await addInboundMessage({ db, conversationId: convId, body: "Здравствуйте", messageType: "text", waMessageId: "wa-001" });
  assert(m1.ok, "addInboundMessage succeeds");
  assertEqual(m1.status, 201, "returns 201");
  assertEqual(m1.body.item.direction, "inbound", "direction is inbound");

  const m2 = await addInboundMessage({ db, conversationId: convId, body: "Фото кухни", messageType: "image", mediaUrl: "https://example.com/kitchen.jpg" });
  assert(m2.ok, "addInboundMessage with media succeeds");

  const updated = await getConversation({ db, conversationId: convId });
  assertEqual(updated.body.item.unreadCount, 2, "unread count incremented");
  assert(updated.body.item.lastMessageAt, "lastMessageAt updated");

  const msgs = await listMessages({ db, conversationId: convId });
  assertEqual(msgs.body.items.length, 2, "lists 2 messages");

  const inb = await listMessages({ db, conversationId: convId, direction: "inbound" });
  assertEqual(inb.body.items.length, 2, "filters by direction");

  const out = await listMessages({ db, conversationId: convId, direction: "outbound" });
  assertEqual(out.body.items.length, 0, "no outbound messages");

  sqlite.close();
}

console.log("\nWhatsApp conversation-store — outbound draft + approve + markSent");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const conv = await findOrCreateConversation({ db, phoneNumber: "+77003334455" });
  const convId = conv.body.item.id;

  const d1 = await addOutboundDraft({ db, conversationId: convId, body: "Здравствуйте! Чем могу помочь?", aiGenerated: true });
  assert(d1.ok, "addOutboundDraft succeeds");
  assertEqual(d1.body.item.status, "draft", "status is draft");
  assertEqual(d1.body.item.direction, "outbound", "direction is outbound");

  const draftConv = await getConversation({ db, conversationId: convId });
  assertEqual(draftConv.body.item.aiDraftReady, 1, "aiDraftReady set to 1");

  const a1 = await approveMessage({ db, messageId: d1.body.item.id });
  assert(a1.ok, "approveMessage succeeds");
  assertEqual(a1.body.item.status, "approved", "status is approved");

  const a2 = await approveMessage({ db, messageId: d1.body.item.id });
  assert(!a2.ok, "double approve fails");
  assertEqual(a2.status, 409, "returns 409");

  const s1 = await markSent({ db, messageId: d1.body.item.id });
  assert(s1.ok, "markSent succeeds");
  assertEqual(s1.body.item.status, "sent", "status is sent");

  sqlite.close();
}

console.log("\nWhatsApp conversation-store — markRead + listConversations");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const c1 = await findOrCreateConversation({ db, phoneNumber: "+77004445566" });
  const c2 = await findOrCreateConversation({ db, phoneNumber: "+77005556677" });

  await addInboundMessage({ db, conversationId: c1.body.item.id, body: "Hello" });
  await addInboundMessage({ db, conversationId: c1.body.item.id, body: "Help" });

  const r1 = await markRead({ db, conversationId: c1.body.item.id });
  assert(r1.ok, "markRead succeeds");

  const conv = await getConversation({ db, conversationId: c1.body.item.id });
  assertEqual(conv.body.item.unreadCount, 0, "unreadCount reset to 0");

  const list = await listConversations({ db });
  assertEqual(list.body.items.length, 2, "lists 2 conversations");

  const active = await listConversations({ db, status: "active" });
  assertEqual(active.body.items.length, 2, "filters by status");

  const archived = await listConversations({ db, status: "archived" });
  assertEqual(archived.body.items.length, 0, "no archived conversations");

  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

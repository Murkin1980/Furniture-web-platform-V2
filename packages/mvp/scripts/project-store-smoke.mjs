import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PACKAGE_CODES, isValidPackageCode, getPackageDefinition } from "../src/packages/package-catalog.js";
import {
  SHARE_ACCESS_LEVEL,
  registerFile,
  getFile,
  grantDownload,
  revokeDownload,
  listProjectFiles,
  createShareLink,
  getShareLinkByToken,
  revokeShareLink,
  addShareComment,
  listShareComments
} from "../src/projects/project-store.js";

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
    readFileSync(new URL("0007_whatsapp.sql", dir), "utf8"),
    readFileSync(new URL("0008_package_c_and_share_links.sql", dir), "utf8")
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

console.log("Package C catalog");

{
  assert(isValidPackageCode(PACKAGE_CODES.PACKAGE_C), "PACKAGE_C is valid package code");
  assertEqual(PACKAGE_CODES.PACKAGE_C, "package_c", "PACKAGE_C code is package_c");

  const def = getPackageDefinition(PACKAGE_CODES.PACKAGE_C);
  assert(def !== null, "Package C definition exists");
  assertEqual(def.priceConfigurable, true, "price is configurable");
  assertEqual(def.designerHandoffRequired, true, "designerHandoffRequired is true");
  assert(def.required3dFormats.includes("skp"), "required3dFormats includes skp");
  assert(def.required3dFormats.includes("obj"), "required3dFormats includes obj");
  assert(def.required3dFormats.includes("glb"), "required3dFormats includes glb");
  assert(def.deliverables.includes("skp_model"), "deliverables includes skp_model");
  assert(def.deliverables.includes("obj_model"), "deliverables includes obj_model");
  assert(def.deliverables.includes("glb_model"), "deliverables includes glb_model");
  assert(def.deliverables.includes("viewer_link"), "deliverables includes viewer_link");
  assertEqual(def.targetUserType, "interior_designer", "targetUserType is interior_designer");
  assertEqual(def.maxRevisions, 2, "maxRevisions is 2");
}

console.log("\nProject files — registerFile + getFile");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await db.prepare("INSERT INTO clients (name, phone) VALUES ('Test Client', '+77000000000')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (1, 'package_c', 'package_c', 'offered', 50000)").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (2, 'package_c', 'package_c', 'offered', 50000)").run();

  const f1 = await registerFile({
    db, orderId: 1, engagementId: 1,
    fileType: "skp_model", storageKey: "files/order-1/skp.kp",
    originalName: "kitchen-v1.skp", mimeType: "application/skp",
    sizeBytes: 1024000, sha256: "abc123", downloadAllowed: false
  });
  assert(f1.ok, "registerFile succeeds");
  assertEqual(f1.status, 201, "returns 201");
  assertEqual(f1.body.item.fileType, "skp_model", "fileType stored");
  assertEqual(f1.body.item.downloadAllowed, false, "download not allowed");

  const f2 = await getFile({ db, fileId: f1.body.item.id });
  assert(f2.ok, "getFile succeeds");
  assertEqual(f2.body.item.storageKey, "files/order-1/skp.kp", "storageKey matches");
  assertEqual(f2.body.item.originalName, "kitchen-v1.skp", "originalName matches");

  const f3 = await registerFile({
    db, orderId: 1, engagementId: 1,
    fileType: "exe_file", storageKey: "bad.exe",
    originalName: "virus.exe", mimeType: "application/x-msdownload"
  });
  assert(!f3.ok, "dangerous MIME type rejected");

  const f4 = await registerFile({
    db, orderId: 1, engagementId: 1,
    fileType: "invalid_type", storageKey: "bad",
    originalName: "bad", mimeType: "text/plain"
  });
  assert(!f4.ok, "invalid fileType rejected");

  const f5 = await registerFile({
    db, orderId: 1, engagementId: 1,
    fileType: "glb_model", storageKey: "files/order-1/model.glb",
    originalName: "model.glb", mimeType: "model/gltf-binary",
    sizeBytes: 5000000, downloadAllowed: true
  });
  assert(f5.ok, "registerFile GLB succeeds");
  assertEqual(f5.body.item.downloadAllowed, true, "download allowed for GLB");

  sqlite.close();
}

console.log("\nProject files — grantDownload + revokeDownload + listProjectFiles");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await db.prepare("INSERT INTO clients (name, phone) VALUES ('Test Client', '+77000000000')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (2, 'package_c', 'package_c', 'offered', 50000)").run();

  const f1 = await registerFile({
    db, orderId: 2, engagementId: 1,
    fileType: "obj_model", storageKey: "files/order-2/model.obj",
    originalName: "model.obj", mimeType: "text/plain",
    downloadAllowed: false
  });

  const g1 = await grantDownload({ db, fileId: f1.body.item.id });
  assert(g1.ok, "grantDownload succeeds");
  assertEqual(g1.body.item.downloadAllowed, true, "download now allowed");

  const r1 = await revokeDownload({ db, fileId: f1.body.item.id });
  assert(r1.ok, "revokeDownload succeeds");
  assertEqual(r1.body.item.downloadAllowed, false, "download revoked");

  const list = await listProjectFiles({ db, orderId: 2 });
  assertEqual(list.body.items.length, 1, "lists 1 file");

  const byType = await listProjectFiles({ db, fileType: "obj_model" });
  assertEqual(byType.body.items.length, 1, "filters by fileType");

  const noMatch = await listProjectFiles({ db, fileType: "skp_model" });
  assertEqual(noMatch.body.items.length, 0, "no match for different type");

  sqlite.close();
}

console.log("\nShare links — createShareLink + getShareLinkByToken");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await db.prepare("INSERT INTO clients (name, phone) VALUES ('Test Client', '+77000000000')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (3, 'package_c', 'package_c', 'offered', 50000)").run();

  const s1 = await createShareLink({
    db, orderId: 3, engagementId: 1,
    accessLevel: SHARE_ACCESS_LEVEL.VIEW,
    expiresAt: "2026-12-31T23:59:59Z",
    downloadEnabled: false, commentEnabled: false, approvalEnabled: false
  });
  assert(s1.ok, "createShareLink succeeds");
  assertEqual(s1.status, 201, "returns 201");
  assert(s1.body.item.token, "token is returned");
  assertEqual(s1.body.item.accessLevel, "view", "access level is view");

  const token = s1.body.item.token;
  const g1 = await getShareLinkByToken({ db, token });
  assert(g1.ok, "getShareLinkByToken succeeds");
  assertEqual(g1.body.item.accessLevel, "view", "access level matches");

  const g2 = await getShareLinkByToken({ db, token: "nonexistent-token" });
  assert(!g2.ok, "nonexistent token fails");
  assertEqual(g2.status, 404, "returns 404");

  const g3 = await getShareLinkByToken({ db, token: "" });
  assert(!g3.ok, "empty token fails");

  const s2 = await createShareLink({
    db, orderId: 3, engagementId: 1,
    accessLevel: SHARE_ACCESS_LEVEL.COMMENT,
    expiresAt: "2026-07-01T00:00:00Z",
    downloadEnabled: true, commentEnabled: true, approvalEnabled: true
  });
  assert(s2.ok, "createShareLink with comment+approval succeeds");

  const g4 = await getShareLinkByToken({ db, token: s2.body.item.token });
  assert(g4.ok, "get second link");
  assertEqual(g4.body.item.downloadEnabled, 1, "download enabled");
  assertEqual(g4.body.item.commentEnabled, 1, "comment enabled");
  assertEqual(g4.body.item.approvalEnabled, 1, "approval enabled");

  sqlite.close();
}

console.log("\nShare links — revoke + expiry");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await db.prepare("INSERT INTO clients (name, phone) VALUES ('Test Client', '+77000000000')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (4, 'package_c', 'package_c', 'offered', 50000)").run();

  const s1 = await createShareLink({
    db, orderId: 4, engagementId: 1,
    expiresAt: "2099-01-01T00:00:00Z"
  });
  const linkId = s1.body.item.id;
  const token = s1.body.item.token;

  const r1 = await revokeShareLink({ db, linkId });
  assert(r1.ok, "revokeShareLink succeeds");

  const g1 = await getShareLinkByToken({ db, token });
  assert(!g1.ok, "revoked link fails");
  assertEqual(g1.status, 403, "returns 403 link_revoked");

  const r2 = await revokeShareLink({ db, linkId });
  assert(!r2.ok, "double revoke fails");
  assertEqual(r2.status, 409, "returns 409");

  const s2 = await createShareLink({
    db, orderId: 4, engagementId: 1,
    expiresAt: "2020-01-01T00:00:00Z"
  });
  const g2 = await getShareLinkByToken({ db, token: s2.body.item.token });
  assert(!g2.ok, "expired link fails");
  assertEqual(g2.status, 403, "returns 403 link_expired");

  sqlite.close();
}

console.log("\nShare links — addShareComment + listShareComments");

{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await db.prepare("INSERT INTO clients (name, phone) VALUES ('Test Client', '+77000000000')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (1, 'new', 'rough_quote')").run();
  await db.prepare("INSERT INTO order_package_engagements (order_id, package_code, engagement_level, status, price_kzt) VALUES (5, 'package_c', 'package_c', 'offered', 50000)").run();

  const s1 = await createShareLink({
    db, orderId: 5, engagementId: 1,
    expiresAt: "2099-01-01T00:00:00Z",
    commentEnabled: true
  });
  const linkId = s1.body.item.id;

  const c1 = await addShareComment({ db, linkId, authorName: "Дизайнер", body: "Всё выглядит отлично!" });
  assert(c1.ok, "addShareComment succeeds");
  assertEqual(c1.status, 201, "returns 201");

  const c2 = await addShareComment({ db, linkId, authorName: "Клиент", body: "Можно другой цвет?" });
  assert(c2.ok, "second comment succeeds");

  const list = await listShareComments({ db, linkId });
  assertEqual(list.body.items.length, 2, "lists 2 comments");
  assertEqual(list.body.items[0].authorName, "Дизайнер", "first comment author");
  assertEqual(list.body.items[1].authorName, "Клиент", "second comment author");

  const s2 = await createShareLink({
    db, orderId: 5, engagementId: 1,
    expiresAt: "2099-01-01T00:00:00Z",
    commentEnabled: false
  });
  const c3 = await addShareComment({ db, linkId: s2.body.item.id, authorName: "Test", body: "fail" });
  assert(!c3.ok, "comment on disabled link fails");
  assertEqual(c3.status, 403, "returns 403 comments_disabled");

  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

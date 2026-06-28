import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  PACKAGE_CODES,
  ENGAGEMENT_LEVELS,
  ENGAGEMENT_STATUS,
  VISUAL_STATE,
  PROPOSAL_DEPTH,
  getPackageDefinition,
  listPackageDefinitions,
  buildEngagementDefaults,
  isValidPackageCode,
  isValidEngagementLevel,
  isValidEngagementStatus,
  normalizeCatalogRow
} from "../src/packages/package-catalog.js";
import {
  CREDIT_POLICY,
  resolveCreditPolicy,
  computeCreditAmount,
  applyCreditToOrder,
  describeCreditImpact
} from "../src/packages/credit-on-order.js";
import {
  canTransition,
  createEngagement,
  transitionEngagement,
  incrementRevisionRound,
  listCatalog,
  listOrderEngagements,
  getEngagement
} from "../src/packages/package-store.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  \u2713 ${message}`); }
  else { failed += 1; console.log(`  \u2717 ${message}`); }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function createD1Adapter(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...values) { return this; },
        async first() {
          const row = stmt.get(...collectBinds(sql, this));
          return row ? normalizeRow(row) : null;
        },
        async all() {
          const rows = stmt.all(...collectBinds(sql, this));
          return { results: rows.map(normalizeRow) };
        },
        async run() {
          const result = stmt.run(...collectBinds(sql, this));
          return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
        },
        _binds: []
      };
    },
    async batch(statements) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    }
  };
}

const bindState = new WeakMap();

function collectBinds(sql, statement) {
  return bindState.get(statement) || [];
}

const originalBind = function () { return this; };

function makeD1(sqliteDb) {
  const adapter = {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      const ctx = { binds: [] };
      const proxy = {
        bind(...values) { ctx.binds = values; return proxy; },
        async first() { return normalizeRow(stmt.get(...ctx.binds)); },
        async all() { return { results: stmt.all(...ctx.binds).map(normalizeRow) }; },
        async run() {
          const r = stmt.run(...ctx.binds);
          return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
        }
      };
      return proxy;
    },
    async batch(statements) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    }
  };
  return adapter;
}

function normalizeRow(row) {
  if (!row) return null;
  const result = {};
  for (const key of Object.keys(row)) {
    result[key] = row[key];
  }
  return result;
}

function loadMigrationSql() {
  return readFileSync(new URL("../migrations/0001_packages.sql", import.meta.url), "utf8");
}

console.log("Package catalog smoke");
{
  const definitions = listPackageDefinitions();
  assertEqual(definitions.length, 3, "catalog has 3 packages");

  const level1 = getPackageDefinition(PACKAGE_CODES.LEVEL_1);
  assertEqual(level1.priceKzt, 0, "level_1 is free");
  assertEqual(level1.creditedOnOrder, false, "level_1 does not credit on order");

  const packageA = getPackageDefinition(PACKAGE_CODES.PACKAGE_A);
  assertEqual(packageA.priceKzt, 10000, "package_a costs 10000");
  assertEqual(packageA.creditedOnOrder, true, "package_a credits on order");
  assertEqual(packageA.maxRevisions, 0, "package_a has 0 revisions");

  const packageB = getPackageDefinition(PACKAGE_CODES.PACKAGE_B);
  assertEqual(packageB.priceKzt, 20000, "package_b costs 20000");
  assertEqual(packageB.maxRevisions, 1, "package_b has 1 revision");

  assert(isValidPackageCode("package_a"), "package_a is valid code");
  assert(!isValidPackageCode("package_x"), "package_x is invalid code");
  assert(isValidEngagementLevel(ENGAGEMENT_LEVELS.PRODUCTION_ORDER), "production_order is valid level");
  assert(isValidEngagementStatus(ENGAGEMENT_STATUS.PAID), "paid is valid status");

  const defaults = buildEngagementDefaults(PACKAGE_CODES.PACKAGE_B);
  assertEqual(defaults.engagementLevel, ENGAGEMENT_LEVELS.PACKAGE_B, "package_b defaults to package_b level");
  assertEqual(defaults.proposalDepth, PROPOSAL_DEPTH.DETAILED, "package_b proposal depth is detailed");

  const row = normalizeCatalogRow({ id: 1, code: "level_1", name: "test", price_kzt: 0, credited_on_order: 0, deliverables_json: '["a"]', sort_order: 1, is_active: 1 });
  assertEqual(row.priceKzt, 0, "normalizeCatalogRow maps price_kzt");
  assertEqual(row.creditedOnOrder, false, "normalizeCatalogRow maps credited_on_order");
  assertEqual(row.deliverables[0], "a", "normalizeCatalogRow parses deliverables_json");
}

console.log("Credit-on-order smoke");
{
  const packageA = getPackageDefinition(PACKAGE_CODES.PACKAGE_A);
  assertEqual(resolveCreditPolicy(packageA), CREDIT_POLICY.FULL_CREDIT, "package_a resolves to full_credit");
  assertEqual(resolveCreditPolicy(getPackageDefinition(PACKAGE_CODES.LEVEL_1)), CREDIT_POLICY.NO_CREDIT, "level_1 resolves to no_credit");

  assertEqual(computeCreditAmount({ packagePriceKzt: 10000, orderTotalKzt: 500000, policy: CREDIT_POLICY.FULL_CREDIT }), 10000, "full credit 10000 on 500000 order");
  assertEqual(computeCreditAmount({ packagePriceKzt: 10000, orderTotalKzt: 5000, policy: CREDIT_POLICY.FULL_CREDIT }), 5000, "credit capped at order total");
  assertEqual(computeCreditAmount({ packagePriceKzt: 10000, orderTotalKzt: 500000, policy: CREDIT_POLICY.NO_CREDIT }), 0, "no_credit returns 0");

  const engagement = { creditedOnOrder: true, status: ENGAGEMENT_STATUS.DELIVERED, priceKzt: 20000 };
  const impact = applyCreditToOrder({ engagement, orderTotalKzt: 400000 });
  assertEqual(impact.creditedAmountKzt, 20000, "delivered package_b credits 20000");
  assertEqual(impact.remainingOrderTotalKzt, 380000, "remaining order total 380000");
  assert(impact.eligible, "eligible is true");

  const notDelivered = applyCreditToOrder({ engagement: { creditedOnOrder: true, status: ENGAGEMENT_STATUS.OFFERED, priceKzt: 10000 }, orderTotalKzt: 400000 });
  assert(!notDelivered.eligible, "offered engagement is not eligible for credit");

  const desc = describeCreditImpact({ engagement, orderTotalKzt: 400000 });
  assert(desc.replace(/\u00a0/g, " ").includes("20 000"), "credit description mentions 20 000");
}

console.log("Status transition smoke");
{
  assert(canTransition(ENGAGEMENT_STATUS.OFFERED, ENGAGEMENT_STATUS.ACCEPTED), "offered -> accepted");
  assert(canTransition(ENGAGEMENT_STATUS.ACCEPTED, ENGAGEMENT_STATUS.PAID), "accepted -> paid");
  assert(canTransition(ENGAGEMENT_STATUS.PAID, ENGAGEMENT_STATUS.IN_PROGRESS), "paid -> in_progress");
  assert(canTransition(ENGAGEMENT_STATUS.IN_PROGRESS, ENGAGEMENT_STATUS.DELIVERED), "in_progress -> delivered");
  assert(canTransition(ENGAGEMENT_STATUS.DELIVERED, ENGAGEMENT_STATUS.CREDITED), "delivered -> credited");
  assert(!canTransition(ENGAGEMENT_STATUS.OFFERED, ENGAGEMENT_STATUS.DELIVERED), "offered -> delivered is blocked");
  assert(!canTransition(ENGAGEMENT_STATUS.CREDITED, ENGAGEMENT_STATUS.OFFERED), "credited is terminal");
}

console.log("D1 store smoke (real SQLite via node:sqlite)");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const catalogResult = await listCatalog({ db });
  assert(catalogResult.ok, "listCatalog succeeds");
  assertEqual(catalogResult.body.items.length, 3, "catalog has 3 items from DB");

  const clientInsert = await db.prepare("INSERT INTO clients (name, phone) VALUES (?, ?)").bind("Тест Клиент", "+7 700 000 00 00").run();
  const clientId = clientInsert.meta.last_row_id;
  const orderInsert = await db.prepare("INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')").bind(clientId).run();
  const orderId = orderInsert.meta.last_row_id;

  const createResult = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_A, sourceMaterialType: "manual" });
  assert(createResult.ok, "createEngagement package_a succeeds");
  assertEqual(createResult.status, 201, "createEngagement returns 201");
  assertEqual(createResult.body.item.status, ENGAGEMENT_STATUS.OFFERED, "new engagement is offered");
  assertEqual(createResult.body.item.priceKzt, 10000, "engagement price 10000");

  const engagementId = createResult.body.item.id;

  const listResult = await listOrderEngagements({ db, orderId });
  assert(listResult.ok, "listOrderEngagements succeeds");
  assertEqual(listResult.body.items.length, 1, "order has 1 engagement");

  const acceptResult = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.ACCEPTED });
  assert(acceptResult.ok, "transition to accepted succeeds");
  assertEqual(acceptResult.body.item.status, ENGAGEMENT_STATUS.ACCEPTED, "status is accepted");
  assert(!!acceptResult.body.item.acceptedAt, "acceptedAt is set");

  const payResult = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.PAID });
  assert(payResult.ok, "transition to paid succeeds");

  const badTransition = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.DELIVERED });
  assert(!badTransition.ok, "paid -> delivered is blocked (must go through in_progress)");
  assertEqual(badTransition.status, 409, "bad transition returns 409");

  const progressResult = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.IN_PROGRESS, visualState: VISUAL_STATE.BW_PREVIEW });
  assert(progressResult.ok, "transition to in_progress with visual state succeeds");
  assertEqual(progressResult.body.item.visualState, VISUAL_STATE.BW_PREVIEW, "visual state is bw_preview");

  const deliverResult = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.DELIVERED });
  assert(deliverResult.ok, "transition to delivered succeeds");

  const creditResult = await transitionEngagement({ db, engagementId, toStatus: ENGAGEMENT_STATUS.CREDITED });
  assert(creditResult.ok, "transition to credited succeeds");
  assert(!!creditResult.body.item.creditedAt, "creditedAt is set");

  const notFound = await getEngagement({ db, engagementId: 999999 });
  assert(!notFound.ok, "getEngagement 999999 returns not found");
  assertEqual(notFound.status, 404, "not found returns 404");

  sqlite.close();
}

console.log("Revision round smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const clientInsert = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Ревизия Тест").run();
  const orderInsert = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(clientInsert.meta.last_row_id).run();
  const orderId = orderInsert.meta.last_row_id;

  const created = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_B });
  const engagementId = created.body.item.id;

  const rev1 = await incrementRevisionRound({ db, engagementId });
  assert(rev1.ok, "first revision on package_b succeeds");
  assertEqual(rev1.body.item.revisionRound, 1, "revision round is 1");

  const rev2 = await incrementRevisionRound({ db, engagementId });
  assert(!rev2.ok, "second revision on package_b is blocked (max 1)");
  assertEqual(rev2.status, 409, "revision limit returns 409");

  const createdA = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_A });
  const revA = await incrementRevisionRound({ db, engagementId: createdA.body.item.id });
  assert(!revA.ok, "revision on package_a is blocked (max 0)");

  sqlite.close();
}

console.log("Conversion events smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const clientInsert = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Аналитика Тест").run();
  const orderInsert = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(clientInsert.meta.last_row_id).run();
  const orderId = orderInsert.meta.last_row_id;

  await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_A });
  const events = await db.prepare("SELECT event_type AS eventType, from_level AS fromLevel, to_level AS toLevel FROM package_conversion_events WHERE order_id = ? ORDER BY id ASC").bind(orderId).all();
  assertEqual(events.results.length, 1, "one conversion event recorded on create");
  assertEqual(events.results[0].eventType, "package_offered", "event type is package_offered");
  assertEqual(events.results[0].fromLevel, "rough_quote", "from_level is rough_quote");
  assertEqual(events.results[0].toLevel, "package_a", "to_level is package_a");

  sqlite.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

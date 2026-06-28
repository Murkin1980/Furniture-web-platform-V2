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
import {
  MESSAGE_TEMPLATE_CODES,
  listMessageTemplates,
  getTemplatesForUpgrade,
  resolveUpgradeTemplates,
  getMessageTemplate,
  renderTemplate
} from "../src/packages/message-templates.js";
import {
  getConversionFunnel,
  getPackageMetrics,
  recordUpgradeOffer
} from "../src/packages/package-analytics.js";
import {
  createPayment,
  confirmPayment,
  cancelPayment,
  listEngagementPayments,
  getPayment
} from "../src/packages/payment-store.js";
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUS,
  getDeliverableSpec,
  listAllDeliverableSpecs,
  buildDeliverableDefaults,
  isValidDeliverableType,
  isValidDeliverableStatus,
  isValidArtifactFormat,
  describePackageVisualState,
  getPackageDeliverableSummary
} from "../src/packages/visual-standards.js";
import {
  seedEngagementDeliverables,
  listEngagementDeliverables,
  getDeliverable,
  transitionDeliverableStatus,
  attachArtifact,
  requestRevision,
  resolveRevision,
  listDeliverableRevisions,
  getPackageDeliverableState,
  canTransitionDeliverable
} from "../src/packages/deliverable-store.js";
import {
  PDF_MANIFEST_VERSION,
  PDF_PAGE_TYPES,
  PDF_FURNITURE_ZONE_TYPES,
  PDF_DRAFT_STATUS,
  buildProjectPdfManifest,
  validateProjectPdfManifest,
  isSupportedPdfFile,
  generatePdfEstimate,
  mapPdfEstimateToProposalLines,
  collectFurnitureZones,
  extractDimensionsFromManifest,
  normalizePage,
  normalizeRoom,
  normalizeFurnitureZone
} from "../src/pdf/pdf-manifest.js";
import {
  createPdfUpload,
  listOrderPdfUploads,
  getPdfUpload,
  createPdfDraft,
  getPdfDraft,
  listOrderPdfDrafts,
  updatePdfDraftManifest,
  reviewPdfDraft,
  generateAndStoreEstimate,
  getDraftEstimate,
  getDraftDimensions,
  getDraftProposalLines
} from "../src/pdf/pdf-store.js";

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
  const dir = new URL("../migrations/", import.meta.url);
  return [
    readFileSync(new URL("0001_packages.sql", dir), "utf8"),
    readFileSync(new URL("0002_package_payments.sql", dir), "utf8"),
    readFileSync(new URL("0003_deliverables.sql", dir), "utf8"),
    readFileSync(new URL("0004_pdf_intake.sql", dir), "utf8")
  ].join("\n");
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

console.log("Message templates smoke");
{
  const templates = listMessageTemplates();
  assert(templates.length >= 5, "at least 5 templates exist");

  const roughQuoteTemplates = getTemplatesForUpgrade(ENGAGEMENT_LEVELS.ROUGH_QUOTE);
  assert(roughQuoteTemplates.length >= 2, "rough_quote has at least 2 upgrade templates");

  const packageATemplates = getTemplatesForUpgrade(ENGAGEMENT_LEVELS.PACKAGE_A);
  assert(packageATemplates.length >= 2, "package_a has at least 2 upgrade templates (package_b + order)");

  const toB = packageATemplates.find((t) => t.toPackage === PACKAGE_CODES.PACKAGE_B);
  assert(!!toB, "package_a has template to package_b");
  assertEqual(toB.code, MESSAGE_TEMPLATE_CODES.PACKAGE_A_OFFER_PACKAGE_B, "package_a -> package_b template code");

  const toOrder = packageATemplates.find((t) => t.toPackage === null);
  assert(!!toOrder, "package_a has template to order");
  assertEqual(toOrder.code, MESSAGE_TEMPLATE_CODES.PACKAGE_A_OFFER_ORDER, "package_a -> order template code");

  const resolved = resolveUpgradeTemplates(ENGAGEMENT_LEVELS.PACKAGE_B, PACKAGE_CODES.PACKAGE_B);
  assert(resolved.length >= 1, "package_b resolves order templates");
  assertEqual(resolved[0].toPackage, null, "package_b resolved template leads to order");

  const rendered = renderTemplate(toB, { clientName: "Иван", orderId: "42", managerName: "Анна" });
  assert(rendered.body.includes("Здравствуйте, Иван!"), "rendered template includes client name");
  assert(rendered.body.includes("#42"), "rendered template includes order id");
  assert(rendered.body.includes("Анна"), "rendered template includes manager name");

  const notFound = getMessageTemplate("nonexistent");
  assertEqual(notFound, null, "nonexistent template returns null");

  const roughResolve = resolveUpgradeTemplates(ENGAGEMENT_LEVELS.ROUGH_QUOTE, null);
  assert(roughResolve.length >= 2, "rough_quote with no package resolves all rough_quote templates");
}

console.log("Payment store smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const clientInsert = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Платёж Тест").run();
  const orderInsert = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(clientInsert.meta.last_row_id).run();
  const orderId = orderInsert.meta.last_row_id;

  const created = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_A });
  const engagementId = created.body.item.id;

  const invalidAmount = await createPayment({ db, engagementId, amountKzt: 0 });
  assert(!invalidAmount.ok, "payment with 0 amount fails");
  assertEqual(invalidAmount.status, 400, "invalid amount returns 400");

  const payment = await createPayment({ db, engagementId, amountKzt: 10000, method: "kaspi", reference: "KASPI-001" });
  assert(payment.ok, "createPayment succeeds");
  assertEqual(payment.status, 201, "createPayment returns 201");
  assertEqual(payment.body.item.status, "pending", "new payment is pending");
  assertEqual(payment.body.item.amountKzt, 10000, "payment amount 10000");
  assertEqual(payment.body.item.method, "kaspi", "payment method kaspi");

  const paymentId = payment.body.item.id;

  const listResult = await listEngagementPayments({ db, engagementId });
  assert(listResult.ok, "listEngagementPayments succeeds");
  assertEqual(listResult.body.items.length, 1, "engagement has 1 payment");

  const confirmResult = await confirmPayment({ db, paymentId });
  assert(confirmResult.ok, "confirmPayment succeeds");
  assertEqual(confirmResult.body.item.status, "confirmed", "payment is confirmed");
  assert(!!confirmResult.body.item.confirmedAt, "confirmedAt is set");

  const updatedEngagement = await getEngagement({ db, engagementId });
  assertEqual(updatedEngagement.body.item.status, ENGAGEMENT_STATUS.PAID, "engagement auto-transitions to paid after confirm");

  const doubleConfirm = await confirmPayment({ db, paymentId });
  assert(doubleConfirm.ok, "double confirm is idempotent");

  const createdB = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_B });
  const cancelledPayment = await createPayment({ db, engagementId: createdB.body.item.id, amountKzt: 5000 });
  const cancelResult = await cancelPayment({ db, paymentId: cancelledPayment.body.item.id });
  assert(cancelResult.ok, "cancelPayment succeeds");
  assertEqual(cancelResult.body.item.status, "cancelled", "payment is cancelled");

  const notFound = await getPayment({ db, paymentId: 999999 });
  assert(!notFound.ok, "getPayment 999999 returns not found");
  assertEqual(notFound.status, 404, "not found returns 404");

  sqlite.close();
}

console.log("Analytics smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  for (let i = 0; i < 3; i += 1) {
    const ci = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind(`Клиент ${i + 1}`).run();
    const oi = await db.prepare("INSERT INTO orders (client_id, engagement_level) VALUES (?, 'rough_quote')").bind(ci.meta.last_row_id).run();
    await createEngagement({ db, orderId: oi.meta.last_row_id, packageCode: PACKAGE_CODES.PACKAGE_A });
  }

  const funnelResult = await getConversionFunnel({ db });
  assert(funnelResult.ok, "getConversionFunnel succeeds");
  assertEqual(funnelResult.body.funnel.length, 4, "funnel has 4 stages");
  assert(funnelResult.body.funnel[0].count >= 3, "funnel rough_quote count >= 3");
  assert(funnelResult.body.transitions.length >= 3, "at least 3 transitions");

  const metricsResult = await getPackageMetrics({ db });
  assert(metricsResult.ok, "getPackageMetrics succeeds");
  assert((metricsResult.body.totals.totalEngagements || 0) >= 3, "metrics totalEngagements >= 3");
  assert((metricsResult.body.totals.offered || 0) >= 3, "metrics offered >= 3");
  assertEqual(metricsResult.body.byPackage.length, 1, "metrics byPackage has 1 package (package_a)");

  sqlite.close();
}

console.log("Visual standards smoke");
{
  const specs = listAllDeliverableSpecs();
  assertEqual(specs.length, 3, "3 package deliverable specs");

  const level1 = getDeliverableSpec(PACKAGE_CODES.LEVEL_1);
  assertEqual(level1.deliverables.length, 0, "level_1 has 0 deliverables");

  const packageA = getDeliverableSpec(PACKAGE_CODES.PACKAGE_A);
  assertEqual(packageA.deliverables.length, 3, "package_a has 3 deliverables");
  assert(packageA.deliverables.some((d) => d.type === DELIVERABLE_TYPES.BW_PREVIEW_SHEET), "package_a includes bw_preview_sheet");
  assert(packageA.deliverables.some((d) => d.type === DELIVERABLE_TYPES.COMMERCIAL_PROPOSAL), "package_a includes commercial_proposal");

  const packageB = getDeliverableSpec(PACKAGE_CODES.PACKAGE_B);
  assertEqual(packageB.deliverables.length, 6, "package_b has 6 deliverables");
  assert(packageB.deliverables.some((d) => d.type === DELIVERABLE_TYPES.COLOR_VIEW_SET), "package_b includes color_view_set");
  assert(packageB.deliverables.some((d) => d.type === DELIVERABLE_TYPES.LAYOUT_VARIANTS), "package_b includes layout_variants");
  assert(packageB.deliverables.some((d) => d.type === DELIVERABLE_TYPES.INCLUSIONS_SHEET), "package_b includes inclusions_sheet");

  const defaults = buildDeliverableDefaults(PACKAGE_CODES.PACKAGE_B);
  assertEqual(defaults.length, 6, "buildDeliverableDefaults package_b returns 6");
  assertEqual(defaults[0].status, DELIVERABLE_STATUS.PENDING, "default status is pending");

  assert(isValidDeliverableType("bw_preview_sheet"), "bw_preview_sheet is valid type");
  assert(!isValidDeliverableType("unknown_type"), "unknown_type is invalid");
  assert(isValidDeliverableStatus("ready"), "ready is valid status");
  assert(isValidArtifactFormat("png"), "png is valid format");

  const descA = describePackageVisualState(PACKAGE_CODES.PACKAGE_A);
  assert(descA.includes("Package A"), "package_a visual description");
  const summaryB = getPackageDeliverableSummary(PACKAGE_CODES.PACKAGE_B);
  assertEqual(summaryB.total, 6, "package_b summary total 6");

  const notFound = getDeliverableSpec("nonexistent");
  assertEqual(notFound, null, "nonexistent spec returns null");
}

console.log("Deliverable lifecycle smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const ci = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Визуал Тест").run();
  const oi = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(ci.meta.last_row_id).run();
  const orderId = oi.meta.last_row_id;

  const created = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_B });
  const engagementId = created.body.item.id;

  const seedResult = await seedEngagementDeliverables({ db, engagementId });
  assert(seedResult.ok, "seedEngagementDeliverables succeeds");
  assertEqual(seedResult.status, 201, "seed returns 201");
  assertEqual(seedResult.body.seeded, 6, "package_b seeded 6 deliverables");

  const reSeed = await seedEngagementDeliverables({ db, engagementId });
  assert(reSeed.ok, "re-seed succeeds (idempotent)");
  assertEqual(reSeed.body.seeded, 0, "re-seed returns 0 (already seeded)");

  const listResult = await listEngagementDeliverables({ db, engagementId });
  assert(listResult.ok, "listEngagementDeliverables succeeds");
  assertEqual(listResult.body.items.length, 6, "6 deliverables listed");

  const deliverableId = listResult.body.items[0].id;
  assertEqual(listResult.body.items[0].status, DELIVERABLE_STATUS.PENDING, "first deliverable is pending");

  const inProgress = await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.IN_PROGRESS });
  assert(inProgress.ok, "transition to in_progress succeeds");
  assertEqual(inProgress.body.item.status, DELIVERABLE_STATUS.IN_PROGRESS, "status is in_progress");

  const badTransition = await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.DELIVERED });
  assert(!badTransition.ok, "in_progress -> delivered is blocked");
  assertEqual(badTransition.status, 409, "bad transition returns 409");

  const ready = await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.READY });
  assert(ready.ok, "transition to ready succeeds");
  assert(!!ready.body.item.completedAt, "completedAt is set for ready");

  const attachResult = await attachArtifact({
    db, deliverableId,
    artifactUrl: "https://example.com/render/front-view.png",
    artifactFormat: "png",
    metadata: { views: 3, resolution: "1920x1080" }
  });
  assert(attachResult.ok, "attachArtifact succeeds");
  assertEqual(attachResult.body.item.artifactUrl, "https://example.com/render/front-view.png", "artifact url set");
  assertEqual(attachResult.body.item.artifactFormat, "png", "artifact format set");
  assertEqual(attachResult.body.item.metadata.views, 3, "metadata views = 3");

  const delivered = await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.DELIVERED });
  assert(delivered.ok, "transition to delivered succeeds");

  const stateResult = await getPackageDeliverableState({ db, engagementId });
  assert(stateResult.ok, "getPackageDeliverableState succeeds");
  assertEqual(stateResult.body.total, 6, "state total 6");
  assert(stateResult.body.counts.delivered >= 1, "at least 1 delivered");

  const notFoundD = await getDeliverable({ db, deliverableId: 999999 });
  assert(!notFoundD.ok, "getDeliverable 999999 returns not found");

  sqlite.close();
}

console.log("Revision workflow smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const ci = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Ревизия Визуал").run();
  const oi = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(ci.meta.last_row_id).run();
  const orderId = oi.meta.last_row_id;

  const created = await createEngagement({ db, orderId, packageCode: PACKAGE_CODES.PACKAGE_B });
  const engagementId = created.body.item.id;
  await seedEngagementDeliverables({ db, engagementId });

  const listResult = await listEngagementDeliverables({ db, engagementId });
  const deliverableId = listResult.body.items[0].id;

  await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.IN_PROGRESS });
  await transitionDeliverableStatus({ db, deliverableId, toStatus: DELIVERABLE_STATUS.READY });

  const revRequest = await requestRevision({ db, deliverableId, requestNote: "Изменить цвет фасадов" });
  assert(revRequest.ok, "requestRevision succeeds on ready deliverable");
  assertEqual(revRequest.status, 201, "requestRevision returns 201");
  assertEqual(revRequest.body.revisionNumber, 1, "first revision round");

  const updatedDeliverable = await getDeliverable({ db, deliverableId });
  assertEqual(updatedDeliverable.body.item.status, DELIVERABLE_STATUS.REVISION_REQUESTED, "deliverable is revision_requested");

  const revList = await listDeliverableRevisions({ db, deliverableId });
  assert(revList.ok, "listDeliverableRevisions succeeds");
  assertEqual(revList.body.items.length, 1, "1 revision recorded");
  assertEqual(revList.body.items[0].requestNote, "Изменить цвет фасадов", "revision note preserved");

  const resolveResult = await resolveRevision({ db, deliverableId, revisionId: revRequest.body.revisionId, resolution: "Цвет изменён на белый" });
  assert(resolveResult.ok, "resolveRevision succeeds");
  assertEqual(resolveResult.body.item.status, DELIVERABLE_STATUS.IN_PROGRESS, "deliverable back to in_progress after resolve");

  const secondRev = await requestRevision({ db, deliverableId, requestNote: "Вторая правка" });
  assert(!secondRev.ok, "second revision on package_b is blocked (max 1)");
  assertEqual(secondRev.status, 409, "revision limit returns 409");

  const resolveTwice = await resolveRevision({ db, deliverableId, revisionId: revRequest.body.revisionId, resolution: "again" });
  assert(!resolveTwice.ok, "resolving already-resolved revision fails");
  assertEqual(resolveTwice.status, 409, "already resolved returns 409");

  const pendingRevRequest = await requestRevision({ db, deliverableId: listResult.body.items[1].id, requestNote: "test" });
  assert(!pendingRevRequest.ok, "requestRevision on pending deliverable fails");
  assertEqual(pendingRevRequest.status, 409, "non-ready revision returns 409");

  sqlite.close();
}

console.log("Deliverable state transitions smoke");
{
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.PENDING, DELIVERABLE_STATUS.IN_PROGRESS), "pending -> in_progress");
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.IN_PROGRESS, DELIVERABLE_STATUS.READY), "in_progress -> ready");
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.READY, DELIVERABLE_STATUS.DELIVERED), "ready -> delivered");
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.READY, DELIVERABLE_STATUS.REVISION_REQUESTED), "ready -> revision_requested");
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.DELIVERED, DELIVERABLE_STATUS.REVISION_REQUESTED), "delivered -> revision_requested");
  assert(canTransitionDeliverable(DELIVERABLE_STATUS.REVISION_REQUESTED, DELIVERABLE_STATUS.IN_PROGRESS), "revision_requested -> in_progress");
  assert(!canTransitionDeliverable(DELIVERABLE_STATUS.PENDING, DELIVERABLE_STATUS.DELIVERED), "pending -> delivered is blocked");
}

console.log("PDF manifest smoke");
{
  assertEqual(PDF_MANIFEST_VERSION, "project-pdf-manifest/v2", "manifest version is v2");
  assert(PDF_PAGE_TYPES.includes("floor_plan"), "floor_plan is valid page type");
  assert(PDF_FURNITURE_ZONE_TYPES.includes("walk_in_closet"), "walk_in_closet is valid zone type");
  assert(PDF_FURNITURE_ZONE_TYPES.includes("bedroom"), "bedroom is valid zone type (unified V2 enum)");
  assert(PDF_FURNITURE_ZONE_TYPES.includes("kids"), "kids is valid zone type");

  assert(isSupportedPdfFile("plan.pdf", "application/pdf"), "plan.pdf is supported");
  assert(!isSupportedPdfFile("plan.jpg", "image/jpeg"), "plan.jpg is not supported");

  const manifest = buildProjectPdfManifest({
    document: { fileName: "test.pdf", fileSizeBytes: 1024 },
    pageCount: 2,
    pages: [
      { pageNumber: 1, pageType: "floor_plan", confidence: 0.9, furnitureZones: [
        { id: "z1", zoneType: "kitchen", label: "Кухня", dimensions: { widthMm: 3000, heightMm: 2700, depthMm: 600 } }
      ]},
      { pageNumber: 2, pageType: "elevation", confidence: 0.8 }
    ],
    rooms: [
      { id: "r1", label: "Кухня", sourcePages: [1], furnitureZones: [
        { id: "z1", zoneType: "kitchen", label: "Кухня", dimensions: { widthMm: 3000 } }
      ]}
    ]
  });
  assertEqual(manifest.manifestVersion, PDF_MANIFEST_VERSION, "built manifest version");
  assertEqual(manifest.document.fileName, "test.pdf", "manifest fileName");
  assertEqual(manifest.pageCount, 2, "manifest pageCount");
  assertEqual(manifest.pages.length, 2, "manifest has 2 pages");
  assertEqual(manifest.pages[0].pageType, "floor_plan", "page 1 is floor_plan");
  assertEqual(manifest.pages[0].furnitureZones.length, 1, "page 1 has 1 zone");
  assertEqual(manifest.pages[0].furnitureZones[0].zoneType, "kitchen", "zone is kitchen");
  assertEqual(manifest.pages[0].furnitureZones[0].dimensions.widthMm, 3000, "zone width 3000mm");
  assertEqual(manifest.rooms.length, 1, "manifest has 1 room");

  const validation = validateProjectPdfManifest(manifest);
  assert(validation.ok, "valid manifest passes validation");

  const invalidManifest = buildProjectPdfManifest({ document: { fileName: "" }, pageCount: 0 });
  const invalidValidation = validateProjectPdfManifest(invalidManifest);
  assert(!invalidValidation.ok, "manifest without fileName fails validation");

  const zones = collectFurnitureZones(manifest);
  assertEqual(zones.length, 1, "collectFurnitureZones dedupes to 1");

  const dims = extractDimensionsFromManifest(manifest);
  assertEqual(dims.length, 1, "extractDimensions returns 1");
  assertEqual(dims[0].widthMm, 3000, "dimension width 3000");

  const normalizedPage = normalizePage({ pageNumber: 5, pageType: "unknown_type", confidence: 1.5 });
  assertEqual(normalizedPage.pageType, "unknown", "unknown page type normalized");
  assertEqual(normalizedPage.confidence, 1, "confidence clamped to 1");
}

console.log("PDF estimate smoke");
{
  const manifest = buildProjectPdfManifest({
    document: { fileName: "kitchen.pdf" },
    pageCount: 1,
    pages: [{ pageNumber: 1, pageType: "floor_plan", furnitureZones: [
      { id: "z1", zoneType: "kitchen", label: "Кухня 3м", dimensions: { widthMm: 3000 } },
      { id: "z2", zoneType: "wardrobe", label: "Шкаф 2м", dimensions: { widthMm: 2000 } }
    ]}]
  });

  const estimate = generatePdfEstimate(manifest);
  assertEqual(estimate.estimateVersion, "pdf-estimate/v2", "estimate version v2");
  assertEqual(estimate.items.length, 2, "estimate has 2 items");
  assertEqual(estimate.items[0].furnitureType, "kitchen", "first item is kitchen");
  assertEqual(estimate.items[0].units, 3, "kitchen 3000mm = 3 units");
  assert(estimate.totals.subtotal > 0, "subtotal > 0");
  assert(estimate.totals.total > 0, "total > 0");

  const withDiscount = generatePdfEstimate(manifest, { discountPercent: 10 });
  assert(withDiscount.totals.discount > 0, "discount > 0 with 10%");
  assert(withDiscount.totals.total < estimate.totals.total, "total reduced by discount");

  const proposalLines = mapPdfEstimateToProposalLines(estimate);
  assertEqual(proposalLines.items.length, 2, "proposal has 2 lines");
  assert(proposalLines.total > 0, "proposal total > 0");
  assertEqual(proposalLines.items[0].unit, "м.п.", "proposal unit is м.п.");
  assertEqual(proposalLines.items[0].quantity, 3, "kitchen quantity 3");
}

console.log("PDF store smoke (upload → draft → review → estimate)");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const ci = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("PDF Тест").run();
  const oi = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(ci.meta.last_row_id).run();
  const orderId = oi.meta.last_row_id;

  const uploadResult = await createPdfUpload({
    db, orderId, fileName: "kitchen-plan.pdf", fileSizeBytes: 2048576,
    mimeType: "application/pdf", pageCount: 3, checksum: "abc123"
  });
  assert(uploadResult.ok, "createPdfUpload succeeds");
  assertEqual(uploadResult.status, 201, "upload returns 201");
  assertEqual(uploadResult.body.item.fileName, "kitchen-plan.pdf", "upload fileName");
  assertEqual(uploadResult.body.item.pageCount, 3, "upload pageCount 3");
  assertEqual(uploadResult.body.item.status, "uploaded", "upload status uploaded");

  const uploadId = uploadResult.body.item.id;

  const listUploads = await listOrderPdfUploads({ db, orderId });
  assert(listUploads.ok, "listOrderPdfUploads succeeds");
  assertEqual(listUploads.body.items.length, 1, "1 upload listed");

  const badUpload = await createPdfUpload({ db, orderId, fileName: "photo.jpg", mimeType: "image/jpeg" });
  assert(!badUpload.ok, "non-PDF upload fails");
  assertEqual(badUpload.status, 400, "unsupported file returns 400");

  const draftResult = await createPdfDraft({
    db, uploadId, orderId,
    manifest: {
      document: { fileName: "kitchen-plan.pdf" },
      pageCount: 3,
      pages: [
        { pageNumber: 1, pageType: "floor_plan", furnitureZones: [
          { id: "z1", zoneType: "kitchen", label: "Кухня 3.5м", dimensions: { widthMm: 3500, heightMm: 2700, depthMm: 600 } }
        ]},
        { pageNumber: 2, pageType: "elevation" },
        { pageNumber: 3, pageType: "specification" }
      ]
    },
    createdBy: "manager"
  });
  assert(draftResult.ok, "createPdfDraft succeeds");
  assertEqual(draftResult.status, 201, "draft returns 201");
  assertEqual(draftResult.body.item.status, PDF_DRAFT_STATUS.DRAFT, "draft status is draft");
  assertEqual(draftResult.body.item.manifest.pages.length, 3, "draft manifest has 3 pages");

  const draftId = draftResult.body.item.id;

  const listDrafts = await listOrderPdfDrafts({ db, orderId });
  assert(listDrafts.ok, "listOrderPdfDrafts succeeds");
  assertEqual(listDrafts.body.items.length, 1, "1 draft listed");

  const getDraft = await getPdfDraft({ db, draftId });
  assert(getDraft.ok, "getPdfDraft succeeds");
  assertEqual(getDraft.body.item.manifest.pages[0].furnitureZones[0].zoneType, "kitchen", "draft zone type");

  const dimsResult = await getDraftDimensions({ db, draftId });
  assert(dimsResult.ok, "getDraftDimensions succeeds");
  assertEqual(dimsResult.body.dimensionCount, 1, "1 dimension extracted");
  assertEqual(dimsResult.body.dimensions[0].widthMm, 3500, "dimension width 3500");

  const estimateBeforeReview = await generateAndStoreEstimate({ db, draftId });
  assert(!estimateBeforeReview.ok, "estimate before review fails");
  assertEqual(estimateBeforeReview.status, 409, "not reviewed returns 409");

  const updateManifest = await updatePdfDraftManifest({
    db, draftId,
    manifest: draftResult.body.item.manifest,
    aiProvider: "openai", aiModel: "gpt-4", processingTimeMs: 1500, analysisVersion: "test-v1"
  });
  assert(updateManifest.ok, "updatePdfDraftManifest succeeds");
  assertEqual(updateManifest.body.item.status, PDF_DRAFT_STATUS.REVIEWED, "draft is reviewed after update");
  assertEqual(updateManifest.body.item.aiProvider, "openai", "ai provider stored");
  assertEqual(updateManifest.body.item.processingTimeMs, 1500, "processing time stored");

  const estimateResult = await generateAndStoreEstimate({ db, draftId });
  assert(estimateResult.ok, "generateAndStoreEstimate succeeds after review");
  assertEqual(estimateResult.status, 201, "estimate returns 201");
  assert(estimateResult.body.estimate.items.length > 0, "estimate has items");
  assert(estimateResult.body.proposalLines.items.length > 0, "proposal lines generated");
  assert(estimateResult.body.estimate.totals.total > 0, "estimate total > 0");

  const reviewResult = await reviewPdfDraft({
    db, draftId, status: PDF_DRAFT_STATUS.APPROVED, reviewedBy: "manager", reviewNote: "Manifest корректен"
  });
  assert(reviewResult.ok, "reviewPdfDraft approves");
  assertEqual(reviewResult.body.item.status, PDF_DRAFT_STATUS.APPROVED, "draft is approved");
  assert(!!reviewResult.body.item.reviewedAt, "reviewedAt is set");
  assertEqual(reviewResult.body.item.reviewNote, "Manifest корректен", "review note stored");

  const doubleApprove = await reviewPdfDraft({ db, draftId, status: PDF_DRAFT_STATUS.APPROVED });
  assert(!doubleApprove.ok, "double approve fails");
  assertEqual(doubleApprove.status, 409, "already approved returns 409");

  const rejectResult = await reviewPdfDraft({ db, draftId, status: PDF_DRAFT_STATUS.REJECTED });
  assert(!rejectResult.ok, "reject after approve fails");

  const storedEstimate = await getDraftEstimate({ db, draftId });
  assert(storedEstimate.ok, "getDraftEstimate succeeds");
  assertEqual(storedEstimate.body.item.totalKzt, estimateResult.body.estimate.totals.total, "stored estimate total matches");

  const proposalResult = await getDraftProposalLines({ db, draftId });
  assert(proposalResult.ok, "getDraftProposalLines succeeds");
  assert(proposalResult.body.proposalLines.items.length > 0, "proposal lines returned");

  sqlite.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

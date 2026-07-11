import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classifyIntent } from "../src/ai/package-advisor.js";
import {
  PACKAGE_CODES,
  ENGAGEMENT_STATUS,
  VISUAL_STATE,
  PROPOSAL_DEPTH,
  getPackageDefinition
} from "../src/packages/package-catalog.js";
import {
  createEngagement,
  getEngagement,
  transitionEngagement,
  incrementRevisionRound
} from "../src/packages/package-store.js";
import {
  createPayment,
  confirmPayment
} from "../src/packages/payment-store.js";
import {
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUS
} from "../src/packages/visual-standards.js";
import {
  seedEngagementDeliverables,
  listEngagementDeliverables,
  getDeliverable,
  attachArtifact,
  transitionDeliverableStatus,
  requestRevision,
  resolveRevision,
  listDeliverableRevisions,
  getPackageDeliverableState
} from "../src/packages/deliverable-store.js";
import {
  createPdfUpload,
  createPdfDraft,
  updatePdfDraftManifest
} from "../src/pdf/pdf-store.js";
import {
  createSupplier,
  createPriceList,
  addPriceItem,
  publishPriceList,
  generateSupplierAwareEstimate
} from "../src/suppliers/supplier-store.js";
import { applyCreditToOrder } from "../src/packages/credit-on-order.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function assertOk(result, message) {
  assert(result.ok, message);
}

function assertError(result, expectedError, message) {
  assert(!result.ok, message);
  assertEqual(result.body.error, expectedError, `${message} — error code`);
}

function loadMigrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return [
    "0001_packages.sql",
    "0002_package_payments.sql",
    "0003_deliverables.sql",
    "0004_pdf_intake.sql",
    "0005_supplier_pricing.sql"
  ].map((file) => readFileSync(new URL(file, dir), "utf8")).join("\n");
}

function makeD1(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      const context = { binds: [] };
      const proxy = {
        bind(...values) {
          context.binds = values;
          return proxy;
        },
        async first() {
          return stmt.get(...context.binds) || null;
        },
        async all() {
          return { results: stmt.all(...context.binds) };
        },
        async run() {
          const result = stmt.run(...context.binds);
          return {
            meta: {
              changes: result.changes,
              last_row_id: result.lastInsertRowid
            }
          };
        }
      };
      return proxy;
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    }
  };
}

console.log("Phase 4.2 — Package B end-to-end commercial proof");

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(loadMigrationSql());
const db = makeD1(sqlite);

try {
  console.log("\n1. Advisor classifies intent as Package B");
  const intent = classifyIntent("Нужен цветной визуал кухни с размерами и вариантами компоновки");
  assertEqual(intent.packageCode, PACKAGE_CODES.PACKAGE_B, "advisor recommends Package B");
  assert(intent.matchedKeywords.length > 0, "advisor matched at least one keyword");

  console.log("\n2. Package B definition assertions");
  const definition = getPackageDefinition(PACKAGE_CODES.PACKAGE_B);
  assert(definition !== null, "Package B definition exists");
  assertEqual(definition.priceKzt, 20000, "Package B price is 20,000 KZT");
  assertEqual(definition.creditedOnOrder, true, "Package B is credited on order");
  assertEqual(definition.isSellable, true, "Package B is sellable");
  assertEqual(definition.readiness, "active", "Package B readiness is active");
  assertEqual(definition.maxRevisions, 1, "Package B allows 1 revision");
  assertEqual(definition.visualState, VISUAL_STATE.COLOR_MULTI_VIEW, "Package B visual state is color_multi_view");
  assertEqual(definition.proposalDepth, PROPOSAL_DEPTH.DETAILED, "Package B proposal depth is detailed");

  console.log("\n3. Client and order setup");
  const clientInsert = await db.prepare(
    "INSERT INTO clients (name, phone) VALUES (?, ?)"
  ).bind("Phase 4.2 Test Client", "+77000000002").run();
  const clientId = clientInsert.meta.last_row_id;

  const orderInsert = await db.prepare(
    "INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')"
  ).bind(clientId).run();
  const orderId = orderInsert.meta.last_row_id;
  assert(Number(orderId) > 0, "test order created");

  console.log("\n4. Engagement creation and acceptance");
  const engagementResult = await createEngagement({
    db,
    orderId,
    packageCode: PACKAGE_CODES.PACKAGE_B,
    sourceMaterialType: "manual"
  });
  assertOk(engagementResult, "Package B engagement created");
  assertEqual(engagementResult.body.item.priceKzt, 20000, "engagement price is 20,000 KZT");
  assertEqual(engagementResult.body.item.packageCode, PACKAGE_CODES.PACKAGE_B, "engagement package is package_b");
  assertEqual(engagementResult.body.item.status, ENGAGEMENT_STATUS.OFFERED, "engagement starts as offered");
  const engagementId = engagementResult.body.item.id;

  const accepted = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.ACCEPTED
  });
  assertOk(accepted, "manager accepts engagement");
  assertEqual(accepted.body.item.status, ENGAGEMENT_STATUS.ACCEPTED, "engagement is now accepted");

  console.log("\n5. Payment flow — 60,000 KZT order total");
  const payment = await createPayment({
    db,
    engagementId,
    amountKzt: 60000,
    method: "kaspi",
    reference: "PHASE42-B-001"
  });
  assertOk(payment, "payment recorded");

  const confirmed = await confirmPayment({ db, paymentId: payment.body.item.id });
  assertOk(confirmed, "payment confirmed");
  const paidEngagement = await getEngagement({ db, engagementId });
  assertEqual(paidEngagement.body.item.status, ENGAGEMENT_STATUS.PAID, "engagement becomes paid after payment confirmation");

  console.log("\n6. Deliverable seeding — 6 deliverables");
  const seeded = await seedEngagementDeliverables({ db, engagementId });
  assertOk(seeded, "deliverables seeded");
  assertEqual(seeded.body.seeded, 6, "Package B has 6 deliverables");
  const seededTypes = seeded.body.items.map((d) => d.deliverableType).sort();
  const expectedTypes = [
    DELIVERABLE_TYPES.COLOR_VIEW_SET,
    DELIVERABLE_TYPES.COMMERCIAL_PROPOSAL,
    DELIVERABLE_TYPES.DIMENSIONS_SHEET,
    DELIVERABLE_TYPES.LAYOUT_VARIANTS,
    DELIVERABLE_TYPES.INCLUSIONS_SHEET,
    DELIVERABLE_TYPES.RECOMMENDED_MATERIALS
  ].sort();
  assertEqual(seededTypes.join(","), expectedTypes.join(","), "seeded types match Package B spec");

  const inProgress = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.IN_PROGRESS,
    visualState: VISUAL_STATE.COLOR_MULTI_VIEW
  });
  assertOk(inProgress, "engagement moves to in_progress with color_multi_view visual state");

  console.log("\n7. Premature handoff rejection");
  const prematureHandoff = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.DELIVERED
  });
  assertError(prematureHandoff, "deliverables_not_approved", "client handoff is blocked before deliverables are approved");

  const allDeliverables = await listEngagementDeliverables({ db, engagementId });
  assertEqual(allDeliverables.body.items.length, 6, "all 6 deliverables are listed");
  const byType = {};
  for (const d of allDeliverables.body.items) byType[d.deliverableType] = d;

  console.log("\n8. color_view_set artifact");
  const colorView = byType[DELIVERABLE_TYPES.COLOR_VIEW_SET];
  assert(colorView, "color_view_set deliverable exists");
  const cvArtifact = await attachArtifact({
    db,
    deliverableId: colorView.id,
    artifactUrl: "https://example.test/package-b/color-view-set.pdf",
    artifactFormat: "pdf",
    metadata: { views: ["front", "side", "top"], reviewedBy: "manager" }
  });
  assertOk(cvArtifact, "color_view_set artifact attached");
  assertEqual(cvArtifact.body.item.artifactFormat, "pdf", "color_view_set artifact format is pdf");

  const cvReady = await transitionDeliverableStatus({
    db, deliverableId: colorView.id, toStatus: DELIVERABLE_STATUS.READY, createdBy: "manager"
  });
  assertOk(cvReady, "color_view_set marked ready");

  console.log("\n9. dimensions_sheet artifact");
  const dimsSheet = byType[DELIVERABLE_TYPES.DIMENSIONS_SHEET];
  assert(dimsSheet, "dimensions_sheet deliverable exists");
  const dsArtifact = await attachArtifact({
    db,
    deliverableId: dimsSheet.id,
    artifactUrl: "https://example.test/package-b/dimensions-sheet.pdf",
    artifactFormat: "pdf",
    metadata: { reviewedBy: "manager" }
  });
  assertOk(dsArtifact, "dimensions_sheet artifact attached");

  const dsReady = await transitionDeliverableStatus({
    db, deliverableId: dimsSheet.id, toStatus: DELIVERABLE_STATUS.READY, createdBy: "manager"
  });
  assertOk(dsReady, "dimensions_sheet marked ready");

  console.log("\n10. inclusions_sheet artifact");
  const incSheet = byType[DELIVERABLE_TYPES.INCLUSIONS_SHEET];
  assert(incSheet, "inclusions_sheet deliverable exists");
  const isArtifact = await attachArtifact({
    db,
    deliverableId: incSheet.id,
    artifactUrl: "https://example.test/package-b/inclusions-sheet.pdf",
    artifactFormat: "pdf",
    metadata: { reviewedBy: "manager" }
  });
  assertOk(isArtifact, "inclusions_sheet artifact attached");

  const isReady = await transitionDeliverableStatus({
    db, deliverableId: incSheet.id, toStatus: DELIVERABLE_STATUS.READY, createdBy: "manager"
  });
  assertOk(isReady, "inclusions_sheet marked ready");

  console.log("\n11. Remaining deliverable artifacts");
  for (const type of [DELIVERABLE_TYPES.COMMERCIAL_PROPOSAL, DELIVERABLE_TYPES.LAYOUT_VARIANTS, DELIVERABLE_TYPES.RECOMMENDED_MATERIALS]) {
    const d = byType[type];
    assert(d, `${type} deliverable exists`);
    const art = await attachArtifact({
      db,
      deliverableId: d.id,
      artifactUrl: `https://example.test/package-b/${type}.pdf`,
      artifactFormat: "pdf",
      metadata: { reviewedBy: "manager" }
    });
    assertOk(art, `${type} artifact attached`);
    const ready = await transitionDeliverableStatus({
      db, deliverableId: d.id, toStatus: DELIVERABLE_STATUS.READY, createdBy: "manager"
    });
    assertOk(ready, `${type} marked ready`);
    const delivered = await transitionDeliverableStatus({
      db, deliverableId: d.id, toStatus: DELIVERABLE_STATUS.DELIVERED, createdBy: "manager"
    });
    assertOk(delivered, `${type} delivered to client`);
  }

  for (const type of [DELIVERABLE_TYPES.COLOR_VIEW_SET, DELIVERABLE_TYPES.DIMENSIONS_SHEET, DELIVERABLE_TYPES.INCLUSIONS_SHEET]) {
    const d = byType[type];
    const deliv = await transitionDeliverableStatus({
      db, deliverableId: d.id, toStatus: DELIVERABLE_STATUS.DELIVERED, createdBy: "manager"
    });
    assertOk(deliv, `${type} delivered to client`);
  }

  const stateAfterDeliver = await getPackageDeliverableState({ db, engagementId });
  assert(stateAfterDeliver.body.allDelivered, "all 6 deliverables are delivered before revision test");

  console.log("\n12. First revision succeeds (revision round 0 → 1)");
  const revisionColorView = await requestRevision({
    db,
    deliverableId: colorView.id,
    requestNote: "Add a perspective view from the window side",
    requestedBy: "manager"
  });
  assertOk(revisionColorView, "first revision request succeeds");
  assertEqual(revisionColorView.body.engagementRevisionRound, 1, "engagement revision round is now 1");
  assertEqual(revisionColorView.body.revisionNumber, 1, "revision number is 1");

  console.log("\n13. Revised state recorded correctly");
  const revisedEngagement = await getEngagement({ db, engagementId });
  assertEqual(revisedEngagement.body.item.revisionRound, 1, "engagement revision_round = 1");
  assertEqual(revisedEngagement.body.item.maxRevisions, 1, "engagement max_revisions = 1");

  const cvAfterRevision = await getDeliverable({ db, deliverableId: colorView.id });
  assertEqual(cvAfterRevision.body.item.status, DELIVERABLE_STATUS.REVISION_REQUESTED, "color_view_set is now revision_requested");

  const revisionState = await getPackageDeliverableState({ db, engagementId });
  assertEqual(revisionState.body.packageState, "revision_in_progress", "package state is revision_in_progress");

  console.log("\n14. Second revision fails — revision_limit_reached");
  const secondRevision = await requestRevision({
    db,
    deliverableId: dimsSheet.id,
    requestNote: "Add more detail to dimensions",
    requestedBy: "manager"
  });
  assertError(secondRevision, "revision_limit_reached", "second revision is blocked at revision_limit_reached");

  console.log("\n15. Manager gate rejects handoff after revision");
  const revisedHandoff = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.DELIVERED
  });
  assertError(revisedHandoff, "deliverables_not_approved", "handoff blocked after revision (not all deliverables delivered)");

  console.log("\n16. Resolve revision and restore deliverable flow");
  const cvRevisions = await listDeliverableRevisions({ db, deliverableId: colorView.id });
  assert(cvRevisions.ok && cvRevisions.body.items.length > 0, "revision record exists");
  const revisionId = cvRevisions.body.items[0].id;

  const resolved = await resolveRevision({
    db,
    deliverableId: colorView.id,
    revisionId,
    resolution: "Added perspective view as requested"
  });
  assertOk(resolved, "revision resolved");
  assertEqual(resolved.body.item.status, DELIVERABLE_STATUS.IN_PROGRESS, "color_view_set back to in_progress after revision resolve");

  const cvReadyAgain = await transitionDeliverableStatus({
    db, deliverableId: colorView.id, toStatus: DELIVERABLE_STATUS.READY, createdBy: "manager"
  });
  assertOk(cvReadyAgain, "color_view_set marked ready again after revision");

  const cvDeliveredAgain = await transitionDeliverableStatus({
    db, deliverableId: colorView.id, toStatus: DELIVERABLE_STATUS.DELIVERED, createdBy: "manager"
  });
  assertOk(cvDeliveredAgain, "color_view_set delivered again after revision");

  const stateAfterResolve = await getPackageDeliverableState({ db, engagementId });
  assert(stateAfterResolve.body.allDelivered, "all deliverables delivered after revision resolution");

  console.log("\n17. PDF upload and draft");
  const upload = await createPdfUpload({
    db,
    orderId,
    fileName: "phase42-kitchen.pdf",
    fileSizeBytes: 2048,
    mimeType: "application/pdf",
    pageCount: 3,
    checksum: "phase42-b"
  });
  assertOk(upload, "source PDF registered");

  const manifest = {
    document: { fileName: "phase42-kitchen.pdf" },
    pageCount: 3,
    pages: [
      { pageNumber: 1, pageType: "floor_plan", furnitureZones: [{ id: "kitchen-1", zoneType: "kitchen", label: "Кухня 4 м", dimensions: { widthMm: 4000, heightMm: 2700, depthMm: 600 } }] },
      { pageNumber: 2, pageType: "elevation", furnitureZones: [{ id: "kitchen-elev-1", zoneType: "kitchen", label: "Фасад кухни" }] },
      { pageNumber: 3, pageType: "3d_view", furnitureZones: [{ id: "kitchen-3d-1", zoneType: "kitchen", label: "3D вид кухни" }] }
    ]
  };

  const draft = await createPdfDraft({
    db,
    uploadId: upload.body.item.id,
    orderId,
    manifest,
    createdBy: "manager"
  });
  assertOk(draft, "PDF draft created");

  const reviewed = await updatePdfDraftManifest({
    db,
    draftId: draft.body.item.id,
    manifest,
    analysisVersion: "manual-phase42"
  });
  assertOk(reviewed, "PDF draft reviewed by manager");

  console.log("\n18. Published supplier price list");
  const supplier = await createSupplier({
    db,
    code: "PHASE42-SUP",
    name: "Phase 4.2 Supplier"
  });
  assertOk(supplier, "supplier created");

  const priceList = await createPriceList({
    db,
    supplierId: supplier.body.item.id,
    note: "Phase 4.2 published price list"
  });
  assertOk(priceList, "supplier price list created");

  const priceItem = await addPriceItem({
    db,
    priceListId: priceList.body.item.id,
    supplierId: supplier.body.item.id,
    furnitureType: "kitchen",
    material: "standard",
    label: "Кухня стандарт",
    basePriceKzt: 20000,
    unitPriceKzt: 80000
  });
  assertOk(priceItem, "supplier kitchen price added");

  const published = await publishPriceList({
    db,
    priceListId: priceList.body.item.id,
    effectiveFrom: "2026-07-11"
  });
  assertOk(published, "supplier price list published");

  console.log("\n19. Supplier-aware estimate");
  const estimate = await generateSupplierAwareEstimate({
    db,
    draftId: draft.body.item.id,
    supplierId: supplier.body.item.id,
    material: "standard"
  });
  assertOk(estimate, "supplier-aware estimate generated");
  assertEqual(estimate.body.estimate.source.priceListId, priceList.body.item.id, "estimate references published price-list version");
  assert(estimate.body.estimate.totals.total > 0, "supplier-aware estimate has positive total");

  console.log("\n20. Client handoff — all deliverables approved");
  const handedOff = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.DELIVERED
  });
  assertOk(handedOff, "client handoff succeeds after all deliverables approved");
  assertEqual(handedOff.body.item.status, ENGAGEMENT_STATUS.DELIVERED, "engagement status is delivered");

  console.log("\n21. Credit-on-order — 20,000 KZT");
  const creditPreview = applyCreditToOrder({
    engagement: handedOff.body.item,
    orderTotalKzt: estimate.body.estimate.totals.total
  });
  assert(creditPreview.eligible, "Package B is eligible for credit-on-order");
  assertEqual(creditPreview.creditedAmountKzt, 20000, "credit amount is exactly 20,000 KZT");

  const credited = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.CREDITED
  });
  assertOk(credited, "credit-on-order applied");
  assertEqual(credited.body.item.creditedAmountKzt, 20000, "persisted credit amount is 20,000 KZT");

  console.log("\n22. Duplicate credit is idempotent");
  const duplicateCredit = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.CREDITED
  });
  assertError(duplicateCredit, "invalid_status_transition", "second credit attempt is blocked");

  const creditEvents = await db.prepare(
    "SELECT COUNT(*) AS count FROM package_conversion_events WHERE engagement_id = ? AND event_type = 'status_credited'"
  ).bind(engagementId).first();
  assertEqual(Number(creditEvents.count), 1, "exactly one credited conversion event exists");

  console.log("\n23. Final database assertions");
  const finalEngagement = await getEngagement({ db, engagementId });
  assertEqual(finalEngagement.body.item.status, ENGAGEMENT_STATUS.CREDITED, "final status is credited");
  assertEqual(finalEngagement.body.item.creditedAmountKzt, 20000, "final credited amount is 20,000 KZT");
  assertEqual(finalEngagement.body.item.priceKzt, 20000, "final price is 20,000 KZT");
  assertEqual(finalEngagement.body.item.packageCode, PACKAGE_CODES.PACKAGE_B, "final package is package_b");
  assertEqual(finalEngagement.body.item.revisionRound, 1, "final revision round is 1");
  assertEqual(finalEngagement.body.item.maxRevisions, 1, "final max revisions is 1");
  assertEqual(finalEngagement.body.item.visualState, VISUAL_STATE.COLOR_MULTI_VIEW, "visual state is color_multi_view");

  const finalDeliverables = await listEngagementDeliverables({ db, engagementId });
  assertEqual(finalDeliverables.body.items.length, 6, "all 6 deliverables still present");
  for (const d of finalDeliverables.body.items) {
    assertEqual(d.status, DELIVERABLE_STATUS.DELIVERED, `${d.deliverableType} remains delivered`);
  }

  const events = await db.prepare(
    "SELECT event_type FROM package_conversion_events WHERE engagement_id = ? ORDER BY id ASC"
  ).bind(engagementId).all();
  const eventTypes = (events?.results || []).map((e) => e.event_type);
  assert(eventTypes.includes("package_offered"), "conversion events include package_offered");
  assert(eventTypes.includes("status_delivered"), "conversion events include status_delivered");
  assert(eventTypes.includes("status_credited"), "conversion events include status_credited");

  console.log("\n24. Package C is not sellable");
  const cClient = await db.prepare(
    "INSERT INTO clients (name, phone) VALUES (?, ?)"
  ).bind("Package C Test Client", "+77000000003").run();
  const cOrder = await db.prepare(
    "INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')"
  ).bind(cClient.meta.last_row_id).run();

  const cEngagement = await createEngagement({
    db,
    orderId: cOrder.meta.last_row_id,
    packageCode: PACKAGE_CODES.PACKAGE_C,
    sourceMaterialType: "manual"
  });
  assertError(cEngagement, "package_not_sellable", "Package C engagement creation returns 409 package_not_sellable");
} finally {
  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

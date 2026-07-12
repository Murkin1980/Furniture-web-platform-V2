import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classifyIntent } from "../src/ai/package-advisor.js";
import {
  PACKAGE_CODES,
  ENGAGEMENT_STATUS,
  VISUAL_STATE,
  getPackageDefinition
} from "../src/packages/package-catalog.js";
import {
  createEngagement,
  getEngagement,
  transitionEngagement
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
const caseResults = [];

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
    "0005_supplier_pricing.sql",
    "0006_ai_observability.sql",
    "0007_whatsapp.sql",
    "0008_package_c_and_share_links.sql"
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

function buildManifest(caseId, zoneType, zoneLabel, dimensions) {
  return {
    document: { fileName: `${caseId}.pdf` },
    pageCount: 2,
    pages: [
      {
        pageNumber: 1,
        pageType: "floor_plan",
        furnitureZones: [{
          id: `${caseId}-z1`,
          zoneType,
          label: zoneLabel,
          dimensions
        }]
      },
      {
        pageNumber: 2,
        pageType: "elevation",
        furnitureZones: [{
          id: `${caseId}-z2`,
          zoneType,
          label: `${zoneLabel} фасад`
        }]
      }
    ]
  };
}

async function runCase(db, {
  caseNum,
  caseId,
  requestText,
  clientName,
  phone,
  expectedPackage,
  expectedPrice,
  expectedDeliverableCount,
  revisionRounds,
  furnitureType,
  zoneType,
  zoneLabel,
  zoneDimensions,
  initialLevelRequest,
  initialLevelExpected
}) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Case ${caseNum}: ${caseId}`);
  console.log(`${"=".repeat(60)}`);

  const result = {
    caseId,
    requestText,
    initialLevel: initialLevelExpected || expectedPackage,
    finalPackage: expectedPackage,
    furnitureType,
    engagementPrice: 0,
    paymentAmount: 0,
    paymentStatus: "",
    deliverableCount: 0,
    requiredArtifacts: [],
    managerApprovalResult: null,
    revisionCount: 0,
    supplierId: null,
    publishedPriceListId: null,
    estimateTotal: 0,
    clientHandoffResult: null,
    orderConversionResult: null,
    creditAmount: 0,
    duplicateCreditResult: null,
    finalEngagementStatus: "",
    eventCounts: { conversionEvents: 0 },
    manualSteps: [],
    result: "PASS"
  };

  const failedBefore = failed;

  try {
    console.log(`\n  1. Advisor classification`);
    const advisorResult = classifyIntent(requestText);
    assertEqual(advisorResult.packageCode, expectedPackage, `advisor recommends ${expectedPackage}`);
    assert(advisorResult.matchedKeywords.length > 0, "advisor matched at least one keyword");

    if (initialLevelRequest) {
      const initialAdvisor = classifyIntent(initialLevelRequest);
      assertEqual(initialAdvisor.packageCode, initialLevelExpected, `initial advisor recommends ${initialLevelExpected}`);
      result.initialLevel = initialLevelExpected;
    }

    const definition = getPackageDefinition(expectedPackage);
    assert(definition !== null, `${expectedPackage} definition exists`);
    assertEqual(definition.priceKzt, expectedPrice, `${expectedPackage} price is ${expectedPrice} KZT`);
    assertEqual(definition.creditedOnOrder, true, `${expectedPackage} is credited on order`);
    assertEqual(definition.isSellable, true, `${expectedPackage} is sellable`);

    console.log(`\n  2. Client and order setup`);
    const clientInsert = await db.prepare(
      "INSERT INTO clients (name, phone) VALUES (?, ?)"
    ).bind(clientName, phone).run();
    const clientId = clientInsert.meta.last_row_id;

    const orderInsert = await db.prepare(
      "INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')"
    ).bind(clientId).run();
    const orderId = orderInsert.meta.last_row_id;
    assert(Number(orderId) > 0, "test order created");

    if (initialLevelRequest) {
      const level1Eng = await createEngagement({
        db,
        orderId,
        packageCode: PACKAGE_CODES.LEVEL_1,
        sourceMaterialType: "manual"
      });
      assertOk(level1Eng, "level_1 engagement created for upgrade path");
    }

    console.log(`\n  3. Engagement creation and acceptance`);
    const engagementResult = await createEngagement({
      db,
      orderId,
      packageCode: expectedPackage,
      sourceMaterialType: "manual"
    });
    assertOk(engagementResult, `${expectedPackage} engagement created`);
    assertEqual(engagementResult.body.item.priceKzt, expectedPrice, `engagement price is ${expectedPrice} KZT`);
    assertEqual(engagementResult.body.item.packageCode, expectedPackage, `engagement package is ${expectedPackage}`);
    assertEqual(engagementResult.body.item.status, ENGAGEMENT_STATUS.OFFERED, "engagement starts as offered");
    const engagementId = engagementResult.body.item.id;
    result.engagementPrice = engagementResult.body.item.priceKzt;

    const accepted = await transitionEngagement({
      db,
      engagementId,
      toStatus: ENGAGEMENT_STATUS.ACCEPTED
    });
    assertOk(accepted, "manager accepts engagement");
    assertEqual(accepted.body.item.status, ENGAGEMENT_STATUS.ACCEPTED, "engagement is now accepted");

    console.log(`\n  4. Payment flow`);
    const payment = await createPayment({
      db,
      engagementId,
      amountKzt: expectedPrice,
      method: "kaspi",
      reference: caseId
    });
    assertOk(payment, "payment recorded");
    assertEqual(payment.body.item.amountKzt, expectedPrice, `payment amount is ${expectedPrice} KZT`);
    result.paymentAmount = payment.body.item.amountKzt;

    const confirmed = await confirmPayment({ db, paymentId: payment.body.item.id });
    assertOk(confirmed, "payment confirmed");
    assertEqual(confirmed.body.item.status, "confirmed", "payment status is confirmed");
    result.paymentStatus = confirmed.body.item.status;

    const paidEngagement = await getEngagement({ db, engagementId });
    assertEqual(paidEngagement.body.item.status, ENGAGEMENT_STATUS.PAID, "engagement becomes paid after payment confirmation");

    console.log(`\n  5. Deliverable seeding`);
    const seeded = await seedEngagementDeliverables({ db, engagementId });
    assertOk(seeded, "deliverables seeded");
    assertEqual(seeded.body.seeded, expectedDeliverableCount, `${expectedPackage} has ${expectedDeliverableCount} deliverables`);
    result.deliverableCount = seeded.body.seeded;

    const visualState = expectedPackage === PACKAGE_CODES.PACKAGE_B
      ? VISUAL_STATE.COLOR_MULTI_VIEW
      : VISUAL_STATE.BW_PREVIEW;
    const inProgress = await transitionEngagement({
      db,
      engagementId,
      toStatus: ENGAGEMENT_STATUS.IN_PROGRESS,
      visualState
    });
    assertOk(inProgress, "engagement moves to in_progress");

    console.log(`\n  6. Artifact attachment and delivery`);
    const allDeliverables = await listEngagementDeliverables({ db, engagementId });
    assertEqual(allDeliverables.body.items.length, expectedDeliverableCount, `all ${expectedDeliverableCount} deliverables listed`);
    const byType = {};
    for (const d of allDeliverables.body.items) byType[d.deliverableType] = d;

    const requiredArtifacts = [];
    for (const d of allDeliverables.body.items) {
      const artUrl = `https://example.test/${caseId}/${d.deliverableType}.pdf`;
      const metadata = { reviewedBy: "manager" };

      if (d.deliverableType === DELIVERABLE_TYPES.INCLUSIONS_SHEET) {
        metadata.inclusions = [
          { id: "inc-1", category: "furniture", label: "Мебель" },
          { id: "inc-2", category: "hardware", label: "Фурнитура" }
        ];
        metadata.exclusions = [
          { id: "exc-1", category: "appliances", label: "Бытовая техника" },
          { id: "exc-2", category: "plumbing", label: "Сантехника" }
        ];
      }

      const art = await attachArtifact({
        db,
        deliverableId: d.id,
        artifactUrl: artUrl,
        artifactFormat: "pdf",
        metadata
      });
      assertOk(art, `${d.deliverableType} artifact attached`);
      requiredArtifacts.push(artUrl);

      if (d.deliverableType === DELIVERABLE_TYPES.INCLUSIONS_SHEET && metadata.inclusions) {
        const fetched = await listEngagementDeliverables({ db, engagementId });
        const fresh = fetched.body.items.find((x) => x.id === d.id);
        assert(Array.isArray(fresh.metadata.inclusions), "metadata has inclusions array");
        assert(fresh.metadata.inclusions.length >= 1, "inclusions has at least 1 item");
        assert(Array.isArray(fresh.metadata.exclusions), "metadata has exclusions array");
        assert(fresh.metadata.exclusions.length >= 1, "exclusions has at least 1 item");
      }

      const ready = await transitionDeliverableStatus({
        db,
        deliverableId: d.id,
        toStatus: DELIVERABLE_STATUS.READY,
        createdBy: "manager"
      });
      assertOk(ready, `${d.deliverableType} marked ready`);

      const delivered = await transitionDeliverableStatus({
        db,
        deliverableId: d.id,
        toStatus: DELIVERABLE_STATUS.DELIVERED,
        createdBy: "manager"
      });
      assertOk(delivered, `${d.deliverableType} delivered`);
    }
    result.requiredArtifacts = requiredArtifacts;

    console.log(`\n  7. Manager approval`);
    const stateAfterDeliver = await getPackageDeliverableState({ db, engagementId });
    assert(stateAfterDeliver.body.allDelivered, "all deliverables are delivered");
    result.managerApprovalResult = { ok: stateAfterDeliver.body.allDelivered };

    let revisionCount = 0;
    if (revisionRounds > 0) {
      console.log(`\n  8. Revision round`);
      const firstDeliverable = allDeliverables.body.items[0];

      const revisionReq = await requestRevision({
        db,
        deliverableId: firstDeliverable.id,
        requestNote: "Уточнить детали визуала",
        requestedBy: "manager"
      });
      assertOk(revisionReq, "first revision request succeeds");
      assertEqual(revisionReq.body.engagementRevisionRound, 1, "engagement revision round is now 1");
      assertEqual(revisionReq.body.revisionNumber, 1, "revision number is 1");
      revisionCount = 1;

      const revisedEngagement = await getEngagement({ db, engagementId });
      assertEqual(revisedEngagement.body.item.revisionRound, 1, "engagement revision_round = 1");

      const firstDeliverableAfter = await getDeliverable({ db, deliverableId: firstDeliverable.id });
      assertEqual(firstDeliverableAfter.body.item.status, DELIVERABLE_STATUS.REVISION_REQUESTED, "deliverable is revision_requested");

      const revisionState = await getPackageDeliverableState({ db, engagementId });
      assertEqual(revisionState.body.packageState, "revision_in_progress", "package state is revision_in_progress");

      const prematureHandoff = await transitionEngagement({
        db,
        engagementId,
        toStatus: ENGAGEMENT_STATUS.DELIVERED
      });
      assertError(prematureHandoff, "deliverables_not_approved", "handoff blocked during revision");

      const secondRevision = await requestRevision({
        db,
        deliverableId: allDeliverables.body.items[1].id,
        requestNote: "Ещё одно уточнение",
        requestedBy: "manager"
      });
      assertError(secondRevision, "revision_limit_reached", "second revision is blocked");

      const revisions = await listDeliverableRevisions({ db, deliverableId: firstDeliverable.id });
      assert(revisions.ok && revisions.body.items.length > 0, "revision record exists");
      const revisionId = revisions.body.items[0].id;

      const resolved = await resolveRevision({
        db,
        deliverableId: firstDeliverable.id,
        revisionId,
        resolution: "Детали уточнены"
      });
      assertOk(resolved, "revision resolved");
      assertEqual(resolved.body.item.status, DELIVERABLE_STATUS.IN_PROGRESS, "deliverable back to in_progress after resolve");

      const readyAgain = await transitionDeliverableStatus({
        db,
        deliverableId: firstDeliverable.id,
        toStatus: DELIVERABLE_STATUS.READY,
        createdBy: "manager"
      });
      assertOk(readyAgain, "deliverable marked ready after revision");

      const deliveredAgain = await transitionDeliverableStatus({
        db,
        deliverableId: firstDeliverable.id,
        toStatus: DELIVERABLE_STATUS.DELIVERED,
        createdBy: "manager"
      });
      assertOk(deliveredAgain, "deliverable delivered after revision");

      const stateAfterResolve = await getPackageDeliverableState({ db, engagementId });
      assert(stateAfterResolve.body.allDelivered, "all deliverables delivered after revision resolution");
    }
    result.revisionCount = revisionCount;

    console.log(`\n  9. Supplier setup and estimate`);
    const supplier = await createSupplier({
      db,
      code: `${caseId}-SUP`,
      name: `${caseId} Supplier`
    });
    assertOk(supplier, "supplier created");
    result.supplierId = supplier.body.item.id;

    const priceList = await createPriceList({
      db,
      supplierId: supplier.body.item.id,
      note: `${caseId} price list`
    });
    assertOk(priceList, "price list created");

    const priceItem = await addPriceItem({
      db,
      priceListId: priceList.body.item.id,
      supplierId: supplier.body.item.id,
      furnitureType,
      material: "standard",
      label: zoneLabel,
      basePriceKzt: 15000,
      unitPriceKzt: 45000
    });
    assertOk(priceItem, "price item added");

    const published = await publishPriceList({
      db,
      priceListId: priceList.body.item.id,
      effectiveFrom: "2026-07-12"
    });
    assertOk(published, "price list published");
    result.publishedPriceListId = published.body.item.id;

    console.log(`\n  10. PDF upload and supplier-aware estimate`);
    const upload = await createPdfUpload({
      db,
      orderId,
      fileName: `${caseId}.pdf`,
      fileSizeBytes: 2048,
      mimeType: "application/pdf",
      pageCount: 2,
      checksum: caseId
    });
    assertOk(upload, "source PDF registered");

    const manifest = buildManifest(caseId, zoneType, zoneLabel, zoneDimensions);

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
      analysisVersion: `manual-${caseId}`
    });
    assertOk(reviewed, "PDF draft reviewed by manager");

    const estimate = await generateSupplierAwareEstimate({
      db,
      draftId: draft.body.item.id,
      supplierId: supplier.body.item.id,
      material: "standard"
    });
    assertOk(estimate, "supplier-aware estimate generated");
    assert(estimate.body.estimate.totals.total > 0, "estimate has positive total");
    result.estimateTotal = estimate.body.estimate.totals.total;

    console.log(`\n  11. Client handoff`);
    const handoff = await transitionEngagement({
      db,
      engagementId,
      toStatus: ENGAGEMENT_STATUS.DELIVERED
    });
    assertOk(handoff, "client handoff succeeds");
    assertEqual(handoff.body.item.status, ENGAGEMENT_STATUS.DELIVERED, "engagement status is delivered");
    result.clientHandoffResult = { ok: handoff.ok };

    console.log(`\n  12. Credit-on-order`);
    const creditPreview = applyCreditToOrder({
      engagement: handoff.body.item,
      orderTotalKzt: estimate.body.estimate.totals.total
    });
    assert(creditPreview.eligible, "engagement is eligible for credit-on-order");
    assertEqual(creditPreview.creditedAmountKzt, expectedPrice, `credit amount is ${expectedPrice} KZT`);

    const credited = await transitionEngagement({
      db,
      engagementId,
      toStatus: ENGAGEMENT_STATUS.CREDITED
    });
    assertOk(credited, "credit-on-order applied");
    assertEqual(credited.body.item.creditedAmountKzt, expectedPrice, `persisted credit amount is ${expectedPrice} KZT`);
    result.creditAmount = credited.body.item.creditedAmountKzt;
    result.orderConversionResult = { ok: true };

    console.log(`\n  13. Duplicate credit rejection`);
    const dupCredit = await transitionEngagement({
      db,
      engagementId,
      toStatus: ENGAGEMENT_STATUS.CREDITED
    });
    assertError(dupCredit, "invalid_status_transition", "duplicate credit is blocked");
    result.duplicateCreditResult = { ok: dupCredit.ok };

    console.log(`\n  14. Final assertions`);
    const finalEngagement = await getEngagement({ db, engagementId });
    assertEqual(finalEngagement.body.item.status, ENGAGEMENT_STATUS.CREDITED, "final status is credited");
    assertEqual(finalEngagement.body.item.creditedAmountKzt, expectedPrice, `final credited amount is ${expectedPrice} KZT`);
    assertEqual(finalEngagement.body.item.priceKzt, expectedPrice, `final price is ${expectedPrice} KZT`);
    assertEqual(finalEngagement.body.item.packageCode, expectedPackage, `final package is ${expectedPackage}`);
    result.finalEngagementStatus = finalEngagement.body.item.status;

    const finalDeliverables = await listEngagementDeliverables({ db, engagementId });
    assertEqual(finalDeliverables.body.items.length, expectedDeliverableCount, `all ${expectedDeliverableCount} deliverables still present`);
    for (const d of finalDeliverables.body.items) {
      assertEqual(d.status, DELIVERABLE_STATUS.DELIVERED, `${d.deliverableType} remains delivered`);
    }

    const events = await db.prepare(
      "SELECT event_type FROM package_conversion_events WHERE engagement_id = ? ORDER BY id ASC"
    ).bind(engagementId).all();
    const eventTypes = (events?.results || []).map((e) => e.event_type);
    result.eventCounts = { conversionEvents: eventTypes.length };
    assert(eventTypes.length > 0, `conversion events recorded (${eventTypes.length})`);
    assert(eventTypes.includes("package_offered"), "conversion events include package_offered");
    assert(eventTypes.includes("status_delivered"), "conversion events include status_delivered");
    assert(eventTypes.includes("status_credited"), "conversion events include status_credited");

    result.manualSteps = [
      "Client consultation and requirement gathering (not simulated)",
      "Deliverable creation by designer (artifacts are synthetic URLs)",
      "Manager review and approval of deliverables",
      "Payment processing via external gateway (simulated)",
      "Supplier pricing coordination and negotiation",
      "Client handoff meeting and sign-off (not simulated)",
      "Credit application to furniture order (automated in rehearsal)"
    ];

  } catch (error) {
    result.result = "FAIL";
    failed += 1;
    console.error(`  ✗ Case ${caseNum} (${caseId}) failed with exception:`, error.message);
  }

  if (failed > failedBefore) {
    result.result = "FAIL";
  }

  caseResults.push(result);
  return result;
}

function getDeliverable({ db, deliverableId }) {
  const stmt = db.prepare(
    `SELECT id, engagement_id, order_id, deliverable_type, label, status, sort_order,
            artifact_url, artifact_format, metadata_json, created_at, updated_at, completed_at
     FROM package_deliverables WHERE id = ?`
  ).bind(deliverableId);
  return stmt.first().then((row) => {
    if (!row) return { ok: false, status: 404, body: { success: false, error: "deliverable_not_found" } };
    let metadata = {};
    try { metadata = JSON.parse(row.metadata_json || "{}"); } catch { metadata = {}; }
    return {
      ok: true, status: 200,
      body: {
        success: true,
        item: {
          id: Number(row.id),
          engagementId: Number(row.engagement_id),
          orderId: Number(row.order_id),
          deliverableType: row.deliverable_type,
          label: row.label,
          status: row.status,
          sortOrder: Number(row.sort_order) || 0,
          artifactUrl: row.artifact_url || null,
          artifactFormat: row.artifact_format || null,
          metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedAt: row.completed_at || null
        }
      }
    };
  });
}

console.log("Phase 4.3 — Operational Rehearsal");
console.log("Deterministic system rehearsals, not real customer cases.\n");

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(loadMigrationSql());
const db = makeD1(sqlite);

try {
  await runCase(db, {
    caseNum: 1,
    caseId: "PHASE43-KITCHEN-A",
    requestText: "Нужна кухня, коммерческое предложение и смета по позициям",
    clientName: "Тестов Тест Тестович",
    phone: "+77000000043",
    expectedPackage: PACKAGE_CODES.PACKAGE_A,
    expectedPrice: 10000,
    expectedDeliverableCount: 3,
    revisionRounds: 0,
    furnitureType: "kitchen",
    zoneType: "kitchen",
    zoneLabel: "Кухня 4 м",
    zoneDimensions: { widthMm: 4000, heightMm: 2700, depthMm: 600 }
  });

  await runCase(db, {
    caseNum: 2,
    caseId: "PHASE43-WARDROBE-A",
    requestText: "Шкаф-купе, линейная смета",
    clientName: "Шкафов Шкаф Шкафович",
    phone: "+77000000044",
    expectedPackage: PACKAGE_CODES.PACKAGE_A,
    expectedPrice: 10000,
    expectedDeliverableCount: 3,
    revisionRounds: 0,
    furnitureType: "wardrobe",
    zoneType: "wardrobe",
    zoneLabel: "Шкаф-купе 3 м",
    zoneDimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 }
  });

  await runCase(db, {
    caseNum: 3,
    caseId: "PHASE43-KITCHEN-B",
    requestText: "Кухня с цветным визуалом, размерами, вариантами компоновки, листом включений и исключений",
    clientName: "Кухонный Кухня Кухнёвич",
    phone: "+77000000045",
    expectedPackage: PACKAGE_CODES.PACKAGE_B,
    expectedPrice: 20000,
    expectedDeliverableCount: 6,
    revisionRounds: 1,
    furnitureType: "kitchen",
    zoneType: "kitchen",
    zoneLabel: "Кухня 4 м",
    zoneDimensions: { widthMm: 4000, heightMm: 2700, depthMm: 600 }
  });

  await runCase(db, {
    caseNum: 4,
    caseId: "PHASE43-WARDROBE-B",
    requestText: "Гардеробная с вариантами компоновки и размерами",
    clientName: "Гардероб Гардероб Гардеробович",
    phone: "+77000000046",
    expectedPackage: PACKAGE_CODES.PACKAGE_B,
    expectedPrice: 20000,
    expectedDeliverableCount: 6,
    revisionRounds: 1,
    furnitureType: "wardrobe",
    zoneType: "wardrobe",
    zoneLabel: "Гардеробная 3 м",
    zoneDimensions: { widthMm: 3000, heightMm: 2400, depthMm: 600 }
  });

  await runCase(db, {
    caseNum: 5,
    caseId: "PHASE43-UPGRADE-TO-B",
    requestText: "Хочу цветной визуал кухни с размерами и вариантами компоновки",
    clientName: "Upgrade Тест Тестович",
    phone: "+77000000047",
    expectedPackage: PACKAGE_CODES.PACKAGE_B,
    expectedPrice: 20000,
    expectedDeliverableCount: 6,
    revisionRounds: 1,
    furnitureType: "kitchen",
    zoneType: "kitchen",
    zoneLabel: "Кухня 4 м",
    zoneDimensions: { widthMm: 4000, heightMm: 2700, depthMm: 600 },
    initialLevelRequest: "Сколько примерно стоит кухня?",
    initialLevelExpected: PACKAGE_CODES.LEVEL_1
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log("Report generation");
  console.log(`${"=".repeat(60)}`);

  const docsDir = new URL("../docs/", import.meta.url);
  mkdirSync(docsDir, { recursive: true });

  const totalAssertions = passed + failed;
  const overallResult = failed > 0 ? "FAIL" : "PASS";

  const summaryRows = caseResults.map((c) => {
    const paymentStr = c.paymentAmount > 0 ? `\u20B8${c.paymentAmount.toLocaleString("ru-RU")}` : "N/A";
    const deliverablesStr = `${c.deliverableCount}`;
    const revisionsStr = `${c.revisionCount}`;
    const estimateStr = c.estimateTotal > 0 ? `\u20B8${c.estimateTotal.toLocaleString("ru-RU")}` : "Pending real pilot";
    const handoffStr = c.clientHandoffResult?.ok ? "OK" : "FAIL";
    const creditStr = c.creditAmount > 0 ? `\u20B8${c.creditAmount.toLocaleString("ru-RU")}` : "N/A";
    return `| ${c.caseId} | ${c.initialLevel} | ${c.finalPackage} | ${paymentStr} | ${deliverablesStr} | ${revisionsStr} | ${estimateStr} | ${handoffStr} | ${creditStr} | ${c.result} |`;
  }).join("\n");

  const manualStepsSection = caseResults.map((c) => {
    const steps = c.manualSteps.map((s) => `- ${s}`).join("\n");
    return `### ${c.caseId}\n${steps}`;
  }).join("\n\n");

  const report = `# Phase 4.3 — Operational Rehearsal Report

> These are deterministic system rehearsals, not real customer cases.
> Generated: ${new Date().toISOString()}

## Summary

| Case | Initial level | Final package | Payment | Deliverables | Revisions | Estimate | Handoff | Credit | Result |
|------|---------------|---------------|---------|--------------|-----------|----------|---------|--------|--------|
${summaryRows}

## Assertion Summary

- Total assertions: ${totalAssertions}
- Passed: ${passed}
- Failed: ${failed}

## Manual Steps (Pending Real Pilot)

${manualStepsSection}

## Overall Result

**${overallResult}**
`;

  writeFileSync(new URL("PHASE_4_3_OPERATIONAL_REHEARSAL_REPORT.md", docsDir), report, "utf8");
  console.log(`\nReport written to docs/PHASE_4_3_OPERATIONAL_REHEARSAL_REPORT.md`);

} finally {
  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

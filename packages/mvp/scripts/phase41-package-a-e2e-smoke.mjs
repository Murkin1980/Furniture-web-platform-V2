import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classifyIntent } from "../src/ai/package-advisor.js";
import {
  PACKAGE_CODES,
  ENGAGEMENT_STATUS,
  VISUAL_STATE
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
  DELIVERABLE_STATUS
} from "../src/packages/visual-standards.js";
import {
  seedEngagementDeliverables,
  listEngagementDeliverables,
  attachArtifact,
  transitionDeliverableStatus,
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

console.log("Phase 4.1 — Package A end-to-end commercial proof");

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(loadMigrationSql());
const db = makeD1(sqlite);

try {
  console.log("\n1. Client request and advisor");
  const intent = classifyIntent("Нужно коммерческое предложение и смета по позициям для кухни");
  assertEqual(intent.packageCode, PACKAGE_CODES.PACKAGE_A, "advisor recommends Package A");

  const clientInsert = await db.prepare(
    "INSERT INTO clients (name, phone) VALUES (?, ?)"
  ).bind("Phase 4.1 Test Client", "+77000000001").run();
  const clientId = clientInsert.meta.last_row_id;

  const orderInsert = await db.prepare(
    "INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')"
  ).bind(clientId).run();
  const orderId = orderInsert.meta.last_row_id;
  assert(Number(orderId) > 0, "test order created");

  console.log("\n2. Engagement and payment");
  const engagementResult = await createEngagement({
    db,
    orderId,
    packageCode: intent.packageCode,
    sourceMaterialType: "manual"
  });
  assert(engagementResult.ok, "Package A engagement created");
  assertEqual(engagementResult.body.item.priceKzt, 10000, "Package A price is 10,000 KZT");
  const engagementId = engagementResult.body.item.id;

  const accepted = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.ACCEPTED
  });
  assert(accepted.ok, "manager accepts Package A engagement");

  const payment = await createPayment({
    db,
    engagementId,
    amountKzt: 10000,
    method: "kaspi",
    reference: "PHASE41-A-001"
  });
  assert(payment.ok, "Package A payment recorded");

  const confirmed = await confirmPayment({ db, paymentId: payment.body.item.id });
  assert(confirmed.ok, "Package A payment confirmed");
  const paidEngagement = await getEngagement({ db, engagementId });
  assertEqual(paidEngagement.body.item.status, ENGAGEMENT_STATUS.PAID, "engagement becomes paid");

  console.log("\n3. Deliverables and manager handoff gate");
  const seeded = await seedEngagementDeliverables({ db, engagementId });
  assert(seeded.ok, "Package A deliverables seeded");
  assertEqual(seeded.body.seeded, 3, "Package A has three deliverables");

  const inProgress = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.IN_PROGRESS,
    visualState: VISUAL_STATE.BW_PREVIEW
  });
  assert(inProgress.ok, "engagement moves to in_progress");

  const prematureHandoff = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.DELIVERED
  });
  assert(!prematureHandoff.ok, "client handoff is blocked before deliverables are approved");
  assertEqual(prematureHandoff.body.error, "deliverables_not_approved", "handoff gate returns deliverables_not_approved");

  const deliverablesResult = await listEngagementDeliverables({ db, engagementId });
  for (const deliverable of deliverablesResult.body.items) {
    const artifact = await attachArtifact({
      db,
      deliverableId: deliverable.id,
      artifactUrl: `https://example.test/package-a/${deliverable.deliverableType}.pdf`,
      artifactFormat: "pdf",
      metadata: { reviewedBy: "manager", phase: "4.1" }
    });
    assert(artifact.ok, `${deliverable.deliverableType}: artifact attached`);

    const ready = await transitionDeliverableStatus({
      db,
      deliverableId: deliverable.id,
      toStatus: DELIVERABLE_STATUS.READY,
      createdBy: "manager"
    });
    assert(ready.ok, `${deliverable.deliverableType}: marked ready`);

    const delivered = await transitionDeliverableStatus({
      db,
      deliverableId: deliverable.id,
      toStatus: DELIVERABLE_STATUS.DELIVERED,
      createdBy: "manager"
    });
    assert(delivered.ok, `${deliverable.deliverableType}: manager delivered`);
  }

  const packageState = await getPackageDeliverableState({ db, engagementId });
  assert(packageState.body.allDelivered, "all Package A deliverables are delivered");

  console.log("\n4. Reviewed source material and supplier-aware estimate");
  const upload = await createPdfUpload({
    db,
    orderId,
    fileName: "phase41-kitchen.pdf",
    fileSizeBytes: 1024,
    mimeType: "application/pdf",
    pageCount: 1,
    checksum: "phase41-a"
  });
  assert(upload.ok, "source PDF registered");

  const manifest = {
    document: { fileName: "phase41-kitchen.pdf" },
    pageCount: 1,
    pages: [{
      pageNumber: 1,
      pageType: "floor_plan",
      furnitureZones: [{
        id: "kitchen-1",
        zoneType: "kitchen",
        label: "Кухня 3 м",
        dimensions: { widthMm: 3000, heightMm: 2700, depthMm: 600 }
      }]
    }]
  };

  const draft = await createPdfDraft({
    db,
    uploadId: upload.body.item.id,
    orderId,
    manifest,
    createdBy: "manager"
  });
  assert(draft.ok, "PDF draft created");

  const reviewed = await updatePdfDraftManifest({
    db,
    draftId: draft.body.item.id,
    manifest,
    analysisVersion: "manual-phase41"
  });
  assert(reviewed.ok, "PDF draft reviewed by manager");

  const supplier = await createSupplier({
    db,
    code: "PHASE41-SUP",
    name: "Phase 4.1 Supplier"
  });
  assert(supplier.ok, "supplier created");

  const priceList = await createPriceList({
    db,
    supplierId: supplier.body.item.id,
    note: "Phase 4.1 published price list"
  });
  assert(priceList.ok, "supplier price list created");

  const priceItem = await addPriceItem({
    db,
    priceListId: priceList.body.item.id,
    supplierId: supplier.body.item.id,
    furnitureType: "kitchen",
    material: "standard",
    label: "Кухня стандарт",
    basePriceKzt: 15000,
    unitPriceKzt: 45000
  });
  assert(priceItem.ok, "supplier kitchen price added");

  const published = await publishPriceList({
    db,
    priceListId: priceList.body.item.id,
    effectiveFrom: "2026-07-11"
  });
  assert(published.ok, "supplier price list published");

  const estimate = await generateSupplierAwareEstimate({
    db,
    draftId: draft.body.item.id,
    supplierId: supplier.body.item.id,
    material: "standard"
  });
  assert(estimate.ok, "supplier-aware estimate generated");
  assertEqual(estimate.body.estimate.source.priceListId, priceList.body.item.id, "estimate references published price-list version");
  assert(estimate.body.estimate.totals.total > 0, "supplier-aware estimate has positive total");

  console.log("\n5. Client handoff and exactly-once credit");
  const handedOff = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.DELIVERED
  });
  assert(handedOff.ok, "client handoff succeeds after manager-delivered artifacts");

  const creditPreview = applyCreditToOrder({
    engagement: handedOff.body.item,
    orderTotalKzt: estimate.body.estimate.totals.total
  });
  assert(creditPreview.eligible, "Package A is eligible for credit-on-order");
  assertEqual(creditPreview.creditedAmountKzt, 10000, "credit amount is exactly 10,000 KZT");

  const credited = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.CREDITED
  });
  assert(credited.ok, "credit-on-order applied");
  assertEqual(credited.body.item.creditedAmountKzt, 10000, "persisted credit amount is 10,000 KZT");

  const duplicateCredit = await transitionEngagement({
    db,
    engagementId,
    toStatus: ENGAGEMENT_STATUS.CREDITED
  });
  assert(!duplicateCredit.ok, "second credit attempt is blocked");
  assertEqual(duplicateCredit.body.error, "invalid_status_transition", "duplicate credit does not create a second application");

  const creditEvents = await db.prepare(
    "SELECT COUNT(*) AS count FROM package_conversion_events WHERE engagement_id = ? AND event_type = 'status_credited'"
  ).bind(engagementId).first();
  assertEqual(Number(creditEvents.count), 1, "exactly one credited conversion event exists");

  const finalEngagement = await getEngagement({ db, engagementId });
  assertEqual(finalEngagement.body.item.status, ENGAGEMENT_STATUS.CREDITED, "final engagement status is credited");
  assertEqual(finalEngagement.body.item.creditedAmountKzt, 10000, "final engagement keeps one credit amount");
} finally {
  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

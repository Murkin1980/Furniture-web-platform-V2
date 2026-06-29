import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  SUPPLIER_PRICE_LIST_STATUS,
  isValidMaterialTier,
  isValidPriceListStatus,
  isValidFurnitureType,
  buildPriceItemDefaults,
  resolveSupplierPricing
} from "../src/suppliers/supplier-catalog.js";
import {
  createSupplier,
  listSuppliers,
  createPriceList,
  getPriceList,
  listSupplierPriceLists,
  addPriceItem,
  listPriceItems,
  publishPriceList,
  archivePriceList,
  getActivePriceList,
  generateSupplierAwareEstimate
} from "../src/suppliers/supplier-store.js";
import {
  createPdfDraft,
  updatePdfDraftManifest
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

function loadMigrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return [
    readFileSync(new URL("0001_packages.sql", dir), "utf8"),
    readFileSync(new URL("0002_package_payments.sql", dir), "utf8"),
    readFileSync(new URL("0003_deliverables.sql", dir), "utf8"),
    readFileSync(new URL("0004_pdf_intake.sql", dir), "utf8"),
    readFileSync(new URL("0005_supplier_pricing.sql", dir), "utf8")
  ].join("\n");
}

function makeD1(sqliteDb) {
  return {
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
}

function normalizeRow(row) {
  if (!row) return null;
  const result = {};
  for (const key of Object.keys(row)) {
    result[key] = row[key];
  }
  return result;
}

console.log("Supplier catalog smoke");
{
  assert(isValidMaterialTier("premium"), "premium is valid material tier");
  assert(!isValidMaterialTier("ultra"), "ultra is invalid material tier");
  assert(isValidPriceListStatus("draft"), "draft is valid price list status");
  assert(isValidFurnitureType("kitchen"), "kitchen is valid furniture type");
  assert(isValidFurnitureType("walk_in_closet"), "walk_in_closet is valid furniture type");

  const defaults = buildPriceItemDefaults("kitchen", "premium");
  assertEqual(defaults.furnitureType, "kitchen", "price item defaults furnitureType");
  assertEqual(defaults.material, "premium", "price item defaults material");
  assert(defaults.basePriceKzt > 0, "price item defaults base > 0");
  assert(defaults.unitPriceKzt > 0, "price item defaults unit > 0");

  const notFound = buildPriceItemDefaults("nonexistent", "standard");
  assertEqual(notFound, null, "invalid furniture type returns null");

  const priceItems = [
    { furnitureType: "kitchen", material: "premium", basePriceKzt: 20000, unitPriceKzt: 55000, unit: "m.p." },
    { furnitureType: "kitchen", material: "standard", basePriceKzt: 15000, unitPriceKzt: 45000, unit: "m.p." },
    { furnitureType: "wardrobe", material: "standard", basePriceKzt: 10000, unitPriceKzt: 35000, unit: "m.p." },
    { furnitureType: "other", material: "standard", basePriceKzt: 8000, unitPriceKzt: 30000, unit: "m.p." }
  ];

  const exact = resolveSupplierPricing(priceItems, "kitchen", "premium");
  assertEqual(exact.basePriceKzt, 20000, "exact match base 20000");
  assertEqual(exact.source, "exact", "exact match source");

  const typeFallback = resolveSupplierPricing(priceItems, "kitchen", "luxury");
  assertEqual(typeFallback.source, "type_fallback", "type fallback when material missing");
  assertEqual(typeFallback.basePriceKzt, 15000, "type fallback uses standard");

  const standardFallback = resolveSupplierPricing(priceItems, "bathroom", "standard");
  assertEqual(standardFallback.source, "standard_fallback", "standard fallback for missing type");
  assertEqual(standardFallback.basePriceKzt, 8000, "standard fallback base 8000");

  const noMatch = resolveSupplierPricing([{ furnitureType: "kitchen", material: "premium", basePriceKzt: 1, unitPriceKzt: 1, unit: "x" }], "bathroom", "standard");
  assertEqual(noMatch, null, "no match returns null when no other/standard fallback");
}

console.log("Supplier store smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const supplierResult = await createSupplier({ db, code: "SUP001", name: "TOO Mebelnye Komponenty", contact: "Ivan", phone: "+7 700 111 22 33", email: "info@mk.kz" });
  assert(supplierResult.ok, "createSupplier succeeds");
  assertEqual(supplierResult.status, 201, "createSupplier returns 201");
  assertEqual(supplierResult.body.item.code, "SUP001", "supplier code");
  assertEqual(supplierResult.body.item.isActive, true, "supplier is active");

  const supplierId = supplierResult.body.item.id;

  const dupCode = await createSupplier({ db, code: "SUP001", name: "Duplicate" });
  assert(!dupCode.ok, "duplicate code fails");
  assertEqual(dupCode.status, 409, "duplicate returns 409");

  const listResult = await listSuppliers({ db });
  assert(listResult.ok, "listSuppliers succeeds");
  assertEqual(listResult.body.items.length, 1, "1 supplier listed");

  const priceListResult = await createPriceList({ db, supplierId, note: "First price list" });
  assert(priceListResult.ok, "createPriceList succeeds");
  assertEqual(priceListResult.status, 201, "createPriceList returns 201");
  assertEqual(priceListResult.body.item.versionNumber, 1, "first price list version 1");
  assertEqual(priceListResult.body.item.status, SUPPLIER_PRICE_LIST_STATUS.DRAFT, "price list is draft");

  const priceListId = priceListResult.body.item.id;

  const itemResult = await addPriceItem({ db, priceListId, supplierId, furnitureType: "kitchen", material: "premium", label: "Kitchen premium", basePriceKzt: 20000, unitPriceKzt: 55000 });
  assert(itemResult.ok, "addPriceItem succeeds");
  assertEqual(itemResult.status, 201, "addPriceItem returns 201");
  assertEqual(itemResult.body.item.furnitureType, "kitchen", "item furnitureType");
  assertEqual(itemResult.body.item.material, "premium", "item material");
  assertEqual(itemResult.body.item.basePriceKzt, 20000, "item base 20000");

  const item2 = await addPriceItem({ db, priceListId, supplierId, furnitureType: "kitchen", material: "standard", label: "Kitchen standard", basePriceKzt: 15000, unitPriceKzt: 45000 });
  assert(item2.ok, "addPriceItem kitchen standard succeeds");

  const item3 = await addPriceItem({ db, priceListId, supplierId, furnitureType: "wardrobe", material: "standard", basePriceKzt: 10000, unitPriceKzt: 35000 });
  assert(item3.ok, "addPriceItem wardrobe succeeds");

  const invalidType = await addPriceItem({ db, priceListId, supplierId, furnitureType: "nonexistent", material: "standard" });
  assert(!invalidType.ok, "invalid furniture type fails");
  assertEqual(invalidType.status, 400, "invalid type returns 400");

  const itemsResult = await listPriceItems({ db, priceListId });
  assert(itemsResult.ok, "listPriceItems succeeds");
  assertEqual(itemsResult.body.items.length, 3, "3 price items listed");

  const publishResult = await publishPriceList({ db, priceListId, effectiveFrom: "2026-07-01" });
  assert(publishResult.ok, "publishPriceList succeeds");
  assertEqual(publishResult.body.item.status, SUPPLIER_PRICE_LIST_STATUS.PUBLISHED, "price list is published");
  assert(!!publishResult.body.item.publishedAt, "publishedAt is set");
  assertEqual(publishResult.body.item.effectiveFrom, "2026-07-01", "effectiveFrom stored");

  const doublePublish = await publishPriceList({ db, priceListId });
  assert(doublePublish.ok, "double publish is idempotent");

  const activeResult = await getActivePriceList({ db, supplierId });
  assert(activeResult.ok, "getActivePriceList succeeds");
  assertEqual(activeResult.body.item.id, priceListId, "active price list matches");
  assertEqual(activeResult.body.item.items.length, 3, "active price list includes 3 items");

  const v2 = await createPriceList({ db, supplierId, note: "Updated price list" });
  assertEqual(v2.body.item.versionNumber, 2, "second price list version 2");

  await addPriceItem({ db, priceListId: v2.body.item.id, supplierId, furnitureType: "kitchen", material: "standard", basePriceKzt: 16000, unitPriceKzt: 46000 });

  const publishV2 = await publishPriceList({ db, priceListId: v2.body.item.id, effectiveFrom: "2026-08-01" });
  assert(publishV2.ok, "publish v2 succeeds");
  assertEqual(publishV2.body.item.status, "published", "v2 is published");

  const oldList = await getPriceList({ db, priceListId: priceListId });
  assertEqual(oldList.body.item.status, "archived", "old published list auto-archived on v2 publish");

  const activeAfterV2 = await getActivePriceList({ db, supplierId });
  assert(activeAfterV2.ok, "active price list exists after v2 publish");
  assertEqual(activeAfterV2.body.item.id, v2.body.item.id, "active is now v2");

  const archiveResult = await archivePriceList({ db, priceListId: v2.body.item.id });
  assert(archiveResult.ok, "archivePriceList succeeds");
  assertEqual(archiveResult.body.item.status, SUPPLIER_PRICE_LIST_STATUS.ARCHIVED, "price list is archived");

  const noActive = await getActivePriceList({ db, supplierId });
  assert(!noActive.ok, "no active price list after archive");
  assertEqual(noActive.status, 404, "no active returns 404");

  sqlite.close();
}

console.log("Supplier-aware estimate smoke");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const supplier = await createSupplier({ db, code: "SUP002", name: "Furnitura Plus" });
  const supplierId = supplier.body.item.id;

  const pl = await createPriceList({ db, supplierId });
  const plId = pl.body.item.id;

  await addPriceItem({ db, priceListId: plId, supplierId, furnitureType: "kitchen", material: "premium", basePriceKzt: 25000, unitPriceKzt: 60000 });
  await addPriceItem({ db, priceListId: plId, supplierId, furnitureType: "kitchen", material: "standard", basePriceKzt: 18000, unitPriceKzt: 48000 });
  await addPriceItem({ db, priceListId: plId, supplierId, furnitureType: "wardrobe", material: "standard", basePriceKzt: 12000, unitPriceKzt: 38000 });
  await addPriceItem({ db, priceListId: plId, supplierId, furnitureType: "other", material: "standard", basePriceKzt: 9000, unitPriceKzt: 32000 });

  await publishPriceList({ db, priceListId: plId });

  const ci = await db.prepare("INSERT INTO clients (name) VALUES (?)").bind("Supplier Estimate Test").run();
  const oi = await db.prepare("INSERT INTO orders (client_id) VALUES (?)").bind(ci.meta.last_row_id).run();
  const orderId = oi.meta.last_row_id;

  const draft = await createPdfDraft({
    db, orderId,
    manifest: {
      document: { fileName: "kitchen-plan.pdf" },
      pageCount: 1,
      pages: [{ pageNumber: 1, pageType: "floor_plan", furnitureZones: [
        { id: "z1", zoneType: "kitchen", label: "Kitchen 3.2m", dimensions: { widthMm: 3200 } },
        { id: "z2", zoneType: "wardrobe", label: "Wardrobe 2.5m", dimensions: { widthMm: 2500 } }
      ]}]
    }
  });
  const draftId = draft.body.item.id;

  const estimateBeforeReview = await generateSupplierAwareEstimate({ db, draftId, supplierId, material: "premium" });
  assert(!estimateBeforeReview.ok, "supplier estimate before review fails");
  assertEqual(estimateBeforeReview.status, 409, "not reviewed returns 409");

  await updatePdfDraftManifest({ db, draftId, manifest: draft.body.item.manifest, aiProvider: "openai", aiModel: "gpt-4" });

  const estimateResult = await generateSupplierAwareEstimate({ db, draftId, supplierId, material: "premium" });
  assert(estimateResult.ok, "supplier-aware estimate succeeds after review");
  assertEqual(estimateResult.status, 201, "estimate returns 201");
  assertEqual(estimateResult.body.estimate.estimateVersion, "supplier-estimate/v1", "estimate version");
  assertEqual(estimateResult.body.estimate.items.length, 2, "2 estimate items");

  const kitchenItem = estimateResult.body.estimate.items.find((i) => i.furnitureType === "kitchen");
  assertEqual(kitchenItem.basePrice, 25000, "kitchen premium base 25000 from supplier");
  assertEqual(kitchenItem.unitPrice, 60000, "kitchen premium unit 60000 from supplier");
  assertEqual(kitchenItem.pricingSource, "exact", "kitchen premium exact match");
  assertEqual(kitchenItem.units, 4, "kitchen 3200mm = 4 units");
  assertEqual(kitchenItem.subtotal, 25000 + 60000 * 4, "kitchen subtotal = base + unit*4");

  const wardrobeItem = estimateResult.body.estimate.items.find((i) => i.furnitureType === "wardrobe");
  assertEqual(wardrobeItem.pricingSource, "type_fallback", "wardrobe uses type_fallback (no premium in price list)");
  assertEqual(wardrobeItem.basePrice, 12000, "wardrobe base 12000");

  assert(estimateResult.body.estimate.totals.total > 0, "supplier estimate total > 0");

  const withDiscount = await generateSupplierAwareEstimate({ db, draftId, supplierId, material: "standard", discountPercent: 10 });
  assert(withDiscount.ok, "supplier estimate with discount succeeds");
  assert(withDiscount.body.estimate.totals.discount > 0, "discount > 0");
  assert(withDiscount.body.estimate.totals.total < estimateResult.body.estimate.totals.total, "discounted total < full total");

  const standardKitchen = withDiscount.body.estimate.items.find((i) => i.furnitureType === "kitchen");
  assertEqual(standardKitchen.basePrice, 18000, "kitchen standard base 18000");
  assertEqual(standardKitchen.material, "standard", "material is standard");

  const noSupplier = await generateSupplierAwareEstimate({ db, draftId, supplierId: 999999, material: "standard" });
  assert(!noSupplier.ok, "nonexistent supplier fails");
  assertEqual(noSupplier.status, 404, "no supplier returns 404");

  sqlite.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

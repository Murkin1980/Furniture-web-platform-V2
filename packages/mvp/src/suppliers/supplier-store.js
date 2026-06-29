import {
  SUPPLIER_PRICE_LIST_STATUS,
  isValidMaterialTier,
  isValidPriceListStatus,
  isValidFurnitureType,
  buildPriceItemDefaults,
  normalizeSupplierRow,
  normalizePriceListRow,
  normalizePriceItemRow,
  resolveSupplierPricing
} from "./supplier-catalog.js";
import { collectFurnitureZones } from "../pdf/pdf-manifest.js";

const FURNITURE_TYPES_FOR_ERROR = [
  "kitchen", "wardrobe", "walk_in_closet", "bathroom", "hallway",
  "kids", "office", "tvzone", "commercial", "storage", "bedroom", "cabinet", "other"
];

export async function createSupplier({ db, code, name, contact, phone, email, note }) {
  if (!code || typeof code !== "string") return errorResult(400, "invalid_code", "code is required.");
  if (!name || typeof name !== "string") return errorResult(400, "invalid_name", "name is required.");

  try {
    const insert = await db.prepare(
      `INSERT INTO suppliers (code, name, contact, phone, email, note, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).bind(code, name, str(contact), str(phone), str(email), str(note)).run();
    const supplierId = insert?.meta?.last_row_id;
    if (!positiveInteger(supplierId)) throw new Error("Supplier insert did not return an id.");
    return getSupplier({ db, supplierId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getSupplier({ db, supplierId, status = 200 }) {
  const id = positiveInteger(supplierId);
  if (!id) return errorResult(400, "invalid_supplier_id", "supplierId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, code, name, contact, phone, email, note, is_active, created_at, updated_at
     FROM suppliers WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "supplier_not_found", "Supplier was not found.");
  return okResult({ item: normalizeSupplierRow(row) }, status);
}

export async function listSuppliers({ db, activeOnly = false }) {
  const sql = activeOnly
    ? `SELECT id, code, name, contact, phone, email, note, is_active, created_at, updated_at FROM suppliers WHERE is_active = 1 ORDER BY name ASC, id ASC`
    : `SELECT id, code, name, contact, phone, email, note, is_active, created_at, updated_at FROM suppliers ORDER BY name ASC, id ASC`;
  const result = await db.prepare(sql).all();
  return okResult({ items: (result?.results || []).map(normalizeSupplierRow) });
}

export async function createPriceList({ db, supplierId, note, createdBy = "manager" }) {
  const id = positiveInteger(supplierId);
  if (!id) return errorResult(400, "invalid_supplier_id", "supplierId must be a positive integer.");

  const supplier = await getSupplier({ db, supplierId: id });
  if (!supplier.ok) return supplier;

  try {
    const lastVersion = await db.prepare(
      `SELECT MAX(version_number) AS maxVersion FROM supplier_price_lists WHERE supplier_id = ?`
    ).bind(id).first();
    const nextVersion = (Number(lastVersion?.maxVersion) || 0) + 1;

    const insert = await db.prepare(
      `INSERT INTO supplier_price_lists (supplier_id, version_number, status, note, created_by)
       VALUES (?, ?, 'draft', ?, ?)`
    ).bind(id, nextVersion, str(note), str(createdBy) || "manager").run();
    const priceListId = insert?.meta?.last_row_id;
    if (!positiveInteger(priceListId)) throw new Error("Price list insert did not return an id.");
    return getPriceList({ db, priceListId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getPriceList({ db, priceListId, status = 200, includeItems = false }) {
  const id = positiveInteger(priceListId);
  if (!id) return errorResult(400, "invalid_price_list_id", "priceListId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, supplier_id, version_number, status, effective_from, effective_to, note, created_by, created_at, published_at
     FROM supplier_price_lists WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "price_list_not_found", "Price list was not found.");
  const priceList = normalizePriceListRow(row);
  if (includeItems) {
    const itemsResult = await db.prepare(
      `SELECT id, price_list_id, supplier_id, furniture_type, material, label, base_price_kzt, unit_price_kzt, unit, sort_order
       FROM supplier_price_items WHERE price_list_id = ? ORDER BY sort_order ASC, id ASC`
    ).bind(id).all();
    priceList.items = (itemsResult?.results || []).map(normalizePriceItemRow);
  }
  return okResult({ item: priceList }, status);
}

export async function listSupplierPriceLists({ db, supplierId }) {
  const id = positiveInteger(supplierId);
  if (!id) return errorResult(400, "invalid_supplier_id", "supplierId must be a positive integer.");
  const result = await db.prepare(
    `SELECT id, supplier_id, version_number, status, effective_from, effective_to, note, created_by, created_at, published_at
     FROM supplier_price_lists WHERE supplier_id = ? ORDER BY version_number DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizePriceListRow) });
}

export async function addPriceItem({ db, priceListId, supplierId, furnitureType, material, label, basePriceKzt, unitPriceKzt, unit, sortOrder }) {
  const plid = positiveInteger(priceListId);
  const sid = positiveInteger(supplierId);
  if (!plid || !sid) return errorResult(400, "invalid_ids", "priceListId and supplierId must be positive integers.");
  if (!isValidFurnitureType(furnitureType)) {
    return errorResult(400, "invalid_furniture_type", `furnitureType must be one of: ${FURNITURE_TYPES_FOR_ERROR.join(", ")}`);
  }
  const mat = isValidMaterialTier(material) ? material : "standard";
  const base = positiveInteger(basePriceKzt) || 0;
  const unitPrice = positiveInteger(unitPriceKzt) || 0;

  try {
    const insert = await db.prepare(
      `INSERT INTO supplier_price_items (price_list_id, supplier_id, furniture_type, material, label, base_price_kzt, unit_price_kzt, unit, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(plid, sid, furnitureType, mat, str(label) || `${furnitureType} — ${mat}`, base, unitPrice, str(unit) || "м.п.", positiveInteger(sortOrder) || 0).run();
    const itemId = insert?.meta?.last_row_id;
    return okResult({ item: { id: itemId, priceListId: plid, supplierId: sid, furnitureType, material: mat, label: str(label) || `${furnitureType} — ${mat}`, basePriceKzt: base, unitPriceKzt: unitPrice, unit: str(unit) || "м.п.", sortOrder: positiveInteger(sortOrder) || 0 } }, 201);
  } catch (error) {
    return storageFailure(error);
  }
}

export async function listPriceItems({ db, priceListId }) {
  const id = positiveInteger(priceListId);
  if (!id) return errorResult(400, "invalid_price_list_id", "priceListId must be a positive integer.");
  const result = await db.prepare(
    `SELECT id, price_list_id, supplier_id, furniture_type, material, label, base_price_kzt, unit_price_kzt, unit, sort_order
     FROM supplier_price_items WHERE price_list_id = ? ORDER BY sort_order ASC, id ASC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizePriceItemRow) });
}

export async function publishPriceList({ db, priceListId, effectiveFrom, effectiveTo }) {
  const id = positiveInteger(priceListId);
  if (!id) return errorResult(400, "invalid_price_list_id", "priceListId must be a positive integer.");

  const priceList = await getPriceList({ db, priceListId: id });
  if (!priceList.ok) return priceList;
  if (priceList.body.item.status === SUPPLIER_PRICE_LIST_STATUS.PUBLISHED) {
    return okResult({ item: priceList.body.item });
  }
  if (priceList.body.item.status !== SUPPLIER_PRICE_LIST_STATUS.DRAFT) {
    return errorResult(409, "invalid_status", "Only draft price lists can be published.");
  }

  try {
    await db.prepare(
      `UPDATE supplier_price_lists SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE supplier_id = ? AND status = 'published' AND id != ?`
    ).bind(priceList.body.item.supplierId, id).run();
    await db.prepare(
      `UPDATE supplier_price_lists SET status = 'published', published_at = CURRENT_TIMESTAMP, effective_from = ?, effective_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`
    ).bind(str(effectiveFrom) || null, str(effectiveTo) || null, id).run();
    return getPriceList({ db, priceListId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function archivePriceList({ db, priceListId }) {
  const id = positiveInteger(priceListId);
  if (!id) return errorResult(400, "invalid_price_list_id", "priceListId must be a positive integer.");
  try {
    await db.prepare(
      `UPDATE supplier_price_lists SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(id).run();
    return getPriceList({ db, priceListId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getActivePriceList({ db, supplierId }) {
  const id = positiveInteger(supplierId);
  if (!id) return errorResult(400, "invalid_supplier_id", "supplierId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, supplier_id, version_number, status, effective_from, effective_to, note, created_by, created_at, published_at
     FROM supplier_price_lists WHERE supplier_id = ? AND status = 'published' ORDER BY version_number DESC LIMIT 1`
  ).bind(id).first();
  if (!row) return errorResult(404, "no_active_price_list", "No published price list found for this supplier.");
  return getPriceList({ db, priceListId: row.id, includeItems: true });
}

export async function generateSupplierAwareEstimate({ db, draftId, supplierId, material = "standard", discountPercent }) {
  const did = positiveInteger(draftId);
  const sid = positiveInteger(supplierId);
  if (!did) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  if (!sid) return errorResult(400, "invalid_supplier_id", "supplierId must be a positive integer.");
  const mat = isValidMaterialTier(material) ? material : "standard";

  const draft = await db.prepare(
    `SELECT id, order_id, manifest_json, status FROM pdf_drafts WHERE id = ?`
  ).bind(did).first();
  if (!draft) return errorResult(404, "draft_not_found", "PDF draft was not found.");
  if (draft.status !== "reviewed" && draft.status !== "approved") {
    return errorResult(409, "draft_not_ready", "Draft must be reviewed or approved.");
  }

  const activePriceList = await getActivePriceList({ db, supplierId: sid });
  if (!activePriceList.ok) return activePriceList;
  const priceItems = activePriceList.body.item.items || [];

  let manifest = {};
  try { manifest = JSON.parse(draft.manifest_json || "{}"); } catch { manifest = {}; }
  const zones = collectFurnitureZones(manifest);
  if (!zones.length) return errorResult(409, "no_zones", "Manifest has no furniture zones.");

  const items = zones.map((zone, i) => {
    const pricing = resolveSupplierPricing(priceItems, zone.zoneType, mat);
    const widthMm = zone.dimensions?.widthMm || zone.dimensions?.lengthMm || 0;
    const units = Math.max(1, Math.ceil(widthMm / 1000));
    const basePrice = pricing?.basePriceKzt ?? 0;
    const unitPrice = pricing?.unitPriceKzt ?? 0;
    const subtotal = basePrice + unitPrice * units;
    return {
      line: i + 1,
      label: zone.label || zone.zoneType,
      furnitureType: zone.zoneType,
      material: mat,
      units,
      basePrice,
      unitPrice,
      subtotal,
      pricingSource: pricing?.source || "no_match",
      supplierId: sid
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.round(subtotal * (Number(discountPercent) || 0) / 100);
  const estimate = {
    estimateVersion: "supplier-estimate/v1",
    source: { draftId: did, orderId: draft.order_id, supplierId: sid, priceListId: activePriceList.body.item.id },
    items,
    totals: { itemCount: items.length, subtotal, discount, total: subtotal - discount },
    warnings: items.filter((i) => i.pricingSource !== "exact").map((i) => `Line ${i.line}: no exact price match for ${i.furnitureType}/${mat}, used ${i.pricingSource}`)
  };

  try {
    const insert = await db.prepare(
      `INSERT INTO pdf_estimates (draft_id, order_id, estimate_version, estimate_json, total_kzt, item_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(did, draft.order_id, "supplier-estimate/v1", JSON.stringify(estimate), estimate.totals.total, estimate.totals.itemCount).run();
    const estimateId = insert?.meta?.last_row_id;

    await db.prepare(
      `INSERT INTO supplier_estimate_links (estimate_id, price_list_id, supplier_id) VALUES (?, ?, ?)`
    ).bind(estimateId, activePriceList.body.item.id, sid).run();

    return okResult({ estimateId, draftId: did, supplierId: sid, priceListId: activePriceList.body.item.id, estimate }, 201);
  } catch (error) {
    return storageFailure(error);
  }
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "supplier_conflict", "Supplier record could not be saved.");
  }
  return errorResult(500, "supplier_storage_failed", "Supplier record could not be stored.");
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function str(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function okResult(body, status = 200) {
  return { ok: true, status, body: { success: true, ...body } };
}

function errorResult(status, error, message) {
  return { ok: false, status, body: { success: false, error, message } };
}

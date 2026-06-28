import { PDF_FURNITURE_ZONE_TYPES } from "../pdf/pdf-manifest.js";

export const SUPPLIER_PRICE_LIST_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived"
});

export const SUPPLIER_MATERIAL_TIERS = Object.freeze([
  "standard", "premium", "luxury", "economy"
]);

export function isValidMaterialTier(material) {
  return SUPPLIER_MATERIAL_TIERS.includes(material);
}

export function isValidPriceListStatus(status) {
  return Object.values(SUPPLIER_PRICE_LIST_STATUS).includes(status);
}

export function isValidFurnitureType(type) {
  return PDF_FURNITURE_ZONE_TYPES.includes(type);
}

export function normalizeSupplierRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    contact: row.contact || null,
    phone: row.phone || null,
    email: row.email || null,
    note: row.note || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function normalizePriceListRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    supplierId: Number(row.supplier_id),
    versionNumber: Number(row.version_number) || 1,
    status: row.status,
    effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null,
    note: row.note || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at || null
  };
}

export function normalizePriceItemRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    priceListId: Number(row.price_list_id),
    supplierId: Number(row.supplier_id),
    furnitureType: row.furniture_type,
    material: row.material || "standard",
    label: row.label,
    basePriceKzt: Number(row.base_price_kzt) || 0,
    unitPriceKzt: Number(row.unit_price_kzt) || 0,
    unit: row.unit || "м.п.",
    sortOrder: Number(row.sort_order) || 0
  };
}

export function buildPriceItemDefaults(furnitureType, material = "standard") {
  if (!isValidFurnitureType(furnitureType)) return null;
  if (!isValidMaterialTier(material)) return null;
  const defaults = DEFAULT_PRICE_HINTS[furnitureType] || DEFAULT_PRICE_HINTS.other;
  return {
    furnitureType,
    material,
    label: `${furnitureType} — ${material}`,
    basePriceKzt: defaults.base,
    unitPriceKzt: defaults.unit,
    unit: "м.п.",
    sortOrder: 0
  };
}

const DEFAULT_PRICE_HINTS = Object.freeze({
  kitchen: { base: 15000, unit: 45000 },
  wardrobe: { base: 10000, unit: 35000 },
  walk_in_closet: { base: 12000, unit: 40000 },
  bathroom: { base: 8000, unit: 30000 },
  hallway: { base: 6000, unit: 25000 },
  kids: { base: 8000, unit: 28000 },
  office: { base: 10000, unit: 32000 },
  tvzone: { base: 8000, unit: 30000 },
  commercial: { base: 20000, unit: 55000 },
  storage: { base: 6000, unit: 22000 },
  bedroom: { base: 12000, unit: 38000 },
  cabinet: { base: 8000, unit: 28000 },
  other: { base: 8000, unit: 30000 }
});

export function resolveSupplierPricing(priceItems, furnitureType, material = "standard") {
  if (!Array.isArray(priceItems) || !priceItems.length) return null;
  const exact = priceItems.find((p) => p.furnitureType === furnitureType && p.material === material);
  if (exact) return { basePriceKzt: exact.basePriceKzt, unitPriceKzt: exact.unitPriceKzt, unit: exact.unit, source: "exact" };
  const typeStandard = priceItems.find((p) => p.furnitureType === furnitureType && p.material === "standard");
  if (typeStandard) return { basePriceKzt: typeStandard.basePriceKzt, unitPriceKzt: typeStandard.unitPriceKzt, unit: typeStandard.unit, source: "type_fallback" };
  const typeMatch = priceItems.find((p) => p.furnitureType === furnitureType);
  if (typeMatch) return { basePriceKzt: typeMatch.basePriceKzt, unitPriceKzt: typeMatch.unitPriceKzt, unit: typeMatch.unit, source: "type_fallback" };
  const standard = priceItems.find((p) => p.furnitureType === "other" && p.material === "standard");
  if (standard) return { basePriceKzt: standard.basePriceKzt, unitPriceKzt: standard.unitPriceKzt, unit: standard.unit, source: "standard_fallback" };
  return null;
}

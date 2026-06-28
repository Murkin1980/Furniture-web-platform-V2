export const PDF_MANIFEST_VERSION = "project-pdf-manifest/v2";
export const PDF_PAGE_TYPES = Object.freeze([
  "floor_plan", "elevation", "visualization", "specification", "text", "mixed", "unknown"
]);
export const PDF_FURNITURE_ZONE_TYPES = Object.freeze([
  "kitchen", "wardrobe", "walk_in_closet", "bathroom", "hallway",
  "kids", "office", "tvzone", "commercial", "storage", "bedroom", "cabinet", "other"
]);
export const PDF_UPLOAD_STATUS = Object.freeze({
  UPLOADED: "uploaded",
  ANALYZING: "analyzing",
  ANALYZED: "analyzed",
  FAILED: "failed"
});
export const PDF_DRAFT_STATUS = Object.freeze({
  DRAFT: "draft",
  REVIEWED: "reviewed",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed"
});
export const PDF_ESTIMATE_VERSION = "pdf-estimate/v2";

const DEFAULT_PRICES_BY_ZONE = Object.freeze({
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

export function getDefaultProjectPdfManifest() {
  return {
    manifestVersion: PDF_MANIFEST_VERSION,
    document: {
      orderId: null,
      fileName: "",
      fileSizeBytes: null,
      mimeType: "application/pdf",
      checksum: "",
      source: "order_admin",
      uploadedBy: "manager"
    },
    pageCount: 0,
    pages: [],
    rooms: [],
    warnings: []
  };
}

export function buildProjectPdfManifest(input = {}) {
  const manifest = getDefaultProjectPdfManifest();
  const doc = input.document || {};
  manifest.document = {
    orderId: numOrNull(doc.orderId ?? doc.order_id),
    fileName: str(doc.fileName ?? doc.file_name),
    fileSizeBytes: numOrNull(doc.fileSizeBytes ?? doc.file_size_bytes),
    mimeType: str(doc.mimeType ?? doc.mime_type) || "application/pdf",
    checksum: str(doc.checksum),
    source: str(doc.source) || "order_admin",
    uploadedBy: str(doc.uploadedBy ?? doc.uploaded_by) || "manager"
  };
  manifest.pageCount = numOrNull(input.pageCount ?? input.page_count) || 0;
  manifest.pages = (input.pages || []).map(normalizePage).filter(Boolean);
  manifest.rooms = (input.rooms || []).map(normalizeRoom).filter(Boolean);
  manifest.warnings = arr(input.warnings);
  return manifest;
}

export function validateProjectPdfManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: [{ field: "manifest", message: "Manifest must be an object." }], warnings, manifest: null };
  }
  if (manifest.manifestVersion !== PDF_MANIFEST_VERSION) {
    warnings.push(`manifestVersion is "${manifest.manifestVersion}", expected "${PDF_MANIFEST_VERSION}".`);
  }
  if (!manifest.document?.fileName) {
    errors.push({ field: "document.fileName", message: "Document fileName is required." });
  }
  if (!Number.isInteger(manifest.pageCount) || manifest.pageCount < 0) {
    errors.push({ field: "pageCount", message: "pageCount must be a non-negative integer." });
  }
  if (!Array.isArray(manifest.pages)) {
    errors.push({ field: "pages", message: "pages must be an array." });
  } else {
    manifest.pages.forEach((page, i) => {
      if (!PDF_PAGE_TYPES.includes(page.pageType)) {
        warnings.push(`Page ${page.pageNumber || i + 1}: unknown pageType "${page.pageType}".`);
      }
      (page.furnitureZones || []).forEach((zone, j) => {
        if (!PDF_FURNITURE_ZONE_TYPES.includes(zone.zoneType)) {
          warnings.push(`Page ${page.pageNumber || i + 1} zone ${j + 1}: unknown zoneType "${zone.zoneType}".`);
        }
      });
    });
  }
  return { ok: errors.length === 0, errors, warnings, manifest };
}

export function isSupportedPdfFile(fileName, mimeType) {
  const name = str(fileName).toLowerCase();
  const mime = str(mimeType).toLowerCase();
  return name.endsWith(".pdf") || mime === "application/pdf";
}

export function getDefaultPdfEstimate() {
  return {
    estimateVersion: PDF_ESTIMATE_VERSION,
    source: { draftId: null, orderId: null },
    items: [],
    totals: { itemCount: 0, subtotal: 0, discount: 0, total: 0 },
    warnings: [],
    notes: []
  };
}

export function generatePdfEstimate(manifest, options = {}) {
  const estimate = getDefaultPdfEstimate();
  if (!manifest?.pages && !manifest?.rooms) return estimate;

  const zones = collectFurnitureZones(manifest);
  const discountPercent = clampNum(options.discountPercent, 0, 95, 0);

  estimate.source.orderId = manifest.document?.orderId || null;
  estimate.items = zones.map((zone, i) => {
    const pricing = DEFAULT_PRICES_BY_ZONE[zone.zoneType] || DEFAULT_PRICES_BY_ZONE.other;
    const widthMm = zone.dimensions?.widthMm || zone.dimensions?.lengthMm || 0;
    const units = Math.max(1, Math.ceil(widthMm / 1000));
    const subtotal = pricing.base + pricing.unit * units;
    return {
      line: i + 1,
      label: zone.label || zone.zoneType,
      furnitureType: zone.zoneType,
      units,
      basePrice: pricing.base,
      unitPrice: pricing.unit,
      subtotal
    };
  });

  const subtotal = estimate.items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Math.round(subtotal * discountPercent / 100);
  estimate.totals = {
    itemCount: estimate.items.length,
    subtotal,
    discount,
    total: subtotal - discount
  };

  if (!zones.length) estimate.warnings.push("No furniture zones found in manifest.");
  return estimate;
}

export function mapPdfEstimateToProposalLines(estimate) {
  if (!estimate?.items?.length) return { items: [], total: 0 };
  const items = estimate.items.map((item) => ({
    line: item.line,
    label: item.label,
    quantity: Math.max(1, Math.round(item.units)),
    unit: "м.п.",
    unitPrice: item.unitPrice,
    basePrice: item.basePrice,
    total: item.basePrice + item.unitPrice * Math.max(1, Math.round(item.units))
  }));
  const total = items.reduce((sum, item) => sum + item.total, 0);
  return { items, total };
}

export function normalizePage(rawPage) {
  if (!rawPage || typeof rawPage !== "object") return null;
  return {
    pageNumber: Number(rawPage.pageNumber) || 1,
    widthMm: numOrNull(rawPage.widthMm ?? rawPage.width_mm),
    heightMm: numOrNull(rawPage.heightMm ?? rawPage.height_mm),
    rotation: [0, 90, 180, 270].includes(Number(rawPage.rotation)) ? Number(rawPage.rotation) : 0,
    pageType: PDF_PAGE_TYPES.includes(rawPage.pageType) ? rawPage.pageType : "unknown",
    confidence: clampNum(rawPage.confidence, 0, 1, 0),
    roomLabel: str(rawPage.roomLabel ?? rawPage.room_label),
    furnitureZones: (rawPage.furnitureZones || rawPage.furniture_zones || []).map(normalizeFurnitureZone).filter(Boolean),
    missingInfo: arr(rawPage.missingInfo ?? rawPage.missing_info),
    warnings: arr(rawPage.warnings)
  };
}

export function normalizeRoom(rawRoom) {
  if (!rawRoom || typeof rawRoom !== "object") return null;
  return {
    id: str(rawRoom.id) || `room-${Date.now()}`,
    label: str(rawRoom.label),
    sourcePages: arr(rawRoom.sourcePages ?? rawRoom.source_pages).map(Number),
    confidence: clampNum(rawRoom.confidence, 0, 1, 0),
    furnitureZones: (rawRoom.furnitureZones || rawRoom.furniture_zones || []).map(normalizeFurnitureZone).filter(Boolean),
    missingInfo: arr(rawRoom.missingInfo ?? rawRoom.missing_info),
    warnings: arr(rawRoom.warnings)
  };
}

export function normalizeFurnitureZone(rawZone) {
  if (!rawZone || typeof rawZone !== "object") return null;
  const dims = rawZone.dimensions || {};
  return {
    id: str(rawZone.id) || `zone-${Math.random().toString(36).slice(2, 8)}`,
    zoneType: PDF_FURNITURE_ZONE_TYPES.includes(rawZone.zoneType) ? rawZone.zoneType : "other",
    label: str(rawZone.label),
    roomId: str(rawZone.roomId ?? rawRoom_room_id(rawZone)),
    roomLabel: str(rawZone.roomLabel ?? rawZone.room_label),
    sourcePage: numOrNull(rawZone.sourcePage ?? rawZone.source_page),
    confidence: clampNum(rawZone.confidence, 0, 1, 0),
    dimensions: {
      widthMm: numOrNull(dims.widthMm ?? dims.width_mm),
      heightMm: numOrNull(dims.heightMm ?? dims.height_mm),
      depthMm: numOrNull(dims.depthMm ?? dims.depth_mm),
      lengthMm: numOrNull(dims.lengthMm ?? dims.length_mm),
      note: str(dims.note)
    },
    materials: arr(rawZone.materials),
    missingInfo: arr(rawZone.missingInfo ?? rawZone.missing_info),
    warnings: arr(rawZone.warnings)
  };
}

export function normalizePdfUploadRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    engagementId: row.engagement_id ? Number(row.engagement_id) : null,
    fileName: row.file_name,
    fileSizeBytes: numOrNull(row.file_size_bytes),
    mimeType: row.mime_type,
    pageCount: Number(row.page_count) || 0,
    checksum: row.checksum,
    source: row.source,
    uploadedBy: row.uploaded_by,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function normalizePdfDraftRow(row) {
  if (!row) return null;
  let manifest = {};
  try { manifest = JSON.parse(row.manifest_json || "{}"); } catch { manifest = {}; }
  return {
    id: Number(row.id),
    uploadId: row.upload_id ? Number(row.upload_id) : null,
    orderId: Number(row.order_id),
    engagementId: row.engagement_id ? Number(row.engagement_id) : null,
    manifestVersion: row.manifest_version,
    manifest: manifest,
    manifestJson: row.manifest_json,
    status: row.status,
    aiProvider: row.ai_provider || null,
    aiModel: row.ai_model || null,
    processingTimeMs: numOrNull(row.processing_time_ms),
    analysisVersion: row.analysis_version || null,
    error: row.error || null,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    reviewNote: row.review_note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function normalizePdfEstimateRow(row) {
  if (!row) return null;
  let estimate = {};
  try { estimate = JSON.parse(row.estimate_json || "{}"); } catch { estimate = {}; }
  return {
    id: Number(row.id),
    draftId: Number(row.draft_id),
    orderId: Number(row.order_id),
    estimateVersion: row.estimate_version,
    estimate: estimate,
    totalKzt: Number(row.total_kzt) || 0,
    itemCount: Number(row.item_count) || 0,
    createdAt: row.created_at
  };
}

export function collectFurnitureZones(manifest) {
  const zones = [];
  const seen = new Set();
  for (const room of manifest.rooms || []) {
    for (const zone of room.furnitureZones || []) {
      const key = `${zone.id}:${zone.label}`;
      if (!seen.has(key)) { seen.add(key); zones.push(zone); }
    }
  }
  for (const page of manifest.pages || []) {
    for (const zone of page.furnitureZones || []) {
      const key = `${zone.id}:${zone.label}`;
      if (!seen.has(key)) { seen.add(key); zones.push(zone); }
    }
  }
  return zones;
}

export function extractDimensionsFromManifest(manifest) {
  const zones = collectFurnitureZones(manifest);
  return zones.map((zone) => ({
    label: zone.label || zone.zoneType,
    zoneType: zone.zoneType,
    widthMm: zone.dimensions?.widthMm || null,
    heightMm: zone.dimensions?.heightMm || null,
    depthMm: zone.dimensions?.depthMm || null,
    lengthMm: zone.dimensions?.lengthMm || null,
    note: zone.dimensions?.note || "",
    sourcePage: zone.sourcePage,
    confidence: zone.confidence
  })).filter((d) => d.widthMm || d.heightMm || d.depthMm || d.lengthMm);
}

function rawRoom_room_id(zone) {
  return zone.roomId ?? zone.room_id;
}

function str(v) { return v === undefined || v === null ? "" : String(v).trim(); }
function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function arr(v) { return Array.isArray(v) ? v.map(String) : []; }
function clampNum(v, min, max, fallback) { const n = Number(v); if (!Number.isFinite(n)) return fallback; return Math.max(min, Math.min(max, n)); }

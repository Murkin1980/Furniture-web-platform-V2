import {
  PACKAGE_CODES,
  VISUAL_STATE,
  PROPOSAL_DEPTH
} from "./package-catalog.js";

export const DELIVERABLE_TYPES = Object.freeze({
  BW_PREVIEW_SHEET: "bw_preview_sheet",
  COLOR_VIEW_SET: "color_view_set",
  DIMENSIONS_SHEET: "dimensions_sheet",
  COMMERCIAL_PROPOSAL: "commercial_proposal",
  LINE_ITEM_ESTIMATE: "line_item_estimate",
  LAYOUT_VARIANTS: "layout_variants",
  INCLUSIONS_SHEET: "inclusions_sheet",
  RECOMMENDED_MATERIALS: "recommended_materials"
});

export const DELIVERABLE_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  READY: "ready",
  DELIVERED: "delivered",
  REVISION_REQUESTED: "revision_requested"
});

export const ARTIFACT_FORMATS = Object.freeze({
  PNG: "png",
  JPEG: "jpeg",
  PDF: "pdf",
  HTML: "html",
  SVG: "svg"
});

const PACKAGE_DELIVERABLE_SPECS = Object.freeze([
  {
    packageCode: PACKAGE_CODES.LEVEL_1,
    visualState: VISUAL_STATE.NONE,
    deliverables: []
  },
  {
    packageCode: PACKAGE_CODES.PACKAGE_A,
    visualState: VISUAL_STATE.BW_PREVIEW,
    deliverables: [
      { type: DELIVERABLE_TYPES.COMMERCIAL_PROPOSAL, label: "Коммерческое предложение", sortOrder: 1 },
      { type: DELIVERABLE_TYPES.LINE_ITEM_ESTIMATE, label: "Смета по позициям", sortOrder: 2 },
      { type: DELIVERABLE_TYPES.BW_PREVIEW_SHEET, label: "Чёрно-белый превью-лист", sortOrder: 3 }
    ]
  },
  {
    packageCode: PACKAGE_CODES.PACKAGE_B,
    visualState: VISUAL_STATE.COLOR_MULTI_VIEW,
    deliverables: [
      { type: DELIVERABLE_TYPES.COLOR_VIEW_SET, label: "Цветной визуал (несколько проекций)", sortOrder: 1 },
      { type: DELIVERABLE_TYPES.COMMERCIAL_PROPOSAL, label: "Коммерческое предложение", sortOrder: 2 },
      { type: DELIVERABLE_TYPES.DIMENSIONS_SHEET, label: "Подробные размеры мебели", sortOrder: 3 },
      { type: DELIVERABLE_TYPES.LAYOUT_VARIANTS, label: "2–3 варианта компоновки", sortOrder: 4 },
      { type: DELIVERABLE_TYPES.INCLUSIONS_SHEET, label: "Лист «что входит / что не входит»", sortOrder: 5 },
      { type: DELIVERABLE_TYPES.RECOMMENDED_MATERIALS, label: "Рекомендуемые материалы", sortOrder: 6 }
    ]
  }
]);

export function getDeliverableSpec(packageCode) {
  const spec = PACKAGE_DELIVERABLE_SPECS.find((s) => s.packageCode === packageCode);
  return spec ? { packageCode: spec.packageCode, visualState: spec.visualState, deliverables: spec.deliverables.map((d) => ({ ...d })) } : null;
}

export function listAllDeliverableSpecs() {
  return PACKAGE_DELIVERABLE_SPECS.map((s) => ({
    packageCode: s.packageCode,
    visualState: s.visualState,
    deliverables: s.deliverables.map((d) => ({ ...d }))
  }));
}

export function isValidDeliverableType(type) {
  return Object.values(DELIVERABLE_TYPES).includes(type);
}

export function isValidDeliverableStatus(status) {
  return Object.values(DELIVERABLE_STATUS).includes(status);
}

export function isValidArtifactFormat(format) {
  return Object.values(ARTIFACT_FORMATS).includes(format);
}

export function buildDeliverableDefaults(packageCode) {
  const spec = getDeliverableSpec(packageCode);
  if (!spec) return [];
  return spec.deliverables.map((d) => ({
    deliverableType: d.type,
    label: d.label,
    status: DELIVERABLE_STATUS.PENDING,
    sortOrder: d.sortOrder
  }));
}

export function normalizeDeliverableRow(row) {
  if (!row) return null;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata_json || "{}"); } catch { metadata = {}; }
  return {
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
  };
}

export function normalizeRevisionRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    deliverableId: Number(row.deliverable_id),
    revisionNumber: Number(row.revision_number) || 1,
    requestedBy: row.requested_by,
    requestNote: row.request_note || null,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at || null,
    resolution: row.resolution || null
  };
}

export function describePackageVisualState(packageCode) {
  const spec = getDeliverableSpec(packageCode);
  if (!spec) return "Нет визуального стандарта для этого пакета.";
  if (spec.visualState === VISUAL_STATE.NONE) return "Level 1: без визуала, только ориентир по цене.";
  if (spec.visualState === VISUAL_STATE.BW_PREVIEW) return "Package A: чёрно-белый превью-лист, 1 ракурс.";
  if (spec.visualState === VISUAL_STATE.COLOR_MULTI_VIEW) return "Package B: цветной визуал, несколько проекций, 2–3 варианта компоновки.";
  return spec.visualState;
}

export function getPackageDeliverableSummary(packageCode) {
  const spec = getDeliverableSpec(packageCode);
  if (!spec || !spec.deliverables.length) return { packageCode, total: 0, items: [] };
  return {
    packageCode,
    visualState: spec.visualState,
    total: spec.deliverables.length,
    items: spec.deliverables.map((d) => ({ type: d.type, label: d.label, sortOrder: d.sortOrder }))
  };
}

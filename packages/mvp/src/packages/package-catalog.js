export const PACKAGE_CODES = Object.freeze({
  LEVEL_1: "level_1",
  PACKAGE_A: "package_a",
  PACKAGE_B: "package_b",
  PACKAGE_C: "package_c"
});

export const PACKAGE_READINESS = Object.freeze({
  ACTIVE: "active",
  DRAFT: "draft"
});

export const ENGAGEMENT_LEVELS = Object.freeze({
  ROUGH_QUOTE: "rough_quote",
  PACKAGE_A: "package_a",
  PACKAGE_B: "package_b",
  PACKAGE_C: "package_c",
  PRODUCTION_ORDER: "production_order"
});

export const ENGAGEMENT_STATUS = Object.freeze({
  OFFERED: "offered",
  ACCEPTED: "accepted",
  PAID: "paid",
  IN_PROGRESS: "in_progress",
  DELIVERED: "delivered",
  CREDITED: "credited",
  DECLINED: "declined"
});

export const VISUAL_STATE = Object.freeze({
  NONE: "none",
  BW_PREVIEW: "bw_preview",
  COLOR_MULTI_VIEW: "color_multi_view",
  DELIVERED: "delivered"
});

export const PROPOSAL_DEPTH = Object.freeze({
  NONE: "none",
  ROUGH: "rough",
  STANDARD: "standard",
  DETAILED: "detailed"
});

export const SOURCE_MATERIAL_TYPE = Object.freeze({
  MANUAL: "manual",
  PDF: "pdf",
  CALCULATOR: "calculator",
  OTHER: "other"
});

export const UPGRADE_OFFER_STATE = Object.freeze({
  NONE: "none",
  OFFERED: "offered",
  ACCEPTED: "accepted",
  DECLINED: "declined"
});

const CATALOG_SEED = Object.freeze([
  {
    code: PACKAGE_CODES.LEVEL_1,
    name: "Быстрый ориентир",
    priceKzt: 0,
    creditedOnOrder: false,
    readiness: PACKAGE_READINESS.ACTIVE,
    isSellable: true,
    deliverables: ["rough_price_per_meter", "no_estimate", "no_visual"],
    engagementLevel: ENGAGEMENT_LEVELS.ROUGH_QUOTE,
    visualState: VISUAL_STATE.NONE,
    proposalDepth: PROPOSAL_DEPTH.ROUGH,
    maxRevisions: 0,
    sortOrder: 1
  },
  {
    code: PACKAGE_CODES.PACKAGE_A,
    name: "Package A — 10 000 тг",
    priceKzt: 10000,
    creditedOnOrder: true,
    readiness: PACKAGE_READINESS.ACTIVE,
    isSellable: true,
    deliverables: ["commercial_proposal", "line_item_estimate", "bw_preview_visual"],
    engagementLevel: ENGAGEMENT_LEVELS.PACKAGE_A,
    visualState: VISUAL_STATE.BW_PREVIEW,
    proposalDepth: PROPOSAL_DEPTH.STANDARD,
    maxRevisions: 0,
    sortOrder: 2
  },
  {
    code: PACKAGE_CODES.PACKAGE_B,
    name: "Package B — 20 000 тг",
    priceKzt: 20000,
    creditedOnOrder: true,
    readiness: PACKAGE_READINESS.ACTIVE,
    isSellable: true,
    deliverables: [
      "color_multi_view_visual",
      "commercial_proposal",
      "detailed_dimensions",
      "2_3_layout_variants",
      "one_revision_round",
      "inclusions_sheet",
      "recommended_materials"
    ],
    engagementLevel: ENGAGEMENT_LEVELS.PACKAGE_B,
    visualState: VISUAL_STATE.COLOR_MULTI_VIEW,
    proposalDepth: PROPOSAL_DEPTH.DETAILED,
    maxRevisions: 1,
    sortOrder: 3
  },
  {
    code: PACKAGE_CODES.PACKAGE_C,
    name: "Package C — Designer / 3D Handoff",
    priceKzt: 0,
    priceConfigurable: true,
    creditedOnOrder: true,
    readiness: PACKAGE_READINESS.DRAFT,
    isSellable: false,
    deliverables: [
      "color_multi_view_visual",
      "commercial_proposal",
      "detailed_dimensions",
      "material_spec",
      "skp_model",
      "obj_model",
      "glb_model"
    ],
    plannedDeliverables: ["viewer_link"],
    readinessNote: "Package C is not sellable until Phase 4.6d GLB viewer and deployment boundary are complete.",
    engagementLevel: ENGAGEMENT_LEVELS.PACKAGE_C,
    visualState: VISUAL_STATE.COLOR_MULTI_VIEW,
    proposalDepth: PROPOSAL_DEPTH.DETAILED,
    maxRevisions: 2,
    sortOrder: 4,
    targetUserType: "interior_designer",
    designerHandoffRequired: true,
    required3dFormats: ["skp", "obj", "glb"],
    fileAccessPolicy: "package_c_full"
  }
]);

export function getPackageDefinition(code) {
  const definition = CATALOG_SEED.find((item) => item.code === code);
  return definition ? cloneDefinition(definition) : null;
}

export function listPackageDefinitions() {
  return CATALOG_SEED.map(cloneDefinition).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isValidPackageCode(code) {
  return Object.values(PACKAGE_CODES).includes(code);
}

export function isValidEngagementLevel(level) {
  return Object.values(ENGAGEMENT_LEVELS).includes(level);
}

export function isValidEngagementStatus(status) {
  return Object.values(ENGAGEMENT_STATUS).includes(status);
}

export function isValidVisualState(state) {
  return Object.values(VISUAL_STATE).includes(state);
}

export function isValidProposalDepth(depth) {
  return Object.values(PROPOSAL_DEPTH).includes(depth);
}

export function isValidSourceMaterialType(type) {
  return Object.values(SOURCE_MATERIAL_TYPE).includes(type);
}

export function isValidUpgradeOfferState(state) {
  return Object.values(UPGRADE_OFFER_STATE).includes(state);
}

export function normalizeCatalogRow(row) {
  if (!row) return null;
  let deliverables = [];
  try { deliverables = JSON.parse(row.deliverables_json || "[]"); } catch { deliverables = []; }
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    priceKzt: Number(row.price_kzt) || 0,
    creditedOnOrder: Boolean(row.credited_on_order),
    deliverables,
    sortOrder: Number(row.sort_order) || 0,
    isActive: Boolean(row.is_active)
  };
}

export function buildEngagementDefaults(packageCode) {
  const definition = getPackageDefinition(packageCode);
  if (!definition) return null;
  return {
    packageCode: definition.code,
    engagementLevel: definition.engagementLevel,
    priceKzt: definition.priceKzt,
    creditedOnOrder: definition.creditedOnOrder,
    visualState: VISUAL_STATE.NONE,
    proposalDepth: definition.proposalDepth,
    revisionRound: 0,
    maxRevisions: definition.maxRevisions,
    sourceMaterialType: SOURCE_MATERIAL_TYPE.MANUAL,
    upgradeOfferState: UPGRADE_OFFER_STATE.NONE,
    status: ENGAGEMENT_STATUS.OFFERED
  };
}

function cloneDefinition(definition) {
  return {
    ...definition,
    deliverables: [...definition.deliverables],
    plannedDeliverables: definition.plannedDeliverables ? [...definition.plannedDeliverables] : undefined,
    required3dFormats: definition.required3dFormats ? [...definition.required3dFormats] : undefined
  };
}

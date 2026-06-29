import {
  PDF_MANIFEST_VERSION,
  PDF_ESTIMATE_VERSION,
  PDF_DRAFT_STATUS,
  PDF_UPLOAD_STATUS,
  buildProjectPdfManifest,
  validateProjectPdfManifest,
  isSupportedPdfFile,
  getDefaultPdfEstimate,
  generatePdfEstimate,
  mapPdfEstimateToProposalLines,
  normalizePdfUploadRow,
  normalizePdfDraftRow,
  normalizePdfEstimateRow,
  collectFurnitureZones,
  extractDimensionsFromManifest
} from "./pdf-manifest.js";

export async function createPdfUpload({ db, orderId, fileName, fileSizeBytes, mimeType, pageCount, checksum, engagementId, uploadedBy = "manager" }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  if (!fileName || typeof fileName !== "string") {
    return errorResult(400, "invalid_file_name", "fileName is required.");
  }
  if (!isSupportedPdfFile(fileName, mimeType)) {
    return errorResult(400, "unsupported_file_type", "File must be a PDF.");
  }

  const order = await db.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
  if (!order) return errorResult(404, "order_not_found", "Order was not found.");

  try {
    const insert = await db.prepare(
      `INSERT INTO pdf_uploads (order_id, engagement_id, file_name, file_size_bytes, mime_type, page_count, checksum, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')`
    ).bind(id, positiveInteger(engagementId) || null, fileName, positiveInteger(fileSizeBytes) || null, mimeType || "application/pdf", positiveInteger(pageCount) || 0, str(checksum), str(uploadedBy) || "manager").run();
    const uploadId = insert?.meta?.last_row_id;
    if (!positiveInteger(uploadId)) throw new Error("Upload insert did not return an id.");
    return getPdfUpload({ db, uploadId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getPdfUpload({ db, uploadId, status = 200 }) {
  const id = positiveInteger(uploadId);
  if (!id) return errorResult(400, "invalid_upload_id", "uploadId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, order_id, engagement_id, file_name, file_size_bytes, mime_type, page_count, checksum, source, uploaded_by, status, created_at, updated_at
     FROM pdf_uploads WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "upload_not_found", "PDF upload was not found.");
  return okResult({ item: normalizePdfUploadRow(row) }, status);
}

export async function listOrderPdfUploads({ db, orderId }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  const result = await db.prepare(
    `SELECT id, order_id, engagement_id, file_name, file_size_bytes, mime_type, page_count, checksum, source, uploaded_by, status, created_at, updated_at
     FROM pdf_uploads WHERE order_id = ? ORDER BY created_at DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizePdfUploadRow) });
}

export async function createPdfDraft({ db, uploadId, orderId, manifest, engagementId, createdBy = "manager" }) {
  const oid = positiveInteger(orderId);
  if (!oid) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");

  const order = await db.prepare("SELECT id FROM orders WHERE id = ?").bind(oid).first();
  if (!order) return errorResult(404, "order_not_found", "Order was not found.");

  const builtManifest = buildProjectPdfManifest(manifest || {});
  builtManifest.document.orderId = oid;
  if (positiveInteger(uploadId)) {
    const upload = await db.prepare("SELECT file_name, file_size_bytes, mime_type, page_count FROM pdf_uploads WHERE id = ?").bind(uploadId).first();
    if (upload) {
      builtManifest.document.fileName = builtManifest.document.fileName || upload.file_name;
      builtManifest.document.fileSizeBytes = builtManifest.document.fileSizeBytes || upload.file_size_bytes;
      builtManifest.document.mimeType = upload.mime_type || builtManifest.document.mimeType;
      builtManifest.pageCount = builtManifest.pageCount || upload.page_count || 0;
    }
  }

  const validation = validateProjectPdfManifest(builtManifest);
  if (!validation.ok) {
    return errorResult(400, "invalid_manifest", validation.errors.map((e) => `${e.field}: ${e.message}`).join("; "));
  }

  const manifestJson = JSON.stringify(builtManifest);
  try {
    const insert = await db.prepare(
      `INSERT INTO pdf_drafts (upload_id, order_id, engagement_id, manifest_version, manifest_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`
    ).bind(positiveInteger(uploadId) || null, oid, positiveInteger(engagementId) || null, PDF_MANIFEST_VERSION, manifestJson, str(createdBy) || "manager").run();
    const draftId = insert?.meta?.last_row_id;
    if (!positiveInteger(draftId)) throw new Error("Draft insert did not return an id.");
    return getPdfDraft({ db, draftId, status: 201 });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getPdfDraft({ db, draftId, status = 200 }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, upload_id, order_id, engagement_id, manifest_version, manifest_json, status,
            ai_provider, ai_model, processing_time_ms, analysis_version, error,
            created_by, reviewed_by, reviewed_at, review_note, created_at, updated_at
     FROM pdf_drafts WHERE id = ?`
  ).bind(id).first();
  if (!row) return errorResult(404, "draft_not_found", "PDF draft was not found.");
  return okResult({ item: normalizePdfDraftRow(row) }, status);
}

export async function listOrderPdfDrafts({ db, orderId }) {
  const id = positiveInteger(orderId);
  if (!id) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  const result = await db.prepare(
    `SELECT id, upload_id, order_id, engagement_id, manifest_version, manifest_json, status,
            ai_provider, ai_model, processing_time_ms, analysis_version, error,
            created_by, reviewed_by, reviewed_at, review_note, created_at, updated_at
     FROM pdf_drafts WHERE order_id = ? ORDER BY created_at DESC, id DESC`
  ).bind(id).all();
  return okResult({ items: (result?.results || []).map(normalizePdfDraftRow) });
}

export async function updatePdfDraftManifest({ db, draftId, manifest, aiProvider, aiModel, processingTimeMs, analysisVersion }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");

  const builtManifest = buildProjectPdfManifest(manifest || {});
  const manifestJson = JSON.stringify(builtManifest);

  try {
    const result = await db.prepare(
      `UPDATE pdf_drafts
       SET manifest_json = ?, ai_provider = ?, ai_model = ?, processing_time_ms = ?, analysis_version = ?, status = 'reviewed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(manifestJson, str(aiProvider) || null, str(aiModel) || null, positiveInteger(processingTimeMs) || null, str(analysisVersion) || null, id).run();
    if (Number(result?.meta?.changes) === 0) {
      return errorResult(404, "draft_not_found", "PDF draft was not found.");
    }
    return getPdfDraft({ db, draftId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function reviewPdfDraft({ db, draftId, status, reviewedBy = "manager", reviewNote, manifest }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  if (status !== PDF_DRAFT_STATUS.APPROVED && status !== PDF_DRAFT_STATUS.REJECTED) {
    return errorResult(400, "invalid_review_status", "status must be 'approved' or 'rejected'.");
  }

  const draft = await getPdfDraft({ db, draftId: id });
  if (!draft.ok) return draft;
  if (draft.body.item.status === PDF_DRAFT_STATUS.APPROVED) {
    return errorResult(409, "already_approved", "Draft is already approved.");
  }

  const updates = [`status = ?`, `reviewed_by = ?`, `reviewed_at = CURRENT_TIMESTAMP`, `updated_at = CURRENT_TIMESTAMP`];
  const values = [status, str(reviewedBy) || "manager"];
  if (reviewNote !== undefined) { updates.push(`review_note = ?`); values.push(str(reviewNote)); }
  if (manifest) {
    const builtManifest = buildProjectPdfManifest(manifest);
    updates.push(`manifest_json = ?`);
    values.push(JSON.stringify(builtManifest));
  }
  values.push(id);

  try {
    await db.prepare(`UPDATE pdf_drafts SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return getPdfDraft({ db, draftId: id });
  } catch (error) {
    return storageFailure(error);
  }
}

export async function generateAndStoreEstimate({ db, draftId, discountPercent }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");

  const draft = await getPdfDraft({ db, draftId: id });
  if (!draft.ok) return draft;

  if (draft.body.item.status !== PDF_DRAFT_STATUS.REVIEWED && draft.body.item.status !== PDF_DRAFT_STATUS.APPROVED) {
    return errorResult(409, "draft_not_ready", "Draft must be reviewed or approved before generating estimate.");
  }

  const estimate = generatePdfEstimate(draft.body.item.manifest, { discountPercent });
  const estimateJson = JSON.stringify(estimate);

  try {
    const insert = await db.prepare(
      `INSERT INTO pdf_estimates (draft_id, order_id, estimate_version, estimate_json, total_kzt, item_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, draft.body.item.orderId, PDF_ESTIMATE_VERSION, estimateJson, estimate.totals.total, estimate.totals.itemCount).run();
    const estimateId = insert?.meta?.last_row_id;
    return okResult({
      estimateId,
      draftId: id,
      orderId: draft.body.item.orderId,
      estimate,
      proposalLines: mapPdfEstimateToProposalLines(estimate)
    }, 201);
  } catch (error) {
    return storageFailure(error);
  }
}

export async function getDraftEstimate({ db, draftId }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  const row = await db.prepare(
    `SELECT id, draft_id, order_id, estimate_version, estimate_json, total_kzt, item_count, created_at
     FROM pdf_estimates WHERE draft_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`
  ).bind(id).first();
  if (!row) return errorResult(404, "estimate_not_found", "No estimate found for this draft.");
  return okResult({ item: normalizePdfEstimateRow(row) });
}

export async function getDraftDimensions({ db, draftId }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  const draft = await getPdfDraft({ db, draftId: id });
  if (!draft.ok) return draft;
  const dimensions = extractDimensionsFromManifest(draft.body.item.manifest);
  const zones = collectFurnitureZones(draft.body.item.manifest);
  return okResult({
    draftId: id,
    orderId: draft.body.item.orderId,
    dimensionCount: dimensions.length,
    zoneCount: zones.length,
    dimensions,
    zones: zones.map((z) => ({ id: z.id, zoneType: z.zoneType, label: z.label, roomLabel: z.roomLabel, materials: z.materials }))
  });
}

export async function getDraftProposalLines({ db, draftId, discountPercent }) {
  const id = positiveInteger(draftId);
  if (!id) return errorResult(400, "invalid_draft_id", "draftId must be a positive integer.");
  const draft = await getPdfDraft({ db, draftId: id });
  if (!draft.ok) return draft;
  const estimate = generatePdfEstimate(draft.body.item.manifest, { discountPercent });
  const proposalLines = mapPdfEstimateToProposalLines(estimate);
  return okResult({
    draftId: id,
    orderId: draft.body.item.orderId,
    estimate,
    proposalLines
  });
}

function storageFailure(error) {
  if (/unique|constraint/i.test(String(error?.message || error))) {
    return errorResult(409, "pdf_conflict", "PDF record could not be saved.");
  }
  return errorResult(500, "pdf_storage_failed", "PDF record could not be stored.");
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

const DANGEROUS_MIME_TYPES = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-bat",
  "application/x-msdos-program"
]);

const SAFE_FILE_TYPES = new Set([
  "skp_model", "obj_model", "glb_model", "fbx_model",
  "dimensions_pdf", "material_spec_pdf",
  "render_image", "preview_image", "source_pdf"
]);

export const SHARE_ACCESS_LEVEL = Object.freeze({
  VIEW: "view",
  COMMENT: "comment",
  APPROVE: "approve"
});

export async function registerFile({ db, orderId, engagementId, deliverableId, fileType, fileRole, storageKey, originalName, mimeType, sizeBytes, sha256, downloadAllowed }) {
  const oid = positiveInteger(orderId);
  const eid = positiveInteger(engagementId);
  if (!oid) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  if (!eid) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");
  if (!fileType || !SAFE_FILE_TYPES.has(fileType)) {
    return errorResult(400, "invalid_file_type", `fileType must be one of: ${[...SAFE_FILE_TYPES].join(", ")}`);
  }
  if (!storageKey || typeof storageKey !== "string") {
    return errorResult(400, "invalid_storage_key", "storageKey is required.");
  }
  if (!mimeType || typeof mimeType !== "string") {
    return errorResult(400, "invalid_mime_type", "mimeType is required.");
  }
  if (DANGEROUS_MIME_TYPES.has(mimeType)) {
    return errorResult(400, "dangerous_mime_type", "This MIME type is not allowed.");
  }

  const result = await db.prepare(
    `INSERT INTO project_files (order_id, engagement_id, deliverable_id, file_type, file_role, storage_key, original_name, mime_type, size_bytes, sha256, download_allowed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    oid, eid, deliverableId || null, fileType, fileRole || "primary",
    storageKey, originalName || "", mimeType, sizeBytes || 0,
    sha256 || null, downloadAllowed ? 1 : 0
  ).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, fileType, storageKey, downloadAllowed: !!downloadAllowed } }, 201);
}

export async function getFile({ db, fileId }) {
  const id = positiveInteger(fileId);
  if (!id) return errorResult(400, "invalid_file_id", "fileId must be a positive integer.");

  const row = await db.prepare(
    `SELECT id, order_id AS orderId, engagement_id AS engagementId, deliverable_id AS deliverableId,
            file_type AS fileType, file_role AS fileRole, storage_key AS storageKey,
            original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes,
            sha256, download_allowed AS downloadAllowed, created_at AS createdAt
     FROM project_files WHERE id = ?`
  ).bind(id).first();

  if (!row) return errorResult(404, "file_not_found", "File not found.");
  return okResult({ item: row });
}

export async function grantDownload({ db, fileId }) {
  const id = positiveInteger(fileId);
  if (!id) return errorResult(400, "invalid_file_id", "fileId must be a positive integer.");

  const file = await db.prepare("SELECT id FROM project_files WHERE id = ?").bind(id).first();
  if (!file) return errorResult(404, "file_not_found", "File not found.");

  await db.prepare("UPDATE project_files SET download_allowed = 1 WHERE id = ?").bind(id).run();
  return okResult({ item: { id, downloadAllowed: true } });
}

export async function revokeDownload({ db, fileId }) {
  const id = positiveInteger(fileId);
  if (!id) return errorResult(400, "invalid_file_id", "fileId must be a positive integer.");

  await db.prepare("UPDATE project_files SET download_allowed = 0 WHERE id = ?").bind(id).run();
  return okResult({ item: { id, downloadAllowed: false } });
}

export async function listProjectFiles({ db, orderId, engagementId, fileType, limit = 100, offset = 0 }) {
  let where = [];
  let params = [];

  if (orderId) { where.push("order_id = ?"); params.push(orderId); }
  if (engagementId) { where.push("engagement_id = ?"); params.push(engagementId); }
  if (fileType) { where.push("file_type = ?"); params.push(fileType); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, order_id AS orderId, engagement_id AS engagementId, file_type AS fileType,
            original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes,
            download_allowed AS downloadAllowed, created_at AS createdAt
     FROM project_files ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(String(token));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createShareLink({ db, orderId, engagementId, accessLevel, expiresAt, downloadEnabled, commentEnabled, approvalEnabled }) {
  const oid = positiveInteger(orderId);
  const eid = positiveInteger(engagementId);
  if (!oid) return errorResult(400, "invalid_order_id", "orderId must be a positive integer.");
  if (!eid) return errorResult(400, "invalid_engagement_id", "engagementId must be a positive integer.");
  if (!expiresAt || typeof expiresAt !== "string") {
    return errorResult(400, "invalid_expires_at", "expiresAt is required (ISO date string).");
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);

  const result = await db.prepare(
    `INSERT INTO project_share_links (order_id, engagement_id, token_hash, access_level, expires_at, download_enabled, comment_enabled, approval_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    oid, eid, tokenHash,
    accessLevel || SHARE_ACCESS_LEVEL.VIEW,
    expiresAt,
    downloadEnabled ? 1 : 0,
    commentEnabled ? 1 : 0,
    approvalEnabled ? 1 : 0
  ).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, token, accessLevel: accessLevel || SHARE_ACCESS_LEVEL.VIEW, expiresAt } }, 201);
}

export async function getShareLinkByToken({ db, token }) {
  if (!token || typeof token !== "string") {
    return errorResult(400, "invalid_token", "token is required.");
  }

  const tokenHash = await hashToken(token);
  const row = await db.prepare(
    `SELECT id, order_id AS orderId, engagement_id AS engagementId, access_level AS accessLevel,
            expires_at AS expiresAt, download_enabled AS downloadEnabled,
            comment_enabled AS commentEnabled, approval_enabled AS approvalEnabled,
            revoked_at AS revokedAt, created_at AS createdAt
     FROM project_share_links WHERE token_hash = ?`
  ).bind(tokenHash).first();

  if (!row) return errorResult(404, "link_not_found", "Share link not found.");
  if (row.revokedAt) return errorResult(403, "link_revoked", "This share link has been revoked.");
  if (new Date(row.expiresAt) < new Date()) return errorResult(403, "link_expired", "This share link has expired.");

  return okResult({ item: row });
}

export async function revokeShareLink({ db, linkId }) {
  const id = positiveInteger(linkId);
  if (!id) return errorResult(400, "invalid_link_id", "linkId must be a positive integer.");

  const link = await db.prepare("SELECT id, revoked_at FROM project_share_links WHERE id = ?").bind(id).first();
  if (!link) return errorResult(404, "link_not_found", "Share link not found.");
  if (link.revoked_at) return errorResult(409, "already_revoked", "Share link is already revoked.");

  await db.prepare(
    `UPDATE project_share_links SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(id).run();

  return okResult({ item: { id, revoked: true } });
}

export async function addShareComment({ db, linkId, authorName, body }) {
  const lid = positiveInteger(linkId);
  if (!lid) return errorResult(400, "invalid_link_id", "linkId must be a positive integer.");
  if (!authorName || typeof authorName !== "string") {
    return errorResult(400, "invalid_author", "authorName is required.");
  }
  if (!body || typeof body !== "string") {
    return errorResult(400, "invalid_body", "comment body is required.");
  }

  const link = await db.prepare("SELECT id, comment_enabled FROM project_share_links WHERE id = ?").bind(lid).first();
  if (!link) return errorResult(404, "link_not_found", "Share link not found.");
  if (!link.comment_enabled) return errorResult(403, "comments_disabled", "Comments are not enabled for this link.");

  const result = await db.prepare(
    `INSERT INTO project_share_comments (share_link_id, author_name, body)
     VALUES (?, ?, ?)`
  ).bind(lid, authorName, body).run();

  const id = result.meta?.last_row_id;
  return okResult({ item: { id, linkId: lid, authorName } }, 201);
}

export async function listShareComments({ db, linkId, limit = 100, offset = 0 }) {
  const lid = positiveInteger(linkId);
  if (!lid) return errorResult(400, "invalid_link_id", "linkId must be a positive integer.");

  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);
  const safeOffset = Math.max(0, Number(offset) || 0);

  const result = await db.prepare(
    `SELECT id, share_link_id AS linkId, author_name AS authorName, body, created_at AS createdAt
     FROM project_share_comments WHERE share_link_id = ?
     ORDER BY created_at ASC, id ASC
     LIMIT ? OFFSET ?`
  ).bind(lid, safeLimit, safeOffset).all();

  return okResult({ items: result?.results || [] });
}

function generateToken() {
  const bytes = new Uint8Array(32);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("crypto.getRandomValues is required to create share links.");
  }
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function okResult(body, status = 200) {
  return { ok: true, status, body: { success: true, ...body } };
}

function errorResult(status, error, message) {
  return { ok: false, status, body: { success: false, error, message } };
}

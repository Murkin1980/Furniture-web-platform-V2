import { AUTH_SCOPES, authorizeRequest } from "../../../../../src/auth.js";
import { createPdfUpload, listOrderPdfUploads, getPdfUpload } from "../../../../../src/pdf/pdf-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const uploadId = url.searchParams.get("uploadId");
  if (uploadId) {
    return respond(await getPdfUpload({ db: context.env.DB, uploadId }));
  }
  return respond(await listOrderPdfUploads({ db: context.env.DB, orderId: context.params.id }));
}

export async function onRequestPost(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  return respond(await createPdfUpload({
    db: context.env.DB,
    orderId: context.params.id,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    mimeType: input.mimeType,
    pageCount: input.pageCount,
    checksum: input.checksum,
    engagementId: input.engagementId,
    uploadedBy: input.uploadedBy
  }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or POST /api/orders/:id/pdf/uploads." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
async function readJson(request) {
  try { return { ok: true, value: await request.json() }; }
  catch { return { ok: false, response: json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, 400) }; }
}
function respond(result) { return json(result.body, result.status); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

import { AUTH_SCOPES, authorizeRequest } from "../../../../../src/auth.js";
import {
  createPdfDraft,
  listOrderPdfDrafts,
  getPdfDraft,
  updatePdfDraftManifest,
  reviewPdfDraft,
  generateAndStoreEstimate,
  getDraftEstimate,
  getDraftDimensions,
  getDraftProposalLines
} from "../../../../../src/pdf/pdf-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const draftId = url.searchParams.get("draftId");
  const action = url.searchParams.get("action");

  if (draftId) {
    if (action === "estimate") return respond(await getDraftEstimate({ db: context.env.DB, draftId }));
    if (action === "dimensions") return respond(await getDraftDimensions({ db: context.env.DB, draftId }));
    if (action === "proposal") return respond(await getDraftProposalLines({ db: context.env.DB, draftId }));
    return respond(await getPdfDraft({ db: context.env.DB, draftId }));
  }
  return respond(await listOrderPdfDrafts({ db: context.env.DB, orderId: context.params.id }));
}

export async function onRequestPost(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  const action = input.action;

  if (action === "review") {
    return respond(await reviewPdfDraft({
      db: context.env.DB,
      draftId: input.draftId,
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewNote: input.reviewNote,
      manifest: input.manifest
    }));
  }
  if (action === "estimate") {
    return respond(await generateAndStoreEstimate({ db: context.env.DB, draftId: input.draftId, discountPercent: input.discountPercent }));
  }
  if (action === "update_manifest") {
    return respond(await updatePdfDraftManifest({
      db: context.env.DB,
      draftId: input.draftId,
      manifest: input.manifest,
      aiProvider: input.aiProvider,
      aiModel: input.aiModel,
      processingTimeMs: input.processingTimeMs,
      analysisVersion: input.analysisVersion
    }));
  }

  return respond(await createPdfDraft({
    db: context.env.DB,
    uploadId: input.uploadId,
    orderId: context.params.id,
    manifest: input.manifest,
    engagementId: input.engagementId,
    createdBy: input.createdBy
  }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or POST /api/orders/:id/pdf/drafts." }, 405); }

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

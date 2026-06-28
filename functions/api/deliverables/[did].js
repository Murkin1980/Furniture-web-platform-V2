import { AUTH_SCOPES, authorizeRequest } from "../../../src/auth.js";
import {
  getDeliverable,
  transitionDeliverableStatus,
  attachArtifact,
  requestRevision,
  resolveRevision,
  listDeliverableRevisions
} from "../../../src/packages/deliverable-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const did = context.params.did;
  const url = new URL(context.request.url);
  if (url.searchParams.get("revisions") === "true") {
    return respond(await listDeliverableRevisions({ db: context.env.DB, deliverableId: did }));
  }
  return respond(await getDeliverable({ db: context.env.DB, deliverableId: did }));
}

export async function onRequestPatch(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  const action = input.action;

  if (action === "attach") {
    return respond(await attachArtifact({
      db: context.env.DB,
      deliverableId: context.params.did,
      artifactUrl: input.artifactUrl,
      artifactFormat: input.artifactFormat,
      metadata: input.metadata
    }));
  }
  if (action === "request_revision") {
    return respond(await requestRevision({
      db: context.env.DB,
      deliverableId: context.params.did,
      requestNote: input.requestNote,
      requestedBy: input.requestedBy
    }));
  }
  if (action === "resolve_revision") {
    return respond(await resolveRevision({
      db: context.env.DB,
      deliverableId: context.params.did,
      revisionId: input.revisionId,
      resolution: input.resolution
    }));
  }

  return respond(await transitionDeliverableStatus({
    db: context.env.DB,
    deliverableId: context.params.did,
    toStatus: input.toStatus,
    createdBy: input.createdBy
  }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or PATCH /api/deliverables/:did." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
async function readJson(request) {
  try { return { ok: true, value: await request.json() }; }
  catch { return { ok: false, response: json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, 400) }; }
}
function respond(result) { return json(result.body, result.status); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

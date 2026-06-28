import { AUTH_SCOPES, authorizeRequest } from "../../../../../src/auth.js";
import { createEngagement, listOrderEngagements } from "../../../../../src/packages/package-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const orderId = context.params.id;
  return respond(await listOrderEngagements({ db: context.env.DB, orderId }));
}

export async function onRequestPost(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  const orderId = context.params.id;
  return respond(await createEngagement({
    db: context.env.DB,
    orderId,
    packageCode: input.packageCode,
    sourceMaterialType: input.sourceMaterialType,
    createdBy: input.createdBy
  }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or POST /api/orders/:id/engagements." }, 405); }

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

import { AUTH_SCOPES, authorizeRequest } from "../../../../../src/auth.js";
import { getEngagement, incrementRevisionRound, transitionEngagement } from "../../../../../src/packages/package-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  return respond(await getEngagement({ db: context.env.DB, engagementId: context.params.eid }));
}

export async function onRequestPatch(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  const action = input.action;

  if (action === "revise") {
    return respond(await incrementRevisionRound({ db: context.env.DB, engagementId: context.params.eid }));
  }

  return respond(await transitionEngagement({
    db: context.env.DB,
    engagementId: context.params.eid,
    toStatus: input.toStatus,
    visualState: input.visualState,
    upgradeOfferState: input.upgradeOfferState,
    createdBy: input.createdBy
  }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or PATCH /api/orders/:id/engagements/:eid." }, 405); }

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

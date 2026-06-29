import { AUTH_SCOPES, authorizeRequest } from "../../../../../../src/auth.js";
import {
  seedEngagementDeliverables,
  listEngagementDeliverables,
  getPackageDeliverableState
} from "../../../../../../src/packages/deliverable-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const engagementId = context.params.eid;
  const url = new URL(context.request.url);
  if (url.searchParams.get("state") === "true") {
    return respond(await getPackageDeliverableState({ db: context.env.DB, engagementId }));
  }
  return respond(await listEngagementDeliverables({ db: context.env.DB, engagementId }));
}

export async function onRequestPost(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  return respond(await seedEngagementDeliverables({ db: context.env.DB, engagementId: context.params.eid }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or POST /api/orders/:id/engagements/:eid/deliverables." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
function respond(result) { return json(result.body, result.status); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

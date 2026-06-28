import { AUTH_SCOPES, authorizeRequest } from "../../src/auth.js";
import { listAllDeliverableSpecs, getPackageDeliverableSummary, describePackageVisualState } from "../../src/packages/visual-standards.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const packageCode = url.searchParams.get("packageCode");

  if (packageCode) {
    const summary = getPackageDeliverableSummary(packageCode);
    if (!summary || summary.total === 0) {
      return json({ success: false, error: "no_deliverables", message: describePackageVisualState(packageCode) }, 404);
    }
    return json({ success: true, item: { ...summary, description: describePackageVisualState(packageCode) } });
  }
  const specs = listAllDeliverableSpecs().map((s) => ({
    packageCode: s.packageCode,
    visualState: s.visualState,
    total: s.deliverables.length,
    deliverables: s.deliverables
  }));
  return json({ success: true, items: specs });
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET /api/deliverable-specs." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

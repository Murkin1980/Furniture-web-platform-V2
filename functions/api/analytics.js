import { AUTH_SCOPES, authorizeRequest } from "../../src/auth.js";
import { getConversionFunnel, getPackageMetrics } from "../../src/packages/package-analytics.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const report = url.searchParams.get("report") || "funnel";
  const fromDate = url.searchParams.get("from") || null;
  const toDate = url.searchParams.get("to") || null;

  if (report === "metrics") {
    return respond(await getPackageMetrics({ db: context.env.DB, fromDate, toDate }));
  }
  return respond(await getConversionFunnel({ db: context.env.DB, fromDate, toDate }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET /api/analytics." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
function respond(result) { return json(result.body, result.status); }
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

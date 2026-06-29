import { AUTH_SCOPES, authorizeRequest } from "../../src/auth.js";
import { listMessageTemplates, getTemplatesForUpgrade, resolveUpgradeTemplates, getMessageTemplate, renderTemplate } from "../../src/packages/message-templates.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const fromLevel = url.searchParams.get("fromLevel");
  const engagementLevel = url.searchParams.get("engagementLevel");
  const packageCode = url.searchParams.get("packageCode");

  if (code) {
    const template = getMessageTemplate(code);
    if (!template) return json({ success: false, error: "template_not_found", message: "Message template was not found." }, 404);
    const rendered = renderTemplate(template, {
      clientName: url.searchParams.get("clientName"),
      orderId: url.searchParams.get("orderId"),
      managerName: url.searchParams.get("managerName")
    });
    return json({ success: true, item: rendered });
  }
  if (engagementLevel || packageCode) {
    return json({ success: true, items: resolveUpgradeTemplates(engagementLevel, packageCode) });
  }
  if (fromLevel) {
    return json({ success: true, items: getTemplatesForUpgrade(fromLevel) });
  }
  return json({ success: true, items: listMessageTemplates() });
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET /api/message-templates." }, 405); }

function authorize(context, scope) {
  const result = authorizeRequest(context.request, context.env, scope);
  return result.ok ? null : json({ success: false, error: result.error, message: result.message }, result.status);
}
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token" }; }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "Content-Type": "application/json; charset=utf-8" } }); }

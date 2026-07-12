import { authorizeRequest } from "../../src/auth.js";
import { classifyIntent, suggestClarifyingQuestions, getAdvisorSummary } from "../../src/ai/package-advisor.js";

export async function onRequestPost(context) {
  const auth = authorizeRequest(context.request, context.env, "read");
  if (auth) return auth;

  let body;
  try { body = await context.request.json(); } catch {
    return Response.json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const text = body.text || body.requestText || "";
  if (!String(text).trim()) {
    return Response.json({ success: false, error: "missing_text", message: "text field is required." }, { status: 400 });
  }

  const intent = classifyIntent(text);
  const questions = suggestClarifyingQuestions(intent, {});
  const summary = getAdvisorSummary(intent);

  return Response.json({ success: true, intent, questions, summary });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-Admin-Token,Authorization" } });
}

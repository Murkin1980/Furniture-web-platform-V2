import { authorizeRequest } from "../../src/auth.js";
import { createClient, listClients } from "../../src/clients/client-store.js";

export async function onRequestGet(context) {
  const auth = authorizeRequest(context.request, context.env, "read");
  if (auth) return auth;
  return listClients({ db: context.env.DB });
}

export async function onRequestPost(context) {
  const auth = authorizeRequest(context.request, context.env, "write");
  if (auth) return auth;

  let body;
  try { body = await context.request.json(); } catch {
    return Response.json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  return createClient({ db: context.env.DB, name: body.name, phone: body.phone, email: body.email, note: body.note });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-Admin-Token,Authorization" } });
}

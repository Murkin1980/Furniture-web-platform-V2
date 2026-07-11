import { authorizeRequest } from "../../src/auth.js";
import { createOrder, listOrders, getOrder } from "../../src/orders/order-store.js";

export async function onRequestGet(context) {
  const auth = authorizeRequest(context.request, context.env, "read");
  if (auth) return auth;

  const url = new URL(context.request.url);
  const orderId = url.searchParams.get("orderId");
  if (orderId) {
    return getOrder({ db: context.env.DB, orderId });
  }
  const clientId = url.searchParams.get("clientId");
  return listOrders({ db: context.env.DB, clientId });
}

export async function onRequestPost(context) {
  const auth = authorizeRequest(context.request, context.env, "write");
  if (auth) return auth;

  let body;
  try { body = await context.request.json(); } catch {
    return Response.json({ success: false, error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  return createOrder({ db: context.env.DB, clientId: body.clientId, requestText: body.requestText, budgetKzt: body.budgetKzt, note: body.note });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-Admin-Token,Authorization" } });
}

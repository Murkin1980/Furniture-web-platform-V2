import { authorizeRequest } from "../../../src/auth.js";
import { getOrder } from "../../../src/orders/order-store.js";
import { listOrderEngagements } from "../../../src/packages/package-store.js";

export async function onRequestGet(context) {
  const auth = authorizeRequest(context.request, context.env, "read");
  if (auth) return auth;

  const url = new URL(context.request.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) {
    return Response.json({ success: false, error: "missing_order_id", message: "orderId query parameter is required." }, { status: 400 });
  }

  const orderResult = await getOrder({ db: context.env.DB, orderId });
  if (!orderResult.ok) return Response.json(orderResult.body, { status: orderResult.status });

  const engagementsResult = await listOrderEngagements({ db: context.env.DB, orderId });

  return Response.json({
    success: true,
    order: orderResult.body.item,
    engagements: engagementsResult.ok ? engagementsResult.body.items : []
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-Admin-Token,Authorization" } });
}

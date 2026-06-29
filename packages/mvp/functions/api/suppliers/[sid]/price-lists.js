import { AUTH_SCOPES, authorizeRequest } from "../../../../src/auth.js";
import {
  createPriceList,
  getPriceList,
  listSupplierPriceLists,
  addPriceItem,
  listPriceItems,
  publishPriceList,
  archivePriceList,
  getActivePriceList,
  generateSupplierAwareEstimate
} from "../../../../src/suppliers/supplier-store.js";

export async function onRequestGet(context) {
  const failure = authorize(context, AUTH_SCOPES.READ);
  if (failure) return failure;
  const url = new URL(context.request.url);
  const supplierId = context.params.sid;
  const priceListId = url.searchParams.get("priceListId");
  const action = url.searchParams.get("action");

  if (action === "active") return respond(await getActivePriceList({ db: context.env.DB, supplierId }));
  if (priceListId) return respond(await getPriceList({ db: context.env.DB, priceListId, includeItems: url.searchParams.get("items") === "true" }));
  return respond(await listSupplierPriceLists({ db: context.env.DB, supplierId }));
}

export async function onRequestPost(context) {
  const failure = authorize(context, AUTH_SCOPES.WRITE);
  if (failure) return failure;
  const payload = await readJson(context.request);
  if (!payload.ok) return payload.response;
  const input = payload.value;
  const action = input.action;
  const supplierId = context.params.sid;

  if (action === "add_item") {
    return respond(await addPriceItem({
      db: context.env.DB,
      priceListId: input.priceListId,
      supplierId,
      furnitureType: input.furnitureType,
      material: input.material,
      label: input.label,
      basePriceKzt: input.basePriceKzt,
      unitPriceKzt: input.unitPriceKzt,
      unit: input.unit,
      sortOrder: input.sortOrder
    }));
  }
  if (action === "publish") {
    return respond(await publishPriceList({ db: context.env.DB, priceListId: input.priceListId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo }));
  }
  if (action === "archive") {
    return respond(await archivePriceList({ db: context.env.DB, priceListId: input.priceListId }));
  }
  if (action === "supplier_estimate") {
    return respond(await generateSupplierAwareEstimate({
      db: context.env.DB,
      draftId: input.draftId,
      supplierId,
      material: input.material,
      discountPercent: input.discountPercent
    }));
  }

  return respond(await createPriceList({ db: context.env.DB, supplierId, note: input.note, createdBy: input.createdBy }));
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: corsHeaders() }); }
export async function onRequest() { return json({ success: false, error: "method_not_allowed", message: "Use GET or POST /api/suppliers/:sid/price-lists." }, 405); }

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

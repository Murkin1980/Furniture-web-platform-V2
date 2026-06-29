/**
 * POST /api/orchestration/clarification/:cid/respond
 *
 * Records a customer's response to a clarification question.
 *
 * Body: { response }
 * Returns: { clarification }
 */

import { respondToClarification } from "../../../../src/clarification/clarifier.js";

export async function onRequestPost(context) {
  const db = context.env.DB;
  const cid = context.params.cid;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.response || typeof body.response !== "string" || body.response.trim().length === 0) {
    return Response.json({ success: false, error: "response_required" }, { status: 400 });
  }

  const result = await respondToClarification({
    db,
    clarificationId: cid,
    response: body.response.trim()
  });

  if (result.error) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  return Response.json({
    success: true,
    item: {
      id: result.id,
      status: result.status,
      response: result.response
    }
  });
}

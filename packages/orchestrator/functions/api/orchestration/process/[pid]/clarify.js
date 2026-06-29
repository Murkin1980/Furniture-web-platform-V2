/**
 * POST /api/orchestration/process/:pid/clarify
 *
 * Creates a clarification question for a process.
 *
 * Body: { question, priority?, extractionId? }
 * Returns: { clarification }
 */

import { createClarification, sendClarification } from "../../../src/clarification/clarifier.js";

export async function onRequestPost(context) {
  const db = context.env.DB;
  const pid = context.params.pid;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
    return Response.json({ success: false, error: "question_required" }, { status: 400 });
  }

  const clarification = await createClarification({
    db,
    processId: pid,
    question: body.question.trim(),
    priority: body.priority || "blocking",
    extractionId: body.extractionId || null
  });

  if (clarification.error) {
    return Response.json({ success: false, error: clarification.error }, { status: 500 });
  }

  const sent = await sendClarification({ db, clarificationId: clarification.id });

  return Response.json({
    success: true,
    item: {
      id: clarification.id,
      status: sent.status || "pending",
      question: body.question,
      priority: body.priority || "blocking"
    }
  }, { status: 201 });
}

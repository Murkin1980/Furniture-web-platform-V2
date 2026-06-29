/**
 * POST /api/orchestration/process
 *
 * Creates a new orchestration process from customer input.
 * Classifies modality, routes to extraction or clarification.
 *
 * Body: { text?, imageUrl?, audioUrl?, pdfUrl?, orderId?, clientId? }
 * Returns: { process, route }
 */

import { classifyModality, routeIntake } from "../../../src/intake/intake-router.js";
import { createProcess, transitionProcess, PROCESS_STATUS } from "../../../src/orchestration/process-tracker.js";
import { createExtraction, getExtractionPipeline } from "../../../src/extraction/extractor.js";
import { createTextAnalysisHandler } from "../../../src/bridge/mvp-bridge.js";

export async function onRequestPost(context) {
  const db = context.env.DB;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const input = {
    text: body.text,
    imageUrl: body.imageUrl,
    audioUrl: body.audioUrl,
    pdfUrl: body.pdfUrl
  };

  const classification = classifyModality(input);
  if (classification.error) {
    return Response.json({ success: false, error: classification.error }, { status: 400 });
  }

  const route = routeIntake(input, {
    orderId: body.orderId,
    clientId: body.clientId
  });

  const process = await createProcess({
    db,
    orderId: body.orderId || null,
    clientId: body.clientId || null,
    inputModality: classification.modality,
    inputSummary: { text: body.text?.substring(0, 200), hasImage: Boolean(body.imageUrl), hasAudio: Boolean(body.audioUrl), hasPdf: Boolean(body.pdfUrl) },
    context: { orderId: body.orderId, clientId: body.clientId }
  });

  if (process.error) {
    return Response.json({ success: false, error: process.error }, { status: 500 });
  }

  await transitionProcess({
    db,
    processId: process.id,
    toStatus: PROCESS_STATUS.CLASSIFYING,
    metadata: { input: classification, output: route }
  });

  let extraction = null;
  if (route.action === "extract") {
    await transitionProcess({
      db,
      processId: process.id,
      toStatus: PROCESS_STATUS.EXTRACTING
    });

    extraction = await createExtraction({
      db,
      processId: process.id,
      extractionType: route.extractionType,
      input
    });

    const pipeline = getExtractionPipeline(route.extractionType);
    extraction.pipeline = pipeline;
  }

  if (route.action === "clarify") {
    await transitionProcess({
      db,
      processId: process.id,
      toStatus: PROCESS_STATUS.CLARIFYING
    });
  }

  return Response.json({
    success: true,
    item: {
      processId: process.id,
      modality: classification.modality,
      action: route.action,
      extraction: extraction ? { id: extraction.id, type: route.extractionType, pipeline: extraction.pipeline } : null,
      clarifyingQuestions: route.questions || (route.question ? [route.question] : []),
      reason: route.reason || null
    }
  }, { status: 201 });
}

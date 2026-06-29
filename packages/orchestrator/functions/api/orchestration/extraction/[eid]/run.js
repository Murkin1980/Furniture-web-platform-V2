/**
 * POST /api/orchestration/extraction/:eid/run
 *
 * Runs an extraction with an injected handler.
 * The handler is selected based on extraction type.
 *
 * Body: { handler?: "text_analysis" | "pdf_intelligence" | "supplier_pricing" }
 * Returns: { extraction }
 */

import { runExtraction, getExtraction } from "../../../src/extraction/extractor.js";
import { transitionProcess, PROCESS_STATUS } from "../../../src/orchestration/process-tracker.js";
import { createTextAnalysisHandler, createPdfIntelligenceHandler } from "../../../src/bridge/mvp-bridge.js";

const HANDLERS = {
  text_analysis: null,
  pdf_intelligence: null,
  image_analysis: null,
  audio_transcription: null
};

export function registerHandlers(handlers) {
  if (handlers.textAnalysis) HANDLERS.text_analysis = createTextAnalysisHandler(handlers.textAnalysis);
  if (handlers.pdfManifest) HANDLERS.pdf_intelligence = createPdfIntelligenceHandler(handlers.pdfManifest);
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const eid = context.params.eid;

  const extraction = await getExtraction({ db, extractionId: eid });
  if (extraction.error) {
    return Response.json({ success: false, error: extraction.error }, { status: 404 });
  }

  const extractionType = extraction.item.extractionType;
  const handler = HANDLERS[extractionType];

  if (!handler) {
    return Response.json({
      success: false,
      error: "no_handler",
      message: `No handler registered for extraction type "${extractionType}"`
    }, { status: 501 });
  }

  const result = await runExtraction({ db, extractionId: eid, handler });

  if (result.error) {
    return Response.json({ success: false, error: result.error }, { status: 400 });
  }

  if (result.status === "completed" && extraction.item.processId) {
    await transitionProcess({
      db,
      processId: extraction.item.processId,
      toStatus: PROCESS_STATUS.ROUTING,
      metadata: { input: { extractionId: eid }, output: result.output }
    });
  }

  return Response.json({
    success: true,
    item: {
      id: result.id,
      status: result.status,
      output: result.output || null,
      error: result.error || null
    }
  });
}

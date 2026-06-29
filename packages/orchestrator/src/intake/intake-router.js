/**
 * Intake Router — classifies incoming data type and routes to the correct handler.
 *
 * Input types:
 * - text: plain text message from customer
 * - image: photo/sketch/drawing
 * - audio: voice message
 * - pdf: designer plan or specification
 * - mixed: combination (e.g., text + image)
 *
 * The router determines:
 * 1. Input modality
 * 2. Intent classification (uses shared package-advisor)
 * 3. Required extraction pipeline
 * 4. Next action (extract, clarify, or route downstream)
 */

export const INPUT_MODALITY = Object.freeze({
  TEXT: "text",
  IMAGE: "image",
  AUDIO: "audio",
  PDF: "pdf",
  MIXED: "mixed"
});

export const ROUTE_ACTION = Object.freeze({
  EXTRACT: "extract",
  CLARIFY: "clarify",
  ROUTE_DOWNSTREAM: "route_downstream",
  REJECT: "reject"
});

export function classifyModality(input) {
  if (!input || typeof input !== "object") {
    return { modality: null, error: "invalid_input" };
  }

  const hasText = Boolean(input.text && typeof input.text === "string" && input.text.trim().length > 0);
  const hasImage = Boolean(input.imageUrl || input.imageBase64 || input.imageParts?.length > 0);
  const hasAudio = Boolean(input.audioUrl || input.audioTranscript);
  const hasPdf = Boolean(input.pdfUrl || input.pdfManifest);

  const types = [];
  if (hasText) types.push(INPUT_MODALITY.TEXT);
  if (hasImage) types.push(INPUT_MODALITY.IMAGE);
  if (hasAudio) types.push(INPUT_MODALITY.AUDIO);
  if (hasPdf) types.push(INPUT_MODALITY.PDF);

  if (types.length === 0) {
    return { modality: null, error: "no_input_data" };
  }

  if (types.length === 1) {
    return { modality: types[0] };
  }

  return { modality: INPUT_MODALITY.MIXED, types };
}

export function routeIntake(input, context = {}) {
  const classification = classifyModality(input);
  if (classification.error) {
    return {
      action: ROUTE_ACTION.REJECT,
      reason: classification.error,
      modality: null
    };
  }

  const modality = classification.modality;
  const intent = context.intent || null;
  const hasExistingOrder = Boolean(context.orderId);

  if (modality === INPUT_MODALITY.TEXT) {
    return routeText(input, intent, hasExistingOrder, context);
  }

  if (modality === INPUT_MODALITY.IMAGE) {
    return {
      action: ROUTE_ACTION.EXTRACT,
      modality,
      extractionType: "image_analysis",
      pipeline: ["ocr", "spatial_analysis", "furniture_detection"]
    };
  }

  if (modality === INPUT_MODALITY.AUDIO) {
    return {
      action: ROUTE_ACTION.EXTRACT,
      modality,
      extractionType: "audio_transcription",
      pipeline: ["transcription", "intent_classification", "entity_extraction"]
    };
  }

  if (modality === INPUT_MODALITY.PDF) {
    return {
      action: ROUTE_ACTION.EXTRACT,
      modality,
      extractionType: "pdf_intelligence",
      pipeline: ["manifest", "page_classification", "room_extraction", "furniture_zone_detection"]
    };
  }

  if (modality === INPUT_MODALITY.MIXED) {
    return {
      action: ROUTE_ACTION.EXTRACT,
      modality,
      types: classification.types,
      extractionType: "multi_modal",
      pipeline: ["parallel_extraction", "fusion", "confidence_scoring"]
    };
  }

  return {
    action: ROUTE_ACTION.REJECT,
    reason: "unsupported_modality",
    modality
  };
}

function routeText(input, intent, hasExistingOrder, context) {
  const text = (input.text || "").trim();

  if (text.length < 3) {
    return {
      action: ROUTE_ACTION.CLARIFY,
      modality: INPUT_MODALITY.TEXT,
      reason: "input_too_short",
      question: "Пожалуйста, опишите ваш запрос подробнее."
    };
  }

  if (intent) {
    if (intent.packageCode) {
      return {
        action: ROUTE_ACTION.ROUTE_DOWNSTREAM,
        modality: INPUT_MODALITY.TEXT,
        intent,
        target: "package_advisor",
        packageCode: intent.packageCode
      };
    }

    if (intent.needsClarification) {
      return {
        action: ROUTE_ACTION.CLARIFY,
        modality: INPUT_MODALITY.TEXT,
        intent,
        questions: intent.clarifyingQuestions || []
      };
    }
  }

  return {
    action: ROUTE_ACTION.EXTRACT,
    modality: INPUT_MODALITY.TEXT,
    extractionType: "text_analysis",
    pipeline: ["intent_classification", "entity_extraction", "package_suggestion"]
  };
}

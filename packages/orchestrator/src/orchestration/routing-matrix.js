/**
 * Routing Matrix — formalizes the input → handler → output routing.
 *
 * Based on ADR 007. Every modality has explicit rules for:
 * - Which handlers are called
 * - Whether clarification is allowed
 * - Which extraction pipeline is used
 */

export const ROUTING_MATRIX = Object.freeze({
  text: {
    hasPackageIntent: {
      action: "route_downstream",
      pipeline: null,
      handlers: ["packageAdvisor"],
      clarificationAllowed: false
    },
    needsClarification: {
      action: "clarify",
      pipeline: null,
      handlers: [],
      clarificationAllowed: true
    },
    default: {
      action: "extract",
      pipeline: "text_analysis",
      handlers: ["textAnalysis"],
      clarificationAllowed: true
    },
    tooShort: {
      action: "clarify",
      pipeline: null,
      handlers: [],
      clarificationAllowed: true,
      question: "Пожалуйста, опишите ваш запрос подробнее."
    }
  },
  image: {
    default: {
      action: "extract",
      pipeline: "image_analysis",
      handlers: ["imageAnalysis"],
      clarificationAllowed: false
    }
  },
  audio: {
    default: {
      action: "extract",
      pipeline: "audio_transcription",
      handlers: ["audioTranscription"],
      clarificationAllowed: false
    }
  },
  pdf: {
    default: {
      action: "extract",
      pipeline: "pdf_intelligence",
      handlers: ["pdfManifest"],
      clarificationAllowed: false
    }
  },
  mixed: {
    text_image: {
      action: "extract",
      pipeline: "multi_modal",
      handlers: ["imageAnalysis", "textAnalysis"],
      clarificationAllowed: true
    },
    text_audio: {
      action: "extract",
      pipeline: "multi_modal",
      handlers: ["audioTranscription", "textAnalysis"],
      clarificationAllowed: true
    },
    text_pdf: {
      action: "extract",
      pipeline: "multi_modal",
      handlers: ["pdfManifest", "textAnalysis"],
      clarificationAllowed: true
    },
    three_plus: {
      action: "extract",
      pipeline: "multi_modal",
      handlers: ["imageAnalysis", "audioTranscription", "pdfManifest", "textAnalysis"],
      clarificationAllowed: true
    }
  },
  reject: {
    default: {
      action: "reject",
      pipeline: null,
      handlers: [],
      clarificationAllowed: false
    }
  }
});

export const PIPELINE_STEPS = Object.freeze({
  text_analysis: ["intent_classification", "entity_extraction", "package_suggestion"],
  image_analysis: ["ocr", "spatial_analysis", "furniture_detection"],
  audio_transcription: ["transcription", "intent_classification", "entity_extraction"],
  pdf_intelligence: ["manifest", "page_classification", "room_extraction", "furniture_zone_detection"],
  multi_modal: ["parallel_extraction", "fusion", "confidence_scoring"]
});

export function resolveRoute(modality, subType, context) {
  const matrix = ROUTING_MATRIX[modality];
  if (!matrix) return ROUTING_MATRIX.reject.default;

  if (modality === "text") {
    if (context.text && context.text.trim().length < 3) return matrix.tooShort;
    if (subType === "hasPackageIntent") return matrix.hasPackageIntent;
    if (subType === "needsClarification") return matrix.needsClarification;
    return matrix.default;
  }

  if (modality === "mixed") {
    const types = context.types || [];
    if (types.length >= 3) return matrix.three_plus;
    if (types.includes("text") && types.includes("image")) return matrix.text_image;
    if (types.includes("text") && types.includes("audio")) return matrix.text_audio;
    if (types.includes("text") && types.includes("pdf")) return matrix.text_pdf;
    return matrix.three_plus;
  }

  return matrix.default || ROUTING_MATRIX.reject.default;
}

export function getHandlersForRoute(route) {
  return route.handlers || [];
}

export function getPipelineSteps(pipeline) {
  return PIPELINE_STEPS[pipeline] || [];
}

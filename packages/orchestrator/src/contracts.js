/**
 * DI Contract Definitions — JSDoc type definitions for all handler interfaces.
 *
 * These are the contracts that handlers must satisfy.
 * Since this project uses vanilla JS (no TypeScript), these JSDoc definitions
 * serve as the contract specification. Contract tests verify compliance.
 *
 * @module contracts
 */

/**
 * @typedef {Object} Intent
 * @property {string|null} packageCode - Matched package code (level_1, package_a, package_b, package_c)
 * @property {number} confidence - Confidence score 0-1
 * @property {boolean} needsClarification - Whether clarification is needed
 * @property {Array<ClarifyingQuestion>} clarifyingQuestions - Questions to ask
 * @property {string} reasoning - Why this package was suggested
 */

/**
 * @typedef {Object} ClarifyingQuestion
 * @property {string} question - The question text
 * @property {"blocking"|"nice_to_have"} priority - Priority level
 * @property {string} field - Which field this question addresses
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {Array<Object>} rooms - Detected rooms
 * @property {Array<Object>} zones - Furniture zones
 * @property {Object|null} dimensions - Detected dimensions
 * @property {number} confidence - Confidence score 0-1
 */

/**
 * @typedef {Object} PackageAdvisorHandler
 * @function
 * @param {Object} input - { text: string, summary?: string }
 * @returns {Promise<{packageCode: string|null, confidence: number, clarifyingQuestions: Array, reasoning: string}>}
 */

/**
 * @typedef {Object} TextAnalysisHandler
 * @function
 * @param {Object} input - { text: string }
 * @returns {Promise<{intent: Intent, clarifyingQuestions: Array, summary: Object, entities: Object, confidence: number}>}
 */

/**
 * @typedef {Object} PdfIntelligenceHandler
 * @function
 * @param {Object} input - { pdfUrl: string, pdfManifest?: Object }
 * @returns {Promise<{manifest: Object, rooms: Array, zones: Array, pageCount: number, confidence: number}>}
 */

/**
 * @typedef {Object} SupplierPricingHandler
 * @function
 * @param {Object} input - { zones: Array<{materialType: string, furnitureType: string}> }
 * @returns {Promise<{zonePricings: Array, totalEstimated: number}>}
 */

/**
 * @typedef {Object} ImageAnalysisHandler
 * @function
 * @param {Object} input - { imageUrl?: string, imageBase64?: string }
 * @returns {Promise<{ocr: {text: string, confidence: number}, objects: Array, layout: {rooms, furnitureZones, dimensions}, overallConfidence: number}>}
 */

/**
 * @typedef {Object} AudioTranscriptionHandler
 * @function
 * @param {Object} input - { audioUrl: string }
 * @returns {Promise<{transcript: string, language: string, duration: number, confidence: number, segments: Array}>}
 */

/**
 * @typedef {Object} PdfExtractionHandler
 * @function
 * @param {Object} input - { pdfUrl: string }
 * @returns {Promise<{manifest: Object, rooms: Array, zones: Array, overallConfidence: number}>}
 */

/**
 * @typedef {Object} MultiModalFusionHandler
 * @function
 * @param {Array<Object>} results - Array of extraction results from individual handlers
 * @returns {Promise<{rooms: Array, furniture: Array, dimensions: Object|null, budget: number|null, style: string|null, confidence: number, sources: Array}>}
 */

export const CONTRACT_SCHEMAS = Object.freeze({
  packageAdvisor: {
    required: ["packageCode", "confidence"],
    optional: ["clarifyingQuestions", "reasoning"],
    inputRequired: ["text"]
  },
  textAnalysis: {
    required: ["intent", "confidence"],
    optional: ["clarifyingQuestions", "summary", "entities"],
    inputRequired: ["text"]
  },
  pdfIntelligence: {
    required: ["manifest", "rooms", "confidence"],
    optional: ["zones", "pageCount"],
    inputRequired: ["pdfUrl"]
  },
  supplierPricing: {
    required: ["zonePricings", "totalEstimated"],
    optional: [],
    inputRequired: ["zones"]
  },
  imageAnalysis: {
    required: ["ocr", "objects", "layout", "overallConfidence"],
    optional: [],
    inputRequired: []
  },
  audioTranscription: {
    required: ["transcript", "language", "confidence"],
    optional: ["duration", "segments"],
    inputRequired: ["audioUrl"]
  },
  pdfExtraction: {
    required: ["manifest", "rooms", "zones", "overallConfidence"],
    optional: [],
    inputRequired: ["pdfUrl"]
  },
  multiModalFusion: {
    required: ["rooms", "furniture", "confidence", "sources"],
    optional: ["dimensions", "budget", "style"],
    inputRequired: []
  }
});

export function validateContract(handlerName, result) {
  const schema = CONTRACT_SCHEMAS[handlerName];
  if (!schema) return { valid: false, error: `Unknown handler: ${handlerName}` };

  const missing = schema.required.filter(field => result[field] === undefined);
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  return { valid: true };
}

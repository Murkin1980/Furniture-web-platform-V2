#!/usr/bin/env node

/**
 * Hardening smoke tests — idempotency, routing matrix, DI contracts, clarification metrics.
 */

import assert from "node:assert/strict";

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`); }
}

function assertTrue(value, label) { assertEqual(Boolean(value), true, label); }
function assertFalse(value, label) { assertEqual(Boolean(value), false, label); }

// --- Import modules ---
const { deriveKey, deriveProcessKey, deriveExtractionKey, deriveClarificationKey, deriveClarificationResponseKey, deriveStepKey } = await import("../src/idempotency.js");

const { ROUTING_MATRIX, resolveRoute, getHandlersForRoute, getPipelineSteps, PIPELINE_STEPS } = await import("../src/orchestration/routing-matrix.js");

const { CONTRACT_SCHEMAS, validateContract } = await import("../src/contracts.js");

const { CLARIFICATION_PRIORITY, generateClarificationQuestions } = await import("../src/clarification/clarifier.js");

// --- Idempotency tests ---
console.log("\n== Idempotency ==");

const key1 = deriveKey("process", { clientId: 1, modality: "text", text: "кухня" });
const key2 = deriveKey("process", { clientId: 1, modality: "text", text: "кухня" });
const key3 = deriveKey("process", { clientId: 2, modality: "text", text: "кухня" });
assertEqual(key1, key2, "same input produces same key");
assertTrue(key1 !== key3, "different client produces different key");

const procKey = deriveProcessKey(1, "text", { text: "кухня 3x4" });
assertTrue(typeof procKey === "string" && procKey.length === 64, "process key is SHA-256 hex");

const extKey = deriveExtractionKey(1, "text_analysis", { text: "кухня" });
assertTrue(typeof extKey === "string" && extKey.length === 64, "extraction key is SHA-256 hex");

const clarKey = deriveClarificationKey(1, "Какой стиль?");
assertTrue(typeof clarKey === "string" && clarKey.length === 64, "clarification key is SHA-256 hex");

const respKey = deriveClarificationResponseKey(1, "современный");
assertTrue(typeof respKey === "string" && respKey.length === 64, "clarification response key is SHA-256 hex");

const stepKey = deriveStepKey(1, "classifying");
assertTrue(typeof stepKey === "string" && stepKey.length === 64, "step key is SHA-256 hex");

const sameStepKey = deriveStepKey(1, "classifying");
assertEqual(stepKey, sameStepKey, "same step produces same key");
const diffStepKey = deriveStepKey(2, "classifying");
assertTrue(stepKey !== diffStepKey, "different process produces different step key");

try { deriveKey("invalid", {}); assertTrue(false, "should throw for invalid entity type"); }
catch (e) { assertTrue(e.message.includes("Invalid"), "throws for invalid entity type"); }

// --- Routing matrix tests ---
console.log("\n== Routing Matrix ==");

const textRoute = resolveRoute("text", "default", { text: "Хочу кухню" });
assertEqual(textRoute.action, "extract", "text default → extract");
assertEqual(textRoute.pipeline, "text_analysis", "text pipeline → text_analysis");
assertTrue(textRoute.handlers.includes("textAnalysis"), "text handler → textAnalysis");
assertEqual(textRoute.clarificationAllowed, true, "text clarification allowed");

const shortTextRoute = resolveRoute("text", "default", { text: "а" });
assertEqual(shortTextRoute.action, "clarify", "short text → clarify");

const packageIntentRoute = resolveRoute("text", "hasPackageIntent", { text: "Хочу КП по позициям" });
assertEqual(packageIntentRoute.action, "route_downstream", "package intent → route_downstream");
assertEqual(packageIntentRoute.clarificationAllowed, false, "no clarification for package intent");

const imageRoute = resolveRoute("image", "default", {});
assertEqual(imageRoute.action, "extract", "image → extract");
assertEqual(imageRoute.pipeline, "image_analysis", "image pipeline → image_analysis");
assertTrue(imageRoute.handlers.includes("imageAnalysis"), "image handler → imageAnalysis");
assertEqual(imageRoute.clarificationAllowed, false, "no clarification for image");

const audioRoute = resolveRoute("audio", "default", {});
assertEqual(audioRoute.action, "extract", "audio → extract");
assertEqual(audioRoute.pipeline, "audio_transcription", "audio pipeline → audio_transcription");

const pdfRoute = resolveRoute("pdf", "default", {});
assertEqual(pdfRoute.action, "extract", "pdf → extract");
assertEqual(pdfRoute.pipeline, "pdf_intelligence", "pdf pipeline → pdf_intelligence");

const mixedRoute = resolveRoute("mixed", "default", { types: ["text", "image"] });
assertEqual(mixedRoute.action, "extract", "mixed → extract");
assertEqual(mixedRoute.pipeline, "multi_modal", "mixed pipeline → multi_modal");
assertTrue(mixedRoute.handlers.includes("imageAnalysis"), "mixed includes imageAnalysis");
assertTrue(mixedRoute.handlers.includes("textAnalysis"), "mixed includes textAnalysis");

const threePlusRoute = resolveRoute("mixed", "default", { types: ["text", "image", "audio"] });
assertTrue(threePlusRoute.handlers.length >= 3, "3+ types includes 3+ handlers");

const rejectRoute = resolveRoute("unknown", "default", {});
assertEqual(rejectRoute.action, "reject", "unknown → reject");

// Pipeline steps
assertEqual(getPipelineSteps("text_analysis").length, 3, "text_analysis has 3 steps");
assertEqual(getPipelineSteps("image_analysis").length, 3, "image_analysis has 3 steps");
assertEqual(getPipelineSteps("audio_transcription").length, 3, "audio_transcription has 3 steps");
assertEqual(getPipelineSteps("pdf_intelligence").length, 4, "pdf_intelligence has 4 steps");
assertEqual(getPipelineSteps("multi_modal").length, 3, "multi_modal has 3 steps");
assertEqual(getPipelineSteps("unknown").length, 0, "unknown pipeline has 0 steps");

// Handler resolution
const handlers = getHandlersForRoute(textRoute);
assertTrue(Array.isArray(handlers), "handlers is array");
assertTrue(handlers.length > 0, "text route has handlers");

// --- DI Contract tests ---
console.log("\n== DI Contracts ==");

assertEqual(validateContract("packageAdvisor", { packageCode: "package_a", confidence: 0.8 }).valid, true, "valid packageAdvisor passes");
assertEqual(validateContract("packageAdvisor", { confidence: 0.8 }).valid, false, "packageAdvisor without packageCode fails");

assertEqual(validateContract("textAnalysis", { intent: {}, confidence: 0.8 }).valid, true, "valid textAnalysis passes");
assertEqual(validateContract("textAnalysis", { intent: {} }).valid, false, "textAnalysis without confidence fails");

assertEqual(validateContract("pdfIntelligence", { manifest: {}, rooms: [], confidence: 0.8 }).valid, true, "valid pdfIntelligence passes");
assertEqual(validateContract("pdfIntelligence", { manifest: {} }).valid, false, "pdfIntelligence without rooms fails");

assertEqual(validateContract("supplierPricing", { zonePricings: [], totalEstimated: 0 }).valid, true, "valid supplierPricing passes");
assertEqual(validateContract("supplierPricing", { zonePricings: [] }).valid, false, "supplierPricing without totalEstimated fails");

assertEqual(validateContract("imageAnalysis", { ocr: {}, objects: [], layout: {}, overallConfidence: 0.8 }).valid, true, "valid imageAnalysis passes");
assertEqual(validateContract("imageAnalysis", { ocr: {} }).valid, false, "imageAnalysis incomplete fails");

assertEqual(validateContract("audioTranscription", { transcript: "text", language: "ru", confidence: 0.8 }).valid, true, "valid audioTranscription passes");
assertEqual(validateContract("audioTranscription", { transcript: "text" }).valid, false, "audioTranscription without confidence fails");

assertEqual(validateContract("pdfExtraction", { manifest: {}, rooms: [], zones: [], overallConfidence: 0.8 }).valid, true, "valid pdfExtraction passes");

assertEqual(validateContract("multiModalFusion", { rooms: [], furniture: [], confidence: 0.8, sources: [] }).valid, true, "valid multiModalFusion passes");
assertEqual(validateContract("multiModalFusion", { rooms: [] }).valid, false, "multiModalFusion incomplete fails");

assertEqual(validateContract("unknownHandler", {}).valid, false, "unknown handler fails");

// All required fields check
for (const [name, schema] of Object.entries(CONTRACT_SCHEMAS)) {
  const validResult = {};
  for (const field of schema.required) validResult[field] = "placeholder";
  assertEqual(validateContract(name, validResult).valid, true, `${name} contract validates with all required fields`);
}

// --- Clarification metrics tests ---
console.log("\n== Clarification Metrics ==");

const questionsNoData = generateClarificationQuestions({});
assertTrue(questionsNoData.length >= 3, "generates 3+ questions for missing data");
assertTrue(questionsNoData.some(q => q.priority === CLARIFICATION_PRIORITY.BLOCKING), "has blocking questions");
assertTrue(questionsNoData.some(q => q.priority === CLARIFICATION_PRIORITY.NICE_TO_HAVE), "has nice-to-have questions");

const questionsPartial = generateClarificationQuestions({ roomType: "кухня" });
assertFalse(questionsPartial.some(q => q.field === "roomType"), "doesn't ask about roomType when provided");

const questionsFull = generateClarificationQuestions({
  roomType: "кухня", dimensions: "3x4", budget: 500000, style: "современный"
});
assertEqual(questionsFull.length, 0, "no questions when all data present");

// --- Summary ---
console.log(`\n== Summary: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);

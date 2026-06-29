#!/usr/bin/env node

/**
 * Orchestrator smoke tests — validates intake routing, process tracking,
 * extraction, and clarification modules.
 */

import { strict as assert } from "node:assert";

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
  }
}

function assertTrue(value, label) {
  assertEqual(Boolean(value), true, label);
}

function assertFalse(value, label) {
  assertEqual(Boolean(value), false, label);
}

// --- Import modules ---
const {
  classifyModality,
  routeIntake,
  INPUT_MODALITY,
  ROUTE_ACTION
} = await import("../src/intake/intake-router.js");

const {
  PROCESS_STATUS,
  isValidTransition
} = await import("../src/orchestration/process-tracker.js");

const {
  EXTRACTION_STATUS,
  EXTRACTION_TYPE,
  getExtractionPipeline
} = await import("../src/extraction/extractor.js");

const {
  CLARIFICATION_PRIORITY,
  generateClarificationQuestions
} = await import("../src/clarification/clarifier.js");

// --- Intake Router tests ---
console.log("\n== Intake Router ==");

assertEqual(classifyModality(null).error, "invalid_input", "null input returns error");
assertEqual(classifyModality({}).error, "no_input_data", "empty input returns no_input_data");

assertEqual(classifyModality({ text: "привет" }).modality, INPUT_MODALITY.TEXT, "text input classified");
assertEqual(classifyModality({ imageUrl: "http://example.com/img.jpg" }).modality, INPUT_MODALITY.IMAGE, "image input classified");
assertEqual(classifyModality({ audioUrl: "http://example.com/audio.ogg" }).modality, INPUT_MODALITY.AUDIO, "audio input classified");
assertEqual(classifyModality({ pdfUrl: "http://example.com/plan.pdf" }).modality, INPUT_MODALITY.PDF, "pdf input classified");

const mixed = classifyModality({ text: "вот план", imageUrl: "http://example.com/img.jpg" });
assertEqual(mixed.modality, INPUT_MODALITY.MIXED, "mixed input classified");
assertTrue(mixed.types.includes(INPUT_MODALITY.TEXT), "mixed includes text");
assertTrue(mixed.types.includes(INPUT_MODALITY.IMAGE), "mixed includes image");

const textRoute = routeIntake({ text: "привет" });
assertEqual(textRoute.action, ROUTE_ACTION.EXTRACT, "text routes to extract");
assertEqual(textRoute.extractionType, "text_analysis", "text extraction type correct");

const shortRoute = routeIntake({ text: "а" });
assertEqual(shortRoute.action, ROUTE_ACTION.CLARIFY, "short text routes to clarify");

const rejectRoute = routeIntake({ unknown: true });
assertEqual(rejectRoute.action, ROUTE_ACTION.REJECT, "unknown input rejected");

// --- Process Tracker tests ---
console.log("\n== Process Tracker ==");

assertTrue(isValidTransition(PROCESS_STATUS.CREATED, PROCESS_STATUS.CLASSIFYING), "created → classifying valid");
assertTrue(isValidTransition(PROCESS_STATUS.CREATED, PROCESS_STATUS.FAILED), "created → failed valid");
assertFalse(isValidTransition(PROCESS_STATUS.CREATED, PROCESS_STATUS.COMPLETED), "created → completed invalid");

assertTrue(isValidTransition(PROCESS_STATUS.CLASSIFYING, PROCESS_STATUS.EXTRACTING), "classifying → extracting valid");
assertTrue(isValidTransition(PROCESS_STATUS.CLASSIFYING, PROCESS_STATUS.CLARIFYING), "classifying → clarifying valid");
assertTrue(isValidTransition(PROCESS_STATUS.CLASSIFYING, PROCESS_STATUS.ROUTING), "classifying → routing valid");

assertTrue(isValidTransition(PROCESS_STATUS.EXTRACTING, PROCESS_STATUS.CLARIFYING), "extracting → clarifying valid");
assertTrue(isValidTransition(PROCESS_STATUS.EXTRACTING, PROCESS_STATUS.ROUTING), "extracting → routing valid");
assertTrue(isValidTransition(PROCESS_STATUS.EXTRACTING, PROCESS_STATUS.COMPLETED), "extracting → completed valid");

assertTrue(isValidTransition(PROCESS_STATUS.CLARIFYING, PROCESS_STATUS.EXTRACTING), "clarifying → extracting valid (re-extract after clarification)");
assertTrue(isValidTransition(PROCESS_STATUS.CLARIFYING, PROCESS_STATUS.COMPLETED), "clarifying → completed valid");

assertTrue(isValidTransition(PROCESS_STATUS.ROUTING, PROCESS_STATUS.COMPLETED), "routing → completed valid");
assertTrue(isValidTransition(PROCESS_STATUS.ROUTING, PROCESS_STATUS.FAILED), "routing → failed valid");

assertFalse(isValidTransition(PROCESS_STATUS.COMPLETED, PROCESS_STATUS.CREATED), "completed → created invalid");
assertFalse(isValidTransition(PROCESS_STATUS.FAILED, PROCESS_STATUS.CREATED), "failed → created invalid");
assertFalse(isValidTransition(PROCESS_STATUS.COMPLETED, PROCESS_STATUS.CLASSIFYING), "completed → classifying invalid");

// --- Extraction tests ---
console.log("\n== Extraction ==");

const textPipeline = getExtractionPipeline(EXTRACTION_TYPE.TEXT_ANALYSIS);
assertEqual(textPipeline.length, 3, "text pipeline has 3 steps");
assertEqual(textPipeline[0].step, "intent_classification", "text pipeline step 1 is intent_classification");

const imagePipeline = getExtractionPipeline(EXTRACTION_TYPE.IMAGE_ANALYSIS);
assertEqual(imagePipeline.length, 3, "image pipeline has 3 steps");
assertEqual(imagePipeline[0].step, "ocr", "image pipeline step 1 is ocr");

const audioPipeline = getExtractionPipeline(EXTRACTION_TYPE.AUDIO_TRANSCRIPTION);
assertEqual(audioPipeline.length, 3, "audio pipeline has 3 steps");

const pdfPipeline = getExtractionPipeline(EXTRACTION_TYPE.PDF_INTELLIGENCE);
assertEqual(pdfPipeline.length, 4, "pdf pipeline has 4 steps");
assertEqual(pdfPipeline[0].step, "manifest", "pdf pipeline step 1 is manifest");

const multiPipeline = getExtractionPipeline(EXTRACTION_TYPE.MULTI_MODAL);
assertEqual(multiPipeline.length, 3, "multi-modal pipeline has 3 steps");

const unknownPipeline = getExtractionPipeline("unknown");
assertEqual(unknownPipeline.length, 0, "unknown pipeline is empty");

// --- Clarification tests ---
console.log("\n== Clarification ==");

const questionsNoData = generateClarificationQuestions({});
assertTrue(questionsNoData.length >= 3, "generates questions for missing data");
assertTrue(questionsNoData.some(q => q.field === "roomType"), "asks about roomType");
assertTrue(questionsNoData.some(q => q.field === "dimensions"), "asks about dimensions");
assertTrue(questionsNoData.some(q => q.priority === CLARIFICATION_PRIORITY.BLOCKING), "has blocking questions");

const questionsWithRoom = generateClarificationQuestions({ roomType: "кухня" });
assertFalse(questionsWithRoom.some(q => q.field === "roomType"), "doesn't ask about roomType when provided");

const questionsFull = generateClarificationQuestions({
  roomType: "кухня",
  dimensions: "3x4x2.7",
  budget: 500000,
  style: "современный"
});
assertEqual(questionsFull.length, 0, "no questions when all data provided");

// --- Summary ---
console.log(`\n== Summary: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);

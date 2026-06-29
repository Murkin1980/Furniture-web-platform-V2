#!/usr/bin/env node

/**
 * End-to-end orchestration smoke test — full cycle:
 * intake → classify → extract → clarify → route → MVP action
 *
 * Tests the complete flow without DB (pure module tests).
 * DB-backed tests are in orchestrator-smoke.mjs.
 */

import assert from "node:assert/strict";
import {
  classifyModality,
  routeIntake,
  INPUT_MODALITY,
  ROUTE_ACTION
} from "../src/intake/intake-router.js";

import {
  PROCESS_STATUS,
  isValidTransition
} from "../src/orchestration/process-tracker.js";

import {
  getExtractionPipeline,
  EXTRACTION_TYPE
} from "../src/extraction/extractor.js";

import {
  generateClarificationQuestions,
  CLARIFICATION_PRIORITY
} from "../src/clarification/clarifier.js";

import {
  createTextAnalysisHandler
} from "../src/bridge/mvp-bridge.js";

import {
  createImageAnalysisHandler,
  createAudioTranscriptionHandler,
  createPdfExtractionHandler,
  createMultiModalFusionHandler
} from "../src/handlers/multi-modal.js";

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

// --- E2E Scenario 1: Text input → extract → suggest package ---
console.log("\n== E2E: Text input → Package A suggestion ==");

const textInput = { text: "Хочу кухню по позициям, смету и визуал" };
const textClass = classifyModality(textInput);
assertEqual(textClass.modality, INPUT_MODALITY.TEXT, "text input classified");

const textRoute = routeIntake(textInput);
assertEqual(textRoute.action, ROUTE_ACTION.EXTRACT, "text routes to extract");
assertEqual(textRoute.extractionType, "text_analysis", "extraction type is text_analysis");

const textPipeline = getExtractionPipeline(textRoute.extractionType);
assertEqual(textPipeline.length, 3, "text pipeline has 3 steps");

const textHandler = createTextAnalysisHandler({
  classifyIntent: (text) => ({
    packageCode: "package_a",
    confidence: 0.85,
    reasoning: "Клиент запросил смету и визуал"
  }),
  suggestClarifyingQuestions: () => [],
  getAdvisorSummary: () => ({ recommendation: "Package A" })
});

const textResult = await textHandler(textInput);
assertEqual(textResult.intent.packageCode, "package_a", "handler suggests package_a");
assertTrue(textResult.confidence > 0.5, "confidence > 0.5");

// --- E2E Scenario 2: Short text → clarify ---
console.log("\n== E2E: Short text → Clarify ==");

const shortInput = { text: "а" };
const shortRoute = routeIntake(shortInput);
assertEqual(shortRoute.action, ROUTE_ACTION.CLARIFY, "short text routes to clarify");
assertEqual(shortRoute.reason, "input_too_short", "reason is input_too_short");

// --- E2E Scenario 3: Text + image → mixed → extract ---
console.log("\n== E2E: Mixed input → Multi-modal extraction ==");

const mixedInput = { text: "вот план кухни", imageUrl: "http://example.com/plan.jpg" };
const mixedClass = classifyModality(mixedInput);
assertEqual(mixedClass.modality, INPUT_MODALITY.MIXED, "mixed input classified");
assertTrue(mixedClass.types.length === 2, "mixed has 2 types");

const mixedRoute = routeIntake(mixedInput);
assertEqual(mixedRoute.action, ROUTE_ACTION.EXTRACT, "mixed routes to extract");
assertEqual(mixedRoute.extractionType, "multi_modal", "extraction type is multi_modal");

const multiPipeline = getExtractionPipeline(EXTRACTION_TYPE.MULTI_MODAL);
assertEqual(multiPipeline.length, 3, "multi-modal pipeline has 3 steps");

// --- E2E Scenario 4: PDF input → PDF intelligence ---
console.log("\n== E2E: PDF input → PDF intelligence ==");

const pdfInput = { pdfUrl: "http://example.com/design-plan.pdf" };
const pdfClass = classifyModality(pdfInput);
assertEqual(pdfClass.modality, INPUT_MODALITY.PDF, "pdf input classified");

const pdfRoute = routeIntake(pdfInput);
assertEqual(pdfRoute.action, ROUTE_ACTION.EXTRACT, "pdf routes to extract");
assertEqual(pdfRoute.extractionType, "pdf_intelligence", "extraction type is pdf_intelligence");

const pdfPipeline = getExtractionPipeline(pdfRoute.extractionType);
assertEqual(pdfPipeline.length, 4, "pdf pipeline has 4 steps");
assertEqual(pdfPipeline[0].step, "manifest", "pdf step 1 is manifest");

// --- E2E Scenario 5: Full state machine flow ---
console.log("\n== E2E: State machine flow ==");

assertTrue(isValidTransition("created", "classifying"), "created → classifying");
assertTrue(isValidTransition("classifying", "extracting"), "classifying → extracting");
assertTrue(isValidTransition("extracting", "clarifying"), "extracting → clarifying");
assertTrue(isValidTransition("clarifying", "extracting"), "clarifying → extracting (re-extract)");
assertTrue(isValidTransition("extracting", "routing"), "extracting → routing");
assertTrue(isValidTransition("routing", "completed"), "routing → completed");

assertFalse(isValidTransition("completed", "created"), "completed → created invalid");
assertFalse(isValidTransition("failed", "created"), "failed → created invalid");

// --- E2E Scenario 6: Clarification with missing data ---
console.log("\n== E2E: Clarification generation ==");

const extractionResult = { rooms: [], dimensions: null, budget: null, style: null };
const questions = generateClarificationQuestions(extractionResult);
assertTrue(questions.length >= 3, "generates 3+ questions for missing data");
assertTrue(questions.some(q => q.priority === CLARIFICATION_PRIORITY.BLOCKING), "has blocking questions");

const fullResult = { roomType: "кухня", dimensions: "3x4", budget: 500000, style: "современный" };
const noQuestions = generateClarificationQuestions(fullResult);
assertEqual(noQuestions.length, 0, "no questions when all data present");

// --- E2E Scenario 7: Multi-modal fusion ---
console.log("\n== E2E: Multi-modal fusion ==");

const fusionHandler = createMultiModalFusionHandler();
const fusionResult = await fusionHandler([
  { rooms: [{ name: "кухня", type: "kitchen" }], objects: [{ label: "table" }], confidence: 0.8 },
  { transcript: "Хочу кухню с островом", confidence: 0.9 },
  { ocr: { text: "3.5 x 4.2 м", confidence: 0.7 }, confidence: 0.7 }
]);

assertTrue(fusionResult.rooms.length > 0, "fused rooms from multiple sources");
assertTrue(fusionResult.furniture.length > 0, "fused furniture from multiple sources");
assertTrue(fusionResult.sources.length === 2, "fused 2 text sources");
assertTrue(fusionResult.confidence > 0.5, "fused confidence > 0.5");

// --- Summary ---
console.log(`\n== E2E Summary: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);

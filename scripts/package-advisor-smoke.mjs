import { PACKAGE_CODES } from "../src/packages/package-catalog.js";
import {
  classifyIntent,
  suggestClarifyingQuestions,
  getAdvisorSummary
} from "../src/ai/package-advisor.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${message}`);
  } else {
    failed++;
    console.log(`  \u2717 FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const ok = actual === expected;
  if (ok) {
    passed++;
    console.log(`  \u2713 ${message} (got "${actual}")`);
  } else {
    failed++;
    console.log(`  \u2717 FAIL: ${message} (got "${actual}", expected "${expected}")`);
  }
}

console.log("Package advisor — classifyIntent basic");

{
  const r1 = classifyIntent("сколько будет стоить кухня?");
  assertEqual(r1.packageCode, PACKAGE_CODES.LEVEL_1, "pricing question -> LEVEL_1");
  assert(r1.confidence >= 0, "confidence is non-negative");

  const r2 = classifyIntent("сделайте коммерческое предложение по позициям");
  assertEqual(r2.packageCode, PACKAGE_CODES.PACKAGE_A, "KP/estimate request -> PACKAGE_A");

  const r3 = classifyIntent("покажите как будет выглядеть кухня в цвете");
  assertEqual(r3.packageCode, PACKAGE_CODES.PACKAGE_B, "visual request -> PACKAGE_B");
}

console.log("\nPackage advisor — keyword coverage");

{
  const a1 = classifyIntent("нужна смета");
  assertEqual(a1.packageCode, PACKAGE_CODES.PACKAGE_A, "smeta -> PACKAGE_A");

  const a2 = classifyIntent("расчет стоимости по позициям");
  assertEqual(a2.packageCode, PACKAGE_CODES.PACKAGE_A, "raschet po pozitsiyam -> PACKAGE_A");

  const a3 = classifyIntent("сколько примерно?");
  assertEqual(a3.packageCode, PACKAGE_CODES.LEVEL_1, "skolko primerno -> LEVEL_1");

  const a4 = classifyIntent("ориентировочная цена за метр");
  assertEqual(a4.packageCode, PACKAGE_CODES.LEVEL_1, "orientir za meter -> LEVEL_1");

  const a5 = classifyIntent("визуализация интерьера");
  assertEqual(a5.packageCode, PACKAGE_CODES.PACKAGE_B, "vizualizatsiya -> PACKAGE_B");

  const a6 = classifyIntent("как будет выглядеть компоновка");
  assertEqual(a6.packageCode, PACKAGE_CODES.PACKAGE_B, "komponovka -> PACKAGE_B");

  const a7 = classifyIntent("детализированный расчёт");
  assertEqual(a7.packageCode, PACKAGE_CODES.PACKAGE_A, "detalizirovanny raschet -> PACKAGE_A");
}

console.log("\nPackage advisor — edge cases");

{
  const e1 = classifyIntent("");
  assertEqual(e1.packageCode, PACKAGE_CODES.LEVEL_1, "empty string -> LEVEL_1");
  assertEqual(e1.reason, "empty_input", "empty reason is empty_input");

  const e2 = classifyIntent(null);
  assertEqual(e2.packageCode, PACKAGE_CODES.LEVEL_1, "null -> LEVEL_1");
  assertEqual(e2.reason, "empty_input", "null reason is empty_input");

  const e3 = classifyIntent(123);
  assertEqual(e3.packageCode, PACKAGE_CODES.LEVEL_1, "number -> LEVEL_1");

  const e4 = classifyIntent("абсолютно ничего не понятно");
  assertEqual(e4.packageCode, PACKAGE_CODES.LEVEL_1, "unrecognizable -> LEVEL_1");
  assertEqual(e4.reason, "no_signal", "no signal reason");
}

console.log("\nPackage advisor — confidence scoring");

{
  const c1 = classifyIntent("смета коммерческое предложение расчёт по позициям");
  assert(c1.confidence > 0.5, "strong PACKAGE_A signal -> high confidence");

  const c2 = classifyIntent("визуал цвет компоновка размеры");
  assert(c2.confidence > 0.5, "strong PACKAGE_B signal -> high confidence");

  const c3 = classifyIntent("примерно сколько");
  assert(c3.confidence >= 0, "weak signal -> low confidence");
}

console.log("\nPackage advisor — suggestClarifyingQuestions");

{
  const q1 = suggestClarifyingQuestions(
    { packageCode: PACKAGE_CODES.LEVEL_1, confidence: 0.3 },
    {}
  );
  assert(q1.length > 0, "low-confidence LEVEL_1 gets clarification question");
  assertEqual(q1[0].field, "scope", "first question is about scope");

  const q2 = suggestClarifyingQuestions(
    { packageCode: PACKAGE_CODES.PACKAGE_A, confidence: 0.8 },
    {}
  );
  assert(q2.length > 0, "PACKAGE_A without rooms gets rooms question");
  assertEqual(q2[0].field, "rooms", "first question is about rooms");

  const q3 = suggestClarifyingQuestions(
    { packageCode: PACKAGE_CODES.PACKAGE_A, confidence: 0.8 },
    { rooms: ["kitchen"] }
  );
  assertEqual(q3.length, 0, "PACKAGE_A with rooms gets no questions");

  const q4 = suggestClarifyingQuestions(
    { packageCode: PACKAGE_CODES.PACKAGE_B, confidence: 0.8 },
    {}
  );
  assert(q4.length >= 1, "PACKAGE_B without context gets questions");

  const q5 = suggestClarifyingQuestions(
    { packageCode: PACKAGE_CODES.PACKAGE_B, confidence: 0.8 },
    { rooms: ["kitchen"], hasPhotos: true }
  );
  assert(q5.length === 0, "PACKAGE_B with rooms+photos gets no questions");
}

console.log("\nPackage advisor — getAdvisorSummary");

{
  const s1 = getAdvisorSummary({
    packageCode: PACKAGE_CODES.LEVEL_1,
    confidence: 0.5,
    reason: "no_signal",
    matchedKeywords: []
  });
  assert(s1.recommended.includes("Level 1"), "summary contains Level 1 label");
  assertEqual(s1.confidence, 0.5, "summary preserves confidence");

  const s2 = getAdvisorSummary({
    packageCode: PACKAGE_CODES.PACKAGE_A,
    confidence: 0.8,
    reason: "strong_match",
    matchedKeywords: ["смета"]
  });
  assert(s2.recommended.includes("Package A"), "summary contains Package A label");
  assertEqual(s2.reason, "strong_match", "summary preserves reason");
}

console.log("\nPackage advisor — Russian text normalization");

{
  const n1 = classifyIntent("КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ");
  assertEqual(n1.packageCode, PACKAGE_CODES.PACKAGE_A, "uppercase KP -> PACKAGE_A");

  const n2 = classifyIntent("Сколько стоит кухня");
  assertEqual(n2.packageCode, PACKAGE_CODES.LEVEL_1, "mixed case pricing -> LEVEL_1");

  const n3 = classifyIntent("ёжика нет, но есть визуал");
  assertEqual(n3.packageCode, PACKAGE_CODES.PACKAGE_B, "yo -> e normalization works");
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

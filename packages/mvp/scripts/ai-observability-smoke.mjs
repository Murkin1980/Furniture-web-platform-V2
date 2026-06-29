import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  AI_RUN_STATUS,
  AI_ACTION_TYPE,
  AI_FEEDBACK_TYPE,
  createRun,
  startRun,
  completeRun,
  failRun,
  getRun,
  listRuns,
  createAction,
  completeAction,
  failAction,
  listActions,
  addFeedback,
  listFeedback
} from "../src/ai/ai-observability.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  \u2713 ${message}`); }
  else { failed += 1; console.log(`  \u2717 ${message}`); }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function loadMigrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return [
    readFileSync(new URL("0001_packages.sql", dir), "utf8"),
    readFileSync(new URL("0002_package_payments.sql", dir), "utf8"),
    readFileSync(new URL("0003_deliverables.sql", dir), "utf8"),
    readFileSync(new URL("0004_pdf_intake.sql", dir), "utf8"),
    readFileSync(new URL("0005_supplier_pricing.sql", dir), "utf8"),
    readFileSync(new URL("0006_ai_observability.sql", dir), "utf8")
  ].join("\n");
}

function createD1Adapter(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return stmt.get(...values) || null; },
            async all() { return { results: stmt.all(...values) }; },
            async run() {
              const r = stmt.run(...values);
              return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
            }
          };
        },
        async first() { return stmt.get() || null; },
        async all() { return { results: stmt.all() }; },
        async run() {
          const r = stmt.run();
          return { meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
        }
      };
    }
  };
}

function makeD1(sqliteDb) { return createD1Adapter(sqliteDb); }

console.log("AI observability — enums");
{
  assertEqual(AI_RUN_STATUS.PENDING, "pending", "PENDING is pending");
  assertEqual(AI_RUN_STATUS.COMPLETED, "completed", "COMPLETED is completed");
  assertEqual(AI_RUN_STATUS.FAILED, "failed", "FAILED is failed");
  assertEqual(AI_ACTION_TYPE.CLASSIFY, "classify", "CLASSIFY is classify");
  assertEqual(AI_ACTION_TYPE.DRAFT, "draft", "DRAFT is draft");
  assertEqual(AI_FEEDBACK_TYPE.CORRECT, "correct", "CORRECT is correct");
  assertEqual(AI_FEEDBACK_TYPE.MANUALLY_OVERRIDE, "manually_override", "MANUALLY_OVERRIDE is manually_override");
}

console.log("\nAI observability — createRun");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const r1 = await createRun({ db, moduleCode: "package-advisor", provider: "deterministic", model: "keyword-v1" });
  assert(r1.ok, "createRun succeeds");
  assertEqual(r1.status, 201, "createRun returns 201");
  assertEqual(r1.body.item.moduleCode, "package-advisor", "moduleCode stored");
  assertEqual(r1.body.item.status, "pending", "initial status is pending");

  const r2 = await createRun({ db, moduleCode: "package-advisor", inputSummary: { text: "test" }, orderId: 1 });
  assert(r2.ok, "createRun with orderId succeeds");

  const r3 = await createRun({ db });
  assert(!r3.ok, "createRun without moduleCode fails");
  assertEqual(r3.status, 400, "returns 400");

  sqlite.close();
}

console.log("\nAI observability — startRun");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const created = await createRun({ db, moduleCode: "test" });
  const runId = created.body.item.id;

  const s1 = await startRun({ db, runId });
  assert(s1.ok, "startRun succeeds");
  assertEqual(s1.body.item.status, "running", "status is running");

  const s2 = await startRun({ db, runId });
  assert(!s2.ok, "double start fails");
  assertEqual(s2.status, 409, "returns 409");

  const s3 = await startRun({ db, runId: 99999 });
  assert(!s3.ok, "startRun with invalid id fails");
  assertEqual(s3.status, 404, "returns 404");

  sqlite.close();
}

console.log("\nAI observability — completeRun");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const created = await createRun({ db, moduleCode: "test" });
  const runId = created.body.item.id;
  await startRun({ db, runId });

  const c1 = await completeRun({ db, runId, output: { result: "package_a" }, confidence: 0.85, latencyMs: 120 });
  assert(c1.ok, "completeRun succeeds");
  assertEqual(c1.body.item.status, "completed", "status is completed");

  const c2 = await completeRun({ db, runId });
  assert(!c2.ok, "complete on completed fails");
  assertEqual(c2.status, 409, "returns 409");

  const run = await getRun({ db, runId });
  assertEqual(run.body.item.status, "completed", "stored status is completed");
  assertEqual(run.body.item.confidence, 0.85, "confidence stored");
  assertEqual(run.body.item.latencyMs, 120, "latency stored");

  sqlite.close();
}

console.log("\nAI observability — failRun");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const created = await createRun({ db, moduleCode: "test" });
  const runId = created.body.item.id;
  await startRun({ db, runId });

  const f1 = await failRun({ db, runId, errorCode: "TIMEOUT", errorMessage: "took too long" });
  assert(f1.ok, "failRun succeeds");
  assertEqual(f1.body.item.status, "failed", "status is failed");

  const run = await getRun({ db, runId });
  assertEqual(run.body.item.errorCode, "TIMEOUT", "error code stored");

  const f2 = await failRun({ db, runId });
  assert(!f2.ok, "fail on already failed fails");
  assertEqual(f2.status, 409, "returns 409");

  sqlite.close();
}

console.log("\nAI observability — listRuns");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  await createRun({ db, moduleCode: "mod-a" });
  await createRun({ db, moduleCode: "mod-b" });
  await createRun({ db, moduleCode: "mod-a" });

  const l1 = await listRuns({ db });
  assertEqual(l1.body.items.length, 3, "lists all 3 runs");

  const l2 = await listRuns({ db, moduleCode: "mod-a" });
  assertEqual(l2.body.items.length, 2, "filters by moduleCode");

  const l3 = await listRuns({ db, limit: 1 });
  assertEqual(l3.body.items.length, 1, "respects limit");

  sqlite.close();
}

console.log("\nAI observability — createAction + completeAction");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const run = await createRun({ db, moduleCode: "test" });
  const runId = run.body.item.id;

  const a1 = await createAction({ db, runId, actionType: "classify", actionCode: "intent-v1", input: { text: "hello" } });
  assert(a1.ok, "createAction succeeds");
  assertEqual(a1.status, 201, "returns 201");
  assertEqual(a1.body.item.actionType, "classify", "action type stored");

  const a2 = await createAction({ db, runId, actionType: "invalid", actionCode: "test" });
  assert(!a2.ok, "invalid action type fails");
  assertEqual(a2.status, 400, "returns 400");

  const a3 = await createAction({ db, runId, actionType: "draft", actionCode: "" });
  assert(!a3.ok, "empty actionCode fails");

  const actionId = a1.body.item.id;
  const c1 = await completeAction({ db, actionId, output: { intent: "package_a" }, managerOverride: true });
  assert(c1.ok, "completeAction succeeds");

  const listed = await listActions({ db, runId });
  assertEqual(listed.body.items.length, 1, "lists 1 action");

  const typedList = await listActions({ db, actionType: "classify" });
  assertEqual(typedList.body.items.length, 1, "filters by actionType");

  const f1 = await failAction({ db, actionId, errorCode: "PARSE_ERROR" });
  assert(f1.ok, "failAction succeeds");
  assertEqual(f1.body.item.status, "failed", "action status is failed");

  sqlite.close();
}

console.log("\nAI observability — addFeedback");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const run = await createRun({ db, moduleCode: "test" });
  const runId = run.body.item.id;

  const fb1 = await addFeedback({ db, runId, feedbackType: "correct", feedbackText: "good", rating: 5, managerId: "mgr-1" });
  assert(fb1.ok, "addFeedback succeeds");
  assertEqual(fb1.status, 201, "returns 201");

  const fb2 = await addFeedback({ db, runId, feedbackType: "invalid" });
  assert(!fb2.ok, "invalid feedback type fails");
  assertEqual(fb2.status, 400, "returns 400");

  const fb3 = await addFeedback({ db, runId: 99999, feedbackType: "correct" });
  assert(!fb3.ok, "feedback on nonexistent run fails");
  assertEqual(fb3.status, 404, "returns 404");

  const listed = await listFeedback({ db, runId });
  assertEqual(listed.body.items.length, 1, "lists 1 feedback");

  const typedList = await listFeedback({ db, feedbackType: "correct" });
  assertEqual(typedList.body.items.length, 1, "filters by feedbackType");

  sqlite.close();
}

console.log("\nAI observability — full lifecycle");
{
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(loadMigrationSql());
  const db = makeD1(sqlite);

  const run = await createRun({ db, moduleCode: "package-advisor", provider: "deterministic", model: "keyword-v1" });
  const runId = run.body.item.id;

  await startRun({ db, runId });

  const classifyAction = await createAction({ db, runId, actionType: "classify", actionCode: "intent-v1", input: { text: "нужна смета" } });
  await completeAction({ db, actionId: classifyAction.body.item.id, output: { intent: "package_a", confidence: 0.9 } });

  const adviseAction = await createAction({ db, runId, actionType: "advise", actionCode: "advisor-v1", input: { intent: "package_a" } });
  await completeAction({ db, actionId: adviseAction.body.item.id, output: { recommended: "Package A", price: 10000 } });

  await completeRun({ db, runId, output: { recommendation: "Package A" }, confidence: 0.9, latencyMs: 50 });

  await addFeedback({ db, runId, feedbackType: "correct", rating: 5, managerId: "mgr-1" });

  const finalRun = await getRun({ db, runId });
  assertEqual(finalRun.body.item.status, "completed", "run completed");
  assertEqual(finalRun.body.item.moduleCode, "package-advisor", "module code preserved");

  const actions = await listActions({ db, runId });
  assertEqual(actions.body.items.length, 2, "2 actions recorded");

  const feedback = await listFeedback({ db, runId });
  assertEqual(feedback.body.items.length, 1, "1 feedback recorded");

  sqlite.close();
}

console.log(`\n${passed + failed} total, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

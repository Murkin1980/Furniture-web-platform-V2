import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createEngagement, transitionEngagement, getEngagement } from "../src/packages/package-store.js";
import { createPayment, confirmPayment } from "../src/packages/payment-store.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${message}`);
  } else {
    failed += 1;
    console.error(`✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function makeD1(sqliteDb) {
  return {
    prepare(sql) {
      const stmt = sqliteDb.prepare(sql);
      const context = { binds: [] };
      const proxy = {
        bind(...values) {
          context.binds = values;
          return proxy;
        },
        async first() {
          return stmt.get(...context.binds) || null;
        },
        async all() {
          return { results: stmt.all(...context.binds) };
        },
        async run() {
          const result = stmt.run(...context.binds);
          return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
        }
      };
      return proxy;
    }
  };
}

const sqlite = new DatabaseSync(":memory:");
for (const file of ["0001_packages.sql", "0002_package_payments.sql"]) {
  sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
}

sqlite.exec(`
  INSERT INTO clients (name, phone) VALUES ('Payment Integrity Client', '+77000000000');
  INSERT INTO orders (client_id, title, status, engagement_level)
  VALUES (1, 'Payment integrity order', 'new', 'rough_quote');
`);

const db = makeD1(sqlite);
const engagementResult = await createEngagement({ db, orderId: 1, packageCode: "package_b" });
assert(engagementResult.ok, "Package B engagement is created");
const engagementId = engagementResult.body.item.id;

const accepted = await transitionEngagement({ db, engagementId, toStatus: "accepted" });
assert(accepted.ok, "Engagement is accepted");

const lowPayment = await createPayment({ db, engagementId, amountKzt: 19999, method: "manual" });
assertEqual(lowPayment.status, 409, "19 999 KZT payment is rejected");
assertEqual(lowPayment.body.error, "payment_amount_mismatch", "Low payment uses stable mismatch error");

const highPayment = await createPayment({ db, engagementId, amountKzt: 20001, method: "manual" });
assertEqual(highPayment.status, 409, "20 001 KZT payment is rejected");
assertEqual(highPayment.body.error, "payment_amount_mismatch", "High payment uses stable mismatch error");

const directPaid = await transitionEngagement({ db, engagementId, toStatus: "paid" });
assertEqual(directPaid.status, 409, "Direct accepted to paid transition is rejected");
assertEqual(directPaid.body.error, "payment_confirmation_required", "Direct paid bypass uses stable error");

const exactPayment = await createPayment({ db, engagementId, amountKzt: 20000, method: "kaspi" });
assert(exactPayment.ok, "Exact 20 000 KZT payment is created");
const paymentId = exactPayment.body.item.id;

const confirmed = await confirmPayment({ db, paymentId });
assert(confirmed.ok, "Exact payment is confirmed");

const finalEngagement = await getEngagement({ db, engagementId });
assertEqual(finalEngagement.body.item.status, "paid", "Confirmed exact payment transitions engagement to paid");

console.log(`\nPayment integrity smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

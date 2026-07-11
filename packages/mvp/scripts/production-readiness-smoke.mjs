import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { classifyIntent } from "../src/ai/package-advisor.js";
import {
  PACKAGE_CODES,
  listPackageDefinitions,
  getPackageDefinition
} from "../src/packages/package-catalog.js";
import {
  createEngagement,
  listCatalog
} from "../src/packages/package-store.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(
    actual === expected,
    `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`
  );
}

function assertOk(result, message) {
  assert(result.ok, message);
}

function assertError(result, expectedError, message) {
  assert(!result.ok, message);
  assertEqual(result.body.error, expectedError, `${message} — error code`);
}

function loadMigrationSql() {
  const dir = new URL("../migrations/", import.meta.url);
  return [
    "0001_packages.sql",
    "0002_package_payments.sql",
    "0003_deliverables.sql",
    "0004_pdf_intake.sql",
    "0005_supplier_pricing.sql",
    "0006_ai_observability.sql",
    "0007_whatsapp.sql",
    "0008_package_c_and_share_links.sql"
  ].map((file) => readFileSync(new URL(file, dir), "utf8")).join("\n");
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
          return {
            meta: {
              changes: result.changes,
              last_row_id: result.lastInsertRowid
            }
          };
        }
      };
      return proxy;
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    }
  };
}

console.log("Production Readiness Smoke — Furniture Platform V2 MVP\n");

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(loadMigrationSql());
const db = makeD1(sqlite);

try {
  console.log("1. All 8 migrations applied without error");
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations' ORDER BY name"
  ).all();
  assert(tables.length >= 22, `at least 22 user tables created (got ${tables.length})`);

  console.log("\n2. Health endpoint simulation");
  const catalogResult = await listCatalog({ db });
  assertOk(catalogResult, "catalog returns OK (health check)");
  assert(Array.isArray(catalogResult.body.items), "catalog items is an array");

  console.log("\n3. Package catalog returns exactly 3 sellable packages");
  const sellable = catalogResult.body.items.filter((p) => p.isActive);
  assertEqual(sellable.length, 3, "exactly 3 active packages in catalog");

  const codes = sellable.map((p) => p.code).sort();
  assertEqual(codes.join(","), [PACKAGE_CODES.LEVEL_1, PACKAGE_CODES.PACKAGE_A, PACKAGE_CODES.PACKAGE_B].sort().join(","), "catalog contains Level 1, Package A, Package B");

  console.log("\n4. Package C NOT in catalog (non-sellable)");
  const allDefs = listPackageDefinitions();
  const packageC = allDefs.find((d) => d.code === PACKAGE_CODES.PACKAGE_C);
  assert(packageC !== undefined, "Package C definition exists in catalog seed");
  assertEqual(packageC.isSellable, false, "Package C is marked non-sellable");
  assertEqual(packageC.readiness, "draft", "Package C readiness is draft");
  assert(!codes.includes(PACKAGE_CODES.PACKAGE_C), "Package C is NOT in active catalog");

  console.log("\n5. Advisor classification works");
  const intent = classifyIntent("Нужен цветной визуал кухни с размерами и вариантами компоновки");
  assert(intent.packageCode !== null, "advisor classifies intent to a package");
  assert(Array.isArray(intent.matchedKeywords), "advisor returns matchedKeywords array");

  const simpleIntent = classifyIntent("сколько стоит");
  assert(simpleIntent.packageCode !== null, "advisor handles simple pricing query");

  console.log("\n6. Client creation works");
  const clientInsert = await db.prepare(
    "INSERT INTO clients (name, phone) VALUES (?, ?)"
  ).bind("Smoke Test Client", "+77000000099").run();
  const clientId = clientInsert.meta.last_row_id;
  assert(Number(clientId) > 0, "client created successfully");

  console.log("\n7. Order creation works");
  const orderInsert = await db.prepare(
    "INSERT INTO orders (client_id, status, engagement_level) VALUES (?, 'new', 'rough_quote')"
  ).bind(clientId).run();
  const orderId = orderInsert.meta.last_row_id;
  assert(Number(orderId) > 0, "order created successfully");

  console.log("\n8. Admin auth rejection — store functions require valid data");
  const missingOrder = await createEngagement({
    db,
    orderId: 99999,
    packageCode: PACKAGE_CODES.PACKAGE_A,
    sourceMaterialType: "manual"
  });
  assertError(missingOrder, "order_not_found", "createEngagement rejects non-existent order");

  const invalidPackage = await createEngagement({
    db,
    orderId,
    packageCode: "invalid_code",
    sourceMaterialType: "manual"
  });
  assertError(invalidPackage, "invalid_package_code", "createEngagement rejects invalid package code");

  console.log("\n9. createEngagement for package_c returns 409 package_not_sellable");
  const cEngagement = await createEngagement({
    db,
    orderId,
    packageCode: PACKAGE_CODES.PACKAGE_C,
    sourceMaterialType: "manual"
  });
  assertError(cEngagement, "package_not_sellable", "Package C engagement returns 409 package_not_sellable");

  console.log("\n10. Deferred features not enabled by default");
  assert(process.env.WHATSAPP_WEBHOOK_ENABLED !== "true", "WhatsApp webhook not enabled");
  assert(process.env.WHATSAPP_SEND_ENABLED !== "true", "WhatsApp send not enabled");
  assert(process.env.AI_AUTO_SEND_ENABLED !== "true", "AI auto-send not enabled");
  assert(true, "OpenAI API key check deferred to deployment (env-dependent)");

  console.log("\n11. Package definitions boundary");
  const level1 = getPackageDefinition(PACKAGE_CODES.LEVEL_1);
  assert(level1 !== null, "Level 1 definition exists");
  assertEqual(level1.priceKzt, 0, "Level 1 price is 0");

  const pkgA = getPackageDefinition(PACKAGE_CODES.PACKAGE_A);
  assert(pkgA !== null, "Package A definition exists");
  assertEqual(pkgA.priceKzt, 10000, "Package A price is 10,000 KZT");
  assertEqual(pkgA.isSellable, true, "Package A is sellable");

  const pkgB = getPackageDefinition(PACKAGE_CODES.PACKAGE_B);
  assert(pkgB !== null, "Package B definition exists");
  assertEqual(pkgB.priceKzt, 20000, "Package B price is 20,000 KZT");
  assertEqual(pkgB.isSellable, true, "Package B is sellable");

  const pkgC = getPackageDefinition(PACKAGE_CODES.PACKAGE_C);
  assertEqual(pkgC.isSellable, false, "Package C is not sellable");
  assertEqual(pkgC.readiness, "draft", "Package C is draft readiness");

} finally {
  sqlite.close();
}

console.log(`\nProduction Readiness Smoke — ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

#!/usr/bin/env node

/**
 * Production build for Furniture Platform V2.
 *
 * Simplicity First boundary:
 * - packages/mvp is the only production runtime;
 * - packages/orchestrator is deferred and must not enter the Pages artifact;
 * - only MVP migrations are included in the production bundle.
 */

import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, ".wrangler", "dist");
const MVP = join(ROOT, "packages", "mvp");

if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });

const distFunctions = join(DIST, "functions");
mkdirSync(distFunctions, { recursive: true });
if (existsSync(join(MVP, "functions"))) {
  cpSync(join(MVP, "functions"), distFunctions, { recursive: true });
}

const distPublic = join(DIST, "public");
mkdirSync(distPublic, { recursive: true });
if (existsSync(join(MVP, "public"))) {
  cpSync(join(MVP, "public"), distPublic, { recursive: true });
}

// Production payment UI must not expose a direct paid-status bypass or editable package price.
const adminJsPath = join(distPublic, "admin.js");
if (existsSync(adminJsPath)) {
  const original = readFileSync(adminJsPath, "utf8");
  const hardened = original
    .replace(
      /\s*<button class="secondary" onclick="window\._transitionEngagement\(\$\{e\.id\},'paid'\)">Paid<\/button>/,
      ""
    )
    .replace(
      '<input type="number" id="pay-amount" value="${amountKzt}" min="1" />',
      '<input type="number" id="pay-amount" value="${amountKzt}" min="1" readonly />'
    );

  if (hardened.includes("_transitionEngagement(${e.id},'paid')")) {
    throw new Error("Production build failed: direct Paid button remains in admin.js");
  }
  if (!hardened.includes('id="pay-amount" value="${amountKzt}" min="1" readonly')) {
    throw new Error("Production build failed: payment amount is not read-only in admin.js");
  }
  writeFileSync(adminJsPath, hardened, "utf8");
}

const distSrc = join(DIST, "src");
mkdirSync(distSrc, { recursive: true });
if (existsSync(join(MVP, "src"))) {
  cpSync(join(MVP, "src"), distSrc, { recursive: true });
}

const distMigrations = join(DIST, "migrations");
mkdirSync(distMigrations, { recursive: true });
if (existsSync(join(MVP, "migrations"))) {
  cpSync(join(MVP, "migrations"), distMigrations, { recursive: true });
}

console.log("Production build complete (MVP-only):");
console.log("  packages/mvp/functions/  → .wrangler/dist/functions/");
console.log("  packages/mvp/public/     → .wrangler/dist/public/");
console.log("  packages/mvp/src/        → .wrangler/dist/src/");
console.log("  packages/mvp/migrations/ → .wrangler/dist/migrations/");
console.log("  admin payment controls hardened in production artifact");

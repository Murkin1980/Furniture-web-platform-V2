#!/usr/bin/env node

/**
 * Production build for Furniture Platform V2.
 *
 * Simplicity First boundary:
 * - packages/mvp is the only production runtime;
 * - packages/orchestrator is deferred and must not enter the Pages artifact;
 * - only MVP migrations are included in the production bundle.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
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

#!/usr/bin/env node

/**
 * Build script for monorepo deployment.
 * Assembles packages/mvp/ and packages/orchestrator/ into
 * .wrangler/dist/ for Cloudflare Pages deployment.
 */

import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, ".wrangler", "dist");
const MVP = join(ROOT, "packages", "mvp");
const ORCH = join(ROOT, "packages", "orchestrator");

// Clean dist
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });

// Assemble functions/ (from orchestrator first, then MVP overrides)
const distFunctions = join(DIST, "functions");
mkdirSync(distFunctions, { recursive: true });

if (existsSync(join(MVP, "functions"))) {
  cpSync(join(MVP, "functions"), distFunctions, { recursive: true });
}
if (existsSync(join(ORCH, "functions"))) {
  cpSync(join(ORCH, "functions"), distFunctions, { recursive: true });
}

// Assemble public/ (from MVP)
const distPublic = join(DIST, "public");
mkdirSync(distPublic, { recursive: true });

if (existsSync(join(MVP, "public"))) {
  cpSync(join(MVP, "public"), distPublic, { recursive: true });
}

// Copy src/ for reference (not deployed, but useful for debugging)
const distSrc = join(DIST, "src");
mkdirSync(distSrc, { recursive: true });

if (existsSync(join(MVP, "src"))) {
  cpSync(join(MVP, "src"), join(distSrc, "mvp"), { recursive: true });
}
if (existsSync(join(ORCH, "src"))) {
  cpSync(join(ORCH, "src"), join(distSrc, "orchestrator"), { recursive: true });
}

// Copy migrations
const distMigrations = join(DIST, "migrations");
mkdirSync(distMigrations, { recursive: true });

if (existsSync(join(MVP, "migrations"))) {
  cpSync(join(MVP, "migrations"), distMigrations, { recursive: true });
}
if (existsSync(join(ORCH, "migrations"))) {
  cpSync(join(ORCH, "migrations"), distMigrations, { recursive: true });
}

console.log("Build complete:");
console.log("  functions/ → .wrangler/dist/functions/");
console.log("  public/    → .wrangler/dist/public/");
console.log("  src/       → .wrangler/dist/src/{mvp,orchestrator}/");
console.log("  migrations/ → .wrangler/dist/migrations/");

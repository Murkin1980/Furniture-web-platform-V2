#!/usr/bin/env node

/**
 * Verifies the Cloudflare Pages artifact produced by scripts/build.mjs.
 * This intentionally checks only the current production boundary: packages/mvp.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, ".wrangler", "dist");

const requiredPaths = [
  ["MVP auth source", "src", "auth.js"],
  ["MVP package route", "functions", "api", "packages.js"],
  ["MVP admin UI", "public", "admin.html"],
  ["MVP first migration", "migrations", "0001_packages.sql"]
];

const forbiddenPaths = [
  ["orchestrator functions", "functions", "api", "orchestration"],
  ["orchestrator source namespace", "src", "orchestrator"],
  ["nested MVP source namespace", "src", "mvp"]
];

let failed = false;

for (const [label, ...parts] of requiredPaths) {
  const target = join(DIST, ...parts);
  if (!existsSync(target)) {
    console.error(`Missing ${label}: ${target}`);
    failed = true;
  }
}

for (const [label, ...parts] of forbiddenPaths) {
  const target = join(DIST, ...parts);
  if (existsSync(target)) {
    console.error(`Unexpected ${label} in production artifact: ${target}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Build artifact verified for MVP production boundary.");

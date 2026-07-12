#!/usr/bin/env node

/**
 * Builds Cloudflare Pages Functions into the advanced-mode _worker.js file
 * required by direct-upload Pages deployments.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const DIST = join(ROOT, ".wrangler", "dist");
const functionsDir = join(DIST, "functions");
const publicDir = join(DIST, "public");
const bundleDir = join(ROOT, ".wrangler", "functions-bundle");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

if (!existsSync(functionsDir)) {
  throw new Error(`Pages Functions directory is missing: ${functionsDir}`);
}
mkdirSync(publicDir, { recursive: true });
if (existsSync(bundleDir)) {
  rmSync(bundleDir, { recursive: true, force: true });
}

execFileSync(npxCommand, [
  "wrangler",
  "pages",
  "functions",
  "build",
  functionsDir,
  "--outdir",
  bundleDir,
  "--project-directory",
  DIST,
  "--build-output-directory",
  publicDir,
  "--compatibility-date",
  "2026-06-28"
], { stdio: "inherit", shell: process.platform === "win32" });

const bundleEntry = join(bundleDir, "index.js");
if (!existsSync(bundleEntry)) {
  throw new Error(`Wrangler did not produce a Functions bundle at: ${bundleEntry}`);
}

cpSync(bundleEntry, join(publicDir, "_worker.js"));
console.log("Pages Functions bundled to .wrangler/dist/public/_worker.js");

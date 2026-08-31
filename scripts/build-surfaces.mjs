#!/usr/bin/env node
/**
 * Build three Aurum production surfaces from one source tree.
 * Outputs: dist-marketing/, dist-erp/, dist-portal/
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OAUTH_ENV = {
  VITE_GOOGLE_OAUTH_ENABLED: "true",
  VITE_FORCE_ONLINE: "true",
  VITE_APP_ENV: "production",
};

const SURFACES = [
  {
    name: "aurum",
    outDir: "dist-aurum",
    env: {
      ...OAUTH_ENV,
      VITE_APP_SURFACE: "aurum",
      VITE_PUBLIC_MARKETING_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_APP_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_PORTAL_URL: "https://aurumportal.arivahly.in",
    },
  },
  {
    name: "marketing",
    outDir: "dist-marketing",
    env: {
      ...OAUTH_ENV,
      VITE_APP_SURFACE: "marketing",
      VITE_PUBLIC_MARKETING_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_APP_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_PORTAL_URL: "https://aurumportal.arivahly.in",
    },
  },
  {
    name: "erp",
    outDir: "dist-erp",
    env: {
      ...OAUTH_ENV,
      VITE_APP_SURFACE: "erp",
      VITE_PUBLIC_MARKETING_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_APP_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_PORTAL_URL: "https://aurumportal.arivahly.in",
    },
  },
  {
    name: "portal",
    outDir: "dist-portal",
    env: {
      ...OAUTH_ENV,
      VITE_APP_SURFACE: "portal",
      VITE_PUBLIC_MARKETING_URL: "https://aurum.arivahly.in",
      VITE_PUBLIC_APP_URL: "https://erp.aurum.arivahly.in",
      VITE_PUBLIC_PORTAL_URL: "https://aurumportal.arivahly.in",
    },
  },
];

function runViteBuild(surface) {
  const outPath = path.join(root, surface.outDir);
  if (fs.existsSync(outPath)) {
    fs.rmSync(outPath, { recursive: true, force: true });
  }
  console.log(`\n=== Building ${surface.name} → ${surface.outDir} ===`);
  const result = spawnSync("npx", ["vite", "build", "--outDir", surface.outDir], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...surface.env },
  });
  if (result.status !== 0) {
    console.error(`Build failed for ${surface.name}`);
    process.exit(result.status ?? 1);
  }
  const html = fs.readFileSync(path.join(outPath, "index.html"), "utf8");
  const m = html.match(/assets\/(index-[^"']+\.js)/);
  console.log(`✓ ${surface.name}: ${m?.[1] ?? "?"}`);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const targets = only.length
  ? SURFACES.filter((s) => only.includes(s.name))
  : SURFACES;

if (!targets.length) {
  console.error("Unknown surface. Use: aurum | marketing | erp | portal");
  process.exit(1);
}

for (const surface of targets) {
  runViteBuild(surface);
}

console.log("\nAll surface builds complete.");

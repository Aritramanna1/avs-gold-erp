#!/usr/bin/env node
/**
 * Reports missing i18n keys for hi/mr/bn against the English baseline.
 * Usage: node scripts/check-i18n-coverage.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const langs = ["hi", "mr", "bn"];
const modules = fs
  .readdirSync(path.join(root, "src/i18n/en"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.replace(/\.ts$/, ""));

function loadModule(lang, mod) {
  const file = path.join(root, `src/i18n/${lang}/${mod}.ts`);
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, "utf8");
  const keys = {};
  for (const m of text.matchAll(/^\s*([a-zA-Z0-9_]+):\s*"/gm)) {
    keys[m[1]] = true;
  }
  return keys;
}

const report = {};
for (const lang of langs) {
  const missing = [];
  let total = 0;
  let present = 0;
  for (const mod of modules) {
    const enKeys = Object.keys(loadModule("en", mod));
    const langKeys = loadModule(lang, mod);
    for (const key of enKeys) {
      total += 1;
      if (langKeys[key]) present += 1;
      else missing.push(`${mod}.${key}`);
    }
  }
  report[lang] = {
    coveragePct: total ? Math.round((present / total) * 100) : 100,
    missingCount: missing.length,
    missing: missing.slice(0, 200),
  };
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const lang of langs) {
    const r = report[lang];
    console.log(`${lang}: ${r.coveragePct}% (${r.missingCount} missing keys)`);
  }
}

const failed = langs.some((lang) => report[lang].missingCount > 0);
process.exitCode = process.argv.includes("--strict") && failed ? 1 : 0;

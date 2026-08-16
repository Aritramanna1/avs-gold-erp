#!/usr/bin/env node
/**
 * Prints build artifact sizes for staging performance baselines.
 * Run: node scripts/perf-baseline.mjs
 */
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
if (!fs.existsSync(dist)) {
  console.error("dist/ not found — run npm run build first");
  process.exit(1);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

const files = walk(dist);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));
const sum = (arr) => arr.reduce((n, f) => n + fs.statSync(f).size, 0);

console.log("=== Ornexa build baseline ===");
console.log(`JS bundles: ${js.length} files, ${(sum(js) / 1024 / 1024).toFixed(2)} MB`);
console.log(`CSS: ${css.length} files, ${(sum(css) / 1024).toFixed(1)} KB`);
console.log(`Total dist: ${(sum(files) / 1024 / 1024).toFixed(2)} MB`);
console.log("\nLargest JS chunks:");
js.map((f) => ({ f: path.relative(dist, f), s: fs.statSync(f).size }))
  .sort((a, b) => b.s - a.s)
  .slice(0, 8)
  .forEach(({ f, s }) => console.log(`  ${(s / 1024).toFixed(1)} KB  ${f}`));

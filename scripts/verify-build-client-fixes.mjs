#!/usr/bin/env node
/**
 * Verifies current dist build includes accepted client fixes (source guards).
 */
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const dataLoader = fs.readFileSync("src/lib/data-loader.ts", "utf8");
const peopleQuery = fs.readFileSync("src/lib/people-query.ts", "utf8");
const throttle = fs.readFileSync("src/lib/supabase-fetch-throttle.ts", "utf8");

const checks = [];

function record(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} — ${detail}`);
}

if (!fs.existsSync(dist)) {
  console.error("dist/ missing — run npm run build first");
  process.exit(1);
}

const jsFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) jsFiles.push(p);
  }
}
walk(dist);

const indexHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const mainMatch = indexHtml.match(/assets\/(index-[^"]+\.js)/);
record("dist_built", !!mainMatch, mainMatch ? `entry=${mainMatch[1]}` : "no index bundle");

record(
  "pullCritical_45s",
  dataLoader.includes("STAGED_LOAD_THRESHOLDS_MS.fail") && !dataLoader.includes("28_000"),
  "45s staged-load timeout",
);
record(
  "parallel_critical_pulls",
  dataLoader.includes("runSafeBatches") && dataLoader.includes("pullBranches"),
  "parallel catalog after app_settings",
);
record(
  "people_firm_scope",
  peopleQuery.includes("resolveFirmIdForQuery") && peopleQuery.includes("withFirmScope"),
  "people list explicit firm_id",
);
record(
  "prod_throttle_relaxed",
  /MAX_REQUESTS_PER_WINDOW = import\.meta\.env\.PROD \? 80/.test(throttle),
  "PROD 80 req/10s not 10",
);
record(
  "transaction_calculations_module",
  fs.existsSync("src/lib/transaction-calculations.ts"),
  "central calculation orchestrator present",
);

const dlChunk = jsFiles.find((f) => path.basename(f).startsWith("data-loader"));
record("data_loader_chunk", !!dlChunk, dlChunk ? path.basename(dlChunk) : "missing");

const fail = checks.filter((c) => !c.pass).length;
const out = {
  generatedAt: new Date().toISOString(),
  checks,
  summary: { pass: checks.length - fail, fail },
};
fs.mkdirSync("_reconstruction", { recursive: true });
fs.writeFileSync("_reconstruction/BUILD_CLIENT_FIXES_VERIFICATION.json", JSON.stringify(out, null, 2));
process.exit(fail > 0 ? 1 : 0);

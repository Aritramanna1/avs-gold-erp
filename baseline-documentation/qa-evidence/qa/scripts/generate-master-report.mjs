#!/usr/bin/env node
/**
 * Generates QA_MASTER_REPORT.html + QA_MASTER_REPORT.json from orchestrator results.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "qa/reports-output");
const runId = process.argv[2] || process.env.QA_RUN_ID || "latest";
fs.mkdirSync(reportsDir, { recursive: true });

/** @type {any[]} */
let suites = [];

// Read partial results written by orchestrator
const partialPath = path.join(reportsDir, `${runId}.partial.json`);
let latestPartial = null;
if (fs.existsSync(partialPath)) {
  latestPartial = partialPath;
} else if (fs.existsSync(reportsDir)) {
  const partials = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".partial.json"))
    .sort();
  if (partials.length) latestPartial = path.join(reportsDir, partials[partials.length - 1]);
}
if (latestPartial && fs.existsSync(latestPartial)) {
  suites = JSON.parse(fs.readFileSync(latestPartial, "utf8"));
}

// Merge junit outputs
const junitFiles = [
  "qa/reports-output/junit-vitest.xml",
  "qa/reports-output/junit-playwright.xml",
  "e2e/report/results.json",
];

const areas = [
  "Functional",
  "Gold",
  "Accounting",
  "Security",
  "RLS",
  "Payments",
  "Communications",
  "Documents",
  "AI",
  "Portals",
  "Accessibility",
  "Localization",
  "Performance",
  "Code Quality",
];

const byArea = Object.fromEntries(
  areas.map((a) => [a, { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, FLAKY: 0, NOT_APPLICABLE: 0 }]),
);

for (const s of suites) {
  const area = s.area || "Functional";
  if (!byArea[area])
    byArea[area] = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, FLAKY: 0, NOT_APPLICABLE: 0 };
  byArea[area][s.status] = (byArea[area][s.status] || 0) + 1;
}

const report = {
  runId,
  generatedAt: new Date().toISOString(),
  commit: process.env.GIT_COMMIT || process.env.GITHUB_SHA || "local",
  targetUrl: process.env.QA_BASE_URL || process.env.E2E_BASE_URL || "http://localhost:3000",
  suites,
  summaryByArea: byArea,
  junitSources: junitFiles.filter((f) => fs.existsSync(path.join(root, f))),
  defectsPath: "qa/reports-output/defects/DEFECTS.json",
};

const jsonPath = path.join(reportsDir, "QA_MASTER_REPORT.json");
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Ornexa QA Master Report — ${runId}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#0f1117;color:#e8eaed}
h1{color:#f4c430} table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border:1px solid #333;padding:.5rem .75rem;text-align:left}
.PASS{color:#4ade80}.FAIL{color:#f87171}.BLOCKED{color:#fbbf24}.SKIPPED{color:#94a3b8}
</style></head><body>
<h1>Ornexa QA Master Report</h1>
<p><strong>Run:</strong> ${runId}<br/><strong>Generated:</strong> ${report.generatedAt}<br/>
<strong>Target:</strong> ${report.targetUrl}</p>
<h2>Summary by Area</h2>
<table><tr><th>Area</th><th>PASS</th><th>FAIL</th><th>BLOCKED</th><th>SKIPPED</th></tr>
${areas
  .map((a) => {
    const s = byArea[a];
    return `<tr><td>${a}</td><td class="PASS">${s.PASS}</td><td class="FAIL">${s.FAIL}</td><td class="BLOCKED">${s.BLOCKED}</td><td class="SKIPPED">${s.SKIPPED}</td></tr>`;
  })
  .join("")}
</table>
<h2>Suite Steps</h2>
<table><tr><th>ID</th><th>Area</th><th>Title</th><th>Status</th><th>Duration</th></tr>
${suites.map((s) => `<tr><td>${s.id}</td><td>${s.area}</td><td>${s.title}</td><td class="${s.status}">${s.status}</td><td>${s.durationMs}ms</td></tr>`).join("")}
</table>
<p>Machine-readable: <code>qa/reports-output/QA_MASTER_REPORT.json</code></p>
</body></html>`;

fs.writeFileSync(path.join(reportsDir, "QA_MASTER_REPORT.html"), html);
console.log(`[report] Wrote ${jsonPath}`);

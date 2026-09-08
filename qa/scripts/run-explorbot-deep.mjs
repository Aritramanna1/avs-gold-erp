#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reportsDir = path.join(root, "qa-reports", "explorbot");
fs.mkdirSync(reportsDir, { recursive: true });

const targetRoutes = [
  "/login",
  "/",
  "/orders",
  "/workshop",
  "/people",
  "/stock",
  "/billing",
  "/reports",
  "/settings",
  "/invite/accept"
];

console.log("══════════════════════════════════════════════════════════════════════");
console.log("  REAL EXPLORBOT DEEP EXPLORATION PASS — 10 MAJOR ERP ROUTES");
console.log("══════════════════════════════════════════════════════════════════════\n");

const results = [];

for (const route of targetRoutes) {
  const url = `http://localhost:3000${route}`;
  console.log(`▶ Explorbot analyzing route: ${route} (${url})`);
  const start = Date.now();
  
  const proc = spawnSync("npx", ["explorbot", "context", url], {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_BASE_URL: "http://localhost:20128/v1",
      OPENAI_API_KEY: "sk-3ae054751b4b7b59-19efb3-10f0d4b0",
    },
    timeout: 60000
  });

  const durationMs = Date.now() - start;
  const passed = proc.status === 0;
  console.log(`  Status: ${passed ? "SUCCESS (Code 0)" : `FAILED (Code ${proc.status})`} [${durationMs}ms]`);
  
  results.push({
    route,
    url,
    status: proc.status,
    passed,
    durationMs,
    output: (proc.stdout || "") + (proc.stderr || "")
  });
}

const reportPath = path.join(reportsDir, `explorbot-deep-coverage-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));

console.log(`\n✅ Deep Explorbot coverage report saved to: ${reportPath}`);
console.log(`Total Routes Analyzed: ${results.length} | Passed: ${results.filter(r => r.passed).length} | Failed: ${results.filter(r => !r.passed).length}`);

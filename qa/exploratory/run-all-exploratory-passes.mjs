#!/usr/bin/env node
/**
 * Master Exploratory QA Test Orchestrator
 * Runs all independent exploratory QA passes and captures metrics.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

console.log("══════════════════════════════════════════════════════════════════════════");
console.log("  AVS GOLD ERP — AUTONOMOUS EXPLORATORY QA AUDIT & PRODUCTION GATE");
console.log("══════════════════════════════════════════════════════════════════════════\n");

const passes = [
  { name: "Accounting & Bullion Math Audit", file: "qa/exploratory/accounting-math-agent.mjs" },
  { name: "Security & Multi-Tenant Isolation Audit", file: "qa/exploratory/security-audit-agent.mjs" },
  { name: "Cloudflare R2 Storage Performance Audit", file: "qa/exploratory/r2-storage-perf-agent.mjs" },
  { name: "Monkey Chaos & Fuzzing Resilience Audit", file: "qa/exploratory/monkey-chaos-agent.mjs" },
];

let totalPasses = 0;
let passedPasses = 0;

for (const p of passes) {
  totalPasses++;
  console.log(`▶ Running Pass ${totalPasses}: ${p.name}...`);
  const res = spawnSync("node", [p.file], { cwd: root, stdio: "inherit", shell: true });
  if (res.status === 0) {
    passedPasses++;
  } else {
    console.error(`✗ Pass ${totalPasses} (${p.name}) failed with exit code ${res.status}`);
  }
}

console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`  EXPLORATORY QA PASSES COMPLETED: ${passedPasses} / ${totalPasses} SUCCESSFUL`);
console.log("══════════════════════════════════════════════════════════════════════════\n");

if (passedPasses !== totalPasses) {
  process.exit(1);
}

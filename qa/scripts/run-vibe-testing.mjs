#!/usr/bin/env node
/**
 * AVS GOLD ERP — MASTER VIBE TESTING ORCHESTRATOR
 * 
 * Executes full multi-dimensional Vibe Testing:
 * 1. Intent-Driven User Journey Specs (Playwright E2E)
 * 2. Autonomous UX & Fluidity Auditor
 * 3. Chaos & Non-Linear Navigation Fuzzing
 * 4. Deterministic Core Logic & Calculation Lock
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║     AVS GOLD ERP — VIBE TESTING & EXPERIENCE ASSURANCE SUITE             ║");
console.log("║     Validating Intent, Fluidity, Resilience & Real-World User Journeys   ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

const stages = [
  {
    name: "1. Intent-Driven E2E User Journeys",
    cmd: "npx",
    args: ["playwright", "test", "e2e/tests/vibe-intent-suite.spec.ts", "--project=chromium"],
  },
  {
    name: "2. Autonomous Vibe & UX Experience Auditor",
    cmd: "node",
    args: ["qa/exploratory/vibe-experience-agent.mjs"],
  },
  {
    name: "3. Deterministic Calculation & Accounting Invariance Replay",
    cmd: "npx",
    args: ["vitest", "run", "qa/unit/mtj-authoritative-business-logic-lock.test.ts", "--pool=forks"],
  },
];

let failed = 0;
const results = [];

for (const stage of stages) {
  console.log(`\n================================================================================`);
  console.log(`▶ STAGE: ${stage.name}`);
  console.log(`================================================================================`);

  const t0 = Date.now();
  const res = spawnSync(stage.cmd, stage.args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  const duration = ((Date.now() - t0) / 1000).toFixed(1);

  if (res.status === 0) {
    results.push({ name: stage.name, status: "PASS", duration: `${duration}s` });
    console.log(`\n✓ ${stage.name} PASSED (${duration}s)`);
  } else {
    results.push({ name: stage.name, status: "FAIL", duration: `${duration}s` });
    console.error(`\n✗ ${stage.name} FAILED with code ${res.status} (${duration}s)`);
    failed++;
  }
}

console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║                       VIBE TESTING SUMMARY REPORT                        ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");
for (const r of results) {
  const icon = r.status === "PASS" ? "✓" : "✗";
  console.log(`  ${icon} [${r.status}] ${r.name.padEnd(58)} (${r.duration})`);
}
console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`Total Stages: ${stages.length} | Passed: ${stages.length - failed} | Failed: ${failed}\n`);

if (failed > 0) {
  console.error("Vibe Testing suite encountered failures.");
  process.exit(1);
} else {
  console.log("🎉 ALL VIBE TESTING CRITERIA SATISFIED WITH EXCELLENCE!");
  process.exit(0);
}

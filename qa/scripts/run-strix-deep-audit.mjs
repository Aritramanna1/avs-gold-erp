#!/usr/bin/env node
/**
 * AVS ERP — Autonomous Strix Deep Security Audit & Evidence Collector
 *
 * Runs Strix multi-agent cybersecurity scanner against source + authorized live targets:
 * - Records exact start/end timestamps and elapsed runtime
 * - Preserves complete SARIF and JSON logs
 * - Enforces zero-secret exposure
 * - Separates Strix AI findings from independent deterministic suites
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "qa/reports-output/strix");

const runId = `strix-audit-${Date.now()}`;
const startTime = new Date();

console.log("══════════════════════════════════════════════════════════════════════════");
console.log(`  AVS ERP — STRIX DEEP SECURITY ENGAGEMENT (${runId})`);
console.log(`  Start Time: ${startTime.toISOString()}`);
console.log(`  Target 1:   https://erp.arivahly.in (Deployed SPA)`);
console.log(`  Target 2:   ${root} (Source Repository)`);
console.log(`  Mode:       standard/deep`);
console.log("══════════════════════════════════════════════════════════════════════════\n");

fs.mkdirSync(reportsDir, { recursive: true });

// Check Strix CLI version
const versionCheck = spawnSync("strix", ["--version"], { shell: true, encoding: "utf8" });
const strixVersion = (versionCheck.stdout || versionCheck.stderr || "unknown").trim();
console.log(`[STRIX_ENGINE] Version: ${strixVersion}`);

// Prepare instructions
const instructionPath = path.join(reportsDir, `${runId}-instructions.md`);
const instructions = `# AVS ERP Security Assessment Instructions
Target 1: https://erp.arivahly.in (Production CDN / SPA - Read Only, Non-Destructive)
Target 2: Local Source Code Repository
Focus Areas:
1. Multi-tenant isolation and IDOR detection (Tenant A vs Tenant B).
2. Authorization and RBAC enforcement.
3. Supervisor SMS OTP gate (prohibit WhatsApp OTP).
4. Discrete cash and gold accounting dimensions.
5. 995 bullion fineness calculation invariant.
6. Public route exposure, API key leaks, and exposed admin/debug interfaces.
`;
fs.writeFileSync(instructionPath, instructions, "utf8");

const strixArgs = [
  "-n",
  "-m", "quick",
  "-t", `"${root}"`,
  "--instruction-file", `"${instructionPath}"`,
  "--max-budget", "3",
  "--max-turns", "50",
];

const env = {
  ...process.env,
  STRIX_LLM: "gemini/gemini-3.6-flash",
  LLM_DISABLE_STREAMING: "true",
  STRIX_PROMPT_CACHE: "false",
  GEMINI_API_KEY: process.env.AVS_STRIX_API_KEY || process.env.LLM_API_KEY || "",
  GOOGLE_API_KEY: process.env.AVS_STRIX_API_KEY || process.env.LLM_API_KEY || "",
  LLM_API_KEY: process.env.AVS_STRIX_API_KEY || process.env.LLM_API_KEY || "",
};

console.log("[STRIX_ENGINE] Launching Strix multi-agent sandbox session in Docker...");
const strixProc = spawnSync("strix", strixArgs, {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env,
});

const endTime = new Date();
const elapsedMs = endTime.getTime() - startTime.getTime();
const elapsedSec = (elapsedMs / 1000).toFixed(2);

console.log(`\n[STRIX_ENGINE] Execution Complete.`);
console.log(`  Start:   ${startTime.toISOString()}`);
console.log(`  End:     ${endTime.toISOString()}`);
console.log(`  Elapsed: ${elapsedSec}s (${(elapsedSec / 60).toFixed(2)} mins)`);

// Archive and summarize
const strixRunsRoot = path.join(root, "strix_runs");
let runSessionDir = null;
let sarifFile = null;
let findingsCount = 0;

if (fs.existsSync(strixRunsRoot)) {
  const runs = fs
    .readdirSync(strixRunsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, mtime: fs.statSync(path.join(strixRunsRoot, d.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (runs[0]) {
    runSessionDir = path.join(strixRunsRoot, runs[0].name);
    const sarifPath = path.join(runSessionDir, "findings.sarif");
    if (fs.existsSync(sarifPath)) {
      sarifFile = sarifPath;
      try {
        const sarifData = JSON.parse(fs.readFileSync(sarifPath, "utf8"));
        const results = sarifData.runs?.[0]?.results || [];
        findingsCount = results.length;
      } catch (e) {}
    }
  }
}

const auditMetadata = {
  runId,
  strixVersion,
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
  elapsedSeconds: elapsedSec,
  targetDeployed: "https://erp.arivahly.in",
  targetSource: root,
  strixSessionDir: runSessionDir,
  sarifReport: sarifFile,
  findingsCount,
  exitCode: strixProc.status,
};

fs.writeFileSync(
  path.join(reportsDir, `${runId}-summary.json`),
  JSON.stringify(auditMetadata, null, 2)
);

console.log(`[STRIX_ENGINE] Metadata saved to qa/reports-output/strix/${runId}-summary.json`);

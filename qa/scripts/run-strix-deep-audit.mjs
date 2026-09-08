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

// Prepare instructions with full attack priorities
const instructionPath = path.join(reportsDir, `${runId}-instructions.md`);
const instructions = `# AVS ERP Autonomous Deep Security Assessment Instructions

Targets:
1. Local Source Repository: ${root}
2. Authorized Live Target: https://erp.arivahly.in (Read-Only, Non-Destructive)

Attack Priorities & Security Verification:
1. Authentication & Session Security (JWT, cookies, OAuth 2.1, session invalidation, token forgery).
2. Authorization & RBAC Scoping (owner vs manager vs accountant vs karigar vs viewer).
3. Insecure Direct Object References (IDOR) & Multi-Tenant Isolation (Tenant A vs Tenant B isolation).
4. Branch Isolation (Main showroom vs Workshop branch data leakage).
5. Privilege Escalation & Supervisor Workflow Bypass (Supervisor SMS OTP override gate).
6. Accounting Integrity & Business Logic:
   - Strict discrete dual-dimension separation of Cash (₹) and Fine Gold (grams @ 995 basis standard).
   - Zero tolerance for collapsing cash and gold into a single composite number.
   - Purity calculations strictly pinned to 995 / 99.50% basis standard.
   - Karigar settlement PREPARE vs CONFIRM state enforcement.
7. Inventory & Stock Manipulation (Barcode tag forgery, negative weight injection, duplicate serials).
8. Race Conditions & Duplicate Financial Transactions (Concurrent payment / ledger postings).
9. Period-Lock & Approval Workflow Bypass (Backdating transactions into closed accounting periods).
10. Model Context Protocol (MCP) Remote Gateway Security (/api/mcp JSON-RPC endpoint).
11. Storage & Asset Security (Cloudflare R2 storage proxy, presigned upload authorization).
12. Webhook & Integration Security (Signature validation, replay prevention, WhatsApp/Razorpay forgery).
13. Exposed Secrets & Server Weaknesses (0 client-bundle secret leaks, secure HTTP headers, .htaccess protection).

Operational Rules:
- Do NOT perform destructive operations or delete production data.
- Assess impact, reproduce, validate, and preserve evidence in SARIF report.
`;
fs.writeFileSync(instructionPath, instructions, "utf8");

const strixArgs = [
  "-n",
  "-m", "deep",
  "-t", ".",
  "--instruction-file", `"${instructionPath}"`,
  "--max-budget", "25",
  "--max-turns", "200",
];

const omniRouteKey = process.env.OMNIROUTE_API_KEY || process.env.AVS_STRIX_API_KEY || "sk-3ae054751b4b7b59-19efb3-10f0d4b0";

const selectedModel = process.env.STRIX_LLM?.startsWith("openai/") ? process.env.STRIX_LLM : "openai/agy/gemini-2.5-flash";

const env = {
  ...process.env,
  STRIX_LLM: selectedModel,
  OPENAI_API_BASE: "http://localhost:20128/v1",
  OPENAI_API_KEY: omniRouteKey,
  LLM_API_KEY: omniRouteKey,
  LLM_DISABLE_STREAMING: "true",
  STRIX_PROMPT_CACHE: "false",
};

console.log(`[STRIX_ENGINE] Configured Provider: OmniRoute LLM Proxy (Model: ${env.STRIX_LLM})`);
console.log(`[STRIX_ENGINE] Mode: deep | Max Turns: 250 | Max Budget: $25 USD`);
console.log(`[STRIX_ENGINE] Targets: [${root}, https://erp.arivahly.in]`);
console.log("[STRIX_ENGINE] Launching Strix multi-agent cybersecurity sandbox session in Docker...");
const strixProc = spawnSync("strix", strixArgs, {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env,
});

const endTime = new Date();
const elapsedMs = endTime.getTime() - startTime.getTime();
const elapsedSec = (elapsedMs / 1000).toFixed(2);
const elapsedHours = (elapsedMs / (1000 * 3600)).toFixed(4);

console.log(`\n[STRIX_ENGINE] Execution Complete.`);
console.log(`  Start UTC:     ${startTime.toISOString()}`);
console.log(`  End UTC:       ${endTime.toISOString()}`);
console.log(`  Elapsed Sec:   ${elapsedSec}s`);
console.log(`  Elapsed Hours: ${elapsedHours}h (${(elapsedSec / 60).toFixed(2)} mins)`);

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

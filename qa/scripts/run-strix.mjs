#!/usr/bin/env node
/**
 * Ornexa Strix runner — AI pentest layer (TEST/STAGING ONLY).
 * Requires: strix-agent (pip), Docker, STRIX_LLM + LLM_API_KEY.
 * Human review mandatory — findings merged into qa/reports-output/defects/DEFECTS.json.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "qa/reports-output/strix");
const runId =
  process.env.QA_RUN_ID || `strix-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

function loadEnvFile(relPath) {
  const p = path.join(root, relPath);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

for (const f of ["qa/config/qa.env", ".env.e2e", "qa/security/strix/accounts.env"]) {
  loadEnvFile(f);
}

process.env.QA_BASE_URL =
  process.env.QA_BASE_URL || process.env.E2E_BASE_URL || "http://localhost:3000";
process.env.E2E_BASE_URL = process.env.QA_BASE_URL;

// Hard staging guard
const guard = spawnSync("node", ["qa/scripts/staging-guard.mjs", "strix"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (guard.status === 2) {
  console.error(guard.stdout || guard.stderr);
  process.exit(2);
}

if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error(
    "[strix] BLOCKED: Set LLM_API_KEY (or provider-specific key) and STRIX_LLM before running Strix.",
  );
  process.exit(2);
}

if (process.env.LLM_API_KEY) {
  if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = process.env.LLM_API_KEY;
  if (!process.env.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = process.env.LLM_API_KEY;
}

const cfg = JSON.parse(
  fs.readFileSync(path.join(root, "qa/security/strix/strix.config.json"), "utf8"),
);
const scanMode = process.argv[2] || cfg.scanMode || "quick";
const maxBudget = process.env.STRIX_MAX_BUDGET || String(cfg.maxBudgetUsd || 3);

fs.mkdirSync(reportsDir, { recursive: true });

// Render scope with live base URL + credential hints (passwords never written to scope file)
const scopeTemplate = fs.readFileSync(path.join(root, "qa/security/strix/ornexa-scope.md"), "utf8");
const credBlock = [
  process.env.QA_OWNER_A_EMAIL || process.env.E2E_EMAIL
    ? `Tenant A Owner: ${process.env.QA_OWNER_A_EMAIL || process.env.E2E_EMAIL} / [password from accounts.env]`
    : "Tenant A Owner: NOT CONFIGURED",
  process.env.QA_CUSTOMER_A_EMAIL ? `Tenant A Customer: ${process.env.QA_CUSTOMER_A_EMAIL}` : null,
  process.env.QA_KARIGAR_A_EMAIL ? `Tenant A Karigar: ${process.env.QA_KARIGAR_A_EMAIL}` : null,
  process.env.QA_OWNER_B_EMAIL
    ? `Tenant B Owner: ${process.env.QA_OWNER_B_EMAIL}`
    : "Tenant B: NOT CONFIGURED — cross-tenant tests BLOCKED",
]
  .filter(Boolean)
  .join("\n");

const scopeRendered = scopeTemplate
  .replace(/\$\{QA_BASE_URL\}/g, process.env.QA_BASE_URL)
  .concat("\n\n## Runtime credential hints\n\n", credBlock, "\n");

const scopeRuntime = path.join(reportsDir, `${runId}-scope.md`);
fs.writeFileSync(scopeRuntime, scopeRendered);

const targetUrl = process.env.QA_BASE_URL;
console.log("═══════════════════════════════════════════════════════");
console.log(`  ORNEXA STRIX ASSESSMENT — ${runId}`);
console.log(`  Target: ${targetUrl}`);
console.log(`  Mode: ${scanMode} | Budget: $${maxBudget}`);
console.log("  FORBIDDEN: production domains, third-party APIs, DoS");
console.log("═══════════════════════════════════════════════════════\n");

const strixArgs = [
  "-n",
  "-m",
  scanMode,
  "-t",
  targetUrl,
  "-t",
  `"${root}"`,
  "--instruction-file",
  `"${scopeRuntime}"`,
  "--max-budget",
  maxBudget,
  "--max-turns",
  String(cfg.maxTurns || 80),
];

if (process.env.STRIX_REASONING_EFFORT) {
  process.env.STRIX_REASONING_EFFORT = process.env.STRIX_REASONING_EFFORT;
} else {
  process.env.STRIX_REASONING_EFFORT = cfg.reasoningEffort || "medium";
}

process.env.STRIX_LLM = cfg.defaultLlm || "gemini/gemini-3.6-flash";

const proc = spawnSync("strix", strixArgs, {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    STRIX_LLM: process.env.STRIX_LLM,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY,
    LLM_API_KEY: process.env.LLM_API_KEY,
  },
});

// Archive strix_runs output
const strixRunsRoot = path.join(root, "strix_runs");
if (fs.existsSync(strixRunsRoot)) {
  const runs = fs
    .readdirSync(strixRunsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, mtime: fs.statSync(path.join(strixRunsRoot, d.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (runs[0]) {
    const src = path.join(strixRunsRoot, runs[0].name);
    const dest = path.join(reportsDir, runs[0].name);
    fs.cpSync(src, dest, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, "LATEST_RUN.txt"), runs[0].name);
    console.log(`[strix] Archived run → ${dest}`);
  }
}

spawnSync("node", ["qa/scripts/integrate-strix-findings.mjs", runId], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});

process.exit(proc.status ?? 1);

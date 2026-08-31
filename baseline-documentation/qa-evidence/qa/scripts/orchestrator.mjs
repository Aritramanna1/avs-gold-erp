#!/usr/bin/env node
/**
 * Ornexa QA Orchestrator — single entry point for the automated QA department.
 * Jenkins-ready: each step is a discrete npm script with JUnit/XML outputs where possible.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "qa/reports-output");
const runId =
  process.env.QA_RUN_ID || `qa-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
process.env.QA_RUN_ID = runId;
process.env.QA_BASE_URL = process.env.QA_BASE_URL || "http://localhost:3000";
process.env.E2E_BASE_URL = process.env.QA_BASE_URL;

const tier = process.argv[2] || "smoke";

/** @type {import('../types').QaSuiteResult[]} */
const results = [];

function runStep(id, area, title, command, args, opts = {}) {
  const started = Date.now();
  console.log(`\n▶ [${id}] ${title}`);
  const proc = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: opts.silent ? "pipe" : "inherit",
  });
  const durationMs = Date.now() - started;
  const status =
    proc.status === 0 ? "PASS" : proc.status === 2 && opts.blockedIsBlocked ? "BLOCKED" : "FAIL";
  const entry = {
    id,
    area,
    title,
    status,
    durationMs,
    exitCode: proc.status ?? 1,
    command: `${command} ${args.join(" ")}`,
    stdoutTail: opts.silent ? (proc.stdout || "").slice(-2000) : undefined,
    stderrTail: opts.silent ? (proc.stderr || "").slice(-2000) : undefined,
  };
  results.push(entry);
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, `${runId}.partial.json`),
      JSON.stringify(results, null, 2),
    );
  } catch {
    /* non-fatal */
  }
  console.log(
    `${status === "PASS" ? "✓" : status === "BLOCKED" ? "⊘" : "✗"} [${id}] ${status} (${durationMs}ms)`,
  );
  return proc.status === 0;
}

function guard(suiteType) {
  return runStep(
    `guard-${suiteType}`,
    "Security",
    `Staging guard (${suiteType})`,
    "node",
    ["qa/scripts/staging-guard.mjs", suiteType],
    { blockedIsBlocked: true, silent: true },
  );
}

const tiers = {
  smoke: () => {
    runStep("TC-01", "Functional", "TypeScript check", "npm", ["run", "typecheck"]);
    runStep("UT-01", "Functional", "Vitest unit (gold/formula)", "npm", ["run", "qa:unit"]);
    runStep("SS-01", "Security", "Semgrep (community)", "npm", ["run", "qa:security:semgrep"]);
    runStep("GL-01", "Security", "Gitleaks secret scan", "npm", ["run", "qa:security:gitleaks"]);
    runStep("CS-01", "Security", "Client security scan", "npm", ["run", "security:scan"]);
    if (guard("e2e-mutation")) {
      runStep("E2E-01", "Functional", "Playwright smoke", "npm", ["run", "qa:e2e:smoke"]);
    }
  },
  unit: () => {
    runStep("TC-01", "Functional", "TypeScript check", "npm", ["run", "typecheck"]);
    runStep("UT-ALL", "Functional", "Vitest full unit suite", "npm", ["run", "qa:unit"]);
  },
  e2e: () => {
    runStep("E2E-FULL", "Functional", "Playwright E2E (chromium)", "npx", [
      "playwright",
      "test",
      "--config=qa/e2e/playwright.qa.config.ts",
      "--project=chromium",
    ]);
  },
  "cross-browser": () => {
    runStep("E2E-XB", "Functional", "Playwright cross-browser", "npx", [
      "playwright",
      "test",
      "--config=qa/e2e/playwright.qa.config.ts",
      "--grep-invert=@visual-only",
    ]);
  },
  security: () => {
    runStep("SS-01", "Security", "Semgrep", "npm", ["run", "qa:security:semgrep"]);
    runStep("GL-01", "Security", "Gitleaks", "npm", ["run", "qa:security:gitleaks"]);
    runStep("TV-01", "Security", "Trivy filesystem", "npm", ["run", "qa:security:trivy"]);
    if (guard("zap")) {
      runStep("ZAP-01", "Security", "OWASP ZAP baseline", "npm", ["run", "qa:security:zap"]);
    }
    if (guard("strix")) {
      runStep("STRIX-01", "Security", "Strix AI pentest (staging)", "npm", [
        "run",
        "qa:security:strix",
      ]);
    }
  },
  accessibility: () => {
    runStep("A11Y-01", "Accessibility", "axe Playwright smoke", "npm", ["run", "qa:accessibility"]);
  },
  performance: () => {
    if (guard("k6")) {
      runStep("K6-01", "Performance", "k6 smoke", "npm", ["run", "qa:load:smoke"]);
    }
    runStep("LHCI-01", "Performance", "Lighthouse CI", "npm", ["run", "qa:performance"]);
  },
  load: () => {
    if (!guard("k6")) return;
    runStep("K6-SMOKE", "Performance", "k6 smoke", "npm", ["run", "qa:load:smoke"]);
    runStep("K6-NORMAL", "Performance", "k6 normal load", "npm", ["run", "qa:load:normal"]);
  },
  localization: () => {
    runStep("I18N-01", "Localization", "i18n key audit", "npm", ["run", "qa:localization"]);
  },
  payments: () => {
    if (!guard("payment-mutation")) return;
    runStep("PAY-01", "Payments", "Razorpay test-mode idempotency", "npm", ["run", "qa:payments"]);
  },
  full: () => {
    tiers.smoke();
    tiers.unit();
    tiers.e2e();
    tiers.accessibility();
    tiers.localization();
    tiers.security();
    if (guard("payment-mutation")) {
      runStep("PAY-01", "Payments", "Razorpay test-mode", "npm", ["run", "qa:payments"]);
    }
    if (guard("k6")) {
      runStep("K6-01", "Performance", "k6 smoke", "npm", ["run", "qa:load:smoke"]);
    }
  },
  release: () => {
    tiers.full();
    tiers["cross-browser"]();
    runStep("VIS-01", "Functional", "Visual regression", "npm", ["run", "qa:visual"]);
    if (guard("zap-auth")) {
      runStep("ZAP-AUTH", "Security", "ZAP authenticated staging", "npm", [
        "run",
        "qa:security:zap:auth",
      ]);
    }
    if (guard("strix")) {
      runStep("STRIX-RC", "Security", "Strix deep staging assessment", "npm", [
        "run",
        "qa:security:strix:deep",
      ]);
    }
    runStep("RLS-01", "RLS", "Supabase tenant isolation", "npm", ["run", "qa:database:rls"]);
    runStep("GOLD-01", "Gold", "Gold accountability suite", "npm", ["run", "qa:gold"]);
    runStep("ACC-01", "Accounting", "Accounting postings suite", "npm", ["run", "qa:accounting"]);
  },
};

fs.mkdirSync(reportsDir, { recursive: true });

console.log("═══════════════════════════════════════════════════════");
console.log(`  ORNEXA QA ORCHESTRATOR — tier: ${tier}`);
console.log(`  Run ID: ${runId}`);
console.log(
  `  Target: ${process.env.QA_BASE_URL || process.env.E2E_BASE_URL || "http://localhost:3000"}`,
);
console.log("═══════════════════════════════════════════════════════");

if (!tiers[tier]) {
  console.error(`Unknown tier: ${tier}. Valid: ${Object.keys(tiers).join(", ")}`);
  process.exit(1);
}

tiers[tier]();

spawnSync("node", ["qa/scripts/generate-master-report.mjs", runId], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const failed = results.filter((r) => r.status === "FAIL").length;
const blocked = results.filter((r) => r.status === "BLOCKED").length;
console.log(`\nSummary: ${results.length} steps — FAIL=${failed} BLOCKED=${blocked}`);
process.exit(failed > 0 ? 1 : 0);

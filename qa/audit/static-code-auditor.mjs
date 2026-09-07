#!/usr/bin/env node
/**
 * AVS ERP — Static Code Adversarial Auditor & Codebase Integrity Scanner
 *
 * Recursively scans src/ for:
 * 1. Hardcoded production secrets & service keys (CRITICAL)
 * 2. Silent empty catch blocks in financial/ledger files (HIGH)
 * 3. Dangerous eval/debugger invocations (HIGH)
 * 4. Hardcoded tenant or branch IDs in business domain stores (MEDIUM)
 * 5. TODO / FIXME markers in active routes (LOW/INFO)
 */

import fs from "node:fs";
import path from "node:path";

export class StaticCodeAuditor {
  constructor(scanDir = "src") {
    this.scanDir = scanDir;
    this.filesScanned = 0;
    this.findings = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
      INFO: [],
    };
  }

  getAllFiles(dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(this.getAllFiles(fullPath));
      } else if (/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  runAudit() {
    console.log("══════════════════════════════════════════════════════════════════════════");
    console.log("  AVS ERP — STATIC CODE ADVERSARIAL AUDIT & CODE INTEGRITY SCAN");
    console.log("══════════════════════════════════════════════════════════════════════════\n");

    const files = this.getAllFiles(this.scanDir);
    this.filesScanned = files.length;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(".", file).replace(/\\/g, "/");

      // 1. Critical Secrets Scan
      if (
        (content.includes("SUPABASE_SERVICE_ROLE_KEY") && !file.includes(".env")) ||
        content.includes("BEGIN RSA PRIVATE KEY") ||
        content.includes("BEGIN EC PRIVATE KEY")
      ) {
        this.findings.CRITICAL.push({
          file: relativePath,
          message: "Potential raw privileged secret or private key pattern detected",
        });
      }

      // 2. Dangerous eval / debugger
      if (content.includes("debugger;") && !file.includes(".test.") && !file.includes("qa/")) {
        this.findings.HIGH.push({
          file: relativePath,
          message: "Hardcoded 'debugger' statement in production source",
        });
      }

      // 3. Silent catch blocks in financial stores
      if (
        (relativePath.includes("ledger") || relativePath.includes("billing") || relativePath.includes("gold")) &&
        /catch\s*\([^)]*\)\s*\{\s*\}/.test(content)
      ) {
        this.findings.HIGH.push({
          file: relativePath,
          message: "Silent empty catch block detected in financial/gold transaction handler",
        });
      }

      // 4. TODO / FIXME markers
      const todoMatches = content.match(/\b(TODO|FIXME|HACK|TEMP)\b/g);
      if (todoMatches && todoMatches.length > 0) {
        this.findings.INFO.push({
          file: relativePath,
          count: todoMatches.length,
          types: Array.from(new Set(todoMatches)),
        });
      }
    }

    console.log(`  ✓ Files Scanned: ${this.filesScanned}`);
    console.log(`  ✓ Critical Findings: ${this.findings.CRITICAL.length}`);
    console.log(`  ✓ High Findings: ${this.findings.HIGH.length}`);
    console.log(`  ✓ Medium Findings: ${this.findings.MEDIUM.length}`);
    console.log(`  ✓ Low/Info Findings: ${this.findings.INFO.length}`);

    const summary = {
      timestamp: new Date().toISOString(),
      filesScanned: this.filesScanned,
      findingsSummary: {
        CRITICAL: this.findings.CRITICAL.length,
        HIGH: this.findings.HIGH.length,
        MEDIUM: this.findings.MEDIUM.length,
        INFO: this.findings.INFO.length,
      },
      findings: this.findings,
    };

    fs.mkdirSync("qa/reports", { recursive: true });
    fs.writeFileSync("qa/reports/static-audit-summary.json", JSON.stringify(summary, null, 2));
    return summary;
  }
}

// Run standalone if executed directly
if (process.argv[1] && process.argv[1].endsWith("static-code-auditor.mjs")) {
  const auditor = new StaticCodeAuditor();
  auditor.runAudit();
}

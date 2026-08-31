#!/usr/bin/env node
/**
 * Merge Strix run output into Ornexa DEFECTS.json with secret redaction.
 * Does NOT auto-apply fixes — marks all items REVIEW_REQUIRED.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "qa/reports-output/strix");
const defectsPath = path.join(root, "qa/reports-output/defects/DEFECTS.json");
const runId = process.argv[2] || "latest";

const SECRET_PATTERNS = [
  /rzp_(live|test)_[a-zA-Z0-9]+/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  /whsec_[a-zA-Z0-9]+/gi,
  /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

function redact(text) {
  if (!text) return text;
  let out = String(text);
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

function mapSeverity(raw) {
  const s = String(raw || "").toLowerCase();
  if (/critical|p0|cross-tenant|auth bypass|service.?role/.test(s)) return "P0";
  if (/high|p1|idor|broken access|payment/.test(s)) return "P1";
  if (/medium|p2|xss|injection|ssrf/.test(s)) return "P2";
  if (/low|p3/.test(s)) return "P3";
  return "P4";
}

function findLatestRunDir() {
  if (!fs.existsSync(reportsDir)) return null;
  const latestFile = path.join(reportsDir, "LATEST_RUN.txt");
  if (fs.existsSync(latestFile)) {
    const name = fs.readFileSync(latestFile, "utf8").trim();
    const p = path.join(reportsDir, name);
    if (fs.existsSync(p)) return p;
  }
  const dirs = fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(reportsDir, d.name));
  return dirs.sort().pop() || null;
}

function extractFindings(runDir) {
  /** @type {any[]} */
  const findings = [];
  if (!runDir) return findings;

  const candidates = ["findings.json", "report.json", "vulnerabilities.json", "summary.json"];
  for (const file of candidates) {
    const p = path.join(runDir, file);
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, "utf8"));
        if (Array.isArray(data)) findings.push(...data);
        else if (Array.isArray(data.findings)) findings.push(...data.findings);
        else if (Array.isArray(data.vulnerabilities)) findings.push(...data.vulnerabilities);
      } catch {
        /* skip */
      }
    }
  }

  // Fallback: scan markdown/text reports
  const reportMd = path.join(runDir, "report.md");
  if (!findings.length && fs.existsSync(reportMd)) {
    const text = fs.readFileSync(reportMd, "utf8");
    const sections = text.split(/\n##\s+/).slice(1);
    for (const sec of sections) {
      const title = sec.split("\n")[0]?.trim();
      if (!title) continue;
      findings.push({
        title,
        description: redact(sec.slice(0, 2000)),
        severity: /critical|high/i.test(sec) ? "high" : "medium",
        source: "report.md",
      });
    }
  }

  return findings;
}

const runDir = findLatestRunDir();
const rawFindings = extractFindings(runDir);

/** @type {any[]} */
let defects = [];
if (fs.existsSync(defectsPath)) {
  try {
    defects = JSON.parse(fs.readFileSync(defectsPath, "utf8"));
  } catch {
    defects = [];
  }
}

const stamp = new Date().toISOString().slice(0, 10);
let added = 0;
for (const [idx, f] of rawFindings.entries()) {
  const title = redact(f.title || f.name || f.type || `Strix finding ${idx + 1}`);
  const severity = mapSeverity(f.severity || f.risk || title);
  const id = `DEF-${stamp}-STRIX-${String(idx + 1).padStart(3, "0")}`;
  if (defects.some((d) => d.id === id)) continue;
  defects.push({
    id,
    severity,
    area: "Security",
    test: "QA-08 Strix AI pentest",
    environment: process.env.QA_BASE_URL || "staging",
    role: f.role || "multi",
    steps: redact((f.steps || f.reproduction || f.description || "").slice(0, 1500)),
    expected: "No exploitable vulnerability in authorized staging scope",
    actual: redact((f.description || f.details || title).slice(0, 1500)),
    evidence: runDir ? path.relative(root, runDir) : "qa/reports-output/strix",
    likelySource: "PRODUCT — requires human security review",
    status: "REVIEW_REQUIRED",
    classification: "STRIX_FINDING",
    remediation: redact(
      f.remediation ||
        f.recommendation ||
        "Review with PO; patch only after confirmed exploit path.",
    ),
    strixRun: runId,
  });
  added++;
}

// Manual classification from first controlled assessment (static + prior scans)
const knownFindings = [
  {
    id: `DEF-${stamp}-STRIX-CS01`,
    severity: "P0",
    area: "Security",
    test: "Client security scan (correlated)",
    title: "Service-role pattern in client auth-storage",
    actual:
      "src/lib/auth/auth-storage.ts matches privileged key pattern — verify not shipped to browser",
    remediation:
      "Audit auth-storage.ts; ensure service role never in client bundle; use anon key + RLS only.",
    classification: "PRODUCT_DEFECT",
  },
  {
    id: `DEF-${stamp}-STRIX-HDR01`,
    severity: "P3",
    area: "Security",
    test: "ZAP baseline (correlated)",
    title: "Missing security headers on Vite dev server",
    actual: "CSP, X-Frame-Options, Permissions-Policy warnings on localhost dev build",
    remediation:
      "Configure production/staging reverse proxy headers; re-test on staging build not Vite dev.",
    classification: "STAGING_DEV_ONLY",
  },
  {
    id: `DEF-${stamp}-STRIX-TENANT-B`,
    severity: "P2",
    area: "RLS",
    test: "Strix tenant matrix",
    title: "Tenant B QA accounts not seeded",
    actual:
      "Cross-tenant negative tests BLOCKED until QA_OWNER_B / QA_CUSTOMER_B credentials exist",
    remediation:
      "Run qa/scripts/seed-qa-tenants.mjs on staging Supabase; populate qa/security/strix/accounts.env",
    classification: "TEST_INFRA",
    status: "BLOCKED",
  },
];

for (const k of knownFindings) {
  if (!defects.some((d) => d.id === k.id)) {
    defects.push({
      ...k,
      environment: process.env.QA_BASE_URL || "http://localhost:3000",
      role: "n/a",
      steps: "Automated Strix + correlated static scan",
      expected: "No P0/P1 in staging scope",
      evidence: "qa/reports-output/strix",
      likelySource: k.classification === "PRODUCT_DEFECT" ? "PRODUCT" : "INFRA",
      status: k.status || "REVIEW_REQUIRED",
      strixRun: runId,
    });
    added++;
  }
}

fs.mkdirSync(path.dirname(defectsPath), { recursive: true });
fs.writeFileSync(defectsPath, JSON.stringify(defects, null, 2));

const summaryPath = path.join(reportsDir, "STRIX_SUMMARY.json");
fs.writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      runId,
      runDir: runDir ? path.relative(root, runDir) : null,
      findingsExtracted: rawFindings.length,
      defectsAdded: added,
      totalDefects: defects.length,
      redaction: "Secrets redacted via integrate-strix-findings.mjs",
      humanReviewRequired: true,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(`[strix] Integrated ${added} defect(s) → ${defectsPath}`);
console.log(`[strix] Summary → ${summaryPath}`);

#!/usr/bin/env node
/**
 * Ornexa QA Staging Guard — REFUSES active/destructive QA against production.
 * Used by: ZAP, k6, payment mutation, destructive workflow, security attack sims.
 *
 * Exit 0 = safe to proceed. Exit 2 = BLOCKED (production target).
 * QA_ALLOW_PRODUCTION_TARGET=1 is ignored by design for normal orchestrator paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const blocklistPath = path.resolve(__dirname, "../config/production-blocklist.json");

const ACTIVE_SUITE_TYPES = new Set([
  "zap",
  "zap-auth",
  "k6",
  "k6-stress",
  "k6-spike",
  "k6-soak",
  "payment-mutation",
  "destructive",
  "security-attack",
  "tenant-mutation",
  "load",
  "e2e-mutation",
  "strix",
]);

function loadEnvFiles() {
  const candidates = [
    path.join(root, "qa/config/qa.env"),
    path.join(root, ".env.e2e"),
    path.join(root, ".env.test.local"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    }
  }
}

function resolveTargetUrl() {
  return (
    process.env.QA_BASE_URL ||
    process.env.E2E_BASE_URL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    "http://localhost:3000"
  );
}

function loadBlocklist() {
  const raw = JSON.parse(fs.readFileSync(blocklistPath, "utf8"));
  return {
    hostPatterns: raw.blockedHostPatterns.map((p) => new RegExp(p, "i")),
    urlSubstrings: raw.blockedUrlSubstrings.map((s) => s.toLowerCase()),
  };
}

export function assertStagingSafe(suiteType = "generic", targetUrl = resolveTargetUrl()) {
  if (!ACTIVE_SUITE_TYPES.has(suiteType) && suiteType !== "generic-check") {
    return { ok: true, targetUrl, reason: "passive suite — guard not required" };
  }

  let hostname = "";
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return { ok: false, targetUrl, reason: `Invalid QA target URL: ${targetUrl}` };
  }

  const { hostPatterns, urlSubstrings } = loadBlocklist();
  const lowerUrl = targetUrl.toLowerCase();

  for (const sub of urlSubstrings) {
    if (lowerUrl.includes(sub)) {
      return {
        ok: false,
        targetUrl,
        reason: `BLOCKED: QA target matches production blocklist substring "${sub}"`,
        suiteType,
      };
    }
  }
  for (const pattern of hostPatterns) {
    if (pattern.test(hostname)) {
      return {
        ok: false,
        targetUrl,
        reason: `BLOCKED: QA target host "${hostname}" matches production pattern ${pattern}`,
        suiteType,
      };
    }
  }

  return { ok: true, targetUrl, suiteType };
}

function main() {
  loadEnvFiles();
  const suiteType = process.argv[2] || "generic-check";
  const result = assertStagingSafe(suiteType);
  if (!result.ok) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║  ORNEXA QA STAGING GUARD — REFUSED TO RUN               ║");
    console.error("╚══════════════════════════════════════════════════════════╝");
    console.error(`Suite:  ${suiteType}`);
    console.error(`Target: ${result.targetUrl}`);
    console.error(`Reason: ${result.reason}`);
    console.error(
      "\nActive QA (ZAP, k6, payments, destructive, tenant mutation) is allowed ONLY on TEST/STAGING.",
    );
    console.error("Set QA_BASE_URL to localhost or an approved staging host.\n");
    process.exit(2);
  }
  console.log(`[staging-guard] OK — ${suiteType} @ ${result.targetUrl}`);
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("staging-guard.mjs")
) {
  main();
}

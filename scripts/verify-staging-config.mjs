#!/usr/bin/env node
/**
 * Verify staging environment configuration — no production URLs in critical paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_URL = process.env.QA_BASE_URL || "https://avs-erp-preview-20260806.hostingersite.com";
const STAGING_HOST = new URL(STAGING_URL).hostname;
const PRODUCTION_HOSTS = ["maatarajewellers.shop", "www.maatarajewellers.shop"];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
}
function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

// 1. QA env
const qaEnvPath = path.join(root, "qa/config/qa.env");
if (fs.existsSync(qaEnvPath)) {
  const text = fs.readFileSync(qaEnvPath, "utf8");
  if (text.includes(STAGING_HOST)) pass("qa.env targets staging", STAGING_HOST);
  else fail("qa.env targets staging", "qa.env missing staging host");
  for (const ph of PRODUCTION_HOSTS) {
    if (text.includes(ph)) fail("qa.env production-free", `contains ${ph}`);
  }
} else {
  fail("qa.env exists", "qa/config/qa.env not found");
}

// 2. R2 worker origins
const workerSrc = fs.readFileSync(path.join(root, "workers/storage-proxy/src/index.ts"), "utf8");
if (workerSrc.includes(STAGING_HOST)) pass("R2 worker allows staging origin", STAGING_HOST);
else fail("R2 worker allows staging origin", "staging host not in ALLOWED_ORIGINS");

// 3. Staging guard allows preview host
const { assertStagingSafe } = await import("../qa/scripts/staging-guard.mjs");
const guard = assertStagingSafe("generic-check", STAGING_URL);
if (guard.ok) pass("staging-guard allows QA", STAGING_URL);
else fail("staging-guard allows QA", guard.reason);

// 4. Production blocklist rejects prod
const prodGuard = assertStagingSafe("e2e-mutation", "https://maatarajewellers.shop");
if (!prodGuard.ok) pass("staging-guard blocks production", "maatarajewellers.shop blocked");
else fail("staging-guard blocks production", "production not blocked");

// 5. Live staging HTTPS reachable
try {
  const res = await fetch(STAGING_URL, { method: "HEAD", redirect: "follow" });
  if (res.ok || res.status === 304) pass("staging site reachable", `HTTP ${res.status}`);
  else fail("staging site reachable", `HTTP ${res.status}`);
} catch (e) {
  fail("staging site reachable", e instanceof Error ? e.message : String(e));
}

// 6. Edge functions
const edgeUrls = [
  "https://dqgrrafuoxaorvyrcuuh.supabase.co/functions/v1/platform-payment-api",
  "https://dqgrrafuoxaorvyrcuuh.supabase.co/functions/v1/razorpay-webhook",
];
for (const url of edgeUrls) {
  try {
    const res = await fetch(url, { method: "OPTIONS" });
    if (res.status < 500) pass(`edge OPTIONS ${url.split("/").pop()}`, `HTTP ${res.status}`);
    else fail(`edge OPTIONS ${url.split("/").pop()}`, `HTTP ${res.status}`);
  } catch (e) {
    fail(`edge ${url.split("/").pop()}`, e instanceof Error ? e.message : String(e));
  }
}

console.log("\n═══ STAGING VERIFICATION ═══\n");
let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);

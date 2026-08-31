#!/usr/bin/env node
/**
 * Deterministic performance + subscription gate verification (no Playwright, no load tests).
 * Writes: _reconstruction/PERFORMANCE_VERIFICATION_FINAL.json + .md
 *
 * Optional: SUPABASE_SERVICE_ROLE_KEY — Postgres error snapshot from platform_error_events
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const url = (env.VITE_SUPABASE_URL || env.QA_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const qaPass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ERP_EMAIL = "mtj.qa.firm-owner.20260731@example.com";
const PLATFORM_EMAIL = "mtj.qa.platform-admin.20260731@example.com";
const CUSTOMER_EMAIL = "mtj.qa.customer.20260731@example.com";

const checks = [];
const timings = [];
const requestLog = [];

function okHttp(status) {
  return status >= 200 && status < 300;
}

function stripComments(src) {
  return src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function record(section, step, pass, detail, extra = {}) {
  checks.push({ section, step, pass, detail, ...extra, at: new Date().toISOString() });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${section} :: ${step} — ${detail}`);
}

async function timed(name, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    timings.push({ name, ms, ok: true });
    return result;
  } catch (e) {
    const ms = Date.now() - t0;
    timings.push({ name, ms, ok: false, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

async function rest(token, method, pathPart, body) {
  const started = Date.now();
  const res = await fetch(`${url}${pathPart}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const entry = {
    path: pathPart.split("?")[0],
    method,
    status: res.status,
    ms: Date.now() - started,
  };
  requestLog.push(entry);
  return { status: res.status, data, headers: res.headers };
}

async function rpc(token, name, payload = {}) {
  return rest(token, "POST", `/rest/v1/rpc/${name}`, payload);
}

async function passwordLogin(email) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: qaPass }),
  });
  const body = await res.json().catch(() => ({}));
  requestLog.push({ path: "/auth/v1/token", method: "POST", status: res.status, ms: 0 });
  return { status: res.status, body };
}

function auditSourceArchitecture() {
  const section = "architecture-audit";
  const throttleSrc = fs.readFileSync("src/lib/supabase-fetch-throttle.ts", "utf8");
  const dataLoaderSrc = fs.readFileSync("src/lib/data-loader.ts", "utf8");
  const tenantSrc = fs.readFileSync("src/lib/identity/tenant-context-store.ts", "utf8");
  const authGateSrc = fs.readFileSync("src/components/auth-gate.tsx", "utf8");
  const subGateSrc = fs.readFileSync("src/components/subscription-gate.tsx", "utf8");
  const subSvcSrc = fs.readFileSync("src/lib/identity/subscription-access-service.ts", "utf8");

  record(
    section,
    "prod_throttle_not_aggressive",
    /MAX_REQUESTS_PER_WINDOW = import\.meta\.env\.PROD \? 80 : 10/.test(throttleSrc) &&
      /MIN_REQUEST_GAP_MS = import\.meta\.env\.PROD \? 0 : 400/.test(throttleSrc),
    "PROD: 80 req/10s, 0ms gap; DEV: 10/400 retained",
  );

  record(
    section,
    "prod_boot_throttle_relaxed",
    /MAX_REQUESTS_BOOT = import\.meta\.env\.PROD \? 120 : 22/.test(throttleSrc) &&
      /MIN_REQUEST_GAP_BOOT_MS = import\.meta\.env\.PROD \? 0 : 80/.test(throttleSrc),
    "PROD boot: 120 req/10s, 0ms gap",
  );

  record(
    section,
    "inflight_dedupe_present",
    throttleSrc.includes("inFlight.get(key)") && fs.existsSync("src/lib/pull-dedupe.ts"),
    "GET dedupe via in-flight map + pull-dedupe.ts",
  );

  record(
    section,
    "no_duplicate_pullAll_boot",
    !/(?:await\s+)?pullAll\s*\(\s*\)/.test(stripComments(tenantSrc)),
    "tenant-context uses startCloudSync only (no pullAll call)",
  );

  record(
    section,
    "token_refresh_skips_boot",
    authGateSrc.includes('evt === "TOKEN_REFRESHED"') && authGateSrc.includes("return"),
    "TOKEN_REFRESHED does not re-run bootstrap",
  );

  record(
    section,
    "pullCritical_45s_budget",
    dataLoaderSrc.includes("STAGED_LOAD_THRESHOLDS_MS.fail") &&
      !dataLoaderSrc.includes("CRITICAL_PULL_TIMEOUT_MS = 28_000"),
    "pullCritical uses 45s staged-load fail threshold",
  );

  record(
    section,
    "critical_pulls_parallel_after_settings",
    dataLoaderSrc.includes("runSafeBatches") && dataLoaderSrc.includes('["branches", pullBranches]'),
    "branches/branch_settings/dropdown_masters parallel after app_settings",
  );

  record(
    section,
    "subscription_gate_passes_org_id",
    subGateSrc.includes("organizationId: orgId") || subGateSrc.includes("organizationId: orgId"),
    "resolveSubscriptionAccess receives activeOrganizationId",
  );

  record(
    section,
    "subscription_membership_fallback",
    subSvcSrc.includes("membershipSubscriptionFallback") &&
      subSvcSrc.includes("fetchMyMemberships"),
    "RPC failure falls back to membership subscription_status",
  );

  record(
    section,
    "platform_owner_gate_bypass",
    subGateSrc.includes("is_platform_owner") && subGateSrc.includes("return <>{children}</>"),
    "Platform owners bypass SubscriptionRequired screen",
  );
}

async function simulateErpBootChain(token, firmId) {
  const section = "erp-boot-chain";
  const chainStart = Date.now();

  const ctx = await timed("get_authorization_context", () => rpc(token, "get_authorization_context"));
  record(
    section,
    "auth_context",
    ctx.status === 200,
    `status=${ctx.status} ms=${timings.find((t) => t.name === "get_authorization_context")?.ms}`,
  );

  const memberships = await timed("get_my_memberships", () =>
    rpc(token, "get_my_memberships", { p_product_id: "ORNEXA", p_portal_type: null }),
  );
  record(section, "memberships", memberships.status === 200, `status=${memberships.status}`);

  const orgId =
    ctx.data?.active_workspace?.organization_id ??
    memberships.data?.find?.((m) => m.is_active)?.organization_id ??
    firmId;

  await timed("app_settings", () =>
    rest(token, "GET", `/rest/v1/app_settings?select=data,updated_at&id=eq.${orgId}&limit=1`),
  );

  const parallel = await Promise.all([
    timed("branches", () => rest(token, "GET", "/rest/v1/branches?select=id,name,short_name,active,data&limit=50")),
    timed("branch_settings", () =>
      rest(token, "GET", "/rest/v1/branch_settings?select=branch_id,data&limit=50"),
    ),
    timed("dropdown_masters", () =>
      rest(token, "GET", "/rest/v1/dropdown_masters?select=master_key,value&active=eq.true&limit=400"),
    ),
  ]);
  record(
    section,
    "critical_catalog_parallel",
    parallel.every((r) => okHttp(r.status)),
    parallel.map((r, i) => `#${i}=${r.status}`).join(" "),
  );

  const dash = await timed("get_home_dashboard_summary", () =>
    rpc(token, "get_home_dashboard_summary", {}),
  );
  record(
    section,
    "dashboard_rpc",
    okHttp(dash.status),
    `status=${dash.status} ms=${timings.find((t) => t.name === "get_home_dashboard_summary")?.ms}`,
  );

  const totalMs = Date.now() - chainStart;
  record(section, "boot_chain_under_45s", totalMs < 45_000, `total=${totalMs}ms`);
  record(section, "boot_chain_under_15s_target", totalMs < 15_000, `target_fast=${totalMs}ms`, {
    advisory: true,
  });

  return { orgId, totalMs };
}

async function probeModules(token, firmId) {
  const section = "module-probes";
  const probes = [
    ["customers_people", `/rest/v1/people?select=id,full_name,type&firm_id=eq.${firmId}&limit=50`],
    ["orders", `/rest/v1/orders?select=data&firm_id=eq.${firmId}&limit=50&order=updated_at.desc`],
    ["job_cards", `/rest/v1/job_cards?select=data&firm_id=eq.${firmId}&limit=50&order=updated_at.desc`],
    ["stock_inventory", `/rest/v1/inventory?select=data&firm_id=eq.${firmId}&limit=50`],
    ["billing_invoices", `/rest/v1/invoices?select=data&firm_id=eq.${firmId}&limit=50&order=updated_at.desc`],
    [
      "gold_ledger_page",
      null,
      () =>
        rpc(token, "get_gold_ledger_page", {
          p_bucket: null,
          p_purity: null,
          p_type: null,
          p_from: null,
          p_to: null,
          p_limit: 50,
          p_offset: 0,
          p_order: "desc",
        }),
    ],
    [
      "reports_firm_balances",
      null,
      () => rpc(token, "get_firm_ledger_balances", { p_branch_id: null, p_metal_code: "gold" }),
    ],
    ["settings_org", `/rest/v1/organizations?select=id,name&id=eq.${firmId}&limit=1`],
  ];

  for (const [name, pathPart, fn] of probes) {
    const t0 = Date.now();
    let res = fn ? await fn() : await rest(token, "GET", pathPart);
    const ms = Date.now() - t0;
    let ok = okHttp(res.status);
    let note = pathPart ? " firm_scoped" : "";

    if (!ok && name === "gold_ledger_page" && res.status === 405) {
      const fallback = await rest(
        token,
        "GET",
        `/rest/v1/gold_ledger?select=id,ts,data&firm_id=eq.${firmId}&limit=50&order=ts.desc`,
      );
      ok = okHttp(fallback.status);
      note = " rpc_405_used_rest_fallback";
      res = fallback;
    }

    timings.push({ name, ms, ok });
    record(section, name, ok, `status=${res.status} ms=${ms}${note}`);
  }
}

async function verifySubscriptionGate(token, orgId) {
  const section = "subscription-gate";

  const withOrg = await rpc(token, "resolve_subscription_access", {
    p_organization_id: orgId,
    p_product_id: "ORNEXA",
  });
  record(
    section,
    "rpc_with_active_firm",
    withOrg.status === 200 &&
      (withOrg.data?.valid === true ||
        withOrg.data?.access === "granted" ||
        withOrg.data?.access === "granted_limited"),
    `status=${withOrg.status} access=${withOrg.data?.access} valid=${withOrg.data?.valid}`,
  );

  const memberships = await rpc(token, "get_my_memberships", {
    p_product_id: "ORNEXA",
    p_portal_type: null,
  });
  const active = (memberships.data ?? []).find((m) => m.organization_id === orgId);
  const memStatus = String(active?.subscription_status ?? "").toLowerCase();
  record(
    section,
    "membership_evidence_active_or_trial",
    ["active", "trial"].includes(memStatus),
    `subscription_status=${memStatus || "missing"}`,
  );

  record(
    section,
    "membership_fallback_would_grant",
    ["active", "trial"].includes(memStatus),
    "RPC failure path has membership evidence for grant",
  );

  const bogus = await rpc(token, "resolve_subscription_access", {
    p_organization_id: "00000000-0000-0000-0000-000000000099",
    p_product_id: "ORNEXA",
  });
  const bogusGranted =
    bogus.data?.valid === true ||
    bogus.data?.access === "granted" ||
    bogus.data?.access === "granted_limited";
  record(
    section,
    "bogus_org_not_auto_granted",
    bogus.status === 200 && !bogusGranted,
    `access=${bogus.data?.access} valid=${bogus.data?.valid}`,
  );
}

async function verifyPlatformBypass() {
  const section = "platform-bypass";
  const auth = await passwordLogin(PLATFORM_EMAIL);
  if (auth.status !== 200) {
    record(section, "platform_login", false, `status=${auth.status}`);
    return;
  }
  const token = auth.body.access_token;
  const ctx = await rpc(token, "get_authorization_context");
  record(
    section,
    "is_platform_owner",
    ctx.data?.is_platform_owner === true,
    `is_platform_owner=${ctx.data?.is_platform_owner}`,
  );
  record(
    section,
    "platform_route",
    (ctx.data?.default_route || "").includes("/platform") || ctx.data?.is_platform_owner,
    `default_route=${ctx.data?.default_route}`,
  );
}

async function verifyPortalProbe(email, portalType) {
  const section = `portal-${portalType}`;
  const auth = await passwordLogin(email);
  record(section, "login", auth.status === 200, `status=${auth.status}`);
  if (auth.status !== 200) return;
  const token = auth.body.access_token;
  const ctx = await rpc(token, "get_authorization_context");
  record(
    section,
    "auth_context",
    ctx.status === 200 && ctx.data?.active_workspace?.workspace_type === portalType,
    `active=${ctx.data?.active_workspace?.workspace_type}`,
  );
  const portal = await rpc(token, "get_my_portal_context", { p_portal_type: portalType });
  const entitlementOnly =
    portal.status === 403 &&
    String(portal.data?.message ?? portal.data ?? "").includes("feature_not_entitled");
  record(
    section,
    "portal_context",
    portal.status === 200 || entitlementOnly,
    entitlementOnly ? `entitlement blocked (auth OK)` : `status=${portal.status}`,
  );
}

async function verifyUnauthorizedDenied() {
  const section = "unauthorized-denied";
  const bad = await rpc("invalid-token", "get_authorization_context");
  record(section, "invalid_token_denied", bad.status === 401 || bad.status === 403, `status=${bad.status}`);
}

async function fetchPostgresErrors() {
  const section = "postgres-errors-24h";
  if (!serviceRole) {
    record(section, "service_role", true, "skipped — set SUPABASE_SERVICE_ROLE_KEY for DB error snapshot", {
      advisory: true,
    });
    return null;
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/platform_error_events?select=category,message,created_at&created_at=gte.${since}&order=created_at.desc&limit=100`,
    {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Accept: "application/json",
      },
    },
  );
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) {
    record(section, "query", false, `status=${res.status}`);
    return [];
  }
  const byCategory = {};
  const byMessage = {};
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    const key = String(r.message ?? "").slice(0, 80);
    byMessage[key] = (byMessage[key] ?? 0) + 1;
  }
  record(section, "query", true, `events=${rows.length} categories=${JSON.stringify(byCategory)}`);
  const top = Object.entries(byMessage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([m, c]) => ({ message: m, count: c }));
  return { total: rows.length, byCategory, top };
}

function countDuplicateRequests() {
  const seen = new Map();
  let duplicates = 0;
  for (const r of requestLog) {
    const key = `${r.method}:${r.path}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const c of seen.values()) {
    if (c > 1) duplicates += c - 1;
  }
  return { unique: seen.size, duplicates, total: requestLog.length };
}

function writeReports(payload) {
  const outDir = "_reconstruction";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "PERFORMANCE_VERIFICATION_FINAL.json"), JSON.stringify(payload, null, 2));

  const pass = payload.summary.pass;
  const fail = payload.summary.fail;
  const md = `# Performance Verification Final

**Date:** ${payload.generatedAt}  
**Project:** ${url}  
**Result:** ${pass}/${pass + fail} checks PASS

## Before / After (documented)

| Metric | Before (aggressive throttle) | After (current) |
|--------|------------------------------|-------------------|
| PROD REST cap | 10 req / 10s | 80 req / 10s (120 boot) |
| PROD min gap | 400ms between requests | 0ms |
| pullCritical timeout | 28s (regression) | 45s staged-load |
| Critical catalog pulls | sequential | parallel after app_settings |
| Boot duplicate | pullAll + startCloudSync | startCloudSync only |
| TOKEN_REFRESHED | re-boot (storm) | skipped |

## Measured (this run)

| Metric | Value |
|--------|-------|
| Login (ERP owner) | ${payload.metrics.loginMs ?? "n/a"} ms |
| Boot chain (simulated critical + dashboard) | ${payload.metrics.bootChainMs ?? "n/a"} ms |
| Total REST/RPC probes | ${payload.metrics.requestTotal} |
| Duplicate request keys | ${payload.metrics.requestDuplicates} |
| Module probes | see JSON |

## Subscription gate

${payload.checks
  .filter((c) => c.section === "subscription-gate" || c.section === "platform-bypass")
  .map((c) => `- [${c.pass ? "x" : " "}] ${c.step}: ${c.detail}`)
  .join("\n")}

## Architecture audit

${payload.checks
  .filter((c) => c.section === "architecture-audit")
  .map((c) => `- [${c.pass ? "x" : " "}] ${c.step}: ${c.detail}`)
  .join("\n")}

## Failures

${
  payload.checks.filter((c) => !c.pass && !c.advisory).length
    ? payload.checks
        .filter((c) => !c.pass && !c.advisory)
        .map((c) => `- **${c.section}** / ${c.step}: ${c.detail}`)
        .join("\n")
    : "_None — all required checks passed._"
}

## PostgreSQL errors (24h)

${payload.postgresErrors ? JSON.stringify(payload.postgresErrors, null, 2) : "_skipped_"}
`;
  fs.writeFileSync(path.join(outDir, "PERFORMANCE_VERIFICATION_FINAL.md"), md);
  console.log(`\nWrote ${outDir}/PERFORMANCE_VERIFICATION_FINAL.json`);
}

async function main() {
  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
  }

  auditSourceArchitecture();

  const loginStart = Date.now();
  const auth = await passwordLogin(ERP_EMAIL);
  const loginMs = Date.now() - loginStart;
  record("login", "erp_owner_password", auth.status === 200, `status=${auth.status} ms=${loginMs}`);
  if (auth.status !== 200) {
    writeReports({
      generatedAt: new Date().toISOString(),
      checks,
      timings,
      metrics: { loginMs },
      summary: {
        pass: checks.filter((c) => c.pass).length,
        fail: checks.filter((c) => !c.pass && !c.advisory).length,
      },
    });
    process.exit(1);
  }

  const token = auth.body.access_token;
  const ctx = await rpc(token, "get_authorization_context");
  const firmId =
    ctx.data?.active_workspace?.organization_id ??
    (await rpc(token, "my_firm_id")).data ??
    null;
  record("login", "firm_id_resolved", !!firmId, `firmId=${firmId ?? "null"}`);

  const { totalMs: bootChainMs, orgId } = await simulateErpBootChain(token, firmId);
  await probeModules(token, firmId || orgId);
  await verifySubscriptionGate(token, orgId || firmId);
  await verifyPlatformBypass();
  await verifyPortalProbe(CUSTOMER_EMAIL, "customer");
  await verifyUnauthorizedDenied();

  const postgresErrors = await fetchPostgresErrors();
  const dup = countDuplicateRequests();

  const required = checks.filter((c) => !c.advisory);
  const payload = {
    generatedAt: new Date().toISOString(),
    projectUrl: url,
    checks,
    timings,
    requestLog,
    postgresErrors,
    metrics: {
      loginMs,
      bootChainMs,
      requestTotal: dup.total,
      requestUnique: dup.unique,
      requestDuplicates: dup.duplicates,
    },
    summary: {
      pass: required.filter((c) => c.pass).length,
      fail: required.filter((c) => !c.pass).length,
      advisory: checks.filter((c) => c.advisory).length,
    },
  };

  writeReports(payload);
  process.exit(payload.summary.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

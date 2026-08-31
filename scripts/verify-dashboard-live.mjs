#!/usr/bin/env node
/**
 * End-to-end dashboard wiring verification (no Playwright).
 * Simulates editable-app data path: login → RPC → mapper → people counts.
 * Writes: _reconstruction/DASHBOARD_LIVE_VERIFICATION.json
 */
import fs from "node:fs";

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
const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const pass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const ERP_EMAIL = "mtj.qa.firm-owner.20260731@example.com";

const checks = [];
const metrics = { rpcCalls: 0, restCalls: 0 };

function record(step, pass, detail, extra = {}) {
  checks.push({ step, pass, detail, ...extra, at: new Date().toISOString() });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${step} — ${detail}`);
}

function asNum(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapRpcSummary(row) {
  return {
    goldBuckets: {
      vault: asNum(row.vault_gold_mg),
      karigar: asNum(row.karigar_gold_mg),
      finished: asNum(row.finished_gold_mg),
      customer: asNum(row.customer_gold_mg),
    },
    openOrders: asNum(row.open_orders),
    totalOrders: asNum(row.total_orders),
    stockCount: asNum(row.available_stock_count),
    todayInvoiceCount: asNum(row.today_invoice_count),
    todayBillingPaise: asNum(row.today_billing_paise),
    ledgerDiscrepancyMg: asNum(row.ledger_discrepancy_mg),
  };
}

async function login() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ERP_EMAIL, password: pass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "login failed");
  return data.access_token;
}

async function rpc(token, fn, body = {}) {
  metrics.rpcCalls += 1;
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function rest(token, pathPart) {
  metrics.restCalls += 1;
  const res = await fetch(`${url}${pathPart}`, {
    headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  record(
    "dev_supabase_flag",
    env.VITE_ENABLE_DEV_SUPABASE === "1",
    env.VITE_ENABLE_DEV_SUPABASE === "1"
      ? "VITE_ENABLE_DEV_SUPABASE=1"
      : "missing — npm run dev will quarantine Supabase",
  );

  const token = await login();
  record("login", true, ERP_EMAIL);

  const ctx = await rpc(token, "get_authorization_context");
  const firmId =
    ctx.data?.active_workspace?.organization_id ?? (await rpc(token, "my_firm_id")).data ?? null;
  record("firm_scope", !!firmId, firmId ? String(firmId) : "none");
  if (!firmId) {
    writeOut();
    process.exit(1);
  }

  // Session 1 — dashboard KPI RPC (same path as fetchHomeDashboardSummary)
  const dash1 = await rpc(token, "get_home_dashboard_summary");
  record("dashboard_rpc_status", dash1.status === 200, `status=${dash1.status}`);
  const row1 = Array.isArray(dash1.data) ? dash1.data[0] : dash1.data;
  const summary1 = mapRpcSummary(row1 ?? {});

  record("vault_gold_live", summary1.goldBuckets.vault > 0, `vault_mg=${summary1.goldBuckets.vault}`);
  record("open_orders_live", summary1.openOrders > 0, `open=${summary1.openOrders}`);
  record("stock_live", summary1.stockCount > 0, `stock=${summary1.stockCount}`);
  record(
    "karigar_gold_live",
    summary1.goldBuckets.karigar > 0,
    `karigar_mg=${summary1.goldBuckets.karigar}`,
  );

  // Session 2 — re-login simulates logout/login
  const token2 = await login();
  const dash2 = await rpc(token2, "get_home_dashboard_summary");
  const row2 = Array.isArray(dash2.data) ? dash2.data[0] : dash2.data;
  const summary2 = mapRpcSummary(row2 ?? {});
  record(
    "relogin_dashboard_parity",
    summary2.goldBuckets.vault === summary1.goldBuckets.vault &&
      summary2.openOrders === summary1.openOrders,
    `vault=${summary2.goldBuckets.vault} open=${summary2.openOrders}`,
  );

  // People pages — firm-scoped counts
  const customers = await rest(
    token,
    `/rest/v1/people?select=id&type=in.(customer,firm_customer)&firm_id=eq.${firmId}&limit=1000`,
  );
  const karigars = await rest(
    token,
    `/rest/v1/people?select=id&type=eq.karigar&firm_id=eq.${firmId}&limit=1000`,
  );
  const customerCount = Array.isArray(customers.data) ? customers.data.length : 0;
  const karigarCount = Array.isArray(karigars.data) ? karigars.data.length : 0;
  record(
    "customers_page_data",
    customers.status === 200 && customerCount > 0,
    `count=${customerCount}`,
  );
  record("karigars_page_data", karigars.status === 200 && karigarCount > 0, `count=${karigarCount}`);

  // Duplicate RPC guard — second immediate call should be deduped in app via summaryInFlight;
  // script documents expected single RPC per mount (not enforced here, informational).
  record(
    "single_rpc_per_probe",
    metrics.rpcCalls <= 5,
    `rpc=${metrics.rpcCalls} rest=${metrics.restCalls} (login+auth+dashboard probes)`,
  );

  writeOut(summary1, { customerCount, karigarCount, firmId });
  process.exit(checks.some((c) => !c.pass) ? 1 : 0);
}

function writeOut(summary, people = {}) {
  const fail = checks.filter((c) => !c.pass).length;
  fs.mkdirSync("_reconstruction", { recursive: true });
  fs.writeFileSync(
    "_reconstruction/DASHBOARD_LIVE_VERIFICATION.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        checks,
        liveSummary: summary,
        people,
        metrics,
        summary: { pass: checks.length - fail, fail },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

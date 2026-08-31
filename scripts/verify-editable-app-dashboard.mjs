#!/usr/bin/env node
/**
 * End-to-end editable-app dashboard verification (no Playwright).
 * Simulates: login → dashboard RPC → people counts → second login (refresh session).
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
const url = (env.VITE_SUPABASE_URL || env.QA_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const pass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const email = env.E2E_EMAIL || "mtj.qa.firm-owner.20260731@example.com";
const devSupabase = env.VITE_ENABLE_DEV_SUPABASE === "1";

const checks = [];
const metrics = {};

function record(step, pass, detail, extra = {}) {
  checks.push({ step, pass, detail, ...extra, at: new Date().toISOString() });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${step} — ${detail}`);
}

async function login() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "login failed");
  return data.access_token;
}

async function rpc(token, fn, body = {}) {
  const t0 = Date.now();
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ms };
}

function mapRpc(row) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    vaultMg: n(row?.vault_gold_mg),
    openOrders: n(row?.open_orders),
    stockCount: n(row?.available_stock_count),
    finishedMg: n(row?.finished_gold_mg),
    karigarMg: n(row?.karigar_gold_mg),
    todayBillingPaise: n(row?.today_billing_paise),
  };
}

async function restCount(token, path) {
  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json();
  return { status: res.status, count: Array.isArray(data) ? data.length : 0, data };
}

async function main() {
  record("dev_supabase_flag", devSupabase, devSupabase ? "VITE_ENABLE_DEV_SUPABASE=1" : "MISSING in .env.local");

  const token1 = await login();
  record("login_1", !!token1, email);

  const ctx = await rpc(token1, "get_authorization_context");
  const firmId =
    ctx.data?.active_workspace?.organization_id ?? (await rpc(token1, "my_firm_id")).data ?? null;
  record("firm_scope", !!firmId, String(firmId ?? "null"));

  const dash1 = await rpc(token1, "get_home_dashboard_summary");
  metrics.dashboardRpcMs = dash1.ms;
  record("dashboard_rpc_1", dash1.status === 200, `status=${dash1.status} ms=${dash1.ms}`);

  const row1 = Array.isArray(dash1.data) ? dash1.data[0] : dash1.data;
  const m1 = mapRpc(row1);
  metrics.dashboard = m1;

  record("vault_live", m1.vaultMg > 0, `${m1.vaultMg} mg`);
  record("open_orders_live", m1.openOrders > 0, String(m1.openOrders));
  record("stock_live", m1.stockCount > 0, String(m1.stockCount));
  record("finished_stock_live", m1.finishedMg > 0, `${m1.finishedMg} mg`);
  record("karigar_gold_live", m1.karigarMg > 0, `${m1.karigarMg} mg`);

  const customers = await restCount(
    token1,
    `/rest/v1/people?select=id&type=in.(customer,firm_customer)&firm_id=eq.${firmId}&limit=1000`,
  );
  const karigars = await restCount(
    token1,
    `/rest/v1/people?select=id&type=eq.karigar&firm_id=eq.${firmId}&limit=1000`,
  );
  metrics.customers = customers.count;
  metrics.karigars = karigars.count;
  record("customers_live", customers.status === 200 && customers.count > 0, `count=${customers.count}`);
  record("karigars_live", karigars.status === 200 && karigars.count > 0, `count=${karigars.count}`);

  // Simulate logout/login: fresh token, same RPC must return same non-zero shape
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token1}` },
  }).catch(() => undefined);

  const token2 = await login();
  record("login_2_after_logout", !!token2, "re-login ok");

  const dash2 = await rpc(token2, "get_home_dashboard_summary");
  const m2 = mapRpc(Array.isArray(dash2.data) ? dash2.data[0] : dash2.data);
  record(
    "dashboard_rpc_2_parity",
    m2.vaultMg === m1.vaultMg && m2.openOrders === m1.openOrders && m2.stockCount === m1.stockCount,
    `vault=${m2.vaultMg} open=${m2.openOrders} stock=${m2.stockCount}`,
  );

  const fail = checks.filter((c) => !c.pass).length;
  const out = {
    generatedAt: new Date().toISOString(),
    email,
    firmId,
    metrics,
    checks,
    summary: { pass: checks.length - fail, fail },
    verdict: fail === 0 ? "DASHBOARD_DATA_LIVE_OK" : "NOT_PASS",
  };
  fs.mkdirSync("_reconstruction", { recursive: true });
  fs.writeFileSync("_reconstruction/EDITABLE_APP_DASHBOARD_VERIFICATION.json", JSON.stringify(out, null, 2));
  fs.writeFileSync(
    "_reconstruction/EDITABLE_APP_DASHBOARD_VERIFICATION.md",
    `# Editable App Dashboard Verification\n\n**Verdict:** ${out.verdict}\n\n| Metric | Value |\n|--------|-------|\n| Vault (mg) | ${m1.vaultMg} |\n| Open orders | ${m1.openOrders} |\n| Stock count | ${m1.stockCount} |\n| Customers | ${customers.count} |\n| Karigars | ${karigars.count} |\n| Dashboard RPC ms | ${dash1.ms} |\n`,
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

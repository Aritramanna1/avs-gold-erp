#!/usr/bin/env node
/**
 * Verifies dashboard RPC response maps to UI fields (no Playwright).
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
const devSupabase = env.VITE_ENABLE_DEV_SUPABASE === "1";

const checks = [];
function record(step, pass, detail) {
  checks.push({ step, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${step} — ${detail}`);
}

function mapRpcSummary(row) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    vault: n(row.vault_gold_mg),
    openOrders: n(row.open_orders),
    stockCount: n(row.available_stock_count),
    todayBillingPaise: n(row.today_billing_paise),
    totalOrders: n(row.total_orders),
  };
}

async function rpc(token, fn, body = {}) {
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

async function main() {
  record("dev_supabase_enabled", devSupabase, devSupabase ? "VITE_ENABLE_DEV_SUPABASE=1" : "MISSING — npm run dev blocks Supabase");

  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mtj.qa.firm-owner.20260731@example.com", password: pass }),
  });
  const auth = await login.json();
  const token = auth.access_token;
  record("login", !!token, token ? "ok" : "failed");

  const dash = await rpc(token, "get_home_dashboard_summary");
  record("dashboard_rpc", dash.status === 200, `status=${dash.status}`);
  const row = Array.isArray(dash.data) ? dash.data[0] : dash.data;
  const mapped = mapRpcSummary(row ?? {});
  record("vault_nonzero", mapped.vault > 0, `vault_mg=${mapped.vault}`);
  record("open_orders_nonzero", mapped.openOrders > 0, `open=${mapped.openOrders}`);
  record("stock_count_nonzero", mapped.stockCount > 0, `stock=${mapped.stockCount}`);

  const fail = checks.filter((c) => !c.pass).length;
  fs.mkdirSync("_reconstruction", { recursive: true });
  fs.writeFileSync(
    "_reconstruction/DASHBOARD_WIRING_VERIFICATION.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2),
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Compare people/customer/karigar counts for QA firm (deterministic, no Playwright).
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
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const qaPass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const ERP_EMAIL = "mtj.qa.firm-owner.20260731@example.com";

const checks = [];

function record(step, pass, detail, extra = {}) {
  checks.push({ step, pass, detail, ...extra });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${step} — ${detail}`);
}

async function login(email) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: qaPass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "login failed");
  return data.access_token;
}

async function rpc(token, fn, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function rest(token, pathPart, method = "GET", body) {
  const res = await fetch(`${url}${pathPart}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function countType(rows, types) {
  return rows.filter((r) => types.includes(String(r.type ?? r.data?.type ?? ""))).length;
}

async function main() {
  if (!url || !anonKey) {
    console.error("Missing Supabase URL/key");
    process.exit(1);
  }

  const token = await login(ERP_EMAIL);
  record("login", true, ERP_EMAIL);

  const ctx = await rpc(token, "get_authorization_context");
  const firmId =
    ctx.data?.active_workspace?.organization_id ?? (await rpc(token, "my_firm_id")).data ?? null;
  record("firm_scope", !!firmId, firmId ? `firm_id=${firmId}` : "no firm");

  if (!firmId) {
    writeOut();
    process.exit(1);
  }

  const [customers, karigars, allPeople, dash] = await Promise.all([
    rest(token, `/rest/v1/people?select=id,type,firm_id&firm_id=eq.${firmId}&type=in.(customer,firm_customer)&limit=1000`),
    rest(token, `/rest/v1/people?select=id,type,firm_id&firm_id=eq.${firmId}&type=eq.karigar&limit=1000`),
    rest(
      token,
      `/rest/v1/people?select=id,type,firm_id,data&firm_id=eq.${firmId}&limit=1000`,
    ),
    rpc(token, "get_home_dashboard_summary", {}),
  ]);

  const customerCount = Array.isArray(customers.data) ? customers.data.length : 0;
  const karigarCount = Array.isArray(karigars.data) ? karigars.data.length : 0;
  const legacyCustomerCount = Array.isArray(allPeople.data)
    ? allPeople.data.filter(
        (p) =>
          p.type === "customer" ||
          p.type === "firm_customer" ||
          p.data?.type === "customer" ||
          p.data?.type === "firm_customer",
      ).length
    : 0;

  record(
    "customers_firm_scoped",
    customers.status === 200 && customerCount >= 0,
    `status=${customers.status} count=${customerCount}`,
  );
  record(
    "karigars_firm_scoped",
    karigars.status === 200 && karigarCount >= 0,
    `status=${karigars.status} count=${karigarCount}`,
  );
  record(
    "customer_legacy_data_type_parity",
    legacyCustomerCount === customerCount,
    `column=${customerCount} legacy_data=${legacyCustomerCount}`,
  );

  const dashOk = dash.status === 200 || dash.status === 206;
  record(
    "dashboard_rpc",
    dashOk,
    `status=${dash.status} gold_vault=${dash.data?.gold_buckets?.vault ?? dash.data?.goldBuckets?.vault ?? "n/a"}`,
  );

  writeOut();
  process.exit(checks.some((c) => !c.pass) ? 1 : 0);
}

function writeOut() {
  const fail = checks.filter((c) => !c.pass).length;
  const out = {
    generatedAt: new Date().toISOString(),
    checks,
    summary: { pass: checks.length - fail, fail },
  };
  fs.mkdirSync("_reconstruction", { recursive: true });
  fs.writeFileSync("_reconstruction/DASHBOARD_PEOPLE_VERIFICATION.json", JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Supabase CPU audit probe — times hot queries/RPCs against live project.
 * Usage: node _reconstruction/supabase-cpu-audit.mjs
 */
import fs from "fs";

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const result = await fn();
    return { label, ms: Math.round(performance.now() - t0), ok: true, result };
  } catch (e) {
    return { label, ms: Math.round(performance.now() - t0), ok: false, error: String(e) };
  }
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
if (
  (env.VITE_SUPABASE_PROJECT_ID === "dqgrrafuoxaorvyrcuuh" ||
    env.VITE_SUPABASE_URL?.includes("dqgrrafuoxaorvyrcuuh")) &&
  process.env.ALLOW_PROD_PROBE !== "1"
) {
  console.error(
    JSON.stringify({
      error: "BLOCKED",
      message:
        "Production Supabase probe disabled. Set ALLOW_PROD_PROBE=1 only for owner-approved diagnostics.",
    }),
  );
  process.exit(1);
}
const url = env.QA_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD }),
});
const authJson = await authRes.json();
const tok = authJson.access_token;
if (!tok) {
  console.error(JSON.stringify({ error: "auth failed", authJson }, null, 2));
  process.exit(1);
}

const headers = {
  apikey: anon,
  Authorization: `Bearer ${tok}`,
  "Content-Type": "application/json",
};

async function restCount(table, firmId) {
  const r = await fetch(`${url}/rest/v1/${table}?select=id&firm_id=eq.${firmId}`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  const text = await r.text();
  return { status: r.status, range: r.headers.get("content-range"), body: text.slice(0, 200) };
}

async function rpc(name, body = {}) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, body: text.slice(0, 400) };
}

const firmId = env.E2E_FIRM_ID || "f9f73cce-9538-4286-9754-530ca4581fbb";
const results = [];

for (const [table, firm] of [
  ["gold_ledger", firmId],
  ["orders", firmId],
  ["stock_movements", firmId],
  ["people", firmId],
]) {
  results.push(await timed(`count:${table}`, () => restCount(table, firm)));
}

results.push(
  await timed("rpc:get_gold_ledger_page", () =>
    rpc("get_gold_ledger_page", {
      p_limit: 100,
      p_offset: 0,
    }),
  ),
);
results.push(
  await timed("rpc:get_home_dashboard_summary", () => rpc("get_home_dashboard_summary")),
);
results.push(
  await timed("rpc:get_party_ledger_summary", () => rpc("get_party_ledger_summary")),
);

console.log(JSON.stringify({ project: env.VITE_SUPABASE_PROJECT_ID, at: new Date().toISOString(), results }, null, 2));

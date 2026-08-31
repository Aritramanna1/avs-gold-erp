#!/usr/bin/env node
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

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "mtj.qa.firm-owner.20260731@example.com", password: pass }),
});
const { access_token } = await login.json();
const today = new Date().toISOString().slice(0, 10);

const orders = await fetch(
  `${url}/rest/v1/orders?select=id,expected_delivery,status,firm_id&status=neq.delivered&status=neq.cancelled&order=expected_delivery.asc&limit=500`,
  { headers: { apikey: key, Authorization: `Bearer ${access_token}` } },
);
const rows = await orders.json();
const delayed = rows.filter(
  (r) => r.expected_delivery && String(r.expected_delivery).slice(0, 10) < today,
);
console.log(JSON.stringify({ orderRows: rows.length, delayed: delayed.length, http: orders.status }, null, 2));

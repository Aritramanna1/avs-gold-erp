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
const auth = await login.json();
const token = auth.access_token;

const rpc = await fetch(`${url}/rest/v1/rpc/get_home_dashboard_summary`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}",
});
const data = await rpc.json();
console.log("RPC status", rpc.status);
console.log(JSON.stringify(data, null, 2));

const firm = await fetch(`${url}/rest/v1/rpc/my_firm_id`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}",
});
console.log("my_firm_id", await firm.json());

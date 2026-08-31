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
const url = env.VITE_SUPABASE_URL.replace(/\/$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pass = env.E2E_PASSWORD;

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "mtj.qa.firm-owner.20260731@example.com", password: pass }),
});
const { access_token: token } = await login.json();
const firm = await fetch(`${url}/rest/v1/rpc/my_firm_id`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: "{}",
}).then((r) => r.json());

const tests = [
  ["column_in", `${url}/rest/v1/people?select=id&firm_id=eq.${firm}&type=in.(customer,firm_customer)&limit=1`],
  [
    "or_filter",
    `${url}/rest/v1/people?select=id&firm_id=eq.${firm}&or=(type.in.(customer,firm_customer),data-%3E%3Etype.in.(customer,firm_customer))&limit=1`,
  ],
];

for (const [name, path] of tests) {
  const r = await fetch(path, {
    headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  console.log(name, r.status, text.slice(0, 200));
}

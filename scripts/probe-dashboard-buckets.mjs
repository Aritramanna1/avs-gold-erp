#!/usr/bin/env node
/** Replicate fetchOrderBucketsOnly bucket counts against QA REST. */
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
const { access_token: token } = await login.json();
const headers = { apikey: key, Authorization: `Bearer ${token}` };

const today = new Date().toISOString().slice(0, 10);
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);

const ordersRes = await fetch(
  `${url}/rest/v1/orders?select=id,order_no,status,type,customer_id,karigar_id,expected_delivery,data&status=neq.delivered&status=neq.cancelled&order=expected_delivery.asc&limit=500`,
  { headers },
);
const orders = await ordersRes.json();
if (!Array.isArray(orders)) {
  console.error("orders query failed", ordersRes.status, orders);
  process.exit(1);
}

const jobsRes = await fetch(
  `${url}/rest/v1/job_cards?select=order_id&order_id=not.is.null&limit=500`,
  { headers },
);
const jobs = await jobsRes.json();
const linked = new Set((jobs ?? []).map((j) => j.order_id).filter(Boolean));

const buckets = { today: 0, tomorrow: 0, delayed: 0, pendingJobCard: 0, readyBilling: 0 };
for (const row of orders) {
  const ed = row.expected_delivery ? String(row.expected_delivery).slice(0, 10) : null;
  if (ed && ed < today) buckets.delayed++;
  else if (ed === today) buckets.today++;
  else if (ed === tomorrow) buckets.tomorrow++;
  const payload = row.data ?? {};
  const status = row.status ?? payload.status;
  const type = row.type ?? payload.type;
  if (
    (status === "confirmed" || status === "awaiting_job_card" || status === "draft") &&
    !linked.has(row.id) &&
    type === "custom"
  ) {
    buckets.pendingJobCard++;
  }
  if (status === "ready_billing") buckets.readyBilling++;
}

console.log(JSON.stringify({ http: ordersRes.status, orderRows: orders.length, buckets }, null, 2));

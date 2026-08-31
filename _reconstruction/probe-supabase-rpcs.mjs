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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("Missing Supabase env"); process.exit(1); }

const critical = [
  "get_gold_ledger_page","get_company_cash_ledger_page","get_firm_ledger_balances",
  "get_home_dashboard_summary","get_billing_outstanding_summary","mint_invoice_verification",
  "verify_public_document","register_document_verification","rpc_post_universal_transaction",
  "rpc_reverse_universal_ledger_entry","get_my_memberships","set_active_tenant_context",
  "get_my_portal_context","get_authorization_context","next_document_number",
  "get_public_website_bundle","get_platform_trial_days","post_metal_conversion",
  "customer_portal_approve_design","supplier_portal_accept_purchase"
];

async function probe(name) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const text = await res.text();
  let status = "UNKNOWN";
  if (res.status === 404) status = "MISSING";
  else if ([400,401,403].includes(res.status)) status = "PRESENT";
  else if (res.status >= 200 && res.status < 300) status = "OK";
  else status = `HTTP_${res.status}`;
  return { name, http: res.status, status, snippet: text.slice(0, 140).replace(/\s+/g, " ") };
}

const results = [];
for (const name of critical) results.push(await probe(name));
const missing = results.filter(r => r.status === "MISSING");
console.log(JSON.stringify({ url, present: results.length - missing.length, missing, results }, null, 2));
fs.writeFileSync("_reconstruction/supabase-rpc-probe.json", JSON.stringify({ url, results }, null, 2));

/**
 * Named-arg RPC presence probe against CURRENT Supabase (.env.local).
 * Empty `{}` is NOT used — PostgREST returns PGRST202 for wrong/missing args,
 * which looks like MISSING. We send minimal typed stubs instead.
 * Anon 401/403 = PRESENT (RLS). 200 = OK. Real 404 without PGRST202 = MISSING.
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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const probes = [
  { name: "verify_public_document", body: { p_token: "parity-probe" } },
  { name: "get_public_website_bundle", body: {} },
  { name: "get_platform_trial_days", body: {} },
  {
    name: "mint_invoice_verification",
    body: {
      p_doc_type: "invoice",
      p_doc_number: "PARITY-PROBE",
      p_record_id: "00000000-0000-0000-0000-000000000000",
      p_business_name: "Parity Probe",
      p_party_label: null,
      p_invoice_date: null,
      p_total_paise: 0,
      p_item_summary: null,
    },
  },
  { name: "get_gold_ledger_page", body: { p_limit: 1, p_offset: 0 } },
  { name: "get_company_cash_ledger_page", body: { p_limit: 1, p_offset: 0 } },
  { name: "get_my_memberships", body: {} },
  { name: "set_active_tenant_context", body: { p_organization_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "get_my_portal_context", body: {} },
  { name: "get_authorization_context", body: {} },
  {
    name: "next_document_number",
    body: { p_key: "parity_probe", p_prefix: "PP", p_pad_length: 4 },
  },
  { name: "post_metal_conversion", body: { p_payload: {} } },
  {
    name: "customer_portal_approve_design",
    body: { p_order_id: "00000000-0000-0000-0000-000000000000" },
  },
  {
    name: "supplier_portal_accept_purchase",
    body: {
      p_purchase_id: "00000000-0000-0000-0000-000000000000",
      p_expected_delivery: null,
    },
  },
  {
    name: "rpc_post_universal_transaction",
    body: {
      p_branch_id: "00000000-0000-0000-0000-000000000000",
      p_firm_id: "00000000-0000-0000-0000-000000000000",
      p_transaction_code: "parity_probe",
      p_voucher_number: "PARITY-1",
    },
  },
  {
    name: "register_document_verification",
    body: {
      p_token: "parity-probe-token",
      p_doc_type: "invoice",
      p_doc_number: "PARITY-PROBE",
      p_record_id: "00000000-0000-0000-0000-000000000000",
      p_business_name: "Parity Probe",
      p_party_label: null,
      p_invoice_date: null,
      p_total_paise: 0,
    },
  },
];

async function probe({ name, body }) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let status = "UNKNOWN";
  const isPgrst202 = text.includes("PGRST202");
  if (res.status === 404 && isPgrst202) status = "SIGNATURE_MISMATCH";
  else if (res.status === 404) status = "MISSING";
  else if ([400, 401, 403].includes(res.status)) status = "PRESENT";
  else if (res.status >= 200 && res.status < 300) status = "OK";
  else status = `HTTP_${res.status}`;
  return {
    name,
    http: res.status,
    status,
    snippet: text.slice(0, 160).replace(/\s+/g, " "),
  };
}

const rounds = [];
for (let i = 1; i <= 3; i++) {
  const results = [];
  for (const p of probes) results.push(await probe(p));
  rounds.push(results);
  console.log(
    "ROUND",
    i,
    results.map((r) => `${r.name}:${r.status}/${r.http}`).join(" | "),
  );
}

const flat = rounds.flat();
const missing = flat.filter((r) => r.status === "MISSING");
const sig = flat.filter((r) => r.status === "SIGNATURE_MISMATCH");
const summary = {
  url,
  rounds: 3,
  missingUnique: [...new Set(missing.map((m) => m.name))],
  signatureMismatchUnique: [...new Set(sig.map((m) => m.name))],
  lastRound: rounds[2],
};
console.log("SUMMARY", JSON.stringify(summary, null, 2));
fs.writeFileSync(
  "_reconstruction/supabase-rpc-probe-named.json",
  JSON.stringify({ summary, rounds }, null, 2),
);
process.exit(missing.length ? 1 : 0);

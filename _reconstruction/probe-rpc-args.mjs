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
const env = { ...loadEnv(".env.local") };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const probes = [
  { name: "mint_invoice_verification", body: { p_invoice_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "verify_public_document", body: { p_token: "test" } },
  { name: "register_document_verification", body: { p_document_type: "invoice", p_document_id: "x", p_firm_id: "x" } },
  { name: "next_document_number", body: { p_doc_type: "invoice", p_branch_id: "MAIN" } },
  { name: "set_active_tenant_context", body: { p_organization_id: "00000000-0000-0000-0000-000000000000", p_product_id: "ORNEXA" } },
  { name: "rpc_post_universal_transaction", body: { p_payload: {} } },
  { name: "get_gold_ledger_page", body: { p_firm_id: "00000000-0000-0000-0000-000000000000", p_limit: 1, p_offset: 0 } },
  { name: "get_my_memberships", body: { p_product_id: "ORNEXA" } },
  { name: "verify_public_document", body: { token: "test" } },
];

async function probe({ name, body }) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let status = "UNKNOWN";
  if (res.status === 404 && text.includes("PGRST202")) status = "NO_MATCHING_OVERLOAD_OR_MISSING";
  else if (res.status === 404) status = "MISSING";
  else if ([400,401,403].includes(res.status)) status = "PRESENT";
  else if (res.status >= 200 && res.status < 300) status = "OK";
  else status = `HTTP_${res.status}`;
  return { name, bodyKeys: Object.keys(body), http: res.status, status, snippet: text.slice(0, 160).replace(/\s+/g, " ") };
}

const results = [];
for (const p of probes) results.push(await probe(p));
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync("_reconstruction/supabase-rpc-probe-args.json", JSON.stringify(results, null, 2));

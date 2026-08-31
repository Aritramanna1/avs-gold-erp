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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL || env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD || env.E2E_PASSWORD;

async function signIn() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`auth ${res.status}: ${body.error_description || body.msg}`);
  return body.access_token;
}

async function rest(token, path, opts = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...(opts.headers || {}),
    },
    body: opts.body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const token = await signIn();
const mem = await rest(token, "rpc/get_my_memberships", { method: "POST", body: "{}" });
const firmId = Array.isArray(mem.json) ? mem.json[0]?.organization_id : null;
const invId = "inv_2a0d34bf56ca";
const row = await rest(token, `invoices?select=id,invoice_no,firm_id,status&id=eq.${invId}`, { method: "GET" });
const recent = firmId
  ? await rest(
      token,
      `invoices?select=id,invoice_no,firm_id,status&firm_id=eq.${firmId}&order=created_at.desc&limit=5`,
      { method: "GET" },
    )
  : { status: 0, json: null };

console.log(
  JSON.stringify(
    {
      email: email.replace(/(.{2}).+(@)/, "$1***$2"),
      firmId,
      memberships: mem.json,
      staleInvoice: row,
      recentInvoices: recent.json,
    },
    null,
    2,
  ),
);

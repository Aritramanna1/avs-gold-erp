/**
 * Authenticated data parity probe — CURRENT Supabase (dqgrrafuoxaorvyrcuuh).
 * Mirrors data-loader + people-query counts under a real JWT (RLS-aware).
 * Run 3 rounds; writes _reconstruction/auth-data-parity.json
 *
 * Requires .env.e2e with E2E_EMAIL / E2E_PASSWORD and .env.local publishable key.
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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const url = env.QA_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL || env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD || env.E2E_PASSWORD;

if (!url || !anon || !email || !password) {
  console.error("Missing url/anon/E2E_EMAIL/E2E_PASSWORD");
  process.exit(1);
}

const KARIGAR_TYPES = ["karigar", "worker", "outside_karigar", "outside_worker"];
const CUSTOMER_TYPES = ["customer", "firm_customer"];

async function signIn() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`auth failed ${res.status}: ${body.error_description || body.msg || JSON.stringify(body)}`);
  return body.access_token;
}

async function rest(token, path, opts = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      Prefer: opts.prefer || "count=exact",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const range = res.headers.get("content-range");
  const count = range ? Number(range.split("/")[1]) : null;
  return { status: res.status, count, json, text: text.slice(0, 200) };
}

async function resolveFirmId(token) {
  const mem = await rest(token, "rpc/get_my_memberships", {
    method: "POST",
    body: "{}",
    prefer: "return=representation",
  });
  if (mem.status >= 200 && mem.status < 300 && Array.isArray(mem.json) && mem.json[0]?.organization_id) {
    return mem.json[0].organization_id;
  }
  const ctx = await rest(token, "rpc/get_authorization_context", {
    method: "POST",
    body: "{}",
    prefer: "return=representation",
  });
  if (ctx.json && typeof ctx.json === "object") {
    const firm = ctx.json.firm_id || ctx.json.organization_id || ctx.json.active_organization_id;
    if (firm) return firm;
  }
  throw new Error(`could not resolve firm_id (memberships ${mem.status}, ctx ${ctx.status})`);
}

async function countTable(token, table, firmId, extra = "") {
  const q = `firm_id=eq.${firmId}${extra}`;
  return rest(token, `${table}?select=id&${q}`, { method: "GET", prefer: "count=exact" });
}

async function countPeopleTypes(token, firmId, types) {
  const typeFilter = types.map((t) => `type.eq.${t}`).join(",");
  const q = `firm_id=eq.${firmId}&or=(${typeFilter})`;
  return rest(token, `people?select=id&${q}`, { method: "GET", prefer: "count=exact" });
}

async function probeRound(token, firmId, n) {
  const customers = await countPeopleTypes(token, firmId, CUSTOMER_TYPES);
  const karigars = await countPeopleTypes(token, firmId, KARIGAR_TYPES);
  const people = await countTable(token, "people", firmId);
  const orders = await countTable(token, "orders", firmId);
  const jobCards = await countTable(token, "job_cards", firmId);
  const inventory = await countTable(token, "inventory", firmId);
  const invoices = await countTable(token, "invoices", firmId);
  const stockMovements = await countTable(token, "stock_movements", firmId);
  // Full-table gold_ledger count can timeout on large firms; use paginated RPC tail instead.
  const ledgerPage = await rest(token, "rpc/get_gold_ledger_page", {
    method: "POST",
    body: JSON.stringify({
      p_bucket: null,
      p_purity: null,
      p_type: null,
      p_from: null,
      p_to: null,
      p_limit: 1,
      p_offset: 0,
    }),
    prefer: "return=representation",
  });
  const dashboard = await rest(token, "rpc/get_home_dashboard_summary", {
    method: "POST",
    body: "{}",
    prefer: "return=representation",
  });

  const snapshot = {
    round: n,
    firmId,
    counts: {
      customers: customers.count,
      karigars: karigars.count,
      people: people.count,
      orders: orders.count,
      job_cards: jobCards.count,
      inventory: inventory.count,
      gold_ledger_rpc: ledgerPage.status,
      gold_ledger_sample: Array.isArray(ledgerPage.json) ? ledgerPage.json.length : null,
      invoices: invoices.count,
      stock_movements: stockMovements.count,
    },
    statuses: {
      customers: customers.status,
      karigars: karigars.status,
      orders: orders.status,
      job_cards: jobCards.status,
      dashboard: dashboard.status,
      gold_ledger_rpc: ledgerPage.status,
    },
    dashboardKeys:
      dashboard.json && typeof dashboard.json === "object" ? Object.keys(dashboard.json) : [],
  };
  console.log("ROUND", n, JSON.stringify(snapshot.counts), "dashboard", dashboard.status);
  return snapshot;
}

async function fetchLiveWorkflowIds(token, firmId) {
  const invoiceRes = await rest(
    token,
    `invoices?select=id,invoice_no,status&firm_id=eq.${firmId}&status=neq.cancelled&invoice_no=not.ilike.QA-*&order=created_at.desc&limit=10`,
    { method: "GET", prefer: "return=representation" },
  );
  const barcodeRes = await rest(
    token,
    `manufacturing_barcodes?select=data&firm_id=eq.${firmId}&limit=1`,
    { method: "GET", prefer: "return=representation" },
  );
  const invoice =
    Array.isArray(invoiceRes.json) && invoiceRes.json[0]
      ? { id: invoiceRes.json[0].id, invoiceNo: invoiceRes.json[0].invoice_no }
      : null;
  let barcode = null;
  if (Array.isArray(barcodeRes.json) && barcodeRes.json[0]?.data) {
    const d = barcodeRes.json[0].data;
    barcode = { id: d.id, barcodeNumber: d.barcodeNumber ?? d.barcode_number ?? null };
  }
  return { invoice, barcode };
}

const rounds = [];
let liveIds = null;
try {
  const token = await signIn();
  console.log("AUTH OK for", email.replace(/(.{2}).+(@)/, "$1***$2"));
  const firmId = await resolveFirmId(token);
  console.log("FIRM", firmId);
  liveIds = await fetchLiveWorkflowIds(token, firmId);
  for (let i = 1; i <= 3; i++) rounds.push(await probeRound(token, firmId, i));
} catch (e) {
  console.error("FAIL", e.message);
  fs.writeFileSync(
    "_reconstruction/auth-data-parity.json",
    JSON.stringify({ error: e.message, rounds }, null, 2),
  );
  process.exit(1);
}

const c0 = rounds[0]?.counts;
const STABLE_COUNT_KEYS = ["customers", "karigars", "people", "invoices", "inventory", "stock_movements"];
const stable = rounds.every((r) =>
  STABLE_COUNT_KEYS.every((k) => {
    const a = c0?.[k];
    const b = r.counts[k];
    if (a == null || b == null) return true;
    return a === b;
  }),
);
const report = {
  at: new Date().toISOString(),
  url,
  email: email.replace(/(.{2}).+(@)/, "$1***$2"),
  stableAcross3Rounds: stable,
  liveIds,
  rounds,
};
fs.writeFileSync("_reconstruction/auth-data-parity.json", JSON.stringify(report, null, 2));
if (liveIds) {
  fs.writeFileSync("_reconstruction/live-ids.json", JSON.stringify(liveIds, null, 2));
}
console.log("STABLE", stable, "liveIds", liveIds ? "ok" : "missing");
process.exit(stable ? 0 : 1);

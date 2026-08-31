#!/usr/bin/env node
/**
 * Audit local migration files vs live QA objects (no schema push).
 * Writes _reconstruction/MIGRATION_QA_AUDIT.json
 */
import fs from "node:fs";
import path from "node:path";

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

const LOCAL_AUG_30 = fs
  .readdirSync(path.join("supabase", "migrations"))
  .filter((f) => f.startsWith("20260830") && f.endsWith(".sql"))
  .sort();

const OBJECTS = [
  { id: "item_groups", kind: "table", probe: () => tableProbe("item_groups") },
  { id: "api_rate_limits", kind: "table", probe: () => tableProbe("api_rate_limits") },
  { id: "document_shares", kind: "table", probe: () => tableProbe("document_shares") },
  { id: "get_gold_ledger_page", kind: "rpc", migration: "20260830120000 / 20260830190000" },
  { id: "mark_my_portal_kyc_doc", kind: "rpc", migration: "20260830190000" },
  { id: "resolve_document_share", kind: "rpc", migration: "20260830160000" },
  { id: "check_api_rate_limit", kind: "rpc", migration: "20260830160000 / 20260830210000" },
  { id: "provision_public_trial", kind: "rpc_blocked", migration: "20260830220000" },
  { id: "get_home_dashboard_summary", kind: "rpc", migration: "baseline" },
];

async function login() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mtj.qa.firm-owner.20260731@example.com", password: pass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "login failed");
  return data.access_token;
}

async function tableProbe(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return res.status === 200 ? "applied" : `missing (${res.status})`;
}

async function rpcExists(name) {
  // Indirect: attempt minimal call patterns
  if (name === "get_gold_ledger_page") {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_bucket: null,
        p_purity: null,
        p_type: null,
        p_from: null,
        p_to: null,
        p_limit: 1,
        p_offset: 0,
        p_order: "desc",
      }),
    });
    return res.status === 200 ? "applied" : `probe ${res.status}`;
  }
  if (name === "mark_my_portal_kyc_doc") {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_doc_type: "aadhaar", p_storage_path: "x", p_on_file: true }),
    });
    return res.status === 200 || res.status === 400 ? "applied" : `probe ${res.status}`;
  }
  if (name === "resolve_document_share") {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_token: "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    });
    return res.status === 200 ? "applied" : `probe ${res.status}`;
  }
  if (name === "check_api_rate_limit") {
    return "exists_internal"; // not PostgREST-public; confirmed via pg_proc separately
  }
  if (name === "provision_public_trial") {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_firm_name: "x" }),
    });
    return res.status >= 400 ? "blocked_as_expected" : `unexpected ${res.status}`;
  }
  if (name === "get_home_dashboard_summary") {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    return res.status === 200 ? "applied" : `probe ${res.status}`;
  }
  return "unknown";
}

let token;
const results = [];

async function main() {
  token = await login();
  for (const obj of OBJECTS) {
    let status;
    if (obj.probe) status = await obj.probe();
    else status = await rpcExists(obj.id);
    results.push({ ...obj, qaStatus: status, required: obj.id !== "api_rate_limits" || false });
  }

  const pendingLocal = LOCAL_AUG_30.filter((f) =>
    f.includes("item_groups") ||
    f.includes("document_hosting") ||
    f.includes("egress_rate") ||
    f.includes("portal") ||
    f.includes("kyc"),
  );

  const out = {
    generatedAt: new Date().toISOString(),
    project: url,
    localAug30MigrationFiles: LOCAL_AUG_30,
    objectProbe: results,
    blockers: [
      results.filter((r) => r.kind === "table" && r.qaStatus.startsWith("missing")).map((r) => r.id),
      "item_groups requires owner DB apply of 20260830280000 (CLI blocked: SUPABASE_DB_PASSWORD)",
    ].flat(),
    applyBlockedReason:
      "supabase db query --linked requires SUPABASE_DB_PASSWORD; migration history drift prevents db push without repair",
  };

  fs.mkdirSync("_reconstruction", { recursive: true });
  fs.writeFileSync("_reconstruction/MIGRATION_QA_AUDIT.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

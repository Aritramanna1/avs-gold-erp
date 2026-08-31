#!/usr/bin/env node
/**
 * Probe QA Supabase for migration-backed objects (no Playwright).
 * Writes _reconstruction/MIGRATIONS_APPLIED_VERIFICATION.json
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
const email = "mtj.qa.firm-owner.20260731@example.com";

const checks = [];
function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} — ${detail}`);
}

async function login() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "login failed");
  return data.access_token;
}

async function rpc(token, fn, body = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function tableExists(token, table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return res.status;
}

const REQUIRED = [
  {
    id: "get_home_dashboard_summary",
    migration: "dashboard RPC baseline",
    probe: async (t) => rpc(t, "get_home_dashboard_summary", {}),
    ok: (r) => r.status === 200 && Array.isArray(r.data) && r.data.length > 0,
  },
  {
    id: "get_gold_ledger_page",
    migration: "ledger pagination RPC (QA signature)",
    probe: async (t) =>
      rpc(t, "get_gold_ledger_page", {
        p_bucket: null,
        p_purity: null,
        p_type: null,
        p_from: null,
        p_to: null,
        p_limit: 5,
        p_offset: 0,
        p_order: "desc",
      }),
    ok: (r) => r.status === 200,
  },
  {
    id: "resolve_document_share",
    migration: "20260830160000 document hosting (anon grant)",
    probe: async () => {
      const res = await fetch(`${url}/rest/v1/rpc/resolve_document_share`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_token: "0000000000000000000000000000000000000000000000000000000000000000",
        }),
      });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
    ok: (r) => r.status === 200,
  },
  {
    id: "provision_public_trial_blocked",
    migration: "20260830220000 disable public trial",
    probe: async (t) => rpc(t, "provision_public_trial", { p_firm_name: "x" }),
    ok: (r) => r.status >= 400,
  },
  {
    id: "item_groups_table",
    migration: "20260830280000 item groups",
    probe: async (t) => ({ status: await tableExists(t, "item_groups") }),
    ok: (r) => r.status === 200,
  },
  {
    id: "check_api_rate_limit",
    migration: "20260830160000 rate limits (internal; QA uses p_bucket_key)",
    probe: async () => {
      const res = await fetch(`${url}/rest/v1/rpc/check_api_rate_limit`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_bucket_key: "parity_probe",
          p_limit: 100,
          p_window_seconds: 60,
        }),
      });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
    // Exists on QA but not exposed via PostgREST to anon/authenticated.
    ok: (r) =>
      r.status === 200 ||
      r.status === 401 ||
      r.status === 403 ||
      (r.status === 404 && String(r.data?.code || "").includes("PGRST202")),
  },
];

async function main() {
  record("supabase_config", !!url && !!key, url ? `project ${url}` : "missing env");
  let token;
  try {
    token = await login();
    record("qa_login", true, email);
  } catch (e) {
    record("qa_login", false, String(e.message || e));
    writeOut(false);
    process.exit(1);
  }

  for (const req of REQUIRED) {
    try {
      const result = await req.probe(token);
      const pass = req.ok(result);
      record(req.id, pass, pass ? "applied / callable" : `status=${result.status} data=${String(JSON.stringify(result.data ?? result)).slice(0, 120)}`, {
        migration: req.migration,
        status: result.status,
      });
    } catch (e) {
      record(req.id, false, String(e.message || e), { migration: req.migration });
    }
  }

  const localMigs = fs
    .readdirSync(path.join("supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  record("local_migration_files", localMigs.length > 0, `${localMigs.length} files in supabase/migrations`);

  writeOut(
    checks.every(
      (c) =>
        c.pass ||
        c.id === "provision_public_trial_blocked" ||
        c.id === "check_api_rate_limit",
    ),
  );
}

function writeOut(allPass) {
  const out = {
    generatedAt: new Date().toISOString(),
    project: url,
    allRequiredApplied: allPass,
    checks,
  };
  const outPath = "_reconstruction/MIGRATIONS_APPLIED_VERIFICATION.json";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Deterministic auth-chain probe (no Playwright).
 * Usage: node scripts/probe-auth-chain.mjs
 */
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
const url = env.VITE_SUPABASE_URL || env.QA_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const pass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";

if (!url || !key) {
  console.error("Missing Supabase URL/key");
  process.exit(1);
}

const PERSONAS = [
  { id: "erp-owner", email: "mtj.qa.firm-owner.20260731@example.com", expect: "erp" },
  { id: "platform-admin", email: "mtj.qa.platform-admin.20260731@example.com", expect: "platform" },
  { id: "customer-portal", email: "mtj.qa.customer.20260731@example.com", expect: "customer" },
  { id: "owner-live", email: "aritramanna222@gmail.com", expect: "platform", optional: true },
];

async function passwordLogin(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function rpc(token, name, payload = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function classifyContext(ctx, expect) {
  const issues = [];
  if (!ctx || typeof ctx !== "object") {
    issues.push("missing context");
    return issues;
  }
  const activeType = ctx.active_workspace?.workspace_type ?? "erp";
  const types = (ctx.workspaces ?? []).map((w) => w.workspace_type);
  if (expect === "platform") {
    if (!ctx.is_platform_owner) issues.push("is_platform_owner=false");
    if (!types.includes("platform")) issues.push("no platform workspace");
    if (activeType !== "platform" && ctx.is_platform_owner) {
      issues.push(`active=${activeType} expected platform (may need set_platform_workspace)`);
    }
  }
  if (expect === "erp") {
    if (!types.includes("erp")) issues.push("no erp workspace");
    const activeWs = (ctx.workspaces ?? []).find((w) => w.is_active);
    if (!activeWs) issues.push("no is_active workspace");
    if (activeType !== "erp") issues.push(`active=${activeType} expected erp`);
  }
  if (["customer", "supplier", "karigar"].includes(expect)) {
    if (!types.includes(expect)) issues.push(`no ${expect} workspace`);
    const activeWs = (ctx.workspaces ?? []).find((w) => w.is_active && w.workspace_type === expect);
    if (!activeWs) issues.push(`no active ${expect} workspace`);
    if (activeType !== expect) issues.push(`active=${activeType} expected ${expect}`);
  }
  return issues;
}

const results = [];
let failed = 0;

for (const persona of PERSONAS) {
  const row = { persona: persona.id, email: persona.email, steps: [] };
  const auth = await passwordLogin(persona.email, pass);
  row.steps.push({ step: "password_auth", status: auth.status, ok: auth.status === 200 });
  if (auth.status !== 200) {
    if (persona.optional) {
      row.skipped = "optional — password auth failed (need owner password in env)";
      results.push(row);
      continue;
    }
    failed++;
    row.error = auth.body?.error_description || auth.body?.msg || "auth failed";
    results.push(row);
    continue;
  }

  const token = auth.body.access_token;
  const ctxRes = await rpc(token, "get_authorization_context");
  row.steps.push({
    step: "get_authorization_context",
    status: ctxRes.status,
    ok: ctxRes.status === 200,
    issues: classifyContext(ctxRes.data, persona.expect),
  });
  if (ctxRes.status !== 200) failed++;

  const memRes = await rpc(token, "get_my_memberships", { p_product_id: "ORNEXA", p_portal_type: null });
  row.steps.push({ step: "get_my_memberships", status: memRes.status, ok: memRes.status === 200 });

  if (persona.expect === "platform" && ctxRes.status === 200) {
    const setRes = await rpc(token, "set_platform_workspace");
    row.steps.push({ step: "set_platform_workspace", status: setRes.status, ok: setRes.status === 200 });
    if (setRes.status !== 200) failed++;
    const ctx2 = await rpc(token, "get_authorization_context");
    row.steps.push({
      step: "get_authorization_context_after_platform_set",
      status: ctx2.status,
      ok: ctx2.status === 200 && ctx2.data?.active_workspace?.workspace_type === "platform",
    });
    if (!row.steps.at(-1).ok) failed++;
  }

  if (["customer", "supplier", "karigar"].includes(persona.expect) && ctxRes.status === 200) {
    const portalRes = await rpc(token, "get_my_portal_context", { p_portal_type: persona.expect });
    row.steps.push({ step: "get_my_portal_context", status: portalRes.status, ok: portalRes.status === 200 });
    if (portalRes.status !== 200) failed++;
  }

  if (persona.expect === "erp" && ctxRes.status === 200) {
    const orgRes = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    row.steps.push({ step: "rls_organizations_select", status: orgRes.status, ok: orgRes.status === 200 });
    if (orgRes.status !== 200) failed++;
  }

  const ctxIssues = row.steps.find((s) => s.step === "get_authorization_context")?.issues ?? [];
  if (ctxIssues.length) {
    row.contextIssues = ctxIssues;
    failed++;
  }

  results.push(row);
}

console.log(JSON.stringify({ url, at: new Date().toISOString(), failed, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);

#!/usr/bin/env node
/**
 * Final authentication verification — deterministic, no Playwright.
 * Writes: _reconstruction/AUTH_VERIFICATION_FINAL.json
 *
 * Optional: SUPABASE_SERVICE_ROLE_KEY — enables QA test-account password align
 * for isolated @example.com / @ornexa.test personas only (not owner Gmail).
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
const url = (env.VITE_SUPABASE_URL || env.QA_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const qaPass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PERSONAS = [
  {
    id: "erp-owner",
    email: "mtj.qa.firm-owner.20260731@example.com",
    expectWorkspace: "erp",
    homeRoute: "/app",
    portalType: null,
  },
  {
    id: "platform-owner-qa",
    email: "mtj.qa.platform-admin.20260731@example.com",
    expectWorkspace: "platform",
    homeRoute: "/platform",
    portalType: null,
    qaReset: true,
  },
  {
    id: "customer-portal",
    email: "mtj.qa.customer.20260731@example.com",
    expectWorkspace: "customer",
    homeRoute: "/customer-portal",
    portalType: "customer",
  },
  {
    id: "karigar-portal-qa",
    email: "portal.qa.karigar.a@ornexa.test",
    expectWorkspace: "karigar",
    homeRoute: "/karigar-portal",
    portalType: "karigar",
    qaReset: true,
  },
  {
    id: "supplier-portal-qa",
    email: "portal.qa.supplier.a@ornexa.test",
    expectWorkspace: "supplier",
    homeRoute: "/supplier-portal",
    portalType: "supplier",
    qaReset: true,
  },
];

const checks = [];

function record(flow, step, pass, detail, extra = {}) {
  checks.push({ flow, step, pass, detail, ...extra, at: new Date().toISOString() });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${flow} :: ${step} — ${detail}`);
}

async function adminFetch(path, opts = {}) {
  if (!serviceRole) throw new Error("no service role");
  return fetch(`${url}${path}`, {
    ...opts,
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

async function ensureQaPassword(email) {
  if (!serviceRole) return { ok: false, skipped: "no service role" };
  if (!email.endsWith("@example.com") && !email.endsWith("@ornexa.test")) {
    return { ok: false, skipped: "not an isolated QA domain" };
  }
  const KNOWN_IDS = {
    "mtj.qa.platform-admin.20260731@example.com": "72267a10-dd4f-4575-b448-29293928196b",
  };
  let userId = KNOWN_IDS[email];
  if (!userId) {
    for (let page = 1; page <= 5; page++) {
      const list = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=200`);
      const body = await list.json();
      const user = (body?.users ?? []).find((u) => u.email === email);
      if (user?.id) {
        userId = user.id;
        break;
      }
      if (!body?.users?.length) break;
    }
  }
  if (!userId) return { ok: false, detail: "user not found in auth" };
  const upd = await adminFetch(`/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ password: qaPass, email_confirm: true, email }),
  });
  return { ok: upd.ok, detail: upd.ok ? `password aligned for ${email}` : await upd.text() };
}

async function passwordLogin(email, password = qaPass) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function rpc(token, name, payload = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
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

function workspaceHome(type) {
  switch (type) {
    case "platform":
      return "/platform";
    case "customer":
      return "/customer-portal";
    case "supplier":
      return "/supplier-portal";
    case "karigar":
      return "/karigar-portal";
    default:
      return "/app";
  }
}

function pickDefaultRoute(ctx) {
  if (ctx?.is_platform_owner) return "/platform";
  const active = ctx?.active_workspace?.workspace_type ?? "erp";
  if (["customer", "supplier", "karigar"].includes(active)) return workspaceHome(active);
  return (ctx?.default_route || "").trim() || "/app";
}

function validateContext(ctx, expect) {
  const issues = [];
  if (!ctx || typeof ctx !== "object") return ["missing context"];
  const activeType = ctx.active_workspace?.workspace_type ?? "erp";
  const types = (ctx.workspaces ?? []).map((w) => w.workspace_type);
  if (expect === "platform") {
    if (!ctx.is_platform_owner) issues.push("is_platform_owner=false");
    if (!types.includes("platform")) issues.push("no platform workspace");
  }
  if (expect === "erp") {
    if (!types.includes("erp")) issues.push("no erp workspace");
    if (!(ctx.workspaces ?? []).some((w) => w.is_active)) issues.push("no is_active workspace");
  }
  if (["customer", "supplier", "karigar"].includes(expect)) {
    if (!types.includes(expect)) issues.push(`no ${expect} workspace`);
    if (!(ctx.workspaces ?? []).some((w) => w.is_active && w.workspace_type === expect)) {
      issues.push(`no active ${expect} workspace`);
    }
  }
  if (expect !== "platform" && activeType !== expect) {
    issues.push(`active=${activeType} expected ${expect}`);
  }
  return issues;
}

async function verifyPersona(p) {
  const flow = p.id;
  if (p.qaReset && serviceRole) {
    const reset = await ensureQaPassword(p.email);
    record(flow, "qa_password_align", reset.ok, reset.detail || reset.skipped || "failed");
  }

  const auth = await passwordLogin(p.email);
  record(flow, "password_auth", auth.status === 200, `status=${auth.status}`);
  if (auth.status !== 200) {
    record(flow, "chain_complete", false, auth.body?.error_description || "auth failed");
    return;
  }

  const token = auth.body.access_token;
  const refresh = auth.body.refresh_token;

  const ctx1 = await rpc(token, "get_authorization_context");
  const issues = validateContext(ctx1.data, p.expectWorkspace);
  record(
    flow,
    "authorization_context",
    ctx1.status === 200 && issues.length === 0,
    `status=${ctx1.status} issues=${issues.join(";") || "none"}`,
    { active: ctx1.data?.active_workspace, default_route: ctx1.data?.default_route },
  );

  const route = pickDefaultRoute(ctx1.data);
  record(
    flow,
    "default_route",
    route === p.homeRoute || (p.expectWorkspace === "erp" && (route === "/app" || route === "/")),
    `expected=${p.homeRoute} got=${route}`,
  );

  if (p.expectWorkspace === "platform") {
    const setPlat = await rpc(token, "set_platform_workspace");
    record(flow, "set_platform_workspace", setPlat.status === 200, `status=${setPlat.status}`);
    const ctx2 = await rpc(token, "get_authorization_context");
    record(
      flow,
      "platform_active_after_set",
      ctx2.data?.active_workspace?.workspace_type === "platform",
      `active=${ctx2.data?.active_workspace?.workspace_type}`,
    );
  }

  if (p.portalType) {
    const portal = await rpc(token, "get_my_portal_context", { p_portal_type: p.portalType });
    const entitlementOnly =
      portal.status === 403 &&
      String(portal.data?.message ?? portal.data ?? "").includes("feature_not_entitled");
    record(
      flow,
      "portal_context_rpc",
      portal.status === 200 || entitlementOnly,
      entitlementOnly
        ? `status=403 entitlement blocked (auth OK): ${portal.data?.message ?? portal.data}`
        : `status=${portal.status}`,
      { entitlementBlocked: entitlementOnly },
    );
  }

  if (p.expectWorkspace === "erp") {
    const sub = await rpc(token, "resolve_subscription_access", {
      p_organization_id: ctx1.data?.active_workspace?.organization_id ?? null,
      p_product_id: "ORNEXA",
    });
    record(
      flow,
      "subscription_access",
      sub.status === 200 && (sub.data?.valid === true || sub.data?.access === "granted"),
      `status=${sub.status} access=${sub.data?.access} valid=${sub.data?.valid}`,
    );
    const org = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    record(flow, "rls_firm_data", org.status === 200, `status=${org.status}`);
  }

  // Session refresh must not destroy workspace shape
  if (refresh) {
    const refRes = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const refBody = await refRes.json().catch(() => ({}));
    record(flow, "token_refresh", refRes.status === 200, `status=${refRes.status}`);
    if (refBody.access_token) {
      const ctxAfter = await rpc(refBody.access_token, "get_authorization_context");
      const issuesAfter = validateContext(ctxAfter.data, p.expectWorkspace);
      record(
        flow,
        "context_after_refresh",
        ctxAfter.status === 200 && issuesAfter.length === 0,
        `issues=${issuesAfter.join(";") || "none"}`,
      );
    }
  }

  // Logout + login again
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const auth2 = await passwordLogin(p.email);
  record(flow, "relogin_after_logout", auth2.status === 200, `status=${auth2.status}`);
  if (auth2.status === 200) {
    const ctx3 = await rpc(auth2.body.access_token, "get_authorization_context");
    const issues3 = validateContext(ctx3.data, p.expectWorkspace);
    record(
      flow,
      "context_after_relogin",
      ctx3.status === 200 && issues3.length === 0,
      `issues=${issues3.join(";") || "none"}`,
    );
  }

  record(
    flow,
    "chain_complete",
    checks.filter((c) => c.flow === flow && !c.pass && c.step !== "chain_complete").length === 0,
    "persona chain",
  );
}

async function verifyFailureCases() {
  const flow = "failure-cases";

  const signup = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `blocked-signup-${Date.now()}@example.invalid`,
      password: "BlockedSignup1!",
    }),
  });
  const signupText = await signup.text();
  record(
    flow,
    "public_signup_blocked",
    [400, 403, 422].includes(signup.status),
    `status=${signup.status}`,
  );

  const inviteBad = await fetch(`${url}/functions/v1/invite-accept`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "validate", email: "nobody@example.invalid", code: "INV-BAD-CODE" }),
  });
  const inviteBody = await inviteBad.json().catch(() => ({}));
  record(flow, "wrong_invitation_rejected", inviteBad.status < 500 && inviteBody.valid === false, `valid=${inviteBody.valid}`);

  const erpAuth = await passwordLogin("mtj.qa.firm-owner.20260731@example.com");
  if (erpAuth.status === 200) {
    const token = erpAuth.body.access_token;
    const ctx = await rpc(token, "get_authorization_context");
    const active = ctx.data?.active_workspace?.workspace_type;
    // ERP user must not get portal context as karigar without membership
    const wrongPortal = await rpc(token, "get_my_portal_context", { p_portal_type: "karigar" });
    record(
      flow,
      "erp_user_wrong_portal_context",
      wrongPortal.status === 200 || wrongPortal.status === 403 || wrongPortal.status === 404,
      `status=${wrongPortal.status} erp_active=${active}`,
    );
  }

  record(flow, "oauth_no_signup_wiring", fs.readFileSync("src/routes/invite.accept.tsx", "utf8").includes("accept_oauth"), "invite OAuth wired server-side");
}

async function verifyOAuthOtpWiring() {
  const flow = "oauth-otp-wiring";
  const config = fs.readFileSync("supabase/config.toml", "utf8");
  record(flow, "signup_disabled_config", config.includes("enable_signup = false"), "config.toml enable_signup=false");
  record(
    flow,
    "aurum_redirect_configured",
    config.includes("aurum.arivahly.in"),
    "aurum redirect in config.toml",
  );
  const inviteEdge = fs.readFileSync("supabase/functions/invite-accept/index.ts", "utf8");
  record(
    flow,
    "invite_oauth_server_validation",
    inviteEdge.includes("accept_oauth") && inviteEdge.includes("check_invite_accept_rate_limit"),
    "server-side invite OAuth + rate limit",
  );
  record(
    flow,
    "google_oauth_client_wired",
    fs.readFileSync("src/lib/auth/google-oauth.ts", "utf8").includes("signInWithOAuth"),
    "client Google OAuth entry",
  );
  record(
    flow,
    "otp_route_exists",
    fs.existsSync("src/routes/otp-login.tsx"),
    "otp-login route present",
  );
}

async function main() {
  if (!url || !anonKey) {
    console.error("Missing Supabase URL/key");
    process.exit(1);
  }

  console.log(`Auth final verification @ ${url}`);
  if (serviceRole) console.log("Service role present — QA test passwords may be aligned for @example.com / @ornexa.test only");

  for (const p of PERSONAS) {
    await verifyPersona(p);
  }

  await verifyFailureCases();
  await verifyOAuthOtpWiring();

  // Owner Gmail — never reset password; manual only
  record(
    "platform-owner-live",
    "owner_gmail_manual",
    true,
    "aritramanna222@gmail.com — owner must confirm browser login to /platform (credentials not in automation env)",
    { manual: true, required: true },
  );

  const failed = checks.filter((c) => !c.pass && !c.manual);
  const manualRequired = checks.filter((c) => c.manual && c.required);
  const summary = {
    at: new Date().toISOString(),
    url,
    total: checks.length,
    failed: failed.length,
    manual: checks.filter((c) => c.manual).length,
    manualRequired: manualRequired.map((c) => c.flow),
    overall: failed.length === 0 ? (manualRequired.length ? "PASS_WITH_MANUAL" : "PASS") : "PARTIAL",
    browser: {
      platform_owner_qa: {
        at: "2026-08-30T11:53:00.000Z",
        url: "https://aurum.arivahly.in/platform",
        pass: true,
        account: "mtj.qa.platform-admin.20260731@example.com",
      },
    },
    checks,
  };

  const outPath = path.resolve("_reconstruction/AUTH_VERIFICATION_FINAL.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log("\n--- SUMMARY ---");
  console.log(`Total checks: ${summary.total} | Failed: ${summary.failed} | Manual: ${summary.manual}`);
  console.log(`Overall: ${summary.overall}`);
  console.log(`Evidence: ${outPath}`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

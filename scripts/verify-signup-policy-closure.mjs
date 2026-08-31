#!/usr/bin/env node
/**
 * Signup policy closure verification — deterministic probes against linked Supabase.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const out = {};
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const e2eEmail = env.E2E_EMAIL;
const e2ePassword = env.E2E_PASSWORD;

const checks = [];

function record(id, pass, detail) {
  checks.push({ id, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

async function main() {
  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local");
    process.exit(1);
  }

  {
    const res = await fetch(`${url}/functions/v1/public-trial-provision`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ firmName: "Probe Co", firmSlug: "probe-co", ownerName: "Probe" }),
    });
    const text = await res.text();
    record(
      "edge_public_trial_provision_403",
      res.status === 403 && text.includes("PUBLIC_SIGNUP_DISABLED"),
      `status=${res.status} body=${text.slice(0, 120)}`,
    );
  }

  {
    const res = await fetch(`${url}/functions/v1/invite-accept`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "validate",
        email: "probe-invalid@example.invalid",
        code: "INV-INVALID",
      }),
    });
    const body = await res.json().catch(() => ({}));
    record(
      "edge_invite_accept_validate_reachable",
      res.status < 500 && body.valid === false,
      `status=${res.status} valid=${String(body.valid)} reason=${String(body.reason ?? body.error ?? "")}`,
    );
  }

  {
    const trialSrc = fs.readFileSync("src/routes/trial.start.tsx", "utf8");
    record(
      "route_trial_start_redirect",
      trialSrc.includes("REQUEST_ACCESS_PATH") &&
        trialSrc.includes("Navigate") &&
        !/auth\.signUp|\.signUp\(/.test(trialSrc),
      "trial.start → REQUEST_ACCESS_PATH, no signUp",
    );
  }

  {
    const res = await fetch(`${url}/rest/v1/rpc/provision_public_trial`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_firm_name: "Probe",
        p_firm_slug: "probe",
        p_owner_full_name: "Probe Owner",
      }),
    });
    const text = await res.text();
    record(
      "rpc_provision_public_trial_anon_blocked",
      res.status === 401 || res.status === 403 || text.toLowerCase().includes("disabled"),
      `status=${res.status} snippet=${text.slice(0, 140)}`,
    );
  }

  if (e2eEmail && e2ePassword) {
    const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: e2eEmail, password: e2ePassword }),
    });
    const signInBody = await signInRes.json().catch(() => ({}));
    const token = signInBody.access_token;
    if (!token) {
      record("auth_existing_user_signin", false, signInBody.error_description ?? "no access_token");
      record("rpc_provision_public_trial_authed_blocked", false, "SKIPPED — sign-in failed");
      record("auth_existing_user_has_workspace", false, "SKIPPED — sign-in failed");
      record("edge_public_trial_provision_authed_403", false, "SKIPPED — sign-in failed");
    } else {
      record("auth_existing_user_signin", true, "signed in as configured E2E user");

      const provRes = await fetch(`${url}/rest/v1/rpc/provision_public_trial`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_firm_name: "Should Fail",
          p_firm_slug: "should-fail",
          p_owner_full_name: "Should Fail",
        }),
      });
      const provText = await provRes.text();
      record(
        "rpc_provision_public_trial_authed_blocked",
        provRes.status === 403 ||
          provRes.status === 401 ||
          provText.toLowerCase().includes("disabled") ||
          provText.includes("42501"),
        `status=${provRes.status} snippet=${provText.slice(0, 160)}`,
      );

      const ctxRes = await fetch(`${url}/rest/v1/rpc/get_authorization_context`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: "{}",
      });
      const ctxText = await ctxRes.text();
      let workspaces = 0;
      let ctxOk = ctxRes.status === 200;
      try {
        const ctx = JSON.parse(ctxText);
        if (Array.isArray(ctx)) {
          workspaces = ctx.length > 0 ? 1 : 0;
        } else if (ctx && typeof ctx === "object") {
          workspaces = Array.isArray(ctx.workspaces) ? ctx.workspaces.length : 0;
        }
      } catch {
        ctxOk = false;
      }
      if (!ctxOk || workspaces === 0) {
        const memRes = await fetch(`${url}/rest/v1/rpc/get_my_memberships`, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        const memText = await memRes.text();
        try {
          const mem = JSON.parse(memText);
          if (Array.isArray(mem) && mem.length > 0) {
            workspaces = mem.filter((m) => m?.is_active !== false).length || mem.length;
            ctxOk = memRes.status === 200;
          }
        } catch {
          /* ignore */
        }
      }
      record(
        "auth_existing_user_has_workspace",
        ctxOk && workspaces > 0,
        `status=${ctxRes.status} workspaces=${workspaces}`,
      );

      const edgeAuthed = await fetch(`${url}/functions/v1/public-trial-provision`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firmName: "X", firmSlug: "x", ownerName: "X" }),
      });
      const edgeText = await edgeAuthed.text();
      record(
        "edge_public_trial_provision_authed_403",
        edgeAuthed.status === 403 && edgeText.includes("PUBLIC_SIGNUP_DISABLED"),
        `status=${edgeAuthed.status}`,
      );
    }
  } else {
    record("auth_existing_user_signin", false, "SKIPPED — set E2E_EMAIL/E2E_PASSWORD");
    record("rpc_provision_public_trial_authed_blocked", false, "SKIPPED — no E2E creds");
    record("auth_existing_user_has_workspace", false, "SKIPPED — no E2E creds");
    record("edge_public_trial_provision_authed_403", false, "SKIPPED — no E2E creds");
  }

  {
    const inviteSrc = fs.readFileSync("src/routes/invite.accept.tsx", "utf8");
    const edgeSrc = fs.readFileSync("supabase/functions/invite-accept/index.ts", "utf8");
    record(
      "invite_google_oauth_and_rate_limit_wired",
      inviteSrc.includes("accept_oauth") &&
        inviteSrc.includes("signInWithGoogle") &&
        edgeSrc.includes("accept_oauth") &&
        edgeSrc.includes("check_invite_accept_rate_limit"),
      "invite accept OAuth + rate limit present",
    );
  }

  {
    const signupRes = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `probe-signup-${Date.now()}@example.invalid`,
        password: "ProbeSignupPolicy1!",
      }),
    });
    const signupText = await signupRes.text();
    const lower = signupText.toLowerCase();
    const disabled =
      signupRes.status === 403 ||
      signupRes.status === 422 ||
      signupRes.status === 400 ||
      (lower.includes("signup") &&
        (lower.includes("disabled") ||
          lower.includes("not allowed") ||
          lower.includes("signups not allowed")));
    record(
      "auth_provider_public_signup_disabled",
      disabled,
      disabled
        ? `signup rejected status=${signupRes.status}`
        : `WARNING status=${signupRes.status} body=${signupText.slice(0, 120)}`,
    );
  }

  const failed = checks.filter((c) => !c.pass && !String(c.detail).startsWith("SKIPPED"));
  console.log("\n--- Summary ---");
  console.log(`Total: ${checks.length} | Failed: ${failed.length}`);

  fs.writeFileSync(
    path.resolve("_reconstruction/SIGNUP_POLICY_VERIFICATION.json"),
    JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
    "utf8",
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("invitation-only signup policy", () => {
  it("trial.start redirects to request-access without signUp", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/trial.start.tsx"), "utf8");
    expect(src).toContain("Navigate");
    expect(src).toContain("REQUEST_ACCESS_PATH");
    expect(src).not.toMatch(/auth\.signUp|\.signUp\(/);
    expect(src).not.toContain("provision_public_trial");
  });

  it("request-access route exists with invitation CTAs", () => {
    const path = resolve(ROOT, "src/routes/request-access.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf8");
    expect(src).toContain("/invite/accept");
    expect(src).toContain("/login");
    expect(src).toContain("/contact");
    expect(src).not.toContain("signUp");
  });

  it("portal auth routing never sends users to trial signup", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/identity/portal-auth-routing.ts"), "utf8");
    expect(src).toContain('/request-access"');
    expect(src).not.toContain('/trial/start"');
  });

  it("auth-gate does not navigate orphan sessions to trial signup", () => {
    const src = readFileSync(resolve(ROOT, "src/components/auth-gate.tsx"), "utf8");
    expect(src).toContain("/request-access");
    expect(src).not.toMatch(/Navigate to="\/trial\/start"/);
  });

  it("public-trial-provision edge function returns 403", () => {
    const src = readFileSync(
      resolve(ROOT, "supabase/functions/public-trial-provision/index.ts"),
      "utf8",
    );
    expect(src).toContain("403");
    expect(src).toContain("PUBLIC_SIGNUP_DISABLED");
    expect(src).not.toContain("provision_public_trial");
  });

  it("migration blocks provision_public_trial for authenticated users", () => {
    const mig = readFileSync(
      resolve(ROOT, "supabase/migrations/20260830220000_disable_public_trial_signup.sql"),
      "utf8",
    );
    expect(mig).toContain("Public self-signup is disabled");
    expect(mig).toContain("revoke all on function public.provision_public_trial");
    expect(mig).toContain("check_invite_accept_rate_limit");
  });

  it("marketing defaults disable free_trial_cta", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/website/defaults.ts"), "utf8");
    expect(src).toContain("free_trial_cta: false");
  });

  it("login page promotes request access not trial", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/login.tsx"), "utf8");
    expect(src).toContain("REQUEST_ACCESS_PATH");
    expect(src).not.toContain("Start 14-Day");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("OAuth callback chain (static audit)", () => {
  it("auth callback route waits for PKCE session before redirect", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/auth.callback.tsx"), "utf8");
    expect(src).toContain("onAuthStateChange");
    expect(src).toContain("getSession");
    expect(src).toContain("exchangeCodeForSession");
    expect(src).toContain("hasCode ? 12_000 : 4_000");
  });

  it("Google OAuth uses canonical redirect URL helper", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/auth/google-oauth.ts"), "utf8");
    expect(src).toContain("getAuthRedirectUrl");
    expect(src).toContain("signInWithOAuth");
  });

  it("auth callback resolves tenant workspace after session", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/auth.callback.tsx"), "utf8");
    expect(src).toContain("useAuthorizationContext.getState().resolve()");
    expect(src).toContain("pickDefaultRoute");
  });

  it("portal OAuth return path is preserved", () => {
    const src = readFileSync(resolve(ROOT, "src/routes/auth.callback.tsx"), "utf8");
    expect(src).toContain("consumePortalAuthReturn");
    expect(src).toContain("customer-portal");
  });

  it("auth callback route is registered in app surface allowlist", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/app-surface.ts"), "utf8");
    expect(src).toContain('"/auth/callback"');
  });

  it("invite OAuth stashes context to avoid PKCE code param collision", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/auth/invite-oauth-state.ts"), "utf8");
    expect(src).toContain("stashInviteOAuthContext");
    expect(src).toContain('params.get("invite")');
    const invitePage = readFileSync(resolve(ROOT, "src/routes/invite.accept.tsx"), "utf8");
    expect(invitePage).toContain("stashInviteOAuthContext");
    expect(invitePage).toContain("inviteAcceptPath");
  });

  it("auth-gate excludes callback from boot gate loops", () => {
    const path = resolve(ROOT, "src/components/auth-gate.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf8");
    expect(src).toContain("/auth/callback");
  });
});

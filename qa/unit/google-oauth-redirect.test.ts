/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, afterEach } from "vitest";
import {
  PRODUCTION_GOOGLE_OAUTH_CALLBACK,
  SUPABASE_GOOGLE_PROVIDER_CALLBACK,
  resolveGoogleOAuthRedirectTo,
} from "@/lib/auth/google-oauth";

describe("google-oauth redirect URLs", () => {
  afterEach(() => {
    // happy-dom resets between tests; no restore required
  });

  function stubHost(hostname: string, origin: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        hostname,
        origin,
        href: `${origin}/login`,
        protocol: origin.startsWith("https") ? "https:" : "http:",
        host: hostname.includes(":") ? hostname : `${hostname}`,
        pathname: "/login",
        search: "",
        hash: "",
      },
    });
  }

  it("locks production callback on maatarajewellers.shop", () => {
    stubHost("maatarajewellers.shop", "https://maatarajewellers.shop");
    expect(resolveGoogleOAuthRedirectTo("/auth/callback")).toBe(PRODUCTION_GOOGLE_OAUTH_CALLBACK);
  });

  it("locks www production host to apex callback", () => {
    stubHost("www.maatarajewellers.shop", "https://www.maatarajewellers.shop");
    expect(resolveGoogleOAuthRedirectTo()).toBe(PRODUCTION_GOOGLE_OAUTH_CALLBACK);
  });

  it("documents exact Supabase Google provider callback", () => {
    expect(SUPABASE_GOOGLE_PROVIDER_CALLBACK).toBe(
      "https://dqgrrafuoxaorvyrcuuh.supabase.co/auth/v1/callback",
    );
  });

  it("uses current origin on localhost for local testing", () => {
    stubHost("localhost", "http://localhost:3000");
    expect(resolveGoogleOAuthRedirectTo("/auth/callback")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });
});

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getProductionPublicOrigin, isLocalOrDevOrigin } from "@/lib/public-origin";

export type GoogleOAuthOptions = {
  /** Path after auth callback, e.g. `/invite/accept?code=...` */
  redirectPath?: string;
};

/** Exact production callback URL (Supabase Redirect URLs allowlist). */
export const PRODUCTION_GOOGLE_OAUTH_CALLBACK = "https://maatarajewellers.shop/auth/callback";

/** Supabase Auth Google provider callback (Authorized redirect URI in Google Cloud). */
export const SUPABASE_GOOGLE_PROVIDER_CALLBACK =
  "https://dqgrrafuoxaorvyrcuuh.supabase.co/auth/v1/callback";

/** True when Google OAuth is explicitly enabled for this build (staging/production config). */
export function isGoogleOAuthEnabled(): boolean {
  const flag = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED;
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Staging builds enable the button by default; production stays off until configured.
  return import.meta.env.VITE_APP_ENV === "staging";
}

/**
 * Canonical redirectTo for Google OAuth.
 * On the live production host always use the locked Site URL callback so Supabase
 * allowlists never mismatch. Elsewhere prefer current origin (local/staging).
 */
export function resolveGoogleOAuthRedirectTo(redirectPath = "/auth/callback"): string {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "maatarajewellers.shop" || host === "www.maatarajewellers.shop") {
      return `https://maatarajewellers.shop${path === "/auth/callback" ? "/auth/callback" : path}`;
    }
    const origin = window.location.origin;
    if (!isLocalOrDevOrigin(origin) || import.meta.env.DEV) {
      return `${origin}${path}`;
    }
  }
  return `${getProductionPublicOrigin()}${path}`;
}

/**
 * Start Supabase Google OAuth.
 * Uses resolveGoogleOAuthRedirectTo so production never sends a localhost/mismatched redirect.
 */
export async function signInWithGoogle(options: GoogleOAuthOptions = {}): Promise<{
  ok: boolean;
  error?: string;
  /** Present when ok — caller should navigate (keeps "Redirecting to Google…" UI visible). */
  url?: string;
}> {
  const redirectTo = resolveGoogleOAuthRedirectTo(options.redirectPath ?? "/auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        // Force account chooser so returning users aren't silently stuck on wrong Google identity.
        prompt: "select_account",
      },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.url) {
    return {
      ok: false,
      error: "Google sign-in did not return a redirect URL. Check provider config.",
    };
  }
  return { ok: true, url: data.url };
}

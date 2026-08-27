import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type GoogleOAuthOptions = {
  /** Path after auth callback, e.g. `/invite/accept?code=...` */
  redirectPath?: string;
};

/** True when Google OAuth is explicitly enabled for this build (staging/production config). */
export function isGoogleOAuthEnabled(): boolean {
  const flag = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED;
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Staging builds enable the button by default; production stays off until configured.
  return import.meta.env.VITE_APP_ENV === "staging";
}

/**
 * Start Supabase Google OAuth.
 * Uses the *current* browser origin for redirectTo so OAuth never lands on a
 * mismatched host (which produced Hostinger/SPA 404s when VITE_PUBLIC_APP_URL
 * disagreed with the live site). Email magic-links still use getAuthRedirectUrl.
 */
export async function signInWithGoogle(options: GoogleOAuthOptions = {}): Promise<{
  ok: boolean;
  error?: string;
  /** Present when ok — caller should navigate (keeps "Redirecting to Google…" UI visible). */
  url?: string;
}> {
  const path = options.redirectPath ?? "/auth/callback";
  const redirectTo = `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
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

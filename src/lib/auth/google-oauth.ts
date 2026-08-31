import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";

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

/** Start Supabase Google OAuth (configured in Supabase Dashboard → Authentication → Providers). */
export async function signInWithGoogle(options: GoogleOAuthOptions = {}): Promise<{
  ok: boolean;
  error?: string;
}> {
  const redirectTo = getAuthRedirectUrl(options.redirectPath ?? "/auth/callback");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

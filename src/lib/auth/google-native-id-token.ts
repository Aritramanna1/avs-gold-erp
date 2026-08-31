/**
 * Native Google ID-token via Capgo Social Login (Android Credential Manager).
 *
 * Required Google Cloud clients (two different IDs):
 * 1. **Web application** OAuth client â†’ `VITE_GOOGLE_WEB_CLIENT_ID` (serverClientId / token audience)
 * 2. **Android** OAuth client (package `in.arivahly.ornexa` + SHA-1) â†’ `VITE_GOOGLE_ANDROID_CLIENT_ID`
 *
 * Flow: Credential Manager account chooser â†’ ID token â†’
 * `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
 *
 * Never use Capgo's web OAuth implementation inside the APK.
 */
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";

function trimId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

export function resolveGoogleAndroidClientId(): string | null {
  return trimId(import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID);
}

/**
 * Web/server OAuth Client ID for Credential Manager.
 * Rejects empty values and rejects using the Android package client by mistake.
 */
export function resolveGoogleWebClientId(): string | null {
  const web = trimId(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID);
  if (!web) return null;
  const android = resolveGoogleAndroidClientId();
  if (android && web === android) {
    console.error(
      "[google-auth] VITE_GOOGLE_WEB_CLIENT_ID matches the Android installed client. " +
        "Credential Manager requires a separate Web application Client ID as serverClientId.",
    );
    return null;
  }
  return web;
}

export function isNativeGoogleSignInConfigured(): boolean {
  return resolveGoogleWebClientId() !== null;
}

function assertNativeSocialLoginPlugin(): void {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") {
    throw new Error(`Native Google Sign-In requires Android/iOS (platform=${platform}).`);
  }
  if ((Capacitor as any).isPluginAvailable?.("SocialLogin") !== true) {
    throw new Error("SocialLogin native plugin is not available in this build.");
  }
  // Capgo web implementation uses browser OAuth — refuse it inside the APK.
  if (Capacitor.getPlatform() === "web") {
    throw new Error("Refusing Capgo web Google OAuth inside the native shell.");
  }
}

export async function obtainGoogleIdToken(webClientId: string): Promise<string> {
  assertNativeSocialLoginPlugin();

  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: "online",
      // Do NOT set redirectUrl â€” that is for web OAuth only.
    },
  });

  // Do not pass a custom `scopes` array unless MainActivity implements Capgo's
  // ModifiedMainActivityForSocialLoginPlugin (we do). Prefer bottom-sheet account chooser.
  const res = await SocialLogin.login({
    provider: "google",
    options: {
      style: "bottom",
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
      forcePrompt: true,
    },
  });

  const idToken =
    (res as { result?: { idToken?: string }; idToken?: string })?.result?.idToken ||
    (res as { idToken?: string })?.idToken ||
    null;

  if (!idToken) {
    throw new Error("Google did not return an ID token. Check Web Client ID and Android SHA-1.");
  }
  return idToken;
}


/**
 * Meta Embedded Signup — FB SDK loader + OAuth code handoff to edge function.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: { authResponse?: { code?: string }; status?: string }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;

function getMetaAppId(): string {
  return String(import.meta.env.VITE_META_APP_ID ?? "").trim();
}

export function loadMetaSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const appId = getMetaAppId();
    if (!appId) {
      reject(new Error("VITE_META_APP_ID is not configured."));
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
      resolve();
    };

    if (document.getElementById("facebook-jssdk")) {
      const check = setInterval(() => {
        if (window.FB) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Meta SDK"));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export async function launchMetaEmbeddedSignup(opts: {
  connectionId: string;
  branchId: string;
}): Promise<{ ok: boolean; error?: string; wabaId?: string | null }> {
  const appId = getMetaAppId();
  if (!appId) return { ok: false, error: "Meta App ID not configured (VITE_META_APP_ID)." };

  await loadMetaSdk();
  if (!window.FB) return { ok: false, error: "Meta SDK failed to initialize." };

  const redirectUri = `${window.location.origin}/settings/communications/meta-callback`;

  const code = await new Promise<string | null>((resolve) => {
    window.FB!.login(
      (response) => {
        if (response.status === "connected" && response.authResponse?.code) {
          resolve(response.authResponse.code);
        } else {
          resolve(null);
        }
      },
      {
        config_id: import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID ?? undefined,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} },
        redirect_uri: redirectUri,
      },
    );
  });

  if (!code) return { ok: false, error: "Meta signup was cancelled or did not return a code." };

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!url || !token) return { ok: false, error: "Sign in required." };

  const res = await fetch(`${url}/functions/v1/meta-whatsapp-signup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      redirectUri,
      connectionId: opts.connectionId,
      branchId: opts.branchId,
    }),
  });

  const body = (await res.json()) as {
    ok?: boolean;
    error?: string;
    wabaId?: string;
    phoneNumberId?: string;
    displayPhone?: string;
  };
  if (!res.ok) return { ok: false, error: body.error ?? `Signup failed (${res.status})` };
  return { ok: true, wabaId: body.wabaId ?? null };
}

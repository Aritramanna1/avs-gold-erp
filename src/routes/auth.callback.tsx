import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { fetchAuthorizationContext } from "@/lib/identity/authorization-context-service";
import { pickDefaultRoute } from "@/lib/identity/route-access";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Secure Login Redirect · AVS Gold ERP" }] }),
  component: AuthCallbackPage,
});

/**
 * Post-OAuth destination.
 * Never send authenticated users to `/` (marketing can 404 / bypass AuthGate).
 * Prefer: recovery/invite → explicit flows; else auth-context default (platform/portal/ERP).
 */
async function resolvePostAuthDestination(input: {
  type: string | null;
  sessionTokenType: string | null;
}): Promise<{ path: string; platformSearch?: boolean }> {
  if (input.type === "recovery" || input.sessionTokenType === "recovery") {
    return { path: "/reset-password" };
  }
  if (
    input.type === "signup" ||
    input.type === "invite" ||
    input.sessionTokenType === "signup" ||
    input.sessionTokenType === "invite"
  ) {
    return { path: "/invite/accept" };
  }

  // Optional deep-link: /auth/callback?next=/orders (must be same-origin path)
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/") {
    return { path: next };
  }

  try {
    const ctx = await fetchAuthorizationContext();
    if (ctx) {
      const route = pickDefaultRoute(ctx);
      if (route.startsWith("/platform")) {
        return { path: "/platform", platformSearch: true };
      }
      // MTG / MTJ edition: land directly on simplified shell (not /app then bounce).
      if (route === "/app" || route === "/mtg" || !route || route === "/") {
        try {
          const { data: ent } = await supabase.rpc("get_my_tenant_entitlements");
          const payload = (ent ?? {}) as Record<string, unknown>;
          const features = (payload.features ?? {}) as Record<string, unknown>;
          const editionFamily =
            (payload.edition_family as string | null) ??
            ((payload.plan as Record<string, unknown> | null)?.edition_family as string | null) ??
            null;
          const isMtg =
            payload.is_mtg === true || editionFamily === "mtg" || features["edition.mtg"] === true;
          if (isMtg) {
            return { path: "/mtg" };
          }
        } catch (entErr) {
          console.warn("[AuthCallback] entitlements unavailable for MTG land:", entErr);
        }
      }
      if (route && route !== "/") {
        return { path: route };
      }
    }
  } catch (err) {
    console.warn("[AuthCallback] authorization context unavailable; falling back to /app", err);
  }

  return { path: "/app" };
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [msg, setMsg] = useState("Completing secure sign-in…");

  useEffect(() => {
    let active = true;

    async function handleAuth() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = window.location.hash
          ? new URLSearchParams(window.location.hash.substring(1))
          : null;

        const type = searchParams.get("type") ?? hashParams?.get("type") ?? null;
        const errorCode = searchParams.get("error_code") ?? hashParams?.get("error_code");
        const errorDesc =
          searchParams.get("error_description") ?? hashParams?.get("error_description");
        const oauthError = searchParams.get("error") ?? hashParams?.get("error");

        if (errorCode || errorDesc || oauthError) {
          if (active) {
            setStatus("error");
            setMsg(
              errorDesc ||
                oauthError ||
                "Google sign-in was cancelled or rejected. You can try again from the login page.",
            );
          }
          return;
        }

        // PKCE / code flow — exchange before reading session (detectSessionInUrl may race).
        const code = searchParams.get("code");
        if (code) {
          setMsg("Verifying Google credentials…");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Brief retry — session can lag one tick after hash/implicit or detectSessionInUrl.
        let session = (await supabase.auth.getSession()).data.session;
        if (!session) {
          await new Promise((r) => setTimeout(r, 250));
          session = (await supabase.auth.getSession()).data.session;
        }

        if (!active) return;

        if (session) {
          setStatus("success");

          let sessionTokenType: string | null = null;
          if (session.access_token) {
            try {
              const tokenParts = session.access_token.split(".");
              if (tokenParts.length === 3) {
                const base64Url = tokenParts[1];
                const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                const jsonPayload = decodeURIComponent(
                  window
                    .atob(base64)
                    .split("")
                    .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                    .join(""),
                );
                const decoded = JSON.parse(jsonPayload);
                if (decoded?.type) sessionTokenType = decoded.type;
              }
            } catch (jwtErr) {
              console.error("[AuthCallback] Error decoding session token JWT:", jwtErr);
            }
          }

          setMsg("Signed in. Loading your workspace…");
          const dest = await resolvePostAuthDestination({ type, sessionTokenType });
          if (!active) return;

          if (dest.platformSearch) {
            void navigate({
              to: "/platform",
              search: DEFAULT_PLATFORM_SEARCH,
              replace: true,
            });
          } else {
            void navigate({ to: dest.path as "/", replace: true });
          }
        } else {
          setStatus("error");
          setMsg(
            "No session was established after Google redirect. Confirm Site URL and Redirect URLs in Supabase Auth include https://maatarajewellers.shop/auth/callback, then try again.",
          );
        }
      } catch (err: unknown) {
        console.error("[AuthCallback] Error occurred during redirect processing:", err);
        if (active) {
          setStatus("error");
          const message = err instanceof Error ? err.message : String(err);
          setMsg(
            message ||
              "Authentication failed after Google redirect. Please return to login and try again.",
          );
        }
      }
    }

    void handleAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-6 space-y-4 text-center">
        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />
            <h1 className="font-serif text-lg text-gold">AVS Security Gateway</h1>
            <p className="text-xs text-muted-foreground">{msg}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <h1 className="font-serif text-lg text-emerald-400">Authenticated</h1>
            <p className="text-xs text-muted-foreground">{msg}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
            <h1 className="font-serif text-lg text-red-400">Sign-in failed</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{msg}</p>
            <div className="pt-2">
              <a href="/login" className="inline-block w-full">
                <button
                  type="button"
                  className="w-full inline-flex justify-center items-center rounded-lg bg-primary text-primary-foreground py-2 px-4 text-sm font-medium hover:opacity-90 min-h-[var(--touch-target)]"
                >
                  Return to login
                </button>
              </a>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

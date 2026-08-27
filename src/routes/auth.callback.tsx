import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Secure Login Redirect · AVS Gold ERP" }] }),
  component: AuthCallbackPage,
});

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

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
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

          // Never send authenticated users to `/` — marketing home can throw 404 when
          // homepage flag is off, and `/` bypasses AuthGate (public marketing path).
          if (type === "recovery" || sessionTokenType === "recovery") {
            setMsg("Recovery session identified. Opening password reset…");
            void navigate({ to: "/reset-password", replace: true });
          } else if (
            type === "signup" ||
            type === "invite" ||
            sessionTokenType === "signup" ||
            sessionTokenType === "invite"
          ) {
            setMsg("Invitation authenticated. Opening invite acceptance…");
            void navigate({ to: "/invite/accept", replace: true });
          } else {
            setMsg("Signed in. Loading your workspace…");
            void navigate({ to: "/app", replace: true });
          }
        } else {
          setStatus("error");
          setMsg(
            "No session was established after Google redirect. Confirm the callback URL is allowed in Supabase Auth settings, then try again.",
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

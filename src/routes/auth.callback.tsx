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
  const [msg, setMsg] = useState("Completing secure sign in...");

  useEffect(() => {
    let active = true;

    async function handleAuth() {
      try {
        // Parse URL parameters from both search and hash robustly
        const searchParams = new URLSearchParams(window.location.search);
        let type = searchParams.get("type");
        let errorCode = searchParams.get("error_code");
        let errorDesc = searchParams.get("error_description");

        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (!type) type = hashParams.get("type");
          if (!errorCode) errorCode = hashParams.get("error_code");
          if (!errorDesc) errorDesc = hashParams.get("error_description");
        }

        if (errorCode || errorDesc) {
          if (active) {
            setStatus("error");
            setMsg(
              errorDesc || "The verification link is either invalid, already expired, or used.",
            );
          }
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!active) return;

        if (session) {
          setStatus("success");

          // Inspect type claim inside Supabase session token JWT
          let sessionTokenType: string | null = null;
          if (session.access_token) {
            try {
              const tokenParts = session.access_token.split(".");
              if (tokenParts.length === 3) {
                // Decode base64url payload
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
                if (decoded && decoded.type) {
                  sessionTokenType = decoded.type;
                }
              }
            } catch (jwtErr) {
              console.error("[AuthCallback] Error decoding session token JWT:", jwtErr);
            }
          }

          // Force redirect to reset-password if recovery is detected in either the token payload or URL parameters
          if (type === "recovery" || sessionTokenType === "recovery") {
            setMsg("Recovery session identified. Redirecting to reset password page...");
            void navigate({ to: "/reset-password" });
          } else if (
            type === "signup" ||
            type === "invite" ||
            sessionTokenType === "signup" ||
            sessionTokenType === "invite"
          ) {
            setMsg("Invitation sign-in authenticated. Route to invite acceptance...");
            setTimeout(() => {
              void navigate({ to: "/invite/accept" });
            }, 1000);
          } else {
            setMsg("Secure connection verified! Loading dashboard...");
            setTimeout(() => {
              void navigate({ to: "/" });
            }, 1000);
          }
        } else {
          // If no session is logged but there's no error, check if it's a hash routing issue or if they just visited `/auth/callback` manually
          setTimeout(() => {
            if (active) {
              setMsg("No active login session detected. Redirecting to portal...");
              void navigate({ to: "/" });
            }
          }, 2000);
        }
      } catch (err: any) {
        console.error("[AuthCallback] Error occurred during redirect processing:", err);
        if (active) {
          setStatus("error");
          setMsg(
            err.message ||
              "An authentication network failure has occurred. Please request a new link.",
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
            <h1 className="font-serif text-lg text-gold">MTJ Security Gateway</h1>
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
            <h1 className="font-serif text-lg text-red-400">Verification Failure</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{msg}</p>
            <div className="pt-2">
              <a href="/" className="inline-block w-full">
                <button className="w-full inline-flex justify-center items-center rounded-lg bg-primary text-primary-foreground py-2 px-4 text-sm font-medium hover:opacity-90">
                  Return to portal
                </button>
              </a>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

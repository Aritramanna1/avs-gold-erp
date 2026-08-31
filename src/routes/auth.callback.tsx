import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { crossHostRedirectForPath, erpAppUrl } from "@/lib/public-origin";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import { pickDefaultRoute, workspaceHomeRoute } from "@/lib/identity/route-access";
import { consumePortalAuthReturn } from "@/components/portal/PortalLoginPage";
import { currentAppSurface } from "@/lib/app-surface";

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
    let unsubAuth: (() => void) | undefined;

    async function resolveSession(hasCode: boolean): Promise<Session | null> {
      const waitMs = hasCode ? 12_000 : 4_000;

      if (hasCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
      }

      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (initialSession) return initialSession;

      return new Promise<Session | null>((resolve) => {
        const timeout = window.setTimeout(() => {
          unsubAuth?.();
          resolve(null);
        }, waitMs);

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) return;
          window.clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(session);
        });
        unsubAuth = () => subscription.unsubscribe();
      });
    }

    async function redirectWithSession(session: Session, type: string | null) {
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
            const decoded = JSON.parse(jsonPayload) as { type?: string };
            if (decoded?.type) sessionTokenType = decoded.type;
          }
        } catch (jwtErr) {
          console.error("[AuthCallback] Error decoding session token JWT:", jwtErr);
        }
      }

      if (type === "recovery" || sessionTokenType === "recovery") {
        setMsg("Recovery session identified. Redirecting to reset password page...");
        void navigate({ to: "/reset-password" });
        return;
      }

      if (
        type === "signup" ||
        type === "invite" ||
        sessionTokenType === "signup" ||
        sessionTokenType === "invite"
      ) {
        setMsg("Invitation sign-in authenticated. Route to invite acceptance...");
        setTimeout(() => {
          void navigate({ to: "/invite/accept" });
        }, 1000);
        return;
      }

      setMsg("Secure connection verified! Loading your workspace...");
      setTimeout(async () => {
        const portalReturn = consumePortalAuthReturn();
        const params = new URLSearchParams(window.location.search);
        const portalRole = params.get("portal");
        if (currentAppSurface() === "portal" || portalReturn || portalRole) {
          const portalPath =
            portalReturn ??
            (portalRole === "karigar"
              ? "/karigar-portal"
              : portalRole === "supplier"
                ? "/supplier-portal"
                : "/customer-portal");
          void navigate({ to: portalPath as "/customer-portal", replace: true });
          return;
        }
        const ctx = await useAuthorizationContext.getState().resolve();
        let path = ctx ? pickDefaultRoute(ctx) : "/app";
        if (ctx?.active_workspace?.workspace_type) {
          const wsPath = workspaceHomeRoute(ctx.active_workspace.workspace_type);
          if (wsPath !== "/app") path = wsPath;
        }
        const dest = crossHostRedirectForPath(path) ?? erpAppUrl(path);
        if (dest.startsWith("http")) window.location.replace(dest);
        else void navigate({ to: path as "/" });
      }, 1000);
    }

    async function handleAuth() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        let type = searchParams.get("type");
        let errorCode = searchParams.get("error_code");
        let errorDesc = searchParams.get("error_description");
        const hasCode = !!searchParams.get("code");

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

        const session = await resolveSession(hasCode);
        if (!active) return;

        if (session) {
          await redirectWithSession(session, type);
          return;
        }

        setTimeout(() => {
          if (active) {
            setMsg("No active login session detected. Redirecting to portal...");
            void navigate({ to: "/" });
          }
        }, 2000);
      } catch (err: unknown) {
        console.error("[AuthCallback] Error occurred during redirect processing:", err);
        if (active) {
          setStatus("error");
          setMsg(
            err instanceof Error
              ? err.message
              : "An authentication network failure has occurred. Please request a new link.",
          );
        }
      }
    }

    void handleAuth();

    return () => {
      active = false;
      unsubAuth?.();
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

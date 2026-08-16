// Unified auth gate — one login, server-resolved authorization context, role-aware routing.
import { useEffect, useState, type ReactNode } from "react";
import { notFound, useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Session } from "@supabase/supabase-js";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";
import { resetAllBusinessStores } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { BootProgressShell } from "@/components/boot-progress-shell";
import { markStartup, recordStartupMetric } from "@/lib/performance/startup-metrics";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import {
  canAccessPath,
  isLegacyPortalLoginPath,
  isPublicAuthPath,
  pickDefaultRoute,
} from "@/lib/identity/route-access";

const startCloudSync = async () => (await import("@/lib/data-loader")).startCloudSync();
const stopCloudSync = () => {
  void import("@/lib/data-loader").then((loader) => loader.stopCloudSync());
};

let _bootstrappedUserId: string | null = null;

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <OnlineAuthGate>
      <RouteAuthBoundary>{children}</RouteAuthBoundary>
    </OnlineAuthGate>
  );
}

/** Blocks unauthorized routes with 404 — protection is RLS + RPC; this hides privileged URLs. */
function RouteAuthBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { context, ready } = useAuthorizationContext();

  if (!ready) return <>{children}</>;
  if (isPublicAuthPath(pathname) || isLegacyPortalLoginPath(pathname)) return <>{children}</>;
  if (!context) return <>{children}</>;

  if (!canAccessPath(context, pathname)) {
    throw notFound();
  }

  return <>{children}</>;
}

function OnlineAuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const authReady = useAuthorizationContext((s) => s.ready);
  const authLoading = useAuthorizationContext((s) => s.loading);
  const authContext = useAuthorizationContext((s) => s.context);
  const authError = useAuthorizationContext((s) => s.error);
  const resolveAuth = useAuthorizationContext((s) => s.resolve);
  const resetAuth = useAuthorizationContext((s) => s.reset);

  useEffect(() => {
    let mounted = true;
    markStartup("session_restore");

    const authTimeout = setTimeout(() => {
      if (!mounted) return;
      setChecking(false);
      recordStartupMetric("auth_check_done", "timeout-fallback", "session_restore");
    }, 12_000);

    async function bootstrapSession(s: Session | null, evt: string) {
      if (!mounted) return;

      if (!s?.user?.email) {
        if (evt === "SIGNED_OUT") {
          setSession(null);
          setBootError(null);
          setChecking(false);
          stopCloudSync();
          _bootstrappedUserId = null;
          resetAuth();
          void resetAllBusinessStores();
        } else {
          setSession(null);
          setBootError(null);
          setChecking(false);
        }
        return;
      }

      setSession(s);
      setBootError(null);
      setChecking(false);
      recordStartupMetric("auth_check_done", evt, "session_restore");

      if (_bootstrappedUserId === s.user.id && authReady) return;
      _bootstrappedUserId = s.user.id;

      let ctx = await resolveAuth();
      if (!mounted) return;

      if (
        ctx?.is_platform_owner &&
        pickDefaultRoute(ctx) === "/platform" &&
        ctx.active_workspace?.workspace_type !== "platform"
      ) {
        await supabase.rpc("set_platform_workspace" as never);
        ctx = (await resolveAuth()) ?? ctx;
      }

      if (!ctx || ctx.workspaces.length === 0) {
        setBootError("Your account has no authorized workspace. Contact your administrator.");
        await supabase.auth.signOut();
        setSession(null);
        resetAuth();
        _bootstrappedUserId = null;
        return;
      }

      const active = ctx.workspaces.find((w) => w.is_active);
      if (active?.role) {
        useSettings.getState().setCurrentUserRole(active.role);
      }

      const defaultRoute = pickDefaultRoute(ctx);
      const currentPath = window.location.pathname;
      const landingPaths = [
        "/app",
        "/login",
        "/saas-admin",
        "/platform",
        "/customer-login",
        "/supplier-login",
        "/karigar-login",
      ];
      if (landingPaths.includes(currentPath) || isLegacyPortalLoginPath(currentPath)) {
        if (defaultRoute.startsWith("/platform")) {
          void navigate({ to: "/platform", search: DEFAULT_PLATFORM_SEARCH, replace: true });
        } else {
          void navigate({ to: defaultRoute as "/", replace: true });
        }
      }

      const workspaceType = ctx.active_workspace?.workspace_type ?? active?.workspace_type;
      if (workspaceType === "erp" || workspaceType === "ceo") {
        void startCloudSync();
      }
    }

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      void bootstrapSession(initialSession, "INITIAL_SESSION");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!mounted) return;
      clearTimeout(authTimeout);
      void bootstrapSession(s, evt);
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate, resolveAuth, resetAuth]);

  if (checking) {
    return <BootProgressShell title="Restoring your session" />;
  }

  if (!session) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    return <Navigate to="/login" search={{ redirect, error: "" }} replace />;
  }

  if (!authReady || authLoading) {
    return <BootProgressShell title="Resolving your access" />;
  }

  if (authError && !authContext) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    return <Navigate to="/login" search={{ redirect, error: authError }} replace />;
  }

  return <>{children}</>;
}

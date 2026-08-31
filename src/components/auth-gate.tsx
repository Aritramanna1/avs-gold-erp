import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
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
  isCustomerPortalPath,
  isErpPath,
  isKarigarPortalPath,
  isLegacyPortalLoginPath,
  isPlatformPath,
  isPortalOnlyContext,
  isPortalPath,
  isPublicAuthPath,
  isSupplierPortalPath,
  pickDefaultRoute,
  portalOnlyHomeRoute,
} from "@/lib/identity/route-access";
import {
  hasPendingPortalInvite,
  loadActivePortalHome,
  resolvePortalOrTrialRoute,
} from "@/lib/identity/portal-auth-routing";
import { LegalAcceptanceGate } from "@/components/compliance/LegalAcceptanceGate";
import { CreatePasswordGate } from "@/components/auth/CreatePasswordGate";
import { OnboardingGate } from "@/components/identity/OnboardingGate";
import { isOnline } from "@/lib/native/network";
import { isCommercialPublicPath } from "@/lib/website/defaults";
import { markLeftPublicSite } from "@/lib/product-entry";
import { markLoginBootStart } from "@/lib/monitoring/supabase-egress-monitor";

const startCloudSync = async () => (await import("@/lib/data-loader")).startCloudSync();
const stopCloudSync = () => {
  void import("@/lib/data-loader").then((loader) => loader.stopCloudSync());
};

let _bootstrappedUserId: string | null = null;
let _lastWorkspaceRedirectKey: string | null = null;

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <OnlineAuthGate>
      <RouteAuthBoundary>{children}</RouteAuthBoundary>
    </OnlineAuthGate>
  );
}

function navigateToWorkspaceHome(
  navigate: ReturnType<typeof useNavigate>,
  home: string,
  currentPath: string,
) {
  const redirectKey = `${currentPath}->${home}`;
  if (_lastWorkspaceRedirectKey === redirectKey) return;

  if (home.startsWith("/platform")) {
    if (currentPath === "/platform" || currentPath.startsWith("/platform/")) return;
    _lastWorkspaceRedirectKey = redirectKey;
    void navigate({ to: "/platform", search: DEFAULT_PLATFORM_SEARCH, replace: true });
    return;
  }
  if (currentPath === home || (home === "/app" && (currentPath === "/app" || currentPath.startsWith("/app/")))) {
    return;
  }
  _lastWorkspaceRedirectKey = redirectKey;
  void navigate({ to: home as "/", replace: true });
}

/** Blocks unauthorized routes — wrong workspace redirects home instead of 404 trap. */
function RouteAuthBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const ready = useAuthorizationContext((s) => s.ready);
  const context = useAuthorizationContext((s) => s.context);
  // Primitive deps only — the whole `context` object identity churns on every
  // resolve() and was re-firing navigates (React #185 with commercial paths).
  const defaultRoute = context?.default_route ?? "";
  const isPlatformOwner = context?.is_platform_owner === true;
  const activeWorkspaceType = context?.active_workspace?.workspace_type ?? null;
  const allowed = context ? canAccessPath(context, pathname) : true;

  useEffect(() => {
    if (!ready) return;
    const ctx = useAuthorizationContext.getState().context;
    if (!ctx) return;
    if (isPublicAuthPath(pathname) || isLegacyPortalLoginPath(pathname)) return;

    const home = pickDefaultRoute(ctx);

    if (isCommercialPublicPath(pathname)) {
      navigateToWorkspaceHome(navigate, home, pathname);
      return;
    }

    if (ctx && isPortalOnlyContext(ctx)) {
      const portalHome = portalOnlyHomeRoute(ctx);
      if (portalHome && !isPortalPath(pathname) && pathname !== "/invite/accept") {
        navigateToWorkspaceHome(navigate, portalHome, pathname);
        return;
      }
    }

    if (allowed) return;

    const portalType = isKarigarPortalPath(pathname)
      ? "karigar"
      : isCustomerPortalPath(pathname)
        ? "customer"
        : isSupplierPortalPath(pathname)
          ? "supplier"
          : null;
    if (portalType) {
      const portalWorkspace = ctx.workspaces.find((w) => w.workspace_type === portalType);
      if (portalWorkspace) {
        void useAuthorizationContext
          .getState()
          .switchWorkspace(portalWorkspace)
          .catch(() => {
            navigateToWorkspaceHome(navigate, home, pathname);
          });
        return;
      }
    }

    // Platform owner hit a platform URL but active workspace is not platform yet.
    if (isPlatformOwner && pathname.startsWith("/platform") && activeWorkspaceType !== "platform") {
      void (async () => {
        try {
          await supabase.rpc("set_platform_workspace" as never);
          await useAuthorizationContext.getState().resolve();
        } catch {
          /* fall through to safe home */
        }
        const next = useAuthorizationContext.getState().context;
        if (next && canAccessPath(next, pathname)) return;
        navigateToWorkspaceHome(navigate, pickDefaultRoute(next ?? ctx), pathname);
      })();
      return;
    }

    navigateToWorkspaceHome(navigate, home, pathname);
  }, [ready, pathname, defaultRoute, isPlatformOwner, activeWorkspaceType, allowed]);

  if (!ready) return <>{children}</>;
  if (isPublicAuthPath(pathname) || isLegacyPortalLoginPath(pathname)) return <>{children}</>;
  if (!context) return <>{children}</>;
  if (isCommercialPublicPath(pathname)) {
    return <BootProgressShell title="Opening your workspace" />;
  }

  if (!allowed) {
    // Soft landing while redirect effect runs — never a permanent 404 trap.
    return <BootProgressShell title="Opening your workspace" />;
  }

  return <>{children}</>;
}

function OnlineAuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onAuthSurface =
    isPublicAuthPath(pathname) || isLegacyPortalLoginPath(pathname);
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [checking, setChecking] = useState(!onAuthSurface);

  const authReady = useAuthorizationContext((s) => s.ready);
  const authContext = useAuthorizationContext((s) => s.context);
  const authError = useAuthorizationContext((s) => s.error);
  const resolveAuth = useAuthorizationContext((s) => s.resolve);
  const resetAuth = useAuthorizationContext((s) => s.reset);

  useEffect(() => {
    let mounted = true;
    markStartup("session_restore");

    const authTimeoutMs = onAuthSurface ? 2_000 : 8_000;
    const authTimeout = setTimeout(() => {
      if (!mounted) return;
      setChecking(false);
      recordStartupMetric("auth_check_done", "timeout-fallback", "session_restore");
    }, authTimeoutMs);

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
      markLeftPublicSite();
      recordStartupMetric("auth_check_done", evt, "session_restore");

      if (_bootstrappedUserId === s.user.id && authReady) return;
      _bootstrappedUserId = s.user.id;
      if (evt === "SIGNED_IN" || evt === "INITIAL_SESSION") {
        markLoginBootStart();
      }

      let ctx = await resolveAuth();
      if (!mounted) return;

      if (ctx?.is_platform_owner) {
        if (isOnline() && ctx.active_workspace?.workspace_type !== "platform") {
          await supabase.rpc("set_platform_workspace" as never);
          ctx = (await resolveAuth()) ?? ctx;
        }
        const platformRole = ctx?.workspaces.find(
          (w) => w.workspace_type === "platform" || w.is_active,
        )?.role;
        if (platformRole) {
          useSettings.getState().setCurrentUserRole(platformRole);
        }
        const path = window.location.pathname;
        if (!isPlatformPath(path)) {
          void navigate({ to: "/platform", search: DEFAULT_PLATFORM_SEARCH, replace: true });
        }
        // Platform Owner skips ERP cloud sync; close the login boot measurement window.
        if (evt === "SIGNED_IN" || evt === "INITIAL_SESSION") {
          void import("@/lib/monitoring/supabase-egress-monitor").then((m) =>
            m.markLoginBootComplete(),
          );
        }
        return;
      }

      if (!ctx || ctx.workspaces.length === 0) {
        const path = window.location.pathname;
        const trialInProgress =
          path === "/request-access" ||
          path === "/trial/start" ||
          path === "/onboarding" ||
          path === "/setup";
        if (trialInProgress) {
          return;
        }
        // Let invite accept finish password/Google provisioning before routing.
        if (path === "/invite/accept" || path.startsWith("/invite/")) {
          return;
        }

        const portalHome = await loadActivePortalHome(s.user.id);
        if (portalHome) {
          ctx = (await resolveAuth()) ?? ctx;
          if (ctx && ctx.workspaces.length > 0) {
            // Membership resolved — continue normal bootstrap below.
          } else {
            void navigate({ to: portalHome as "/", replace: true });
            return;
          }
        } else if (await hasPendingPortalInvite(s.user.email ?? "")) {
          if (path !== "/invite/accept") {
            void navigate({ to: "/invite/accept", replace: true });
          }
          return;
        } else {
          const next = await resolvePortalOrTrialRoute(s.user.id, s.user.email ?? "");
          void navigate({ to: next.route as "/", replace: true });
          return;
        }
      }

      if (!ctx) return;

      if (isPortalOnlyContext(ctx)) {
        const portalHome = portalOnlyHomeRoute(ctx);
        const currentPath = window.location.pathname;
        if (
          portalHome &&
          (currentPath === "/request-access" ||
            currentPath === "/trial/start" ||
            currentPath === "/onboarding" ||
            currentPath === "/setup" ||
            isErpPath(currentPath) ||
            currentPath === "/app" ||
            currentPath === "/")
        ) {
          if (currentPath !== portalHome) {
            void navigate({ to: portalHome as "/", replace: true });
          }
          return;
        }
      }

      const active = ctx.workspaces.find((w) => w.is_active);
      if (active?.role) {
        useSettings.getState().setCurrentUserRole(active.role);
      }

      const defaultRoute = pickDefaultRoute(ctx);
      const currentPath = window.location.pathname;
      const landingPaths = [
        "/",
        "/app",
        "/login",
        "/auth/callback",
        "/saas-admin",
        "/platform",
        "/customer-login",
        "/supplier-login",
        "/karigar-login",
      ];
      if (landingPaths.includes(currentPath) || isLegacyPortalLoginPath(currentPath)) {
        if (defaultRoute.startsWith("/platform")) {
          if (!(currentPath === "/platform" || currentPath.startsWith("/platform/"))) {
            void navigate({ to: "/platform", search: DEFAULT_PLATFORM_SEARCH, replace: true });
          }
        } else if (currentPath !== defaultRoute) {
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
      // Token refresh is high-frequency (~hourly) and must not re-run full
      // authorization + data-loader boot (was a major Auth/API request storm).
      if (evt === "TOKEN_REFRESHED" || evt === "USER_UPDATED") return;
      void bootstrapSession(s, evt);
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate, onAuthSurface, resolveAuth, resetAuth]);

  if (checking && !onAuthSurface) {
    return <BootProgressShell title="Restoring your session" />;
  }

  if (!session) {
    if (onAuthSurface) {
      return <>{children}</>;
    }
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    return (
      <Navigate to="/login" search={{ redirect, error: bootError ?? "", audience: undefined }} replace />
    );
  }

  if (!authReady) {
    return <BootProgressShell title="Resolving your access" />;
  }

  if (!authContext) {
    if (authError) {
      return (
        <BootProgressShell
          title="Could not restore your workshop"
          failed
          errorMessage="Check your connection, then retry."
          onRetry={() => {
            void resolveAuth();
          }}
        />
      );
    }
    return (
      <PortalOrTrialRedirect session={session} resolveAuth={resolveAuth} />
    );
  }

  return (
    <LegalAcceptanceGate>
      <CreatePasswordGate>
        <OnboardingGate>{children}</OnboardingGate>
      </CreatePasswordGate>
    </LegalAcceptanceGate>
  );
}

/** Authenticated users without a workspace — invite or request access only (no self-signup). */
function PortalOrTrialRedirect({
  session,
  resolveAuth,
}: {
  session: Session;
  resolveAuth: () => Promise<import("@/lib/identity/authorization-types").AuthorizationContext | null>;
}) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const userId = session.user.id;
      const email = session.user.email ?? "";
      const next = await resolvePortalOrTrialRoute(userId, email);
      if (!mounted) return;
      if (next.kind === "access") {
        setTarget("/request-access");
        setChecking(false);
        return;
      }
      void navigate({ to: next.route as "/", replace: true });
    })();
    return () => {
      mounted = false;
    };
  }, [session.user.id, session.user.email, navigate, resolveAuth]);

  if (checking && !target) {
    return <BootProgressShell title="Opening your portal" />;
  }
  return <Navigate to={(target ?? "/request-access") as "/"} replace />;
}

// auth-gate v2 - module-level flag prevents repeated sync on HMR/multi-client auth events
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Session } from "@supabase/supabase-js";
import { resetAllBusinessStores } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppBootSkeleton } from "@/components/app-boot-skeleton";

const startCloudSync = async () => (await import("@/lib/data-loader")).startCloudSync();
const pullAll = async () => (await import("@/lib/data-loader")).pullAll();
const stopCloudSync = () => {
  void import("@/lib/data-loader").then((loader) => loader.stopCloudSync());
};

export function AuthGate({ children }: { children: ReactNode }) {
  return <OnlineAuthGate>{children}</OnlineAuthGate>;
}
// Module-level flag: persists across HMR remounts within the same browser session.
let _initialSyncDone = false;
// De-dupes concurrent auth-state events (Supabase fires both an explicit
// getSession() resolution and an "INITIAL_SESSION" onAuthStateChange event on
// every load, sometimes followed by a near-simultaneous TOKEN_REFRESHED/
// SIGNED_IN event) so the same account-lookup round trip to `app_settings`
// isn't fired 2-3x in parallel on every page load/reload.
let _checkInFlight: Promise<{ allowed: boolean; error?: string; role?: string }> | null = null;

function OnlineAuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  // Platform owners (saas_admin) never have — and never need — a tenant
  // user_profiles row. Their identity is resolved from the authoritative
  // user_roles table before any tenant check runs, so they can never fall
  // through to the tenant "no assigned ERP role" rejection or briefly render
  // a tenant screen while the redirect to /platform is still in flight.
  const [isPlatformOwner, setIsPlatformOwner] = useState<boolean | null>(null);

  async function checkPlatformOwner(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", userId);
    return ((data ?? []) as Array<{ role?: string }>).some(
      (row) => row.role === "saas_admin" || row.role === "SaaS Admin",
    );
  }

  useEffect(() => {
    if (!session || isPlatformOwner !== true) return;
    if (!pathname.startsWith("/platform")) void navigate({ to: "/platform", replace: true });
  }, [navigate, pathname, session, isPlatformOwner]);
  // Restoring a session from localStorage (as opposed to a fresh sign-in)
  // can legitimately take up to ~25s (see the account-lookup race below).
  // Without this, that entire window renders the same UI as "logged out" â€”
  // indistinguishable from an actual sign-out to a real user reopening the app.
  const [checking, setChecking] = useState(true);

  const checkUserAllowed = async (
    userEmail: string,
    currentSession: Session,
  ): Promise<{ allowed: boolean; error?: string; role?: string }> => {
    if (!userEmail) return { allowed: false, error: "Missing email address." };

    // The authoritative identity mapping is user_profiles.auth_id. The
    // legacy app_settings user directory remains only as a compatibility
    // fallback for older offline/pilot records.
    try {
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles" as never)
        .select("auth_id, full_name, status, active, role")
        .eq("auth_id", currentSession.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("[AuthGate] user_profiles lookup failed:", profileError);
      } else if (profile) {
        const p = profile as { active?: boolean; status?: string; role?: string | null };
        if (p.active === false || p.status === "suspended") {
          return { allowed: false, error: "Your account is deactivated. Contact admin." };
        }
        if (!p.role) {
          return { allowed: false, error: "Your account has no assigned ERP role. Contact admin." };
        }
        return { allowed: true, role: p.role };
      }
    } catch (err) {
      console.error("[AuthGate] user_profiles lookup threw:", err);
    }

    let users = useSettings.getState().users;
    let matched = users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());

    if (!matched) {
      // A transient network blip here must never be mistaken for "this
      // account doesn't exist" â€” that would forcibly sign out a fully
      // legitimate, already-authenticated user. Retry once before giving up.
      for (let attempt = 0; attempt < 2 && !matched; attempt++) {
        try {
          const { data, error } = await supabase
            .from("app_settings")
            .select("data")
            .eq("id", "firm")
            .maybeSingle();

          if (error) {
            console.error(
              `[AuthGate] Supabase app_settings fetch failed (attempt ${attempt + 1}):`,
              error,
            );
          } else if (data?.data) {
            const payload = data.data as any;
            if (payload.users && Array.isArray(payload.users)) {
              useSettings.setState({
                users: payload.users,
                firm: payload.firm ?? useSettings.getState().firm,
                branches: payload.branches ?? useSettings.getState().branches,
              });
              users = payload.users;
              matched = users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());
            }
            break; // query succeeded (even if no match found) â€” don't retry
          } else {
            break; // query succeeded with no data â€” don't retry
          }
        } catch (err) {
          console.error(
            `[AuthGate] Failed to dynamically sync app_settings (attempt ${attempt + 1}):`,
            err,
          );
        }
      }
    }

    if (!matched) {
      const newUser = {
        id: currentSession.user.id || `usr_${Date.now()}`,
        name: userEmail.split("@")[0] || "ERP Admin",
        email: userEmail,
        role: "Super Owner",
        active: true,
        createdAt: Date.now(),
        isSuperOwner: true,
      };
      useSettings.getState().addUser(newUser);
      return { allowed: true, role: "Super Owner" };
    }

    if (!matched.active) {
      return { allowed: true, role: matched.role || "Super Owner" };
    }

    if (!matched.role) {
      return { allowed: true, role: "Super Owner" };
    }

    return { allowed: true, role: matched.role };
  };

  useEffect(() => {
    let mounted = true;

    // Safety valve so a hung/slow auth check (e.g. autoRefreshToken retrying
    // a token refresh while offline at startup) doesn't leave the user
    // staring at an infinite loading state â€” falls through to the login
    // screen. Deliberately does NOT delete the persisted Supabase auth token:
    // a slow check isn't an invalid session, and wiping it here would force
    // a full re-login even once the network/refresh that was merely slow
    // eventually succeeds (this app must keep working once reconnected).
    const authTimeout = setTimeout(() => {
      if (!mounted) return;
      setSession(null);
      setBootError(null);
      setChecking(false);
    }, 25_000);

    const finalizeSession = async (s: Session | null, evt: string) => {
      if (!mounted || !s?.user?.email) {
        // INITIAL_SESSION may briefly carry a null session while Supabase
        // restores the persisted session during a page reload. Clearing all
        // business stores in that transient state races the real session
        // hydration and makes local-first records disappear after refresh.
        // Only an explicit sign-out is a data-boundary event.
        if (evt === "SIGNED_OUT") {
          setSession(null);
          setBootError(null);
          setChecking(false);
          stopCloudSync();
          _initialSyncDone = false;
          // Clears cached orders/invoices/ledger/customer data from memory
          // so it can't flash on screen for the next person who logs in on
          // this device before their own fresh pull completes.
          void resetAllBusinessStores();
        } else {
          // A null INITIAL_SESSION is still a valid signed-out state. Finish
          // the auth check without clearing durable/local-first business data;
          // Supabase may immediately follow it with the restored session.
          setSession(null);
          setBootError(null);
          setChecking(false);
        }
        return;
      }

      // Session is already Supabase-verified — render immediately instead of
      // blocking the whole app behind the authorization lookup below (that
      // lookup used to gate the boot skeleton for up to ~25s on a slow
      // network). RLS on the backend enforces access independently of this
      // client-side gate, so it's safe to run the authorization check in the
      // background and only kick the user out if it comes back denied.
      setSession(s);
      setBootError(null);
      setChecking(false);

      // Resolve platform-owner status before anything tenant-side: a
      // saas_admin has no tenant profile and must never hit the tenant
      // checkUserAllowed() gate below (which would reject/sign them out for
      // "no assigned ERP role") or render tenant children even momentarily.
      const platformOwner = await checkPlatformOwner(s.user.id);
      if (!mounted) return;
      setIsPlatformOwner(platformOwner);
      if (platformOwner) {
        _initialSyncDone = true;
        if (window.location.pathname !== "/platform")
          void navigate({ to: "/platform", replace: true });
        return;
      }

      const loggedInNow = useSettings
        .getState()
        .users.find((u) => u.email.toLowerCase() === s.user.email!.toLowerCase());
      useSettings.getState().setCurrentUserRole(loggedInNow?.role ?? null);

      if (_initialSyncDone) return;

      // Reuse an already-in-flight check instead of firing a duplicate
      // app_settings round trip when multiple auth events land close
      // together (INITIAL_SESSION + TOKEN_REFRESHED/SIGNED_IN, etc.).
      if (!_checkInFlight) {
        _checkInFlight = checkUserAllowed(s.user.email, s).finally(() => {
          _checkInFlight = null;
        });
      }
      const check = await _checkInFlight;
      if (!mounted) return;

      if (!check.allowed) {
        setBootError(check.error || "Account is not authorized.");
        setSession(null);
        return;
      }

      _initialSyncDone = true;
      // user_profiles is authoritative. The local app_settings directory is
      // only a compatibility fallback and may not contain newly onboarded
      // users, so never let it erase a valid backend role after login.
      const loggedIn = useSettings
        .getState()
        .users.find((u) => u.email.toLowerCase() === s.user.email!.toLowerCase());
      useSettings.getState().setCurrentUserRole(check.role ?? loggedIn?.role ?? null);
      useSettings.getState().addSecurityLog("login", `User signed in successfully`, s.user.email);
      void startCloudSync();
      void supabase.rpc("get_login_destination" as never).then(({ data }) => {
        const destination: string = typeof data === "string" ? data : "/";
        const currentPath = window.location.pathname;
        if (currentPath === "/" || currentPath === "/saas-admin" || currentPath === "/platform") {
          if (destination === "/customer-portal") {
            void navigate({ to: "/customer-portal", replace: true });
          } else if (destination === "/platform") {
            void navigate({ to: "/platform", replace: true });
          } else if (destination === "/retail" || destination === "/wholesale") {
            // Dedicated retail/wholesale dashboards are future routes. Keep
            // current tenants on the working home until those screens exist.
            void navigate({ to: "/", replace: true });
          }
        }
      });
    };

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      void finalizeSession(initialSession, "INITIAL_SESSION");
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, s) => {
      if (!mounted) return;
      clearTimeout(authTimeout);
      await finalizeSession(s, evt);
    });

    const unsubBranch = useSettings.subscribe((state, prev) => {
      // Only refetch on a REAL branch switch by the user. Skip the initial
      // "" â†’ default assignment that pullBranches makes during the first load â€”
      // otherwise it fires a second full pullAll() on top of the boot pull,
      // loading every table twice on every startup.
      if (prev.selectedBranchId && state.selectedBranchId !== prev.selectedBranchId) {
        void pullAll();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
      unsubBranch();
    };
  }, [navigate]);

  if (checking) {
    return <AppBootSkeleton />;
  }

  if (!session) {
    return <AuthLayout prefilledError={bootError} onClearError={() => setBootError(null)} />;
  }

  // Platform-owner status hasn't resolved yet — hold on the skeleton instead
  // of flashing tenant UI a saas_admin should never see, even briefly.
  const publicPaths = ["/auth/callback", "/forgot-password", "/reset-password", "/otp-login"];
  if (isPlatformOwner === null && !publicPaths.some((path) => pathname.startsWith(path))) {
    return <AppBootSkeleton />;
  }

  if (isPlatformOwner && !pathname.startsWith("/platform")) {
    return <AppBootSkeleton />;
  }

  return <>{children}</>;
}

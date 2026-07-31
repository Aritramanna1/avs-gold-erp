// auth-gate v2 — module-level flag prevents repeated sync on HMR/multi-client auth events
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Session } from "@supabase/supabase-js";
import { resetAllBusinessStores } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { LocalAuthLayout } from "@/components/layout/LocalAuthLayout";
import { useDeploymentMode, hydrateDeploymentMode } from "@/lib/deployment-mode";
import { getLocalSessionUser } from "@/lib/local-auth";
import { applyUserBranchAccess } from "@/lib/permissions";
import { SetupWizard } from "@/components/setup-wizard";
import { AppBootSkeleton } from "@/components/app-boot-skeleton";

// The data loader imports every operational store. Keep it out of the initial
// authentication bundle and load it only after a session has been established.
const startCloudSync = async () => (await import("@/lib/data-loader")).startCloudSync();
const startLocalLoad = async () => (await import("@/lib/data-loader")).startLocalLoad();
const pullAll = async () => (await import("@/lib/data-loader")).pullAll();
const stopCloudSync = () => {
  void import("@/lib/data-loader").then((loader) => loader.stopCloudSync());
};

/**
 * Deployment-mode switch: hydrates the persisted mode once at boot, shows the
 * first-run setup wizard if none has ever been chosen (fresh install), then
 * dispatches to OfflineAuthGate (no Supabase, ever) or OnlineAuthGate
 * (unchanged, today's exact Supabase-only flow — also what every pre-existing
 * install without a chosen mode falls back to).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const mode = useDeploymentMode((s) => s.mode);
  const hydrated = useDeploymentMode((s) => s.hydrated);

  useEffect(() => {
    // Never let a slow/failed local-DB init (deployment mode lives in local
    // SQLite) hang the whole app on the boot skeleton. If it rejects, or takes
    // too long, mark hydrated anyway so the app opens — a null mode falls
    // through to the setup wizard rather than an infinite loader.
    let settled = false;
    const settle = () => {
      settled = true;
    };
    void hydrateDeploymentMode()
      .then(settle)
      .catch((err) => {
        console.error("[AuthGate] deployment mode hydrate failed:", err);
        settle();
        if (!useDeploymentMode.getState().hydrated) {
          useDeploymentMode.setState({ hydrated: true });
        }
      });
    const valve = setTimeout(() => {
      if (!settled && !useDeploymentMode.getState().hydrated) {
        console.error("[AuthGate] deployment mode hydrate timed out — opening anyway");
        useDeploymentMode.setState({ hydrated: true });
      }
    }, 12_000);
    return () => clearTimeout(valve);
  }, []);

  if (!hydrated) {
    return <AppBootSkeleton />;
  }

  if (!mode) {
    return <SetupWizard onComplete={() => void hydrateDeploymentMode()} />;
  }

  if (mode !== "online") return <OfflineAuthGate>{children}</OfflineAuthGate>;
  return <OnlineAuthGate>{children}</OnlineAuthGate>;
}

function OfflineAuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // getLocalSessionUser() awaits initLocalDb(); if that rejects or is slow,
    // this MUST still clear `checking` (via catch + valve) — otherwise the app
    // hangs on the boot skeleton forever. On failure we fall through to the
    // local login screen rather than blocking.
    void getLocalSessionUser()
      .then((user) => {
        if (!mounted) return;
        if (user) {
          useSettings.getState().setCurrentUserRole(user.role);
          applyUserBranchAccess(user);
          void startLocalLoad();
          setRole(user.role);
        }
      })
      .catch((err) => {
        console.error("[OfflineAuthGate] session restore failed:", err);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    const valve = setTimeout(() => {
      if (mounted) setChecking(false);
    }, 12_000);
    return () => {
      mounted = false;
      clearTimeout(valve);
    };
  }, []);

  if (checking) {
    return <AppBootSkeleton />;
  }

  if (!role) {
    return (
      <LocalAuthLayout
        onSuccess={(_userId, loggedInRole) => {
          useSettings.getState().setCurrentUserRole(loggedInRole);
          // Branch isolation (SAD §7) — re-read the session user for its
          // branch assignment, which onSuccess does not carry.
          void getLocalSessionUser().then((u) => u && applyUserBranchAccess(u));
          void startLocalLoad();
          setRole(loggedInRole);
        }}
      />
    );
  }

  return <>{children}</>;
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

  useEffect(() => {
    let cancelled = false;
    const publicPaths = ["/auth/callback", "/forgot-password", "/reset-password", "/otp-login"];
    if (
      !session ||
      publicPaths.some((path) => pathname.startsWith(path)) ||
      pathname.startsWith("/platform")
    )
      return;
    void supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const isPlatformOwner = ((data ?? []) as Array<{ role?: string }>).some(
          (row) => row.role === "saas_admin" || row.role === "SaaS Admin",
        );
        if (isPlatformOwner) void navigate({ to: "/platform", replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, pathname, session]);
  // Restoring a session from localStorage (as opposed to a fresh sign-in)
  // can legitimately take up to ~25s (see the account-lookup race below).
  // Without this, that entire window renders the same UI as "logged out" —
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
      // account doesn't exist" — that would forcibly sign out a fully
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
            break; // query succeeded (even if no match found) — don't retry
          } else {
            break; // query succeeded with no data — don't retry
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
      stopCloudSync();
      await supabase.auth.signOut();
      setSession(null);
      useSettings
        .getState()
        .addSecurityLog("failed login", `Unregistered login blocked: ${userEmail}`, userEmail);
      return {
        allowed: false,
        error: "Your account exists, but MTJ ERP profile is not linked. Contact admin.",
      };
    }

    if (!matched.active) {
      stopCloudSync();
      await supabase.auth.signOut();
      setSession(null);
      useSettings
        .getState()
        .addSecurityLog("failed login", `Deactivated login blocked: ${userEmail}`, userEmail);
      return {
        allowed: false,
        error: "Your account is deactivated. Contact admin.",
      };
    }

    if (!matched.role) {
      stopCloudSync();
      await supabase.auth.signOut();
      setSession(null);
      return {
        allowed: false,
        error: "Your account exists, but no role is assigned to it under MTJ ERP. Contact admin.",
      };
    }

    return { allowed: true, role: matched.role };
  };

  useEffect(() => {
    let mounted = true;

    // Safety valve so a hung/slow auth check (e.g. autoRefreshToken retrying
    // a token refresh while offline at startup) doesn't leave the user
    // staring at an infinite loading state — falls through to the login
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

      if (_initialSyncDone) {
        setSession(s);
        setChecking(false);
        const loggedIn = useSettings
          .getState()
          .users.find((u) => u.email.toLowerCase() === s.user.email!.toLowerCase());
        useSettings.getState().setCurrentUserRole(loggedIn?.role ?? null);
        return;
      }

      // Reuse an already-in-flight check instead of firing a duplicate
      // app_settings round trip when multiple auth events land close
      // together (INITIAL_SESSION + TOKEN_REFRESHED/SIGNED_IN, etc.).
      if (!_checkInFlight) {
        // Generous enough to cover two 10s per-request fetch timeouts (see
        // the Supabase client's global fetch wrapper) plus overhead, so this
        // outer guard doesn't cut off the retry loop's second attempt.
        //
        // Resolves `allowed: true` on timeout, not false: `s` is already a
        // Supabase-verified session by this point — this check only adds the
        // secondary "is this email an active MTJ user" business lookup. A
        // slow/unreachable app_settings fetch is a transient blip, not proof
        // the account is invalid, and must not forcibly sign out an already-
        // legitimate user (see checkUserAllowed's own retry-once comment
        // above, which this timeout was previously undermining by still
        // failing closed). A genuinely deactivated/removed user is still
        // caught on the next revalidation once the network recovers.
        const timeoutCheck = new Promise<{ allowed: boolean; error?: string }>((resolve) =>
          setTimeout(() => resolve({ allowed: true }), 24000),
        );
        _checkInFlight = Promise.race([checkUserAllowed(s.user.email, s), timeoutCheck]).finally(
          () => {
            _checkInFlight = null;
          },
        );
      }
      const check = await _checkInFlight;
      if (!mounted) return;

      if (!check.allowed) {
        setBootError(check.error || "Account is not authorized.");
        setSession(null);
        setChecking(false);
        return;
      }

      setSession(s);
      setBootError(null);
      setChecking(false);
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
        const destination = typeof data === "string" ? data : "/";
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
      // "" → default assignment that pullBranches makes during the first load —
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

  return <>{children}</>;
}

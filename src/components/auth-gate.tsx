// auth-gate v2 — module-level flag prevents repeated sync on HMR/multi-client auth events
import { useEffect, useState, type ReactNode } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Session } from "@supabase/supabase-js";
import { resetAllBusinessStores } from "@/lib/session-cleanup";
import { useSettings } from "@/lib/settings-store";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppBootSkeleton } from "@/components/app-boot-skeleton";

// The data loader imports every operational store. Keep it out of the initial
// authentication bundle and load it only after a session has been established.
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
let _checkInFlight: Promise<{ allowed: boolean; error?: string }> | null = null;

function OnlineAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  // Restoring a session from localStorage (as opposed to a fresh sign-in)
  // can legitimately take up to ~25s (see the account-lookup race below).
  // Without this, that entire window renders the same UI as "logged out" —
  // indistinguishable from an actual sign-out to a real user reopening the app.
  const [checking, setChecking] = useState(true);

  const checkUserAllowed = async (
    userEmail: string,
    currentSession: Session,
  ): Promise<{ allowed: boolean; error?: string }> => {
    if (!userEmail) return { allowed: false, error: "Missing email address." };

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

    return { allowed: true };
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
        if (evt === "SIGNED_OUT" || !s) {
          setSession(null);
          setBootError(null);
          setChecking(false);
          stopCloudSync();
          _initialSyncDone = false;
          // Clears cached orders/invoices/ledger/customer data from memory
          // so it can't flash on screen for the next person who logs in on
          // this device before their own fresh pull completes.
          void resetAllBusinessStores();
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
      const loggedIn = useSettings
        .getState()
        .users.find((u) => u.email.toLowerCase() === s.user.email!.toLowerCase());
      useSettings.getState().setCurrentUserRole(loggedIn?.role ?? null);
      useSettings.getState().addSecurityLog("login", `User signed in successfully`, s.user.email);
      void startCloudSync();
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
  }, []);

  if (checking) {
    return <AppBootSkeleton />;
  }

  if (!session) {
    return <AuthLayout prefilledError={bootError} onClearError={() => setBootError(null)} />;
  }

  return <>{children}</>;
}

// auth-gate v2 — module-level flag prevents repeated sync on HMR/multi-client auth events
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { startCloudSync, stopCloudSync, pullAll } from "@/lib/data-loader";
import { useSettings } from "@/lib/settings-store";
import { AuthLayout } from "@/components/layout/AuthLayout";

// Module-level flag: persists across HMR remounts within the same browser session.
let _initialSyncDone = false;
// De-dupes concurrent auth-state events (Supabase fires both an explicit
// getSession() resolution and an "INITIAL_SESSION" onAuthStateChange event on
// every load, sometimes followed by a near-simultaneous TOKEN_REFRESHED/
// SIGNED_IN event) so the same account-lookup round trip to `app_settings`
// isn't fired 2-3x in parallel on every page load/reload.
let _checkInFlight: Promise<{ allowed: boolean; error?: string }> | null = null;

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

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

    const authTimeout = setTimeout(() => {
      if (!mounted) return;
      try {
        const tokenKey = Object.keys(localStorage).find(
          (k) => k.includes("supabase") && k.includes("auth-token"),
        );
        if (tokenKey) localStorage.removeItem(tokenKey);
      } catch (_) {}
      if (mounted) {
        setSession(null);
        setBootError(null);
      }
    }, 25_000);

    const finalizeSession = async (s: Session | null, evt: string) => {
      if (!mounted || !s?.user?.email) {
        if (evt === "SIGNED_OUT" || !s) {
          setSession(null);
          setBootError(null);
          stopCloudSync();
          _initialSyncDone = false;
        }
        return;
      }

      if (_initialSyncDone) {
        setSession(s);
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
        const timeoutCheck = new Promise<{ allowed: boolean; error?: string }>((resolve) =>
          setTimeout(
            () =>
              resolve({ allowed: false, error: "Auth check timed out. Please sign in again." }),
            24000,
          ),
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
        return;
      }

      setSession(s);
      setBootError(null);
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
      if (state.selectedBranchId !== prev.selectedBranchId) void pullAll();
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
      unsubBranch();
    };
  }, []);

  if (!session) {
    return <AuthLayout prefilledError={bootError} onClearError={() => setBootError(null)} />;
  }

  return <>{children}</>;
}

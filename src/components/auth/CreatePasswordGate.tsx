import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  markEmailPasswordConfiguredServer,
  primaryOAuthProvider,
  readPasswordGateDismissed,
  shouldRequireCreatePasswordGate,
  writePasswordGateDismissed,
} from "@/lib/auth/identity-providers";
import { isPublicAuthPath } from "@/lib/identity/route-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AUTH_REFRESH_DEBOUNCE_MS = 800;

/**
 * Blocks app access for Google-only accounts until they set an email login password.
 */
export function CreatePasswordGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onPublicAuthSurface = isPublicAuthPath(pathname);
  const [checking, setChecking] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [oauthLabel, setOauthLabel] = useState("Google");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gateDismissedRef = useRef(false);
  const busyRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissGate = useCallback((userId: string) => {
    gateDismissedRef.current = true;
    writePasswordGateDismissed(userId);
    setNeedsPassword(false);
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current || gateDismissedRef.current) {
      setNeedsPassword(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setNeedsPassword(false);
        return;
      }

      setUserEmail(user.email ?? "");

      if (readPasswordGateDismissed(user.id) || gateDismissedRef.current) {
        dismissGate(user.id);
        return;
      }

      const requireGate = await shouldRequireCreatePasswordGate(user);
      if (!requireGate) {
        dismissGate(user.id);
        return;
      }

      setNeedsPassword(true);
      const provider = primaryOAuthProvider(user);
      setOauthLabel(provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Google");
    } finally {
      setChecking(false);
    }
  }, [dismissGate]);

  useEffect(() => {
    if (onPublicAuthSurface) {
      setNeedsPassword(false);
      setChecking(false);
      return;
    }

    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (busyRef.current || gateDismissedRef.current) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void refresh();
      }, AUTH_REFRESH_DEBOUNCE_MS);
    });

    return () => {
      sub.subscription.unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refresh, onPublicAuthSurface]);

  async function completePasswordSetup(userId: string, message: string) {
    await markEmailPasswordConfiguredServer();
    await supabase.auth.refreshSession();
    const configured = !(await shouldRequireCreatePasswordGate(
      (await supabase.auth.getUser()).data.user,
    ));
    if (!configured) {
      throw new Error("Password saved but verification failed. Please try again.");
    }
    dismissGate(userId);
    toast.success(message);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      const { data: current } = await supabase.auth.getUser();
      const userId = current.user?.id;
      if (!userId) {
        setError("Session expired. Please sign in again.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const alreadyConfigured = /different from the old password|already been registered|same password/i.test(
          updateError.message,
        );
        if (alreadyConfigured) {
          await completePasswordSetup(userId, "Password already set. Continuing to your account.");
          return;
        }
        setError(updateError.message);
        return;
      }

      await completePasswordSetup(
        userId,
        "Password saved. You can now sign in with email and password.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save password.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (checking || onPublicAuthSurface) return <>{children}</>;

  if (!needsPassword) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-md p-6 space-y-4 shadow-lg border-gold/20">
          <div className="flex items-center gap-2 text-gold">
            <KeyRound className="h-5 w-5" />
            <h2 className="font-serif text-xl">Create your login password</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You signed in with {oauthLabel}. Set a password for{" "}
            <strong>{userEmail || "your email"}</strong> so you can sign in normally without{" "}
            {oauthLabel} — for example on another device or when {oauthLabel} is unavailable.
          </p>
          <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="create-password">New password</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={10}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-create-password">Confirm password</Label>
              <Input
                id="confirm-create-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={10}
                required
              />
            </div>
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full gap-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save password & continue
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, KeyRound, UserCheck, Eye, EyeOff, ShieldAlert, Loader2 } from "lucide-react";
import { OrnexaBrandLogo } from "@/components/marketing/OrnexaBrandLogo";
import { useSettings } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { isGoogleOAuthEnabled, signInWithGoogle } from "@/lib/auth/google-oauth";
import { noteSuccessfulPasswordLogin } from "@/lib/auth/identity-providers";
import { isRememberDeviceEnabled, setRememberDevice } from "@/lib/auth/auth-storage";
import { GoogleSignInButton } from "@/components/compliance/GoogleSignInButton";
import { isNativeApp } from "@/lib/native/platform";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  prefilledError?: string | null;
  onClearError?: () => void;
  onSuccess?: () => void;
  /** Capacitor shell: logo/title live on the outer login page; no web portal chrome. */
  nativeMinimal?: boolean;
  /** Soft audience hint under Google (native portal chips). */
  audienceHint?: string;
}

/**
 * Secures individual user authorization state inside the AVS ERP platform.
 * Returns { allowed: true } if active directory matches, or descriptive error string otherwise.
 */
// Kept exported for the auth flow's legacy compatibility surface; moving it
// would change the public import boundary used by downstream builds.
// eslint-disable-next-line react-refresh/only-export-components
export async function verifyUserRoleAndStatus(
  userEmail: string,
): Promise<{ allowed: boolean; error?: string }> {
  if (!userEmail) {
    return { allowed: false, error: "Missing email address." };
  }

  let users = useSettings.getState().users;
  let matched = users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase());

  if (!matched) {
    try {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("firm_id")
          .eq("auth_id", userId)
          .maybeSingle();
        const firmId = profile?.firm_id;
        if (firmId) {
          const { data, error } = await supabase
            .from("app_settings")
            .select("data")
            .eq("id", firmId)
            .maybeSingle();

          if (error) {
            console.error("[AuthLayout] Supabase app_settings fetch failed:", error);
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
          }
        }
      }
    } catch (err) {
      console.error("[AuthLayout] Failed to dynamically sync app_settings:", err);
    }
  }

  if (!matched) {
    return {
      allowed: false,
      error: "Your account exists, but AVS ERP profile is not linked. Contact admin.",
    };
  }

  if (!matched.active) {
    return {
      allowed: false,
      error: "Your account is deactivated. Contact admin.",
    };
  }

  if (!matched.role) {
    return {
      allowed: false,
      error: "Your account exists, but no role is assigned to it under AVS ERP. Contact admin.",
    };
  }

  return { allowed: true };
}

/**
 * Pre-login eligibility: block deactivated/misconfigured ERP staff only.
 * Portal-only and trial sign-ups are allowed to attempt Supabase auth.
 */
export async function resolveLoginEligibility(
  userEmail: string,
): Promise<{ allowed: boolean; error?: string }> {
  const result = await verifyUserRoleAndStatus(userEmail);
  if (result.allowed) return result;

  const msg = result.error ?? "";
  if (msg.includes("deactivated") || msg.includes("no role is assigned")) {
    return result;
  }

  // Unknown email or portal-only account — do not block before password verify.
  return { allowed: true };
}

export function AuthLayout({
  prefilledError,
  onClearError,
  onSuccess,
  nativeMinimal = false,
  audienceHint,
}: AuthLayoutProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const native = isNativeApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [rememberDevice, setRememberDeviceState] = useState(() => isRememberDeviceEnabled());

  /** Capacitor WebView: prefer SPA navigate over <a>/target=_blank (often no-ops). */
  const go = (to: "/forgot-password" | "/otp-login" | "/invite/accept") => {
    void navigate({ to });
  };

  useEffect(() => {
    if (prefilledError) {
      const lower = prefilledError.toLowerCase();
      if (
        lower.includes("authorization context") ||
        lower.includes("not linked") ||
        lower.includes("cannot open another")
      ) {
        setErr(
          "Start a 14-day trial to create your workshop, or accept an invitation from your jeweller.",
        );
      } else {
        setErr(prefilledError);
      }
    }
  }, [prefilledError]);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setErr(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (lockedUntil && Date.now() < lockedUntil) {
      setErr(
        `Too many failed attempts. Try again in about ${Math.ceil((lockedUntil - Date.now()) / 60000)} minutes.`,
      );
      return;
    }

    // Removed strict frontend check to adapt dynamically to Supabase's bot protection toggle.
    // If Supabase actually requires CAPTCHA, it will fail at the API level and return a CAPTCHA-related error.
    setBusy(true);
    setErr(null);
    onClearError?.();
    setRememberDevice(rememberDevice);

    const targetEmail = email.trim();

    try {
      const eligibility = await resolveLoginEligibility(targetEmail);
      if (!eligibility.allowed) {
        setErr(eligibility.error ?? "Sign-in is not allowed for this account.");
        setBusy(false);
        return;
      }

      let authUser = null;
      let authSession = null;
      let functionInvokedSuccessfully = false;
      let isRateLimited = false;
      let lockMinutes = 60;

      try {
        // The Edge Function is an optional rate-limit layer. It is opt-in so
        // a missing/stale deployment cannot produce a browser CORS error or
        // delay normal Supabase authentication. Supabase Auth remains the
        // authoritative credential and session boundary.
        if (import.meta.env.VITE_AUTH_LOGIN_FUNCTION_ENABLED !== "true") {
          throw Object.assign(new Error("Optional auth-login function disabled"), { status: 0 });
        }
        // Route the sign-in form through the "auth-login" Edge Function.
        // NOTE: The Edge Function login rate-limiting lockout is a secondary UX lockout boundary,
        // while the ultimate security boundary is handled natively by the database / Supabase auth settings.
        const { data: funcData, error: funcErr } = await supabase.functions.invoke("auth-login", {
          body: { email: targetEmail, password },
        });

        if (funcErr) {
          const status = funcErr.status || (funcErr as any).statusCode;
          if (status === 429) {
            isRateLimited = true;
          }
          throw funcErr;
        }

        if (funcData) {
          if (funcData.locked) {
            isRateLimited = true;
            lockMinutes = funcData.retryAfterMinutes || 60;
            throw new Error(
              funcData.error ||
                `Too many failed attempts. Try again in about ${lockMinutes} minutes.`,
            );
          }

          if (funcData.error) {
            throw new Error(funcData.error);
          }

          // Successful authentication via Edge Function
          authSession = funcData.session;
          authUser = funcData.user;
          functionInvokedSuccessfully = true;
        }
      } catch (ex: any) {
        if (ex?.status !== 0) {
          console.warn(
            "[AuthLayout] Edge function login failed or not found, verifying rate-limit status.",
            ex,
          );
        }

        // Handle explicit rate limit responses from our Edge Function
        if (
          isRateLimited ||
          ex.status === 429 ||
          ex.message?.includes("Too many failed attempts") ||
          ex.message?.includes("429")
        ) {
          const errMsg = ex.message?.includes("minutes")
            ? ex.message
            : `Too many failed attempts. Try again in about ${lockMinutes} minutes.`;
          setErr(errMsg);
          setLockedUntil(Date.now() + lockMinutes * 60 * 1000);
          useSettings
            .getState()
            .addSecurityLog(
              "rate limited",
              `Sign-in attempt rate limited for ${targetEmail}: ${errMsg}`,
              targetEmail,
            );
          setBusy(false);
          return;
        }

        // Handle generic 401 unauthenticated response from Edge Function
        if (
          ex.status === 401 ||
          ex.message?.includes("Invalid email or password") ||
          ex.message?.includes("401")
        ) {
          setErr("Invalid email or password.");
          useSettings
            .getState()
            .addSecurityLog(
              "failed login",
              `Failed Edge Function auth attempt for ${targetEmail}: Invalid credentials`,
              targetEmail,
            );
setBusy(false);
          return;
        }

        // Graceful fallback to client-side login if the Edge Function itself is unreachable

        try {
          const { data: fallbackData, error: fallbackErr } = await supabase.auth.signInWithPassword(
            {
              email: targetEmail,
              password,
            },
          );

          if (fallbackErr) {
            if (fallbackErr.status === 429) {
              setErr("Too many failed attempts. Please try again later.");
              setLockedUntil(Date.now() + 5 * 60 * 1000);
            } else if (
              fallbackErr.status === 400 ||
              fallbackErr.message?.includes("Invalid login credentials") ||
              fallbackErr.message?.includes("invalid_credentials")
            ) {
              setErr("Invalid email or password.");
            } else {
              const { isAbortLikeError, abortFriendlyMessage } = await import(
                "@/lib/network-abort"
              );
              if (isAbortLikeError(fallbackErr)) {
const retry = await supabase.auth.signInWithPassword({
                  email: targetEmail,
                  password,
                });
                if (retry.error) {
                  setErr(
                    isAbortLikeError(retry.error)
                      ? abortFriendlyMessage()
                      : retry.error.message || abortFriendlyMessage(),
                  );
                  setBusy(false);
                  return;
                }
                if (retry.data?.session) {
                  authSession = retry.data.session;
                  authUser = retry.data.user;
                  functionInvokedSuccessfully = false;
                } else {
                  setErr(abortFriendlyMessage());
                  setBusy(false);
                  return;
                }
              } else {
                setErr(
                  fallbackErr.message || "Authentication service error. Please try again later.",
                );
              }
            }

            if (!authSession) {
              useSettings
                .getState()
                .addSecurityLog(
                  "failed login",
                  `Failed fallback auth attempt for ${targetEmail}: ${fallbackErr.message}`,
                  targetEmail,
                );
              setBusy(false);
              return;
            }
          } else if (fallbackData?.session) {
            authSession = fallbackData.session;
            authUser = fallbackData.user;
            functionInvokedSuccessfully = false; // session is already loaded client-side, setSession not needed
          } else {
            throw new Error("No session returned from authentication provider.");
          }
        } catch (fallbackEx: any) {
          console.error(
            "[AuthLayout] Fallback client-side sign-in failed:",
            fallbackEx.message || fallbackEx,
          );
          const { isAbortLikeError, abortFriendlyMessage } = await import("@/lib/network-abort");
          setErr(
            isAbortLikeError(fallbackEx)
              ? abortFriendlyMessage()
              : "Login service is temporarily unavailable. Please try again later.",
          );
          useSettings
            .getState()
            .addSecurityLog(
              "failed login",
              `Login attempt for ${targetEmail} blocked due to login service outage: ${fallbackEx.message || fallbackEx}`,
              targetEmail,
            );
          setBusy(false);
          return;
        }
      }

      if (functionInvokedSuccessfully && authSession) {
        // Set the session on client-side Supabase client
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }
      } else if (!authSession) {
        // Fallback or unexpected condition
        setErr("Login service returned an invalid response. Please try again later.");
        setBusy(false);
        return;
      }

      // NOTE: authorization (role/active/profile-linked checks) is performed
      // exactly once, by AuthGate's reactive onAuthStateChange handler, which
      // fires immediately once the session above is set. This form used to
      // duplicate that same check here via its own getUser()+
      // verifyUserRoleAndStatus() call — running the same app_settings
      // lookup twice in parallel on every login. Beyond the redundant
      // network round trip, if THIS copy's fetch hit any transient network
      // hiccup, it would fall through and force a sign-out even when the
      // user was fully authorized, producing an intermittent spurious
      // logout right after a successful sign-in. AuthGate remains the single
      // source of truth for authorization; if it determines the account
      // isn't allowed, it shows its own error and signs the user out itself.
      const signedInUserId = authUser?.id ?? authSession?.user?.id;
      if (signedInUserId) {
        void noteSuccessfulPasswordLogin(signedInUserId);
      }
      await Promise.resolve(onSuccess?.());
    } catch (ex: any) {
      console.error("[AuthLayout] Login submission hit unexpected system exception:", ex);
const { isAbortLikeError, abortFriendlyMessage } = await import("@/lib/network-abort");
      setErr(
        isAbortLikeError(ex)
          ? abortFriendlyMessage()
          : ex.message || "An unexpected system error occurred.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setErr(null);
    setBusy(true);
    const result = await signInWithGoogle({ redirectPath: "/auth/callback" });
    setBusy(false);
    if (!result.ok) {
      setErr(result.error ?? "Google sign-in failed.");
      toast.error(result.error ?? "Google sign-in failed.");
      return;
    }
    // Native ID-token path does not leave the WebView — land in the app immediately.
    await Promise.resolve(onSuccess?.());
  }

  return (
    <div
      className={
        nativeMinimal
          ? "w-full relative"
          : "min-h-screen w-full flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden"
      }
    >
      {!nativeMinimal && (
        <>
          <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
        </>
      )}

      <Card
        className={
          nativeMinimal
            ? "w-full max-w-sm p-5 space-y-4 border-white/10 bg-white/5 text-white shadow-none"
            : "w-full max-w-sm p-6 space-y-5 border-border shadow-elegant bg-card/85 backdrop-blur-md relative z-10 transition-all duration-300 hover:border-gold/20"
        }
      >
        {!nativeMinimal && (
          <div className="text-center space-y-1.5">
            <OrnexaBrandLogo variant="stacked" className="mx-auto h-36 max-w-[200px]" />
          </div>
        )}

        {!nativeMinimal && (
          <div className="border-b border-border pb-1.5">
            <div className="text-xs font-semibold text-muted-foreground">
              <span className="text-gold uppercase tracking-widest text-[10px]">
                {t("auth.standardSignInHeader")}
              </span>
            </div>
          </div>
        )}

        <form
          onSubmit={handlePasswordLogin}
          className="space-y-4"
          data-testid="auth-form"
          id="auth-login-form"
        >
          <div className="grid gap-1.5">
            <Label
              className={cn(
                "text-xs font-medium tracking-wide",
                nativeMinimal && "text-white/85",
              )}
              htmlFor="auth-email-input"
            >
              {t("auth.emailLabel")}
            </Label>
            <div className="relative">
              <Mail
                className={cn(
                  "absolute left-3 top-2.5 h-4 w-4",
                  nativeMinimal ? "text-white/45" : "text-muted-foreground",
                )}
              />
              <Input
                id="auth-email-input"
                className={cn(
                  "pl-9 h-10 focus-visible:ring-gold/30 focus-visible:border-gold/50",
                  nativeMinimal
                    ? "bg-black/40 border-white/25 text-white placeholder:text-white/40"
                    : "border-input bg-background/50",
                )}
                data-testid="auth-email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                required
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex justify-between items-center">
              <Label
                className={cn(
                  "text-xs font-medium tracking-wide",
                  nativeMinimal && "text-white/85",
                )}
                htmlFor="auth-password-input"
              >
                {t("auth.passwordLabel")}
              </Label>
              {native || nativeMinimal ? (
                <button
                  type="button"
                  className="text-[10px] text-gold hover:text-gold/85 hover:underline focus:outline-none font-medium transition-colors"
                  onClick={() => go("/forgot-password")}
                >
                  {t("auth.forgotBtn")}
                </button>
              ) : (
                <Link
                  to="/forgot-password"
                  className="text-[10px] text-gold hover:text-gold/85 hover:underline focus:outline-none font-medium transition-colors"
                >
                  {t("auth.forgotBtn")}
                </Link>
              )}
            </div>
            <div className="relative">
              <KeyRound
                className={cn(
                  "absolute left-3 top-2.5 h-4 w-4",
                  nativeMinimal ? "text-white/45" : "text-muted-foreground",
                )}
              />
              <Input
                id="auth-password-input"
                className={cn(
                  "pl-9 pr-10 h-10 focus-visible:ring-gold/30 focus-visible:border-gold/50",
                  nativeMinimal
                    ? "bg-black/40 border-white/25 text-white placeholder:text-white/40"
                    : "border-input bg-background/50",
                )}
                data-testid="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("auth.passwordPlaceholder")}
                required
                disabled={busy}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className={cn(
                  "absolute right-3 top-2.5 focus:outline-none transition-colors",
                  nativeMinimal
                    ? "text-white/55 hover:text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
                id="btn-toggle-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label
            className={cn(
              "flex items-center gap-2 text-xs cursor-pointer select-none",
              nativeMinimal ? "text-white/70" : "text-muted-foreground",
            )}
          >
            <input
              type="checkbox"
              className="rounded border-border"
              checked={rememberDevice}
              onChange={(e) => setRememberDeviceState(e.target.checked)}
              disabled={busy}
            />
            Keep me signed in on this device
          </label>

          {err && (
            <div
              className={cn(
                "text-xs font-medium leading-relaxed rounded-lg p-2.5 flex items-start gap-2 border",
                nativeMinimal
                  ? "text-white/85 bg-white/5 border-white/15"
                  : "text-foreground bg-muted/60 border-border",
              )}
              data-testid="auth-error"
              id="auth-error-banner"
            >
              <ShieldAlert
                className={cn(
                  "h-4 w-4 shrink-0 mt-0.5",
                  nativeMinimal ? "text-[#B89454]" : "text-gold",
                )}
              />
              <span>{err}</span>
            </div>
          )}

          <Button
            data-testid="auth-submit"
            type="submit"
            className="w-full h-10 bg-gold hover:bg-gold/90 text-black font-semibold mt-2 shadow-sm relative overflow-hidden transition-all active:scale-[0.98]"
            disabled={busy || !!lockedUntil}
            id="btn-auth-submit"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </span>
            ) : nativeMinimal ? (
              "Secure Sign In"
            ) : (
              t("auth.signInBtn")
            )}
          </Button>

          {isGoogleOAuthEnabled() && (
            <>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className={nativeMinimal ? "bg-transparent px-2 text-white/50" : "bg-card px-2 text-muted-foreground"}>
                    or
                  </span>
                </div>
              </div>

              <GoogleSignInButton
                disabled={busy || !!lockedUntil}
                busy={busy}
                onClick={() => void handleGoogleSignIn()}
              />
            </>
          )}

          {audienceHint ? (
            <p
              className={
                nativeMinimal
                  ? "text-[10px] leading-relaxed text-white/55 text-center"
                  : "text-[10px] leading-relaxed text-muted-foreground text-center"
              }
              data-testid="auth-audience-hint"
            >
              {audienceHint}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2 text-center text-xs">
            {native || nativeMinimal ? (
              <>
                <button
                  type="button"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none transition-colors"
                  data-testid="auth-link-otp"
                  onClick={() => go("/otp-login")}
                >
                  {t("auth.otpBtn")}
                </button>
                <button
                  type="button"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none transition-colors"
                  data-testid="auth-link-forgot"
                  onClick={() => go("/forgot-password")}
                >
                  Forgot Password
                </button>
                <button
                  type="button"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none inline-flex justify-center items-center gap-1.5 transition-colors mx-auto"
                  data-testid="auth-link-invite"
                  onClick={() => go("/invite/accept")}
                >
                  <UserCheck className="h-3.5 w-3.5" /> {t("auth.inviteBtn")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/otp-login"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none transition-colors"
                >
                  {t("auth.otpBtn")}
                </Link>
                <Link
                  to="/forgot-password"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none transition-colors"
                >
                  Forgot Password
                </Link>
                <Link
                  to="/invite/accept"
                  className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none flex justify-center items-center gap-1.5 transition-colors"
                >
                  <UserCheck className="h-3.5 w-3.5" /> {t("auth.inviteBtn")}
                </Link>
              </>
            )}
          </div>
        </form>

        {!nativeMinimal && (
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            {t("auth.publicSignupDisabled")}
          </p>
        )}
      </Card>
    </div>
  );
}

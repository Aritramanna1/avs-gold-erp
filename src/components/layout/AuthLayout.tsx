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
  className?: string;
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
      const { data: sessionResult } = await supabase.auth.getSession();
      const userId = sessionResult?.session?.user?.id;
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
      error: "Your account exists, but AVS ERP profile is not linked. Please contact your firm admin or AVS support.",
    };
  }

  if (!matched.active) {
    return {
      allowed: false,
      error: "Your account is deactivated. Please contact your firm admin or AVS support.",
    };
  }

  if (!matched.role) {
    return {
      allowed: false,
      error: "Your account exists, but no role is assigned under AVS ERP. Contact your admin.",
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
  className,
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

      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (authErr) {
        const status = authErr.status;
        if (status === 429) {
          setErr("Too many failed attempts. Please try again later.");
          setLockedUntil(Date.now() + 5 * 60 * 1000);
          useSettings
            .getState()
            .addSecurityLog(
              "rate limited",
              `Sign-in attempt rate limited for ${targetEmail}`,
              targetEmail,
            );
        } else if (
          status === 400 ||
          authErr.message?.includes("Invalid login credentials") ||
          authErr.message?.includes("invalid_credentials")
        ) {
          setErr("Invalid email or password.");
          useSettings
            .getState()
            .addSecurityLog(
              "failed login",
              `Failed login attempt for ${targetEmail}: Invalid credentials`,
              targetEmail,
            );
        } else {
          setErr(authErr.message || "Authentication error. Please try again.");
        }
        setBusy(false);
        return;
      }

      if (!authData?.session) {
        setErr("Login service returned an invalid response. Please try again.");
        setBusy(false);
        return;
      }

      const signedInUserId = authData.user?.id || authData.session.user?.id;
      if (signedInUserId) {
        void noteSuccessfulPasswordLogin(signedInUserId);
      }
      await Promise.resolve(onSuccess?.());
    } catch (ex: any) {
      console.error("[AuthLayout] Login submission hit unexpected exception:", ex);
      setErr(ex?.message || "An unexpected system error occurred.");
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
      className={cn(
        "w-full flex items-center justify-center relative",
        className,
      )}
    >
      <Card
        className={cn(
          nativeMinimal
            ? "w-full max-w-sm p-5 space-y-4 border-white/10 bg-white/5 text-white shadow-none"
            : "w-full max-w-md p-7 space-y-5 border border-slate-200 dark:border-border shadow-lg bg-white dark:bg-card text-slate-900 dark:text-foreground rounded-2xl relative z-10 transition-all",
        )}
      >
        {!nativeMinimal && (
          <div className="text-center space-y-2 pb-1">
            <OrnexaBrandLogo variant="stacked" className="mx-auto h-28 max-w-[190px]" />
            <div className="border-b border-slate-100 dark:border-border pb-2 pt-1">
              <span className="text-[#8C6D32] dark:text-[#B89454] uppercase tracking-widest text-[11px] font-bold">
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
                "text-xs font-semibold tracking-wide",
                nativeMinimal ? "text-white/85" : "text-slate-800 dark:text-slate-200",
              )}
              htmlFor="auth-email-input"
            >
              {t("auth.emailLabel")}
            </Label>
            <div className="relative">
              <Mail
                className={cn(
                  "absolute left-3.5 top-3 h-4 w-4",
                  nativeMinimal ? "text-white/45" : "text-slate-400 dark:text-muted-foreground",
                )}
              />
              <Input
                id="auth-email-input"
                className={cn(
                  "pl-10 h-11 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-[#B89454]/40 focus-visible:border-[#B89454]",
                  nativeMinimal
                    ? "bg-black/40 border-white/25 text-white placeholder:text-white/40"
                    : "border-slate-300 dark:border-input bg-slate-50/50 dark:bg-background text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground/60",
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
                  "text-xs font-semibold tracking-wide",
                  nativeMinimal ? "text-white/85" : "text-slate-800 dark:text-slate-200",
                )}
                htmlFor="auth-password-input"
              >
                {t("auth.passwordLabel")}
              </Label>
              {native || nativeMinimal ? (
                <button
                  type="button"
                  className="text-[11px] text-[#8C6D32] dark:text-[#B89454] hover:underline focus:outline-none font-semibold transition-colors"
                  onClick={() => go("/forgot-password")}
                >
                  {t("auth.forgotBtn")}
                </button>
              ) : (
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-[#8C6D32] dark:text-[#B89454] hover:underline focus:outline-none font-semibold transition-colors"
                >
                  {t("auth.forgotBtn")}
                </Link>
              )}
            </div>
            <div className="relative">
              <KeyRound
                className={cn(
                  "absolute left-3.5 top-3 h-4 w-4",
                  nativeMinimal ? "text-white/45" : "text-slate-400 dark:text-muted-foreground",
                )}
              />
              <Input
                id="auth-password-input"
                className={cn(
                  "pl-10 pr-10 h-11 text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-[#B89454]/40 focus-visible:border-[#B89454]",
                  nativeMinimal
                    ? "bg-black/40 border-white/25 text-white placeholder:text-white/40"
                    : "border-slate-300 dark:border-input bg-slate-50/50 dark:bg-background text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground/60",
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
                  "absolute right-3.5 top-3 focus:outline-none transition-colors",
                  nativeMinimal
                    ? "text-white/55 hover:text-white"
                    : "text-slate-400 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground",
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
              nativeMinimal ? "text-white/70" : "text-slate-600 dark:text-muted-foreground font-medium",
            )}
          >
            <input
              type="checkbox"
              className="rounded border-slate-300 dark:border-border text-[#B89454] focus:ring-[#B89454]"
              checked={rememberDevice}
              onChange={(e) => setRememberDeviceState(e.target.checked)}
              disabled={busy}
            />
            Keep me signed in on this device
          </label>

          {err && (
            <div
              className={cn(
                "text-xs font-medium leading-relaxed rounded-lg p-3 flex flex-col gap-1.5 border",
                nativeMinimal
                  ? "text-white/85 bg-white/5 border-white/15"
                  : "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
              )}
              data-testid="auth-error"
              id="auth-error-banner"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert
                  className={cn(
                    "h-4 w-4 shrink-0 mt-0.5",
                    nativeMinimal ? "text-[#B89454]" : "text-red-600 dark:text-red-400",
                  )}
                />
                <span>{err}</span>
              </div>
              <div className="pl-6.5 text-[11px] flex items-center gap-3">
                <Link
                  to="/invite/accept"
                  className={cn(
                    "font-semibold underline hover:opacity-80 transition-opacity",
                    nativeMinimal ? "text-[#B89454]" : "text-red-900 dark:text-red-200",
                  )}
                >
                  Accept Invitation
                </Link>
                <span>·</span>
                <a
                  href="https://arivahly.in/products/onyxa-erp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "font-semibold underline hover:opacity-80 transition-opacity",
                    nativeMinimal ? "text-[#B89454]" : "text-red-900 dark:text-red-200",
                  )}
                >
                  Request Demo ↗
                </a>
              </div>
            </div>
          )}

          <Button
            data-testid="auth-submit"
            type="submit"
            className={cn(
              "w-full h-11 bg-[#B89454] hover:bg-[#A38245] text-slate-950 font-bold text-sm rounded-lg shadow-sm relative overflow-hidden transition-all active:scale-[0.99]",
            )}
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
                  <span className="w-full border-t border-slate-200 dark:border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className={nativeMinimal ? "bg-transparent px-2 text-white/50" : "bg-white dark:bg-card px-2 text-slate-500 dark:text-muted-foreground font-semibold"}>
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
                  : "text-[11px] leading-relaxed text-slate-500 dark:text-muted-foreground text-center"
              }
              data-testid="auth-audience-hint"
            >
              {audienceHint}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-border mt-2 text-center text-xs">
            {native || nativeMinimal ? (
              <>
                <button
                  type="button"
                  className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none transition-colors"
                  data-testid="auth-link-otp"
                  onClick={() => go("/otp-login")}
                >
                  {t("auth.otpBtn")}
                </button>
                <button
                  type="button"
                  className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none transition-colors"
                  data-testid="auth-link-forgot"
                  onClick={() => go("/forgot-password")}
                >
                  Forgot Password
                </button>
                <button
                  type="button"
                  className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none inline-flex justify-center items-center gap-1.5 transition-colors mx-auto"
                  data-testid="auth-link-invite"
                  onClick={() => go("/invite/accept")}
                >
                  <UserCheck className="h-3.5 w-3.5" /> {t("auth.inviteBtn")}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-4 text-xs">
                  <Link
                    to="/otp-login"
                    className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none transition-colors"
                  >
                    {t("auth.otpBtn")}
                  </Link>
                  <span className="text-slate-300 dark:text-border">·</span>
                  <Link
                    to="/forgot-password"
                    className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none transition-colors"
                  >
                    Forgot Password
                  </Link>
                </div>
                <Link
                  to="/invite/accept"
                  className="text-[#8C6D32] dark:text-[#B89454] font-semibold hover:underline focus:outline-none flex justify-center items-center gap-1.5 transition-colors pt-1"
                >
                  <UserCheck className="h-3.5 w-3.5" /> {t("auth.inviteBtn")}
                </Link>
              </>
            )}
          </div>
        </form>

        {!nativeMinimal && (
          <p className="text-[10px] text-slate-400 dark:text-muted-foreground text-center leading-relaxed">
            {t("auth.publicSignupDisabled")}
          </p>
        )}
      </Card>
    </div>
  );
}

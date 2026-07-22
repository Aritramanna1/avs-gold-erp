import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, KeyRound, UserCheck, Eye, EyeOff, ShieldAlert, Loader2 } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { toast } from "sonner";

interface AuthLayoutProps {
  prefilledError?: string | null;
  onClearError?: () => void;
  onSuccess?: () => void;
}

export function AuthLayout({ prefilledError, onClearError, onSuccess }: AuthLayoutProps) {
  const { t } = useLanguage();
  const { firm, branding } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (prefilledError) {
      setErr(prefilledError);
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

    const targetEmail = email.trim();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });
      if (error) {
        if (error.status === 429) {
          setLockedUntil(Date.now() + 5 * 60 * 1000);
          setErr("Too many failed attempts. Please try again later.");
        } else {
          setErr(error.message || "Invalid email or password.");
        }
        useSettings
          .getState()
          .addSecurityLog(
            "failed login",
            `Supabase sign-in failed for ${targetEmail}`,
            targetEmail,
          );
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
      onSuccess?.();
    } catch (ex: any) {
      console.error("[AuthLayout] Login submission hit unexpected system exception:", ex);
      setErr(ex.message || "An unexpected system error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8 relative overflow-hidden">
      {/* Structural background glow accents to evoke safe luxury branding */}
      <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gold/5 blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-sm p-6 space-y-5 border-border shadow-elegant bg-card/85 backdrop-blur-md relative z-10 transition-all duration-300 hover:border-gold/20">
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold shadow-sm border border-gold/15 animate-pulse-slow">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-wide text-gold mt-1.5">
            {(firm.shopName || branding.applicationName || APP_NAME).toUpperCase()}
          </h1>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {t("auth.productionPortal")}
          </p>
          <p className="text-[9px] tracking-widest text-muted-foreground/70 font-medium">
            {branding.tagline || APP_TAGLINE}
          </p>
        </div>

        <div className="border-b border-border pb-1.5">
          <div className="text-xs font-semibold text-muted-foreground">
            <span className="text-gold uppercase tracking-widest text-[10px]">
              {t("auth.standardSignInHeader")}
            </span>
          </div>
        </div>

        <form
          onSubmit={handlePasswordLogin}
          className="space-y-4"
          data-testid="auth-form"
          id="auth-login-form"
        >
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium tracking-wide" htmlFor="auth-email-input">
              {t("auth.emailLabel")}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-email-input"
                className="pl-9 h-10 border-input bg-background/50 focus-visible:ring-gold/30 focus-visible:border-gold/50"
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
              <Label className="text-xs font-medium tracking-wide" htmlFor="auth-password-input">
                {t("auth.passwordLabel")}
              </Label>
              <Link
                to="/forgot-password"
                className="text-[10px] text-gold hover:text-gold/85 hover:underline focus:outline-none font-medium transition-colors"
              >
                {t("auth.forgotBtn")}
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-password-input"
                className="pl-9 pr-10 h-10 border-input bg-background/50 focus-visible:ring-gold/30 focus-visible:border-gold/50"
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
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                id="btn-toggle-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {err && (
            <div
              className="text-xs text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5 flex items-start gap-2"
              data-testid="auth-error"
              id="auth-error-banner"
            >
              <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
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
            ) : (
              t("auth.signInBtn")
            )}
          </Button>

          <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2 text-center text-xs">
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
              Forgot Username / Email?
            </Link>
            <Link
              to="/invite/accept"
              className="text-gold font-medium hover:text-gold/85 hover:underline focus:outline-none flex justify-center items-center gap-1.5 transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" /> {t("auth.inviteBtn")}
            </Link>
          </div>
        </form>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          {t("auth.publicSignupDisabled")}
        </p>
      </Card>
    </div>
  );
}

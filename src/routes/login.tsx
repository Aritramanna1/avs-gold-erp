import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import {
  AuthNativeBrandHeader,
  AuthNativeShell,
} from "@/components/layout/AuthNativeShell";
import { OrnexaBrandLogo } from "@/components/marketing/OrnexaBrandLogo";
import {
  resolvePostLoginRoute,
  sanitizeLoginRedirect,
} from "@/lib/auth/post-login-redirect";
import { REQUEST_ACCESS_PATH } from "@/lib/auth/public-signup-policy";
import { isNativeApp } from "@/lib/native/platform";
import { cn } from "@/lib/utils";

import { supabase } from "@/lib/supabase";
interface LoginSearchParams {
  redirect?: string;
  error?: string;
  audience?: string;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearchParams => {
    let redirect: string | undefined =
      typeof s.redirect === "string" ? s.redirect : undefined;
    if (redirect) {
      try {
        if (redirect.includes("%2F") || redirect.includes("%2f")) {
          redirect = decodeURIComponent(redirect);
        }
      } catch {
        /* keep */
      }
    }
    const error =
      typeof s.error === "string" && s.error.trim().length > 0
        ? s.error
        : undefined;
    return {
      redirect,
      error,
      audience: typeof s.audience === "string" ? s.audience : undefined,
    };
  },
  head: () => ({
    meta: [{ title: "Sign In · AVS ERP" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, error } = Route.useSearch();
  const native = isNativeApp();

  useEffect(() => {
    window.scrollTo(0, 0);
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const defaultRoute = await resolvePostLoginRoute("/app");
          const destination = sanitizeLoginRedirect(redirect, defaultRoute);
          void navigate({ to: destination as "/app", replace: true });
        }
      } catch {
        // ignore
      }
    })();
  }, [navigate, redirect]);

  const handleSuccess = async () => {
    const defaultRoute = await resolvePostLoginRoute("/app");
    const destination = sanitizeLoginRedirect(redirect, defaultRoute);
    void navigate({ to: destination as "/app", replace: true });
  };

  // 1. Packaged Native Mobile Shell (Capacitor APK/IPA only)
  if (native) {
    return (
      <AuthNativeShell>
        <div className="mx-auto w-full max-w-md">
          <AuthLayout
            prefilledError={error}
            onSuccess={handleSuccess}
            nativeMinimal
          />

          <section
            className="mt-5 space-y-3 rounded-lg border border-white/15 bg-[#14110f] p-4 text-white"
            data-testid="native-invite-access"
          >
            <h2 className="text-xs font-semibold tracking-wide text-[#B89454]">Access by Invitation Only</h2>
            <p className="text-[11px] leading-relaxed text-white/70">
              AVS ERP is an enterprise jewellery ecosystem. Accounts are provisioned via verified firm invitations.
            </p>

            <button
              type="button"
              data-testid="login-accept-invite"
              className="w-full rounded-md border border-[#B89454]/40 bg-[#B89454]/20 px-3 py-2.5 text-xs font-semibold text-[#B89454] hover:bg-[#B89454]/30 transition-colors flex items-center justify-center gap-2"
              onClick={() => void navigate({ to: "/invite/accept" })}
            >
              Accept Invitation
            </button>

            <a
              href="https://arivahly.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center text-xs text-white/70 hover:text-white underline underline-offset-2 py-1"
            >
              Don't have an account? Request Demo on AVS ERP
            </a>
          </section>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 py-6 text-[12px] text-white/80">
            <button
              type="button"
              className="underline underline-offset-4 hover:text-white"
              data-testid="login-link-terms"
              onClick={() => void navigate({ to: "/terms" })}
            >
              Terms of Service
            </button>
            <button
              type="button"
              className="underline underline-offset-4 hover:text-white"
              data-testid="login-link-privacy"
              onClick={() => void navigate({ to: "/privacy" })}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </AuthNativeShell>
    );
  }

  // 2. Authoritative Clean Web Browser Login Page
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF9F6] dark:bg-background px-4 py-10 relative overflow-hidden font-sans">
      {/* Decorative Golden Ambient Glows */}
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#B89454]/10 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#B89454]/10 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto space-y-5 relative z-10">
        {/* Core Sign-in Card */}
        <AuthLayout
          onSuccess={() => void handleSuccess()}
          prefilledError={error}
          nativeMinimal={false}
        />

        {/* Invitation & Request Demo Info Box */}
        <div className="rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card p-5 shadow-xs space-y-3 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-border/60 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E7B3B] dark:text-[#B89454]">
              Invitation & Onboarding
            </h2>
            <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-medium">
              Enterprise Access
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
            Accounts are provisioned by invitation from your firm administrator. If you have received an invite code, activate your account below.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              data-testid="login-accept-invite"
              className="w-full rounded-lg border border-gold/40 bg-gold/10 hover:bg-gold/20 px-3 py-2 text-xs font-semibold text-gold shadow-xs transition-colors text-center"
              onClick={() => void navigate({ to: "/invite/accept" })}
            >
              Accept Invitation
            </button>
            <a
              href="https://arivahly.in/products/onyxa-erp"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="login-request-demo"
              className="w-full rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 text-xs font-semibold shadow-xs transition-colors text-center flex items-center justify-center"
            >
              Request Demo ↗
            </a>
          </div>
        </div>

        {/* Footer Legal & Privacy Links */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-muted-foreground pt-1">
          <Link
            to="/terms"
            className="hover:text-slate-800 dark:hover:text-foreground hover:underline transition-colors"
            data-testid="login-link-terms"
          >
            Terms of Service
          </Link>
          <span>·</span>
          <Link
            to="/privacy"
            className="hover:text-slate-800 dark:hover:text-foreground hover:underline transition-colors"
            data-testid="login-link-privacy"
          >
            Privacy Policy
          </Link>
          <span>·</span>
          <a
            href="https://arivahly.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-800 dark:hover:text-foreground hover:underline transition-colors"
          >
            AVS ERP
          </a>
        </div>
      </div>
    </div>
  );
}

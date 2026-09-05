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

const AUDIENCE_VALUES = ["staff", "customer", "karigar", "supplier"] as const;
type LoginAudience = (typeof AUDIENCE_VALUES)[number];

const AUDIENCE_HINTS: Record<LoginAudience, string> = {
  staff:
    "Workshop owners and staff: sign in above with email or Google. Joining a firm? Accept invitation.",
  customer:
    "Customer portal: your jeweller must invite you first. Accept invitation (or use Google/password after invite). You only see that firm's orders and invoices.",
  karigar:
    "Karigar portal: accept the firm's invitation, then sign in with Google or password. Role and gold jobs come from the invite.",
  supplier:
    "Supplier portal: accept invitation from the partner firm, then use the same Google or password sign-in. You cannot open another jeweller's data.",
};

const PORTAL_AUDIENCE_OPTIONS: Array<[LoginAudience, string]> = [
  ["staff", "Workshop Staff"],
  ["customer", "Customer"],
  ["karigar", "Karigar"],
  ["supplier", "Supplier"],
];

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const rawAudience = typeof s.audience === "string" ? s.audience : undefined;
    const audience = AUDIENCE_VALUES.includes(rawAudience as LoginAudience)
      ? (rawAudience as LoginAudience)
      : undefined;

    return {
      redirect: (s.redirect as string) ?? undefined,
      error: (s.error as string) ?? undefined,
      audience,
    };
  },
  head: () => ({
    meta: [{ title: "Sign In · AVS Gold ERP" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, error, audience } = Route.useSearch();
  const native = isNativeApp();
  const activeAudience: LoginAudience = audience ?? "staff";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSuccess = async () => {
    const defaultRoute = await resolvePostLoginRoute("/app");
    const destination = sanitizeLoginRedirect(redirect, defaultRoute);
    void navigate({ to: destination as "/app", replace: true });
  };

  const setAudience = (next: LoginAudience) => {
    void navigate({
      to: "/login",
      search: { redirect, error, audience: next },
      replace: true,
    });
  };

  // 1. Packaged Native Mobile Shell (Capacitor APK/IPA only)
  if (native) {
    return (
      <AuthNativeShell>
        <div className="mx-auto w-full max-w-md">
          <AuthNativeBrandHeader />
          <AuthLayout
            onSuccess={() => void handleSuccess()}
            prefilledError={error}
            nativeMinimal
            audienceHint={AUDIENCE_HINTS[activeAudience]}
          />

          <section
            className="mt-5 space-y-3 rounded-lg border border-white/15 bg-[#14110f] p-4 text-white"
            data-testid="native-portal-access"
          >
            <h2 className="text-xs font-semibold tracking-wide text-[#B89454]">Portal & Invite Access</h2>
            <p className="text-[11px] leading-relaxed text-white/70">
              Customer, Karigar, and Supplier use this same sign-in. Your firm must invite you
              first — the invite assigns your role.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {PORTAL_AUDIENCE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`login-audience-${value}`}
                  onClick={() => setAudience(value)}
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-[11px] font-medium transition-colors",
                    activeAudience === value
                      ? "border-[#B89454] bg-[#B89454]/20 text-[#B89454] font-semibold"
                      : "border-white/15 text-white/80 hover:border-white/30 hover:text-white bg-white/5",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[11px] leading-relaxed text-white/80">
              {AUDIENCE_HINTS[activeAudience]}
            </p>

            <button
              type="button"
              data-testid="login-accept-invite"
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
              onClick={() => void navigate({ to: "/invite/accept" })}
            >
              Accept Invitation
            </button>
            <button
              type="button"
              data-testid="login-request-access"
              className="w-full text-center text-xs text-white/70 hover:text-white underline underline-offset-2 py-1"
              onClick={() => void navigate({ to: REQUEST_ACCESS_PATH })}
            >
              Don't have an account? Request Access
            </button>
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

  // 2. Authoritative Clean White Web Browser Login Page
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF9F6] dark:bg-background px-4 py-10 relative overflow-hidden font-sans">
      {/* Decorative Golden Ambient Glows */}
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#B89454]/10 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#B89454]/10 blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto space-y-6 relative z-10">
        {/* Core Sign-in Card */}
        <AuthLayout
          onSuccess={() => void handleSuccess()}
          prefilledError={error}
          nativeMinimal={false}
          audienceHint={AUDIENCE_HINTS[activeAudience]}
        />

        {/* Portal Audience & Invitation Helper Box */}
        <div className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-5 shadow-md space-y-3.5 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-border/60 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#9E7B3B] dark:text-[#B89454]">
              Portal & Role Access
            </h2>
            <span className="text-[10px] text-slate-500 dark:text-muted-foreground font-medium">
              Multi-Role Gateway
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">
            Staff, Customers, Karigars, and Suppliers sign in here. Your role and permissions are automatically assigned via invitation.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {PORTAL_AUDIENCE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`login-audience-${value}`}
                onClick={() => setAudience(value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-center",
                  activeAudience === value
                    ? "border-[#B89454] bg-[#B89454]/15 text-[#8C6D32] dark:text-[#B89454] font-semibold shadow-xs"
                    : "border-slate-200 dark:border-border bg-slate-50/70 dark:bg-muted/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-600 dark:text-muted-foreground bg-slate-50 dark:bg-muted/30 p-2.5 rounded-md border border-slate-100 dark:border-border/40 leading-relaxed">
            {AUDIENCE_HINTS[activeAudience]}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              data-testid="login-accept-invite"
              className="w-full rounded-lg border border-slate-300 dark:border-border bg-white dark:bg-card px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-muted/60 shadow-xs transition-colors"
              onClick={() => void navigate({ to: "/invite/accept" })}
            >
              Accept Invite
            </button>
            <button
              type="button"
              data-testid="login-request-access"
              className="w-full rounded-lg bg-[#B89454] hover:bg-[#A38245] px-3 py-2 text-xs font-semibold text-slate-950 shadow-xs transition-colors"
              onClick={() => void navigate({ to: REQUEST_ACCESS_PATH })}
            >
              Request Access
            </button>
          </div>
        </div>

        {/* Footer Legal & Privacy Links */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-muted-foreground pt-2">
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
          <span className="text-slate-400">Online Managed ERP</span>
        </div>
      </div>
    </div>
  );
}

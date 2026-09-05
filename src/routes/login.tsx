import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import {
  AuthNativeBrandHeader,
  AuthNativeShell,
} from "@/components/layout/AuthNativeShell";
import {
  resolvePostLoginRoute,
  sanitizeLoginRedirect,
} from "@/lib/auth/post-login-redirect";
import { REQUEST_ACCESS_PATH } from "@/lib/auth/public-signup-policy";
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
  ["staff", "Workshop staff"],
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
    meta: [{ title: "Login · MTJ / AVS ERP" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, error, audience } = Route.useSearch();
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
          className="mt-5 space-y-3 rounded-sm border border-white/15 bg-[#14110f] p-4"
          data-testid="native-portal-access"
        >
          <h2 className="text-xs font-semibold tracking-wide text-[#B89454]">Portal & invite</h2>
          <p className="text-[11px] leading-relaxed text-white/65">
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
                  "rounded-sm border px-2 py-2 text-[11px] font-medium transition-colors",
                  activeAudience === value
                    ? "border-[#B89454]/60 bg-[#B89454]/15 text-[#B89454]"
                    : "border-white/15 text-white/75 hover:border-white/30 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-white/70">
            {AUDIENCE_HINTS[activeAudience]}
          </p>

          <button
            type="button"
            data-testid="login-accept-invite"
            className="w-full rounded-sm border border-white/20 px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            onClick={() => void navigate({ to: "/invite/accept" })}
          >
            Accept invitation
          </button>
          <button
            type="button"
            data-testid="login-request-access"
            className="w-full text-center text-xs text-white/60 hover:text-white underline underline-offset-2 py-1"
            onClick={() => void navigate({ to: REQUEST_ACCESS_PATH })}
          >
            Don't have an invitation? Request Access
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

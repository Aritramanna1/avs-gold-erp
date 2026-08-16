/**
 * Subscription & Entitlement Access Gate — non-blocking shell startup.
 * Renders AppShell immediately; membership/subscription resolve in parallel.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  isSubscriptionAccessGranted,
  resolveSubscriptionAccess,
  useSubscriptionAccess,
} from "@/lib/identity/subscription-access-service";
import { useTenantContext } from "@/lib/identity/tenant-context-store";
import { BusinessSelectorScreen } from "@/components/identity/BusinessSwitcher";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ShieldAlert, CreditCard } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { recordStartupMetric } from "@/lib/performance/startup-metrics";

const RECHECK_MS = 6 * 60 * 60 * 1000;

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const branding = useSettings((s) => s.branding);
  const { checking, status, access, message, daysRemaining, organizationId } =
    useSubscriptionAccess();
  const {
    needsSelection,
    restoreLastOrSelect,
    loadMemberships,
    loading: membershipsLoading,
  } = useTenantContext();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        await loadMemberships();
        const resolved = await restoreLastOrSelect();
        if (!cancelled) {
          setBootstrapped(true);
          recordStartupMetric("session_restore", "membership+tenant");
        }
        if (resolved) await resolveSubscriptionAccess();
      } catch (e) {
        if (!cancelled) {
          setBootstrapError(e instanceof Error ? e.message : "Workspace bootstrap failed");
          setBootstrapped(true);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadMemberships, restoreLastOrSelect]);

  useEffect(() => {
    if (!bootstrapped) return;
    void resolveSubscriptionAccess({ organizationId });
    const id = window.setInterval(
      () => void resolveSubscriptionAccess({ organizationId }),
      RECHECK_MS,
    );
    return () => window.clearInterval(id);
  }, [bootstrapped, organizationId]);

  if (needsSelection) {
    return <BusinessSelectorScreen />;
  }

  const snapshot = useSubscriptionAccess.getState();
  if (bootstrapped && !checking && !isSubscriptionAccessGranted(snapshot)) {
    return (
      <SubscriptionRequiredScreen
        status={status}
        message={message}
        applicationName={branding.applicationName}
        access={access}
      />
    );
  }

  const showTrialBanner = status === "TRIAL_ACTIVE" || status === "TRIAL_EXPIRING";
  const workspaceLoading = !bootstrapped || membershipsLoading || checking;

  return (
    <>
      {workspaceLoading ? (
        <div
          className="border-b border-border bg-muted/40 px-4 py-1 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2"
          role="status"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Restoring workspace…
        </div>
      ) : null}
      {bootstrapError ? (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-1 text-center text-[11px] text-amber-800 dark:text-amber-200">
          {bootstrapError} — navigation remains available; data may be limited until retry.
        </div>
      ) : null}
      {showTrialBanner ? (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-1.5 text-center text-xs text-foreground">
          {branding.applicationName} trial
          {daysRemaining != null
            ? ` · ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
            : ""}
          {" · "}
          <Link to="/settings/license" className="underline hover:text-gold">
            Upgrade
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}

function SubscriptionRequiredScreen({
  status,
  message,
  applicationName,
  access,
}: {
  status: string;
  message: string | null;
  applicationName: string;
  access: string;
}) {
  const title =
    status === "SUSPENDED"
      ? "Account Suspended"
      : status === "PAYMENT_PENDING"
        ? "Payment Required"
        : "Subscription Required";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-md border border-gold/30 bg-card p-6 shadow-elegant">
        <div className="flex items-center gap-2 text-gold">
          <ShieldAlert className="h-6 w-6" />
          <h1 className="font-serif text-xl">
            {applicationName} · {title}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {message ?? "Your subscription needs attention. Your data is safely retained."}
        </p>
        <div className="space-y-2">
          {(access === "subscription_required" || access === "billing_only") && (
            <Button className="w-full gap-1.5" asChild>
              <Link to="/settings/license">
                <CreditCard className="h-4 w-4" /> Renew / Choose Plan
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full" asChild>
            <a href="mailto:support@avsjewellers.com">Contact AVS</a>
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-1.5"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" /> Log Out / Switch Account
          </Button>
        </div>
      </div>
    </div>
  );
}

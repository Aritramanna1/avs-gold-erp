/**
 * One-time assisted setup gate — redirects to /onboarding only on first login.
 * Returning tenants with completion flag or live data pass through immediately.
 */
import { useEffect, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useAppLoading } from "@/lib/app-loading-store";
import { useSettings } from "@/lib/settings-store";
import {
  isEstablishedWorkshopTenant,
  isOnboardingExemptPath,
  markAssistedSetupComplete,
  shouldRedirectToAssistedSetup,
} from "@/lib/identity/onboarding-gate-service";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const criticalLoadDone = useAppLoading((s) => s.criticalLoadDone);
  const initialLoadDone = useAppLoading((s) => s.initialLoadDone);
  const currentUserRole = useSettings((s) => s.currentUserRole);

  useEffect(() => {
    if (!initialLoadDone) return;
    if (isOnboardingExemptPath(pathname)) return;
    if (isEstablishedWorkshopTenant()) {
      markAssistedSetupComplete();
    }
  }, [initialLoadDone, pathname]);

  if (isOnboardingExemptPath(pathname)) {
    return <>{children}</>;
  }

  if (!criticalLoadDone || !initialLoadDone) {
    return <>{children}</>;
  }

  if (isEstablishedWorkshopTenant()) {
    return <>{children}</>;
  }

  if (shouldRedirectToAssistedSetup(pathname, currentUserRole)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, CatchBoundary, createRootRouteWithContext } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PlatformShell } from "@/components/platform-shell";
import { InteractiveGuidedTour } from "@/components/training/InteractiveGuidedTour";
import { ModuleSkeleton } from "@/components/module-skeleton";
import { AuthGate } from "@/components/auth-gate";
import { SubscriptionGate } from "@/components/subscription-gate";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { BackendGate } from "@/components/backend-gate";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { RouteErrorFallback } from "@/components/app-error-boundary";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { CookieConsentBanner } from "@/components/compliance/CookieConsentBanner";
import { KeyboardCheatSheet } from "@/components/keyboard/KeyboardCheatSheet";

const PrintPreviewModal = lazy(() =>
  import("@/components/print/PrintPreviewModal").then((module) => ({
    default: module.PrintPreviewModal,
  })),
);
const SessionLockOverlay = lazy(() =>
  import("@/components/security/SessionLockOverlay").then((module) => ({
    default: module.SessionLockOverlay,
  })),
);

function NotFoundComponent() {
  const erpHome = "/login";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen doesn't exist yet in AVS ERP.
        </p>
        <div className="mt-6">
          <Link
            to="/login"
            search={{ redirect: undefined, error: undefined, audience: undefined }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} />;
}

function RouteContentPending() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background p-4 md:p-8" aria-busy="true">
      <ModuleSkeleton />
    </div>
  );
}

import { useSettings, onSettingsPersistFailed } from "@/lib/settings-store";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: `${shortName} ERP — ${shopName}` },
        { name: "description", content: `Gold jewellery manufacturing ERP for ${shopName}.` },
      ],
    };
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useRouterState } from "@tanstack/react-router";
import { usePrintEngine } from "@/lib/print-engine";
import { logBackgroundError } from "@/lib/error-handling";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useRouterState({ select: (s) => s.location });
  const currentPath = location.pathname;

  const { isOpen, printUrl, printTitle, closePrint, pdfBlob, pdfFileName, shareCaption } =
    usePrintEngine();
  const [deferredChromeReady, setDeferredChromeReady] = useState(false);

  useEffect(() => {
    return onSettingsPersistFailed((message) => {
      toast.error(message);
    });
  }, []);

  const isPublic =
    [
      "/login",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/otp-login",
      "/invite",
      "/invite/accept",
      "/accept-invitation",
      "/verify",
      "/karigar-login",
      "/karigar-portal",
      "/customer-login",
      "/customer-portal",
      "/supplier-login",
      "/supplier-portal",
      "/privacy",
      "/terms",
    ].includes(currentPath) ||
    currentPath.startsWith("/invite/") ||
    currentPath.startsWith("/doc/") ||
    currentPath.startsWith("/verify/") ||
    currentPath.startsWith("/karigar-") ||
    currentPath.startsWith("/customer-") ||
    currentPath.startsWith("/supplier-");

  /**
   * A print route renders the DOCUMENT ONLY — no sidebar, no header, no app
   * chrome (see the `isPrintRoute` branch below, which skips AppShell entirely).
   *
   * The substring tests alone were not enough: `/workshop/receive-slip/:id` and
   * `/workshop/filings-slip/:id` are print documents that contain neither
   * "print" nor "-print", so they were rendering INSIDE the app shell — which is
   * how the sidebar could end up on a printed slip. Printable routes that don't
   * happen to have "print" in their name are listed explicitly instead of being
   * guessed at.
   */
  const PRINT_ROUTE_PREFIXES = ["/workshop/receive-slip/", "/workshop/filings-slip/"];

  const isPrintRoute =
    currentPath.includes("/print") ||
    currentPath.includes("-print") ||
    currentPath.includes("print-log") ||
    PRINT_ROUTE_PREFIXES.some((p) => currentPath.startsWith(p));

  // Global Keyboard Shortcuts Dispatcher (Ctrl+K, Alt+N, Alt+W, Alt+S, etc.)
  useGlobalShortcuts();

  useEffect(() => {
    setDeferredChromeReady(true);
  }, []);

  // Start non-essential developer helpers only after the shell has painted.
  // Production business data remains Supabase-authoritative; this avoids
  // debug/test chunks competing with authentication and first useful render.
  useEffect(() => {
    if (
      import.meta.env.DEV ||
      (typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname === "::1"))
    ) {
      console.log(`[startup] renderer mounted +${Math.round(performance.now())}ms`);
      import("@/lib/test-seed")
        .then((m) => {
          m.installTestSeedOnWindow();
        })
        .catch((e) => {
          console.error("Failed to load test seed:", e);
        });
      import("@/lib/settings-store").then((m) => {
        (window as any).__settingsStore = m;
      });
      import("@/lib/billing-store").then((m) => {
        (window as any).__billingStore = m;
      });
      import("@/lib/manufacturing-bill-store").then((m) => {
        (window as any).__mfgBillStore = m;
      });
      import("@/lib/ledger-store").then((m) => {
        (window as any).__ledgerEntries = () => m.useLedger.getState().entries;
      });
      // Permanent regression coverage exposes the same module surface used
      // during each feature's original validation.
      import("@/lib/security/audit-log").then((m) => {
        (window as any).__auditLog = m;
      });
      import("@/lib/security/session-lock").then((m) => {
        (window as any).__sessionLock = m;
      });
      import("@/lib/comm/service").then((m) => {
        (window as any).__commService = m.commService;
      });
      import("@/lib/comm/comm-queue").then((m) => {
        (window as any).__commQueue = m;
      });
      import("@/lib/security/device-registry").then((m) => {
        (window as any).__deviceRegistry = m;
      });
      import("@/lib/comm/automation-settings-store").then((m) => {
        (window as any).__automationSettings = m;
      });
      import("@/lib/reconciliation/gold-reconciliation").then((m) => {
        (window as any).__goldRecon = m;
      });
      import("@/lib/hardware-service").then((m) => {
        (window as any).__hardwareService = m.hardwareService;
      });
      import("@/lib/hardware-service").then(async (hw) => {
        const pq = await import("@/lib/print/print-queue");
        // submitPrintJob's real signature is job.type/{success,message,jobId,status}
        // (hardware-service.ts) — this thin adapter is the one place that
        // maps the test's docType/tagData vocabulary onto it, so the
        // regression suite exercises the actual production call path
        // rather than a second, parallel print entry point.
        (window as any).__printQueue = {
          submitPrintJob: (job: { docType: string; title: string; tagData?: unknown }) =>
            hw.hardwareService.submitPrintJob({
              type: job.docType as any,
              title: job.title,
              data: null,
              tagData: job.tagData as any,
            }),
          getPrintJobHistory: (limit?: number) => pq.getPrintJobHistory(limit),
        };
      });
    }
    const stops: Array<() => void> = [];
    let cancelled = false;
    const protect = (promise: Promise<unknown>, context: string) => {
      void promise.catch((error) => {
        logBackgroundError(error, context);
      });
    };
    const schedule = (delay: number, task: () => void) =>
      window.setTimeout(() => {
        if (cancelled) return;
        const idle = window.requestIdleCallback;
        if (idle) idle(task, { timeout: 3000 });
        else task();
      }, delay);

    const securityTimer = schedule(1_500, () => {
      protect(
        import("@/lib/security/session-lock").then((m) => {
          if (!cancelled) stops.push(m.startSessionLockMonitor());
        }),
        "startup.session-lock",
      );
    });

    // Firm-scoped background services (sync, comm queue, bullion rate polling,
    // backups, scheduled reports/reminders/reconciliation) have nothing to do
    // for a signed-out visitor and no firm to operate on. Starting them on
    // the login screen was pure waste — dozens of chunk fetches and network
    // calls before anyone authenticates. Gate on an actual session and start
    // once, either immediately (session already exists on mount) or on the
    // first sign-in.
    return () => {
      cancelled = true;
      window.clearTimeout(securityTimer);
      stops.forEach((stop) => stop());
    };
  }, []);

  const isMtgRoute = currentPath === "/mtg" || currentPath.startsWith("/mtg/");

  if (isMtgRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthGate>
              <SubscriptionGate>
                <BackendGate>
                  <CatchBoundary
                    getResetKey={() => currentPath}
                    errorComponent={RouteErrorFallback}
                  >
                    <Suspense fallback={<RouteContentPending />}>
                      <Outlet />
                    </Suspense>
                  </CatchBoundary>
                </BackendGate>
              </SubscriptionGate>
            </AuthGate>
            <Toaster position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  if (isPublic) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-background">
              <CatchBoundary getResetKey={() => currentPath} errorComponent={RouteErrorFallback}>
                <Suspense fallback={<RouteContentPending />}>
                  <Outlet />
                </Suspense>
              </CatchBoundary>
            </div>
            <CookieConsentBanner />
            <Toaster position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  if (isPrintRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthGate>
              <BackendGate>
                <div className="min-h-screen bg-white text-black">
                  <CatchBoundary
                    getResetKey={() => currentPath}
                    errorComponent={RouteErrorFallback}
                  >
                    <Suspense fallback={<RouteContentPending />}>
                      <Outlet />
                    </Suspense>
                  </CatchBoundary>
                </div>
              </BackendGate>
            </AuthGate>
            <Toaster position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthGate>
            <SubscriptionGate>
              <BackendGate>
                <WhatsNewDialog />
                <InteractiveGuidedTour />
                {currentPath.startsWith("/platform") ? (
                  <PlatformShell>
                    <CatchBoundary
                      getResetKey={() => currentPath}
                      errorComponent={RouteErrorFallback}
                    >
                      <Suspense fallback={<RouteContentPending />}>
                        <Outlet />
                      </Suspense>
                    </CatchBoundary>
                  </PlatformShell>
                ) : (
                  <AppShell>
                    <CatchBoundary
                      getResetKey={() => currentPath}
                      errorComponent={RouteErrorFallback}
                    >
                      <Suspense fallback={<RouteContentPending />}>
                        <Outlet />
                      </Suspense>
                    </CatchBoundary>
                  </AppShell>
                )}
              </BackendGate>
            </SubscriptionGate>
          </AuthGate>
          <Toaster position="top-center" />
          <CookieConsentBanner />
          <Suspense fallback={null}>
            {deferredChromeReady ? (
              <>
                <SessionLockOverlay />
                <KeyboardCheatSheet />
              </>
            ) : null}
            {isOpen ? (
              <PrintPreviewModal
                isOpen={isOpen}
                onClose={closePrint}
                title={printTitle}
                printUrl={printUrl}
                pdfBlob={pdfBlob}
                pdfFileName={pdfFileName}
                shareCaption={shareCaption}
              />
            ) : null}
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

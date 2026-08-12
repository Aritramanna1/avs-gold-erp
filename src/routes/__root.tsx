import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, CatchBoundary, createRootRouteWithContext } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { PlatformShell } from "@/components/platform-shell";
import { AuthGate } from "@/components/auth-gate";
import { LicenseGate } from "@/components/license-gate";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { BackendGate } from "@/components/backend-gate";
import { Toaster } from "@/components/ui/sonner";
import { RouteErrorFallback } from "@/components/app-error-boundary";

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
const GlobalCommandPalette = lazy(() =>
  import("@/components/GlobalCommandPalette").then((module) => ({
    default: module.GlobalCommandPalette,
  })),
);

function NotFoundComponent() {
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
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return <RouteErrorFallback error={error} reset={reset} />;
}

import { useSettings } from "@/lib/settings-store";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
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
import { reportUnexpectedError, showErrorToast } from "@/lib/error-handling";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useRouterState({ select: (s) => s.location });
  const currentPath = location.pathname;

  const { isOpen, printUrl, printTitle, closePrint } = usePrintEngine();

  const isPublic =
    [
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/otp-login",
      "/invite",
      "/invite/accept",
      "/verify",
    ].includes(currentPath) ||
    currentPath.startsWith("/invite/") ||
    currentPath.startsWith("/doc/");

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

  // Start non-essential services in stages after the shell has painted. This
  // avoids SQLite, network, and scheduler work competing with authentication
  // and the first useful render.
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
      import("@/lib/sync-engine").then((m) => {
        (window as any).__syncEngine = m;
      });
      import("@/lib/ledger-store").then((m) => {
        (window as any).__ledgerEntries = () => m.useLedger.getState().entries;
      });
      // Permanent regression coverage (e2e/tests/plan1-stabilization.spec.ts)
      // for the offline-first migration's later phases — exposes the same
      // module surface used during each feature's original validation.
      import("@/lib/security/audit-log").then((m) => {
        (window as any).__auditLog = m;
      });
      import("@/lib/local-db").then((m) => {
        (window as any).__localDb = m;
      });
      import("@/lib/security/device-registry").then((m) => {
        (window as any).__deviceRegistry = m;
      });
      import("@/lib/security/session-lock").then((m) => {
        (window as any).__sessionLock = m;
      });
      import("@/lib/comm/comm-queue").then((m) => {
        (window as any).__commQueue = m;
      });
      import("@/lib/comm/service").then((m) => {
        (window as any).__commService = m.commService;
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
      import("@/lib/print/print-queue").then((printQueueMod) => {
        import("@/lib/hardware-service").then((hw) => {
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
            getPrintJobHistory: printQueueMod.getPrintJobHistory,
          };
        });
      });
    }
    const stops: Array<() => void> = [];
    let cancelled = false;
    const protect = (promise: Promise<unknown>, context: string) => {
      void promise.catch((error) => {
        const normalized = reportUnexpectedError(error, context);
        showErrorToast(normalized);
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
        import("@/lib/security/device-registry").then((m) => m.registerThisDevice()),
        "startup.device-registry",
      );
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
    let servicesStarted = false;
    const startFirmScopedServices = () => {
      if (servicesStarted || cancelled) return;
      servicesStarted = true;
      const operationalTimer = schedule(6_000, () => {
        protect(
          import("@/lib/comm/comm-queue").then((m) => stops.push(m.startCommQueueScheduler())),
          "startup.comm-queue",
        );
        protect(
          import("@/lib/sync-engine").then((m) => stops.push(m.startSyncOutboxScheduler())),
          "startup.sync-engine",
        );
        protect(
          import("@/lib/bullion-rate-service").then((m) =>
            stops.push(m.startBullionRateScheduler()),
          ),
          "startup.bullion-rate",
        );
        protect(
          import("@/lib/security/backup-scheduler").then((m) =>
            stops.push(m.startBackupScheduler()),
          ),
          "startup.backup-scheduler",
        );
      });
      const automationTimer = schedule(12_000, () => {
        protect(
          Promise.all([
            import("@/lib/comm/scheduler"),
            import("@/lib/comm/scheduled-reports"),
            import("@/lib/comm/reminder-sweeps"),
            import("@/lib/reconciliation/scheduled-reconciliation"),
            import("@/lib/security/disaster-recovery"),
            import("@/lib/comm/scheduled-statements"),
          ]).then(
            ([scheduler, reports, reminders, reconciliation, disasterRecovery, statements]) => {
              reports.registerScheduledReportJobs();
              reminders.registerReminderSweeps();
              reconciliation.registerGoldReconciliationJob();
              disasterRecovery.registerDisasterRecoveryDrillJob();
              statements.registerWeeklyStatementJobs();
              if (!cancelled) stops.push(scheduler.startScheduler());
            },
          ),
          "startup.automation-scheduler",
        );
      });
      firmServiceTimers.push(operationalTimer, automationTimer);
    };

    const firmServiceTimers: number[] = [];
    let authUnsub: (() => void) | undefined;
    void import("@/lib/providers/data-provider").then(({ dataProvider }) => {
      if (cancelled) return;
      void dataProvider.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
        if (!cancelled && data.session) startFirmScopedServices();
      });
      const {
        data: { subscription },
      } = dataProvider.auth.onAuthStateChange((event: string) => {
        if (event === "SIGNED_IN") startFirmScopedServices();
      });
      authUnsub = () => subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(securityTimer);
      firmServiceTimers.forEach(window.clearTimeout);
      authUnsub?.();
      stops.forEach((stop) => stop());
    };
  }, []);

  if (isPublic) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-background">
              <CatchBoundary getResetKey={() => currentPath} errorComponent={RouteErrorFallback}>
                <Outlet />
              </CatchBoundary>
            </div>
            <Toaster richColors position="top-right" />
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
                    <Outlet />
                  </CatchBoundary>
                </div>
              </BackendGate>
            </AuthGate>
            <Toaster richColors position="top-right" />
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
            <LicenseGate>
              <BackendGate>
                <WhatsNewDialog />
                {currentPath.startsWith("/platform") ? (
                  <PlatformShell>
                    <CatchBoundary
                      getResetKey={() => currentPath}
                      errorComponent={RouteErrorFallback}
                    >
                      <Outlet />
                    </CatchBoundary>
                  </PlatformShell>
                ) : (
                  <AppShell>
                    <CatchBoundary
                      getResetKey={() => currentPath}
                      errorComponent={RouteErrorFallback}
                    >
                      <Outlet />
                    </CatchBoundary>
                  </AppShell>
                )}
              </BackendGate>
            </LicenseGate>
          </AuthGate>
          <Toaster richColors position="top-right" />
          <Suspense fallback={null}>
            <SessionLockOverlay />
            <GlobalCommandPalette />
            {isOpen ? (
              <PrintPreviewModal
                isOpen={isOpen}
                onClose={closePrint}
                title={printTitle}
                printUrl={printUrl}
              />
            ) : null}
          </Suspense>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

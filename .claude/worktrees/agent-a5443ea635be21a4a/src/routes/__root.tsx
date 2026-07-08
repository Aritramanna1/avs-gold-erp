import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";

import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { BackendGate } from "@/components/backend-gate";
import { Toaster } from "@/components/ui/sonner";
import { SessionLockOverlay } from "@/components/security/SessionLockOverlay";
import { GlobalCommandPalette } from "@/components/GlobalCommandPalette";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen doesn't exist yet in MTJ ERP.
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
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
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
import { useSupabaseSync } from "@/lib/supabase-sync";

function RootComponent() {
  useSupabaseSync();
  const { queryClient } = Route.useRouteContext();
  const location = useRouterState({ select: (s) => s.location });
  const currentPath = location.pathname;

  const [globalPrintOpen, setGlobalPrintOpen] = useState(false);
  const [globalPrintUrl, setGlobalPrintUrl] = useState("");
  const [globalPrintTitle, setGlobalPrintTitle] = useState("");

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

  const isPrintRoute =
    currentPath.includes("/print") ||
    currentPath.includes("-print") ||
    currentPath.includes("print-log");

  useEffect(() => {
    if (typeof window === "undefined" || isPrintRoute) return;

    function handleGlobalClick(e: MouseEvent) {
      const origin = e.target as HTMLElement | null;
      if (!origin) return;

      // Most "Print A4"/"Thermal"/etc. buttons are a <Button> (a <button>
      // element) wrapped INSIDE a router <Link> (an <a> with the real
      // href) — walking up and stopping at the first A-or-BUTTON tag would
      // stop at the inner <button>, which has no href/to attribute, so the
      // intercept silently never fired for the app's most common print
      // trigger pattern. closest("a[href]") finds the actual anchor
      // regardless of how many non-anchor elements (button, icon, span)
      // sit between the click target and it.
      const anchor = origin.closest("a[href]") as HTMLElement | null;
      let target: HTMLElement | null = anchor;
      if (!target) {
        // Fall back to the original walk for plain <button>-only triggers
        // (a button with its own onClick, not wrapped in a Link) that use
        // a `to`/data-attribute convention instead of a real href.
        target = origin;
        while (target && target.tagName !== "A" && target.tagName !== "BUTTON" && target.parentElement) {
          target = target.parentElement;
        }
      }
      if (!target) return;

      const href = target.getAttribute("href") || target.getAttribute("to");
      // Safe trap for print, slips, or tags
      if (
        href &&
        (href.includes("/print/") ||
          href.includes("-print") ||
          href.includes("/print-log") ||
          href.includes("slip")) &&
        !href.includes("javascript:")
      ) {
        e.preventDefault();
        e.stopPropagation();

        setGlobalPrintUrl(href);
        setGlobalPrintTitle(target.innerText?.trim() || "Print Preview");
        setGlobalPrintOpen(true);
      }
    }

    window.addEventListener("click", handleGlobalClick, { capture: true });
    return () => window.removeEventListener("click", handleGlobalClick, { capture: true });
  }, [isPrintRoute]);

  // Test-only seed helper — DEV builds only, for Playwright E2E harness.
  useEffect(() => {
    if (import.meta.env.DEV) {
      import("@/lib/test-seed").then((m) => m.installTestSeedOnWindow());
      // Exposes LocalDatabaseManager for Plan 1 Step 2 validation scripts.
      // Dormant otherwise — nothing in the app calls into local-db.ts unless
      // VITE_ENABLE_LOCAL_DB is set (see src/integrations/supabase/client.ts).
      import("@/lib/local-db").then((m) => {
        (window as unknown as { __localDb?: typeof m }).__localDb = m;
      });
      // Exposes createRepository for Plan 1 Step 3 (Local Write Engine)
      // validation scripts — lets a test drive saveLocal/updateLocal/
      // deleteLocal/bulkSaveLocal through the exact same code path stores use.
      import("@/lib/repositories/base-repository").then((m) => {
        (window as unknown as { __createRepository?: typeof m.createRepository }).__createRepository =
          m.createRepository;
      });
      // Exposes the sync engine for Plan 1 Step 4 validation scripts. Not
      // invoked automatically anywhere — no background sync loop is wired up.
      import("@/lib/sync-engine").then((m) => {
        (window as unknown as { __syncEngine?: typeof m }).__syncEngine = m;
      });
      // Exposes saveDirect for Step 4 conflict-detection validation scripts
      // (simulating a remote-side edit made outside our own outbox).
      import("@/lib/supabase-write").then((m) => {
        (window as unknown as { __saveDirect?: typeof m.saveDirect }).__saveDirect = m.saveDirect;
      });
      // Exposes the local file store for Plan 1 Step 6 validation scripts.
      import("@/lib/local-file-store").then((m) => {
        (window as unknown as { __fileStore?: typeof m }).__fileStore = m;
      });
      // Exposes the communication retry queue for validation scripts.
      import("@/lib/comm/comm-queue").then((m) => {
        (window as unknown as { __commQueue?: typeof m }).__commQueue = m;
      });
      // Exposes commService for validation scripts (e.g. monkey-patching
      // .send() to simulate a transient provider failure/recovery).
      import("@/lib/comm/service").then((m) => {
        (window as unknown as { __commService?: typeof m.commService }).__commService = m.commService;
      });
      // Exposes the audit log + device registry for Plan 1 Step 8 validation scripts.
      import("@/lib/security/audit-log").then((m) => {
        (window as unknown as { __auditLog?: typeof m }).__auditLog = m;
      });
      import("@/lib/security/device-registry").then((m) => {
        (window as unknown as { __deviceRegistry?: typeof m }).__deviceRegistry = m;
      });
      import("@/lib/security/session-lock").then((m) => {
        (window as unknown as { __sessionLock?: typeof m }).__sessionLock = m;
      });
      import("@/lib/comm/scheduler").then((m) => {
        (window as unknown as { __scheduler?: typeof m }).__scheduler = m;
      });
      import("@/lib/comm/automation-settings-store").then((m) => {
        (window as unknown as { __automationSettings?: typeof m }).__automationSettings = m;
      });
      import("@/lib/reconciliation/gold-reconciliation").then((m) => {
        (window as unknown as { __goldRecon?: typeof m }).__goldRecon = m;
      });
      import("@/lib/hardware-service").then((m) => {
        (window as unknown as { __hardwareService?: typeof m.hardwareService }).__hardwareService =
          m.hardwareService;
      });
      import("@/lib/thermal-printer").then((m) => {
        (window as unknown as { __thermalPrinter?: typeof m.thermalPrinterService }).__thermalPrinter =
          m.thermalPrinterService;
      });
      import("@/lib/hardware/tag-pdf-fallback").then((m) => {
        (window as unknown as { __tagPdfFallback?: typeof m }).__tagPdfFallback = m;
      });
      import("@/lib/print/print-queue").then((m) => {
        (window as unknown as { __printQueue?: typeof m }).__printQueue = m;
      });
      import("@/lib/comm/escalation").then((m) => {
        (window as unknown as { __escalation?: typeof m }).__escalation = m;
      });
      import("@/lib/comm/comm-analytics").then((m) => {
        (window as unknown as { __commAnalytics?: typeof m }).__commAnalytics = m;
      });
      import("@/lib/security/disaster-recovery").then((m) => {
        (window as unknown as { __disasterRecovery?: typeof m }).__disasterRecovery = m;
      });
      import("@/lib/security/key-management").then((m) => {
        (window as unknown as { __keyManagement?: typeof m }).__keyManagement = m;
      });
      import("@/lib/reports/inventory-lifecycle").then((m) => {
        (window as unknown as { __inventoryLifecycle?: typeof m }).__inventoryLifecycle = m;
      });
      import("@/lib/workflow/approval-workflow").then((m) => {
        (window as unknown as { __approvalWorkflow?: typeof m }).__approvalWorkflow = m;
      });
      import("@/lib/stone-tracking-store").then((m) => {
        (window as unknown as { __stoneTracking?: typeof m }).__stoneTracking = m;
      });
      import("@/lib/lot-batch-store").then((m) => {
        (window as unknown as { __lotBatches?: typeof m }).__lotBatches = m;
      });
      import("@/lib/reports/recent-activity").then((m) => {
        (window as unknown as { __recentActivity?: typeof m }).__recentActivity = m;
      });
      import("@/lib/saved-filters-store").then((m) => {
        (window as unknown as { __savedFilters?: typeof m }).__savedFilters = m;
      });
      import("@/lib/comm/reminder-sweeps").then((m) => {
        (window as unknown as { __reminderSweeps?: typeof m }).__reminderSweeps = m;
      });
    }
    // Background drain of any queued (previously failed) communications —
    // runs regardless of DEV/PROD, since a real install needs this too.
    import("@/lib/comm/comm-queue").then((m) => m.startCommQueueScheduler());
    // Registers daily/weekly/monthly report jobs and starts the background
    // scheduler that checks for due jobs every minute.
    Promise.all([
      import("@/lib/comm/scheduler"),
      import("@/lib/comm/scheduled-reports"),
      import("@/lib/comm/reminder-sweeps"),
      import("@/lib/reconciliation/scheduled-reconciliation"),
      import("@/lib/security/disaster-recovery"),
    ]).then(([scheduler, reports, reminders, reconciliation, disasterRecovery]) => {
      reports.registerScheduledReportJobs();
      reminders.registerReminderSweeps();
      reconciliation.registerGoldReconciliationJob();
      disasterRecovery.registerDisasterRecoveryDrillJob();
      scheduler.startScheduler();
    });
    // Registers this machine in the device registry (Plan 1 Step 8) and
    // starts idle-timeout session locking — both run in every build, not
    // just DEV, since real installs need them too.
    import("@/lib/security/device-registry").then((m) => m.registerThisDevice());
    let stopSessionLock: (() => void) | undefined;
    import("@/lib/security/session-lock").then((m) => {
      stopSessionLock = m.startSessionLockMonitor();
    });
    return () => stopSessionLock?.();
  }, []);

  if (isPublic) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-background">
              <Outlet />
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
                  <Outlet />
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
            <BackendGate>
              <AppShell>
                <Outlet />
              </AppShell>
            </BackendGate>
          </AuthGate>
          <Toaster richColors position="top-right" />
          <SessionLockOverlay />
          <GlobalCommandPalette />
          <PrintPreviewModal
            isOpen={globalPrintOpen}
            onClose={() => setGlobalPrintOpen(false)}
            title={globalPrintTitle}
            printUrl={globalPrintUrl}
          />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

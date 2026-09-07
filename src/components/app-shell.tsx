import { Link, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  Sun,
  Moon,
  Languages,
  LogOut,
  Repeat,
  User as UserIcon,
  Settings,
  ChevronDown,
  AlertTriangle,
  Sliders,
  Search,
} from "lucide-react";
import { type ReactNode, useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/lib/settings-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { GoldRateEditor } from "@/components/GoldRateEditor";
import { QuickCommandPalette } from "@/components/layout/QuickCommandPalette";
import { Sidebar } from "@/components/layout/Sidebar";
import { OfflineMenuBar } from "@/components/layout/OfflineMenuBar";
import { GlobalBreadcrumbs } from "@/components/layout/GlobalBreadcrumbs";
import { ErpStatusBar } from "@/components/desktop/ErpStatusBar";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { BranchSelector } from "@/components/branch-selector";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileAccountSheet } from "@/components/mobile/MobileAccountSheet";
import { MobileSearchButton } from "@/components/mobile/MobileSearchButton";
import { ConnectivityStrip } from "@/components/mobile/ConnectivityStrip";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { ALL_LANGUAGES, LANGUAGE_INFO } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useRoles } from "@/lib/rbac";
import { useAppLoading, markCriticalLoadDegraded } from "@/lib/app-loading-store";
import { ModuleSkeleton } from "@/components/module-skeleton";
import { StagedLoadPanel } from "@/components/staged-load-panel";
import { useStagedLoad } from "@/hooks/use-staged-load";
import { GuidedTourOffer } from "@/components/training/GuidedTourOffer";
import { MobileGuidedTour } from "@/components/mobile/MobileGuidedTour";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notification-bell";
import { PersonProfileAvatar } from "@/components/people/PersonProfileAvatar";
import { AssistantDrawer, openOrnexaAssistant } from "@/components/assistant/AssistantDrawer";
import { PageHeader } from "@/components/design-system";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { WorkspaceSwitcher } from "@/components/identity/WorkspaceSwitcher";
import { prefetchLikelyRoutes } from "@/lib/performance/route-prefetch";
import { recordRecentRoute, patchStartupPreferences } from "@/lib/startup-preferences";
import {
  applyDeviceLayoutAttributes,
  useDeviceClass,
  usePhoneChrome,
  useTabletChrome,
} from "@/hooks/use-device-class";
import { signOutAndLeave } from "@/lib/native/sign-out";

export { PageHeader };

export function triggerGoldRateEditor() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-gold-rate-editor"));
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  useNetworkStatus();
  const { language, setLanguage: setAppLanguage } = useLanguage();
  const { theme, setTheme, isDark } = useTheme();
  // Narrow selectors, not the whole store: the shell must not re-render on
  // every unrelated setState the startup pull storm fires (orders, ledger,
  // etc.). It only depends on these three slices.
  const goldRatePerGramPaise = useSettings((s) => s.goldRatePerGramPaise);
  const firm = useSettings((s) => s.firm);
  const branding = useSettings((s) => s.branding);
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const users = useSettings((s) => s.users);
  const { roles, email: currentEmail } = useRoles();
  const enableAiAssistant = useBusinessRules((s) => s.isEnabled("enable_ai_assistant"));
  const [goldRateOpen, setGoldRateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Gate the boot skeleton on the CRITICAL load (settings/branch), not the full
  // background pull - so the shell + route appear as soon as the layout's own
  // data is in, and operational modules fill in progressively underneath.
  const criticalLoadDone = useAppLoading((s) => s.criticalLoadDone);
  const criticalLoadFailed = useAppLoading((s) => s.criticalLoadFailed);
  const criticalLoadError = useAppLoading((s) => s.criticalLoadError);
  const stagedBoot = useStagedLoad({
    active: !criticalLoadDone && !criticalLoadFailed,
    done: criticalLoadDone,
    failed: criticalLoadFailed,
  });

  useEffect(() => {
    if (criticalLoadDone || criticalLoadFailed) return;
    if (stagedBoot.phase === "failed") {
      markCriticalLoadDegraded(
        "Connection timed out while loading workspace settings. You can retry from the banner.",
      );
    }
  }, [stagedBoot.phase, stagedBoot.elapsedMs, criticalLoadDone, criticalLoadFailed]);

  const lastBootRetryAt = useRef(0);
  function retryWorkspaceLoad() {
    const now = Date.now();
    if (now - lastBootRetryAt.current < 60_000) {
      console.warn("[app-shell] Boot retry debounced — wait 60s between full sync retries.");
      return;
    }
    lastBootRetryAt.current = now;
    void import("@/lib/data-loader").then((m) => m.retryCloudSync());
  }

  const currentUser = currentEmail
    ? users.find((u) => u.email.toLowerCase() === currentEmail.toLowerCase())
    : null;
  const displayName = currentUser?.name || currentEmail?.split("@")[0] || "User";
  const displayRole = currentUserRole || currentUser?.role || roles[0] || "—";

  const deviceClass = useDeviceClass();
  const isPhoneChrome = usePhoneChrome();
  const isTabletChrome = useTabletChrome();

  // Device-class owns html[data-layout]. Never clear tablet — CSS touch rules depend on it.
  useEffect(() => {
    applyDeviceLayoutAttributes(deviceClass);
  }, [deviceClass]);

  useEffect(() => {
    if (!isPhoneChrome) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/native/mobile-table-stamp").then((m) => {
      if (cancelled) return;
      stop = m.startMobileTableLabelStamp();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [isPhoneChrome]);

  useEffect(() => {
    recordRecentRoute(pathname);
    prefetchLikelyRoutes(displayRole);
  }, [pathname, displayRole]);

  useEffect(() => {
    const branchId = useSettings.getState().selectedBranchId;
    if (branchId) patchStartupPreferences({ lastActiveBranchId: branchId });
  }, [firm]);
  const initials =
    displayName
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  async function handleSignOut() {
    setIsSwitchingAccount(true);
    toast.loading("Signing out...");
    await signOutAndLeave();
  }

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true);
    toast.loading("Switching profile account...");
    await signOutAndLeave();
  }

  useEffect(() => {
    const handleOpen = () => setGoldRateOpen(true);
    window.addEventListener("open-gold-rate-editor", handleOpen);
    return () => {
      window.removeEventListener("open-gold-rate-editor", handleOpen);
    };
  }, []);

  // The mobile hamburger Sheet has no close-on-navigate behavior of its
  // own - its Sidebar's nav <Link>s don't call onOpenChange, so a route
  // change from a link clicked inside it would otherwise leave the drawer
  // sitting open over the new page. Reset on every pathname change instead.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const formattedGoldRate =
    goldRatePerGramPaise > 0
      ? `Rs. ${(goldRatePerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "Rs. NOT SET";

  const goldRateStatus = goldRatePerGramPaise > 0 ? "22K | Active" : "22K | awaiting setup";

  const shortName =
    branding.shortName ||
    (firm?.shopName
      ? firm.shopName
          .split(" ")
          .filter(Boolean)
          .map((w: string) => w[0])
          .join("")
          .toUpperCase() || firm.shopName.slice(0, 3).toUpperCase()
      : "ERP");

  return (
    <div
      className="min-h-[100dvh] h-[100dvh] max-h-[100dvh] flex w-full overflow-hidden bg-background text-foreground"
      id="app-shell-root"
    >
      <a
        href="#main-view-scroll-container"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:shadow-lg"
        onClick={() => {
          const el = document.getElementById("main-view-scroll-container");
          if (el) {
            el.setAttribute("tabindex", "-1");
            el.focus();
          }
        }}
      >
        Skip to main content
      </a>

      <div className="flex-1 flex flex-col min-w-0 min-h-0" id="main-content-wrapper">
        <header
          className="h-14 min-h-[var(--touch-target)] shrink-0 border-b border-border bg-card flex items-center gap-2 md:gap-3 px-3 md:px-6 overflow-x-auto overflow-y-hidden scrollbar-none"
          id="main-header"
        >
          {/* Phone: Offline menu tree in drawer. md+ uses OfflineMenuBar strip. */}
          <div className="flex md:hidden items-center" id="mobile-sidebar-trigger">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open Offline ERP menu"
                  className="p-2 rounded-sm border border-border hover:border-gold/50 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-colors active:scale-95"
                >
                  <Menu className="h-5 w-5 text-gold" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 bg-sidebar border-r border-sidebar-border w-[min(20rem,92vw)] h-full"
              >
                <Sidebar
                  onOpenGoldRateEditor={() => {
                    setSidebarOpen(false);
                    setGoldRateOpen(true);
                  }}
                  className="w-full h-full border-r-0"
                  compact
                />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-2 min-w-0" id="mobile-branding">
            <Logo variant="svg" className="h-8 w-8 object-contain shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{shortName}</span>
          </div>
          {isPhoneChrome || isTabletChrome ? <MobileSearchButton /> : null}

          <button
            type="button"
            onClick={() => setGoldRateOpen(true)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 lg:gap-2 lg:px-3 lg:py-1.5 transition-colors cursor-pointer text-current focus:outline-none ${
              goldRatePerGramPaise > 0
                ? "border-border bg-background/60 hover:border-gold/40 hover:bg-gold/5"
                : "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-500/20 shadow-sm animate-pulse"
            }`}
            id="header-gold-rate-trigger"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                goldRatePerGramPaise > 0 ? "bg-success animate-pulse" : "bg-red-500 animate-ping"
              }`}
            />
            <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Gold Rate
            </span>
            <span
              className={`font-serif text-xs md:text-sm leading-none ${goldRatePerGramPaise > 0 ? "text-gold" : "text-red-600 dark:text-red-400 font-semibold underline"}`}
            >
              {formattedGoldRate}
            </span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground">{goldRateStatus}</span>
          </button>

          {/* Quick Task Command Palette Button (Ctrl+K) */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
            }}
            className="hidden lg:flex items-center gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-gold/50 hover:bg-gold/5 hover:text-foreground transition-colors cursor-pointer"
            title="Quick Action Finder (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">Quick Tasks</span>
            <kbd className="rounded border bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2" data-desktop-chrome>
              <WorkspaceSwitcher compact />
              <BusinessSwitcher />
            </div>
            <div className="md:hidden">
              <MobileAccountSheet />
            </div>
            <div className="hidden sm:block" data-desktop-chrome>
              <BranchSelector />
            </div>

            {/* Quick Actions Search / Palette Trigger (Desktop / Laptop / Tablet) */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="hidden lg:flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background/60 hover:border-gold/50 hover:bg-gold/5 text-muted-foreground hover:text-foreground transition-all no-print cursor-pointer"
              title="Quick Search & Tasks (Ctrl+K)"
              aria-label="Quick Search and Tasks"
            >
              <Search className="h-3.5 w-3.5 text-gold" />
              <span>Quick Tasks</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/80 text-muted-foreground">Ctrl+K</kbd>
            </button>

            {/* Language — visible from tablet (md) up; was lg-only and missing on iPad */}
            <div
              className="relative hidden md:flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm bg-background/60 hover:border-gold/40 transition-colors no-print"
              id="header-lang-selector"
            >
              <Languages className="h-3.5 w-3.5 text-gold shrink-0" />
              <select
                className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-foreground pr-1"
                value={language}
                onChange={(e) => setAppLanguage(e.target.value as any)}
                id="header-lang-select"
                aria-label="Select language"
              >
                {ALL_LANGUAGES.map((code) => {
                  const info = LANGUAGE_INFO[code];
                  const label = code === "en" ? "EN" : info.native;
                  return (
                    <option
                      key={code}
                      value={code}
                      disabled={!info.enabled}
                      className="bg-popover text-foreground"
                    >
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {enableAiAssistant && (
              <button
                type="button"
                onClick={() => openOrnexaAssistant()}
                className="relative h-9 w-9 grid place-items-center rounded-full border border-border hover:border-gold/50 hover:bg-gold/10 transition-colors focus:outline-none cursor-pointer bg-transparent no-print"
                aria-label="Open Assistant (Ctrl+J)"
                title="Assistant (Ctrl+J)"
                id="header-assistant-trigger"
              >
                <Logo variant="svg" className="h-4 w-4 object-contain" />
              </button>
            )}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="relative h-9 w-9 grid place-items-center rounded-full border border-border hover:border-gold/50 transition-colors focus:outline-none cursor-pointer bg-transparent no-print"
              aria-label="Toggle Theme"
              id="theme-toggle"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-gold animate-spin-slow" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <NotificationBell />
            {/* User menu with Sign Out */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 pl-3 border-l border-border hover:opacity-80 transition-opacity focus:outline-none cursor-pointer"
                  id="user-menu-trigger"
                >
                  <div className="text-right hidden sm:block">
                    <div className="text-sm leading-tight font-medium">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">
                      {displayRole}
                    </div>
                  </div>
                  <PersonProfileAvatar
                    personId={currentUser?.id}
                    person={currentUser}
                    name={displayName}
                    isLoading={isSwitchingAccount}
                    className="h-9 w-9 rounded-md shrink-0"
                    data-testid="app-shell-user-avatar"
                  />
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  <div className="font-semibold text-foreground text-sm">{displayName}</div>
                  <div className="text-[11px] mt-0.5">{currentEmail}</div>
                  <div className="text-[10px] mt-0.5 text-gold">{displayRole}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {enableAiAssistant && (
                  <DropdownMenuItem
                    onSelect={() => openOrnexaAssistant()}
                    className="gap-2 cursor-pointer"
                  >
                    <Logo variant="svg" className="h-3.5 w-3.5 object-contain" /> Assistant (Ctrl+J)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    to="/control/customization"
                    search={{ tab: "fundamentals" }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Sliders className="h-3.5 w-3.5" /> Customization
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSwitchAccount} className="gap-2 cursor-pointer">
                  <Repeat className="h-3.5 w-3.5" /> Switch Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* Primary nav: Offline ERP menu + form strip (desktop, laptop, iPad) */}
        <OfflineMenuBar className="hidden md:block" />
        <GlobalBreadcrumbs />
        <ConnectivityStrip />
        <main
          className={
            isPhoneChrome
              ? "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y relative page-enter pb-[calc(var(--mobile-nav-height,4.25rem)+var(--ornexa-inset-bottom))]"
              : "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y relative page-enter pb-[max(0.5rem,var(--ornexa-inset-bottom))]"
          }
          id="main-view-scroll-container"
        >
          <MaintenanceNotice />
          {criticalLoadFailed && criticalLoadDone && criticalLoadError ? (
            <div
              className="mx-3 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2"
              role="status"
            >
              <span>
                {criticalLoadError ??
                  "Workspace settings incomplete — some rates or modules may be limited."}
              </span>
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={retryWorkspaceLoad}
              >
                Retry
              </button>
            </div>
          ) : null}
          <div className="min-h-full relative">
            {criticalLoadFailed && !criticalLoadDone ? (
              <div className="p-4 md:p-8 max-w-xl">
                <StagedLoadPanel
                  phase="failed"
                  title="We couldn’t load the workspace"
                  onRetry={retryWorkspaceLoad}
                  onGoHome={() => {
                    window.location.href = "/app";
                  }}
                  onReportIssue={() => {
                    window.location.href = `/settings/support?subject=${encodeURIComponent("Boot failure")}`;
                  }}
                />
              </div>
            ) : (
              children
            )}
            {!criticalLoadDone && !criticalLoadFailed && (
              <div
                className="absolute inset-0 z-10 bg-background/80 backdrop-blur-[1px] pointer-events-none"
                aria-hidden="true"
              >
                <ModuleSkeleton />
                {(stagedBoot.phase === "slow" || stagedBoot.phase === "retry") && (
                  <div className="absolute inset-x-0 bottom-8 flex justify-center px-4 pointer-events-auto">
                    <div className="w-full max-w-lg">
                      <StagedLoadPanel
                        phase={stagedBoot.phase}
                        title="Loading workspace"
                        onRetry={retryWorkspaceLoad}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <GuidedTourOffer />
          <MobileGuidedTour />
        </main>
        <ErpStatusBar />
        {isPhoneChrome ? <MobileBottomNav /> : null}
        <GoldRateEditor open={goldRateOpen} onOpenChange={setGoldRateOpen} />
        <QuickCommandPalette />
        {enableAiAssistant && <AssistantDrawer />}
      </div>
    </div>
  );
}

interface MaintenanceWindowNotice {
  id: string;
  title: string;
  message: string;
  status: "scheduled" | "active" | "resolved" | "cancelled";
  severity: "info" | "warning" | "critical";
  starts_at: string;
  ends_at: string | null;
}

function MaintenanceNotice() {
  const [notice, setNotice] = useState<MaintenanceWindowNotice | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMaintenanceWindow() {
      const now = new Date();
      const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data, error } = await (supabase as any)
        .from("platform_maintenance_windows")
        .select("id,title,message,status,severity,starts_at,ends_at")
        .in("status", ["active", "scheduled"])
        .lte("starts_at", soon.toISOString())
        .or(`ends_at.is.null,ends_at.gte.${now.toISOString()}`)
        .order("starts_at", { ascending: true })
        .limit(1);

      if (cancelled) return;
      if (error) {
        console.warn("[maintenance] Could not load maintenance window", error.message);
        return;
      }
      setNotice((data?.[0] as MaintenanceWindowNotice | undefined) ?? null);
    }

    loadMaintenanceWindow();
    const timer = window.setInterval(loadMaintenanceWindow, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!notice) return null;

  const starts = new Date(notice.starts_at).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ends = notice.ends_at
    ? new Date(notice.ends_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const active = notice.status === "active";
  const tone =
    notice.severity === "critical"
      ? "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300"
      : notice.severity === "warning"
        ? "border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        : "border-gold/40 bg-gold/10 text-foreground";

  return (
    <div className={`m-3 rounded-md border px-4 py-3 text-sm ${tone}`} role="status">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold">
            {active ? "Maintenance in progress" : "Scheduled maintenance"}: {notice.title}
          </div>
          <div className="mt-1 text-xs opacity-90">{notice.message}</div>
          <div className="mt-1 text-xs opacity-80">
            Starts {starts}
            {ends ? ` - Ends ${ends}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhasePlaceholder({
  phase,
  description,
  bullets,
}: {
  phase: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-sm border border-border bg-card p-6 md:p-8">
      <div className="inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Coming in {phase}
      </div>
      <p className="mt-4 text-muted-foreground max-w-2xl">{description}</p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm"
          >
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        This section is currently being refined for production use and will remain available with
        the latest verified workflow behavior.
      </p>
    </div>
  );
}

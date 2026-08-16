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
} from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/lib/settings-store";
import { GoldRateEditor } from "@/components/GoldRateEditor";
import { Sidebar } from "@/components/layout/Sidebar";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { BranchSelector } from "@/components/branch-selector";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileAccountSheet } from "@/components/mobile/MobileAccountSheet";
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
import { useAppLoading, markCriticalLoadFailed } from "@/lib/app-loading-store";
import { ModuleSkeleton } from "@/components/module-skeleton";
import { StagedLoadPanel } from "@/components/staged-load-panel";
import { useStagedLoad } from "@/hooks/use-staged-load";
import { GuidedTourOffer } from "@/components/training/GuidedTourOffer";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notification-bell";
import { AssistantDrawer, openOrnexaAssistant } from "@/components/assistant/AssistantDrawer";
import { PageHeader } from "@/components/design-system";
import { BusinessSwitcher } from "@/components/identity/BusinessSwitcher";
import { WorkspaceSwitcher } from "@/components/identity/WorkspaceSwitcher";
import { prefetchLikelyRoutes } from "@/lib/performance/route-prefetch";
import { recordRecentRoute } from "@/lib/startup-preferences";
import { patchStartupPreferences } from "@/lib/startup-preferences";

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
  const [goldRateOpen, setGoldRateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      markCriticalLoadFailed(
        "Connection timed out while loading workspace settings. Please retry.",
      );
    }
  }, [stagedBoot.phase, criticalLoadDone, criticalLoadFailed]);

  function retryWorkspaceLoad() {
    void import("@/lib/data-loader").then((m) => m.retryCloudSync());
  }

  const currentUser = currentEmail
    ? users.find((u) => u.email.toLowerCase() === currentEmail.toLowerCase())
    : null;
  const displayName = currentUser?.name || currentEmail?.split("@")[0] || "User";
  const displayRole = currentUserRole || currentUser?.role || roles[0] || "—";

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
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore API errors — local session is cleared regardless
    }
    // Hard reload to root: guarantees React state is wiped and AuthGate
    // renders the login form. The Playwright session-injected guard in
    // addInitScript detects the cleared token and will not re-inject it.
    window.location.href = "/";
  }

  async function handleSwitchAccount() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore API errors — local session is cleared regardless
    }
    window.location.href = "/";
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
    <div className="min-h-screen flex w-full bg-background text-foreground" id="app-shell-root">
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
      <Sidebar onOpenGoldRateEditor={() => setGoldRateOpen(true)} className="hidden lg:flex" />

      <div className="flex-1 flex flex-col min-w-0" id="main-content-wrapper">
        <header
          className="h-14 min-h-[var(--touch-target)] border-b border-border bg-card flex items-center gap-3 px-4 md:px-6"
          id="main-header"
        >
          {/* Tablet only: optional module drawer. Phones use bottom nav (Home / Master / Transactions). */}
          <div className="hidden md:flex lg:hidden items-center" id="mobile-sidebar-trigger">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  className="p-2 rounded-lg border border-border hover:border-gold/50 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 transition-colors active:scale-95"
                >
                  <Menu className="h-5 w-5 text-gold" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 bg-sidebar border-r border-sidebar-border w-64 h-full"
              >
                <Sidebar
                  onOpenGoldRateEditor={() => {
                    setSidebarOpen(false);
                    setGoldRateOpen(true);
                  }}
                  className="w-full h-full border-r-0"
                />
              </SheetContent>
            </Sheet>
          </div>

          <div className="lg:hidden flex items-center gap-2" id="mobile-branding">
            <Logo variant="svg" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-foreground">{shortName}</span>
          </div>

          <button
            type="button"
            onClick={() => setGoldRateOpen(true)}
            className={`hidden lg:flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors cursor-pointer text-current focus:outline-none ${
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Gold Rate
            </span>
            <span
              className={`font-serif text-sm leading-none ${goldRatePerGramPaise > 0 ? "text-gold" : "text-red-600 dark:text-red-400 font-semibold underline"}`}
            >
              {formattedGoldRate}
            </span>
            <span className="text-[10px] text-muted-foreground">{goldRateStatus}</span>
          </button>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              <WorkspaceSwitcher compact />
              <BusinessSwitcher />
            </div>
            <div className="md:hidden">
              <MobileAccountSheet />
            </div>
            <BranchSelector />

            {/* Quick Language Toggle */}
            <div
              className="relative flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm bg-background/60 hover:border-gold/40 transition-colors no-print"
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
            <button
              type="button"
              onClick={() => openOrnexaAssistant()}
              className="relative h-9 min-w-[var(--touch-target)] px-2.5 flex items-center gap-1.5 rounded-sm border border-border bg-background hover:bg-muted text-foreground transition-colors focus:outline-none cursor-pointer no-print"
              aria-label="Open Assistant (Ctrl+J)"
              id="header-ai-assistant-trigger"
              title="Assistant (Ctrl+J)"
            >
              <Logo variant="svg" className="h-4 w-4 object-contain" />
              <span className="text-xs font-medium hidden md:inline">Assistant</span>
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
                  <div className="h-9 w-9 rounded-md bg-primary grid place-items-center text-primary-foreground font-bold text-sm shrink-0">
                    {initials}
                  </div>
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
                <DropdownMenuItem asChild>
                  <Link
                    to="/control/customization"
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
        <main
          className="flex-1 overflow-y-auto relative page-enter pb-16 lg:pb-0"
          id="main-view-scroll-container"
        >
          <MaintenanceNotice />
          <div className="min-h-full relative">
            {criticalLoadFailed ? (
              <div className="p-4 md:p-8 max-w-xl">
                <StagedLoadPanel
                  phase="failed"
                  title="Workspace could not load"
                  onRetry={retryWorkspaceLoad}
                  onGoHome={() => {
                    window.location.href = "/";
                  }}
                  onReportIssue={() => {
                    window.location.href = `/settings/support?subject=${encodeURIComponent("Boot failure")}`;
                  }}
                />
                {criticalLoadError ? (
                  <p className="mt-3 text-xs text-muted-foreground font-mono break-all">
                    {criticalLoadError}
                  </p>
                ) : null}
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
        </main>
        <MobileBottomNav />
        <GoldRateEditor open={goldRateOpen} onOpenChange={setGoldRateOpen} />
        <AssistantDrawer />
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

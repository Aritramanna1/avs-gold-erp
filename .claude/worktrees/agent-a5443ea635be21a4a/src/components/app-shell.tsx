import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Menu,
  Sun,
  Moon,
  Languages,
  LogOut,
  User as UserIcon,
  Settings,
  ChevronDown,
} from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/lib/settings-store";
import { GoldRateEditor } from "@/components/GoldRateEditor";
import { Sidebar } from "@/components/layout/Sidebar";
import { Logo } from "@/components/ui/Logo";
import { BranchSelector } from "@/components/branch-selector";
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
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/rbac";
import { toast } from "sonner";

export function triggerGoldRateEditor() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-gold-rate-editor"));
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  useNetworkStatus();
  const { language, setLanguage: setAppLanguage } = useLanguage();
  const { theme, setTheme, isDark } = useTheme();
  const { goldRatePerGramPaise, firm, users } = useSettings();
  const { roles, email: currentEmail } = useRoles();
  const navigate = useNavigate();
  const [goldRateOpen, setGoldRateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentUser = currentEmail
    ? users.find((u) => u.email.toLowerCase() === currentEmail.toLowerCase())
    : null;
  const displayName = currentUser?.name || currentEmail?.split("@")[0] || "User";
  const displayRole = currentUser?.role || roles[0] || "Viewer";
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
      toast.success("Signed out successfully");
      navigate({ to: "/" });
    } catch {
      toast.error("Sign out failed — please try again");
    }
  }

  useEffect(() => {
    const handleOpen = () => setGoldRateOpen(true);
    window.addEventListener("open-gold-rate-editor", handleOpen);
    return () => {
      window.removeEventListener("open-gold-rate-editor", handleOpen);
    };
  }, []);

  const formattedGoldRate =
    goldRatePerGramPaise > 0
      ? `₹ ${(goldRatePerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "₹ NOT SET";

  const goldRateStatus = goldRatePerGramPaise > 0 ? "22K · Active" : "22K · awaiting setup";

  const shortName = firm?.shopName
    ? firm.shopName
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase() || firm.shopName.slice(0, 3).toUpperCase()
    : "ERP";

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
          className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center gap-4 px-4 md:px-8"
          id="main-header"
        >
          {/* Hamburger Menu Trigger for Tablets and Mobile */}
          <div className="lg:hidden flex items-center" id="mobile-sidebar-trigger">
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
            <span className="font-serif text-gold">{shortName}</span>
          </div>

          <button
            type="button"
            onClick={() => setGoldRateOpen(true)}
            className={`hidden lg:flex items-center gap-2 rounded-full border px-4 py-1.5 transition-colors cursor-pointer text-current focus:outline-none ${
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
            <BranchSelector />

            {/* Quick Language Toggle */}
            <div
              className="relative flex items-center gap-1 rounded-full border border-border px-2 py-1 text-sm bg-background/60 hover:border-gold/40 transition-colors no-print"
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
              aria-label="Notifications"
              className="relative h-9 w-9 grid place-items-center rounded-full border border-border hover:border-gold/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
            </button>
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
                  <div className="h-9 w-9 rounded-full gradient-gold grid place-items-center text-primary-foreground font-bold text-sm shrink-0">
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
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto" id="main-view-scroll-container">
          {children}
        </main>
        <GoldRateEditor open={goldRateOpen} onOpenChange={setGoldRateOpen} />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl text-gold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
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
    <div className="rounded-2xl border border-border bg-card p-8 shadow-elegant">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-gold">
        Coming in {phase}
      </div>
      <p className="mt-4 text-muted-foreground max-w-2xl">{description}</p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
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

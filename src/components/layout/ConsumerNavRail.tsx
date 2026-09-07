import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Home,
  Zap,
  BookOpen,
  Layers,
  ShoppingBag,
  Package,
  Hammer,
  Users,
  Receipt,
  FileSpreadsheet,
  TrendingDown,
  Sparkles,
  ChevronRight,
  FlameKindling,
  Scale,
  Plus,
} from "lucide-react";
import { AppLauncherDialog } from "./AppLauncherDialog";

interface ConsumerNavRailProps {
  className?: string;
}

export function ConsumerNavRail({ className = "" }: ConsumerNavRailProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);

  // Determine active primary section
  const activeSection = useMemo(() => {
    if (pathname === "/app" || pathname === "/") return "home";
    if (
      pathname.startsWith("/billing") ||
      pathname.startsWith("/workshop") ||
      pathname.startsWith("/manufacturing") ||
      pathname.startsWith("/stock") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/people") ||
      pathname.startsWith("/quotations") ||
      pathname.startsWith("/catalog") ||
      pathname.startsWith("/melt") ||
      pathname.startsWith("/hallmark")
    ) {
      return "operations";
    }
    if (
      pathname.startsWith("/ledger") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/expenses") ||
      pathname.startsWith("/bank") ||
      pathname.startsWith("/accounting")
    ) {
      return "finance";
    }
    return "more";
  }, [pathname]);

  // Contextual secondary action chips based on active workflow
  const contextualChips = useMemo(() => {
    if (activeSection === "operations") {
      return [
        { label: "New Sale", to: "/billing/new", icon: Plus, active: pathname === "/billing/new" },
        { label: "Sales & Invoices", to: "/billing", icon: Receipt, active: pathname === "/billing" },
        { label: "Ready Stock", to: "/stock", icon: Package, active: pathname.startsWith("/stock") },
        { label: "Karigar Gold Book", to: "/workshop/gold-book", icon: Hammer, active: pathname.startsWith("/workshop/gold-book") },
        { label: "Job Cards", to: "/manufacturing/jobs", icon: FlameKindling, active: pathname.startsWith("/manufacturing/jobs") },
        { label: "Customers", to: "/people?tab=customers", icon: Users, active: pathname.startsWith("/people") },
        { label: "Outside & Melting", to: "/workshop/outside-work", icon: FlameKindling, active: pathname.startsWith("/workshop/outside-work") },
      ];
    }
    if (activeSection === "finance") {
      return [
        { label: "General Ledger", to: "/ledger", icon: BookOpen, active: pathname === "/ledger" },
        { label: "Trial Balance", to: "/reports/account-balance", icon: Scale, active: pathname === "/reports/account-balance" },
        { label: "Profit & Loss", to: "/reports/total-profit", icon: FileSpreadsheet, active: pathname === "/reports/total-profit" },
        { label: "Day Book", to: "/reports/day-book", icon: Receipt, active: pathname === "/reports/day-book" },
        { label: "GST Reports", to: "/reports/gst", icon: FileSpreadsheet, active: pathname === "/reports/gst" },
        { label: "Expenses", to: "/expenses", icon: TrendingDown, active: pathname === "/expenses" },
        { label: "Bank Reconciliation", to: "/bank/reconciliation", icon: Scale, active: pathname.startsWith("/bank") },
      ];
    }
    // Default Home / Feed chips
    return [
      { label: "New Sale", to: "/billing/new", icon: Plus, active: false },
      { label: "Find Customer", to: "/people?tab=customers", icon: Users, active: false },
      { label: "Ready Stock", to: "/stock", icon: Package, active: false },
      { label: "Karigar Gold Book", to: "/workshop/gold-book", icon: Hammer, active: false },
      { label: "General Ledger", to: "/ledger", icon: BookOpen, active: false },
      { label: "Day Book", to: "/reports/day-book", icon: Receipt, active: false },
    ];
  }, [activeSection, pathname]);

  return (
    <>
      <div
        className={`bg-card/90 backdrop-blur-md border-b border-border/80 px-3 md:px-6 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 select-none no-print ${className}`}
        id="consumer-nav-rail"
      >
        {/* Left: 3-4 Core Consumer Primary Anchors */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <Link
            to="/app"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSection === "home"
                ? "bg-gold text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>

          <Link
            to="/billing"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSection === "operations"
                ? "bg-gold text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Operations</span>
          </Link>

          <Link
            to="/ledger"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeSection === "finance"
                ? "bg-gold text-black shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Books & Reports</span>
          </Link>

          <button
            type="button"
            onClick={() => setAppLauncherOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
            aria-label="Open App Launcher"
          >
            <Layers className="h-3.5 w-3.5 text-gold" />
            <span>Apps & Tools</span>
          </button>
        </div>

        {/* Right / Secondary Contextual Chips (YouTube category pills style) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <div className="hidden lg:flex items-center text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider mr-1 shrink-0">
            Quick Jump:
          </div>
          {contextualChips.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <Link
                key={idx}
                to={chip.to as any}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                  chip.active
                    ? "bg-secondary text-secondary-foreground border border-gold/40 shadow-xs font-semibold"
                    : "bg-background/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-gold/30"
                }`}
              >
                <Icon className={`h-3 w-3 ${chip.active ? "text-gold" : "text-muted-foreground"}`} />
                <span>{chip.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <AppLauncherDialog open={appLauncherOpen} onOpenChange={setAppLauncherOpen} />
    </>
  );
}

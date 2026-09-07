import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Home,
  Zap,
  BookOpen,
  Settings,
  Layers,
  ChevronRight,
} from "lucide-react";
import { AppLauncherDialog } from "./AppLauncherDialog";

interface WorkspaceNavRailProps {
  className?: string;
}

export function WorkspaceNavRail({ className = "" }: WorkspaceNavRailProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);

  // Match current active workspace
  const activeWorkspace = useMemo(() => {
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
      pathname.startsWith("/hallmark") ||
      pathname.startsWith("/repair") ||
      pathname.startsWith("/refinery") ||
      pathname.startsWith("/conversion") ||
      pathname.startsWith("/barcode")
    ) {
      return "operations";
    }
    if (
      pathname.startsWith("/ledger") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/expenses") ||
      pathname.startsWith("/bank") ||
      pathname.startsWith("/accounting") ||
      pathname.startsWith("/control/accounts") ||
      pathname.startsWith("/treasury") ||
      pathname.startsWith("/settlement")
    ) {
      return "accounts";
    }
    if (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/control") ||
      pathname.startsWith("/customization") ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/communications") ||
      pathname.startsWith("/whatsapp") ||
      pathname.startsWith("/branches") ||
      pathname.startsWith("/attendance")
    ) {
      return "settings";
    }
    return "home";
  }, [pathname]);

  const workspaces = [
    {
      id: "home",
      label: "Home",
      to: "/app",
      icon: Home,
    },
    {
      id: "operations",
      label: "Operations",
      to: "/billing",
      icon: Zap,
    },
    {
      id: "accounts",
      label: "Accounts",
      to: "/ledger",
      icon: BookOpen,
    },
    {
      id: "settings",
      label: "Settings",
      to: "/settings",
      icon: Settings,
    },
  ];

  return (
    <>
      <aside
        className={`w-16 lg:w-48 bg-sidebar/95 border-r border-sidebar-border shrink-0 flex flex-col justify-between py-3 select-none no-print transition-all duration-200 z-20 ${className}`}
        id="workspace-nav-rail"
        aria-label="Workspace Navigation"
      >
        {/* Primary Workspace Destinations */}
        <div className="flex flex-col gap-1.5 px-2">
          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = activeWorkspace === ws.id;
            return (
              <Link
                key={ws.id}
                to={ws.to as any}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer group ${
                  isActive
                    ? "bg-gold text-black font-semibold shadow-sm"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={ws.label}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-black" : "text-sidebar-foreground/80 group-hover:text-gold"}`} />
                <span className="hidden lg:inline truncate">{ws.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom: Apps & Tools Launcher Drawer */}
        <div className="px-2 pt-2 border-t border-sidebar-border/60">
          <button
            type="button"
            onClick={() => setAppLauncherOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer group"
            title="Apps & Utilities Launcher"
            aria-label="Open Apps and Utilities Drawer"
          >
            <Layers className="h-4 w-4 text-gold shrink-0 group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline truncate">All Apps</span>
          </button>
        </div>
      </aside>

      <AppLauncherDialog open={appLauncherOpen} onOpenChange={setAppLauncherOpen} />
    </>
  );
}

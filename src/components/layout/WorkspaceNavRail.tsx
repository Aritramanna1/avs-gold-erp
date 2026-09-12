import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Layers } from "lucide-react";
import { AppLauncherDialog } from "./AppLauncherDialog";
import { FIRM_PRIMARY_NAV } from "@/lib/firm-primary-nav";

interface WorkspaceNavRailProps {
  className?: string;
}

export function WorkspaceNavRail({ className = "" }: WorkspaceNavRailProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);

  return (
    <>
      <aside
        className={`w-16 lg:w-48 bg-sidebar/95 border-r border-sidebar-border shrink-0 flex flex-col justify-between py-3 select-none no-print transition-all duration-200 z-20 ${className}`}
        id="workspace-nav-rail"
        aria-label="Workspace Navigation"
      >
        {/* Primary Workspace Destinations: 7+More */}
        <div className="flex flex-col gap-1 px-2">
          {FIRM_PRIMARY_NAV.map((slot) => {
            const Icon = slot.icon;
            const isActive = slot.match(pathname);
            return (
              <Link
                key={slot.id}
                to={slot.to as any}
                search={slot.search as any}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer group ${
                  isActive
                    ? "bg-gold text-black font-semibold shadow-sm"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                title={slot.word}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? "text-black" : "text-sidebar-foreground/80 group-hover:text-gold"}`}
                />
                <span className="hidden lg:inline truncate">{slot.word}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom: Apps & Tools Launcher Drawer */}
        <div className="px-2 pt-2 border-t border-sidebar-border/60">
          <button
            type="button"
            onClick={() => setAppLauncherOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer group"
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

import { useState, useRef, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart,
  Hammer,
  Package,
  Scale,
  Users,
  FileSpreadsheet,
  Settings,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Check,
} from "lucide-react";
import {
  getActiveWorkspace,
  WORKSPACES,
  type WorkspaceDefinition,
} from "@/lib/workspace-registry";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof ShoppingCart> = {
  ShoppingCart,
  Hammer,
  Package,
  Scale,
  Users,
  FileSpreadsheet,
  Settings,
};

export function WorkspaceHeader() {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const workspace = getActiveWorkspace(pathname);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsSwitcherOpen(false);
      }
    }
    if (isSwitcherOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSwitcherOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsSwitcherOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!workspace) return null;

  const Icon = ICONS[workspace.iconName] || Sparkles;
  const workspaceList = Object.values(WORKSPACES);

  return (
    <div
      className="border-b border-border/80 bg-card/60 backdrop-blur-md px-3 md:px-6 py-2.5 shrink-0 flex flex-col gap-2 no-print relative z-20"
      id="workspace-contextual-bar"
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/app"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0 font-medium"
            title="Return to Home Dashboard"
          >
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />

          {/* Workspace Switcher Trigger */}
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setIsSwitcherOpen((prev) => !prev)}
              className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-foreground hover:text-gold transition-colors py-1 px-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
              aria-expanded={isSwitcherOpen}
              aria-haspopup="true"
              title="Click to switch workspace"
            >
              <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${workspace.accentColor}`}>
                <Icon className="h-3 w-3" />
              </div>
              <span className="truncate">{workspace.title}</span>
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", isSwitcherOpen && "rotate-180")} />
            </button>

            {/* Workspace Switcher Dropdown */}
            {isSwitcherOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
                  Switch Workspace
                </div>
                <div className="flex flex-col gap-0.5">
                  {workspaceList.map((ws) => {
                    const WsIcon = ICONS[ws.iconName] || Sparkles;
                    const isCurrent = ws.id === workspace.id;
                    return (
                      <Link
                        key={ws.id}
                        to={ws.baseRoute}
                        onClick={() => setIsSwitcherOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                          isCurrent
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-foreground hover:bg-muted/70",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${ws.accentColor}`}>
                            <WsIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{ws.title}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{ws.subtitle}</div>
                          </div>
                        </div>
                        {isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden sm:block text-[11px] text-muted-foreground truncate">
          {workspace.subtitle}
        </div>
      </div>

      {/* Layer 3: Contextual Workspace Sub-Navigation */}
      <nav
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 -mx-1 px-1"
        aria-label={`${workspace.title} navigation`}
      >
        {workspace.items.map((item) => {
          const isActive =
            pathname === item.to ||
            (item.to !== workspace.baseRoute && pathname.startsWith(item.to));

          return (
            <Link
              key={item.id}
              to={item.to}
              search={item.search as any}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                  : "bg-background/80 text-muted-foreground hover:text-foreground border-border hover:border-gold/40 hover:bg-gold/5",
              )}
              title={item.description}
            >
              <span>{item.title}</span>
              {item.badge && (
                <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

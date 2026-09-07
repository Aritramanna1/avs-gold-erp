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
  Sparkles,
} from "lucide-react";
import { getActiveWorkspace, type WorkspaceDefinition } from "@/lib/workspace-registry";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const workspace = getActiveWorkspace(pathname);

  if (!workspace) return null;

  const Icon = ICONS[workspace.iconName] || Sparkles;

  return (
    <div
      className="border-b border-border/80 bg-card/60 backdrop-blur-md px-3 md:px-6 py-2.5 shrink-0 flex flex-col gap-2 no-print"
      id="workspace-contextual-bar"
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/app"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
            title="Return to Home"
          >
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <Link
            to={workspace.baseRoute}
            className="flex items-center gap-1.5 font-bold text-xs md:text-sm text-foreground hover:text-gold transition-colors shrink-0"
          >
            <div className={`h-5 w-5 rounded flex items-center justify-center ${workspace.accentColor}`}>
              <Icon className="h-3 w-3" />
            </div>
            <span>{workspace.title}</span>
          </Link>
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

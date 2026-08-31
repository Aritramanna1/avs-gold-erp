import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { requireOrganizationFeature, hasOrganizationFeature } from "@/lib/identity/feature-gate";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import {
  Package,
  ShoppingBag,
  ArrowLeftRight,
  Users,
  Banknote,
  BarChart3,
  Receipt,
  Gem,
} from "lucide-react";

type MtgModule = {
  to: string;
  label: string;
  icon: typeof Package;
  end?: boolean;
};

const MTG_MODULES: MtgModule[] = [
  { to: "/mtg", label: "Home", icon: Package, end: true },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/billing", label: "Sale", icon: Receipt },
  { to: "/workshop", label: "Workshop", icon: Gem },
  { to: "/ledger", label: "Settlement", icon: Banknote },
  { to: "/people", label: "Parties", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export const Route = createFileRoute("/mtg")({
  beforeLoad: ({ location }) => {
    guardRoute(location.pathname);
    if (!hasOrganizationFeature("business.mtg_shell")) {
      throw redirect({ to: "/app" });
    }
  },
  component: MtgShellLayout,
});

function MtgShellLayout() {
  const firm = useSettings((s) => s.firm);
  const manubookEnabled = firm?.manubookEnabled === true;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="md:w-56 border-b md:border-b-0 md:border-r bg-muted/20 shrink-0">
        <div className="p-4 border-b">
          <p className="text-xs uppercase tracking-wider text-gold font-semibold">MTG Edition</p>
          <p className="text-sm font-medium truncate">{firm?.shopName ?? "Workshop"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Gold + cash shown separately</p>
        </div>
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
          {MTG_MODULES.map((m) => (
            <Link
              key={m.to}
              to={m.to as "/mtg"}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-md text-sm whitespace-nowrap",
                "hover:bg-muted transition-colors [&.active]:bg-gold/10 [&.active]:text-gold",
              )}
              activeOptions={m.end ? { exact: true } : undefined}
            >
              <m.icon className="h-4 w-4 shrink-0" />
              {m.label}
            </Link>
          ))}
          {manubookEnabled ? (
            <Link
              to={"/ledger" as "/ledger"}
              className="flex items-center gap-2 px-3 py-2.5 min-h-11 rounded-md text-sm hover:bg-muted"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Manubook
            </Link>
          ) : null}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

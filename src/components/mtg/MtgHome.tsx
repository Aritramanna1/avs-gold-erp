/**
 * MTG (Ma Tara) workshop edition — extremely simple home actions.
 * Only rendered when edition_family=mtg. Does not fork ERP engines.
 */
import { Link } from "@tanstack/react-router";
import {
  Package,
  ShoppingBag,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  FlameKindling,
  Sparkles,
  Hammer,
  User,
  Banknote,
  BarChart3,
  TrendingDown,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useTenantEntitlements } from "@/lib/tenant-entitlements";
import { useSettings } from "@/lib/settings-store";

type MtgAction = {
  to: string;
  label: string;
  icon: LucideIcon;
  feature?: string;
  search?: Record<string, string>;
};

const MTG_ACTIONS: MtgAction[] = [
  { to: "/stock", label: "STOCK", icon: Package, feature: "inventory" },
  { to: "/billing", label: "SALE", icon: Receipt, feature: "billing" },
  {
    to: "/billing",
    label: "PURCHASE",
    icon: ClipboardList,
    feature: "billing",
    search: { mode: "purchase" },
  },
  { to: "/orders", label: "ORDER", icon: ShoppingBag, feature: "orders" },
  {
    to: "/workshop/gold-book",
    label: "ISSUE",
    icon: ArrowUpRight,
    feature: "manufacturing",
    search: { entry: "given" },
  },
  {
    to: "/workshop/gold-book",
    label: "RECEIVE",
    icon: ArrowDownLeft,
    feature: "manufacturing",
    search: { entry: "return" },
  },
  { to: "/melt", label: "MELTING", icon: FlameKindling, feature: "melt_account" },
  { to: "/workshop/polishing", label: "POLISHING", icon: Sparkles, feature: "manufacturing" },
  {
    to: "/people",
    label: "KARIGAR",
    icon: Hammer,
    feature: "manufacturing",
    search: { tab: "karigars" },
  },
  { to: "/people", label: "CUSTOMER", icon: User, search: { tab: "customers" } },
  { to: "/settlement/new", label: "SETTLEMENT", icon: Banknote },
  { to: "/reports", label: "REPORTS", icon: BarChart3, feature: "reports" },
  { to: "/expenses", label: "EXPENSE", icon: TrendingDown },
];

export function MtgHome() {
  const firm = useSettings((s) => s.firm);
  const hasFeature = useTenantEntitlements((s) => s.hasFeature);
  const loaded = useTenantEntitlements((s) => s.loaded);
  const planName = useTenantEntitlements((s) => s.planName);

  const actions = MTG_ACTIONS.filter((a) => {
    if (!a.feature) return true;
    if (!loaded) return true;
    return hasFeature(a.feature);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700/80">
          {planName ?? "MTG"}
        </p>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {firm?.shopName || "Workshop"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose an action. Advanced settings stay under Admin.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={`${action.label}-${action.to}`}
              to={action.to}
              search={action.search as never}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/80 bg-gradient-to-b from-amber-50/80 to-background px-3 py-8 text-center shadow-sm transition hover:border-amber-500/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 transition group-hover:bg-amber-500/25">
                <Icon className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <span className="text-sm font-bold tracking-wide text-foreground">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

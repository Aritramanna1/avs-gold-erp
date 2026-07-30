import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Users,
  ClipboardCheck,
  ShoppingBag,
  Sparkles,
  Hammer,
  Wrench,
  Package,
  ScanLine,
  Receipt,
  Scale,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  MessageSquare,
  LifeBuoy,
  Building2,
  TrendingDown,
  Mail,
  FlameKindling,
  Cpu,
} from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { useModuleStore } from "@/lib/module-store";
import {
  isPilotHiddenModule,
  RETAIL_COMING_SOON_MESSAGE,
  ATTENDANCE_COMING_SOON_MESSAGE,
} from "@/lib/pilot-config";
import { usePermissions } from "@/lib/use-permissions";
import { Logo } from "@/components/ui/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from "react";

// Manufacturing Mode pilot: ordered to follow the production workflow
// (intake → job execution → finished goods → materials/gold → money →
// supporting/admin) rather than the prior alphabetical-ish grouping.
export const navigationItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/people", label: "People / KYC", icon: Users },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/catalog", label: "Catalog", icon: Sparkles },
  { to: "/workshop/gold-book", label: "Worker Gold Book", icon: BookOpen },
  { to: "/workshop", label: "Manufacturing Books", icon: Hammer },
  { to: "/barcode", label: "Barcode & Tagging", icon: ScanLine },
  { to: "/melt", label: "Melt Account", icon: FlameKindling },
  { to: "/stock", label: "Ready Stock", icon: Package },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/ledger", label: "Gold Stock", icon: BookOpen },
  {
    to: "/communications",
    label: "Communications",
    icon: MessageSquare,
  },
  { to: "/repair", label: RETAIL_COMING_SOON_MESSAGE, icon: ShoppingBag, retailOnly: true },
  {
    to: "/attendance",
    label: ATTENDANCE_COMING_SOON_MESSAGE,
    icon: ClipboardCheck,
    comingSoon: true,
  },
  { to: "/expenses", label: "Expenses", icon: TrendingDown },
  { to: "/dashboard/ceo", label: "CEO Dashboard", icon: Building2 },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/manufacturing", label: "Manufacturing", icon: Wrench },
  { to: "/hardware", label: "Hardware Integrations", icon: Cpu },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/help", label: "Help & Guide", icon: LifeBuoy },
] as const;

const labelKeys: Record<string, string> = {
  "/": "home",
  "/people": "peopleKyc",
  "/communications": "communications",
  "/orders": "orders",
  "/catalog": "catalog",
  "/workshop": "workshop",
  "/workshop/gold-book": "workerGoldBook",
  "/stock": "stock",
  "/barcode": "barcodeTagging",
  "/billing": "billing",
  "/ledger": "ledger",
  "/expenses": "expenses",
  "/branches": "branches",
  "/reports": "reports",
  "/hardware": "hardware",
  "/settings": "settings",
  "/help": "helpGuide",
};

interface SidebarProps {
  onOpenGoldRateEditor: () => void;
  className?: string;
}

export function Sidebar({ onOpenGoldRateEditor, className = "" }: SidebarProps) {
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Narrow selectors: the sidebar must not re-render on every unrelated
  // setState the startup pull storm fires — only these three slices matter.
  const goldRatePerGramPaise = useSettings((s) => s.goldRatePerGramPaise);
  const goldRate24KPerGramPaise = useSettings((s) => s.goldRate24KPerGramPaise);
  const firm = useSettings((s) => s.firm);
  const branding = useSettings((s) => s.branding);
  const moduleStates = useModuleStore((s) => s.moduleStates);
  const permissions = usePermissions();

  const filteredItems = useMemo(() => {
    const mStore = useModuleStore.getState();

    const pathModuleMap: Record<string, import("@/lib/module-store").ERPModuleKey> = {
      "/attendance": "attendance",
      "/orders": "orders",
      "/catalog": "inventory",
      "/workshop": "job_work",
      "/workshop/gold-book": "payroll",
      "/manufacturing": "manufacturing",
      "/melt": "melt_account",
      "/stock": "inventory",
      "/barcode": "barcode",
      "/hardware": "hardware_integration",
      "/billing": "billing",
      "/ledger": "billing",
      "/expenses": "billing",
      "/reports": "reports",
      "/dashboard/ceo": "analytics",
      "/communications": "crm_communications",
      "/repair": "repairs",
    };

    const isAllowed = (path: string) => {
      const key = pathModuleMap[path];
      if (!key) return true;
      if (isPilotHiddenModule(key)) return true; // still shown as a disabled placeholder, not filtered out
      return mStore.isModuleEnabled(key);
    };

    const allowed = navigationItems.filter(
      (item) => isAllowed(item.to) && permissions.can(item.to),
    );
    const isDeferred = (item: (typeof navigationItems)[number]) =>
      ("comingSoon" in item && item.comingSoon) || ("retailOnly" in item && item.retailOnly);
    // Stable partition: deferred/placeholder modules sink to the bottom,
    // active modules keep their production-workflow order above them.
    return [...allowed.filter((i) => !isDeferred(i)), ...allowed.filter(isDeferred)];
  }, [moduleStates, permissions]);

  const shopInitials = firm?.shopName
    ? firm.shopName
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "ERP";

  const formattedGoldRate =
    goldRatePerGramPaise > 0
      ? `₹ ${(goldRatePerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "NOT SET";

  const formattedGoldRate24 =
    goldRate24KPerGramPaise > 0
      ? `₹ ${(goldRate24KPerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "NOT SET";

  return (
    <aside
      className={`flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground ${className}`}
      id="app-sidebar-main"
    >
      {/* Branding Header */}
      <div
        className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border"
        id="sidebar-branding"
      >
        <Logo variant="svg" className="h-11 w-11 object-contain animate-fade-in" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight text-gold truncate">
            {branding.shortName || `${shopInitials} ERP`}
          </div>
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold truncate"
            title={firm?.shopName}
          >
            {firm?.shopName}
          </div>
        </div>
      </div>

      {/* Gold Rate Widget */}
      <div
        className="px-4 py-3 mx-3 mt-3.5 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/60 hover:border-gold/30 transition-all group"
        id="sidebar-gold-widget"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full animate-pulse ${goldRatePerGramPaise > 0 ? "bg-success" : "bg-warning"}`}
            />
            {t("navigation.liveMetalRates")}
          </div>
          <button
            type="button"
            onClick={onOpenGoldRateEditor}
            className="text-[10px] text-gold hover:text-gold-light underline cursor-pointer bg-transparent border-0 p-0 font-medium focus:outline-none"
            id="sidebar-rate-update-action"
          >
            {t("navigation.update")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-sidebar/50 p-2 rounded-lg border border-sidebar-border/30">
            <span className="text-[9px] text-muted-foreground block font-semibold">22K / 916</span>
            <span
              className={`font-serif text-xs font-semibold leading-tight ${goldRatePerGramPaise > 0 ? "text-gold" : "text-red-500 dark:text-red-400 underline animate-pulse"}`}
            >
              {formattedGoldRate}
            </span>
          </div>
          <div className="bg-sidebar/50 p-2 rounded-lg border border-sidebar-border/30">
            <span className="text-[9px] text-muted-foreground block font-semibold">24K Pure</span>
            <span
              className={`font-serif text-xs font-semibold leading-tight ${goldRate24KPerGramPaise > 0 ? "text-amber-500" : "text-red-500 dark:text-red-400 underline animate-pulse"}`}
            >
              {formattedGoldRate24}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" id="sidebar-navigation">
        {filteredItems.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : (pathname === item.to || pathname.startsWith(`${item.to}/`)) &&
                !filteredItems.some(
                  (candidate) =>
                    candidate.to !== item.to &&
                    candidate.to.length > item.to.length &&
                    (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`)),
                );
          const Icon = item.icon;
          const translationKey = labelKeys[item.to];
          const translatedLabel = translationKey ? t(`navigation.${translationKey}`) : item.label;
          const isComingSoonPlaceholder =
            ("retailOnly" in item && item.retailOnly) || ("comingSoon" in item && item.comingSoon);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                isComingSoonPlaceholder
                  ? "text-sidebar-foreground/60 italic hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  : active
                    ? "bg-sidebar-accent text-gold font-medium shadow-[inset_3px_0_0_0_#d4af37]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${isComingSoonPlaceholder ? "text-sidebar-foreground/40" : active ? "text-gold" : "text-muted-foreground"}`}
              />
              <span className="min-w-0 flex-1 truncate">{translatedLabel}</span>
              {isComingSoonPlaceholder && (
                <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[8px] font-bold not-italic uppercase tracking-wider text-gold">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground/75 flex items-center justify-between"
        id="sidebar-info-footer"
      >
        <span>v1.0 · pilot</span>
        <div className="flex items-center gap-1.5 text-[10px] text-success font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-success inline-block animate-ping" />
          <span>{t("navigation.secureLogs")}</span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Customer / Supplier / Karigar phone bottom nav.
 * Rendered only under PortalShell when usePhoneChrome() is true — not on tablet.
 */
import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Calendar,
  ClipboardCheck,
  Coins,
  FileText,
  Hammer,
  LayoutGrid,
  MessageCircle,
  MoreHorizontal,
  Package,
  PackageCheck,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type PortalKind = "customer" | "supplier" | "karigar";

const CUSTOMER_TABS = [
  { tab: "dashboard", label: "Home", icon: LayoutGrid },
  { tab: "orders", label: "Orders", icon: Package },
  { tab: "invoices", label: "Bills", icon: Receipt },
  { tab: "kyc", label: "KYC", icon: ShieldCheck },
  { tab: "support", label: "Help", icon: MessageCircle },
] as const;

const SUPPLIER_TABS = [
  { tab: "dashboard", label: "Home", icon: LayoutGrid },
  { tab: "purchases", label: "Purchases", icon: Package },
  { tab: "jobs", label: "Jobs", icon: FileText },
  { tab: "kyc", label: "KYC", icon: ShieldCheck },
] as const;

const KARIGAR_PRIMARY_TABS = [
  { tab: "jobs", label: "Jobs", icon: Hammer },
  { tab: "gold", label: "Gold", icon: Coins },
  { tab: "hisab", label: "Hisab", icon: FileText },
  { tab: "work", label: "Work", icon: PackageCheck },
] as const;

const KARIGAR_MORE_TABS = [
  { tab: "qc", label: "QC Rejections", icon: ClipboardCheck },
  { tab: "performance", label: "Settlement", icon: TrendingUp },
  { tab: "attendance", label: "Attendance", icon: Calendar },
  { tab: "kyc", label: "KYC", icon: ShieldCheck },
] as const;

const KARIGAR_MORE_TAB_IDS = new Set<string>(KARIGAR_MORE_TABS.map((t) => t.tab));

export function PortalMobileBottomNav({
  portalPath,
  kind = "karigar",
}: {
  portalPath: "/customer-portal" | "/supplier-portal" | "/karigar-portal" | string;
  kind?: PortalKind;
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const search = useRouterState({ select: (s) => (s.location.search as { tab?: string }) ?? {} });
  const defaultTab = kind === "karigar" ? "jobs" : "dashboard";
  const activeTab = search.tab ?? defaultTab;

  if (kind === "karigar") {
    const moreActive = KARIGAR_MORE_TAB_IDS.has(activeTab);

    return (
      <>
        <nav
          className="mobile-bottom-nav"
          data-device-chrome="phone"
          style={{ minHeight: "var(--mobile-nav-height)" }}
          aria-label="Portal navigation"
        >
          {KARIGAR_PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.tab;
            return (
              <Link
                key={tab.tab}
                to={portalPath as "/karigar-portal"}
                search={{ tab: tab.tab }}
                className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full px-0.5 text-center leading-tight break-words whitespace-normal">
                  {tab.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`mobile-bottom-nav__item ${moreActive ? "is-active" : ""}`}
            onClick={() => setMoreOpen(true)}
            aria-label="More sections"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="max-w-full px-0.5 text-center leading-tight break-words whitespace-normal">
              More
            </span>
          </button>
        </nav>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl mobile-sheet-surface">
            <SheetHeader>
              <SheetTitle>Karigar sections</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {KARIGAR_MORE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.tab;
                return (
                  <button
                    key={tab.tab}
                    type="button"
                    className={`flex min-h-[var(--touch-target)] flex-col items-center justify-center gap-1 rounded-md border px-3 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      setMoreOpen(false);
                      void navigate({
                        to: portalPath as "/karigar-portal",
                        search: { tab: tab.tab },
                      });
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  const tabs = kind === "customer" ? CUSTOMER_TABS : SUPPLIER_TABS;

  return (
    <nav
      className="mobile-bottom-nav"
      data-device-chrome="phone"
      style={{ minHeight: "var(--mobile-nav-height)" }}
      aria-label="Portal navigation"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.tab || (tab.tab === defaultTab && !search.tab);
        return (
          <Link
            key={tab.tab}
            to={portalPath as "/karigar-portal"}
            search={{ tab: tab.tab }}
            className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full px-0.5 text-center leading-tight break-words whitespace-normal">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Repair shortcut icon for customer portal extensions */
export const PortalRepairIcon = Wrench;

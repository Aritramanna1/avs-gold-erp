import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Landmark,
  Receipt,
  ShoppingCart,
  Users,
  BarChart3,
  Hammer,
  Package,
  ShoppingBag,
  Gem,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Offline ERP daily operations — one click to the working screen (no dashboard cards). */
const LINKS = [
  {
    to: "/billing" as const,
    labelKey: "item_sales",
    fallback: "Sale (Billing)",
    icon: Receipt,
    search: undefined,
  },
  {
    to: "/stock" as const,
    labelKey: "item_ready_stock",
    fallback: "Stock (Inventory)",
    icon: Package,
    search: undefined,
  },
  {
    to: "/workshop/gold-book" as const,
    labelKey: "item_gold_book",
    fallback: "Karigar Transactions",
    icon: Hammer,
    search: undefined,
  },
  {
    to: "/reports/gold-ledger" as const,
    labelKey: "item_gold_ledger",
    fallback: "Gold Book",
    icon: BookOpen,
    search: undefined,
  },
  {
    to: "/billing/purchases" as const,
    labelKey: "item_purchases",
    fallback: "Purchase",
    icon: ShoppingCart,
    search: undefined,
  },
  {
    to: "/treasury/vouchers" as const,
    labelKey: "item_receipt_jama",
    fallback: "Receipt / Jama",
    icon: ArrowDownLeft,
    search: { tab: "receipt" as const },
  },
  {
    to: "/treasury/vouchers" as const,
    labelKey: "item_payment_nave",
    fallback: "Payment / Nave",
    icon: ArrowUpRight,
    search: { tab: "payment" as const },
  },
  {
    to: "/people" as const,
    labelKey: "item_customers",
    fallback: "Accounts / Parties",
    icon: Users,
    search: undefined,
  },
  {
    to: "/orders" as const,
    labelKey: "item_orders",
    fallback: "Orders",
    icon: ShoppingBag,
    search: undefined,
  },
  {
    to: "/catalog" as const,
    labelKey: "item_catalog",
    fallback: "Catalogue / Designs",
    icon: Gem,
    search: undefined,
  },
  {
    to: "/reports/ledgers" as const,
    labelKey: "item_accountwise",
    fallback: "Account Ledger",
    icon: BookOpen,
    search: undefined,
  },
  {
    to: "/treasury/cash-book" as const,
    labelKey: "item_cash_book",
    fallback: "Cash Book",
    icon: Landmark,
    search: undefined,
  },
  {
    to: "/reports" as const,
    labelKey: "item_reports",
    fallback: "Reports",
    icon: BarChart3,
    search: undefined,
  },
] as const;

export function OperationalHomeLinks() {
  const { t } = useLanguage();

  return (
    <section className="mb-6" aria-labelledby="operational-home-heading">
      <h2 id="operational-home-heading" className="erp-section-title mb-3">
        Daily operations
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {LINKS.map((item) => {
          const label = t(`navigation.${item.labelKey}`);
          const text = label.startsWith("navigation.") ? item.fallback : label;
          return (
            <Link
              key={`${item.to}-${item.labelKey}`}
              to={item.to}
              search={item.search}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium hover:border-gold/40 hover:bg-gold/5 transition-colors min-h-[var(--touch-target,2.75rem)]"
            >
              <item.icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              <span className="truncate">{text}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

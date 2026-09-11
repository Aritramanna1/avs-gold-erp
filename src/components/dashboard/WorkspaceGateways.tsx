import { Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  Hammer,
  Package,
  Wallet,
  UserRound,
  FileSpreadsheet,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";

/**
 * MVP-NAV Home gateways — plain operator words.
 * Not Admin/Treasury mega cards.
 */
const PRIMARY = [
  {
    id: "sell",
    title: "Sell",
    subtitle: "New sale",
    description: "Take a sale or payment — gold value and cash stay separate.",
    icon: ShoppingCart,
    accentColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    to: "/billing",
    links: [
      { label: "New sale", to: "/billing/new" },
      { label: "Orders", to: "/orders" },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    subtitle: "Grahak",
    description: "Find a customer. Gold balance and cash balance are always separate.",
    icon: UserRound,
    accentColor: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    to: "/people",
    search: { tab: "customers" },
    links: [
      { label: "Customers", to: "/people", search: { tab: "customers" } },
      { label: "Who owes", to: "/ledger" },
    ],
  },
  {
    id: "stock",
    title: "Stock",
    subtitle: "Gold first",
    description: "Gold stock and pieces — fine g @995 first.",
    icon: Package,
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    to: "/stock",
    links: [
      { label: "Stock", to: "/stock" },
      { label: "Scan tag", to: "/workshop/barcode-scanner" },
    ],
  },
  {
    id: "make",
    title: "Make",
    subtitle: "Jobs & karigars",
    description: "Give metal, get back, jobs — workshop books.",
    icon: Hammer,
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    to: "/workshop",
    links: [
      { label: "Jobs", to: "/workshop" },
      { label: "Give metal", to: "/workshop/gold-book" },
      { label: "Meena", to: "/workshop/process/$type", params: { type: "meena" } },
    ],
  },
  {
    id: "money",
    title: "Money",
    subtitle: "Cash | Gold @995",
    description: "Who owes, cash book, gold vault — not Admin charts.",
    icon: Wallet,
    accentColor: "text-gold bg-gold/10 border-gold/20",
    to: "/ledger",
    links: [
      { label: "Gold vault", to: "/ledger" },
      { label: "Cash book", to: "/treasury/cash-book" },
      { label: "Receipts", to: "/treasury/vouchers" },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    subtitle: "Day done",
    description: "Daily close and registers in plain words.",
    icon: FileSpreadsheet,
    accentColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    to: "/reports",
    links: [
      { label: "Day done", to: "/reports/daily-close" },
      { label: "Sales", to: "/reports/sales-register" },
    ],
  },
  {
    id: "more",
    title: "More",
    subtitle: "Company & tools",
    description: "Firm, team, rates, and settings — under More, not primary mega tabs.",
    icon: MoreHorizontal,
    accentColor: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    to: "/settings",
    links: [
      { label: "Firm", to: "/settings" },
      { label: "Company", to: "/settings" },
      { label: "Rates", to: "/control/rates" },
    ],
  },
] as const;

export function WorkspaceGateways() {
  return (
    <section className="mb-6" aria-labelledby="workspace-gateways-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="workspace-gateways-heading" className="text-base font-bold text-foreground">
            Go to
          </h2>
          <p className="text-xs text-muted-foreground">
            Home · Sell · Customers · Stock · Make · Money · Reports · More
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {PRIMARY.map((ws) => {
          const Icon = ws.icon;
          return (
            <div
              key={ws.id}
              className="rounded-lg border border-border bg-card/80 hover:border-gold/40 hover:bg-card transition-all p-4 flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${ws.accentColor}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{ws.title}</div>
                      <div className="text-[11px] text-muted-foreground">{ws.subtitle}</div>
                    </div>
                  </div>
                  <Link
                    to={ws.to}
                    search={"search" in ws ? (ws.search as never) : undefined}
                    className="text-muted-foreground group-hover:text-gold transition-colors"
                    aria-label={`Open ${ws.title}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{ws.description}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ws.links.map((link) => (
                  <Link
                    key={`${link.to}-${link.label}`}
                    to={link.to as never}
                    params={"params" in link ? ((link as { params?: Record<string, string> }).params as never) : undefined}
                    search={"search" in link ? (link.search as never) : undefined}
                    className="text-[11px] px-2 py-1 rounded-md border border-border hover:border-gold/40 hover:bg-gold/5 text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

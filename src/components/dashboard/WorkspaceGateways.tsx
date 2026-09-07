import { Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  Hammer,
  Package,
  Scale,
  Users,
  FileSpreadsheet,
  Settings,
  ArrowRight,
} from "lucide-react";

interface WorkspaceGatewayDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof ShoppingCart;
  accentColor: string;
  to: string;
  links: Array<{
    label: string;
    to: string;
    search?: Record<string, unknown>;
  }>;
}

const WORKSPACES: WorkspaceGatewayDef[] = [
  {
    id: "retail",
    title: "Sell & Customers",
    subtitle: "Showroom & POS",
    description: "POS billing, customer orders, design catalogue, delivery challans, and customer KYC.",
    icon: ShoppingCart,
    accentColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    to: "/billing",
    links: [
      { label: "POS Billing", to: "/billing/new" },
      { label: "Customers", to: "/people", search: { tab: "customers" } },
      { label: "Orders", to: "/orders" },
      { label: "Catalogue", to: "/catalog" },
    ],
  },
  {
    id: "workshop",
    title: "Workshop & Karigars",
    subtitle: "Production & WIP",
    description: "Karigar gold book, active job cards, outside work, polishing, and melts.",
    icon: Hammer,
    accentColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    to: "/workshop",
    links: [
      { label: "Gold Book", to: "/workshop/gold-book" },
      { label: "Job Cards", to: "/workshop" },
      { label: "Outside Work", to: "/workshop/outside-work" },
      { label: "Melt & Assay", to: "/melt" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory & Stock",
    subtitle: "Ready Stock & Barcodes",
    description: "Item tagging, barcode search, metal lots, transfers, and physical audits.",
    icon: Package,
    accentColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    to: "/stock",
    links: [
      { label: "Ready Stock", to: "/stock" },
      { label: "Barcode Search", to: "/workshop/barcode-scanner" },
      { label: "Metal Lots", to: "/stock/lots" },
      { label: "Transfers", to: "/stock/transfers" },
    ],
  },
  {
    id: "accounts",
    title: "Accounts & Treasury",
    subtitle: "Vault, Cash & Ledgers",
    description: "Fine gold bullion vault, daily cash book, bank reconciliation, and expenses.",
    icon: Scale,
    accentColor: "text-gold bg-gold/10 border-gold/20",
    to: "/ledger",
    links: [
      { label: "Vault Ledger", to: "/ledger" },
      { label: "Cash Book", to: "/treasury/cash-book" },
      { label: "Bank Reconcile", to: "/treasury/bank-reconciliation" },
      { label: "Expenses", to: "/expenses" },
    ],
  },
  {
    id: "people",
    title: "People & HR",
    subtitle: "Staff & Attendance",
    description: "Employee registry, daily attendance, salary rules, advances, and payroll.",
    icon: Users,
    accentColor: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    to: "/attendance",
    links: [
      { label: "Attendance", to: "/attendance" },
      { label: "Staff", to: "/people", search: { tab: "workers" } },
      { label: "Salary Rules", to: "/attendance", search: { tab: "rules" } },
      { label: "Payroll", to: "/attendance", search: { tab: "payroll" } },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    subtitle: "Business Intelligence",
    description: "Day book closing, GST sales register, metal position, and CA export pack.",
    icon: FileSpreadsheet,
    accentColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    to: "/reports",
    links: [
      { label: "Day Book", to: "/reports/daily-close" },
      { label: "Sales Register", to: "/reports/sales-register" },
      { label: "Metal Position", to: "/reports/metal-position" },
      { label: "CA Pack", to: "/reports/ca-pack" },
    ],
  },
  {
    id: "settings",
    title: "Administration & Tools",
    subtitle: "System Setup",
    description: "Firm profile, automation rules, hardware devices, bullion rates, and customization.",
    icon: Settings,
    accentColor: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    to: "/settings",
    links: [
      { label: "Firm Profile", to: "/settings" },
      { label: "Automation", to: "/settings/automation" },
      { label: "Live Rates", to: "/control/rates" },
      { label: "Hardware", to: "/hardware" },
    ],
  },
];

export function WorkspaceGateways() {
  return (
    <section className="mb-6" aria-labelledby="workspace-gateways-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="workspace-gateways-heading" className="text-base font-bold text-foreground">
            Workspaces
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose an area to work in. All workflows and tools are organized inside their workspace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {WORKSPACES.map((ws) => {
          const Icon = ws.icon;
          return (
            <div
              key={ws.id}
              className="rounded-lg border border-border bg-card/80 hover:border-gold/40 hover:bg-card transition-all p-4 flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border ${ws.accentColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <Link
                        to={ws.to}
                        className="font-bold text-sm text-foreground hover:text-gold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                      >
                        {ws.title}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-gold" />
                      </Link>
                      <div className="text-[11px] text-muted-foreground font-medium">
                        {ws.subtitle}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {ws.description}
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
                {ws.links.map((link) => (
                  <Link
                    key={`${ws.id}-${link.label}`}
                    to={link.to}
                    search={link.search as any}
                    className="inline-flex items-center rounded-md border border-border/80 bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground hover:border-gold/50 hover:bg-gold/5 hover:text-gold transition-colors"
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ArrowRight,
  ClipboardList,
  Scale,
  Users,
  Package,
  FileSpreadsheet,
  Receipt,
  ShieldAlert,
  Building2,
  Factory,
  AlertTriangle,
  Calendar,
  Gem,
  BookOpen,
  Bell,
  CheckCircle,
  ClipboardCheck,
  TrendingDown,
  Search,
  Wrench,
} from "lucide-react";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { ModuleWorkspace } from "@/components/module-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReportSnapshots } from "@/lib/report-snapshots-store";
import { OFFLINE_PARITY_CATALOG, searchOfflineParity } from "@/lib/offline-parity-catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/")({ component: ReportsWorkspace });

const jewelleryBooksGroup = {
  title: "Jewellery Books (Offline names)",
  items: [
    {
      label: "Fine Rojmel",
      description: "Final rojeldar — daily fine gold book.",
      to: "/reports/fine-rojmel",
      icon: Gem,
    },
    {
      label: "Dar Rojmel",
      description: "Cash Jama/Nave day book.",
      to: "/reports/dar-rojmel",
      icon: BookOpen,
    },
    {
      label: "Account Balance",
      description: "Offline PDF layout — No, Name, Phone, Jama Wt, Return Wt, Nave Wt, Cash, Anamat, Fine.",
      to: "/reports/account-balance",
      icon: Users,
      search: { variant: "1" as const },
    },
    {
      label: "Account Balance 2",
      description: "Same Offline columns, sorted by Nave / Fine outstanding.",
      to: "/reports/account-balance",
      icon: Users,
      search: { variant: "2" as const },
    },
    {
      label: "Daily Summary",
      description: "Day totals — gold, cash, sales.",
      to: "/reports/daily-summary",
      icon: Calendar,
    },
    {
      label: "Bank Transactions",
      description: "Bank CoA voucher lines.",
      to: "/reports/bank-transactions",
      icon: Building2,
    },
    {
      label: "Item Jama Nave",
      description: "Item-wise sale / purchase metal.",
      to: "/reports/item-jama-nave",
      icon: Package,
      search: { mode: "item" as const },
    },
    {
      label: "Account-wise Sale / Purchase",
      description: "Party Jama/Nave metal + ₹.",
      to: "/reports/item-jama-nave",
      icon: Receipt,
      search: { mode: "account" as const },
    },
    {
      label: "Item Transaction",
      description: "Stock + invoice item movements.",
      to: "/reports/item-transaction",
      icon: ClipboardList,
    },
    {
      label: "City Wise",
      description: "City rollup of balances and sales.",
      to: "/reports/city-wise",
      icon: Building2,
    },
    {
      label: "Fine Margin",
      description: "Making / profit margin on sales.",
      to: "/reports/fine-margin",
      icon: TrendingDown,
      search: { view: "profit" as const },
    },
    {
      label: "Sale Fine",
      description: "Invoice fine vs billed value.",
      to: "/reports/fine-margin",
      icon: Scale,
      search: { view: "sale-fine" as const },
    },
    {
      label: "Cash Flow",
      description: "Operating cash in/out.",
      to: "/reports/cash-flow",
      icon: Receipt,
    },
    {
      label: "Deleted Bills",
      description: "Cancelled sales register (audit-safe).",
      to: "/reports/deleted-bills",
      icon: ShieldAlert,
    },
    {
      label: "Company Cash Book",
      description: "Offline Cashbook.",
      to: "/treasury/cash-book",
      icon: BookOpen,
    },
    {
      label: "Payment / Receipts",
      description: "Offline Pay/Rec register.",
      to: "/treasury/vouchers",
      icon: Receipt,
    },
    {
      label: "Utilities & Masters",
      description: "URD, Sauda, Rate Master, Wipeout alias…",
      to: "/utilities",
      icon: Wrench,
    },
  ],
};

const reportGroups = [
  jewelleryBooksGroup,
  {
    title: "Ledger (Source of Truth)",
    items: [
      {
        label: "Party ledgers",
        description: "Short, detailed, and bill-wise customer books (₹ + fine g).",
        to: "/reports/ledgers",
        icon: BookOpen,
      },
      {
        label: "Company Cash Book",
        description: "Canonical cash register — Dr/Cr, running balance, narration, party, source.",
        to: "/treasury/cash-book",
        icon: Receipt,
      },
      {
        label: "Gold ledger report",
        description: "Gold ledger movements with filters and paginated server query.",
        to: "/reports/gold-ledger",
        icon: Gem,
      },
      {
        label: "Gold stock by purity",
        description: "Vault and scrap purity lines from the gold ledger.",
        to: "/reports/gold-stock",
        icon: Scale,
      },
      {
        label: "Receipts & Payments register",
        description: "Treasury vouchers — same spine as Company Cash Book.",
        to: "/treasury/vouchers",
        icon: Receipt,
      },
      {
        label: "Expenses (canonical cash view)",
        description: "Universal ledger lines posted from the expense module (`source=expense`).",
        to: "/treasury/cash-book",
        icon: TrendingDown,
        search: { source: "expense" },
      },
      {
        label: "Gold summary",
        description: "Vault, karigar, customer, and finished-goods position.",
        to: "/reports/gold-summary",
        icon: Scale,
      },
      {
        label: "Where Is My Gold?",
        description: "Real-time custody traceability across vault, karigar, and WIP.",
        to: "/reports/gold-position",
        icon: Gem,
      },
    ],
  },
  {
    title: "Reconciliation & Audit",
    items: [
      {
        label: "Reconciliation Center",
        description: "Unified balance checks — gold integrity, cash vs CoA, stock, expenses.",
        to: "/reports/reconciliation-center",
        icon: CheckCircle,
      },
      {
        label: "Vault reconciliation",
        description: "Vault custody vs ledger variance.",
        to: "/reports/vault-reconciliation",
        icon: Scale,
      },
      {
        label: "Settlement reconciliation",
        description: "Gold settlement posting vs ledger proof.",
        to: "/reports/settlement-reconciliation",
        icon: CheckCircle,
      },
      {
        label: "Gold reconciliation",
        description: "Cross-check gold books and ledger buckets.",
        to: "/reports/gold-reconciliation",
        icon: Gem,
      },
      {
        label: "Manufacturing reconciliation",
        description: "Job card metal vs issued/received proof.",
        to: "/reports/manufacturing-reconciliation",
        icon: Factory,
      },
      {
        label: "Bank reconciliation",
        description: "Bank statement vs cash book.",
        to: "/treasury/bank-reconciliation",
        icon: Building2,
      },
      {
        label: "ERP Audit Report",
        description:
          "PASS / FAIL / BLOCKED evaluation of books, portals, calculations, RLS — with evidence.",
        to: "/reports/erp-audit",
        icon: ClipboardCheck,
      },
      {
        label: "Exceptions",
        description: "Operational anomalies requiring follow-up.",
        to: "/reports/exceptions",
        icon: AlertTriangle,
      },
      {
        label: "Auditor workspace",
        description: "Audit logs, financial year locks, and freeze status.",
        to: "/reports/auditor",
        icon: ShieldAlert,
      },
    ],
  },
  {
    title: "Manufacturing & Operations",
    items: [
      {
        label: "Manufacturing register",
        description: "Production movement, loss, recovery, and delay views.",
        to: "/reports/manufacturing",
        icon: ClipboardList,
      },
      {
        label: "Outside work",
        description: "Subcontractor challans, loss, and turnaround.",
        to: "/reports/outside-work",
        icon: Factory,
      },
      {
        label: "Worker / karigar books",
        description: "Per-worker gold and labour position.",
        to: "/reports/worker",
        icon: Users,
      },
      {
        label: "Settlements",
        description: "Hisab final and settlement register.",
        to: "/reports/settlements",
        icon: Receipt,
      },
      {
        label: "Gold outstanding",
        description: "Customer and workshop balances requiring action.",
        to: "/reports/gold-outstanding",
        icon: Users,
      },
      {
        label: "Gold loss",
        description: "Process and person loss across manufacturing and conversion.",
        to: "/reports/gold-loss",
        icon: AlertTriangle,
      },
      {
        label: "Daily gold flow",
        description: "Daily gold book movement (operational view).",
        to: "/reports/daily-gold-flow",
        icon: BookOpen,
      },
      {
        label: "Metal position (short / long)",
        description: "Physical gold vs customer deposits and open orders.",
        to: "/reports/metal-position",
        icon: Scale,
      },
      {
        label: "Stock valuation",
        description: "On-hand tags at cost vs live bhav.",
        to: "/reports/stock-valuation",
        icon: Scale,
      },
      {
        label: "Inventory ageing",
        description: "Ready stock by age, status, and location.",
        to: "/reports/inventory-ageing",
        icon: Package,
      },
      {
        label: "Dealer register",
        description: "Dealer-wise stock and movement.",
        to: "/reports/dealer",
        icon: Package,
      },
    ],
  },
  {
    title: "Finance, GST & Compliance",
    items: [
      {
        label: "Sales register",
        description: "Invoice-wise metal, making, GST, TCS, and HSN.",
        to: "/reports/sales-register",
        icon: Receipt,
      },
      {
        label: "Purchase register",
        description: "Supplier purchases with GST and outstanding.",
        to: "/reports/purchase-register",
        icon: FileSpreadsheet,
      },
      {
        label: "HSN summary",
        description: "GSTR-1 Table 12 style HSN / SAC totals.",
        to: "/reports/hsn-summary",
        icon: Receipt,
      },
      {
        label: "GST returns",
        description: "GSTR-1 (B2B), B2CS, HSN, and GSTR-3B summary exports.",
        to: "/reports/gst-returns",
        icon: Receipt,
      },
      {
        label: "ITC-04",
        description: "Job work movement register for GST compliance.",
        to: "/reports/itc04",
        icon: Receipt,
      },
      {
        label: "Total profit earned (Business P&L)",
        description: "Accurate business profit separating direct work margins, operating overheads, and owner drawings.",
        to: "/reports/total-profit",
        icon: BarChart3,
      },
      {
        label: "Owner drawings & personal",
        description: "Owner and family member drawings tracked against equity without reducing business operating profit.",
        to: "/reports/owner-drawings",
        icon: Users,
      },
      {
        label: "Financial statements",
        description: "Trial balance, trading account, P&L, and balance sheet.",
        to: "/reports/financial-statements",
        icon: FileSpreadsheet,
      },
      {
        label: "Tally export",
        description: "Sales, purchase, and receipt vouchers as Tally XML.",
        to: "/reports/tally-export",
        icon: FileSpreadsheet,
      },
      {
        label: "Daily close",
        description: "End-of-day cash and gold verification.",
        to: "/reports/daily-close",
        icon: Calendar,
      },
      {
        label: "Month-end close",
        description: "Period close checklist and locks.",
        to: "/reports/month-end-close",
        icon: Calendar,
      },
      {
        label: "Branch summary",
        description: "Multi-branch operational rollup.",
        to: "/reports/branch",
        icon: Building2,
      },
      {
        label: "Audit log",
        description: "Immutable administrative action trail.",
        to: "/reports/audit-log",
        icon: ShieldAlert,
      },
      {
        label: "Approvals queue",
        description: "Pending approval documents and actions.",
        to: "/reports/approvals",
        icon: CheckCircle,
      },
      {
        label: "Reminders",
        description: "Follow-ups, dues, and scheduled tasks.",
        to: "/reports/reminders",
        icon: Bell,
      },
      {
        label: "Delivery summary",
        description: "Order delivery performance.",
        to: "/reports/delivery-summary",
        icon: ClipboardList,
      },
    ],
  },
];

function ReportsWorkspace() {
  const { snapshots, loading, hydrate, saveSnapshot, verifySnapshot } = useReportSnapshots();
  const [verifierName, setVerifierName] = useState("");
  const [parityQ, setParityQ] = useState("");
  const parityHits = useMemo(() => searchOfflineParity(parityQ).slice(0, 24), [parityQ]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <ModuleWorkspace
      eyebrow="Decision support"
      title="Reports & Registers"
      description="Derived registers and reconciliation views — Ledger is source of truth; Offline jewellery book names are listed first for operators."
      icon={BarChart3}
      metrics={[]}
      actions={[]}
    >
      <div className="mb-4">
        <SourceOfTruthBadge variant="report" />
      </div>

      <section className="erp-surface rounded-md p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">Find Offline report / utility name</h2>
          <Badge variant="outline">{OFFLINE_PARITY_CATALOG.length} mapped</Badge>
        </div>
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cashbook, Fine Rojmel, URD, Sauda, Rate Master…"
            value={parityQ}
            onChange={(e) => setParityQ(e.target.value)}
          />
        </div>
        {parityQ.trim() ? (
          <div className="grid gap-1 md:grid-cols-2">
            {parityHits.map((e) => (
              <Link
                key={`${e.offlineName}-${e.to}`}
                to={e.to}
                search={e.search}
                className="text-sm px-2 py-1.5 rounded hover:bg-muted/50 flex justify-between gap-2"
              >
                <span>
                  <span className="font-medium">{e.offlineName}</span>
                  <span className="text-muted-foreground"> → {e.avsName}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {parityHits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No match — try another Offline name.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Type any Offline menu name. Full utilities hub:{" "}
            <Link to="/utilities" className="text-gold underline">
              /utilities
            </Link>
          </p>
        )}
      </section>

      <section className="erp-surface rounded-md p-5 mb-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm">Saved Report Snapshots</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Save report filters and data for QA verification. Verified snapshots are immutable
              audit evidence.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              void saveSnapshot({
                reportCode: "reports_hub",
                reportName: "Reports Hub Snapshot",
                filters: { savedFrom: "reports.index" },
                snapshotData: { groupCount: reportGroups.length },
              }).then((s) => {
                if (s) toast.success("Report snapshot saved.");
                else toast.error("Could not save snapshot — apply DB migration first.");
              })
            }
          >
            Save Hub Snapshot
          </Button>
        </div>
        <div className="flex gap-2 items-end">
          <Input
            placeholder="Verifier name for QA sign-off"
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading snapshots…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved report snapshots yet.</p>
        ) : (
          <div className="divide-y text-sm">
            {snapshots.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 gap-3">
                <div>
                  <div className="font-medium">{s.reportName}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.savedAt).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.status}</Badge>
                  {s.status === "saved" && verifierName.trim() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void verifySnapshot(s.id, verifierName.trim()).then((ok) => {
                          if (ok) toast.success("Report verified.");
                          else toast.error("Verification failed.");
                        })
                      }
                    >
                      Verify
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="space-y-8">
        {reportGroups.map((group) => (
          <section key={group.title}>
            <h2 className="text-sm font-semibold text-gold mb-3">{group.title}</h2>
            <div className="grid gap-2 md:gap-3 md:grid-cols-2">
              {group.items.map(({ label, description, to, icon: Icon, search }) => (
                <Link
                  className="erp-surface group rounded-xl p-3.5 md:p-5 hover:border-primary/50 flex items-center gap-3 md:block min-h-[var(--touch-target)]"
                  key={`${to}-${label}`}
                  to={to}
                  search={search}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight">{label}</h3>
                    <p className="mt-0.5 text-xs md:text-sm text-muted-foreground">{description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 md:hidden" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ModuleWorkspace>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReportSnapshots } from "@/lib/report-snapshots-store";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/")({ component: ReportsWorkspace });

const reportGroups = [
  {
    title: "Gold & Metal Books",
    items: [
      {
        label: "Where Is My Gold?",
        description: "Real-time custody traceability across vault, karigar, and WIP.",
        to: "/reports/gold-position",
        icon: Gem,
      },
      {
        label: "Gold summary",
        description: "Vault, karigar, customer, and finished-goods position.",
        to: "/reports/gold-summary",
        icon: Scale,
      },
      {
        label: "Gold outstanding",
        description: "Customer and workshop balances requiring action.",
        to: "/reports/gold-outstanding",
        icon: Users,
      },
      {
        label: "Daily gold flow",
        description: "Daily gold book movement and reconciliation.",
        to: "/reports/daily-gold-flow",
        icon: BookOpen,
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
    ],
  },
  {
    title: "Manufacturing & Karigar",
    items: [
      {
        label: "Manufacturing register",
        description: "Production movement, loss, recovery, and delay views.",
        to: "/reports/manufacturing",
        icon: ClipboardList,
      },
      {
        label: "Manufacturing reconciliation",
        description: "Job card metal vs issued/received proof.",
        to: "/reports/manufacturing-reconciliation",
        icon: Factory,
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
    ],
  },
  {
    title: "Stock & Inventory",
    items: [
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
        label: "GST returns",
        description: "GSTR-1 (B2B) and GSTR-3B summary exports.",
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
    ],
  },
  {
    title: "Audit & Operations",
    items: [
      {
        label: "Auditor workspace",
        description: "Audit logs, financial year locks, and freeze status.",
        to: "/reports/auditor",
        icon: ShieldAlert,
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
        label: "Exceptions",
        description: "Operational anomalies requiring follow-up.",
        to: "/reports/exceptions",
        icon: AlertTriangle,
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

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <ModuleWorkspace
      eyebrow="Decision support"
      title="Reports & Registers"
      description="Jewellery industry reports aligned to gold books, manufacturing registers, stock, GST, and audit — per JWELLY_REFERENCE_MASTER and JEWELLERY_ERP_BENCHMARK_MATRIX."
      icon={BarChart3}
      metrics={[]}
      actions={[]}
    >
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
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map(({ label, description, to, icon: Icon }) => (
                <Link
                  className="erp-surface group rounded-md p-5 hover:border-primary/50"
                  key={to}
                  to={to}
                >
                  <div className="flex items-start justify-between">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-5 font-semibold">{label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ModuleWorkspace>
  );
}

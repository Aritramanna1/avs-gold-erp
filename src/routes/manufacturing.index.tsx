/**
 * Manufacturing Dashboard — lists all Job Cards that are ready for billing,
 * plus all Manufacturing Bills in progress or recently finalised.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { useMfgBills, MFG_BILL_STATUS_LABELS } from "@/lib/manufacturing-bill-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import {
  Hammer,
  FileText,
  CheckCircle2,
  Clock,
  PackageCheck,
  AlertCircle,
  ArrowRight,
  Plus,
  ChevronRight,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/manufacturing/")({
  head: () => ({ meta: [{ title: "Manufacturing · AVS Gold ERP" }] }),
  component: ManufacturingDashboard,
});

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted/40 text-muted-foreground border-border",
  finalised: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  delivered: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  settled: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  ready_for_billing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  work_received: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export default function ManufacturingDashboard() {
  const { jobs } = useJobCards();
  const { bills } = useMfgBills();
  const { config: wf } = useWorkflowEngine();

  // Jobs that need a Manufacturing Bill
  const readyJobs = jobs.filter((j) => ["work_received", "ready_for_billing"].includes(j.status));
  const allActiveJobs = jobs.filter((j) => j.status !== "closed");

  // Bills by status
  const draftBills = bills.filter((b) => b.status === "draft");
  const finalisedBills = bills.filter((b) => b.status === "finalised");
  const recentBills = bills.filter((b) => b.status !== "draft").slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Manufacturing"
          subtitle="Production lifecycle — Job Cards → Manufacturing Bills → Finished Stock → Delivery"
          actions={
            <Link to="/reports/gold-summary">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Coins className="h-4 w-4 text-gold" /> Gold Summary
              </Button>
            </Link>
          }
        />
        {!wf.mfgBillEnabled && (
          <Badge variant="outline" className="text-amber-400 border-amber-500/30 gap-1">
            <AlertCircle className="h-3 w-3" />
            Manufacturing Bill disabled in Workflow Settings
          </Badge>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Active Jobs"
          value={allActiveJobs.length}
          icon={Hammer}
          color="text-blue-400"
        />
        <KpiCard
          label="Ready for Bill"
          value={readyJobs.length}
          icon={AlertCircle}
          color="text-amber-400"
          urgent={readyJobs.length > 0}
        />
        <KpiCard
          label="Draft Bills"
          value={draftBills.length}
          icon={FileText}
          color="text-muted-foreground"
        />
        <KpiCard
          label="Finalised (Pending Delivery)"
          value={finalisedBills.length}
          icon={PackageCheck}
          color="text-emerald-400"
        />
      </div>

      {/* Jobs ready for Manufacturing Bill */}
      {readyJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400">
              Awaiting Manufacturing Bill ({readyJobs.length})
            </h2>
          </div>
          <div className="space-y-2">
            {readyJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{job.jobNo}</span>
                    <span className="font-semibold text-sm truncate">{job.itemName}</span>
                    <Badge
                      className={`text-[10px] border ${STATUS_COLOR[job.status] ?? "border-border"}`}
                    >
                      {JOB_STATUS_LABELS[job.status]}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {job.customerName}
                    {job.karigarName && ` · Karigar: ${job.karigarName}`}
                    {job.orderNo && ` · Order: ${job.orderNo}`}
                  </div>
                </div>
                <Link to="/manufacturing/bill/new/$jobId" params={{ jobId: job.id }}>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-black gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Bill
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Draft Bills */}
      {draftBills.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Draft Bills ({draftBills.length})
          </h2>
          <div className="space-y-2">
            {draftBills.map((bill) => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Finalised Bills */}
      {recentBills.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Recent Bills
          </h2>
          <div className="space-y-2">
            {recentBills.map((bill) => (
              <BillRow key={bill.id} bill={bill} />
            ))}
          </div>
        </section>
      )}

      {allActiveJobs.length === 0 && bills.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
          <Hammer className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">No active manufacturing jobs.</p>
          <p className="text-xs text-muted-foreground">
            Create a Job Card from Workshop to start the production cycle.
          </p>
          <Link to="/workshop">
            <Button variant="outline" size="sm" className="mt-2">
              Go to Workshop <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  urgent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 space-y-1 ${urgent ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
          {label}
        </span>
      </div>
      <div className={`font-bold text-2xl font-mono ${color}`}>{value}</div>
    </div>
  );
}

function BillRow({ bill }: { bill: import("@/lib/manufacturing-bill-store").ManufacturingBill }) {
  const closingG = (bill.closingBalanceMg / 1000).toFixed(3);
  return (
    <Link to="/manufacturing/bill/$id" params={{ id: bill.id }}>
      <div className="rounded-xl border border-border bg-card/60 hover:border-gold/30 hover:bg-gold/5 transition-colors p-4 flex items-center gap-4 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{bill.billNo}</span>
            <span className="font-semibold text-sm truncate">{bill.itemName}</span>
            <Badge className={`text-[10px] border ${STATUS_COLOR[bill.status] ?? "border-border"}`}>
              {MFG_BILL_STATUS_LABELS[bill.status]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {bill.customerName}
            {bill.karigarName && ` · Karigar: ${bill.karigarName}`}
            {bill.closingBalanceMg !== 0 && (
              <span
                className={`ml-2 font-mono ${bill.closingBalanceMg < 0 ? "text-amber-400" : "text-emerald-400"}`}
              >
                Karigar: G {closingG} {bill.closingBalanceMg < 0 ? "Jama" : "Udhar"}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}

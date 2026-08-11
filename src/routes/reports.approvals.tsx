import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  type ApprovalRequest,
} from "@/lib/workflow/approval-workflow";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Printer,
  Download,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/approvals")({
  head: () => ({ meta: [{ title: "Pending Approvals · AVS Gold ERP" }] }),
  component: ApprovalsPage,
});

const ENTITY_TYPE_LABELS: Record<string, string> = {
  discount_override: "Discount Override",
  stock_adjustment: "Manual Stock Adjustment",
  financial_lock_unlock: "Financial Lock Unlock",
  settlement_dispute: "Settlement Dispute",
};

function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRequests(await getPendingApprovals());
    } catch (error) {
      setRequests([]);
      toast.error(
        error instanceof Error ? error.message : "Could not load pending approvals. Retry shortly.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function actor() {
    const { data } = await supabase.auth.getSession();
    return { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null };
  }

  async function handleApprove(r: ApprovalRequest) {
    setBusyId(r.id);
    try {
      const who = await actor();
      await approveRequest(r.id, who);
      toast.success(`Approved: ${r.reason}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(r: ApprovalRequest) {
    const note = window.prompt("Reason for rejection (optional)?") ?? undefined;
    setBusyId(r.id);
    try {
      const who = await actor();
      await rejectRequest(r.id, who, note);
      toast(`Rejected: ${r.reason}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setBusyId(null);
    }
  }

  function handleCSV() {
    const header = ["Type", "Reason", "Requested By", "Requested At"];
    const data = requests.map((r) => [
      ENTITY_TYPE_LABELS[r.entityType] ?? r.entityType,
      r.reason,
      r.requestedByEmail ?? "",
      new Date(r.requestedAt).toLocaleString(),
    ]);
    exportToCSV("pending-approvals.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Pending Approvals"
        subtitle="Discount overrides, manual stock adjustments, financial-lock unlocks and other sign-off-required actions waiting on a decision."
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button variant="outline" onClick={handleCSV} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => triggerPrint()} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Type</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Requested By</th>
                <th className="p-3">Requested At</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {loading ? "Loading…" : "No pending approvals."}
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Badge variant="secondary">
                      {ENTITY_TYPE_LABELS[r.entityType] ?? r.entityType}
                    </Badge>
                  </td>
                  <td className="p-3">{r.reason}</td>
                  <td className="p-3 text-muted-foreground">{r.requestedByEmail ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={busyId === r.id}
                        onClick={() => handleApprove(r)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive"
                        disabled={busyId === r.id}
                        onClick={() => handleReject(r)}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Hammer, FileText, Plus } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { MFG_BILL_STATUS_LABELS } from "@/lib/manufacturing-bill-store";
import {
  fetchManufacturingWorkspaceSummary,
  type ManufacturingWorkspaceSummary,
} from "@/lib/manufacturing-query";
import { useSettings } from "@/lib/settings-store";
import { EmptyState, WebAppState } from "@/components/web-app-state";

export const Route = createFileRoute("/manufacturing/")({ component: ManufacturingWorkspace });
function ManufacturingWorkspace() {
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [summary, setSummary] = useState<ManufacturingWorkspaceSummary>({
    openJobCards: 0,
    totalBills: 0,
    draftBills: 0,
    finalisedBills: 0,
    recentBills: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchId = useMemo(() => {
    const globalRoles = ["Super Owner", "Administrator", "CEO (View Only)", "owner", "admin"];
    return currentUserRole && !globalRoles.includes(currentUserRole)
      ? selectedBranchId || "MAIN"
      : null;
  }, [currentUserRole, selectedBranchId]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    fetchManufacturingWorkspaceSummary({ branchId })
      .then(setSummary)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load manufacturing summary."),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  return (
    <ModuleWorkspace
      eyebrow="Workshop operations"
      title="Manufacturing"
      description="Track job cards, production bills, finished receipts, and workshop throughput from one operational desk."
      icon={Hammer}
      loading={loading}
      onRefresh={refresh}
      metrics={[
        {
          label: "Open job cards",
          value: summary.openJobCards,
        },
        { label: "Bills", value: summary.totalBills },
        { label: "Draft bills", value: summary.draftBills },
        { label: "Completed", value: summary.finalisedBills },
      ]}
      actions={[{ label: "Workshop books", to: "/workshop", icon: FileText }]}
    >
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Recent manufacturing bills</h2>
        {loading ? (
          <WebAppState
            title="Loading manufacturing"
            description="Fetching current job and bill counts from Supabase."
          />
        ) : error ? (
          <WebAppState
            title="Could not load manufacturing"
            description={error}
            tone="danger"
            action={{ label: "Retry", onClick: refresh }}
          />
        ) : summary.recentBills.length === 0 ? (
          <EmptyState
            title="No manufacturing bills have been recorded"
            description="Finalised job cards and production receipts will appear here."
          />
        ) : (
          <div className="mt-4 divide-y">
            {summary.recentBills.map((bill) => (
              <Link
                className="flex items-center justify-between py-3 text-sm hover:text-primary"
                key={bill.id}
                to="/manufacturing/bill/$id"
                params={{ id: bill.id }}
              >
                <span>
                  {bill.billNo || bill.id}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {bill.customerName ?? bill.jobNo ?? bill.itemName ?? ""}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {MFG_BILL_STATUS_LABELS[bill.status] ?? bill.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ModuleWorkspace>
  );
}

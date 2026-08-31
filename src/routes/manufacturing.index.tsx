import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Hammer, FileText } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { MFG_BILL_STATUS_LABELS } from "@/lib/manufacturing-bill-store";
import {
  fetchManufacturingWorkspaceSummary,
  type ManufacturingWorkspaceSummary,
} from "@/lib/manufacturing-query";
import { useSettings } from "@/lib/settings-store";
import { isAdminLikeRole } from "@/lib/role-resolution";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import { EmptyState, WebAppState } from "@/components/web-app-state";
import { MobilePageScaffold, MobileListCard } from "@/components/mobile/MobilePageScaffold";
import { prefersMobileAppChrome } from "@/lib/native/platform";

export const Route = createFileRoute("/manufacturing/")({ component: ManufacturingWorkspace });
function ManufacturingWorkspace() {
  const navigate = useNavigate();
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
    if (!currentUserRole || isAdminLikeRole(currentUserRole)) return null;
    return resolveOperationalBranchId(selectedBranchId);
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

  const mobile = prefersMobileAppChrome();
  const billList =
    loading ? (
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
        {summary.recentBills.map((bill) =>
          mobile ? (
            <MobileListCard
              key={bill.id}
              title={bill.billNo || bill.id}
              subtitle={bill.customerName ?? bill.jobNo ?? bill.itemName ?? ""}
              meta={MFG_BILL_STATUS_LABELS[bill.status] ?? bill.status}
              onClick={() => {
                void navigate({ to: "/manufacturing/bill/$id", params: { id: bill.id } });
              }}
            />
          ) : (
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
          ),
        )}
      </div>
    );

  if (mobile) {
    return (
      <MobilePageScaffold
        title="Manufacturing"
        subtitle="Job cards, production bills, and workshop throughput."
        trailing={
          <Link to="/workshop" className="text-xs text-gold font-medium">
            Books
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Open jobs</p>
            <p className="font-serif text-xl text-gold">{summary.openJobCards}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Bills</p>
            <p className="font-serif text-xl text-gold">{summary.totalBills}</p>
          </div>
        </div>
        {billList}
      </MobilePageScaffold>
    );
  }

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

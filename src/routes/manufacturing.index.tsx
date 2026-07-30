import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hammer, FileText, Plus } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useJobCards } from "@/lib/jobcards-store";

export const Route = createFileRoute("/manufacturing/")({ component: ManufacturingWorkspace });
function ManufacturingWorkspace() {
  const bills = useMfgBills((s) => s.bills);
  const refreshBills = useMfgBills((s) => s.refresh);
  const jobs = useJobCards((s) => s.jobs);
  const refreshJobs = useJobCards((s) => s.refresh);
  useEffect(() => {
    void Promise.all([refreshBills(), refreshJobs()]);
  }, [refreshBills, refreshJobs]);
  return (
    <ModuleWorkspace
      eyebrow="Workshop operations"
      title="Manufacturing"
      description="Track job cards, production bills, finished receipts, and workshop throughput from one operational desk."
      icon={Hammer}
      loading={!bills.length && !jobs.length}
      onRefresh={() => void Promise.all([refreshBills(), refreshJobs()])}
      metrics={[
        {
          label: "Open job cards",
          value: jobs.filter((j) => !["closed", "completed"].includes(j.status)).length,
        },
        { label: "Bills", value: bills.length },
        { label: "Draft bills", value: bills.filter((b) => b.status === "draft").length },
        { label: "Completed", value: bills.filter((b) => b.status === "finalised").length },
      ]}
      actions={[{ label: "Workshop books", to: "/workshop", icon: FileText }]}
    >
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Recent manufacturing bills</h2>
        {bills.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No manufacturing bills have been recorded.
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {bills.slice(0, 8).map((bill) => (
              <Link
                className="flex items-center justify-between py-3 text-sm hover:text-primary"
                key={bill.id}
                to="/manufacturing/bill/$id"
                params={{ id: bill.id }}
              >
                <span>{bill.billNo || bill.id}</span>
                <span className="text-muted-foreground">{bill.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ModuleWorkspace>
  );
}

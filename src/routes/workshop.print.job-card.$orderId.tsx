/**
 * Job Card Print Route — thin wrapper around the Unified Print Engine.
 *
 * The `$orderId` param is really a RECORD id: normally a Job Card id (an order
 * has one card per item, and each prints separately), with an Order id still
 * accepted for older links and resolving to that order's first card. The route
 * path is unchanged to keep existing links working; data-mapper's `job_card`
 * builder does the resolution.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/workshop/print/job-card/$orderId")({
  head: () => ({ meta: [{ title: "Job Card Print · AVS Gold ERP" }] }),
  component: JobCardPrintPage,
});

function JobCardPrintPage() {
  const { orderId: recordId } = useParams({ from: "/workshop/print/job-card/$orderId" });
  const job = useJobCards((s) => s.jobs.find((j) => j.id === recordId));
  const order = useOrders((s) => s.orders.find((o) => o.id === (job ? job.orderId : recordId)));

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Order not found</h1>
          <Link to="/workshop" className="text-gold underline">
            Back to Workshop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="job_card"
      recordId={recordId}
      backUrl={`/workshop/job-card/${recordId}`}
    />
  );
}

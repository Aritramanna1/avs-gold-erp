/**
 * Job Card Print Route — thin wrapper around the Unified Print Engine.
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/workshop/print/job-card/$orderId")({
  head: () => ({ meta: [{ title: "Job Card Print · AVS Gold ERP" }] }),
  component: JobCardPrintPage,
});

function JobCardPrintPage() {
  const { orderId } = useParams({ from: "/workshop/print/job-card/$orderId" });
  return (
    <PrintEngine docType="job_card" recordId={orderId} backUrl={`/workshop/job-card/${orderId}`} />
  );
}

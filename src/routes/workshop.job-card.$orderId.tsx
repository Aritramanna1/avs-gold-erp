/**
 * Digital Job Card — on-screen preview + PDF download, generated straight
 * from an existing Production Order (reusing its linked workshop Job Card,
 * if one exists, for the assigned-worker/job-number fields). Read-only:
 * nothing here writes to Billing, Gold Ledger, Inventory, Reports, or
 * Communication.
 */
import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { buildJobCardData } from "@/lib/job-card-engine";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { mgToGrams } from "@/lib/gold";
import { ArrowLeft, Download, Loader2, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop/job-card/$orderId")({
  head: () => ({ meta: [{ title: "Job Card · AVS Gold ERP" }] }),
  component: JobCardPage,
});

function purityLabel(p: number): string {
  if (p >= 990) return "999 (24K)";
  if (p >= 915) return "916 (22K)";
  if (p >= 749) return "750 (18K)";
  if (p >= 584) return "585 (14K)";
  return `${p}`;
}

function JobCardPage() {
  // The param is a JOB CARD id (one per order line — an order with three pieces
  // has three cards, and this screen must show the right one). An Order id is
  // still accepted for older links and resolves to that order's first card.
  const { orderId: recordId } = useParams({ from: "/workshop/job-card/$orderId" });
  const jobs = useJobCards((s) => s.jobs);
  const jobById = jobs.find((j) => j.id === recordId) ?? null;
  const order = useOrders((s) =>
    s.orders.find((o) => o.id === (jobById ? jobById.orderId : recordId)),
  );
  const people = usePeople((s) => s.people);
  const { firm } = useSettings();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  if (!order) {
    return (
      <div className="p-8 text-center space-y-2">
        <p className="font-semibold">Production Order not found</p>
        <Link to="/orders">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  const linkedJob = jobById ?? jobs.find((j) => j.orderId === order.id) ?? null;

  const data = buildJobCardData(
    order,
    linkedJob,
    customer?.fullName ?? "—",
    customer?.phone,
    karigar?.fullName ?? null,
  );

  function handlePrint() {
    // Navigate to the print ROUTE — the same stabilized pipeline People/KYC
    // uses (PrintLayout + PrintToolbar → printDocument). The old preview-modal
    // path rendered the document inside the app shell, which is how app chrome
    // could reach the paper; printDocument serializes ONLY the PrintLayout
    // roots, so nothing but the document can ever be printed.
    navigate({ to: `/workshop/print/job-card/${recordId}` as any });
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const printData = resolvePrintContext("job_card", recordId);
      if (!printData) throw new Error("Job Card data not available");
      const template = usePrintTemplates.getState().getForDocType("job_card");
      const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
      const { blob, fileName } = await generateDocumentPdf(printData, template, firm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Job Card PDF downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Job Card PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <Link to="/orders/$id" params={{ id: order.id }}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Order
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={handleDownload} disabled={downloading} className="gap-2">
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Job Card PDF
          </Button>
        </div>
      </div>

      <PageHeader
        title="Job Card Preview"
        subtitle="Half-page (A5) layout — the same template every job card uses."
      />

      {/* On-screen preview — mirrors the PDF's content, not its exact pixel layout. */}
      <div
        className="rounded-2xl border-2 border-border bg-card p-6 mx-auto"
        style={{ maxWidth: "420px" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-serif text-lg font-bold">{firm.shopName || "Jewellers ERP"}</div>
            <div className="text-xs text-muted-foreground">Job Card No: {data.jobCardNo}</div>
            <div className="text-xs text-muted-foreground">
              Production Order: {data.productionOrderNo}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-sm">JOB CARD</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
              <QrCode className="h-3.5 w-3.5" /> QR on PDF
            </div>
          </div>
        </div>

        <div className="border-t border-border my-3" />

        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <Field
            label="Customer / Dealer"
            value={data.customerName + (data.customerPhone ? ` (${data.customerPhone})` : "")}
          />
          <Field label="Assigned Worker" value={data.assignedWorkerName || "Unassigned"} />
          <Field label="Product Name" value={data.itemName} full />
          <Field label="Product Description" value={data.itemDescription || "—"} full />
        </div>

        <div className="border-t border-border my-3" />

        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
          <Field label="Target Weight (Net)" value={`${mgToGrams(data.targetNetMg)} g`} />
          <Field label="Purity" value={purityLabel(data.purity)} />
          <Field
            label="Gold Received"
            value={
              data.goldReceivedFineMg > 0 ? `${mgToGrams(data.goldReceivedFineMg)} g fine` : "None"
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <Field label="Target Gross Weight" value={`${mgToGrams(data.targetGrossMg)} g`} />
          <Field
            label="Expected Delivery"
            value={
              data.expectedDelivery
                ? new Date(data.expectedDelivery).toLocaleDateString("en-IN")
                : "—"
            }
          />
        </div>

        {data.referenceImages.length > 0 && (
          <>
            <div className="border-t border-border my-3" />
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Reference Image(s)
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.referenceImages.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Reference ${i + 1}`}
                  className="h-16 w-16 object-cover rounded border border-border"
                />
              ))}
            </div>
          </>
        )}

        <div className="border-t border-border my-3" />
        <Field label="Remarks" value={data.remarks || "—"} full />

        <div className="flex justify-between mt-8 pt-3 text-[11px] text-muted-foreground">
          <div className="border-t border-border pt-1 w-24 text-center">Issued By</div>
          <div className="border-t border-border pt-1 w-32 text-center">Worker Acknowledgement</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

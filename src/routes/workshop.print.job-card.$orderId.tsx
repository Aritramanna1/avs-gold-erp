/**
 * Job Card Print Route — renders a proper A5 PrintLayout for the unified
 * print preview modal (iframe). Accessed via triggerPrint() from the
 * job-card preview page. Read-only; no data mutations.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { buildJobCardData } from "@/lib/job-card-engine";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { mgToGrams } from "@/lib/gold";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/workshop/print/job-card/$orderId")({
  head: () => ({ meta: [{ title: "Job Card Print · AVS Gold ERP" }] }),
  component: JobCardPrintPage,
});

function purityLabel(p: number): string {
  if (p >= 990) return "999 (24K)";
  if (p >= 915) return "916 (22K)";
  if (p >= 749) return "750 (18K)";
  if (p >= 584) return "585 (14K)";
  return `${p}`;
}

function JobCardPrintPage() {
  const { orderId } = useParams({ from: "/workshop/print/job-card/$orderId" });
  const order = useOrders((s) => s.orders.find((o) => o.id === orderId));
  const jobs = useJobCards((s) => s.jobs);
  const people = usePeople((s) => s.people);
  const { firm } = useSettings();

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord("job_card", orderId);

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Order not found</h1>
          <p className="text-sm text-muted-foreground">This order may have been removed.</p>
          <Link to="/orders" className="text-gold underline text-sm">
            <ArrowLeft className="inline h-3 w-3 mr-1" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const customer = people.find((p) => p.id === order.customerId);
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  const linkedJob = jobs.find((j) => j.orderId === order.id) ?? null;

  const data = buildJobCardData(
    order,
    linkedJob,
    customer?.fullName ?? "—",
    customer?.phone,
    karigar?.fullName ?? null,
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-foreground">
      <PrintToolbar
        title="Job Card"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/workshop/job-card/${orderId}`}
      />

      <div className="p-4 md:p-8 flex flex-col items-center">
        <PrintLayout
          title="JOB CARD"
          docNumber={data.jobCardNo || data.productionOrderNo}
          docType="job_card"
          recordId={orderId}
          createdAt={order.createdAt}
          size="a5"
          showQR={true}
          qrLabel="Verify Job"
          qrPosition="header"
          footerLine={`Production Order: ${data.productionOrderNo} · ${firm.shopName || "Jewellers ERP"}`}
        >
          {/* Customer & Worker */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
            <Field
              label="Customer / Dealer"
              value={data.customerName + (data.customerPhone ? ` (${data.customerPhone})` : "")}
              full
            />
            <Field label="Assigned Worker" value={data.assignedWorkerName || "Unassigned"} />
            <Field label="Product Name" value={data.itemName} />
          </div>

          {data.itemDescription && (
            <Field label="Product Description" value={data.itemDescription} full />
          )}

          <div className="border-t border-stone-200 my-3" />

          {/* Specifications */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm mb-3">
            <Field label="Target Weight (Net)" value={`${mgToGrams(data.targetNetMg)} g`} />
            <Field label="Purity" value={purityLabel(data.purity)} />
            <Field
              label="Gold Received"
              value={
                data.goldReceivedFineMg > 0
                  ? `${mgToGrams(data.goldReceivedFineMg)} g fine`
                  : "None"
              }
            />
            <Field label="Target Gross Wt" value={`${mgToGrams(data.targetGrossMg)} g`} />
            <Field
              label="Expected Delivery"
              value={
                data.expectedDelivery
                  ? new Date(data.expectedDelivery).toLocaleDateString("en-IN")
                  : "—"
              }
            />
            <Field label="Priority" value={linkedJob?.priority ?? "—"} />
          </div>

          {/* Reference Images */}
          {data.referenceImages.length > 0 && (
            <>
              <div className="border-t border-stone-200 my-3" />
              <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-2 font-semibold">
                Reference Images
              </div>
              <div className="flex gap-3 flex-wrap mb-3">
                {data.referenceImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Reference ${i + 1}`}
                    className="h-20 w-20 object-cover rounded border border-stone-300"
                  />
                ))}
              </div>
            </>
          )}

          <div className="border-t border-stone-200 my-3" />
          <Field label="Remarks" value={data.remarks || "—"} full />

          {/* Signature area */}
          <div className="flex justify-between mt-8 pt-3 text-[11px] text-stone-500">
            <div className="border-t border-stone-300 pt-1 w-28 text-center">Issued By</div>
            <div className="border-t border-stone-300 pt-1 w-36 text-center">
              Worker Acknowledgement
            </div>
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-3" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
        {label}
      </div>
      <div className="font-medium text-stone-900 text-sm">{value}</div>
    </div>
  );
}

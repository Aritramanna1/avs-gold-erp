import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { referenceImagesForOrder } from "@/lib/job-card-engine";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintQR } from "@/components/print-qr";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/workshop/print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [{ title: `Print Job Card · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

function PrintPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/workshop/print/$id" });
  const job = useJobCards((s) =>
    s.jobs.find((j) => j.id === id || j.id.toLowerCase() === id.toLowerCase()),
  );
  const people = usePeople((s) => s.people);

  const karigar = job?.karigarId ? people.find((p) => p.id === job.karigarId) : null;

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord("job_card", job?.id ?? "");

  if (!job) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Job Card not found</h1>
          <Link to="/workshop" className="text-gold underline">
            Back to Workshop
          </Link>
        </div>
      </div>
    );
  }

  const customer = people.find((p) => p.id === job.customerId);
  const referenceImages = referenceImagesForOrder(job.orderId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Job Card"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/workshop/${job.id}`}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="Job Card"
          docNumber={docNumber}
          docType="job_card"
          recordId={job.id}
          createdAt={job.createdAt}
          size="a4"
          showQR={false}
        >
          <section className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-xs uppercase text-gray-500">Customer</div>
              <div className="font-medium">{customer?.fullName ?? job.customerName}</div>
              <div className="text-xs">{customer?.phone ?? ""}</div>
              {customer?.currentAddress && <div className="text-xs">{customer.currentAddress}</div>}
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Assigned Karigar</div>
              <div className="font-medium">{karigar?.fullName ?? job.karigarName ?? "—"}</div>
              <div className="text-xs">
                {karigar?.phone ?? ""}
                {karigar?.workType ? ` · ${karigar.workType}` : ""}
              </div>
              <div className="text-xs uppercase text-gray-500 mt-2">Expected delivery</div>
              <div>{job.expectedDelivery || "—"}</div>
            </div>
          </section>

          <section className="border border-gray-300 rounded mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Item</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Purity</th>
                  <th className="text-right p-2">Target Gross (g)</th>
                  <th className="text-right p-2">Target Net (g)</th>
                  <th className="text-right p-2">Target Fine (g)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="p-2">{job.itemName}</td>
                  <td className="p-2">{job.category}</td>
                  <td className="p-2 text-right">{job.purity}</td>
                  <td className="p-2 text-right font-mono">{mgToGrams(job.targetGrossMg)}</td>
                  <td className="p-2 text-right font-mono">{mgToGrams(job.targetNetMg)}</td>
                  <td className="p-2 text-right font-mono">{mgToGrams(job.targetFineMg)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {referenceImages.length > 0 && (
            <section className="border border-gray-300 rounded mb-4 p-2">
              <div className="text-xs uppercase text-gray-600 mb-2">Reference Images</div>
              <div className="flex flex-wrap gap-2">
                {referenceImages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Reference ${i + 1}`}
                    className="h-32 w-32 object-contain border border-gray-200 rounded"
                  />
                ))}
              </div>
            </section>
          )}

          <section className="text-sm mb-4">
            <div>
              Status: <b>{JOB_STATUS_LABELS[job.status]}</b> · Priority: {job.priority}
            </div>
            {job.notes && <div className="text-xs italic mt-1">{job.notes}</div>}
          </section>

          <footer className="mt-12 grid grid-cols-[1fr_auto_1fr] gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Karigar signature"}
              </div>
            </div>
            <PrintQR
              docType="job_card"
              docNumber={docNumber}
              recordId={job.id}
              createdAt={job.createdAt}
            />
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelRight || "Workshop manager signature"}
              </div>
            </div>
          </footer>
        </PrintLayout>
      </div>
    </div>
  );
}

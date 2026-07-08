import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  useJobCards,
  JOB_STATUS_LABELS,
  PROCESS_TEMPLATES,
  STEP_STATUS_LABELS,
} from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer, RotateCw } from "lucide-react";
import { useRecordPrintOnce } from "@/lib/use-print-recorder";
import { PrintQR } from "@/components/print-qr";
import { ReprintReasonDialog } from "@/components/reprint-dialog";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";

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

  const { reprintOpen, requestReprint, closeReprint, doReprint } = useRecordPrintOnce({
    docType: "job_card",
    docNumber: job?.jobNo ?? "—",
    linkedId: job?.id ?? "",
    linkedLabel: job ? `${job.jobNo} · ${karigar?.fullName ?? "—"}` : "—",
  });

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
  const template = job.templateKey ? PROCESS_TEMPLATES[job.templateKey] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link
          to="/workshop/$id"
          params={{ id: job.id }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to job card
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={requestReprint} className="gap-2">
            <RotateCw className="h-4 w-4" /> Reprint
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>
      <ReprintReasonDialog open={reprintOpen} onClose={closeReprint} onConfirm={doReprint} />

      <div className="max-w-3xl mx-auto p-8 print:p-0">
        <div className="bg-white text-black rounded-lg p-8 print:rounded-none print:shadow-none shadow">
          <header className="flex items-center justify-between border-b-2 border-yellow-700 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <Logo variant="svg" className="h-12 w-12 object-contain" />
              <div>
                <div className="font-serif text-2xl text-yellow-800">{firm.shopName}</div>
                <div className="text-xs text-gray-600">Workshop · Job Card</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">Job Card</div>
              <div className="font-mono text-sm">{job.jobNo}</div>
              <div className="text-xs text-gray-600">Order {job.orderNo}</div>
              <div className="text-xs text-gray-600">
                {new Date(job.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
          </header>

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

          <section className="border border-gray-300 rounded mb-4">
            <div className="bg-gray-100 px-2 py-1 text-xs uppercase text-gray-600">
              Process — {template?.name ?? "Standard Process"}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 w-10">#</th>
                  <th className="text-left p-2">Step</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {job.steps.map((s, i) => (
                  <tr key={s.id} className="border-t border-gray-200">
                    <td className="p-2 text-gray-500">{i + 1}</td>
                    <td className="p-2">{s.name}</td>
                    <td className="p-2">{STEP_STATUS_LABELS[s.status]}</td>
                    <td className="p-2 text-xs text-gray-700">{s.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

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
              docNumber={job.jobNo}
              recordId={job.id}
              createdAt={job.createdAt}
            />
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelRight || "Workshop manager signature"}
              </div>
            </div>
          </footer>
          <AvsPrintFooter />
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
        }
      `}</style>
    </div>
  );
}

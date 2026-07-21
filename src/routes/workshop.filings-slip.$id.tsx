import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";
import { PrintQR } from "@/components/print-qr";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/workshop/filings-slip/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Filings Receipt · ${shortName} ERP` }],
    };
  },
  component: FilingsReceiptPage,
});

function FilingsReceiptPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/workshop/filings-slip/$id" });
  const job = useJobCards((s) =>
    s.jobs.find((j) => j.id === id || j.id.toLowerCase() === id.toLowerCase()),
  );
  const people = usePeople((s) => s.people);

  if (!job || !job.workReceipt || job.workReceipt.filingsFineMg <= 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">No filings recorded</h1>
          <Link to="/workshop" className="text-gold underline">
            Back to Workshop
          </Link>
        </div>
      </div>
    );
  }

  const karigar = job.karigarId ? people.find((p) => p.id === job.karigarId) : null;
  const r = job.workReceipt;

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
        <Button onClick={() => void printDocument()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="max-w-xl mx-auto p-8 print:p-0">
        <div className="bg-white text-black rounded-lg p-8 print:rounded-none print:shadow-none shadow">
          <header className="flex items-center justify-between border-b-2 border-yellow-700 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <Logo variant="svg" className="h-10 w-10 object-contain" />
              <div>
                <div className="font-serif text-xl text-yellow-800">{firm.shopName}</div>
                <div className="text-xs text-gray-600">Filings Receipt</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">Receipt</div>
              <div className="font-mono text-sm">{r.slipNo}-F</div>
              <div className="text-xs text-gray-600">{new Date(r.ts).toLocaleString("en-IN")}</div>
            </div>
          </header>

          <div className="text-sm space-y-2 mb-6">
            <Kv k="Karigar" v={karigar?.fullName ?? job.karigarName ?? "—"} />
            <Kv k="Job Card" v={job.jobNo} />
            <Kv k="Order" v={job.orderNo} />
          </div>

          <div className="border border-gray-300 rounded">
            <table className="w-full text-sm">
              <tbody>
                <Row k="Filings gross weight" v={`${mgToGrams(r.filingsGrossMg)} g`} />
                <Row k="Purity / Touch" v={String(r.filingsPurity)} />
                <Row k="Filings fine gold" v={`${mgToGrams(r.filingsFineMg)} g`} bold />
              </tbody>
            </table>
          </div>

          <footer className="mt-16 grid grid-cols-[1fr_auto_1fr] gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Karigar signature"}
              </div>
            </div>
            <PrintQR
              docType="filings_receipt"
              docNumber={`${r.slipNo}-F`}
              recordId={job.id}
              createdAt={r.ts}
            />
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelRight || "Supervisor signature"}
              </div>
            </div>
          </footer>
          <AvsPrintFooter />
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <tr className="border-t border-gray-200">
      <td className="p-2 text-gray-700">{k}</td>
      <td className={`p-2 text-right font-mono ${bold ? "font-bold text-yellow-800" : ""}`}>{v}</td>
    </tr>
  );
}
function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";
import { PrintQR } from "@/components/print-qr";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";

export const Route = createFileRoute("/workshop/receive-slip/$id")({
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
      meta: [{ title: `Gold Receive Slip · ${shortName} ERP` }],
    };
  },
  component: ReceiveSlipPage,
});

function ReceiveSlipPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/workshop/receive-slip/$id" });
  const job = useJobCards((s) =>
    s.jobs.find((j) => j.id === id || j.id.toLowerCase() === id.toLowerCase()),
  );
  const people = usePeople((s) => s.people);

  if (!job || !job.workReceipt) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Gold Receive Slip not available</h1>
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
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-8 print:p-0">
        <div className="bg-white text-black rounded-lg p-8 print:rounded-none print:shadow-none shadow">
          <header className="flex items-center justify-between border-b-2 border-yellow-700 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <Logo variant="svg" className="h-12 w-12 object-contain" />
              <div>
                <div className="font-serif text-2xl text-yellow-800">{firm.shopName}</div>
                <div className="text-xs text-gray-600">Workshop · Gold Receive Slip</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">Slip No</div>
              <div className="font-mono text-sm">{r.slipNo}</div>
              <div className="text-xs text-gray-600">{new Date(r.ts).toLocaleString("en-IN")}</div>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-xs uppercase text-gray-500">Job Card</div>
              <div className="font-mono">{job.jobNo}</div>
              <div className="text-xs uppercase text-gray-500 mt-2">Order</div>
              <div className="font-mono">{job.orderNo}</div>
              <div className="text-xs uppercase text-gray-500 mt-2">Item</div>
              <div>{job.itemName}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Karigar</div>
              <div className="font-medium">{karigar?.fullName ?? job.karigarName ?? "—"}</div>
              <div className="text-xs uppercase text-gray-500 mt-2">Issued</div>
              <div className="font-mono">{mgToGrams(job.goldIssue?.fineMg ?? 0)} g fine</div>
            </div>
          </section>

          <section className="border border-gray-300 rounded mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Component</th>
                  <th className="text-right p-2">Gross (g)</th>
                  <th className="text-right p-2">Purity</th>
                  <th className="text-right p-2">Fine (g)</th>
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Finished"
                  gross={r.finishedGrossMg}
                  purity={r.finishedPurity}
                  fine={r.finishedFineMg}
                  bold
                />
                <Row
                  label="Scrap returned"
                  gross={r.scrapGrossMg}
                  purity={r.scrapPurity}
                  fine={r.scrapFineMg}
                />
                <Row
                  label="Filings returned"
                  gross={r.filingsGrossMg}
                  purity={r.filingsPurity}
                  fine={r.filingsFineMg}
                />
                {r.dustFineMg > 0 && (
                  <Row label="Dust returned" gross={0} purity={0} fine={r.dustFineMg} />
                )}
              </tbody>
            </table>
          </section>

          <section className="grid grid-cols-3 gap-2 text-sm mb-4">
            <Box
              label="Expected loss"
              value={`${mgToGrams(r.expectedLossMg)} g`}
              sub={`@ ${r.expectedWastagePct}%`}
            />
            <Box label="Actual loss" value={`${mgToGrams(r.actualLossMg)} g`} />
            <Box
              label="Overloss"
              value={`${mgToGrams(r.overlossMg)} g`}
              tone={r.overlossMg > 0 ? "red" : undefined}
            />
          </section>

          {r.notes && <p className="text-xs italic mb-4">Notes: {r.notes}</p>}

          <footer className="mt-12 grid grid-cols-[1fr_auto_1fr] gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Karigar signature"}
              </div>
            </div>
            <PrintQR
              docType="gold_receive_slip"
              docNumber={r.slipNo}
              recordId={job.id}
              createdAt={r.ts}
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

      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
    </div>
  );
}

function Row({
  label,
  gross,
  purity,
  fine,
  bold,
}: {
  label: string;
  gross: number;
  purity: number;
  fine: number;
  bold?: boolean;
}) {
  return (
    <tr className="border-t border-gray-200">
      <td className={`p-2 ${bold ? "font-medium" : ""}`}>{label}</td>
      <td className="p-2 text-right font-mono">{gross > 0 ? mgToGrams(gross) : "—"}</td>
      <td className="p-2 text-right font-mono">{purity > 0 ? purity : "—"}</td>
      <td className={`p-2 text-right font-mono ${bold ? "font-bold" : ""}`}>{mgToGrams(fine)}</td>
    </tr>
  );
}

function Box({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "red";
}) {
  return (
    <div
      className={`rounded border p-2 ${tone === "red" ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-600">{label}</div>
      <div className={`font-mono ${tone === "red" ? "text-red-700 font-bold" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}

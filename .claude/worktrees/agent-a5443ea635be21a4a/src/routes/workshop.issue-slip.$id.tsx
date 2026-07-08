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

export const Route = createFileRoute("/workshop/issue-slip/$id")({
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
      meta: [{ title: `Gold Issue Slip · ${shortName} ERP` }],
    };
  },
  component: IssueSlipPage,
});

function IssueSlipPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/workshop/issue-slip/$id" });
  const job = useJobCards((s) =>
    s.jobs.find((j) => j.id === id || j.id.toLowerCase() === id.toLowerCase()),
  );
  const people = usePeople((s) => s.people);

  if (!job || !job.goldIssue) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Gold Issue Slip not available</h1>
          <Link to="/workshop" className="text-gold underline">
            Back to Workshop
          </Link>
        </div>
      </div>
    );
  }
  const karigar = job.karigarId ? people.find((p) => p.id === job.karigarId) : null;
  const gi = job.goldIssue;

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
                <div className="text-xs text-gray-600">Workshop · Gold Issue Slip</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">Slip No</div>
              <div className="font-mono text-sm">{gi.slipNo}</div>
              <div className="text-xs text-gray-600">{new Date(gi.ts).toLocaleString("en-IN")}</div>
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
              <div className="text-xs">{karigar?.phone ?? ""}</div>
              <div className="text-xs uppercase text-gray-500 mt-2">Source</div>
              <div>Vault</div>
            </div>
          </section>

          <section className="border border-gray-300 rounded mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-right p-2">Gross (g)</th>
                  <th className="text-right p-2">Purity / Touch</th>
                  <th className="text-right p-2">Fine (g)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="p-2 text-right font-mono">{mgToGrams(gi.grossMg)}</td>
                  <td className="p-2 text-right font-mono">{gi.purity}</td>
                  <td className="p-2 text-right font-mono font-bold">{mgToGrams(gi.fineMg)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {gi.notes && <p className="text-xs italic mb-4">Notes: {gi.notes}</p>}
          {gi.issuedBy && (
            <p className="text-xs mb-4">
              Issued by: <b>{gi.issuedBy}</b>
            </p>
          )}

          <footer className="mt-16 grid grid-cols-[1fr_auto_1fr] gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Karigar signature"}
              </div>
            </div>
            <PrintQR
              docType="gold_issue_slip"
              docNumber={gi.slipNo}
              recordId={job.id}
              createdAt={gi.ts}
            />
            <div className="text-right">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelRight || "Manager / Store signature"}
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

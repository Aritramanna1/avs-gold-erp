import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMetalConversion } from "@/lib/metal-conversion-store";
import { mgToGrams } from "@/lib/gold";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/conversion/slip/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Conversion Slip · ${shortName} ERP` }],
    };
  },
  component: ConversionSlipPage,
});

function ConversionSlipPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/conversion/slip/$id" });
  const { records, refresh } = useMetalConversion();
  const record = records.find((r) => r.id === id);

  useEffect(() => {
    if (records.length === 0) void refresh();
  }, [records.length, refresh]);

  if (!record) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Conversion slip not available</h1>
          <Link to="/conversion" className="text-gold underline">
            Back to Metal Conversion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link
          to="/conversion"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Metal Conversion
        </Link>
        <Button onClick={() => void printDocument()} className="gap-2">
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
                <div className="text-xs text-gray-600">Metal Conversion Slip</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-gray-600">Batch No</div>
              <div className="font-mono text-sm">{record.batchNo}</div>
              <div className="text-xs text-gray-600">
                {new Date(record.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-xs uppercase text-gray-500">Source Purity</div>
              <div className="font-mono">{record.sourcePurity}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Destination Purity</div>
              <div className="font-mono">{record.destPurity}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Operator</div>
              <div>{record.operator}</div>
            </div>
          </section>

          <section className="border border-gray-300 rounded mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2">Field</th>
                  <th className="text-right p-2">Weight (g)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="p-2 font-medium">Input Weight (fine)</td>
                  <td className="p-2 text-right font-mono font-bold">
                    {mgToGrams(record.inputFineMg)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="p-2">Expected Output</td>
                  <td className="p-2 text-right font-mono">
                    {mgToGrams(record.expectedOutputFineMg)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="p-2 font-medium">Actual Output</td>
                  <td className="p-2 text-right font-mono font-bold">
                    {mgToGrams(record.actualOutputFineMg)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="p-2">Alloy Added (mg)</td>
                  <td className="p-2 text-right font-mono">{record.alloyAddedMg}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div
              className={`rounded border p-2 ${record.conversionLossMg > 0 ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-gray-600">
                Conversion Loss
              </div>
              <div
                className={`font-mono ${record.conversionLossMg > 0 ? "text-red-700 font-bold" : ""}`}
              >
                {mgToGrams(record.conversionLossMg)} g
              </div>
            </div>
            <div className="rounded border border-gray-300 bg-gray-50 p-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-600">Recovery</div>
              <div className="font-mono">{mgToGrams(record.recoveryMg)} g</div>
            </div>
          </section>

          {record.notes && <p className="text-xs italic mb-4">Notes: {record.notes}</p>}

          <footer className="mt-12 grid grid-cols-2 gap-8 text-sm items-end">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">
                {firm.signatureLabelLeft || "Operator signature"}
              </div>
            </div>
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

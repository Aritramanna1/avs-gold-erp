import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { mgToGrams } from "@/lib/gold";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";

export const Route = createFileRoute("/workshop/gold-book-print/$workerId")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Worker Custody Statement · ${shopName} ERP` }],
    };
  },
  component: GoldBookPrintPage,
});

function GoldBookPrintPage() {
  const { workerId } = useParams({ from: "/workshop/gold-book-print/$workerId" });
  const worker = usePeople((s) => s.people.find((p) => p.id === workerId));
  const { entries, getWorkerBalance } = useWorkerGoldBook();

  const wEntries = entries
    .filter((e) => e.workerId === workerId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const summary = getWorkerBalance(workerId);

  const docNumber = `STMT-${workerId.toUpperCase().slice(-6)}`;

  const {
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord({
    docType: "karigar_custody_statement",
    docNumber,
    linkedId: workerId,
    linkedLabel: worker?.fullName,
  });

  if (!worker) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Worker not found</h1>
          <p className="text-sm text-muted-foreground">This worker may have been removed.</p>
          <Link to="/workshop/gold-book" className="text-gold underline">
            Back to Gold Book
          </Link>
        </div>
      </div>
    );
  }

  let runningFine = 0;
  let runningQty = 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Worker Custody Statement"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/workshop/gold-book"
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="Worker Custody Ledger Statement"
          docNumber={docNumber}
          docType="karigar_custody_statement"
          recordId={workerId}
          createdAt={Date.now()}
          size="a4"
        >
          {/* Worker profile & summary */}
          <div className="grid grid-cols-3 gap-4 border border-stone-200 rounded-xl p-4 bg-stone-50 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold mb-1">
                Worker
              </div>
              <div className="font-serif text-sm font-bold text-stone-900">{worker.fullName}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">{worker.phone}</div>
            </div>
            <div className="border-l border-stone-200 pl-4">
              <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold mb-1">
                Cumulative Fine Gold
              </div>
              <div className="font-mono space-y-0.5">
                <div>
                  Given:{" "}
                  <strong className="text-red-700">{mgToGrams(summary.totalGivenFine)} g</strong>
                </div>
                <div>
                  Returned:{" "}
                  <strong className="text-emerald-700">
                    {mgToGrams(summary.totalReturnedFine)} g
                  </strong>
                </div>
              </div>
            </div>
            <div className="border-l border-stone-200 pl-4">
              <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold mb-1">
                Closing Balance Pending
              </div>
              <div className="text-sm font-bold text-amber-700 font-mono">
                {mgToGrams(summary.pendingFine)} g Fine Gold
              </div>
              <div className="text-[10px] text-stone-500 font-mono">
                {summary.pendingQty} pieces material qty
              </div>
            </div>
          </div>

          {/* Statement table */}
          <div className="border border-stone-300 rounded-xl overflow-hidden bg-white mt-6">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-100 text-stone-600 uppercase font-mono text-[9px] tracking-wider border-b border-stone-300">
                <tr>
                  <th className="px-2.5 py-2">Date &amp; Time</th>
                  <th className="px-2.5 py-2">Voucher No</th>
                  <th className="px-2.5 py-2">Particulars</th>
                  <th className="px-2.5 py-2">Type</th>
                  <th className="px-2.5 py-2 text-right">Net Wt. (g)</th>
                  <th className="px-2.5 py-2 text-right">Fine Gold (g)</th>
                  <th className="px-2.5 py-2 text-right">Qty</th>
                  <th className="px-2.5 py-2 text-right border-l border-stone-300">Bal (Fine)</th>
                  <th className="px-2.5 py-2 text-right">Bal (Qty)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {wEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-stone-400 italic">
                      No ledger transactions found for this worker.
                    </td>
                  </tr>
                ) : (
                  wEntries.map((e) => {
                    const isGiven = e.type === "given";
                    if (isGiven) {
                      runningFine += e.fineMg;
                      runningQty += e.quantity;
                    } else {
                      runningFine -= e.fineMg;
                      runningQty -= e.quantity;
                    }
                    return (
                      <tr key={e.id} className="hover:bg-stone-50">
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <div>{e.date}</div>
                          <div className="text-[9px] text-stone-400 font-mono">{e.time}</div>
                        </td>
                        <td className="px-2.5 py-2 font-mono font-medium">{e.entryNo}</td>
                        <td className="px-2.5 py-2 max-w-[160px] break-words">
                          <span className="font-semibold">{e.particulars}</span>
                          {e.reference && (
                            <div className="text-[9px] text-stone-400">Ref: {e.reference}</div>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <span
                            className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isGiven ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}
                          >
                            {isGiven ? "Issued" : "Returned"}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono">{mgToGrams(e.netMg)}</td>
                        <td
                          className={`px-2.5 py-2 text-right font-mono font-semibold ${isGiven ? "text-red-700" : "text-emerald-700"}`}
                        >
                          {e.fineMg > 0 ? mgToGrams(e.fineMg) : "—"}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono">
                          {e.quantity > 0 ? e.quantity : "—"}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono font-bold border-l border-stone-300">
                          {mgToGrams(runningFine)} g
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-stone-600">
                          {runningQty} pcs
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-2 gap-12 break-inside-avoid">
            <div>
              <div className="h-16 border-b border-stone-300" />
              <div className="mt-1.5 text-xs text-stone-600 font-mono">Worker Signature</div>
            </div>
            <div>
              <div className="h-16 border-b border-stone-300" />
              <div className="mt-1.5 text-xs text-stone-600 font-mono">Authorized Supervisor</div>
            </div>
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

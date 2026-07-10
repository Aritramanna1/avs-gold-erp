import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling, paiseToRupees, computeInvoiceTotals } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";

export const Route = createFileRoute("/billing/estimate/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimatePrint,
});

function EstimatePrint() {
  const { id } = useParams({ from: "/billing/estimate/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(inv ? "invoice_quote_preview" : null, id);

  if (!inv) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Invoice not found</h1>
          <Link to="/billing" className="text-gold underline">
            Back to Billing
          </Link>
        </div>
      </div>
    );
  }

  const totals = computeInvoiceTotals(inv.items, inv.gst, inv.orderAdjustment, inv.payments);
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Estimate"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/billing/${inv.id}`}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="ESTIMATE"
          docNumber={inv.invoiceNo}
          docType="invoice_quote_preview"
          recordId={inv.id}
          createdAt={Date.now()}
          size="a4"
          showQR={false}
          footerLine={`Valid until ${validUntil} — this is a non-binding estimate, not a tax invoice.`}
        >
          <div className="text-sm mb-4">
            <div className="text-xs uppercase text-stone-500">Quotation For</div>
            <div className="font-semibold text-base">{inv.customerName}</div>
            {inv.customerPhone && <div className="text-sm text-stone-500">{inv.customerPhone}</div>}
            <div className="text-xs text-amber-600 font-medium mt-1">Valid until: {validUntil}</div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-amber-500 text-xs uppercase text-stone-500">
                <th className="text-left py-2 pr-4 w-8">#</th>
                <th className="text-left py-2 pr-4">Item</th>
                <th className="text-center py-2 px-2">Purity</th>
                <th className="text-center py-2 px-2">Gross</th>
                <th className="text-center py-2 px-2 text-amber-600">Fine</th>
                <th className="text-center py-2 px-2">Rate ₹/g</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, idx) => (
                <tr key={it.id} className="border-b border-stone-100">
                  <td className="py-3 pr-4 text-stone-400 text-xs">{idx + 1}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{it.itemName}</div>
                    {it.category && <div className="text-xs text-stone-400">{it.category}</div>}
                  </td>
                  <td className="py-3 px-2 text-center text-xs font-mono">{it.purity}</td>
                  <td className="py-3 px-2 text-center text-xs font-mono">
                    {mgToGrams(it.grossMg)}g
                  </td>
                  <td className="py-3 px-2 text-center text-xs font-mono text-amber-600 font-semibold">
                    {mgToGrams(it.fineMg)}g
                  </td>
                  <td className="py-3 px-2 text-center text-xs font-mono">
                    ₹{paiseToRupees(it.goldRatePerGramPaise)}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    ₹{Number(paiseToRupees(it.lineTotalPaise)).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1 text-stone-500">
                <span>Subtotal</span>
                <span className="font-mono">
                  ₹{Number(paiseToRupees(totals.subtotalPaise)).toLocaleString("en-IN")}
                </span>
              </div>
              {totals.gstPaise > 0 && (
                <div className="flex justify-between py-1 text-stone-500 text-xs">
                  <span>GST ({inv.gst})</span>
                  <span className="font-mono">
                    ₹{Number(paiseToRupees(totals.gstPaise)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              {totals.adjustmentPaise > 0 && (
                <div className="flex justify-between py-1 text-emerald-600 text-xs">
                  <span>Advance / Adjustment</span>
                  <span className="font-mono">
                    − ₹{Number(paiseToRupees(totals.adjustmentPaise)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-amber-500 mt-1 font-bold text-base">
                <span>Grand Total</span>
                <span className="font-mono text-amber-700">
                  ₹{Number(paiseToRupees(totals.grandTotalPaise)).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-2 border-t border-stone-100">
            <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
              Terms &amp; Conditions
            </div>
            <ul className="text-xs text-stone-400 space-y-0.5">
              <li>• Gold rate applicable on date of delivery.</li>
              <li>• This estimate is valid for 7 days.</li>
              <li>• Making charges may vary on final design.</li>
              <li>• 30% advance required to confirm order.</li>
              <li>• All disputes subject to local jurisdiction.</li>
            </ul>
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

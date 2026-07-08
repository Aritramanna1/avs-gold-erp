import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling, paiseToRupees, computeInvoiceTotals } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/billing/estimate/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimatePrint,
});

function EstimatePrint() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/billing/estimate/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  if (!inv) return <div className="p-8">Invoice not found.</div>;

  const totals = computeInvoiceTotals(inv.items, inv.gst, inv.orderAdjustment, inv.payments);
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 print:bg-white print:p-0">
      {/* Toolbar — hidden on print */}
      <div className="flex gap-2 mb-4 print:hidden">
        <Link to="/billing/$id" params={{ id: inv.id }}>
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Invoice
          </Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print Estimate
        </Button>
      </div>

      {/* A4 page */}
      <div
        className="bg-white text-neutral-900 shadow-lg rounded-lg mx-auto print:shadow-none print:rounded-none"
        style={{ maxWidth: 794, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="border-b-4 border-amber-500 px-10 py-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Logo variant="png" className="h-12 w-12 object-contain flex-shrink-0" />
                <div
                  className="text-2xl font-bold tracking-wide text-amber-700"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {firm.shopName.toUpperCase()}
                </div>
              </div>
              {firm.address && (
                <div className="text-xs text-neutral-500 mt-1 max-w-[280px]">{firm.address}</div>
              )}
              {firm.phone && (
                <div className="text-xs text-neutral-500 inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {firm.phone}
                  {firm.email ? (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <Mail className="h-3 w-3" /> {firm.email}
                    </span>
                  ) : null}
                </div>
              )}
              {firm.gstin && (
                <div className="text-[10px] text-neutral-400 mt-1">GSTIN: {firm.gstin}</div>
              )}
            </div>
            <div className="text-right">
              <div
                className="text-3xl font-bold text-amber-600"
                style={{ letterSpacing: "0.08em" }}
              >
                ESTIMATE
              </div>
              <div className="text-xs text-neutral-500 mt-2">
                Ref: <span className="font-mono font-semibold">{inv.invoiceNo}</span>
              </div>
              <div className="text-xs text-neutral-500">Date: {today}</div>
              <div className="text-xs text-amber-600 font-medium mt-1">
                Valid until: {validUntil}
              </div>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="px-10 py-4 bg-amber-50 border-b border-amber-100">
          <div className="text-xs uppercase tracking-wider text-amber-700 font-bold mb-1">
            Quotation For
          </div>
          <div className="font-semibold text-base">{inv.customerName}</div>
          {inv.customerPhone && (
            <div className="text-sm text-neutral-500 inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {inv.customerPhone}
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="px-10 py-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-amber-500">
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-neutral-500 font-bold w-8">
                    #
                  </th>
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    Item
                  </th>
                  <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    Purity
                  </th>
                  <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    Gross
                  </th>
                  <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-amber-600 font-bold">
                    Fine
                  </th>
                  <th className="text-center py-2 px-2 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    Rate ₹/g
                  </th>
                  <th className="text-right py-2 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, idx) => (
                  <tr key={it.id} className="border-b border-neutral-100">
                    <td className="py-3 pr-4 text-neutral-400 text-xs">{idx + 1}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{it.itemName}</div>
                      {it.category && <div className="text-xs text-neutral-400">{it.category}</div>}
                      {it.huid && (
                        <div className="text-[10px] text-neutral-400 font-mono">
                          HUID: {it.huid}
                        </div>
                      )}
                      {it.barcode && (
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Tag: {it.barcode}
                        </div>
                      )}
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
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1 text-neutral-500">
                <span>Subtotal</span>
                <span className="font-mono">
                  ₹{Number(paiseToRupees(totals.subtotalPaise)).toLocaleString("en-IN")}
                </span>
              </div>
              {totals.gstPaise > 0 && (
                <div className="flex justify-between py-1 text-neutral-500 text-xs">
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
        </div>

        {/* Terms & signature */}
        <div className="px-10 pb-8 pt-2 border-t border-neutral-100">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Terms &amp; Conditions
              </div>
              <ul className="text-xs text-neutral-400 space-y-0.5">
                <li>• Gold rate applicable on date of delivery.</li>
                <li>• This estimate is valid for 7 days.</li>
                <li>• Making charges may vary on final design.</li>
                <li>• 30% advance required to confirm order.</li>
                <li>• All disputes subject to local jurisdiction.</li>
              </ul>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-400 mb-16">For {firm.shopName}</div>
              <div className="border-t border-neutral-300 inline-block w-36 mt-1" />
              <div className="text-xs text-neutral-500">Authorised Signatory</div>
            </div>
          </div>
          <div className="mt-4 text-center text-[10px] text-neutral-300">
            This is a computer-generated estimate. Not a tax invoice.
          </div>
        </div>
      </div>
    </div>
  );
}

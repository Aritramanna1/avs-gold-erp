import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { buildCustomerSettlementSlipData } from "@/lib/customer-settlement-slip";
import { mgToGrams } from "@/lib/gold";
import { Button } from "@/components/ui/button";
import { PrintQR } from "@/components/print-qr";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/billing/settlement-slip/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    return { meta: [{ title: `Customer Settlement Slip · ${shopName ?? "AVS ERP"}` }] };
  },
  component: SettlementSlipPrint,
});

/**
 * Customer Settlement Slip — half-A4, customer-facing print template.
 * Deliberately mirrors billing.receipt.$id.tsx's plain HTML/Tailwind
 * approach (no Unified Print Engine exists yet) rather than a shared
 * component with the GST Invoice template — the two documents show
 * completely different data and must never be conflated into one layout.
 */
function SettlementSlipPrint() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/billing/settlement-slip/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  if (!inv) return <div className="p-8">Invoice not found.</div>;
  const slip = buildCustomerSettlementSlipData(inv);

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/billing/$id" params={{ id: inv.id }}>
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button
          onClick={() => void printDocument(`Customer Settlement Slip - ${slip.settlementNo}`)}
          className="gap-1.5"
          data-testid="settlement-slip-print-btn"
        >
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div data-testid="print-layout-root">
        <div
          className="bg-white text-black p-6 rounded-md shadow print:shadow-none"
          data-testid="settlement-slip-doc"
        >
          <div className="text-center border-b border-black/30 pb-3 mb-4">
            <div className="flex justify-center mb-1">
              <Logo variant="png" className="h-10 w-10 object-contain" />
            </div>
            <div className="text-xl font-serif tracking-wide">{firm.shopName.toUpperCase()}</div>
            <div className="text-xs">Customer Settlement Slip</div>
          </div>

          <div className="text-sm grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="font-bold">Customer</div>
              <div>{slip.customerName}</div>
            </div>
            <div className="text-right">
              <div>
                Settlement No. <b>{slip.settlementNo}</b>
              </div>
              <div>{new Date(slip.date).toLocaleDateString("en-IN")}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-black/30 mb-4">
            <thead className="bg-black/5">
              <tr>
                <th className="border border-black/20 p-1.5 text-left">Product</th>
                <th className="border border-black/20 p-1.5 text-right">Gross (g)</th>
                <th className="border border-black/20 p-1.5 text-right">Net (g)</th>
                <th className="border border-black/20 p-1.5 text-right">Purity</th>
                <th className="border border-black/20 p-1.5 text-right">Wastage (g)</th>
                <th className="border border-black/20 p-1.5 text-right">Pcs</th>
              </tr>
            </thead>
            <tbody>
              {slip.items.map((it, i) => (
                <tr key={i}>
                  <td className="border border-black/20 p-1.5">{it.description}</td>
                  <td className="border border-black/20 p-1.5 text-right">
                    {mgToGrams(it.grossMg)}
                  </td>
                  <td className="border border-black/20 p-1.5 text-right">{mgToGrams(it.netMg)}</td>
                  <td className="border border-black/20 p-1.5 text-right">
                    {(it.purity / 10).toFixed(1)}%
                  </td>
                  <td className="border border-black/20 p-1.5 text-right">
                    {mgToGrams(it.wastageMg)}
                  </td>
                  <td className="border border-black/20 p-1.5 text-right">{it.pcs}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full text-sm border border-black/30 mb-4">
            <tbody>
              <Row
                label="Previous Gold Balance"
                value={`${mgToGrams(slip.previousGoldBalanceMg)} g`}
              />
              <Row label="Gold Used" value={`${mgToGrams(slip.goldUsedFineMg)} g`} />
              <Row label="Gold Received" value={`${mgToGrams(slip.goldReceivedFineMg)} g`} />
              <Row
                label="Gold Balance / Closing Balance"
                value={`${mgToGrams(Math.abs(slip.closingGoldBalanceMg))} g ${slip.closingGoldBalanceMg < 0 ? "(Owed by customer)" : slip.closingGoldBalanceMg > 0 ? "(Owed to customer)" : "(Settled)"}`}
                bold
              />
              <Row
                label="Gold Rate Used"
                value={
                  slip.goldRatePerGramPaise > 0
                    ? `₹ ${paiseToRupees(slip.goldRatePerGramPaise)} / g`
                    : "—"
                }
              />
              <Row label="Cash Received" value={`₹ ${paiseToRupees(slip.cashReceivedPaise)}`} />
              <Row
                label="Closing Settlement"
                value={`₹ ${paiseToRupees(Math.abs(slip.closingSettlementPaise))} ${slip.closingSettlementPaise > 0 ? "(Due)" : slip.closingSettlementPaise < 0 ? "(Advance)" : "(Settled)"}`}
                bold
              />
            </tbody>
          </table>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 mt-10 text-xs items-end">
            <div className="border-t border-black/30 pt-2 text-center">
              {firm.signatureLabelLeft || "Customer Signature"}
            </div>
            <PrintQR
              docType="gold_settlement"
              docNumber={slip.settlementNo}
              recordId={inv.id}
              createdAt={slip.date}
            />
            <div className="border-t border-black/30 pt-2 text-center">
              {firm.signatureLabelRight || "Authorised Signatory"}
            </div>
          </div>
          <AvsPrintFooter />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "bg-black/5" : undefined}>
      <td className={`border border-black/20 p-1.5 ${bold ? "font-bold" : ""}`}>{label}</td>
      <td className={`border border-black/20 p-1.5 text-right ${bold ? "font-bold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}

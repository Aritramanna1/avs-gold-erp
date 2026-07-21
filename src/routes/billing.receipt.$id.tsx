import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling, PAYMENT_MODE_LABELS, paiseToRupees } from "@/lib/billing-store";
import { Button } from "@/components/ui/button";
import { PrintQR } from "@/components/print-qr";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { Logo } from "@/components/ui/Logo";
import { ArrowLeft, Printer } from "lucide-react";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/billing/receipt/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Payment Receipt · ${shortName} ERP` }],
    };
  },
  component: ReceiptPrint,
});

function ReceiptPrint() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/billing/receipt/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  if (!inv) return <div className="p-8">Invoice not found.</div>;
  const total = inv.payments.reduce((s, p) => s + p.amountPaise, 0);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/billing/$id" params={{ id: inv.id }}>
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button
          onClick={() => void printDocument(`Payment Receipt - ${inv.invoiceNo}`, "Receipt")}
          className="gap-1.5"
        >
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <div
        data-testid="print-layout-root"
        className="bg-white text-black p-8 rounded-md shadow print:shadow-none"
      >
        <div className="text-center border-b border-black/30 pb-3 mb-4">
          <div className="flex justify-center mb-1">
            <Logo variant="png" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-2xl font-serif tracking-wide">{firm.shopName.toUpperCase()}</div>
          <div className="text-xs">Payment Receipt</div>
        </div>

        <div className="text-sm grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="font-bold">Received From</div>
            <div>{inv.customerName}</div>
            {inv.customerPhone && <div>{inv.customerPhone}</div>}
          </div>
          <div className="text-right">
            <div>
              <b>{inv.invoiceNo}</b>
            </div>
            <div>{new Date().toLocaleString("en-IN")}</div>
          </div>
        </div>

        <table className="w-full text-sm border border-black/30 mb-4">
          <thead className="bg-black/5">
            <tr>
              <th className="border border-black/20 p-2 text-left">Date</th>
              <th className="border border-black/20 p-2 text-left">Mode</th>
              <th className="border border-black/20 p-2 text-left">Reference</th>
              <th className="border border-black/20 p-2 text-right">Amount ₹</th>
            </tr>
          </thead>
          <tbody>
            {inv.payments.map((p) => (
              <tr key={p.id}>
                <td className="border border-black/20 p-2">
                  {new Date(p.ts).toLocaleDateString("en-IN")}
                </td>
                <td className="border border-black/20 p-2">{PAYMENT_MODE_LABELS[p.mode]}</td>
                <td className="border border-black/20 p-2">{p.reference ?? "—"}</td>
                <td className="border border-black/20 p-2 text-right">
                  {paiseToRupees(p.amountPaise)}
                </td>
              </tr>
            ))}
            <tr className="bg-black/5">
              <td colSpan={3} className="border border-black/20 p-2 text-right font-bold">
                Total Received
              </td>
              <td className="border border-black/20 p-2 text-right font-bold">
                ₹ {paiseToRupees(total)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black/20 p-2 text-right">
                Invoice Balance
              </td>
              <td className="border border-black/20 p-2 text-right">
                ₹ {paiseToRupees(inv.balancePaise)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 mt-12 text-xs items-end">
          <div className="border-t border-black/30 pt-2 text-center">
            {firm.signatureLabelLeft || "Customer Signature"}
          </div>
          <PrintQR
            docType="payment_receipt"
            docNumber={inv.invoiceNo}
            recordId={inv.id}
            createdAt={inv.createdAt}
          />
          <div className="border-t border-black/30 pt-2 text-center">
            {firm.signatureLabelRight || "Authorised Signatory"}
          </div>
        </div>
        <AvsPrintFooter />
      </div>
    </div>
  );
}

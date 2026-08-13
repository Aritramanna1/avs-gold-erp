import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useBilling } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useExpensesStore } from "@/lib/expenses-store";
import { generateTallyXML, type TallyVoucher } from "@/lib/tally-export-engine";

export const Route = createFileRoute("/reports/tally-export")({
  head: () => ({ meta: [{ title: "Tally Export · AVS Gold ERP" }] }),
  component: TallyExportPage,
});

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Only these payment modes represent an actual cash/bank movement worth a
// Tally Receipt voucher — gold-exchange/credit/advance/outstanding modes
// settle through the gold ledger, not a bank/cash account.
const CASH_RECEIPT_MODES = new Set(["cash", "upi", "bank", "card", "cheque"]);

type SupplierPurchaseRow = {
  id: string;
  purchase_no: string;
  supplier_id: string;
  invoice_date: string;
  total_paise: number;
  fine_mg: number;
  data: { supplierName?: string } | null;
};

function TallyExportPage() {
  const invoices = useBilling((s) => s.invoices);
  const firm = useSettings((s) => s.firm);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(toDateInputValue(monthStart.getTime()));
  const [to, setTo] = useState(toDateInputValue(today.getTime()));
  const [purchases, setPurchases] = useState<SupplierPurchaseRow[]>([]);
  const expenses = useExpensesStore((s) => s.expenses);
  const refreshExpenses = useExpensesStore((s) => s.refresh);

  useEffect(() => {
    void refreshExpenses();
  }, [refreshExpenses]);

  useEffect(() => {
    void supabase
      .from("supplier_purchases" as never)
      .select("id,purchase_no,supplier_id,invoice_date,total_paise,fine_mg,data")
      .gte("invoice_date", from)
      .lte("invoice_date", to)
      .then(({ data, error }) => {
        if (error) {
          toast.error(`Could not load supplier purchases: ${error.message}`);
          return;
        }
        setPurchases((data ?? []) as unknown as SupplierPurchaseRow[]);
      });
  }, [from, to]);

  const vouchers = useMemo<TallyVoucher[]>(() => {
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    const periodInvoices = invoices.filter(
      (inv) => inv.createdAt >= fromMs && inv.createdAt <= toMs && inv.status !== "cancelled",
    );

    const salesVouchers: TallyVoucher[] = periodInvoices.map((inv) => {
      const fineMg = inv.items.reduce((sum, item) => sum + (item.fineMg || 0), 0);
      return {
        voucherNumber: inv.invoiceNo,
        dateStr: toDateInputValue(inv.createdAt),
        voucherType: "Sales",
        partyName: inv.customerName || "Cash Sale",
        amountPaise: inv.grandTotalPaise,
        fineGoldMg: fineMg,
        narration: `Invoice ${inv.invoiceNo}${inv.orderNo ? ` · Order ${inv.orderNo}` : ""}`,
      };
    });

    const receiptVouchers: TallyVoucher[] = periodInvoices.flatMap((inv) =>
      (inv.payments ?? [])
        .filter(
          (p) =>
            CASH_RECEIPT_MODES.has(p.mode) && p.ts >= fromMs && p.ts <= toMs && p.amountPaise > 0,
        )
        .map((p) => ({
          voucherNumber: `${inv.invoiceNo}-RCPT-${p.id.slice(-6)}`,
          dateStr: toDateInputValue(p.ts),
          voucherType: "Receipt" as const,
          partyName: inv.customerName || "Cash Sale",
          amountPaise: p.amountPaise,
          narration: `Payment (${p.mode}) against Invoice ${inv.invoiceNo}${p.reference ? ` · Ref ${p.reference}` : ""}`,
        })),
    );

    const purchaseVouchers: TallyVoucher[] = purchases.map((p) => ({
      voucherNumber: p.purchase_no,
      dateStr: p.invoice_date,
      voucherType: "Purchase",
      partyName: p.data?.supplierName || p.supplier_id,
      amountPaise: p.total_paise,
      fineGoldMg: p.fine_mg,
      narration: `Supplier Purchase ${p.purchase_no}`,
    }));

    const paymentVouchers: TallyVoucher[] = expenses
      .filter((e) => e.date >= from && e.date <= to && e.amountPaise > 0)
      .map((e) => ({
        voucherNumber: `EXP-${e.id.slice(-8)}`,
        dateStr: e.date,
        voucherType: "Payment",
        partyName: e.category || "Business Expense",
        amountPaise: e.amountPaise,
        narration: `${e.type} expense · ${e.category}${e.notes ? ` · ${e.notes}` : ""}`,
      }));

    return [...salesVouchers, ...receiptVouchers, ...purchaseVouchers, ...paymentVouchers];
  }, [invoices, purchases, expenses, from, to]);

  const totalAmountPaise = vouchers.reduce((sum, v) => sum + v.amountPaise, 0);
  const totalFineMg = vouchers.reduce((sum, v) => sum + (v.fineGoldMg ?? 0), 0);

  function handleExport() {
    if (vouchers.length === 0) {
      toast.error("No invoices in this date range to export.");
      return;
    }
    const xml = generateTallyXML(vouchers, firm?.shopName || "AVS Gold ERP");
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tally_Vouchers_${from}_to_${to}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-amber-600" />
          Tally Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Exports Sales invoices, cash/bank Receipts, and Supplier Purchases in this range as a
          Tally ERP 9 / Tally Prime XML import file (Import Data → Vouchers).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={handleExport} className="gap-2">
            <FileDown className="h-4 w-4" /> Export Tally XML
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview — {vouchers.length} voucher(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Total amount</p>
              <p className="font-semibold">₹{(totalAmountPaise / 100).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total fine gold</p>
              <p className="font-semibold">{(totalFineMg / 1000).toFixed(3)} g</p>
            </div>
          </div>
          {vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No confirmed invoices in this date range.
            </p>
          ) : (
            <>
              {/* Mobile view */}
              <div className="block md:hidden border rounded-md divide-y divide-border">
                {vouchers.slice(0, 50).map((v) => (
                  <div key={v.voucherNumber} className="p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gold font-semibold">{v.voucherNumber}</span>
                      <span className="text-[10px] text-muted-foreground">{v.dateStr}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span>
                        Type:{" "}
                        <strong className="font-medium text-foreground">{v.voucherType}</strong>
                      </span>
                      <span className="font-semibold text-foreground">
                        ₹{(v.amountPaise / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Party: <span className="font-medium text-foreground">{v.partyName}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view */}
              <div className="hidden md:block overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="p-2">Voucher</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Party</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.slice(0, 50).map((v) => (
                      <tr key={v.voucherNumber} className="border-t">
                        <td className="p-2 font-mono text-xs">{v.voucherNumber}</td>
                        <td className="p-2 text-xs">{v.voucherType}</td>
                        <td className="p-2 text-xs">{v.dateStr}</td>
                        <td className="p-2">{v.partyName}</td>
                        <td className="p-2 text-right">₹{(v.amountPaise / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vouchers.length > 50 && (
                <p className="p-2 text-xs text-muted-foreground text-center">
                  Showing first 50 of {vouchers.length} — export includes all.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

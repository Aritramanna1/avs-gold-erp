/**
 * Canonical Route: /control/tally-export
 * Schema-Validated Tally Prime XML Export Pipeline
 * Master Reference: docs/MASTER/ACCOUNTING_AND_PERIOD_CONTROL.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileDown, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useBilling } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useExpensesStore } from "@/lib/expenses-store";
import { generateTallyXML, type TallyVoucher } from "@/lib/tally-export-engine";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/control/tally-export")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Tally Prime XML Export Â· AVS ERP" }] }),
  component: ControlTallyExportPage,
});

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

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

function ControlTallyExportPage() {
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
        if (!error && Array.isArray(data)) {
          setPurchases(data as unknown as SupplierPurchaseRow[]);
        }
      });
  }, [from, to]);

  const vouchers = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime() + 86400000;
    const list: TallyVoucher[] = [];

    // 1. Sales Invoices
    for (const inv of invoices) {
      if (inv.createdAt >= fromMs && inv.createdAt <= toMs) {
        list.push({
          voucherNumber: inv.invoiceNo,
          dateStr: new Date(inv.createdAt).toISOString().slice(0, 10),
          voucherType: "Sales",
          partyName: inv.customerName || "Cash Customer",
          amountPaise: inv.grandTotalPaise,
          fineGoldMg: inv.items.reduce((sum, item) => sum + (item.fineMg || 0), 0),
          narration: `AVS Sales Invoice ${inv.invoiceNo}`,
        });

        for (const p of inv.payments) {
          if (CASH_RECEIPT_MODES.has(p.mode) && p.amountPaise > 0) {
            list.push({
              voucherNumber: `RCP-${inv.invoiceNo}-${p.id.slice(0, 4)}`,
              dateStr: new Date(inv.createdAt).toISOString().slice(0, 10),
              voucherType: "Receipt",
              partyName: inv.customerName || "Cash Customer",
              amountPaise: p.amountPaise,
              narration: `Payment received for ${inv.invoiceNo} via ${p.mode.toUpperCase()}`,
            });
          }
        }
      }
    }

    // 2. Purchases
    for (const pur of purchases) {
      list.push({
        voucherNumber: pur.purchase_no,
        dateStr: pur.invoice_date,
        voucherType: "Purchase",
        partyName: pur.data?.supplierName || "Bullion Supplier",
        amountPaise: pur.total_paise,
        fineGoldMg: pur.fine_mg,
        narration: `Raw Gold Purchase ${pur.purchase_no}`,
      });
    }

    // 3. Expenses
    for (const exp of expenses) {
      const expMs = new Date(exp.date).getTime();
      if (expMs >= fromMs && expMs <= toMs) {
        list.push({
          voucherNumber: `EXP-${exp.id.slice(0, 6)}`,
          dateStr: exp.date,
          voucherType: "Payment",
          partyName: exp.category || "Workshop Operating Expense",
          amountPaise: exp.amountPaise,
          narration: exp.notes || `Workshop Expense EXP-${exp.id.slice(0, 6)}`,
        });
      }
    }

    return list;
  }, [invoices, purchases, expenses, from, to]);

  const handleExportXML = () => {
    if (vouchers.length === 0) {
      toast.error("No vouchers found in selected date range.");
      return;
    }
    const xml = generateTallyXML(vouchers, firm?.shopName || APP_NAME);
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tally_prime_export_${from}_to_${to}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${vouchers.length} vouchers to Tally XML format.`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Tally Prime XML Export"
        subtitle="Export schema-validated XML vouchers (Sales, Purchases, Receipts, Payments) directly to Tally Prime."
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Date Range & Scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">From Date</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">To Date</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/40 border text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Vouchers Compiled:</span>
              <span className="font-bold text-foreground">{vouchers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target ERP Schema:</span>
              <span className="font-mono text-foreground">
                Tally Prime / Tally.ERP 9 XML (Vouchers)
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleExportXML} className="gap-2 text-xs">
              <FileDown className="h-4 w-4" /> Export Tally XML
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


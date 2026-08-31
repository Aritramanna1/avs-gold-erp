import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { previewSettlementTotals, type Settlement } from "@/lib/settlement-store";
import { paiseToRupees, type Invoice } from "@/lib/billing-store";
import { fetchDeliverySummaryData } from "@/lib/delivery-summary-query";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { printDocument } from "@/lib/print-document";
import { AlertTriangle, Download, Loader2, Printer, RotateCcw, Truck } from "lucide-react";

export const Route = createFileRoute("/reports/delivery-summary")({
  head: () => ({ meta: [{ title: "Daily Delivery Summary · AVS Gold ERP" }] }),
  component: DeliverySummaryPage,
});

const CASH_MODES = new Set(["cash", "upi", "bank", "card", "cheque"]);

function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function deliveredOn(s: Settlement, date: string): boolean {
  return !!s.deliveredAt && dateKey(s.deliveredAt) === date;
}

/** Once a settlement is finalised, its linked GST Invoice is the single
 * source of truth for GST/TCS/balance — read from there rather than
 * recomputing via previewSettlementTotals(), which uses the CURRENT global
 * tax settings and would drift from what was actually charged if those
 * settings changed after finalisation. Still-draft settlements (no invoice
 * yet) fall back to the live preview, same as the rest of the app. */
function resolveSettlementFinancials(
  s: Settlement,
  invoicesById: Map<string, Invoice>,
): { gstPaise: number; tcsPaise: number; balancePaise: number; labourPaise: number } {
  const labourPaise = s.items.reduce((sum, it) => sum + it.makingChargesPaise, 0);
  const invoice = s.linkedInvoiceId ? invoicesById.get(s.linkedInvoiceId) : undefined;
  if (invoice) {
    return {
      gstPaise: invoice.gstPaise,
      tcsPaise: invoice.tcsPaise,
      balancePaise: invoice.balancePaise,
      labourPaise,
    };
  }
  const totals = previewSettlementTotals(s.items, s.gst, s.payments);
  return {
    gstPaise: totals.gstPaise,
    tcsPaise: totals.tcsPaise,
    balancePaise: totals.balancePaise,
    labourPaise,
  };
}

interface DealerRow {
  customerName: string;
  ordersDelivered: number;
  itemsDelivered: number;
  goldDeliveredMg: number;
  goldReceivedMg: number;
  cashReceivedPaise: number;
  labourPaise: number;
  gstPaise: number;
  tcsPaise: number;
  outstandingGoldMg: number;
  outstandingCashPaise: number;
  pendingSettlements: number;
  remarks: string[];
  deliveryPerson: string;
}

/** One row per dealer/customer for settlements delivered on the given date —
 * this is the operator's internal reconciliation document, never sent to the
 * customer and never a substitute for the GST Invoice / Settlement Receipt. */
export function computeDailyDeliverySummary(
  settlements: Settlement[],
  date: string,
  invoices: Invoice[] = [],
): DealerRow[] {
  const invoicesById = new Map(invoices.map((i) => [i.id, i]));
  const todays = settlements.filter((s) => deliveredOn(s, date));
  const byCustomer = new Map<string, DealerRow>();

  for (const s of todays) {
    const financials = resolveSettlementFinancials(s, invoicesById);
    const goldDeliveredMg = s.items.reduce((sum, it) => sum + it.fineMg, 0);
    const goldReceivedMg = s.payments
      .filter((p) => p.mode === "gold_exchange")
      .reduce((sum, p) => sum + (p.goldFineMg ?? 0), 0);
    const cashReceivedPaise = s.payments
      .filter((p) => CASH_MODES.has(p.mode))
      .reduce((sum, p) => sum + p.amountPaise, 0);

    const key = s.customerName;
    const row = byCustomer.get(key) ?? {
      customerName: s.customerName,
      ordersDelivered: 0,
      itemsDelivered: 0,
      goldDeliveredMg: 0,
      goldReceivedMg: 0,
      cashReceivedPaise: 0,
      labourPaise: 0,
      gstPaise: 0,
      tcsPaise: 0,
      outstandingGoldMg: 0,
      outstandingCashPaise: 0,
      pendingSettlements: 0,
      remarks: [],
      deliveryPerson: s.deliveryPersonName ?? "",
    };

    row.ordersDelivered += 1;
    row.itemsDelivered += s.items.length;
    row.goldDeliveredMg += goldDeliveredMg;
    row.goldReceivedMg += goldReceivedMg;
    row.cashReceivedPaise += cashReceivedPaise;
    row.labourPaise += financials.labourPaise;
    row.gstPaise += financials.gstPaise;
    row.tcsPaise += financials.tcsPaise;
    row.outstandingCashPaise += Math.max(0, financials.balancePaise);
    if (!s.finalisedAt) row.pendingSettlements += 1;
    if (s.dealerRemarks?.trim()) row.remarks.push(s.dealerRemarks.trim());
    if (s.employeeRemarks?.trim()) row.remarks.push(s.employeeRemarks.trim());
    if (!row.deliveryPerson && s.deliveryPersonName) row.deliveryPerson = s.deliveryPersonName;

    byCustomer.set(key, row);
  }

  return Array.from(byCustomer.values()).sort((a, b) =>
    a.customerName.localeCompare(b.customerName),
  );
}

interface DeliveryPersonRow {
  name: string;
  dealersVisited: number;
  ordersDelivered: number;
  goldCarriedMg: number;
  goldReturnedMg: number;
  cashCollectedPaise: number;
  outstandingCashPaise: number;
  remarks: string[];
}

/** One row per delivery person for settlements delivered on the given date —
 * "Gold Carried" is the fine gold in the jewellery taken out; "Gold
 * Returned" is any gold the customer paid back (gold_exchange payments). */
export function computeDeliveryPersonSummary(
  settlements: Settlement[],
  date: string,
  invoices: Invoice[] = [],
): DeliveryPersonRow[] {
  const invoicesById = new Map(invoices.map((i) => [i.id, i]));
  const todays = settlements.filter((s) => deliveredOn(s, date) && s.deliveryPersonName);
  const byPerson = new Map<string, DeliveryPersonRow>();

  for (const s of todays) {
    const name = s.deliveryPersonName!.trim();
    if (!name) continue;
    const financials = resolveSettlementFinancials(s, invoicesById);
    const goldCarriedMg = s.items.reduce((sum, it) => sum + it.fineMg, 0);
    const goldReturnedMg = s.payments
      .filter((p) => p.mode === "gold_exchange")
      .reduce((sum, p) => sum + (p.goldFineMg ?? 0), 0);
    const cashCollectedPaise = s.payments
      .filter((p) => CASH_MODES.has(p.mode))
      .reduce((sum, p) => sum + p.amountPaise, 0);

    const row = byPerson.get(name) ?? {
      name,
      dealersVisited: 0,
      ordersDelivered: 0,
      goldCarriedMg: 0,
      goldReturnedMg: 0,
      cashCollectedPaise: 0,
      outstandingCashPaise: 0,
      remarks: [],
    };

    row.dealersVisited += 1;
    row.ordersDelivered += 1;
    row.goldCarriedMg += goldCarriedMg;
    row.goldReturnedMg += goldReturnedMg;
    row.cashCollectedPaise += cashCollectedPaise;
    row.outstandingCashPaise += Math.max(0, financials.balancePaise);
    if (s.employeeRemarks?.trim()) row.remarks.push(s.employeeRemarks.trim());

    byPerson.set(name, row);
  }

  return Array.from(byPerson.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function todayStr(): string {
  return dateKey(Date.now());
}

function DeliverySummaryPage() {
  const [date, setDate] = useState(todayStr());
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDeliverySummaryData(date)
      .then((data) => {
        if (cancelled) return;
        setSettlements(data.settlements);
        setInvoices(data.invoices);
        setCapped(data.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setSettlements([]);
        setInvoices([]);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load delivery summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  const dealerRows = useMemo(
    () => computeDailyDeliverySummary(settlements, date, invoices),
    [settlements, date, invoices],
  );
  const personRows = useMemo(
    () => computeDeliveryPersonSummary(settlements, date, invoices),
    [settlements, date, invoices],
  );

  function handleCSV() {
    const dealerHeader = [
      "Dealer",
      "Orders",
      "Items",
      "Gold Delivered (g)",
      "Gold Received (g)",
      "Cash Received (₹)",
      "Labour (₹)",
      "GST (₹)",
      "TCS (₹)",
      "Outstanding Cash (₹)",
      "Pending",
      "Delivery Person",
      "Remarks",
    ];
    const dealerRowsCsv = dealerRows.map((r) => [
      r.customerName,
      r.ordersDelivered,
      r.itemsDelivered,
      mgToGrams(r.goldDeliveredMg),
      mgToGrams(r.goldReceivedMg),
      paiseToRupees(r.cashReceivedPaise),
      paiseToRupees(r.labourPaise),
      paiseToRupees(r.gstPaise),
      paiseToRupees(r.tcsPaise),
      paiseToRupees(r.outstandingCashPaise),
      r.pendingSettlements,
      r.deliveryPerson || "—",
      r.remarks.join("; "),
    ]);
    const personHeader = [
      "Delivery Person",
      "Dealers Visited",
      "Orders Delivered",
      "Gold Carried (g)",
      "Gold Returned (g)",
      "Cash Collected (₹)",
      "Outstanding (₹)",
      "Remarks",
    ];
    const personRowsCsv = personRows.map((r) => [
      r.name,
      r.dealersVisited,
      r.ordersDelivered,
      mgToGrams(r.goldCarriedMg),
      mgToGrams(r.goldReturnedMg),
      paiseToRupees(r.cashCollectedPaise),
      paiseToRupees(r.outstandingCashPaise),
      r.remarks.join("; "),
    ]);
    exportToCSV(`delivery-summary-${date}.csv`, [
      ["Daily Delivery Summary — by Dealer"],
      dealerHeader,
      ...dealerRowsCsv,
      [],
      ["Delivery Person Summary"],
      personHeader,
      ...personRowsCsv,
    ]);
  }

  function handlePrint() {
    const dealerHeader = [
      "Dealer",
      "Orders",
      "Items",
      "Gold Deliv (g)",
      "Gold Recv (g)",
      "Cash Recv (₹)",
      "Labour (₹)",
      "GST (₹)",
      "TCS (₹)",
      "Outstanding (₹)",
      "Pending",
      "Delivery Person",
      "Remarks",
    ];
    const dealerRowsTable = dealerRows.map((r) => [
      r.customerName,
      String(r.ordersDelivered),
      String(r.itemsDelivered),
      mgToGrams(r.goldDeliveredMg),
      mgToGrams(r.goldReceivedMg),
      paiseToRupees(r.cashReceivedPaise),
      paiseToRupees(r.labourPaise),
      paiseToRupees(r.gstPaise),
      paiseToRupees(r.tcsPaise),
      paiseToRupees(r.outstandingCashPaise),
      String(r.pendingSettlements),
      r.deliveryPerson || "—",
      r.remarks.join("; ") || "—",
    ]);
    const personHeader = [
      "Delivery Person",
      "Dealers",
      "Orders",
      "Gold Carried (g)",
      "Gold Returned (g)",
      "Cash Collected (₹)",
      "Outstanding (₹)",
      "Remarks",
    ];
    const personRowsTable = personRows.map((r) => [
      r.name,
      String(r.dealersVisited),
      String(r.ordersDelivered),
      mgToGrams(r.goldCarriedMg),
      mgToGrams(r.goldReturnedMg),
      paiseToRupees(r.cashCollectedPaise),
      paiseToRupees(r.outstandingCashPaise),
      r.remarks.join("; ") || "—",
    ]);

    const tables: string[][][] = [[dealerHeader, ...dealerRowsTable]];
    if (personRowsTable.length) {
      tables.push([personHeader, ...personRowsTable]);
    }
    void triggerPrint(`Daily Delivery Summary - ${date}`, { from: date, to: date }, tables);
  }

  return (
    <div data-testid="print-layout-root" className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Daily Delivery Summary"
        subtitle="Internal reconciliation only — never send this to a customer. It does not replace the GST Invoice or Settlement Receipt."
      />

      <div className="flex items-end gap-3 no-print">
        <div>
          <Label className="text-xs">Delivery Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="delivery-summary-date"
          />
        </div>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={handlePrint}
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={handleCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      <Badge variant="outline" className="border-amber-500/40 text-amber-500">
        Internal document — not for customer distribution
      </Badge>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading delivered settlements for this date...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">Delivery summary could not load</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </div>
      ) : null}

      {capped ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Showing the first 1000 matching rows. Promote delivered_at to an indexed report column
          before using this report for unusually high-volume delivery days.
        </div>
      ) : null}

      <div data-testid="report-print-source" className="space-y-6">
      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-lg text-gold">Daily Delivery Summary — by Dealer</h3>
        </div>
        {dealerRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No settlements delivered on this date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="delivery-summary-dealer-table">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Dealer</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Gold Delivered</th>
                  <th className="text-right">Gold Received</th>
                  <th className="text-right">Cash Received</th>
                  <th className="text-right">Labour</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">TCS</th>
                  <th className="text-right">Outstanding Cash</th>
                  <th className="text-right">Pending</th>
                  <th className="text-left">Delivery Person</th>
                  <th className="text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {dealerRows.map((r) => (
                  <tr key={r.customerName} className="border-b border-border/60">
                    <td className="py-2">{r.customerName}</td>
                    <td className="text-right">{r.ordersDelivered}</td>
                    <td className="text-right">{r.itemsDelivered}</td>
                    <td className="text-right font-mono">{mgToGrams(r.goldDeliveredMg)} g</td>
                    <td className="text-right font-mono">{mgToGrams(r.goldReceivedMg)} g</td>
                    <td className="text-right font-mono">₹{paiseToRupees(r.cashReceivedPaise)}</td>
                    <td className="text-right font-mono">₹{paiseToRupees(r.labourPaise)}</td>
                    <td className="text-right font-mono">₹{paiseToRupees(r.gstPaise)}</td>
                    <td className="text-right font-mono">₹{paiseToRupees(r.tcsPaise)}</td>
                    <td className="text-right font-mono">
                      ₹{paiseToRupees(r.outstandingCashPaise)}
                    </td>
                    <td className="text-right">{r.pendingSettlements}</td>
                    <td className="text-xs">{r.deliveryPerson || "—"}</td>
                    <td className="text-xs text-muted-foreground">
                      {r.remarks.length ? r.remarks.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-lg text-gold">Delivery Person Summary</h3>
        </div>
        {personRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No delivery person recorded against a delivered settlement on this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="delivery-summary-person-table">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Delivery Person</th>
                  <th className="text-right">Dealers Visited</th>
                  <th className="text-right">Orders Delivered</th>
                  <th className="text-right">Gold Carried</th>
                  <th className="text-right">Gold Returned</th>
                  <th className="text-right">Cash Collected</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {personRows.map((r) => (
                  <tr key={r.name} className="border-b border-border/60">
                    <td className="py-2">{r.name}</td>
                    <td className="text-right">{r.dealersVisited}</td>
                    <td className="text-right">{r.ordersDelivered}</td>
                    <td className="text-right font-mono">{mgToGrams(r.goldCarriedMg)} g</td>
                    <td className="text-right font-mono">{mgToGrams(r.goldReturnedMg)} g</td>
                    <td className="text-right font-mono">₹{paiseToRupees(r.cashCollectedPaise)}</td>
                    <td className="text-right font-mono">
                      ₹{paiseToRupees(r.outstandingCashPaise)}
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {r.remarks.length ? r.remarks.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { ReportShell } from "@/components/reports/ReportShell";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compilePartyLedger } from "@/lib/customer-account-ledger";
import { compileBillWiseOutstanding } from "@/lib/statutory-registers";
import { useBilling } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import {
  exportToCSV,
  fmtG,
  fmtRs,
  isInDateRange,
  rangeForPeriod,
  thisMonthRange,
  triggerPrint,
  type ReportPeriod,
} from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/ledgers")({
  head: () => ({ meta: [{ title: "Party Ledgers · AVS ERP" }] }),
  component: PartyLedgersPage,
});

type LedgerView = "short" | "detailed" | "billwise";

function PartyLedgersPage() {
  const invoices = useBilling((s) => s.invoices);
  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const orders = useOrders((s) => s.orders);
  const settlements = useGoldSettlement((s) => s.settlements);
  const goldBookEntries = useWorkerGoldBook((s) => s.entries);
  const [customerId, setCustomerId] = useState("");
  const [view, setView] = useState<LedgerView>("short");
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [customRange, setCustomRange] = useState(thisMonthRange());

  useEffect(() => {
    void refreshPeople();
    void useWorkerGoldBook.getState().refresh?.();
  }, [refreshPeople]);

  const parties = useMemo(
    () =>
      people
        .filter((p) => p.active !== false)
        .filter((p) => {
          const roles = [p.type, ...(p.roles ?? [])];
          return roles.some((r) =>
            [
              "customer",
              "firm_customer",
              "jeweller",
              "dealer",
              "karigar",
              "worker",
              "supplier",
              "vendor",
            ].includes(r),
          );
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [people],
  );

  useEffect(() => {
    if (!customerId && parties.length > 0) {
      setCustomerId(parties[0]!.id);
    }
  }, [customerId, parties]);

  const dateRange = useMemo(() => rangeForPeriod(period, customRange), [period, customRange]);

  const fullLedger = useMemo(
    () => (customerId ? compilePartyLedger(customerId) : null),
    [customerId, invoices, orders, settlements, people, goldBookEntries],
  );

  const ledger = useMemo(() => {
    if (!fullLedger) return null;
    const rows = fullLedger.rows.filter((row) => {
      if (!row.ts) return true;
      return isInDateRange(row.ts, dateRange);
    });
    if (rows.length === fullLedger.rows.length) return fullLedger;
    return {
      ...fullLedger,
      rows,
      totalGoldInMg: rows.reduce((s, r) => s + r.goldInMg, 0),
      totalGoldOutMg: rows.reduce((s, r) => s + r.goldOutMg, 0),
      totalDebitPaise: rows.reduce((s, r) => s + r.moneyDebitPaise, 0),
      totalCreditPaise: rows.reduce((s, r) => s + r.moneyCreditPaise, 0),
      closingGoldMg: rows.length ? rows[rows.length - 1].closingGoldMg : fullLedger.openingGoldMg,
      closingMoneyPaise: rows.length
        ? rows[rows.length - 1].closingMoneyPaise
        : fullLedger.openingMoneyPaise,
    };
  }, [fullLedger, dateRange]);

  const bills = useMemo(
    () => (customerId ? compileBillWiseOutstanding(invoices, customerId) : []),
    [customerId, invoices],
  );

  function handleCSV() {
    if (!ledger) return;
    if (view === "billwise") {
      exportToCSV("party-billwise.csv", [
        ["Invoice", "Date", "Customer", "Grand", "Paid", "Balance", "Fine g"],
        ...bills.map((row) => [
          row.invoiceNo,
          new Date(row.dateMs).toLocaleDateString("en-IN"),
          row.customerName,
          fmtRs(row.grandPaise),
          fmtRs(row.paidPaise),
          fmtRs(row.balancePaise),
          fmtG(row.fineMg),
        ]),
      ]);
      return;
    }
    exportToCSV("party-ledger.csv", [
      ["Date", "Voucher", "Type", "Description", "Gold In g", "Gold Out g", "Debit", "Credit"],
      ...ledger.rows.map((row) => [
        row.date,
        row.voucherNo,
        row.type,
        row.description,
        fmtG(row.goldInMg),
        fmtG(row.goldOutMg),
        fmtRs(row.moneyDebitPaise),
        fmtRs(row.moneyCreditPaise),
      ]),
    ]);
  }

  async function openPrint(format: "short" | "detailed" = "detailed") {
    if (!customerId || !ledger) return;
    const partyName = parties.find((p) => p.id === customerId)?.fullName ?? customerId;
    if (format === "short") {
      await triggerPrint(
        `Short Ledger (Compact) — ${partyName}`,
        dateRange,
        [
          [
            ["Dt", "Vchr", "Particulars", "Fine In (g)", "Fine Out (g)", "Debit ₹", "Credit ₹", "Bal ₹"],
            ...ledger.rows.map((r) => [
              r.date,
              r.voucherNo || "—",
              r.description || r.type,
              r.goldInMg > 0 ? fmtG(r.goldInMg) : "—",
              r.goldOutMg > 0 ? fmtG(r.goldOutMg) : "—",
              r.moneyDebitPaise > 0 ? fmtRs(r.moneyDebitPaise) : "—",
              r.moneyCreditPaise > 0 ? fmtRs(r.moneyCreditPaise) : "—",
              fmtRs(r.closingMoneyPaise ?? 0),
            ]),
          ],
        ],
      );
    } else {
      await triggerPrint(
        `Party Account Statement (Detailed) — ${partyName}`,
        dateRange,
        [
          [
            ["Date", "Voucher No", "Transaction Type", "Description / Narration", "Purity", "Gold In (g)", "Gold Out (g)", "Debit (₹)", "Credit (₹)", "Gold Bal (g)", "Cash Bal (₹)"],
            ...ledger.rows.map((r) => [
              r.date,
              r.voucherNo || "—",
              r.type,
              r.description || "—",
              r.purity ? `${r.purity}` : "—",
              r.goldInMg > 0 ? fmtG(r.goldInMg) : "—",
              r.goldOutMg > 0 ? fmtG(r.goldOutMg) : "—",
              r.moneyDebitPaise > 0 ? fmtRs(r.moneyDebitPaise) : "—",
              r.moneyCreditPaise > 0 ? fmtRs(r.moneyCreditPaise) : "—",
              fmtG(r.closingGoldMg ?? 0),
              fmtRs(r.closingMoneyPaise ?? 0),
            ]),
          ],
        ],
      );
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Accountwise Summary / Details"
        subtitle="Offline Accountwise — pick a party for summary or detailed Jama/Nave rows. Print Short for compact audits or Print Long for detailed accounts."
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <SourceOfTruthBadge variant="report" />
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/reports/ledgers-print-all">
                <Printer className="h-4 w-4" /> Print All
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={!ledger}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => void openPrint("short")}
              disabled={!customerId || !ledger}
            >
              <Printer className="h-3.5 w-3.5" /> Print Short
            </Button>
            <Button
              size="sm"
              className="gap-1 text-xs bg-gold text-black hover:bg-gold/90"
              onClick={() => void openPrint("detailed")}
              disabled={!customerId || !ledger}
            >
              <Printer className="h-3.5 w-3.5" /> Print Long
            </Button>
          </div>
        }
      />

      <ReportShell
        title="Party ledger register"
        variant="report"
        period={period}
        onPeriodChange={setPeriod}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        openingLabel={
          ledger
            ? `Opening fine ${fmtG(ledger.openingGoldMg)} · Opening ₹ ${fmtRs(ledger.openingMoneyPaise)}`
            : undefined
        }
        closingLabel={
          ledger
            ? `Closing fine ${fmtG(ledger.closingGoldMg)} · Closing ₹ ${fmtRs(ledger.closingMoneyPaise)}`
            : undefined
        }
        onExport={handleCSV}
        onPrint={() => void openPrint()}
      >
        <div className="no-print flex flex-wrap gap-4 items-end mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Party</Label>
            <select
              className="h-9 min-w-[16rem] rounded-md border border-input bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                  {p.tradeName ? ` · ${p.tradeName}` : ""}
                  {p.type === "karigar" || p.type === "worker" ? " · Karigar" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {(
              [
                ["short", "Short"],
                ["detailed", "Detailed"],
                ["billwise", "Bill-wise"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={view === id ? "default" : "outline"}
                onClick={() => setView(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div data-testid="report-print-source">
        {!customerId ? (
          <p className="text-sm text-muted-foreground">
            Pick a customer, jeweller, dealer, or karigar.
          </p>
        ) : !ledger ? (
          <p className="text-sm text-muted-foreground">No ledger rows.</p>
        ) : view === "short" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <SummaryCard label="Opening gold" value={fmtG(ledger.openingGoldMg)} />
            <SummaryCard label="Closing gold" value={fmtG(ledger.closingGoldMg)} />
            <SummaryCard label="Gold with us (advance)" value={fmtG(ledger.goldAdvanceMg)} />
            <SummaryCard label="Gold they owe" value={fmtG(ledger.goldCreditOwedMg)} />
            <SummaryCard label="Opening ₹" value={fmtRs(ledger.openingMoneyPaise)} />
            <SummaryCard label="Closing ₹" value={fmtRs(ledger.closingMoneyPaise)} />
            <SummaryCard label="Money due" value={fmtRs(ledger.moneyDuePaise)} />
            <SummaryCard label="Money advance" value={fmtRs(ledger.moneyAdvancePaise)} />
          </div>
        ) : view === "billwise" ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Invoice</th>
                <th className="py-2">Date</th>
                <th className="py-2 text-right">Grand</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Balance</th>
                <th className="py-2 text-right">Fine g</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-muted-foreground text-center">
                    No outstanding bills.
                  </td>
                </tr>
              ) : (
                bills.map((row) => (
                  <tr key={row.invoiceNo} className="border-b border-border/40">
                    <td className="py-1.5 font-mono">{row.invoiceNo}</td>
                    <td className="py-1.5">{new Date(row.dateMs).toLocaleDateString("en-IN")}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.grandPaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.paidPaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.balancePaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtG(row.fineMg)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Date</th>
                  <th className="py-2">Voucher</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Jama (In)</th>
                  <th className="py-2 text-right">Nave (Out)</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                  <th className="py-2 text-right">Gold Cl.</th>
                  <th className="py-2 text-right">₹ Cl.</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40">
                    <td className="py-1.5 whitespace-nowrap">{row.date}</td>
                    <td className="py-1.5 font-mono">
                      {row.sourceRoute ? (
                        <Link to={row.sourceRoute} className="text-primary hover:underline">
                          {row.voucherNo}
                        </Link>
                      ) : (
                        row.voucherNo
                      )}
                    </td>
                    <td className="py-1.5">{row.type}</td>
                    <td className="py-1.5 max-w-xs truncate">{row.description}</td>
                    <td className="py-1.5 text-right font-mono">
                      {row.goldInMg ? fmtG(row.goldInMg) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {row.goldOutMg ? fmtG(row.goldOutMg) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {row.moneyDebitPaise ? fmtRs(row.moneyDebitPaise) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {row.moneyCreditPaise ? fmtRs(row.moneyCreditPaise) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono">{fmtG(row.closingGoldMg)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.closingMoneyPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </ReportShell>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm mt-1">{value}</div>
    </div>
  );
}

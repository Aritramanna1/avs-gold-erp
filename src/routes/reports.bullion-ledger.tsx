import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileBullionLedger, mgToGrams, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useLedger } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/bullion-ledger")({
  head: () => ({ meta: [{ title: "Bullion Ledger · AVS ERP" }] }),
  component: BullionLedgerPage,
});

function BullionLedgerPage() {
  const gold = useLedger((s) => s.entries);
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileBullionLedger(range), [range, gold, invoices]);
  const rows = data.map((r) => [
    r.date,
    r.voucherNo,
    r.party,
    r.side === "in" ? "In" : "Out",
    mgToGrams(r.fineMg),
    paiseToRupees(r.amountPaise),
    r.narration,
  ]);

  return (
    <JewelleryBookPage
      title="Bullion Ledger"
      offlineName="Bullion / Sauda Ledger"
      description="Metal deals from gold vault + invoice fine lines"
      columns={["Date", "Voucher", "Party", "Side", "Fine (g)", "Amount ₹", "Narration"]}
      rows={rows}
      csvName="bullion-ledger.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

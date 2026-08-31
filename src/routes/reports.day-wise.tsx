import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileDayWise, mgToGrams, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useLedger } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { useMoneyVoucherStore } from "@/lib/money-voucher";

export const Route = createFileRoute("/reports/day-wise")({
  head: () => ({ meta: [{ title: "Day-wise · AVS ERP" }] }),
  component: DayWisePage,
});

function DayWisePage() {
  const gold = useLedger((s) => s.entries);
  const money = useMoneyVoucherStore((s) => s.entries);
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileDayWise(range), [range, gold, money, invoices]);
  const rows = data.map((r) => [
    r.date,
    mgToGrams(r.goldInMg),
    mgToGrams(r.goldOutMg),
    paiseToRupees(r.cashInPaise),
    paiseToRupees(r.cashOutPaise),
    paiseToRupees(r.salesPaise),
    paiseToRupees(r.purchasePaise),
    r.bills,
  ]);

  return (
    <JewelleryBookPage
      title="Day-wise Summary"
      offlineName="Day Wise"
      description="Per-day gold, cash, sales and purchase totals"
      columns={[
        "Date",
        "Gold In (g)",
        "Gold Out (g)",
        "Cash In ₹",
        "Cash Out ₹",
        "Sales ₹",
        "Purchase ₹",
        "Bills",
      ]}
      rows={rows}
      csvName="day-wise.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

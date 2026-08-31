import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileCashFlow, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useMoneyVoucherStore } from "@/lib/money-voucher";

export const Route = createFileRoute("/reports/cash-flow")({
  head: () => ({ meta: [{ title: "Cash Flow · AVS ERP" }] }),
  component: CashFlowPage,
});

function CashFlowPage() {
  const entries = useMoneyVoucherStore((s) => s.entries);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const compiled = useMemo(() => compileCashFlow(range), [range, entries]);
  const rows = compiled.rows.map((r) => [
    r.label,
    paiseToRupees(r.inPaise),
    paiseToRupees(r.outPaise),
    paiseToRupees(r.inPaise - r.outPaise),
  ]);

  return (
    <JewelleryBookPage
      title="Cash Flow"
      offlineName="Cash Flow"
      description="Operating cash in/out from money vouchers"
      columns={["Category", "In ₹", "Out ₹", "Net ₹"]}
      rows={rows}
      csvName="cash-flow.csv"
      openingLabel={`Opening ₹ ${paiseToRupees(compiled.openingPaise)}`}
      closingLabel={`Closing ₹ ${paiseToRupees(compiled.closingPaise)} · Net ${paiseToRupees(compiled.netPaise)}`}
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

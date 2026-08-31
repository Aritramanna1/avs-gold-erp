import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileTanchHishob, mgToGrams } from "@/lib/jewellery-books-reports";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/tanch-hishob")({
  head: () => ({ meta: [{ title: "Tanch / Hishob · AVS ERP" }] }),
  component: TanchHishobPage,
});

function TanchHishobPage() {
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileTanchHishob(range), [range, invoices]);
  const rows = data.map((r) => [
    r.billNo,
    r.date,
    r.party,
    r.item,
    mgToGrams(r.netMg),
    r.tanchPct.toFixed(2),
    r.wstgPct.toFixed(2),
    r.hisobPct.toFixed(2),
    mgToGrams(r.fineMg),
  ]);

  return (
    <JewelleryBookPage
      title="Tanch / Hishob"
      offlineName="Tanch Hishob"
      description="Invoice line tanch, wastage, hisob and fine worksheet"
      columns={[
        "Bill",
        "Date",
        "Party",
        "Item",
        "Net (g)",
        "Tanch %",
        "Wstg %",
        "Hisob %",
        "Fine (g)",
      ]}
      rows={rows}
      csvName="tanch-hishob.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

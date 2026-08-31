import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileCityWise, mgToGrams, paiseToRupees } from "@/lib/jewellery-books-reports";
import { usePeople } from "@/lib/people-store";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/city-wise")({
  head: () => ({ meta: [{ title: "City Wise · AVS ERP" }] }),
  component: CityWisePage,
});

function CityWisePage() {
  const people = usePeople((s) => s.people);
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileCityWise(range), [range, people, invoices]);
  const rows = data.map((r) => [
    r.city,
    r.parties,
    mgToGrams(r.closingGoldMg),
    paiseToRupees(r.closingMoneyPaise),
    mgToGrams(r.saleFineMg),
    paiseToRupees(r.salePaise),
  ]);

  return (
    <JewelleryBookPage
      title="City-wise Jama Nave"
      offlineName="City Wise"
      description="Party city rollup of balances and period sales"
      columns={["City", "Parties", "Closing Fine (g)", "Closing ₹", "Sale Fine (g)", "Sale ₹"]}
      rows={rows}
      csvName="city-wise.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

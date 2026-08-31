import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileItemTransactions, mgToGrams } from "@/lib/jewellery-books-reports";
import { useStock } from "@/lib/stock-store";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/item-transaction")({
  head: () => ({ meta: [{ title: "Item Transaction · AVS ERP" }] }),
  component: ItemTransactionPage,
});

function ItemTransactionPage() {
  const movements = useStock((s) => s.movements);
  const items = useStock((s) => s.items);
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(
    () => compileItemTransactions(range),
    [range, movements, items, invoices],
  );
  const rows = data.map((r) => [
    r.date,
    r.itemName,
    r.type,
    r.qty,
    mgToGrams(r.grossMg),
    mgToGrams(r.netMg),
    mgToGrams(r.fineMg),
    r.ref,
  ]);

  return (
    <JewelleryBookPage
      title="Item Transaction"
      offlineName="Item Transaction"
      description="Stock movements + invoice lines"
      columns={["Date", "Item", "Type", "Qty", "Gross (g)", "Net (g)", "Fine (g)", "Ref"]}
      rows={rows}
      csvName="item-transaction.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

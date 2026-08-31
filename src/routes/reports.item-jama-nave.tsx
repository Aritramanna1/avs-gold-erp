import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { mgToGrams, paiseToRupees, type JamaNaveRow } from "@/lib/jewellery-books-reports";
import { fetchItemJamaNave } from "@/lib/jewellery-books-query";

export const Route = createFileRoute("/reports/item-jama-nave")({
  validateSearch: (s: Record<string, unknown>): { mode?: "item" | "account" } => ({
    mode: s.mode === "account" ? "account" : "item",
  }),
  head: () => ({ meta: [{ title: "Item Jama Nave · AVS ERP" }] }),
  component: ItemJamaNavePage,
});

function ItemJamaNavePage() {
  const { mode } = Route.useSearch();
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const [data, setData] = useState<JamaNaveRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void fetchItemJamaNave(range, mode ?? "item")
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load Jama Nave");
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, mode]);

  const rows = error
    ? [[error, "", "", "", "", "", ""]]
    : data.map((r) => [
        r.label,
        mgToGrams(r.saleFineMg),
        mgToGrams(r.purchaseFineMg),
        paiseToRupees(r.salePaise),
        paiseToRupees(r.purchasePaise),
        r.saleCount,
        r.purchaseCount,
      ]);

  return (
    <JewelleryBookPage
      title={mode === "account" ? "Account-wise Sale / Purchase" : "Item-wise Jama Nave"}
      offlineName={
        mode === "account" ? "Account Wise Sales Purchase" : "Item Wise Sales Purchase"
      }
      description="Metal Jama (sale) / Nave (purchase) — server RPC over invoices + supplier purchases"
      columns={["Name", "Sale Fine (g)", "Purchase Fine (g)", "Sale ₹", "Purchase ₹", "Sale #", "Purchase #"]}
      rows={rows}
      csvName="item-jama-nave.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      printHref={`/reports/book-print/item_jama_nave?from=${range.from}&to=${range.to}&mode=${mode ?? "item"}`}
    />
  );
}

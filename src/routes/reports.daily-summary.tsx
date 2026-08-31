import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { mgToGrams, paiseToRupees } from "@/lib/jewellery-books-reports";
import {
  fetchDailyJewellerySummary,
  type DailyJewellerySummary,
} from "@/lib/jewellery-books-query";

export const Route = createFileRoute("/reports/daily-summary")({
  head: () => ({ meta: [{ title: "Daily Summary · AVS ERP" }] }),
  component: DailySummaryPage,
});

function DailySummaryPage() {
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const [summary, setSummary] = useState<DailyJewellerySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void fetchDailyJewellerySummary(range)
      .then((r) => {
        if (!cancelled) setSummary(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load daily summary");
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const rows = error
    ? [[error, "", "", "", "", "", ""]]
    : summary
      ? [
          [
            `${summary.from} → ${summary.to}`,
            mgToGrams(summary.goldInMg),
            mgToGrams(summary.goldOutMg),
            paiseToRupees(summary.cashJamaPaise),
            paiseToRupees(summary.cashNavePaise),
            paiseToRupees(summary.invoiceTotalPaise),
            summary.invoiceCount,
          ],
          [
            "Purchases",
            mgToGrams(summary.purchaseFineMg),
            "",
            "",
            "",
            "",
            summary.purchaseCount,
          ],
        ]
      : [];

  return (
    <JewelleryBookPage
      title="Daily Summary"
      offlineName="Daily Summary"
      description="Period totals from server RPC (gold flow, cash Jama/Nave, sales, purchases)"
      columns={["Period", "Gold In (g)", "Gold Out (g)", "Cash Jama ₹", "Cash Nave ₹", "Sales ₹", "Count"]}
      rows={rows}
      csvName="daily-summary.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      printHref={`/reports/book-print/daily_jewellery_summary?from=${range.from}&to=${range.to}`}
    />
  );
}

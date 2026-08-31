import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { mgToGrams } from "@/lib/jewellery-books-reports";
import { fetchFineRojmel, type FineRojmelResult } from "@/lib/jewellery-books-query";

export const Route = createFileRoute("/reports/fine-rojmel")({
  head: () => ({ meta: [{ title: "Fine Rojmel · AVS ERP" }] }),
  component: FineRojmelPage,
});

function FineRojmelPage() {
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const [compiled, setCompiled] = useState<FineRojmelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchFineRojmel(range)
      .then((r) => {
        if (!cancelled) setCompiled(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load Fine Rojmel");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const rows = (compiled?.rows ?? []).map((r) => [
    r.date,
    r.voucherNo,
    r.narration,
    mgToGrams(r.inMg),
    mgToGrams(r.outMg),
    mgToGrams(r.closingMg),
  ]);

  return (
    <JewelleryBookPage
      title="Fine Rojmel"
      offlineName="Fine Rojmel / Final Rojeldar"
      description={
        loading
          ? "Loading from server…"
          : compiled?.capped
            ? `Daily fine gold book (server RPC — showing first page of ${compiled.total} entries)`
            : "Daily fine gold book from gold_ledger (server aggregate RPC)"
      }
      columns={["Date", "Voucher", "Narration", "In (g)", "Out (g)", "Closing (g)"]}
      rows={error ? [[error, "", "", "", "", ""]] : rows}
      csvName="fine-rojmel.csv"
      openingLabel={`Opening fine ${mgToGrams(compiled?.openingMg ?? 0)} g`}
      closingLabel={`Closing fine ${mgToGrams(compiled?.closingMg ?? 0)} g`}
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      printHref={`/reports/book-print/fine_rojmel?from=${range.from}&to=${range.to}`}
    />
  );
}

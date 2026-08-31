import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { mgToGrams } from "@/lib/jewellery-books-reports";
import { fetchDhadiBook, type DhadiBookResult } from "@/lib/stock-books-query";

export const Route = createFileRoute("/reports/dhadi-book")({
  head: () => ({ meta: [{ title: "Dhadi Book · AVS ERP" }] }),
  component: DhadiBookPage,
});

function DhadiBookPage() {
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const [compiled, setCompiled] = useState<DhadiBookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchDhadiBook(range)
      .then((r) => {
        if (!cancelled) setCompiled(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load Dhadi book");
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
    r.voucher_no,
    r.worker_name,
    r.item_name,
    r.j_n,
    mgToGrams(r.gr_wt_mg),
    mgToGrams(r.net_wt_mg),
    String(r.tanch || ""),
    mgToGrams(r.fine_mg),
    r.remark || "",
  ]);

  return (
    <JewelleryBookPage
      title="Dhadi Book"
      offlineName="Dhadi / Issue–Return hisab"
      description={
        loading
          ? "Loading from server…"
          : compiled?.capped
            ? `Karigar issue (Nave) / return (Jama) — showing page of ${compiled.total} lines`
            : "Karigar issue (Nave) / return (Jama) from worker gold book (server RPC)"
      }
      columns={[
        "Date",
        "Voucher",
        "Worker",
        "Item",
        "J/N",
        "Gr (g)",
        "Net (g)",
        "Tanch",
        "Fine (g)",
        "Remark",
      ]}
      rows={error ? [[error, "", "", "", "", "", "", "", "", ""]] : rows}
      csvName="dhadi-book.csv"
      openingLabel={`Issue fine ${mgToGrams(compiled?.issueFineMg ?? 0)} g`}
      closingLabel={`Pending fine ${mgToGrams(compiled?.pendingFineMg ?? 0)} g (return ${mgToGrams(compiled?.returnFineMg ?? 0)} g)`}
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      printHref={`/reports/book-print/dhadi_book?from=${range.from}&to=${range.to}`}
    />
  );
}

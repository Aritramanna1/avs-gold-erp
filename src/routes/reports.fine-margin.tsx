import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileFineMargin, mgToGrams, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/fine-margin")({
  validateSearch: (s: Record<string, unknown>): { view?: "profit" | "sale-fine" } => ({
    view: s.view === "sale-fine" ? "sale-fine" : "profit",
  }),
  head: () => ({ meta: [{ title: "Fine Margin · AVS ERP" }] }),
  component: FineMarginPage,
});

function FineMarginPage() {
  const { view } = Route.useSearch();
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileFineMargin(range), [range, invoices]);
  const saleFine = view === "sale-fine";
  const columns = saleFine
    ? ["Invoice", "Date", "Customer", "Fine (g)", "Gold Value ₹", "Line Total ₹"]
    : ["Invoice", "Date", "Customer", "Fine (g)", "Making ₹", "Margin ₹", "Line Total ₹"];
  const rows = data.map((r) =>
    saleFine
      ? [
          r.invoiceNo,
          r.date,
          r.customerName,
          mgToGrams(r.fineMg),
          paiseToRupees(r.goldValuePaise),
          paiseToRupees(r.lineTotalPaise),
        ]
      : [
          r.invoiceNo,
          r.date,
          r.customerName,
          mgToGrams(r.fineMg),
          paiseToRupees(r.makingPaise),
          paiseToRupees(r.marginPaise),
          paiseToRupees(r.lineTotalPaise),
        ],
  );

  return (
    <JewelleryBookPage
      title={saleFine ? "Sale Fine Margin" : "Fine Margin / Profit"}
      offlineName={saleFine ? "Sale Fine" : "Fine Margin"}
      description="Invoice fine, making, and margin from billing SoT"
      columns={columns}
      rows={rows}
      csvName="fine-margin.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

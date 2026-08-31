import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileDeletedBills, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useBilling } from "@/lib/billing-store";

export const Route = createFileRoute("/reports/deleted-bills")({
  head: () => ({ meta: [{ title: "Deleted Bills · AVS ERP" }] }),
  component: DeletedBillsPage,
});

function DeletedBillsPage() {
  const invoices = useBilling((s) => s.invoices);
  const { period, setPeriod, customRange, setCustomRange } = useJewelleryReportRange();
  const data = useMemo(() => compileDeletedBills(), [invoices]);
  const rows = data.map((r) => [
    r.invoiceNo,
    r.date,
    r.customerName,
    paiseToRupees(r.grandPaise),
    r.cancelledAt,
    r.reason,
  ]);

  return (
    <JewelleryBookPage
      title="Cancelled / Deleted Bills"
      offlineName="Delete Sales / Purchase Bills"
      description="Cancelled invoices with reason — audit-safe (no silent wipe)"
      columns={["Invoice", "Bill Date", "Customer", "Amount ₹", "Cancelled", "Reason"]}
      rows={rows}
      csvName="deleted-bills.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

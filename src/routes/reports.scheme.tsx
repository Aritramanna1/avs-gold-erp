import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { useSchemeStore } from "@/lib/scheme-store";
import { paiseToRupees } from "@/lib/jewellery-books-reports";

export const Route = createFileRoute("/reports/scheme")({
  head: () => ({ meta: [{ title: "Scheme Report · AVS ERP" }] }),
  component: SchemeReportPage,
});

function SchemeReportPage() {
  const plans = useSchemeStore((s) => s.plans);
  const accounts = useSchemeStore((s) => s.accounts);
  const receipts = useSchemeStore((s) => s.receipts);
  const hydrate = useSchemeStore((s) => s.hydrate);
  const { period, setPeriod, customRange, setCustomRange } = useJewelleryReportRange();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const rows = useMemo(() => {
    const planById = new Map(plans.map((p) => [p.id, p]));
    const accById = new Map(accounts.map((a) => [a.id, a]));
    return receipts.map((r) => {
      const acc = accById.get(r.account_id);
      const plan = acc ? planById.get(acc.plan_id) : undefined;
      return [
        r.receipt_date,
        acc?.account_no ?? "—",
        acc?.party_name || acc?.party_id || "—",
        plan?.code ?? "—",
        r.installment_no ?? "—",
        paiseToRupees(r.amount_paise),
        r.narration || "",
      ];
    });
  }, [plans, accounts, receipts]);

  const totalPaise = receipts.reduce((s, r) => s + r.amount_paise, 0);

  return (
    <JewelleryBookPage
      title="Scheme Report"
      offlineName="Scheme"
      description="Installment receipts by scheme account — cash via money vouchers"
      columns={["Date", "Account", "Party", "Plan", "Inst.", "Amount ₹", "Narration"]}
      rows={rows}
      csvName="scheme-report.csv"
      openingLabel={`${accounts.length} accounts · ${plans.length} plans`}
      closingLabel={`Receipts total ₹ ${paiseToRupees(totalPaise)}`}
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

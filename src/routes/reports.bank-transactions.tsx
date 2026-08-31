import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { compileBankTransactions, paiseToRupees } from "@/lib/jewellery-books-reports";
import { useMoneyVoucherStore } from "@/lib/money-voucher";

export const Route = createFileRoute("/reports/bank-transactions")({
  head: () => ({ meta: [{ title: "Bank Transactions · AVS ERP" }] }),
  component: BankTransactionsPage,
});

function BankTransactionsPage() {
  const entries = useMoneyVoucherStore((s) => s.entries);
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const data = useMemo(() => compileBankTransactions(range), [range, entries]);
  const rows = data.map((r) => [
    r.date,
    r.voucherNo,
    r.accountName,
    r.partyName,
    r.narration,
    paiseToRupees(r.debitPaise),
    paiseToRupees(r.creditPaise),
    paiseToRupees(r.closingPaise),
  ]);

  return (
    <JewelleryBookPage
      title="Bank Transactions"
      offlineName="Bank Transaction"
      description="Bank CoA lines from money vouchers"
      columns={["Date", "Voucher", "Account", "Party", "Narration", "Dr ₹", "Cr ₹", "Closing ₹"]}
      rows={rows}
      csvName="bank-transactions.csv"
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    />
  );
}

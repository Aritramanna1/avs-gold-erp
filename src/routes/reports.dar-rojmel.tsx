import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  JewelleryBookPage,
  useJewelleryReportRange,
} from "@/components/reports/JewelleryBookPage";
import { paiseToRupees, compileDarRojmel } from "@/lib/jewellery-books-reports";
import { fetchCompanyCashLedgerPage } from "@/lib/ledger-pagination";
import { companyCashLedgerOpeningPaise } from "@/lib/company-cash-ledger";
import type { UniversalMoneyEntry } from "@/lib/money-voucher";

export const Route = createFileRoute("/reports/dar-rojmel")({
  head: () => ({ meta: [{ title: "Dar Rojmel · AVS ERP" }] }),
  component: DarRojmelPage,
});

function DarRojmelPage() {
  const { period, setPeriod, customRange, setCustomRange, range } = useJewelleryReportRange();
  const [rowsRaw, setRowsRaw] = useState<UniversalMoneyEntry[]>([]);
  const [openingPaise, setOpeningPaise] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const opening = companyCashLedgerOpeningPaise({ dateRange: range });
        const localCompiled = compileDarRojmel(range);
        let pageRows: UniversalMoneyEntry[] = [];
        let totalCount = localCompiled.rows.length;

        try {
          const page = await fetchCompanyCashLedgerPage({
            from: range.from,
            to: range.to,
            limit: 1000,
            offset: 0,
          });
          if (page.rows && page.rows.length > 0) {
            pageRows = page.rows;
            totalCount = page.total;
          }
        } catch {
          /* fallback to local below */
        }

        if (cancelled) return;
        setOpeningPaise(opening);
        if (pageRows.length > 0) {
          setRowsRaw(pageRows);
          setTotal(totalCount);
        } else {
          setRowsRaw(
            localCompiled.rows.map((r, i) => ({
              id: `local-${i}`,
              voucherNumber: r.voucherNo,
              voucherDate: r.date,
              counterpartyName: r.partyName,
              cashDebitPaise: r.jamaPaise,
              cashCreditPaise: r.navePaise,
              transactionCode: "CASH_VOUCHER",
              metadata: { narration: r.narration },
              organizationId: "MAIN",
              createdAt: r.date,
              updatedAt: r.date,
            })) as unknown as UniversalMoneyEntry[],
          );
          setTotal(localCompiled.rows.length);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Dar Rojmel");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  let running = openingPaise;
  const rows = error
    ? [[error, "", "", "", "", "", ""]]
    : rowsRaw.map((r) => {
        const jama = r.cashDebitPaise || 0;
        const nave = r.cashCreditPaise || 0;
        running = running + jama - nave;
        return [
          r.voucherDate?.slice(0, 10) || "",
          r.voucherNumber || r.id.slice(0, 8),
          r.counterpartyName || "—",
          String((r.metadata as { narration?: string } | null)?.narration || ""),
          paiseToRupees(jama),
          paiseToRupees(nave),
          paiseToRupees(running),
        ];
      });

  return (
    <JewelleryBookPage
      title="Dar Rojmel"
      offlineName="Dar Rojmel / Rojel Account Balance"
      description={
        total > rowsRaw.length
          ? `Cash day book via get_company_cash_ledger_page (${rowsRaw.length}/${total})`
          : "Cash day book (Jama / Nave) via server cash ledger page RPC"
      }
      columns={["Date", "Voucher", "Party", "Narration", "Jama ₹", "Nave ₹", "Closing ₹"]}
      rows={rows}
      csvName="dar-rojmel.csv"
      openingLabel={`Opening ₹ ${paiseToRupees(openingPaise)}`}
      closingLabel={`Closing ₹ ${paiseToRupees(running)}`}
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      printHref={`/reports/book-print/dar_rojmel?from=${range.from}&to=${range.to}`}
    />
  );
}

/**
 * Offline-style "Print All Accounts" — one continuous print of every party ledger.
 * Mirrors Offline Accountwise Details print-all behaviour.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { compilePartyLedger } from "@/lib/customer-account-ledger";
import { usePeople } from "@/lib/people-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { fmtG, fmtRs, triggerPrint } from "@/lib/report-engine";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/reports/ledgers-print-all")({
  head: () => ({ meta: [{ title: "Print All Accounts · AVS ERP" }] }),
  component: PrintAllAccountsPage,
});

function PrintAllAccountsPage() {
  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const invoices = useBilling((s) => s.invoices);
  const orders = useOrders((s) => s.orders);
  const settlements = useGoldSettlement((s) => s.settlements);
  const goldBookEntries = useWorkerGoldBook((s) => s.entries);
  const firm = useSettings((s) => s.firm);

  useEffect(() => {
    void refreshPeople();
    void useWorkerGoldBook.getState().refresh?.();
  }, [refreshPeople]);

  const parties = useMemo(
    () =>
      people
        .filter((p) => p.active !== false)
        .filter((p) => {
          const roles = [p.type, ...(p.roles ?? [])];
          return roles.some((r) =>
            [
              "customer",
              "firm_customer",
              "jeweller",
              "dealer",
              "karigar",
              "worker",
              "supplier",
              "vendor",
            ].includes(r),
          );
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [people],
  );

  const books = useMemo(
    () =>
      parties.map((p) => ({
        party: p,
        ledger: compilePartyLedger(p.id),
      })),
    [parties, invoices, orders, settlements, people, goldBookEntries],
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Print All Accounts</h1>
          <p className="text-xs text-muted-foreground">
            Offline Accountwise Details — every party ledger in one print job ({books.length}{" "}
            accounts).
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => triggerPrint()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="space-y-8 print:space-y-6" data-testid="report-print-source">
        <header className="border-b border-foreground/30 pb-2 mb-4">
          <div className="font-serif text-base font-semibold">
            {firm?.shopName || "AVS ERP"}
          </div>
          <div className="text-xs text-muted-foreground">
            Accountwise Details — All Accounts · {new Date().toLocaleDateString("en-IN")}
          </div>
        </header>

        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground">No party accounts found.</p>
        ) : (
          books.map(({ party, ledger }) => (
            <section
              key={party.id}
              className="break-inside-avoid border border-border rounded-md p-3 print:border-foreground/40"
            >
              <h2 className="text-sm font-semibold mb-2">
                {party.fullName}
                {party.tradeName ? ` · ${party.tradeName}` : ""}
                {party.phone ? ` · ${party.phone}` : ""}
              </h2>
              {!ledger || ledger.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No ledger rows.</p>
              ) : (
                <>
                  <div className="text-[10px] text-muted-foreground mb-2 flex flex-wrap gap-3">
                    <span>Opening fine {fmtG(ledger.openingGoldMg)}</span>
                    <span>Opening ₹ {fmtRs(ledger.openingMoneyPaise)}</span>
                    <span>Closing fine {fmtG(ledger.closingGoldMg)}</span>
                    <span>Closing ₹ {fmtRs(ledger.closingMoneyPaise)}</span>
                  </div>
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-foreground/40 text-left">
                        <th className="py-1 pr-1">Date</th>
                        <th className="py-1 pr-1">No.</th>
                        <th className="py-1 pr-1">Type</th>
                        <th className="py-1 pr-1">Nar</th>
                        <th className="py-1 pr-1 text-right">Jama Wt</th>
                        <th className="py-1 pr-1 text-right">Nave Wt</th>
                        <th className="py-1 pr-1 text-right">Jama ₹</th>
                        <th className="py-1 pr-1 text-right">Nave ₹</th>
                        <th className="py-1 text-right">Fine Cl.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-0.5 pr-1 whitespace-nowrap">{row.date}</td>
                          <td className="py-0.5 pr-1 font-mono">{row.voucherNo}</td>
                          <td className="py-0.5 pr-1">{row.type}</td>
                          <td className="py-0.5 pr-1 max-w-[140px] truncate">{row.description}</td>
                          <td className="py-0.5 pr-1 text-right font-mono">
                            {row.goldInMg ? fmtG(row.goldInMg) : ""}
                          </td>
                          <td className="py-0.5 pr-1 text-right font-mono">
                            {row.goldOutMg ? fmtG(row.goldOutMg) : ""}
                          </td>
                          <td className="py-0.5 pr-1 text-right font-mono">
                            {row.moneyCreditPaise ? fmtRs(row.moneyCreditPaise) : ""}
                          </td>
                          <td className="py-0.5 pr-1 text-right font-mono">
                            {row.moneyDebitPaise ? fmtRs(row.moneyDebitPaise) : ""}
                          </td>
                          <td className="py-0.5 text-right font-mono">{fmtG(row.closingGoldMg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

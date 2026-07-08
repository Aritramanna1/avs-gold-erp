import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";

export const Route = createFileRoute("/people/ledger-print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Ledger Statement · ${shopName} ERP` }],
    };
  },
  component: LedgerPrintPage,
});

function LedgerPrintPage() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/people/ledger-print/$id" });
  const person = usePeople((s) => s.people.find((p) => p.id === id));

  // Calculate ledger rows
  const ledger = person ? compileCustomerLedger(person.id) : null;

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(person ? "customer_ledger_statement" : null, id);

  if (!person || !ledger) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Customer not found</h1>
          <p className="text-sm text-muted-foreground">This person may have been removed.</p>
          <Link to="/people" className="text-gold underline">
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Customer Ledger Statement"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/people"
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="Customer Ledger Statement"
          docNumber={docNumber}
          docType="customer_ledger_statement"
          recordId={person.id}
          createdAt={Date.now()}
          size="a4"
        >
          {/* Customer Details Box */}
          <div className="grid grid-cols-2 gap-6 border border-stone-200 rounded-xl p-4 bg-stone-50 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold mb-1">
                Customer Profile
              </div>
              <div className="font-serif text-lg font-bold text-stone-900">{person.fullName}</div>
              <div className="text-xs text-stone-600 mt-0.5">Phone: {person.phone}</div>
              {person.email && <div className="text-xs text-stone-600">Email: {person.email}</div>}
              {(person.currentAddress || person.villageCity) && (
                <div className="text-xs text-stone-600 mt-1 max-w-sm">
                  Address:{" "}
                  {[person.currentAddress, person.villageCity, person.state]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold mb-1 font-mono">
                Tax / Identifiers
              </div>
              {person.gstin && (
                <div className="text-xs text-stone-900 font-mono">GSTIN: {person.gstin}</div>
              )}
              {person.pan && (
                <div className="text-xs text-stone-900 font-mono">PAN: {person.pan}</div>
              )}
              <div className="text-xs text-stone-600 mt-2">
                Status:{" "}
                <span className="font-semibold text-stone-900">
                  {person.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Account Summaries Side-by-Side */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="border border-amber-300 rounded-xl p-4 bg-amber-50 flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
                  Gold Credit Account Balance
                </div>
                <div className="font-serif text-3xl text-amber-700 mt-2 font-bold font-mono">
                  {mgToGrams(ledger.closingGoldMg)}{" "}
                  <span className="text-xs font-sans text-stone-600">g fine</span>
                </div>
                <div className="text-xs text-stone-600 mt-1 font-mono">
                  {ledger.closingGoldMg > 0
                    ? "Shop owes Customer Gold (Advance Deposit)"
                    : ledger.closingGoldMg < 0
                      ? "Customer owes Shop Gold (Gold Credit Sale)"
                      : "Gold account is fully settled"}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 flex justify-between text-xs font-mono text-stone-600">
                <div>Total Recd: {mgToGrams(ledger.totalGoldInMg)} g</div>
                <div>Total Issued: {mgToGrams(ledger.totalGoldOutMg)} g</div>
              </div>
            </div>

            <div className="border border-stone-300 rounded-xl p-4 bg-stone-50 flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-600 font-bold">
                  Monetary Ledger Balance
                </div>
                <div
                  className={`font-serif text-3xl mt-2 font-bold font-mono ${ledger.closingMoneyPaise > 0 ? "text-red-700" : ledger.closingMoneyPaise < 0 ? "text-emerald-700" : "text-stone-900"}`}
                >
                  ₹ {paiseToRupees(ledger.closingMoneyPaise)}
                </div>
                <div className="text-xs text-stone-600 mt-1 font-mono">
                  {ledger.closingMoneyPaise > 0
                    ? "Outstanding Balance (Customer owes us cash)"
                    : ledger.closingMoneyPaise < 0
                      ? "Credit Advance Balance (Shop owes customer cash)"
                      : "Monetary account is fully settled"}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-200 flex justify-between text-xs font-mono text-stone-600">
                <div>Total Debit: ₹ {paiseToRupees(ledger.totalDebitPaise)}</div>
                <div>Total Credit: ₹ {paiseToRupees(ledger.totalCreditPaise)}</div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-700 mb-3 font-semibold">
              Ledger Entries Log
            </div>
            <div className="border border-stone-300 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-mono text-[9px] tracking-wider border-b border-stone-300">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-2 py-2.5">Ref/Voucher</th>
                    <th className="px-2 py-2.5">Type</th>
                    <th className="px-3 py-2.5 max-w-[200px]">Description</th>
                    <th className="px-2 py-2.5 text-right">Gold In</th>
                    <th className="px-2 py-2.5 text-right">Gold Out</th>
                    <th className="px-2 py-2.5 text-right">Debit (Dr)</th>
                    <th className="px-2 py-2.5 text-right">Credit (Cr)</th>
                    <th className="px-3 py-2.5 text-right font-bold border-l border-stone-300">
                      Gold Bal
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">Money Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {ledger.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-stone-50">
                      <td className="px-3 py-2 text-stone-600 whitespace-nowrap">{row.date}</td>
                      <td className="px-2 py-2 font-mono uppercase">{row.voucherNo}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-stone-600 max-w-[200px] break-words">
                        {row.description}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-amber-700 whitespace-nowrap">
                        {row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono whitespace-nowrap text-stone-600">
                        {row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-red-700 whitespace-nowrap">
                        {row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-700 whitespace-nowrap">
                        {row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono text-amber-700 border-l border-stone-300 whitespace-nowrap">
                        {mgToGrams(row.closingGoldMg)} g
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold font-mono whitespace-nowrap ${row.closingMoneyPaise > 0 ? "text-red-700" : row.closingMoneyPaise < 0 ? "text-emerald-700" : "text-stone-900"}`}
                      >
                        ₹{paiseToRupees(row.closingMoneyPaise)}
                      </td>
                    </tr>
                  ))}
                  {ledger.rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-stone-500">
                        No transactions registered in this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-2 gap-12 break-inside-avoid">
            <div>
              <div className="h-16 border-b border-stone-300" />
              <div className="mt-1.5 text-xs text-stone-600 font-mono">
                Customer's Acknowledgement Signature
              </div>
            </div>
            <div>
              <div className="h-16 border-b border-stone-300" />
              <div className="mt-1.5 text-xs text-stone-600 font-mono">
                For {firm.shopName} · Authorized Signature
              </div>
            </div>
          </div>

          <p className="mt-10 text-[9px] text-stone-500 text-center font-mono">
            This statement is computer-generated and reflects real-time independent running balances
            of gold and money accounts.
          </p>
        </PrintLayout>
      </div>
    </div>
  );
}

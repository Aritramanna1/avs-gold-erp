import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";

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
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between">
        <Link
          to="/people"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to People
        </Link>
        <Button
          onClick={() => window.print()}
          size="sm"
          className="bg-primary text-primary-foreground"
        >
          <Printer className="h-4 w-4 mr-1" /> Print Statement
        </Button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-6 print:p-0">
        <div className="print-sheet bg-card border border-border rounded-xl p-8 shadow-elegant print:rounded-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Logo variant="svg" className="h-14 w-14 object-contain" />
              <div>
                <div className="font-serif text-2xl text-gold leading-tight">{firm.shopName}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Jewellery Gold & Monetary Account Ledger
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Date Generated: {new Date().toLocaleString()}</div>
              <div>Customer Ref: {person.id}</div>
            </div>
          </div>

          {/* Customer Details Box */}
          <div className="grid grid-cols-2 gap-6 mt-6 border border-border/40 rounded-xl p-4 bg-muted/10 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gold font-bold mb-1">
                Customer Profile
              </div>
              <div className="font-serif text-lg font-bold text-foreground">{person.fullName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Phone: {person.phone}</div>
              {person.email && (
                <div className="text-xs text-muted-foreground">Email: {person.email}</div>
              )}
              {(person.currentAddress || person.villageCity) && (
                <div className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Address:{" "}
                  {[person.currentAddress, person.villageCity, person.state]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-gold font-bold mb-1 font-mono">
                Tax / Identifiers
              </div>
              {person.gstin && (
                <div className="text-xs text-foreground font-mono">GSTIN: {person.gstin}</div>
              )}
              {person.pan && (
                <div className="text-xs text-foreground font-mono">PAN: {person.pan}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                Status:{" "}
                <span className="font-semibold text-foreground">
                  {person.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Account Summaries Side-by-Side */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="border border-gold/30 rounded-xl p-4 bg-gold/5 flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gold font-bold">
                  Gold Credit Account Balance
                </div>
                <div className="font-serif text-3xl text-gold mt-2 font-bold font-mono">
                  {mgToGrams(ledger.closingGoldMg)}{" "}
                  <span className="text-xs font-sans text-muted-foreground">g fine</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono">
                  {ledger.closingGoldMg > 0
                    ? "Shop owes Customer Gold (Advance Deposit)"
                    : ledger.closingGoldMg < 0
                      ? "Customer owes Shop Gold (Gold Credit Sale)"
                      : "Gold account is fully settled"}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gold/20 flex justify-between text-xs font-mono text-muted-foreground">
                <div>Total Recd: {mgToGrams(ledger.totalGoldInMg)} g</div>
                <div>Total Issued: {mgToGrams(ledger.totalGoldOutMg)} g</div>
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/5 flex flex-col justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Monetary Ledger Balance
                </div>
                <div
                  className={`font-serif text-3xl mt-2 font-bold font-mono ${ledger.closingMoneyPaise > 0 ? "text-destructive" : ledger.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
                >
                  ₹ {paiseToRupees(ledger.closingMoneyPaise)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono">
                  {ledger.closingMoneyPaise > 0
                    ? "Outstanding Balance (Customer owes us cash)"
                    : ledger.closingMoneyPaise < 0
                      ? "Credit Advance Balance (Shop owes customer cash)"
                      : "Monetary account is fully settled"}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs font-mono text-muted-foreground">
                <div>Total Debit: ₹ {paiseToRupees(ledger.totalDebitPaise)}</div>
                <div>Total Credit: ₹ {paiseToRupees(ledger.totalCreditPaise)}</div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-gold mb-3 font-semibold">
              Ledger Entries Log
            </div>
            <div className="border border-border/60 rounded-xl overflow-hidden bg-background/25">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-mono text-[9px] tracking-wider border-b border-border/60">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-2 py-2.5">Ref/Voucher</th>
                    <th className="px-2 py-2.5">Type</th>
                    <th className="px-3 py-2.5 max-w-[200px]">Description</th>
                    <th className="px-2 py-2.5 text-right">Gold In</th>
                    <th className="px-2 py-2.5 text-right">Gold Out</th>
                    <th className="px-2 py-2.5 text-right">Debit (Dr)</th>
                    <th className="px-2 py-2.5 text-right">Credit (Cr)</th>
                    <th className="px-3 py-2.5 text-right font-bold border-l border-border/40">
                      Gold Bal
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">Money Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ledger.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-2 py-2 font-mono uppercase">{row.voucherNo}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] break-words">
                        {row.description}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-gold whitespace-nowrap">
                        {row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono whitespace-nowrap text-muted-foreground">
                        {row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-destructive whitespace-nowrap">
                        {row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-500 whitespace-nowrap">
                        {row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono text-gold border-l border-border/40 whitespace-nowrap">
                        {mgToGrams(row.closingGoldMg)} g
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold font-mono whitespace-nowrap ${row.closingMoneyPaise > 0 ? "text-destructive" : row.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
                      >
                        ₹{paiseToRupees(row.closingMoneyPaise)}
                      </td>
                    </tr>
                  ))}
                  {ledger.rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-muted-foreground">
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
              <div className="h-16 border-b border-border/60" />
              <div className="mt-1.5 text-xs text-muted-foreground font-mono">
                Customer's Acknowledgement Signature
              </div>
            </div>
            <div>
              <div className="h-16 border-b border-border/60" />
              <div className="mt-1.5 text-xs text-muted-foreground font-mono">
                For {firm.shopName} · Authorized Signature
              </div>
            </div>
          </div>

          <p className="mt-10 text-[9px] text-muted-foreground text-center font-mono">
            This statement is computer-generated and reflects real-time independent running balances
            of gold and money accounts.
          </p>
          <div className="mt-4">
            <AvsPrintFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

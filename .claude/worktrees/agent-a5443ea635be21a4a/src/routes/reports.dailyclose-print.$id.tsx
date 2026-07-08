import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { Button } from "@/components/ui/button";
import { PrintQR } from "@/components/print-qr";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/reports/dailyclose-print/$id")({
  head: () => ({ meta: [{ title: "Daily Close Print · MTJ ERP" }] }),
  component: DailyClosePrint,
});

function DailyClosePrint() {
  const { id } = useParams({ from: "/reports/dailyclose-print/$id" });
  const c = useDailyCloses((s) => s.closes.find((x) => x.id === id));
  if (!c) return <div className="p-8">Daily Close not found.</div>;
  const s = c.snapshot;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/reports/daily-close">
          <Button variant="ghost">← Back</Button>
        </Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <div className="bg-white text-black p-8 rounded-md shadow print:shadow-none">
        <div className="text-center border-b border-black/30 pb-3 mb-4">
          <div className="flex justify-center mb-1">
            <Logo variant="png" className="h-10 w-10 object-contain" />
          </div>
          <div className="text-2xl font-serif tracking-wide">
            {useSettings.getState().firm.shopName}
          </div>
          <div className="text-xs">Daily Close Report — {c.date}</div>
          <div className="text-[10px] text-black/60">
            Generated {new Date(c.createdAt).toLocaleString("en-IN")}
          </div>
        </div>

        <Section title="Gold Summary">
          <Row k="Opening Vault" v={`${mgToGrams(s.openingVaultMg)} g`} />
          <Row k="Gold Issued" v={`${mgToGrams(s.goldIssuedMg)} g`} />
          <Row k="Gold Received" v={`${mgToGrams(s.goldReceivedMg)} g`} />
          <Row k="Finished Created" v={`${mgToGrams(s.finishedCreatedMg)} g`} />
          <Row k="Scrap Returned" v={`${mgToGrams(s.scrapReturnedMg)} g`} />
          <Row k="Sold (fine)" v={`${mgToGrams(s.soldFineMg)} g`} />
          <Row k="Closing Vault" v={`${mgToGrams(s.closingVaultMg)} g`} bold />
          <Row k="Karigar Outstanding" v={`${mgToGrams(s.karigarOutstandingMg)} g`} />
          <Row
            k="Balance Sheet"
            v={s.balanceSheetBalanced ? "BALANCED" : `DIFFERENCE ${mgToGrams(s.discrepancyMg)} g`}
            bold
          />
        </Section>

        <Section title="Cash / Payments">
          <Row k="Invoices" v={String(s.invoiceCount)} />
          <Row k="Sales Total" v={`₹ ${paiseToRupees(s.salesTotalPaise)}`} />
          <Row k="Cash" v={`₹ ${paiseToRupees(s.cashTotalPaise)}`} />
          <Row k="UPI" v={`₹ ${paiseToRupees(s.upiTotalPaise)}`} />
          <Row k="Bank" v={`₹ ${paiseToRupees(s.bankTotalPaise)}`} />
          <Row k="Card" v={`₹ ${paiseToRupees(s.cardTotalPaise)}`} />
          <Row k="Outstanding" v={`₹ ${paiseToRupees(s.outstandingTotalPaise)}`} />
          <Row k="GST Collected" v={`₹ ${paiseToRupees(s.gstCollectedPaise)}`} />
          <Row k="Repair Payments" v={`₹ ${paiseToRupees(s.repairPaymentsPaise)}`} />
          <Row k="Worker Withdrawals" v={`₹ ${paiseToRupees(s.workerWithdrawalsPaise)}`} />
        </Section>

        <Section title="Workshop / Repair">
          <Row k="Job Cards Created" v={String(s.jobCardsCreated)} />
          <Row k="Job Cards Closed" v={String(s.jobCardsClosed)} />
          <Row k="Repairs Created" v={String(s.repairsCreated)} />
          <Row k="Repairs Delivered" v={String(s.repairsDelivered)} />
        </Section>

        <Section title="Cash Reconciliation">
          <Row k="Physical Cash Counted" v={`₹ ${paiseToRupees(c.physicalCashCountedPaise)}`} />
          <Row k="Expected Cash" v={`₹ ${paiseToRupees(c.expectedCashPaise)}`} />
          <Row k="Variance" v={`₹ ${paiseToRupees(c.cashVariancePaise)}`} bold />
        </Section>

        <Section title="Checklist">
          <Row k="Cash counted" v={c.checklist.cashCounted ? "✓" : "✗"} />
          <Row k="Gold checked" v={c.checklist.goldChecked ? "✓" : "✗"} />
          <Row k="Pending orders reviewed" v={c.checklist.pendingOrdersReviewed ? "✓" : "✗"} />
          <Row k="Karigar custody reviewed" v={c.checklist.karigarCustodyReviewed ? "✓" : "✗"} />
          <Row k="Print reports saved" v={c.checklist.printReportsSaved ? "✓" : "✗"} />
        </Section>

        {c.notes && (
          <div className="mt-3 text-sm">
            <b>Notes:</b> {c.notes}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] gap-8 mt-12 text-xs items-end">
          <div className="border-t border-black/40 pt-1">Manager: {c.managerSignature ?? "—"}</div>
          <PrintQR
            docType="daily_close_report"
            docNumber={c.date}
            recordId={c.id}
            createdAt={c.createdAt}
          />
          <div className="border-t border-black/40 pt-1 text-right">
            Owner: {c.ownerSignature ?? "—"}
          </div>
        </div>

        <AvsPrintFooter className="mt-8 border-t border-black/10 pt-4" />
      </div>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-sm font-bold border-b border-black/30 pb-1 mb-1">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

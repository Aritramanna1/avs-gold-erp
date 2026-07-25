import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { PrintQR } from "@/components/print-qr";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { useSettings } from "@/lib/settings-store";
import { generateReportPdf } from "@/lib/pdf/document-pdf-generator";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/dailyclose-print/$id")({
  head: () => ({ meta: [{ title: "Daily Close Print · AVS Gold ERP" }] }),
  component: DailyClosePrint,
});

function DailyClosePrint() {
  const { id } = useParams({ from: "/reports/dailyclose-print/$id" });
  const c = useDailyCloses((s) => s.closes.find((x) => x.id === id));

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(c ? "daily_close_report" : null, id);
  const firm = useSettings((s) => s.firm);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!c) return <div className="p-8">Daily Close not found.</div>;
  const s = c.snapshot;
  const title = `Daily Close Report — ${c.date}`;

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const blob = generateReportPdf(
        {
          title,
          reportNo: c!.id,
          metrics: [
            { label: "Opening Vault", value: `${mgToGrams(s.openingVaultMg)} g` },
            { label: "Gold Issued", value: `${mgToGrams(s.goldIssuedMg)} g` },
            { label: "Gold Received", value: `${mgToGrams(s.goldReceivedMg)} g` },
            { label: "Closing Vault", value: `${mgToGrams(s.closingVaultMg)} g` },
            {
              label: "Balance Sheet",
              value: s.balanceSheetBalanced
                ? "BALANCED"
                : `DIFFERENCE ${mgToGrams(s.discrepancyMg)} g`,
            },
            { label: "Sales Total", value: `Rs ${paiseToRupees(s.salesTotalPaise)}` },
            { label: "Cash", value: `Rs ${paiseToRupees(s.cashTotalPaise)}` },
            {
              label: "Physical Cash Counted",
              value: `Rs ${paiseToRupees(c!.physicalCashCountedPaise)}`,
            },
            { label: "Expected Cash", value: `Rs ${paiseToRupees(c!.expectedCashPaise)}` },
            { label: "Cash Variance", value: `Rs ${paiseToRupees(c!.cashVariancePaise)}` },
          ],
        },
        firm,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Daily-Close-${c!.date}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title={title}
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/reports/daily-close"
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title={title}
          docNumber={docNumber}
          docType="daily_close_report"
          recordId={c.id}
          createdAt={c.createdAt}
          size="a4"
          showQR={false}
        >
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
            <div className="border-t border-black/40 pt-1">
              Manager: {c.managerSignature ?? "—"}
            </div>
            <PrintQR
              docType="daily_close_report"
              docNumber={docNumber}
              recordId={c.id}
              createdAt={c.createdAt}
            />
            <div className="border-t border-black/40 pt-1 text-right">
              Owner: {c.ownerSignature ?? "—"}
            </div>
          </div>
        </PrintLayout>
      </div>
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

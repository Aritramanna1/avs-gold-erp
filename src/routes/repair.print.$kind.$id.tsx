import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  useRepairs,
  REPAIR_TYPE_LABELS,
  REPAIR_KIND_LABELS,
  REPAIR_STATUS_LABELS,
  computeRepairTotals,
} from "@/lib/repair-store";
import { paiseToRupees, PAYMENT_MODE_LABELS } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { PrintQR } from "@/components/print-qr";
import type { PrintDocType } from "@/lib/printlog-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { useSettings } from "@/lib/settings-store";
import { useState } from "react";
import { toast } from "sonner";

type Kind = "receipt" | "delivery" | "invoice" | "payment";
const TITLES: Record<Kind, string> = {
  receipt: "Repair Receipt",
  delivery: "Repair Delivery Slip",
  invoice: "Repair Invoice",
  payment: "Payment Receipt",
};

export const Route = createFileRoute("/repair/print/$kind/$id")({
  head: () => ({ meta: [{ title: "Repair Print · AVS Gold ERP" }] }),
  component: RepairPrint,
});

function RepairPrint() {
  const params = useParams({ from: "/repair/print/$kind/$id" });
  const id = params.id;
  const KIND_ALIASES: Record<string, string> = {
    "polishing-receipt": "receipt",
    "polishing-delivery": "delivery",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;
  const r = useRepairs((s) => s.repairs.find((x) => x.id === id));
  const k = TITLES[kind as Kind] ? (kind as Kind) : "receipt";

  const docType: PrintDocType =
    r?.kind === "polishing"
      ? "polishing_receipt"
      : k === "invoice"
        ? "repair_invoice"
        : k === "delivery"
          ? "repair_delivery_slip"
          : k === "payment"
            ? "payment_receipt"
            : "repair_receipt";

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(r ? docType : null, id);
  const firm = useSettings((s) => s.firm);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!r) return <div className="p-8">Repair not found.</div>;

  const totals = computeRepairTotals(r);
  const title =
    r.kind === "polishing"
      ? k === "receipt"
        ? "Polishing Receipt"
        : k === "delivery"
          ? "Polishing Delivery Slip"
          : TITLES[k]
      : TITLES[k];

  async function handleDownloadPdf() {
    const repair = r!;
    setDownloadingPdf(true);
    try {
      const { generateRepairPdf, generateRepairInvoicePdf, generateRepairPaymentReceiptPdf } =
        await import("@/lib/pdf/document-pdf-generator");
      const dateStr = new Date(repair.createdAt).toLocaleDateString("en-IN", {
        dateStyle: "medium",
      });
      if (k === "receipt") {
        const blob = generateRepairPdf(repair, firm);
        downloadBlob(blob, `Repair-${repair.repairNo || repair.id}.pdf`);
      } else if (k === "invoice" || k === "delivery") {
        const blob = generateRepairInvoicePdf(
          {
            title,
            docNo: docNumber || repair.id,
            date: dateStr,
            customerName: repair.customerName,
            customerPhone: repair.customerPhone,
            repairChargePaise: repair.finalChargePaise || repair.estimatedChargePaise,
            polishingChargePaise: repair.polishingChargePaise,
            additionalChargePaise: repair.additionalChargePaise,
            gstEnabled: repair.gstEnabled,
            cgstPaise: totals.cgstPaise,
            sgstPaise: totals.sgstPaise,
            grandTotalPaise: totals.grandTotalPaise,
            paidPaise: totals.paidPaise,
            balancePaise: totals.balancePaise,
            deliveredAt:
              k === "delivery" && repair.deliveredAt
                ? new Date(repair.deliveredAt).toLocaleString("en-IN")
                : undefined,
          },
          firm,
        );
        downloadBlob(blob, `${title.replace(/\s+/g, "-")}-${repair.repairNo || repair.id}.pdf`);
      } else if (k === "payment") {
        const rows = [
          ...(repair.advancePaise > 0
            ? [
                {
                  date: new Date(repair.createdAt).toLocaleDateString("en-IN"),
                  mode: repair.advanceMode ? PAYMENT_MODE_LABELS[repair.advanceMode] : "—",
                  reference: "Advance",
                  amountPaise: repair.advancePaise,
                },
              ]
            : []),
          ...repair.payments.map((p) => ({
            date: new Date(p.ts).toLocaleDateString("en-IN"),
            mode: PAYMENT_MODE_LABELS[p.mode],
            reference: p.reference ?? "—",
            amountPaise: p.amountPaise,
          })),
        ];
        const blob = generateRepairPaymentReceiptPdf(
          {
            docNo: docNumber || repair.id,
            date: dateStr,
            customerName: repair.customerName,
            rows,
            totalPaidPaise: totals.paidPaise,
          },
          firm,
        );
        downloadBlob(blob, `Payment-Receipt-${repair.repairNo || repair.id}.pdf`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
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
        backUrl={`/repair/${r.id}`}
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title={title}
          docNumber={docNumber}
          docType={docType}
          recordId={r.id}
          createdAt={r.createdAt}
          size="a4"
          showQR={false}
        >
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="font-bold">Customer</div>
              <div>{r.customerName}</div>
              {r.customerPhone && <div>{r.customerPhone}</div>}
            </div>
            <div className="text-right">
              <div>
                <b>{r.repairNo}</b>
              </div>
              <div>{new Date(r.createdAt).toLocaleString("en-IN")}</div>
              <div>Status: {REPAIR_STATUS_LABELS[r.status]}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-black/30 mb-4">
            <tbody>
              <Row
                label={`${REPAIR_KIND_LABELS[r.kind]} Type`}
                value={REPAIR_TYPE_LABELS[r.repairType]}
              />
              <Row label="Item Type" value={r.itemType} />
              <Row label="Description" value={r.itemDescription || "—"} />
              <Row label="Received Weight" value={`${mgToGrams(r.receivedGrossMg)} g`} />
              {r.purity ? <Row label="Purity" value={`${r.purity}/1000`} /> : null}
              {r.conditionNotes && <Row label="Condition" value={r.conditionNotes} />}
              {r.stoneFittingNotes && <Row label="Stones/Fittings" value={r.stoneFittingNotes} />}
              <Row label="Expected Delivery" value={r.expectedDelivery ?? "—"} />
              <Row label="Worker" value={r.workerName ?? "—"} />
            </tbody>
          </table>

          {k === "receipt" && (
            <div className="text-sm">
              <div>Estimated Charge: ₹ {paiseToRupees(r.estimatedChargePaise)}</div>
              <div>
                Advance Received: ₹ {paiseToRupees(r.advancePaise)}{" "}
                {r.advanceMode ? `(${PAYMENT_MODE_LABELS[r.advanceMode]})` : ""}
              </div>
            </div>
          )}

          {(k === "invoice" || k === "delivery") && (
            <table className="w-full text-sm border border-black/30 mb-4">
              <tbody>
                <Row
                  label="Repair Charge"
                  value={`₹ ${paiseToRupees(r.finalChargePaise || r.estimatedChargePaise)}`}
                />
                <Row
                  label="Polishing Charge"
                  value={`₹ ${paiseToRupees(r.polishingChargePaise)}`}
                />
                <Row
                  label="Additional Material"
                  value={`₹ ${paiseToRupees(r.additionalChargePaise)}`}
                />
                {r.gstEnabled && (
                  <Row label="CGST 1.5%" value={`₹ ${paiseToRupees(totals.cgstPaise)}`} />
                )}
                {r.gstEnabled && (
                  <Row label="SGST 1.5%" value={`₹ ${paiseToRupees(totals.sgstPaise)}`} />
                )}
                <Row
                  label="Grand Total"
                  value={`₹ ${paiseToRupees(totals.grandTotalPaise)}`}
                  bold
                />
                <Row label="Advance + Payments" value={`₹ ${paiseToRupees(totals.paidPaise)}`} />
                <Row label="Balance" value={`₹ ${paiseToRupees(totals.balancePaise)}`} bold />
              </tbody>
            </table>
          )}

          {k === "payment" && (
            <table className="w-full text-sm border border-black/30 mb-4">
              <thead className="bg-black/5">
                <tr>
                  <th className="p-2 border border-black/20 text-left">Date</th>
                  <th className="p-2 border border-black/20 text-left">Mode</th>
                  <th className="p-2 border border-black/20 text-left">Ref</th>
                  <th className="p-2 border border-black/20 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.advancePaise > 0 && (
                  <tr>
                    <td className="p-2 border border-black/20">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-2 border border-black/20">
                      {r.advanceMode ? PAYMENT_MODE_LABELS[r.advanceMode] : "—"}
                    </td>
                    <td className="p-2 border border-black/20">Advance</td>
                    <td className="p-2 border border-black/20 text-right">
                      {paiseToRupees(r.advancePaise)}
                    </td>
                  </tr>
                )}
                {r.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 border border-black/20">
                      {new Date(p.ts).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-2 border border-black/20">{PAYMENT_MODE_LABELS[p.mode]}</td>
                    <td className="p-2 border border-black/20">{p.reference ?? "—"}</td>
                    <td className="p-2 border border-black/20 text-right">
                      {paiseToRupees(p.amountPaise)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-black/5">
                  <td className="p-2 border border-black/20 text-right font-bold" colSpan={3}>
                    Total Paid
                  </td>
                  <td className="p-2 border border-black/20 text-right font-bold">
                    ₹ {paiseToRupees(totals.paidPaise)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {k === "delivery" && (
            <div className="text-sm mt-4">
              Delivered on: {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString("en-IN") : "—"}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] gap-8 mt-12 text-xs items-end">
            <div>
              <div className="border-t border-black/40 pt-1">Customer Signature</div>
            </div>
            <PrintQR
              docType={docType}
              docNumber={docNumber}
              recordId={r.id}
              createdAt={r.createdAt}
            />
            <div>
              <div className="border-t border-black/40 pt-1 text-right">Authorised Signatory</div>
            </div>
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "bg-black/5 font-bold" : ""}>
      <td className="p-2 border border-black/20 w-1/2">{label}</td>
      <td className="p-2 border border-black/20">{value}</td>
    </tr>
  );
}

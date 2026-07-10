import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettlements, previewSettlementTotals, type Settlement } from "@/lib/settlement-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";

export const Route = createFileRoute("/settlement/draft-print/$id")({
  head: () => ({ meta: [{ title: "Settlement Draft · AVS Gold ERP" }] }),
  component: SettlementDraftPrint,
});

/**
 * Settlement Draft — half-A4, TWO identical copies (Customer + Workshop),
 * printed front (customer-facing preview figures only) and back (a blank
 * handwritten form the employee fills at the delivery counter). This is
 * NEVER a GST Invoice and never a final Settlement Receipt — both of those
 * only exist after Final Settlement (see settlement.$id.tsx's
 * completeFinalSettlement(), and the existing billing.settlement-slip.$id.tsx
 * for the post-final Settlement Receipt, reused as-is).
 */
function SettlementDraftPrint() {
  const { id } = useParams({ from: "/settlement/draft-print/$id" });
  const s = useSettlements((st) => st.settlements.find((x) => x.id === id));
  const refresh = useSettlements((st) => st.refresh);
  const { firm } = useSettings();

  // See settlement.$id.tsx's identical guard — never refresh() unconditionally
  // here, it would race and overwrite the store's own optimistic update from
  // createDraft() with a stale local-first read.
  useEffect(() => {
    if (!s) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(
    s
      ? {
          docType: "settlement_draft",
          docNumber: s.settlementNo,
          linkedId: s.id,
          linkedLabel: s.customerName,
        }
      : null,
  );

  if (!s) return <div className="p-8">Settlement not found.</div>;
  const preview = previewSettlementTotals(s.items, s.gst, s.payments);
  const item = s.items[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Settlement Draft (Front + Back)"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/settlement/${s.id}`}
      />

      <div className="p-4 md:p-8 max-w-3xl mx-auto print:p-0">
        {/* ── PAGE 1 — FRONT SIDE — two identical copies stacked ────────────── */}
        <div
          className="bg-white text-black print:break-after-page"
          data-testid="settlement-draft-front"
        >
          <DraftCopy
            label="CUSTOMER COPY"
            s={s}
            item={item}
            preview={preview}
            shopName={firm.shopName}
          />
          <div className="border-t-2 border-dashed border-black/40 my-2 text-center text-[9px] text-black/40 py-1 print:my-0">
            ✂ — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — ✂
          </div>
          <DraftCopy
            label="WORKSHOP COPY"
            s={s}
            item={item}
            preview={preview}
            shopName={firm.shopName}
          />
        </div>

        {/* ── PAGE 2 — BACK SIDE — two blank handwritten forms stacked ──────── */}
        <div className="bg-white text-black" data-testid="settlement-draft-back">
          <BackForm label="CUSTOMER COPY" />
          <div className="border-t-2 border-dashed border-black/40 my-2 text-center text-[9px] text-black/40 py-1 print:my-0">
            ✂ — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — ✂
          </div>
          <BackForm label="WORKSHOP COPY" />
        </div>
      </div>
    </div>
  );
}

function DraftCopy({
  label,
  s,
  item,
  preview,
  shopName,
}: {
  label: string;
  s: Settlement;
  item: Settlement["items"][number] | undefined;
  preview: ReturnType<typeof previewSettlementTotals>;
  shopName: string;
}) {
  return (
    <div className="p-6" style={{ minHeight: "135mm" }}>
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <div className="text-lg font-serif tracking-wide">{shopName.toUpperCase()}</div>
        <div className="text-xs font-bold tracking-widest mt-1">DRAFT SETTLEMENT</div>
        <div className="text-[10px] italic">NOT A TAX INVOICE</div>
        <div className="text-[9px] mt-0.5 font-bold">{label}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <b>Settlement No.</b> {s.settlementNo}
        </div>
        <div className="text-right">
          <b>Date</b> {new Date(s.createdAt).toLocaleDateString("en-IN")}
        </div>
        <div className="col-span-2">
          <b>Customer / Dealer</b> {s.customerName}
        </div>
      </div>

      {item && (
        <table className="w-full text-xs border border-black/30 mb-3">
          <tbody>
            <Row2 label="Product" value={item.itemName} />
            <Row2 label="Gross Weight" value={`${mgToGrams(item.grossMg)} g`} />
            <Row2 label="Net Weight" value={`${mgToGrams(item.netMg)} g`} />
            <Row2 label="Purity" value={`${(item.purity / 10).toFixed(1)}%`} />
            <Row2 label="Making Charges" value={`₹${paiseToRupees(item.makingChargesPaise)}`} />
          </tbody>
        </table>
      )}

      <table className="w-full text-xs border border-black/30 mb-2">
        <tbody>
          <Row2
            label="Previous Gold Balance"
            value={`${mgToGrams(s.existingGoldCreditMgAtDraft)} g`}
          />
          <Row2 label="Gold Received" value={`${mgToGrams(item?.fineMg ?? 0)} g fine`} />
          <Row2 label="Gold Used" value={`${mgToGrams(item?.fineMg ?? 0)} g fine`} />
          <Row2
            label="Gold Balance"
            value={`${mgToGrams(Math.max(0, s.existingGoldCreditMgAtDraft - (item?.fineMg ?? 0)))} g`}
          />
          {s.gst !== "none" && (
            <Row2 label="GST Preview" value={`₹${paiseToRupees(preview.gstPaise)}`} />
          )}
          {preview.tcsPaise > 0 && (
            <Row2 label="TCS Preview" value={`₹${paiseToRupees(preview.tcsPaise)}`} />
          )}
          <Row2 label="Gold Payable" value={`${mgToGrams(item?.fineMg ?? 0)} g fine`} bold />
          <Row2 label="Cash Equivalent" value={`₹${paiseToRupees(preview.grandTotalPaise)}`} bold />
        </tbody>
      </table>

      <p className="text-[9px] text-center text-black/50 mt-2">
        Employee carries this draft with the jewellery — actual payment is recorded on the reverse
        side and finalised at the office.
      </p>
    </div>
  );
}

function BackForm({ label }: { label: string }) {
  return (
    <div className="p-6 text-xs" style={{ minHeight: "135mm" }}>
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <div className="text-sm font-bold tracking-widest">SETTLEMENT — DELIVERY RECORD</div>
        <div className="text-[9px] mt-0.5 font-bold">{label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>Date: ________________</div>
        <div>Time: ________________</div>
      </div>

      <div className="mb-3">
        <div className="font-bold mb-1">Payment Type</div>
        <div className="flex gap-6">
          <span>☐ Full Payment</span>
          <span>☐ Partial Payment</span>
          <span>☐ Credit Delivery (No Payment)</span>
        </div>
      </div>

      <div className="font-bold mb-1">Payment Received</div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-6 mb-3">
        <div>Gold: ________________</div>
        <div>Cash: ________________</div>
        <div>UPI: ________________</div>
        <div>Bank: ________________</div>
        <div>Cheque: ________________</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>Outstanding Gold: ________________</div>
        <div>Outstanding Cash: ________________</div>
      </div>

      <div className="mb-3">
        <div>Dealer Remarks:</div>
        <div className="border-b border-black/40 h-6 mt-1" />
        <div className="border-b border-black/40 h-6 mt-2" />
      </div>
      <div className="mb-6">
        <div>Employee Remarks:</div>
        <div className="border-b border-black/40 h-6 mt-1" />
        <div className="border-b border-black/40 h-6 mt-2" />
      </div>

      <div className="grid grid-cols-2 gap-6 text-center mt-8">
        <div className="border-t border-black pt-1">Dealer Signature</div>
        <div className="border-t border-black pt-1">Employee Signature</div>
      </div>
    </div>
  );
}

function Row2({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td className={`border border-black/20 p-1.5 ${bold ? "font-bold" : ""}`}>{label}</td>
      <td className={`border border-black/20 p-1.5 text-right ${bold ? "font-bold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}

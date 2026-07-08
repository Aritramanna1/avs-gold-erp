import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  useRepairs,
  REPAIR_TYPE_LABELS,
  REPAIR_KIND_LABELS,
  REPAIR_STATUS_LABELS,
  computeRepairTotals,
} from "@/lib/repair-store";
import { paiseToRupees, PAYMENT_MODE_LABELS } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { Button } from "@/components/ui/button";
import { PrintQR } from "@/components/print-qr";
import type { PrintDocType } from "@/lib/printlog-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";

type Kind = "receipt" | "delivery" | "invoice" | "payment";
const TITLES: Record<Kind, string> = {
  receipt: "Repair Receipt",
  delivery: "Repair Delivery Slip",
  invoice: "Repair Invoice",
  payment: "Payment Receipt",
};

export const Route = createFileRoute("/repair/print/$kind/$id")({
  head: () => ({ meta: [{ title: "Repair Print · MTJ ERP" }] }),
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
  if (!r) return <div className="p-8">Repair not found.</div>;
  const k = TITLES[kind as Kind] ? (kind as Kind) : "receipt";

  const totals = computeRepairTotals(r);
  const title =
    r.kind === "polishing"
      ? k === "receipt"
        ? "Polishing Receipt"
        : k === "delivery"
          ? "Polishing Delivery Slip"
          : TITLES[k]
      : TITLES[k];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/repair/$id" params={{ id: r.id }}>
          <Button variant="ghost">← Back</Button>
        </Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>
      <div className="bg-white text-black p-8 rounded-md shadow print:shadow-none">
        <div className="flex items-center gap-3 border-b border-black/30 pb-3 mb-4">
          <Logo
            variant="png"
            className="h-12 w-12 object-contain flex-shrink-0 print:h-10 print:w-10"
          />
          <div className="flex-1 text-center">
            <div className="text-2xl font-serif tracking-wide">
              {useSettings.getState().firm.shopName}
            </div>
            <div className="text-xs">{title}</div>
          </div>
        </div>

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
              <Row label="Polishing Charge" value={`₹ ${paiseToRupees(r.polishingChargePaise)}`} />
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
              <Row label="Grand Total" value={`₹ ${paiseToRupees(totals.grandTotalPaise)}`} bold />
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
            docType={
              (r.kind === "polishing"
                ? "polishing_receipt"
                : k === "invoice"
                  ? "repair_invoice"
                  : k === "delivery"
                    ? "repair_delivery_slip"
                    : k === "payment"
                      ? "payment_receipt"
                      : "repair_receipt") as PrintDocType
            }
            docNumber={r.repairNo}
            recordId={r.id}
            createdAt={r.createdAt}
          />
          <div>
            <div className="border-t border-black/40 pt-1 text-right">Authorised Signatory</div>
          </div>
        </div>

        <AvsPrintFooter className="mt-8 border-t border-black/10 pt-4" />
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

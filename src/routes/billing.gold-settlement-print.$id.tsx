import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintLayout } from "@/components/print/PrintLayout";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { useGoldSettlementRecord } from "@/lib/use-gold-settlement-record";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/gold-settlement-print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Print Voucher · ${shopName}` }],
    };
  },
  component: GoldSettlementPrintComponent,
});

const linkUseLabel = (val: string) => {
  switch (val) {
    case "advance":
      return "Advance against order";
    case "invoice_payment":
      return "Invoice payment";
    case "old_gold":
      return "Old gold exchange";
    case "karigar":
      return "Karigar settlement";
    case "worker_return":
      return "Worker gold return";
    case "rate_cut":
      return "Rate-cut settlement";
    default:
      return "General gold adjustment";
  }
};

function GoldSettlementPrintComponent() {
  const { id } = useParams({ from: "/billing/gold-settlement-print/$id" });
  const { firm } = useSettings();
  const { party, loading: directLoading, error: directError, retry } = useGoldSettlementRecord(id);

  const [layoutSize, setLayoutSize] = useState<"a4" | "a5" | "thermal" | "thermal58" | "tag">("a4");
  const [downloading, setDownloading] = useState(false);

  const {
    record: settlement,
    error,
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord("gold_settlement", id);

  if (directLoading && !settlement) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <p className="mt-2 text-xs font-mono text-muted-foreground">Loading Print Record...</p>
      </div>
    );
  }

  if (directError || error || !settlement) {
    return (
      <div className="p-8 text-rose-500 bg-background max-w-md mx-auto my-12 border border-rose-500/20 rounded-xl text-center space-y-3">
        <h2 className="text-lg font-serif font-semibold">Voucher Loading Failure</h2>
        <p className="text-xs text-muted-foreground">
          {directError || error || "The requested Gold Settlement Voucher could not be found."}
        </p>
        {directError ? (
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-amber-900 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        ) : null}
        <Link to="/billing">
          <button className="px-4 py-2 mt-4 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
            Back to Billing
          </button>
        </Link>
      </div>
    );
  }

  const partyName = party ? party.fullName : "Internal App Account";
  const partyPhone = party?.phone || "";
  const partyAddress = party?.currentAddress || "";
  const cleanNotes = settlement.notes?.split("[Voucher Action:")[0] || "";

  // Pull items array from JSON payload or create a synthetic fallback row for legacy records
  const itemsList: any[] = settlement.items || [
    {
      id: "synthetic",
      kind: "gold",
      description: settlement.notes?.includes("Status:")
        ? "Metal weight adjustment"
        : settlement.notes || "Official Weight Adjustment Entry",
      grossGrams: settlement.gross_mg / 1000,
      lessGrams: (settlement.gross_mg - settlement.net_mg) / 1000,
      netGrams: settlement.net_mg / 1000,
      purity: settlement.purity / 10,
      wastagePct: 0,
      fineGrams: settlement.net_mg / 1000, // assume fine gold equivalent if simple record
      goldRate:
        settlement.rate_per_gram_paise > 0 ? settlement.rate_per_gram_paise / 100 : undefined,
      amountRupees: settlement.amount_paise > 0 ? settlement.amount_paise / 100 : undefined,
      direction: settlement.settlement_type === "gold_given" ? "Naam" : "Jama",
      rowType: "item",
    },
  ];

  // Calculations
  const prevGoldMg = settlement.p_balance_gold_mg ?? 0;
  const prevCashPaise = settlement.p_balance_cash_paise ?? 0;

  const todayGoldJamaGrams = itemsList
    .filter((it) => it.kind === "gold" && it.direction === "Jama")
    .reduce((sum, it) => sum + (it.fineGrams || 0), 0);

  const todayGoldNaamGrams = itemsList
    .filter((it) => it.kind === "gold" && it.direction === "Naam")
    .reduce((sum, it) => sum + (it.fineGrams || 0), 0);

  const todayCashJamaRupees = itemsList
    .filter((it) => it.direction === "Jama")
    .reduce((sum, it) => {
      if (it.kind === "cash") return sum + (it.amountRupees || 0);
      return sum + (it.labourRupees || 0);
    }, 0);

  const todayCashNaamRupees = itemsList
    .filter((it) => it.direction === "Naam")
    .reduce((sum, it) => {
      if (it.kind === "cash") return sum + (it.amountRupees || 0);
      const conv = it.amountRupees || 0;
      const lab = it.labourRupees || 0;
      return sum + conv + lab;
    }, 0);

  const netTodayGoldGrams = todayGoldJamaGrams - todayGoldNaamGrams;
  const netTodayCashRupees = todayCashJamaRupees - todayCashNaamRupees;

  const closingGoldMg = prevGoldMg + Math.round(netTodayGoldGrams * 1000);
  const closingCashPaise = prevCashPaise + Math.round(netTodayCashRupees * 100000);

  // Net Total — previous balance plus only today's ITEM rows (goods/gold
  // changing hands), the legacy report's checkpoint printed before any
  // settlement/payment rows are netted in below.
  const itemNetGoldGrams = itemsList
    .filter((it) => it.kind === "gold" && it.rowType === "item")
    .reduce((sum, it) => sum + (it.direction === "Jama" ? 1 : -1) * (it.fineGrams || 0), 0);
  const itemNetCashRupees = itemsList
    .filter((it) => it.rowType === "item")
    .reduce((sum, it) => {
      const val = it.kind === "cash" ? it.amountRupees || 0 : it.labourRupees || 0;
      return sum + (it.direction === "Jama" ? 1 : -1) * val;
    }, 0);
  const netTotalGoldMg = prevGoldMg + Math.round(itemNetGoldGrams * 1000);
  const netTotalCashPaise = prevCashPaise + Math.round(itemNetCashRupees * 100000);

  // Direction Helper labels
  const getGoldLiabilityLabel = (mg: number) => {
    if (mg > 0) return `We owe ${partyName} gold (Jama / Credit)`;
    if (mg < 0) return `${partyName} owes us gold (Naam / Debit)`;
    return "Gold Balance Cleared";
  };

  const getCashLiabilityLabel = (paise: number) => {
    if (paise > 0) return `We owe ${partyName} cash (Jama / Credit)`;
    if (paise < 0) return `${partyName} owes us cash (Naam / Debit)`;
    return "Cash Balance Cleared";
  };

  const isThermalOrTag =
    layoutSize === "thermal" || layoutSize === "thermal58" || layoutSize === "tag";

  async function handleDownload() {
    setDownloading(true);
    try {
      const { generateGoldSettlementPdf, goldSettlementPdfFileName } =
        await import("@/lib/pdf/gold-settlement-pdf");
      const blob = generateGoldSettlementPdf(settlement!, partyName, firm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = goldSettlementPdfFileName(settlement!, firm);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Voucher PDF downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate voucher PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/15 flex flex-col font-sans">
      <PrintToolbar
        title="Gold Payment Voucher"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/billing"
        layoutSize={layoutSize}
        onLayoutSizeChange={(sz) =>
          setLayoutSize(sz as "a4" | "a5" | "thermal" | "thermal58" | "tag")
        }
        onDownloadPdf={handleDownload}
        downloadingPdf={downloading}
      />

      <div className="flex-1 p-4 md:p-8 flex flex-col items-center overflow-y-auto">
        <PrintLayout
          title="Gold Payment Voucher"
          docNumber={docNumber}
          docType="gold_settlement"
          recordId={settlement.id}
          createdAt={settlement.settlement_date}
          size={layoutSize}
          showQR={true}
          qrPosition={isThermalOrTag ? "footer" : "header"}
        >
          {!isThermalOrTag ? (
            /* Standard high-fidelity inkjet details block for A4/A5 */
            <div className="space-y-6 pt-4 text-xs font-sans text-neutral-800">
              <div className="grid grid-cols-2 gap-6 bg-stone-50 border border-stone-200 p-4 rounded-xl">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Party / Account Details
                  </span>
                  <div className="font-serif font-bold text-stone-900 mt-0.5 text-base">
                    {partyName}
                  </div>
                  {partyPhone && (
                    <div className="text-xs text-stone-600 font-mono mt-0.5">
                      Phone: {partyPhone}
                    </div>
                  )}
                  {partyAddress && (
                    <div className="text-xs text-stone-500 mt-1 max-w-xs">{partyAddress}</div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Voucher Properties
                  </span>
                  <div className="text-xs text-stone-800 mt-1 space-y-1">
                    <div>
                      <span className="text-stone-500 font-medium">Link Purpose:</span>{" "}
                      <span className="font-semibold text-stone-900">
                        {linkUseLabel(settlement.link_use || "general")}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 font-medium">Branch Location:</span>{" "}
                      <span className="font-medium text-stone-900">
                        {settlement.branch_id || "Main Showroom"}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 font-medium">Payment Method:</span>{" "}
                      <span className="font-mono font-semibold text-emerald-800">
                        {settlement.payment_mode || "Mixed"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 12-Column Table */}
              <div className="overflow-hidden border border-stone-200 rounded-xl shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <header className="hidden" />
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-700 uppercase font-semibold text-[9.5px] tracking-wider">
                    <tr>
                      <th className="p-2.5">Particulars</th>
                      <th className="p-2.5 text-center">HUID</th>
                      <th className="p-2.5 text-center">Stamp</th>
                      <th className="p-2.5 text-right">G.Wt (g)</th>
                      <th className="p-2.5 text-right">Add (g)</th>
                      <th className="p-2.5 text-right">Less (g)</th>
                      <th className="p-2.5 text-right font-medium">Net Wt</th>
                      <th className="p-2.5 text-center">Touch</th>
                      <th className="p-2.5 text-center">Wstg</th>
                      <th className="p-2.5 text-center">Pcs</th>
                      <th className="p-2.5 text-right">Labour (₹)</th>
                      <th className="p-2.5 text-right text-stone-900 font-bold">Gold (g)</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-[11px]">
                    {itemsList.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-stone-50/50">
                        <td className="p-2.5">
                          <div className="font-semibold text-stone-900">{it.description}</div>
                          <div className="text-[9px] text-stone-500">
                            Mode: {it.direction === "Jama" ? "Jama (Credit)" : "Naam (Debit)"}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono text-stone-750">
                          {it.huid || "—"}
                        </td>
                        <td className="p-2.5 text-center font-mono text-stone-750">
                          {it.stamp || "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-stone-750">
                          {it.grossGrams ? it.grossGrams.toFixed(3) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-stone-750">
                          {it.addGrams ? it.addGrams.toFixed(3) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-stone-750">
                          {it.lessGrams ? it.lessGrams.toFixed(3) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-medium text-stone-900">
                          {it.netGrams ? it.netGrams.toFixed(3) : "—"}
                        </td>
                        <td className="p-2.5 text-center font-mono text-stone-750">
                          {it.purity ? `${it.purity}%` : "—"}
                        </td>
                        <td className="p-2.5 text-center font-mono text-stone-750">
                          {it.wastagePct ? `${it.wastagePct}%` : "—"}
                        </td>
                        <td className="p-2.5 text-center text-stone-750">{it.pcs || "—"}</td>
                        <td className="p-2.5 text-right font-mono text-stone-750">
                          {it.labourRupees ? `₹${it.labourRupees}` : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-stone-900">
                          {it.fineGrams ? `${it.fineGrams.toFixed(3)}g` : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-stone-900">
                          {it.amountRupees ? `₹${it.amountRupees}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Balances Section (Separate Cash & Gold) */}
              <div className="grid grid-cols-2 gap-6 pt-4">
                {/* Gold Balance Box */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/30 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 border-b border-stone-200 pb-1.5">
                    Gold Statement (Fine equivalent)
                  </h3>
                  <div className="space-y-1.5 text-xs text-stone-600 font-mono">
                    <div className="flex justify-between">
                      <span>Previous / Initial Balance:</span>
                      <span className="font-semibold text-stone-900">
                        {mgToGrams(Math.abs(prevGoldMg))}g {prevGoldMg >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    {settlement.p_balance_ref_voucher_id && (
                      <div className="text-[9px] text-stone-400 -mt-1">
                        LB Bal. [#{settlement.p_balance_ref_voucher_id} ·{" "}
                        {new Date(settlement.p_balance_ref_voucher_date ?? "").toLocaleDateString(
                          "en-IN",
                        )}
                        ]
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-700">
                      <span>Today's Metal Jama (+):</span>
                      <span className="font-bold">+{todayGoldJamaGrams.toFixed(3)}g</span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>Today's Metal Naam (-):</span>
                      <span className="font-bold">-{todayGoldNaamGrams.toFixed(3)}g</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-stone-200 text-stone-800 font-semibold">
                      <span>Net Total:</span>
                      <span>
                        {mgToGrams(Math.abs(netTotalGoldMg))}g{" "}
                        {netTotalGoldMg >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-stone-200 text-stone-900 font-bold">
                      <span>Closing Gold Outstanding:</span>
                      <span>
                        {mgToGrams(Math.abs(closingGoldMg))}g{" "}
                        {closingGoldMg >= 0 ? "Jama / Credit" : "Naam / Debit"}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-[10px] font-bold text-center p-2 rounded-lg border ${
                      closingGoldMg >= 0
                        ? "text-emerald-700 bg-emerald-50/50 border-emerald-200"
                        : "text-rose-700 bg-rose-50/50 border-rose-200"
                    }`}
                  >
                    {getGoldLiabilityLabel(closingGoldMg)}
                  </div>
                </div>

                {/* Cash Balance Box */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/30 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 border-b border-stone-200 pb-1.5">
                    Rupees / Cash Statement
                  </h3>
                  <div className="space-y-1.5 text-xs text-stone-600 font-mono">
                    <div className="flex justify-between">
                      <span>Previous / Initial Balance:</span>
                      <span className="font-semibold text-stone-900">
                        ₹{paiseToRupees(Math.abs(prevCashPaise))}{" "}
                        {prevCashPaise >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    {settlement.p_balance_ref_voucher_id && (
                      <div className="text-[9px] text-stone-400 -mt-1">
                        LB Bal. [#{settlement.p_balance_ref_voucher_id} ·{" "}
                        {new Date(settlement.p_balance_ref_voucher_date ?? "").toLocaleDateString(
                          "en-IN",
                        )}
                        ]
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-700">
                      <span>Today's Cash Jama (+):</span>
                      <span className="font-bold">+₹{todayCashJamaRupees}</span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>Today's Cash Naam (-):</span>
                      <span className="font-bold">-₹{todayCashNaamRupees}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-stone-200 text-stone-800 font-semibold">
                      <span>Net Total:</span>
                      <span>
                        ₹{paiseToRupees(Math.abs(netTotalCashPaise))}{" "}
                        {netTotalCashPaise >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-stone-200 text-stone-900 font-bold">
                      <span>Closing Cash Outstanding:</span>
                      <span>
                        ₹{paiseToRupees(Math.abs(closingCashPaise))}{" "}
                        {closingCashPaise >= 0 ? "Jama / Credit" : "Naam / Debit"}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-[10px] font-bold text-center p-2 rounded-lg border ${
                      closingCashPaise >= 0
                        ? "text-emerald-700 bg-emerald-50/50 border-emerald-200"
                        : "text-rose-700 bg-rose-50/50 border-rose-200"
                    }`}
                  >
                    {getCashLiabilityLabel(closingCashPaise)}
                  </div>
                </div>
              </div>

              {cleanNotes && (
                <div className="border border-stone-200 bg-stone-50/20 p-4 rounded-xl text-stone-700 italic">
                  <strong>Voucher Memo / Remarks:</strong> {cleanNotes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-12 pt-8 mt-12 border-t border-dashed border-stone-200 text-center text-stone-600 font-mono text-[10px]">
                <div>
                  <div className="border-t border-stone-400 pt-1.5 font-semibold text-stone-800">
                    Recipient Signature
                  </div>
                  <p className="text-[9px] text-stone-400 mt-0.5">({partyName})</p>
                </div>
                <div>
                  <div className="border-t border-stone-400 pt-1.5 font-semibold text-stone-800">
                    Authorised Signature
                  </div>
                  <p className="text-[9px] text-stone-400 mt-0.5">
                    ({firm.ownerName || "Authorised Signatory"})
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Compressed thermal slip design */
            <div className="font-mono text-[11px] leading-relaxed space-y-3 pt-2 text-stone-900 bg-white">
              <div className="space-y-1">
                <div>
                  Party : <span className="font-bold">{partyName}</span>
                </div>
                {partyPhone && <div>Phone : {partyPhone}</div>}
                <div>Date : {new Date(settlement.settlement_date).toLocaleDateString("en-IN")}</div>
                <div>Link : {linkUseLabel(settlement.link_use || "general")}</div>
              </div>

              <div className="border-t border-b border-dashed border-stone-300 py-2 my-2 space-y-1.5">
                <div className="font-bold uppercase text-[9px] text-stone-500">Declared Items</div>
                {itemsList.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="flex justify-between border-b border-dotted border-stone-200 pb-1"
                  >
                    <span>
                      {it.description?.slice(0, 16)} ({it.direction === "Jama" ? "J" : "N"})
                    </span>
                    <span>
                      {it.fineGrams ? `${it.fineGrams.toFixed(3)}g` : "0g"} / ₹
                      {it.amountRupees || 0}
                    </span>
                  </div>
                ))}

                <div className="font-bold uppercase text-[9px] text-stone-500 pt-2 border-t border-dashed border-stone-200">
                  Outstanding Ledgers
                </div>
                <div className="flex justify-between font-bold">
                  <span>Net Gold Bal (g):</span>
                  <span>
                    {mgToGrams(Math.abs(closingGoldMg))}g {closingGoldMg >= 0 ? "Jama" : "Naam"}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Net Cash Bal (₹):</span>
                  <span>
                    ₹{paiseToRupees(Math.abs(closingCashPaise))}{" "}
                    {closingCashPaise >= 0 ? "Jama" : "Naam"}
                  </span>
                </div>
              </div>

              {cleanNotes && (
                <div className="italic text-[10px] break-words">*Memo: {cleanNotes}</div>
              )}

              <div className="grid grid-cols-2 gap-4 text-center text-[9px] pt-4 mt-4 border-t border-dashed border-stone-300">
                <div>
                  <div className="border-t border-dashed border-stone-400 pt-1">Recipient</div>
                </div>
                <div>
                  <div className="border-t border-dashed border-stone-400 pt-1">Manager</div>
                </div>
              </div>
            </div>
          )}
        </PrintLayout>
      </div>
    </div>
  );
}

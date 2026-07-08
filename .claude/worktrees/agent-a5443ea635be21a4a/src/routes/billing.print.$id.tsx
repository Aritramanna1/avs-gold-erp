import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useBilling, PAYMENT_MODE_LABELS, paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintQR } from "@/components/print-qr";
import { useAttachments } from "@/lib/attachments-store";
import { useStock } from "@/lib/stock-store";
import { useCatalog } from "@/lib/catalog-store";
import { Sparkles, CreditCard, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

// Helper to look up an invoice item's design photo across stock, catalog, and order entities
function getItemPhoto(it: any, orderId?: string) {
  const attachments = useAttachments.getState().items;

  if (it.stockItemId) {
    const stockAttKey = `stock:${it.stockItemId}:design_photo`;
    if (attachments[stockAttKey]?.thumbnailDataUrl || attachments[stockAttKey]?.fileDataUrl) {
      return attachments[stockAttKey].thumbnailDataUrl || attachments[stockAttKey].fileDataUrl;
    }
  }

  if (it.stockItemId || it.barcode) {
    const stockItem = useStock
      .getState()
      .items.find((s) => s.id === it.stockItemId || (it.barcode && s.barcode === it.barcode));
    if (stockItem) {
      const stockAttKey = `stock:${stockItem.id}:design_photo`;
      if (attachments[stockAttKey]?.thumbnailDataUrl || attachments[stockAttKey]?.fileDataUrl) {
        return attachments[stockAttKey].thumbnailDataUrl || attachments[stockAttKey].fileDataUrl;
      }

      const catalogDesign = useCatalog
        .getState()
        .designs.find(
          (d) => d.designNumber === stockItem.itemCode || d.designName === stockItem.itemName,
        );
      if (catalogDesign) {
        const catAttKey = `catalog:${catalogDesign.id}:design_photo`;
        if (attachments[catAttKey]?.thumbnailDataUrl || attachments[catAttKey]?.fileDataUrl) {
          return attachments[catAttKey].thumbnailDataUrl || attachments[catAttKey].fileDataUrl;
        }
      }
    }
  }

  const catalogDesignByName = useCatalog
    .getState()
    .designs.find((d) => d.designName === it.itemName);
  if (catalogDesignByName) {
    const catAttKey = `catalog:${catalogDesignByName.id}:design_photo`;
    if (attachments[catAttKey]?.thumbnailDataUrl || attachments[catAttKey]?.fileDataUrl) {
      return attachments[catAttKey].thumbnailDataUrl || attachments[catAttKey].fileDataUrl;
    }
  }

  if (orderId) {
    const orderAttKey = `order:${orderId}:design_photo`;
    if (attachments[orderAttKey]?.thumbnailDataUrl || attachments[orderAttKey]?.fileDataUrl) {
      return attachments[orderAttKey].thumbnailDataUrl || attachments[orderAttKey].fileDataUrl;
    }
  }

  return null;
}

// Convert numbers/rupees to words
function rupeesToWords(totalPaise: number): string {
  const totalRupees = Math.floor(totalPaise / 100);
  if (totalRupees === 0) return "Zero Rupees Only";

  const arr1 = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const arr2 = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n >= 100) {
      str += arr1[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += arr2[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += arr1[n] + " ";
    }
    return str.trim();
  }

  let temp = totalRupees;
  let words = "";

  // Crores
  if (Math.floor(temp / 10000000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 10000000)) + " Crore ";
    temp %= 10000000;
  }
  // Lakhs
  if (Math.floor(temp / 100000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 100000)) + " Lakh ";
    temp %= 100000;
  }
  // Thousands
  if (Math.floor(temp / 1000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 1000)) + " Thousand ";
    temp %= 1000;
  }
  // Remaining
  if (temp > 0) {
    words += convertLessThanOneThousand(temp);
  }

  return (words.trim() + " Rupees Only").replace(/\s+/g, " ");
}

export const Route = createFileRoute("/billing/print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [{ title: `Invoice Print · ${shortName} ERP` }],
    };
  },
  component: InvoicePrint,
});

function InvoicePrint() {
  const { firm } = useSettings();
  const { id } = useParams({ from: "/billing/print/$id" });
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));
  const [layoutSize, setLayoutSize] = useState<"a4" | "a5" | "thermal" | "thermal58" | "tag">("a4");

  const docType = inv?.gst === "gst3" ? "gst_invoice" : "retail_invoice";

  const {
    loading,
    error,
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(inv ? docType : null, id);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        <p className="mt-2 text-xs font-mono text-muted-foreground">Loading Print Record...</p>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="p-8 text-rose-500 bg-background max-w-md mx-auto my-12 border border-rose-500/20 rounded-xl text-center space-y-3">
        <h2 className="text-lg font-serif font-semibold">Invoice Loading Failure</h2>
        <p className="text-xs text-muted-foreground">
          {error || "The requested invoice could not be found."}
        </p>
        <Link to="/billing">
          <Button variant="outline" className="mt-4 text-xs">
            Back to Billing
          </Button>
        </Link>
      </div>
    );
  }

  const isThermal = layoutSize === "thermal" || layoutSize === "thermal58";
  const isTag = layoutSize === "tag";
  const isThermalOrTag = isThermal || isTag;

  // Calculate high-fidelity aggregate sums for weight and monetary metrics
  const totalGrossMg = inv.items?.reduce((acc, it) => acc + (it.grossMg || 0), 0) || 0;
  const totalNetMg = inv.items?.reduce((acc, it) => acc + (it.netMg || 0), 0) || 0;
  const totalFineMg = inv.items?.reduce((acc, it) => acc + (it.fineMg || 0), 0) || 0;
  const totalGoldValuePaise =
    inv.items?.reduce((acc, it) => acc + (it.goldValuePaise || 0), 0) || 0;
  const totalMakingChargesPaise =
    inv.items?.reduce((acc, it) => acc + (it.makingChargesPaise || 0), 0) || 0;
  const totalStoneChargesPaise =
    inv.items?.reduce((acc, it) => acc + (it.stoneChargesPaise || 0), 0) || 0;
  const totalOtherChargesPaise =
    inv.items?.reduce((acc, it) => acc + (it.otherChargesPaise || 0), 0) || 0;
  const totalDiscountPaise = inv.items?.reduce((acc, it) => acc + (it.discountPaise || 0), 0) || 0;
  const totalLineTotalPaise =
    inv.items?.reduce((acc, it) => acc + (it.lineTotalPaise || 0), 0) || 0;
  const hasOtherCharges = totalOtherChargesPaise > 0;

  // Render original, premium branded layouts
  return (
    <div className="min-h-screen bg-muted/15 flex flex-col font-sans">
      <style>{`
        @media print {
          @page {
            size: ${layoutSize === "thermal" ? "80mm auto" : layoutSize === "thermal58" ? "58mm auto" : layoutSize === "tag" ? "50mm 30mm" : "A4 portrait"};
            margin: ${isThermalOrTag ? "2mm" : "12mm 15mm 15mm 15mm"};
          }
        }
      `}</style>
      <PrintToolbar
        title={inv.gst === "gst3" ? "Tax Invoice (GST 3%)" : "Retail Invoice"}
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/billing/${inv.id}`}
        layoutSize={layoutSize}
        onLayoutSizeChange={(sz) => setLayoutSize(sz)}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        {!isThermalOrTag ? (
          /* A4/A5 Premium Original Purple & Gold Invoice design */
          <div
            className={`${layoutSize === "a4" ? "w-[210mm] min-h-[297mm] p-10" : "w-[148mm] min-h-[210mm] p-6"} mx-auto bg-white text-slate-800 border border-neutral-200 shadow-xl rounded-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0 print:rounded-none`}
            style={{ contentVisibility: "auto" }}
          >
            {/* Elegant Header Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950" />

            {/* Header section with brand identity */}
            <div className="flex justify-between items-start border-b border-neutral-200 pb-6 mb-6 mt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {firm.logoUrl ? (
                    <Logo
                      variant="png"
                      className="h-12 w-12 object-contain flex-shrink-0 rounded-xl"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-purple-950 flex items-center justify-center border border-amber-400 shrink-0 shadow-md">
                      <Sparkles className="h-6 w-6 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <h1 className="font-serif text-2xl font-black text-purple-950 tracking-tight leading-none">
                      {firm.shopName}
                    </h1>
                    <p className="text-[10px] text-amber-600 font-bold tracking-widest uppercase mt-0.5 font-mono">
                      {firm.tagline || "HANDCRAFTED LUXURY & PURE GOLD TRADITION"}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-650 space-y-1 mt-2 max-w-md">
                  <p className="leading-relaxed">
                    {firm.address || "Main Bazar Road, Near Post Office, West Bengal - 700001"}
                  </p>
                  <p className="font-mono">
                    Mob: <span className="font-semibold text-slate-850">{firm.phone || ""}</span>{" "}
                    {firm.email && `| Email: ${firm.email}`}
                  </p>
                  {firm.website && (
                    <p className="font-mono">
                      Web: <span className="font-semibold">{firm.website}</span>
                    </p>
                  )}
                  {firm.gstin && (
                    <div className="inline-block bg-purple-50 text-purple-950 font-bold font-mono text-[10px] px-2 py-0.5 rounded border border-purple-100 uppercase">
                      GSTIN: {firm.gstin}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-3">
                <div className="bg-amber-500 text-purple-950 px-4 py-1.5 rounded-lg border border-amber-400 font-bold font-serif uppercase tracking-wider text-xs shadow-sm">
                  {inv.gst === "gst3" ? "Tax Invoice (3% GST)" : "Retail Cash Memo"}
                </div>
                <div className="text-xs space-y-1 font-mono text-slate-600">
                  <div>
                    Voucher No: <span className="font-bold text-purple-950">{inv.invoiceNo}</span>
                  </div>
                  <div>
                    Date:{" "}
                    <span className="font-semibold text-slate-900">
                      {new Date(inv.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>
                  {inv.orderNo && (
                    <div>
                      Order Ref:{" "}
                      <span className="font-semibold text-purple-900">#{inv.orderNo}</span>
                    </div>
                  )}
                  {inv.jobNo && (
                    <div>
                      Job Card: <span className="font-semibold text-purple-900">#{inv.jobNo}</span>
                    </div>
                  )}
                </div>

                {/* Micro verification QR */}
                <div className="pt-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded p-1">
                  <PrintQR
                    docType={inv.gst === "gst3" ? "gst_invoice" : "retail_invoice"}
                    docNumber={docNumber}
                    recordId={inv.id}
                    createdAt={inv.createdAt}
                    size={40}
                    label="Secure Receipt"
                  />
                </div>
              </div>
            </div>

            {/* Invoice Information Blocks */}
            <div className="grid grid-cols-2 gap-6 bg-purple-50/40 rounded-xl border border-purple-100 p-4 mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 font-mono">
                  Billed To (Customer Details)
                </span>
                <div className="font-serif font-black text-purple-950 text-base mt-1">
                  {inv.customerName}
                </div>
                {inv.customerPhone && (
                  <div className="text-xs text-slate-600 font-mono mt-0.5">
                    Phone: <span className="font-medium text-slate-800">{inv.customerPhone}</span>
                  </div>
                )}
                {inv.customerGstin && (
                  <div className="text-xs text-purple-900 font-bold uppercase mt-1.5 font-mono">
                    Cust GSTIN: {inv.customerGstin}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 font-mono">
                    Security Stamp
                  </span>
                  <div className="flex items-center justify-end gap-1 text-xs text-emerald-700 font-bold mt-1">
                    <ShieldCheck className="h-4 w-4" />
                    <span>ORIGINAL TRANS-REC</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {isReprint && (
                    <span className="text-rose-600 font-bold">REPRINT RECORD ({reprintCount})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Products Table with exquisite purple accents */}
            <div className="border border-purple-100 rounded-xl overflow-hidden shadow-sm bg-white mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-purple-900 text-white uppercase font-serif text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3 text-center w-12 border-r border-purple-800">Photo</th>
                    <th className="p-3 border-r border-purple-800">Item Code &amp; Descr.</th>
                    <th className="p-3 text-center border-r border-purple-800">Purity</th>
                    <th className="p-3 text-right border-r border-purple-800">Gross</th>
                    <th className="p-3 text-right border-r border-purple-800">Net</th>
                    <th className="p-3 text-right border-r border-purple-800 text-amber-300">
                      Fine
                    </th>
                    <th className="p-3 text-right border-r border-purple-800">Rate/g</th>
                    <th className="p-3 text-right border-r border-purple-800">Gold ₹</th>
                    <th className="p-3 text-right border-r border-purple-800">Making</th>
                    <th className="p-3 text-right border-r border-purple-800">Stone</th>
                    {hasOtherCharges && (
                      <th className="p-3 text-right border-r border-purple-800">Other</th>
                    )}
                    <th className="p-3 text-right border-r border-purple-800">Disc</th>
                    <th className="p-3 text-right font-serif font-bold text-amber-300">Total ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 text-[11px] text-slate-700">
                  {inv.items.map((it) => {
                    const photoUrl = getItemPhoto(it, inv.orderId);
                    return (
                      <tr key={it.id} className="hover:bg-purple-50/20 font-sans">
                        <td className="p-2.5 text-center border-r border-purple-50">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={it.itemName}
                              className="h-10 w-10 object-cover rounded border border-neutral-200 shadow-sm mx-auto"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-slate-50 flex items-center justify-center text-slate-400 text-[10px] mx-auto border border-neutral-150 font-serif">
                              Gold
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 border-r border-purple-50">
                          <div className="font-bold text-purple-950">{it.itemName}</div>
                          {it.barcode && (
                            <div className="text-[9px] text-amber-700 font-mono font-medium">
                              Tag: {it.barcode}
                            </div>
                          )}
                          {it.huid && (
                            <div className="text-[9px] text-slate-500 font-mono font-semibold">
                              HUID: {it.huid}
                            </div>
                          )}
                          {it.stoneWeightMg && it.stoneWeightMg > 0 ? (
                            <div className="text-[9px] text-purple-900 font-mono font-semibold">
                              Stone Wt: {mgToGrams(it.stoneWeightMg)} g
                            </div>
                          ) : null}
                          {it.diamondWeightMg && it.diamondWeightMg > 0 ? (
                            <div className="text-[9px] text-purple-900 font-mono font-semibold">
                              Diamond Wt: {(it.diamondWeightMg / 200).toFixed(2)} ct
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold border-r border-purple-50">
                          {it.purity}
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          {mgToGrams(it.grossMg)}g
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          {mgToGrams(it.netMg)}g
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold border-r border-purple-50 text-amber-700">
                          {mgToGrams(it.fineMg)}g
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          ₹{paiseToRupees(it.goldRatePerGramPaise)}
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          ₹{paiseToRupees(it.goldValuePaise)}
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          ₹{paiseToRupees(it.makingChargesPaise)}
                        </td>
                        <td className="p-2.5 text-right font-mono border-r border-purple-50">
                          ₹{paiseToRupees(it.stoneChargesPaise)}
                        </td>
                        {hasOtherCharges && (
                          <td className="p-2.5 text-right font-mono border-r border-purple-50">
                            ₹{paiseToRupees(it.otherChargesPaise)}
                          </td>
                        )}
                        <td className="p-2.5 text-right font-mono text-rose-600 border-r border-purple-50">
                          -₹{paiseToRupees(it.discountPaise)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-purple-950">
                          ₹{paiseToRupees(it.lineTotalPaise)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-purple-50/50 border-t-2 border-purple-900 font-mono text-[10px] font-bold text-purple-950">
                  <tr>
                    <td
                      colSpan={3}
                      className="p-3 text-left font-serif text-[11px] font-black uppercase tracking-wider text-purple-900"
                    >
                      Totals
                    </td>
                    <td className="p-3 text-right">{mgToGrams(totalGrossMg)}g</td>
                    <td className="p-3 text-right">{mgToGrams(totalNetMg)}g</td>
                    <td className="p-3 text-right font-semibold text-amber-700">
                      {mgToGrams(totalFineMg)}g
                    </td>
                    <td className="p-3 text-right text-slate-400 font-normal">—</td>
                    <td className="p-3 text-right">₹{paiseToRupees(totalGoldValuePaise)}</td>
                    <td className="p-3 text-right">₹{paiseToRupees(totalMakingChargesPaise)}</td>
                    <td className="p-3 text-right font-semibold">
                      ₹{paiseToRupees(totalStoneChargesPaise)}
                    </td>
                    {hasOtherCharges && (
                      <td className="p-3 text-right font-semibold">
                        ₹{paiseToRupees(totalOtherChargesPaise)}
                      </td>
                    )}
                    <td className="p-3 text-right text-rose-600">
                      -₹{paiseToRupees(totalDiscountPaise)}
                    </td>
                    <td className="p-3 text-right font-black text-amber-700 text-xs bg-amber-500/10">
                      ₹{paiseToRupees(totalLineTotalPaise)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Calculations, adjustments & mixed payment details side-by-side */}
            <div className="grid grid-cols-2 gap-6 items-start mt-4">
              {/* Payment Summary Panel */}
              <div className="space-y-4">
                {inv.payments.length > 0 && (
                  <div className="border border-purple-100 rounded-xl bg-purple-50/10 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950 border-b border-purple-100 pb-2 mb-2 flex items-center gap-1.5 font-mono">
                      <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                      Mixed Payment Summary
                    </h3>
                    <ul className="text-xs space-y-1.5 font-mono text-slate-700">
                      {inv.payments.map((p) => (
                        <li
                          key={p.id}
                          className="flex justify-between items-center border-b border-neutral-100 pb-1 last:border-0 last:pb-0"
                        >
                          <span className="font-semibold text-slate-600">
                            {PAYMENT_MODE_LABELS[p.mode]}
                            {p.reference ? ` [${p.reference}]` : ""}:
                          </span>
                          <span className="font-bold text-slate-900">
                            ₹{paiseToRupees(p.amountPaise)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Ledger & Advance Adjustments */}
                {inv.orderAdjustment && (
                  <div className="border border-purple-100 rounded-xl bg-amber-500/5 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 border-b border-amber-200/50 pb-2 mb-2 font-mono">
                      Applied Advance &amp; Old Gold
                    </h3>
                    <div className="text-xs space-y-1.5 font-mono text-slate-700">
                      {inv.orderAdjustment.cashAdvancePaise > 0 && (
                        <div className="flex justify-between">
                          <span>Order Cash Advance:</span>
                          <span className="font-bold text-slate-900">
                            -₹{paiseToRupees(inv.orderAdjustment.cashAdvancePaise)}
                          </span>
                        </div>
                      )}
                      {inv.orderAdjustment.goldValuePaise > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Old Gold Exchange ({mgToGrams(inv.orderAdjustment.goldGrossMg)}g):
                          </span>
                          <span className="font-bold text-slate-900">
                            -₹{paiseToRupees(inv.orderAdjustment.goldValuePaise)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* High-fidelity tax calculations panel */}
              <div className="border border-purple-100 rounded-xl bg-purple-950 text-white p-5 space-y-2 font-mono text-xs shadow-md">
                <div className="flex justify-between text-purple-200">
                  <span>Gold Value Amount:</span>
                  <span>₹{paiseToRupees(totalGoldValuePaise)}</span>
                </div>
                <div className="flex justify-between text-purple-200">
                  <span>Labour / Making:</span>
                  <span>₹{paiseToRupees(totalMakingChargesPaise)}</span>
                </div>
                {totalStoneChargesPaise > 0 && (
                  <div className="flex justify-between text-purple-200">
                    <span>Stone Valuation:</span>
                    <span>₹{paiseToRupees(totalStoneChargesPaise)}</span>
                  </div>
                )}
                {totalDiscountPaise > 0 && (
                  <div className="flex justify-between text-rose-300">
                    <span>Discount Reduction:</span>
                    <span>-₹{paiseToRupees(totalDiscountPaise)}</span>
                  </div>
                )}
                <div className="border-t border-purple-800 my-1 pt-1.5 flex justify-between text-purple-100">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{paiseToRupees(inv.subtotalPaise)}</span>
                </div>

                {inv.gst === "gst3" ? (
                  <>
                    <div className="flex justify-between text-purple-300 text-[11px]">
                      <span>CGST (1.5%):</span>
                      <span>₹{paiseToRupees(inv.cgstPaise)}</span>
                    </div>
                    <div className="flex justify-between text-purple-300 text-[11px]">
                      <span>SGST (1.5%):</span>
                      <span>₹{paiseToRupees(inv.sgstPaise)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-400 italic text-[11px]">
                    <span>GST Allocation:</span>
                    <span>Composition Exempt</span>
                  </div>
                )}

                {inv.adjustmentPaise > 0 && (
                  <div className="flex justify-between text-rose-300">
                    <span>Applied Reductions:</span>
                    <span>-₹{paiseToRupees(inv.adjustmentPaise)}</span>
                  </div>
                )}

                <div className="border-t-2 border-amber-400/80 pt-2 flex justify-between text-white font-black text-sm">
                  <span className="font-serif uppercase text-amber-300 text-xs">
                    Grand Net Amount:
                  </span>
                  <span className="text-amber-300">₹{paiseToRupees(inv.grandTotalPaise)}</span>
                </div>

                <div className="flex justify-between text-emerald-400 font-semibold pt-1">
                  <span>Total Amount Received:</span>
                  <span>₹{paiseToRupees(inv.paidPaise)}</span>
                </div>

                <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-dashed border-purple-800">
                  <span>Balance Outstanding:</span>
                  <span>₹{paiseToRupees(inv.balancePaise)}</span>
                </div>
              </div>
            </div>

            {/* Amount in words & T&C and signature layout footer */}
            <div className="mt-8 border-t border-neutral-200 pt-4 text-xs">
              <div className="font-mono bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-150 mb-6 text-slate-700">
                <span className="font-semibold text-slate-500 uppercase text-[10px]">
                  Amount in words:
                </span>{" "}
                <strong className="text-purple-950">{rupeesToWords(inv.grandTotalPaise)}</strong>
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-6 items-start mt-6">
                {/* Custom T&C */}
                <div className="text-[10px] text-slate-500 leading-relaxed space-y-1 pr-4 border-r border-neutral-200">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[9px] font-serif">
                    Terms &amp; Conditions
                  </h4>
                  <p>
                    1. Handcrafted jewelry weights and fine purity certified under BIS standards.
                  </p>
                  <p>
                    2. Subject to local jurisdiction of West Bengal courts. Goods once sold are not
                    returnable.
                  </p>
                  <p>3. Authentic valuation matches the current market gold index dynamically.</p>
                </div>

                {/* Secure original signatures */}
                <div className="grid grid-cols-2 gap-8 text-center text-slate-600 font-mono text-[10px] pt-4">
                  <div className="flex flex-col justify-end min-h-[60px]">
                    <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800 uppercase tracking-wide">
                      {firm.signatureLabelLeft || "Customer Signature"}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">({inv.customerName})</p>
                  </div>
                  <div className="flex flex-col justify-end min-h-[60px]">
                    {/* Simulated Authorized Stamp/Signature */}
                    <div className="mx-auto mb-2 font-serif text-[11px] text-purple-950 font-black tracking-widest border border-purple-950/30 px-2.5 py-0.5 rounded opacity-60 transform -rotate-2">
                      {firm.shopName}
                    </div>
                    <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800 uppercase tracking-wide">
                      {firm.signatureLabelRight || "Authorized Signatory"}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      ({firm.ownerName || "Authorised Signatory"})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : isTag ? (
          /* Jewellery Price Tag Layout (50mm × 30mm per item) */
          <div className="flex flex-col gap-3 mx-auto items-center">
            {inv.items.map((it) => (
              <div
                key={it.id}
                className="w-[50mm] min-h-[30mm] bg-white border border-neutral-300 rounded shadow-md p-1.5 print:border print:shadow-none font-mono text-[7px] leading-tight relative overflow-hidden"
                style={{ contentVisibility: "auto" }}
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950" />
                <div className="text-center font-serif text-[8px] font-black text-purple-950 uppercase tracking-tight mt-0.5">
                  {firm.shopName || "MTJ"}
                </div>
                <div className="border-t border-dashed border-slate-300 my-0.5" />
                <div className="font-bold text-[8px] text-slate-900 leading-tight truncate">
                  {it.itemName}
                </div>
                <div className="flex justify-between mt-0.5 text-slate-600">
                  <span>GW: {mgToGrams(it.grossMg)}g</span>
                  <span>NW: {mgToGrams(it.netMg)}g</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pty: {it.purity}</span>
                  {it.huid && <span className="font-mono text-[6px]">HUID: {it.huid}</span>}
                </div>
                {it.barcode && (
                  <div className="text-[6px] text-amber-700 font-mono">Tag: {it.barcode}</div>
                )}
                <div className="border-t border-dashed border-slate-300 my-0.5" />
                <div className="flex justify-between font-black text-[9px] text-purple-950">
                  <span>{inv.invoiceNo}</span>
                  <span>₹{paiseToRupees(it.lineTotalPaise)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* High-Fidelity Original Thermal Slip Designs (Configurable for 80mm and 58mm) */
          <div
            className={`${layoutSize === "thermal58" ? "w-[58mm] p-2" : "w-[80mm] p-4"} mx-auto bg-white text-slate-900 border border-neutral-200 shadow-lg rounded-xl print:border-none print:shadow-none print:p-0 print:rounded-none font-mono text-[10px] leading-snug space-y-4`}
            style={{ contentVisibility: "auto" }}
          >
            {/* Compressed Thermal Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-300">
              <h2 className="font-serif text-sm font-black tracking-tight uppercase text-purple-950">
                {firm.shopName}
              </h2>
              <p className="text-[8px] font-serif uppercase tracking-widest text-slate-600">
                {firm.tagline || "HANDCRAFTED PURE GOLD"}
              </p>
              <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">
                {firm.address ? firm.address.slice(0, 48) + "..." : "West Bengal, India"}
              </p>
              <p className="text-[8px] font-semibold text-slate-600 mt-0.5">
                Mob: {firm.phone || ""}
              </p>
              {firm.gstin && (
                <p className="text-[8px] font-bold text-slate-700 uppercase mt-0.5">
                  GST: {firm.gstin}
                </p>
              )}
            </div>

            {/* Ticket info */}
            <div className="space-y-0.5 text-[9px] border-b border-dotted border-slate-200 pb-2">
              <div className="flex justify-between">
                <span>Voucher:</span>
                <span className="font-bold">{inv.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(inv.createdAt).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span>Cust Name:</span>
                <span className="font-bold">{inv.customerName}</span>
              </div>
              {inv.customerPhone && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{inv.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Thermal compact line items list */}
            <div>
              <div className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                TRANS-ITEMS DETAILS
              </div>
              <div className="space-y-1.5 divide-y divide-dotted divide-slate-200">
                {inv.items.map((it) => (
                  <div key={it.id} className="pt-1.5 first:pt-0">
                    <div className="flex justify-between font-bold">
                      <span>{it.itemName?.slice(0, 22)}</span>
                      <span>₹{paiseToRupees(it.lineTotalPaise)}</span>
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 font-sans">
                      <span>
                        GW: {mgToGrams(it.grossMg)}g | NW: {mgToGrams(it.netMg)}g | {it.purity}
                      </span>
                      <span>HUID: {it.huid || "—"}</span>
                    </div>
                    {it.stoneWeightMg || it.diamondWeightMg ? (
                      <div className="text-[7px] text-slate-500 font-mono">
                        {it.stoneWeightMg ? `Stone: ${mgToGrams(it.stoneWeightMg)}g ` : ""}
                        {it.diamondWeightMg
                          ? `Diamond: ${(it.diamondWeightMg / 200).toFixed(2)}ct`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Mixed payment totals block */}
            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Gross Metal Value:</span>
                <span>₹{paiseToRupees(totalGoldValuePaise)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Labour / Making:</span>
                <span>₹{paiseToRupees(totalMakingChargesPaise)}</span>
              </div>
              {totalStoneChargesPaise > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Stone Valuation:</span>
                  <span>₹{paiseToRupees(totalStoneChargesPaise)}</span>
                </div>
              )}
              {totalOtherChargesPaise > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Other Charges:</span>
                  <span>₹{paiseToRupees(totalOtherChargesPaise)}</span>
                </div>
              )}
              {inv.gst === "gst3" && (
                <div className="flex justify-between text-slate-600">
                  <span>GST Allocation (3%):</span>
                  <span>₹{paiseToRupees(inv.cgstPaise + inv.sgstPaise)}</span>
                </div>
              )}
              {totalDiscountPaise > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Discount Reduction:</span>
                  <span>-₹{paiseToRupees(totalDiscountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-[11px] pt-1.5 border-t border-dotted border-slate-200 text-purple-950">
                <span>GRAND TOTAL:</span>
                <span>₹{paiseToRupees(inv.grandTotalPaise)}</span>
              </div>

              {inv.payments.length > 0 && (
                <div className="pt-1.5 border-t border-dotted border-slate-200 space-y-1 text-[8px]">
                  <div className="font-bold text-slate-500 uppercase">PAYMENTS:</div>
                  {inv.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-slate-600 font-sans">
                      <span>
                        {PAYMENT_MODE_LABELS[p.mode]} {p.reference ? `(${p.reference})` : ""}:
                      </span>
                      <span className="font-bold">₹{paiseToRupees(p.amountPaise)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-bold text-slate-700 pt-1 border-t border-dotted border-slate-200">
                <span>Amount Paid:</span>
                <span>₹{paiseToRupees(inv.paidPaise)}</span>
              </div>

              <div className="flex justify-between font-bold text-rose-700">
                <span>OUTSTANDING DUE:</span>
                <span>₹{paiseToRupees(inv.balancePaise)}</span>
              </div>
            </div>

            {/* Custom thermal QR Code verification */}
            <div className="flex flex-col items-center justify-center pt-1 text-center space-y-1.5">
              <PrintQR
                docType={inv.gst === "gst3" ? "gst_invoice" : "retail_invoice"}
                docNumber={docNumber}
                recordId={inv.id}
                createdAt={inv.createdAt}
                size={48}
                label="Scan to Verify Authentic Receipt"
              />
            </div>

            {/* Signature spaces */}
            <div className="grid grid-cols-2 gap-4 text-center text-[8px] pt-4 border-t border-dashed border-slate-300">
              <div>
                <div className="border-t border-dotted border-slate-400 pt-1 font-bold">
                  CUSTOMER SIGN
                </div>
              </div>
              <div>
                <div className="border-t border-dotted border-slate-400 pt-1 font-bold">
                  AUTH SIGNATORY
                </div>
              </div>
            </div>

            <div className="text-center text-[7px] text-slate-400 pt-1 uppercase">
              Handcrafted with Pure Quality · MTJ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

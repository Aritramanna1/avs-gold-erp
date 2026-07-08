import React from "react";
import { Sparkles, QrCode, CreditCard, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import {
  paiseToRupees,
  type InvoiceItem,
  type PaymentRecord,
  PAYMENT_MODE_LABELS,
} from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";

export interface InvoicePrintTemplateProps {
  invoice: {
    id?: string;
    invoiceNo: string;
    createdAt: string | Date | number;
    customerName: string;
    customerPhone?: string;
    customerGstin?: string;
    gst: "gst3" | "exempt" | "gst0" | string;
    items: InvoiceItem[];
    payments: PaymentRecord[];
    orderNo?: string;
    jobNo?: string;
    subtotalPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    grandTotalPaise: number;
    paidPaise: number;
    balancePaise: number;
    adjustmentPaise?: number;
    orderAdjustment?: {
      cashAdvancePaise: number;
      goldGrossMg: number;
      goldValuePaise: number;
    } | null;
  };
  layoutSize?: "a4" | "a5";
  isReprint?: boolean;
  reprintCount?: number;
}

// Convert numbers/rupees to words
export function rupeesToWords(totalPaise: number): string {
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

export const InvoicePrintTemplate: React.FC<InvoicePrintTemplateProps> = ({
  invoice,
  layoutSize = "a4",
  isReprint = false,
  reprintCount = 0,
}) => {
  const { firm } = useSettings();

  // Aggregate stats
  const totalGrossMg = invoice.items?.reduce((acc, it) => acc + (it.grossMg || 0), 0) || 0;
  const totalNetMg = invoice.items?.reduce((acc, it) => acc + (it.netMg || 0), 0) || 0;
  const totalGoldValuePaise =
    invoice.items?.reduce((acc, it) => acc + (it.goldValuePaise || 0), 0) || 0;
  const totalMakingChargesPaise =
    invoice.items?.reduce((acc, it) => acc + (it.makingChargesPaise || 0), 0) || 0;
  const totalStoneChargesPaise =
    invoice.items?.reduce((acc, it) => acc + (it.stoneChargesPaise || 0), 0) || 0;
  const totalDiscountPaise =
    invoice.items?.reduce((acc, it) => acc + (it.discountPaise || 0), 0) || 0;
  const totalLineTotalPaise =
    invoice.items?.reduce((acc, it) => acc + (it.lineTotalPaise || 0), 0) || 0;

  return (
    <div
      className={`${
        layoutSize === "a4" ? "w-[210mm] min-h-[297mm] p-10" : "w-[148mm] min-h-[210mm] p-6"
      } mx-auto bg-white text-slate-800 border border-neutral-200 shadow-xl rounded-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0 print:rounded-none`}
    >
      {/* Top Banner Accent with elegant Royal Purple and Gold gradients */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950" />

      {/* Branded Header Area */}
      <div className="flex justify-between items-start border-b border-neutral-200 pb-6 mb-6 mt-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {firm.logoUrl ? (
              <Logo variant="png" className="h-12 w-12 object-contain flex-shrink-0 rounded-xl" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-purple-950 flex items-center justify-center border border-amber-400 shrink-0 shadow-md">
                <Sparkles className="h-6 w-6 text-amber-400" />
              </div>
            )}
            <div>
              <h1 className="font-serif text-2xl font-black text-purple-950 tracking-tight leading-none">
                {firm.shopName || "MAA TARA JEWELLERS"}
              </h1>
              <p className="text-[10px] text-amber-600 font-bold tracking-widest uppercase mt-0.5 font-mono">
                {firm.tagline || "HANDCRAFTED LUXURY & PURE GOLD TRADITION"}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1 mt-2 max-w-md">
            <p className="leading-relaxed">
              {firm.address || "Main Bazar Road, Near Post Office, West Bengal - 700001"}
            </p>
            <p className="font-mono">
              Mob: <span className="font-semibold text-slate-800">{firm.phone || ""}</span>
              {firm.email && ` | Email: ${firm.email}`}
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

        {/* Invoice Metadata (Right Side) */}
        <div className="text-right flex flex-col items-end gap-3">
          <div className="bg-amber-500 text-purple-950 px-4 py-1.5 rounded-lg border border-amber-400 font-bold font-serif uppercase tracking-wider text-xs shadow-sm">
            {invoice.gst === "gst3" ? "Tax Invoice (3% GST)" : "Retail Cash Memo"}
          </div>
          <div className="text-xs space-y-1 font-mono text-slate-600">
            <div>
              Voucher No: <span className="font-bold text-purple-950">{invoice.invoiceNo}</span>
            </div>
            <div>
              Date:{" "}
              <span className="font-semibold text-slate-900">
                {new Date(invoice.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            </div>
            {invoice.orderNo && (
              <div>
                Order Ref: <span className="font-semibold text-purple-900">#{invoice.orderNo}</span>
              </div>
            )}
            {invoice.jobNo && (
              <div>
                Job Card: <span className="font-semibold text-purple-900">#{invoice.jobNo}</span>
              </div>
            )}
          </div>

          {/* Secure Verification Stamp */}
          <div className="pt-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded p-1">
            <QrCode className="h-8 w-8 text-purple-950 shrink-0" />
            <div className="text-left font-mono text-[8px] leading-tight text-slate-500">
              <div>Scan to Verify</div>
              <div className="font-bold text-slate-700">Secure Receipt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Billed To / Security Stamp Header Block */}
      <div className="grid grid-cols-2 gap-6 bg-purple-50/40 rounded-xl border border-purple-100 p-4 mb-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 font-mono">
            Billed To (Customer Details)
          </span>
          <div className="font-serif font-black text-purple-950 text-base mt-1">
            {invoice.customerName}
          </div>
          {invoice.customerPhone && (
            <div className="text-xs text-slate-600 font-mono mt-0.5">
              Phone: <span className="font-medium text-slate-800">{invoice.customerPhone}</span>
            </div>
          )}
          {invoice.customerGstin && (
            <div className="text-xs text-purple-900 font-bold uppercase mt-1.5 font-mono">
              Cust GSTIN: {invoice.customerGstin}
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

      {/* Items List Table with Royal Purple Accents */}
      <div className="border border-purple-100 rounded-xl overflow-hidden shadow-sm bg-white mb-6">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-purple-900 text-white uppercase font-serif text-[9px] tracking-wider">
            <tr>
              <th className="p-3 border-r border-purple-800">Item Name &amp; Details</th>
              <th className="p-3 text-center border-r border-purple-800">Purity</th>
              <th className="p-3 text-right border-r border-purple-800">Gross Wt</th>
              <th className="p-3 text-right border-r border-purple-800">Net Wt</th>
              <th className="p-3 text-right border-r border-purple-800">Rate/g</th>
              <th className="p-3 text-right border-r border-purple-800">Gold Value</th>
              <th className="p-3 text-right border-r border-purple-800">Making Charges</th>
              <th className="p-3 text-right border-r border-purple-800">Stone Charges</th>
              <th className="p-3 text-right border-r border-purple-800">Discount</th>
              <th className="p-3 text-right font-serif font-bold text-amber-300">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-100 text-[11px] text-slate-700">
            {invoice.items?.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-purple-50/20 font-sans">
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
                <td className="p-2.5 text-right font-mono text-rose-600 border-r border-purple-50">
                  -₹{paiseToRupees(it.discountPaise)}
                </td>
                <td className="p-2.5 text-right font-mono font-black text-purple-950">
                  ₹{paiseToRupees(it.lineTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-purple-50/50 border-t-2 border-purple-900 font-mono text-[10px] font-bold text-purple-950">
            <tr>
              <td className="p-3 text-left font-serif text-[11px] font-black uppercase tracking-wider text-purple-900 border-r border-purple-50">
                Totals
              </td>
              <td className="p-3 text-right border-r border-purple-50 text-slate-400 font-normal">
                —
              </td>
              <td className="p-3 text-right border-r border-purple-50">
                {mgToGrams(totalGrossMg)}g
              </td>
              <td className="p-3 text-right border-r border-purple-50">{mgToGrams(totalNetMg)}g</td>
              <td className="p-3 text-right border-r border-purple-50 text-slate-400 font-normal">
                —
              </td>
              <td className="p-3 text-right border-r border-purple-50">
                ₹{paiseToRupees(totalGoldValuePaise)}
              </td>
              <td className="p-3 text-right border-r border-purple-50">
                ₹{paiseToRupees(totalMakingChargesPaise)}
              </td>
              <td className="p-3 text-right border-r border-purple-50">
                ₹{paiseToRupees(totalStoneChargesPaise)}
              </td>
              <td className="p-3 text-right border-r border-purple-50 text-rose-600">
                -₹{paiseToRupees(totalDiscountPaise)}
              </td>
              <td className="p-3 text-right font-black text-amber-750 text-xs bg-amber-500/10">
                ₹{paiseToRupees(totalLineTotalPaise)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detailed calculations, adjustments & payments */}
      <div className="grid grid-cols-2 gap-6 items-start mt-4">
        {/* Payments, Adjustments and Ledger Updates summaries */}
        <div className="space-y-4">
          {invoice.payments?.length > 0 && (
            <div className="border border-purple-100 rounded-xl bg-purple-50/10 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-950 border-b border-purple-100 pb-2 mb-2 flex items-center gap-1.5 font-mono">
                <CreditCard className="h-3.5 w-3.5 text-amber-600" />
                Payments Summary
              </h3>
              <ul className="text-xs space-y-1.5 font-mono text-slate-700">
                {invoice.payments.map((p, idx) => (
                  <li
                    key={p.id || idx}
                    className="flex justify-between items-center border-b border-neutral-100 pb-1 last:border-0 last:pb-0"
                  >
                    <span className="font-semibold text-slate-600 animate-none">
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

          {/* Applied Advance & Old Gold summary */}
          {invoice.orderAdjustment && (
            <div className="border border-purple-100 rounded-xl bg-amber-500/5 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 border-b border-amber-200/50 pb-2 mb-2 font-mono">
                Applied Adjustments &amp; Advances
              </h3>
              <div className="text-xs space-y-1.5 font-mono text-slate-700">
                {invoice.orderAdjustment.cashAdvancePaise > 0 && (
                  <div className="flex justify-between">
                    <span>Order Cash Advance:</span>
                    <span className="font-bold text-slate-950">
                      -₹{paiseToRupees(invoice.orderAdjustment.cashAdvancePaise)}
                    </span>
                  </div>
                )}
                {invoice.orderAdjustment.goldValuePaise > 0 && (
                  <div className="flex justify-between">
                    <span>Old Gold Value ({mgToGrams(invoice.orderAdjustment.goldGrossMg)}g):</span>
                    <span className="font-bold text-slate-950">
                      -₹{paiseToRupees(invoice.orderAdjustment.goldValuePaise)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Financial calculation panel (right-side) */}
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
            <span className="font-semibold">₹{paiseToRupees(invoice.subtotalPaise)}</span>
          </div>

          {invoice.gst === "gst3" ? (
            <>
              <div className="flex justify-between text-purple-300 text-[11px]">
                <span>CGST (1.5%):</span>
                <span>₹{paiseToRupees(invoice.cgstPaise)}</span>
              </div>
              <div className="flex justify-between text-purple-300 text-[11px]">
                <span>SGST (1.5%):</span>
                <span>₹{paiseToRupees(invoice.sgstPaise)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-slate-400 italic text-[11px]">
              <span>GST Allocation:</span>
              <span>Composition Exempt</span>
            </div>
          )}

          {invoice.adjustmentPaise && invoice.adjustmentPaise > 0 ? (
            <div className="flex justify-between text-rose-300">
              <span>Applied Reductions:</span>
              <span>-₹{paiseToRupees(invoice.adjustmentPaise)}</span>
            </div>
          ) : null}

          <div className="border-t-2 border-amber-400/80 pt-2 flex justify-between text-white font-black text-sm">
            <span className="font-serif uppercase text-amber-300 text-xs">Grand Net Amount:</span>
            <span className="text-amber-300">₹{paiseToRupees(invoice.grandTotalPaise)}</span>
          </div>

          <div className="flex justify-between text-emerald-400 font-semibold pt-1">
            <span>Total Amount Received:</span>
            <span>₹{paiseToRupees(invoice.paidPaise)}</span>
          </div>

          <div className="flex justify-between text-rose-400 font-bold pt-1 border-t border-dashed border-purple-800">
            <span>Balance Outstanding:</span>
            <span>₹{paiseToRupees(invoice.balancePaise)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words, Terms and Conditions, and Authorized Signatures */}
      <div className="mt-8 border-t border-neutral-200 pt-4 text-xs">
        <div className="font-mono bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-150 mb-6 text-slate-700">
          <span className="font-semibold text-slate-500 uppercase text-[10px]">
            Amount in words:
          </span>{" "}
          <strong className="text-purple-950">{rupeesToWords(invoice.grandTotalPaise)}</strong>
        </div>

        <div className="grid grid-cols-[1fr_2fr] gap-6 items-start mt-6">
          {/* Terms & Conditions */}
          <div className="text-[10px] text-slate-500 leading-relaxed space-y-1 pr-4 border-r border-neutral-200">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[9px] font-serif">
              Terms &amp; Conditions
            </h4>
            <p>1. Handcrafted jewelry weights and fine purity certified under BIS standards.</p>
            <p>
              2. Subject to local jurisdiction of West Bengal courts. Goods once sold are not
              returnable.
            </p>
            <p>3. Authentic valuation matches the current market gold index dynamically.</p>
          </div>

          {/* Signature fields */}
          <div className="grid grid-cols-2 gap-8 text-center text-slate-600 font-mono text-[10px] pt-4">
            <div className="flex flex-col justify-end min-h-[60px]">
              <div className="border-t border-slate-400 pt-1.5 font-semibold text-slate-800 uppercase tracking-wide">
                {firm.signatureLabelLeft || "Customer Signature"}
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5">({invoice.customerName})</p>
            </div>
            <div className="flex flex-col justify-end min-h-[60px]">
              <div className="mx-auto mb-2 font-serif text-[11px] text-purple-950 font-black tracking-widest border border-purple-950/30 px-2.5 py-0.5 rounded opacity-60 transform -rotate-2">
                {firm.shopName || "MAA TARA JEWELLERS"}
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
  );
};

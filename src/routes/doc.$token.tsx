/**
 * Public Customer Document Portal — /doc/:token
 *
 * Fully public (no ERP login). Renders a snapshot of a shared document
 * (Invoice, Order, Repair Slip, Manufacturing Bill) with View / Download PDF / Print.
 *
 * The snapshot was captured at share time and is stored in Supabase `document_shares`.
 * Customers can open this on any mobile browser without an ERP account.
 */

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDocumentShare, type DocumentShare } from "@/lib/document-shares";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/doc/$token")({
  component: DocumentPortal,
});

// ── Formatting helpers ────────────────────────────────────────────────────────

function rs(paise: number) {
  return "₹" + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function grams(mg: number) {
  return (mg / 1000).toFixed(3) + "g";
}

function fmtDate(val: string | number | Date) {
  try {
    return new Date(val).toLocaleDateString("en-IN", { dateStyle: "medium" });
  } catch {
    return String(val);
  }
}

// ── Loading / error screens ───────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-700 border-t-transparent" />
      <p className="mt-4 text-sm text-gray-500">Loading document…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="h-12 w-12 rounded-full border-2 border-red-200 bg-red-50 flex items-center justify-center mx-auto">
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-800">Document not available</h2>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

// ── Invoice renderer ──────────────────────────────────────────────────────────

function InvoiceView({ doc, firm }: { doc: any; firm: any }) {
  const items: any[] = doc.items ?? [];
  const payments: any[] = doc.payments ?? [];
  const hasGst = doc.gst === "gst3";

  return (
    <div className="space-y-4">
      {/* Bill-to */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
          Billed To
        </div>
        <div className="mt-1 text-base font-bold text-purple-950">{doc.customerName}</div>
        {doc.customerPhone && (
          <div className="text-sm text-gray-600">Phone: {doc.customerPhone}</div>
        )}
        {doc.customerGstin && (
          <div className="text-xs font-mono text-purple-800">GSTIN: {doc.customerGstin}</div>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-xl border border-purple-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-purple-900 text-white">
            <tr>
              <th className="p-2.5">Item</th>
              <th className="p-2.5 text-right">Purity</th>
              <th className="p-2.5 text-right">Gross</th>
              <th className="p-2.5 text-right">Net</th>
              <th className="p-2.5 text-right">Making</th>
              <th className="p-2.5 text-right font-bold text-amber-300">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-50">
            {items.map((it, i) => (
              <tr key={i} className="bg-white">
                <td className="p-2.5">
                  <div className="font-semibold text-purple-950">{it.itemName}</div>
                  {it.huid && (
                    <div className="font-mono text-[9px] text-gray-400">HUID: {it.huid}</div>
                  )}
                  {it.barcode && (
                    <div className="font-mono text-[9px] text-amber-600">Tag: {it.barcode}</div>
                  )}
                </td>
                <td className="p-2.5 text-right font-mono">{it.purity}</td>
                <td className="p-2.5 text-right font-mono">{grams(it.grossMg)}</td>
                <td className="p-2.5 text-right font-mono">{grams(it.netMg)}</td>
                <td className="p-2.5 text-right font-mono">{rs(it.makingChargesPaise)}</td>
                <td className="p-2.5 text-right font-mono font-bold text-purple-950">
                  {rs(it.lineTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-purple-950 p-4 text-white text-sm space-y-1.5 font-mono">
        <div className="flex justify-between text-purple-200">
          <span>Subtotal</span>
          <span>{rs(doc.subtotalPaise)}</span>
        </div>
        {hasGst && (
          <>
            <div className="flex justify-between text-purple-300 text-xs">
              <span>CGST (1.5%)</span>
              <span>{rs(doc.cgstPaise)}</span>
            </div>
            <div className="flex justify-between text-purple-300 text-xs">
              <span>SGST (1.5%)</span>
              <span>{rs(doc.sgstPaise)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between border-t border-amber-400/60 pt-2 text-base font-bold text-amber-300">
          <span>Grand Total</span>
          <span>{rs(doc.grandTotalPaise)}</span>
        </div>
        <div className="flex justify-between text-emerald-400">
          <span>Amount Paid</span>
          <span>{rs(doc.paidPaise)}</span>
        </div>
        <div className="flex justify-between text-rose-300 font-bold">
          <span>Balance Due</span>
          <span>{rs(doc.balancePaise)}</span>
        </div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            Payment Methods
          </div>
          <div className="space-y-1">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{p.mode?.toUpperCase()}</span>
                <span className="font-mono font-semibold">{rs(p.amountPaise)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Order renderer ────────────────────────────────────────────────────────────

function OrderView({ doc }: { doc: any }) {
  const items: any[] = doc.items ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Customer</div>
          <div className="font-bold text-purple-950">{doc.customerName}</div>
          {doc.customerPhone && <div className="text-gray-600">{doc.customerPhone}</div>}
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Delivery</div>
          <div className="font-mono text-purple-950">
            {doc.deliveryDate ? fmtDate(doc.deliveryDate) : "—"}
          </div>
          <div className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 uppercase">
            {doc.status ?? "pending"}
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-purple-100">
          <table className="w-full text-xs">
            <thead className="bg-purple-900 text-white">
              <tr>
                <th className="p-2.5 text-left">Item</th>
                <th className="p-2.5 text-right">Purity</th>
                <th className="p-2.5 text-right">Gross</th>
                <th className="p-2.5 text-right">Making</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {items.map((it, i) => (
                <tr key={i} className="bg-white">
                  <td className="p-2.5 font-semibold">{it.itemName}</td>
                  <td className="p-2.5 text-right font-mono">{it.purity ?? "—"}</td>
                  <td className="p-2.5 text-right font-mono">{grams(it.grossMg ?? 0)}</td>
                  <td className="p-2.5 text-right font-mono">{rs(it.makingChargesPaise ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc.cashAdvancePaise > 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex justify-between text-sm">
          <span className="text-emerald-700 font-semibold">Cash Advance Paid</span>
          <span className="font-mono font-bold text-emerald-900">{rs(doc.cashAdvancePaise)}</span>
        </div>
      )}
    </div>
  );
}

// ── Repair renderer ───────────────────────────────────────────────────────────

function RepairView({ doc }: { doc: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase text-purple-700">Customer</div>
            <div className="font-bold text-purple-950">{doc.customerName}</div>
            {doc.customerPhone && <div className="text-gray-600">{doc.customerPhone}</div>}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-purple-700">Est. Delivery</div>
            <div className="font-mono text-purple-950">
              {doc.estimatedDelivery ? fmtDate(doc.estimatedDelivery) : "—"}
            </div>
          </div>
        </div>
        {doc.description && (
          <div>
            <div className="text-[11px] font-bold uppercase text-gray-500">Work Description</div>
            <div className="mt-0.5 text-gray-700">{doc.description}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-purple-950 p-4 text-white font-mono text-sm space-y-1.5">
        <div className="flex justify-between text-purple-200">
          <span>Repair Charges</span>
          <span>{rs(doc.repairChargesPaise ?? 0)}</span>
        </div>
        <div className="flex justify-between text-emerald-400">
          <span>Advance Paid</span>
          <span>{rs(doc.advancePaise ?? 0)}</span>
        </div>
        <div className="flex justify-between border-t border-amber-400/60 pt-2 font-bold text-amber-300">
          <span>Balance Due</span>
          <span>{rs((doc.repairChargesPaise ?? 0) - (doc.advancePaise ?? 0))}</span>
        </div>
      </div>
    </div>
  );
}

// ── Manufacturing Bill renderer ───────────────────────────────────────────────

function MfgBillView({ doc }: { doc: any }) {
  const items: any[] = doc.items ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Karigar / Worker</div>
          <div className="font-bold text-purple-950">
            {doc.karigarName ?? doc.workerName ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Gold Issued</div>
          <div className="font-mono text-purple-950">{grams(doc.goldIssuedMg ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Gold Received</div>
          <div className="font-mono text-purple-950">{grams(doc.goldReceivedMg ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-purple-700">Wastage</div>
          <div className="font-mono text-rose-600">{grams(doc.wastageMg ?? 0)}</div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-purple-100">
          <table className="w-full text-xs">
            <thead className="bg-purple-900 text-white">
              <tr>
                <th className="p-2.5 text-left">Item</th>
                <th className="p-2.5 text-right">Qty</th>
                <th className="p-2.5 text-right">Net Wt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {items.map((it, i) => (
                <tr key={i} className="bg-white">
                  <td className="p-2.5 font-semibold">{it.itemName}</td>
                  <td className="p-2.5 text-right font-mono">{it.quantity ?? 1}</td>
                  <td className="p-2.5 text-right font-mono">{grams(it.netMg ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main portal component ─────────────────────────────────────────────────────

function DocumentPortal() {
  const { token } = useParams({ from: "/doc/$token" });
  const [share, setShare] = useState<DocumentShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    getDocumentShare(token)
      .then((s) => {
        if (!s) setError("This link has expired or is not valid.");
        else setShare(s);
      })
      .catch(() => setError("Unable to load the document. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spinner />;
  if (error || !share) return <ErrorScreen message={error ?? "Document not found."} />;

  const firm = share.firm_snapshot;
  const doc = share.document_snapshot;
  const docType = share.document_type;

  const docTypeLabels: Record<string, string> = {
    invoice: doc.gst === "gst3" ? "Tax Invoice (GST 3%)" : "Retail Invoice",
    estimate: "Estimate / Quotation",
    order: "Work Order",
    repair: "Repair Job Card",
    job: "Manufacturing Bill",
  };
  const label = docTypeLabels[docType] ?? "Document";

  const docNo =
    doc.invoiceNo ?? doc.orderNo ?? doc.repairNo ?? doc.billNo ?? doc.jobNo ?? token.slice(0, 8);
  const docDate = doc.createdAt ? fmtDate(doc.createdAt) : "";

  async function handleDownloadPdf() {
    setPdfError(null);
    try {
      const pdfDocType =
        docType === "job" ? "manufacturing_bill" : (docType as "invoice" | "order" | "repair");
      const { generateDocumentPdf } = await import("@/lib/pdf/document-pdf-generator");
      const { blob, fileName } = await generateDocumentPdf(pdfDocType, doc, firm as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError("PDF generation failed. Please try printing instead.");
      console.error(err);
    }
  }

  function handlePrint() {
    void printDocument(`${label} - ${docNo}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm font-semibold text-gray-700">{label}</div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-transform"
          >
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            className="rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-800 active:scale-95 transition-transform"
          >
            Download PDF
          </button>
        </div>
      </div>
      {pdfError && (
        <div className="print:hidden border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {pdfError}
        </div>
      )}

      {/* Document card */}
      <div
        data-testid="print-layout-root"
        className="mx-auto max-w-2xl px-4 py-6 space-y-4 print:px-0 print:py-0 print:max-w-none"
      >
        {/* Firm header */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 print:shadow-none print:border-none">
          {/* Top accent */}
          <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950 mb-4 print:rounded-none" />

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              {firm.logoUrl && (
                <img
                  src={firm.logoUrl}
                  alt={firm.shopName}
                  className="h-12 w-12 rounded-xl object-contain mb-2"
                />
              )}
              <h1 className="text-2xl font-serif font-black text-purple-950 leading-none">
                {firm.shopName}
              </h1>
              {firm.tagline && (
                <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase mt-0.5">
                  {firm.tagline}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{firm.address}</p>
              <p className="text-xs text-gray-500">
                {firm.phone}
                {firm.email ? ` · ${firm.email}` : ""}
              </p>
              {firm.gstin && (
                <div className="mt-1 inline-block rounded border border-purple-100 bg-purple-50 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-800 uppercase">
                  GSTIN: {firm.gstin}
                </div>
              )}
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-purple-950 uppercase">
                {label}
              </div>
              <div className="text-xs font-mono text-gray-600 mt-1">
                No: <span className="font-bold text-gray-800">{docNo}</span>
              </div>
              {docDate && (
                <div className="text-xs font-mono text-gray-600">
                  Date: <span className="font-bold text-gray-800">{docDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document body */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 print:shadow-none print:border-none print:p-0">
          {(docType === "invoice" || docType === "estimate") && (
            <InvoiceView doc={doc} firm={firm} />
          )}
          {docType === "order" && <OrderView doc={doc} />}
          {docType === "repair" && <RepairView doc={doc} />}
          {docType === "job" && <MfgBillView doc={doc} />}
        </div>

        {/* Terms / footer */}
        {firm.terms && (
          <div className="rounded-xl border border-gray-100 bg-white p-4 text-[10px] text-gray-400 print:shadow-none">
            <div className="font-bold uppercase tracking-wider text-gray-500 mb-1">
              Terms &amp; Conditions
            </div>
            <p>{firm.terms}</p>
          </div>
        )}

        {/* Expiry notice — hidden on print */}
        <div className="print:hidden text-center text-xs text-gray-400 pb-6">
          Document shared by <span className="font-semibold text-gray-600">{firm.shopName}</span>
          {" · "}
          Link valid until{" "}
          <span className="font-semibold">
            {new Date(share.expires_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </span>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="hidden print:block text-center text-[9px] text-gray-400 pt-4 border-t border-gray-200">
        {firm.footerLine || `Thank you for shopping at ${firm.shopName}`}
      </div>
    </div>
  );
}

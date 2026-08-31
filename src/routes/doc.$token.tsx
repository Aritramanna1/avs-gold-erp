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
import { formatDateMedium as fmtDate } from "@/lib/format-date";
import { AlertCircle, FileText, Printer, Download } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export const Route = createFileRoute("/doc/$token")({
  head: () => ({
    meta: [{ title: "Document Viewer · AVS Gold ERP" }],
  }),
  component: DocumentPortal,
});

// ── Formatting helpers ────────────────────────────────────────────────────────

function rs(paise: number) {
  return "₹" + (paise / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function grams(mg: number) {
  return (mg / 1000).toFixed(3) + "g";
}

type PortalFirm = {
  shopName: string;
  tagline?: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  logoUrl?: string;
  terms?: string;
  footerLine?: string;
  goldAccent?: string;
};

function portalFirm(raw: Record<string, unknown>): PortalFirm {
  const opt = (key: string) => {
    const v = raw[key];
    return v == null || v === "" ? undefined : String(v);
  };
  return {
    shopName: String(raw.shopName ?? "AVS ERP"),
    tagline: opt("tagline"),
    address: String(raw.address ?? ""),
    phone: String(raw.phone ?? ""),
    email: opt("email"),
    gstin: opt("gstin"),
    logoUrl: opt("logoUrl"),
    terms: opt("terms"),
    footerLine: opt("footerLine"),
    goldAccent: opt("goldAccent"),
  };
}

function snapshotText(doc: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = doc[key];
    if (v != null && v !== "") return String(v);
  }
  return "";
}

// ── Loading / error screens ───────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      <p className="mt-4 text-xs font-medium text-muted-foreground">Loading document…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-sm rounded-md border border-border bg-card p-8 text-center shadow-xs">
        <div className="h-12 w-12 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center mx-auto text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">Document not available</h2>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
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
      <div className="rounded-md border border-border bg-muted/20 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gold font-mono">
          Billed To
        </div>
        <div className="mt-1 text-base font-bold text-foreground">{doc.customerName}</div>
        {doc.customerPhone && (
          <div className="text-xs text-muted-foreground mt-0.5">Phone: {doc.customerPhone}</div>
        )}
        {doc.customerGstin && (
          <div className="text-xs font-mono text-muted-foreground mt-0.5">
            GSTIN: {doc.customerGstin}
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono">
            <tr>
              <th className="p-2.5">Item</th>
              <th className="p-2.5 text-right">Purity</th>
              <th className="p-2.5 text-right">Gross</th>
              <th className="p-2.5 text-right">Net</th>
              <th className="p-2.5 text-right">Making</th>
              <th className="p-2.5 text-right font-bold text-gold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it, i) => (
              <tr key={i} className="bg-card">
                <td className="p-2.5">
                  <div className="font-semibold text-foreground">{it.itemName}</div>
                  {it.huid && (
                    <div className="font-mono text-[9px] text-muted-foreground">
                      HUID: {it.huid}
                    </div>
                  )}
                  {it.barcode && (
                    <div className="font-mono text-[9px] text-gold">Tag: {it.barcode}</div>
                  )}
                </td>
                <td className="p-2.5 text-right font-mono text-foreground">{it.purity}</td>
                <td className="p-2.5 text-right font-mono text-foreground">{grams(it.grossMg)}</td>
                <td className="p-2.5 text-right font-mono text-foreground">{grams(it.netMg)}</td>
                <td className="p-2.5 text-right font-mono text-foreground">
                  {rs(it.makingChargesPaise)}
                </td>
                <td className="p-2.5 text-right font-mono font-bold text-gold">
                  {rs(it.lineTotalPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gold-First Headline & Totals */}
      <div className="rounded-md bg-muted/30 border border-border p-4 text-foreground text-sm space-y-2 font-mono">
        {/* Primary Gold First Obligation */}
        {(() => {
          const rate = doc.items?.[0]?.goldRatePerGramPaise || 750000;
          const totalGoldMg = doc.items?.reduce((s: number, it: any) => s + (it.fineGoldMg || it.fineMg || it.netMg || 0), 0) || Math.round(((doc.grandTotalPaise || 0) / rate) * 1000);
          const paidGoldMg = Math.round(((doc.paidPaise || 0) / rate) * 1000);
          const balanceGoldMg = Math.max(0, totalGoldMg - paidGoldMg);

          return (
            <div className="border-b border-border/70 pb-2 mb-2">
              <div className="text-[10px] uppercase font-bold text-gold tracking-wider">
                Primary Gold Accounting
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-muted-foreground">Pure Gold Obligation</span>
                <span className="text-base font-bold text-gold">{grams(totalGoldMg)} Fine</span>
              </div>
              <div className="flex justify-between items-baseline text-xs text-emerald-400 mt-0.5">
                <span>Gold Paid / Equivalent</span>
                <span>{grams(paidGoldMg)}</span>
              </div>
              {balanceGoldMg > 0 && (
                <div className="flex justify-between items-baseline text-xs text-amber-400 font-bold mt-0.5">
                  <span>Balance Due (Gold)</span>
                  <span>{grams(balanceGoldMg)} Fine</span>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex justify-between text-muted-foreground text-xs">
          <span>Subtotal</span>
          <span className="text-foreground">{rs(doc.subtotalPaise)}</span>
        </div>
        {hasGst && (
          <>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>CGST (1.5%)</span>
              <span className="text-foreground">{rs(doc.cgstPaise)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>SGST (1.5%)</span>
              <span className="text-foreground">{rs(doc.sgstPaise)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
          <span>Grand Total (Cash)</span>
          <span>{rs(doc.grandTotalPaise)}</span>
        </div>
        <div className="flex justify-between text-emerald-400 text-xs">
          <span>Cash Paid</span>
          <span>{rs(doc.paidPaise)}</span>
        </div>
        <div className="flex justify-between text-red-400 text-xs font-bold">
          <span>Balance Due (Cash)</span>
          <span>{rs(doc.balancePaise)}</span>
        </div>
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 font-mono">
            Payment Methods & Gold Equivalents
          </div>
          <div className="space-y-1.5">
            {payments.map((p, i) => {
              const rate = doc.items?.[0]?.goldRatePerGramPaise || 750000;
              const equivMg = rate > 0 ? Math.round((p.amountPaise / rate) * 1000) : 0;
              return (
                <div key={i} className="flex justify-between text-xs items-center">
                  <div>
                    <span className="text-foreground uppercase font-medium">{p.mode}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                      (Equiv: {grams(equivMg)})
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-foreground">{rs(p.amountPaise)}</span>
                </div>
              );
            })}
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
      <div className="rounded-md border border-border bg-muted/20 p-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">Customer</div>
          <div className="font-bold text-foreground text-sm mt-0.5">{doc.customerName}</div>
          {doc.customerPhone && (
            <div className="text-muted-foreground mt-0.5">{doc.customerPhone}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">Delivery</div>
          <div className="font-mono text-foreground font-medium mt-0.5">
            {doc.deliveryDate ? fmtDate(doc.deliveryDate) : "—"}
          </div>
          <div className="mt-1 inline-block rounded-md bg-gold/10 border border-gold/30 px-2 py-0.5 text-[10px] font-semibold text-gold uppercase">
            {doc.status ?? "pending"}
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono">
              <tr>
                <th className="p-2.5 text-left">Item</th>
                <th className="p-2.5 text-right">Purity</th>
                <th className="p-2.5 text-right">Gross</th>
                <th className="p-2.5 text-right">Making</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, i) => (
                <tr key={i} className="bg-card">
                  <td className="p-2.5 font-semibold text-foreground">{it.itemName}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">{it.purity ?? "—"}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">
                    {grams(it.grossMg ?? 0)}
                  </td>
                  <td className="p-2.5 text-right font-mono text-foreground">
                    {rs(it.makingChargesPaise ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc.cashAdvancePaise > 0 && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 flex justify-between text-xs">
          <span className="text-emerald-400 font-semibold uppercase">Cash Advance Paid</span>
          <span className="font-mono font-bold text-emerald-400">{rs(doc.cashAdvancePaise)}</span>
        </div>
      )}
    </div>
  );
}

// ── Repair renderer ───────────────────────────────────────────────────────────

function RepairView({ doc }: { doc: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase text-gold font-mono">Customer</div>
            <div className="font-bold text-foreground text-sm mt-0.5">{doc.customerName}</div>
            {doc.customerPhone && (
              <div className="text-muted-foreground mt-0.5">{doc.customerPhone}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-gold font-mono">Est. Delivery</div>
            <div className="font-mono text-foreground font-medium mt-0.5">
              {doc.estimatedDelivery ? fmtDate(doc.estimatedDelivery) : "—"}
            </div>
          </div>
        </div>
        {doc.description && (
          <div className="border-t border-border/50 pt-2">
            <div className="text-[10px] font-bold uppercase text-muted-foreground font-mono">
              Work Description
            </div>
            <div className="mt-0.5 text-foreground">{doc.description}</div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-muted/30 border border-border p-4 text-foreground font-mono text-xs space-y-1.5">
        <div className="flex justify-between text-muted-foreground">
          <span>Repair Charges</span>
          <span className="text-foreground">{rs(doc.repairChargesPaise ?? 0)}</span>
        </div>
        <div className="flex justify-between text-emerald-400">
          <span>Advance Paid</span>
          <span>{rs(doc.advancePaise ?? 0)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-bold text-gold text-sm">
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
      <div className="rounded-md border border-border bg-muted/20 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">
            Karigar / Worker
          </div>
          <div className="font-bold text-foreground text-sm mt-0.5">
            {doc.karigarName ?? doc.workerName ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">Gold Issued</div>
          <div className="font-mono text-foreground mt-0.5">{grams(doc.goldIssuedMg ?? 0)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">Gold Received</div>
          <div className="font-mono text-foreground mt-0.5">{grams(doc.goldReceivedMg ?? 0)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-gold font-mono">Wastage</div>
          <div className="font-mono text-red-400 mt-0.5">{grams(doc.wastageMg ?? 0)}</div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono">
              <tr>
                <th className="p-2.5 text-left">Item</th>
                <th className="p-2.5 text-right">Qty</th>
                <th className="p-2.5 text-right">Net Wt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, i) => (
                <tr key={i} className="bg-card">
                  <td className="p-2.5 font-semibold text-foreground">{it.itemName}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">{it.quantity ?? 1}</td>
                  <td className="p-2.5 text-right font-mono text-foreground">
                    {grams(it.netMg ?? 0)}
                  </td>
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

  const firm = portalFirm(share.firm_snapshot);
  const doc = share.document_snapshot;
  const docType = share.document_type;

  const docTypeLabels: Record<string, string> = {
    invoice: snapshotText(doc, "gst") === "gst3" ? "Tax Invoice (GST 3%)" : "Retail Invoice",
    estimate: "Estimate / Quotation",
    order: "Work Order",
    repair: "Repair Job Card",
    job: "Manufacturing Bill",
  };
  const label = docTypeLabels[docType] ?? "Document";

  const docNo =
    snapshotText(doc, "invoiceNo", "orderNo", "repairNo", "billNo", "jobNo") ||
    token.slice(0, 8);
  const docDate = snapshotText(doc, "createdAt")
    ? fmtDate(snapshotText(doc, "createdAt"))
    : "";

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
    <div className="min-h-screen bg-background text-foreground print:bg-white print:text-black">
      {/* Action bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Logo className="h-6" />
          <div className="h-4 w-px bg-border" />
          <div className="text-xs font-semibold text-foreground font-mono">{label}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-gold-dark transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>
      {pdfError && (
        <div className="print:hidden border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {pdfError}
        </div>
      )}

      {/* Document card */}
      <div
        data-testid="print-layout-root"
        className="mx-auto max-w-2xl px-4 py-6 space-y-4 print:px-0 print:py-0 print:max-w-none"
      >
        {/* Firm header */}
        <div className="rounded-md bg-card border border-border shadow-xs p-6 print:shadow-none print:border-none">
          {/* Top accent */}
          <div className="h-1 rounded-full bg-gold mb-4 print:hidden" />

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              {firm.logoUrl && (
                <img
                  src={firm.logoUrl}
                  alt={firm.shopName}
                  className="h-12 w-12 rounded-md object-contain mb-2"
                />
              )}
              <h1 className="text-2xl font-serif font-bold text-gold leading-none">
                {firm.shopName}
              </h1>
              {firm.tagline && (
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-1">
                  {firm.tagline}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{firm.address}</p>
              <p className="text-xs text-muted-foreground">
                {firm.phone}
                {firm.email ? ` · ${firm.email}` : ""}
              </p>
              {firm.gstin && (
                <div className="mt-1.5 inline-block rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold text-gold uppercase">
                  GSTIN: {firm.gstin}
                </div>
              )}
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block rounded-md bg-gold/15 border border-gold/30 px-3 py-1 text-xs font-bold text-gold uppercase">
                {label}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-1">
                No: <span className="font-bold text-foreground">{docNo}</span>
              </div>
              {docDate && (
                <div className="text-xs font-mono text-muted-foreground">
                  Date: <span className="font-bold text-foreground">{docDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document body */}
        <div className="rounded-md bg-card border border-border shadow-xs p-4 print:shadow-none print:border-none print:p-0">
          {(docType === "invoice" || docType === "estimate") && (
            <InvoiceView doc={doc} firm={firm} />
          )}
          {docType === "order" && <OrderView doc={doc} />}
          {docType === "repair" && <RepairView doc={doc} />}
          {docType === "job" && <MfgBillView doc={doc} />}
        </div>

        {/* Terms / footer */}
        {firm.terms && (
          <div className="rounded-md border border-border bg-card p-4 text-[10px] text-muted-foreground print:shadow-none">
            <div className="font-bold uppercase tracking-wider text-muted-foreground mb-1 font-mono">
              Terms &amp; Conditions
            </div>
            <p className="leading-relaxed">{firm.terms}</p>
          </div>
        )}

        {/* Expiry notice — hidden on print */}
        <div className="print:hidden text-center text-xs text-muted-foreground pb-6">
          Document shared by <span className="font-semibold text-foreground">{firm.shopName}</span>
          {" · "}
          Link valid until{" "}
          <span className="font-semibold text-foreground">
            {new Date(share.expires_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </span>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="hidden print:block text-center text-[9px] text-muted-foreground pt-4 border-t border-border">
        {firm.footerLine || `Thank you for shopping at ${firm.shopName}`}
      </div>
    </div>
  );
}

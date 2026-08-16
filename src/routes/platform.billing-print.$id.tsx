import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { guardRoute } from "@/lib/permissions";
import { loadPlatformPrintDocument, type PlatformPrintDoc } from "@/lib/platform-invoice-adapter";
import { brandingToPdfInputAsync, loadPlatformBrandingSettings } from "@/lib/platform-branding";
import { downloadPlatformBillingPdf } from "@/lib/platform-billing-pdf";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { printDocument } from "@/lib/print-document";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/platform/billing-print/$id")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Billing Document · AVS Gold ERP Platform" }] }),
  component: BillingPrintPage,
});

type Firm = { id: string; name: string; gstin: string | null; address: string | null };

const DOC_TYPE_LABEL: Record<string, string> = {
  quotation: "QUOTATION",
  proforma: "PROFORMA INVOICE",
  tax_invoice: "TAX INVOICE",
  renewal_invoice: "RENEWAL INVOICE",
  credit_note: "CREDIT NOTE",
  payment_receipt: "PAYMENT RECEIPT",
};

function rs(minor: number | null | undefined): string {
  return `₹${((minor ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BillingPrintPage() {
  const { id } = useParams({ from: "/platform/billing-print/$id" });
  const [doc, setDoc] = useState<PlatformPrintDoc | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [branding, setBranding] = useState<Awaited<
    ReturnType<typeof loadPlatformBrandingSettings>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { doc: loaded, error: loadError } = await loadPlatformPrintDocument(id);
      if (loadError || !loaded) {
        setError(loadError ?? "Document not found.");
        setLoading(false);
        return;
      }
      setDoc(loaded);
      const [{ data: firmRow }, brandSettings] = await Promise.all([
        supabase
          .from("organizations" as never)
          .select("id,name,gstin,address")
          .eq("id", loaded.firm_id)
          .maybeSingle(),
        loadPlatformBrandingSettings(),
      ]);
      setFirm((firmRow as Firm | null) ?? null);
      setBranding(brandSettings);
      setLoading(false);
    })();
  }, [id]);

  const pdfInput = useMemo(() => {
    if (!doc || !branding) return null;
    return {
      doc,
      buyerName: firm?.name ?? doc.firm_id,
      buyerAddress: firm?.address,
      buyerGstin: firm?.gstin,
      brandingPromise: brandingToPdfInputAsync(branding),
    };
  }, [doc, firm, branding]);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !doc || !branding) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center text-sm text-muted-foreground bg-white">
        {error ?? "Document not found."}
      </div>
    );
  }

  const isInterState = (doc.igst_minor ?? 0) > 0;
  const gstRate = doc.data?.gst_rate_percent ?? 0;
  const logo = branding.logoDocument || branding.logoPrimary || branding.logoCompact;
  const companyName = branding.legalName || branding.appName;
  const docTitle = DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type;

  const handlePrint = () => {
    void printDocument(`${docTitle} · ${doc.document_no}`, "Invoice");
  };

  const handleDownloadPdf = async () => {
    if (!pdfInput) return;
    setDownloadingPdf(true);
    try {
      const brandingPdf = await pdfInput.brandingPromise;
      await downloadPlatformBillingPdf({
        doc: pdfInput.doc,
        buyerName: pdfInput.buyerName,
        buyerAddress: pdfInput.buyerAddress,
        buyerGstin: pdfInput.buyerGstin,
        branding: brandingPdf,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title={docTitle}
        docNumber={doc.document_no}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
        documentSize="a4"
        backUrl="/platform?view=billing"
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-x-auto overflow-y-auto">
        <div
          data-testid="print-layout-root"
          data-print-size="a4"
          className="bg-white text-black shadow-sm print:shadow-none"
          style={{ width: "210mm", minHeight: "297mm", padding: "14mm", boxSizing: "border-box" }}
        >
          <div className="flex items-start justify-between border-b border-neutral-300 pb-4">
            <div className="flex items-start gap-3">
              {logo && <img src={logo} alt="Logo" className="h-14 w-auto object-contain" />}
              <div>
                <h1 className="text-base font-bold">{companyName}</h1>
                {branding.address && (
                  <p className="text-[10px] whitespace-pre-line text-neutral-600 mt-1">
                    {branding.address}
                  </p>
                )}
                {branding.gstin && (
                  <p className="text-[10px] text-neutral-600">GSTIN: {branding.gstin}</p>
                )}
                {branding.email && <p className="text-[10px] text-neutral-600">{branding.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold uppercase">{docTitle}</h2>
              <p className="text-[10px]">No: {doc.document_no}</p>
              {doc.issued_at && (
                <p className="text-[10px]">
                  Date: {new Date(doc.issued_at).toLocaleDateString("en-IN")}
                </p>
              )}
              {doc.due_at && (
                <p className="text-[10px]">
                  Due: {new Date(doc.due_at).toLocaleDateString("en-IN")}
                </p>
              )}
              <p className="text-[10px] font-semibold uppercase mt-1">{doc.status}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[9px] uppercase tracking-wide text-neutral-500 font-semibold">
              Bill To
            </p>
            <p className="text-sm font-semibold mt-1">{firm?.name ?? doc.firm_id}</p>
            {firm?.address && (
              <p className="text-[10px] whitespace-pre-line text-neutral-600">{firm.address}</p>
            )}
            {firm?.gstin && <p className="text-[10px]">GSTIN: {firm.gstin}</p>}
          </div>

          <table className="mt-5 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-neutral-400 bg-neutral-50 text-left">
                <th className="py-2 px-1">Description</th>
                <th className="py-2 px-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200">
                <td className="py-2 px-1">
                  {doc.data?.description || DOC_TYPE_LABEL[doc.document_type] || doc.document_type}
                </td>
                <td className="py-2 px-1 text-right font-mono">{rs(doc.taxable_minor)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-56 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Taxable Subtotal</span>
              <span className="font-mono">{rs(doc.taxable_minor)}</span>
            </div>
            {isInterState ? (
              <div className="flex justify-between">
                <span>IGST ({gstRate}%)</span>
                <span className="font-mono">{rs(doc.igst_minor)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>CGST ({gstRate / 2}%)</span>
                  <span className="font-mono">{rs(doc.cgst_minor)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST ({gstRate / 2}%)</span>
                  <span className="font-mono">{rs(doc.sgst_minor)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-neutral-400 pt-2 text-sm font-bold">
              <span>Grand Total</span>
              <span className="font-mono">{rs(doc.amount_minor)}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount Paid</span>
              <span className="font-mono">{rs(doc.paid_minor)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span className="font-mono">
                {rs((doc.amount_minor ?? 0) - (doc.paid_minor ?? 0))}
              </span>
            </div>
          </div>

          <p className="mt-10 text-[9px] text-neutral-500">
            System-generated {DOC_TYPE_LABEL[doc.document_type]?.toLowerCase() ?? "document"} ·{" "}
            {companyName}
          </p>
        </div>
      </div>
    </div>
  );
}

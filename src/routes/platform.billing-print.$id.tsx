import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { guardRoute } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";

export const Route = createFileRoute("/platform/billing-print/$id")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Invoice · AVS Gold ERP Platform" }] }),
  component: BillingPrintPage,
});

type Doc = {
  id: string;
  firm_id: string;
  document_no: string;
  document_type: string;
  status: string;
  amount_minor: number;
  taxable_minor: number | null;
  cgst_minor: number | null;
  sgst_minor: number | null;
  igst_minor: number | null;
  gst_minor: number | null;
  buyer_state_code: string | null;
  seller_state_code: string | null;
  issued_at: string | null;
  due_at: string | null;
  data: { description?: string; gst_rate_percent?: number } | null;
};

type Firm = { id: string; name: string; gstin: string | null; address: string | null };

const DOC_TYPE_LABEL: Record<string, string> = {
  quotation: "Quotation",
  proforma: "Proforma Invoice",
  tax_invoice: "Tax Invoice",
  renewal_invoice: "Renewal Invoice",
  credit_note: "Credit Note",
  payment_receipt: "Payment Receipt",
};

function rupees(minor: number | null | undefined): string {
  return `Rs. ${((minor ?? 0) / 100).toFixed(2)}`;
}

function BillingPrintPage() {
  const { id } = useParams({ from: "/platform/billing-print/$id" });
  const [doc, setDoc] = useState<Doc | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [seller, setSeller] = useState({ name: "Arivahly Venture Sphere", address: "", gstin: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: docRow, error: docError } = await supabase
        .from("platform_billing_documents" as never)
        .select(
          "id,firm_id,document_no,document_type,status,amount_minor,taxable_minor,cgst_minor,sgst_minor,igst_minor,gst_minor,buyer_state_code,seller_state_code,issued_at,due_at,data",
        )
        .eq("id", id)
        .maybeSingle();
      if (docError || !docRow) {
        setError(docError?.message ?? "Document not found.");
        setLoading(false);
        return;
      }
      const doc = docRow as unknown as Doc;
      setDoc(doc);
      const [{ data: firmRow }, { data: settingsRows }] = await Promise.all([
        supabase
          .from("organizations" as never)
          .select("id,name,gstin,address")
          .eq("id", doc.firm_id)
          .maybeSingle(),
        supabase
          .from("platform_settings" as never)
          .select("key,value")
          .in("key", ["billing.seller_name", "billing.seller_address", "billing.seller_gstin"]),
      ]);
      setFirm((firmRow as Firm | null) ?? null);
      const settingsMap = new Map(
        ((settingsRows ?? []) as Array<{ key: string; value: unknown }>).map((r) => [
          r.key,
          r.value,
        ]),
      );
      setSeller({
        name: (settingsMap.get("billing.seller_name") as string) || "Arivahly Venture Sphere",
        address: (settingsMap.get("billing.seller_address") as string) || "",
        gstin: (settingsMap.get("billing.seller_gstin") as string) || "",
      });
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !doc) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center text-sm text-muted-foreground">
        {error ?? "Document not found."}
      </div>
    );
  }

  const isInterState = (doc.gst_minor ?? 0) > 0 && (doc.igst_minor ?? 0) > 0;
  const gstRate = doc.data?.gst_rate_percent ?? 0;

  return (
    <div className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <div className="border border-black/20 p-8 text-sm text-black bg-white">
        <div className="flex items-start justify-between border-b border-black/20 pb-4">
          <div>
            <h1 className="text-lg font-semibold">{seller.name}</h1>
            {seller.address && <p className="text-xs whitespace-pre-line">{seller.address}</p>}
            {seller.gstin && <p className="text-xs">GSTIN: {seller.gstin}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase">
              {DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type}
            </h2>
            <p className="text-xs">No: {doc.document_no}</p>
            {doc.issued_at && (
              <p className="text-xs">Date: {new Date(doc.issued_at).toLocaleDateString("en-IN")}</p>
            )}
            {doc.due_at && (
              <p className="text-xs">Due: {new Date(doc.due_at).toLocaleDateString("en-IN")}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-black/60">Billed to</p>
          <p className="font-medium">{firm?.name ?? doc.firm_id}</p>
          {firm?.address && <p className="text-xs whitespace-pre-line">{firm.address}</p>}
          {firm?.gstin && <p className="text-xs">GSTIN: {firm.gstin}</p>}
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-black/30 text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/10">
              <td className="py-2">
                {doc.data?.description || DOC_TYPE_LABEL[doc.document_type] || doc.document_type}
              </td>
              <td className="py-2 text-right">{rupees(doc.taxable_minor)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Taxable amount</span>
            <span>{rupees(doc.taxable_minor)}</span>
          </div>
          {isInterState ? (
            <div className="flex justify-between">
              <span>IGST ({gstRate}%)</span>
              <span>{rupees(doc.igst_minor)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span>CGST ({gstRate / 2}%)</span>
                <span>{rupees(doc.cgst_minor)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST ({gstRate / 2}%)</span>
                <span>{rupees(doc.sgst_minor)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-black/30 pt-1 font-semibold">
            <span>Total</span>
            <span>{rupees(doc.amount_minor)}</span>
          </div>
        </div>

        <p className="mt-8 text-[10px] text-black/50">
          This is a system-generated{" "}
          {(DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type).toLowerCase()} for the AVS Gold
          ERP platform subscription. Status: {doc.status}.
        </p>
      </div>
    </div>
  );
}

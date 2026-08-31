/**
 * Universal Print Engine — jewellery book / cash book / karigar / barcode prints.
 * recordId search: from, to, mode (optional).
 */
import { createFileRoute } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import type { PrintDocType } from "@/lib/printlog-store";
import { encodeBookPrintId } from "@/lib/print-engine/jewellery-books-print-data";

const BOOK_DOC_TYPES = new Set<PrintDocType>([
  "cash_book",
  "fine_rojmel",
  "dar_rojmel",
  "karigar_book",
  "barcode_stock",
  "item_jama_nave",
  "dhadi_book",
  "daily_jewellery_summary",
]);

const BACK_URL: Partial<Record<PrintDocType, string>> = {
  cash_book: "/treasury/cash-book",
  fine_rojmel: "/reports/fine-rojmel",
  dar_rojmel: "/reports/dar-rojmel",
  karigar_book: "/workshop/karigar-book",
  barcode_stock: "/reports/barcode-stock",
  item_jama_nave: "/reports/item-jama-nave",
  dhadi_book: "/reports/dhadi-book",
  daily_jewellery_summary: "/reports/daily-summary",
};

export const Route = createFileRoute("/reports/book-print/$docType")({
  validateSearch: (s: Record<string, unknown>): { from?: string; to?: string; mode?: string } => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    mode: typeof s.mode === "string" ? s.mode : undefined,
  }),
  head: ({ params }) => ({
    meta: [{ title: `Print ${params.docType} · AVS ERP` }],
  }),
  component: BookPrintPage,
});

function BookPrintPage() {
  const { docType: raw } = Route.useParams();
  const search = Route.useSearch();
  const docType = raw as PrintDocType;
  if (!BOOK_DOC_TYPES.has(docType)) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <p className="text-destructive">Unknown book print type: {raw}</p>
      </div>
    );
  }
  const from = search.from || "";
  const to = search.to || from;
  const recordId =
    docType === "barcode_stock" && !from
      ? "all"
      : encodeBookPrintId(from, to, search.mode);
  return (
    <PrintEngine
      docType={docType}
      recordId={recordId}
      backUrl={BACK_URL[docType] || "/reports"}
    />
  );
}

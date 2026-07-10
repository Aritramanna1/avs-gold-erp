import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useDebitNotes } from "@/lib/billing-documents-store";
import { paiseToRupees } from "@/lib/billing-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/billing/debit-note-print/$id")({
  head: () => ({ meta: [{ title: "Debit Note Print · AVS Gold ERP" }] }),
  component: DebitNotePrintPage,
});

function DebitNotePrintPage() {
  const { id } = useParams({ from: "/billing/debit-note-print/$id" });
  const note = useDebitNotes((s) => s.notes.find((n) => n.id === id));

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(note ? "debit_note" : null, id);

  if (!note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Debit note not found</h1>
          <Link to="/billing/debit-notes" className="text-gold underline">
            Back to Debit Notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Debit Note"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/billing/debit-notes/${note.id}`}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="DEBIT NOTE"
          docNumber={docNumber}
          docType="debit_note"
          recordId={note.id}
          createdAt={note.createdAt}
          size="a4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={note.status === "issued" ? "outline" : "destructive"}>
              {note.status === "issued" ? "Issued" : "Cancelled"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <div className="text-xs uppercase text-stone-500">Customer</div>
              <div className="font-medium">{note.customerName}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-stone-500">Against Invoice</div>
              <div className="font-medium">{note.invoiceNo}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-stone-500">Amount</div>
              <div className="font-semibold text-amber-700">
                ₹ {paiseToRupees(note.amountPaise)}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase text-stone-500 mb-1">Reason</div>
            <div className="text-sm border border-stone-200 rounded-md p-3">{note.reason}</div>
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}

import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useCreditNotes } from "@/lib/billing-documents-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/credit-note-print/$id")({
  head: () => ({ meta: [{ title: "Credit Note Print · AVS Gold ERP" }] }),
  component: CreditNotePrintPage,
});

function CreditNotePrintPage() {
  const { id } = useParams({ from: "/billing/credit-note-print/$id" });
  const note = useCreditNotes((s) => s.notes.find((n) => n.id === id));

  if (!note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Credit note not found</h1>
          <Link to="/billing/credit-notes" className="text-gold underline">
            Back to Credit Notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="credit_note"
      recordId={note.id}
      backUrl={`/billing/credit-notes/${note.id}`}
    />
  );
}

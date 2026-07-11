import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useDebitNotes } from "@/lib/billing-documents-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/debit-note-print/$id")({
  head: () => ({ meta: [{ title: "Debit Note Print · AVS Gold ERP" }] }),
  component: DebitNotePrintPage,
});

function DebitNotePrintPage() {
  const { id } = useParams({ from: "/billing/debit-note-print/$id" });
  const note = useDebitNotes((s) => s.notes.find((n) => n.id === id));

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
    <PrintEngine
      docType="debit_note"
      recordId={note.id}
      backUrl={`/billing/debit-notes/${note.id}`}
    />
  );
}

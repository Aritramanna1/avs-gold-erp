import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { Button } from "@/components/ui/button";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/debit-note-print/$id")({
  head: () => ({ meta: [{ title: "Debit Note Print · AVS Gold ERP" }] }),
  component: DebitNotePrintPage,
});

function DebitNotePrintPage() {
  const { id } = useParams({ from: "/billing/debit-note-print/$id" });
  const { document: note, loading, error, retry } = useBillingDocumentById("debit_note", id);

  if (loading && !note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading debit note print data...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Debit note not found</h1>
          {error ? (
            <Button variant="outline" className="gap-1.5" onClick={retry}>
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          ) : null}
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

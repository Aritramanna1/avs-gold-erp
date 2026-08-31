import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { Button } from "@/components/ui/button";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/credit-note-print/$id")({
  head: () => ({ meta: [{ title: "Credit Note Print · AVS Gold ERP" }] }),
  component: CreditNotePrintPage,
});

function CreditNotePrintPage() {
  const { id } = useParams({ from: "/billing/credit-note-print/$id" });
  const { document: note, loading, error, retry } = useBillingDocumentById("credit_note", id);

  if (loading && !note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading credit note print data...</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Credit note not found</h1>
          {error ? (
            <Button variant="outline" className="gap-1.5" onClick={retry}>
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          ) : null}
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

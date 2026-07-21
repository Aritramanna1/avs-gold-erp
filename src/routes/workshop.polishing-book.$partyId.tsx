import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { usePolishing } from "@/lib/polishing-store";
import { usePeople } from "@/lib/people-store";
import { compilePolishingBook } from "@/lib/workshop-polishing-books";
import { PartyPurityBooksView } from "@/components/workshop/party-purity-books";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/workshop/polishing-book/$partyId")({
  head: () => ({ meta: [{ title: "Polishing Book · Manufacturing Books · AVS Gold ERP" }] }),
  component: PolishingBookPage,
});

function PolishingBookPage() {
  const { partyId } = useParams({ from: "/workshop/polishing-book/$partyId" });
  const txns = usePolishing((s) => s.transactions);
  const people = usePeople((s) => s.people);
  const book = useMemo(
    () => compilePolishingBook(partyId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partyId, txns, people],
  );

  if (!book) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <h1 className="font-serif text-2xl text-gold">Polisher not found</h1>
        <Link to="/workshop/polishing-books" className="text-gold underline text-sm">
          Back to Polishing Books
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link
          to="/workshop/polishing-books"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Polishing Books
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> {book.party.fullName}
        </h1>
        <Link to="/workshop/polishing">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Sparkles className="h-4 w-4" /> Enter Transactions
          </Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Each purity is an independent book showing the current payable gold only. Polishing charges
        and settlement belong to the Payment module.
      </p>

      <PartyPurityBooksView
        purityBooks={book.purityBooks}
        issuedLabel="Gold Sent"
        receivedLabel="Gold Received"
        partyName={book.party.fullName}
        partyId={partyId}
        kind="polishing"
      />
    </div>
  );
}

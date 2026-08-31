import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useOutsideWork } from "@/lib/outside-work-store";
import { usePeople } from "@/lib/people-store";
import { compileOutsideBook } from "@/lib/workshop-outside-books";
import { PartyPurityBooksView } from "@/components/workshop/party-purity-books";
import { ArrowLeft, BookOpen, Truck } from "lucide-react";

export const Route = createFileRoute("/workshop/outside-worker-book/$partyId")({
  head: () => ({ meta: [{ title: "Outside Worker Book · Manufacturing Books · AVS Gold ERP" }] }),
  component: OutsideWorkerBookPage,
});

function OutsideWorkerBookPage() {
  const { partyId } = useParams({ from: "/workshop/outside-worker-book/$partyId" });
  const txns = useOutsideWork((s) => s.transactions);
  const people = usePeople((s) => s.people);
  const book = useMemo(
    () => compileOutsideBook(partyId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partyId, txns, people],
  );

  if (!book) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <h1 className="font-serif text-2xl text-gold">Outside worker not found</h1>
        <Link to="/workshop/outside-worker-books" className="text-gold underline text-sm">
          Back to Outside Worker Books
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link
          to="/workshop/outside-worker-books"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Outside Worker Books
        </Link>
      </div>

      <div className="rounded-md border border-border bg-card p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> {book.party.fullName}
        </h1>
        <Link to="/workshop/outside-work">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Truck className="h-4 w-4" /> Enter Transactions
          </Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Each purity is an independent book showing the current payable gold only. Charges,
        deductions and settlement belong to the Payment module.
      </p>

      <PartyPurityBooksView
        purityBooks={book.purityBooks}
        issuedLabel="Gold Sent"
        receivedLabel="Gold Received"
        partyName={book.party.fullName}
        partyId={partyId}
        kind="outside"
      />
    </div>
  );
}

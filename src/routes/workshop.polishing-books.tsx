import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePolishing } from "@/lib/polishing-store";
import { usePeople } from "@/lib/people-store";
import { compilePolishingBooks, type PolishingBook } from "@/lib/workshop-polishing-books";
import { BookCard, type BookCardData } from "@/components/workshop/book-card";
import { formatWeight } from "@/lib/gold";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";

function polishingCardData(b: PolishingBook): BookCardData {
  const sent = b.purityBooks.reduce((s, pb) => s + pb.issuedFineMg, 0);
  const received = b.purityBooks.reduce((s, pb) => s + pb.returnedFineMg, 0);
  const balance = b.purityBooks.reduce((s, pb) => s + pb.currentBalanceMg, 0);
  return {
    id: b.party.id,
    title: b.party.fullName,
    subtitle: "Polisher",
    personId: "type" in b.party ? b.party.id : undefined,
    icon: Sparkles,
    metrics: {
      receivedMg: received,
      issuedMg: sent,
      outstandingMg: balance,
      balanceMg: balance,
      lastTs: b.lastActivityTs,
      statusLabel: balance > 0 ? `${formatWeight(balance)} with polisher` : "Settled",
      statusTone: balance > 0 ? "held" : "settled",
    },
  };
}

export const Route = createFileRoute("/workshop/polishing-books")({
  head: () => ({ meta: [{ title: "Polishing Books · Manufacturing Books · AVS Gold ERP" }] }),
  component: PolishingBooksPage,
});

function PolishingBooksPage() {
  const txns = usePolishing((s) => s.transactions);
  const people = usePeople((s) => s.people);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const books = useMemo(
    () => compilePolishingBooks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txns, people],
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/workshop"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Workshop
        </Link>
        <Link
          to="/workshop/polishing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
        >
          <Sparkles className="h-4 w-4" /> Open Polishing (enter transactions)
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> Polishing Books
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only per-purity ledgers of gold sent to and returned by each polisher. Balances stay
          in their own purity. Enter transactions in the Polishing module.
        </p>
      </div>

      {books.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No polishing books yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A book opens once gold is sent to a polisher in the Polishing module.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {books.map((b) => (
            <BookCard
              key={b.party.id}
              data={polishingCardData(b)}
              selected={selectedId === b.party.id}
              onSelect={() => setSelectedId(b.party.id)}
              onOpen={() =>
                navigate({
                  to: "/workshop/polishing-book/$partyId",
                  params: { partyId: b.party.id },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

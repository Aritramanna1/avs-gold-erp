import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { compileWorkerBooks, type WorkerBook } from "@/lib/workshop-worker-books";
import { BookCard, type BookCardData } from "@/components/workshop/book-card";
import { formatWeight } from "@/lib/gold";
import { ArrowLeft, BookOpen, Search, Hammer, Users } from "lucide-react";

/** Worker book → People-style card metrics. Roll-up across purity books for the card face; the detail keeps strict per-purity ledgers. */
function workerCardData(b: WorkerBook): BookCardData {
  const issued = b.purityBooks.reduce((s, pb) => s + pb.issuedFineMg, 0);
  const returned = b.purityBooks.reduce((s, pb) => s + pb.returnedFineMg, 0);
  const balance = b.purityBooks.reduce((s, pb) => s + pb.currentBalanceMg, 0);
  return {
    id: b.worker.id,
    title: b.worker.fullName,
    subtitle: PERSON_TYPE_LABELS[b.worker.type],
    personId: b.worker.id,
    icon: Users,
    metrics: {
      receivedMg: returned,
      issuedMg: issued,
      outstandingMg: balance,
      balanceMg: balance,
      lastTs: b.lastActivityTs,
      statusLabel: balance > 0 ? `${formatWeight(balance)} with worker` : "Settled",
      statusTone: balance > 0 ? "held" : "settled",
    },
  };
}

export const Route = createFileRoute("/workshop/worker-books")({
  head: () => ({ meta: [{ title: "Worker Books · Manufacturing Books · AVS Gold ERP" }] }),
  component: WorkerBooksPage,
});

/**
 * Workshop — Worker Books (read-only ledger index).
 *
 * A read-only reporting view of every worker's gold book. Entering issues and
 * returns still happens in the Worker Gold Book transaction module
 * (/workshop/gold-book); this is Workshop's master-ledger view of the same data.
 */
function WorkerBooksPage() {
  const people = usePeople((s) => s.people);
  const entries = useWorkerGoldBook((s) => s.entries);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const books = useMemo(
    () => compileWorkerBooks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.worker.fullName.toLowerCase().includes(q));
  }, [books, query]);

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
          to="/workshop/gold-book"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
        >
          <Hammer className="h-4 w-4" /> Open Worker Gold Book (enter transactions)
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> Worker Books
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only ledger of gold and materials issued to and returned by each worker. Balances are
          kept in their own purity — never converted or mixed. Enter transactions in the Worker Gold
          Book module.
        </p>
      </div>

      <div className="rounded-md border border-border bg-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search worker by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            data-testid="worker-book-search"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No worker books yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A book opens once a worker is issued gold or material in the Worker Gold Book.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <BookCard
              key={b.worker.id}
              data={workerCardData(b)}
              selected={selectedId === b.worker.id}
              onSelect={() => setSelectedId(b.worker.id)}
              onOpen={() =>
                navigate({
                  to: "/workshop/worker-book/$workerId",
                  params: { workerId: b.worker.id },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

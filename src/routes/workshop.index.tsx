import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { BookCard, type BookCardData } from "@/components/workshop/book-card";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { compileJewellerBooks, jewellerBooksTotals, type JewellerBook } from "@/lib/workshop-books";
import { formatWeight } from "@/lib/gold";
import { Search, BookOpen, Scale, Library } from "lucide-react";

// The Workshop Edition exposes only the jeweller ledger here. Production book
// types remain isolated in the enterprise code path and are not rendered.
const BOOK_TYPES: {
  key: string;
  icon: typeof BookOpen;
  status: string;
  title: string;
  note?: string;
  description?: string;
  indexRoute: string;
}[] = [];

/** Jeweller book → People-style card metrics. */
function jewellerCardData(b: JewellerBook): BookCardData {
  const net = b.ledger.closingGoldMg;
  return {
    id: b.jeweller.id,
    title: b.jeweller.fullName,
    subtitle: PERSON_TYPE_LABELS[b.jeweller.type],
    personId: b.jeweller.id,
    icon: BookOpen,
    metrics: {
      receivedMg: b.goldReceivedMg,
      issuedMg: b.goldIssuedMg,
      outstandingMg: b.goldOwedMg > 0 ? b.goldOwedMg : b.goldHeldMg,
      balanceMg: net,
      lastTs: b.lastActivityTs,
      statusLabel:
        b.goldOwedMg > 0
          ? `${formatWeight(b.goldOwedMg)} owed to us`
          : b.goldHeldMg > 0
            ? `${formatWeight(b.goldHeldMg)} with us`
            : "Settled",
      statusTone: b.goldOwedMg > 0 ? "owed" : b.goldHeldMg > 0 ? "held" : "settled",
    },
  };
}

export const Route = createFileRoute("/workshop/")({
  head: () => ({ meta: [{ title: "Jeweller Gold Book · AVS Gold ERP" }] }),
  component: WorkshopBooksPage,
});

/**
 * Workshop — Jeweller Books.
 *
 * The workshop's own set of ledgers, one page per client jeweller: the digital
 * form of the physical jeweller ledger kept by the workshop. Production
 * planning and execution are outside this edition.
 * The Karigar Gold Book, Outside Work and Polishing remain their own modules,
 * only linked from here.
 */
function WorkshopBooksPage() {
  // Subscribe to the stores that can change a jeweller's gold/cash ledger.
  const people = usePeople((s) => s.people);
  const invoices = useBilling((s) => s.invoices);
  const settlements = useGoldSettlement((s) => s.settlements);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const books = useMemo(
    () => compileJewellerBooks(),
    // Recompiled from the stores above; the deps are the re-render triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, invoices, settlements],
  );
  const totals = useMemo(() => jewellerBooksTotals(books), [books]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      `${b.jeweller.fullName} ${b.jeweller.phone} ${b.jeweller.villageCity ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [books, query]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Jeweller Gold Book"
        subtitle="Gold received, gold returned, balances and transaction history for each jeweller."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <ModuleLink to="/workshop/gold-book" icon={BookOpen} label="Worker Gold Book" />
          </div>
        }
      />

      {/* The shelf: every book type Workshop holds. Jeweller Books is the one
          implemented here today; the rest are separate modules linked out.
          Adding a book type is a new BOOK_TYPES entry — this renders it. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {BOOK_TYPES.map((bt) => {
          const Icon = bt.icon;
          const active = bt.status === "implemented";
          const planned = bt.status === "planned";
          const content = (
            <>
              <Icon
                className={`h-5 w-5 mt-0.5 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {bt.title}
                  {bt.status === "section" && (
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">
                      Workshop section
                    </span>
                  )}
                  {planned && (
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {bt.note ?? bt.description}
                </div>
              </div>
            </>
          );
          if (planned) {
            return (
              <div
                key={bt.key}
                className="rounded-2xl border border-border bg-card p-4 flex gap-3 opacity-60 cursor-not-allowed"
                aria-disabled="true"
              >
                {content}
              </div>
            );
          }
          return (
            <Link
              key={bt.key}
              to={bt.indexRoute as never}
              className={`rounded-2xl border p-4 flex gap-3 transition-colors ${
                active
                  ? "border-gold/40 bg-gold/5 hover:bg-gold/10"
                  : "border-border bg-card hover:bg-muted/20"
              }`}
            >
              {content}
            </Link>
          );
        })}
      </div>

      {/* Where the workshop stands across every jeweller book. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Totals
          k="Jeweller gold with us"
          v={`${formatWeight(totals.goldHeldMg)}`}
          hint="Fine gold held on jewellers' account"
          tone="gold"
        />
        <Totals
          k="Gold owed to us"
          v={`${formatWeight(totals.goldOwedMg)}`}
          hint="Issued beyond what was received"
          tone={totals.goldOwedMg > 0 ? "red" : undefined}
        />
        <Totals
          k="Cash outstanding"
          v={`₹${paiseToRupees(totals.cashDuePaise)}`}
          hint="Billed but unpaid"
        />
        <Totals k="Jeweller books" v={String(books.length)} hint="Active gold ledgers" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jeweller by name, phone or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            data-testid="jeweller-book-search"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Library className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No jeweller books yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A book opens when a jeweller has gold or billing activity.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <BookCard
              key={b.jeweller.id}
              data={jewellerCardData(b)}
              selected={selectedId === b.jeweller.id}
              onSelect={() => setSelectedId(b.jeweller.id)}
              onOpen={() =>
                navigate({
                  to: "/workshop/book/$jewellerId",
                  params: { jewellerId: b.jeweller.id },
                })
              }
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Books are compiled from the same postings the rest of the ERP makes — gold settlements,
        settlements, billing and gold postings. Nothing is entered twice.
      </p>
    </div>
  );
}

function ModuleLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof BookOpen;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      className="inline-flex items-center justify-center rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-4 py-2.5 text-sm font-semibold gap-2 transition-colors active:scale-95"
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Totals({
  k,
  v,
  hint,
  tone,
}: {
  k: string;
  v: string;
  hint?: string;
  tone?: "gold" | "red";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Scale className="h-3 w-3" /> {k}
      </div>
      <div
        className={`mt-1 font-mono text-lg ${tone === "gold" ? "text-gold" : tone === "red" ? "text-red-300" : ""}`}
      >
        {v}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

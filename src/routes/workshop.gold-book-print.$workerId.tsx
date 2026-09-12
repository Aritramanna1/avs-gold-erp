import { createFileRoute, useParams, useSearch, Link } from "@tanstack/react-router";
import { z } from "zod";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

/**
 * Manufacturing Books — print one purity book for one period through the shared
 * Print Engine (branding, page setup, print profiles all unchanged). The opened
 * ledger and selected range travel to the workshop data builder encoded in the
 * engine's opaque `recordId` as `kind~partyId~purity~from~to~label`. Without
 * search params it falls back to the whole worker book (legacy links).
 */
const SearchSchema = z.object({
  kind: z.enum(["worker", "outside", "polishing"]).catch(undefined).optional(),
  purity: z.coerce.number().optional(),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  plabel: z.string().optional(),
});

export const Route = createFileRoute("/workshop/gold-book-print/$workerId")({
  validateSearch: (s: Record<string, unknown>) => {
    const result = SearchSchema.safeParse(s);
    return result.success ? result.data : {};
  },
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Ledger Statement · ${shopName} ERP` }],
    };
  },
  component: GoldBookPrintPage,
});

function GoldBookPrintPage() {
  const { workerId } = useParams({ from: "/workshop/gold-book-print/$workerId" });
  const { kind, purity, from, to, plabel } = useSearch({
    from: "/workshop/gold-book-print/$workerId",
  });
  const worker = usePeople((s) => s.people.find((p) => p.id === workerId));

  if (!worker) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Worker not found</h1>
          <p className="text-sm text-muted-foreground">This worker may have been removed.</p>
          <Link to="/workshop/gold-book" className="text-gold underline">
            Back to Gold Book
          </Link>
        </div>
      </div>
    );
  }

  // Build the compound recordId the workshop builder decodes. A bare workerId
  // (no search params) keeps the old whole-book behaviour for legacy links.
  const recordId =
    purity !== undefined && from !== undefined && to !== undefined
      ? [kind ?? "worker", workerId, purity, from, to, plabel ?? "All Time"].join("~")
      : workerId;

  return (
    <PrintEngine
      docType="karigar_custody_statement"
      recordId={recordId}
      backUrl="/workshop/gold-book"
    />
  );
}

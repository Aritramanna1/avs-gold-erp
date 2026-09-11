import { createFileRoute, useParams, useSearch, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

/**
 * Optional period scoping. Without these (People's own "Print Ledger") the
 * statement prints the whole ledger, unchanged. The Jeweller Book passes
 * from/to/plabel so the printed statement covers only the selected period —
 * encoded into the engine's opaque recordId as `id~from~to~label`.
 */
const SearchSchema = z.object({
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  plabel: z.string().optional(),
  docType: z
    .enum(["customer_ledger_statement", "customer_unpaid_invoices", "customer_paid_invoices"])
    .optional(),
});

export const Route = createFileRoute("/people/ledger-print/$id")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Customer Document Print · ${shopName} ERP` }],
    };
  },
  component: LedgerPrintPage,
});

function LedgerPrintPage() {
  const { id } = useParams({ from: "/people/ledger-print/$id" });
  const { from, to, plabel, docType = "customer_ledger_statement" } = useSearch({
    from: "/people/ledger-print/$id",
  });
  const person = usePeople((s) => s.people.find((p) => p.id === id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void import("@/lib/billing-print-prep").then(({ ensureCustomerLedgerForPrint }) =>
      ensureCustomerLedgerForPrint(id).finally(() => {
        if (active) setLoading(false);
      }),
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (loading && !person) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading print document...</p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Customer not found</h1>
          <p className="text-sm text-muted-foreground">This person may have been removed.</p>
          <Link to="/people" className="text-gold underline">
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  // Compound recordId only when a period is supplied; bare id keeps People's
  // whole-ledger statement byte-for-byte unchanged.
  const recordId =
    from !== undefined && to !== undefined
      ? [person.id, from, to, plabel ?? "All Time"].join("~")
      : person.id;

  return <PrintEngine docType={docType} recordId={recordId} backUrl="/people" />;
}

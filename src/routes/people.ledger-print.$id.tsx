import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/people/ledger-print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Ledger Statement · ${shopName} ERP` }],
    };
  },
  component: LedgerPrintPage,
});

function LedgerPrintPage() {
  const { id } = useParams({ from: "/people/ledger-print/$id" });
  const person = usePeople((s) => s.people.find((p) => p.id === id));

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

  return <PrintEngine docType="customer_ledger_statement" recordId={person.id} backUrl="/people" />;
}

/**
 * Customer Settlement Draft Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useSettlements } from "@/lib/settlement-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/settlement/draft-print/$id")({
  head: () => ({ meta: [{ title: "Settlement Draft · AVS Gold ERP" }] }),
  component: SettlementDraftPrint,
});

function SettlementDraftPrint() {
  const { id } = useParams({ from: "/settlement/draft-print/$id" });
  const s = useSettlements((st) => st.settlements.find((x) => x.id === id));

  if (!s) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Settlement not found</h1>
          <Link to="/billing" className="text-gold underline">
            Back to Billing
          </Link>
        </div>
      </div>
    );
  }

  return <PrintEngine docType="settlement_draft" recordId={s.id} backUrl={`/settlement/${s.id}`} />;
}

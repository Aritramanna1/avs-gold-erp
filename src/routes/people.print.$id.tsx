/**
 * People KYC & Identity Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { usePeople } from "@/lib/people-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/people/print/$id")({
  head: () => ({ meta: [{ title: "KYC Document Print · AVS Gold ERP" }] }),
  component: PrintPage,
});

function PrintPage() {
  const { id } = useParams({ from: "/people/print/$id" });
  const person = usePeople((s) => s.people.find((p) => p.id === id));

  if (!person) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Person not found</h1>
          <Link to="/people" className="text-gold underline">
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  return <PrintEngine docType="worker_kyc" recordId={person.id} backUrl={`/people/${person.id}`} />;
}

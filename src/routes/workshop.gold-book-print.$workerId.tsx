import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/workshop/gold-book-print/$workerId")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName || "";
    return {
      meta: [{ title: `Worker Custody Statement · ${shopName} ERP` }],
    };
  },
  component: GoldBookPrintPage,
});

function GoldBookPrintPage() {
  const { workerId } = useParams({ from: "/workshop/gold-book-print/$workerId" });
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

  return (
    <PrintEngine
      docType="karigar_custody_statement"
      recordId={workerId}
      backUrl="/workshop/gold-book"
    />
  );
}

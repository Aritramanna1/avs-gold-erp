/**
 * Daily Close Report Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/reports/dailyclose-print/$id")({
  head: () => ({ meta: [{ title: "Daily Close Print · AVS Gold ERP" }] }),
  component: DailyClosePrint,
});

function DailyClosePrint() {
  const { id } = useParams({ from: "/reports/dailyclose-print/$id" });
  const c = useDailyCloses((s) => s.closes.find((x) => x.id === id));

  if (!c) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Daily Close Report not found</h1>
          <Link to="/reports/daily-close" className="text-gold underline">
            Back to Daily Close
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine docType="daily_close_report" recordId={c.id} backUrl="/reports/daily-close" />
  );
}

/**
 * Refinery Operations — Jewellery ERP module (NOT Platform Owner).
 * Tracks melt batches sent to refinery parties: send, receive, loss, recovery.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMeltStore } from "@/lib/melt-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { FlameKindling, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/refinery/")({
  head: () => ({ meta: [{ title: "Refinery Operations · Ornexa ERP" }] }),
  component: RefineryPage,
});

function RefineryPage() {
  const { jobs, refresh } = useMeltStore();
  const people = usePeople((s) => s.people);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void refresh().finally(() => setLoaded(true));
  }, [refresh]);

  const refineryParties = useMemo(
    () => people.filter((p) => p.type === "refinery" && p.active),
    [people],
  );

  const refineryJobs = useMemo(
    () =>
      jobs
        .filter(
          (j) =>
            j.refineryName ||
            j.refinerySentDate ||
            j.status === "processing" ||
            (j.refineryReceiptNo && j.refineryReceiptNo.length > 0),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [jobs],
  );

  const atRefinery = refineryJobs.filter((j) => j.status === "processing");
  const completed = refineryJobs.filter((j) => j.status === "completed");

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Refinery Operations"
        subtitle="Batch send/receive, recovery %, and melting loss against registered refinery parties."
        backTo="/melt"
        backLabel="Melt Account"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/melt">
              <ExternalLink className="h-4 w-4" /> Full Melt Book
            </Link>
          </Button>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 text-center">
        <div className="rounded-md border p-4 bg-card">
          <div className="text-2xl font-bold">{refineryParties.length}</div>
          <div className="text-xs text-muted-foreground">Refinery Parties</div>
        </div>
        <div className="rounded-md border p-4 bg-card">
          <div className="text-2xl font-bold text-amber-500">{atRefinery.length}</div>
          <div className="text-xs text-muted-foreground">At Refinery</div>
        </div>
        <div className="rounded-md border p-4 bg-card">
          <div className="text-2xl font-bold text-emerald-500">{completed.length}</div>
          <div className="text-xs text-muted-foreground">Received This Period</div>
        </div>
      </div>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading refinery batches…</p>
      ) : refineryJobs.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          No refinery batches yet. Create a melt job and record refinery send/receive dates in the{" "}
          <Link to="/melt" className="underline">
            Melt Account
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {refineryJobs.map((job) => (
            <div key={job.id} className="rounded-md border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <FlameKindling className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <div className="font-semibold font-mono">{job.jobNo}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {job.refineryName || "Refinery TBD"} · Sent {job.refinerySentDate ?? "—"} ·
                      Received {job.refineryReceivedDate ?? "—"}
                    </div>
                    <div className="text-xs mt-2">
                      Input fine {mgToGrams(job.totalInputFineMg)} g → Recovered{" "}
                      {mgToGrams(job.fineGoldRecoveredMg)} g · Loss {mgToGrams(job.lossFineMg)} g
                    </div>
                  </div>
                </div>
                <Badge variant="outline">{job.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

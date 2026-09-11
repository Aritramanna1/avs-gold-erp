import { useState, useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useJobCards, normalizeJobStatus, type JobCard } from "@/lib/jobcards-store";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/workshop/receive-slip/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Gold Receive Slip · ${shortName} ERP` }],
    };
  },
  component: ReceiveSlipPage,
});

function ReceiveSlipPage() {
  const { id } = useParams({ from: "/workshop/receive-slip/$id" });
  const [loading, setLoading] = useState(true);

  const job = useJobCards((s) =>
    s.jobs.find((j) => j.id === id || j.id.toLowerCase() === id.toLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;
    async function loadJob() {
      if (job?.workReceipt) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await (supabase as any)
          .from("job_cards")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        if (!cancelled && data?.data) {
          const loadedJob = data.data as JobCard;
          if (loadedJob && loadedJob.id) {
            const normalized = { ...loadedJob, status: normalizeJobStatus(loadedJob.status) };
            useJobCards.setState((s) => ({
              jobs: [...s.jobs.filter((j) => j.id !== normalized.id), normalized],
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load job card for receive slip:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadJob();
    return () => {
      cancelled = true;
    };
  }, [id, job?.workReceipt]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
        <div className="text-center space-y-3 flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-gold animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Gold Receive Sheet…</p>
        </div>
      </div>
    );
  }

  if (!job || !job.workReceipt) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Gold Receive Slip not available</h1>
          <p className="text-sm text-muted-foreground">
            No work receipt has been recorded yet for Job Card #{id?.slice(-6)?.toUpperCase()}.
          </p>
          <Link to="/workshop" className="text-gold underline">
            Back to Workshop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="gold_receive_slip"
      recordId={job.id}
      backUrl={`/workshop/${job.id}`}
    />
  );
}

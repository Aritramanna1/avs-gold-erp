import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const BUCKET_ACCENTS = [
  "border-l-gold/40",
  "border-l-emerald-500/40",
  "border-l-amber-500/40",
  "border-l-blue-500/40",
  "border-l-violet-500/40",
];

function KpiTileSkeleton() {
  return (
    <div className="erp-surface rounded-none p-3 space-y-2">
      <Skeleton className="h-2.5 w-16 bg-gold/10" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-2 w-24" />
    </div>
  );
}

export function HomeDashboardSkeleton({ phase }: { phase: "critical" | "secondary" }) {
  if (phase === "critical") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-sm" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {BUCKET_ACCENTS.map((accent, i) => (
          <Card key={i} className={`rounded-none border-l-2 ${accent} p-3 space-y-2`}>
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-5 w-10" />
          </Card>
        ))}
      </div>
      <Card className="ornexa-panel rounded-sm p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full rounded-sm" />
      </Card>
    </div>
  );
}

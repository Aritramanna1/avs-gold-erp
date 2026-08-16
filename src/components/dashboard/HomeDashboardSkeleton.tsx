import { Card } from "@/components/ui/card";

export function HomeDashboardSkeleton({ phase }: { phase: "critical" | "secondary" }) {
  if (phase === "critical") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 h-24 bg-muted/40" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4 animate-pulse">
      <Card className="p-4 h-40 bg-muted/30" />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 h-56 bg-muted/25" />
        <Card className="p-4 h-56 bg-muted/25" />
      </div>
    </div>
  );
}

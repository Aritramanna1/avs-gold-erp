import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { collectExceptions, type ExceptionItem, type ExceptionCategory } from "@/lib/exception-report";
import { RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reports/exceptions")({
  head: () => ({ meta: [{ title: "Exception Report · MTJ ERP" }] }),
  component: ExceptionReportPage,
});

const CATEGORY_LABELS: Record<ExceptionCategory, string> = {
  overdue_order: "Overdue Order",
  overdue_repair: "Overdue Repair",
  overdue_job_card: "Overdue Job Card",
  gold_discrepancy: "Gold Discrepancy",
  stock_shortage: "Stock Shortage",
};

function ExceptionReportPage() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ExceptionCategory | "all">("all");

  async function refresh() {
    setLoading(true);
    try {
      const items = await collectExceptions();
      setExceptions(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? exceptions : exceptions.filter((e) => e.category === filter)),
    [exceptions, filter],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { high: 0, medium: 0, low: 0 };
    for (const e of exceptions) out[e.severity] = (out[e.severity] ?? 0) + 1;
    return out;
  }, [exceptions]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Exception Report"
        subtitle="Everything needing manager attention right now — overdue work, gold discrepancies, and stock shortages, in one place."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="text-xs text-muted-foreground">High Severity</div>
          <div className="text-2xl font-semibold text-destructive">{counts.high ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Medium Severity</div>
          <div className="text-2xl font-semibold">{counts.medium ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Low Severity</div>
          <div className="text-2xl font-semibold">{counts.low ?? 0}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All ({exceptions.length})
        </Button>
        {(Object.keys(CATEGORY_LABELS) as ExceptionCategory[]).map((c) => {
          const n = exceptions.filter((e) => e.category === c).length;
          if (n === 0) return null;
          return (
            <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} onClick={() => setFilter(c)}>
              {CATEGORY_LABELS[c]} ({n})
            </Button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">Severity</th>
              <th className="p-3">Category</th>
              <th className="p-3">Title</th>
              <th className="p-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  {loading ? "Scanning…" : "No exceptions found — everything is on track."}
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Badge
                    variant={e.severity === "high" ? "destructive" : e.severity === "medium" ? "secondary" : "outline"}
                    className="gap-1"
                  >
                    {e.severity === "high" && <AlertTriangle className="h-3 w-3" />}
                    {e.severity}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">{CATEGORY_LABELS[e.category]}</td>
                <td className="p-3 font-medium">{e.title}</td>
                <td className="p-3 text-muted-foreground">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

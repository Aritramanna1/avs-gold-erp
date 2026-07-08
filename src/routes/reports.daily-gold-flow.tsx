import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { useLedger, computeBalances, type Bucket } from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports/daily-gold-flow")({
  head: () => ({ meta: [{ title: "Daily Gold Flow · AVS Gold ERP" }] }),
  component: DailyGoldFlowPage,
});

const BUCKETS: Bucket[] = ["vault", "karigar", "finished", "customer", "scrap"];
const BUCKET_LABELS: Record<Bucket, string> = {
  vault: "Vault",
  karigar: "Karigar",
  finished: "Finished",
  customer: "Customer",
  scrap: "Scrap",
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DailyGoldFlowPage() {
  const entries = useLedger((s) => s.entries);
  const [days, setDays] = useState(14);

  const rows = useMemo(() => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const inWindow = entries.filter((e) => e.createdAt >= since);
    const byDay = new Map<
      string,
      { in: number; out: number; net: number; buckets: Record<Bucket, number>; count: number }
    >();
    for (const e of inWindow) {
      const key = dayKey(e.createdAt);
      const row = byDay.get(key) ?? {
        in: 0,
        out: 0,
        net: 0,
        buckets: { vault: 0, karigar: 0, finished: 0, customer: 0, scrap: 0 },
        count: 0,
      };
      row.net += e.netFineMg;
      if (e.netFineMg > 0) row.in += e.netFineMg;
      else row.out += -e.netFineMg;
      for (const b of BUCKETS) row.buckets[b] += e.deltas[b] ?? 0;
      row.count += 1;
      byDay.set(key, row);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, r]) => ({ date, ...r }));
  }, [entries, days]);

  const balance = useMemo(() => computeBalances(entries), [entries]);

  function handleExport() {
    const rowsOut: (string | number)[][] = [
      [
        "Date",
        "Entries",
        "Gold In (g)",
        "Gold Out (g)",
        "Net (g)",
        ...BUCKETS.map((b) => `${BUCKET_LABELS[b]} Δ (g)`),
      ],
    ];
    for (const r of rows) {
      rowsOut.push([
        r.date,
        r.count,
        mgToGrams(r.in),
        mgToGrams(r.out),
        mgToGrams(r.net),
        ...BUCKETS.map((b) => mgToGrams(r.buckets[b])),
      ]);
    }
    exportToCSV(`daily-gold-flow-${new Date().toISOString().slice(0, 10)}.csv`, rowsOut);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Daily Gold Flow"
        subtitle="Day-by-day gold movement across every bucket — the ledger's own running total, sliced by day."
        actions={
          <div className="flex gap-2 items-center">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-background p-2 text-sm h-10"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-5 gap-3 mb-6">
        {BUCKETS.map((b) => (
          <div key={b} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {BUCKET_LABELS[b]}
            </div>
            <div className="text-lg font-mono font-bold">{mgToGrams(balance.buckets[b])} g</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Date</th>
                <th className="p-3">Entries</th>
                <th className="p-3 text-right">Gold In</th>
                <th className="p-3 text-right">Gold Out</th>
                <th className="p-3 text-right">Net</th>
                {BUCKETS.map((b) => (
                  <th key={b} className="p-3 text-right">
                    {BUCKET_LABELS[b]} Δ
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5 + BUCKETS.length}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No gold ledger activity in this window.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{r.date}</td>
                  <td className="p-3 text-muted-foreground">{r.count}</td>
                  <td className="p-3 text-right font-mono text-emerald-600">{mgToGrams(r.in)}</td>
                  <td className="p-3 text-right font-mono text-amber-600">{mgToGrams(r.out)}</td>
                  <td className="p-3 text-right font-mono">
                    <Badge
                      variant={r.net === 0 ? "secondary" : r.net > 0 ? "default" : "destructive"}
                    >
                      {mgToGrams(r.net)} g
                    </Badge>
                  </td>
                  {BUCKETS.map((b) => (
                    <td key={b} className="p-3 text-right font-mono text-muted-foreground">
                      {mgToGrams(r.buckets[b])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

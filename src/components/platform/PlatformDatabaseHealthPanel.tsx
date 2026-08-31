/**
 * Platform Owner — live PostgreSQL / database health (saas_admin RPC only).
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import {
  fetchPlatformDatabaseHealth,
  formatBytes,
  type PlatformDatabaseHealthSnapshot,
} from "@/lib/platform-database-health";

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="erp-surface rounded-md border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={`font-mono text-xl font-semibold mt-1 ${accent ?? "text-foreground"}`}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-muted-foreground mt-1">{sub}</div> : null}
    </div>
  );
}

export function PlatformDatabaseHealthPanel() {
  const [data, setData] = useState<PlatformDatabaseHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snap = await fetchPlatformDatabaseHealth();
    if (!snap) {
      setError(
        "Could not load database health. Ensure get_platform_database_health RPC is applied and you are signed in as Platform Owner.",
      );
      setData(null);
    } else {
      setData(snap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const errorRate24h =
    data && data.errors_last_24h > 0
      ? `${data.critical_errors_last_24h} critical / ${data.errors_last_24h} total (24h)`
      : "No error events in 24h";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-gold">Database Health Monitor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live PostgreSQL connectivity, size, connections, and platform error telemetry — not
            simulated values.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="DB ping"
              value={`${data.ping_ms}ms`}
              sub={data.checked_at ? new Date(data.checked_at).toLocaleString("en-IN") : undefined}
              accent={data.ping_ms > 500 ? "text-amber-400" : "text-emerald-400"}
            />
            <Stat
              label="Database size"
              value={formatBytes(data.database_size_bytes)}
              sub="pg_database_size(current_database())"
            />
            <Stat
              label="Active connections"
              value={String(data.active_connections)}
              sub="pg_stat_activity (this database)"
              accent={data.active_connections > 40 ? "text-amber-400" : undefined}
            />
            <Stat
              label="Errors (1h / 24h)"
              value={`${data.errors_last_1h} / ${data.errors_last_24h}`}
              sub={errorRate24h}
              accent={data.critical_errors_last_24h > 0 ? "text-red-400" : "text-emerald-400"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Organizations"
              value={`${data.active_organizations} / ${data.total_organizations}`}
              sub="active / total"
            />
            <Stat
              label="Active subscriptions"
              value={String(data.active_subscriptions)}
            />
            <Stat
              label="Rate-limit buckets (hits)"
              value={String(
                data.rate_limit_buckets.reduce((sum, b) => sum + (b.hits ?? 0), 0),
              )}
              sub={`${data.rate_limit_buckets.length} RPC buckets tracked`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="erp-surface rounded-md border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Largest tables (public)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-1.5">Table</th>
                      <th className="text-right py-1.5">Rows</th>
                      <th className="text-right py-1.5">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.largest_tables.map((t) => (
                      <tr key={t.table} className="border-b border-border/50">
                        <td className="py-1.5 font-mono">{t.table}</td>
                        <td className="py-1.5 text-right font-mono">{t.live_rows?.toLocaleString()}</td>
                        <td className="py-1.5 text-right font-mono">{formatBytes(t.size_bytes)}</td>
                      </tr>
                    ))}
                    {data.largest_tables.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">
                          No table stats returned.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="erp-surface rounded-md border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Errors by category (24h)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-1.5">Category</th>
                      <th className="text-right py-1.5">Count</th>
                      <th className="text-right py-1.5">Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.errors_by_category_24h.map((row) => (
                      <tr key={row.category} className="border-b border-border/50">
                        <td className="py-1.5 font-mono">{row.category}</td>
                        <td className="py-1.5 text-right font-mono">{row.count}</td>
                        <td className="py-1.5 text-right font-mono text-red-400">{row.critical}</td>
                      </tr>
                    ))}
                    {data.errors_by_category_24h.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">
                          No categorized errors in the last 24 hours.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading database health…
        </div>
      ) : null}
    </div>
  );
}

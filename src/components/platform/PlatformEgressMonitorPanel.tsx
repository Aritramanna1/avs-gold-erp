/**
 * Platform Owner — egress / API pressure observability (saas_admin only).
 * Server RPC + optional client session snapshot from __ORNEXA_EGRESS__.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import {
  fetchPlatformEgressObservability,
  formatBytes,
  readPlatformClientEgressSnapshot,
  type PlatformClientEgressSnapshot,
  type PlatformEgressObservabilitySnapshot,
} from "@/lib/platform-database-health";

export function PlatformEgressMonitorPanel() {
  const [server, setServer] = useState<PlatformEgressObservabilitySnapshot | null>(null);
  const [client, setClient] = useState<PlatformClientEgressSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snap = await fetchPlatformEgressObservability();
    if (!snap) {
      setError(
        "Could not load egress observability. Apply get_platform_egress_observability migration and use Platform Owner access.",
      );
      setServer(null);
    } else {
      setServer(snap);
    }
    setClient(readPlatformClientEgressSnapshot());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-gold">Egress & API Pressure Monitor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-side rate-limit buckets and PostgreSQL-related error signals. Client login-boot
            counts shown when this browser session has instrumentation active.
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
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          {error}
        </div>
      ) : null}

      {server?.note ? (
        <p className="text-[11px] text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/20">
          {server.note}
        </p>
      ) : null}

      {server ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="erp-surface rounded-md border border-border p-4">
            <div className="text-[10px] uppercase text-muted-foreground font-mono">Rate-limit hits</div>
            <div className="font-mono text-xl font-semibold mt-1">{server.rate_limit_total_hits}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {server.rate_limit_distinct_users} users in buckets
            </div>
          </div>
          <div className="erp-surface rounded-md border border-border p-4">
            <div className="text-[10px] uppercase text-muted-foreground font-mono">RPC query time</div>
            <div className="font-mono text-xl font-semibold mt-1">{server.query_ms}ms</div>
          </div>
          <div className="erp-surface rounded-md border border-border p-4">
            <div className="text-[10px] uppercase text-muted-foreground font-mono">
              Postgres-related errors (24h)
            </div>
            <div className="font-mono text-xl font-semibold mt-1">
              {server.postgres_related_errors_24h.length}
            </div>
          </div>
        </div>
      ) : null}

      {client?.loginBoot ? (
        <div className="erp-surface rounded-md border border-gold/30 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gold">
            This browser session — last login boot
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div>REST: {client.loginBoot.restRequests}</div>
            <div>Auth: {client.loginBoot.authRequests}</div>
            <div>Realtime: {client.loginBoot.realtimeEvents}</div>
            <div>Storage: {client.loginBoot.storageRequests}</div>
            <div>Deduped: {client.loginBoot.dedupedRequests}</div>
            <div>Blocked: {client.loginBoot.blockedRequests}</div>
            <div>Bytes: {formatBytes(client.loginBoot.totalBytes)}</div>
            <div>Duration: {client.loginBoot.durationMs ?? "—"}ms</div>
          </div>
        </div>
      ) : null}

      {client?.sessionTotals ? (
        <div className="text-[11px] text-muted-foreground font-mono">
          Session totals — requests: {client.sessionTotals.totalRequests}, deduped:{" "}
          {client.sessionTotals.dedupedRequests}, blocked: {client.sessionTotals.blockedRequests},
          bytes: {formatBytes(client.sessionTotals.totalBytes)}
        </div>
      ) : null}

      {server ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="erp-surface rounded-md border border-border p-4 overflow-x-auto">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Rate-limit buckets
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5">Bucket</th>
                  <th className="text-right py-1.5">Users</th>
                  <th className="text-right py-1.5">Hits</th>
                </tr>
              </thead>
              <tbody>
                {server.rate_limit_buckets.map((b) => (
                  <tr key={b.bucket} className="border-b border-border/50">
                    <td className="py-1.5 font-mono">{b.bucket}</td>
                    <td className="py-1.5 text-right font-mono">{b.users}</td>
                    <td className="py-1.5 text-right font-mono">{b.hits}</td>
                  </tr>
                ))}
                {server.rate_limit_buckets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No rate-limit bucket activity recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="erp-surface rounded-md border border-border p-4 overflow-x-auto">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              PostgreSQL / timeout signals (24h)
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5">Time</th>
                  <th className="text-left py-1.5">Severity</th>
                  <th className="text-left py-1.5">Message</th>
                </tr>
              </thead>
              <tbody>
                {server.postgres_related_errors_24h.map((e, i) => (
                  <tr key={`${e.created_at}-${i}`} className="border-b border-border/50">
                    <td className="py-1.5 font-mono whitespace-nowrap text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="py-1.5">{e.severity}</td>
                    <td className="py-1.5">{e.message}</td>
                  </tr>
                ))}
                {server.postgres_related_errors_24h.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No PostgreSQL-related client errors in the last 24 hours.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading egress observability…
        </div>
      ) : null}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  searchCommunicationHistory,
  getCommunicationAnalytics,
  type CommAnalytics,
} from "@/lib/comm/comm-analytics";
import { COMM_KIND_LABELS, type CommEvent } from "@/lib/comm-log-store";
import { exportToCSV } from "@/lib/report-engine";
import { RefreshCw, Loader2, MessageSquare, Download } from "lucide-react";

export const Route = createFileRoute("/reports/communication-analytics")({
  head: () => ({ meta: [{ title: "Communication Analytics · AVS Gold ERP" }] }),
  component: CommunicationAnalyticsPage,
});

function CommunicationAnalyticsPage() {
  const [analytics, setAnalytics] = useState<CommAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [windowDays, setWindowDays] = useState(30);

  async function refresh() {
    setLoading(true);
    try {
      setAnalytics(await getCommunicationAnalytics(windowDays));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  const history: CommEvent[] = useMemo(
    () =>
      searchCommunicationHistory({ recipientQuery: q || undefined })
        .slice()
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 200),
    [q, analytics],
  );

  function handleCSV() {
    const header = [
      "Time",
      "Recipient",
      "Phone",
      "Template",
      "Outcome",
      "Delivery Status",
      "Linked Type",
      "Linked Id",
    ];
    const data = history.map((e) => [
      new Date(e.ts).toLocaleString(),
      e.recipientLabel,
      e.recipientPhone,
      e.templateName,
      COMM_KIND_LABELS[e.kind as keyof typeof COMM_KIND_LABELS] || e.kind || "unknown",
      e.deliveryStatus ?? "manual",
      e.linkedType,
      e.linkedId,
    ]);
    exportToCSV("communication-history.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Communication Analytics & History"
        subtitle="Every prepared/sent WhatsApp message and its outcome, plus a rolling analytics window and retry-queue snapshot."
        actions={
          <div className="flex gap-2 items-center">
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-background p-2 text-sm h-10"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button variant="outline" onClick={handleCSV} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      {analytics && (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Total Logged ({windowDays}d)</div>
              <div className="text-2xl font-semibold">{analytics.totalLogged}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Queue Pending</div>
              <div className="text-2xl font-semibold">{analytics.queue.pending}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Queue Sent</div>
              <div className="text-2xl font-semibold text-green-600">{analytics.queue.sent}</div>
            </div>
            <div
              className={`rounded-2xl border p-4 ${analytics.queue.permanentlyFailed > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
            >
              <div className="text-xs text-muted-foreground">Permanently Failed</div>
              <div
                className={`text-2xl font-semibold ${analytics.queue.permanentlyFailed > 0 ? "text-destructive" : ""}`}
              >
                {analytics.queue.permanentlyFailed}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="font-semibold text-sm mb-2">By Outcome</div>
              {Object.entries(analytics.byKind).map(([kind, count]) => (
                <div key={kind} className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground">
                    {COMM_KIND_LABELS[kind as keyof typeof COMM_KIND_LABELS] ?? kind}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.byKind).length === 0 && (
                <div className="text-sm text-muted-foreground">No data in this window.</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="font-semibold text-sm mb-2">By Template</div>
              {Object.entries(analytics.byTemplate).map(([tpl, count]) => (
                <div key={tpl} className="flex justify-between text-sm py-1">
                  <span className="text-muted-foreground truncate">{tpl}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.byTemplate).length === 0 && (
                <div className="text-sm text-muted-foreground">No data in this window.</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="font-semibold text-sm mb-2">By Linked Record</div>
              {Object.entries(analytics.byLinkedType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm py-1 capitalize">
                  <span className="text-muted-foreground">{type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.byLinkedType).length === 0 && (
                <div className="text-sm text-muted-foreground">No data in this window.</div>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="font-semibold text-sm mb-2">By Delivery Status</div>
              {Object.entries(analytics.byDeliveryStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm py-1 capitalize">
                  <span className="text-muted-foreground">{status}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(analytics.byDeliveryStatus).length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No API-provider deliveries in this window (manual flow only).
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search history by recipient name or phone"
        className="mb-4 max-w-sm"
      />

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Communication History
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Time</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Template</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Delivery Status</th>
                <th className="p-3">Linked</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No communication history matches.
                  </td>
                </tr>
              )}
              {history.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{new Date(e.ts).toLocaleString()}</td>
                  <td className="p-3">
                    {e.recipientLabel}{" "}
                    <span className="text-muted-foreground">({e.recipientPhone})</span>
                  </td>
                  <td className="p-3">{e.templateName}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{COMM_KIND_LABELS[e.kind]}</Badge>
                  </td>
                  <td className="p-3">
                    {e.deliveryStatus ? (
                      <Badge
                        variant="outline"
                        className={
                          e.deliveryStatus === "failed"
                            ? "border-destructive/40 text-destructive"
                            : e.deliveryStatus === "delivered"
                              ? "border-emerald-500/40 text-emerald-500"
                              : ""
                        }
                      >
                        {e.deliveryStatus}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Manual flow — no API status
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground capitalize">
                    {e.linkedType} · {e.linkedId.slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

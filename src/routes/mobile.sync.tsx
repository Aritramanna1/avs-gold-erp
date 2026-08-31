import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  CloudOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Wifi,
} from "lucide-react";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { isOnline, subscribeNetworkStatus, probeSupabaseReachable } from "@/lib/native/network";
import {
  discardOperation,
  loadQueueSnapshot,
  processOfflineQueue,
  subscribeOfflineSync,
  type OfflineOperation,
} from "@/lib/offline";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/sync")({
  head: () => ({ meta: [{ title: "Sync Status · AVS ERP" }] }),
  component: MobileSyncCentrePage,
});

function statusLabel(status: OfflineOperation["status"]): string {
  switch (status) {
    case "pending_sync":
      return "Pending Sync";
    case "syncing":
      return "Syncing";
    case "synced":
      return "Synced";
    case "needs_attention":
      return "Needs Attention";
    case "discarded":
      return "Discarded";
    default:
      return status;
  }
}

function MobileSyncCentrePage() {
  const isMobile = usePhoneChrome();
  const [online, setOnline] = useState(isOnline());
  const [ops, setOps] = useState<OfflineOperation[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cloudOk, setCloudOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const snap = await loadQueueSnapshot();
    setOps(snap.operations.filter((o) => o.status !== "discarded").slice(0, 100));
    setLastSync(snap.lastSuccessfulSyncAt);
    const reach = await probeSupabaseReachable(5000);
    setCloudOk(reach.ok);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    void refresh();
    return subscribeOfflineSync(() => {
      void refresh();
    });
  }, [isMobile, refresh]);

  useEffect(() => subscribeNetworkStatus(setOnline), []);

  if (!isMobile) {
    return <Navigate to="/settings" replace />;
  }

  async function syncNow() {
    if (!online) {
      toast.error("Internet connection required to sync.");
      return;
    }
    setBusy(true);
    try {
      const result = await processOfflineQueue({ manual: true });
      await refresh();
      if (result.processed > 0) toast.success(`Synced ${result.processed} item(s).`);
      else if (result.attention > 0) toast.message("Some changes need review.");
      else toast.message("Nothing new to sync yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-28 space-y-4">
      <div>
        <h1 className="font-serif text-2xl text-foreground">Sync Status</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Queued work waits for AVS ERP cloud confirmation. Nothing is final until the server accepts
          it.
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {online && cloudOk !== false ? (
            <Wifi className="h-4 w-4 text-emerald-600" />
          ) : (
            <CloudOff className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium">
            {!online
              ? "Network unavailable"
              : cloudOk === false
                ? "Backend temporarily unavailable"
                : "Online"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Last successful sync:{" "}
          {lastSync ? new Date(lastSync).toLocaleString("en-IN") : "Not yet"}
        </p>
        <Button
          type="button"
          size="sm"
          className="w-full gap-2"
          disabled={busy || !online}
          onClick={() => void syncNow()}
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Sync Now
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Queued operations
        </h2>
        {ops.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-4 text-center">
            No pending changes.
          </p>
        ) : (
          ops.map((op) => (
            <article
              key={op.localId}
              className="rounded-md border border-border bg-card p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{op.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{op.summary}</p>
                </div>
                <StatusPill status={op.status} />
              </div>
              {op.conflictReason || op.lastError ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 flex gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{op.conflictReason || op.lastError}</span>
                </p>
              ) : null}
              {op.status === "needs_attention" ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      void discardOperation(op.localId).then(() => {
                        toast.message("Discarded local change.");
                        void refresh();
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Discard
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!online}
                    onClick={() => void syncNow()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      <p className="text-[10px] text-muted-foreground text-center">
        Gold and accounting posts stay <strong>Pending Server Validation</strong> until the cloud
        re-checks balances and permissions.{" "}
        <Link to="/help" className="underline">
          Learn more
        </Link>
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: OfflineOperation["status"] }) {
  const label = statusLabel(status);
  const icon =
    status === "synced" ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : status === "needs_attention" ? (
      <AlertTriangle className="h-3 w-3" />
    ) : (
      <Clock className="h-3 w-3" />
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold shrink-0">
      {icon}
      {label}
    </span>
  );
}

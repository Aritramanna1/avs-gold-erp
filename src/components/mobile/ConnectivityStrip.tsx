import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CloudOff, RefreshCw, CloudUpload, ServerCrash } from "lucide-react";
import { isOnline, subscribeNetworkStatus } from "@/lib/native/network";
import {
  connectivityLabel,
  refreshConnectivityStatus,
  subscribeConnectivity,
  type ConnectivitySnapshot,
} from "@/lib/native/connectivity-status";
import { getQueueStats, processOfflineQueue, subscribeOfflineSync } from "@/lib/offline";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * Restrained connectivity + queue strip under the single app header.
 * Device offline ≠ single query failure ≠ backend outage.
 */
export function ConnectivityStrip({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [attention, setAttention] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [conn, setConn] = useState<ConnectivitySnapshot | null>(null);

  async function refreshStats() {
    const s = await getQueueStats();
    setPending(s.pending + s.syncing);
    setAttention(s.needsAttention);
  }

  useEffect(() => subscribeNetworkStatus(setOnline), []);
  useEffect(() => subscribeConnectivity(setConn), []);
  useEffect(() => {
    void refreshStats();
    void refreshConnectivityStatus();
    return subscribeOfflineSync(() => {
      void refreshStats();
    });
  }, []);

  const backendIssue = conn?.kind === "backend_unavailable" && online;
  const show = !online || backendIssue || pending > 0 || attention > 0;
  if (!show) return null;

  return (
    <div
      className={cn(
        "ornexa-connectivity-strip",
        !online || backendIssue
          ? "ornexa-connectivity-strip--offline"
          : "ornexa-connectivity-strip--pending",
        className,
      )}
      role="status"
    >
      {!online ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      ) : backendIssue ? (
        <ServerCrash className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CloudUpload className="h-3.5 w-3.5 shrink-0" />
      )}
      <p className="flex-1 min-w-0 truncate">
        {!online
          ? t("common.offlineBanner")
          : backendIssue
            ? conn?.detail || connectivityLabel("backend_unavailable")
            : attention > 0
              ? `${attention} ${t("common.changesNeedReview")}`
              : `${pending} ${t("common.waitingToSync")}`}
      </p>
      <Link to="/mobile/sync" className="underline shrink-0 text-[10px] font-bold uppercase">
        {t("common.syncStatus")}
      </Link>
      {online ? (
        <button
          type="button"
          className="shrink-0 p-1 rounded hover:bg-black/5"
          aria-label={t("common.syncNow")}
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            void Promise.all([
              processOfflineQueue({ manual: true }),
              refreshConnectivityStatus(),
            ]).finally(() => {
              setSyncing(false);
              void refreshStats();
            });
          }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
        </button>
      ) : null}
    </div>
  );
}

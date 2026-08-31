/**
 * Registers in-app communication/report schedulers and retry drains on ERP boot.
 */
import { registerScheduledReportJobs } from "@/lib/comm/scheduled-reports";
import { registerWeeklyStatementJobs } from "@/lib/comm/scheduled-statements";
import { registerGoldReconciliationJob } from "@/lib/reconciliation/scheduled-reconciliation";
import { registerDisasterRecoveryDrillJob } from "@/lib/security/disaster-recovery";
import { registerJob, startScheduler } from "@/lib/comm/scheduler";
import { startCommQueueScheduler } from "@/lib/comm/comm-queue";
import { invokeCommunicationScheduler } from "@/lib/comm/communication-scheduler-client";
import { loadCommunicationPolicy } from "@/lib/communication-policy";
import { resumePendingPushRoute } from "@/lib/deep-link";
import { checkAndNotifyDelayedOrders } from "@/lib/comm/order-delay-monitor";

let booted = false;

function devSchedulerIntervals(): {
  schedulerMs: number;
  commQueueMs: number;
  edgeMs: number;
} {
  const devQuiet =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_COMM_SCHEDULER !== "1";
  if (!devQuiet) {
    return { schedulerMs: 60_000, commQueueMs: 30_000, edgeMs: 60 * 60_000 };
  }
  return { schedulerMs: 5 * 60_000, commQueueMs: 5 * 60_000, edgeMs: 4 * 60 * 60_000 };
}

export function bootCommunicationRuntime(): () => void {
  if (booted) return () => undefined;
  booted = true;

  registerScheduledReportJobs();
  registerWeeklyStatementJobs();
  registerGoldReconciliationJob();
  registerDisasterRecoveryDrillJob();

  // Daily sweep for overdue orders to dispatch delay apologies automatically
  registerJob({
    key: "order_delay_auto_apology_sweep",
    cadence: "daily",
    run: async () => {
      await checkAndNotifyDelayedOrders();
    },
  });

  // Background check on startup after data loads
  setTimeout(() => {
    void checkAndNotifyDelayedOrders().catch((err) =>
      console.warn("[comm-boot] initial order delay check:", err),
    );
  }, 5000);

  void loadCommunicationPolicy().catch((err) =>
    console.warn("[comm-boot] communication policy:", err),
  );
  void resumePendingPushRoute().catch(() => undefined);

  const { schedulerMs, commQueueMs, edgeMs } = devSchedulerIntervals();
  const stopScheduler = startScheduler(schedulerMs);
  const stopCommQueue = startCommQueueScheduler(commQueueMs);

  void invokeCommunicationScheduler().catch((err) =>
    console.warn("[comm-boot] scheduler invoke:", err),
  );

  const edgeInterval = setInterval(() => {
    void invokeCommunicationScheduler().catch((err) =>
      console.warn("[comm-boot] periodic scheduler invoke:", err),
    );
  }, edgeMs);

  return () => {
    stopScheduler();
    stopCommQueue();
    clearInterval(edgeInterval);
    booted = false;
  };
}

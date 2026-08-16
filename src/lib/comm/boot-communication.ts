/**
 * Registers in-app communication/report schedulers and retry drains on ERP boot.
 */
import { registerScheduledReportJobs } from "@/lib/comm/scheduled-reports";
import { registerWeeklyStatementJobs } from "@/lib/comm/scheduled-statements";
import { registerGoldReconciliationJob } from "@/lib/reconciliation/scheduled-reconciliation";
import { registerDisasterRecoveryDrillJob } from "@/lib/security/disaster-recovery";
import { startScheduler } from "@/lib/comm/scheduler";
import { startCommQueueScheduler } from "@/lib/comm/comm-queue";
import { invokeCommunicationScheduler } from "@/lib/comm/communication-scheduler-client";

let booted = false;

export function bootCommunicationRuntime(): () => void {
  if (booted) return () => undefined;
  booted = true;

  registerScheduledReportJobs();
  registerWeeklyStatementJobs();
  registerGoldReconciliationJob();
  registerDisasterRecoveryDrillJob();

  const stopScheduler = startScheduler(60_000);
  const stopCommQueue = startCommQueueScheduler(30_000);

  void invokeCommunicationScheduler().catch((err) =>
    console.warn("[comm-boot] scheduler invoke:", err),
  );

  const edgeInterval = setInterval(() => {
    void invokeCommunicationScheduler().catch((err) =>
      console.warn("[comm-boot] periodic scheduler invoke:", err),
    );
  }, 15 * 60_000);

  return () => {
    stopScheduler();
    stopCommQueue();
    clearInterval(edgeInterval);
    booted = false;
  };
}

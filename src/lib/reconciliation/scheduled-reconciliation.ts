/** Registers the Gold Reconciliation Engine as a daily scheduled job (Priority 6 + Plan 1 Step 9's scheduler). */
import { registerJob } from "@/lib/comm/scheduler";
import { runGoldReconciliation } from "./gold-reconciliation";

export function registerGoldReconciliationJob(): void {
  registerJob({
    key: "gold_reconciliation_daily",
    cadence: "daily",
    run: async () => {
      await runGoldReconciliation();
    },
  });
}

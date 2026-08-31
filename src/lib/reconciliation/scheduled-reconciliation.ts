/** Registers the Gold Reconciliation Engine as a daily scheduled job (Priority 6 + Plan 1 Step 9's scheduler). */
import { registerJob } from "@/lib/comm/scheduler";
import { runGoldReconciliation } from "./gold-reconciliation";
import {
  runBalanceReconciliationChecks,
  summarizeReconciliationChecks,
} from "@/lib/balance-reconciliation";

export function registerGoldReconciliationJob(): void {
  registerJob({
    key: "gold_reconciliation_daily",
    cadence: "daily",
    run: async () => {
      await runGoldReconciliation();
      // CVsE73i6 shop parity: also run cross-module balance checks.
      const checks = runBalanceReconciliationChecks();
      const summary = summarizeReconciliationChecks(checks);
      if (summary.fail > 0) {
        console.warn("[reconciliation] balance checks failed:", summary, checks.filter((c) => c.status === "fail"));
      }
    },
  });
}

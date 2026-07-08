/**
 * Disaster Recovery Validation (Step 8) — an automatic, recurring drill
 * proving backups are genuinely restorable, not just "a backup file
 * exists." Every drill run is itself recorded in the immutable audit log
 * (Plan 1 Step 8) — a disaster-recovery capability that silently rotted
 * would be exactly the kind of gap that never gets discovered until it's
 * actually needed, so its own health is auditable too.
 */
import { createBackupSnapshot, verifyBackupRestorable } from "@/lib/local-db";
import { append as appendAuditEntry } from "./audit-log";
import { registerJob } from "@/lib/comm/scheduler";

export interface DrillResult {
  ranAt: string;
  ok: boolean;
  checksumVerified: boolean;
  integrityCheckPassed: boolean;
  sizeBytes: number;
  issues: string[];
}

/**
 * Creates a real backup snapshot of the CURRENT live database and verifies
 * it is restorable (decrypt + checksum + integrity_check) without ever
 * touching the live database itself. Never throws — a drill that fails is
 * exactly the finding this exists to surface, so failure is returned as
 * `{ ok: false, issues: [...] }` and recorded, not thrown past the caller.
 */
export async function runDisasterRecoveryDrill(): Promise<DrillResult> {
  const ranAt = new Date().toISOString();
  try {
    const snapshot = await createBackupSnapshot();
    const verification = await verifyBackupRestorable(snapshot);

    await appendAuditEntry({
      actorId: null,
      actorEmail: null,
      action: verification.ok ? "disaster_recovery.drill_passed" : "disaster_recovery.drill_failed",
      entityType: "disaster_recovery",
      entityId: ranAt,
      before: null,
      after: verification,
      deviceId: null,
    });

    return { ranAt, ...verification };
  } catch (err) {
    const failure: DrillResult = {
      ranAt,
      ok: false,
      checksumVerified: false,
      integrityCheckPassed: false,
      sizeBytes: 0,
      issues: [err instanceof Error ? err.message : String(err)],
    };
    await appendAuditEntry({
      actorId: null,
      actorEmail: null,
      action: "disaster_recovery.drill_failed",
      entityType: "disaster_recovery",
      entityId: ranAt,
      before: null,
      after: failure,
      deviceId: null,
    }).catch(() => {});
    return failure;
  }
}

/** Runs the drill automatically, weekly, via the shared scheduler (scheduler.ts) — a monthly-only cadence isn't offered by the scheduler today (daily/weekly/monthly), weekly is the closer, safer default for catching regressions sooner. */
export function registerDisasterRecoveryDrillJob(): void {
  registerJob({
    key: "disaster_recovery_drill_weekly",
    cadence: "weekly",
    run: async () => {
      await runDisasterRecoveryDrill();
    },
  });
}

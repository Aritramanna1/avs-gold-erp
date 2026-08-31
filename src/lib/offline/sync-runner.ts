/**
 * Background sync runner — dependency-aware, exponential backoff, idempotent.
 * Applies via canonical domain adapters; never invents gold/account balances.
 */
import { isOnline, subscribeAppResume } from "@/lib/native/network";
import { loadQueueSnapshot, saveQueueSnapshot } from "./storage";
import { orderReadyOperations, updateOperation } from "./queue";
import { applyOfflineOperation } from "./adapters";

function backoffMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6));
  return base + Math.floor(Math.random() * 400);
}

let running = false;
const listeners = new Set<() => void>();

export function subscribeOfflineSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export async function processOfflineQueue(opts?: { manual?: boolean }): Promise<{
  processed: number;
  failed: number;
  attention: number;
}> {
  if (running) return { processed: 0, failed: 0, attention: 0 };
  if (!isOnline()) return { processed: 0, failed: 0, attention: 0 };

  running = true;
  let processed = 0;
  let failed = 0;
  let attention = 0;

  try {
    const snap = await loadQueueSnapshot();
    snap.lastAttemptAt = new Date().toISOString();
    await saveQueueSnapshot(snap);

    const ordered = orderReadyOperations(
      snap.operations.filter((o) => o.status !== "synced" && o.status !== "discarded"),
    );

    const now = Date.now();
    for (const op of ordered) {
      if (op.nextAttemptAt && new Date(op.nextAttemptAt).getTime() > now && !opts?.manual) {
        continue;
      }
      const depsPending = op.dependsOnLocalIds.some((id) => {
        const d = snap.operations.find((x) => x.localId === id);
        return d && d.status !== "synced";
      });
      if (depsPending) continue;

      await updateOperation(op.localId, { status: "syncing" });
      emit();

      try {
        const result = await applyOfflineOperation(op);
        if (result.ok) {
          await updateOperation(op.localId, {
            status: "synced",
            resultServerIds: result.serverIds,
            lastError: undefined,
            conflictReason: undefined,
            nextAttemptAt: null,
          });
          processed++;
        } else if (result.needsAttention) {
          await updateOperation(op.localId, {
            status: "needs_attention",
            conflictReason: result.reason,
            lastError: result.reason,
            attemptCount: op.attemptCount + 1,
          });
          attention++;
          void import("@/lib/notifications/erp-events").then(({ notifyStaffSyncAttention }) =>
            notifyStaffSyncAttention({ operationId: op.localId }),
          );
        } else {
          const attempt = op.attemptCount + 1;
          await updateOperation(op.localId, {
            status: "pending_sync",
            lastError: result.reason,
            attemptCount: attempt,
            nextAttemptAt: new Date(Date.now() + backoffMs(attempt)).toISOString(),
          });
          failed++;
        }
      } catch (err) {
        const attempt = op.attemptCount + 1;
        await updateOperation(op.localId, {
          status: "pending_sync",
          lastError: err instanceof Error ? err.message : "Sync failed",
          attemptCount: attempt,
          nextAttemptAt: new Date(Date.now() + backoffMs(attempt)).toISOString(),
        });
        failed++;
      }
      emit();
    }

    if (processed > 0) {
      const s3 = await loadQueueSnapshot();
      s3.lastSuccessfulSyncAt = new Date().toISOString();
      await saveQueueSnapshot(s3);
      void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => emitUiFeedback("sync"));
    }
  } finally {
    running = false;
    emit();
  }

  return { processed, failed, attention };
}

let autoStarted = false;

/** Call once from app bootstrap — auto sync on online, resume, and 45s drain. Web and native. */
export function startOfflineSyncAutopilot(): () => void {
  if (autoStarted || typeof window === "undefined") return () => {};
  autoStarted = true;

  const tick = () => {
    void processOfflineQueue();
  };

  window.addEventListener("online", tick);
  const interval = window.setInterval(tick, 45_000);
  let unsubResume: (() => void) | undefined;
  void subscribeAppResume(tick).then((u) => {
    unsubResume = u;
  });
  tick();

  return () => {
    window.removeEventListener("online", tick);
    window.clearInterval(interval);
    unsubResume?.();
    autoStarted = false;
  };
}

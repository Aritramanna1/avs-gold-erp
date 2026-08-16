/**
 * Client-side communication scheduler trigger.
 * Uses the authenticated RPC when available and always runs in-app queue/report drains.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { checkDueJobs } from "@/lib/comm/scheduler";
import { drainCommQueue } from "@/lib/comm/comm-queue";

let lastInvokeAt = 0;
const MIN_INTERVAL_MS = 5 * 60_000;

export async function invokeCommunicationScheduler(force = false): Promise<{
  ok: boolean;
  skipped?: boolean;
  result?: unknown;
  error?: string;
}> {
  const now = Date.now();
  if (!force && now - lastInvokeAt < MIN_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }

  try {
    const [dueJobs, queueDrain] = await Promise.all([checkDueJobs(), drainCommQueue()]);

    const { error: rpcError } = await supabase.rpc("invoke_communication_scheduler" as never);
    lastInvokeAt = now;

    return {
      ok: true,
      result: {
        dueJobs,
        queueDrain,
        rpcInvoked: !rpcError,
        rpcError: rpcError?.message ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Scheduler invoke failed",
    };
  }
}

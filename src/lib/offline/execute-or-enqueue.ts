/**
 * Online-first helper: run immediately when connected, else enqueue safely.
 */
import { isOnline } from "@/lib/native/network";
import { classifyOfflineAction, isOnlineRequired } from "./classifier";
import { enqueueOfflineOperation, OnlineRequiredError, type EnqueueInput } from "./queue";
import type { OfflineOperation } from "./types";

export type ExecuteOrEnqueueResult =
  | { mode: "executed"; result: unknown }
  | { mode: "queued"; operation: OfflineOperation };

/**
 * @param action classifier key e.g. party.create / order.draft / photo.upload
 * @param runOnline canonical domain call when online
 * @param enqueue payload used when offline
 */
export async function executeOrEnqueue(
  action: string,
  runOnline: () => Promise<unknown>,
  enqueue: Omit<EnqueueInput, "action">,
): Promise<ExecuteOrEnqueueResult> {
  const classified = classifyOfflineAction(action);

  if (!isOnline()) {
    if (classified.capability === "ONLINE_REQUIRED" || isOnlineRequired(action)) {
      throw new OnlineRequiredError(
        classified.onlineMessage ?? "Internet connection required for this action.",
      );
    }
    const operation = await enqueueOfflineOperation({
      action,
      capability: classified.capability,
      ...enqueue,
    });
    return { mode: "queued", operation };
  }

  const result = await runOnline();
  return { mode: "executed", result };
}

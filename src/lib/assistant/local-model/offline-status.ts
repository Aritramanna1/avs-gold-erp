/**
 * Assistant offline draft / queue status cards.
 * Gold & accounting never invent balances offline.
 */

import type { ERPActionCard } from "../assistant-types";
import { isOnline } from "@/lib/native/network";

export async function buildOfflineAssistantStatusCard(): Promise<ERPActionCard | null> {
  if (isOnline()) return null;

  let pending = 0;
  try {
    const { countPendingOps } = await import("@/lib/offline/storage");
    pending = await countPendingOps();
  } catch {
    pending = 0;
  }

  return {
    type: "offline_queue_status",
    title: "Offline — limited Assistant",
    summary:
      pending > 0
        ? `${pending} draft operation(s) waiting for server validation. Help and navigation still work locally. Live gold / money balances cannot be verified offline.`
        : "You are offline. Local help and navigation work. Live gold / money balances cannot be verified until you reconnect.",
    actionRoute: "/mobile/sync",
    kpis: [
      { label: "Connection", value: "Offline", variant: "warning" },
      { label: "Queued drafts", value: pending, variant: pending > 0 ? "warning" : "default" },
    ],
    data: {
      primaryContent:
        "Pending Server Validation applies to gold and accounting writes. Do not trust invented numbers.",
    },
  };
}

export function offlineBalanceRefusal(topic: string): string {
  return `I can't verify ${topic} while offline. Reconnect so AVS ERP can read your authorized live ledger — I never invent gold or money balances.`;
}

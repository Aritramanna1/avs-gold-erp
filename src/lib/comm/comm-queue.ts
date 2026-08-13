/**
 * Supabase-online communication retry facade.
 *
 * The legacy SQLite-backed retry queue has been retired. Communication
 * reliability belongs in the centralized Supabase message/follow-up system,
 * so this compatibility layer no longer creates browser-local queue state.
 */
import type { CommRequest } from "./types";

export interface CommQueueEntry {
  id: string;
  request: CommRequest;
  log_event_id: string | null;
  status: "pending" | "sent" | "permanently_failed";
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function enqueueForRetry(_req: CommRequest, _logEventId?: string): Promise<string> {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `supabase_message_retry_${suffix}`;
}

export async function getQueueEntries(
  _status?: CommQueueEntry["status"],
): Promise<CommQueueEntry[]> {
  return [];
}

export async function drainCommQueue(): Promise<{
  attempted: number;
  sent: number;
  stillPending: number;
}> {
  return { attempted: 0, sent: 0, stillPending: 0 };
}

export function startCommQueueScheduler(_intervalMs = 30_000): () => void {
  return () => stopCommQueueScheduler();
}

export function stopCommQueueScheduler(): void {
  return;
}

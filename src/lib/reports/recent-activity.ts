/**
 * Recent Activity (Priority 5) — a human-readable activity feed derived
 * entirely from the existing immutable audit log (Step 8). No new tracking
 * needed: every save/delete on a financial table, every approval decision,
 * every reconciliation exception, every key rotation and disaster-recovery
 * drill already writes an audit entry — this is purely a
 * presentation/query layer on top of data that already exists.
 */
import { getAuditEntries, type AuditEntry } from "@/lib/security/audit-log";

export interface ActivityFeedItem {
  id: string;
  ts: string;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
}

const ACTION_SUMMARIES: Record<string, (e: AuditEntry) => string> = {
  "invoices.save": () => "created or updated an invoice",
  "payments.save": () => "recorded a payment",
  "ledger_entries.save": () => "posted a ledger entry",
  "gold_settlements.save": () => "recorded a gold settlement",
  "worker_transactions.save": () => "recorded a worker gold transaction",
  "manufacturing_bills.save": () => "updated a manufacturing bill",
  "approval_workflow.requested": () => "requested an approval",
  "approval_workflow.approved": () => "approved a request",
  "approval_workflow.rejected": () => "rejected a request",
  "gold_reconciliation.exception": () => "a gold reconciliation exception was flagged",
  "key_management.master_key_rotated": () => "rotated the encryption key",
  "disaster_recovery.drill_passed": () => "a disaster recovery drill passed",
  "disaster_recovery.drill_failed": () => "a disaster recovery drill FAILED",
  "financial_lock_periods.lock": () => "locked a financial period",
  "financial_lock_periods.unlock": () => "unlocked a financial period",
};

function summarize(entry: AuditEntry): string {
  const fn = ACTION_SUMMARIES[entry.action];
  if (fn) return fn(entry);
  return entry.action.replace(/[._]/g, " ");
}

/** Every audit entry, newest first, rendered as a human-readable feed item. Accepts the same optional entityType/entityId/actorId filters as getAuditEntries. */
export async function getRecentActivity(
  filter?: { entityType?: string; entityId?: string; actorId?: string },
  limit = 50,
): Promise<ActivityFeedItem[]> {
  const entries = await getAuditEntries(filter);
  return entries
    .slice()
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      ts: e.ts,
      actorLabel: e.actorEmail ?? e.actorId ?? "System",
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      summary: summarize(e),
    }));
}

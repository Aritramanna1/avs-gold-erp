/**
 * Escalation Engine (Step 9) — "no important business event should rely on
 * someone remembering to send a message."
 *
 * A configurable ladder: Day 1 -> responsible staff, Day 3 -> second
 * reminder to the same person, Day 7 -> manager, Day 15 -> owner. Reuses
 * the exact same send/log/retry path as every other communication (via
 * comm-automation.ts's emitBusinessEvent) — escalation is just "who gets
 * notified and how insistently," not a separate communication mechanism.
 *
 * State is tracked per (entityType, entityId) in the `escalation_state`
 * table: `first_flagged_at` records when the condition was first seen
 * unresolved, `last_tier_index` records the highest ladder tier already
 * sent — so calling `escalate()` daily only actually sends when a NEW tier
 * threshold has been crossed, not every single day.
 */
import { runLocal, getDb, queryTable, initLocalDb } from "@/lib/local-db";
import { emitBusinessEvent } from "./comm-automation";
import type { AutomationEventKey } from "./automation-settings-store";
import { useSettings } from "@/lib/settings-store";

export interface EscalationTier {
  dayThreshold: number;
  target: "responsible" | "manager" | "owner";
}

export const ESCALATION_LADDER: EscalationTier[] = [
  { dayThreshold: 1, target: "responsible" },
  { dayThreshold: 3, target: "responsible" },
  { dayThreshold: 7, target: "manager" },
  { dayThreshold: 15, target: "owner" },
];

function daysBetween(fromIso: string, toMs: number): number {
  return Math.floor((toMs - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

/** Resolves which registered user(s) to notify for a given escalation target — manager/owner roles come from settings-store's user directory, not hardcoded contacts. */
function resolveEscalationRecipient(
  target: EscalationTier["target"],
): { name: string; email?: string; phone?: string } | null {
  const users = useSettings.getState().users.filter((u) => u.active);
  if (target === "owner") {
    const owner = users.find((u) => u.isSuperOwner || /owner/i.test(u.role));
    return owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null;
  }
  if (target === "manager") {
    const manager = users.find((u) => /manager|administrator/i.test(u.role));
    return manager ? { name: manager.name, email: manager.email, phone: manager.phone } : null;
  }
  return null; // "responsible" — caller already knows who that is (the customer/worker themselves)
}

function getState(entityType: string, entityId: string): Record<string, unknown> | null {
  const rows = queryTable("escalation_state", "entity_type = ? AND entity_id = ?", [
    entityType,
    entityId,
  ]);
  return (rows as Record<string, unknown>[])[0] ?? null;
}

/**
 * Evaluates and (if a new tier is due) fires the escalation for one
 * unresolved entity. `responsibleRecipient` is who tier "responsible"
 * notifies (the customer/worker the condition is actually about) —
 * manager/owner tiers notify whoever holds those roles instead, resolved
 * from the registered users list.
 */
export async function escalate(
  entityType: string,
  entityId: string,
  eventKey: AutomationEventKey,
  responsibleRecipient: { name: string; email?: string; phone?: string },
  context: { branchId: string; linkedType: Parameters<typeof emitBusinessEvent>[1]["linkedType"] },
): Promise<{ tierSent: EscalationTier | null }> {
  await initLocalDb();
  const now = Date.now();
  const existing = getState(entityType, entityId);
  const firstFlaggedAt = (existing?.first_flagged_at as string) ?? new Date(now).toISOString();
  const lastTierIndex = existing ? Number(existing.last_tier_index) : -1;

  const daysSince = daysBetween(firstFlaggedAt, now);
  // Highest tier whose threshold has been reached but hasn't been sent yet.
  let dueTierIndex = -1;
  for (let i = 0; i < ESCALATION_LADDER.length; i++) {
    if (daysSince >= ESCALATION_LADDER[i].dayThreshold && i > lastTierIndex) dueTierIndex = i;
  }

  if (!existing) {
    await runLocal(() => {
      getDb().run(
        `INSERT INTO escalation_state (entity_type, entity_id, first_flagged_at, last_tier_index, last_sent_at) VALUES (?, ?, ?, -1, NULL);`,
        [entityType, entityId, firstFlaggedAt],
      );
    });
  }

  if (dueTierIndex === -1) return { tierSent: null };

  const tier = ESCALATION_LADDER[dueTierIndex];
  const recipient =
    tier.target === "responsible" ? responsibleRecipient : resolveEscalationRecipient(tier.target);

  if (recipient) {
    await emitBusinessEvent(eventKey, {
      branchId: context.branchId,
      recipient,
      linkedId: entityId,
      linkedType: context.linkedType,
    });
  }

  await runLocal(() => {
    getDb().run(
      `UPDATE escalation_state SET last_tier_index = ?, last_sent_at = ? WHERE entity_type = ? AND entity_id = ?;`,
      [dueTierIndex, new Date(now).toISOString(), entityType, entityId],
    );
  });

  return { tierSent: tier };
}

/** Call when the underlying condition clears (paid, settled, resolved) so escalation restarts fresh if it recurs later. */
export async function resolveEscalation(entityType: string, entityId: string): Promise<void> {
  await initLocalDb();
  await runLocal(() => {
    getDb().run(`DELETE FROM escalation_state WHERE entity_type = ? AND entity_id = ?;`, [
      entityType,
      entityId,
    ]);
  });
}

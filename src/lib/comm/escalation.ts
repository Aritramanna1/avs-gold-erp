/**
 * Escalation engine for unresolved business conditions.
 *
 * State is tracked in Supabase `escalation_state`, keeping follow-up history
 * centralized instead of browser-local.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
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

function resolveEscalationRecipient(
  target: EscalationTier["target"],
): { name: string; email?: string; phone?: string } | null {
  const users = useSettings.getState().users.filter((user) => user.active);
  if (target === "owner") {
    const owner = users.find((user) => user.isSuperOwner || /owner/i.test(user.role));
    return owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null;
  }
  if (target === "manager") {
    const manager = users.find((user) => /manager|administrator/i.test(user.role));
    return manager ? { name: manager.name, email: manager.email, phone: manager.phone } : null;
  }
  return null;
}

async function getState(
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await (supabase as any)
    .from("escalation_state")
    .select("entity_type,entity_id,first_flagged_at,last_tier_index,last_sent_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

async function upsertState(input: {
  entityType: string;
  entityId: string;
  firstFlaggedAt: string;
  lastTierIndex: number;
  lastSentAt: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).from("escalation_state").upsert(
    {
      entity_type: input.entityType,
      entity_id: input.entityId,
      first_flagged_at: input.firstFlaggedAt,
      last_tier_index: input.lastTierIndex,
      last_sent_at: input.lastSentAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id,entity_type,entity_id" },
  );
  if (error) throw new Error(error.message);
}

export async function escalate(
  entityType: string,
  entityId: string,
  eventKey: AutomationEventKey,
  responsibleRecipient: { name: string; email?: string; phone?: string },
  context: { branchId: string; linkedType: Parameters<typeof emitBusinessEvent>[1]["linkedType"] },
): Promise<{ tierSent: EscalationTier | null }> {
  const now = Date.now();
  const existing = await getState(entityType, entityId);
  const firstFlaggedAt = (existing?.first_flagged_at as string) ?? new Date(now).toISOString();
  const lastTierIndex = existing ? Number(existing.last_tier_index) : -1;

  const daysSince = daysBetween(firstFlaggedAt, now);
  let dueTierIndex = -1;
  for (let i = 0; i < ESCALATION_LADDER.length; i += 1) {
    if (daysSince >= ESCALATION_LADDER[i].dayThreshold && i > lastTierIndex) dueTierIndex = i;
  }

  if (!existing) {
    await upsertState({
      entityType,
      entityId,
      firstFlaggedAt,
      lastTierIndex: -1,
      lastSentAt: null,
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

  await upsertState({
    entityType,
    entityId,
    firstFlaggedAt,
    lastTierIndex: dueTierIndex,
    lastSentAt: new Date(now).toISOString(),
  });

  return { tierSent: tier };
}

export async function resolveEscalation(entityType: string, entityId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("escalation_state")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw new Error(error.message);
}

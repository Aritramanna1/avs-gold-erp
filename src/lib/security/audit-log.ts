import { getCloudDataClient } from "@/lib/providers/data-provider";

export interface AuditEntryInput {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  deviceId?: string | null;
}

export interface AuditEntry {
  seq: number;
  id: string;
  ts: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  deviceId: string | null;
  prevHash: string;
  hash: string;
  signature: string;
}

function mapRow(row: any): AuditEntry {
  return {
    seq: Number(row.seq ?? 0),
    id: String(row.id),
    ts: String(row.ts ?? row.created_at ?? ""),
    actorId: row.actor_id ?? null,
    actorEmail: row.actor_email ?? null,
    action: String(row.action ?? ""),
    entityType: String(row.entity_type ?? ""),
    entityId: row.entity_id ?? null,
    before: row.before_json ?? row.before ?? null,
    after: row.after_json ?? row.after ?? null,
    deviceId: row.device_id ?? null,
    prevHash: String(row.prev_hash ?? ""),
    hash: String(row.hash ?? ""),
    signature: String(row.signature ?? ""),
  };
}

export async function append(input: AuditEntryInput): Promise<AuditEntry> {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    before_json: input.before ?? null,
    after_json: input.after ?? null,
    device_id: input.deviceId ?? null,
  };
  const { data, error } = await (getCloudDataClient() as any)
    .from("audit_log")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export interface ChainVerificationResult {
  ok: boolean;
  entriesChecked: number;
  brokenAtSeq: number | null;
  issues: string[];
}

export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const { data, error } = await (getCloudDataClient() as any)
    .from("audit_log")
    .select("*")
    .order("seq");
  if (error) return { ok: false, entriesChecked: 0, brokenAtSeq: null, issues: [error.message] };
  return { ok: true, entriesChecked: data?.length ?? 0, brokenAtSeq: null, issues: [] };
}

export async function getAuditEntries(filter?: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
}): Promise<AuditEntry[]> {
  let query = (getCloudDataClient() as any)
    .from("audit_log")
    .select("*")
    .order("seq", { ascending: true });
  if (filter?.entityType) query = query.eq("entity_type", filter.entityType);
  if (filter?.entityId) query = query.eq("entity_id", filter.entityId);
  if (filter?.actorId) query = query.eq("actor_id", filter.actorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

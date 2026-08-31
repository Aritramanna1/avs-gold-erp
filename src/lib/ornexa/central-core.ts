import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  ORNEXA_TRANSACTION_CONTRACTS,
  type OrnexaTransactionContract,
} from "@/lib/ornexa/transaction-contracts";
export { archiveCentralPartyForPerson, syncPersonToCentralParty } from "@/lib/central-foundation";

const centralDb = supabase as any;

export function listOrnexaTransactionContracts(): OrnexaTransactionContract[] {
  return Object.values(ORNEXA_TRANSACTION_CONTRACTS);
}

export function getOrnexaTransactionContract(key: string): OrnexaTransactionContract | null {
  return ORNEXA_TRANSACTION_CONTRACTS[key] ?? null;
}

export async function trackCentralActivity(input: {
  firmId: string;
  branchId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  description?: string | null;
  relatedPartyId?: string | null;
  relatedTransactionId?: string | null;
  relatedDocumentId?: string | null;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await centralDb.rpc("central_track_activity", {
    p_firm_id: input.firmId,
    p_branch_id: input.branchId ?? null,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_event_type: input.eventType,
    p_title: input.title,
    p_description: input.description ?? null,
    p_related_party_id: input.relatedPartyId ?? null,
    p_related_transaction_id: input.relatedTransactionId ?? null,
    p_related_document_id: input.relatedDocumentId ?? null,
    p_severity: input.severity ?? "info",
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`central activity tracking failed: ${error.message}`);
  return String(data);
}

export async function createCentralMessageThread(input: {
  firmId: string;
  branchId?: string | null;
  partyId?: string | null;
  subject: string;
  channel?: "in_app" | "whatsapp" | "email" | "system";
  status?: "open" | "pending" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await centralDb.from("central_message_threads").insert({
    id,
    firm_id: input.firmId,
    branch_id: input.branchId ?? null,
    party_id: input.partyId ?? null,
    subject: input.subject,
    channel: input.channel ?? "in_app",
    status: input.status ?? "open",
    priority: input.priority ?? "normal",
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`central message thread creation failed: ${error.message}`);
  return id;
}

export async function appendCentralMessage(input: {
  firmId: string;
  threadId: string;
  body: string;
  direction?: "inbound" | "outbound" | "internal";
  senderUserId?: string | null;
  senderPartyId?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await centralDb.from("central_messages").insert({
    id,
    firm_id: input.firmId,
    thread_id: input.threadId,
    body: input.body,
    direction: input.direction ?? "internal",
    sender_user_id: input.senderUserId ?? null,
    sender_party_id: input.senderPartyId ?? null,
    provider: input.provider ?? null,
    provider_message_id: input.providerMessageId ?? null,
    status: "sent",
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`central message append failed: ${error.message}`);
  return id;
}

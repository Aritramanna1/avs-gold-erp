/**
 * Communication Jobs Store — Supabase-backed job queue (replaces localStorage email queue).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type {
  CommunicationChannel,
  CommunicationJobStatus,
  CommunicationRecipient,
  AvsProductId,
  CommunicationEventKey,
  ChannelDeliveryStatus,
} from "./communication-events";

export interface CreateJobInput {
  productId: AvsProductId;
  eventKey: CommunicationEventKey;
  branchId?: string;
  channels: CommunicationChannel[];
  recipient: CommunicationRecipient;
  payload?: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
  documentUrl?: string;
  scheduledFor?: string;
}

export async function createCommunicationJob(
  input: CreateJobInput,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("communication_jobs" as never)
    .insert({
      product_id: input.productId,
      branch_id: input.branchId ?? null,
      event_key: input.eventKey,
      channels_requested: input.channels,
      status: "pending",
      recipient: input.recipient,
      payload: input.payload ?? {},
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      document_url: input.documentUrl ?? null,
      party_id: input.recipient.partyId ?? null,
      user_id: input.recipient.userId ?? null,
      scheduled_for: input.scheduledFor ?? null,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error("[CommJobs] create failed:", error?.message);
    return null;
  }
  return { id: String((data as { id: string }).id) };
}

export async function updateJobStatus(
  jobId: string,
  status: CommunicationJobStatus,
  errorMessage?: string,
): Promise<void> {
  await supabase
    .from("communication_jobs" as never)
    .update({
      status,
      error_message: errorMessage ?? null,
      completed_at: ["completed", "partial", "failed"].includes(status)
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId);
}

export async function recordChannelResult(input: {
  jobId: string;
  channel: CommunicationChannel;
  provider: string;
  status: ChannelDeliveryStatus;
  externalMessageId?: string;
  costCredits?: number;
  errorMessage?: string;
  fallbackFromChannel?: CommunicationChannel;
}): Promise<void> {
  await supabase.from("communication_channel_results" as never).insert({
    job_id: input.jobId,
    channel: input.channel,
    provider: input.provider,
    status: input.status,
    external_message_id: input.externalMessageId ?? null,
    cost_credits: input.costCredits ?? 0,
    error_message: input.errorMessage ?? null,
    fallback_from_channel: input.fallbackFromChannel ?? null,
    sent_at: ["sent", "delivered", "read"].includes(input.status) ? new Date().toISOString() : null,
  } as never);
}

export interface CommunicationCentreRow {
  id: string;
  productId: string;
  eventKey: string;
  status: CommunicationJobStatus;
  channelsRequested: CommunicationChannel[];
  recipientName: string;
  recipientContact: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  channelResults: Array<{
    channel: CommunicationChannel;
    status: ChannelDeliveryStatus;
    provider?: string;
    errorMessage?: string;
  }>;
}

export async function fetchCommunicationCentre(opts: {
  limit?: number;
  eventKey?: string;
  status?: CommunicationJobStatus;
}): Promise<CommunicationCentreRow[]> {
  const limit = opts.limit ?? 50;

  let query = supabase
    .from("communication_jobs" as never)
    .select(
      "id,product_id,event_key,status,channels_requested,recipient,reference_type,reference_id,created_at,communication_channel_results(channel,status,provider,error_message)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.eventKey) query = query.eq("event_key", opts.eventKey);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => {
    const recipient = (row.recipient ?? {}) as CommunicationRecipient;
    const results = (row.communication_channel_results ?? []) as Record<string, unknown>[];
    return {
      id: String(row.id),
      productId: String(row.product_id),
      eventKey: String(row.event_key),
      status: row.status as CommunicationJobStatus,
      channelsRequested: (row.channels_requested ?? []) as CommunicationChannel[],
      recipientName: recipient.name ?? "—",
      recipientContact: recipient.email ?? recipient.phone ?? "—",
      referenceType: row.reference_type ? String(row.reference_type) : undefined,
      referenceId: row.reference_id ? String(row.reference_id) : undefined,
      createdAt: String(row.created_at),
      channelResults: results.map((r) => ({
        channel: r.channel as CommunicationChannel,
        status: r.status as ChannelDeliveryStatus,
        provider: r.provider ? String(r.provider) : undefined,
        errorMessage: r.error_message ? String(r.error_message) : undefined,
      })),
    };
  });
}

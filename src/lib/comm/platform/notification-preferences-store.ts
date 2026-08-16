/**
 * Notification preferences — Supabase notification_preferences table.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  DEFAULT_AVS_PRODUCT,
  type CommunicationChannel,
  type CommunicationEventKey,
  type AvsProductId,
} from "./communication-events";

export interface NotificationPreference {
  id: string;
  firmId: string;
  productId: AvsProductId;
  eventKey: CommunicationEventKey;
  branchId?: string;
  enabled: boolean;
  channels: CommunicationChannel[];
  emailTemplateKey?: string;
  whatsappTemplateName?: string;
  scheduleCron?: string;
  recipients: Array<{ name?: string; email?: string; phone?: string }>;
  language: string;
}

function mapRow(row: Record<string, unknown>): NotificationPreference {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    productId: String(row.product_id) as AvsProductId,
    eventKey: String(row.event_key) as CommunicationEventKey,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    enabled: Boolean(row.enabled),
    channels: (row.channels ?? ["email"]) as CommunicationChannel[],
    emailTemplateKey: row.email_template_key ? String(row.email_template_key) : undefined,
    whatsappTemplateName: row.whatsapp_template_name
      ? String(row.whatsapp_template_name)
      : undefined,
    scheduleCron: row.schedule_cron ? String(row.schedule_cron) : undefined,
    recipients: (row.recipients ?? []) as NotificationPreference["recipients"],
    language: String(row.language ?? "en-IN"),
  };
}

export async function fetchNotificationPreferences(opts?: {
  branchId?: string;
  productId?: AvsProductId;
}): Promise<NotificationPreference[]> {
  let query = supabase
    .from("notification_preferences" as never)
    .select("*")
    .eq("product_id", opts?.productId ?? DEFAULT_AVS_PRODUCT);

  if (opts?.branchId) query = query.eq("branch_id", opts.branchId);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function upsertNotificationPreference(input: {
  id?: string;
  eventKey: CommunicationEventKey;
  branchId?: string;
  enabled: boolean;
  channels: CommunicationChannel[];
  recipients?: NotificationPreference["recipients"];
  scheduleCron?: string;
  emailTemplateKey?: string;
  whatsappTemplateName?: string;
}): Promise<NotificationPreference | null> {
  const payload = {
    product_id: DEFAULT_AVS_PRODUCT,
    event_key: input.eventKey,
    branch_id: input.branchId ?? null,
    enabled: input.enabled,
    channels: input.channels,
    recipients: input.recipients ?? [],
    schedule_cron: input.scheduleCron ?? null,
    email_template_key: input.emailTemplateKey ?? null,
    whatsapp_template_name: input.whatsappTemplateName ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("notification_preferences" as never)
      .update(payload as never)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("notification_preferences" as never)
    .upsert(payload as never, {
      onConflict: "firm_id,product_id,event_key,branch_id",
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function fetchEventCatalog(): Promise<
  Array<{ eventKey: string; displayName: string; defaultChannels: CommunicationChannel[] }>
> {
  const { data } = await supabase
    .from("communication_event_catalog" as never)
    .select("event_key,display_name,default_channels")
    .order("event_key");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    eventKey: String(r.event_key),
    displayName: String(r.display_name),
    defaultChannels: (r.default_channels ?? ["email"]) as CommunicationChannel[],
  }));
}

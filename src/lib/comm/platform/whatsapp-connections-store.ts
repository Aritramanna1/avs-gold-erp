/**
 * WhatsApp Connections — Meta partner / client WABA state (no secrets in frontend).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { AvsProductId } from "./communication-events";

export type WhatsAppConnectionMode =
  "off" | "managed_partner" | "client_owned" | "custom_connector";
export type BillingResponsibility = "AVS" | "CLIENT";

export interface WhatsAppConnection {
  id: string;
  firmId: string;
  productId: AvsProductId;
  branchId?: string;
  connectionMode: WhatsAppConnectionMode;
  billingResponsibility: BillingResponsibility;
  providerAdapter?: string;
  providerConfig: Record<string, unknown>;
  meteredCreditsEnabled: boolean;
  setupFeePaise: number;
  monthlyManagementFeePaise: number;
  providerType?: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhone?: string;
  displayName?: string;
  onboardingStatus: string;
  embeddedSignupStatus?: string;
  webhookStatus?: string;
  templateSyncStatus?: string;
  businessVerificationStatus?: string;
  isEnabled: boolean;
  messagesSentCount: number;
  messagesDeliveredCount: number;
  messagesFailedCount: number;
  lastMessageAt?: string;
  lastWebhookAt?: string;
  lastError?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): WhatsAppConnection {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    productId: String(row.product_id) as AvsProductId,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    connectionMode: String(row.connection_mode) as WhatsAppConnectionMode,
    billingResponsibility: String(row.billing_responsibility ?? "AVS") as BillingResponsibility,
    providerAdapter: row.provider_adapter ? String(row.provider_adapter) : undefined,
    providerConfig: (row.provider_config ?? {}) as Record<string, unknown>,
    meteredCreditsEnabled: Boolean(row.metered_credits_enabled ?? true),
    setupFeePaise: Number(row.setup_fee_paise ?? 0),
    monthlyManagementFeePaise: Number(row.monthly_management_fee_paise ?? 0),
    providerType: row.provider_type ? String(row.provider_type) : undefined,
    wabaId: row.waba_id ? String(row.waba_id) : undefined,
    phoneNumberId: row.phone_number_id ? String(row.phone_number_id) : undefined,
    displayPhone: row.display_phone ? String(row.display_phone) : undefined,
    displayName: row.display_name ? String(row.display_name) : undefined,
    onboardingStatus: String(row.onboarding_status),
    embeddedSignupStatus: row.embedded_signup_status
      ? String(row.embedded_signup_status)
      : undefined,
    webhookStatus: row.webhook_status ? String(row.webhook_status) : undefined,
    templateSyncStatus: row.template_sync_status ? String(row.template_sync_status) : undefined,
    businessVerificationStatus: row.business_verification_status
      ? String(row.business_verification_status)
      : undefined,
    isEnabled: Boolean(row.is_enabled),
    messagesSentCount: Number(row.messages_sent_count ?? 0),
    messagesDeliveredCount: Number(row.messages_delivered_count ?? 0),
    messagesFailedCount: Number(row.messages_failed_count ?? 0),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : undefined,
    lastWebhookAt: row.last_webhook_at ? String(row.last_webhook_at) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function fetchWhatsAppConnections(opts?: {
  firmId?: string;
  productId?: AvsProductId;
}): Promise<WhatsAppConnection[]> {
  let query = supabase
    .from("whatsapp_connections" as never)
    .select("*")
    .order("updated_at", { ascending: false });

  if (opts?.firmId) query = query.eq("firm_id", opts.firmId);
  if (opts?.productId) query = query.eq("product_id", opts.productId);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function upsertWhatsAppConnection(input: {
  id?: string;
  firmId?: string;
  productId: AvsProductId;
  branchId?: string;
  connectionMode?: WhatsAppConnectionMode;
  billingResponsibility?: BillingResponsibility;
  meteredCreditsEnabled?: boolean;
  providerAdapter?: string;
  isEnabled?: boolean;
  onboardingStatus?: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhone?: string;
  displayName?: string;
}): Promise<WhatsAppConnection | null> {
  const payload = {
    product_id: input.productId,
    branch_id: input.branchId ?? null,
    connection_mode: input.connectionMode ?? "off",
    billing_responsibility: input.billingResponsibility ?? "AVS",
    metered_credits_enabled: input.meteredCreditsEnabled ?? true,
    provider_adapter: input.providerAdapter ?? "whatsapp_cloud_api",
    is_enabled: input.isEnabled ?? false,
    onboarding_status: input.onboardingStatus ?? "not_started",
    waba_id: input.wabaId ?? null,
    phone_number_id: input.phoneNumberId ?? null,
    display_phone: input.displayPhone ?? null,
    display_name: input.displayName ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("whatsapp_connections" as never)
      .update(payload as never)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  }

  const insertPayload = {
    ...payload,
    ...(input.firmId ? { firm_id: input.firmId } : {}),
  };

  const { data, error } = await supabase
    .from("whatsapp_connections" as never)
    .upsert(insertPayload as never, {
      onConflict: "firm_id,product_id,branch_id",
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

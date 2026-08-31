/**
 * SMS Provider Adapter — infrastructure only; disabled until Platform Owner configures.
 * Does NOT fake successful sends.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type SmsProviderStatus = "disabled" | "not_configured" | "configured" | "invalid";

export interface SmsSendRequest {
  to: string;
  body: string;
  eventKey?: string;
  firmId?: string;
}

export interface SmsSendResult {
  success: false;
  provider: string;
  status: SmsProviderStatus;
  error: string;
  messageId?: never;
}

export interface SmsConfigSnapshot {
  enabled: boolean;
  provider: string | null;
  senderId: string | null;
  otpEnabled: boolean;
  transactionalEnabled: boolean;
  credentialsStatus: SmsProviderStatus;
}

export async function fetchPlatformSmsConfig(): Promise<SmsConfigSnapshot> {
  const { data } = await supabase
    .from("platform_sms_config" as never)
    .select("enabled, provider, sender_id, otp_enabled, transactional_enabled, credentials_status")
    .eq("id", "default")
    .maybeSingle();

  const row = data as {
    enabled?: boolean;
    provider?: string | null;
    sender_id?: string | null;
    otp_enabled?: boolean;
    transactional_enabled?: boolean;
    credentials_status?: string;
  } | null;

  return {
    enabled: Boolean(row?.enabled),
    provider: row?.provider ?? null,
    senderId: row?.sender_id ?? null,
    otpEnabled: Boolean(row?.otp_enabled),
    transactionalEnabled: Boolean(row?.transactional_enabled),
    credentialsStatus: (row?.credentials_status as SmsProviderStatus) ?? "not_configured",
  };
}

/** Always returns failure when SMS is not configured — never pretends delivery succeeded. */
export async function sendSmsViaAdapter(req: SmsSendRequest): Promise<SmsSendResult> {
  const config = await fetchPlatformSmsConfig();

  if (!config.enabled) {
    return {
      success: false,
      provider: "sms_disabled",
      status: "disabled",
      error: "SMS is disabled. Platform Owner has not enabled an SMS provider.",
    };
  }

  if (config.credentialsStatus !== "configured" || !config.provider) {
    return {
      success: false,
      provider: config.provider ?? "none",
      status: "not_configured",
      error: "SMS provider is not configured.",
    };
  }

  // Future: route to edge function when provider is connected
  return {
    success: false,
    provider: config.provider,
    status: "not_configured",
    error: `SMS provider ${config.provider} adapter is not yet connected.`,
  };
}

export function isSmsChannelAvailable(config: SmsConfigSnapshot, forOtp = false): boolean {
  if (!config.enabled || config.credentialsStatus !== "configured") return false;
  return forOtp ? config.otpEnabled : config.transactionalEnabled;
}

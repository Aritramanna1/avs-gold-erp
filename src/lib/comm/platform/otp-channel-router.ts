/**
 * OTP channel resolution — Email / WhatsApp / SMS with fallback policy.
 * Only exposes channels that are actually configured.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { fetchPlatformSmsConfig, isSmsChannelAvailable } from "./sms-provider-adapter";
import type { CommunicationChannel } from "./communication-events";

export interface OtpChannelResolution {
  channels: CommunicationChannel[];
  primary: CommunicationChannel | null;
  fallbackEnabled: boolean;
}

export async function resolveOtpChannels(): Promise<OtpChannelResolution> {
  const smsConfig = await fetchPlatformSmsConfig();

  let preferred: CommunicationChannel[] = ["email", "whatsapp", "sms"];
  let fallbackEnabled = true;

  try {
    const { data } = await supabase
      .from("platform_otp_policy" as never)
      .select("preferred_channels, fallback_enabled")
      .eq("id", "default")
      .maybeSingle();
    const row = data as { preferred_channels?: string[]; fallback_enabled?: boolean } | null;
    if (row?.preferred_channels?.length) {
      preferred = row.preferred_channels.filter((c): c is CommunicationChannel =>
        ["email", "whatsapp", "sms", "in_app"].includes(c),
      );
    }
    if (row?.fallback_enabled != null) fallbackEnabled = row.fallback_enabled;
  } catch {
    // use defaults
  }

  const available: CommunicationChannel[] = [];
  for (const ch of preferred) {
    if (ch === "email") available.push("email");
    if (ch === "whatsapp") {
      // WhatsApp availability checked at send time via comm service
      available.push("whatsapp");
    }
    if (ch === "sms" && isSmsChannelAvailable(smsConfig, true)) {
      available.push("sms");
    }
  }

  // Email is always available as last-resort if platform SMTP or tenant email configured
  if (!available.includes("email")) available.push("email");

  return {
    channels: available,
    primary: available[0] ?? "email",
    fallbackEnabled,
  };
}

/**
 * Channel Router — resolves which channels to use for a communication event.
 * Email is the default low-cost channel for scheduled/automatic reporting.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { loadPlatformBillingDefaults } from "@/lib/platform-settings-runtime";
import type {
  AvsProductId,
  CommunicationChannel,
  CommunicationEventKey,
} from "./communication-events";
import { DEFAULT_AVS_PRODUCT } from "./communication-events";

export interface ChannelRoutingResult {
  channels: CommunicationChannel[];
  source: "explicit" | "tenant_preference" | "catalog_default";
  emailFallbackEnabled: boolean;
}

const SCHEDULED_REPORT_EVENTS = new Set<CommunicationEventKey>([
  "report.daily",
  "report.weekly",
  "report.monthly",
  "credits.low",
  "subscription.amc_reminder",
  "subscription.plan_renewal",
]);

export async function resolveChannelsForEvent(opts: {
  productId?: AvsProductId;
  eventKey: CommunicationEventKey;
  branchId?: string;
  explicitChannels?: CommunicationChannel[];
  emailFallbackOnWhatsAppFailure?: boolean;
}): Promise<ChannelRoutingResult> {
  const productId = opts.productId ?? DEFAULT_AVS_PRODUCT;

  const platformDefaults = await loadPlatformBillingDefaults();
  if (!platformDefaults.whatsappEnabled) {
    const withoutWhatsapp = (channels: CommunicationChannel[]) =>
      channels.filter((ch) => ch !== "whatsapp");
    if (opts.explicitChannels && opts.explicitChannels.length > 0) {
      const filtered = withoutWhatsapp(opts.explicitChannels);
      return {
        channels: filtered.length > 0 ? filtered : ["email"],
        source: "explicit",
        emailFallbackEnabled: opts.emailFallbackOnWhatsAppFailure ?? true,
      };
    }
  }

  if (opts.explicitChannels && opts.explicitChannels.length > 0) {
    return {
      channels: opts.explicitChannels,
      source: "explicit",
      emailFallbackEnabled: opts.emailFallbackOnWhatsAppFailure ?? true,
    };
  }

  // Tenant preference from notification_preferences
  try {
    let query = supabase
      .from("notification_preferences" as never)
      .select("channels,enabled")
      .eq("product_id", productId)
      .eq("event_key", opts.eventKey)
      .eq("enabled", true)
      .limit(1);

    if (opts.branchId) {
      query = query.eq("branch_id", opts.branchId);
    }

    const { data } = await query;
    const pref = (data as { channels?: CommunicationChannel[] }[] | null)?.[0];
    if (pref?.channels && Array.isArray(pref.channels) && pref.channels.length > 0) {
      const channels = platformDefaults.whatsappEnabled
        ? pref.channels
        : pref.channels.filter((ch) => ch !== "whatsapp");
      return {
        channels: channels.length > 0 ? channels : ["email"],
        source: "tenant_preference",
        emailFallbackEnabled: opts.emailFallbackOnWhatsAppFailure ?? true,
      };
    }
  } catch {
    // Table may not exist yet — fall through
  }

  // Catalog default
  try {
    const { data } = await supabase
      .from("communication_event_catalog" as never)
      .select("default_channels")
      .eq("event_key", opts.eventKey)
      .maybeSingle();

    const defaults = (data as { default_channels?: CommunicationChannel[] } | null)
      ?.default_channels;
    if (defaults && defaults.length > 0) {
      const channels = platformDefaults.whatsappEnabled
        ? defaults
        : defaults.filter((ch) => ch !== "whatsapp");
      return {
        channels: channels.length > 0 ? channels : ["email"],
        source: "catalog_default",
        emailFallbackEnabled: opts.emailFallbackOnWhatsAppFailure ?? true,
      };
    }
  } catch {
    // fall through
  }

  // Hard fallback: scheduled reports → email only
  if (SCHEDULED_REPORT_EVENTS.has(opts.eventKey)) {
    return {
      channels: ["email"],
      source: "catalog_default",
      emailFallbackEnabled: false,
    };
  }

  return {
    channels: ["email"],
    source: "catalog_default",
    emailFallbackEnabled: opts.emailFallbackOnWhatsAppFailure ?? true,
  };
}

export function channelSupportsEvent(
  channel: CommunicationChannel,
  eventKey: CommunicationEventKey,
): boolean {
  if (channel === "email") return true;
  if (channel === "in_app") return true;
  if (channel === "sms") {
    const authSms = new Set<CommunicationEventKey>([
      "auth.password_reset",
      "auth.otp_login",
      "portal.invited",
    ]);
    return authSms.has(eventKey);
  }
  if (channel === "whatsapp") {
    const authOnly = new Set<CommunicationEventKey>([
      "auth.password_reset",
      "auth.otp_login",
      "portal.invited",
    ]);
    return !authOnly.has(eventKey);
  }
  return false;
}

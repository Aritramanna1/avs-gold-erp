/**
 * WhatsApp capability gating — AVS Managed vs External BSP modes.
 */
import type {
  WhatsAppConnection,
  WhatsAppConnectionMode,
} from "@/lib/comm/platform/whatsapp-connections-store";

export type WhatsAppCapability =
  | "inbox"
  | "inbound_messages"
  | "outbound_reply"
  | "templates"
  | "template_sync"
  | "campaigns"
  | "broadcasts"
  | "automations"
  | "media"
  | "documents"
  | "assignment"
  | "labels"
  | "internal_notes"
  | "crm_linkage"
  | "analytics"
  | "usage_cost"
  | "embedded_signup"
  | "provider_template_create";

export interface WhatsAppCapabilities {
  mode: WhatsAppConnectionMode;
  modeLabel: string;
  isManagedFull: boolean;
  isExternalRestricted: boolean;
  capabilities: Set<WhatsAppCapability>;
  billingModel: "avs_credits" | "client_direct" | "annual_integration_fee" | "off";
  showManageTemplatesAtProvider: boolean;
}

const MANAGED_FULL: WhatsAppCapability[] = [
  "inbox",
  "inbound_messages",
  "outbound_reply",
  "templates",
  "template_sync",
  "campaigns",
  "broadcasts",
  "automations",
  "media",
  "documents",
  "assignment",
  "labels",
  "internal_notes",
  "crm_linkage",
  "analytics",
  "usage_cost",
  "embedded_signup",
];

const EXTERNAL_BSP: WhatsAppCapability[] = [
  "outbound_reply",
  "templates",
  "automations",
  "documents",
  "analytics",
  "usage_cost",
];

export function getWhatsAppCapabilities(
  conn: WhatsAppConnection | null | undefined,
): WhatsAppCapabilities {
  const mode = conn?.connectionMode ?? "off";
  const isManaged = mode === "managed_partner";
  const isClientOwned = mode === "client_owned";
  const isCustom = mode === "custom_connector";
  const isEnabled = Boolean(conn?.isEnabled && mode !== "off");

  let capabilities: WhatsAppCapability[] = [];
  let billingModel: WhatsAppCapabilities["billingModel"] = "off";
  let showManageTemplatesAtProvider = false;

  if (!isEnabled) {
    return {
      mode,
      modeLabel: "Disconnected",
      isManagedFull: false,
      isExternalRestricted: true,
      capabilities: new Set(),
      billingModel: "off",
      showManageTemplatesAtProvider: false,
    };
  }

  if (isManaged) {
    capabilities = [...MANAGED_FULL];
    billingModel = conn?.meteredCreditsEnabled ? "avs_credits" : "avs_credits";
  } else if (isClientOwned || isCustom) {
    capabilities = [...EXTERNAL_BSP];
    billingModel = "client_direct";
    showManageTemplatesAtProvider = true;
    if (conn?.billingResponsibility === "AVS") {
      billingModel = "annual_integration_fee";
    }
  }

  return {
    mode,
    modeLabel: isManaged
      ? "AVS Managed Meta"
      : isClientOwned
        ? "Client-Owned WABA"
        : isCustom
          ? "External BSP"
          : "Off",
    isManagedFull: isManaged,
    isExternalRestricted: !isManaged,
    capabilities: new Set(capabilities),
    billingModel,
    showManageTemplatesAtProvider,
  };
}

export function canUse(cap: WhatsAppCapabilities, feature: WhatsAppCapability): boolean {
  return cap.capabilities.has(feature);
}

/** WhatsApp 24h service window — template required outside window for business-initiated msgs */
export function requiresTemplateForOutbound(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return true;
  const last = new Date(lastInboundAt).getTime();
  const windowMs = 24 * 60 * 60 * 1000;
  return Date.now() - last > windowMs;
}

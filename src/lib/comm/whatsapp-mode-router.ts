/**
 * Three-mode WhatsApp delivery — credentials, pipelines, and status stay separated.
 *
 * 1. Native Mobile Share (Capacitor)
 * 2. OpenWA (Local same-machine OR Cloud remote HTTPS)
 * 3. Official Meta / BSP API (automation path, separate flag)
 */
import { isNativeApp, isDesktopApp } from "@/lib/native/platform";
import { useWaAutomation, type WaConfig } from "@/lib/wa-automation-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  canSendOfficialWhatsAppApi,
  loadCommunicationPolicy,
  type CommunicationPolicy,
} from "./communication-policy";
import { isLocalhostOpenWaUrl } from "./openwa-url";
import type { ProviderType } from "./types";

export type WhatsAppDeliveryMode =
  | "native_share"
  | "openwa"
  | "official_api"
  | "not_configured";

export type OpenWaDeployment = "local" | "cloud";

export type WhatsAppSendIntent = "user_send" | "automation";

export interface WhatsAppModeResolution {
  mode: WhatsAppDeliveryMode;
  providerType?: ProviderType;
  openwaDeployment?: OpenWaDeployment;
  reason?: string;
}

function openWaBaseConfigured(cfg: WaConfig): boolean {
  return (
    cfg.openwaEnabled === true &&
    !!cfg.openwaBaseUrl?.trim() &&
    !!cfg.openwaSessionId?.trim()
  );
}

function openWaLocalUsable(cfg: WaConfig): boolean {
  return openWaBaseConfigured(cfg) && cfg.openwaDeployment === "local";
}

function openWaCloudUsable(cfg: WaConfig): boolean {
  if (!openWaBaseConfigured(cfg) || cfg.openwaDeployment !== "cloud") return false;
  if (isLocalhostOpenWaUrl(cfg.openwaBaseUrl)) return false;
  return true;
}

function openWaHealthy(cfg: WaConfig): boolean {
  if (cfg.openwaConnectionStatus === "connected") return true;
  if (cfg.openwaConnectionStatus === "disconnected") return false;
  return cfg.openwaConnectionStatus !== "connecting";
}

function officialApiConfigured(cfg: WaConfig): boolean {
  return (
    cfg.officialApiEnabled === true &&
    cfg.providerType !== "whatsapp_deep_link" &&
    !!cfg.providerType
  );
}

function browserShareAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function resolveOpenWa(cfg: WaConfig, onMobile: boolean): WhatsAppModeResolution | null {
  if (onMobile) {
    if (!openWaCloudUsable(cfg)) {
      return null;
    }
    if (!openWaHealthy(cfg) && cfg.openwaConnectionStatus === "disconnected") {
      return null;
    }
    return { mode: "openwa", providerType: "whatsapp_openwa", openwaDeployment: "cloud" };
  }

  if (isDesktopApp() || !onMobile) {
    if (openWaLocalUsable(cfg)) {
      return { mode: "openwa", providerType: "whatsapp_openwa", openwaDeployment: "local" };
    }
    if (openWaCloudUsable(cfg)) {
      return { mode: "openwa", providerType: "whatsapp_openwa", openwaDeployment: "cloud" };
    }
  }

  return null;
}

/**
 * Resolve delivery mode (sync). Uses last-known OpenWA health from settings.
 * Prefer resolveWhatsAppDeliveryModeAsync when health must be probed live.
 */
export function resolveWhatsAppDeliveryMode(
  branchId?: string,
  policy?: CommunicationPolicy,
  intent: WhatsAppSendIntent = "user_send",
): WhatsAppModeResolution {
  const bId = branchId || "MAIN";
  const cfg = useWaAutomation.getState().getConfig(bId);
  const onMobile = isNativeApp();
  const preference = cfg.deliveryPreference ?? "auto";

  const officialReady =
    officialApiConfigured(cfg) &&
    (!policy || canSendOfficialWhatsAppApi(policy));

  if (preference === "official_api" || (preference === "auto" && officialReady)) {
    if (!officialReady) {
      return {
        mode: "not_configured",
        reason:
          "Official WhatsApp API is selected but not ready (platform flag, WABA, or credentials missing). OpenWA was not used.",
      };
    }
    return { mode: "official_api", providerType: cfg.providerType };
  }

  if (preference === "openwa" || (preference === "auto" && cfg.openwaEnabled)) {
    const openWa = resolveOpenWa(cfg, onMobile);
    if (openWa) return openWa;
    if (preference === "openwa") {
      return {
        mode: "not_configured",
        reason: "OpenWA is selected but not connected. Official API was not used.",
      };
    }
  }

  if (preference === "native_share" || onMobile) {
    return { mode: "native_share", reason: "Native OS share sheet." };
  }

  if (browserShareAvailable()) {
    return {
      mode: "native_share",
      reason: "Manual share via browser share sheet or deep link.",
    };
  }

  return {
    mode: "not_configured",
    reason:
      "WhatsApp is not configured. Choose Official WhatsApp API, OpenWA, or Native Share in Settings → WhatsApp.",
  };
}

/** True when Official API or OpenWA credentials are configured — show WhatsApp on documents. */
export function isWhatsAppApiConfigured(branchId?: string): boolean {
  const bId = branchId || "MAIN";
  const cfg = useWaAutomation.getState().getConfig(bId);
  if (officialApiConfigured(cfg)) return true;
  if (openWaCloudUsable(cfg) || openWaLocalUsable(cfg)) return true;
  return openWaBaseConfigured(cfg);
}

/** Probe OpenWa session via secure edge function; updates branch connection status. */
export async function probeOpenWaHealth(branchId: string): Promise<{
  ok: boolean;
  status: string;
  message?: string;
}> {
  const bId = branchId || "MAIN";
  useWaAutomation.getState().setConfig(bId, { openwaConnectionStatus: "connecting" });
  const { data, error } = await (supabase as any).functions.invoke("send-whatsapp", {
    body: { branchId: bId, verifyOnly: true, adapter: "openwa" },
  });
  const ok = !error && data?.ok === true;
  const sessionStatus = String(data?.status ?? (ok ? "connected" : "disconnected"));
  useWaAutomation.getState().setConfig(bId, {
    openwaConnectionStatus: ok ? "connected" : "disconnected",
    openwaLastCheckAt: new Date().toISOString(),
  });
  return {
    ok,
    status: sessionStatus,
    message: error?.message || data?.message || data?.error,
  };
}

export async function resolveWhatsAppDeliveryModeAsync(
  branchId?: string,
  intent: WhatsAppSendIntent = "user_send",
): Promise<WhatsAppModeResolution> {
  const policy = await loadCommunicationPolicy();
  const bId = branchId || "MAIN";
  const cfg = useWaAutomation.getState().getConfig(bId);

  const shouldProbe =
    cfg.openwaEnabled &&
    cfg.openwaDeployment === "cloud" &&
    openWaCloudUsable(cfg) &&
    (isNativeApp() || intent === "user_send");

  if (shouldProbe && cfg.openwaConnectionStatus !== "connected") {
    await probeOpenWaHealth(bId);
  }

  return resolveWhatsAppDeliveryMode(bId, policy, intent);
}

export function prefersOfficialApiSend(branchId?: string): boolean {
  const res = resolveWhatsAppDeliveryMode(branchId, undefined, "user_send");
  return res.mode === "official_api";
}

/** True when mobile should show API send as primary (OpenWA Cloud healthy). */
export function prefersOpenWaApiSend(branchId?: string): boolean {
  const res = resolveWhatsAppDeliveryMode(branchId, undefined, "user_send");
  return res.mode === "openwa" && res.openwaDeployment === "cloud";
}

export const WHATSAPP_DELIVERY_STATUS_LABELS: Record<string, string> = {
  not_configured: "Not configured",
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
  share_initiated: "Share initiated",
  queued: "Queued",
  provider_accepted: "Provider accepted",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  deep_link_opened: "Share sheet opened",
};

export function mapCommResultToDeliveryLabel(
  mode: WhatsAppDeliveryMode,
  status?: string,
  success?: boolean,
): string {
  if (mode === "native_share") return WHATSAPP_DELIVERY_STATUS_LABELS.share_initiated;
  if (mode === "not_configured") return WHATSAPP_DELIVERY_STATUS_LABELS.not_configured;
  if (!success) return WHATSAPP_DELIVERY_STATUS_LABELS.failed;
  if (status === "delivered") return WHATSAPP_DELIVERY_STATUS_LABELS.delivered;
  if (status === "sent") return WHATSAPP_DELIVERY_STATUS_LABELS.sent;
  if (status === "queued") return WHATSAPP_DELIVERY_STATUS_LABELS.queued;
  if (status === "connected") return WHATSAPP_DELIVERY_STATUS_LABELS.connected;
  return WHATSAPP_DELIVERY_STATUS_LABELS.provider_accepted;
}

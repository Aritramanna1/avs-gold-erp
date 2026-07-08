/**
 * WhatsApp Automation Store
 * Per-branch enable/disable toggles for every automated WA workflow.
 * Persisted to branch_settings.wa_automations via settings-store BranchSettings.
 */
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings-store";

export type WaAutomationKey =
  | "orderConfirmation"
  | "orderReady"
  | "manufacturingComplete"
  | "invoiceGenerated"
  | "paymentReceived"
  | "outstandingReminder"
  | "goldDueReminder"
  | "repairReady"
  | "deliveryReminder"
  | "birthdayWishes"
  | "festivalGreetings"
  | "anniversaryWishes";

export const WA_AUTOMATION_LABELS: Record<WaAutomationKey, string> = {
  orderConfirmation: "Order Confirmation",
  orderReady: "Order Ready for Pickup",
  manufacturingComplete: "Manufacturing Complete",
  invoiceGenerated: "Invoice Generated",
  paymentReceived: "Payment Received",
  outstandingReminder: "Outstanding Payment Reminder",
  goldDueReminder: "Gold Due Reminder",
  repairReady: "Repair Ready",
  deliveryReminder: "Delivery Reminder",
  birthdayWishes: "Birthday Wishes",
  festivalGreetings: "Festival Greetings",
  anniversaryWishes: "Anniversary Wishes",
};

export const WA_AUTOMATION_DEFAULTS: Record<WaAutomationKey, boolean> = {
  orderConfirmation: true,
  orderReady: true,
  manufacturingComplete: false,
  invoiceGenerated: true,
  paymentReceived: true,
  outstandingReminder: false,
  goldDueReminder: false,
  repairReady: true,
  deliveryReminder: false,
  birthdayWishes: false,
  festivalGreetings: false,
  anniversaryWishes: false,
};

export type WaAutomations = Record<WaAutomationKey, boolean>;

export interface WaConfig {
  providerType:
    | "whatsapp_deep_link"
    | "whatsapp_cloud_api"
    | "whatsapp_interakt"
    | "whatsapp_wati"
    | "whatsapp_aisensy"
    | "whatsapp_gupshup";
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  apiVersion: string;
  apiBaseUrl: string;
  webhookVerifyToken: string;
  webhookSecret: string;
  senderDisplayName: string;
  defaultCountryCode: string;
  rateLimitPerMinute: number;
  retryCount: number;
  timeoutMs: number;
  // Template name mappings (Meta approved template names)
  templateOrderConfirm: string;
  templateOrderReady: string;
  templateInvoice: string;
  templateReceipt: string;
  templatePaymentReminder: string;
  templateRepairReady: string;
  templateMfgBill: string;
  templateGoldIssue: string;
  templateBirthday: string;
  templateFestival: string;
}

export const WA_CONFIG_DEFAULTS: WaConfig = {
  providerType: "whatsapp_deep_link",
  enabled: true,
  phoneNumberId: "",
  accessToken: "",
  businessAccountId: "",
  apiVersion: "v19.0",
  apiBaseUrl: "https://graph.facebook.com",
  webhookVerifyToken: "",
  webhookSecret: "",
  senderDisplayName: "",
  defaultCountryCode: "91",
  rateLimitPerMinute: 60,
  retryCount: 2,
  timeoutMs: 10000,
  templateOrderConfirm: "order_confirmation",
  templateOrderReady: "order_ready_pickup",
  templateInvoice: "invoice_notification",
  templateReceipt: "payment_receipt",
  templatePaymentReminder: "payment_reminder",
  templateRepairReady: "repair_ready",
  templateMfgBill: "manufacturing_bill",
  templateGoldIssue: "gold_issue_alert",
  templateBirthday: "birthday_wishes",
  templateFestival: "festival_greetings",
};

interface WaAutomationState {
  configsByBranch: Record<string, WaConfig>;
  automationsByBranch: Record<string, WaAutomations>;
  getConfig(branchId: string): WaConfig;
  getAutomations(branchId: string): WaAutomations;
  setConfig(branchId: string, cfg: Partial<WaConfig>): void;
  setAutomation(branchId: string, key: WaAutomationKey, value: boolean): void;
  loadFromBranchSettings(branchId: string, waConfig: unknown, waAutomations: unknown): void;
  saveToDb(branchId: string): Promise<void>;
  testConnection(branchId: string): Promise<{ ok: boolean; message: string }>;
}

export const useWaAutomation = create<WaAutomationState>((set, get) => ({
  configsByBranch: {},
  automationsByBranch: {},

  getConfig(branchId) {
    return { ...WA_CONFIG_DEFAULTS, ...(get().configsByBranch[branchId] ?? {}) };
  },

  getAutomations(branchId) {
    return { ...WA_AUTOMATION_DEFAULTS, ...(get().automationsByBranch[branchId] ?? {}) };
  },

  setConfig(branchId, partial) {
    set((s) => ({
      configsByBranch: {
        ...s.configsByBranch,
        [branchId]: { ...get().getConfig(branchId), ...partial },
      },
    }));
  },

  setAutomation(branchId, key, value) {
    set((s) => ({
      automationsByBranch: {
        ...s.automationsByBranch,
        [branchId]: { ...get().getAutomations(branchId), [key]: value },
      },
    }));
  },

  loadFromBranchSettings(branchId, waConfigRaw, waAutomationsRaw) {
    const cfg =
      typeof waConfigRaw === "object" && waConfigRaw ? (waConfigRaw as Partial<WaConfig>) : {};
    const aut =
      typeof waAutomationsRaw === "object" && waAutomationsRaw
        ? (waAutomationsRaw as Partial<WaAutomations>)
        : {};
    set((s) => ({
      configsByBranch: { ...s.configsByBranch, [branchId]: { ...WA_CONFIG_DEFAULTS, ...cfg } },
      automationsByBranch: {
        ...s.automationsByBranch,
        [branchId]: { ...WA_AUTOMATION_DEFAULTS, ...aut },
      },
    }));
  },

  async saveToDb(branchId) {
    const cfg = get().getConfig(branchId);
    const aut = get().getAutomations(branchId);
    const payload: Record<string, unknown> = {
      branch_id: branchId,
      wa_config: cfg,
      wa_automations: aut,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase.from("branch_settings") as any).upsert(payload, {
      onConflict: "branch_id",
    });
    if (error) throw new Error(error.message);
  },

  async testConnection(branchId) {
    const cfg = get().getConfig(branchId);
    if (cfg.providerType !== "whatsapp_cloud_api") {
      return { ok: true, message: "Deep-link / BSP providers do not require a connection test." };
    }
    if (!cfg.phoneNumberId || !cfg.accessToken) {
      return { ok: false, message: "Phone Number ID and Access Token are required." };
    }
    try {
      const url = `${cfg.apiBaseUrl}/${cfg.apiVersion}/${cfg.phoneNumberId}?fields=display_phone_number,verified_name,status`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.accessToken}` },
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        return { ok: false, message: data?.error?.message ?? `HTTP ${res.status}` };
      }
      const name = data.verified_name ?? "Unknown";
      const phone = data.display_phone_number ?? cfg.phoneNumberId;
      const status = data.status ?? "unknown";
      return { ok: true, message: `Connected ✓  ${name} (${phone}) — Status: ${status}` };
    } catch (e: unknown) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
}));

/** Call from data-loader after pullBranchSettings to hydrate WA store */
export function hydrateWaStore(branchId: string, waConfig: unknown, waAutomations: unknown) {
  useWaAutomation.getState().loadFromBranchSettings(branchId, waConfig, waAutomations);
}

/** Check if a given automation is enabled for a branch */
export function isWaAutomationEnabled(branchId: string, key: WaAutomationKey): boolean {
  return useWaAutomation.getState().getAutomations(branchId)[key] ?? WA_AUTOMATION_DEFAULTS[key];
}

/** Get the resolved WA config merged from branch settings */
export function getWaConfig(branchId: string): WaConfig {
  return useWaAutomation.getState().getConfig(branchId);
}

/**
 * WhatsApp Automation Store
 * Per-branch enable/disable toggles for every automated WA workflow.
 * Persisted to branch_settings.wa_automations via settings-store BranchSettings.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";

/**
 * 11 canonical WhatsApp automation events per WHATSAPP_META_PARTNER_MASTER.md §3.
 * Default ON = utility (always on); Default OPTIONAL = marketing/low-priority.
 */
export type WaAutomationKey =
  /** Tax Invoice Ready — sends PDF link via WhatsApp [DEFAULT ON] */
  | "taxInvoiceReady"
  /** Payment Receipt Confirmation [DEFAULT ON] */
  | "paymentReceiptConfirmation"
  /** Payment / Due Date Reminder [DEFAULT OPTIONAL] */
  | "paymentDueReminder"
  /** Order Confirmed & Progress Update [DEFAULT ON] */
  | "orderProgressUpdate"
  /** CAD Design Approval Request [DEFAULT ON] */
  | "cadApprovalRequest"
  /** Curated Catalogue Collection Share [DEFAULT ON] */
  | "catalogCollectionShare"
  /** Ready for Collection Notice [DEFAULT ON] */
  | "readyForCollection"
  /** Karigar Job Assignment Reminder [DEFAULT OPTIONAL] */
  | "karigarJobReminder"
  /** Supplier Purchase Order Memo [DEFAULT OPTIONAL] */
  | "supplierPurchaseOrder"
  /** Hallmark Outward & Return Memo [DEFAULT OPTIONAL] */
  | "hallmarkMemo"
  /** Repair Ready for Pickup [DEFAULT ON] */
  | "repairReady";

export const WA_AUTOMATION_LABELS: Record<WaAutomationKey, string> = {
  taxInvoiceReady: "Tax Invoice Ready (with PDF link)",
  paymentReceiptConfirmation: "Payment Receipt Confirmation",
  paymentDueReminder: "Payment / Due Date Reminder",
  orderProgressUpdate: "Order Confirmed & Progress Update",
  cadApprovalRequest: "CAD Design Approval Request",
  catalogCollectionShare: "Curated Catalogue / Collection Share",
  readyForCollection: "Ready for Collection Notice",
  karigarJobReminder: "Karigar Job Assignment Reminder",
  supplierPurchaseOrder: "Supplier Purchase Order Memo",
  hallmarkMemo: "Hallmark Outward & Return Memo",
  repairReady: "Repair Ready for Pickup",
};

export const WA_AUTOMATION_DEFAULTS: Record<WaAutomationKey, boolean> = {
  taxInvoiceReady: true,
  paymentReceiptConfirmation: true,
  paymentDueReminder: false,
  orderProgressUpdate: true,
  cadApprovalRequest: true,
  catalogCollectionShare: true,
  readyForCollection: true,
  karigarJobReminder: false,
  supplierPurchaseOrder: false,
  hallmarkMemo: false,
  repairReady: true,
};

export type WaAutomations = Record<WaAutomationKey, boolean>;

export interface WaConfig {
  /**
   * Commercial deployment mode per WHATSAPP_META_PARTNER_MASTER.md §2:
   * A = WhatsApp OFF (use Email/in-app only)
   * B = Managed Partner Service (messages through Ornexa's Meta credit line)
   * C = Client-Owned WABA (tenant connects own Meta Business via Embedded Signup)
   * D = Custom Connector (third-party aggregator)
   */
  waMode: "A" | "B" | "C" | "D";
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
  /** WhatsApp Business Account ID (from Meta Embedded Signup for Mode C) */
  wabaId: string;
  businessAccountId: string;
  /** Status returned from Meta after Embedded Signup */
  businessVerificationStatus?: "verified" | "pending" | "rejected" | "not_started";
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
  waMode: "A",
  providerType: "whatsapp_deep_link",
  enabled: false,
  phoneNumberId: "",
  accessToken: "",
  wabaId: "",
  businessAccountId: "",
  businessVerificationStatus: "not_started",
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

const WA_SECRET_FIELDS: Array<keyof WaConfig> = [
  "accessToken",
  "webhookVerifyToken",
  "webhookSecret",
];

function withoutWaSecrets(config: WaConfig): WaConfig {
  const sanitized = { ...config };
  for (const field of WA_SECRET_FIELDS) sanitized[field] = "" as never;
  return sanitized;
}

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
      configsByBranch: {
        ...s.configsByBranch,
        [branchId]: withoutWaSecrets({ ...WA_CONFIG_DEFAULTS, ...cfg }),
      },
      automationsByBranch: {
        ...s.automationsByBranch,
        [branchId]: { ...WA_AUTOMATION_DEFAULTS, ...aut },
      },
    }));
  },

  async saveToDb(branchId) {
    const cfg = withoutWaSecrets(get().getConfig(branchId));
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
    const { data: secureResult, error: secureError } = await (supabase as any).functions.invoke(
      "send-whatsapp",
      { body: { branchId, verifyOnly: true } },
    );
    if (secureError || secureResult?.ok !== true) {
      return {
        ok: false,
        message: secureError?.message || secureResult?.error || "Connection test failed.",
      };
    }
    return { ok: true, message: secureResult.message || "WhatsApp connection verified." };
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

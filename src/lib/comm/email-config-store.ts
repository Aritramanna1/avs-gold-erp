/**
 * Email Configuration Store
 * Controls AVS Company Email fallback vs Custom Tenant Credentials,
 * master toggles, attachment rules, and event-level automation policies.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type EmailSenderMode = "avs_company_email" | "tenant_credentials";

export type AutomaticEventKey =
  | "invoice_created"
  | "order_created"
  | "order_assigned"
  | "order_delayed"
  | "order_delivered"
  | "payment_received"
  | "gold_receipt"
  | "advance_receipt"
  | "settlement"
  | "credit_note"
  | "document_cancelled"
  | "financial_report";

export interface EmailConfigState {
  senderMode: EmailSenderMode;
  avsSenderEmail: string;
  avsSenderName: string;
  tenantSenderEmail: string;
  tenantSenderName: string;
  autoEmailEnabled: boolean;
  attachFullDocumentPdf: boolean;
  ccAddresses: string[];
  bccAddresses: string[];
  eventToggles: Record<AutomaticEventKey, boolean>;

  setSenderMode(mode: EmailSenderMode): Promise<void>;
  updateTenantSender(info: { email: string; name: string }): Promise<void>;
  setAutoEmailEnabled(enabled: boolean): Promise<void>;
  setAttachFullDocumentPdf(attach: boolean): Promise<void>;
  setEventToggle(event: AutomaticEventKey, enabled: boolean): Promise<void>;
  setCcBcc(cc: string[], bcc: string[]): Promise<void>;
  refresh(): Promise<void>;
}

const DEFAULT_EVENT_TOGGLES: Record<AutomaticEventKey, boolean> = {
  invoice_created: true,
  order_created: true,
  order_assigned: true,
  order_delayed: true,
  order_delivered: true,
  payment_received: true,
  gold_receipt: true,
  advance_receipt: true,
  settlement: true,
  credit_note: true,
  document_cancelled: true,
  financial_report: true,
};

const STORAGE_KEY = "avs_email_config_cache";

function loadCachedConfig(): Partial<EmailConfigState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useEmailConfigStore = create<EmailConfigState>()((set, get) => {
  const cached = loadCachedConfig();

  const persist = async (updated: Partial<EmailConfigState>) => {
    const current = get();
    const payload = {
      senderMode: updated.senderMode ?? current.senderMode,
      avsSenderEmail: current.avsSenderEmail,
      avsSenderName: current.avsSenderName,
      tenantSenderEmail: updated.tenantSenderEmail ?? current.tenantSenderEmail,
      tenantSenderName: updated.tenantSenderName ?? current.tenantSenderName,
      autoEmailEnabled: updated.autoEmailEnabled ?? current.autoEmailEnabled,
      attachFullDocumentPdf: updated.attachFullDocumentPdf ?? current.attachFullDocumentPdf,
      ccAddresses: updated.ccAddresses ?? current.ccAddresses,
      bccAddresses: updated.bccAddresses ?? current.bccAddresses,
      eventToggles: updated.eventToggles ?? current.eventToggles,
    };
    set(payload);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore quota
      }
    }
    try {
      await supabase
        .from("app_settings")
        .upsert({ id: "email_config", data: payload } as any);
    } catch {
      // In offline/mock test environments, state is preserved in-memory
    }
  };

  return {
    senderMode: cached?.senderMode ?? "avs_company_email",
    avsSenderEmail: "notifications@maatarajewellers.shop",
    avsSenderName: "Maa Tara Jewellers (AVS Cloud Mail)",
    tenantSenderEmail: cached?.tenantSenderEmail ?? "",
    tenantSenderName: cached?.tenantSenderName ?? "",
    autoEmailEnabled: cached?.autoEmailEnabled ?? true,
    attachFullDocumentPdf: cached?.attachFullDocumentPdf ?? true,
    ccAddresses: cached?.ccAddresses ?? [],
    bccAddresses: cached?.bccAddresses ?? [],
    eventToggles: { ...DEFAULT_EVENT_TOGGLES, ...(cached?.eventToggles ?? {}) },

    setSenderMode: async (mode) => persist({ senderMode: mode }),
    updateTenantSender: async (info) =>
      persist({ tenantSenderEmail: info.email, tenantSenderName: info.name }),
    setAutoEmailEnabled: async (enabled) => persist({ autoEmailEnabled: enabled }),
    setAttachFullDocumentPdf: async (attach) => persist({ attachFullDocumentPdf: attach }),
    setEventToggle: async (event, enabled) => {
      const toggles = { ...get().eventToggles, [event]: enabled };
      await persist({ eventToggles: toggles });
    },
    setCcBcc: async (cc, bcc) => persist({ ccAddresses: cc, bccAddresses: bcc }),

    refresh: async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("data")
          .eq("id", "email_config")
          .maybeSingle();

        if (!error && data?.data) {
          const payload = data.data as any;
          set({
            senderMode: payload.senderMode ?? "avs_company_email",
            tenantSenderEmail: payload.tenantSenderEmail ?? "",
            tenantSenderName: payload.tenantSenderName ?? "",
            autoEmailEnabled: payload.autoEmailEnabled ?? true,
            attachFullDocumentPdf: payload.attachFullDocumentPdf ?? true,
            ccAddresses: payload.ccAddresses ?? [],
            bccAddresses: payload.bccAddresses ?? [],
            eventToggles: { ...DEFAULT_EVENT_TOGGLES, ...(payload.eventToggles ?? {}) },
          });
        }
      } catch {
        // Network offline fallback
      }
    },
  };
});

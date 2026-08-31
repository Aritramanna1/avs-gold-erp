/**
 * Communication Audit Store
 * Centralized audit log tracking all automatic & manual communications,
 * attached documents, delivery status, and providers.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type CommDeliveryStatus = "sent" | "failed" | "skipped_no_email" | "queued";
export type CommChannelType = "email" | "whatsapp" | "native_share" | "sms";

export interface CommAuditEntry {
  id: string;
  eventKey: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientName: string;
  documentType: string;
  documentNumber: string;
  attachmentName: string | null;
  channel: CommChannelType;
  status: CommDeliveryStatus;
  provider: string;
  errorMessage: string | null;
  timestamp: string;
  retryCount: number;
}

interface CommAuditState {
  entries: CommAuditEntry[];
  recordEntry(entry: Omit<CommAuditEntry, "id" | "timestamp" | "retryCount"> & { id?: string; timestamp?: string }): Promise<CommAuditEntry>;
  clearLogs(): Promise<void>;
  refresh(): Promise<void>;
}

const STORAGE_KEY = "avs_comm_audit_log_cache";

function loadCachedLogs(): CommAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useCommunicationAuditStore = create<CommAuditState>()((set, get) => {
  const cached = loadCachedLogs();

  return {
    entries: cached,

    recordEntry: async (entryInput) => {
      const fullEntry: CommAuditEntry = {
        id: entryInput.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: entryInput.timestamp || new Date().toISOString(),
        retryCount: 0,
        ...entryInput,
      };

      const updated = [fullEntry, ...get().entries.slice(0, 199)];
      set({ entries: updated });

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore
        }
      }

      try {
        await supabase.from("email_outbox" as never).insert({
          recipient_email: fullEntry.recipientEmail,
          subject: `${fullEntry.documentType} ${fullEntry.documentNumber}`,
          template_key: fullEntry.eventKey,
          status: fullEntry.status,
          external_message_id: fullEntry.id,
          sent_at: fullEntry.timestamp,
          error_message: fullEntry.errorMessage,
        } as never);
      } catch {
        // Fallback
      }

      return fullEntry;
    },

    clearLogs: async () => {
      set({ entries: [] });
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore
        }
      }
    },

    refresh: async () => {
      try {
        const { data } = await supabase
          .from("email_outbox" as never)
          .select("*")
          .order("sent_at", { ascending: false })
          .limit(100);

        if (Array.isArray(data) && data.length > 0) {
          const dbEntries: CommAuditEntry[] = data.map((d: any) => ({
            id: d.external_message_id || d.id,
            eventKey: d.template_key || "notification",
            recipientEmail: d.recipient_email,
            recipientPhone: null,
            recipientName: d.recipient_email ? d.recipient_email.split("@")[0] : "Recipient",
            documentType: "Business Document",
            documentNumber: d.subject || "—",
            attachmentName: "Document.pdf",
            channel: "email",
            status: d.status === "sent" ? "sent" : "failed",
            provider: "avs_company_mail",
            errorMessage: d.error_message || null,
            timestamp: d.sent_at || new Date().toISOString(),
            retryCount: 0,
          }));
          set({ entries: dbEntries });
        }
      } catch {
        // Fallback
      }
    },
  };
});

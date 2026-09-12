/**
 * AVS ERP — Central Webhook Management & Inspection Store
 *
 * Provides authoritative UI controls for:
 * - Real-time webhook logs inspection (Razorpay, WhatsApp, SMS, Custom)
 * - Safe manual [RETRY] action with idempotency protection
 * - Payload & error viewer
 * - Webhook simulation testing
 */

import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export interface WebhookLogItem {
  id: string;
  idempotencyKey: string;
  provider: string;
  eventType: string;
  status: "received" | "processing" | "processed" | "failed" | "ignored";
  signatureVerified: boolean;
  rawPayload: Record<string, any> | string;
  processedResult: Record<string, any> | null;
  retryCount: number;
  lastError: string | null;
  processingTimeMs: number;
  sourceIp: string;
  receivedAt: string;
  processedAt: string | null;
}

interface WebhookManagementState {
  logs: WebhookLogItem[];
  isLoading: boolean;
  retryingId: string | null;

  fetchLogs: () => Promise<void>;
  retryWebhook: (id: string, actorEmail?: string) => Promise<boolean>;
  simulateWebhook: (
    provider: string,
    eventType: string,
    payload: Record<string, any>,
  ) => Promise<boolean>;
}

const MOCK_WEBHOOK_LOGS: WebhookLogItem[] = [
  {
    id: "wh_log_001",
    idempotencyKey: "rzp_pay_92817348912_capt",
    provider: "razorpay",
    eventType: "payment.captured",
    status: "processed",
    signatureVerified: true,
    rawPayload: {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_N29K193Ks8a",
            amount: 1450000,
            currency: "INR",
            status: "captured",
            order_id: "order_K29184812",
            method: "upi",
            contact: "+919876543210",
          },
        },
      },
    },
    processedResult: { success: true, action: "payment_recorded", amount: 14500 },
    retryCount: 0,
    lastError: null,
    processingTimeMs: 42,
    sourceIp: "52.66.124.91",
    receivedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    processedAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "wh_log_002",
    idempotencyKey: "wa_msg_wamid_982137198",
    provider: "whatsapp",
    eventType: "messages.inbound",
    status: "processed",
    signatureVerified: true,
    rawPayload: {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "919876543210", id: "wamid_982137198", text: { body: "Can I get my invoice copy?" } }],
              },
            },
          ],
        },
      ],
    },
    processedResult: { success: true, action: "message_logged", from: "919876543210" },
    retryCount: 0,
    lastError: null,
    processingTimeMs: 35,
    sourceIp: "157.240.241.35",
    receivedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    processedAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "wh_log_003",
    idempotencyKey: "gen_cust_sync_9218734",
    provider: "custom",
    eventType: "customer.sync_failed",
    status: "failed",
    signatureVerified: true,
    rawPayload: {
      event: "customer.sync_failed",
      customerId: "CUST-9012",
      reason: "Network timeout communicating with remote CRM",
    },
    processedResult: { success: false, error: "Remote CRM 504 Gateway Timeout" },
    retryCount: 1,
    lastError: "Remote CRM 504 Gateway Timeout",
    processingTimeMs: 1200,
    sourceIp: "103.21.244.0",
    receivedAt: new Date(Date.now() - 120 * 60000).toISOString(),
    processedAt: new Date(Date.now() - 119 * 60000).toISOString(),
  },
];

export const useWebhookManagementStore = create<WebhookManagementState>((set, get) => ({
  logs: MOCK_WEBHOOK_LOGS,
  isLoading: false,
  retryingId: null,

  fetchLogs: async () => {
    set({ isLoading: true });
    try {
      const { data } = await (supabase as any)
        .from("inbound_webhooks")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        const mapped: WebhookLogItem[] = data.map((r: any) => ({
          id: r.id,
          idempotencyKey: r.idempotency_key,
          provider: r.provider,
          eventType: r.event_type,
          status: r.status,
          signatureVerified: r.signature_verified,
          rawPayload: typeof r.raw_payload === "string" ? JSON.parse(r.raw_payload) : r.raw_payload,
          processedResult: typeof r.processed_result === "string" ? JSON.parse(r.processed_result) : r.processed_result,
          retryCount: r.retry_count || 0,
          lastError: r.last_error,
          processingTimeMs: r.processing_time_ms || 0,
          sourceIp: r.source_ip || "0.0.0.0",
          receivedAt: r.received_at,
          processedAt: r.processed_at,
        }));
        set({ logs: mapped });
      }
    } catch {
      // Keep mock/local fallback
    } finally {
      set({ isLoading: false });
    }
  },

  retryWebhook: async (id: string, actorEmail = "admin@arivahly.in") => {
    set({ retryingId: id });
    try {
      const resp = await fetch("/api/webhooks/dispatcher.php?action=retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: id,
          actor_email: actorEmail,
        }),
      });

      const json = await resp.json().catch(() => ({ success: false }));
      if (resp.ok && json.success) {
        toast.success("Webhook safely reprocessed and resolved");
        await get().fetchLogs();
        return true;
      } else {
        toast.error(json.error || "Retry execution failed");
        return false;
      }
    } catch (err: any) {
      toast.error(err?.message || "Retry network failure");
      return false;
    } finally {
      set({ retryingId: null });
    }
  },

  simulateWebhook: async (provider, eventType, payload) => {
    try {
      const resp = await fetch(`/api/webhooks/dispatcher.php?provider=${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventType,
          ...payload,
        }),
      });

      const json = await resp.json().catch(() => ({ success: false }));
      if (resp.ok) {
        toast.success(`Simulation received: ${eventType}`);
        await get().fetchLogs();
        return true;
      } else {
        toast.error(json.error || "Simulation rejected");
        return false;
      }
    } catch (err: any) {
      toast.error(err?.message || "Simulation failed");
      return false;
    }
  },
}));

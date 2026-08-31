/**
 * WasenderAPI webhook event store backed by Supabase communication_logs.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type WebhookEventType = "message.incoming" | "message.status" | "session.status" | "unknown";

export type MessageDeliveryStatus = "sent" | "delivered" | "read" | "failed" | "unknown";

export interface WebhookEvent {
  id: string;
  receivedAt: number;
  type: WebhookEventType;
  messageId?: string;
  status?: MessageDeliveryStatus;
  phone?: string;
  text?: string;
  mediaUrl?: string;
  raw: unknown;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeStatus(raw: unknown): MessageDeliveryStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("read")) return "read";
  if (s.includes("deliver")) return "delivered";
  if (s.includes("sent")) return "sent";
  if (s.includes("fail") || s.includes("error")) return "failed";
  return "unknown";
}

export function normalizeWebhook(payload: unknown): Omit<WebhookEvent, "id" | "receivedAt"> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const event = String(p.event ?? p.type ?? "").toLowerCase();
  const data = (p.data ?? p) as Record<string, unknown>;

  if (event.includes("status") || data.status) {
    return {
      type: event.includes("session") ? "session.status" : "message.status",
      messageId: str(data.messageId ?? data.id),
      status: normalizeStatus(data.status),
      phone: str(data.to ?? data.recipient ?? data.phone),
      raw: payload,
    };
  }
  if (event.includes("message") || data.text || data.body) {
    return {
      type: "message.incoming",
      messageId: str(data.id ?? data.messageId),
      phone: str(data.from ?? data.sender ?? data.phone),
      text: str(data.text ?? data.body ?? data.caption),
      mediaUrl: str(data.mediaUrl ?? data.media ?? data.url),
      raw: payload,
    };
  }
  return { type: "unknown", raw: payload };
}

function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

function fromRow(row: Record<string, unknown>): WebhookEvent {
  const data = (row.data ?? {}) as Partial<WebhookEvent>;
  return {
    id: String(row.id),
    receivedAt: Date.parse(String(row.created_at ?? "")) || Date.now(),
    type: (data.type as WebhookEventType) ?? "unknown",
    messageId: data.messageId,
    status: data.status,
    phone: (row.phone as string) ?? data.phone,
    text: (row.body as string) ?? data.text,
    mediaUrl: data.mediaUrl,
    raw: data.raw ?? row.data,
  };
}

interface WebhookState {
  events: WebhookEvent[];
  refresh(): Promise<void>;
  ingest(payload: unknown): Promise<WebhookEvent>;
  statusFor(messageId: string): MessageDeliveryStatus | null;
  clear(): Promise<void>;
}

const MAX_EVENTS = 2000;

export const useWasenderWebhooks = create<WebhookState>()((set, get) => ({
  events: [],
  async refresh() {
    const { data, error } = await supabase
      .from("communication_logs" as never)
      .select("*")
      .eq("channel", "whatsapp")
      .eq("linked_table", "wasender_webhook")
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS);
    if (error) throw new Error(`Could not read webhook events: ${error.message}`);
    set({ events: ((data ?? []) as Record<string, unknown>[]).map(fromRow) });
  },
  async ingest(payload) {
    const event: WebhookEvent = {
      id: makeId(),
      receivedAt: Date.now(),
      ...normalizeWebhook(payload),
    };
    const { error } = await supabase.from("communication_logs" as never).upsert({
      id: event.id,
      channel: "whatsapp",
      direction: event.type === "message.incoming" ? "inbound" : "system",
      status: event.status ?? "unknown",
      phone: event.phone ?? null,
      body: event.text ?? null,
      linked_id: event.messageId ?? event.id,
      linked_table: "wasender_webhook",
      data: event,
    } as never);
    if (error) throw new Error(`Could not save webhook event: ${error.message}`);
    set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) }));
    return event;
  },
  statusFor(messageId) {
    const hit = get().events.find((e) => e.type === "message.status" && e.messageId === messageId);
    return hit?.status ?? null;
  },
  async clear() {
    const { error } = await supabase
      .from("communication_logs" as never)
      .delete()
      .eq("channel", "whatsapp")
      .eq("linked_table", "wasender_webhook");
    if (error) throw new Error(`Could not clear webhook events: ${error.message}`);
    set({ events: [] });
  },
}));

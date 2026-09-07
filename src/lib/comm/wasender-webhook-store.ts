/**
 * WasenderAPI & Meta Webhook event store backed by Supabase communication_logs.
 * Single source of truth for incoming messages, delivery reports, and 24h customer service windows.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { CANONICAL_WHATSAPP_PRICING, type MessageCategory } from "@/lib/comm/platform/communication-rate-cards-store";

export type WebhookEventType =
  | "message.incoming"
  | "message.status"
  | "session.status"
  | "unknown";

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
  category?: MessageCategory;
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

function classifyMessage(text?: string, isIncoming = false): MessageCategory {
  if (isIncoming) return "service";
  const lower = (text ?? "").toLowerCase();
  if (
    lower.includes("otp") ||
    lower.includes("invoice") ||
    lower.includes("receipt") ||
    lower.includes("challan") ||
    lower.includes("order") ||
    lower.includes("jama") ||
    lower.includes("karigar") ||
    lower.includes("verification")
  ) {
    return "utility";
  }
  if (
    lower.includes("discount") ||
    lower.includes("offer") ||
    lower.includes("festival") ||
    lower.includes("catalogue") ||
    lower.includes("collection") ||
    lower.includes("campaign")
  ) {
    return "marketing";
  }
  return "service";
}

export function normalizeWebhook(payload: unknown): Omit<WebhookEvent, "id" | "receivedAt"> {
  const p = (payload ?? {}) as Record<string, unknown>;
  const event = String(p.event ?? p.type ?? "").toLowerCase();
  const data = (p.data ?? p) as Record<string, unknown>;

  if (event.includes("status") || data.status) {
    const text = str(data.text ?? data.body ?? data.message);
    return {
      type: event.includes("session") ? "session.status" : "message.status",
      messageId: str(data.messageId ?? data.id),
      status: normalizeStatus(data.status),
      phone: str(data.to ?? data.recipient ?? data.phone),
      text,
      category: classifyMessage(text, false),
      raw: payload,
    };
  }
  if (event.includes("message") || data.text || data.body) {
    const text = str(data.text ?? data.body ?? data.caption);
    return {
      type: "message.incoming",
      messageId: str(data.id ?? data.messageId),
      phone: str(data.from ?? data.sender ?? data.phone),
      text,
      mediaUrl: str(data.mediaUrl ?? data.media ?? data.url),
      category: "service",
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
    category: data.category ?? classifyMessage((row.body as string) ?? data.text, row.direction === "inbound"),
    raw: data.raw ?? row.data,
  };
}

interface WebhookState {
  events: WebhookEvent[];
  refresh(): Promise<void>;
  ingest(payload: unknown): Promise<WebhookEvent>;
  statusFor(messageId: string): MessageDeliveryStatus | null;
  isWithin24HourWindow(phone: string): boolean;
  clear(): Promise<void>;
}

const MAX_EVENTS = 2000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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
    const normalized = normalizeWebhook(payload);
    
    // Idempotency: skip re-processing duplicate status event if already recorded
    if (normalized.messageId) {
      const existing = get().events.find(
        (e) => e.messageId === normalized.messageId && e.status === normalized.status
      );
      if (existing) {
        return existing;
      }
    }

    const event: WebhookEvent = {
      id: makeId(),
      receivedAt: Date.now(),
      ...normalized,
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
  isWithin24HourWindow(phone: string) {
    const clean = phone.replace(/\D/g, "");
    const now = Date.now();
    return get().events.some((e) => {
      if (e.type !== "message.incoming" || !e.phone) return false;
      const eventClean = e.phone.replace(/\D/g, "");
      return eventClean.endsWith(clean) || clean.endsWith(eventClean)
        ? now - e.receivedAt <= TWENTY_FOUR_HOURS_MS
        : false;
    });
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

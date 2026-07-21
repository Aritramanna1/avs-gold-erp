/**
 * WasenderAPI webhook event store (local, offline-first).
 *
 * WasenderAPI posts delivery statuses, read receipts and incoming customer
 * messages to a webhook URL. A LAN desktop app can't expose a public URL
 * directly, so events reach us one of two future ways (both feed `ingest`
 * below, so the rest of the app is agnostic to which):
 *   1. a small cloud relay that forwards webhook payloads to the app, or
 *   2. periodic polling of WasenderAPI for message status.
 * Either way every event is stored locally — this becomes the CRM
 * communication history the spec calls for. Nothing here depends on the cloud
 * for the LOCAL database; it only records what external WhatsApp reports.
 *
 * This module is the durable sink + a normalizer. Wiring an actual relay/poll
 * transport is a follow-up; the storage contract is stable so that work won't
 * touch any consumer.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WebhookEventType =
  | "message.incoming"
  | "message.status" // sent / delivered / read / failed
  | "session.status"
  | "unknown";

export type MessageDeliveryStatus = "sent" | "delivered" | "read" | "failed" | "unknown";

export interface WebhookEvent {
  id: string;
  receivedAt: number;
  type: WebhookEventType;
  /** WasenderAPI's own message id, when the event is about a message. */
  messageId?: string;
  /** For status events. */
  status?: MessageDeliveryStatus;
  /** Counterparty phone (incoming sender / outgoing recipient). */
  phone?: string;
  /** Incoming text / media caption. */
  text?: string;
  /** Media URL for incoming media messages. */
  mediaUrl?: string;
  /** Raw payload, kept for audit and for fields we don't model yet. */
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

/** Best-effort mapping of a raw WasenderAPI webhook payload to a WebhookEvent. */
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

interface WebhookState {
  events: WebhookEvent[];
  /** Store a raw webhook payload (from a relay/poll). Returns the stored event. */
  ingest(payload: unknown): WebhookEvent;
  /** Latest known delivery status for a message id, if any. */
  statusFor(messageId: string): MessageDeliveryStatus | null;
  clear(): void;
}

const MAX_EVENTS = 2000; // keep the local history bounded

export const useWasenderWebhooks = create<WebhookState>()(
  persist(
    (set, get) => ({
      events: [],
      ingest(payload) {
        const event: WebhookEvent = {
          id: makeId(),
          receivedAt: Date.now(),
          ...normalizeWebhook(payload),
        };
        set((s) => ({ events: [event, ...s.events].slice(0, MAX_EVENTS) }));
        return event;
      },
      statusFor(messageId) {
        const hit = get().events.find(
          (e) => e.type === "message.status" && e.messageId === messageId,
        );
        return hit?.status ?? null;
      },
      clear() {
        set({ events: [] });
      },
    }),
    { name: "mtj-wasender-webhooks-v1" },
  ),
);

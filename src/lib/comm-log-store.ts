/**
 * MTJ ERP — Communication log (WhatsApp manual flow).
 * We never claim "delivered" / "read" — no official API.
 */
import { create } from "zustand";
import type { TemplateKind, TemplateTarget } from "@/lib/wa-templates-store";
import { createRepository } from "./repositories/base-repository";

export type CommKind = "prepared" | "copied" | "opened_app" | "opened_web" | "manually_sent";

export const COMM_KIND_LABELS: Record<CommKind, string> = {
  prepared: "Prepared",
  copied: "Copied to clipboard",
  opened_app: "Opened in WhatsApp",
  opened_web: "Opened in WhatsApp Web",
  manually_sent: "Marked manually sent",
};

export type CommLinkedType = "order" | "job" | "invoice" | "repair" | "estimate";

export interface CommEvent {
  id: string;
  ts: number;
  kind: CommKind;
  templateKind: TemplateKind;
  templateName: string;
  target: TemplateTarget;
  recipientLabel: string;
  recipientPhone: string;
  linkedType: CommLinkedType;
  linkedId: string;
  body: string;
  /**
   * Raw provider-reported delivery status (queued/sent/delivered/failed/
   * deep_link_opened), when the send went through a real API provider via
   * comm/service.ts — undefined for the legacy manual-WhatsApp-paste flow,
   * which genuinely has no delivery visibility (see this file's header
   * comment). Kept separate from `kind` (a UI-action log, not a delivery
   * status) so provider status is never lost or conflated with it.
   */
  deliveryStatus?: "queued" | "sent" | "delivered" | "failed" | "deep_link_opened";
}

interface CommLogState {
  events: CommEvent[];
  record: (e: Omit<CommEvent, "id" | "ts">) => CommEvent;
  markSent: (id: string) => void;
  remove: (id: string) => void;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const commLogRepository = createRepository<CommEvent>("communication_logs");

export const useCommLog = create<CommLogState>()((set, get) => ({
  events: [],
  record: (input) => {
    const ev: CommEvent = { ...input, id: makeId(), ts: Date.now() };
    set({ events: [ev, ...get().events] });
    commLogRepository.save(ev).catch((err) => {
      console.error("Failed to persist communication log to Supabase:", err);
    });
    return ev;
  },
  markSent: (id) =>
    set({
      events: get().events.map((e) => (e.id === id ? { ...e, kind: "manually_sent" } : e)),
    }),
  remove: (id) => set({ events: get().events.filter((e) => e.id !== id) }),
  reset: () => set({ events: [] }),
}));

export function eventsFor(linkedType: CommLinkedType, linkedId: string): CommEvent[] {
  return useCommLog
    .getState()
    .events.filter((e) => e.linkedType === linkedType && e.linkedId === linkedId);
}

export type WaitingOnParty =
  "internal" | "customer" | "supplier" | "karigar" | "carrier" | "approval" | "other";

export interface CommitmentRecord {
  id: string;
  partyName: string;
  partyType: "customer" | "supplier" | "karigar" | "carrier";
  linkedType: CommLinkedType;
  linkedId: string;
  commitmentPromise: string;
  dueAt: string;
  waitingOn: WaitingOnParty;
  isOverdue: boolean;
  status: "pending" | "fulfilled" | "breached";
  createdAt: string;
}

export function isCommitmentOverdue(dueAtIso: string): boolean {
  return new Date(dueAtIso).getTime() < Date.now();
}

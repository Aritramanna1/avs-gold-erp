/**
 * MTJ ERP — Orders store
 * Persistent registry of customer orders.
 *
 * Weights in mg (integer), money in paise (integer), purity per-mille.
 */
import { create } from "zustand";
import { useSettings } from "./settings-store";
import { supabase } from "@/integrations/supabase/client";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";

export type OrderType = "custom" | "repair" | "polishing" | "ready_stock" | "wholesale";

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  custom: "Custom Manufacturing",
  repair: "Repair",
  polishing: "Polishing",
  ready_stock: "Ready Stock Sale",
  wholesale: "Wholesale / Bulk",
};

export type OrderStatus =
  | "draft"
  | "confirmed"
  | "awaiting_job_card"
  | "in_production"
  | "ready_billing"
  | "delivered"
  | "cancelled"
  | "gold_received"
  | "gold_issued"
  | "in_manufacturing"
  | "ready_for_delivery"
  | "received"
  | "under_inspection"
  | "sent_to_worker"
  | "repair_in_progress"
  | "ready"
  | "sent_for_polishing"
  | "polishing_in_progress"
  | "billed"
  | "partially_ready"
  | "partially_delivered";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  awaiting_job_card: "Awaiting Job Card",
  in_production: "In Production",
  ready_billing: "Ready for Billing",
  delivered: "Delivered",
  cancelled: "Cancelled",
  gold_received: "Gold Received",
  gold_issued: "Gold Issued",
  in_manufacturing: "In Manufacturing",
  ready_for_delivery: "Ready for Delivery",
  received: "Received",
  under_inspection: "Under Inspection",
  sent_to_worker: "Sent to Worker",
  repair_in_progress: "Repair in Progress",
  ready: "Ready",
  sent_for_polishing: "Sent for Polishing",
  polishing_in_progress: "Polishing in Progress",
  billed: "Billed",
  partially_ready: "Partially Ready",
  partially_delivered: "Partially Delivered",
};

export type Priority = "normal" | "high" | "urgent";

export interface OrderItem {
  itemName: string;
  category: string; // ring / chain / earring / pendant / bangle / necklace / other
  quantity: number;
  size?: string;
  metal: string; // gold / silver
  metalColor: string; // yellow / white / rose
  purity: number; // per-mille
  grossMg: number;
  lessMg: number;
  netMg: number;
  fineMg: number;
  expectedWastagePct: number; // tenths of a percent? we store as integer 0..1000 = 0..100.0%
  expectedWastageMg: number;
  stoneDetails?: string;
  remarks?: string;
  addMg?: number;
  stamp?: string;
  labourRupees?: number;
  amountRupees?: number;
}

export interface OrderAdvance {
  cashPaise: number;
  cashMode?: "cash" | "upi" | "bank" | "card";
  cashRef?: string;
  // Gold portion: can be "advance" pure-gold OR "old_gold" jewellery received
  goldKind?: "advance" | "old_gold";
  goldGrossMg: number;
  goldPurity?: number;
  goldFineMg: number;
  goldApplyMode?: "apply" | "credit"; // apply to this order vs hold as customer credit
  goldLedgerEntryId?: string;
  goldRatePerGram?: number; // optional, rupees per gram
}

export interface OrderDesign {
  designNumber?: string;
  customerCode?: string;
  pattern?: string;
  notes?: string;
  saveToCatalog?: boolean;
}

export type OrderSource = "walk_in" | "phone" | "whatsapp" | "manual";

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

export interface OrderTimelineEvent {
  ts: number;
  label: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  createdAt: number;
  updatedAt: number;
  type: OrderType;
  status: OrderStatus;
  customerId: string;
  karigarId?: string;
  expectedDelivery?: string; // YYYY-MM-DD
  priority: Priority;
  source: OrderSource;
  branchId?: string;
  whatsappSourceId?: string; // placeholder for future WhatsApp Ingestion phase
  design: OrderDesign;
  item: OrderItem;
  advance: OrderAdvance;
  timeline: OrderTimelineEvent[];
}

interface OrdersState {
  orders: Order[];
  refresh: () => Promise<void>;
  add: (
    o: Omit<Order, "id" | "createdAt" | "updatedAt" | "timeline" | "orderNo"> & {
      orderNo?: string;
      timeline?: OrderTimelineEvent[];
    },
    opts?: { silent?: boolean },
  ) => Promise<Order>;
  update: (id: string, patch: Partial<Order>) => Promise<void>;
  appendTimeline: (id: string, ev: OrderTimelineEvent) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function makeOrderNo(): Promise<string> {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const branchCode = useSettings.getState().firm?.shopName?.slice(0, 3).toUpperCase() || "ORD";
  const prefix = `${branchCode}-${yyyymmdd}-`;
  return nextDocumentNumber(`order:${yyyymmdd}`, prefix, 3);
}

const orderRepository = createRepository<Order>("orders");

/** Fire-and-forget communication automation trigger (Plan 1 Step 9) — never blocks or can fail the order mutation it follows. */
/** Orders in these statuses are considered production-ready and get a Job Card auto-created — see autoCreateJobCard. */
const JOB_CARD_ELIGIBLE_STATUSES: OrderStatus[] = ["awaiting_job_card", "confirmed"];

/**
 * Job Card must be auto-generated from Order — the only approved workflow
 * (no manual "Create Job Card" step). Fires from add() for orders created
 * directly into a production-ready status, and from update() for orders
 * (e.g. WhatsApp-sourced) that start as "draft" and get confirmed later.
 * Skips if a job card already exists for this order (avoids duplicates on
 * repeated status updates); karigar/priority/dates are inherited from the
 * order and remain editable afterward from the Job Card itself.
 */
async function autoCreateJobCard(order: Order): Promise<void> {
  const [{ useJobCards }, { usePeople }] = await Promise.all([
    import("./jobcards-store"),
    import("./people-store"),
  ]);
  if (useJobCards.getState().jobs.some((j) => j.orderId === order.id)) return;
  const people = usePeople.getState().people;
  const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;
  await useJobCards.getState().add({
    orderId: order.id,
    orderNo: order.orderNo,
    customerId: order.customerId,
    customerName: people.find((p) => p.id === order.customerId)?.fullName ?? "—",
    karigarId: karigar?.id,
    karigarName: karigar?.fullName,
    itemName: order.item.itemName,
    category: order.item.category,
    purity: order.item.purity,
    targetGrossMg: order.item.grossMg,
    targetNetMg: order.item.netMg,
    targetFineMg: order.item.fineMg,
    status: "ready_for_gold_issue",
    priority: order.priority,
    expectedDelivery: order.expectedDelivery,
    branchId: order.branchId,
  });
  await useOrders.getState().update(order.id, { status: "in_production" });
  await useOrders.getState().appendTimeline(order.id, {
    ts: Date.now(),
    label: "Job Card auto-created",
  });
}

function emitOrderEvent(
  eventKey: "order_confirmation" | "order_ready" | "order_delivered",
  order: Order,
): void {
  import("@/lib/people-store")
    .then(({ usePeople }) => {
      const person = usePeople.getState().people.find((p) => p.id === order.customerId);
      if (!person) return Promise.resolve();
      return import("@/lib/comm/comm-automation").then(({ emitBusinessEvent }) =>
        emitBusinessEvent(eventKey, {
          branchId: order.branchId ?? "default",
          recipient: { name: person.fullName, phone: person.phone, email: person.email },
          linkedId: order.id,
          linkedType: "order",
        }),
      );
    })
    .catch((err) => console.error(`[Orders] ${eventKey} automation failed:`, err));
}

export const useOrders = create<OrdersState>()((set, get) => ({
  orders: [],
  refresh: async () => {
    const { currentUserRole, selectedBranchId } = useSettings.getState();
    const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
    const bid =
      !currentUserRole || GLOBAL_ROLES.includes(currentUserRole)
        ? null
        : selectedBranchId || "MAIN";
    let q = supabase.from("orders").select("data").limit(10000);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      // DB error on refresh — leave existing state
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as Order | null)
      .filter((o): o is Order => !!o && !!o.id && !!o.orderNo);
    set({ orders: rows });
  },
  add: async (input, opts) => {
    const now = Date.now();
    const order: Order = {
      branchId: (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined,
      id: (input as { id?: string }).id ?? makeId(),
      createdAt: now,
      updatedAt: now,
      ...input,
      orderNo: input.orderNo ?? (await makeOrderNo()),
      timeline: input.timeline ?? [{ ts: now, label: "Order created" }],
    };
    await orderRepository.save(order);
    // Optimistic local update — realtime will confirm from DB
    set((s) => ({ orders: [order, ...s.orders] }));
    // opts.silent skips the customer-facing WhatsApp "order confirmation" event —
    // used by bulk/historical import so backfilling past orders doesn't send
    // false notifications to customers.
    if (!opts?.silent) emitOrderEvent("order_confirmation", order);
    if (JOB_CARD_ELIGIBLE_STATUSES.includes(order.status)) await autoCreateJobCard(order);
    return order;
  },
  update: async (id, patch) => {
    const current = get().orders.find((o) => o.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await orderRepository.save(updated);
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? updated : o)) }));

    // Event-driven communication automation (Plan 1 Step 9) — fires only on
    // an actual status transition into a customer-facing milestone, not on
    // every field update.
    if (patch.status && patch.status !== current.status) {
      const READY_STATUSES: OrderStatus[] = ["ready_billing", "ready", "ready_for_delivery"];
      if (READY_STATUSES.includes(patch.status)) emitOrderEvent("order_ready", updated);
      if (patch.status === "delivered") emitOrderEvent("order_delivered", updated);
      // Every order status transition is audited — best-effort so a logging
      // failure never blocks the update itself.
      try {
        const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
          import("./security/audit-log"),
          import("@/integrations/supabase/client"),
        ]);
        const { data } = await sb.auth.getSession();
        await appendAudit({
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
          action: "order.status_change",
          entityType: "orders",
          entityId: id,
          before: { status: current.status },
          after: { status: patch.status },
          deviceId: null,
        });
      } catch (err) {
        console.error("[Orders] Failed to audit-log status change:", err);
      }
      if (
        JOB_CARD_ELIGIBLE_STATUSES.includes(patch.status) &&
        !JOB_CARD_ELIGIBLE_STATUSES.includes(current.status)
      ) {
        await autoCreateJobCard(updated);
      }
    }
  },
  appendTimeline: async (id, ev) => {
    const current = get().orders.find((o) => o.id === id);
    if (!current) return;
    const updated = {
      ...current,
      timeline: [...current.timeline, ev],
      updatedAt: Date.now(),
    };
    await orderRepository.save(updated);
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? updated : o)) }));
  },
  remove: async (id) => {
    const current = get().orders.find((o) => o.id === id);
    await orderRepository.delete(id);
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
    // Order deletion is irreversible and high-risk — always audited.
    try {
      const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
        import("./security/audit-log"),
        import("@/integrations/supabase/client"),
      ]);
      const { data } = await sb.auth.getSession();
      await appendAudit({
        actorId: data.session?.user.id ?? null,
        actorEmail: data.session?.user.email ?? null,
        action: "order.delete",
        entityType: "orders",
        entityId: id,
        before: current ?? null,
        after: null,
        deviceId: null,
      });
    } catch (err) {
      console.error("[Orders] Failed to audit-log deletion:", err);
    }
  },
  reset: () => set({ orders: [] }),
}));

export const ITEM_CATEGORIES = [
  "Ring",
  "Chain",
  "Necklace",
  "Earring",
  "Pendant",
  "Bangle",
  "Bracelet",
  "Mangalsutra",
  "Nose Pin",
  "Other",
];

export const METAL_COLORS = ["Yellow", "White", "Rose"];
export const METALS = ["Gold", "Silver"];
export const PAYMENT_MODES: { value: NonNullable<OrderAdvance["cashMode"]>; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
];

export function rupeesToPaise(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const s = String(input).trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paiseToRupees(p: number): string {
  const abs = Math.abs(p);
  const r = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, "0");
  return `${p < 0 ? "-" : ""}${r.toLocaleString("en-IN")}.${c}`;
}

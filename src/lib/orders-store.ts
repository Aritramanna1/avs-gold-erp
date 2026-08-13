/**
 * MTJ ERP — Orders store
 * Persistent registry of customer orders.
 *
 * Weights in mg (integer), money in paise (integer), purity per-mille.
 */
import { create } from "zustand";
import { useSettings } from "./settings-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
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

/**
 * The life of a manufacturing ORDER — the customer-facing contract.
 *
 * An order status answers exactly one question: WHAT DO WE OWE THIS JEWELLER,
 * AND HOW FAR ALONG IS IT? It must NOT try to describe where the gold is or
 * which bench a piece is on — that is the Job Card's job (see JobStatus), and a
 * multi-item order has several job cards in several different states at once.
 * Trying to express both on one field is what produced 21 statuses, most of them
 * duplicates of each other or of a job card's state.
 *
 *   draft              → captured but not accepted (e.g. from WhatsApp)
 *   confirmed          → accepted; work not yet assigned to any karigar
 *   in_production      → at least one item is on a bench
 *   partially_ready    → some items finished, others still in production
 *   ready_for_delivery → every item is finished and checked
 *   billed             → invoiced
 *   delivered          → handed over
 *   cancelled          → dead
 *
 * Everything removed was either a duplicate (`awaiting_job_card` == confirmed;
 * `ready` / `ready_billing` == ready_for_delivery; `in_manufacturing` ==
 * in_production) or a Job Card state wearing an order's clothes (`gold_issued`,
 * `sent_to_worker`, `under_inspection`, `repair_in_progress`,
 * `polishing_in_progress`, …). Those live on the job card, where they can differ
 * per item.
 *
 * Legacy values remain in the type because they exist in saved records, and are
 * folded onto the live flow by `normalizeOrderStatus()` on read. Nothing writes
 * them any more.
 */
export type OrderStatus =
  | "draft"
  | "confirmed"
  | "in_production"
  | "partially_ready"
  | "ready_for_delivery"
  | "billed"
  | "delivered"
  | "cancelled"
  // ── Legacy, read-only. Normalized away on read; never written. ──
  | "awaiting_job_card"
  | "ready_billing"
  | "gold_received"
  | "gold_issued"
  | "in_manufacturing"
  | "received"
  | "under_inspection"
  | "sent_to_worker"
  | "repair_in_progress"
  | "ready"
  | "sent_for_polishing"
  | "polishing_in_progress"
  | "partially_delivered";

/** The live workflow, in order. Anything not here is legacy. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "draft",
  "confirmed",
  "in_production",
  "partially_ready",
  "ready_for_delivery",
  "billed",
  "delivered",
  "cancelled",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_production: "In Production",
  partially_ready: "Partially Ready",
  ready_for_delivery: "Ready for Delivery",
  billed: "Billed",
  delivered: "Delivered",
  cancelled: "Cancelled",

  // Legacy — labelled as their live equivalent, so an old order never displays
  // a status the workflow no longer has.
  awaiting_job_card: "Confirmed",
  ready_billing: "Ready for Delivery",
  gold_received: "Confirmed",
  gold_issued: "In Production",
  in_manufacturing: "In Production",
  received: "In Production",
  under_inspection: "In Production",
  sent_to_worker: "In Production",
  repair_in_progress: "In Production",
  ready: "Ready for Delivery",
  sent_for_polishing: "In Production",
  polishing_in_progress: "In Production",
  partially_delivered: "Partially Ready",
};

/**
 * Folds a stored status onto the live workflow. Every read goes through this —
 * an order saved months ago as `awaiting_job_card` must appear in today's
 * "Confirmed" filter, not vanish from every screen.
 */
export function normalizeOrderStatus(status: OrderStatus): OrderStatus {
  switch (status) {
    case "awaiting_job_card":
    case "gold_received":
      return "confirmed";
    case "gold_issued":
    case "in_manufacturing":
    case "received":
    case "under_inspection":
    case "sent_to_worker":
    case "repair_in_progress":
    case "sent_for_polishing":
    case "polishing_in_progress":
      return "in_production";
    case "ready":
    case "ready_billing":
      return "ready_for_delivery";
    case "partially_delivered":
      return "partially_ready";
    default:
      return status;
  }
}

export type Priority = "normal" | "high" | "urgent";

export interface OrderItem {
  /**
   * Stable identity of this line within the order. Reference images for the
   * line are stored under the `design_photo__<lineId>` attachment docKey (see
   * job-card-engine's lineReferenceDocKey), so the photo of THIS piece reaches
   * the karigar making it. Absent on orders created before multi-item.
   */
  lineId?: string;
  itemName: string;
  category: string; // ring / chain / earring / pendant / bangle / necklace / other
  quantity: number;
  size?: string;
  /**
   * Category-specific dimensions the karigar works to — ring size, chain
   * length, bangle inner diameter. Keys come from product-attributes.ts, which
   * decides which fields a category even has. Free-form on purpose: adding a
   * field there needs no schema change here.
   */
  attributes?: Record<string, string>;
  /**
   * Expected weight of ONE piece. `grossMg` is the line TOTAL
   * (perPieceGrossMg × quantity) — that is what the workshop must issue gold
   * for and what every downstream consumer already reads, so the total stays
   * authoritative and this is the per-piece figure the bench is told to hit.
   * Absent on orders created before per-piece capture (quantity was always 1).
   */
  perPieceGrossMg?: number;
  metal: string; // gold / silver
  metalColor: string; // yellow / white / rose
  purity: number; // per-mille
  /** Line TOTAL gross weight — perPieceGrossMg × quantity. */
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
  /**
   * The order's line items. A jeweller places several manufacturing jobs on one
   * order (a necklace, a pair of bangles, six rings) — each is its own bench
   * job with its own weight, purity and karigar, and each gets its own Job Card
   * (see autoCreateJobCard).
   */
  items: OrderItem[];
  /**
   * @deprecated Read `items` instead. Kept as a permanently-synced alias of
   * `items[0]` — every write path goes through `normalizeOrder()`, so this can
   * never drift. It exists because ~25 call sites (billing, ledger, reports,
   * WhatsApp placeholders, PDF generation) still read `order.item`; they stay
   * correct for the single-item orders that are the common case and are being
   * migrated to `items` module by module. Do not add new readers.
   */
  item: OrderItem;
  /**
   * The workshop's own label for the production type when it isn't one of the
   * five built-in `OrderType` workflows — e.g. "Antique Jadau", "Casting Job".
   * The built-ins gate real behaviour (repair/polishing/billing paths), so they
   * stay in code; anything a workshop adds in Settings rides on the `custom`
   * workflow and carries its label here. Display via `productionTypeLabel()`.
   */
  productionType?: string;
  advance: OrderAdvance;
  timeline: OrderTimelineEvent[];
}

/**
 * The one place an Order's shape is made whole. Accepts anything that has
 * either `items` or a legacy single `item` (orders written before multi-item,
 * and rows coming back from Supabase) and returns an order with both populated
 * and consistent. Every read path (refresh) and write path (add/update) runs
 * through it, so no consumer ever has to defend against a missing `items` or a
 * stale `item`.
 */
export function normalizeOrder<
  T extends { items?: OrderItem[]; item?: OrderItem; status?: OrderStatus },
>(o: T): T & { items: OrderItem[]; item: OrderItem } {
  const items = o.items?.length ? o.items : o.item ? [o.item] : [];
  return {
    ...o,
    items,
    item: (items[0] ?? o.item) as OrderItem,
    // Legacy statuses folded onto the live flow HERE, so no screen, filter or
    // report ever has to know the old ones existed.
    ...(o.status ? { status: normalizeOrderStatus(o.status) } : {}),
  };
}

/** Every line item on an order, safe on legacy single-item rows. */
export function orderItems(o: Pick<Order, "items" | "item">): OrderItem[] {
  return o.items?.length ? o.items : o.item ? [o.item] : [];
}

/** What to show the user for an order's production type. */
export function productionTypeLabel(o: Pick<Order, "type" | "productionType">): string {
  return o.productionType || ORDER_TYPE_LABELS[o.type];
}

/**
 * Maps a Production Type master value (Settings → Dropdowns → Order Type) onto
 * the stored order.
 *
 * The five built-in `OrderType` keys gate real behaviour — repair and polishing
 * route to different workflows, ready_stock and wholesale bill differently — so
 * they stay in code and are matched by name here. Anything else the workshop
 * adds in Settings is a manufacturing variant ("Antique Jadau", "Casting Job"):
 * it rides the `custom` workflow and keeps its own label on the order, so the
 * workshop sees its own vocabulary on screen and on paper without a user's
 * Settings edit ever being able to knock out the repair or billing path.
 */
const BUILTIN_TYPE_ALIASES: Record<string, OrderType> = {
  custom: "custom",
  custommanufacturing: "custom",
  repair: "repair",
  polishing: "polishing",
  readystock: "ready_stock",
  readystocksale: "ready_stock",
  wholesale: "wholesale",
  wholesalebulk: "wholesale",
};

export function resolveProductionType(value: string): {
  type: OrderType;
  productionType?: string;
} {
  const norm = value.toLowerCase().replace(/[^a-z]/g, "");
  const builtin = BUILTIN_TYPE_ALIASES[norm];
  if (builtin) return { type: builtin };
  return { type: "custom", productionType: value };
}

/** Order-level totals — what the workshop must issue and expects back, across all line items. */
export function orderTotals(o: Pick<Order, "items" | "item">): {
  quantity: number;
  grossMg: number;
  netMg: number;
  fineMg: number;
} {
  return orderItems(o).reduce(
    (acc, it) => ({
      quantity: acc.quantity + (it.quantity || 1),
      grossMg: acc.grossMg + (it.grossMg || 0),
      netMg: acc.netMg + (it.netMg || 0),
      fineMg: acc.fineMg + (it.fineMg || 0),
    }),
    { quantity: 0, grossMg: 0, netMg: 0, fineMg: 0 },
  );
}

interface OrdersState {
  orders: Order[];
  refresh: () => Promise<void>;
  add: (
    // `items` and `item` are both optional on input and both guaranteed on
    // output: pass either one (a multi-item create passes `items`, older call
    // sites still pass `item`) and normalizeOrder fills in the other.
    o: Omit<Order, "id" | "createdAt" | "updatedAt" | "timeline" | "orderNo" | "items" | "item"> & {
      orderNo?: string;
      timeline?: OrderTimelineEvent[];
      items?: OrderItem[];
      item?: OrderItem;
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

/**
 * Creates the Job Card for ONE line of an order, against ONE karigar.
 *
 * Job Cards are NOT created automatically when an order is saved. In a workshop
 * an order is taken first and reviewed, and only then is the work assigned — who
 * is free, who is good at this piece, what is already on their bench. Auto-
 * creating a card at order time invents an assignment nobody made, and (with no
 * karigar on it) puts a card into the workshop queue that isn't really work yet.
 *
 * So this is called explicitly, from the order screen, once per item, with the
 * karigar chosen at that moment. ONE CARD PER LINE, never merged: a necklace and
 * a ring on the same order are independent bench jobs that can run in parallel on
 * two different benches, each with its own gold issue and its own wastage — the
 * number a manufacturer is judged on.
 *
 * Refuses to create a second card for a line that already has one.
 */
export async function createJobCardForLine(
  order: Order,
  lineId: string | undefined,
  karigarId: string,
  opts: {
    /**
     * When the bench is expected to START this piece (YYYY-MM-DD).
     *
     * Distinct from the delivery deadline: work rarely begins the day an order
     * is taken. A karigar may be finishing something else, gold may not be
     * issued yet, or the piece may be deliberately queued. Capturing the start
     * date is what makes "this job is late" mean something before the delivery
     * date has already passed.
     */
    expectedStart?: string;
    priority?: Priority;
  } = {},
): Promise<void> {
  const [{ useJobCards }, { usePeople }] = await Promise.all([
    import("./jobcards-store"),
    import("./people-store"),
  ]);

  const items = orderItems(order);
  const item = lineId ? items.find((it) => it.lineId === lineId) : items[0];
  if (!item) throw new Error("That item is no longer on this order.");

  const existing = useJobCards.getState().jobs.filter((j) => j.orderId === order.id);
  const already = lineId
    ? existing.some((j) => j.lineId === lineId)
    : existing.some((j) => !j.lineId);
  if (already) throw new Error("This item already has a Job Card.");

  const people = usePeople.getState().people;
  const karigar = people.find((p) => p.id === karigarId);
  if (!karigar) throw new Error("Select a karigar to assign this work to.");

  await useJobCards.getState().add({
    orderId: order.id,
    orderNo: order.orderNo,
    lineId: item.lineId,
    customerId: order.customerId,
    customerName: people.find((p) => p.id === order.customerId)?.fullName ?? "—",
    karigarId: karigar.id,
    karigarName: karigar.fullName,
    itemName: item.itemName,
    category: item.category,
    attributes: item.attributes,
    quantity: item.quantity,
    perPieceGrossMg: item.perPieceGrossMg,
    purity: item.purity,
    targetGrossMg: item.grossMg,
    targetNetMg: item.netMg,
    targetFineMg: item.fineMg,
    status: "awaiting_gold_issue",
    priority: opts.priority ?? order.priority,
    expectedStart: opts.expectedStart,
    expectedDelivery: order.expectedDelivery,
    branchId: order.branchId,
  });

  // The order enters production when its FIRST piece is assigned, not when all
  // of them are — a workshop with one of three items on a bench is in production.
  if (existing.length === 0) {
    await useOrders.getState().update(order.id, { status: "in_production" });
  }
  await useOrders.getState().appendTimeline(order.id, {
    ts: Date.now(),
    label: `Job Card created — ${item.itemName}`,
    note: `Assigned to ${karigar.fullName}`,
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
    // Compatibility/detail cache only. High-volume order registers must use
    // route-level Supabase pagination instead of hydrating every historical
    // order into the browser on app startup.
    let q = supabase
      .from("orders")
      .select("data")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
    const { data, error } = await q;
    if (error) {
      // DB error on refresh — leave existing state
      return;
    }
    const rows = (data ?? [])
      .map((r) => r.data as Order | null)
      .filter((o): o is Order => !!o && !!o.id && !!o.orderNo)
      // Orders written before multi-item carry only `item` — give them an
      // `items` array on the way in, so nothing downstream has to know that
      // two generations of the row shape exist.
      .map(normalizeOrder);
    set({ orders: rows });
  },
  add: async (input, opts) => {
    const now = Date.now();
    const order: Order = normalizeOrder({
      branchId: (input as any).branchId ?? useSettings.getState().selectedBranchId ?? undefined,
      id: (input as { id?: string }).id ?? makeId(),
      createdAt: now,
      updatedAt: now,
      ...input,
      orderNo: input.orderNo ?? (await makeOrderNo()),
      timeline: input.timeline ?? [{ ts: now, label: "Order created" }],
    });
    await orderRepository.save(order);
    // Optimistic local update — realtime will confirm from DB
    set((s) => ({ orders: [order, ...s.orders] }));
    // opts.silent skips the customer-facing WhatsApp "order confirmation" event —
    // used by bulk/historical import so backfilling past orders doesn't send
    // false notifications to customers.
    if (!opts?.silent) emitOrderEvent("order_confirmation", order);
    // No Job Card here. Saving an order is not assigning work: the order is
    // reviewed first, then a karigar is chosen per item from the order screen
    // (see createJobCardForLine).
    return order;
  },
  update: async (id, patch) => {
    const current = get().orders.find((o) => o.id === id);
    if (!current) return;
    // normalizeOrder keeps `item` and `items[0]` from ever drifting apart —
    // a patch touching either one re-syncs the other.
    const updated = normalizeOrder({ ...current, ...patch, updatedAt: Date.now() });
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
          import("@/lib/providers/data-provider"),
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
      // Confirming an order no longer conjures Job Cards either — work is
      // assigned deliberately, per item, with a karigar chosen at that moment.
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
        import("@/lib/providers/data-provider"),
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

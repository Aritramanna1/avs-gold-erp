/**
 * Gold & Material Vault — generalizes the vault beyond raw gold into any
 * number of material categories (Raw Gold, Fine Gold, Old Gold, KDM, Ball,
 * Wire, Tube, Findings, other manufacturing materials, Recovery Gold,
 * Scrap, and any future category). This is deliberately a NEW, additive
 * system alongside ledger-store.ts's existing fine-gold-only bucket model
 * (vault/karigar/finished/customer/scrap) — that model is exactly what
 * Billing, Reports, Worker Gold Book, and Gold Settlement already depend on
 * today, and rewiring those call sites was explicitly out of scope for this
 * phase. See "Integration" extension points below for where those flows
 * will eventually connect.
 *
 * Every balance here is DERIVED from movements — never stored/edited
 * directly. The only "manual" path is `recordAdjustment()`, which still
 * goes through the same movement log and requires a reason + actor, exactly
 * like ledger-store.ts's own `adjustment` movement type — so "no manual
 * quantity editing" is enforced by there being no other write path at all,
 * not by a permission check alone.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAuditEntry } from "./security/audit-log";

// ── Material categories — extensible registry, not a closed enum ──────────

export type MaterialGroup = "gold" | "manufacturing_materials" | "recovery";

export interface MaterialCategoryDef {
  key: string;
  label: string;
  group: MaterialGroup;
}

/**
 * Built-in categories covering the minimum required set. New categories can
 * be added at runtime via `useMaterialVault.getState().registerCategory()`
 * without any code change elsewhere — every balance/history computation
 * below works off whatever categories actually appear in the movement log,
 * not off this list, so an unregistered-but-used category still balances
 * correctly; the registry only drives labels/grouping in the UI.
 */
export const DEFAULT_MATERIAL_CATEGORIES: MaterialCategoryDef[] = [
  { key: "raw_gold", label: "Raw Gold", group: "gold" },
  { key: "fine_gold", label: "Fine Gold", group: "gold" },
  { key: "old_gold", label: "Old Gold", group: "gold" },
  { key: "kdm", label: "KDM", group: "manufacturing_materials" },
  { key: "ball", label: "Ball", group: "manufacturing_materials" },
  { key: "wire", label: "Wire", group: "manufacturing_materials" },
  { key: "tube", label: "Tube", group: "manufacturing_materials" },
  { key: "findings", label: "Findings", group: "manufacturing_materials" },
  {
    key: "other_material",
    label: "Other Manufacturing Materials",
    group: "manufacturing_materials",
  },
  { key: "recovery_gold", label: "Recovery Gold", group: "recovery" },
  { key: "scrap", label: "Scrap", group: "recovery" },
];

export const MATERIAL_GROUP_LABELS: Record<MaterialGroup, string> = {
  gold: "Gold",
  manufacturing_materials: "Manufacturing Materials",
  recovery: "Recovery",
};

// ── Movements ───────────────────────────────────────────────────────────────

export type MaterialMovementType =
  | "purchase"
  | "conversion_out"
  | "conversion_in"
  | "worker_issue"
  | "worker_return"
  | "outside_work"
  | "adjustment"
  | "gold_sale";

export const MATERIAL_MOVEMENT_LABELS: Record<MaterialMovementType, string> = {
  purchase: "Purchase",
  conversion_out: "Material Conversion (Out)",
  conversion_in: "Material Conversion (In)",
  worker_issue: "Worker Issue",
  worker_return: "Worker Return",
  outside_work: "Outside Work",
  adjustment: "Adjustment",
  gold_sale: "Gold Sale",
};

export interface MaterialMovement {
  id: string;
  ts: number;
  category: string;
  type: MaterialMovementType;
  /** Signed mg — positive increases the category balance, negative decreases it. */
  deltaMg: number;
  grossMg: number;
  purity?: number;
  reference?: string;
  remarks?: string;
  /** Balance of this category immediately after this movement — computed at write time so history never needs to replay the whole log to render. */
  balanceAfterMg: number;
  /** Links the two halves of a Material Conversion (conversion_out + conversion_in) together. */
  conversionGroupId?: string;
  /** Gross-weight loss recorded by a conversion (fromGrossMg - toGrossMg). Only set on conversion_out. */
  conversionLossMg?: number;
  actorId?: string | null;
  actorEmail?: string | null;

  // ── Integration points — reserved, NOT wired in this phase ─────────────
  /** Future: Production Order this movement is issued/returned against. */
  relatedOrderId?: string;
  /** Future: the Gold Issue (order-issue-store.ts OrderIssue) this movement mirrors. */
  relatedIssueId?: string;
  /** Future: the Worker Return (worker-return-store.ts WorkerReturn) this movement mirrors. */
  relatedReturnId?: string;
  /** Future: Manufacturing Bill this movement's cost eventually rolls into. */
  manufacturingBillId?: string;
  /** Future: Gold Settlement this movement is reconciled against. */
  goldSettlementId?: string;

  // ── Future-readiness extension points — reserved, NOT implemented ──────
  /** Future: barcode-tracked inventory unit this movement refers to. */
  barcodeId?: string;
  /** Future: batch/lot this movement belongs to. */
  batchId?: string;
  /** Future: QR-tracked physical unit this movement refers to. */
  qrCode?: string;
  /** Future: which physical vault this movement applies to, once multiple vaults exist. Defaults to "main". */
  vaultId?: string;
  /** Future: which branch this movement belongs to, once multi-branch vaults are separated. */
  branchId?: string;
}

export interface CategoryBalance {
  category: string;
  label: string;
  group: MaterialGroup;
  balanceMg: number;
}

export interface GroupedBalances {
  categories: CategoryBalance[];
  byGroup: Record<MaterialGroup, CategoryBalance[]>;
  groupTotals: Record<MaterialGroup, number>;
  grandTotalMg: number;
}

const movementRepository = createRepository<MaterialMovement>("material_vault_movements");

// Guards a rapid double-click/double-submit from recording the same
// adjustment twice for the same category before React's disabled state
// commits — same class of race fixed in manufacturing-barcode-store.ts's
// generate() and reused across the other movement stores.
const adjustmentInFlight = new Set<string>();

function makeId(prefix = "mv"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function labelFor(categories: MaterialCategoryDef[], key: string): MaterialCategoryDef {
  return (
    categories.find((c) => c.key === key) ?? {
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      group: "manufacturing_materials",
    }
  );
}

/** Current balance for one category — derived by summing every movement's signed delta. Never stored. */
export function computeCategoryBalance(movements: MaterialMovement[], category: string): number {
  return movements.filter((m) => m.category === category).reduce((s, m) => s + m.deltaMg, 0);
}

/** Grouped balances across every category that has ever had a movement, plus any registered-but-unused category (shown at 0). */
export function computeMaterialBalances(
  movements: MaterialMovement[],
  categories: MaterialCategoryDef[] = DEFAULT_MATERIAL_CATEGORIES,
): GroupedBalances {
  const keysSeen = new Set<string>(categories.map((c) => c.key));
  for (const m of movements) keysSeen.add(m.category);

  const categoryBalances: CategoryBalance[] = Array.from(keysSeen).map((key) => {
    const def = labelFor(categories, key);
    return {
      category: key,
      label: def.label,
      group: def.group,
      balanceMg: computeCategoryBalance(movements, key),
    };
  });

  const byGroup: Record<MaterialGroup, CategoryBalance[]> = {
    gold: [],
    manufacturing_materials: [],
    recovery: [],
  };
  const groupTotals: Record<MaterialGroup, number> = {
    gold: 0,
    manufacturing_materials: 0,
    recovery: 0,
  };
  for (const cb of categoryBalances) {
    byGroup[cb.group].push(cb);
    groupTotals[cb.group] += cb.balanceMg;
  }
  for (const g of Object.keys(byGroup) as MaterialGroup[]) {
    byGroup[g].sort((a, b) => a.label.localeCompare(b.label));
  }

  const grandTotalMg = categoryBalances.reduce((s, c) => s + c.balanceMg, 0);

  return { categories: categoryBalances, byGroup, groupTotals, grandTotalMg };
}

interface MaterialVaultState {
  movements: MaterialMovement[];
  categories: MaterialCategoryDef[];
  refresh: () => Promise<void>;
  registerCategory: (def: MaterialCategoryDef) => void;
  /** Generic single-sided movement — Purchase, Worker Issue, Worker Return, Outside Work, Gold Sale all funnel through this with the appropriate `type`. */
  append: (
    input: Omit<MaterialMovement, "id" | "ts" | "balanceAfterMg">,
  ) => Promise<MaterialMovement>;
  /** The ONLY manual-edit path — an authorized adjustment entry, fully audited, never a silent balance overwrite. */
  recordAdjustment: (input: {
    category: string;
    deltaMg: number;
    reference?: string;
    remarks: string;
    actor: { id: string | null; email: string | null };
  }) => Promise<MaterialMovement>;
  /** Stamps this movement as consumed by a Manufacturing Bill — guards
   *  against a later auto-collect pass double-counting it. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

export const useMaterialVault = create<MaterialVaultState>()((set, get) => ({
  movements: [],
  categories: DEFAULT_MATERIAL_CATEGORIES,
  refresh: async () => set({ movements: await movementRepository.readAll() }),
  registerCategory: (def) =>
    set((s) => ({
      categories: s.categories.some((c) => c.key === def.key)
        ? s.categories
        : [...s.categories, def],
    })),
  append: async (input) => {
    const balanceBefore = computeCategoryBalance(get().movements, input.category);
    const movement: MaterialMovement = {
      ...input,
      id: makeId(),
      ts: Date.now(),
      balanceAfterMg: balanceBefore + input.deltaMg,
    };
    // Offline-first pilot (Priority 4.5): writes locally + enqueues the
    // outbox entry immediately (works with no internet), rather than
    // blocking on a direct Supabase round trip. The background scheduler
    // (sync-engine.ts's startSyncOutboxScheduler(), started in __root.tsx)
    // pushes it to Supabase within ~15s, on reconnect, or on next app boot.
    // material_vault_movements was chosen as the first repository to migrate
    // because it's append-only (no cross-row sequence dependency like
    // invoice/order numbering) and already the most heavily
    // sync-integration-tested table this sprint (order-workflow-integration
    // e2e exercises it end to end).
    await movementRepository.saveLocal(movement);
    set((s) => ({ movements: [movement, ...s.movements] }));
    await appendAuditEntry({
      actorId: movement.actorId ?? null,
      actorEmail: movement.actorEmail ?? null,
      action: `material_vault.${movement.type}`,
      entityType: "material_vault_movements",
      entityId: movement.id,
      before: null,
      after: movement,
      deviceId: null,
    });
    return movement;
  },
  recordAdjustment: async (input) => {
    if (!input.remarks.trim()) {
      throw new Error("A reason is required for a manual adjustment.");
    }
    if (adjustmentInFlight.has(input.category)) {
      throw new Error("An adjustment for this category is already being saved.");
    }
    if (input.deltaMg < 0) {
      const available = computeCategoryBalance(get().movements, input.category);
      if (Math.abs(input.deltaMg) > available) {
        throw new Error(
          `Adjustment would take ${labelFor(get().categories, input.category).label} negative — available ${(available / 1000).toFixed(3)} g, requested ${(Math.abs(input.deltaMg) / 1000).toFixed(3)} g.`,
        );
      }
    }
    adjustmentInFlight.add(input.category);
    try {
      return await get().append({
        category: input.category,
        type: "adjustment",
        deltaMg: input.deltaMg,
        grossMg: Math.abs(input.deltaMg),
        reference: input.reference,
        remarks: input.remarks.trim(),
        actorId: input.actor.id,
        actorEmail: input.actor.email,
      });
    } finally {
      adjustmentInFlight.delete(input.category);
    }
  },
  linkToManufacturingBill: async (id, billId) => {
    const mv = get().movements.find((m) => m.id === id);
    if (!mv || mv.manufacturingBillId) return;
    const updated: MaterialMovement = { ...mv, manufacturingBillId: billId };
    await movementRepository.updateLocal(id, { manufacturingBillId: billId });
    set((s) => ({ movements: s.movements.map((m) => (m.id === id ? updated : m)) }));
  },
  reset: () => set({ movements: [], categories: DEFAULT_MATERIAL_CATEGORIES }),
}));

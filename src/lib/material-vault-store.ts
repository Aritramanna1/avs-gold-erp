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
import { fineGoldMg } from "./gold";
import { fetchMaterialVaultMovements } from "./custody-flow-query";

// ── Material categories — extensible registry, not a closed enum ──────────

export type MaterialGroup = "gold" | "manufacturing_materials" | "recovery";

export interface MaterialCategoryDef {
  key: string;
  label: string;
  group: MaterialGroup;
  /**
   * Optional display hint only. Authoritative payable flag lives in
   * `maTaraWorkshopPolicy.materialPayableByCategoryKey` (default PAYABLE).
   */
  payable?: boolean;
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
  // Gold group — raw material form (the "Gold Held" bucket on the balance sheet).
  { key: "raw_gold", label: "Raw Gold", group: "gold" },
  { key: "fine_gold", label: "Fine Gold", group: "gold" },
  { key: "old_gold", label: "Old Gold", group: "gold" },
  // Manufacturing Materials — each individually stock-managed.
  { key: "kdm_balls", label: "KDM Balls", group: "manufacturing_materials" },
  { key: "chains", label: "Chains", group: "manufacturing_materials" },
  { key: "findings", label: "Findings", group: "manufacturing_materials" },
  { key: "locks", label: "Locks", group: "manufacturing_materials" },
  { key: "jump_rings", label: "Jump Rings", group: "manufacturing_materials" },
  { key: "components", label: "Components", group: "manufacturing_materials" },
  { key: "wire", label: "Wire", group: "manufacturing_materials" },
  { key: "tube", label: "Tube", group: "manufacturing_materials" },
  {
    key: "other_material",
    label: "Other Manufacturing Materials",
    group: "manufacturing_materials",
  },
  { key: "recovery_gold", label: "Recovery Gold", group: "recovery" },
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
  /** Configurable precious-metal family. Legacy movements default to Gold. */
  metal?: string;
  /** Economic owner of the metal, kept on every movement for reconciliation. */
  ownership?: "company" | "customer" | "karigar" | "supplier";
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

  // ── Integration points ──────────────────────────────────────────────────
  /** Production Order this movement is issued/returned against — populated by WorkerIssueDialog/WorkerReturnDialog/OutsideWorkIssueDialog. */
  relatedOrderId?: string;
  /** Future: the Worker Gold Book entry (worker-gold-book-store.ts WorkerGoldBookEntry, type "given") this movement mirrors. */
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
const materialConfigRepository = createRepository<{ id: string; key: string; value?: unknown }>(
  "platform_settings",
);

// ── Admin-configurable materials — persisted, nothing hard-coded ────────────
const CUSTOM_CATEGORIES_KEY = "material_custom_categories";

/** Compatibility helper. Admin-defined materials hydrate from Supabase in `refresh()`. */
export function readCustomCategories(): MaterialCategoryDef[] {
  return [];
}

async function writeCustomCategories(list: MaterialCategoryDef[]): Promise<void> {
  await materialConfigRepository.save({
    id: CUSTOM_CATEGORIES_KEY,
    key: CUSTOM_CATEGORIES_KEY,
    value: list,
  });
}

function customCategoriesFrom(categories: MaterialCategoryDef[]): MaterialCategoryDef[] {
  const builtIns = new Set(DEFAULT_MATERIAL_CATEGORIES.map((c) => c.key));
  return categories.filter((c) => !builtIns.has(c.key));
}

/** Built-ins + admin-defined materials, deduped by key (custom overrides on clash). */
export function mergeCategories(custom: MaterialCategoryDef[]): MaterialCategoryDef[] {
  const seen = new Set(DEFAULT_MATERIAL_CATEGORIES.map((c) => c.key));
  return [...DEFAULT_MATERIAL_CATEGORIES, ...custom.filter((c) => !seen.has(c.key))];
}

/** Slugify a material name into a stable category key. */
export function materialKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

function movementBalanceKey(m: Pick<MaterialMovement, "category" | "metal" | "purity">): string {
  return `${m.metal ?? "Gold"}::${m.category}::${m.purity ?? 0}`;
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

/**
 * A material stock item is (category × purity): "22K Chain" and "18K Chain" are
 * DISTINCT stock items even though both are Chains. Manufacturing materials are
 * not always fine gold, so each carries its own purity and fine-gold equivalent.
 */
export interface MaterialStockItem {
  key: string; // `${metal}::${category}::${purity}`
  metal: string;
  category: string;
  label: string;
  group: MaterialGroup;
  purity: number; // per-mille; 0 = non-gold / accessory
  weightMg: number; // net stock weight
  fineMg: number; // fine-gold equivalent = weight × purity ÷ 1000 (0 for non-gold)
  unit: string; // "g" for weighed, "pcs" reserved for future piece-counted items
}

/** Per-(category × purity) stock items — the individually managed material list. */
export function computeMaterialStockItems(
  movements: MaterialMovement[],
  categories: MaterialCategoryDef[] = DEFAULT_MATERIAL_CATEGORIES,
): MaterialStockItem[] {
  const map = new Map<string, MaterialStockItem>();
  for (const m of movements) {
    const metal = m.metal ?? "Gold";
    const purity = m.purity ?? 0;
    const key = `${metal}::${m.category}::${purity}`;
    const def = labelFor(categories, m.category);
    const item = map.get(key) ?? {
      key,
      metal,
      category: m.category,
      label: def.label,
      group: def.group,
      purity,
      weightMg: 0,
      fineMg: 0,
      unit: "g",
    };
    item.weightMg += m.deltaMg;
    // fineGoldMg() is the ERP-wide fine-gold formula (gross * purity / 999,
    // not /1000 — see its docstring). This used to reimplement it with /1000,
    // which silently under-reports fine gold vs. the ledger for every purity
    // below 999. Sign is reapplied after computing on the magnitude, since
    // fineGoldMg() requires a non-negative gross.
    item.fineMg +=
      purity > 0
        ? Math.sign(m.deltaMg) *
          (metal === "Gold"
            ? fineGoldMg(Math.abs(m.deltaMg), purity)
            : Math.round((Math.abs(m.deltaMg) * purity) / 1000))
        : 0;
    map.set(key, item);
  }
  return Array.from(map.values())
    .filter((i) => i.weightMg !== 0 || i.fineMg !== 0)
    .sort((a, b) => a.label.localeCompare(b.label) || b.purity - a.purity);
}

interface MaterialVaultState {
  movements: MaterialMovement[];
  categories: MaterialCategoryDef[];
  refresh: () => Promise<void>;
  registerCategory: (def: MaterialCategoryDef) => void;
  /** Remove an admin-defined material (built-ins are permanent, ignored). */
  removeCategory: (key: string) => void;
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
  categories: mergeCategories(readCustomCategories()),
  refresh: async () => {
    const persisted = await fetchMaterialVaultMovements();
    const settings = await materialConfigRepository.read(CUSTOM_CATEGORIES_KEY).catch(() => null);
    const remoteCustom = Array.isArray(settings?.value)
      ? (settings.value as MaterialCategoryDef[]).filter((c) => c && c.key && c.label && c.group)
      : [];
    set({
      movements: persisted,
      // Custom materials are admin-configurable and persisted — reload them so a
      // material added on another screen/session shows up here too.
      categories: mergeCategories(remoteCustom),
    });
  },
  registerCategory: (def) => {
    // Persist admin-defined materials so they survive reload; built-ins are
    // never written to the custom store (they always come from DEFAULT).
    const isDefault = DEFAULT_MATERIAL_CATEGORIES.some((c) => c.key === def.key);
    if (!isDefault) {
      const custom = customCategoriesFrom(get().categories).filter((c) => c.key !== def.key);
      void writeCustomCategories([...custom, def]);
      set({ categories: mergeCategories([...custom, def]) });
      return;
    }
    set({ categories: mergeCategories(customCategoriesFrom(get().categories)) });
  },
  removeCategory: (key) => {
    // Only admin-defined materials can be removed; built-ins are permanent.
    if (DEFAULT_MATERIAL_CATEGORIES.some((c) => c.key === key)) return;
    const custom = customCategoriesFrom(get().categories).filter((c) => c.key !== key);
    void writeCustomCategories(custom);
    set({ categories: mergeCategories(custom) });
  },
  append: async (input) => {
    const balanceBefore = get()
      .movements.filter((m) => movementBalanceKey(m) === movementBalanceKey(input))
      .reduce((sum, m) => sum + m.deltaMg, 0);
    if (balanceBefore + input.deltaMg < 0) {
      throw new Error("This metal, purity, and category balance cannot become negative.");
    }
    const movement: MaterialMovement = {
      ...input,
      metal: input.metal ?? "Gold",
      id: makeId(),
      ts: Date.now(),
      balanceAfterMg: balanceBefore + input.deltaMg,
    };
    await movementRepository.save(movement);
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
    await movementRepository.save(updated);
    set((s) => ({ movements: s.movements.map((m) => (m.id === id ? updated : m)) }));
  },
  reset: () => set({ movements: [], categories: DEFAULT_MATERIAL_CATEGORIES }),
}));

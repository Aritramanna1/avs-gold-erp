/**
 * Configurable fine-gold calculation engine.
 *
 * Named methods only — no eval. Admins pick a method per module in
 * Customization → Calculations. Posted transactions freeze a FormulaSnapshot;
 * later rule edits never rewrite history.
 *
 * Net Weight = Gross + Add − Less is invariant. Fine math is method-specific.
 */

import { fineGoldMg, gramsToMg, mgToGrams, normalizeFinenessBasis, type FinenessBasis, DEFAULT_FINENESS_BASIS } from "@/lib/gold";

export type FineGoldMethod = "hisob_100" | "metal_content_999" | "touch_100";
export type FineGoldBase = "gross" | "net";
export type { FinenessBasis };

export type GoldCalcModuleId =
  | "vault"
  | "karigar_issue"
  | "karigar_return"
  | "melt"
  | "retail_billing"
  | "purchase"
  | "stock"
  | "orders"
  | "gold_settlement"
  | "mfg_p_entry"
  | "mfg_billing"
  | "mfg_mp_entry"
  | "inventory_lots"
  | "conversion"
  | "opening_balance";

export const GOLD_CALC_MODULES: { id: GoldCalcModuleId; label: string }[] = [
  { id: "vault", label: "Gold Vault / opening" },
  { id: "karigar_issue", label: "Karigar gold issue" },
  { id: "karigar_return", label: "Karigar gold return" },
  { id: "melt", label: "Melt" },
  { id: "retail_billing", label: "Retail / ready-stock billing" },
  { id: "purchase", label: "Purchase" },
  { id: "stock", label: "Stock / tags" },
  { id: "orders", label: "Orders" },
  { id: "gold_settlement", label: "Gold Settlement / approval" },
  { id: "mfg_p_entry", label: "Manufacturing P (gold given)" },
  { id: "mfg_billing", label: "Manufacturing billing type" },
  { id: "mfg_mp_entry", label: "Manufacturing MP (gold received)" },
  { id: "inventory_lots", label: "Inventory lots" },
  { id: "conversion", label: "Conversion (Gold Vault / scrap)" },
  { id: "opening_balance", label: "Party opening gold" },
];

export interface ModuleGoldRule {
  method: FineGoldMethod;
  base: FineGoldBase;
  includeWastage: boolean;
  includeLess: boolean;
}

/**
 * How Conversion / Melt obtain source purity — business-owner configurable.
 * - ledger_line: always from selected vault/scrap line (locked)
 * - ledger_with_override: default from line; authorized roles may override with reason
 * - manual: operator enters purity (legacy; still posts through gold_ledger)
 */
export type SourcePurityMode = "ledger_line" | "ledger_with_override" | "manual";

export interface ModuleSourcePurityPolicy {
  mode: SourcePurityMode;
  /** Role labels that may override when mode is ledger_with_override (case-insensitive contains). */
  overrideRoles: string[];
  requireOverrideReason: boolean;
  requireConfirmBeforePost: boolean;
}

export const DEFAULT_SOURCE_PURITY_POLICY: ModuleSourcePurityPolicy = {
  mode: "ledger_with_override",
  overrideRoles: ["Owner", "Admin", "Manager", "saas_admin"],
  requireOverrideReason: true,
  requireConfirmBeforePost: true,
};

export interface GoldSourcePurityPolicies {
  conversion: ModuleSourcePurityPolicy;
  melt: ModuleSourcePurityPolicy;
}

export const DEFAULT_GOLD_SOURCE_PURITY_POLICIES: GoldSourcePurityPolicies = {
  conversion: { ...DEFAULT_SOURCE_PURITY_POLICY },
  melt: { ...DEFAULT_SOURCE_PURITY_POLICY },
};

/** Seeded from live code — do not change these defaults or posted numbers jump. */
export const DEFAULT_MODULE_GOLD_RULES: Record<GoldCalcModuleId, ModuleGoldRule> = {
  vault: { method: "metal_content_999", base: "gross", includeWastage: false, includeLess: true },
  karigar_issue: {
    method: "metal_content_999",
    base: "gross",
    includeWastage: false,
    includeLess: true,
  },
  karigar_return: {
    method: "metal_content_999",
    base: "net",
    includeWastage: false,
    includeLess: true,
  },
  melt: { method: "metal_content_999", base: "gross", includeWastage: false, includeLess: true },
  retail_billing: {
    method: "hisob_100",
    base: "net",
    includeWastage: true,
    includeLess: true,
  },
  purchase: { method: "hisob_100", base: "net", includeWastage: true, includeLess: true },
  stock: { method: "metal_content_999", base: "net", includeWastage: false, includeLess: true },
  orders: { method: "metal_content_999", base: "gross", includeWastage: false, includeLess: true },
  gold_settlement: { method: "hisob_100", base: "net", includeWastage: true, includeLess: true },
  mfg_p_entry: { method: "hisob_100", base: "net", includeWastage: true, includeLess: true },
  mfg_billing: { method: "hisob_100", base: "net", includeWastage: true, includeLess: true },
  mfg_mp_entry: { method: "touch_100", base: "gross", includeWastage: false, includeLess: false },
  inventory_lots: { method: "touch_100", base: "gross", includeWastage: false, includeLess: false },
  conversion: { method: "touch_100", base: "gross", includeWastage: false, includeLess: false },
  opening_balance: {
    method: "metal_content_999",
    base: "gross",
    includeWastage: false,
    includeLess: true,
  },
};

export const GOLD_CALC_RULES_ID = "gold_calculation_rules";

/** Firm-level calculation control — BASIC = ledger/arithmetic; ADVANCED = jewellery rules. */
export type CalculationMode = "basic" | "advanced";

/**
 * Individual jewellery rules (only active when calculationMode === "advanced").
 * Basic arithmetic (+ − × ÷) and document totals are always on.
 */
export interface JewelleryCalcFeatureFlags {
  purityCalculation: boolean;
  wastageCalculation: boolean;
  fineCalculation: boolean;
  alloyCalculation: boolean;
  automaticLoss: boolean;
  makingCalculation: boolean;
  settlementCalculation: boolean;
}

export const DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED: JewelleryCalcFeatureFlags = {
  purityCalculation: true,
  wastageCalculation: true,
  fineCalculation: true,
  alloyCalculation: true,
  automaticLoss: true,
  makingCalculation: true,
  settlementCalculation: true,
};

export const DEFAULT_JEWELLERY_CALC_FEATURES_BASIC: JewelleryCalcFeatureFlags = {
  purityCalculation: false,
  wastageCalculation: false,
  fineCalculation: false,
  alloyCalculation: false,
  automaticLoss: false,
  makingCalculation: false,
  settlementCalculation: false,
};

export const JEWELLERY_CALC_FEATURE_LABELS: {
  key: keyof JewelleryCalcFeatureFlags;
  label: string;
  help: string;
}[] = [
  {
    key: "purityCalculation",
    label: "Purity calculation",
    help: "Derive fine from purity / touch automatically.",
  },
  {
    key: "wastageCalculation",
    label: "Wastage calculation",
    help: "Include wastage % in Hisob / fine formulas.",
  },
  {
    key: "fineCalculation",
    label: "Fine calculation",
    help: "Auto-compute fine gold from named methods.",
  },
  {
    key: "alloyCalculation",
    label: "Alloy calculation",
    help: "Metal conversion / alloy mix formulas.",
  },
  {
    key: "automaticLoss",
    label: "Automatic loss",
    help: "Auto melt / process loss posting.",
  },
  {
    key: "makingCalculation",
    label: "Making / labour calculation",
    help: "Auto making-charge formulas from configured rates.",
  },
  {
    key: "settlementCalculation",
    label: "Settlement calculation",
    help: "Gold settlement Hisob / rate-cut automation.",
  },
];

/** Display-only — storage remains integer mg / per-mille / basis points. */
export type DisplayRoundingMode = "half_up" | "floor" | "ceil";

export interface GoldDisplayPrecision {
  /** Grams shown to operators (default 3 = exact mg). */
  gramDecimals: number;
  /** Percents such as melt recovery (default 2). */
  percentDecimals: number;
  roundingMode: DisplayRoundingMode;
}

export const DEFAULT_GOLD_DISPLAY_PRECISION: GoldDisplayPrecision = {
  gramDecimals: 3,
  percentDecimals: 2,
  roundingMode: "half_up",
};

export interface GoldCalculationRulesDoc {
  id: typeof GOLD_CALC_RULES_ID;
  version: number;
  /**
   * BASIC = user-controlled values + arithmetic/totals only.
   * ADVANCED = configured jewellery rules (subject to featureFlags).
   * Default advanced preserves historical firm behaviour.
   */
  calculationMode: CalculationMode;
  /** Deep jewellery rules — ignored when calculationMode is basic. */
  featureFlags: JewelleryCalcFeatureFlags;
  moduleMap: Record<GoldCalcModuleId, ModuleGoldRule>;
  displayPrecision: GoldDisplayPrecision;
  /**
   * Per-mille at or above this value is treated as pure / fine gold:
   * fine weight = gross weight (e.g. 999 → 10g in = 10g fine; set 950 to
   * treat 95% / 950‰ shop “fine” metal the same way). Default 999.
   */
  pureGoldMinPermille: number;
  /**
   * Metal-content fineness denominator (‰). When method is metal_content_999,
   * fine = base × purity ÷ finenessBasis. Choosing 995 uses 995 — never silently
   * substitutes 999. Default 999 preserves historical ledgers.
   */
  finenessBasis: FinenessBasis;
  /** Conversion / Melt source-purity behaviour (Customization → Calculations). */
  sourcePurityPolicy: GoldSourcePurityPolicies;
  updatedAt: number;
  updatedBy?: string;
}

export const DEFAULT_PURE_GOLD_MIN_PERMILLE = 999;

export function defaultGoldCalculationRules(): GoldCalculationRulesDoc {
  return {
    id: GOLD_CALC_RULES_ID,
    version: 1,
    calculationMode: "advanced",
    featureFlags: { ...DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED },
    moduleMap: { ...DEFAULT_MODULE_GOLD_RULES },
    displayPrecision: { ...DEFAULT_GOLD_DISPLAY_PRECISION },
    pureGoldMinPermille: DEFAULT_PURE_GOLD_MIN_PERMILLE,
    finenessBasis: DEFAULT_FINENESS_BASIS,
    sourcePurityPolicy: {
      conversion: { ...DEFAULT_SOURCE_PURITY_POLICY },
      melt: { ...DEFAULT_SOURCE_PURITY_POLICY },
    },
    updatedAt: 0,
  };
}


/** Effective flags: BASIC forces all deep jewellery rules off. */
export function effectiveJewelleryCalcFeatures(
  config?: GoldCalculationRulesDoc | null,
): JewelleryCalcFeatureFlags {
  const mode = config?.calculationMode === "advanced" ? "advanced" : "basic";
  if (mode === "basic") return { ...DEFAULT_JEWELLERY_CALC_FEATURES_BASIC };
  return {
    ...DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED,
    ...(config?.featureFlags ?? {}),
  };
}

export function isAdvancedCalculationMode(config?: GoldCalculationRulesDoc | null): boolean {
  return (config?.calculationMode ?? "basic") === "advanced";
}

export function isJewelleryCalcFeatureEnabled(
  flag: keyof JewelleryCalcFeatureFlags,
  config?: GoldCalculationRulesDoc | null,
): boolean {
  return effectiveJewelleryCalcFeatures(config)[flag] === true;
}

export function resolveSourcePurityPolicy(
  module: "conversion" | "melt",
  config?: GoldCalculationRulesDoc | null,
): ModuleSourcePurityPolicy {
  const defaults = DEFAULT_GOLD_SOURCE_PURITY_POLICIES[module];
  const raw = config?.sourcePurityPolicy?.[module];
  if (!raw) return { ...defaults };
  return {
    mode:
      raw.mode === "ledger_line" || raw.mode === "manual" || raw.mode === "ledger_with_override"
        ? raw.mode
        : defaults.mode,
    overrideRoles: Array.isArray(raw.overrideRoles) ? raw.overrideRoles.map(String) : defaults.overrideRoles,
    requireOverrideReason: raw.requireOverrideReason !== false,
    requireConfirmBeforePost: raw.requireConfirmBeforePost !== false,
  };
}

/** Whether the current role may override source purity under the configured policy. */
export function canOverrideSourcePurity(
  policy: ModuleSourcePurityPolicy,
  userRole: string | null | undefined,
): boolean {
  if (policy.mode === "ledger_line") return false;
  if (policy.mode === "manual") return true;
  const role = (userRole ?? "").toLowerCase();
  if (!role) return false;
  if (policy.overrideRoles.length === 0) return true;
  return policy.overrideRoles.some((r) => role.includes(String(r).toLowerCase()));
}

/** True when this purity is configured as shop “pure / fine” gold. */
export function isPureGoldPermille(
  purityPermille: number | null | undefined,
  config?: GoldCalculationRulesDoc | null,
): boolean {
  if (purityPermille == null || !Number.isFinite(purityPermille)) return false;
  const min = Math.max(
    1,
    Math.min(999, Math.round(config?.pureGoldMinPermille ?? DEFAULT_PURE_GOLD_MIN_PERMILLE)),
  );
  return Math.round(purityPermille) >= min;
}

/** Format mg → grams using firm display precision (never for re-storage). */
export function formatDisplayGrams(mg: number, config?: GoldCalculationRulesDoc | null): string {
  const prec = config?.displayPrecision ?? DEFAULT_GOLD_DISPLAY_PRECISION;
  return mgToGrams(mg, { decimals: prec.gramDecimals });
}

/** Format a 0–10000 basis-point ratio as a percent string for UI. */
export function formatDisplayPercentBp(
  basisPoints: number,
  config?: GoldCalculationRulesDoc | null,
): string {
  const prec = config?.displayPrecision ?? DEFAULT_GOLD_DISPLAY_PRECISION;
  const pct = basisPoints / 100;
  const d = Math.max(0, Math.min(4, prec.percentDecimals));
  if (prec.roundingMode === "floor") {
    const f = 10 ** d;
    return (Math.floor(pct * f) / f).toFixed(d);
  }
  if (prec.roundingMode === "ceil") {
    const f = 10 ** d;
    return (Math.ceil(pct * f) / f).toFixed(d);
  }
  return pct.toFixed(d);
}

export interface FineGoldInput {
  module: GoldCalcModuleId;
  grossMg: number;
  lessMg?: number;
  addMg?: number;
  tanchPct?: number;
  wastagePct?: number;
  purityPermille?: number;
  /**
   * User-authored fine (mg). Authoritative when fine calculation is OFF / BASIC mode.
   * Never silently overwritten by deep jewellery formulas in that case.
   */
  userFineMg?: number;
  /**
   * User-authored net (mg). When provided in BASIC / fine-off, prefer over recomputed net
   * only if includeLess would otherwise change a locked operator value — we still apply
   * Gross+Add−Less as basic arithmetic when less/add are supplied.
   */
  userNetMg?: number;
  method?: FineGoldMethod;
  base?: FineGoldBase;
  ruleId?: string;
  ruleVersion?: number;
}

export interface FormulaSnapshot {
  ruleId: string;
  ruleVersion: number;
  calculationMode?: CalculationMode;
  featureFlags?: JewelleryCalcFeatureFlags;
  method: FineGoldMethod;
  base: FineGoldBase;
  /** Metal-content denominator frozen at post (995 / 999 / 1000). */
  finenessBasis?: FinenessBasis;
  tanchPct?: number;
  purityPermille?: number;
  wastagePct?: number;
  grossMg: number;
  lessMg: number;
  addMg: number;
  netMg: number;
  fineMg: number;
  hisobPct?: number;
  computedAt: number;
  formulaLabel: string;
  /** Conversion/Melt: how source purity was resolved at post (frozen). */
  sourcePurityMode?: SourcePurityMode;
  sourcePurityOverridden?: boolean;
  sourcePurityOverrideReason?: string;
  ledgerLinePurityPermille?: number;
  targetPurityPermille?: number;
  /** True when fine was taken from user entry (BASIC / fineCalculation OFF). */
  userControlledFine?: boolean;
}

export interface FineGoldResult {
  netMg: number;
  fineMg: number;
  hisobPct?: number;
  method: FineGoldMethod;
  base: FineGoldBase;
  snapshot: FormulaSnapshot;
}

export function netWeightMg(grossMg: number, lessMg = 0, addMg = 0): number {
  if (!Number.isInteger(grossMg) || grossMg < 0) {
    throw new Error("grossMg must be a non-negative integer");
  }
  if (!Number.isInteger(lessMg) || lessMg < 0) {
    throw new Error("lessMg must be a non-negative integer");
  }
  if (!Number.isInteger(addMg) || addMg < 0) {
    throw new Error("addMg must be a non-negative integer");
  }
  return Math.max(0, grossMg + addMg - lessMg);
}

export function formulaLabel(
  method: FineGoldMethod,
  base: FineGoldBase,
  finenessBasis: FinenessBasis = DEFAULT_FINENESS_BASIS,
): string {
  const baseWord = base === "gross" ? "Gross" : "Net";
  if (method === "hisob_100") return `${baseWord} × (Tanch + Wastage) ÷ 100 → Fine`;
  if (method === "touch_100") return `${baseWord} × Tanch ÷ 100 → Fine`;
  const basis = normalizeFinenessBasis(finenessBasis);
  return `${baseWord} × Purity ÷ ${basis} → Fine`;
}

export function resolveModuleRule(
  module: GoldCalcModuleId,
  config?: GoldCalculationRulesDoc | null,
): ModuleGoldRule {
  return (
    config?.moduleMap?.[module] ??
    DEFAULT_MODULE_GOLD_RULES[module] ?? {
      method: "metal_content_999",
      base: "gross",
      includeWastage: false,
      includeLess: true,
    }
  );
}

function tanchToPermille(tanchPct: number): number {
  const permille = Math.round(tanchPct * 10);
  return Math.max(0, Math.min(999, permille));
}

function permilleToTanch(purityPermille: number): number {
  return purityPermille / 10;
}

/**
 * Compute fine gold using the named method for this module (or an explicit override).
 * Integer milligrams throughout. Hisob percents keep two decimals (e.g. 94.80).
 *
 * BASIC mode / disabled fineCalculation: basic Net = Gross+Add−Less only; fine stays
 * user-authored (userFineMg). Never silently invents jewellery fine from purity/wastage.
 */
export function computeFineGold(
  input: FineGoldInput,
  config?: GoldCalculationRulesDoc | null,
): FineGoldResult {
  const features = effectiveJewelleryCalcFeatures(config);
  const mode: CalculationMode = config?.calculationMode === "advanced" ? "advanced" : "basic";
  const rule = resolveModuleRule(input.module, config);
  const method = input.method ?? rule.method;
  const base = input.base ?? rule.base;
  const lessMg = rule.includeLess ? (input.lessMg ?? 0) : 0;
  const addMg = input.addMg ?? 0;
  // Basic arithmetic always on: Net = Gross + Add − Less
  const netMg = netWeightMg(input.grossMg, lessMg, addMg);
  const baseMg = base === "gross" ? input.grossMg : netMg;

  const tanchPct =
    input.tanchPct ??
    (input.purityPermille != null ? permilleToTanch(input.purityPermille) : undefined);
  const purityPermille =
    input.purityPermille ?? (tanchPct != null ? tanchToPermille(tanchPct) : undefined);

  const wastageAllowed = features.wastageCalculation && (rule.includeWastage || method === "hisob_100");
  const wastagePct = wastageAllowed ? (input.wastagePct ?? 0) : 0;

  const ruleId = input.ruleId ?? config?.id ?? GOLD_CALC_RULES_ID;
  const ruleVersion = input.ruleVersion ?? config?.version ?? 1;
  const finenessBasis = normalizeFinenessBasis(config?.finenessBasis ?? DEFAULT_FINENESS_BASIS);
  const flagsSnapshot = effectiveJewelleryCalcFeatures(config);

  // BASIC / fine OFF — user fine is authoritative when provided; auto-computes at 995 basis when not provided.
  if (!features.fineCalculation) {
    const autoFine =
      purityPermille != null && purityPermille > 0 && netMg > 0
        ? fineGoldMg(netMg, Math.min(purityPermille, 999), finenessBasis)
        : 0;
    const userFine =
      input.userFineMg != null && Number.isFinite(input.userFineMg) && input.userFineMg > 0
        ? Math.max(0, Math.round(input.userFineMg))
        : autoFine;
    const snapshot: FormulaSnapshot = {
      ruleId,
      ruleVersion,
      calculationMode: mode,
      featureFlags: flagsSnapshot,
      method,
      base,
      finenessBasis,
      tanchPct,
      purityPermille,
      wastagePct: input.wastagePct || undefined,
      grossMg: input.grossMg,
      lessMg,
      addMg,
      netMg,
      fineMg: userFine,
      computedAt: Date.now(),
      formulaLabel:
        input.userFineMg != null && input.userFineMg > 0
          ? "Fine = user-entered"
          : formulaLabel(method, base, finenessBasis),
      userControlledFine: input.userFineMg != null && input.userFineMg > 0 ? true : undefined,
    };
    return { netMg, fineMg: userFine, method, base, snapshot };
  }


  let fineMg = 0;
  let hisobPct: number | undefined;
  let userControlledFine = false;

  // Shop pure-gold threshold only when purity calculation is enabled
  if (features.purityCalculation && isPureGoldPermille(purityPermille, config)) {
    fineMg = Math.round(baseMg);
  } else if (!features.purityCalculation && method !== "hisob_100") {
    // Purity/touch auto-derive disabled — keep user fine if given
    if (input.userFineMg != null && Number.isFinite(input.userFineMg)) {
      fineMg = Math.max(0, Math.round(input.userFineMg));
      userControlledFine = true;
    } else {
      fineMg = 0;
      userControlledFine = true;
    }
  } else if (method === "hisob_100") {
    if (tanchPct == null || !Number.isFinite(tanchPct)) {
      throw new Error("hisob_100 requires Tanch / touch %");
    }
    hisobPct = Math.round((tanchPct + wastagePct) * 100) / 100;
    fineMg = Math.round((baseMg * hisobPct) / 100);
  } else if (method === "touch_100") {
    if (tanchPct == null || !Number.isFinite(tanchPct)) {
      throw new Error("touch_100 requires Tanch / touch %");
    }
    fineMg = Math.round((baseMg * tanchPct) / 100);
  } else {
    if (purityPermille == null || !Number.isInteger(purityPermille)) {
      throw new Error("metal_content_999 requires integer per-mille purity");
    }
    const basis = normalizeFinenessBasis(config?.finenessBasis ?? DEFAULT_FINENESS_BASIS);
    fineMg = fineGoldMg(baseMg, Math.min(purityPermille, 999), basis);
  }

  const snapshot: FormulaSnapshot = {
    ruleId,
    ruleVersion,
    calculationMode: mode,
    featureFlags: flagsSnapshot,
    method,
    base,
    finenessBasis,
    tanchPct,
    purityPermille,
    wastagePct: wastagePct || undefined,
    grossMg: input.grossMg,
    lessMg,
    addMg,
    netMg,
    fineMg,
    hisobPct,
    computedAt: Date.now(),
    formulaLabel: userControlledFine
      ? "Purity calculation OFF — Fine = user-entered"
      : formulaLabel(method, base, finenessBasis),
    userControlledFine: userControlledFine || undefined,
  };

  return { netMg, fineMg, hisobPct, method, base, snapshot };
}

/** Readers must use the frozen snapshot fine, never the live rule. */
export function postedFineMg(
  storedFineMg: number | null | undefined,
  snapshot?: FormulaSnapshot | null,
): number {
  if (snapshot && Number.isInteger(snapshot.fineMg)) return snapshot.fineMg;
  return storedFineMg ?? 0;
}

export function goldCashIsolation(input: {
  goldFineMg?: number;
  cashPaise?: number;
}): { goldFineMg: number; cashPaise: number } {
  return {
    goldFineMg: input.goldFineMg ?? 0,
    cashPaise: input.cashPaise ?? 0,
  };
}

/** Preview helper for Customization (grams in, grams out). */
export function previewFineGoldGrams(opts: {
  method: FineGoldMethod;
  base: FineGoldBase;
  grossGrams: number;
  lessGrams?: number;
  tanchPct?: number;
  wastagePct?: number;
  purityPermille?: number;
  finenessBasis?: FinenessBasis;
  config?: GoldCalculationRulesDoc | null;
}): { netGrams: string; fineGrams: string; label: string; hisobPct?: number } {
  const config =
    opts.config ??
    (opts.finenessBasis
      ? { ...defaultGoldCalculationRules(), finenessBasis: opts.finenessBasis }
      : undefined);
  const result = computeFineGold(
    {
      module: "gold_settlement",
      grossMg: gramsToMg(opts.grossGrams),
      lessMg: gramsToMg(opts.lessGrams ?? 0),
      tanchPct: opts.tanchPct,
      wastagePct: opts.wastagePct,
      purityPermille: opts.purityPermille,
      method: opts.method,
      base: opts.base,
    },
    config,
  );
  return {
    netGrams: mgToGrams(result.netMg),
    fineGrams: mgToGrams(result.fineMg),
    label: result.snapshot.formulaLabel,
    hisobPct: result.hisobPct,
  };
}

/**
 * Prefer this over bare fineGoldMg at write sites that have not yet migrated to
 * computeFineGold — applies the live Customization fineness basis.
 */
export function fineGoldMgConfigured(
  grossMg: number,
  purityPermille: number,
  config?: GoldCalculationRulesDoc | null,
): number {
  const basis = normalizeFinenessBasis(config?.finenessBasis ?? DEFAULT_FINENESS_BASIS);
  if (isPureGoldPermille(purityPermille, config)) return Math.round(grossMg);
  return fineGoldMg(grossMg, purityPermille, basis);
}

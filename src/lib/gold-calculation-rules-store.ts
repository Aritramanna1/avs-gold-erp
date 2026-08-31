/**
 * Firm-scoped gold calculation rules.
 * Persisted to app_settings[id="gold_calculation_rules"].
 * Version increments on every save so posted snapshots stay frozen.
 */
import { create } from "zustand";
import { createRepository } from "@/lib/repositories/base-repository";
import {
  GOLD_CALC_RULES_ID,
  DEFAULT_GOLD_DISPLAY_PRECISION,
  DEFAULT_GOLD_SOURCE_PURITY_POLICIES,
  DEFAULT_SOURCE_PURITY_POLICY,
  DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED,
  DEFAULT_JEWELLERY_CALC_FEATURES_BASIC,
  defaultGoldCalculationRules,
  type CalculationMode,
  type GoldCalcModuleId,
  type GoldCalculationRulesDoc,
  type GoldDisplayPrecision,
  type GoldSourcePurityPolicies,
  type JewelleryCalcFeatureFlags,
  type ModuleGoldRule,
  type ModuleSourcePurityPolicy,
  type FinenessBasis,
} from "@/lib/gold-calculation-rules";
import { normalizeFinenessBasis } from "@/lib/gold";
import { resolveAppSettingsReadId } from "@/lib/firm-scoped-app-settings";

const repo = createRepository<{ id: string } & Record<string, unknown>>("app_settings");

async function goldCalcRulesSettingsId(): Promise<string> {
  return resolveAppSettingsReadId(GOLD_CALC_RULES_ID);
}

export type SaveGoldCalcOptions = {
  moduleMap: Record<GoldCalcModuleId, ModuleGoldRule>;
  updatedBy?: string;
  displayPrecision?: GoldDisplayPrecision;
  pureGoldMinPermille?: number;
  finenessBasis?: FinenessBasis;
  sourcePurityPolicy?: GoldSourcePurityPolicies;
  calculationMode?: CalculationMode;
  featureFlags?: JewelleryCalcFeatureFlags;
};

interface GoldCalculationRulesState {
  doc: GoldCalculationRulesDoc;
  hydrated: boolean;
  saving: boolean;
  hydrate: () => Promise<void>;
  /** @deprecated Prefer saveRules — kept for existing call sites. */
  saveModuleMap: (
    moduleMap: Record<GoldCalcModuleId, ModuleGoldRule>,
    updatedBy?: string,
    displayPrecision?: GoldDisplayPrecision,
    pureGoldMinPermille?: number,
    finenessBasis?: FinenessBasis,
    sourcePurityPolicy?: GoldSourcePurityPolicies,
    calculationMode?: CalculationMode,
    featureFlags?: JewelleryCalcFeatureFlags,
  ) => Promise<GoldCalculationRulesDoc>;
  saveRules: (opts: SaveGoldCalcOptions) => Promise<GoldCalculationRulesDoc>;
  ruleFor: (module: GoldCalcModuleId) => ModuleGoldRule;
}

function parseDisplayPrecision(raw: unknown): GoldDisplayPrecision {
  const d = DEFAULT_GOLD_DISPLAY_PRECISION;
  if (!raw || typeof raw !== "object") return { ...d };
  const p = raw as Partial<GoldDisplayPrecision>;
  const gramDecimals =
    typeof p.gramDecimals === "number" && p.gramDecimals >= 0 && p.gramDecimals <= 6
      ? Math.round(p.gramDecimals)
      : d.gramDecimals;
  const percentDecimals =
    typeof p.percentDecimals === "number" && p.percentDecimals >= 0 && p.percentDecimals <= 4
      ? Math.round(p.percentDecimals)
      : d.percentDecimals;
  const roundingMode =
    p.roundingMode === "floor" || p.roundingMode === "ceil" || p.roundingMode === "half_up"
      ? p.roundingMode
      : d.roundingMode;
  return { gramDecimals, percentDecimals, roundingMode };
}

function parseSourcePurityPolicy(
  raw: unknown,
  fallback: ModuleSourcePurityPolicy,
): ModuleSourcePurityPolicy {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const p = raw as Partial<ModuleSourcePurityPolicy>;
  return {
    mode:
      p.mode === "ledger_line" || p.mode === "manual" || p.mode === "ledger_with_override"
        ? p.mode
        : fallback.mode,
    overrideRoles: Array.isArray(p.overrideRoles)
      ? p.overrideRoles.map(String)
      : [...fallback.overrideRoles],
    requireOverrideReason: p.requireOverrideReason !== false,
    requireConfirmBeforePost: p.requireConfirmBeforePost !== false,
  };
}

function parseSourcePurityPolicies(raw: unknown): GoldSourcePurityPolicies {
  const d = DEFAULT_GOLD_SOURCE_PURITY_POLICIES;
  if (!raw || typeof raw !== "object") {
    return {
      conversion: { ...DEFAULT_SOURCE_PURITY_POLICY },
      melt: { ...DEFAULT_SOURCE_PURITY_POLICY },
    };
  }
  const p = raw as Partial<GoldSourcePurityPolicies>;
  return {
    conversion: parseSourcePurityPolicy(p.conversion, d.conversion),
    melt: parseSourcePurityPolicy(p.melt, d.melt),
  };
}

function parseFeatureFlags(raw: unknown, mode: CalculationMode): JewelleryCalcFeatureFlags {
  const base =
    mode === "basic"
      ? DEFAULT_JEWELLERY_CALC_FEATURES_BASIC
      : DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED;
  if (!raw || typeof raw !== "object") return { ...base };
  const p = raw as Partial<JewelleryCalcFeatureFlags>;
  return {
    purityCalculation: p.purityCalculation ?? base.purityCalculation,
    wastageCalculation: p.wastageCalculation ?? base.wastageCalculation,
    fineCalculation: p.fineCalculation ?? base.fineCalculation,
    alloyCalculation: p.alloyCalculation ?? base.alloyCalculation,
    automaticLoss: p.automaticLoss ?? base.automaticLoss,
    makingCalculation: p.makingCalculation ?? base.makingCalculation,
    settlementCalculation: p.settlementCalculation ?? base.settlementCalculation,
  };
}

function parseDoc(row: unknown): GoldCalculationRulesDoc {
  const defaults = defaultGoldCalculationRules();
  if (!row || typeof row !== "object") return defaults;
  const data = row as Partial<GoldCalculationRulesDoc>;
  const pureRaw = (data as { pureGoldMinPermille?: unknown }).pureGoldMinPermille;
  const pureGoldMinPermille =
    typeof pureRaw === "number" && Number.isFinite(pureRaw)
      ? Math.max(1, Math.min(999, Math.round(pureRaw)))
      : defaults.pureGoldMinPermille;
  const finenessBasis = normalizeFinenessBasis(
    (data as { finenessBasis?: unknown }).finenessBasis ?? defaults.finenessBasis,
  );
  const calculationMode: CalculationMode =
    data.calculationMode === "advanced" ? "advanced" : "basic";
  return {
    id: GOLD_CALC_RULES_ID,
    version: Number.isInteger(data.version) && (data.version ?? 0) > 0 ? data.version! : 1,
    calculationMode,
    featureFlags: parseFeatureFlags(data.featureFlags, calculationMode),
    moduleMap: { ...defaults.moduleMap, ...(data.moduleMap ?? {}) },
    displayPrecision: parseDisplayPrecision(data.displayPrecision),
    pureGoldMinPermille,
    finenessBasis,
    sourcePurityPolicy: parseSourcePurityPolicies(
      (data as { sourcePurityPolicy?: unknown }).sourcePurityPolicy,
    ),
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
    updatedBy: data.updatedBy,
  };
}

export const useGoldCalculationRules = create<GoldCalculationRulesState>()((set, get) => ({
  doc: defaultGoldCalculationRules(),
  hydrated: false,
  saving: false,

  hydrate: async () => {
    try {
      const id = await goldCalcRulesSettingsId();
      const row = await repo.read(id);
      set({ doc: parseDoc(row), hydrated: true });
    } catch {
      set({ doc: defaultGoldCalculationRules(), hydrated: true });
    }
  },

  saveRules: async (opts) => {
    set({ saving: true });
    try {
      const prev = get().doc;
      const pure =
        typeof opts.pureGoldMinPermille === "number" && Number.isFinite(opts.pureGoldMinPermille)
          ? Math.max(1, Math.min(999, Math.round(opts.pureGoldMinPermille)))
          : prev.pureGoldMinPermille;
      const calculationMode: CalculationMode =
        opts.calculationMode === "basic"
          ? "basic"
          : opts.calculationMode === "advanced"
            ? "advanced"
            : prev.calculationMode ?? "basic";
      const featureFlags =
        calculationMode === "basic"
          ? { ...DEFAULT_JEWELLERY_CALC_FEATURES_BASIC }
          : parseFeatureFlags(opts.featureFlags ?? prev.featureFlags, "advanced");
      const next: GoldCalculationRulesDoc = {
        id: GOLD_CALC_RULES_ID,
        version: prev.version + 1,
        calculationMode,
        featureFlags,
        moduleMap: opts.moduleMap,
        displayPrecision: opts.displayPrecision
          ? parseDisplayPrecision(opts.displayPrecision)
          : prev.displayPrecision,
        pureGoldMinPermille: pure,
        finenessBasis: normalizeFinenessBasis(opts.finenessBasis ?? prev.finenessBasis),
        sourcePurityPolicy: opts.sourcePurityPolicy
          ? parseSourcePurityPolicies(opts.sourcePurityPolicy)
          : prev.sourcePurityPolicy ?? {
              conversion: { ...DEFAULT_SOURCE_PURITY_POLICY },
              melt: { ...DEFAULT_SOURCE_PURITY_POLICY },
            },
        updatedAt: Date.now(),
        updatedBy: opts.updatedBy,
      };
      await repo.saveAs(await goldCalcRulesSettingsId(), { ...next });
      set({ doc: next, saving: false });
      return next;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  saveModuleMap: async (
    moduleMap,
    updatedBy,
    displayPrecision,
    pureGoldMinPermille,
    finenessBasis,
    sourcePurityPolicy,
    calculationMode,
    featureFlags,
  ) => {
    return get().saveRules({
      moduleMap,
      updatedBy,
      displayPrecision,
      pureGoldMinPermille,
      finenessBasis,
      sourcePurityPolicy,
      calculationMode,
      featureFlags,
    });
  },

  ruleFor: (module) => get().doc.moduleMap[module] ?? defaultGoldCalculationRules().moduleMap[module],
}));

export function currentGoldCalculationRules(): GoldCalculationRulesDoc {
  return useGoldCalculationRules.getState().doc;
}

/** Lazy load firm rules from app_settings. Prefer boot via data-loader; safe to call again. */
export async function ensureGoldCalculationRulesLoaded(): Promise<void> {
  const { hydrated, hydrate } = useGoldCalculationRules.getState();
  if (!hydrated) await hydrate();
}

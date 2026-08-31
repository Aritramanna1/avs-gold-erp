/**
 * AVS ERP — Metal Conversion (V1.1 Phase 2)
 *
 * Purity conversion posts atomically via post_metal_conversion RPC:
 * gold ledger entries + per-alloy material vault deductions + optional
 * silver/copper fine ledger rows. Gold Vault remains authoritative for gold.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { computeBalances, useLedger, type Bucket } from "./ledger-store";
import { useSettings } from "./settings-store";
import { calculateLoss } from "./metal-composition-engine";
import { fetchMetalConversions } from "./custody-flow-query";
import { grossFromFineMg } from "./gold";
import { computeFineGold, isJewelleryCalcFeatureEnabled } from "./gold-calculation-rules";
import { currentGoldCalculationRules } from "./gold-calculation-rules-store";
import { dataProvider as supabase } from "./providers/data-provider";
import { assertAlloyLinesStock, type AlloyStockLine } from "./material-issue-stock";
import { assertVaultGoldIssueAvailable } from "./vault-gold-stock";
import { useMaterialVault } from "./material-vault-store";
import { issueMaterialToVaultCategory } from "./material-vault-sync";
import {
  preciousMetalNameForType,
  type ManufacturingMaterialType,
} from "./manufacturing-materials-store";

export interface AlloyConversionLine {
  materialId?: string;
  material: string;
  materialType?: ManufacturingMaterialType | string;
  weightMg: number;
  purityPermille?: number;
  categoryKey?: string;
  form?: string;
  location?: string;
}

export interface ConversionRecord {
  id: string;
  batchNo: string;
  createdAt: number;
  operator: string;
  sourceMetal?: string;
  destinationMetal?: string;
  batch?: string;
  furnace?: string;
  sourcePurity: number;
  destPurity: number;
  sourceBucket?: Extract<Bucket, "vault" | "scrap">;
  inputFineMg: number;
  sourceGrossMg?: number;
  destGrossMg?: number;
  expectedOutputFineMg: number;
  actualOutputFineMg: number;
  alloyAddedMg: number;
  alloyLines?: AlloyConversionLine[];
  conversionLossMg: number;
  recoveryMg: number;
  notes?: string;
  ledgerRefOut: string;
  ledgerRefIn: string;
}

export type ConversionSourceBucket = Extract<Bucket, "vault" | "scrap">;

interface MetalConversionState {
  records: ConversionRecord[];
  refresh: () => Promise<void>;
  convert: (input: {
    sourceMetal?: string;
    destinationMetal?: string;
    sourcePurity: number;
    ledgerLinePurity?: number;
    destPurity: number;
    sourceBucket?: ConversionSourceBucket;
    inputFineMg: number;
    sourceGrossMg?: number;
    destGrossMg?: number;
    actualOutputFineMg: number;
    alloyAddedMg: number;
    alloyLines?: AlloyConversionLine[];
    operator: string;
    notes?: string;
    batch?: string;
    furnace?: string;
    sourcePurityMode?: import("./gold-calculation-rules").SourcePurityMode;
    sourcePurityOverridden?: boolean;
    sourcePurityOverrideReason?: string;
  }) => Promise<ConversionRecord>;
}

const conversionRepository = createRepository<ConversionRecord>("metal_conversions");

function makeBatchNo(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CNV-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function availableFineAt(bucket: ConversionSourceBucket, purity: number): number {
  const balances = computeBalances(useLedger.getState().entries);
  const row = balances.bucketBreakdowns[bucket]?.purities?.[purity];
  return Math.max(0, Math.round(row?.fineMg ?? 0));
}

function buildExtraAlloyLines(lines: AlloyConversionLine[]): Record<string, unknown>[] {
  return lines
    .filter((l) => l.weightMg > 0)
    .map((l) => ({
      material: l.material,
      materialType: l.materialType ?? "other",
      weightMg: l.weightMg,
      purityPermille: l.purityPermille ?? 0,
      categoryKey: l.categoryKey ?? issueMaterialToVaultCategory(l.material),
      category: l.categoryKey ?? issueMaterialToVaultCategory(l.material),
      manufacturingMaterialId: l.materialId,
      form: l.form ?? "",
      location: l.location ?? "",
    }));
}

function alloyLinesFromScalar(
  alloyAddedMg: number,
  formulaComponents?: Array<{ metal: string; permille: number }>,
): AlloyConversionLine[] {
  if (!(alloyAddedMg > 0)) return [];
  if (!formulaComponents?.length) {
    return [{ material: "Alloy", materialType: "other", weightMg: alloyAddedMg, purityPermille: 0 }];
  }
  const totalPermille = formulaComponents.reduce((s, c) => s + c.permille, 0) || 1000;
  return formulaComponents.map((c) => ({
    material: c.metal,
    materialType: c.metal.toLowerCase().includes("silver")
      ? "silver"
      : c.metal.toLowerCase().includes("copper")
        ? "copper"
        : "other",
    weightMg: Math.round((alloyAddedMg * c.permille) / totalPermille),
    purityPermille: 0,
    categoryKey: issueMaterialToVaultCategory(c.metal),
  }));
}

export const useMetalConversion = create<MetalConversionState>()((set, get) => ({
  records: [],
  refresh: async () => {
    set({ records: await fetchMetalConversions() });
  },
  convert: async (input) => {
    const sourceBucket: ConversionSourceBucket = input.sourceBucket ?? "vault";
    const rules = currentGoldCalculationRules();
    const alloyOn = isJewelleryCalcFeatureEnabled("alloyCalculation", rules);
    const autoLossOn = isJewelleryCalcFeatureEnabled("automaticLoss", rules);

    const formula = useSettings
      .getState()
      .alloyFormulas.find(
        (f) =>
          f.active &&
          f.fromPurityPermille === input.sourcePurity &&
          f.toPurityPermille === input.destPurity,
      );
    if (alloyOn && !formula) {
      throw new Error(
        `No active conversion formula from ${input.sourcePurity} to ${input.destPurity}. Add one under Settings before converting, or disable Alloy Calculation under Customization → Calculations.`,
      );
    }

    if (!(input.inputFineMg > 0) || !(input.actualOutputFineMg > 0)) {
      throw new Error("Conversion weights must be greater than zero.");
    }

    await useLedger.getState().refresh();
    const debitPurity = input.ledgerLinePurity ?? input.sourcePurity;
    const ledgerEntries = useLedger.getState().entries;
    assertVaultGoldIssueAvailable({
      entries: ledgerEntries,
      purityPermille: debitPurity,
      fineMg: input.inputFineMg,
      grossMg:
        input.sourceGrossMg && input.sourceGrossMg > 0
          ? Math.round(input.sourceGrossMg)
          : grossFromFineMg(input.inputFineMg, input.sourcePurity as never),
      bucket: sourceBucket,
    });
    const available = availableFineAt(sourceBucket, debitPurity);
    if (input.inputFineMg > available) {
      throw new Error(
        `Insufficient ${sourceBucket} stock at ${debitPurity}‰: need ${input.inputFineMg} mg fine, available ${available} mg.`,
      );
    }

    // Alloy ON: split via formula components. Alloy OFF: user-entered lines/scalar only.
    const alloyLines =
      input.alloyLines && input.alloyLines.length > 0
        ? input.alloyLines
        : alloyLinesFromScalar(
            input.alloyAddedMg,
            alloyOn ? formula?.components : undefined,
          );

    const stockLines: AlloyStockLine[] = alloyLines.map((l) => ({
      material: l.material,
      weightMg: l.weightMg,
      purityPermille: l.purityPermille,
      categoryKey: l.categoryKey,
      metal: preciousMetalNameForType(
        (l.materialType as ManufacturingMaterialType) ?? "other",
      ),
      materialType: l.materialType,
    }));
    assertAlloyLinesStock(stockLines);

    const expectedOutputFineMg =
      autoLossOn && formula
        ? Math.round(input.inputFineMg * (1 - formula.expectedLossPct / 100))
        : Math.round(input.actualOutputFineMg);
    const { actualLossMg: conversionLossMg } = autoLossOn
      ? calculateLoss(input.inputFineMg, input.actualOutputFineMg)
      : { actualLossMg: 0 };
    const recoveryMg = autoLossOn
      ? Math.max(0, input.actualOutputFineMg - expectedOutputFineMg)
      : 0;

    const batchNo = makeBatchNo();
    const sourceGrossMg =
      input.sourceGrossMg && input.sourceGrossMg > 0
        ? Math.round(input.sourceGrossMg)
        : grossFromFineMg(input.inputFineMg, input.sourcePurity as never);
    const destGrossMg =
      input.destGrossMg && input.destGrossMg > 0
        ? Math.round(input.destGrossMg)
        : grossFromFineMg(input.actualOutputFineMg, input.destPurity as never);

    const outSnap = computeFineGold(
      {
        module: "conversion",
        grossMg: sourceGrossMg,
        purityPermille: input.sourcePurity,
      },
      rules,
    ).snapshot;
    const inSnap = computeFineGold(
      {
        module: "conversion",
        grossMg: destGrossMg,
        purityPermille: input.destPurity,
      },
      rules,
    ).snapshot;

    const payload = {
      id: batchNo,
      batchNo,
      sourceMetal: input.sourceMetal ?? "Gold",
      destinationMetal: input.destinationMetal ?? "Gold",
      sourcePurity: input.sourcePurity,
      destPurity: input.destPurity,
      sourceBucket,
      inputFineMg: input.inputFineMg,
      fineMetalRequiredMg: input.inputFineMg,
      actualOutputFineMg: input.actualOutputFineMg,
      outputFineMg: input.actualOutputFineMg,
      destGrossMg,
      netOutputWeightMg: destGrossMg,
      conversionLossMg,
      alloyAddedMg: input.alloyAddedMg,
      alloyLines,
      extraAlloyLines: buildExtraAlloyLines(alloyLines),
      operator: input.operator,
      notes: input.notes,
      batch: input.batch,
      furnace: input.furnace,
      formulaSnapshotOut: {
        ...outSnap,
        fineMg: input.inputFineMg,
        ledgerLinePurityPermille: debitPurity,
      },
      formulaSnapshotIn: {
        ...inSnap,
        fineMg: input.actualOutputFineMg,
        targetPurityPermille: input.destPurity,
      },
      sourcePurityMode: input.sourcePurityMode,
      sourcePurityOverridden: input.sourcePurityOverridden === true,
      sourcePurityOverrideReason: input.sourcePurityOverrideReason,
      createdAt: Date.now(),
    };

    const { data, error } = await supabase.rpc("post_metal_conversion", {
      p_payload: payload as never,
    });
    if (error) {
      throw new Error(error.message || "Metal conversion RPC failed.");
    }

    const rpcResult = (data ?? {}) as { id?: string; batchNo?: string; ledgerRefOut?: string; ledgerRefIn?: string };

    const record: ConversionRecord = {
      id: rpcResult.id ?? batchNo,
      batchNo: rpcResult.batchNo ?? batchNo,
      createdAt: Date.now(),
      operator: input.operator,
      sourceMetal: input.sourceMetal ?? "Gold",
      destinationMetal: input.destinationMetal ?? input.sourceMetal ?? "Gold",
      batch: input.batch,
      furnace: input.furnace,
      sourcePurity: input.sourcePurity,
      destPurity: input.destPurity,
      sourceBucket,
      inputFineMg: input.inputFineMg,
      sourceGrossMg,
      destGrossMg,
      expectedOutputFineMg,
      actualOutputFineMg: input.actualOutputFineMg,
      alloyAddedMg: input.alloyAddedMg,
      alloyLines,
      conversionLossMg,
      recoveryMg,
      notes: input.notes,
      ledgerRefOut: rpcResult.ledgerRefOut ?? batchNo,
      ledgerRefIn: rpcResult.ledgerRefIn ?? batchNo,
    };

    try {
      await conversionRepository.save(record);
    } catch (err) {
      console.error("[metal-conversion] History save failed after RPC post:", err);
    }

    await Promise.all([
      useLedger.getState().refresh(),
      useMaterialVault.getState().refresh(),
      get().refresh(),
    ]);
    return record;
  },
}));

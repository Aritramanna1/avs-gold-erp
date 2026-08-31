/**
 * MTJ ERP — Metal Conversion (V1.1 Phase 2)
 *
 * Purity conversion (e.g. 999 -> 916) with full audit fields. Gold Vault is
 * the single source of truth: this store never keeps its own balance — every
 * conversion posts two Gold Ledger entries (source purity out, destination
 * purity in) and the vault's purity-wise breakdown (ledger-store.ts's
 * computeBalances().bucketBreakdowns.vault.purities) reflects the result
 * immediately. This store only keeps the conversion HISTORY record (batch
 * number, operator, alloy added, expected vs actual output, loss/recovery) —
 * the accounting itself lives entirely in the ledger.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { useSettings } from "./settings-store";
import { calculateLoss } from "./metal-composition-engine";
import { fetchMetalConversions } from "./custody-flow-query";

export interface ConversionRecord {
  id: string;
  batchNo: string;
  createdAt: number;
  operator: string;
  sourceMetal?: string;
  destinationMetal?: string;
  batch?: string;
  furnace?: string;
  sourcePurity: number; // permille
  destPurity: number; // permille
  inputFineMg: number;
  /** Expected output fine mg per the matching AlloyFormula's expectedLossPct. */
  expectedOutputFineMg: number;
  actualOutputFineMg: number;
  alloyAddedMg: number;
  /** input - actual output, floor 0 (never negative — a gain is recovery, not negative loss). */
  conversionLossMg: number;
  /** actual output - expected output, when actual beats expectation. */
  recoveryMg: number;
  notes?: string;
  ledgerRefOut: string;
  ledgerRefIn: string;
}

interface MetalConversionState {
  records: ConversionRecord[];
  refresh: () => Promise<void>;
  convert: (input: {
    sourceMetal?: string;
    destinationMetal?: string;
    sourcePurity: number;
    destPurity: number;
    inputFineMg: number;
    actualOutputFineMg: number;
    alloyAddedMg: number;
    operator: string;
    notes?: string;
    batch?: string;
    furnace?: string;
  }) => Promise<ConversionRecord>;
}

const conversionRepository = createRepository<ConversionRecord>("metal_conversions");

function makeBatchNo(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CNV-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const useMetalConversion = create<MetalConversionState>()((set, get) => ({
  records: [],
  refresh: async () => {
    set({ records: await fetchMetalConversions() });
  },
  convert: async (input) => {
    const formula = useSettings
      .getState()
      .alloyFormulas.find(
        (f) =>
          f.active &&
          f.fromPurityPermille === input.sourcePurity &&
          f.toPurityPermille === input.destPurity,
      );
    if (!formula) {
      throw new Error(
        `No active conversion formula from ${input.sourcePurity} to ${input.destPurity}. Add one under Settings before converting.`,
      );
    }

    const expectedOutputFineMg = Math.round(
      input.inputFineMg * (1 - formula.expectedLossPct / 100),
    );
    const { actualLossMg: conversionLossMg } = calculateLoss(
      input.inputFineMg,
      input.actualOutputFineMg,
    );
    const recoveryMg = Math.max(0, input.actualOutputFineMg - expectedOutputFineMg);

    const batchNo = makeBatchNo();

    // Source purity leaves the vault at its own fine value.
    const outEntry = await useLedger.getState().append({
      type: "conversion_deducted",
      netFineMg: -input.inputFineMg,
      deltas: { vault: -input.inputFineMg },
      purity: input.sourcePurity as any,
      fineMg: input.inputFineMg,
      reference: batchNo,
      notes: `Metal conversion ${batchNo}: ${input.sourcePurity} -> ${input.destPurity} (source deducted)`,
    });

    // Destination purity enters the vault at the actual output fine value —
    // alloy added is a physical addition to gross weight, not to fine gold,
    // so it never appears as fine-mg on either ledger side.
    const inEntry = await useLedger.getState().append({
      type: "conversion_added",
      netFineMg: input.actualOutputFineMg,
      deltas: { vault: input.actualOutputFineMg },
      purity: input.destPurity as any,
      fineMg: input.actualOutputFineMg,
      reference: batchNo,
      notes: `Metal conversion ${batchNo}: ${input.sourcePurity} -> ${input.destPurity} (destination added, alloy ${input.alloyAddedMg}mg)`,
    });

    // No separate loss-entry posting: the deduct (-input) and add
    // (+actualOutput) entries above already net to exactly -conversionLossMg
    // in the vault bucket — a third entry would double-count it. Loss and
    // recovery are still fully visible: as ConversionRecord fields (below)
    // and, transaction-wide, in the two ledger entries' own audit-log rows.
    const record: ConversionRecord = {
      id: batchNo,
      batchNo,
      createdAt: Date.now(),
      operator: input.operator,
      sourceMetal: input.sourceMetal ?? "Gold",
      destinationMetal: input.destinationMetal ?? input.sourceMetal ?? "Gold",
      batch: input.batch,
      furnace: input.furnace,
      sourcePurity: input.sourcePurity,
      destPurity: input.destPurity,
      inputFineMg: input.inputFineMg,
      expectedOutputFineMg,
      actualOutputFineMg: input.actualOutputFineMg,
      alloyAddedMg: input.alloyAddedMg,
      conversionLossMg,
      recoveryMg,
      notes: input.notes,
      ledgerRefOut: outEntry.id,
      ledgerRefIn: inEntry.id,
    };
    await conversionRepository.save(record);
    await get().refresh();
    return record;
  },
}));

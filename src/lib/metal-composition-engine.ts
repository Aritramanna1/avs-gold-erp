/** Shared, integer-safe composition calculations for every precious metal. */

export interface CompositionComponent {
  metal: string;
  permille: number;
  weightMg: number;
}

export interface MetalCompositionFormula {
  id: string;
  metal: string;
  targetPurityPermille: number;
  fineMetalPermille: number;
  components: CompositionComponent[];
  effectiveFrom: string;
  version: number;
  active: boolean;
  expectedLossPct: number;
  remarks?: string;
}

export interface ConversionCalculation {
  inputWeightMg: number;
  inputFineMg: number;
  alloyTotalMg: number;
  expectedOutputMg: number;
  components: CompositionComponent[];
}

export function fineMetalMg(weightMg: number, purityPermille: number): number {
  if (!Number.isSafeInteger(weightMg) || weightMg < 0)
    throw new Error("Weight must be a non-negative integer in milligrams.");
  if (!Number.isSafeInteger(purityPermille) || purityPermille <= 0 || purityPermille > 1000)
    throw new Error("Purity must be between 1 and 1000 per-mille.");
  return Math.round((weightMg * purityPermille) / 1000);
}

export function calculateComposition(input: {
  inputWeightMg: number;
  sourcePurityPermille: number;
  formula: MetalCompositionFormula;
}): ConversionCalculation {
  const inputFineMg = fineMetalMg(input.inputWeightMg, input.sourcePurityPermille);
  const targetFineMg = Math.round((inputFineMg * 1000) / input.formula.targetPurityPermille);
  const alloyTotalMg = Math.max(0, targetFineMg - inputFineMg);
  const components = input.formula.components.map((component) => ({
    ...component,
    weightMg: Math.round((alloyTotalMg * component.permille) / 1000),
  }));
  return {
    inputWeightMg: input.inputWeightMg,
    inputFineMg,
    alloyTotalMg,
    expectedOutputMg: Math.max(
      0,
      targetFineMg - Math.round((targetFineMg * input.formula.expectedLossPct) / 100),
    ),
    components,
  };
}

export function calculateLoss(inputWeightMg: number, actualOutputMg: number, recoveryMg = 0) {
  if (inputWeightMg < 0 || actualOutputMg < 0 || recoveryMg < 0)
    throw new Error("Loss and recovery values cannot be negative.");
  const actualLossMg = Math.max(0, inputWeightMg - actualOutputMg);
  return { actualLossMg, recoveryMg, unreconciledLossMg: Math.max(0, actualLossMg - recoveryMg) };
}

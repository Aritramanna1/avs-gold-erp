/**
 * Runtime accessor for tenant declarative business rules (Supabase-backed).
 */
import { useDeclarativeRulesStore } from "@/lib/declarative-rules-store";
import type { BusinessRuleDefinition } from "@/lib/formula-engine";
import {
  applyDeclarativeBusinessRules,
  calculateKarigarWastageWithRules,
  type KarigarWastageInput,
  type KarigarWastageResult,
} from "@/lib/calculation-engine";

export function getRuntimeDeclarativeRules(): BusinessRuleDefinition[] {
  const state = useDeclarativeRulesStore.getState();
  if (!state.hydrated) {
    void state.hydrate();
  }
  return state.rules.filter((rule) => rule.isActive);
}

export function applyRuntimeDeclarativeRules(
  record: Record<string, number | string | boolean>,
): ReturnType<typeof applyDeclarativeBusinessRules> {
  return applyDeclarativeBusinessRules(record, getRuntimeDeclarativeRules());
}

export function calculateKarigarWastageWithRuntimeRules(
  input: KarigarWastageInput,
): KarigarWastageResult & { ruleMessages: string[]; requiresApproval: boolean } {
  return calculateKarigarWastageWithRules(input, getRuntimeDeclarativeRules());
}

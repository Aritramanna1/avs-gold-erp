/**
 * Declarative Business Rules Store — Supabase `declarative_business_rules` table.
 * Rules drive real calculation behaviour via formula-engine integration.
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";
import type { BusinessRuleDefinition } from "@/lib/formula-engine";

export const PRESET_DECLARATIVE_RULES: BusinessRuleDefinition[] = [
  {
    id: "rule_chain_exclusion",
    name: "Chain Weight Remuneration Exclusion",
    description:
      "When manufacturing chain items, deduct machine chain weight from worker labour calculation.",
    category: "labour",
    conditions: [{ field: "process_type", operator: "eq", value: "Chain" }],
    conditionLogic: "AND",
    action: {
      type: "apply_formula",
      targetField: "worker_eligible_weight",
      formulaExpression: "{net_weight} - {chain_weight}",
      message: "Deducted machine chain weight from worker remuneration.",
    },
    isActive: true,
  },
  {
    id: "rule_wholesale_pricing",
    name: "Wholesale Heavy Weight Rate Tier",
    description: "Wholesale orders exceeding 50g apply wholesale flat making charge rate.",
    category: "discount",
    conditions: [
      { field: "customer_type", operator: "eq", value: "Wholesale" },
      { field: "gross_weight", operator: "gt", value: 50.0 },
    ],
    conditionLogic: "AND",
    action: {
      type: "override_rate",
      targetField: "making_rate_per_gram",
      overrideValue: 350,
      message: "Applied Wholesale Volume Rate tier (₹350/g).",
    },
    isActive: true,
  },
  {
    id: "rule_excess_wastage_gate",
    name: "Karigar Excess Loss Approval Gate",
    description: "Require Workshop Owner authorization if loss exceeds 0.50% of issued weight.",
    category: "approval",
    conditions: [{ field: "loss_percentage", operator: "gt", value: 0.5 }],
    conditionLogic: "AND",
    action: {
      type: "require_approval",
      approvalRole: "owner",
      message: "Loss exceeds allowed threshold (0.50%). Owner approval required to post voucher.",
    },
    isActive: true,
  },
];

function mapRow(row: Record<string, unknown>): BusinessRuleDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category ?? "general") as BusinessRuleDefinition["category"],
    conditions: (row.conditions ?? []) as BusinessRuleDefinition["conditions"],
    conditionLogic: (row.condition_logic ?? "AND") as BusinessRuleDefinition["conditionLogic"],
    action: row.action as BusinessRuleDefinition["action"],
    isActive: Boolean(row.is_active ?? true),
  };
}

function toRow(rule: BusinessRuleDefinition) {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? null,
    category: rule.category ?? "general",
    conditions: rule.conditions ?? [],
    condition_logic: rule.conditionLogic ?? "AND",
    action: rule.action,
    is_active: rule.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
}

interface DeclarativeRulesState {
  rules: BusinessRuleDefinition[];
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setRules: (rules: BusinessRuleDefinition[]) => Promise<void>;
  upsertRule: (rule: BusinessRuleDefinition) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  getActiveRules: () => BusinessRuleDefinition[];
}

async function seedPresetsIfEmpty(): Promise<void> {
  const { count } = await supabase
    .from("declarative_business_rules" as never)
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return;
  const rows = PRESET_DECLARATIVE_RULES.map(toRow);
  await supabase.from("declarative_business_rules" as never).upsert(rows as never, {
    onConflict: "firm_id,id",
  });
}

export const useDeclarativeRulesStore = create<DeclarativeRulesState>()((set, get) => ({
  rules: PRESET_DECLARATIVE_RULES,
  loading: false,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      await seedPresetsIfEmpty();
      const { data, error } = await supabase
        .from("declarative_business_rules" as never)
        .select("*")
        .order("name");
      if (error) throw error;
      const rules =
        Array.isArray(data) && data.length > 0
          ? (data as Record<string, unknown>[]).map(mapRow)
          : PRESET_DECLARATIVE_RULES;
      set({ rules, hydrated: true, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load business rules";
      console.warn("[declarative-rules] hydrate failed:", message);
      set({ loading: false, hydrated: true });
    }
  },

  setRules: async (rules) => {
    set({ rules });
    const rows = rules.map(toRow);
    const { error } = await supabase
      .from("declarative_business_rules" as never)
      .upsert(rows as never, { onConflict: "firm_id,id" });
    if (error) throw new Error(error.message);
  },

  upsertRule: async (rule) => {
    const rules = get().rules.some((r) => r.id === rule.id)
      ? get().rules.map((r) => (r.id === rule.id ? rule : r))
      : [rule, ...get().rules];
    await get().setRules(rules);
    toast.success(`Rule "${rule.name}" saved.`);
  },

  deleteRule: async (id) => {
    const rules = get().rules.filter((r) => r.id !== id);
    await get().setRules(rules);
    const { error } = await supabase
      .from("declarative_business_rules" as never)
      .delete()
      .eq("id", id);
    if (error) console.warn("[declarative-rules] delete failed:", error.message);
    toast.success("Rule removed.");
  },

  getActiveRules: () => get().rules.filter((r) => r.isActive),
}));

let hydrateOnce: Promise<void> | null = null;

export function ensureDeclarativeRulesLoaded(): Promise<void> {
  if (!hydrateOnce) hydrateOnce = useDeclarativeRulesStore.getState().hydrate();
  return hydrateOnce;
}

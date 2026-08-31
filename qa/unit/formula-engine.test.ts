import { describe, it, expect } from "vitest";
import {
  evaluateSafeFormula,
  evaluateBusinessRules,
  type BusinessRuleDefinition,
} from "../../src/lib/formula-engine";

describe("QA-02 Formula Engine", () => {
  it.each([
    ["100 + 50", {}, 150],
    ["gross * 0.03", { gross: 10000 }, 300],
    ["max(0, issued - returned)", { issued: 5000, returned: 3000 }, 2000],
    ["round(net * purity / 999)", { net: 10000, purity: 916 }, 9169],
  ] as const)("evaluates %s", (expr, vars, expected) => {
    const r = evaluateSafeFormula(expr, vars);
    expect(r.success).toBe(true);
    expect(r.value).toBe(expected);
  });

  it("rejects unsafe expressions", () => {
    const r = evaluateSafeFormula("alert(1)", {});
    expect(r.success).toBe(false);
  });

  it("triggers approval business rule", () => {
    const rules: BusinessRuleDefinition[] = [
      {
        id: "high-value",
        name: "High value approval",
        category: "approval",
        conditions: [{ field: "amountPaise", operator: "gt", value: 100000 }],
        conditionLogic: "AND",
        action: { type: "require_approval", approvalRole: "manager", message: "Needs manager" },
        isActive: true,
      },
    ];
    const result = evaluateBusinessRules(rules, { amountPaise: 500000 });
    expect(result.requiresApproval).toBe(true);
    expect(result.messages).toContain("Needs manager");
  });
});

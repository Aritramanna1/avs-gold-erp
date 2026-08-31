import { describe, it, expect, beforeEach } from "vitest";
import { resolveInvoiceDueAt, requireVaultStockLine } from "../../src/lib/invoice-due";
import { useCustomizationHubPreferences } from "../../src/lib/customization-hub-preferences-store";
import { usePeople } from "../../src/lib/people-store";

describe("customization hub APPLY → runtime", () => {
  beforeEach(() => {
    usePeople.setState({ people: [] });
  });

  it("payment.defaultDueDays changes invoice due date calculation", () => {
    useCustomizationHubPreferences.setState({
      payment: { defaultDueDays: 7 },
      hydrated: true,
    });
    const createdAt = Date.parse("2026-01-01T12:00:00Z");
    const due = resolveInvoiceDueAt("unknown-customer", createdAt);
    expect(due).toBe(createdAt + 7 * 86_400_000);

    useCustomizationHubPreferences.setState({
      payment: { defaultDueDays: 0 },
      hydrated: true,
    });
    expect(resolveInvoiceDueAt("unknown-customer", createdAt)).toBeUndefined();
  });

  it("gold.requireVaultStockLine default is enforced (vault line required)", () => {
    useCustomizationHubPreferences.setState({
      gold: {
        physicalUtilization: true,
        allowNegativeStock: false,
        requireVaultStockLine: true,
        cashBookEnabled: true,
      },
      hydrated: true,
    });
    expect(requireVaultStockLine()).toBe(true);

    useCustomizationHubPreferences.setState({
      gold: {
        physicalUtilization: true,
        allowNegativeStock: false,
        requireVaultStockLine: false,
        cashBookEnabled: true,
      },
      hydrated: true,
    });
    expect(requireVaultStockLine()).toBe(false);
  });
});

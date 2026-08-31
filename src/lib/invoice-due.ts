import { usePeople } from "@/lib/people-store";
import { useCustomizationHubPreferences } from "@/lib/customization-hub-preferences-store";

/** Due date from party dueDays, else Customization default. Never a hard-coded 3. */
export function resolveInvoiceDueAt(customerId: string, createdAt = Date.now()): number | undefined {
  const person = usePeople.getState().people.find((p) => p.id === customerId);
  const defaultDays = useCustomizationHubPreferences.getState().payment.defaultDueDays;
  const days = person?.dueDays && person.dueDays > 0 ? person.dueDays : defaultDays;
  if (!days || days <= 0) return undefined;
  return createdAt + days * 86_400_000;
}

export function allowNegativeStock(): boolean {
  return useCustomizationHubPreferences.getState().gold.allowNegativeStock === true;
}

/** When true, gold issue forms require selecting a vault purity line with live stock. */
export function requireVaultStockLine(): boolean {
  return useCustomizationHubPreferences.getState().gold.requireVaultStockLine !== false;
}

/** When true, cash receipts/payments post to the company cash book (universal ledger). */
export function cashBookEnabled(): boolean {
  return useCustomizationHubPreferences.getState().gold.cashBookEnabled !== false;
}

/**
 * When true, customer-owned physical metal may be pooled/melted into production
 * while the liability row stays active until allocation or settlement.
 */
export function physicalUtilizationEnabled(): boolean {
  return useCustomizationHubPreferences.getState().gold.physicalUtilization !== false;
}

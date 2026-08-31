/**
 * MTJ ERP — Bullion rate provider registry
 *
 * The single place a new vendor gets wired in. To add a vendor-specific
 * provider later (e.g. one that needs SDK calls the generic HTTP provider
 * can't express), implement BullionRateProvider in a new file next to
 * configured-http-provider.ts and add one line here — nothing in
 * bullion-rate-service.ts or any consumer needs to change.
 */
import type { BullionRateProvider } from "../types";
import { configuredHttpProvider } from "./configured-http-provider";

export const BULLION_RATE_PROVIDERS: Record<string, BullionRateProvider> = {
  [configuredHttpProvider.id]: configuredHttpProvider,
};

export function getBullionRateProvider(id: string): BullionRateProvider | undefined {
  return BULLION_RATE_PROVIDERS[id];
}

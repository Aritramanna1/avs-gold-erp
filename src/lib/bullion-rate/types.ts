/**
 * MTJ ERP — Bullion Rate Provider contracts
 *
 * A live-rate vendor plugs in by implementing BullionRateProvider and
 * registering it in providers/registry.ts. Nothing outside this folder may
 * import a vendor SDK or hardcode a vendor's response shape — swapping or
 * adding a provider is a configuration change (ConfiguredHttpProviderSettings,
 * edited from Settings → Rates), never a code change.
 *
 * Mode ("manual" vs "api") is NOT part of this config — it already exists
 * per-branch as BranchSettings.goldRateSource (settings-store.ts), which
 * predates this file. Reuse that field rather than adding a second,
 * competing mode switch.
 */

export interface BullionRateSnapshot {
  gold24KPerGramPaise: number;
  gold22KPerGramPaise: number;
  gold18KPerGramPaise: number;
  silverPerGramPaise: number;
  /** Epoch ms this snapshot was fetched. */
  fetchedAt: number;
  /** Provider id that produced this snapshot (see registry.ts). */
  source: string;
}

/** Vendor-agnostic config for the "configured-http" provider — any REST API
 *  that returns JSON can be plugged in by pointing these fields at it, with
 *  no provider code written. This is the "pluggable via configuration" path;
 *  a future SDK-based vendor would instead register a new BullionRateProvider
 *  in registry.ts and keep this shape for the common case. */
export interface ConfiguredHttpProviderSettings {
  apiUrl: string;
  apiKey?: string;
  /** How the API key is attached to the request. Defaults to a Bearer Authorization header. */
  apiKeyPlacement: "header" | "query";
  /** Header name (e.g. "x-api-key") or query param name (e.g. "apikey") — ignored for the Bearer default. */
  apiKeyParamName?: string;
  /** Dot-paths into the JSON response, e.g. "data.gold.xau24kInrPerGram". 22K/18K are
   *  derived as 91.6%/75% of 24K when left blank — most feeds only quote 24K/fine gold. */
  responsePaths: {
    gold24K: string;
    gold22K?: string;
    gold18K?: string;
    silver?: string;
  };
  /** Multiply the raw response numbers by this to get RUPEES (not paise) per gram. Default 1. */
  unitMultiplier: number;
}

export interface BullionRateProviderConfig {
  providerId: string;
  refreshIntervalMinutes: number;
  httpProvider: ConfiguredHttpProviderSettings;
}

export interface BullionRateProvider {
  id: string;
  label: string;
  fetchRates(config: BullionRateProviderConfig): Promise<BullionRateSnapshot>;
}

export const DEFAULT_BULLION_RATE_PROVIDER_CONFIG: BullionRateProviderConfig = {
  providerId: "configured-http",
  refreshIntervalMinutes: 60,
  httpProvider: {
    apiUrl: "",
    apiKey: "",
    apiKeyPlacement: "header",
    apiKeyParamName: "Authorization",
    responsePaths: { gold24K: "" },
    unitMultiplier: 1,
  },
};

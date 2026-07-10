/**
 * MTJ ERP — Generic configured-HTTP bullion rate provider
 *
 * Fetches a JSON response from an arbitrary REST endpoint and extracts rates
 * via dot-path field mapping (ConfiguredHttpProviderSettings.responsePaths),
 * so any vendor's shop can be wired up from Settings → Rates without a code
 * change. This is deliberately the ONLY provider implementation shipped —
 * see registry.ts for how a future SDK-based vendor would be added instead.
 */
import type { BullionRateProvider, BullionRateProviderConfig, BullionRateSnapshot } from "../types";

/** Resolves "a.b.c" against a parsed JSON object. Returns undefined on any miss. */
function resolvePath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as any)[key] : undefined),
      obj,
    );
}

function toPaise(rupeesPerGram: number, unitMultiplier: number): number {
  return Math.round(rupeesPerGram * unitMultiplier * 100);
}

export const configuredHttpProvider: BullionRateProvider = {
  id: "configured-http",
  label: "Configured HTTP API",

  async fetchRates(config: BullionRateProviderConfig): Promise<BullionRateSnapshot> {
    const { httpProvider } = config;
    if (!httpProvider.apiUrl.trim()) {
      throw new Error(
        "No bullion rate API URL configured — set one in Settings → Rates before switching to Live API.",
      );
    }

    const url = new URL(httpProvider.apiUrl);
    const headers: Record<string, string> = {};
    if (httpProvider.apiKey) {
      if (httpProvider.apiKeyPlacement === "query") {
        url.searchParams.set(httpProvider.apiKeyParamName || "apikey", httpProvider.apiKey);
      } else {
        headers[httpProvider.apiKeyParamName || "Authorization"] = httpProvider.apiKey.startsWith(
          "Bearer ",
        )
          ? httpProvider.apiKey
          : `Bearer ${httpProvider.apiKey}`;
      }
    }

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`Bullion rate API returned ${res.status} ${res.statusText}`);
    }
    const body = await res.json();

    const gold24KRaw = resolvePath(body, httpProvider.responsePaths.gold24K);
    if (typeof gold24KRaw !== "number") {
      throw new Error(
        `Bullion rate API response didn't contain a number at "${httpProvider.responsePaths.gold24K}" — check the response path mapping in Settings → Rates.`,
      );
    }

    const unitMultiplier = httpProvider.unitMultiplier || 1;
    const gold24KPerGramPaise = toPaise(gold24KRaw, unitMultiplier);

    const gold22KRaw = resolvePath(body, httpProvider.responsePaths.gold22K ?? "");
    const gold18KRaw = resolvePath(body, httpProvider.responsePaths.gold18K ?? "");
    const silverRaw = resolvePath(body, httpProvider.responsePaths.silver ?? "");

    return {
      gold24KPerGramPaise,
      gold22KPerGramPaise:
        typeof gold22KRaw === "number"
          ? toPaise(gold22KRaw, unitMultiplier)
          : Math.round(gold24KPerGramPaise * 0.916),
      gold18KPerGramPaise:
        typeof gold18KRaw === "number"
          ? toPaise(gold18KRaw, unitMultiplier)
          : Math.round(gold24KPerGramPaise * 0.75),
      silverPerGramPaise: typeof silverRaw === "number" ? toPaise(silverRaw, unitMultiplier) : 0,
      fetchedAt: Date.now(),
      source: "configured-http",
    };
  },
};

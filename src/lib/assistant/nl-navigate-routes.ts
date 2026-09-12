/**
 * AVS-67 — NL navigate / openRoute targets aligned to locked AVS-4 nav.
 *
 * Maps natural-language intents and route keys to EXISTING app routes only.
 * Sources: src/lib/navigation-groups.ts (retail → /billing, stock → /stock,
 * manufacturing → /workshop, accounts → /control/accounts).
 * No invented URLs. Miss clearly when a phrase does not map.
 */

export type Avs4NavKey = "sell" | "stock" | "make" | "money";

export type NavigateTarget = {
  key: Avs4NavKey;
  /** In-app path only (no absolute URL). */
  href: string;
  /** Plain operator title (AVS-4 verb). */
  title: string;
};

/** Canonical AVS-4 hubs → real tip paths (do not invent). */
export const AVS4_NAV_TARGETS: Readonly<Record<Avs4NavKey, NavigateTarget>> = {
  sell: { key: "sell", href: "/billing", title: "Sell" },
  stock: { key: "stock", href: "/stock", title: "Stock" },
  make: { key: "make", href: "/workshop", title: "Make" },
  money: { key: "money", href: "/control/accounts", title: "Money" },
} as const;

/** Allowed alias tokens → canonical key (still the same four hrefs). */
const ALIAS_TO_KEY: Readonly<Record<string, Avs4NavKey>> = {
  sell: "sell",
  sale: "sell",
  sales: "sell",
  billing: "sell",
  bill: "sell",
  invoice: "sell",
  "sales billing": "sell",
  "new sale": "sell",
  stock: "stock",
  inventory: "stock",
  "ready stock": "stock",
  "gold stock": "stock",
  make: "make",
  workshop: "make",
  manufacturing: "make",
  jobs: "make",
  job: "make",
  money: "money",
  treasury: "money",
  accounts: "money",
  account: "money",
  cash: "money",
  "cash book": "money",
  "accounts overview": "money",
};

export type OpenRouteHit = {
  ok: true;
  action: "openRoute";
  href: string;
  title: string;
  key: Avs4NavKey;
};

export type OpenRouteMiss = {
  ok: false;
  action: "openRoute";
  miss: true;
  message: string;
  query: string;
  allowedKeys: Avs4NavKey[];
};

export type OpenRouteResult = OpenRouteHit | OpenRouteMiss;

function normalizePhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNavigateVerbs(phrase: string): string {
  return phrase
    .replace(
      /^(please\s+)?(open|go to|goto|navigate to|take me to|show me|show|bring me to|switch to|jump to)\s+/i,
      "",
    )
    .replace(/^(the\s+)?(screen|page|module|hub|section)\s+/i, "")
    .replace(/\s+(screen|page|module|hub|section)$/i, "")
    .trim();
}

/**
 * Resolve a route key or NL phrase to an existing AVS-4 hub.
 * Never invents hrefs outside AVS4_NAV_TARGETS.
 */
export function resolveOpenRoute(input: {
  routeKey?: string | null;
  phrase?: string | null;
}): OpenRouteResult {
  const rawQuery = String(input.routeKey ?? input.phrase ?? "").trim();
  if (!rawQuery) {
    return {
      ok: false,
      action: "openRoute",
      miss: true,
      message:
        "No screen matched. Say Sell, Stock, Make, or Money (or open / go to those names).",
      query: rawQuery,
      allowedKeys: ["sell", "stock", "make", "money"],
    };
  }

  const keyCandidate = normalizePhrase(String(input.routeKey ?? ""));
  if (keyCandidate && (AVS4_NAV_TARGETS as Record<string, NavigateTarget>)[keyCandidate]) {
    const target = AVS4_NAV_TARGETS[keyCandidate as Avs4NavKey];
    return {
      ok: true,
      action: "openRoute",
      href: target.href,
      title: target.title,
      key: target.key,
    };
  }
  if (keyCandidate && ALIAS_TO_KEY[keyCandidate]) {
    const target = AVS4_NAV_TARGETS[ALIAS_TO_KEY[keyCandidate]];
    return {
      ok: true,
      action: "openRoute",
      href: target.href,
      title: target.title,
      key: target.key,
    };
  }

  const phrase = normalizePhrase(String(input.phrase ?? input.routeKey ?? ""));
  const stripped = stripNavigateVerbs(phrase);

  for (const candidate of [stripped, phrase]) {
    if ((AVS4_NAV_TARGETS as Record<string, NavigateTarget>)[candidate]) {
      const target = AVS4_NAV_TARGETS[candidate as Avs4NavKey];
      return {
        ok: true,
        action: "openRoute",
        href: target.href,
        title: target.title,
        key: target.key,
      };
    }
    if (ALIAS_TO_KEY[candidate]) {
      const target = AVS4_NAV_TARGETS[ALIAS_TO_KEY[candidate]];
      return {
        ok: true,
        action: "openRoute",
        href: target.href,
        title: target.title,
        key: target.key,
      };
    }
  }

  // Loose contains match only against known aliases (still no invented URLs).
  const aliasEntries = Object.entries(ALIAS_TO_KEY).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, key] of aliasEntries) {
    if (stripped === alias || phrase === alias) {
      const target = AVS4_NAV_TARGETS[key];
      return {
        ok: true,
        action: "openRoute",
        href: target.href,
        title: target.title,
        key: target.key,
      };
    }
  }
  for (const [alias, key] of aliasEntries) {
    const re = new RegExp(`(?:^|\\s)${alias.replace(/\s+/g, "\\s+")}(?:\\s|$)`);
    if (re.test(stripped) || re.test(phrase)) {
      const target = AVS4_NAV_TARGETS[key];
      return {
        ok: true,
        action: "openRoute",
        href: target.href,
        title: target.title,
        key: target.key,
      };
    }
  }

  return {
    ok: false,
    action: "openRoute",
    miss: true,
    message: `No matching screen for “${rawQuery}”. Allowed hubs: Sell (/billing), Stock (/stock), Make (/workshop), Money (/control/accounts).`,
    query: rawQuery,
    allowedKeys: ["sell", "stock", "make", "money"],
  };
}

/** True when the utterance looks like a navigate / open-screen intent. */
export function looksLikeNavigateIntent(userQuery: string): boolean {
  const q = normalizePhrase(userQuery);
  if (!q) return false;
  if (/^(open|go to|goto|navigate to|take me to|switch to|jump to)\b/.test(q)) return true;
  if (/^(sell|stock|make|money|billing|workshop|treasury|accounts)$/.test(q)) return true;
  if (/^(open|go to|show)\s+(sell|stock|make|money|billing|workshop|treasury|accounts)\b/.test(q)) {
    return true;
  }
  return false;
}

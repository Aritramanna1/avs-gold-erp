/**
 * AVS-67 — Assistant openRoute / NL navigate tool (READ / PREPARE scope).
 * Returns a navigate action the UI can consume (href + plain title).
 * No writes, no payments, no secrets.
 */

import type { ERPActionCard } from "./assistant-types";
import {
  looksLikeNavigateIntent,
  resolveOpenRoute,
  type OpenRouteResult,
} from "./nl-navigate-routes";
import { auditAssistantAction } from "./assistant-tool-registry";

export { looksLikeNavigateIntent, resolveOpenRoute };
export type { OpenRouteResult };

export function toolOpenRouteFromInput(input: {
  routeKey?: string | null;
  phrase?: string | null;
}): OpenRouteResult {
  return resolveOpenRoute(input);
}

/**
 * Resolve NL / route key into an ERPActionCard with actionRoute for the UI Link.
 */
export async function toolOpenRoute(userMessage: string): Promise<ERPActionCard> {
  const result = resolveOpenRoute({ phrase: userMessage });

  await auditAssistantAction({
    actionKey: "openRoute",
    actionType: "read",
    status: result.ok ? "executed" : "rejected",
    requiresConfirmation: false,
    requestPayload: { phrase: userMessage },
    resultPayload: result,
    errorMessage: result.ok ? undefined : result.message,
  });

  if (result.ok) {
    return {
      type: "search_results",
      title: `Open ${result.title}`,
      summary: `Navigate to ${result.title}.`,
      actionRoute: result.href,
      data: {
        action: "openRoute",
        ok: true,
        href: result.href,
        title: result.title,
        key: result.key,
      },
    };
  }

  return {
    type: "search_results",
    title: "No matching screen",
    summary: result.message,
    data: {
      action: "openRoute",
      ok: false,
      miss: true,
      message: result.message,
      query: result.query,
      allowedKeys: result.allowedKeys,
    },
  };
}

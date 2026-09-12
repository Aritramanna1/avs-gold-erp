/**
 * list_attention_items — VIEW-only read model (AVS-54 / AVS-37).
 * SELECT-equivalent. No ledger/stock/tax writes. No ack/snooze/post.
 * KARIGAR overdue threshold N is TBD — do not invent (no silent 30).
 * Home MVP teaser (AVS-32) consumes the same list via fixLabel CTAs.
 */
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { useSettings } from "@/lib/settings-store";

export type AttentionKind = "RATE" | "IRN" | "KARIGAR" | "EXCEPTION";
export type AttentionSeverity = "P0" | "P1" | "P2";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  href: string;
  severity: AttentionSeverity;
  /** Plain one-line fix verb for Home CTA (optional for non-Home consumers). */
  fixLabel?: string;
};

export type ListAttentionItemsResult = { items: AttentionItem[] };

/** VIEW-only. Empty list is valid. Never mutates. */
export function listAttentionItems(): ListAttentionItemsResult {
  const items: AttentionItem[] = [];
  const settings = useSettings.getState();

  // RATE — missing today's bhav (never invent a rate)
  const ratePaise = getCurrentGoldRatePaise();
  if (!(ratePaise > 0)) {
    items.push({
      id: "attn-rate-missing",
      kind: "RATE",
      title: "Today's gold rate is not set",
      href: "/control/rates",
      severity: "P0",
      fixLabel: "Set today's gold rate",
    });
  }

  // EXCEPTION — blank business name (AVS-4 Home class)
  const shop = String(settings.firm?.shopName ?? "").trim();
  if (!shop) {
    items.push({
      id: "attn-exception-blank-business",
      kind: "EXCEPTION",
      title: "Business name is blank — fill firm settings",
      href: "/settings",
      severity: "P0",
      fixLabel: "Open settings",
    });
  }

  // IRN — observe only when e-invoice required; skip if profile flag absent
  const eInvoiceRequired = Boolean((settings.firm as any)?.eInvoiceRequired);
  if (eInvoiceRequired) {
    // Tip has no settled IRN invoice enumerator in this pass — leave empty rather than invent.
  }

  // KARIGAR — threshold N TBD (AVS-38). Do not emit overdue items until product sets N.
  // Open custody listing without overdue filter can land in a follow-up PR.

  return { items };
}

/** MCP/tool alias — same VIEW contract. */
export function list_attention_items(): ListAttentionItemsResult {
  return listAttentionItems();
}

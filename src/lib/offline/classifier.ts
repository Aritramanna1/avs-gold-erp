/**
 * Classify mobile actions for the offline queue.
 * Gold / accounting / posting → CAPTURE_THEN_VALIDATE or ONLINE_REQUIRED.
 */
import type { OfflineCapability, OfflineDomain } from "./types";

export type ClassifiedAction = {
  capability: OfflineCapability;
  domain: OfflineDomain;
  /** Shown when ONLINE_REQUIRED and device is offline */
  onlineMessage?: string;
};

const ONLINE: ClassifiedAction = {
  capability: "ONLINE_REQUIRED",
  domain: "other",
  onlineMessage: "Internet connection required for this action.",
};

const RULES: Array<{ match: RegExp; result: ClassifiedAction }> = [
  {
    match: /oauth|password|reset|login|invite|razorpay|checkout|subscription|amc|credit.?pack/i,
    result: {
      ...ONLINE,
      onlineMessage: "Internet connection required for sign-in and payments.",
    },
  },
  {
    match: /whatsapp|send.?message|campaign|provider/i,
    result: {
      capability: "ONLINE_REQUIRED",
      domain: "other",
      onlineMessage: "Internet connection required to send live messages.",
    },
  },
  {
    match: /photo|camera|gallery|attachment|upload.?image/i,
    result: { capability: "OFFLINE_SAFE", domain: "photo" },
  },
  {
    match: /party|customer|supplier|karigar|employee|people\.create|people\.draft/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "party" },
  },
  {
    match: /order\.draft|order\.create|orders\.new/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "order" },
  },
  {
    match: /expense\.create|expenses?\.add/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "treasury" },
  },
  {
    match: /invoice\.create|invoice\.payment|billing\.save/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "billing" },
  },
  {
    match: /repair\.create|repair\.payment|polishing\.create/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "other" },
  },
  {
    match: /purchase\.create|voucher\.post/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "treasury" },
  },
  {
    match: /catalog\.create|jobcard\.create|attendance\.upsert|melt\.create|attendance\.loan/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "other" },
  },
  {
    match: /conversion\.execute|workshop\.process\.(issue|complete)/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "gold" },
  },
  {
    match: /manufacturing\.bill\.finalise/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "gold" },
  },
  {
    match: /manufacturing\.bill\.save|hallmark\.close|outside.?work\.approve|settings\.gold.?rate/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "other" },
  },
  {
    match: /billing\.(estimate|credit_note|debit_note|challan)/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "billing" },
  },
  {
    match: /stock\.transfer/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "inventory_mutation" },
  },
  {
    match: /party\.update|people\.update/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "party" },
  },
  {
    match: /stock\.create|ready.?stock/i,
    result: { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "inventory_mutation" },
  },
  {
    match: /issue.?gold|receive.?gold|metal.?conversion|melt|settlement|invoice.?post|purchase.?post|payment|receipt|journal|salary|stock.?transfer|stock.?consume/i,
    result: {
      capability: "OFFLINE_CAPTURE_THEN_VALIDATE",
      domain: "gold",
      onlineMessage: undefined,
    },
  },
  {
    match: /note|memo|draft.?comment/i,
    result: { capability: "OFFLINE_SAFE", domain: "note" },
  },
];

/** Override domain for known gold-family actions that matched the gold regex. */
function refineDomain(action: string, base: ClassifiedAction): ClassifiedAction {
  const a = action.toLowerCase();
  if (/settlement/.test(a)) return { ...base, domain: "settlement" };
  if (/invoice|purchase|billing/.test(a)) return { ...base, domain: "billing" };
  if (/payment|receipt|voucher|journal|salary/.test(a)) return { ...base, domain: "treasury" };
  if (/stock.?transfer|stock.?consume|inventory/.test(a))
    return { ...base, domain: "inventory_mutation" };
  if (/conversion|melt|issue|receive/.test(a) && base.domain === "gold") return base;
  return base;
}

export function classifyOfflineAction(action: string): ClassifiedAction {
  for (const rule of RULES) {
    if (rule.match.test(action)) {
      return refineDomain(action, rule.result);
    }
  }
  // Unknown mutations default to capture-then-validate (never fake success).
  return { capability: "OFFLINE_CAPTURE_THEN_VALIDATE", domain: "other" };
}

export function isOnlineRequired(action: string): boolean {
  return classifyOfflineAction(action).capability === "ONLINE_REQUIRED";
}

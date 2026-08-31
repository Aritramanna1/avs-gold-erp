/**
 * Professional document numbering — atomic, concurrency-safe sequence
 * generation backed by the `document_sequences` table's unique
 * `(firm_id, doc_type)` constraint and the `next_document_number()` Postgres
 * RPC (a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, safe under
 * concurrent transactions via Postgres row locking).
 *
 * Replaces the previous `existing.filter(...).length + 1` pattern used
 * across orders/job-cards/invoices/settlements — that scheme could hand out
 * a duplicate number whenever two operators (or two branches) created a
 * document in the same instant, since it counted already-loaded client-side
 * state rather than reserving a number atomically at the database.
 *
 * `key` scopes the counter — include the date (for daily-reset numbering
 * like "JC-20260703-001") or a financial-year token (for FY-reset numbering
 * like "INV-FY2025-26-") directly in the key, since each distinct key gets
 * its own independent counter starting at 1.
 *
 * There is deliberately no browser-local fallback. Legal/business document
 * numbers must be reserved in Supabase so every branch and device sees the
 * same sequence.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export const DOCUMENT_NUMBER_ONLINE_MESSAGE = "Internet required to create document number";

export class DocumentNumberOnlineRequiredError extends Error {
  constructor(detail?: string) {
    super(detail ? `${DOCUMENT_NUMBER_ONLINE_MESSAGE}. ${detail}` : DOCUMENT_NUMBER_ONLINE_MESSAGE);
    this.name = "DocumentNumberOnlineRequiredError";
  }
}

function looksLikeNetworkFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("offline") ||
    m.includes("timeout") ||
    m.includes("abort") ||
    m.includes("err_internet") ||
    m.includes("unavailable")
  );
}

export async function nextDocumentNumber(
  key: string,
  prefix: string,
  padLength = 3,
): Promise<string> {
  const { isOnline } = await import("@/lib/native/network");
  if (!isOnline()) {
    throw new DocumentNumberOnlineRequiredError();
  }

  const { data, error } = await supabase.rpc("next_document_number", {
    p_key: key,
    p_prefix: prefix,
    p_pad_length: padLength,
  });
  if (error || typeof data !== "string") {
    const detail = error?.message ?? "No sequence returned";
    if (looksLikeNetworkFailure(detail)) {
      throw new DocumentNumberOnlineRequiredError(detail);
    }
    throw new Error(
      `Could not reserve document number for "${key}". Supabase sequence RPC failed: ${detail}`,
    );
  }
  return data;
}

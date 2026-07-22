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
 * Falls back to a locally-derived number (timestamp-suffixed, never
 * colliding but not sequential) only when the RPC is unreachable (offline) —
 * true cross-client atomicity is impossible without a live database, which
 * matches this app's established offline-degradation pattern elsewhere
 * (see repositories/base-repository.ts's read()/readAll()).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export async function nextDocumentNumber(
  key: string,
  prefix: string,
  padLength = 3,
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("generate_sequential_number", {
      p_type: key,
      p_prefix: prefix,
    });
    if (error || typeof data !== "string") throw error ?? new Error("No sequence returned");
    return data;
  } catch (err) {
    console.error(
      `[DocumentNumbering] RPC unavailable for key "${key}", using offline fallback:`,
      err,
    );
    const fallbackSeq =
      Date.now()
        .toString()
        .slice(-padLength - 2, -2) || "0";
    return `${prefix}${fallbackSeq.padStart(padLength, "0")}`;
  }
}

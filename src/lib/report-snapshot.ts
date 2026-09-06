import { getCloudDataClient } from "@/lib/providers/data-provider";

/**
 * Saves an immutable, hashed snapshot of a report's computed output so its
 * figures survive later ledger edits (REPORTING_ENGINE_MASTER.md section 4).
 */
export async function saveReportSnapshot(opts: {
  reportType: string;
  branchId: string | null;
  params: unknown;
  computedRows: unknown;
  totals: unknown;
}): Promise<{ id: string; rowHash: string }> {
  const supabase = getCloudDataClient();

  const { data: sessionResult } = await supabase.auth.getSession();
  const userId = sessionResult.session?.user?.id ?? null;

  const { data: profile } = userId
    ? await supabase.from("user_profiles").select("firm_id").eq("auth_id", userId).maybeSingle()
    : { data: null };

  if (!profile?.firm_id) {
    throw new Error("Could not resolve firm for report snapshot.");
  }

  const payload = {
    report_type: opts.reportType,
    params: opts.params ?? {},
    computed_rows: opts.computedRows ?? [],
    totals: opts.totals ?? {},
  };
  const rowHash = await hashSnapshot(payload);

  const { data, error } = await supabase
    .from("report_snapshots" as any)
    .insert({
      firm_id: profile.firm_id,
      branch_id: opts.branchId,
      report_type: opts.reportType,
      params: payload.params,
      computed_rows: payload.computed_rows,
      totals: payload.totals,
      row_hash: rowHash,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as unknown as { id: string }).id, rowHash };
}

// ponytail: SHA-256 via Web Crypto (native, no dep) rather than a hashing library.
async function hashSnapshot(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

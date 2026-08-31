/**
 * Gold loss report — aggregates existing loss signals only (no parallel ledger).
 * Sources: manufacturing wastage, gold_ledger loss types, metal conversion records,
 * inventory conversion lineage (expected loss), workshop/melt/overloss ledger rows.
 */
import { fetchGoldLedgerInRange } from "@/lib/ledger-pagination";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { LedgerEntry, MovementType } from "@/lib/ledger-store";
import { MOVEMENT_LABELS } from "@/lib/ledger-store";
import { fetchMetalConversions } from "@/lib/custody-flow-query";
import { resolveFirmIdForQuery } from "@/lib/firm-scoped-query";

const REPORT_ROW_LIMIT = 500;

const LEDGER_LOSS_TYPES = new Set<MovementType>([
  "wastage",
  "overloss",
  "melt_loss",
  "workshop_process_loss",
]);

export type GoldLossProcess =
  | "Manufacturing"
  | "Overloss"
  | "Melt"
  | "Workshop"
  | "Conversion"
  | "Ledger";

export interface GoldLossRow {
  id: string;
  dateIso: string;
  process: GoldLossProcess;
  person: string;
  lossMg: number;
  reference: string;
  notes: string;
  source: "manufacturing_bill" | "gold_ledger" | "metal_conversion" | "inventory_lineage";
}

export interface GoldLossReportResult {
  rows: GoldLossRow[];
  totalLossMg: number;
  byProcess: Record<GoldLossProcess, number>;
  capped: boolean;
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function personFromNotes(notes?: string): string {
  if (!notes) return "—";
  const byMatch = notes.match(/by\s+([^—\-·(]+)/i);
  if (byMatch?.[1]) return byMatch[1].trim();
  const dotMatch = notes.match(/·\s*([^·]+)$/);
  if (dotMatch?.[1]) return dotMatch[1].trim();
  return "—";
}

function processForLedgerType(type: MovementType): GoldLossProcess {
  if (type === "wastage") return "Manufacturing";
  if (type === "overloss") return "Overloss";
  if (type === "melt_loss") return "Melt";
  if (type === "workshop_process_loss") return "Workshop";
  return "Ledger";
}

function lossMgFromLedger(entry: LedgerEntry): number {
  if (entry.type === "workshop_process_loss") {
    return Math.max(0, asNumber(entry.fineMg));
  }
  if (entry.netFineMg < 0) return Math.abs(entry.netFineMg);
  return Math.max(0, asNumber(entry.fineMg));
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function fetchLedgerLossRows(
  from: string,
  to: string,
  branchId?: string | null,
): Promise<{ rows: GoldLossRow[]; capped: boolean }> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) return { rows: [], capped: false };

  const { rows: rawEntries, capped } = await fetchGoldLedgerInRange({
    from,
    to,
    maxRows: REPORT_ROW_LIMIT,
  });

  let entries = rawEntries;
  if (branchId && branchId !== "all") {
    entries = entries.filter((e) => (e as { branchId?: string }).branchId === branchId);
  }

  const nameById = new Map<string, string>();
  const karigarIds = [
    ...new Set(entries.map((e) => e.karigarId).filter((id): id is string => Boolean(id))),
  ];
  if (karigarIds.length) {
    const { data: people } = await supabase
      .from("people")
      .select("id,data")
      .in("id", karigarIds.slice(0, 200));
    for (const p of people ?? []) {
      const payload = (p as { data?: { fullName?: string; name?: string } }).data;
      const label = payload?.fullName ?? payload?.name;
      if (label) nameById.set((p as { id: string }).id, label);
    }
  }

  const rows: GoldLossRow[] = [];

  for (const entry of entries) {
    if (LEDGER_LOSS_TYPES.has(entry.type)) {
      const lossMg = lossMgFromLedger(entry);
      if (lossMg <= 0) continue;
      rows.push({
        id: `ledger:${entry.id}`,
        dateIso: new Date(entry.createdAt).toISOString(),
        process: processForLedgerType(entry.type),
        person:
          (entry.karigarId && nameById.get(entry.karigarId)) || personFromNotes(entry.notes),
        lossMg,
        reference: entry.reference ?? entry.id,
        notes: entry.notes ?? MOVEMENT_LABELS[entry.type] ?? entry.type,
        source: "gold_ledger",
      });
    }
  }

  // Conversion pair net: deduct + add by shared reference → loss without a separate loss type.
  const byRef = new Map<string, { deduct: number; add: number; ts: number; notes?: string }>();
  for (const entry of entries) {
    if (entry.type !== "conversion_deducted" && entry.type !== "conversion_added") continue;
    const ref = entry.reference ?? entry.id;
    const bucket = byRef.get(ref) ?? { deduct: 0, add: 0, ts: entry.createdAt, notes: entry.notes };
    if (entry.type === "conversion_deducted") bucket.deduct += Math.abs(entry.netFineMg);
    else bucket.add += Math.max(0, entry.netFineMg);
    bucket.ts = Math.min(bucket.ts, entry.createdAt);
    byRef.set(ref, bucket);
  }
  for (const [ref, pair] of byRef) {
    const lossMg = Math.max(0, pair.deduct - pair.add);
    if (lossMg <= 0) continue;
    rows.push({
      id: `ledger-cnv:${ref}`,
      dateIso: new Date(pair.ts).toISOString(),
      process: "Conversion",
      person: personFromNotes(pair.notes),
      lossMg,
      reference: ref,
      notes: pair.notes ?? `Conversion pair net loss for ${ref}`,
      source: "gold_ledger",
    });
  }

  return { rows, capped };
}

async function fetchManufacturingLossRows(
  from: string,
  to: string,
  branchId?: string | null,
  skipRefs?: Set<string>,
): Promise<{ rows: GoldLossRow[]; capped: boolean }> {
  let query = supabase
    .from("manufacturing_bills")
    .select(
      "id,bill_no,created_at,karigar_name,actual_wastage_fine_mg,status",
      { count: "exact" },
    )
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`)
    .gt("actual_wastage_fine_mg", 0)
    .order("created_at", { ascending: false })
    .range(0, REPORT_ROW_LIMIT - 1);

  if (branchId && branchId !== "all") {
    query = query.eq("branch_id", branchId);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: GoldLossRow[] = [];
  for (const row of data ?? []) {
    const billNo = String((row as { bill_no?: string }).bill_no ?? (row as { id: string }).id);
    if (skipRefs?.has(billNo)) continue;
    const lossMg = asNumber((row as { actual_wastage_fine_mg?: number }).actual_wastage_fine_mg);
    if (lossMg <= 0) continue;
    rows.push({
      id: `mfg:${(row as { id: string }).id}`,
      dateIso: String((row as { created_at?: string }).created_at ?? new Date(0).toISOString()),
      process: "Manufacturing",
      person: String((row as { karigar_name?: string | null }).karigar_name ?? "—"),
      lossMg,
      reference: billNo,
      notes: `Manufacturing wastage · ${billNo}`,
      source: "manufacturing_bill",
    });
  }

  return { rows, capped: (count ?? 0) > REPORT_ROW_LIMIT };
}

async function fetchConversionRecordRows(
  fromMs: number,
  toMs: number,
  skipRefs?: Set<string>,
): Promise<GoldLossRow[]> {
  const records = await fetchMetalConversions({ limit: REPORT_ROW_LIMIT });
  return records
    .filter((r) => r.createdAt >= fromMs && r.createdAt <= toMs)
    .filter((r) => r.conversionLossMg > 0)
    .filter((r) => !skipRefs?.has(r.batchNo))
    .map((r) => ({
      id: `cnv:${r.id}`,
      dateIso: new Date(r.createdAt).toISOString(),
      process: "Conversion" as const,
      person: r.operator?.trim() || "—",
      lossMg: r.conversionLossMg,
      reference: r.batchNo,
      notes:
        r.notes?.trim() ||
        `Conversion ${r.sourcePurity}→${r.destPurity}${r.furnace ? ` · ${r.furnace}` : ""}`,
      source: "metal_conversion" as const,
    }));
}

async function fetchInventoryConversionLossRows(
  from: string,
  to: string,
): Promise<GoldLossRow[]> {
  const { data, error } = await (supabase as any)
    .from("gold_lineage_events")
    .select(
      "id,event_type,voucher_ref,fine_gold_mg,gross_weight_mg,operator_name,notes,created_at",
    )
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`)
    .ilike("event_type", "%convert%")
    .order("created_at", { ascending: false })
    .limit(REPORT_ROW_LIMIT);

  if (error) {
    // Table may be absent on older envs — skip silently.
    console.warn("[gold-loss-report] gold_lineage_events:", error.message);
    return [];
  }

  const rows: GoldLossRow[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const notes = String(row.notes ?? "");
    const lossMatch = notes.match(/Loss:\s*(\d+)\s*mg/i);
    const lossMg = lossMatch ? asNumber(lossMatch[1]) : 0;
    if (lossMg <= 0) continue;
    const id = String(row.id ?? "");
    rows.push({
      id: `inv:${id}`,
      dateIso: String(row.created_at ?? new Date(0).toISOString()),
      process: "Conversion",
      person: String(row.operator_name ?? "—"),
      lossMg,
      reference: String(row.voucher_ref ?? id),
      notes: notes || "Inventory metal conversion loss",
      source: "inventory_lineage",
    });
  }
  return rows;
}

function emptyByProcess(): Record<GoldLossProcess, number> {
  return {
    Manufacturing: 0,
    Overloss: 0,
    Melt: 0,
    Workshop: 0,
    Conversion: 0,
    Ledger: 0,
  };
}

export async function fetchGoldLossReport({
  from,
  to,
  branchId,
}: {
  from?: string;
  to?: string;
  branchId?: string | null;
} = {}): Promise<GoldLossReportResult> {
  const range = {
    from: from || defaultDateRange().from,
    to: to || defaultDateRange().to,
  };
  const fromMs = new Date(`${range.from}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${range.to}T23:59:59.999Z`).getTime();

  const [ledger, inventory] = await Promise.all([
    fetchLedgerLossRows(range.from, range.to, branchId),
    fetchInventoryConversionLossRows(range.from, range.to),
  ]);

  const ledgerRefs = new Set(
    ledger.rows.map((r) => r.reference).filter((r) => r && r !== "—"),
  );

  const [mfg, conversions] = await Promise.all([
    fetchManufacturingLossRows(range.from, range.to, branchId, ledgerRefs),
    fetchConversionRecordRows(fromMs, toMs, ledgerRefs),
  ]);

  // Prefer ledger conversion-pair / metal_conversions over duplicate inventory rows.
  const invFiltered = inventory.filter((r) => !ledgerRefs.has(r.reference));

  const merged = [...ledger.rows, ...mfg.rows, ...conversions, ...invFiltered].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
  );

  const byProcess = emptyByProcess();
  let totalLossMg = 0;
  for (const row of merged) {
    totalLossMg += row.lossMg;
    byProcess[row.process] += row.lossMg;
  }

  return {
    rows: merged,
    totalLossMg,
    byProcess,
    capped: ledger.capped || mfg.capped,
  };
}

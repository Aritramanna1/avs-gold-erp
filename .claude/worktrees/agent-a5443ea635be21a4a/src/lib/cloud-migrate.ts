/**
 * MTJ ERP — Cloud Migration (Lovable Cloud / Supabase)
 *
 * Idempotently pushes every local pilot store into the connected
 * Lovable Cloud database. Designed to be safe to run multiple times —
 * uses upsert on the stable string primary key from the local stores.
 *
 * Cloud is the backup; local Zustand stores remain the source of truth
 * on the frontend until the service layer wires reads back in a later
 * sprint. We deliberately store the full record under `data jsonb` and
 * only fan out a small set of indexable columns. This keeps schema
 * coupling loose while ensuring no field is lost in the migration.
 */
import { supabase } from "@/integrations/supabase/client";
import { useLedger } from "@/lib/ledger-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useCatalog } from "@/lib/catalog-store";
import { useStock } from "@/lib/stock-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { useRateCuts } from "@/lib/ratecut-store";
import { useWhatsapp } from "@/lib/whatsapp-store";
import { usePrintLog } from "@/lib/printlog-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkers } from "@/lib/workers-store";
import { useAttachments } from "@/lib/attachments-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useCommLog } from "@/lib/comm-log-store";

export interface MigrationProgress {
  table: string;
  inserted: number;
  total: number;
  ok: boolean;
  error?: string;
}

async function upsertBatch(table: string, rows: any[], onProgress: (p: MigrationProgress) => void) {
  if (rows.length === 0) {
    onProgress({ table, inserted: 0, total: 0, ok: true });
    return;
  }
  const chunkSize = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table as any).upsert(chunk as any, { onConflict: "id" });
    if (error) {
      onProgress({ table, inserted: done, total: rows.length, ok: false, error: error.message });
      return;
    }
    done += chunk.length;
    onProgress({ table, inserted: done, total: rows.length, ok: true });
  }
}

function iso(ts?: number | string | Date): string {
  if (!ts) return new Date().toISOString();
  return new Date(ts).toISOString();
}

export async function migrateAllToCloud(
  onProgress: (p: MigrationProgress) => void,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const trap = (p: MigrationProgress) => {
    onProgress(p);
    if (!p.ok && p.error) errors.push(`${p.table}: ${p.error}`);
  };

  // ---------- People ----------
  const people = usePeople.getState().people.map((p: any) => ({
    id: p.id,
    type: p.type,
    active: p.active ?? true,
    full_name: p.fullName,
    phone: p.phone ?? null,
    whatsapp: p.whatsapp ?? null,
    email: p.email ?? null,
    village_city: p.villageCity ?? null,
    current_address: p.currentAddress ?? null,
    permanent_address: p.permanentAddress ?? null,
    gstin: p.gstin ?? null,
    pan: p.pan ?? null,
    aadhaar_masked: p.aadhaarMasked ?? null,
    work_type: p.workType ?? null,
    salary_rule_id: p.salaryRuleId ?? null,
    notes: p.notes ?? null,
    data: p,
  }));
  await upsertBatch("people", people, trap);

  // ---------- Gold ledger ----------
  const ledger = useLedger.getState().entries.map((e: any) => ({
    id: e.id,
    ts: iso(e.ts ?? e.createdAt),
    movement: e.movement ?? e.kind ?? "manual",
    net_fine_mg: e.netFineMg ?? 0,
    bucket_deltas: e.deltas ?? {},
    reference: e.reference ?? null,
    note: e.note ?? e.notes ?? null,
    data: e,
  }));
  await upsertBatch("gold_ledger", ledger, trap);

  // ---------- Workers ----------
  const workers: any = useWorkers.getState();
  const attendance = (workers.attendance ?? []).map((a: any) => ({
    id: a.id,
    worker_id: a.workerId,
    date: a.date,
    status: a.status,
    hours: a.hours ?? null,
    data: a,
  }));
  await upsertBatch("attendance", attendance, trap);

  const rules = (workers.rules ?? []).map((r: any) => ({
    id: r.id,
    name: r.name ?? r.label ?? `Rule ${r.id.slice(0, 6)}`,
    data: r,
  }));
  await upsertBatch("salary_rules", rules, trap);

  const wtx = [
    ...(workers.withdrawals ?? []).map((w: any) => ({
      id: w.id,
      worker_id: w.workerId,
      kind: "withdrawal",
      ts: iso(w.ts ?? w.date),
      amount_paise: w.amountPaise ?? 0,
      gold_mg: 0,
      data: w,
    })),
    ...(workers.loans ?? []).map((l: any) => ({
      id: l.id,
      worker_id: l.workerId,
      kind: "loan",
      ts: iso(l.ts ?? l.date),
      amount_paise: l.amountPaise ?? 0,
      gold_mg: 0,
      data: l,
    })),
    ...(workers.salaryAdvances ?? []).map((s: any) => ({
      id: s.id,
      worker_id: s.workerId,
      kind: "salary_advance",
      ts: iso(s.ts ?? s.date),
      amount_paise: s.amountPaise ?? 0,
      gold_mg: 0,
      data: s,
    })),
    ...(workers.goldAdvances ?? []).map((g: any) => ({
      id: g.id,
      worker_id: g.workerId,
      kind: "gold_advance",
      ts: iso(g.ts ?? g.date),
      amount_paise: 0,
      gold_mg: g.fineMg ?? g.grossMg ?? 0,
      data: g,
    })),
    ...(workers.wastageReturns ?? []).map((w: any) => ({
      id: w.id,
      worker_id: w.workerId,
      kind: "wastage_return",
      ts: iso(w.ts ?? w.date),
      amount_paise: 0,
      gold_mg: w.fineMg ?? 0,
      data: w,
    })),
  ];
  await upsertBatch("worker_transactions", wtx, trap);

  const settlements = (workers.settlements ?? []).map((s: any) => ({
    id: s.id,
    worker_id: s.workerId,
    period_from: s.periodFrom ?? s.fromDate ?? null,
    period_to: s.periodTo ?? s.toDate ?? null,
    data: s,
  }));
  await upsertBatch("worker_settlements", settlements, trap);

  // ---------- Orders ----------
  const orders = useOrders.getState().orders.map((o: any) => ({
    id: o.id,
    order_no: o.orderNo,
    type: o.type,
    status: o.status,
    customer_id: o.customerId,
    karigar_id: o.karigarId ?? null,
    expected_delivery: o.expectedDelivery ?? null,
    priority: o.priority,
    source: o.source,
    whatsapp_source_id: o.whatsappSourceId ?? null,
    data: o,
  }));
  await upsertBatch("orders", orders, trap);

  // ---------- Job cards + steps ----------
  const jobs = useJobCards.getState().jobs as any[];
  await upsertBatch(
    "job_cards",
    jobs.map((j) => ({
      id: j.id,
      job_no: j.jobNo,
      order_id: j.orderId,
      karigar_id: j.karigarId ?? null,
      status: j.status,
      template_key: j.templateKey ?? null,
      data: j,
    })),
    trap,
  );
  await upsertBatch(
    "job_process_steps",
    jobs.flatMap((j) =>
      (j.steps ?? []).map((s: any, idx: number) => ({
        id: `${j.id}:${idx}`,
        job_id: j.id,
        ordinal: idx,
        name: s.name,
        status: s.status,
        data: s,
      })),
    ),
    trap,
  );

  // ---------- Catalog ----------
  const catState: any = useCatalog.getState();
  const catItems: any[] = catState.designs ?? catState.items ?? [];
  await upsertBatch(
    "catalog_designs",
    catItems.map((c: any) => ({
      id: c.id,
      design_no: c.designNo ?? c.designNumber ?? null,
      name: c.name ?? c.itemName ?? "Design",
      category: c.category ?? null,
      data: c,
    })),
    trap,
  );

  // ---------- Stock ----------
  const stock: any = useStock.getState();
  await upsertBatch(
    "inventory",
    (stock.items ?? []).map((i: any) => ({
      id: i.id,
      item_code: i.itemCode,
      barcode: i.barcode,
      huid: i.huid ?? null,
      item_name: i.itemName,
      category: i.category ?? null,
      purity: i.purity ?? null,
      gross_mg: i.grossMg ?? 0,
      net_mg: i.netMg ?? 0,
      status: i.status,
      location: i.location,
      data: i,
    })),
    trap,
  );
  await upsertBatch(
    "stock_movements",
    (stock.movements ?? []).map((m: any) => ({
      id: m.id,
      item_id: m.itemId ?? null,
      ts: iso(m.ts),
      kind: m.kind,
      from_location: m.fromLocation ?? null,
      to_location: m.toLocation ?? null,
      note: m.note ?? m.notes ?? null,
      data: m,
    })),
    trap,
  );

  // ---------- Billing ----------
  const billing = useBilling.getState();
  await upsertBatch(
    "invoices",
    billing.invoices.map((i) => ({
      id: i.id,
      invoice_no: i.invoiceNo,
      customer_id: i.customerId,
      order_id: i.orderId ?? null,
      status: i.status,
      gst: i.gst,
      subtotal_paise: i.subtotalPaise,
      cgst_paise: i.cgstPaise,
      sgst_paise: i.sgstPaise,
      gst_paise: i.gstPaise,
      adjustment_paise: i.adjustmentPaise,
      grand_total_paise: i.grandTotalPaise,
      paid_paise: i.paidPaise,
      balance_paise: i.balancePaise,
      data: i,
    })),
    trap,
  );
  await upsertBatch(
    "payments",
    billing.invoices.flatMap((i) =>
      i.payments.map((p) => ({
        id: p.id,
        invoice_id: i.id,
        ts: iso(p.ts),
        mode: p.mode,
        amount_paise: p.amountPaise,
        reference: p.reference ?? null,
        notes: p.notes ?? null,
        data: p,
      })),
    ),
    trap,
  );

  // ---------- Rate-cut ----------
  await upsertBatch(
    "rate_cut_records",
    (useRateCuts.getState() as any).records.map((r: any) => ({
      id: r.id,
      rate_cut_no: r.rateCutNo ?? r.id,
      karigar_id: r.karigarId ?? null,
      job_id: r.jobId ?? null,
      overloss_fine_mg: r.overlossFineMg ?? 0,
      gold_rate_per_gram_paise: r.goldRatePerGramPaise ?? 0,
      penalty_paise: r.penaltyPaise ?? 0,
      settlement_mode: r.settlementMode ?? "cash",
      data: r,
    })),
    trap,
  );

  // ---------- Repairs ----------
  await upsertBatch(
    "repairs",
    useRepairs.getState().repairs.map((r) => ({
      id: r.id,
      repair_no: r.repairNo,
      customer_id: r.customerId ?? null,
      kind: r.kind,
      status: r.status,
      received_gross_mg: (r as any).receivedGrossMg ?? 0,
      estimated_charge_paise: r.estimatedChargePaise,
      advance_paise: r.advancePaise,
      data: r,
    })),
    trap,
  );

  // ---------- Daily close ----------
  await upsertBatch(
    "daily_close",
    (useDailyCloses.getState() as any).snapshots ?? (useDailyCloses.getState() as any).closes ?? [],
    trap,
  );

  // ---------- Print logs ----------
  await upsertBatch(
    "print_logs",
    usePrintLog.getState().events.map((e) => ({
      id: e.id,
      doc_type: e.docType,
      doc_number: e.docNumber,
      linked_id: e.linkedId,
      linked_label: e.linkedLabel ?? null,
      printed_by: e.printedBy,
      first_printed_at: iso(e.firstPrintedAt),
      last_printed_at: iso(e.lastPrintedAt),
      reprint_count: e.reprintCount,
      history: e.history,
    })),
    trap,
  );

  // ---------- WhatsApp inbox ----------
  await upsertBatch(
    "whatsapp_inbox",
    useWhatsapp.getState().messages.map((m) => ({
      id: m.id,
      sender_name: m.senderName,
      sender_phone: m.senderPhone,
      raw_text: m.rawText,
      status: m.status,
      parsed: m.parsed ?? null,
      converted_order_id: m.convertedOrderId ?? null,
      linked_person_id: m.linkedPersonId ?? null,
      notes: m.notes ?? null,
    })),
    trap,
  );

  // ---------- Attachments ----------
  const atts = Object.entries(useAttachments.getState().items).map(([key, a]) => {
    const parts = key.split(":");
    const entityType = parts[0] || "outside";
    const entityId = parts[1] || "unknown";
    const docKey = parts.slice(2).join(":") || "doc";
    return {
      id: key,
      kind: docKey,
      linked_id: entityId,
      linked_table: entityType,
      storage_path: a.storagePath ?? null,
      size_bytes: null,
      file_name: a.fileName ?? null,
      mime_type: null,
      created_at: iso(a.filedAt ?? a.updatedAt),
      updated_at: iso(a.updatedAt),
      data: a,
    };
  });
  await upsertBatch("attachments", atts, trap);

  // ---------- Worker Gold Book ----------
  const wgbEntries = useWorkerGoldBook.getState().entries.map((e) => ({
    id: e.id,
    worker_id: e.workerId,
    kind: e.type === "given" ? "gold_book_given" : "gold_book_return",
    ts: iso(e.createdAt),
    amount_paise: 0,
    gold_mg: e.fineMg ?? 0,
    data: e,
  }));
  await upsertBatch("worker_transactions", wgbEntries, trap);

  // ---------- Settings + dropdowns ----------
  const settings: any = useSettings.getState();
  await upsertBatch("app_settings", [{ id: "firm", scope: "firm", data: settings }], trap);
  const ddRows: any[] = [];
  const masters: Record<string, string[]> = settings.dropdowns ?? {};
  for (const [key, vals] of Object.entries(masters)) {
    vals.forEach((v, idx) =>
      ddRows.push({
        id: `${key}:${idx}`,
        master_key: key,
        value: v,
        sort_order: idx,
        active: true,
      }),
    );
  }
  await upsertBatch("dropdown_masters", ddRows, trap);

  const ok = errors.length === 0;
  if (ok) {
    const { setLastMigrationAt } = await import("@/lib/db-status");
    setLastMigrationAt();
  }
  return { ok, errors };
}

export async function wipeAllTestData(): Promise<{
  ok: boolean;
  clearedTables: string[];
  errors: string[];
}> {
  const tables = [
    "job_process_steps",
    "worker_transactions",
    "worker_settlements",
    "attendance",
    "payments",
    "invoices",
    "job_cards",
    "orders",
    "gold_ledger",
    "repairs",
    "daily_close",
    "print_logs",
    "whatsapp_inbox",
    "attachments",
    "communication_logs",
    "inventory",
    "stock_movements",
  ];

  const clearedTables: string[] = [];
  const errors: string[] = [];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .neq("id", "_never_match_id_");
      if (error) {
        errors.push(`${table}: ${error.message}`);
      } else {
        clearedTables.push(table);
      }
    } catch (err: any) {
      errors.push(`${table}: ${err?.message || String(err)}`);
    }
  }

  // Clear people table while preserving the authenticated super-admin
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const ownerEmail = authUser?.email;
    const { data: peopleList } = await supabase.from("people").select("*");
    if (peopleList) {
      for (const p of peopleList) {
        const isOwner = ownerEmail && p.email === ownerEmail;
        if (!isOwner) {
          const { error } = await supabase.from("people").delete().eq("id", p.id);
          if (error) errors.push(`people (${p.full_name}): ${error.message}`);
        }
      }
      clearedTables.push("people");
    }
  } catch (err: any) {
    errors.push(`people: ${err?.message || String(err)}`);
  }

  // Reset local Zustand stores to completely clear the UI memory
  try {
    usePeople.setState({ people: [] });
    useLedger.setState({ entries: [] });
    useOrders.setState({ orders: [] });
    useJobCards.setState({ jobs: [] });
    useStock.setState({ items: [], movements: [] });
    useBilling.setState({ invoices: [] });
    useWorkers.setState({ attendance: [], settlements: [] });
    useWorkerGoldBook.setState({ entries: [] });
    useRepairs.setState({ repairs: [] });
    useDailyCloses.setState({ closes: [] });
    usePrintLog.setState({ events: [] });
    useWhatsapp.setState({ messages: [] });
    useAttachments.setState({ items: {} });
    useCommLog.setState({ events: [] });
  } catch (err: any) {
    console.error("Error resetting local stores during wipe:", err);
  }

  return {
    ok: errors.length === 0,
    clearedTables,
    errors,
  };
}

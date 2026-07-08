import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings-store";
import { runLocal, upsertRow, softDeleteRow } from "@/lib/local-db";

// Map our entity types to Supabase table structures
const BRANCH_SUPPORTED_TABLES = [
  "people",
  "orders",
  "job_cards",
  "inventory",
  "stock_movements",
  "invoices",
  "payments",
  "repairs",
  "attendance",
  "worker_transactions",
  "worker_settlements",
  "daily_close",
  "print_logs",
  "whatsapp_inbox",
  "communication_logs",
  "gold_ledger",
  "module_states",
  "financial_lock_periods",
  "physical_stock_counts",
  "stock_lots",
  "stock_stones",
  "hallmark_batches",
  "order_issues",
  "worker_returns",
  "outside_work_transactions",
  "outside_work_labour_charges",
  "outside_work_payments",
  "customer_settlements",
];

function nz(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export function personRow(p: any) {
  return {
    id: p.id,
    type: p.type,
    active: p.active ?? true,
    full_name: p.fullName,
    phone: p.phone ?? null,
    village_city: p.villageCity ?? null,
    current_address: p.currentAddress ?? null,
    permanent_address: p.permanentAddress ?? null,
    gstin: p.gstin ?? null,
    pan: p.pan ?? null,
    aadhaar_masked: p.aadhaar ? `XXXX${p.aadhaar.replace(/\D/g, "").slice(-4)}` : null,
    work_type: p.workType ?? null,
    notes: p.notes ?? null,
    data: p,
  };
}

export function ledgerRow(e: any) {
  return {
    id: e.id,
    ts: new Date(e.createdAt || Date.now()).toISOString(),
    movement: e.type,
    net_fine_mg: e.netFineMg,
    bucket_deltas: e.deltas || null,
    reference: e.reference ?? null,
    note: e.notes ?? null,
    data: e,
  };
}

export function orderRow(o: any) {
  return {
    id: o.id,
    order_no: o.orderNo,
    type: o.type,
    status: o.status,
    customer_id: o.customerId,
    karigar_id: nz(o.karigarId),
    expected_delivery: nz(o.expectedDelivery),
    priority: o.priority,
    source: o.source,
    whatsapp_source_id: nz(o.whatsappSourceId),
    data: o,
  };
}

export function jobCardRow(j: any) {
  return {
    id: j.id,
    job_no: j.jobNo,
    order_id: nz(j.orderId),
    karigar_id: nz(j.karigarId),
    status: j.status,
    template_key: j.templateKey,
    data: j,
  };
}

export function inventoryRow(i: any) {
  return {
    id: i.id,
    item_code: nz(i.itemCode),
    barcode: nz(i.barcode),
    huid: nz(i.huid),
    item_name: i.itemName,
    category: nz(i.category),
    purity: i.purity ?? null,
    gross_mg: i.grossMg ?? 0,
    net_mg: i.netMg ?? 0,
    status: i.status,
    location: i.location,
    data: i,
  };
}

export function movementRow(m: any) {
  return {
    id: m.id,
    item_id: nz(m.itemId),
    ts: new Date(m.ts || Date.now()).toISOString(),
    kind: m.kind,
    from_location: nz(m.fromLocation),
    to_location: nz(m.toLocation),
    note: nz(m.notes),
    data: m,
  };
}

export function invoiceRow(inv: any) {
  return {
    id: inv.id,
    invoice_no: inv.invoiceNo,
    customer_id: nz(inv.customerId),
    order_id: nz(inv.orderId),
    status: inv.status,
    gst: inv.gst,
    subtotal_paise: inv.subtotalPaise ?? 0,
    cgst_paise: inv.cgstPaise ?? 0,
    sgst_paise: inv.sgstPaise ?? 0,
    gst_paise: inv.gstPaise ?? 0,
    adjustment_paise: inv.adjustmentPaise ?? 0,
    grand_total_paise: inv.grandTotalPaise ?? 0,
    paid_paise: inv.paidPaise ?? 0,
    balance_paise: inv.balancePaise ?? 0,
    data: inv,
  };
}

export function paymentRow(invoiceId: string, p: any) {
  return {
    id: p.id,
    invoice_id: nz(invoiceId),
    ts: new Date(p.ts || Date.now()).toISOString(),
    mode: p.mode,
    amount_paise: p.amountPaise ?? 0,
    reference: nz(p.reference),
    notes: nz(p.notes),
    data: { ...p, invoiceId },
  };
}

export async function saveDirect(table: string, id: string, rawPayload: any): Promise<void> {
  // Map to database schema
  let dbRow: any = null;

  if (table === "people") dbRow = personRow(rawPayload);
  else if (table === "gold_ledger") dbRow = ledgerRow(rawPayload);
  else if (table === "orders") dbRow = orderRow(rawPayload);
  else if (table === "job_cards") dbRow = jobCardRow(rawPayload);
  else if (table === "inventory") dbRow = inventoryRow(rawPayload);
  else if (table === "stock_movements") dbRow = movementRow(rawPayload);
  else if (table === "invoices") dbRow = invoiceRow(rawPayload);
  else if (table === "payments") {
    dbRow = paymentRow(rawPayload.invoiceId, rawPayload);
  } else if (table === "attendance") {
    dbRow = {
      id: rawPayload.id,
      worker_id: rawPayload.workerId,
      date: rawPayload.date,
      status: rawPayload.status,
      hours: rawPayload.overtimeHours ?? null,
      data: rawPayload,
    };
  } else if (table === "salary_rules") {
    dbRow = {
      id: rawPayload.id,
      name: rawPayload.name ?? rawPayload.label ?? `Rule ${rawPayload.id.slice(0, 6)}`,
      data: rawPayload,
    };
  } else if (table === "worker_transactions") {
    dbRow = {
      id: rawPayload.id,
      worker_id: rawPayload.workerId,
      kind:
        rawPayload.kind || (rawPayload.type === "given" ? "gold_book_given" : "gold_book_return"),
      ts: new Date(
        rawPayload.ts ?? rawPayload.date ?? rawPayload.createdAt ?? Date.now(),
      ).toISOString(),
      amount_paise: rawPayload.amountPaise ?? 0,
      gold_mg: rawPayload.fineMg ?? rawPayload.grossMg ?? 0,
      data: rawPayload,
    };
  } else if (table === "worker_settlements") {
    dbRow = {
      id: rawPayload.id,
      worker_id: rawPayload.workerId,
      period_from: rawPayload.periodFrom ?? rawPayload.fromDate ?? null,
      period_to: rawPayload.periodTo ?? rawPayload.toDate ?? null,
      data: rawPayload,
    };
  } else if (table === "catalog_designs") {
    dbRow = {
      id: rawPayload.id,
      design_no: rawPayload.designNo ?? rawPayload.designNumber ?? null,
      name: rawPayload.name ?? rawPayload.itemName ?? "Design",
      category: rawPayload.category ?? null,
      data: rawPayload,
    };
  } else if (table === "rate_cut_records") {
    dbRow = {
      id: rawPayload.id,
      rate_cut_no: rawPayload.rateCutNo ?? rawPayload.id,
      karigar_id: rawPayload.karigarId ?? null,
      job_id: rawPayload.jobId ?? null,
      overloss_fine_mg: rawPayload.overlossFineMg ?? 0,
      gold_rate_per_gram_paise: rawPayload.goldRatePerGramPaise ?? 0,
      penalty_paise: rawPayload.penaltyValuePaise ?? 0,
      settlement_mode: rawPayload.mode ?? "cash",
      data: rawPayload,
    };
  } else if (table === "repairs") {
    dbRow = {
      id: rawPayload.id,
      repair_no: rawPayload.repairNo,
      customer_id: rawPayload.customerId ?? null,
      kind: rawPayload.kind,
      status: rawPayload.status,
      received_gross_mg: rawPayload.receivedGrossMg ?? 0,
      estimated_charge_paise: rawPayload.estimatedChargePaise ?? 0,
      advance_paise: rawPayload.advancePaise ?? 0,
      data: rawPayload,
    };
  } else if (table === "daily_close") {
    dbRow = {
      id: rawPayload.id,
      data: rawPayload,
    };
  } else if (table === "print_logs") {
    dbRow = {
      id: rawPayload.id,
      doc_type: rawPayload.docType,
      doc_number: rawPayload.docNumber,
      linked_id: rawPayload.linkedId,
      linked_label: rawPayload.linkedLabel ?? null,
      printed_by: rawPayload.printedBy,
      first_printed_at: new Date(rawPayload.firstPrintedAt ?? Date.now()).toISOString(),
      last_printed_at: new Date(rawPayload.lastPrintedAt ?? Date.now()).toISOString(),
      reprint_count: rawPayload.reprintCount ?? 0,
      history: rawPayload.history ?? [],
    };
  } else if (table === "whatsapp_inbox") {
    dbRow = {
      id: rawPayload.id,
      sender_name: rawPayload.senderName,
      sender_phone: rawPayload.senderPhone,
      raw_text: rawPayload.rawText,
      status: rawPayload.status,
      parsed: rawPayload.parsed ?? null,
      converted_order_id: rawPayload.convertedOrderId ?? null,
      linked_person_id: rawPayload.linkedPersonId ?? null,
      notes: rawPayload.notes ?? null,
    };
  } else if (table === "app_settings") {
    dbRow = {
      id: id,
      scope: "firm",
      data: rawPayload,
      updated_at: new Date().toISOString(),
    };
  } else if (table === "manufacturing_bills") {
    // The bill row is already fully serialised by billToDbRow() in mfg store.
    // Pass it straight through — the function has already mapped camelCase → snake_case.
    dbRow = rawPayload;
  } else if (table === "melt_jobs") {
    // Melt job row is already serialised by melt-store's jobToDbRow helper.
    dbRow = rawPayload;
  } else if (table === "module_states") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branch_id || rawPayload.branchId,
      module_key: rawPayload.module_key || rawPayload.moduleKey,
      enabled: rawPayload.enabled ?? true,
      updated_at: new Date().toISOString(),
    };
  } else if (table === "dropdown_masters") {
    dbRow = rawPayload;
  } else if (table === "attachments") {
    dbRow = {
      id: rawPayload.id,
      file_name: rawPayload.file_name ?? null,
      kind: rawPayload.kind,
      linked_id: rawPayload.linked_id,
      linked_table: rawPayload.linked_table,
      size_bytes: rawPayload.size_bytes ?? null,
      storage_path: rawPayload.storage_path ?? null,
      mime_type: rawPayload.mime_type ?? null,
      data: rawPayload.data || rawPayload,
    };
  } else if (table === "financial_lock_periods") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId,
      period: rawPayload.period,
      data: rawPayload,
    };
  } else if (table === "physical_stock_counts") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId,
      status: rawPayload.status,
      data: rawPayload,
    };
  } else if (table === "stock_lots") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId,
      lot_number: rawPayload.lotNumber,
      status: rawPayload.status,
      data: rawPayload,
    };
  } else if (table === "stock_stones") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId,
      item_id: rawPayload.itemId ?? null,
      stone_type: rawPayload.stoneType,
      certificate_number: rawPayload.certificateNumber ?? null,
      data: rawPayload,
    };
  } else if (table === "hallmark_batches") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId,
      batch_number: rawPayload.batchNumber,
      status: rawPayload.status,
      data: rawPayload,
    };
  } else if (
    table === "credit_notes" ||
    table === "debit_notes" ||
    table === "estimates" ||
    table === "delivery_challans"
  ) {
    // These tables only have {id, data jsonb, created_at, updated_at} — no
    // structured branch_id/invoice_id/customer_id/status columns exist (see
    // supabase/migrations/*_add_credit_debit_notes_estimates_challans.sql).
    // The full domain object (including branchId/invoiceId/customerId/status)
    // already lives in `data`; nothing filters on top-level columns for these
    // tables yet, so there is no reason to write ones the schema doesn't have.
    dbRow = {
      id: rawPayload.id,
      data: rawPayload,
    };
  } else if (table === "order_issues" || table === "worker_returns") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId ?? null,
      order_id: rawPayload.orderId,
      worker_id: rawPayload.workerId ?? null,
      data: rawPayload,
    };
  } else if (
    table === "outside_work_transactions" ||
    table === "outside_work_labour_charges" ||
    table === "outside_work_payments"
  ) {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId ?? null,
      order_id: rawPayload.orderId ?? null,
      worker_id: rawPayload.jewellerId ?? null,
      data: rawPayload,
    };
  } else if (table === "customer_settlements") {
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId ?? null,
      order_id: rawPayload.orderId ?? null,
      worker_id: rawPayload.customerId ?? null,
      data: rawPayload,
    };
  } else if (table === "communication_logs") {
    dbRow = {
      id: rawPayload.id,
      channel: "whatsapp",
      direction: "outbound",
      status: "sent",
      phone: rawPayload.recipientPhone ?? null,
      body: rawPayload.body ?? null,
      linked_id: rawPayload.linkedId ?? null,
      linked_table: rawPayload.linkedType ?? null,
      data: rawPayload,
    };
  } else {
    // General fallback
    dbRow = {
      id: id,
      data: rawPayload,
    };
  }

  // Handle branch ID insertion if needed
  if (BRANCH_SUPPORTED_TABLES.includes(table) && dbRow) {
    let bid = null;
    if (dbRow.data && typeof dbRow.data === "object" && dbRow.data !== null) {
      bid = dbRow.data.branchId || dbRow.data.branch_id;
    }
    if (!bid) {
      bid = useSettings.getState().selectedBranchId || "MAIN";
    }
    if (dbRow.data && typeof dbRow.data === "object" && dbRow.data !== null) {
      const dataCopy = { ...dbRow.data };
      if (!dataCopy.branchId) dataCopy.branchId = bid;
      if (!dataCopy.branch_id) dataCopy.branch_id = bid;
      dbRow.data = dataCopy;
    }
    // Also set top-level branch_id if column exists
    if (["attachments", "file_attachments", "gold_settlements"].includes(table)) {
      dbRow.branch_id = bid;
    }
  }

  // Strict Database-First Action: Save directly to Supabase, throw error on failure
  const { error } = await supabase.from(table as any).upsert([dbRow], { onConflict: "id" });
  if (error) {
    // Surface a more actionable message for the two well-known schema gaps that ship
    // with the current production database (manufacturing_bills missing, melt_jobs missing columns).
    // Once `supabase/migrations/20260630_phase2_stabilization.sql` is applied this branch
    // becomes unreachable.
    if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
      throw new Error(
        `Database save failed for ${table}: this table is missing in Supabase. Apply supabase/migrations/20260630_phase2_stabilization.sql to provision it.`,
      );
    }
    if (error.code === "42703" || /column .* does not exist/i.test(error.message)) {
      throw new Error(
        `Database save failed for ${table}: schema is out of date. Apply supabase/migrations/20260630_phase2_stabilization.sql.`,
      );
    }
    throw new Error(`Database save failed for ${table}: ${error.message}`);
  }

  // readAll()/read() in base-repository.ts are local-first: readAll() only
  // re-pulls from Supabase when the local cache for this table is
  // completely EMPTY, so once any row has ever been cached locally, a
  // brand-new row saved here (direct-to-Supabase only, nothing written
  // locally) stayed invisible to every local-first read until some other
  // sync pass happened to pull it down — on a fresh reload right after
  // creating a record (e.g. navigating straight to a print/preview route)
  // this read back as "not found" even though the save had fully
  // succeeded. Mirroring the just-written row into the local cache here
  // keeps local-first reads immediately consistent with what was just
  // saved. Best-effort: the remote save already succeeded and must not be
  // undone by a local-cache hiccup, so a failure here is only logged.
  try {
    await runLocal(() => upsertRow(table, { id: rawPayload.id, data: JSON.stringify(rawPayload) }));
  } catch (err) {
    console.error(
      `[supabase-write] Failed to mirror ${table}/${rawPayload.id} to local cache:`,
      err,
    );
  }
}

export async function deleteDirect(table: string, id: string): Promise<void> {
  // Strict Database-First Action: Delete directly from Supabase, throw error on failure
  const { error } = await supabase
    .from(table as any)
    .delete()
    .eq("id", id);
  if (error) {
    if (error.code === "42P01" || /relation .* does not exist/i.test(error.message)) {
      throw new Error(
        `Database delete failed for ${table}: this table is missing in Supabase. Apply supabase/migrations/20260630_phase2_stabilization.sql.`,
      );
    }
    throw new Error(`Database delete failed for ${table}: ${error.message}`);
  }

  // Same local-cache mirroring as saveDirect above — without this, a
  // deleted row kept showing up in local-first reads until an unrelated
  // full resync happened to catch up.
  try {
    await runLocal(() => softDeleteRow(table, id));
  } catch (err) {
    console.error(
      `[supabase-write] Failed to mirror delete of ${table}/${id} to local cache:`,
      err,
    );
  }
}

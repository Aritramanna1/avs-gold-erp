import { getCloudDataClient as getRawSupabaseClient } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { redactWaConfig } from "@/lib/security/client-secret-redaction";

let cachedProfile: { firm_id: string; branch_id: string | null } | null = null;

// Map our entity types to Supabase table structures
const BRANCH_SUPPORTED_TABLES = [
  "attachments",
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
  "material_vault_movements",
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
  const supabase = getRawSupabaseClient();
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
      date: rawPayload.date,
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
      data: rawPayload,
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
      data: rawPayload,
    };
  } else if (table === "app_settings") {
    dbRow = {
      id: id,
      scope: "firm",
      data: rawPayload,
      updated_at: new Date().toISOString(),
    };
  } else if (table === "branch_settings") {
    dbRow = {
      branch_id: id,
      address: rawPayload.address ?? null,
      phone: rawPayload.phone ?? null,
      email: rawPayload.email ?? null,
      gstin: rawPayload.gstin ?? null,
      invoice_series: rawPayload.invoiceSeries ?? null,
      receipt_series: rawPayload.receiptSeries ?? null,
      barcode_series: rawPayload.barcodeSeries ?? null,
      smtp_host: rawPayload.smtpHost ?? null,
      smtp_port: rawPayload.smtpPort ?? null,
      smtp_user: rawPayload.smtpUser ?? null,
      smtp_from_name: rawPayload.smtpFromName ?? null,
      smtp_from_email: rawPayload.smtpFromEmail ?? null,
      wa_phone_number: rawPayload.waPhoneNumber ?? null,
      thermal_printer_ip: rawPayload.thermalPrinterIp ?? null,
      thermal_printer_port: rawPayload.thermalPrinterPort ?? null,
      default_karat: rawPayload.defaultKarat ?? null,
      gold_rate_source: rawPayload.goldRateSource ?? null,
      invoice_template_id: rawPayload.invoiceTemplateId ?? null,
      receipt_template_id: rawPayload.receiptTemplateId ?? null,
      logo_url: rawPayload.logoUrl ?? null,
      logo_storage_path: rawPayload.logoStoragePath ?? null,
      wa_config: (() => {
        const raw = rawPayload.wa_config ?? rawPayload.waConfig ?? null;
        if (!raw || typeof raw !== "object") return raw;
        return redactWaConfig(raw as Record<string, unknown>);
      })(),
      wa_automations: rawPayload.wa_automations ?? rawPayload.waAutomations ?? null,
      gold_rate_24k_override_paise: rawPayload.goldRate24KOverridePaise ?? null,
      gold_rate_22k_override_paise: rawPayload.goldRate22KOverridePaise ?? null,
      gold_rate_18k_override_paise: rawPayload.goldRate18KOverridePaise ?? null,
      silver_rate_override_paise: rawPayload.silverRateOverridePaise ?? null,
      updated_at: new Date().toISOString(),
    };
  } else if (table === "manufacturing_bills") {
    // The bill row is already fully serialised by billToDbRow() in mfg store.
    // Pass it straight through - the function has already mapped camelCase to snake_case.
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
    // Keep the full domain object in `data`, while also writing the live
    // tenant/branch columns used by RLS. The target schema has firm_id and
    // branch_id even though older repository comments described a JSON-only
    // compatibility shape.
    dbRow = {
      id: rawPayload.id,
      branch_id: rawPayload.branchId ?? null,
      customer_id: rawPayload.customerId ?? null,
      status: rawPayload.status ?? null,
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
    if (
      ["attachments", "file_attachments", "gold_settlements", "material_vault_movements"].includes(
        table,
      )
    ) {
      dbRow.branch_id = bid;
    }
  }

  // Load and cache firm profile to optimize writes and handle network blips
  let profile = cachedProfile;
  if (!profile) {
    const { data: userResult } = await supabase.auth.getUser();
    if (userResult.user?.id) {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("firm_id, branch_id")
        .eq("auth_id", userResult.user.id)
        .maybeSingle();
      if (profileData?.firm_id) {
        profile = {
          firm_id: profileData.firm_id,
          branch_id: profileData.branch_id || null,
        };
        cachedProfile = profile;
      }
    }
  }

  if (["credit_notes", "debit_notes", "estimates", "delivery_challans"].includes(table)) {
    if (profile?.firm_id) dbRow.firm_id = profile.firm_id;
    if (!dbRow.branch_id) dbRow.branch_id = profile?.branch_id ?? null;
  }

  // Auto-populate firm_id for all multi-tenant tables
  const multiTenantTables = [
    "people",
    "gold_ledger",
    "orders",
    "job_cards",
    "whatsapp_inbox",
    "inventory",
    "stock_movements",
    "invoices",
    "payments",
    "repairs",
    "attendance",
    "worker_returns",
    "customer_settlements",
    "worker_transactions",
    "worker_settlements",
    "material_vault_movements",
    "catalog_designs",
    "rate_cut_records",
    "daily_close",
    "branches",
    "precious_metals",
    "precious_metal_purities",
    "metal_composition_formulas",
    "supplier_purchases",
    "metal_conversions",
    "physical_stock_counts",
    "dropdown_masters",
    "financial_lock_periods",
    "stock_lots",
    "stock_stones",
    "hallmark_batches",
    "order_issues",
    "outside_work_transactions",
    "outside_work_labour_charges",
    "outside_work_payments",
    "attachments",
  ];

  if (multiTenantTables.includes(table) && !dbRow.firm_id) {
    if (profile?.firm_id) dbRow.firm_id = profile.firm_id;
  }

  // Strict Database-First Action: Save directly to Supabase, throw error on failure
  const conflictKey = table === "branch_settings" ? "branch_id" : "id";
  const { error } = await supabase.from(table as any).upsert([dbRow], { onConflict: conflictKey });
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

  // readAll()/read() in base-repository.ts use an in-memory Supabase-backed cache: readAll() only
  // re-pulls from Supabase when the local cache for this table is
  // completely EMPTY, so once any row has ever been cached locally, a
  // brand-new row saved here (direct-to-Supabase only, nothing written
  // in cache) stayed invisible to every cached read until some other
  // sync pass happened to pull it down - on a fresh reload right after
  // creating a record (e.g. navigating straight to a print/preview route)
  // this read back as "not found" even though the save had fully
  // succeeded. Mirroring the just-written row into the local cache here
  // keeps cached reads immediately consistent with what was just
  // saved. Best-effort: the remote save already succeeded and must not be
  // undone by a local-cache hiccup, so a failure here is only logged.
  // Supabase is the production source of truth. No local SQLite/IndexedDB
  // mirroring is performed in the online-only architecture.
}

export async function deleteDirect(table: string, id: string): Promise<void> {
  const supabase = getRawSupabaseClient();
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

  // Same in-memory cache update as saveDirect above - without this, a
  // deleted row kept showing up in cached reads until an unrelated
  // full resync happened to catch up.
  // Supabase is the production source of truth. No local SQLite/IndexedDB
  // mirroring is performed in the online-only architecture.
}

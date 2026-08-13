import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";
import { usePeople, type Person } from "@/lib/people-store";
import { useLedger, type LedgerEntry } from "@/lib/ledger-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { useJobCards, type JobCard } from "@/lib/jobcards-store";
import { useStock, type StockItem, type StockMovement } from "@/lib/stock-store";
import { useBilling, type Invoice } from "@/lib/billing-store";
import {
  useWorkers,
  type AttendanceEntry as AttendanceRecord,
  type SalaryRule,
  type Settlement as WorkerSettlement,
} from "@/lib/workers-store";
import {
  useWorkerGoldBook,
  type WorkerGoldBookEntry as WorkerGoldTransaction,
} from "@/lib/worker-gold-book-store";
import { useCatalog, type Design as CatalogDesign } from "@/lib/catalog-store";
import { useRateCuts, type RateCutRecord } from "@/lib/ratecut-store";
import { useRepairs, type Repair as RepairRecord } from "@/lib/repair-store";
import { useDailyCloses, type DailyClose as DailyCloseRecord } from "@/lib/dailyclose-store";
import { usePrintLog, type PrintEvent as PrintLogRecord } from "@/lib/printlog-store";
import { useWhatsapp, type WhatsappMessage } from "@/lib/whatsapp-store";
import { useSettings, isSettingsPullStale } from "@/lib/settings-store";
import { useAttachments, hydrateAttachmentsFromLocal } from "@/lib/attachments-store";
import { migrateLegacyRepairsToOrders } from "@/lib/repair-migration";
import { useCommLog, type CommEvent } from "@/lib/comm-log-store";
import { startRealtimeSync, stopRealtimeSync } from "@/lib/realtime-sync";
import { resolveAllSignedUrls, initializeStorage } from "@/lib/storage";
import { markCriticalLoadDone, markInitialLoadDone } from "@/lib/app-loading-store";
import { reportUnexpectedError } from "@/lib/error-handling";

/**
 * Returns the branch ID to filter queries by, or null if the current user
 * should see all branches (Super Owner, Administrator, CEO).
 */
function getActiveBranchId(): string | null {
  const { currentUserRole, selectedBranchId } = useSettings.getState();
  const GLOBAL_ROLES = ["Super Owner", "Administrator", "CEO (View Only)"];
  if (!currentUserRole || GLOBAL_ROLES.includes(currentUserRole)) return null;
  return selectedBranchId || "MAIN";
}

const STARTUP_DETAIL_CACHE_LIMIT = 500;
const STARTUP_LEDGER_CACHE_LIMIT = 1000;
const STARTUP_REFERENCE_CACHE_LIMIT = 1000;
const STARTUP_ATTACHMENT_CACHE_LIMIT = 1000;

export async function pullPeople(): Promise<void> {
  const bid = getActiveBranchId();
  // Keep only a small recent cache for legacy detail helpers and optimistic
  // edits. High-volume People screens use Supabase range/count queries via
  // `people-query.ts`; startup must not hydrate thousands of parties just to
  // render the shell.
  let q = supabase
    .from("people")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`people pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as Person | null)
    .filter((p): p is Person => !!p && !!p.id && !!p.fullName);
  usePeople.setState({ people: rows });
}

export async function pullLedger(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("gold_ledger")
    .select("data")
    .order("ts", { ascending: false })
    .limit(STARTUP_LEDGER_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`gold_ledger pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as LedgerEntry | null)
    .filter((e): e is LedgerEntry => !!e && !!e.id && typeof e.netFineMg === "number");
  useLedger.setState({ entries: rows });
}

export async function pullOrders(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("orders")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`orders pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as Order | null)
    .filter((o): o is Order => !!o && !!o.id && !!o.orderNo);
  useOrders.setState({ orders: rows });
}

export async function pullJobCards(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("job_cards")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`job_cards pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as JobCard | null)
    .filter((j): j is JobCard => !!j && !!j.id && !!j.jobNo);
  useJobCards.setState({ jobs: rows });
}

export async function pullInventory(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("inventory")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`inventory pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as StockItem | null)
    .filter((s): s is StockItem => !!s && !!s.id && !!s.itemName);
  useStock.setState({ items: rows });
}

export async function pullMovements(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("stock_movements")
    .select("data")
    .order("ts", { ascending: false })
    .limit(STARTUP_LEDGER_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`stock_movements pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as StockMovement | null)
    .filter((m): m is StockMovement => !!m && !!m.id && !!m.itemId);
  useStock.setState({ movements: rows });
}

export async function pullInvoices(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("invoices")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`invoices pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as Invoice | null)
    .filter((i): i is Invoice => !!i && !!i.id && !!i.invoiceNo)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  useBilling.setState({ invoices: rows });
}

export async function pullPayments(): Promise<void> {
  const { error } = await supabase.from("payments").select("id", { count: "exact", head: true });
  if (error) throw new Error(`payments pull: ${error.message}`);
}

export async function pullAttendance(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("attendance")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`attendance pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as AttendanceRecord | null)
    .filter((a): a is AttendanceRecord => !!a && !!a.id && !!a.workerId);
  useWorkers.setState({ attendance: rows });
}

export async function pullSalaryRules(): Promise<void> {
  const { data, error } = await supabase
    .from("salary_rules")
    .select("data")
    .limit(STARTUP_REFERENCE_CACHE_LIMIT);
  if (error) throw new Error(`salary_rules pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as SalaryRule | null)
    .filter((r): r is SalaryRule => !!r && !!r.id && !!r.workerId);
  useWorkers.setState({ rules: rows });
}

export async function pullWorkerTransactions(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("worker_transactions")
    .select("data, kind")
    .order("created_at", { ascending: false })
    .limit(STARTUP_LEDGER_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`worker_transactions pull: ${error.message}`);

  const withdrawals: any[] = [];
  const loans: any[] = [];
  const advances: any[] = [];
  const goldAdvances: any[] = [];
  const wastageReturns: any[] = [];
  const goldBookEntries: WorkerGoldTransaction[] = [];

  (data ?? []).forEach((r) => {
    const payload = r.data as any;
    if (!payload?.id) return;
    const k = (r as any).kind as string;
    if (k === "withdrawal") withdrawals.push(payload);
    else if (k === "loan") loans.push(payload);
    else if (k === "salary_advance") advances.push(payload);
    else if (k === "gold_advance") goldAdvances.push(payload);
    else if (k === "wastage_return") wastageReturns.push(payload);
    else if (k === "gold_book_given" || k === "gold_book_return")
      goldBookEntries.push(payload as WorkerGoldTransaction);
  });

  useWorkers.setState({ withdrawals, loans, advances, goldAdvances, wastageReturns });
  useWorkerGoldBook.setState({ entries: goldBookEntries });
}

export async function pullWorkerSettlements(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("worker_settlements")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`worker_settlements pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as WorkerSettlement | null)
    .filter((s): s is WorkerSettlement => !!s && !!s.id && !!s.workerId);
  useWorkers.setState({ settlements: rows });
}

export async function pullCatalogDesigns(): Promise<void> {
  const { data, error } = await supabase
    .from("catalog_designs")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_REFERENCE_CACHE_LIMIT);
  if (error) throw new Error(`catalog_designs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as CatalogDesign | null)
    .filter((d): d is CatalogDesign => !!d && !!d.id && !!d.designNumber);
  useCatalog.setState({ designs: rows });
}

export async function pullRateCutRecords(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("rate_cut_records")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`rate_cut_records pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as RateCutRecord | null)
    .filter((r): r is RateCutRecord => !!r && !!r.id && !!r.karigarId);
  useRateCuts.setState({ records: rows });
}

export async function pullRepairs(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("repairs")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`repairs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as RepairRecord | null)
    .filter((r): r is RepairRecord => !!r && !!r.id && !!r.repairNo);
  useRepairs.setState({ repairs: rows });
}

export async function pullDailyCloses(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("daily_close")
    .select("data")
    .order("date", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`daily_close pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as DailyCloseRecord | null)
    .filter((r): r is DailyCloseRecord => !!r && !!r.id);
  useDailyCloses.setState({ closes: rows });
}

export async function pullPrintLogs(): Promise<void> {
  const { data, error } = await supabase
    .from("print_logs")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (error) throw new Error(`print_logs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as PrintLogRecord | null)
    .filter((r): r is PrintLogRecord => !!r && !!r.id && !!r.docNumber);
  // Merge instead of replace: recordPrint() writes the new/incremented event
  // to local state immediately and saves to the backend fire-and-forget. If
  // this pull's request was already in flight when that happened, a blind
  // replace here would silently erase the just-created print/reprint event —
  // the exact printed-then-shows-as-never-printed race that made reprint
  // counts unreliable. Keep whichever side has the more recent activity.
  const merged = new Map(rows.map((r) => [r.id, r]));
  for (const local of usePrintLog.getState().events) {
    const remote = merged.get(local.id);
    if (!remote || local.lastPrintedAt > remote.lastPrintedAt) {
      merged.set(local.id, local);
    }
  }
  usePrintLog.setState({ events: Array.from(merged.values()) });
}

export async function pullWhatsappInbox(): Promise<void> {
  const { data, error } = await supabase
    .from("whatsapp_inbox")
    .select(
      "id, sender_name, sender_phone, raw_text, status, parsed, converted_order_id, linked_person_id, notes, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (error) throw new Error(`whatsapp_inbox pull: ${error.message}`);
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    senderName: r.sender_name || "",
    senderPhone: r.sender_phone || "",
    rawText: r.raw_text || "",
    status: (r.status || "pending") as any,
    parsed: (r.parsed || undefined) as any,
    convertedOrderId: r.converted_order_id || undefined,
    linkedPersonId: r.linked_person_id || undefined,
    notes: r.notes || undefined,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  }));
  useWhatsapp.setState({ messages: rows });
}

export async function pullAppSettings(): Promise<void> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("data, updated_at")
    .eq("id", "firm")
    .maybeSingle();
  if (error) throw new Error(`app_settings pull: ${error.message}`);

  // Drop a row that predates this tab's last settings write. Such a row is a
  // snapshot taken before the write (a pull already in flight, or a realtime echo
  // of the previous version); applying it would roll local state back and the next
  // persist would then commit that rollback — the mechanism by which a just-saved
  // custom form silently disappeared on restart.
  if (isSettingsPullStale((data as any)?.updated_at)) {
    return;
  }

  if (data?.data) {
    const payload = data.data as any;
    const firm = payload.firm ?? useSettings.getState().firm;

    // Resolve the logo through the configured remote storage signer.
    if (firm && firm.logoStoragePath) {
      try {
        const freshUrl = await getAttachmentSignedUrl("firm-assets", firm.logoStoragePath);
        if (freshUrl) {
          firm.logoUrl = freshUrl;
        }
      } catch (err) {
        console.warn("[data-loader] Failed to dynamically sign firm logo:", err);
      }
    }

    const updatedUsers = payload.users ?? useSettings.getState().users;
    useSettings.setState({
      firm,
      branding: {
        ...useSettings.getState().branding,
        ...(payload.branding ?? {}),
      },
      print: payload.print ?? useSettings.getState().print,
      gst: payload.gst ?? useSettings.getState().gst,
      makingCharge: payload.makingCharge ?? useSettings.getState().makingCharge,
      purities: payload.purities ?? useSettings.getState().purities,
      making: payload.making ?? useSettings.getState().making,
      hardware: payload.hardware ?? useSettings.getState().hardware,
      catalog: payload.catalog ?? useSettings.getState().catalog,
      goldRatePerGramPaise:
        payload.goldRatePerGramPaise ?? useSettings.getState().goldRatePerGramPaise,
      goldRate24KPerGramPaise:
        payload.goldRate24KPerGramPaise ?? useSettings.getState().goldRate24KPerGramPaise,
      goldRate18KPerGramPaise:
        payload.goldRate18KPerGramPaise ?? useSettings.getState().goldRate18KPerGramPaise,
      silverRatePerGramPaise:
        payload.silverRatePerGramPaise ?? useSettings.getState().silverRatePerGramPaise,
      bullionRateProvider:
        payload.bullionRateProvider ?? useSettings.getState().bullionRateProvider,
      language: payload.language ?? useSettings.getState().language,
      developer: payload.developer ?? useSettings.getState().developer,
      users: updatedUsers,
      invitations: payload.invitations ?? useSettings.getState().invitations,
      securityLogs: payload.securityLogs ?? useSettings.getState().securityLogs,
      printerProfiles: payload.printerProfiles ?? useSettings.getState().printerProfiles,
      documentTemplates: payload.documentTemplates ?? useSettings.getState().documentTemplates,
      complianceProfile: payload.complianceProfile ?? useSettings.getState().complianceProfile,
      formsMetadata: payload.formsMetadata ?? useSettings.getState().formsMetadata,
      campaignTemplates: payload.campaignTemplates
        ? { ...useSettings.getState().campaignTemplates, ...payload.campaignTemplates }
        : useSettings.getState().campaignTemplates,
      commAutomation: payload.commAutomation
        ? { ...useSettings.getState().commAutomation, ...payload.commAutomation }
        : useSettings.getState().commAutomation,
      smtp: payload.smtp ?? useSettings.getState().smtp,
      dropdowns: payload.dropdowns ?? useSettings.getState().dropdowns,
      disabledDropdowns: payload.disabledDropdowns ?? useSettings.getState().disabledDropdowns,
      branchSettings: payload.branchSettings ?? useSettings.getState().branchSettings,
      emailTemplates: payload.emailTemplates ?? useSettings.getState().emailTemplates,
    });

    // Also refresh currentUserRole if the users list changed (e.g. after an
    // admin updates roles via Supabase — picks it up via realtime subscription).
    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email;
    if (email) {
      const matched = updatedUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (matched?.role && matched.role !== useSettings.getState().currentUserRole) {
        useSettings.getState().setCurrentUserRole(matched.role);
      }
    }
  }
}

export async function pullDropdownMasters(): Promise<void> {
  const { data, error } = await supabase
    .from("dropdown_masters")
    .select("master_key, value")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(STARTUP_REFERENCE_CACHE_LIMIT);
  if (error) throw new Error(`dropdown_masters pull: ${error.message}`);
  const dict: Record<string, string[]> = {};
  (data ?? []).forEach((r) => {
    if (!dict[r.master_key]) dict[r.master_key] = [];
    dict[r.master_key].push(r.value);
  });
  if (Object.keys(dict).length > 0) {
    useSettings.setState({ dropdowns: { ...useSettings.getState().dropdowns, ...dict } });
  }
}

export async function pullAttachments(): Promise<void> {
  // Supabase-backed attachment metadata is authoritative. The compatibility
  // hydration call is retained while older attachment stores are migrated.
  await hydrateAttachmentsFromLocal();

  const dict: any = {};
  try {
    const { data: legacyData, error: legacyError } = await supabase
      .from("attachments")
      .select("data, id, file_name, storage_path")
      .order("updated_at", { ascending: false })
      .limit(STARTUP_ATTACHMENT_CACHE_LIMIT);

    if (legacyError) {
      console.warn("Attachments table query skipped/errored:", legacyError.message);
    } else {
      (legacyData ?? []).forEach((r) => {
        const rawData = (r.data as any) ?? {};
        dict[r.id] = {
          filed: rawData.filed ?? true,
          note: rawData.note ?? "",
          updatedAt: rawData.updatedAt ?? Date.now(),
          fileName: r.file_name || rawData.fileName || undefined,
          checksum: rawData.checksum || undefined,
          mimeType: rawData.mimeType || undefined,
          bucket: rawData.bucket || undefined,
          storagePath: r.storage_path || rawData.storagePath || undefined,
          uploadedBy: rawData.uploadedBy || undefined,
          fileDataUrl: rawData.fileDataUrl || undefined,
          thumbnailDataUrl: rawData.thumbnailDataUrl || undefined,
        };
      });
    }
  } catch (err) {
    console.warn("Attachments fetch skipped:", err);
  }

  // Merge rather than replace — a blind overwrite here could clobber an
  // attachment .save() that landed in memory a moment ago but hasn't yet
  // round-tripped through this exact pull (this pull can re-run later, e.g.
  // on branch switch or reconnect), which is exactly the "upload succeeds,
  // then later the attachment disappears / its status flips back" symptom.
  // The freshly-pulled DB row still wins per key — it's only the KEYS this
  // pull doesn't know about yet that are preserved from the in-memory state.
  //
  // `checksum` is legacy attachment metadata. New rows should use bucket and
  // storagePath; preserving checksum here only avoids erasing old references
  // while those records are migrated to Supabase storage.
  useAttachments.setState((s) => ({
    items: Object.fromEntries(
      Object.entries({ ...s.items, ...dict }).map(([k, v]: [string, any]) => [
        k,
        { ...v, checksum: v.checksum ?? s.items[k]?.checksum },
      ]),
    ),
  }));

  const legacyDictOnly: any = {};
  Object.entries(dict).forEach(([k, v]: [string, any]) => {
    if (v.bucket && v.storagePath) {
      legacyDictOnly[k] = v;
    }
  });
  void resolveAllSignedUrls(legacyDictOnly);
}

export async function pullBranches(): Promise<void> {
  const { data, error } = await supabase.from("branches").select("*");
  if (error) throw new Error(`branches pull: ${error.message}`);
  if (data && data.length > 0) {
    const branches = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      address: r.address ?? "",
      phone: r.phone ?? "",
      managerName: r.manager_name ?? r.data?.manager_name ?? "Unassigned",
      gstin: r.gstin ?? undefined,
      active: r.active,
      isDefault: r.is_default ?? r.data?.is_default ?? false,
    }));
    useSettings.setState({ branches });
    // Also update selectedBranchId if not set
    const def = branches.find((b) => b.isDefault);
    if (def && !useSettings.getState().selectedBranchId) {
      useSettings.setState({ selectedBranchId: def.id });
    }
  }
}

export async function pullBranchSettings(): Promise<void> {
  const { data, error } = await supabase.from("branch_settings").select("*");
  if (error) throw new Error(`branch_settings pull: ${error.message}`);
  if (data && data.length > 0) {
    const { hydrateWaStore } = await import("@/lib/wa-automation-store");
    data.forEach((r: any) => {
      if (r.wa_config || r.wa_automations) {
        hydrateWaStore(r.branch_id, r.wa_config ?? {}, r.wa_automations ?? {});
      }
      useSettings.getState().setBranchSettings(r.branch_id, {
        branchId: r.branch_id,
        address: r.address ?? undefined,
        phone: r.phone ?? undefined,
        email: r.email ?? undefined,
        gstin: r.gstin ?? undefined,
        invoiceSeries: r.invoice_series ?? undefined,
        receiptSeries: r.receipt_series ?? undefined,
        barcodeSeries: r.barcode_series ?? undefined,
        smtpHost: r.smtp_host ?? undefined,
        smtpPort: r.smtp_port ?? undefined,
        smtpUser: r.smtp_user ?? undefined,
        smtpPassword: r.smtp_password ?? undefined,
        smtpFromName: r.smtp_from_name ?? undefined,
        smtpFromEmail: r.smtp_from_email ?? undefined,
        waPhoneNumber: r.wa_phone_number ?? undefined,
        thermalPrinterIp: r.thermal_printer_ip ?? undefined,
        thermalPrinterPort: r.thermal_printer_port ?? undefined,
        defaultKarat: r.default_karat ?? undefined,
        goldRateSource: r.gold_rate_source ?? undefined,
        invoiceTemplateId: r.invoice_template_id ?? undefined,
        receiptTemplateId: r.receipt_template_id ?? undefined,
        logoUrl: r.logo_url ?? undefined,
        logoStoragePath: r.logo_storage_path ?? undefined,
        goldRate24KOverridePaise: r.gold_rate_24k_override_paise ?? undefined,
        goldRate22KOverridePaise: r.gold_rate_22k_override_paise ?? undefined,
        goldRate18KOverridePaise: r.gold_rate_18k_override_paise ?? undefined,
        silverRateOverridePaise: r.silver_rate_override_paise ?? undefined,
      });
    });
  }
}

export async function pullWorkshops(): Promise<void> {
  const { data, error } = await supabase.from("workshops").select("*").order("name");
  if (error) throw new Error(`workshops pull: ${error.message}`);
  if (data && data.length > 0) {
    const workshops = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type as any,
      branchId: r.branch_id,
      active: r.active,
      description: r.description ?? undefined,
    }));
    useSettings.setState({ workshops });
  }
}

export async function pullCommLogs(): Promise<void> {
  const bid = getActiveBranchId();
  let q = supabase
    .from("communication_logs")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  if (bid) q = q.filter("data->>branchId", "eq", bid) as typeof q;
  const { data, error } = await q;
  if (error) throw new Error(`communication_logs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as CommEvent | null)
    .filter((e): e is CommEvent => !!e && !!e.id && !!e.kind);
  useCommLog.setState({ events: rows });
}

async function runSafe(key: string, fn: () => Promise<void>, errors: string[]): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const normalized = reportUnexpectedError(e, `data-loader.${key}`);
    errors.push(`${key}: ${normalized.message} Reference: ${normalized.id}`);
  }
}

// Critical path: only what's needed to render the layout and sidebar correctly.
// These run IN PARALLEL and must complete before the UI is shown.
export async function pullCritical(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  await Promise.all([
    runSafe("app_settings", pullAppSettings, errors),
    runSafe("branches", pullBranches, errors),
    runSafe("branch_settings", pullBranchSettings, errors),
    runSafe("dropdown_masters", pullDropdownMasters, errors),
  ]);
  // Module states depend on selectedBranchId which is set by pullBranches
  await runSafe(
    "module_states",
    async () => {
      const { useModuleStore } = await import("@/lib/module-store");
      const branchId = useSettings.getState().selectedBranchId || "MAIN";
      await useModuleStore.getState().refresh(branchId);
    },
    errors,
  );
  return { ok: errors.length === 0, errors };
}

// Background path: all operational data, runs IN PARALLEL after UI is shown.
export async function pullBackground(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  await Promise.all([
    runSafe("workshops", pullWorkshops, errors),
    runSafe("people", pullPeople, errors),
    runSafe("gold_ledger", pullLedger, errors),
    runSafe("orders", pullOrders, errors),
    runSafe("job_cards", pullJobCards, errors),
    runSafe("inventory", pullInventory, errors),
    runSafe("stock_movements", pullMovements, errors),
    runSafe("invoices", pullInvoices, errors),
    runSafe("payments", pullPayments, errors),
    runSafe("attendance", pullAttendance, errors),
    runSafe("salary_rules", pullSalaryRules, errors),
    runSafe("worker_transactions", pullWorkerTransactions, errors),
    runSafe("worker_settlements", pullWorkerSettlements, errors),
    runSafe("catalog_designs", pullCatalogDesigns, errors),
    runSafe("rate_cut_records", pullRateCutRecords, errors),
    runSafe("repairs", pullRepairs, errors),
    runSafe("daily_close", pullDailyCloses, errors),
    runSafe("print_logs", pullPrintLogs, errors),
    runSafe("whatsapp_inbox", pullWhatsappInbox, errors),
    runSafe("attachments", pullAttachments, errors),
    runSafe("communication_logs", pullCommLogs, errors),
    runSafe(
      "crm",
      async () => {
        const { useCRMStore } = await import("@/lib/crm-store");
        await useCRMStore.getState().refresh();
      },
      errors,
    ),
    runSafe(
      "melt_jobs",
      async () => {
        const { useMeltStore } = await import("@/lib/melt-store");
        await useMeltStore.getState().refresh();
      },
      errors,
    ),
    runSafe(
      "manufacturing_bills",
      async () => {
        const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
        await useMfgBills.getState().refresh();
      },
      errors,
    ),
    runSafe(
      "gold_settlements",
      async () => {
        const { useGoldSettlement } = await import("@/lib/gold-settlement-store");
        await useGoldSettlement.getState().refresh();
      },
      errors,
    ),
    runSafe(
      "operational_settings",
      async () => {
        const [{ useCommSettings }, { useAutomationSettings }, { useWorkflowEngine }] =
          await Promise.all([
            import("@/lib/comm/comm-settings-store"),
            import("@/lib/comm/automation-settings-store"),
            import("@/lib/workflow-engine"),
          ]);
        await Promise.all([
          useCommSettings.getState().refresh(),
          useAutomationSettings.getState().refresh(),
          useWorkflowEngine.getState().refresh(),
        ]);
      },
      errors,
    ),
    // Credit notes, debit notes, estimates, delivery challans — all four
    // "billing documents" from billing-documents-store.ts were never
    // hydrated on boot (confirmed: zero references to this file anywhere
    // in data-loader.ts before this). A store's own list/detail route
    // populates it via its own useEffect, but a print route reached
    // directly (a fresh page load, e.g. a shared link) found nothing —
    // affects all four doc types identically, not just the one being
    // migrated, so fixed here once rather than per-route.
    runSafe(
      "billing_documents",
      async () => {
        const { useCreditNotes, useDebitNotes, useEstimates, useDeliveryChallans } =
          await import("@/lib/billing-documents-store");
        await Promise.all([
          useCreditNotes.getState().refresh(),
          useDebitNotes.getState().refresh(),
          useEstimates.getState().refresh(),
          useDeliveryChallans.getState().refresh(),
        ]);
      },
      errors,
    ),
  ]);
  return { ok: errors.length === 0, errors };
}

export async function pullAll(): Promise<{ ok: boolean; errors: string[] }> {
  const [r1, r2] = await Promise.all([pullCritical(), pullBackground()]);
  const errors = [...r1.errors, ...r2.errors];
  return { ok: errors.length === 0, errors };
}

let starting = false;
let isLoaded = false;

export async function startCloudSync(): Promise<void> {
  if (isLoaded || starting) {
    // Already hydrated (e.g. HMR remount or a second auth event) — the shell
    // must not stay stuck on the loading skeleton.
    if (isLoaded) markInitialLoadDone();
    return;
  }
  starting = true;
  try {
    const critical = await pullCritical();
    if (!critical.ok) {
      toast.error("Settings failed to load", {
        description: critical.errors.slice(0, 2).join("; "),
        duration: 6000,
      });
    }
    // Unblocks routes that gate on firm.shopName (e.g. index.tsx's first-run
    // redirect) — set regardless of critical.ok so a failed pull doesn't
    // leave those routes waiting forever.
    useSettings.getState().setSettingsHydrated(true);
    // Reveal the real shell + route the moment the layout's own data is in;
    // operational modules fill in from the background pull below, each showing
    // its own per-store skeleton until then, instead of one global gate.
    markCriticalLoadDone();
    // Background load starts after critical — don't await so UI unblocks immediately
    void pullBackground()
      .then(async (bg) => {
        markInitialLoadDone();
        if (!bg.ok) {
          toast.error("Some data failed to load in background", {
            description: bg.errors.slice(0, 2).join("; "),
            duration: 4000,
          });
        }
        // Auto-seed demo data only for self-serve trial tenants — an empty
        // database is the NORMAL state for a real paying customer's first
        // login (a brand-new tenant hasn't entered any people/orders/stock
        // yet), and silently injecting fake demo records into their live
        // account would be a real data-integrity problem, not a convenience.
        // Trial status is the only signal available that this is a sandbox
        // account, not a real one.
        const peopleCount = usePeople.getState().people.length;
        const ordersCount = useOrders.getState().orders.length;
        const stockCount = useStock.getState().items.length;
        const { useLicense } = await import("@/lib/licensing/license-store");
        const isTrialTenant = useLicense.getState().status === "trial";
        if (isTrialTenant && peopleCount === 0 && ordersCount === 0 && stockCount === 0) {
          console.log(
            "[data-loader] Trial database is empty. Seeding pilot dataset automatically...",
          );
          const { seedPilotDataset } = await import("@/lib/test-seed");
          await seedPilotDataset();
        }
      })
      .catch((error) => {
        const normalized = reportUnexpectedError(error, "data-loader.background");
        markInitialLoadDone();
        toast.error(normalized.title, {
          description: `${normalized.message} Reference: ${normalized.id}`,
          duration: 7000,
        });
      });
    isLoaded = true;
    startRealtimeSync();
    void initializeStorage()
      .then(() => {
        void migrateLegacyRepairsToOrders().catch((error) =>
          reportUnexpectedError(error, "data-loader.repair-migration"),
        );
      })
      .catch((error) => reportUnexpectedError(error, "data-loader.storage-init"));
  } finally {
    starting = false;
  }
}

export function stopCloudSync(): void {
  stopRealtimeSync();
  isLoaded = false;
}

/** Compatibility alias. Ornexa production has one Supabase-backed boot path. */
export async function startLocalLoad(): Promise<void> {
  return startCloudSync();
}

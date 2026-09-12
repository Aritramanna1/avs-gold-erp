import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  redactBullionRateProvider,
  redactSmtpSettings,
  redactWaConfig,
} from "@/lib/security/client-secret-redaction";
import { getAttachmentSignedUrl, normalizeR2Url } from "@/lib/supabase-storage";
import { usePeople, type Person } from "@/lib/people-store";
import { rowToPerson } from "@/lib/people-query";
import { useLedger, type LedgerEntry } from "@/lib/ledger-store";
import { fetchGoldLedgerPage } from "@/lib/ledger-pagination";
import { useOrders, type Order } from "@/lib/orders-store";
import { useJobCards, type JobCard } from "@/lib/jobcards-store";
import { useStock, type StockItem, type StockMovement } from "@/lib/stock-store";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { rowToInvoice } from "@/lib/billing-query";
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
import {
  markCriticalLoadDone,
  markInitialLoadDone,
  markCriticalLoadDegraded,
} from "@/lib/app-loading-store";
import { recordStartupMetric } from "@/lib/performance/startup-metrics";
import { logBackgroundError } from "@/lib/error-handling";
import { isOnline } from "@/lib/native/network";
import {
  AsyncTimeoutError,
  withTimeout,
  STAGED_LOAD_THRESHOLDS_MS,
} from "@/lib/performance/resilient-async";
import {
  readBootSessionCache,
  writeBootSessionCache,
  clearBootSessionCache,
} from "@/lib/boot-session-cache";
import { isProductionSupabaseEgressBlocked } from "@/lib/supabase-egress-guard";
import { beginEgressOperation } from "@/lib/monitoring/supabase-egress-monitor";
import { dedupedPull } from "@/lib/pull-dedupe";

const STARTUP_DETAIL_CACHE_LIMIT = 200;
// Boot hydration for high-volume ledger tables is intentionally limited to a
// recent tail. The full ledger history is still available via the dedicated
// report/ledger queries on-demand; pulling the entire historical gold_ledger
// payload during startup makes the app vulnerable to the 25s request timeout.
const STARTUP_LEDGER_CACHE_LIMIT = 150;
const STARTUP_REFERENCE_CACHE_LIMIT = 400;
const STARTUP_ATTACHMENT_CACHE_LIMIT = 150;

/** Firm scope for startup pulls ÔÇö uses cached resolve so parallel batches share one lookup. */
async function firmIdForPull(): Promise<string | null> {
  const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
  return resolveCurrentFirmId();
}

export async function pullPeople(): Promise<void> {
  return dedupedPull("people", pullPeopleInner);
}

async function pullPeopleInner(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    usePeople.setState({ people: [] });
    return;
  }
  // Keep a small recent cache for detail helpers. People lists use
  // `people-query.ts`. Read columns + `data` so a just-created party still
  // hydrates after refresh even if jsonb is incomplete.
  const { data, error } = await supabase
    .from("people")
    .select("id,full_name,phone,email,type,active,created_at,updated_at,data")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(`people pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => rowToPerson(r as any))
    .filter((p): p is Person => !!p && !!p.id && !!p.fullName);
  usePeople.setState((s) => {
    const byId = new Map(rows.map((p) => [p.id, p]));
    for (const local of s.people) {
      if (!byId.has(local.id) && Date.now() - (local.updatedAt || 0) < 120_000) {
        byId.set(local.id, local);
      }
    }
    return {
      people: Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    };
  });
}

export async function pullLedger(): Promise<void> {
  return dedupedPull("gold_ledger", pullLedgerInner);
}

async function pullLedgerInner(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useLedger.setState({ entries: [] });
    return;
  }
  const page = await fetchGoldLedgerPage({
    limit: STARTUP_LEDGER_CACHE_LIMIT,
    offset: 0,
    order: "desc",
  });
  useLedger.setState({
    entries: page.rows.sort((a, b) => a.createdAt - b.createdAt),
  });
}

export async function pullOrders(): Promise<void> {
  return dedupedPull("orders", pullOrdersInner);
}

async function pullOrdersInner(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useOrders.setState({ orders: [] });
    return;
  }
  const q = supabase
    .from("orders")
    .select("data")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(120);
  const { data, error } = await q;
  if (error) throw new Error(`orders pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as Order | null)
    .filter((o): o is Order => !!o && !!o.id && !!o.orderNo);
  useOrders.setState({ orders: rows });
}

export async function pullJobCards(): Promise<void> {
  return dedupedPull("job_cards", pullJobCardsInner);
}

async function pullJobCardsInner(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useJobCards.setState({ jobs: [] });
    return;
  }
  const q = supabase
    .from("job_cards")
    .select("data")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`job_cards pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as JobCard | null)
    .filter((j): j is JobCard => !!j && !!j.id && !!j.jobNo);
  useJobCards.setState({ jobs: rows });
}

export async function pullInventory(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useStock.setState({ items: [] });
    return;
  }
  const q = supabase
    .from("inventory")
    .select("data")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`inventory pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as StockItem | null)
    .filter((s): s is StockItem => !!s && !!s.id && !!s.itemName);
  useStock.setState({ items: rows });
}

export async function pullMovements(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useStock.setState({ movements: [] });
    return;
  }
  const q = supabase
    .from("stock_movements")
    .select("data")
    .eq("firm_id", firmId)
    .order("ts", { ascending: false })
    .limit(STARTUP_LEDGER_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`stock_movements pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as StockMovement | null)
    .filter((m): m is StockMovement => !!m && !!m.id && !!m.itemId);
  useStock.setState({ movements: rows });
}

export async function pullInvoices(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useBilling.setState({ invoices: [] });
    return;
  }
  const q = supabase
    .from("invoices")
    .select(
      "id,invoice_no,customer_id,order_id,status,subtotal_paise,gst_paise,grand_total_paise,paid_paise,balance_paise,created_at,updated_at,data",
    )
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`invoices pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r: any) => rowToInvoice(r))
    .filter((i): i is Invoice => !!i && !!i.id && !!i.invoiceNo)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  useBilling.setState({ invoices: rows });
}

export async function pullPayments(): Promise<void> {
  // Payments hydrate on demand in billing flows; avoid a startup COUNT scan.
}

export async function pullAttendance(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useWorkers.setState({ attendance: [] });
    return;
  }
  const q = supabase
    .from("attendance")
    .select("data")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`attendance pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as AttendanceRecord | null)
    .filter((a): a is AttendanceRecord => !!a && !!a.id && !!a.workerId);
  useWorkers.setState({ attendance: rows });
}

export async function pullSalaryRules(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useWorkers.setState({ rules: [] });
    return;
  }
  const { data, error } = await supabase
    .from("salary_rules")
    .select("data")
    .eq("firm_id", firmId)
    .limit(STARTUP_REFERENCE_CACHE_LIMIT);
  if (error) throw new Error(`salary_rules pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as SalaryRule | null)
    .filter((r): r is SalaryRule => !!r && !!r.id && !!r.workerId);
  useWorkers.setState({ rules: rows });
}

export async function pullWorkerTransactions(): Promise<void> {
  return dedupedPull("worker_transactions", pullWorkerTransactionsInner);
}

async function pullWorkerTransactionsInner(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useWorkers.setState({
      withdrawals: [],
      loans: [],
      advances: [],
      allowances: [],
      goldAdvances: [],
      wastageReturns: [],
    });
    useWorkerGoldBook.setState({ entries: [] });
    return;
  }
  const q = supabase
    .from("worker_transactions")
    .select("data, kind")
    .eq("firm_id", firmId)
    .order("ts", { ascending: false })
    .limit(80);
  const { data, error } = await q;
  if (error) throw new Error(`worker_transactions pull: ${error.message}`);

  const withdrawals: any[] = [];
  const loans: any[] = [];
  const advances: any[] = [];
  const allowances: any[] = [];
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
    else if (k === "allowance") allowances.push(payload);
    else if (k === "gold_advance") goldAdvances.push(payload);
    else if (k === "wastage_return") wastageReturns.push(payload);
    else if (k === "gold_book_given" || k === "gold_book_return")
      goldBookEntries.push(payload as WorkerGoldTransaction);
  });

  useWorkers.setState({ withdrawals, loans, advances, allowances, goldAdvances, wastageReturns });
  useWorkerGoldBook.setState({ entries: goldBookEntries });
}

export async function pullWorkerSettlements(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useWorkers.setState({ settlements: [] });
    return;
  }
  const q = supabase
    .from("worker_settlements")
    .select("data")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`worker_settlements pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as WorkerSettlement | null)
    .filter((s): s is WorkerSettlement => !!s && !!s.id && !!s.workerId);
  useWorkers.setState({ settlements: rows });
}

export async function pullCatalogDesigns(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    return;
  }
  const { data, error } = await supabase
    .from("catalog_designs")
    .select("id,design_no,name,category,data,updated_at")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`catalog_designs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => {
      const row = r as {
        id: string;
        design_no: string | null;
        name: string | null;
        category: string | null;
        data?: Record<string, any> | null;
        updated_at: string | null;
      };
      if (!row.id) return null;
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
      const rawData = row.data || {};
      const design: CatalogDesign = {
        id: row.id,
        designNumber: rawData.designNumber || row.design_no || `DES-${row.id.slice(0, 6)}`,
        designName: rawData.designName || row.name || row.design_no || "Jewellery Design",
        category: rawData.category || row.category || "General",
        subcategory: rawData.subcategory,
        itemType: rawData.itemType,
        purity: Number(rawData.purity) || 916,
        approxGrossMg: Number(rawData.approxGrossMg) || 0,
        approxNetMg: Number(rawData.approxNetMg) || Number(rawData.approxGrossMg) || 0,
        difficulty: rawData.difficulty || "medium",
        tags: Array.isArray(rawData.tags) ? rawData.tags : [],
        source: rawData.source || "internal",
        notes: rawData.notes || undefined,
        photoDataUrl: rawData.photoDataUrl || undefined,
        createdAt: Number(rawData.createdAt) || updatedAt,
        updatedAt,
      };
      return design;
    })
    .filter((d): d is CatalogDesign => !!d);

  if (rows.length > 0) {
    const existing = useCatalog.getState().designs;
    const existingMap = new Map(existing.map((d) => [d.id, d]));
    rows.forEach((r) => existingMap.set(r.id, r));
    useCatalog.setState({ designs: Array.from(existingMap.values()) });
  }
}

export async function pullRateCutRecords(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useRateCuts.setState({ records: [] });
    return;
  }
  const q = supabase
    .from("rate_cut_records")
    .select("data")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`rate_cut_records pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as RateCutRecord | null)
    .filter((r): r is RateCutRecord => !!r && !!r.id && !!r.karigarId);
  useRateCuts.setState({ records: rows });
}

export async function pullRepairs(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useRepairs.setState({ repairs: [] });
    return;
  }
  const q = supabase
    .from("repairs")
    .select("data")
    .eq("firm_id", firmId)
    .order("updated_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`repairs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as RepairRecord | null)
    .filter((r): r is RepairRecord => !!r && !!r.id && !!r.repairNo);
  useRepairs.setState({ repairs: rows });
}

export async function pullDailyCloses(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useDailyCloses.setState({ closes: [] });
    return;
  }
  const q = supabase
    .from("daily_close")
    .select("data")
    .eq("firm_id", firmId)
    .order("date", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`daily_close pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as DailyCloseRecord | null)
    .filter((r): r is DailyCloseRecord => !!r && !!r.id);
  useDailyCloses.setState({ closes: rows });
}

export async function pullPrintLogs(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    usePrintLog.setState({ events: [] });
    return;
  }
  const { data, error } = await supabase
    .from("print_logs")
    .select("data")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`print_logs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r) => r.data as PrintLogRecord | null)
    .filter((r): r is PrintLogRecord => !!r && !!r.id && !!r.docNumber);
  // Merge instead of replace: recordPrint() writes the new/incremented event
  // to local state immediately and saves to the backend fire-and-forget. If
  // this pull's request was already in flight when that happened, a blind
  // replace here would silently erase the just-created print/reprint event ÔÇö
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
  const firmId = await firmIdForPull();
  if (!firmId) {
    useWhatsapp.setState({ messages: [] });
    return;
  }
  const { data, error } = await supabase
    .from("whatsapp_inbox")
    .select(
      "id, sender_name, sender_phone, raw_text, status, parsed, converted_order_id, linked_person_id, notes, created_at, updated_at",
    )
    .eq("firm_id", firmId)
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;

  let firmId: string | null = null;
  try {
    const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
    // Do not clear the firm cache on every settings pull ÔÇö parallel background
    // pulls share the cache and clearing here re-triggers RLS helper work.
    firmId = await resolveCurrentFirmId();
  } catch {
    /* fall through */
  }
  if (!firmId) {
    try {
      const { data: rpcFirm, error: rpcError } = await (supabase as any).rpc("my_firm_id");
      if (!rpcError && rpcFirm) firmId = String(rpcFirm);
    } catch {
      /* fall through */
    }
  }
  if (!firmId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    firmId = profile?.firm_id ?? null;
  }
  if (!firmId) {
    const { data: membership } = await (supabase as any)
      .from("tenant_memberships")
      .select("organization_id")
      .eq("auth_user_id", userId)
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    firmId = (membership as { organization_id?: string } | null)?.organization_id ?? null;
  }
  if (!firmId) return;

  const { data, error } = await supabase
    .from("app_settings")
    .select("data, updated_at")
    .eq("id", firmId)
    .maybeSingle();
  if (error) throw new Error(`app_settings pull: ${error.message}`);

  // Drop a row that predates this tab's last settings write. Such a row is a
  // snapshot taken before the write (a pull already in flight, or a realtime echo
  // of the previous version); applying it would roll local state back and the next
  // persist would then commit that rollback ÔÇö the mechanism by which a just-saved
  // custom form silently disappeared on restart.
  if (isSettingsPullStale((data as any)?.updated_at)) {
    return;
  }

  // Organization legal name is the trial/signup source of truth when the firm
  // blob is missing or still contaminated with the old shared MTJ defaults.
  let organizationName: string | null = null;
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", firmId)
      .maybeSingle();
    organizationName = (org as { name?: string } | null)?.name?.trim() || null;
  } catch {
    /* optional overlay */
  }

  // Demo-only markers. Never list real production firms (e.g. Maa Tara Jewellers).
  // Fake phones / Super Owner are cleared below when a blank/demo shop is replaced.
  const CONTAMINATED_SHOP_NAMES = new Set([
    "Demo Jewellers",
    "Sample Shop",
    "Test Firm",
  ]);

  if (data?.data) {
    const payload = data.data as any;
    const baseFirm = useSettings.getState().firm;
    const nested =
      payload.firm && typeof payload.firm === "object" && !Array.isArray(payload.firm)
        ? payload.firm
        : {};
    // SETTINGS-01: prefer nested firm.*, then legacy flat keys on the settings blob.
    let firm = { ...baseFirm, ...nested };
    const fillIfEmpty = (key: string, ...legacyKeys: string[]) => {
      const cur = String((firm as Record<string, unknown>)[key] ?? "").trim();
      if (cur) return;
      for (const lk of legacyKeys) {
        const v = (payload as Record<string, unknown>)[lk] ?? (nested as Record<string, unknown>)[lk];
        if (v != null && String(v).trim()) {
          (firm as Record<string, unknown>)[key] = String(v).trim();
          return;
        }
      }
    };
    fillIfEmpty("shopName", "shop_name", "businessName", "trade_name", "name");
    fillIfEmpty("phone", "businessPhone", "mobile", "contact_phone");
    fillIfEmpty("email", "businessEmail", "contact_email");
    fillIfEmpty("address", "businessAddress", "branchAddress", "address_line");
    fillIfEmpty("ownerName", "owner_name", "proprietor");
    fillIfEmpty("gstin", "GSTIN", "gst_in");
    fillIfEmpty("cityState", "city", "city_state");
    fillIfEmpty("pan", "PAN");
    fillIfEmpty("whatsappNumber", "whatsapp", "wa_number");
    fillIfEmpty("tagline", "tag_line");
    fillIfEmpty("website", "web", "site");
    const shop = String(firm?.shopName ?? "").trim();
    const wasContaminated = !shop || CONTAMINATED_SHOP_NAMES.has(shop);
    if (organizationName && wasContaminated) {
      firm = {
        ...firm,
        shopName: organizationName,
        email: /maatarajewellers/i.test(String(firm.email ?? "")) ? "" : firm.email,
        phone:
          String(firm.phone ?? "") === "9830012345" || String(firm.phone ?? "") === "98300 12345"
            ? ""
            : firm.phone,
        ownerName: firm.ownerName === "Super Owner" ? "" : firm.ownerName,
      };
    }

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
    if (firm && firm.logoUrl) {
      firm.logoUrl = normalizeR2Url(firm.logoUrl);
    }

    // SETTINGS-02: never let an empty/missing users[] wipe a good in-memory Owner directory.
  const updatedUsers =
    Array.isArray(payload.users) && payload.users.length > 0
      ? payload.users
      : useSettings.getState().users;
    const incomingBranding = payload.branding ?? {};
    if (incomingBranding.logoUrl) {
      incomingBranding.logoUrl = normalizeR2Url(incomingBranding.logoUrl);
    }

    useSettings.setState({
      firm,
      branding: {
        ...useSettings.getState().branding,
        ...incomingBranding,
      },
      print: payload.print ?? useSettings.getState().print,
      gst: payload.gst ?? useSettings.getState().gst,
      makingCharge: payload.makingCharge ?? useSettings.getState().makingCharge,
      purities: payload.purities ?? useSettings.getState().purities,
      making: payload.making ?? useSettings.getState().making,
      hardware: payload.hardware ?? useSettings.getState().hardware,
      catalog: payload.catalog ?? useSettings.getState().catalog,
      goldRatePerGramPaise:
        payload.goldRatePerGramPaise ??
        payload.firm?.goldRatePerGramPaise ??
        payload.rates?.goldRatePerGramPaise ??
        payload.rates?.gold22KPerGramPaise ??
        useSettings.getState().goldRatePerGramPaise,
      goldRate24KPerGramPaise:
        payload.goldRate24KPerGramPaise ??
        payload.firm?.goldRate24KPerGramPaise ??
        payload.rates?.goldRate24KPerGramPaise ??
        payload.rates?.gold24KPerGramPaise ??
        useSettings.getState().goldRate24KPerGramPaise,
      goldRate18KPerGramPaise:
        payload.goldRate18KPerGramPaise ??
        payload.firm?.goldRate18KPerGramPaise ??
        payload.rates?.goldRate18KPerGramPaise ??
        payload.rates?.gold18KPerGramPaise ??
        useSettings.getState().goldRate18KPerGramPaise,
      silverRatePerGramPaise:
        payload.silverRatePerGramPaise ??
        payload.firm?.silverRatePerGramPaise ??
        payload.rates?.silverRatePerGramPaise ??
        payload.rates?.silverPerGramPaise ??
        useSettings.getState().silverRatePerGramPaise,
      bullionRateProvider: payload.bullionRateProvider
        ? redactBullionRateProvider(payload.bullionRateProvider)
        : useSettings.getState().bullionRateProvider,
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
      smtp: payload.smtp ? redactSmtpSettings(payload.smtp) : useSettings.getState().smtp,
      dropdowns: payload.dropdowns ?? useSettings.getState().dropdowns,
      disabledDropdowns: payload.disabledDropdowns ?? useSettings.getState().disabledDropdowns,
      branchSettings: payload.branchSettings ?? useSettings.getState().branchSettings,
      emailTemplates: payload.emailTemplates ?? useSettings.getState().emailTemplates,
    });

    // Authoritative role lives on user_profiles ÔÇö never overwrite with a stale
    // app_settings.users[] snapshot during deployment pulls.
    const { syncCurrentUserRoleFromProfile } = await import("@/lib/role-resolution");
    await syncCurrentUserRoleFromProfile();

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("avs_firm_app_settings_cache", JSON.stringify(useSettings.getState()));
      }
    } catch {
      /* ignore storage quota / private browsing */
    }
  } else if (organizationName) {
    // Trial created the organization but no firm settings row yet ÔÇö surface the
    // company name so Settings / prints are not blank or stuck on shared defaults.
    const current = useSettings.getState().firm;
    useSettings.setState({
      firm: {
        ...current,
        shopName: current.shopName?.trim() ? current.shopName : organizationName,
      },
    });
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
    const key = r.master_key;
    if (!key) return;
    if (!dict[key]) dict[key] = [];
    if (r.value != null) dict[key].push(r.value);
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
    const firmId = await firmIdForPull();
    if (!firmId) {
      useAttachments.setState({ items: {} });
      return;
    }
    const { data: legacyData, error: legacyError } = await supabase
      .from("attachments")
      .select("data, id, file_name, storage_path")
      .eq("firm_id", firmId)
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

  // Merge rather than replace ÔÇö a blind overwrite here could clobber an
  // attachment .save() that landed in memory a moment ago but hasn't yet
  // round-tripped through this exact pull (this pull can re-run later, e.g.
  // on branch switch or reconnect), which is exactly the "upload succeeds,
  // then later the attachment disappears / its status flips back" symptom.
  // The freshly-pulled DB row still wins per key ÔÇö it's only the KEYS this
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
  void resolveAllSignedUrls(legacyDictOnly, { limit: 20 });
}

const BRANCH_COLUMNS = "id,name,short_name,address,phone,gstin,active,data,firm_id";
const BRANCH_SETTINGS_COLUMNS =
  "branch_id,data,address,phone,email,gstin,invoice_series,receipt_series,barcode_series,smtp_host,smtp_port,smtp_user,smtp_from_name,smtp_from_email,wa_phone_number,thermal_printer_ip,thermal_printer_port,default_karat,gold_rate_source,invoice_template_id,receipt_template_id,logo_url,logo_storage_path";
const WORKSHOP_COLUMNS = "id,name,branch_id,data";

export async function pullBranches(): Promise<void> {
  let firmId: string | null = null;
  try {
    const { useTenantContext } = await import("@/lib/identity/tenant-context-store");
    firmId = useTenantContext.getState().activeOrganizationId;
  } catch {
    /* fallback to resolveCurrentFirmId */
  }
  if (!firmId) {
    try {
      const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
      firmId = await resolveCurrentFirmId().catch(() => null);
    } catch {
      /* ignore */
    }
  }

  let data: any[] | null = null;
  let error: any = null;

  if (firmId) {
    const scopedRes = await (supabase.from("branches") as any)
      .select(BRANCH_COLUMNS)
      .eq("firm_id", firmId);
    if (!scopedRes.error && scopedRes.data && scopedRes.data.length > 0) {
      data = scopedRes.data;
    } else {
      error = scopedRes.error;
    }
  }

  // If no firm-specific branches found, fetch unassigned (legacy) branches
  if (!data || data.length === 0) {
    const fallbackRes = await (supabase.from("branches") as any)
      .select(BRANCH_COLUMNS)
      .is("firm_id", null);
    if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
      data = fallbackRes.data;
      error = null;
    }
  }

  if (error && (!data || data.length === 0)) throw new Error(`branches pull: ${error.message}`);
  if (data && data.length > 0) {
    const branches = data.map((r: any) => {
      const rowData =
        r.data && typeof r.data === "object" && !Array.isArray(r.data)
          ? (r.data as Record<string, unknown>)
          : {};
      return {
        id: r.id,
        name: r.name,
        code: String(r.short_name ?? rowData.code ?? r.code ?? "MAIN"),
        address: r.address ?? "",
        phone: r.phone ?? "",
        managerName: String(
          r.manager_name ?? rowData.manager_name ?? rowData.managerName ?? "Unassigned",
        ),
        gstin: r.gstin ?? undefined,
        active: r.active,
        isDefault: Boolean(r.is_default ?? rowData.is_default ?? rowData.isDefault ?? false),
        firmId: r.firm_id ?? undefined,
        firm_id: r.firm_id ?? undefined,
      };
    });
    useSettings.setState({ branches });
    // Remap missing / legacy "MAIN" selection onto the real default branch id
    // (trial branches are br_* with code MAIN). Leaving literal "MAIN" hides
    // People/orders filtered by data->>branchId.
    const currentBid = String(useSettings.getState().selectedBranchId ?? "").trim();
    const known = branches.some((b) => b.id === currentBid);
    if (!currentBid || currentBid === "MAIN" || currentBid === "WORKSHOP" || !known) {
      const def =
        branches.find((b) => b.isDefault) ||
        branches.find((b) => String(b.code || "").toUpperCase() === "MAIN") ||
        branches[0];
      // Only write when the value actually changes ÔÇö avoids settings churn loops.
      if (def && def.id !== currentBid) {
        useSettings.setState({ selectedBranchId: def.id });
      }
    }
  }
}

export async function pullBranchSettings(): Promise<void> {
  const { data, error } = await supabase.from("branch_settings").select(BRANCH_SETTINGS_COLUMNS);
  if (error) throw new Error(`branch_settings pull: ${error.message}`);
  if (data && data.length > 0) {
    const { hydrateWaStore } = await import("@/lib/wa-automation-store");
    for (const raw of data as Array<Record<string, unknown>>) {
      const r = raw;
      const rowData =
        r.data && typeof r.data === "object" && !Array.isArray(r.data)
          ? (r.data as Record<string, unknown>)
          : {};
      const rawWaConfig =
        r.wa_config ?? rowData.wa_config ?? rowData.waConfig ?? {};
      const rawWaAutomations =
        r.wa_automations ?? rowData.wa_automations ?? rowData.waAutomations ?? {};
      const waConfig = redactWaConfig(rawWaConfig as Record<string, unknown>);
      if (
        Object.keys(rawWaConfig as object).length > 0 ||
        Object.keys(rawWaAutomations as object).length > 0
      ) {
        hydrateWaStore(String(r.branch_id), waConfig, rawWaAutomations);
      }
    }

    const branchRows = data as Array<Record<string, unknown>>;

    branchRows.forEach((r) => {
      const rowData =
        r.data && typeof r.data === "object" && !Array.isArray(r.data)
          ? (r.data as Record<string, unknown>)
          : {};
      const branchId = String(r.branch_id);
      useSettings.getState().setBranchSettings(branchId, {
        branchId,
        address: (r.address as string | null) ?? undefined,
        phone: (r.phone as string | null) ?? undefined,
        email: (r.email as string | null) ?? undefined,
        gstin: (r.gstin as string | null) ?? undefined,
        invoiceSeries: (r.invoice_series as string | null) ?? undefined,
        receiptSeries: (r.receipt_series as string | null) ?? undefined,
        barcodeSeries: (r.barcode_series as string | null) ?? undefined,
        smtpHost: (r.smtp_host as string | null) ?? undefined,
        smtpPort: (r.smtp_port as string | null) ?? undefined,
        smtpUser: (r.smtp_user as string | null) ?? undefined,
        // SMTP secret presence is checked on Settings ÔåÆ Branch (not at boot ÔÇö N branches = N RPCs).
        smtpPasswordConfigured: false,
        smtpFromName: (r.smtp_from_name as string | null) ?? undefined,
        smtpFromEmail: (r.smtp_from_email as string | null) ?? undefined,
        waPhoneNumber: (r.wa_phone_number as string | null) ?? undefined,
        thermalPrinterIp: (r.thermal_printer_ip as string | null) ?? undefined,
        thermalPrinterPort: (r.thermal_printer_port as string | null) ?? undefined,
        defaultKarat: r.default_karat ? (Number(r.default_karat) as 22 | 24 | 18) : undefined,
        goldRateSource: (r.gold_rate_source as "manual" | "api" | undefined) ?? undefined,
        invoiceTemplateId: (r.invoice_template_id as string | null) ?? undefined,
        receiptTemplateId: (r.receipt_template_id as string | null) ?? undefined,
        logoUrl: r.logo_url ? normalizeR2Url(r.logo_url as string) : undefined,
        logoStoragePath: (r.logo_storage_path as string | null) ?? undefined,
        goldRate24KOverridePaise:
          (r.gold_rate_24k_override_paise as number | null) ??
          (rowData.goldRate24KOverridePaise as number | undefined) ??
          undefined,
        goldRate22KOverridePaise:
          (r.gold_rate_22k_override_paise as number | null) ??
          (rowData.goldRate22KOverridePaise as number | undefined) ??
          undefined,
        goldRate18KOverridePaise:
          (r.gold_rate_18k_override_paise as number | null) ??
          (rowData.goldRate18KOverridePaise as number | undefined) ??
          undefined,
        silverRateOverridePaise:
          (r.silver_rate_override_paise as number | null) ??
          (rowData.silverRateOverridePaise as number | undefined) ??
          undefined,
      });
    });

    // RATE-01: if firm-wide rates are still 0 after app_settings pull, promote
    // non-zero branch overrides so header / Daily Bhav / billing see them.
    const settings = useSettings.getState();
    const branch = settings.getBranchSettings(settings.selectedBranchId);
    const backfill: Record<string, number> = {};
    if (!(settings.goldRatePerGramPaise > 0) && (branch.goldRate22KOverridePaise ?? 0) > 0) {
      backfill.goldRatePerGramPaise = branch.goldRate22KOverridePaise as number;
    }
    if (!(settings.goldRate24KPerGramPaise > 0) && (branch.goldRate24KOverridePaise ?? 0) > 0) {
      backfill.goldRate24KPerGramPaise = branch.goldRate24KOverridePaise as number;
    }
    if (!(settings.goldRate18KPerGramPaise > 0) && (branch.goldRate18KOverridePaise ?? 0) > 0) {
      backfill.goldRate18KPerGramPaise = branch.goldRate18KOverridePaise as number;
    }
    if (!(settings.silverRatePerGramPaise > 0) && (branch.silverRateOverridePaise ?? 0) > 0) {
      backfill.silverRatePerGramPaise = branch.silverRateOverridePaise as number;
    }
    if (Object.keys(backfill).length > 0) {
      useSettings.setState(backfill);
    }
  }
}

export async function pullWorkshops(): Promise<void> {
  const { data, error } = await supabase.from("workshops").select(WORKSHOP_COLUMNS).order("name");
  if (error) {
    if (error.code === "PGRST205" || error.message?.includes("schema cache") || (error as any).code === "42P01") {
      return;
    }
    throw new Error(`workshops pull: ${error.message}`);
  }
  if (data && data.length > 0) {
    const workshops = data.map((r: any) => {
      const rowData =
        r.data && typeof r.data === "object" && !Array.isArray(r.data)
          ? (r.data as Record<string, unknown>)
          : {};
      return {
        id: r.id,
        name: String(r.name ?? rowData.name ?? ""),
        type: String(rowData.type ?? "manufacturing") as import("@/lib/settings-store").WorkshopDefinition["type"],
        branchId: r.branch_id ?? "",
        active: rowData.active !== false,
        description: rowData.description ? String(rowData.description) : undefined,
      };
    });
    useSettings.setState({ workshops });
  }
}

export async function pullCommLogs(): Promise<void> {
  const firmId = await firmIdForPull();
  if (!firmId) {
    useCommLog.setState({ events: [] });
    return;
  }
  const q = (supabase as any)
    .from("communication_logs")
    .select("data")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false })
    .limit(STARTUP_DETAIL_CACHE_LIMIT);
  const { data, error } = await q;
  if (error) throw new Error(`communication_logs pull: ${error.message}`);
  const rows = (data ?? [])
    .map((r: { data: unknown }) => r.data as CommEvent | null)
    .filter((e: CommEvent | null): e is CommEvent => !!e && !!e.id && !!e.kind);
  useCommLog.setState({ events: rows });
}

async function runSafe(key: string, fn: () => Promise<void>, errors: string[]): Promise<void> {
  try {
    await fn();
  } catch (initialError) {
    const { isAbortLikeError } = await import("@/lib/network-abort");
    if (isAbortLikeError(initialError)) {
      // Navigation/unmount abort ÔÇö do not retry (was doubling egress on boot pulls).
      console.warn(`[data-loader] ${key} aborted`);
      return;
    }
    const normalized = logBackgroundError(initialError, `data-loader.${key}`);
    errors.push(`${key}: ${normalized.message} Reference: ${normalized.id}`);
  }
}

async function runSafeBatches(
  tasks: Array<[string, () => Promise<void>]>,
  errors: string[],
  batchSize = 2,
): Promise<void> {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await Promise.all(batch.map(([key, fn]) => runSafe(key, fn, errors)));
  }
}

async function executePullCritical(errors: string[]): Promise<void> {
  // Firm resolution + settings blob must complete before scoped pulls share firm cache.
  await runSafe("app_settings", pullAppSettings, errors);
  // Independent catalog pulls ÔÇö parallel after settings to cut wall-clock boot time.
  await runSafeBatches(
    [
      ["branches", pullBranches],
      ["branch_settings", pullBranchSettings],
      ["dropdown_masters", pullDropdownMasters],
    ],
    errors,
    3,
  );
  // Module states need selectedBranchId (branches may remap legacy MAIN ÔåÆ real id).
  await runSafe(
    "module_states",
    async () => {
      const { useModuleStore } = await import("@/lib/module-store");
      const branchId = useSettings.getState().selectedBranchId || "MAIN";
      await useModuleStore.getState().refresh(branchId);
    },
    errors,
  );
}

export async function pullCritical(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const timeoutMs = STAGED_LOAD_THRESHOLDS_MS.fail;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await withTimeout(executePullCritical(errors), timeoutMs, "pullCritical");
      return { ok: errors.length === 0, errors };
    } catch (e) {
      lastError = e;
      // Wall-clock timeout already consumed the staged-load budget ÔÇö do not rerun the chain.
      if (e instanceof AsyncTimeoutError) break;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  const normalized = logBackgroundError(lastError, "data-loader.pullCritical");
  errors.push(`pullCritical: ${normalized.message} Reference: ${normalized.id}`);
  return { ok: errors.length === 0, errors };
}

// Background path: core operational data after UI is shown. Heavy/low-traffic
// slices defer to pullBackgroundDeferred() to cut Supabase egress on login.
export async function pullBackground(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  await firmIdForPull().catch(() => null);
  // Sequential background pulls ÔÇö parallel batches were causing statement timeouts (57014)
  // when combined with auth/membership RPCs during login boot.
  await runSafeBatches(
    [
      ["workshops", pullWorkshops],
      ["people", pullPeople],
      ["gold_ledger", pullLedger],
      ["orders", pullOrders],
      ["job_cards", pullJobCards],
      ["inventory", pullInventory],
      ["stock_movements", pullMovements],
      ["invoices", pullInvoices],
      ["attendance", pullAttendance],
      ["salary_rules", pullSalaryRules],
      ["worker_transactions", pullWorkerTransactions],
      ["worker_settlements", pullWorkerSettlements],
      [
        "gold_calculation_rules",
        async () => {
          const { ensureGoldCalculationRulesLoaded } = await import(
            "@/lib/gold-calculation-rules-store"
          );
          const { ensurePurityGradesLoaded } = await import("@/lib/purity-grades-store");
          await Promise.all([ensureGoldCalculationRulesLoaded(), ensurePurityGradesLoaded()]);
        },
      ],
    ],
    errors,
    1,
  );
  return { ok: errors.length === 0, errors };
}

let deferredPullStarted = false;

/** Low-priority hydrations ÔÇö run once, delayed, when the tab is idle/visible. */
export async function pullBackgroundDeferred(): Promise<void> {
  if (deferredPullStarted) return;
  deferredPullStarted = true;
  const errors: string[] = [];
  await runSafeBatches(
    [
      ["catalog_designs", pullCatalogDesigns],
      ["rate_cut_records", pullRateCutRecords],
      ["repairs", pullRepairs],
      ["daily_close", pullDailyCloses],
      ["print_logs", pullPrintLogs],
      ["whatsapp_inbox", pullWhatsappInbox],
      ["attachments", pullAttachments],
      ["communication_logs", pullCommLogs],
      [
        "party_opening_balances",
        async () => {
          const { hydratePartyOpeningBalances } = await import("@/lib/party-opening-balances");
          await hydratePartyOpeningBalances();
        },
      ],
      [
        "print_engine",
        async () => {
          const { hydratePrintEngineStores } = await import(
            "@/lib/print-engine/print-engine-bootstrap"
          );
          await hydratePrintEngineStores();
        },
      ],
      [
        "crm",
        async () => {
          const { useCRMStore } = await import("@/lib/crm-store");
          await useCRMStore.getState().refresh();
        },
      ],
      [
        "melt_jobs",
        async () => {
          const { useMeltStore } = await import("@/lib/melt-store");
          await useMeltStore.getState().refresh();
        },
      ],
      [
        "manufacturing_bills",
        async () => {
          const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
          await useMfgBills.getState().refresh();
        },
      ],
      [
        "gold_settlements",
        async () => {
          const { useGoldSettlement } = await import("@/lib/gold-settlement-store");
          await useGoldSettlement.getState().refresh();
        },
      ],
      [
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
      ],
      [
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
      ],
    ],
    errors,
    1,
  );
  if (errors.length > 0) {
    console.warn("[data-loader] deferred background partial failure:", errors.slice(0, 3));
  }
}

function scheduleDeferredBackgroundPull(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    if (document.visibilityState === "hidden") return;
    void pullBackgroundDeferred();
  };
  window.setTimeout(() => {
    const idle = window.requestIdleCallback;
    if (idle) idle(run, { timeout: 120_000 });
    else run();
  }, 90_000);
}

export async function pullAll(): Promise<{ ok: boolean; errors: string[] }> {
  const [r1, r2] = await Promise.all([pullCritical(), pullBackground()]);
  const errors = [...r1.errors, ...r2.errors];
  return { ok: errors.length === 0, errors };
}

let starting = false;
let isLoaded = false;

function isCloudSyncBlocked(): boolean {
  return isProductionSupabaseEgressBlocked();
}

async function resolveBootIdentity(): Promise<{ userId: string | null; firmId: string | null }> {
  try {
    const { getRawSupabaseClient } = await import("@/integrations/supabase/client");
    const { data } = await getRawSupabaseClient().auth.getSession();
    const userId = data.session?.user?.id ?? null;
    const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
    const firmId = await resolveCurrentFirmId().catch(() => null);
    return { userId, firmId };
  } catch {
    return { userId: null, firmId: null };
  }
}

function bootDegradedMessage(restored: boolean, summary: string): string {
  if (!isOnline() && restored) {
    return "Offline ÔÇö showing last synced workshop data. New saves wait in Pending Sync until you reconnect.";
  }
  if (isOnline() && restored) {
    return "Connection is slow ÔÇö showing last synced data. Retrying live sync in the backgroundÔÇª";
  }
  return summary || "Workspace settings could not be loaded. Check your connection and retry.";
}

let bootRecoveryInFlight = false;

/** After a degraded boot, retry Supabase pulls when the device is online. */
async function recoverCloudSyncAfterDegradedBoot(): Promise<void> {
  if (bootRecoveryInFlight || starting || !isOnline()) return;
  bootRecoveryInFlight = true;
  try {
    await new Promise((r) => setTimeout(r, 2_500));
    if (!isOnline()) return;

    const critical = await pullCritical();
    if (!critical.ok) return;

    markCriticalLoadDone();
    useSettings.getState().setSettingsHydrated(true);

    const bg = await pullBackground();
    markInitialLoadDone();
    await completeBootSessionCache();

    if (bg.ok) {
      const { saveErpReadCache, rehydratePendingOutboxPreviews } = await import(
        "@/lib/offline/erp-read-cache"
      );
      await saveErpReadCache();
      await rehydratePendingOutboxPreviews();
    } else {
      console.warn("[data-loader] recovery background partial:", bg.errors.slice(0, 5));
    }

    scheduleDeferredBackgroundPull();
    if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1") {
      startRealtimeSync();
    }
    if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_COMM_SCHEDULER === "1") {
      const { bootCommunicationRuntime } = await import("@/lib/comm/boot-communication");
      bootCommunicationRuntime();
    }
  } catch (error) {
    logBackgroundError(error, "data-loader.recoverBoot");
  } finally {
    bootRecoveryInFlight = false;
  }
}

async function hydrateFromCacheOnly(): Promise<void> {
  const { hydrateErpReadCache } = await import("@/lib/offline/erp-read-cache");
  const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
  const firmId = await resolveCurrentFirmId().catch(() => null);
  await hydrateErpReadCache(firmId);
  useSettings.getState().setSettingsHydrated(true);
  markCriticalLoadDone();
  markInitialLoadDone();
  isLoaded = true;
}

async function completeBootSessionCache(): Promise<void> {
  const { userId, firmId } = await resolveBootIdentity();
  writeBootSessionCache(userId, firmId);
}

export async function startCloudSync(force = false): Promise<void> {
  const op = beginEgressOperation("cloud_sync");
  try {
    if (!force && isCloudSyncBlocked()) {
      await hydrateFromCacheOnly();
      return;
    }

    if (!force) {
      const { userId, firmId } = await resolveBootIdentity();
      if (readBootSessionCache(userId, firmId)) {
        const { hydrateErpReadCache } = await import("@/lib/offline/erp-read-cache");
        await hydrateErpReadCache(firmId);
        isLoaded = true;
        useSettings.getState().setSettingsHydrated(true);
        markCriticalLoadDone();
        if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1") {
          startRealtimeSync();
        }
        // Session cache speeds shell open only ÔÇö always refresh live operational data.
        void pullBackground()
          .then(async (bg) => {
            markInitialLoadDone();
            await completeBootSessionCache();
            if (!bg.ok) {
              console.warn("[data-loader] background partial failure after cache hit:", bg.errors.slice(0, 5));
            } else {
              const { saveErpReadCache, rehydratePendingOutboxPreviews } = await import(
                "@/lib/offline/erp-read-cache"
              );
              await saveErpReadCache();
              await rehydratePendingOutboxPreviews();
            }
            scheduleDeferredBackgroundPull();
          })
          .catch(async (error) => {
            markInitialLoadDone();
            await completeBootSessionCache();
            logBackgroundError(error, "data-loader.background-after-cache");
            scheduleDeferredBackgroundPull();
          });
        if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_COMM_SCHEDULER === "1") {
          const { bootCommunicationRuntime } = await import("@/lib/comm/boot-communication");
          bootCommunicationRuntime();
        }
        return;
      }
    }

    if (!force && (isLoaded || starting)) {
      if (isLoaded) markInitialLoadDone();
      return;
    }
    starting = true;
    const { setRealtimeBootGrace } = await import("@/lib/realtime-sync");
    setRealtimeBootGrace();
    const bootWatchdog = globalThis.setTimeout(() => {
      if (!isLoaded) {
        markCriticalLoadDegraded(
          "Connection is slow ÔÇö opening with last synced settings. Data will refresh in the background.",
        );
        useSettings.getState().setSettingsHydrated(true);
        isLoaded = true;
      }
    }, 20_000);
    try {
      const critical = await pullCritical();
      if (!critical.ok) {
        const summary = critical.errors.slice(0, 2).join("; ");
        const { hydrateErpReadCache } = await import("@/lib/offline/erp-read-cache");
        const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
        const firmId = await resolveCurrentFirmId().catch(() => null);
        const restored = await hydrateErpReadCache(firmId);
        markCriticalLoadDegraded(bootDegradedMessage(restored, summary));
        useSettings.getState().setSettingsHydrated(true);
        isLoaded = true;
        if (isOnline()) {
          void recoverCloudSyncAfterDegradedBoot();
        }
        return;
      }
      useSettings.getState().setSettingsHydrated(true);
      markCriticalLoadDone();
      recordStartupMetric("critical_load_done", `${critical.errors.length} errors`);
      void pullBackground()
        .then(async (bg) => {
          markInitialLoadDone();
          await completeBootSessionCache();
          if (!bg.ok) {
            console.warn("[data-loader] background partial failure:", bg.errors.slice(0, 5));
            const { hydrateErpReadCache } = await import("@/lib/offline/erp-read-cache");
            if (usePeople.getState().people.length === 0) {
              const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
              const firmId = await resolveCurrentFirmId().catch(() => null);
              await hydrateErpReadCache(firmId);
            }
          } else {
            const { saveErpReadCache, rehydratePendingOutboxPreviews } = await import(
              "@/lib/offline/erp-read-cache"
            );
            await saveErpReadCache();
            await rehydratePendingOutboxPreviews();
          }
          scheduleDeferredBackgroundPull();
          const { startRealtimeSync, clearRealtimeBootGrace } = await import("@/lib/realtime-sync");
          if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1") {
            startRealtimeSync();
          }
          clearRealtimeBootGrace();
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
        .catch(async (error) => {
          const normalized = logBackgroundError(error, "data-loader.background");
          markInitialLoadDone();
          await completeBootSessionCache();
          console.warn("[data-loader] background fatal:", normalized.id, normalized.technicalMessage);
          const { startRealtimeSync, clearRealtimeBootGrace } = await import("@/lib/realtime-sync");
          if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_SUPABASE === "1") {
            startRealtimeSync();
          }
          clearRealtimeBootGrace();
        });
      isLoaded = true;
      if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_COMM_SCHEDULER === "1") {
        const { bootCommunicationRuntime } = await import("@/lib/comm/boot-communication");
        bootCommunicationRuntime();
      }
      void initializeStorage()
        .then(() => {
          void migrateLegacyRepairsToOrders().catch((error) =>
            logBackgroundError(error, "data-loader.repair-migration"),
          );
        })
        .catch((error) => logBackgroundError(error, "data-loader.storage-init"));
    } finally {
      globalThis.clearTimeout(bootWatchdog);
      starting = false;
    }
  } finally {
    op.finish(isLoaded);
  }
}

/** Force a fresh boot pull after a recoverable failure. */
export async function retryCloudSync(): Promise<void> {
  isLoaded = false;
  starting = false;
  const { userId, firmId } = await resolveBootIdentity();
  clearBootSessionCache(userId, firmId);
  const { useAppLoading } = await import("@/lib/app-loading-store");
  useAppLoading.setState({
    criticalLoadFailed: false,
    criticalLoadError: null,
    criticalLoadDone: false,
    initialLoadDone: false,
  });
  await startCloudSync(true);
}

export function stopCloudSync(): void {
  stopRealtimeSync();
  isLoaded = false;
  starting = false;
  deferredPullStarted = false;
}

/** Compatibility alias. AVS ERP production has one Supabase-backed boot path. */
export async function startLocalLoad(): Promise<void> {
  return startCloudSync();
}

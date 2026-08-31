/**
 * Last-pulled jeweller ERP lists for airplane-mode cold start.
 * Display + capture only. Gold Vault remains server-authoritative.
 */
import { loadEncryptedJson, removeEncryptedJson, saveEncryptedJson } from "./storage";
import { loadQueueSnapshot } from "./storage";
import { usePeople, type Person } from "@/lib/people-store";
import { useOrders, type Order } from "@/lib/orders-store";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { useStock, type StockItem } from "@/lib/stock-store";
import { useRepairs, type Repair } from "@/lib/repair-store";
import { useCatalog, type Design } from "@/lib/catalog-store";
import { useJobCards, type JobCard } from "@/lib/jobcards-store";
import { useLedger, type LedgerEntry } from "@/lib/ledger-store";
import { useWorkerGoldBook, type WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";
import { useExpensesStore, type ExpenseRecord } from "@/lib/expenses-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkers, type AttendanceEntry } from "@/lib/workers-store";
import type { OfflineOperation } from "./types";

const READ_KEY = "erp.read.v1";
const LIST_CAP = 400;
const LEDGER_CAP = 200;

type SettingsSlice = {
  firm: unknown;
  branding: unknown;
  print: unknown;
  gst: unknown;
  makingCharge: unknown;
  purities: unknown;
  making: unknown;
  hardware: unknown;
  catalog: unknown;
  goldRatePerGramPaise: unknown;
  goldRate24KPerGramPaise: unknown;
  goldRate18KPerGramPaise: unknown;
  silverRatePerGramPaise: unknown;
  language: unknown;
  branches: unknown;
  selectedBranchId: unknown;
  currentUserRole: unknown;
};

export type ErpReadCache = {
  savedAt: number;
  organizationId: string | null;
  people: Person[];
  orders: Order[];
  invoices: Invoice[];
  stockItems: StockItem[];
  repairs: Repair[];
  designs: Design[];
  jobs: JobCard[];
  ledger: LedgerEntry[];
  goldBook: WorkerGoldBookEntry[];
  expenses: ExpenseRecord[];
  attendance: AttendanceEntry[];
  settings: SettingsSlice;
};

function cap<T>(rows: T[], n: number): T[] {
  return rows.slice(0, n);
}

export async function saveErpReadCache(organizationId?: string | null): Promise<void> {
  const settings = useSettings.getState();
  const snapshot: ErpReadCache = {
    savedAt: Date.now(),
    organizationId: organizationId ?? null,
    people: cap(usePeople.getState().people, LIST_CAP),
    orders: cap(useOrders.getState().orders, LIST_CAP),
    invoices: cap(useBilling.getState().invoices, LIST_CAP),
    stockItems: cap(useStock.getState().items, LIST_CAP),
    repairs: cap(useRepairs.getState().repairs, LIST_CAP),
    designs: cap(useCatalog.getState().designs, LIST_CAP),
    jobs: cap(useJobCards.getState().jobs, LIST_CAP),
    ledger: cap([...useLedger.getState().entries].reverse(), LEDGER_CAP),
    goldBook: cap(useWorkerGoldBook.getState().entries, LIST_CAP),
    expenses: cap(useExpensesStore.getState().expenses, LIST_CAP),
    attendance: cap(useWorkers.getState().attendance, LIST_CAP),
    settings: {
      firm: settings.firm,
      branding: settings.branding,
      print: settings.print,
      gst: settings.gst,
      makingCharge: settings.makingCharge,
      purities: settings.purities,
      making: settings.making,
      hardware: settings.hardware,
      catalog: settings.catalog,
      goldRatePerGramPaise: settings.goldRatePerGramPaise,
      goldRate24KPerGramPaise: settings.goldRate24KPerGramPaise,
      goldRate18KPerGramPaise: settings.goldRate18KPerGramPaise,
      silverRatePerGramPaise: settings.silverRatePerGramPaise,
      language: settings.language,
      branches: settings.branches,
      selectedBranchId: settings.selectedBranchId,
      currentUserRole: settings.currentUserRole,
    },
  };
  try {
    await saveEncryptedJson(READ_KEY, snapshot);
  } catch (err) {
    console.warn("[offline] could not persist ERP read cache", err);
  }
}

export async function hydrateErpReadCache(expectedOrganizationId?: string | null): Promise<boolean> {
  const snap = await loadEncryptedJson<ErpReadCache>(READ_KEY);
  if (!snap) return false;

  // Never apply another firm's cached settings — that is how MTJ branding
  // reappeared after refresh on a shared browser / device.
  if (
    expectedOrganizationId &&
    snap.organizationId &&
    snap.organizationId !== expectedOrganizationId
  ) {
    return false;
  }

  if (snap.people?.length) usePeople.setState({ people: snap.people });
  if (snap.orders?.length) useOrders.setState({ orders: snap.orders });
  if (snap.invoices?.length) useBilling.setState({ invoices: snap.invoices });
  if (snap.stockItems?.length) useStock.setState({ items: snap.stockItems });
  if (snap.repairs?.length) useRepairs.setState({ repairs: snap.repairs });
  if (snap.designs?.length) useCatalog.setState({ designs: snap.designs });
  if (snap.jobs?.length) useJobCards.setState({ jobs: snap.jobs });
  if (snap.ledger?.length) useLedger.setState({ entries: snap.ledger });
  if (snap.goldBook?.length) useWorkerGoldBook.setState({ entries: snap.goldBook });
  if (snap.expenses?.length) useExpensesStore.setState({ expenses: snap.expenses });
  if (snap.attendance?.length) useWorkers.setState({ attendance: snap.attendance });
  if (snap.settings) {
    const slice = snap.settings;
    useSettings.setState({
      firm: slice.firm as never,
      branding: slice.branding as never,
      print: slice.print as never,
      gst: slice.gst as never,
      makingCharge: slice.makingCharge as never,
      purities: slice.purities as never,
      making: slice.making as never,
      hardware: slice.hardware as never,
      catalog: slice.catalog as never,
      goldRatePerGramPaise: slice.goldRatePerGramPaise as never,
      goldRate24KPerGramPaise: slice.goldRate24KPerGramPaise as never,
      goldRate18KPerGramPaise: slice.goldRate18KPerGramPaise as never,
      silverRatePerGramPaise: slice.silverRatePerGramPaise as never,
      language: slice.language as never,
      branches: slice.branches as never,
      selectedBranchId: slice.selectedBranchId as never,
      currentUserRole: slice.currentUserRole as never,
    });
    useSettings.getState().setSettingsHydrated(true);
  }

  await rehydratePendingOutboxPreviews();
  return true;
}

export async function clearErpReadCache(): Promise<void> {
  await removeEncryptedJson(READ_KEY);
}

function pendingId(op: OfflineOperation): string {
  return op.localId;
}

export async function rehydratePendingOutboxPreviews(): Promise<void> {
  const snap = await loadQueueSnapshot();
  for (const op of snap.operations) {
    if (op.status !== "pending_sync" && op.status !== "syncing" && op.status !== "needs_attention") {
      continue;
    }
    const id = pendingId(op);
    const p = op.payload;
    const action = op.action.toLowerCase();

    if (action === "party.create" || action.startsWith("people.create")) {
      const exists = usePeople.getState().people.some((row) => row.id === id);
      if (!exists && p.fullName) {
        usePeople.setState((s) => ({
          people: [
            {
              id,
              fullName: String(p.fullName),
              phone: String(p.phone || ""),
              type: (p.type as Person["type"]) || "customer",
              active: p.active !== false,
              createdAt: Date.parse(op.createdAt) || Date.now(),
              updatedAt: Date.now(),
              docs: {},
              ...(p as object),
            } as Person,
            ...s.people.filter((row) => row.id !== id),
          ],
        }));
      }
    }

    if (action === "invoice.create") {
      const exists = useBilling.getState().invoices.some((row) => row.id === id);
      if (!exists) {
        useBilling.setState((s) => ({
          invoices: [
            {
              id,
              invoiceNo: `PENDING-${id.slice(0, 8).toUpperCase()}`,
              createdAt: Date.parse(op.createdAt) || Date.now(),
              updatedAt: Date.now(),
              status: "draft",
              customerId: String(p.customerId || ""),
              customerName: String(p.customerName || "Pending customer"),
              items: (p.items as Invoice["items"]) ?? [],
              gst: (p.gst as Invoice["gst"]) ?? "none",
              cgstPaise: Number(p.cgstPaise || 0),
              sgstPaise: Number(p.sgstPaise || 0),
              gstPaise: Number(p.gstPaise || 0),
              tcsPaise: Number(p.tcsPaise || 0),
              subtotalPaise: Number(p.subtotalPaise || 0),
              adjustmentPaise: Number(p.adjustmentPaise || 0),
              grandTotalPaise: Number(p.grandTotalPaise || 0),
              paidPaise: Number(p.paidPaise || 0),
              balancePaise: Number(p.balancePaise || 0),
              payments: (p.payments as Invoice["payments"]) ?? [],
              notes: "Pending Sync — gold and legal number apply on reconnect",
            } as Invoice,
            ...s.invoices.filter((row) => row.id !== id),
          ],
        }));
      }
    }

    if (action === "repair.create") {
      const exists = useRepairs.getState().repairs.some((row) => row.id === id);
      if (!exists) {
        useRepairs.setState((s) => ({
          repairs: [
            {
              id,
              repairNo: `PENDING-${id.slice(0, 8).toUpperCase()}`,
              kind: (p.kind as Repair["kind"]) || "repair",
              createdAt: Date.parse(op.createdAt) || Date.now(),
              updatedAt: Date.now(),
              status: "pending",
              customerId: String(p.customerId || ""),
              customerName: String(p.customerName || "Pending customer"),
              customerPhone: p.customerPhone ? String(p.customerPhone) : undefined,
              itemType: String(p.itemType || "Item"),
              itemDescription: String(p.itemDescription || ""),
              receivedGrossMg: Number(p.receivedGrossMg || 0),
              repairType: (p.repairType as Repair["repairType"]) || "other",
              estimatedChargePaise: Number(p.estimatedChargePaise || 0),
              advancePaise: Number(p.advancePaise || 0),
              finalChargePaise: 0,
              polishingChargePaise: 0,
              additionalChargePaise: 0,
              gstEnabled: false,
              cgstPaise: 0,
              sgstPaise: 0,
              payments: [],
              timeline: [],
              notes: "Pending Sync",
            } as Repair,
            ...s.repairs.filter((row) => row.id !== id),
          ],
        }));
      }
    }

    if (action === "expense.create") {
      const exists = useExpensesStore.getState().expenses.some((row) => row.id === id);
      if (!exists) {
        useExpensesStore.setState((s) => ({
          expenses: [
            {
              ...(p as object),
              id,
            } as ExpenseRecord,
            ...s.expenses.filter((row) => row.id !== id),
          ],
        }));
      }
    }
  }
}

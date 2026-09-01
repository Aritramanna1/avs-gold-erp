import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useShortcutBinding } from "@/lib/keyboard/use-shortcut-binding";
import { getShortcutDisplayLabel } from "@/lib/keyboard/shortcut-keys";
import { isNativeApp } from "@/lib/native/platform";
import { useDeviceClass, layoutFromDevice } from "@/hooks/use-device-class";
import { useDraft } from "@/lib/drafts-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBilling,
  computeItemTotals,
  computeInvoiceTotals,
  computeInvoiceGoldTotals,
  paiseToFineGoldMg,
  invoiceItemValidationError,
  PAYMENT_MODE_LABELS,
  paiseToRupees,
  rupeesToPaise,
  customerLedger,
  type Invoice,
  type InvoiceItem,
  type InvoiceUrdLine,
  type PaymentRecord,
  type PaymentMode,
  type GstKind,
  type OrderAdjustment,
} from "@/lib/billing-store";
import { useOrders, ORDER_STATUS_LABELS } from "@/lib/orders-store";
import { useStock } from "@/lib/stock-store";
import { assertReadyStockSellable, stockItemHasProductPhoto } from "@/lib/stock-photos";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { isCustomerParty } from "@/lib/party-types";
import { applyInvoiceLineGold } from "@/lib/invoice-line-gold";
import {
  fineGoldMgConfigured,
  isJewelleryCalcFeatureEnabled,
} from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { ReadyStockPickerDialog } from "@/modules/billing/ReadyStockPickerDialog";
import { PersonFormDialog } from "@/routes/people.index";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { CashGoldPaymentSummary } from "@/components/billing/CashGoldPaymentSummary";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { resolveMakingCharge } from "@/lib/calculation-engine";
import {
  getCurrentGoldRatePaise,
  useCurrentGoldRatePaise,
  getBranchBullionRates,
} from "@/lib/bullion-rate-service";
import { useAttachments } from "@/lib/attachments-store";
import { useBillingStore, type BillingType } from "./billingStore";
import { useModuleStore } from "@/lib/module-store";
import { compileJewellerBook } from "@/lib/workshop-books";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { mgToGrams, gramsToMg, getDefaultPurityPermille } from "@/lib/gold";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Check,
  AlertTriangle,
  Scale,
  Barcode,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Landmark,
  Receipt,
  Undo2,
  Clock,
  Printer,
  Phone,
  Mail,
  Package,
  ArrowLeftRight,
} from "lucide-react";
import { PageHeader } from "@/components/design-system";
import { RequireAction } from "@/components/role-gate";
import { WeightInput } from "@/components/hardware/WeightInput";
import { CashDrawerButton } from "@/components/hardware/CashDrawerButton";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useScaleReading, type ScaleReading } from "@/lib/hardware-service";
import { thermalPrinterService } from "@/lib/thermal-printer";
import { isValidWaPhone } from "@/lib/wa-link";
import { notifyInvoiceReady } from "@/lib/comm/platform";
import { createDocumentShareLink } from "@/lib/document-shares";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";
import { fetchBillingInvoiceById } from "@/lib/billing-query";

interface BillingModuleProps {
  orderId?: string;
  stockId?: string;
  jobId?: string;
}

interface DraftPayment {
  id: string;
  mode: PaymentMode;
  amountStr: string;
  reference: string;
  notes: string;
  goldGramsStr: string;
  goldPurityStr: string;
  goldRateStr: string;
  goldMeltLossWtDeductionStr?: string;
  goldMeltLossPctDeductionStr?: string;
  /** False until the operator explicitly overrides the current main rate. */
  goldRateManuallyOverridden?: boolean;
}

// Manufacturing bill MP entry (metal received from karigar)
interface MfgMpEntry {
  id: string;
  type: "fine" | "lagad" | "scrap";
  label: string;
  grossMg: number; // G.Wt in mg
  purity: number; // Tunch per 100 (e.g. 76 = 76%)
  pcs: number; // pieces
  fineMg: number; // computed: grossMg × purity / 100
}

// "Custom Order Delivery" (custom_order) removed as a selectable type — order
// billing now flows through the Manufacturing Bill. The type remains in the
// billing-store union so any legacy custom_order bill still renders.
const BILLING_TYPES = [
  {
    id: "repair",
    label: "Repair Job / दुरुस्ती आणि रिपेअरिंग",
    desc: "Billing for repairing / soldering work",
    group: "primary" as const,
  },
  {
    id: "polishing",
    label: "Polishing Job / पॉलिशिंग काम",
    desc: "Billing for colouring, polishing or washing items",
    group: "primary" as const,
  },
  {
    id: "wholesale",
    label: "Wholesale Bill / घाऊक आणि होलसेल बिल",
    desc: "Wholesale transactions with other firms or goldsmiths",
    group: "primary" as const,
  },
  {
    id: "manufacturing",
    label: "Job-Work Invoice / कारीगर खाते",
    desc: "Jeweller gold account — gold given, received, balance",
    group: "primary" as const,
  },
  {
    id: "ready_stock",
    label: "Ready Stock Sale / रेडी स्टॉक विक्री",
    desc: "Direct sale of workshop-owned stock (minority flow — most billing is job-work)",
    group: "primary" as const,
  },
  {
    id: "advance_receipt",
    label: "Advance Deposit / ऑर्डर ॲडव्हान्स पावती",
    desc: "Generate advance receipt for booking a design",
    group: "secondary" as const,
  },
  {
    id: "payment_receipt",
    label: "Outstanding Receipt / जमा पावती",
    desc: "Receive payment for previous outstanding ledgers",
    group: "secondary" as const,
  },
];

// Job-work invoices bill making/wastage charges only — gold stays customer-owned.
// ready_stock is the sole legacy direct-stock-sale flow that bills full gold value.
function chargeModeForBillingType(
  billingType: BillingType | null | undefined,
): "job_work" | "full_value" {
  return billingType === "ready_stock" ? "full_value" : "job_work";
}

function newItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function getRowItemPhoto(it: { stockItemId?: string; barcode?: string; itemName?: string }) {
  const stockItems = useStock.getState().items;
  const resolve = (id: string) => {
    const item = stockItems.find((s) => s.id === id);
    if (item && stockItemHasProductPhoto(item)) {
      const attachments = useAttachments.getState().items;
      const list = useAttachments.getState().listForEntity("stock", id);
      for (const { docKey, rec } of list) {
        if (
          (docKey.startsWith("product_photo_") ||
            docKey === "design_photo" ||
            docKey === "item_photo") &&
          (rec.thumbnailDataUrl || rec.fileDataUrl)
        ) {
          return rec.thumbnailDataUrl || rec.fileDataUrl;
        }
      }
      const legacy = attachments[`stock:${id}:design_photo`];
      if (legacy?.thumbnailDataUrl || legacy?.fileDataUrl) {
        return legacy.thumbnailDataUrl || legacy.fileDataUrl;
      }
    }
    return undefined;
  };

  if (it.stockItemId) {
    const url = resolve(it.stockItemId);
    if (url) return url;
  }
  if (it.barcode) {
    const si = stockItems.find((s) => s.barcode === it.barcode);
    if (si) return resolve(si.id);
  }
  return undefined;
}

function getStockItemPhotoDataUrl(s: { id: string }): string | undefined {
  return getRowItemPhoto({ stockItemId: s.id });
}

/** Renders a stock photo, resolving Supabase storage paths asynchronously. */
function StockPhotoImg({
  stockItem,
  className,
  fallback,
}: {
  stockItem: { id: string; imageStoragePath?: string };
  className?: string;
  fallback?: React.ReactNode;
}) {
  const dataUrl = getStockItemPhotoDataUrl(stockItem);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(dataUrl ?? null);

  useEffect(() => {
    if (dataUrl) {
      setResolvedUrl(dataUrl);
      return;
    }
    if (!stockItem.imageStoragePath) return;
    getAttachmentSignedUrl("stock-assets", stockItem.imageStoragePath)
      .then((url) => {
        if (url) setResolvedUrl(url);
      })
      .catch(() => {});
  }, [stockItem.id, stockItem.imageStoragePath, dataUrl]);

  if (!resolvedUrl) return <>{fallback ?? null}</>;
  return <img src={resolvedUrl} alt="" className={className} />;
}

/**
 * Resolves a stock item's making charge. A stock item's own explicit
 * makingChargePct/makingChargePerGPaise always wins (unchanged behavior —
 * every existing stock row and every historically-posted invoice keeps
 * working exactly as before). Only the old hardcoded "12%" fallback — which
 * previously had zero configurability — now consults Settings → Making
 * Charge (category override, then tenant default), which can be any basis.
 */
function computeStockMakingCharge(
  stock: {
    category: string;
    makingChargePct?: number;
    makingChargePerGPaise?: number;
    grossMg: number;
    netMg: number;
    fineMg: number;
    piecesCount?: number;
    caratsCount?: number;
  },
  goldValuePaise: number,
  makingChargeSettings: import("@/lib/settings-store").MakingChargeSettings,
): {
  makingChargesPaise: number;
  makingChargePct: number;
  basis: import("@/lib/calculation-engine").MakingChargeBasis;
  ratePerUnitPaise: number;
} {
  if (stock.makingChargePct != null) {
    const resolved = resolveMakingCharge({
      basis: "percentage",
      percent: stock.makingChargePct,
      goldValuePaise,
      grossWeightMg: stock.grossMg,
      netWeightMg: stock.netMg,
      fineWeightMg: stock.fineMg,
    });
    return {
      makingChargesPaise: resolved.totalChargePaise,
      makingChargePct: stock.makingChargePct,
      basis: "percentage",
      ratePerUnitPaise: stock.makingChargePct,
    };
  }
  if (stock.makingChargePerGPaise) {
    const pct =
      goldValuePaise > 0
        ? ((stock.makingChargePerGPaise * (stock.grossMg / 1000)) / goldValuePaise) * 100
        : 0;
    const resolved = resolveMakingCharge({
      basis: "percentage",
      percent: pct,
      goldValuePaise,
      grossWeightMg: stock.grossMg,
      netWeightMg: stock.netMg,
      fineWeightMg: stock.fineMg,
    });
    return {
      makingChargesPaise: resolved.totalChargePaise,
      makingChargePct: pct,
      basis: "percentage",
      ratePerUnitPaise: pct,
    };
  }

  const override = makingChargeSettings.categoryOverrides[stock.category];
  const basis = override?.basis ?? makingChargeSettings.defaultBasis;
  const percent = override?.percent ?? makingChargeSettings.defaultPercent;
  const ratePerUnitPaise =
    override?.ratePerUnitPaise ?? makingChargeSettings.defaultRatePerUnitPaise;
  const resolved = resolveMakingCharge({
    basis,
    percent,
    ratePerUnitPaise,
    goldValuePaise,
    grossWeightMg: stock.grossMg,
    netWeightMg: stock.netMg,
    fineWeightMg: stock.fineMg,
    piecesCount: stock.piecesCount,
    caratsCount: stock.caratsCount,
  });
  return {
    makingChargesPaise: resolved.totalChargePaise,
    makingChargePct: basis === "percentage" ? percent : 0,
    basis,
    ratePerUnitPaise: resolved.resolvedRate,
  };
}

export function BillingModule({ orderId, stockId, jobId }: BillingModuleProps) {
  const deviceClass = useDeviceClass();
  const layout = layoutFromDevice(deviceClass);
  const hideKeyboardHints = isNativeApp() || deviceClass === "mobile";
  /** Dense Offline hisab table: desktop + tablet landscape only. */
  const useHisabTable = layout === "desktop" || deviceClass === "tablet-landscape";
  /** Large touch targets + stacked cards: phone + tablet portrait. */
  const touchCompact = layout === "mobile" || deviceClass === "tablet-portrait";
  const labelTouch = touchCompact ? "text-xs" : "text-[10px]";
  const navigate = useNavigate();
  const { t } = useLanguage();
  const billing = useBilling();
  const orders = useOrders((s) => s.orders);
  const stockItems = useStock((s) => s.items);
  const changeStockStatus = useStock((s) => s.changeStatus);
  const updateStock = useStock((s) => s.update);
  const updateOrder = useOrders((s) => s.update);
  const appendOrderTimeline = useOrders((s) => s.appendTimeline);
  const jobs = useJobCards((s) => s.jobs);
  const people = usePeople((s) => s.people);
  const currentGoldRatePaise = useCurrentGoldRatePaise();
  const appendLedger = useLedger((s) => s.append);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderId || null);

  const linkedOrder = useMemo(() => {
    return selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : undefined;
  }, [selectedOrderId, orders]);

  const linkedJob = useMemo(() => {
    return (
      (jobId && jobs.find((j) => j.id === jobId)) ||
      (linkedOrder && jobs.find((j) => j.orderId === linkedOrder.id)) ||
      undefined
    );
  }, [jobId, linkedOrder, jobs]);

  const linkedStock = useMemo(() => {
    return (
      (stockId && stockItems.find((s) => s.id === stockId)) ||
      (linkedJob && stockItems.find((s) => s.linkedJobId === linkedJob.id)) ||
      undefined
    );
  }, [stockId, linkedJob, stockItems]);

  // Billing Type state
  const [billingType, setBillingType, clearBillingType] = useDraft<BillingType>(
    "mtj-billing-billingType-v1",
    linkedOrder ? "manufacturing" : linkedStock ? "ready_stock" : "ready_stock",
  );

  // Customer
  const [customerId, setCustomerId, clearCustomerId] = useDraft<string>(
    "mtj-billing-customerId-v1",
    linkedOrder?.customerId ?? "",
  );
  const customer = people.find((p) => p.id === customerId);
  const customers = people.filter(isCustomerParty);

  const [haste, setHaste] = useState("");
  const [salesman, setSalesman] = useState("");
  const [voucherNarration, setVoucherNarration] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [roundOffRupees, setRoundOffRupees] = useState("");
  const [settlementKind, setSettlementKind] = useState<"cash" | "gold">("cash");
  const [urdLines, setUrdLines] = useState<InvoiceUrdLine[]>([]);

  // GST
  const [gst, setGst, clearGst] = useDraft<GstKind>(
    "mtj-billing-gst-v1",
    linkedOrder || linkedStock ? "gst3" : billing.gstDefault || "gst3",
  );

  // Items — prefill one from linked stock / order
  const [rawItems, setItems, clearItems] = useDraft<InvoiceItem[]>("mtj-billing-items-v1", () => {
    const first = buildPrefilledItem(linkedStock, linkedOrder);
    return [first];
  });

  const items = useMemo(() => {
    return Array.isArray(rawItems) ? rawItems : [];
  }, [rawItems]);

  const partyAccount = useMemo(
    () => (customerId ? compileCustomerLedger(customerId) : null),
    [customerId, billing.invoices, items],
  );

  // Hardware scanner, keyboard shortcuts, and weigh scale integration refs/states
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  const addItemRef = useRef(addItem);
  const addPaymentRowRef = useRef(addPaymentRow);
  const confirmRef = useRef(confirm);

  // Shared scale-subscription hook (also used by WeightInput.tsx) — one
  // implementation of scale device handling/connection lifecycle, this
  // table just adds its own focused-field auto-fill on top (below).
  const { reading: liveScaleReading, connected: scaleConnected } = useScaleReading();
  // Do not invent a synthetic "stable" zero reading — UI treats null as disconnected/idle.
  const scaleReading: ScaleReading | null = liveScaleReading;
  const [confirmedInvoice, setConfirmedInvoice] = useState<Invoice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedCustomerEmail, setConfirmedCustomerEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [focusedWeightField, setFocusedWeightField] = useState<{
    itemId: string;
    type: "gross" | "net";
  } | null>(null);

  const focusedWeightFieldRef = useRef(focusedWeightField);
  const itemsRef = useRef(items);
  const patchItemRef = useRef<((id: string, diff: Partial<InvoiceItem>) => void) | null>(null);

  useEffect(() => {
    focusedWeightFieldRef.current = focusedWeightField;
  }, [focusedWeightField]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // patchItemRef is updated after patchItem is declared (see below near patchItem definition)

  useEffect(() => {
    addItemRef.current = addItem;
    addPaymentRowRef.current = addPaymentRow;
    confirmRef.current = confirm;
  });

  useShortcutBinding("bill_f2_scan", () => {
    barcodeInputRef.current?.focus();
    barcodeInputRef.current?.select();
  });
  useShortcutBinding("bill_f4_customer", () => {
    customerInputRef.current?.focus();
    customerInputRef.current?.select();
  });
  useShortcutBinding("bill_f7_order", () => {
    orderInputRef.current?.focus();
    orderInputRef.current?.select();
  });
  useShortcutBinding("bill_f8_add_line", () => addItemRef.current());
  useShortcutBinding("bill_f9_payment", () => addPaymentRowRef.current());
  useShortcutBinding("bill_f10_save", () => confirmRef.current());
  useShortcutBinding("bill_save_enter", () => confirmRef.current(), { allowInInputs: true });

  // Auto-fill focused weight only from a STABLE scale reading — never silently
  // accept unstable weights as confirmed line weights (jewellery barcode HW spec).
  useEffect(() => {
    const target = focusedWeightFieldRef.current;
    if (
      target &&
      liveScaleReading &&
      liveScaleReading.isStable &&
      liveScaleReading.weightGrams > 0
    ) {
      const item = itemsRef.current.find((it) => it.id === target.itemId);
      if (item) {
        const updatedVal = gramsToMg(liveScaleReading.weightGrams.toFixed(3));
        if (target.type === "gross") {
          if (item.grossMg === updatedVal) return;
          patchItemRef.current?.(target.itemId, { grossMg: updatedVal });
        } else {
          if (item.netMg === updatedVal) return;
          patchItemRef.current?.(target.itemId, { netMg: updatedVal });
        }
      }
    }
  }, [liveScaleReading]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [readyStockPickerOpen, setReadyStockPickerOpen] = useState(false);
  const [activeInspectedStock, setActiveInspectedStock] = useState<(typeof stockItems)[0] | null>(
    null,
  );

  // New customer — full party form (same as People / desktop)
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // Scan state
  const [scanMessage, setScanMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Manufacturing Bill specific state
  const [mfgLBGoldMg, setMfgLBGoldMg, clearMfgLBGoldMg] = useDraft<number>(
    "mtj-billing-mfg-lb-v1",
    0,
  );
  const [mfgGoldBhavStr, setMfgGoldBhavStr, clearMfgGoldBhavStr] = useDraft<string>(
    "mtj-billing-mfg-bhav-v1",
    "",
  );
  const [rawMfgMpEntries, setMfgMpEntries, clearMfgMpEntries] = useDraft<MfgMpEntry[]>(
    "mtj-billing-mfg-mp-v1",
    [],
  );
  const mfgMpEntries: MfgMpEntry[] = Array.isArray(rawMfgMpEntries) ? rawMfgMpEntries : [];

  function addMfgMpEntry(type: MfgMpEntry["type"]) {
    setMfgMpEntries([
      ...mfgMpEntries,
      {
        id: newItemId(),
        type,
        label:
          type === "fine"
            ? "Metal Received — Fine"
            : type === "lagad"
              ? "Metal Received — Lagad (Alloy)"
              : "Metal Received — Scrap",
        grossMg: 0,
        purity: type === "fine" ? 100 : 0,
        pcs: 0,
        fineMg: 0,
      },
    ]);
  }
  function patchMfgMp(id: string, diff: Partial<MfgMpEntry>) {
    setMfgMpEntries(
      mfgMpEntries.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...diff };
        merged.fineMg = Math.round((merged.grossMg * merged.purity) / 100);
        return merged;
      }),
    );
  }
  function removeMfgMp(id: string) {
    setMfgMpEntries(mfgMpEntries.filter((e) => e.id !== id));
  }

  // Payments State
  const [paymentReceivedNow, setPaymentReceivedNow] = useDraft<boolean>(
    "mtj-billing-payment-received-now-v1",
    true,
  );
  const [rawPayments, setPayments, clearPayments] = useDraft<DraftPayment[]>(
    "mtj-billing-payments-v1",
    [
      {
        id: newItemId(),
        mode: "gold_exchange",
        amountStr: "",
        reference: "",
        notes: "",
        goldGramsStr: "",
        goldPurityStr: "916",
        goldRateStr: "",
      },
    ],
  );

  const payments = useMemo(() => {
    if (!paymentReceivedNow) return [];
    return Array.isArray(rawPayments) ? rawPayments : [];
  }, [rawPayments, paymentReceivedNow]);

  const goldPaymentSelected = payments.some(
    (payment) => payment.mode === "gold_exchange" || payment.mode === "customer_gold_credit",
  );

  // A gold-payment row follows the main rate until the operator explicitly
  // overrides it. This keeps a rate change in Settings immediately visible in
  // an open invoice without destroying a deliberate historical override.
  useEffect(() => {
    if (currentGoldRatePaise <= 0) return;
    const defaultRate = paiseToRupees(currentGoldRatePaise);
    setPayments((current) => {
      let changed = false;
      const next = current.map((payment) => {
        if (payment.mode !== "gold_exchange" && payment.mode !== "customer_gold_credit") {
          return payment;
        }
        const updated = { ...payment };
        if (!updated.goldPurityStr) {
          updated.goldPurityStr = "916";
          changed = true;
        }
        if (!updated.goldRateManuallyOverridden && updated.goldRateStr !== defaultRate) {
          updated.goldRateStr = defaultRate;
          changed = true;
        }
        if (!updated.goldRateManuallyOverridden && updated.goldGramsStr) {
          const grossMg = gramsToMg(updated.goldGramsStr);
          const purity = Math.round(Number(updated.goldPurityStr) || 0);
          const fineMg = purity > 0 ? fineGoldMgConfigured(grossMg, purity) : 0;
          const valuePaise = fineMg > 0 ? Math.round((fineMg * currentGoldRatePaise) / 1000) : 0;
          const nextAmount = valuePaise > 0 ? (valuePaise / 100).toString() : "";
          if (updated.amountStr !== nextAmount) {
            updated.amountStr = nextAmount;
            changed = true;
          }
        }
        return updated;
      });
      return changed ? next : current;
    });
  }, [currentGoldRatePaise]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)),
    );
  }, [customers, customerSearch]);

  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return [];
    const q = orderSearch.toLowerCase();
    return orders.filter((o) => {
      if (o.status === "billed" || o.status === "cancelled" || o.status === "delivered")
        return false;
      const cust = people.find((p) => p.id === o.customerId);
      return (
        o.orderNo.toLowerCase().includes(q) ||
        (o.item?.itemName ?? "").toLowerCase().includes(q) ||
        (cust && cust.fullName.toLowerCase().includes(q)) ||
        (cust && cust.phone.includes(q))
      );
    });
  }, [orderSearch, orders, people]);

  const filteredStock = useMemo(() => {
    if (!stockSearchQuery.trim()) return [];
    const q = stockSearchQuery.toLowerCase();
    return stockItems.filter(
      (s) =>
        s.status === "available" &&
        ((s.itemName ?? "").toLowerCase().includes(q) ||
          (s.itemCode ?? "").toLowerCase().includes(q) ||
          (s.barcode ?? "").toLowerCase().includes(q) ||
          (s.huid && s.huid.toLowerCase().includes(q))),
    );
  }, [stockItems, stockSearchQuery]);

  const [activeCustomerIdx, setActiveCustomerIdx] = useState<number>(-1);
  const [activeOrderIdx, setActiveOrderIdx] = useState<number>(-1);
  const [activeStockIdx, setActiveStockIdx] = useState<number>(-1);

  useEffect(() => {
    setActiveCustomerIdx(-1);
  }, [customerSearch]);

  useEffect(() => {
    setActiveOrderIdx(-1);
  }, [orderSearch]);

  useEffect(() => {
    setActiveStockIdx(-1);
  }, [stockSearchQuery]);

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCustomers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCustomerIdx((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCustomerIdx((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeCustomerIdx >= 0 ? activeCustomerIdx : 0;
      if (idx < filteredCustomers.length) {
        const selected = filteredCustomers[idx];
        setCustomerId(selected.id);
        setCustomerSearch("");
        setActiveCustomerIdx(-1);
      }
    } else if (e.key === "Escape") {
      setCustomerSearch("");
      setActiveCustomerIdx(-1);
    }
  };

  const handleOrderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredOrders.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveOrderIdx((prev) => (prev < filteredOrders.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveOrderIdx((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeOrderIdx >= 0 ? activeOrderIdx : 0;
      if (idx < filteredOrders.length) {
        const selected = filteredOrders[idx];
        setSelectedOrderId(selected.id);
        if (selected.customerId) {
          setCustomerId(selected.customerId);
        }
        const loadedItem = buildPrefilledItem(undefined, selected);
        setItems([loadedItem]);
        setOrderSearch("");
        setActiveOrderIdx(-1);
        setScanMessage({
          text: `Matched order details loaded! Order No: ${selected.orderNo}`,
          type: "success",
        });
      }
    } else if (e.key === "Escape") {
      setOrderSearch("");
      setActiveOrderIdx(-1);
    }
  };

  const handleStockKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = filteredStock.slice(0, 50);
    if (list.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveStockIdx((prev) => (prev < list.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveStockIdx((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeStockIdx >= 0 ? activeStockIdx : 0;
      if (idx < list.length) {
        const selected = list[idx];
        setActiveInspectedStock(selected);
        setStockSearchQuery("");
        setActiveStockIdx(-1);
      }
    } else if (e.key === "Escape") {
      setStockSearchQuery("");
      setActiveStockIdx(-1);
    }
  };

  // Order adjustment shown (do not double-count) - fully reactive useMemo
  const firstItemGoldRate = items[0]?.goldRatePerGramPaise;
  const adjustmentLive: OrderAdjustment | undefined = useMemo(() => {
    if (!linkedOrder) return undefined;
    const adv = linkedOrder.advance;
    if (adv.cashPaise === 0 && adv.goldGrossMg === 0) return undefined;
    // Value old gold at the first item's gold rate if available, else use rate provided per gram on order, else 0.
    const ratePaise =
      firstItemGoldRate ??
      (adv.goldRatePerGram ? Math.round(adv.goldRatePerGram * 100) : 0) ??
      getCurrentGoldRatePaise() ??
      0;
    const goldValue = adv.goldGrossMg > 0 ? Math.round((adv.goldFineMg * ratePaise) / 1000) : 0;
    return {
      cashAdvancePaise: adv.cashPaise,
      cashAdvanceRef: adv.cashRef,
      goldGrossMg: adv.goldGrossMg,
      goldPurity: adv.goldPurity ?? 0,
      goldFineMg: adv.goldFineMg,
      goldRatePerGramPaise: ratePaise,
      goldValuePaise: goldValue,
      goldKind: adv.goldKind,
    };
  }, [linkedOrder, firstItemGoldRate]);

  const customerOutstandingPaise = useMemo(() => {
    if (!customerId || !billing || !billing.invoices) return 0;
    try {
      if (typeof customerLedger === "function") {
        return customerLedger(customerId, billing.invoices).outstanding;
      } else {
        // Safe local fallback computation of outstanding balance
        const customerInvoices = billing.invoices.filter((i) => i.customerId === customerId);
        let totalDebit = 0;
        let totalCredit = 0;
        for (const inv of customerInvoices) {
          totalDebit += inv.grandTotalPaise || 0;
          totalCredit += inv.paidPaise || 0;
        }
        return Math.max(0, totalDebit - totalCredit);
      }
    } catch (e) {
      console.error("Error calculating customer ledger outstanding paise:", e);
      return 0;
    }
  }, [customerId, billing]);

  // Customer gold balance from settlement records:
  // Jama (received from customer) is credit; Naam (given to customer) is debit.
  const settlements = useGoldSettlement((s) => s.settlements);
  const customerGoldBalanceMg = useMemo(() => {
    if (!customerId) return 0;
    return settlements
      .filter((s) => s.party_type === "customer" && s.party_id === customerId)
      .reduce((bal, s) => {
        if (s.direction === "Jama") return bal + s.net_mg;
        if (s.direction === "Naam") return bal - s.net_mg;
        // Fallback: received types add, given types subtract
        if (s.settlement_type === "gold_received") return bal + s.net_mg;
        if (s.settlement_type === "gold_given") return bal - s.net_mg;
        return bal;
      }, 0);
  }, [customerId, settlements]);

  const jewellerBook = useMemo(() => {
    if (!customerId) return null;
    return compileJewellerBook(customerId);
  }, [customerId, billing, settlements, orders]);

  const customerOpenOrders = useMemo(() => {
    if (!customerId) return [];
    return orders.filter(
      (o) => o.customerId === customerId && o.status !== "billed" && o.status !== "cancelled",
    );
  }, [customerId, orders]);

  const pendingCashAdvanceRupees = useMemo(() => {
    const paise = customerOpenOrders.reduce((sum, o) => sum + (o.advance?.cashPaise ?? 0), 0);
    return paise / 100;
  }, [customerOpenOrders]);

  const pendingGoldAdvanceGrams = useMemo(() => {
    const mg = customerOpenOrders.reduce((sum, o) => sum + (o.advance?.goldGrossMg ?? 0), 0);
    return mg / 1000;
  }, [customerOpenOrders]);

  const totals = useMemo(() => {
    const paymentRecords: PaymentRecord[] = payments
      .filter((p) => p.mode === "outstanding" || rupeesToPaise(p.amountStr) > 0)
      .map((p) => ({
        id: p.id,
        ts: Date.now(),
        mode: p.mode,
        amountPaise: rupeesToPaise(p.amountStr),
        reference: p.reference || undefined,
        notes: p.notes || undefined,
      }));
    return computeInvoiceTotals(items, gst, adjustmentLive, paymentRecords, urdLines);
  }, [items, gst, adjustmentLive, payments, urdLines]);

  const goldSettlementRatePaise = useMemo(() => {
    const selectedGoldPayment = payments.find(
      (payment) =>
        (payment.mode === "gold_exchange" || payment.mode === "customer_gold_credit") &&
        rupeesToPaise(payment.goldRateStr) > 0,
    );
    return selectedGoldPayment
      ? rupeesToPaise(selectedGoldPayment.goldRateStr)
      : currentGoldRatePaise;
  }, [payments, currentGoldRatePaise]);

  const goldTotals = useMemo(() => {
    const paymentRecords: PaymentRecord[] = payments
      .filter((payment) => payment.mode === "outstanding" || rupeesToPaise(payment.amountStr) > 0)
      .map((payment) => ({
        id: payment.id,
        ts: 0,
        mode: payment.mode,
        amountPaise: rupeesToPaise(payment.amountStr),
        goldFineMg:
          payment.mode === "gold_exchange" || payment.mode === "customer_gold_credit"
            ? fineGoldMgConfigured(
                gramsToMg(payment.goldGramsStr),
                Math.round(Number(payment.goldPurityStr) || 0),
              )
            : undefined,
      }));
    return computeInvoiceGoldTotals(items, totals, paymentRecords, goldSettlementRatePaise);
  }, [items, totals, payments, goldSettlementRatePaise]);

  // Synchronize state with useBillingStore
  useEffect(() => {
    const outstandingAmountPaise = customerOutstandingPaise;
    const customerInvoices = billing?.invoices?.filter((i) => i.customerId === customerId) || [];
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;
    for (const inv of customerInvoices) {
      totalDebitPaise += inv.grandTotalPaise || 0;
      totalCreditPaise += inv.paidPaise || 0;
    }

    const customerLedgerData = {
      outstandingAmountPaise,
      totalDebitPaise,
      totalCreditPaise,
      advancePaise: Math.round(pendingCashAdvanceRupees * 100),
      closingBalancePaise: Math.max(0, totalDebitPaise - totalCreditPaise),
    };

    const goldLedgerData = {
      totalGrossMg: items.reduce((acc, it) => acc + (it.grossMg || 0), 0),
      totalFineMg: items.reduce((acc, it) => acc + (it.fineMg || 0), 0),
      depositMg: Math.round(pendingGoldAdvanceGrams * 1000),
      advanceMg: 0,
      exchangeMg: 0,
      closingGoldMg: Math.max(
        0,
        items.reduce((acc, it) => acc + (it.grossMg || 0), 0) -
          Math.round(pendingGoldAdvanceGrams * 1000),
      ),
    };

    useBillingStore.setState({
      customerId: customerId || null,
      selectedOrderId: orderId || null,
      selectedStockId: stockId || null,
      selectedJobId: jobId || null,
      billingType: billingType || null,
      gst: gst || null,
      items: items || null,
      payments: rawPayments || null,
      customerSearch: customerSearch || null,
      orderSearch: orderSearch || null,
      stockSearchQuery: stockSearchQuery || null,
      customerLedger: customerLedgerData,
      goldLedger: goldLedgerData,
    });
  }, [
    customerId,
    orderId,
    stockId,
    jobId,
    billingType,
    gst,
    items,
    rawPayments,
    customerSearch,
    orderSearch,
    stockSearchQuery,
    customerOutstandingPaise,
    pendingCashAdvanceRupees,
    pendingGoldAdvanceGrams,
    billing?.invoices,
  ]);

  const patchItem = useCallback(
    (id: string, diff: Partial<InvoiceItem>) => {
      setItems((curr) => {
        let changed = false;
        const nextItems = curr.map((it) => {
          if (it.id !== id) return it;
          const unchanged = (Object.keys(diff) as (keyof InvoiceItem)[]).every(
            (key) => it[key] === diff[key],
          );
          if (unchanged) return it;
          changed = true;
          const rawMerged: InvoiceItem = { ...it, ...diff, chargeMode: chargeModeForBillingType(billingType) };
          // Gross and Less are completely separate, independent fields.
          // Invariant: Net = Gross + Add − Less
          if (!("netMg" in diff) || ("grossMg" in diff || "lessMg" in diff || "addMg" in diff)) {
            const gr = Math.max(0, rawMerged.grossMg ?? 0);
            const ls = Math.max(0, rawMerged.lessMg ?? 0);
            const ad = Math.max(0, rawMerged.addMg ?? rawMerged.stoneWeightMg ?? 0);
            rawMerged.lessMg = ls;
            rawMerged.netMg = Math.max(0, gr + ad - ls);
          } else if ("netMg" in diff && !("lessMg" in diff)) {
            // User explicitly edited Net weight, back-calculate Less
            const gr = Math.max(0, rawMerged.grossMg ?? 0);
            const ad = Math.max(0, rawMerged.addMg ?? rawMerged.stoneWeightMg ?? 0);
            rawMerged.lessMg = Math.max(0, gr + ad - rawMerged.netMg);
          }
          const goldTouched =
            "grossMg" in diff ||
            "netMg" in diff ||
            "lessMg" in diff ||
            "addMg" in diff ||
            "fineMg" in diff ||
            "purity" in diff ||
            "wastagePct" in diff ||
            "hisobPct" in diff ||
            "stoneWeightMg" in diff ||
            "goldRatePerGramPaise" in diff;
          const next = goldTouched ? applyInvoiceLineGold(rawMerged, billingType) : rawMerged;
          return { ...next, ...computeItemTotals(next) };
        });
        return changed ? nextItems : curr;
      });
    },
    [setItems, billingType],
  );
  // Keep ref current so the scale-reading effect can call patchItem without stale closure
  patchItemRef.current = patchItem;

  function addItem() {
    const defaultGoldRate = getCurrentGoldRatePaise() || 0;
    const isService =
      billingType === "repair" ||
      billingType === "polishing" ||
      billingType === "advance_receipt" ||
      billingType === "payment_receipt";

    const blank: InvoiceItem = {
      id: newItemId(),
      itemName: isService ? "Service job" : "",
      category: isService ? "Service" : "Other",
      purity: isService ? 0 : 916,
      grossMg: 0,
      netMg: 0,
      fineMg: 0,
      goldRatePerGramPaise: defaultGoldRate,
      goldValuePaise: 0,
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: 0,
      chargeMode: chargeModeForBillingType(billingType),
      lessMg: 0,
      wastagePct: 0,
      pcs: 1,
    };
    setItems([...items, blank]);
    // Auto-focus the new item's name field after render
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>("[data-item-name-input]");
      const last = inputs[inputs.length - 1];
      last?.focus();
      last?.select();
    }, 60);
  }

  function removeItem(id: string) {
    if (items.length <= 1) {
      toast.error("At least one line item is required.");
      return;
    }
    setItems(items.filter((it) => it.id !== id));
  }

  // Ready stock selection helper
  function handleSelectStockItem(stock: (typeof stockItems)[0]) {
    try {
      assertReadyStockSellable(stock);
    } catch (err) {
      setScanMessage({
        text: err instanceof Error ? err.message : "Stock item incomplete",
        type: "error",
      });
      toast.error(err instanceof Error ? err.message : "Stock item incomplete");
      return;
    }
    const alreadyInBill = items.some((it) => it.stockItemId === stock.id);
    if (alreadyInBill) {
      setScanMessage({
        text: "हा दागिना आधीच जोडलेला आहे / Already added to invoice",
        type: "error",
      });
      return;
    }

    const goldValuePaise = Math.round((stock.fineMg * (getCurrentGoldRatePaise() || 0)) / 1000);
    const resolved = computeStockMakingCharge(
      stock,
      goldValuePaise,
      useSettings.getState().makingCharge,
    );

    const invoiceItem: InvoiceItem = {
      id: newItemId(),
      stockItemId: stock.id,
      barcode: stock.barcode,
      itemName: stock.itemName,
      category: stock.category,
      purity: stock.purity,
      grossMg: stock.grossMg,
      netMg: stock.netMg,
      fineMg: stock.fineMg,
      goldRatePerGramPaise: getCurrentGoldRatePaise() || 0,
      goldValuePaise,
      makingChargesPaise: resolved.makingChargesPaise,
      makingChargePct: resolved.makingChargePct,
      makingChargeBasis: resolved.basis,
      makingChargeRatePerUnitPaise: resolved.ratePerUnitPaise,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: 0,
      huid: stock.huid || undefined,
      chargeMode: chargeModeForBillingType(billingType),
    };
    const tot = computeItemTotals(invoiceItem);
    invoiceItem.goldValuePaise = tot.goldValuePaise;
    invoiceItem.lineTotalPaise = tot.lineTotalPaise;

    setItems([...items, invoiceItem]);
    setScanMessage({
      text: `दागिना जोडला! / Added: ${stock.itemName} (${mgToGrams(stock.grossMg)}g)`,
      type: "success",
    });
  }

  // Handle barcode scanning submit
  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const barcode = stockSearchQuery.trim();
    if (!barcode) return;

    const matched = stockItems.find(
      (s) => s.barcode === barcode || s.itemCode === barcode || (s.huid && s.huid === barcode),
    );

    if (matched) {
      if (matched.status !== "available") {
        setScanMessage({
          text: `दागिना उपलब्ध नाही / Tag ${barcode} status is ${matched.status}`,
          type: "error",
        });
        return;
      }
      handleSelectStockItem(matched);
      setStockSearchQuery("");
    } else {
      setScanMessage({
        text: `दागिना सापडला नाही / Tag ${barcode} not found in inventory`,
        type: "error",
      });
    }
  }

  // Payment Rows Helpers
  function addPaymentRow() {
    setPayments([
      ...payments,
      {
        id: newItemId(),
        mode: "gold_exchange",
        amountStr: "",
        reference: "",
        notes: "",
        goldGramsStr: "",
        goldPurityStr: "916",
        goldRateStr: "",
        goldMeltLossWtDeductionStr: "",
        goldMeltLossPctDeductionStr: "",
      },
    ]);
  }

  function patchPayment(idx: number, diff: Partial<DraftPayment>) {
    setPayments((curr) =>
      curr.map((p, i) => {
        if (i !== idx) return p;
        return { ...p, ...diff };
      }),
    );
  }

  function changePaymentMode(idx: number, mode: PaymentMode) {
    const payment = payments[idx];
    if (!payment) return;
    const isGold = mode === "gold_exchange" || mode === "customer_gold_credit";
    patchPayment(idx, {
      mode,
      ...(isGold
        ? {
            goldPurityStr: payment.goldPurityStr || "916",
            goldRateStr: payment.goldRateStr || paiseToRupees(currentGoldRatePaise),
            goldRateManuallyOverridden: payment.goldRateManuallyOverridden ?? false,
          }
        : {}),
    });
    if (isGold && payment.goldGramsStr) {
      autoFillFromGold(idx, {
        goldPurityStr: payment.goldPurityStr || "916",
        goldRateStr: payment.goldRateStr || paiseToRupees(currentGoldRatePaise),
      });
    }
  }

  function removePaymentRow(idx: number) {
    if (payments.length <= 1) return;
    setPayments(payments.filter((_, i) => i !== idx));
  }

  function autoFillRemaining(idx: number) {
    const outstandingPaymentSum = payments
      .filter((p, i) => i !== idx && p.mode !== "outstanding")
      .reduce((s, p) => s + rupeesToPaise(p.amountStr), 0);
    const balance = Math.max(0, totals.grandTotalPaise - outstandingPaymentSum);
    patchPayment(idx, { amountStr: (balance / 100).toString() });
  }

  function autoFillFromGold(
    idx: number,
    overrides?: {
      goldGramsStr?: string;
      goldPurityStr?: string;
      goldRateStr?: string;
      goldMeltLossWtDeductionStr?: string;
      goldMeltLossPctDeductionStr?: string;
    },
  ) {
    const p = payments[idx];
    if (!p) return;
    try {
      const gramsStr = overrides?.goldGramsStr ?? p.goldGramsStr;
      const purityStr = overrides?.goldPurityStr ?? p.goldPurityStr;
      const rateStr = overrides?.goldRateStr ?? p.goldRateStr;
      const wtDedStr = overrides?.goldMeltLossWtDeductionStr ?? p.goldMeltLossWtDeductionStr ?? "";
      const pctDedStr =
        overrides?.goldMeltLossPctDeductionStr ?? p.goldMeltLossPctDeductionStr ?? "";

      const grossG = parseFloat(gramsStr) || 0;
      const wtDed = parseFloat(wtDedStr) || 0;
      const pctDed = parseFloat(pctDedStr) || 0;
      const netG = Math.max(0, grossG - wtDed - (grossG * pctDed) / 100);

      const netMg = Math.round(netG * 1000);
      const purity = Math.round(Number(purityStr));
      const fine = fineGoldMgConfigured(netMg, purity);
      const ratePaise = rupeesToPaise(rateStr) || currentGoldRatePaise;
      const valuePaise = Math.round((fine * ratePaise) / 1000);
      if (valuePaise > 0) patchPayment(idx, { amountStr: (valuePaise / 100).toString() });
    } catch {
      /* ignore */
    }
  }

  function selectPaymentPreset(preset: "gold" | "cash" | "mixed") {
    const ratePaise =
      currentGoldRatePaise > 0 ? currentGoldRatePaise : (items[0]?.goldRatePerGramPaise || 700000);
    const rateRupees = paiseToRupees(ratePaise);
    const requiredFineMg =
      goldTotals?.grandTotalMg ||
      (totals.grandTotalPaise > 0 ? Math.round((totals.grandTotalPaise * 1000) / ratePaise) : 0);
    const grandTotalRupees = (totals.grandTotalPaise / 100).toString();

    if (preset === "gold") {
      // Pure Gold receipt: at 916 purity (standard retail exchange), gross = fine / 0.916
      const grossG = requiredFineMg > 0 ? (requiredFineMg / 1000 / 0.916).toFixed(3) : "0.000";
      setPayments([
        {
          id: newItemId(),
          mode: "gold_exchange",
          amountStr: grandTotalRupees,
          reference: "RECEIVED IN GOLD",
          notes: "Full payment received in physical gold",
          goldGramsStr: grossG,
          goldPurityStr: "916",
          goldRateStr: rateRupees,
          goldMeltLossWtDeductionStr: "",
          goldMeltLossPctDeductionStr: "",
        },
      ]);
      toast.success("Settlement mode: [GOLD] (Full Gold Receipt)");
    } else if (preset === "cash") {
      // Pure Cash payment
      setPayments([
        {
          id: newItemId(),
          mode: "cash",
          amountStr: grandTotalRupees,
          reference: "CASH PAYMENT",
          notes: "Full payment received in cash",
          goldGramsStr: "",
          goldPurityStr: "",
          goldRateStr: "",
          goldMeltLossWtDeductionStr: "",
          goldMeltLossPctDeductionStr: "",
        },
      ]);
      toast.success("Settlement mode: [CASH] (Full Cash Payment)");
    } else if (preset === "mixed") {
      // Mixed Gold + Cash payment
      const targetGoldFineMg = Math.round(requiredFineMg * 0.5);
      const grossG = targetGoldFineMg > 0 ? (targetGoldFineMg / 1000 / 0.916).toFixed(3) : "10.000";
      const goldFineMg = fineGoldMgConfigured(gramsToMg(grossG), 916);
      const goldValPaise = Math.round((goldFineMg * ratePaise) / 1000);
      const remainingCashPaise = Math.max(0, totals.grandTotalPaise - goldValPaise);
      const cashStr = (remainingCashPaise / 100).toString();

      setPayments([
        {
          id: newItemId(),
          mode: "gold_exchange",
          amountStr: (goldValPaise / 100).toString(),
          reference: "Gold Receipt (Part 1)",
          notes: "Physical gold received",
          goldGramsStr: grossG,
          goldPurityStr: "916",
          goldRateStr: rateRupees,
          goldMeltLossWtDeductionStr: "",
          goldMeltLossPctDeductionStr: "",
        },
        {
          id: newItemId(),
          mode: "cash",
          amountStr: cashStr,
          reference: "Cash Payment (Part 2)",
          notes: "Remainder settled in cash",
          goldGramsStr: "",
          goldPurityStr: "",
          goldRateStr: "",
          goldMeltLossWtDeductionStr: "",
          goldMeltLossPctDeductionStr: "",
        },
      ]);
      toast.success("Settlement mode: [MIXED] (Gold + Cash Settlement)");
    }
  }

  async function confirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      await confirmInternal();
    } finally {
      setConfirming(false);
    }
  }

  async function confirmInternal() {
    if (!customerId || !customer) {
      toast.error("Select a customer.");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one line item.");
      return;
    }

    // Same rule the store enforces at save time (billing-store.ts's
    // assertInvoiceItemsValid) — checked here too so the error surfaces
    // immediately instead of after a round-trip to add()/update().
    for (const it of items) {
      const error = invoiceItemValidationError(it, billingType);
      if (error) {
        toast.error(`"${it.itemName || "Item"}" ${error}.`);
        return;
      }
    }

    if (billingType === "ready_stock") {
      if (items.some((it) => !it.stockItemId)) {
        toast.error(
          "Ready Stock billing requires selecting tagged inventory items (Select from Ready Stock). Manual lines are not allowed.",
        );
        return;
      }
      for (const it of items) {
        const stock = stockItems.find((s) => s.id === it.stockItemId);
        if (!stock) {
          toast.error(`Stock item missing for "${it.itemName || "line"}".`);
          return;
        }
        try {
          assertReadyStockSellable(stock);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Ready stock incomplete");
          return;
        }
      }
    }

    const realPayments: PaymentRecord[] = payments
      .filter((p) => p.mode === "outstanding" || rupeesToPaise(p.amountStr) > 0)
      .map((p) => {
        const base: PaymentRecord = {
          id: p.id,
          ts: Date.now(),
          mode: p.mode,
          amountPaise: rupeesToPaise(p.amountStr),
          reference: p.reference || undefined,
          notes: p.notes || undefined,
        };
        if ((p.mode === "gold_exchange" || p.mode === "customer_gold_credit") && p.goldGramsStr) {
          try {
            const grossG = parseFloat(p.goldGramsStr) || 0;
            const wtDed = parseFloat(p.goldMeltLossWtDeductionStr || "") || 0;
            const pctDed = parseFloat(p.goldMeltLossPctDeductionStr || "") || 0;
            const netG = Math.max(0, grossG - wtDed - (grossG * pctDed) / 100);

            const netMg = Math.round(netG * 1000);
            const purity = Math.round(Number(p.goldPurityStr));
            const fine = fineGoldMgConfigured(netMg, purity);
            const ratePaise = rupeesToPaise(p.goldRateStr) || currentGoldRatePaise;
            base.goldGrossMg = gramsToMg(p.goldGramsStr);
            base.goldPurity = purity;
            base.goldFineMg = fine;
            base.goldRatePerGramPaise = ratePaise;
            base.goldMeltLossWtDeductionStr = p.goldMeltLossWtDeductionStr || undefined;
            base.goldMeltLossPctDeductionStr = p.goldMeltLossPctDeductionStr || undefined;
          } catch {
            /* ignore */
          }
        }
        return base;
      });

    // Check payment mode & reference validation
    for (const p of realPayments) {
      if (!p.mode) {
        toast.error("Payment mode is required for all recorded payments.");
        return;
      }
      if ((p.mode === "upi" || p.mode === "bank") && !p.reference?.trim()) {
        toast.error(
          `Reference number / transaction ID is required for ${PAYMENT_MODE_LABELS[p.mode]} payment.`,
        );
        return;
      }
    }

    const computed = computeInvoiceTotals(items, gst, adjustmentLive, realPayments, urdLines);
    // Every gold-moving ledger entry this invoice posts (beyond the primary
    // sale entry, tracked separately as saleLedgerEntryId) is collected here
    // so cancelInvoice() can reverse ALL of them, not just the sale.
    const additionalLedgerIds: string[] = [];

    if (computed.grandTotalPaise <= 0) {
      toast.error("Billing amount total must be positive.");
      return;
    }

    const exceedsGrandTotal = computed.paidPaise > computed.grandTotalPaise;
    const isAdvanceOrRcpt = billingType === "advance_receipt" || billingType === "payment_receipt";

    const { isOnline } = await import("@/lib/native/network");
    if (!isOnline()) {
      const { captureInvoiceCreate } = await import("@/lib/offline");
      const queued = await captureInvoiceCreate({
        billingType,
        customerId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerGstin: customer.gstin,
        customerEmail: customer.email,
        items,
        gst,
        orderAdjustment: adjustmentLive,
        payments: realPayments,
        orderId: linkedOrder?.id,
        orderNo: linkedOrder?.orderNo,
        jobId: linkedJob?.id,
        jobNo: linkedJob?.jobNo,
        branchId: useSettings.getState().selectedBranchId || "MAIN",
        cgstPaise: computed.cgstPaise,
        sgstPaise: computed.sgstPaise,
        gstPaise: computed.gstPaise,
        tcsPaise: computed.tcsPaise,
        gstGoldEquivalentMg: computed.gstGoldEquivalentMg,
        subtotalPaise: computed.subtotalPaise,
        adjustmentPaise: computed.adjustmentPaise,
        grandTotalPaise: computed.grandTotalPaise,
        paidPaise: computed.paidPaise,
        balancePaise: computed.balancePaise,
        overpaymentAuthorized: exceedsGrandTotal && !isAdvanceOrRcpt,
      });
      if (queued.mode === "queued") {
        toast.message("Invoice saved offline — Pending Sync. Gold posts when you reconnect.");
        const staged = useBilling.getState().invoices.find((row) => row.id === queued.operation.localId);
        const savedEmail = customer?.email ?? "";
        clearBillingType();
        clearCustomerId();
        clearGst();
        clearItems();
        clearPayments();
        setConfirmedCustomerEmail(savedEmail);
        if (staged) setConfirmedInvoice(staged);
        return;
      }
    }

    if (exceedsGrandTotal && !isAdvanceOrRcpt) {
      const overrideReason = prompt(
        "Warning: Recorded payments exceed the invoice grand total.\nEnter owner override passcode or reason to proceed:",
      );
      if (!overrideReason) {
        toast.error(
          "Payment cannot exceed invoice grand total without owner override authorization.",
        );
        return;
      }
      appendLedger({
        type: "gold_overdraft_issue",
        netFineMg: 0,
        deltas: {},
        fineMg: 0,
        reference: `INV-OVERPAY`,
        notes: `Overpayment authorized. Reason: ${overrideReason}. Invoice Total: ₹${computed.grandTotalPaise / 100}, Paid: ₹${computed.paidPaise / 100}`,
      });
    }

    // Sale / job-work gold_ledger is posted once inside billing.add() via
    // postInvoiceGoldLedgerForSale. Do not append here or the same invoice
    // writes two vault rows.

    const typeLabel = BILLING_TYPES.find((t) => t.id === billingType)?.label || "Invoice";
    const invNotes = [voucherNarration.trim(), `[Type: ${typeLabel}]`].filter(Boolean).join(" ");

    const allocatedInvoiceNo = await getNextSequenceNumber("invoice");

    // Check if the bill is settled in GOLD (Pay-In-Gold or Gold Credit)
    const goldPayment = realPayments.find(
      (p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit",
    );
    const isGoldExchange = !!goldPayment;

    const goldRatePaise = getCurrentGoldRatePaise() || 1;
    const goldRequiredGrams = isGoldExchange ? computed.grandTotalPaise / goldRatePaise : 0;
    const goldReceivedGrams = isGoldExchange ? (goldPayment.goldGrossMg ?? 0) / 1000 : 0;
    const goldShortfallGrams = Math.max(0, goldRequiredGrams - goldReceivedGrams);
    // Excess gold handed over beyond what the invoice required — previously
    // discarded entirely by the Math.max(0, ...) above, meaning a customer
    // who paid MORE gold than owed had that surplus silently vanish instead
    // of being recorded as their credit/advance with the shop.
    const goldSurplusGrams = Math.max(0, goldReceivedGrams - goldRequiredGrams);

    const goldShortfallFineMg =
      isGoldExchange && goldShortfallGrams > 0
        ? fineGoldMgConfigured(
            Math.round(goldShortfallGrams * 1000),
            Math.round(goldPayment.goldPurity ?? 916) as number,
          )
        : 0;
    const goldSurplusFineMg =
      isGoldExchange && goldSurplusGrams > 0
        ? fineGoldMgConfigured(
            Math.round(goldSurplusGrams * 1000),
            Math.round(goldPayment.goldPurity ?? 916) as number,
          )
        : 0;

    const isPhysicalGoldExchange = goldPayment?.mode === "gold_exchange";
    const isGoldCreditUsage = goldPayment?.mode === "customer_gold_credit";

    if (isPhysicalGoldExchange && goldShortfallFineMg > 0) {
      const shortfallEntry = await appendLedger({
        type: "gold_overdraft_issue",
        netFineMg: -goldShortfallFineMg,
        deltas: {
          customer: -goldShortfallFineMg,
        },
        notes: `Pay-In-Gold settlement shortfall receivable for Invoice ${allocatedInvoiceNo}`,
        reference: allocatedInvoiceNo,
        customerId,
      });
      additionalLedgerIds.push(shortfallEntry.id);

      try {
        await useGoldSettlement.getState().addSettlement({
          party_type: "customer",
          party_id: customerId,
          branch_id: useSettings.getState().selectedBranchId || "MAIN",
          // "gold_shortfall_receivable", NOT "gold_received" — this gold has
          // NOT actually been received; recording it as gold_received would
          // make the customer ledger show it as the customer's credit/
          // advance with us instead of gold they still owe us, exactly
          // backwards from reality.
          settlement_type: "gold_shortfall_receivable",
          purity: goldPayment.goldPurity ?? 916,
          gross_mg: Math.round(goldShortfallGrams * 1000),
          net_mg: Math.round(goldShortfallGrams * 1000),
          wastage_mg: 0,
          rate_per_gram_paise: getCurrentGoldRatePaise() || 0,
          amount_paise: 0,
          notes: `Gold payment shortfall receivable from Invoice ${allocatedInvoiceNo}`,
          payment_mode: "gold_exchange",
        });
      } catch (err) {
        console.error("Failed writing customer gold settlement record:", err);
      }

      // Event-driven communication automation (Plan 1 Step 9) — "please
      // clear the payment" reminder, no-op unless the automation rule is
      // enabled. The daily reminder-sweep in reminder-sweeps.ts also picks
      // this customer up every day (escalating) for as long as the
      // shortfall remains unresolved.
      import("@/lib/comm/comm-automation")
        .then(({ emitBusinessEvent }) =>
          emitBusinessEvent("gold_settlement_reminder", {
            branchId: useSettings.getState().selectedBranchId || "MAIN",
            recipient: {
              name: customer.fullName,
              phone: customer.phone,
              email: (customer as any)?.email,
            },
            linkedId: customerId,
            linkedType: "invoice",
            variables: {
              shortfallGrams: goldShortfallGrams.toFixed(3),
              invoiceNo: allocatedInvoiceNo,
            },
          }),
        )
        .catch((err) => console.error("[Billing] gold shortfall reminder automation failed:", err));

      void import("@/lib/notifications/erp-events").then(({ notifyStaffPaymentDue }) =>
        notifyStaffPaymentDue({
          customerId,
          customerName: customer.fullName,
          invoiceNo: allocatedInvoiceNo,
        }),
      );
    }

    if (isPhysicalGoldExchange && goldSurplusFineMg > 0) {
      // Surplus physical gold is already posted as customer_gold_received when
      // billing.add() saves the gold_exchange payment — settlement row only.
      try {
        await useGoldSettlement.getState().addSettlement({
          party_type: "customer",
          party_id: customerId,
          branch_id: useSettings.getState().selectedBranchId || "MAIN",
          settlement_type: "gold_received",
          purity: goldPayment.goldPurity ?? 916,
          gross_mg: Math.round(goldSurplusGrams * 1000),
          net_mg: Math.round(goldSurplusGrams * 1000),
          wastage_mg: 0,
          rate_per_gram_paise: getCurrentGoldRatePaise() || 0,
          amount_paise: 0,
          notes: `Excess gold received against Invoice ${allocatedInvoiceNo} — recorded as customer credit`,
          payment_mode: "gold_exchange",
        });
      } catch (err) {
        console.error("Failed writing customer gold surplus settlement record:", err);
      }
    }

    if (isGoldCreditUsage && (goldPayment.goldFineMg ?? 0) > 0) {
      // Gold ledger post for credit usage happens in billing.add() payment loop.
      try {
        await useGoldSettlement.getState().addSettlement({
          party_type: "customer",
          party_id: customerId,
          branch_id: useSettings.getState().selectedBranchId || "MAIN",
          settlement_type: "gold_given",
          purity: goldPayment.goldPurity ?? 916,
          gross_mg: goldPayment.goldGrossMg ?? 0,
          net_mg: goldPayment.goldFineMg ?? 0,
          wastage_mg: 0,
          rate_per_gram_paise: getCurrentGoldRatePaise() || 0,
          amount_paise: 0,
          notes: `Gold Advance applied against Invoice ${allocatedInvoiceNo}`,
          payment_mode: "customer_gold_credit",
          direction: "Naam",
        });
      } catch (err) {
        console.error("Failed writing customer gold-advance usage settlement record:", err);
      }
    }

    // Gold payments already carry their fine-gold value as amountPaise (see
    // autoFillFromGold), so computed.balancePaise already reflects exactly
    // what a partial gold payment leaves outstanding — it must never be
    // force-zeroed just because a gold payment row exists, or a customer
    // who only partially covers the bill from their Gold Advance would show
    // as fully paid with the shortfall silently dropped.
    const finalBalancePaise = computed.balancePaise;
    const finalPaidPaise = computed.paidPaise;

    // Clean payment records: Only actual payments recorded.
    // When unpaid or partially paid, the invoice balance is tracked directly via balancePaise without fake payment rows.
    const finalRealPayments = realPayments.filter((p) => p.mode !== "outstanding" && p.amountPaise > 0);

    let inv;
    try {
      inv = await billing.add({
        billingType,
        invoiceNo: allocatedInvoiceNo,
        status: finalBalancePaise <= 0 ? "paid" : finalPaidPaise > 0 ? "partial" : "issued",
        customerId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerGstin: customer.gstin,
        orderId: linkedOrder?.id,
        orderNo: linkedOrder?.orderNo,
        jobId: linkedJob?.id,
        jobNo: linkedJob?.jobNo,
        items,
        orderAdjustment: adjustmentLive,
        gst,
        cgstPaise: computed.cgstPaise,
        sgstPaise: computed.sgstPaise,
        gstPaise: computed.gstPaise,
        tcsPaise: computed.tcsPaise,
        gstGoldEquivalentMg: computed.gstGoldEquivalentMg,
        subtotalPaise: computed.subtotalPaise,
        adjustmentPaise: computed.adjustmentPaise,
        grandTotalPaise: (() => {
          const n = Number(roundOffRupees);
          const roundOff = Number.isFinite(n) && n !== 0 ? Math.round(n * 100) : 0;
          return computed.grandTotalPaise + roundOff;
        })(),
        paidPaise: finalPaidPaise,
        balancePaise: (() => {
          const n = Number(roundOffRupees);
          const roundOff = Number.isFinite(n) && n !== 0 ? Math.round(n * 100) : 0;
          return Math.max(0, computed.grandTotalPaise + roundOff - finalPaidPaise);
        })(),
        payments: finalRealPayments,
        additionalLedgerEntryIds: additionalLedgerIds.length > 0 ? additionalLedgerIds : undefined,
        notes:
          invNotes +
          (isGoldExchange && goldShortfallFineMg > 0
            ? ` [Pay-In-Gold Shortfall: ${goldShortfallGrams.toFixed(3)}g]`
            : ""),
        haste: haste.trim() || undefined,
        salesman: salesman.trim() || undefined,
        urdLines: urdLines.length > 0 ? urdLines : undefined,
        partyPrintSnapshot: partyAccount
          ? {
              openingFineMg: partyAccount.openingGoldMg,
              closingFineMg: partyAccount.closingGoldMg,
              openingCashPaise: partyAccount.openingMoneyPaise,
              closingCashPaise: partyAccount.closingMoneyPaise,
              anamatPaise: partyAccount.moneyAdvancePaise,
            }
          : undefined,
        dueAt: dueDate ? new Date(dueDate + "T23:59:59").getTime() : undefined,
        placeOfSupply: placeOfSupply.trim() || undefined,
        roundOffPaise: (() => {
          const n = Number(roundOffRupees);
          if (!Number.isFinite(n) || n === 0) return undefined;
          return Math.round(n * 100);
        })(),
      });
    } catch (err: any) {
      toast.error(
        `किंमत सेव्ह करणे अपयशी ठरले / Failed to save invoice: ${err.message || err}. Please check network connection and try again.`,
      );
      return;
    }

    let confirmed = inv;
    try {
      const reloaded = await fetchBillingInvoiceById(inv.id);
      if (reloaded) confirmed = reloaded;
    } catch (reloadErr) {
      console.warn("[Billing] fetch-by-id after save failed; using returned invoice.", reloadErr);
    }

    for (const item of items) {
      if (item.stockItemId) {
        updateStock(item.stockItemId, { linkedCustomerId: customerId });
      }
    }

    if (linkedOrder) {
      updateOrder(linkedOrder.id, { status: "delivered" });
      appendOrderTimeline(linkedOrder.id, {
        ts: Date.now(),
        label: `Invoice ${inv.invoiceNo} created`,
        note: `Total ₹ ${paiseToRupees(inv.subtotalPaise + inv.gstPaise)}`,
      });
    }

    // Cash-drawer auto-open — only for a fully-cash payment (no mixed UPI/
    // card/bank/cheque), and only when both Settings toggles allow it.
    // Best-effort: never blocks or fails invoice creation.
    const hw = useSettings.getState().hardware;
    if (
      hw.cashDrawerEnabled &&
      hw.cashDrawerAutoOpenOnCash &&
      realPayments.length > 0 &&
      realPayments.every((p) => p.mode === "cash")
    ) {
      thermalPrinterService.openCashDrawer().catch((err) => {
        console.error("[Billing] Cash drawer auto-open failed:", err);
      });
    }

    const savedEmail = customer?.email ?? "";
    clearBillingType();
    clearCustomerId();
    clearGst();
    clearItems();
    clearPayments();

    setConfirmedCustomerEmail(savedEmail);
    setConfirmedInvoice(confirmed);
  }

  // Customer walk-in helper
  const addPerson = usePeople((s) => s.add);
  async function selectOrCreateWalkIn() {
    const existing = people.find((p) => p.fullName === "Walk-In Customer");
    if (existing) {
      setCustomerId(existing.id);
      return;
    }
    try {
      const walkIn = await addPerson({
        fullName: "Walk-In Customer",
        phone: "0000000000",
        type: "customer" as const,
        active: true,
        branchId: useSettings.getState().selectedBranchId || "MAIN",
      });
      setCustomerId(walkIn.id);
    } catch (err: any) {
      toast.error("Failed to create walk-in customer: " + err.message);
    }
  }

  // Build items helper
  function buildPrefilledItem(
    stock?: ReturnType<typeof useStock.getState>["items"][number],
    order?: ReturnType<typeof useOrders.getState>["orders"][number],
  ): InvoiceItem {
    const currentGoldRate = getCurrentGoldRatePaise() || 0;
    if (stock) {
      const ratePaise = currentGoldRate;
      const goldValuePaise2 = Math.round((stock.fineMg * ratePaise) / 1000);
      const resolved2 = computeStockMakingCharge(
        stock,
        goldValuePaise2,
        useSettings.getState().makingCharge,
      );

      const blank: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise"> = {
        stockItemId: stock.id,
        barcode: stock.barcode,
        itemName: stock.itemName,
        category: stock.category,
        purity: stock.purity,
        grossMg: stock.grossMg,
        netMg: stock.netMg,
        fineMg: stock.fineMg,
        goldRatePerGramPaise: ratePaise,
        makingChargesPaise: resolved2.makingChargesPaise,
        makingChargePct: resolved2.makingChargePct,
        makingChargeBasis: resolved2.basis,
        makingChargeRatePerUnitPaise: resolved2.ratePerUnitPaise,
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
        huid: stock.huid || undefined,
        chargeMode: chargeModeForBillingType(billingType),
      };
      const tot = computeItemTotals(blank);
      return { id: newItemId(), ...blank, ...tot };
    }
    if (order) {
      const weightGramsNum3 = order.item.grossMg / 1000;
      // If order has labourRupees, use it. Otherwise compute a standard rate
      const makingChargesPaise = order.item.labourRupees
        ? Math.round(order.item.labourRupees * 100)
        : Math.round(weightGramsNum3 * 45000);

      const blank: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise"> = {
        itemName: order.item.itemName,
        category: order.item.category,
        purity: order.item.purity,
        grossMg: order.item.grossMg,
        netMg: order.item.netMg,
        fineMg: order.item.fineMg,
        goldRatePerGramPaise: order.advance.goldRatePerGram
          ? Math.round(order.advance.goldRatePerGram * 100)
          : currentGoldRate,
        makingChargesPaise: makingChargesPaise,
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
        chargeMode: chargeModeForBillingType(billingType),
      };
      const tot = computeItemTotals(blank);
      return { id: newItemId(), ...blank, ...tot };
    }
    const blank: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise"> = {
      itemName: "",
      category: "Other",
      // MTJ mandate: default purity from firm settings (default 995), never hard-coded 916 globally.
      purity: getDefaultPurityPermille(),
      grossMg: 0,
      netMg: 0,
      fineMg: 0,
      goldRatePerGramPaise: currentGoldRate,
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      chargeMode: chargeModeForBillingType(billingType),
    };
    const tot = computeItemTotals(blank);
    return { id: newItemId(), ...blank, ...tot };
  }

  // ── Post-billing success dialog ─────────────────────────────────────────
  if (confirmedInvoice) {
    const inv = confirmedInvoice;
    const custPhone = inv.customerPhone ?? "";
    const custEmail = confirmedCustomerEmail;
    // Real, single source of truth for the current branch (see
    // branch-store.ts's Priority 4.5 fix) — this used to read a
    // billingStore-local currentBranchId that was hardcoded to a stale,
    // non-existent branch id and never actually updated.
    const branchId = useSettings.getState().selectedBranchId || "MAIN";

    async function invoiceShareUrl(): Promise<string> {
      return (
        (await createDocumentShareLink("invoice", inv.id, branchId)) ??
        `${window.location.origin}/billing/print/${inv.id}`
      );
    }

    async function handleSendEmail() {
      if (!custEmail) {
        toast.error("Customer email not set.");
        return;
      }
      setEmailSending(true);
      const documentUrl = await invoiceShareUrl();
      const result = await notifyInvoiceReady({
        branchId,
        recipient: { name: inv.customerName, email: custEmail },
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNo,
        amount: `₹ ${paiseToRupees(inv.grandTotalPaise)}`,
        documentUrl,
        channels: ["email"],
      });
      setEmailSending(false);
      if (result.success) toast.success("Invoice notification queued via email.");
      else toast.error(result.errors[0] ?? "Email dispatch failed.");
    }

    async function handleSendWhatsApp() {
      const documentUrl = await invoiceShareUrl();
      const result = await notifyInvoiceReady({
        branchId,
        recipient: { name: inv.customerName, phone: custPhone },
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNo,
        amount: `₹ ${paiseToRupees(inv.grandTotalPaise)}`,
        documentUrl,
        channels: ["whatsapp"],
        emailFallbackOnWhatsAppFailure: true,
      });
      if (result.success) toast.success("Invoice notification sent.");
      else toast.error(result.errors[0] ?? "WhatsApp dispatch failed.");
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-md shadow-2xl w-full max-w-md p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="font-serif text-2xl text-gold">Invoice Saved!</h2>
            <p className="text-muted-foreground text-sm">{inv.invoiceNo}</p>
          </div>

          {/* Summary */}
          <div className="rounded-md bg-muted/30 border border-border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{inv.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grand Total</span>
              <span className="font-semibold text-gold text-base">
                ₹ {paiseToRupees(inv.grandTotalPaise)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>{inv.items?.length ?? 0}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/billing/print/${inv.id}`, "_blank")}
            >
              Print A4
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/billing/receipt/${inv.id}`, "_blank")}
            >
              Print Receipt
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/billing/estimate/${inv.id}`, "_blank")}
            >
              Estimate
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!custEmail || emailSending}
              onClick={handleSendEmail}
            >
              {emailSending ? "Sending…" : "Email Invoice"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!isValidWaPhone(custPhone)}
              onClick={handleSendWhatsApp}
            >
              WhatsApp
            </Button>
          </div>

          {/* Footer actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => navigate({ to: "/billing/$id", params: { id: inv.id } })}
            >
              View Invoice
            </Button>
            <Button
              className="flex-1 bg-gold text-black hover:bg-gold/90"
              onClick={() => {
                setConfirmedInvoice(null);
                navigate({ to: "/billing" });
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 sm:p-4 md:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6 ${
        touchCompact ? "pb-28" : ""
      }`}
    >
      <PageHeader
        title={t("billing.newInvoice")}
        subtitle={
          linkedOrder
            ? `Order ${linkedOrder.orderNo}`
            : linkedStock
              ? `Tag ${linkedStock.itemCode}`
              : "Jewellery billing"
        }
        actions={
          <Link to="/billing">
            <Button variant="ghost" className="gap-2 border border-border/60 hover:bg-muted/10">
              <ArrowLeft className="h-4 w-4" /> All Invoices
            </Button>
          </Link>
        }
      />

      <PersonFormDialog
        open={showAddCustomer}
        initial={null}
        defaultType="customer"
        onClose={() => setShowAddCustomer(false)}
        onSaved={(p) => {
          setCustomerId(p.id);
          setShowAddCustomer(false);
        }}
      />

      <div className="rounded-md border bg-card p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
        <div>
          <Label className={`${labelTouch} uppercase`}>{t("billing.dayRate")}</Label>
          <p className="font-mono text-gold">
            {currentGoldRatePaise > 0
              ? (currentGoldRatePaise / 100).toLocaleString("en-IN")
              : "Not set"}
          </p>
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>{t("billing.haste")}</Label>
          <Input
            value={haste}
            onChange={(e) => setHaste(e.target.value)}
            placeholder="Responsible person"
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>{t("billing.salesman")}</Label>
          <Input
            value={salesman}
            onChange={(e) => setSalesman(e.target.value)}
            placeholder="Salesman / counter"
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>{t("billing.receiptIn")}</Label>
          <Select value={settlementKind} onValueChange={(v) => setSettlementKind(v as "cash" | "gold")}>
            <SelectTrigger className={touchCompact ? "h-11" : undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{t("billing.receiptCash")}</SelectItem>
              <SelectItem value="gold">{t("billing.receiptGold")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 xl:col-span-3">
          <Label className={`${labelTouch} uppercase`}>{t("billing.narration")}</Label>
          <Input
            value={voucherNarration}
            onChange={(e) => setVoucherNarration(e.target.value)}
            placeholder="Gold and cash impact of this voucher"
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>Due Date</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>Place of Supply</Label>
          <Input
            value={placeOfSupply}
            onChange={(e) => setPlaceOfSupply(e.target.value)}
            placeholder="State (GST)"
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
        <div>
          <Label className={`${labelTouch} uppercase`}>Round Off (₹)</Label>
          <Input
            inputMode="decimal"
            value={roundOffRupees}
            onChange={(e) => setRoundOffRupees(e.target.value)}
            placeholder="0.00"
            className={touchCompact ? "h-11" : undefined}
          />
        </div>
      </div>

      {/* Compact status bar — F-key strip is desktop-only */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 text-[10px] font-mono text-muted-foreground">
        {!hideKeyboardHints ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(
              [
                ["bill_f2_scan", "Scan"],
                ["bill_f4_customer", "Customer"],
                ["bill_f7_order", "Order"],
                ["bill_f8_add_line", "Add Item"],
                ["bill_f9_payment", "Payment"],
                ["bill_f10_save", "Save & Print"],
              ] as const
            ).map(([id, label]) => (
              <span key={id}>
                <kbd className="bg-background border border-border px-1 py-0.5 rounded text-[9px] font-bold text-foreground mr-0.5">
                  {getShortcutDisplayLabel(id)}
                </kbd>
                {label}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">Touch billing workspace</div>
        )}
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${scaleConnected ? (scaleReading?.isStable ? "bg-emerald-500" : "bg-yellow-400 animate-pulse") : "bg-slate-400"}`}
          />
          <span
            className={
              scaleConnected
                ? scaleReading?.isStable
                  ? "text-emerald-500"
                  : "text-yellow-500"
                : ""
            }
          >
            {scaleConnected && scaleReading
              ? `Scale: ${scaleReading.weightGrams.toFixed(3)}g${!scaleReading.isStable ? " (unstable — not applied)" : ""}`
              : "Scale: —"}
          </span>
        </div>
      </div>

      {/* Billing Type — compact pill row */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          {BILLING_TYPES.filter((t) => t.group === "primary").map((t) => {
            const active = billingType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setBillingType(t.id as BillingType);
                  setGst("gst3");
                  setItems([buildPrefilledItem(linkedStock, linkedOrder)]);
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  active
                    ? "border-gold bg-gold/15 text-gold shadow-sm font-bold"
                    : "border-border bg-card hover:bg-muted/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label.split(" / ")[0]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Other
          </span>
          {BILLING_TYPES.filter((t) => t.group === "secondary").map((t) => {
            const active = billingType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setBillingType(t.id as BillingType);
                  setGst("none");
                  setItems([
                    {
                      id: newItemId(),
                      itemName:
                        t.id === "advance_receipt" ? "Booking Advance" : "Outstanding Settlement",
                      category: t.id === "advance_receipt" ? "Advance Deposit" : "Inst. Payment",
                      purity: 0,
                      grossMg: 0,
                      netMg: 0,
                      fineMg: 0,
                      goldRatePerGramPaise: 0,
                      goldValuePaise: 0,
                      makingChargesPaise: 0,
                      stoneChargesPaise: 0,
                      hallmarkChargesPaise: 0,
                      otherChargesPaise: 0,
                      discountPaise: 0,
                      lineTotalPaise: 0,
                    },
                  ]);
                }}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all opacity-80 ${
                  active
                    ? "border-gold bg-gold/15 text-gold shadow-sm font-bold opacity-100"
                    : "border-border/60 bg-muted/10 text-muted-foreground/70 hover:opacity-100"
                }`}
              >
                {t.label.split(" / ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Section 1: Customer and Ready Orders */}
          <Section title="Customer Registry & Order Matching">
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Customer selection */}
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  Select or Register Customer
                </Label>
                {!customerId ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1" data-suggestion-root>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={customerInputRef}
                          placeholder="Search customer by name or phone... F4"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          onKeyDown={handleCustomerKeyDown}
                          className="pl-9 h-10 border-gold/20 focus-visible:border-gold"
                        />
                        {filteredCustomers.length > 0 && (
                          <div
                            data-suggestion-panel
                            className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border"
                          >
                            {filteredCustomers.map((c, i) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setCustomerId(c.id);
                                  setCustomerSearch("");
                                }}
                                className={`p-3 cursor-pointer flex justify-between items-center transition-colors text-sm ${
                                  i === activeCustomerIdx ? "bg-gold/20" : "hover:bg-gold/10"
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-foreground">{c.fullName}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Phone: {c.phone}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`h-7 text-xs ${
                                    i === activeCustomerIdx
                                      ? "bg-gold text-white border-gold"
                                      : "border-gold/30 text-gold"
                                  }`}
                                >
                                  Select
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {chargeModeForBillingType(billingType) === "full_value" && (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-gold/30 hover:bg-gold/5 text-gold h-10"
                          onClick={selectOrCreateWalkIn}
                        >
                          Walk-In Customer
                        </Button>
                      )}
                      <Button
                        type="button"
                        className="bg-gold hover:bg-gold/90 text-white h-10 gap-1"
                        onClick={() => setShowAddCustomer(true)}
                      >
                        <Plus className="h-4 w-4" /> New Customer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-md border border-gold/30 bg-gold/5 gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {customer?.fullName}
                        <Badge
                          variant="outline"
                          className="text-[10px] border-gold/30 text-gold bg-gold/5"
                        >
                          Customer Selected
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Phone: {customer?.phone || "0000000000"}{" "}
                        {customer?.gstin ? `· GSTIN: ${customer.gstin}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 h-8"
                      onClick={() => {
                        setCustomerId("");
                        setCustomerSearch("");
                        setSelectedOrderId(null);
                      }}
                    >
                      Change Customer
                    </Button>
                  </div>
                )}
              </div>

              {/* Ready / Open Orders Matcher */}
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  Match Ready / Open Order
                </Label>
                {!selectedOrderId ? (
                  <div className="relative" data-suggestion-root>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={orderInputRef}
                      placeholder="Link a customer order... Type order no, item name, or search... F7"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={handleOrderKeyDown}
                      className="pl-9 h-10"
                    />
                    {filteredOrders.length > 0 && (
                      <div
                        data-suggestion-panel
                        className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border"
                      >
                        {filteredOrders.map((o, i) => {
                          const oCust = people.find((p) => p.id === o.customerId);
                          return (
                            <div
                              key={o.id}
                              onClick={() => {
                                setSelectedOrderId(o.id);
                                if (o.customerId) {
                                  setCustomerId(o.customerId);
                                }
                                const loadedItem = buildPrefilledItem(undefined, o);
                                setItems([loadedItem]);
                                setOrderSearch("");
                                setScanMessage({
                                  text: `Matched order details loaded! Order No: ${o.orderNo}`,
                                  type: "success",
                                });
                              }}
                              className={`p-3 cursor-pointer flex justify-between items-center text-sm ${
                                i === activeOrderIdx ? "bg-gold/20" : "hover:bg-gold/10"
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span>Order #{o.orderNo}</span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 py-0 text-amber-500 border-amber-500/20 bg-amber-500/5"
                                  >
                                    {ORDER_STATUS_LABELS[o.status] || o.status}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Customer: {oCust?.fullName || "Walk-In"} · Item: {o.item.itemName}{" "}
                                  ({mgToGrams(o.item.netMg)}g)
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 text-xs ${
                                  i === activeOrderIdx
                                    ? "bg-gold text-white border-gold"
                                    : "border-gold/30 text-gold"
                                }`}
                              >
                                Match & Load
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-md border border-border bg-background/50 gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm flex items-center gap-2">
                        Order #{linkedOrder?.orderNo}
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5 font-mono"
                        >
                          Linked Order
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Item: {linkedOrder?.item.itemName} (
                        {mgToGrams(linkedOrder?.item.netMg || 0)}g) · Status:{" "}
                        {linkedOrder
                          ? ORDER_STATUS_LABELS[linkedOrder.status] || linkedOrder.status
                          : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 h-8"
                      onClick={() => {
                        setSelectedOrderId(null);
                        setOrderSearch("");
                      }}
                    >
                      Unlink Order
                    </Button>
                  </div>
                )}
              </div>

              {/* GST configuration */}
              {useModuleStore.getState().isModuleEnabled("gst") ? (
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
                    GST Application
                  </Label>
                  <Select value={gst} onValueChange={(v) => setGst(v as GstKind)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gst3">
                        GST 3% (CGST 1.5 + SGST 1.5) — taxable base from Settings
                      </SelectItem>
                      <SelectItem value="none">GST Not Applied (0%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="sm:col-span-2 hidden"></div>
              )}
            </div>

            {/* Display Customer Ledger Account Summary */}
            {customer && (
              <div className="mt-4 p-3 rounded-md border border-border/80 bg-background/40 flex flex-wrap gap-6 text-xs justify-between">
                {jewellerBook ? (
                  <>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                        Gold Advance Available
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-500">
                        {mgToGrams(jewellerBook.goldHeldMg)} g
                      </span>
                    </div>
                    {jewellerBook.goldHeldMg > 0 && (
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                          Gold We Owe the Customer
                        </span>
                        <span className="font-mono font-bold text-sm text-emerald-500">
                          {mgToGrams(jewellerBook.goldHeldMg)} g
                        </span>
                      </div>
                    )}
                    {jewellerBook.goldOwedMg > 0 && (
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                          Gold the Customer Owes Us
                        </span>
                        <span className="font-mono font-bold text-sm text-destructive">
                          {mgToGrams(jewellerBook.goldOwedMg)} g
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                        Current Outstanding Gold Balance
                      </span>
                      <span
                        className={`font-mono font-bold text-sm ${jewellerBook.goldHeldMg - jewellerBook.goldOwedMg >= 0 ? "text-emerald-500" : "text-destructive"}`}
                      >
                        {mgToGrams(Math.abs(jewellerBook.goldHeldMg - jewellerBook.goldOwedMg))} g{" "}
                        {jewellerBook.goldHeldMg - jewellerBook.goldOwedMg >= 0
                          ? "(in customer's favor)"
                          : "(owed by customer)"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                        Outstanding balance
                      </span>
                      <span
                        className={`font-mono font-bold text-sm ${customerOutstandingPaise > 0 ? "text-destructive" : "text-emerald-500"}`}
                      >
                        ₹{" "}
                        {(customerOutstandingPaise / 100).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                        Advances (Active orders)
                      </span>
                      <span className="font-mono font-bold text-sm text-amber-500">
                        ₹{" "}
                        {pendingCashAdvanceRupees.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        + {pendingGoldAdvanceGrams.toFixed(3)}g fine
                      </span>
                    </div>
                    {customerGoldBalanceMg !== 0 && (
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
                          Gold Credit Balance
                        </span>
                        <span
                          className={`font-mono font-bold text-sm ${customerGoldBalanceMg > 0 ? "text-yellow-500" : "text-rose-500"}`}
                        >
                          {mgToGrams(Math.abs(customerGoldBalanceMg))} g{" "}
                          {customerGoldBalanceMg > 0
                            ? "(in customer's favor)"
                            : "(owed by customer)"}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Matchable Customer Specific Open Orders Display */}
            {customer && customerOpenOrders.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
                  Customer's Active Orders ({customerOpenOrders.length})
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {customerOpenOrders.map((o) => (
                    <div
                      key={o.id}
                      className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          Order #{o.orderNo}
                          {o.status === "ready" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-emerald-500/5 text-emerald-500 border-emerald-500/10 h-4 py-0"
                            >
                              Ready
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-0.5">
                          {o.item.itemName} · {mgToGrams(o.item.netMg)}g ({o.item.purity} touch)
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOrderId(o.id);
                          const loadedItem = buildPrefilledItem(undefined, o);
                          setItems([loadedItem]);
                          setScanMessage({
                            text: `Loaded order details for matching!`,
                            type: "success",
                          });
                        }}
                        className="text-gold hover:text-gold/90 hover:bg-gold/5 font-bold h-7 text-[11px]"
                      >
                        Load Order
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Section 2: Barcode Lookup and Multi-Item Grid */}
          <Section
            title={
              billingType === "advance_receipt" || billingType === "payment_receipt"
                ? "Receipt & Accounts Narration"
                : t("billing.jewelleryLines")
            }
            right={
              billingType !== "advance_receipt" &&
              billingType !== "payment_receipt" && (
                <div className="flex flex-wrap gap-2">
                  {billingType === "ready_stock" && (
                    <Button
                      size="sm"
                      className="gap-1.5 h-8 bg-gold hover:bg-gold/90 text-white"
                      onClick={() => setReadyStockPickerOpen(true)}
                    >
                      <Package className="h-3 w-3" /> Select from Ready Stock
                    </Button>
                  )}
                  {billingType !== "ready_stock" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 border-gold/40 text-gold hover:bg-gold/5"
                      onClick={addItem}
                    >
                      <Plus className="h-3 w-3" /> F8 Add Line
                    </Button>
                  )}
                </div>
              )
            }
          >
            <div className="space-y-4">
              {/* Scan or Search Stock */}
              {billingType !== "advance_receipt" && billingType !== "payment_receipt" && (
                <div className="bg-background/40 p-3 rounded-md border border-border space-y-3">
                  {billingType === "ready_stock" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 bg-gold hover:bg-gold/90 text-white"
                        onClick={() => setReadyStockPickerOpen(true)}
                      >
                        <Package className="h-3 w-3" /> Select from Ready Stock
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Each piece must have product photo(s) and full details (name, category,
                        purity, weights).
                      </p>
                    </div>
                  )}
                  <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                    <div className="relative flex-1" data-suggestion-root>
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={barcodeInputRef}
                        placeholder="Scan tags, enter HUID or item barcode... F2"
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        onKeyDown={handleStockKeyDown}
                        className="pl-9 h-10 border-gold/20 focus-visible:border-gold"
                      />

                      {/* Stock Autocomplete Dropdown */}
                      {filteredStock.length > 0 && (
                        <div
                          data-suggestion-panel
                          className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border"
                        >
                          {filteredStock.slice(0, 50).map((s, i) => {
                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setActiveInspectedStock(s);
                                }}
                                className={`p-3 cursor-pointer flex items-center gap-3 transition-colors text-sm ${
                                  i === activeStockIdx
                                    ? "bg-gold/25 font-semibold"
                                    : "hover:bg-gold/15"
                                }`}
                              >
                                {/* Thumbnail */}
                                <div className="h-10 w-10 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">
                                  <StockPhotoImg
                                    stockItem={s}
                                    className="h-full w-full object-cover"
                                    fallback={
                                      <span className="text-center leading-tight">
                                        No
                                        <br />
                                        Photo
                                      </span>
                                    }
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate">{s.itemName}</span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] h-4 py-0 text-emerald-500 border-emerald-500/20 bg-emerald-500/5 flex-shrink-0"
                                    >
                                      Available
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                                    {s.itemCode} · {s.barcode} {s.purity}K
                                    {s.huid ? ` · HUID: ${s.huid}` : ""}
                                  </div>
                                </div>
                                <div className="text-right flex flex-col items-end flex-shrink-0">
                                  <span className="font-mono text-xs font-semibold text-gold">
                                    {mgToGrams(s.grossMg)} g
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`h-6 text-[11px] mt-1 px-2.5 py-0 flex items-center gap-1 font-semibold ${
                                      i === activeStockIdx
                                        ? "bg-gold text-white border-gold"
                                        : "border-gold/40 text-gold hover:bg-gold/5"
                                    }`}
                                  >
                                    <Eye className="h-3 w-3" /> Inspect
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </form>

                  {scanMessage && (
                    <div
                      className={`text-xs p-2 rounded-lg flex items-center gap-1.5 font-semibold ${
                        scanMessage.type === "success"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : scanMessage.type === "error"
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}
                    >
                      <Check className="h-3 w-3 shrink-0" />
                      <span>{scanMessage.text}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items — dense table on desktop/tablet-landscape; touch cards on phone/tablet-portrait */}
              {useHisabTable ? (
                <div className="overflow-x-auto border rounded-md -mx-0">
                  <table className="w-full text-[11px] min-w-[880px]">
                    <thead className="bg-muted/40 text-left sticky top-0 z-[1]">
                      <tr>
                        <th className="p-1.5" title={t("billing.itemName")}>{t("billing.itemName")}</th>
                        <th className="p-1.5" title={t("billing.col_grWt")}>{t("billing.col_grWt")}</th>
                        <th className="p-1.5" title={t("billing.col_less")}>{t("billing.col_less")}</th>
                        <th className="p-1.5" title={t("billing.col_add")}>{t("billing.col_add")}</th>
                        <th className="p-1.5" title={t("billing.col_net")}>{t("billing.col_net")}</th>
                        <th className="p-1.5" title={t("billing.col_tanch")}>{t("billing.col_tanch")}</th>
                        <th className="p-1.5" title={t("billing.col_wstg")}>{t("billing.col_wstg")}</th>
                        <th className="p-1.5" title={t("billing.col_hisob")}>{t("billing.col_hisob")}</th>
                        <th className="p-1.5" title={t("billing.col_fine")}>{t("billing.col_fine")}</th>
                        <th className="p-1.5" title={t("billing.col_pcs")}>{t("billing.col_pcs")}</th>
                        <th className="p-1.5" title={t("billing.col_lab")}>{t("billing.col_lab")}</th>
                        <th className="p-1.5" title={t("billing.col_rate")}>{t("billing.col_rate")}</th>
                        <th className="p-1.5" title={t("billing.col_amt")}>{t("billing.col_amt")}</th>
                        <th className="p-1.5" title={t("billing.col_jn")}>{t("billing.col_jn")}</th>
                        <th className="p-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <ItemRow
                          key={it.id}
                          it={it}
                          idx={idx}
                          billingType={billingType}
                          variant="table"
                          touchCompact={false}
                          scaleReading={scaleReading ?? undefined}
                          onWeightFocus={(type) => setFocusedWeightField({ itemId: it.id, type })}
                          onWeightBlur={() => setFocusedWeightField(null)}
                          onChange={(diff) => patchItem(it.id, diff)}
                          onRemove={() => removeItem(it.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <ItemRow
                      key={it.id}
                      it={it}
                      idx={idx}
                      billingType={billingType}
                      variant="card"
                      touchCompact={touchCompact}
                      scaleReading={scaleReading ?? undefined}
                      onWeightFocus={(type) => setFocusedWeightField({ itemId: it.id, type })}
                      onWeightBlur={() => setFocusedWeightField(null)}
                      onChange={(diff) => patchItem(it.id, diff)}
                      onRemove={() => removeItem(it.id)}
                    />
                  ))}
                </div>
              )}
              {partyAccount ? (
                <div className="mt-3 rounded-md border bg-muted/20 p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div title="Fine Jama (gold in)">
                    Fine J {mgToGrams(partyAccount.totalGoldInMg)} g
                  </div>
                  <div title="Fine Naam (gold out)">
                    Fine N {mgToGrams(partyAccount.totalGoldOutMg)} g
                  </div>
                  <div title="Cash Jama">
                    Cash J ₹{paiseToRupees(partyAccount.totalCreditPaise)}
                  </div>
                  <div title="Cash Naam">
                    Cash N ₹{paiseToRupees(partyAccount.totalDebitPaise)}
                  </div>
                  <div title="Closing fine">
                    Closing Fine {mgToGrams(partyAccount.closingGoldMg)} g
                  </div>
                  <div title="Closing cash">
                    Closing Cash ₹{paiseToRupees(partyAccount.closingMoneyPaise)}
                  </div>
                  <div className="col-span-2" title="Amount still due on this voucher">
                    This voucher unpaid ₹{paiseToRupees(Math.max(0, computeInvoiceTotals(items, gst, undefined, [], urdLines).balancePaise))}
                  </div>
                </div>
              ) : null}

              {/* Offline URD second grid — cards on touch, table on dense */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-xs font-semibold uppercase tracking-wide">
                    {t("billing.urdOnBill")}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={touchCompact ? "h-11 text-sm px-4" : "h-7 text-xs"}
                    onClick={() => {
                      setUrdLines((prev) => [
                        ...prev,
                        {
                          id: newItemId(),
                          itemName: "",
                          grossMg: 0,
                          lessMg: 0,
                          netMg: 0,
                          // MTJ mandate: default purity from firm settings (default 995).
                          purity: getDefaultPurityPermille(),
                          fineMg: 0,
                          ratePerGramPaise: getCurrentGoldRatePaise() || 0,
                          amountPaise: 0,
                          jn: 1,
                        },
                      ]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add URD line
                  </Button>
                </div>
                {urdLines.length > 0 &&
                  (useHisabTable ? (
                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full text-[11px] min-w-[640px]">
                        <thead className="bg-muted/40 text-left">
                          <tr>
                            <th className="p-1">Item</th>
                            <th className="p-1">Gr</th>
                            <th className="p-1">Less</th>
                            <th className="p-1">Net</th>
                            <th className="p-1">Tanch‰</th>
                            <th className="p-1">Fine</th>
                            <th className="p-1">Rate</th>
                            <th className="p-1">Amt</th>
                            <th className="p-1">J/N</th>
                            <th className="p-1" />
                          </tr>
                        </thead>
                        <tbody>
                          {urdLines.map((u) => (
                            <UrdTableRow
                              key={u.id}
                              u={u}
                              setUrdLines={setUrdLines}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {urdLines.map((u) => (
                        <UrdCard
                          key={u.id}
                          u={u}
                          touchCompact={touchCompact}
                          setUrdLines={setUrdLines}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          </Section>

          {/* Section 2b: Manufacturing Bill — Jeweller Account (MP entries + balances) */}
          {billingType === "manufacturing" && (
            <Section
              title="Jeweller Account — Metal Received"
              right={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8 border-amber-500/40 text-amber-600 hover:bg-amber-500/5 text-xs"
                    onClick={() => addMfgMpEntry("fine")}
                  >
                    <Plus className="h-3 w-3" /> Pure Fine
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8 border-gold/40 text-gold hover:bg-gold/5 text-xs"
                    onClick={() => addMfgMpEntry("lagad")}
                  >
                    <Plus className="h-3 w-3" /> Lagad
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-8 border-slate-400/40 text-slate-400 hover:bg-slate-400/5 text-xs"
                    onClick={() => addMfgMpEntry("scrap")}
                  >
                    <Plus className="h-3 w-3" /> Scrap
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                {/* Opening / LB Balance */}
                <div className="rounded-md border border-border bg-background/40 px-4 py-3">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        LB — Opening Gold Balance (g) · Previous ledger balance
                      </Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="e.g. -252.192"
                        value={mfgLBGoldMg === 0 ? "" : (mfgLBGoldMg / 1000).toFixed(3)}
                        onChange={(e) =>
                          setMfgLBGoldMg(Math.round(parseFloat(e.target.value || "0") * 1000))
                        }
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                    <div className="min-w-[160px] space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Gold Bhav Rate (₹/10g) · e.g. 112650
                      </Label>
                      <Input
                        type="number"
                        step="1"
                        placeholder="112650"
                        value={mfgGoldBhavStr}
                        onChange={(e) => setMfgGoldBhavStr(e.target.value)}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* MP Entries table header */}
                {mfgMpEntries.length > 0 && (
                  <div className="hidden sm:grid text-[10px] uppercase tracking-wider text-muted-foreground grid-cols-[1fr_80px_70px_60px_80px_32px] gap-2 px-2">
                    <span>Label / Type</span>
                    <span>G.Wt (g)</span>
                    <span>Tunch%</span>
                    <span>Pcs</span>
                    <span>Fine (g)</span>
                    <span></span>
                  </div>
                )}

                {mfgMpEntries.map((e) => {
                  const color =
                    e.type === "fine"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : e.type === "lagad"
                        ? "border-gold/25 bg-gold/5"
                        : "border-slate-400/20 bg-slate-400/5";
                  return (
                    <div
                      key={e.id}
                      className={`rounded-md border ${color} px-3 py-2.5 grid grid-cols-2 sm:grid-cols-[1fr_80px_70px_60px_80px_32px] gap-2 items-center`}
                    >
                      <Input
                        value={e.label}
                        onChange={(ev) => patchMfgMp(e.id, { label: ev.target.value })}
                        className="h-8 text-xs font-medium"
                        placeholder="Metal Received — Fine / Lagad"
                      />
                      <Input
                        type="number"
                        step="0.001"
                        value={e.grossMg === 0 ? "" : (e.grossMg / 1000).toFixed(3)}
                        onChange={(ev) =>
                          patchMfgMp(e.id, {
                            grossMg: Math.round(parseFloat(ev.target.value || "0") * 1000),
                          })
                        }
                        className="h-8 text-xs font-mono text-right"
                        placeholder="0.000"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={e.purity === 0 ? "" : e.purity}
                        onChange={(ev) =>
                          patchMfgMp(e.id, { purity: parseFloat(ev.target.value || "0") })
                        }
                        className="h-8 text-xs font-mono text-right"
                        placeholder="100"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={e.pcs === 0 ? "" : e.pcs}
                        onChange={(ev) =>
                          patchMfgMp(e.id, { pcs: parseInt(ev.target.value || "0") })
                        }
                        className="h-8 text-xs font-mono text-right"
                        placeholder="0"
                      />
                      <div className="text-right font-mono text-xs font-semibold text-amber-500">
                        {(e.fineMg / 1000).toFixed(3)}g
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => removeMfgMp(e.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}

                {/* Unified Job-Work Obligation, Metal Received & Remainder Settlement */}
                {(() => {
                  const totalItemFineMg = items.reduce((s, it) => s + it.fineMg, 0); // Gold given / Obligation
                  const totalMpFineMg = mfgMpEntries.reduce((s, e) => s + e.fineMg, 0); // Physical metal received
                  const bhavPer10g = parseFloat(mfgGoldBhavStr || "0");
                  const ratePerGramPaise =
                    bhavPer10g > 0
                      ? Math.round((bhavPer10g / 10) * 100)
                      : currentGoldRatePaise > 0
                        ? currentGoldRatePaise
                        : 750000;
                  const cashPaymentPaise = payments.reduce(
                    (s, p) =>
                      p.mode === "cash" || p.mode === "upi" || p.mode === "bank"
                        ? s + rupeesToPaise(p.amountStr)
                        : s,
                    0,
                  );
                  const bhavGoldMg =
                    ratePerGramPaise > 0 ? Math.round((cashPaymentPaise / ratePerGramPaise) * 1000) : 0;
                  const totalSettledFineMg = totalMpFineMg + bhavGoldMg;
                  const remainingBeforeCashFineMg = Math.max(0, totalItemFineMg - totalMpFineMg);
                  const remainingJobWorkFineMg = Math.max(0, totalItemFineMg - totalSettledFineMg);

                  const availableCustomerGoldMg =
                    (partyAccount && partyAccount.goldAdvanceMg > 0 ? partyAccount.goldAdvanceMg : 0) ||
                    (jewellerBook && jewellerBook.goldHeldMg > 0 ? jewellerBook.goldHeldMg : 0) ||
                    0;

                  const isFullySettled = totalItemFineMg > 0 && remainingJobWorkFineMg === 0;
                  const isPartiallySettled = totalSettledFineMg > 0 && remainingJobWorkFineMg > 0;

                  return (
                    <div className="space-y-3 pt-2">
                      {/* Customer Existing Gold Balance Settlement Banner */}
                      {availableCustomerGoldMg > 0 && totalItemFineMg > 0 && (
                        <div
                          data-testid="mfg-auto-gold-balance-panel"
                          className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-3.5"
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2">
                              <Coins className="h-4 w-4 text-amber-400" />
                              <span className="font-semibold text-xs tracking-wide text-amber-300 uppercase">
                                Customer Existing Gold Advance Available
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-amber-400/40 text-amber-400 bg-amber-400/10 text-[10px]"
                            >
                              Available: {mgToGrams(availableCustomerGoldMg)} g
                            </Badge>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Apply {mgToGrams(Math.min(availableCustomerGoldMg, remainingBeforeCashFineMg))} g from customer's existing balance against this {mgToGrams(totalItemFineMg)} g job-work obligation.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs shrink-0"
                              onClick={() => {
                                const applyMg = Math.min(availableCustomerGoldMg, remainingBeforeCashFineMg);
                                if (applyMg <= 0) return;
                                setMfgMpEntries([
                                  ...mfgMpEntries,
                                  {
                                    id: newItemId(),
                                    type: "fine",
                                    label: "Customer Gold Advance Offset",
                                    grossMg: applyMg,
                                    purity: 100,
                                    pcs: 1,
                                    fineMg: applyMg,
                                  },
                                ]);
                                toast.success(`Applied ${mgToGrams(applyMg)} g from customer gold balance.`);
                              }}
                            >
                              <Coins className="h-3.5 w-3.5" /> Apply Existing Gold Balance
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Live Obligation & Settlement Summary Card */}
                      <div className="rounded-xl border border-border bg-card p-4 space-y-3 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                            Job-Work Settlement Breakdown
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs font-bold ${
                              isFullySettled
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : isPartiallySettled
                                  ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                  : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                            }`}
                          >
                            {isFullySettled
                              ? cashPaymentPaise > 0 && totalMpFineMg > 0
                                ? "SETTLED WITH GOLD + CASH"
                                : cashPaymentPaise > 0
                                  ? "SETTLED IN FULL (CASH)"
                                  : "SETTLED FROM GOLD"
                              : isPartiallySettled
                                ? "PARTIALLY SETTLED"
                                : "UNSETTLED"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                            <div className="text-[10px] text-muted-foreground uppercase font-sans">
                              Bill Obligation
                            </div>
                            <div className="font-bold text-foreground text-sm mt-0.5">
                              {mgToGrams(totalItemFineMg)} g Fine
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/20">
                            <div className="text-[10px] text-amber-500 uppercase font-sans">
                              Gold Received
                            </div>
                            <div className="font-bold text-amber-400 text-sm mt-0.5">
                              {mgToGrams(totalMpFineMg)} g Fine
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20">
                            <div className="text-[10px] text-emerald-400 uppercase font-sans">
                              Cash Settled (Equiv)
                            </div>
                            <div className="font-bold text-emerald-400 text-sm mt-0.5">
                              {cashPaymentPaise > 0
                                ? `₹${(cashPaymentPaise / 100).toFixed(0)} (${mgToGrams(bhavGoldMg)}g)`
                                : "—"}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-background/80 border border-rose-500/20">
                            <div className="text-[10px] text-rose-400 uppercase font-sans">
                              Remaining Gold
                            </div>
                            <div className="font-bold text-rose-400 text-sm mt-0.5">
                              {mgToGrams(remainingJobWorkFineMg)} g
                            </div>
                          </div>
                        </div>

                        {/* Settle Remaining Balance Secondary Options */}
                        {remainingBeforeCashFineMg > 0 && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-xs text-amber-300">
                                  Remaining Gold Obligation: {mgToGrams(remainingBeforeCashFineMg)} g
                                </div>
                                <div className="text-[11px] text-muted-foreground font-sans">
                                  Settle remaining balance using physical gold or cash equivalent.
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
                                  onClick={() => {
                                    setMfgMpEntries([
                                      ...mfgMpEntries,
                                      {
                                        id: newItemId(),
                                        type: "fine",
                                        label: "Metal Received — Settle Remainder",
                                        grossMg: remainingBeforeCashFineMg,
                                        purity: 100,
                                        pcs: 1,
                                        fineMg: remainingBeforeCashFineMg,
                                      },
                                    ]);
                                    toast.success(
                                      `Added ${mgToGrams(remainingBeforeCashFineMg)} g Gold to settle remaining balance.`,
                                    );
                                  }}
                                >
                                  <Coins className="h-3.5 w-3.5" /> [GOLD] Settle in Gold
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                  onClick={() => {
                                    const cashPaise = Math.round(
                                      (remainingBeforeCashFineMg * ratePerGramPaise) / 1000,
                                    );
                                    const cashRupees = (cashPaise / 100).toString();
                                    const rateRupees = (ratePerGramPaise / 100).toString();
                                    const gramsStr = mgToGrams(remainingBeforeCashFineMg).toString();

                                    setPayments([
                                      {
                                        id: newItemId(),
                                        mode: "cash",
                                        amountStr: cashRupees,
                                        reference: "Cash Settlement for Remainder",
                                        notes: `Balance ${gramsStr} g settled in cash equivalent to ₹${cashRupees} at ₹${rateRupees}/g`,
                                        goldGramsStr: "",
                                        goldPurityStr: "",
                                        goldRateStr: rateRupees,
                                      },
                                    ]);
                                    toast.success(
                                      `Settled remaining ${gramsStr} g in cash (₹${cashRupees} @ ₹${rateRupees}/g).`,
                                    );
                                  }}
                                >
                                  <Banknote className="h-3.5 w-3.5" /> [CASH] Settle in Cash (₹
                                  {(
                                    (remainingBeforeCashFineMg * (ratePerGramPaise / 100)) /
                                    1000
                                  ).toFixed(0)}
                                  )
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* When Cash is settled */}
                        {cashPaymentPaise > 0 && (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Banknote className="h-4 w-4" />
                              <span>
                                Cash Settled: <strong><MoneyDisplay paise={cashPaymentPaise} /></strong> (Gold Equiv:{" "}
                                <strong>{mgToGrams(bhavGoldMg)} g</strong> @ ₹
                                {paiseToRupees(ratePerGramPaise)}/g)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-destructive hover:bg-destructive/10 text-xs font-sans"
                              onClick={() => setPayments([])}
                            >
                              Remove Cash
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Section>
          )}

          {/* Section 3: Payment Collection (Only for non-manufacturing bills) */}
          {billingType !== "manufacturing" && (
            <Section
              title="Payment Collection"
              right={
                paymentReceivedNow ? (
                  <div className="flex items-center gap-2">
                    <CashDrawerButton />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 border-gold/40 text-gold hover:bg-gold/5"
                      onClick={addPaymentRow}
                    >
                      <Plus className="h-3.5 w-3.5" /> F9 Add Mode
                    </Button>
                  </div>
                ) : null
              }
            >
              <div className="space-y-3">
                {/* PAYMENT RECEIVED NOW? [ YES ] [ NO ] */}
                <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/80 rounded-xl mb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Payment Received Now?
                    </span>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      {paymentReceivedNow
                        ? "Payment is being collected during bill entry."
                        : "Invoice will be created as Unpaid with full balance outstanding."}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border">
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentReceivedNow ? "default" : "ghost"}
                      className={`h-7 px-3.5 text-xs font-bold ${
                        paymentReceivedNow
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setPaymentReceivedNow(true)}
                    >
                      YES
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!paymentReceivedNow ? "default" : "ghost"}
                      className={`h-7 px-3.5 text-xs font-bold ${
                        !paymentReceivedNow
                          ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setPaymentReceivedNow(false);
                        setPayments([]);
                      }}
                    >
                      NO (UNPAID)
                    </Button>
                  </div>
                </div>

                {!paymentReceivedNow ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                      <div>
                        <div className="font-bold text-rose-500 text-xs uppercase tracking-wider">
                          [ UNPAID INVOICE ]
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Full invoice amount will remain outstanding on the customer ledger. Settle anytime later.
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className="text-[10px] text-muted-foreground uppercase">Outstanding Due</div>
                      <div className="text-sm font-bold text-rose-500">
                        <GoldWeightDisplay mg={goldTotals.grandTotalMg} kind="fine" />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <MoneyDisplay paise={totals.grandTotalPaise} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Explicit Preset Selector: [GOLD] [CASH] [MIXED] */}
                    {(() => {
                      const hasGoldRow = payments.some(
                        (p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit",
                      );
                      const hasCashRow = payments.some(
                        (p) =>
                          p.mode === "cash" ||
                          p.mode === "upi" ||
                          p.mode === "bank" ||
                          p.mode === "card" ||
                          p.mode === "cheque",
                      );
                      const isPureGold = hasGoldRow && !hasCashRow;
                      const isPureCash = hasCashRow && !hasGoldRow;
                      const isMixed = hasGoldRow && hasCashRow;

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/20 border border-border/80 rounded-xl mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                              Settlement Mode:
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant={isPureGold ? "default" : "outline"}
                              className={`h-8 gap-1.5 font-bold text-xs ${
                                isPureGold
                                  ? "bg-amber-500 hover:bg-amber-600 text-black shadow-md border-amber-500"
                                  : "border-border text-foreground hover:bg-amber-500/10 hover:text-amber-500"
                              }`}
                              onClick={() => selectPaymentPreset("gold")}
                            >
                              <Coins className="h-3.5 w-3.5" /> [GOLD] Full Gold
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={isPureCash ? "default" : "outline"}
                              className={`h-8 gap-1.5 font-bold text-xs ${
                                isPureCash
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-emerald-600"
                                  : "border-border text-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                              }`}
                              onClick={() => selectPaymentPreset("cash")}
                            >
                              <Banknote className="h-3.5 w-3.5" /> [CASH] Full Cash
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={isMixed ? "default" : "outline"}
                              className={`h-8 gap-1.5 font-bold text-xs ${
                                isMixed
                                  ? "bg-sky-600 hover:bg-sky-700 text-white shadow-md border-sky-600"
                                  : "border-border text-foreground hover:bg-sky-500/10 hover:text-sky-500"
                              }`}
                              onClick={() => selectPaymentPreset("mixed")}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" /> [MIXED] Gold + Cash
                            </Button>
                          </div>

                          <div className="text-[10px] text-muted-foreground font-mono">
                            {isPureGold && "Full settlement in Physical Gold"}
                            {isPureCash && "Full settlement in Cash / Bank / UPI"}
                            {isMixed && "Partially settled in Gold, remainder in Cash"}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Auto Gold Settlement Panel */}
                    {(() => {
                      const availableGoldAdvanceMg =
                        (partyAccount && partyAccount.goldAdvanceMg > 0 ? partyAccount.goldAdvanceMg : 0) ||
                        (jewellerBook && jewellerBook.goldHeldMg > 0 ? jewellerBook.goldHeldMg : 0) ||
                        0;
                      const invoiceFineGoldRequirementMg =
                        goldTotals?.grandTotalMg ||
                        goldTotals?.productFineMg ||
                        (totals.grandTotalPaise > 0 && currentGoldRatePaise > 0
                          ? Math.round((totals.grandTotalPaise * 1000) / currentGoldRatePaise)
                          : 0);
                      const autoSettlementGoldMg = Math.min(availableGoldAdvanceMg, invoiceFineGoldRequirementMg);
                      const remainingCustomerGoldMg = Math.max(0, availableGoldAdvanceMg - autoSettlementGoldMg);

                      if (availableGoldAdvanceMg <= 0 || invoiceFineGoldRequirementMg <= 0) return null;

                      return (
                        <div
                          data-testid="auto-gold-settlement-panel"
                          className="mb-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4"
                        >
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <Coins className="h-4 w-4 text-amber-400" />
                              <span className="font-semibold text-xs tracking-wide text-amber-300 uppercase">
                                Automatic Gold Balance Settlement
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-amber-400/40 text-amber-400 bg-amber-400/10 text-[10px]"
                            >
                              Existing Gold Advance Available
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mb-3">
                            <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                              <div className="text-[10px] text-muted-foreground uppercase">Available Balance</div>
                              <div className="font-bold text-emerald-400 text-sm">
                                {mgToGrams(availableGoldAdvanceMg)} g
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                              <div className="text-[10px] text-muted-foreground uppercase">Invoice Requirement</div>
                              <div className="font-bold text-foreground text-sm">
                                {mgToGrams(invoiceFineGoldRequirementMg)} g
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                              <div className="text-[10px] text-muted-foreground uppercase">Auto Settlement</div>
                              <div className="font-bold text-amber-400 text-sm">
                                {mgToGrams(autoSettlementGoldMg)} g
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                              <div className="text-[10px] text-muted-foreground uppercase">Remaining Balance</div>
                              <div className="font-bold text-sky-400 text-sm">
                                {mgToGrams(remainingCustomerGoldMg)} g
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <p className="text-[11px] text-muted-foreground">
                              {autoSettlementGoldMg >= invoiceFineGoldRequirementMg
                                ? "Customer's gold advance fully settles this invoice. No cash or credit note required."
                                : `Applies ${mgToGrams(autoSettlementGoldMg)} g from balance. Remaining ${mgToGrams(
                                    invoiceFineGoldRequirementMg - autoSettlementGoldMg,
                                  )} g payable via cash or gold.`}
                            </p>
                            <Button
                              size="sm"
                              data-testid="apply-gold-advance-btn"
                              className="h-8 gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs shrink-0"
                              onClick={() => {
                                if (autoSettlementGoldMg <= 0) return;
                                const ratePaise =
                                  currentGoldRatePaise > 0
                                    ? currentGoldRatePaise
                                    : (items[0]?.goldRatePerGramPaise || 700000);
                                const rateStr = (ratePaise / 100).toString();
                                const gramsStr = mgToGrams(autoSettlementGoldMg).toString();

                                const existingIndex = payments.findIndex(
                                  (p) => p.mode === "customer_gold_credit",
                                );
                                if (existingIndex >= 0) {
                                  patchPayment(existingIndex, {
                                    goldGramsStr: gramsStr,
                                    goldPurityStr: "100",
                                    goldRateStr: rateStr,
                                  });
                                  autoFillFromGold(existingIndex, {
                                    goldGramsStr: gramsStr,
                                    goldPurityStr: "100",
                                    goldRateStr: rateStr,
                                  });
                                } else {
                                  const newId = newItemId();
                                  setPayments([
                                    ...payments,
                                    {
                                      id: newId,
                                      mode: "customer_gold_credit",
                                      amountStr: "",
                                      reference: "Gold Advance Usage",
                                      notes: `Settled from customer existing gold balance (${gramsStr}g fine)`,
                                      goldGramsStr: gramsStr,
                                      goldPurityStr: "100",
                                      goldRateStr: rateStr,
                                    },
                                  ]);
                                }
                                toast.success(
                                  `Applied ${gramsStr} g Fine Gold from customer's existing balance.`,
                                );
                              }}
                            >
                              <Coins className="h-3.5 w-3.5" /> Apply Existing Gold Balance
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-3">
                      {payments.map((p, idx) => {
                      const isGold = p.mode === "gold_exchange" || p.mode === "customer_gold_credit";
                      const paymentFineMg = isGold
                        ? fineGoldMgConfigured(
                            gramsToMg(p.goldGramsStr),
                            Math.round(Number(p.goldPurityStr) || 0),
                          )
                        : 0;
                      const modeColor = isGold
                        ? "border-gold/30 bg-gold/5"
                        : p.mode === "cash"
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-border bg-background/30";
                      const ModeIcon = isGold
                        ? Coins
                        : p.mode === "cash"
                          ? Banknote
                          : p.mode === "upi"
                            ? Smartphone
                            : CreditCard;
                      return (
                        <div key={p.id} className={`rounded-md border ${modeColor} overflow-hidden`}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <ModeIcon
                              className={`h-4 w-4 flex-shrink-0 ${isGold ? "text-gold" : p.mode === "cash" ? "text-emerald-500" : "text-muted-foreground"}`}
                            />
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                              <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                                  Mode
                                </Label>
                                <Select
                                  value={p.mode}
                                  onValueChange={(v) => changePaymentMode(idx, v as PaymentMode)}
                                >
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gold_exchange">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Coins className="h-3.5 w-3.5 text-gold" /> Gold Payment / सोन्यात
                                        पेमेंट
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="customer_gold_credit">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Wallet className="h-3.5 w-3.5 text-gold" /> Use Gold Advance
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="cash">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Banknote className="h-3.5 w-3.5" /> Cash / रोख रक्कम
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="anamat">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Wallet className="h-3.5 w-3.5" /> Anamat / अमानत (Deposit)
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="upi">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Smartphone className="h-3.5 w-3.5" /> UPI (GPay / PhonePe)
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="bank">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Landmark className="h-3.5 w-3.5" /> Bank Transfer / NEFT
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="card">
                                      <span className="inline-flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5" /> Card / Debit / Credit
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="cheque">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Receipt className="h-3.5 w-3.5" /> Cheque / धनादेश
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="advance">
                                      <span className="inline-flex items-center gap-1.5">
                                        <Undo2 className="h-3.5 w-3.5" /> Advance Adjustment
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                        <div>
                          <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                            {isGold ? "Gold Settled" : "Amount (₹)"}
                          </Label>
                          <div className="flex gap-1.5 items-center">
                            {isGold ? (
                              <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 w-full flex items-center justify-between">
                                <div>
                                  <div className="text-[9px] font-semibold uppercase text-gold/80">
                                    Paid in Gold
                                  </div>
                                  <div className="font-mono font-bold text-gold text-sm">
                                    <GoldWeightDisplay mg={paymentFineMg} kind="fine" />
                                  </div>
                                </div>
                                <Badge variant="outline" className="border-gold/40 text-gold text-[9px] bg-gold/10 font-mono">
                                  PAID IN GOLD
                                </Badge>
                              </div>
                            ) : (
                              <>
                                <Input
                                  type="number"
                                  value={p.amountStr}
                                  onChange={(e) => patchPayment(idx, { amountStr: e.target.value })}
                                  className="h-9 text-sm font-mono font-bold"
                                  placeholder="0"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 text-[10px] px-2.5 text-gold font-bold bg-gold/5 border border-gold/20 whitespace-nowrap"
                                  onClick={() => autoFillRemaining(idx)}
                                >
                                  Fill Due
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1.5 items-end">
                          <div className="flex-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                              Reference / Narration
                            </Label>
                            <Input
                              value={p.reference}
                              onChange={(e) => patchPayment(idx, { reference: e.target.value })}
                              placeholder={isGold ? "Payment in Gold" : "Ref / UTR / Cheque No."}
                              className="h-9 text-xs"
                            />
                          </div>
                          {payments.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-9 w-9"
                              onClick={() => removePaymentRow(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Gold Payment / Gold Credit Sub-fields — fully redesigned */}
                    {(p.mode === "gold_exchange" || p.mode === "customer_gold_credit") && (
                      <div className="mt-3 pt-3 border-t border-gold/20 bg-gradient-to-b from-gold/5 to-transparent p-4 rounded-md space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gold mb-1 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {p.mode === "gold_exchange"
                            ? "Gold Payment Details / सोने पेमेंट"
                            : "Using Customer's Gold Advance"}
                        </div>
                        {/* Input row */}
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Gross Wt (g)
                            </Label>
                            <WeightInput
                              valueGrams={p.goldGramsStr ? parseFloat(p.goldGramsStr) : null}
                              onChange={(g) => {
                                const val = g != null ? String(g) : "";
                                patchPayment(idx, { goldGramsStr: val });
                                autoFillFromGold(idx, { goldGramsStr: val });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Melt Loss (g)
                            </Label>
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              value={p.goldMeltLossWtDeductionStr ?? ""}
                              onChange={(e) => {
                                patchPayment(idx, { goldMeltLossWtDeductionStr: e.target.value });
                                autoFillFromGold(idx, {
                                  goldMeltLossWtDeductionStr: e.target.value,
                                });
                              }}
                              className="h-8 text-xs font-mono border-gold/30 focus-visible:border-gold"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Melt Loss (%)
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={p.goldMeltLossPctDeductionStr ?? ""}
                              onChange={(e) => {
                                patchPayment(idx, { goldMeltLossPctDeductionStr: e.target.value });
                                autoFillFromGold(idx, {
                                  goldMeltLossPctDeductionStr: e.target.value,
                                });
                              }}
                              className="h-8 text-xs font-mono border-gold/30 focus-visible:border-gold"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Purity (Touch)
                            </Label>
                            <Input
                              value={p.goldPurityStr}
                              onChange={(e) => {
                                patchPayment(idx, { goldPurityStr: e.target.value });
                                autoFillFromGold(idx, { goldPurityStr: e.target.value });
                              }}
                              placeholder="916"
                              className="h-8 text-xs font-mono border-gold/30 focus-visible:border-gold"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Rate ₹/g
                            </Label>
                            <div className="flex gap-1 items-center">
                              <Input
                                value={p.goldRateStr}
                                onChange={(e) => {
                                  patchPayment(idx, {
                                    goldRateStr: e.target.value,
                                    goldRateManuallyOverridden: true,
                                  });
                                  autoFillFromGold(idx, { goldRateStr: e.target.value });
                                }}
                                placeholder="Market rate"
                                className="h-8 text-xs font-mono border-gold/30 focus-visible:border-gold w-20"
                              />
                              <select
                                className="h-8 text-[10px] border border-gold/30 rounded px-1 bg-background focus:outline-none focus:ring-1 focus:ring-gold"
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const val = parseInt(e.target.value, 10);
                                    patchPayment(idx, {
                                      goldRateStr: paiseToRupees(val),
                                      goldRateManuallyOverridden: true,
                                    });
                                    autoFillFromGold(idx, { goldRateStr: paiseToRupees(val) });
                                  }
                                }}
                              >
                                <option value="" disabled>
                                  Branch Rate
                                </option>
                                {useSettings.getState().branches.map((b) => {
                                  const rates = getBranchBullionRates(b.id);
                                  const purity = Math.round(Number(p.goldPurityStr) || 916);
                                  let rate = rates.gold22KPerGramPaise;
                                  if (purity >= 990) rate = rates.gold24KPerGramPaise;
                                  else if (purity <= 780 && purity > 0)
                                    rate = rates.gold18KPerGramPaise;
                                  return (
                                    <option key={b.id} value={rate}>
                                      {b.code}: ₹{paiseToRupees(rate)}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        </div>
                        {/* Live calculation chain */}
                        {(() => {
                          try {
                            const grossG = parseFloat(p.goldGramsStr) || 0;
                            const wtDed = parseFloat(p.goldMeltLossWtDeductionStr || "") || 0;
                            const pctDed = parseFloat(p.goldMeltLossPctDeductionStr || "") || 0;
                            const netG = Math.max(0, grossG - wtDed - (grossG * pctDed) / 100);

                            const netMgVal = Math.round(netG * 1000);
                            const purityVal = Math.round(Number(p.goldPurityStr) || 0);
                            const fine = purityVal > 0 ? fineGoldMgConfigured(netMgVal, purityVal) : 0;
                            const rateP = rupeesToPaise(p.goldRateStr);
                            const goldValue =
                              fine > 0 && rateP > 0 ? Math.round((fine * rateP) / 1000) : 0;
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Gross / Net Wt</div>
                                  <div className="font-bold text-foreground">
                                    <GoldWeightDisplay grams={grossG} kind="gross" /> / <GoldWeightDisplay grams={netG} kind="net" />
                                  </div>
                                </div>
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Fine Gold</div>
                                  <div className="font-bold text-gold">
                                    <GoldWeightDisplay mg={fine} kind="fine" />
                                  </div>
                                </div>
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Rate</div>
                                  <div className="font-bold text-foreground">
                                    <MoneyDisplay paise={rateP} /> / g
                                  </div>
                                </div>
                                <div className="bg-gold/15 border border-gold/40 rounded-lg p-2 text-center">
                                  <div className="text-gold/70 mb-0.5">Valued Amount</div>
                                  <div className="font-bold text-gold text-xs">
                                    <MoneyDisplay paise={goldValue} />
                                  </div>
                                </div>
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        {/* Customer gold balance display for credit mode */}
                        {p.mode === "customer_gold_credit" &&
                          (jewellerBook?.goldHeldMg || 0) !== 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                              <div
                                className={`text-[10px] font-mono px-3 py-1.5 rounded-lg flex items-center justify-between ${
                                  jewellerBook && jewellerBook.goldHeldMg > 0
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                }`}
                              >
                                <span>Gold Advance Available:</span>
                                <span className="font-bold">
                                  <GoldWeightDisplay mg={Math.abs(jewellerBook?.goldHeldMg || 0)} kind="fine" />
                                </span>
                              </div>

                              {jewellerBook &&
                                jewellerBook.goldHeldMg > 0 &&
                                totals.balancePaise > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] w-full border-gold text-gold hover:bg-gold/10"
                                    onClick={() => {
                                      const rateStr =
                                        p.goldRateStr || (firstItemGoldRate / 100).toString();
                                      const ratePaise = rupeesToPaise(rateStr);
                                      if (ratePaise <= 0) {
                                        toast.error("Please enter a valid gold rate first");
                                        return;
                                      }
                                      const fineMgNeeded = Math.round(
                                        (totals.balancePaise * 1000) / ratePaise,
                                      );
                                      const availableMg = jewellerBook.goldHeldMg;
                                      const fineToApply = Math.min(fineMgNeeded, availableMg);

                                      const gramsStr = mgToGrams(fineToApply).toString();
                                      const purityStr = "100";

                                      patchPayment(idx, {
                                        goldGramsStr: gramsStr,
                                        goldPurityStr: purityStr,
                                        goldRateStr: rateStr,
                                      });
                                      autoFillFromGold(idx, {
                                        goldGramsStr: gramsStr,
                                        goldPurityStr: purityStr,
                                        goldRateStr: rateStr,
                                      });
                                    }}
                                  >
                                    Apply Gold Advance
                                  </Button>
                                )}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Cash / Money Payment — Redesigned Visual Hierarchy */}
                    {!isGold && p.mode !== "outstanding" && parseFloat(p.amountStr) > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-500/20 bg-emerald-500/5 p-3.5 rounded-xl space-y-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Banknote className="h-3.5 w-3.5" />
                            Payment Method: {PAYMENT_MODE_LABELS[p.mode] || p.mode.toUpperCase()}
                          </span>
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px] bg-emerald-500/10 font-mono">
                            Actual Payment: Cash
                          </Badge>
                        </div>
                        {(() => {
                          const cashPaise = rupeesToPaise(p.amountStr);
                          const ratePaise =
                            currentGoldRatePaise > 0
                              ? currentGoldRatePaise
                              : (items[0]?.goldRatePerGramPaise || 700000);
                          const goldEquivMg = ratePaise > 0 ? Math.round((cashPaise * 1000) / ratePaise) : 0;
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                              <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20">
                                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Cash Paid</div>
                                <div className="font-bold text-foreground text-sm mt-0.5">
                                  <MoneyDisplay paise={cashPaise} />
                                </div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                                <div className="text-muted-foreground text-[10px] uppercase font-semibold">Gold Rate Used</div>
                                <div className="font-bold text-gold text-sm mt-0.5">
                                  <MoneyDisplay paise={ratePaise} /> <span className="text-[10px] font-sans text-muted-foreground">/ g</span>
                                </div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/20">
                                <div className="text-emerald-400 text-[10px] uppercase font-semibold">Gold-First Equiv</div>
                                <div className="font-bold text-emerald-400 text-sm mt-0.5">
                                  <GoldWeightDisplay mg={goldEquivMg} kind="fine" />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Section>
  )}
</div>

        {/* Section 4: Invoice Summary Side Panel */}
        <div className="space-y-6">
          <div className="rounded-md border border-border bg-card p-4 space-y-4 lg:sticky lg:top-6">
            <div className="text-xs uppercase tracking-wider font-black text-muted-foreground">
              Invoice Summary
            </div>

            {/* Dedicated Job-Work Manufacturing Bill Summary */}
            {billingType === "manufacturing" ? (
              <div className="space-y-4">
                {/* Gold-First Total */}
                <div className="rounded-md border border-gold/30 bg-gold/5 p-3.5 space-y-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-gold font-black uppercase tracking-wider font-sans">
                    <span>Job-Work Obligation</span>
                    <Badge variant="outline" className="border-gold/40 text-gold text-[10px]">
                      Gold-First
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Total Job-Work Obligation</span>
                    <span className="font-bold text-gold">
                      <GoldWeightDisplay mg={items.reduce((s, it) => s + it.fineMg, 0)} kind="fine" />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Physical Gold Received</span>
                    <span className="font-bold text-emerald-400">
                      <GoldWeightDisplay mg={mfgMpEntries.reduce((s, e) => s + e.fineMg, 0)} kind="fine" />
                    </span>
                  </div>
                  {payments.some((p) => p.mode === "cash" || p.mode === "upi" || p.mode === "bank") && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Cash Settlement (Equiv)</span>
                      <span className="font-bold text-emerald-400">
                        {(() => {
                          const cashPaise = payments.reduce(
                            (s, p) =>
                              p.mode === "cash" || p.mode === "upi" || p.mode === "bank"
                                ? s + rupeesToPaise(p.amountStr)
                                : s,
                            0,
                          );
                          const bhavRate =
                            parseFloat(mfgGoldBhavStr || "0") > 0
                              ? Math.round((parseFloat(mfgGoldBhavStr) / 10) * 100)
                              : currentGoldRatePaise > 0
                                ? currentGoldRatePaise
                                : 750000;
                          const equivMg = bhavRate > 0 ? Math.round((cashPaise / bhavRate) * 1000) : 0;
                          return <GoldWeightDisplay mg={equivMg} kind="fine" />;
                        })()}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gold/30 pt-2 flex justify-between font-black text-gold">
                    <span className="font-sans">Grand Total (Gold)</span>
                    <span className="text-base font-bold">
                      <GoldWeightDisplay mg={items.reduce((s, it) => s + it.fineMg, 0)} kind="fine" />
                    </span>
                  </div>
                </div>

                {/* Settlement & Balance breakdown */}
                {(() => {
                  const totalObligationMg = items.reduce((s, it) => s + it.fineMg, 0);
                  const totalMpFineMg = mfgMpEntries.reduce((s, e) => s + e.fineMg, 0);
                  const cashPaise = payments.reduce(
                    (s, p) =>
                      p.mode === "cash" || p.mode === "upi" || p.mode === "bank"
                        ? s + rupeesToPaise(p.amountStr)
                        : s,
                    0,
                  );
                  const bhavRate =
                    parseFloat(mfgGoldBhavStr || "0") > 0
                      ? Math.round((parseFloat(mfgGoldBhavStr) / 10) * 100)
                      : currentGoldRatePaise > 0
                        ? currentGoldRatePaise
                        : 750000;
                  const cashEquivMg = bhavRate > 0 ? Math.round((cashPaise / bhavRate) * 1000) : 0;
                  const totalSettledMg = totalMpFineMg + cashEquivMg;
                  const outstandingMg = Math.max(0, totalObligationMg - totalSettledMg);

                  const statusLabel =
                    totalObligationMg === 0
                      ? "UNSETTLED"
                      : outstandingMg === 0
                        ? cashPaise > 0 && totalMpFineMg > 0
                          ? "SETTLED WITH GOLD + CASH"
                          : cashPaise > 0
                            ? "SETTLED IN FULL (CASH)"
                            : "SETTLED FROM GOLD"
                        : totalSettledMg > 0
                          ? "PARTIALLY SETTLED"
                          : "UNSETTLED";

                  return (
                    <div className="rounded-md border border-border bg-card p-3.5 space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold font-sans">
                          Live Settlement Status
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            outstandingMg === 0
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : totalSettledMg > 0
                                ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                : "border-rose-500/40 text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {statusLabel}
                        </Badge>
                      </div>

                      <div className="flex justify-between font-semibold text-emerald-500">
                        <span className="font-sans">Paid / Settled (Gold):</span>
                        <span className="text-sm font-bold">
                          <GoldWeightDisplay mg={totalSettledMg} kind="fine" />
                        </span>
                      </div>

                      <div className="flex justify-between font-bold text-rose-500 border-t border-border pt-2">
                        <span className="font-sans">Outstanding (Gold):</span>
                        <span className="text-base font-bold">
                          <GoldWeightDisplay mg={outstandingMg} kind="fine" />
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Non-manufacturing billing: 3-Tier Hierarchy */
              <>
                {/* Tier 1: Gold-First Fine Gold Obligation */}
                <div className="rounded-md border border-gold/30 bg-gold/5 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gold font-black uppercase tracking-wider">
                    <span>Gold-First Total</span>
                    <span className="font-mono"><MoneyDisplay paise={goldTotals.ratePerGramPaise} /> / g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product Fine Gold</span>
                    <span className="font-mono font-bold text-gold">
                      <GoldWeightDisplay mg={goldTotals.productFineMg} kind="fine" />
                    </span>
                  </div>
                  {goldTotals.makingChargesMg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Making / Labour (Gold)</span>
                      <span className="font-mono"><GoldWeightDisplay mg={goldTotals.makingChargesMg} kind="fine" /></span>
                    </div>
                  )}
                  {goldTotals.stoneChargesMg + goldTotals.hallmarkChargesMg + goldTotals.otherChargesMg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stone & Charges (Gold)</span>
                      <span className="font-mono">
                        <GoldWeightDisplay
                          mg={
                            goldTotals.stoneChargesMg +
                            goldTotals.hallmarkChargesMg +
                            goldTotals.otherChargesMg
                          }
                          kind="fine"
                        />
                      </span>
                    </div>
                  )}
                  {(goldTotals.gstMg > 0 || totals.gstPaise > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (Gold Equiv)</span>
                      <span className="font-mono">
                        <GoldWeightDisplay
                          mg={goldTotals.gstMg || paiseToFineGoldMg(totals.gstPaise, goldTotals.ratePerGramPaise)}
                          kind="fine"
                        />
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gold/30 pt-2 flex justify-between font-black text-gold">
                    <span>Total Obligation (Gold)</span>
                    <span className="font-mono text-base font-bold">
                      <GoldWeightDisplay mg={goldTotals.grandTotalMg} kind="fine" />
                    </span>
                  </div>
                </div>

                {/* Tier 2: Monetary Calculations Panel (Cash Equivalent) */}
                <div className="space-y-2 border-b border-border pb-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal (Net Value):</span>
                    <span className="font-mono"><MoneyDisplay paise={totals.subtotalPaise} /></span>
                  </div>
                  {totals.adjustmentPaise > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Adv. Adjusted / वजावट:</span>
                      <span className="font-mono">- <MoneyDisplay paise={totals.adjustmentPaise} /></span>
                    </div>
                  )}
                  {totals.gstPaise > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST (CGST+SGST):</span>
                      <span className="font-mono"><MoneyDisplay paise={totals.gstPaise} /></span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex justify-between font-extrabold text-sm text-foreground">
                    <span>GRAND TOTAL (₹):</span>
                    <span className="font-mono text-gold text-base">
                      <MoneyDisplay paise={totals.grandTotalPaise} />
                    </span>
                  </div>
                </div>

                {/* Tier 3: Settlement Panel */}
                <div className="space-y-2 text-xs">
                  {payments
                    .filter((p) => (p.mode === "gold_exchange" || p.mode === "customer_gold_credit") && p.goldGramsStr)
                    .map((p, i) => {
                      try {
                        const grossG = parseFloat(p.goldGramsStr) || 0;
                        const wtDed = parseFloat(p.goldMeltLossWtDeductionStr || "") || 0;
                        const pctDed = parseFloat(p.goldMeltLossPctDeductionStr || "") || 0;
                        const netG = Math.max(0, grossG - wtDed - (grossG * pctDed) / 100);
                        const fine = fineGoldMgConfigured(
                          Math.round(netG * 1000),
                          Math.round(Number(p.goldPurityStr) || 0),
                        );
                        return (
                          <div
                            key={i}
                            className="bg-gold/5 border border-gold/20 rounded-lg px-2.5 py-1.5 space-y-0.5"
                          >
                            <div className="flex justify-between font-semibold text-gold">
                              <span>Received in Gold</span>
                              <span className="font-mono">
                                <GoldWeightDisplay grams={grossG} kind="gross" />
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>Touch {p.goldPurityStr || "916"} → Fine</span>
                              <span className="font-mono text-gold font-bold">
                                <GoldWeightDisplay mg={fine} kind="fine" />
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[11px]">
                              <span>Cash Value @ ₹{p.goldRateStr || paiseToRupees(goldTotals.ratePerGramPaise)}/g</span>
                              <span className="font-mono">
                                <MoneyDisplay paise={rupeesToPaise(p.amountStr)} />
                              </span>
                            </div>
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })}

                  {payments
                    .filter((p) => p.mode !== "gold_exchange" && p.mode !== "customer_gold_credit" && rupeesToPaise(p.amountStr) > 0)
                    .map((p, i) => {
                      const amtPaise = rupeesToPaise(p.amountStr);
                      const rateP = goldTotals.ratePerGramPaise || currentGoldRatePaise || 700000;
                      const equivMg = paiseToFineGoldMg(amtPaise, rateP);
                      return (
                        <div
                          key={i}
                          className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 space-y-0.5"
                        >
                          <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>Actual Payment: {p.mode.toUpperCase()}</span>
                            <span className="font-mono">
                              <MoneyDisplay paise={amtPaise} />
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground text-[11px]">
                            <span>Gold Equiv @ ₹{paiseToRupees(rateP)}/g</span>
                            <span className="font-mono font-semibold text-foreground">
                              <GoldWeightDisplay mg={equivMg} kind="fine" />
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  <div className="flex justify-between font-semibold text-emerald-600 pt-1">
                    <span>Total Paid:</span>
                    <div className="text-right font-mono">
                      <div><MoneyDisplay paise={totals.paidPaise} /></div>
                      <div className="text-[10px] text-muted-foreground">
                        (<GoldWeightDisplay mg={goldTotals.paidMg} kind="fine" />)
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold text-rose-500">
                    <span>Balance Due:</span>
                    <div className="text-right font-mono">
                      <div><MoneyDisplay paise={totals.balancePaise} /></div>
                      <div className="text-[10px] text-rose-400 font-normal">
                        (<GoldWeightDisplay mg={goldTotals.balanceMg} kind="fine" />)
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Advance Adjustment Details */}
            {adjustmentLive && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 space-y-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                <div className="font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Advance Applied
                </div>
                {adjustmentLive.cashAdvancePaise > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>Cash Advance:</span>
                    <span>₹ {paiseToRupees(adjustmentLive.cashAdvancePaise)}</span>
                  </div>
                )}
                {adjustmentLive.goldGrossMg > 0 && (
                  <div className="flex justify-between font-mono">
                    <span>Gold:</span>
                    <span>
                      {mgToGrams(adjustmentLive.goldGrossMg)}g ({adjustmentLive.goldPurity} touch)
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={confirm}
              disabled={confirming}
              className="w-full bg-gold hover:bg-gold/90 text-white font-bold h-11 rounded-md text-xs uppercase shadow-lg transition-all"
            >
              {confirming ? "Issuing…" : "Issue Bill & Print / बिल पूर्ण करा"}
            </Button>
          </div>
        </div>
      </div>

      {touchCompact ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-6xl mx-auto px-3 py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Balance</div>
              <div className="font-mono font-bold text-rose-500 truncate">
                ₹ {paiseToRupees(totals.balancePaise)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Total</div>
              <div className="font-mono font-bold text-gold">
                ₹ {paiseToRupees(totals.grandTotalPaise)}
              </div>
            </div>
            <Button
              onClick={confirm}
              disabled={confirming}
              className="h-12 px-5 bg-gold hover:bg-gold/90 text-white font-bold shrink-0"
            >
              {confirming ? "…" : "Issue"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Stock Inspector Dialog */}
      <ReadyStockPickerDialog
        open={readyStockPickerOpen}
        onOpenChange={setReadyStockPickerOpen}
        stockItems={stockItems}
        onSelect={handleSelectStockItem}
      />
      <Dialog open={!!activeInspectedStock} onOpenChange={() => setActiveInspectedStock(null)}>
        <DialogContent className="max-w-xl rounded-md p-6 border-gold/20">
          {activeInspectedStock &&
            (() => {
              const s = activeInspectedStock;
              const currentGoldRate = getCurrentGoldRatePaise() || 0;
              const ratePaise = currentGoldRate;
              const previewGoldValuePaise = Math.round((s.fineMg * ratePaise) / 1000);

              const resolvedPreview = computeStockMakingCharge(
                s,
                previewGoldValuePaise,
                useSettings.getState().makingCharge,
              );
              const makingChargePct4 = resolvedPreview.makingChargePct;
              const makingChargesPaise = resolvedPreview.makingChargesPaise;

              const previewItem: InvoiceItem = {
                id: s.id,
                stockItemId: s.id,
                barcode: s.barcode,
                itemName: s.itemName,
                category: s.category,
                purity: s.purity,
                grossMg: s.grossMg,
                netMg: s.netMg,
                fineMg: s.fineMg,
                goldRatePerGramPaise: ratePaise,
                goldValuePaise: previewGoldValuePaise,
                makingChargesPaise,
                makingChargePct: makingChargePct4,
                stoneChargesPaise: 0,
                hallmarkChargesPaise: 0,
                otherChargesPaise: 0,
                discountPaise: 0,
                lineTotalPaise: 0,
                huid: s.huid || undefined,
                chargeMode: chargeModeForBillingType(billingType),
              };

              const tot = computeItemTotals(previewItem);
              const previewTotals = computeInvoiceTotals([{ ...previewItem, ...tot }], gst);
              const gstPaise = previewTotals.gstPaise;
              const totalAmountWithGst = previewTotals.grandTotalPaise;

              const realPhoto = getRowItemPhoto(s);

              return (
                <div className="grid md:grid-cols-[180px_1fr] gap-6">
                  {/* Photo Section */}
                  <div className="space-y-2">
                    <div className="aspect-square w-full rounded-md overflow-hidden bg-muted/30 border border-border relative flex items-center justify-center">
                      {realPhoto ? (
                        <img
                          src={realPhoto}
                          referrerPolicy="no-referrer"
                          alt={s.itemName}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <StockPhotoImg
                          stockItem={s}
                          className="h-full w-full object-contain p-1"
                          fallback={
                            <span className="text-muted-foreground text-xs text-center px-2">
                              No photo uploaded
                            </span>
                          }
                        />
                      )}
                    </div>
                  </div>

                  {/* Product Specification Details */}
                  <div className="space-y-4">
                    <DialogHeader>
                      <DialogTitle className="text-base font-serif font-black text-foreground flex items-center gap-1.5">
                        <span>{s.itemName}</span>
                      </DialogTitle>
                      <DialogDescription className="text-xs font-mono">
                        Code: {s.itemCode} · Barcode: {s.barcode}{" "}
                        {s.huid ? `· HUID: ${s.huid}` : ""}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3 text-xs border-y border-border py-3">
                      <div>
                        Purity: <strong className="font-mono text-gold">{s.purity} Touch</strong>
                      </div>
                      <div>
                        Gross Weight:{" "}
                        <strong className="font-mono">{mgToGrams(s.grossMg)} g</strong>
                      </div>
                      <div>
                        Net Weight: <strong className="font-mono">{mgToGrams(s.netMg)} g</strong>
                      </div>
                      <div>
                        Fine Equivalent:{" "}
                        <strong className="font-mono">{mgToGrams(previewItem.fineMg)} g</strong>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between font-mono">
                        <span>
                          Gold Price ({mgToGrams(previewItem.fineMg)}g fine @ ₹
                          {paiseToRupees(ratePaise)}/g):
                        </span>
                        <span>₹ {paiseToRupees(previewItem.goldValuePaise)}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>
                          Making Charges ({previewItem.makingChargePct ?? 0}% of gold value):
                        </span>
                        <span>₹ {paiseToRupees(previewItem.makingChargesPaise)}</span>
                      </div>
                      {gstPaise > 0 && (
                        <div className="flex justify-between font-mono text-slate-500">
                          <span>Est. GST (same base as the bill):</span>
                          <span>₹ {paiseToRupees(gstPaise)}</span>
                        </div>
                      )}
                      <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold text-sm text-foreground">
                        <span>EST. TOTAL WITH GST:</span>
                        <span className="font-mono text-gold">
                          ₹ {paiseToRupees(totalAmountWithGst)}
                        </span>
                      </div>
                    </div>

                    <DialogFooter className="flex gap-2 justify-end pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveInspectedStock(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          handleSelectStockItem(s);
                          setActiveInspectedStock(null);
                          setStockSearchQuery("");
                        }}
                        className="bg-gold hover:bg-gold/90 text-white font-bold text-xs gap-1"
                      >
                        <Plus className="h-4 w-4 shrink-0" /> Add to Invoice
                      </Button>
                    </DialogFooter>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponent: Section card wrapper
function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider font-extrabold text-foreground font-serif">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

// Subcomponent: Single Invoice Item Row — switch routing
function ItemRow(props: {
  it: InvoiceItem;
  idx: number;
  billingType: BillingType;
  variant: "table" | "card";
  touchCompact: boolean;
  scaleReading?: ScaleReading;
  onWeightFocus?: (type: "gross" | "net") => void;
  onWeightBlur?: () => void;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  if (props.billingType === "manufacturing" || props.billingType === "wholesale") {
    return <MfgItemRow {...props} />;
  }
  const inner =
    props.billingType === "advance_receipt" || props.billingType === "payment_receipt" ? (
      <ReceiptItemRow it={props.it} onChange={props.onChange} />
    ) : props.billingType === "repair" || props.billingType === "polishing" ? (
      <ServiceItemRow it={props.it} onChange={props.onChange} onRemove={props.onRemove} />
    ) : (
      <StandardItemRow
        it={props.it}
        idx={props.idx}
        touchCompact={props.touchCompact}
        scaleReading={props.scaleReading}
        onWeightFocus={props.onWeightFocus}
        onWeightBlur={props.onWeightBlur}
        onChange={props.onChange}
        onRemove={props.onRemove}
      />
    );
  if (props.variant === "card") {
    return <div className="w-full">{inner}</div>;
  }
  return (
    <tr>
      <td colSpan={15} className="p-2 align-top">
        {inner}
      </td>
    </tr>
  );
}

function UrdTableRow({
  u,
  setUrdLines,
}: {
  u: InvoiceUrdLine;
  setUrdLines: Dispatch<SetStateAction<InvoiceUrdLine[]>>;
}) {
  return (
    <tr className="border-t border-border/40">
      <td className="p-1">
        <Input
          className="h-7 text-xs"
          value={u.itemName}
          onChange={(e) =>
            setUrdLines((prev) =>
              prev.map((x) => (x.id === u.id ? { ...x, itemName: e.target.value } : x)),
            )
          }
          placeholder="Old gold / URD"
        />
      </td>
      <td className="p-1">
        <Input
          className="h-7 w-16 text-xs font-mono"
          defaultValue={mgToGrams(u.grossMg)}
          onBlur={(e) => {
            try {
              const grossMg = gramsToMg(e.target.value || "0");
              const netMg = Math.max(0, grossMg - u.lessMg);
              const fineMg = Math.round((netMg * u.purity) / 1000);
              const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
              setUrdLines((prev) =>
                prev.map((x) =>
                  x.id === u.id ? { ...x, grossMg, netMg, fineMg, amountPaise } : x,
                ),
              );
            } catch {
              /* */
            }
          }}
        />
      </td>
      <td className="p-1">
        <Input
          className="h-7 w-14 text-xs font-mono"
          defaultValue={mgToGrams(u.lessMg)}
          onBlur={(e) => {
            try {
              const lessMg = gramsToMg(e.target.value || "0");
              const netMg = Math.max(0, u.grossMg - lessMg);
              const fineMg = Math.round((netMg * u.purity) / 1000);
              const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
              setUrdLines((prev) =>
                prev.map((x) =>
                  x.id === u.id ? { ...x, lessMg, netMg, fineMg, amountPaise } : x,
                ),
              );
            } catch {
              /* */
            }
          }}
        />
      </td>
      <td className="p-1 font-mono">{mgToGrams(u.netMg)}</td>
      <td className="p-1">
        <Input
          className="h-7 w-14 text-xs font-mono"
          value={String(u.purity)}
          onChange={(e) => {
            const purity = Math.max(0, Math.min(999, Number(e.target.value) || 0));
            const fineMg = Math.round((u.netMg * purity) / 1000);
            const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
            setUrdLines((prev) =>
              prev.map((x) => (x.id === u.id ? { ...x, purity, fineMg, amountPaise } : x)),
            );
          }}
        />
      </td>
      <td className="p-1 font-mono">{mgToGrams(u.fineMg)}</td>
      <td className="p-1">
        <Input
          className="h-7 w-16 text-xs font-mono"
          value={paiseToRupees(u.ratePerGramPaise)}
          onChange={(e) => {
            const ratePerGramPaise = rupeesToPaise(e.target.value);
            const amountPaise = Math.round((u.fineMg * ratePerGramPaise) / 1000);
            setUrdLines((prev) =>
              prev.map((x) =>
                x.id === u.id ? { ...x, ratePerGramPaise, amountPaise } : x,
              ),
            );
          }}
        />
      </td>
      <td className="p-1 font-mono">₹{paiseToRupees(u.amountPaise)}</td>
      <td className="p-1">
        <Select
          value={String(u.jn ?? 1)}
          onValueChange={(v) =>
            setUrdLines((prev) =>
              prev.map((x) => (x.id === u.id ? { ...x, jn: Number(v) as 1 | 2 } : x)),
            )
          }
        >
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">J</SelectItem>
            <SelectItem value="2">N</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setUrdLines((prev) => prev.filter((x) => x.id !== u.id))}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function UrdCard({
  u,
  touchCompact,
  setUrdLines,
}: {
  u: InvoiceUrdLine;
  touchCompact: boolean;
  setUrdLines: Dispatch<SetStateAction<InvoiceUrdLine[]>>;
}) {
  const ih = touchCompact ? "h-11 text-base" : "h-9 text-sm";
  return (
    <div className="rounded-md border bg-card p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Input
          className={`${ih} flex-1`}
          value={u.itemName}
          onChange={(e) =>
            setUrdLines((prev) =>
              prev.map((x) => (x.id === u.id ? { ...x, itemName: e.target.value } : x)),
            )
          }
          placeholder="Old gold / URD item"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={touchCompact ? "h-11 w-11 shrink-0" : "h-9 w-9 shrink-0"}
          onClick={() => setUrdLines((prev) => prev.filter((x) => x.id !== u.id))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Gr (g)</Label>
          <Input
            className={`${ih} font-mono`}
            defaultValue={mgToGrams(u.grossMg)}
            inputMode="decimal"
            onBlur={(e) => {
              try {
                const grossMg = gramsToMg(e.target.value || "0");
                const netMg = Math.max(0, grossMg - u.lessMg);
                const fineMg = Math.round((netMg * u.purity) / 1000);
                const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
                setUrdLines((prev) =>
                  prev.map((x) =>
                    x.id === u.id ? { ...x, grossMg, netMg, fineMg, amountPaise } : x,
                  ),
                );
              } catch {
                /* */
              }
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Less (g)</Label>
          <Input
            className={`${ih} font-mono`}
            defaultValue={mgToGrams(u.lessMg)}
            inputMode="decimal"
            onBlur={(e) => {
              try {
                const lessMg = gramsToMg(e.target.value || "0");
                const netMg = Math.max(0, u.grossMg - lessMg);
                const fineMg = Math.round((netMg * u.purity) / 1000);
                const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
                setUrdLines((prev) =>
                  prev.map((x) =>
                    x.id === u.id ? { ...x, lessMg, netMg, fineMg, amountPaise } : x,
                  ),
                );
              } catch {
                /* */
              }
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Tanch ‰</Label>
          <Input
            className={`${ih} font-mono`}
            value={String(u.purity)}
            inputMode="numeric"
            onChange={(e) => {
              const purity = Math.max(0, Math.min(999, Number(e.target.value) || 0));
              const fineMg = Math.round((u.netMg * purity) / 1000);
              const amountPaise = Math.round((fineMg * u.ratePerGramPaise) / 1000);
              setUrdLines((prev) =>
                prev.map((x) => (x.id === u.id ? { ...x, purity, fineMg, amountPaise } : x)),
              );
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Rate ₹/g</Label>
          <Input
            className={`${ih} font-mono`}
            value={paiseToRupees(u.ratePerGramPaise)}
            inputMode="decimal"
            onChange={(e) => {
              const ratePerGramPaise = rupeesToPaise(e.target.value);
              const amountPaise = Math.round((u.fineMg * ratePerGramPaise) / 1000);
              setUrdLines((prev) =>
                prev.map((x) =>
                  x.id === u.id ? { ...x, ratePerGramPaise, amountPaise } : x,
                ),
              );
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">J/N</Label>
          <Select
            value={String(u.jn ?? 1)}
            onValueChange={(v) =>
              setUrdLines((prev) =>
                prev.map((x) => (x.id === u.id ? { ...x, jn: Number(v) as 1 | 2 } : x)),
              )
            }
          >
            <SelectTrigger className={ih}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Jama</SelectItem>
              <SelectItem value="2">Nave</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="text-[10px] uppercase text-muted-foreground">Net / Fine / Amt</div>
          <div className="font-mono text-sm font-semibold">
            {mgToGrams(u.netMg)}g · {mgToGrams(u.fineMg)}g · ₹{paiseToRupees(u.amountPaise)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MANUFACTURING ROW COMPONENT ──
function MfgItemRow({
  it,
  variant = "table",
  touchCompact = false,
  scaleReading,
  onWeightFocus,
  onWeightBlur,
  onChange,
  onRemove,
}: {
  it: InvoiceItem;
  idx: number;
  variant?: "table" | "card";
  touchCompact?: boolean;
  scaleReading?: ScaleReading;
  onWeightFocus?: (type: "gross" | "net") => void;
  onWeightBlur?: () => void;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [grossStr, setGrossStr] = useState(() => (it.grossMg ? mgToGrams(it.grossMg).toString() : ""));
  const [lessStr, setLessStr] = useState(() => (it.lessMg ? mgToGrams(it.lessMg).toString() : ""));
  const [tunchStr, setTunchStr] = useState(() => (it.purity ? (it.purity / 10).toFixed(2) : "84.00"));
  const [wstgStr, setWstgStr] = useState(() => (it.wastagePct != null ? it.wastagePct.toFixed(2) : "4.00"));
  const [labourStr, setLabourStr] = useState(() =>
    it.makingChargesPaise ? paiseToRupees(it.makingChargesPaise) : "",
  );
  const [addWtStr, setAddWtStr] = useState(() =>
    it.addMg ? mgToGrams(it.addMg).toString() : "",
  );
  const [hisobStr, setHisobStr] = useState(() => (it.hisobPct != null ? String(it.hisobPct) : ""));
  const [pcsStr, setPcsStr] = useState(() => (it.pcs != null ? String(it.pcs) : "1"));
  const [fineStr, setFineStr] = useState(() => (it.fineMg ? mgToGrams(it.fineMg).toString() : ""));
  const fineEditable = !isJewelleryCalcFeatureEnabled(
    "fineCalculation",
    currentGoldCalculationRules(),
  );
  const ih = touchCompact ? "h-11 text-base" : "h-7 text-xs";

  useEffect(() => {
    if (focusedField !== "gross") setGrossStr(it.grossMg ? mgToGrams(it.grossMg).toString() : "");
  }, [it.grossMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "less") setLessStr(it.lessMg ? mgToGrams(it.lessMg).toString() : "");
  }, [it.lessMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "add") setAddWtStr(it.addMg ? mgToGrams(it.addMg).toString() : "");
  }, [it.addMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "fine") setFineStr(it.fineMg ? mgToGrams(it.fineMg).toString() : "");
  }, [it.fineMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "tunch") setTunchStr(it.purity ? (it.purity / 10).toFixed(2) : "84.00");
  }, [it.purity, focusedField]);

  useEffect(() => {
    if (focusedField !== "wstg") setWstgStr(it.wastagePct != null ? it.wastagePct.toFixed(2) : "4.00");
  }, [it.wastagePct, focusedField]);

  useEffect(() => {
    if (focusedField !== "hisob") setHisobStr(it.hisobPct != null ? String(it.hisobPct) : "");
  }, [it.hisobPct, focusedField]);

  useEffect(() => {
    if (focusedField !== "labour") setLabourStr(it.makingChargesPaise ? paiseToRupees(it.makingChargesPaise) : "");
  }, [it.makingChargesPaise, focusedField]);

  useEffect(() => {
    if (focusedField !== "pcs") setPcsStr(it.pcs != null ? String(it.pcs) : "1");
  }, [it.pcs, focusedField]);

  function commitMfgWeights(overrides?: {
    gross?: string;
    less?: string;
    add?: string;
    tunch?: string;
    wstg?: string;
    hisob?: string;
    labour?: string;
    pcs?: string;
    fineMg?: number;
    syncHisobFromTanch?: boolean;
  }) {
    const curGrossStr = overrides?.gross !== undefined ? overrides.gross : grossStr;
    const curLessStr = overrides?.less !== undefined ? overrides.less : lessStr;
    const curAddStr = overrides?.add !== undefined ? overrides.add : addWtStr;
    const curTunchStr = overrides?.tunch !== undefined ? overrides.tunch : tunchStr;
    const curWstgStr = overrides?.wstg !== undefined ? overrides.wstg : wstgStr;
    const curHisobStr = overrides?.hisob !== undefined ? overrides.hisob : hisobStr;
    const curLabourStr = overrides?.labour !== undefined ? overrides.labour : labourStr;
    const curPcsStr = overrides?.pcs !== undefined ? overrides.pcs : pcsStr;

    const tunchPct = parseFloat(curTunchStr) || 0;
    const wstgPct = parseFloat(curWstgStr) || 0;
    let lessMg = 0;
    let addMg = 0;
    let grossMg = 0;
    try {
      grossMg = gramsToMg(curGrossStr || "0");
      lessMg = gramsToMg(curLessStr || "0");
      addMg = gramsToMg(curAddStr || "0");
    } catch {
      grossMg = it.grossMg;
      lessMg = it.lessMg ?? 0;
      addMg = it.addMg ?? 0;
    }
    const netMg = Math.max(0, grossMg + addMg - lessMg);
    const expectedHisob = Math.round((tunchPct + wstgPct) * 100) / 100;
    let hisobPct: number | undefined;
    if (overrides?.syncHisobFromTanch) {
      hisobPct = expectedHisob;
      setHisobStr(expectedHisob.toFixed(2));
    } else if (curHisobStr.trim() !== "") {
      hisobPct = parseFloat(curHisobStr) || 0;
    } else {
      hisobPct = expectedHisob;
    }

    const patch: Partial<InvoiceItem> = {
      grossMg,
      lessMg,
      addMg,
      netMg,
      purity: Math.round(tunchPct * 10),
      wastagePct: wstgPct,
      hisobPct,
      pcs: parseInt(curPcsStr, 10) || 1,
      makingChargesPaise: rupeesToPaise(curLabourStr),
      otherChargesPaise: 0,
      stoneChargesPaise: 0,
      diamondWeightMg: 0,
      jn: it.jn ?? 2,
      metalKind: it.metalKind ?? "gold",
    };
    if (overrides?.fineMg != null && Number.isFinite(overrides.fineMg)) {
      patch.fineMg = overrides.fineMg;
    }
    onChange(patch);
  }

  if (variant === "card") {
    return (
      <div className="rounded-md border bg-card p-3 space-y-3 shadow-sm">
        <div className="flex items-start gap-2">
          <Input
            value={it.itemName}
            onChange={(e) => onChange({ itemName: e.target.value })}
            className={`${ih} flex-1 font-semibold`}
            placeholder="Item name"
            data-item-name-input="true"
          />
          {onRemove ? (
            <Button
              variant="ghost"
              size="icon"
              className={`${touchCompact ? "h-11 w-11" : "h-9 w-9"} shrink-0 text-muted-foreground hover:text-destructive`}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Gr (g)</Label>
            <Input
              value={grossStr}
              onFocus={() => {
                setFocusedField("gross");
                onWeightFocus?.("gross");
              }}
              onBlur={() => {
                setFocusedField(null);
                onWeightBlur?.();
                const num = parseFloat(grossStr);
                if (!isNaN(num) && num > 0) setGrossStr(num.toFixed(3));
              }}
              onChange={(e) => {
                const val = e.target.value;
                setGrossStr(val);
                commitMfgWeights({ gross: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
              placeholder="0.000"
            />
            {scaleReading?.isStable && scaleReading.weightGrams > 0 ? (
              <div className="mt-0.5 text-[10px] text-emerald-500 font-mono flex items-center gap-0.5">
                <Scale className="h-2.5 w-2.5" />
                {scaleReading.weightGrams.toFixed(3)}g
              </div>
            ) : null}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Less (g)</Label>
            <Input
              value={lessStr}
              onFocus={() => setFocusedField("less")}
              onBlur={() => {
                setFocusedField(null);
                const num = parseFloat(lessStr);
                if (!isNaN(num) && num > 0) setLessStr(num.toFixed(3));
              }}
              onChange={(e) => {
                const val = e.target.value;
                setLessStr(val);
                commitMfgWeights({ less: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
              placeholder="0.000"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Add (g)</Label>
            <Input
              value={addWtStr}
              onFocus={() => setFocusedField("add")}
              onBlur={() => {
                setFocusedField(null);
                const num = parseFloat(addWtStr);
                if (!isNaN(num) && num > 0) setAddWtStr(num.toFixed(3));
              }}
              onChange={(e) => {
                const val = e.target.value;
                setAddWtStr(val);
                commitMfgWeights({ add: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
              placeholder="0.000"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Net (g)</Label>
            <div className={`${ih} flex items-center font-mono font-semibold`}>{mgToGrams(it.netMg)}</div>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Tanch %</Label>
            <Input
              value={tunchStr}
              onFocus={() => setFocusedField("tunch")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setTunchStr(val);
                commitMfgWeights({ tunch: val, syncHisobFromTanch: true });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Wstg %</Label>
            <Input
              value={wstgStr}
              onFocus={() => setFocusedField("wstg")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setWstgStr(val);
                commitMfgWeights({ wstg: val, syncHisobFromTanch: true });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Hisob %</Label>
            <Input
              value={hisobStr}
              onFocus={() => setFocusedField("hisob")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setHisobStr(val);
                commitMfgWeights({ hisob: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Fine (g)</Label>
            {fineEditable ? (
              <Input
                value={fineStr}
                onFocus={() => setFocusedField("fine")}
                onBlur={() => {
                  setFocusedField(null);
                  const num = parseFloat(fineStr);
                  if (!isNaN(num) && num > 0) setFineStr(num.toFixed(3));
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setFineStr(val);
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0) {
                    commitMfgWeights({ fineMg: Math.round(num * 1000) });
                  }
                }}
                className={`${ih} font-mono font-bold text-amber-600 w-full`}
                inputMode="decimal"
              />
            ) : (
              <div className={`${ih} flex items-center font-mono font-bold text-amber-600`}>
                {mgToGrams(it.fineMg)}
              </div>
            )}
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Pcs</Label>
            <Input
              value={pcsStr}
              onFocus={() => setFocusedField("pcs")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setPcsStr(val);
                commitMfgWeights({ pcs: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Lab ₹</Label>
            <Input
              value={labourStr}
              onFocus={() => setFocusedField("labour")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setLabourStr(val);
                commitMfgWeights({ labour: val });
              }}
              className={`${ih} font-mono w-full`}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">J/N</Label>
            <Select
              value={String(it.jn ?? 2)}
              onValueChange={(v) => onChange({ jn: Number(v) as 1 | 2 })}
            >
              <SelectTrigger className={ih}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Jama</SelectItem>
                <SelectItem value="2">Nave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end">
            <div className="text-[10px] uppercase text-muted-foreground">Rate / Amt</div>
            <div className="font-mono text-sm font-semibold text-gold">
              ₹{paiseToRupees(it.goldRatePerGramPaise)}/g · ₹{paiseToRupees(it.lineTotalPaise)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <tr className="border-t border-border/40 align-top text-xs">
      <td className="p-1">
        <Input
          value={it.itemName}
          onChange={(e) => onChange({ itemName: e.target.value })}
          className="h-8 text-xs min-h-[40px]"
          placeholder="Item"
          data-item-name-input="true"
        />
      </td>
      <td className="p-1">
        <Input
          value={grossStr}
          onFocus={() => {
            setFocusedField("gross");
            onWeightFocus?.("gross");
          }}
          onBlur={() => {
            setFocusedField(null);
            onWeightBlur?.();
            const num = parseFloat(grossStr);
            if (!isNaN(num) && num > 0) setGrossStr(num.toFixed(3));
          }}
          onChange={(e) => {
            const val = e.target.value;
            setGrossStr(val);
            commitMfgWeights({ gross: val });
          }}
          className="h-8 w-20 text-xs font-mono min-h-[40px]"
          placeholder="0.000"
          title="Gross weight"
        />
      </td>
      <td className="p-1">
        <Input
          value={lessStr}
          onFocus={() => setFocusedField("less")}
          onBlur={() => {
            setFocusedField(null);
            const num = parseFloat(lessStr);
            if (!isNaN(num) && num > 0) setLessStr(num.toFixed(3));
          }}
          onChange={(e) => {
            const val = e.target.value;
            setLessStr(val);
            commitMfgWeights({ less: val });
          }}
          className="h-8 w-16 text-xs font-mono min-h-[40px]"
          placeholder="0.000"
          title="Less weight"
        />
      </td>
      <td className="p-1">
        <Input
          value={addWtStr}
          onFocus={() => setFocusedField("add")}
          onBlur={() => {
            setFocusedField(null);
            const num = parseFloat(addWtStr);
            if (!isNaN(num) && num > 0) setAddWtStr(num.toFixed(3));
          }}
          onChange={(e) => {
            const val = e.target.value;
            setAddWtStr(val);
            commitMfgWeights({ add: val });
          }}
          className="h-8 w-16 text-xs font-mono min-h-[40px]"
          placeholder="0.000"
          title="Add weight (Offline Add_wt)"
        />
      </td>
      <td className="p-1 font-mono whitespace-nowrap" title="Net = Gr − Less + Add">
        {mgToGrams(it.netMg)}
      </td>
      <td className="p-1">
        <Input
          value={tunchStr}
          onFocus={() => setFocusedField("tunch")}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => {
            const val = e.target.value;
            setTunchStr(val);
            commitMfgWeights({ tunch: val, syncHisobFromTanch: true });
          }}
          className="h-8 w-16 text-xs font-mono min-h-[40px]"
          placeholder="84.00"
          title="Tanch / touch %"
        />
      </td>
      <td className="p-1">
        <Input
          value={wstgStr}
          onFocus={() => setFocusedField("wstg")}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => {
            const val = e.target.value;
            setWstgStr(val);
            commitMfgWeights({ wstg: val, syncHisobFromTanch: true });
          }}
          className="h-8 w-14 text-xs font-mono min-h-[40px]"
          placeholder="4.00"
          title="Wastage %"
        />
      </td>
      <td className="p-1">
        <Input
          value={hisobStr}
          onFocus={() => setFocusedField("hisob")}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => {
            const val = e.target.value;
            setHisobStr(val);
            commitMfgWeights({ hisob: val });
          }}
          className="h-8 w-14 text-xs font-mono min-h-[40px]"
          placeholder="—"
          title="Hisob % (Tanch+Wstg; editable)"
        />
      </td>
      <td className="p-1 font-mono font-bold text-amber-600 whitespace-nowrap" title="Fine gold">
        {fineEditable ? (
          <Input
            value={fineStr}
            onFocus={() => setFocusedField("fine")}
            onBlur={() => {
              setFocusedField(null);
              const num = parseFloat(fineStr);
              if (!isNaN(num) && num > 0) setFineStr(num.toFixed(3));
            }}
            onChange={(e) => {
              const val = e.target.value;
              setFineStr(val);
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                commitMfgWeights({ fineMg: Math.round(num * 1000) });
              }
            }}
            className="h-8 w-16 text-xs font-mono font-bold text-amber-600 min-h-[40px]"
            title="Fine (user-authoritative when fine calc off)"
          />
        ) : (
          mgToGrams(it.fineMg)
        )}
      </td>
      <td className="p-1">
        <Input
          value={pcsStr}
          onFocus={() => setFocusedField("pcs")}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => {
            const val = e.target.value;
            setPcsStr(val);
            commitMfgWeights({ pcs: val });
          }}
          className="h-8 w-12 text-xs font-mono min-h-[40px]"
          placeholder="1"
          type="number"
          title="Pieces"
        />
      </td>
      <td className="p-1">
        <Input
          value={labourStr}
          onFocus={() => setFocusedField("labour")}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => {
            const val = e.target.value;
            setLabourStr(val);
            commitMfgWeights({ labour: val });
          }}
          className="h-8 w-16 text-xs font-mono min-h-[40px]"
          placeholder="0"
          title="Labour"
        />
      </td>
      <td className="p-1 font-mono whitespace-nowrap" title="Rate per gram">
        {paiseToRupees(it.goldRatePerGramPaise)}
      </td>
      <td className="p-1 font-mono whitespace-nowrap" title="Amount">
        {paiseToRupees(it.lineTotalPaise)}
      </td>
      <td className="p-1">
        <Select
          value={String(it.jn ?? 2)}
          onValueChange={(v) => onChange({ jn: Number(v) as 1 | 2 })}
        >
          <SelectTrigger className="h-8 w-14 text-xs min-h-[40px]" title="Jama / Nave">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">J</SelectItem>
            <SelectItem value="2">N</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="p-1">
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

// ── RECEIPT ROW COMPONENT ──
function ReceiptItemRow({
  it,
  onChange,
}: {
  it: InvoiceItem;
  onChange: (diff: Partial<InvoiceItem>) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-gold/30 bg-gold/5 p-4 space-y-3">
      <div className="font-semibold text-xs text-gold flex items-center gap-1.5">
        Receipt / Booking Context
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Voucher / Receipt Title</Label>
          <Input
            value={it.itemName}
            onChange={(e) => onChange({ itemName: e.target.value })}
            placeholder="Voucher reference title"
          />
        </div>
        <div>
          <Label>Narration / Booking Details</Label>
          <Input
            value={it.category}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder="Booking details"
          />
        </div>
      </div>
    </div>
  );
}

// ── SERVICE ROW COMPONENT ──
function ServiceItemRow({
  it,
  onChange,
  onRemove,
}: {
  it: InvoiceItem;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  const [mkStr, setMkStr] = useState(paiseToRupees(it.makingChargesPaise).toString());

  return (
    <div className="rounded-md border border-border bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Label>Job / Article Description</Label>
          <Input
            value={it.itemName}
            onChange={(e) => onChange({ itemName: e.target.value })}
            placeholder="Hook soldering, polishing, sizing..."
          />
        </div>
        {onRemove && (
          <Button variant="ghost" size="icon" className="mt-5 text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label>Job Category</Label>
          <Input value={it.category} onChange={(e) => onChange({ category: e.target.value })} />
        </div>
        <div>
          <Label>Charges (₹)</Label>
          <Input
            value={mkStr}
            onChange={(e) => {
              setMkStr(e.target.value);
              onChange({ makingChargesPaise: rupeesToPaise(e.target.value) });
            }}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}

// ── STANDARD INVENTORY/STOCK ROW COMPONENT ──
function StandardItemRow({
  it,
  touchCompact = false,
  scaleReading,
  onWeightFocus,
  onWeightBlur,
  onChange,
  onRemove,
}: {
  it: InvoiceItem;
  idx: number;
  touchCompact?: boolean;
  scaleReading?: ScaleReading;
  onWeightFocus?: (type: "gross" | "net") => void;
  onWeightBlur?: () => void;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  const [showCharges, setShowCharges] = useState(
    () =>
      it.makingChargesPaise +
        it.stoneChargesPaise +
        (it.hallmarkChargesPaise ?? 0) +
        it.otherChargesPaise +
        it.discountPaise >
      0,
  );

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [grossStr, setGrossStr] = useState(() => (it.grossMg ? mgToGrams(it.grossMg).toString() : ""));
  const [lessStr, setLessStr] = useState(() => (it.lessMg ? mgToGrams(it.lessMg).toString() : ""));
  const [addStr, setAddStr] = useState(() => (it.addMg ? mgToGrams(it.addMg).toString() : ""));
  const [netStr, setNetStr] = useState(() => (it.netMg ? mgToGrams(it.netMg).toString() : ""));
  const [purityStr, setPurityStr] = useState(() => (it.purity ? String(it.purity) : "916"));
  const [wstgStr, setWstgStr] = useState(() => (it.wastagePct != null && it.wastagePct > 0 ? String(it.wastagePct) : ""));
  const [hisobStr, setHisobStr] = useState(() => (it.hisobPct != null ? String(it.hisobPct) : ""));
  const [pcsStr, setPcsStr] = useState(() => (it.pcs != null ? String(it.pcs) : "1"));
  const [rateStr, setRateStr] = useState(() => (it.goldRatePerGramPaise ? paiseToRupees(it.goldRatePerGramPaise).toString() : ""));
  const [mkPctStr, setMkPctStr] = useState(() =>
    (
      it.makingChargePct ??
      (it.goldValuePaise > 0 ? (it.makingChargesPaise / it.goldValuePaise) * 100 : 0)
    ).toString(),
  );
  const [stStr, setStStr] = useState(() => (it.stoneChargesPaise ? paiseToRupees(it.stoneChargesPaise).toString() : ""));
  const [hmStr, setHmStr] = useState(() => (it.hallmarkChargesPaise ? paiseToRupees(it.hallmarkChargesPaise).toString() : ""));
  const [otStr, setOtStr] = useState(() => (it.otherChargesPaise ? paiseToRupees(it.otherChargesPaise).toString() : ""));
  const [dcStr, setDcStr] = useState(() => (it.discountPaise ? paiseToRupees(it.discountPaise).toString() : ""));
  const [stoneWeightStr, setStoneWeightStr] = useState(() => (it.stoneWeightMg ? mgToGrams(it.stoneWeightMg).toString() : ""));
  const [diamondWeightStr, setDiamondWeightStr] = useState(() =>
    ((it.diamondWeightMg || 0) / 200).toString(),
  );
  const fineEditable = !isJewelleryCalcFeatureEnabled(
    "fineCalculation",
    currentGoldCalculationRules(),
  );
  const [fineStr, setFineStr] = useState(() => (it.fineMg ? mgToGrams(it.fineMg).toString() : ""));

  // Focus-safe synchronization from props
  useEffect(() => {
    if (focusedField !== "gross") setGrossStr(it.grossMg ? mgToGrams(it.grossMg).toString() : "");
  }, [it.grossMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "less") setLessStr(it.lessMg ? mgToGrams(it.lessMg).toString() : "");
  }, [it.lessMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "add") setAddStr(it.addMg ? mgToGrams(it.addMg).toString() : "");
  }, [it.addMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "net") setNetStr(it.netMg ? mgToGrams(it.netMg).toString() : "");
  }, [it.netMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "fine") setFineStr(it.fineMg ? mgToGrams(it.fineMg).toString() : "");
  }, [it.fineMg, focusedField]);

  useEffect(() => {
    if (focusedField !== "purity") setPurityStr(it.purity ? String(it.purity) : "916");
  }, [it.purity, focusedField]);

  useEffect(() => {
    if (focusedField !== "wastage") setWstgStr(it.wastagePct != null && it.wastagePct > 0 ? String(it.wastagePct) : "");
  }, [it.wastagePct, focusedField]);

  useEffect(() => {
    if (focusedField !== "hisob") setHisobStr(it.hisobPct != null ? String(it.hisobPct) : "");
  }, [it.hisobPct, focusedField]);

  useEffect(() => {
    if (focusedField !== "rate") setRateStr(it.goldRatePerGramPaise ? paiseToRupees(it.goldRatePerGramPaise).toString() : "");
  }, [it.goldRatePerGramPaise, focusedField]);

  useEffect(() => {
    if (focusedField !== "pcs") setPcsStr(it.pcs != null ? String(it.pcs) : "1");
  }, [it.pcs, focusedField]);

  useEffect(() => {
    if (focusedField !== "making") {
      const heldPct =
        it.makingChargePct ??
        (it.goldValuePaise > 0 ? (it.makingChargesPaise / it.goldValuePaise) * 100 : 0);
      setMkPctStr(heldPct ? heldPct.toString() : "");
    }
  }, [it.makingChargePct, it.goldValuePaise, it.makingChargesPaise, focusedField]);

  const thumbnailImg = getRowItemPhoto(it);
  const stockItems2 = useStock((s) => s.items);
  const stockRef = it.stockItemId
    ? { id: it.stockItemId }
    : it.barcode
      ? stockItems2.find((s) => s.barcode === it.barcode)
      : undefined;

  const totalChargesPaise =
    it.makingChargesPaise +
    it.stoneChargesPaise +
    (it.hallmarkChargesPaise ?? 0) +
    it.otherChargesPaise;
  const hasCharges =
    totalChargesPaise > 0 ||
    it.discountPaise > 0 ||
    (it.stoneWeightMg || 0) > 0 ||
    (it.diamondWeightMg || 0) > 0;

  return (
    <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <div className="w-14 h-14 rounded-md overflow-hidden border border-border bg-muted/40 flex-shrink-0 flex items-center justify-center">
          {thumbnailImg ? (
            <img src={thumbnailImg} alt={it.itemName} className="h-full w-full object-contain p-0.5" />
          ) : stockRef ? (
            <StockPhotoImg
              stockItem={stockRef}
              className="h-full w-full object-contain p-0.5"
              fallback={
                <span className="text-[8px] text-muted-foreground text-center leading-tight px-1">
                  No
                  <br />
                  Photo
                </span>
              }
            />
          ) : (
            <span className="text-[8px] text-muted-foreground text-center leading-tight px-1">
              No
              <br />
              Photo
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Input
            value={it.itemName}
            onChange={(e) => onChange({ itemName: e.target.value })}
            className="font-bold border-none shadow-none focus-visible:ring-1 focus-visible:ring-gold bg-transparent h-7 px-0 text-base text-foreground"
            placeholder="Item name…"
            data-item-name-input="true"
          />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {it.category && (
              <span className="text-[10px] text-muted-foreground font-medium">{it.category}</span>
            )}
            {it.purity > 0 && (
              <span className="text-[10px] text-muted-foreground">· {it.purity}‰</span>
            )}
            {it.barcode && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 py-0 font-mono text-amber-500 border-amber-500/20"
              >
                {it.barcode}
              </Badge>
            )}
            {it.huid && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 py-0 font-mono text-blue-400 border-blue-400/20"
              >
                HUID: {it.huid}
              </Badge>
            )}
            {it.stockItemId && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 py-0 text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
              >
                Inventory
              </Badge>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-bold text-gold font-mono text-lg leading-none">
            ₹{Number(paiseToRupees(it.lineTotalPaise)).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Line Total</div>
        </div>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 flex-shrink-0 ml-1"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className={`grid grid-cols-2 ${touchCompact ? "sm:grid-cols-2" : "sm:grid-cols-5"} sm:divide-x divide-border/50 bg-background/30 text-xs`}>
        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Gross (g)
          </div>
          <Input
            id={`grossMg-${it.id}`}
            type="text"
            inputMode="decimal"
            value={grossStr}
            onFocus={() => {
              setFocusedField("gross");
              onWeightFocus?.("gross");
            }}
            onBlur={() => {
              setFocusedField(null);
              onWeightBlur?.();
              const num = parseFloat(grossStr);
              if (!isNaN(num) && num > 0) {
                setGrossStr(num.toFixed(3));
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setGrossStr(val);
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                const grossMg = Math.round(num * 1000);
                const lessMg = it.lessMg ?? 0;
                const addMg = it.addMg ?? 0;
                onChange({ grossMg, lessMg, addMg, netMg: Math.max(0, grossMg + addMg - lessMg) });
              } else if (val === "") {
                onChange({ grossMg: 0, netMg: Math.max(0, (it.addMg ?? 0) - (it.lessMg ?? 0)) });
              }
            }}
            placeholder="0.000"
            className={`h-8 text-xs font-mono border-border/60 focus-visible:ring-gold ${touchCompact ? "h-11 text-base" : ""}`}
          />
          {scaleReading && scaleReading.isStable && scaleReading.weightGrams > 0 && (
            <div className="mt-0.5 flex items-center gap-0.5 text-[8px] text-emerald-500 font-mono">
              <Scale className="h-2 w-2" />
              {scaleReading.weightGrams.toFixed(3)}g
            </div>
          )}
          {scaleReading && !scaleReading.isStable && scaleReading.weightGrams > 0 && (
            <div className="mt-0.5 text-[8px] text-yellow-600 font-mono">Unstable — waiting</div>
          )}
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Less weight">
            Less (g)
          </div>
          <Input
            type="text"
            inputMode="decimal"
            value={lessStr}
            onFocus={() => setFocusedField("less")}
            onBlur={() => {
              setFocusedField(null);
              const num = parseFloat(lessStr);
              if (!isNaN(num) && num > 0) {
                setLessStr(num.toFixed(3));
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setLessStr(val);
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                const lessMg = Math.round(num * 1000);
                const grossMg = it.grossMg ?? 0;
                const addMg = it.addMg ?? 0;
                onChange({ lessMg, addMg, netMg: Math.max(0, grossMg + addMg - lessMg) });
              } else if (val === "") {
                const grossMg = it.grossMg ?? 0;
                const addMg = it.addMg ?? 0;
                onChange({ lessMg: 0, addMg, netMg: Math.max(0, grossMg + addMg) });
              }
            }}
            placeholder="0.000"
            className={`h-8 text-xs font-mono border-border/60 focus-visible:ring-gold ${touchCompact ? "h-11 text-base" : ""}`}
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Add weight">
            Add (g)
          </div>
          <Input
            type="text"
            inputMode="decimal"
            value={addStr}
            onFocus={() => setFocusedField("add")}
            onBlur={() => {
              setFocusedField(null);
              const num = parseFloat(addStr);
              if (!isNaN(num) && num > 0) {
                setAddStr(num.toFixed(3));
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setAddStr(val);
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                const addMg = Math.round(num * 1000);
                const grossMg = it.grossMg ?? 0;
                const lessMg = it.lessMg ?? 0;
                onChange({ addMg, lessMg, netMg: Math.max(0, grossMg + addMg - lessMg) });
              } else if (val === "") {
                const grossMg = it.grossMg ?? 0;
                const lessMg = it.lessMg ?? 0;
                onChange({ addMg: 0, lessMg, netMg: Math.max(0, grossMg - lessMg) });
              }
            }}
            placeholder="0.000"
            className={`h-8 text-xs font-mono border-border/60 focus-visible:ring-gold ${touchCompact ? "h-11 text-base" : ""}`}
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Net (g)
          </div>
          <Input
            id={`netMg-${it.id}`}
            type="text"
            inputMode="decimal"
            value={netStr}
            onFocus={() => {
              setFocusedField("net");
              onWeightFocus?.("net");
            }}
            onBlur={() => {
              setFocusedField(null);
              onWeightBlur?.();
              const num = parseFloat(netStr);
              if (!isNaN(num) && num > 0) {
                setNetStr(num.toFixed(3));
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setNetStr(val);
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                const netMg = Math.round(num * 1000);
                const grossMg = it.grossMg ?? 0;
                const addMg = it.addMg ?? 0;
                const lessMg = Math.max(0, grossMg + addMg - netMg);
                onChange({ netMg, lessMg });
              } else if (val === "") {
                onChange({ netMg: 0 });
              }
            }}
            placeholder="0.000"
            aria-invalid={it.netMg > (it.grossMg ?? 0) + (it.addMg ?? 0)}
            className={`h-8 text-xs font-mono focus-visible:ring-gold ${
              it.netMg > (it.grossMg ?? 0) + (it.addMg ?? 0)
                ? "border-destructive text-destructive focus-visible:ring-destructive"
                : "border-border/60"
            }`}
          />
          {it.netMg > (it.grossMg ?? 0) + (it.addMg ?? 0) && (
            <div className="mt-0.5 text-[9px] text-destructive font-medium">
              Net can&apos;t exceed Gr + Add
            </div>
          )}
        </div>

        <div className="px-3 py-2.5 bg-gold/5">
          <div className="text-[10px] uppercase tracking-wider text-gold/70 font-bold mb-1">
            Fine (g)
          </div>
          {fineEditable ? (
            <Input
              type="text"
              inputMode="decimal"
              value={fineStr}
              onFocus={() => setFocusedField("fine")}
              onBlur={() => {
                setFocusedField(null);
                const num = parseFloat(fineStr);
                if (!isNaN(num) && num > 0) {
                  setFineStr(num.toFixed(3));
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                setFineStr(val);
                const num = parseFloat(val);
                if (!isNaN(num) && num >= 0) {
                  onChange({ fineMg: Math.round(num * 1000) });
                }
              }}
              className="h-8 text-xs font-mono font-bold text-gold border-border/60"
            />
          ) : (
            <div className="h-8 flex items-center font-mono font-bold text-gold text-sm">
              {mgToGrams(it.fineMg)}
            </div>
          )}
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Tanch / touch ‰">
            Tanch
          </div>
          <Input
            type="text"
            inputMode="numeric"
            value={purityStr}
            onFocus={() => setFocusedField("purity")}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => {
              const val = e.target.value;
              setPurityStr(val);
              const num = Number(val);
              if (!isNaN(num)) {
                onChange({ purity: Math.max(0, Math.min(999, Math.round(num))) });
              }
            }}
            className="h-8 text-xs font-mono border-border/60"
            placeholder="916"
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Wastage %">
            Wstg
          </div>
          <Input
            type="text"
            inputMode="decimal"
            value={wstgStr}
            onFocus={() => setFocusedField("wastage")}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => {
              const val = e.target.value;
              setWstgStr(val);
              const num = parseFloat(val);
              onChange({ wastagePct: !isNaN(num) && num >= 0 ? num : 0 });
            }}
            className="h-8 text-xs font-mono border-border/60"
            placeholder="0.00"
          />
        </div>

        <div className="px-3 py-2.5 bg-muted/10">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Hisob %">
            Hisob
          </div>
          <Input
            type="text"
            inputMode="decimal"
            value={hisobStr}
            onFocus={() => setFocusedField("hisob")}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => {
              const raw = e.target.value;
              setHisobStr(raw);
              const num = parseFloat(raw.trim());
              onChange({ hisobPct: raw.trim() === "" || isNaN(num) ? undefined : num });
            }}
            className="h-8 text-xs font-mono border-border/60"
            placeholder="Tanch+Wstg"
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Pieces">
            Pcs
          </div>
          <Input
            type="text"
            inputMode="numeric"
            value={pcsStr}
            onFocus={() => setFocusedField("pcs")}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => {
              const val = e.target.value;
              setPcsStr(val);
              const num = parseInt(val, 10);
              onChange({ pcs: !isNaN(num) && num >= 0 ? num : 1 });
            }}
            className="h-8 text-xs font-mono border-border/60"
            placeholder="1"
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Metal">
            Metal
          </div>
          <Select
            value={it.metalKind ?? "gold"}
            onValueChange={(v) => onChange({ metalKind: v as "gold" | "silver" })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1" title="Jama / Nave">
            J/N
          </div>
          <Select
            value={String(it.jn ?? 2)}
            onValueChange={(v) => onChange({ jn: Number(v) as 1 | 2 })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Jama</SelectItem>
              <SelectItem value="2">Nave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Rate ₹/g
          </div>
          <div className="flex gap-1 items-center">
            <Input
              type="text"
              inputMode="numeric"
              value={rateStr}
              onFocus={() => setFocusedField("rate")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                const val = e.target.value;
                setRateStr(val);
                const num = rupeesToPaise(val);
                onChange({ goldRatePerGramPaise: num });
              }}
              className="h-8 text-xs font-mono border-border/60 w-24"
            />
            <select
              className="h-8 text-[10px] border border-border/60 rounded px-1 bg-background focus:outline-none focus:ring-1 focus:ring-gold"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const val = parseInt(e.target.value, 10);
                  setRateStr(paiseToRupees(val));
                  onChange({ goldRatePerGramPaise: val });
                }
              }}
            >
              <option value="" disabled>
                Branch Rate
              </option>
              {useSettings.getState().branches.map((b) => {
                const rates = getBranchBullionRates(b.id);
                let rate = rates.gold22KPerGramPaise;
                if (it.purity >= 990) rate = rates.gold24KPerGramPaise;
                else if (it.purity <= 780 && it.purity > 0) rate = rates.gold18KPerGramPaise;
                return (
                  <option key={b.id} value={rate}>
                    {b.code}: ₹{paiseToRupees(rate)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 py-1.5 bg-gold/5 border-y border-gold/10 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
        <span>
          Gold Value: {mgToGrams(it.fineMg)}g × ₹{paiseToRupees(it.goldRatePerGramPaise)}/g
        </span>
        <span className="font-semibold text-foreground">
          = ₹{Number(paiseToRupees(it.goldValuePaise)).toLocaleString("en-IN")}
        </span>
      </div>

      <div className="px-4 py-2">
        <button
          type="button"
          onClick={() => setShowCharges((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showCharges ? "" : "-rotate-90"}`}
          />
          <span className="font-medium">
            {showCharges ? "Hide" : "+"} Making · Stone · Diamond · Discount
          </span>
          {!showCharges && hasCharges && (
            <span className="ml-auto text-foreground font-semibold font-mono">
              {it.discountPaise > 0
                ? `₹${paiseToRupees(totalChargesPaise)} − ₹${paiseToRupees(it.discountPaise)} disc`
                : `₹${paiseToRupees(totalChargesPaise)}`}
            </span>
          )}
        </button>

        {showCharges && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 pb-2">
            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Category
              </Label>
              <Input
                value={it.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className="h-8 text-xs font-serif"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                HUID
              </Label>
              <Input
                value={it.huid || ""}
                onChange={(e) => onChange({ huid: e.target.value })}
                className="h-8 text-xs font-mono"
                placeholder="—"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                HSN
              </Label>
              <Input
                value={it.hsnCode || ""}
                onChange={(e) => onChange({ hsnCode: e.target.value })}
                className="h-8 text-xs font-mono"
                placeholder="7113"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Making (%)
              </Label>
              <Input
                value={mkPctStr}
                onChange={(e) => {
                  setMkPctStr(e.target.value);
                  const pct = parseFloat(e.target.value) || 0;
                  onChange({
                    makingChargePct: pct,
                    makingChargesPaise: Math.round((it.goldValuePaise * pct) / 100),
                  });
                }}
                placeholder="e.g. 12"
                className="h-8 text-xs font-mono"
              />
              <div className="text-[10px] text-muted-foreground mt-0.5">
                ₹ {paiseToRupees(it.makingChargesPaise)}
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Stone Wt (g)
              </Label>
              <Input
                value={stoneWeightStr}
                onChange={(e) => {
                  setStoneWeightStr(e.target.value);
                  try {
                    onChange({ stoneWeightMg: gramsToMg(e.target.value) });
                  } catch {
                    /* */
                  }
                }}
                placeholder="0.000"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Stone Charges (₹)
              </Label>
              <Input
                value={stStr}
                onChange={(e) => {
                  setStStr(e.target.value);
                  onChange({ stoneChargesPaise: rupeesToPaise(e.target.value) });
                }}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Hallmark Charges (₹)
              </Label>
              <Input
                value={hmStr}
                onChange={(e) => {
                  setHmStr(e.target.value);
                  onChange({ hallmarkChargesPaise: rupeesToPaise(e.target.value) });
                }}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Diamond (ct)
              </Label>
              <Input
                value={diamondWeightStr}
                onChange={(e) => {
                  setDiamondWeightStr(e.target.value);
                  try {
                    const val = parseFloat(e.target.value) || 0;
                    onChange({ diamondWeightMg: Math.round(val * 200) });
                  } catch {
                    /* */
                  }
                }}
                placeholder="0.00"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                Other Charges (₹)
              </Label>
              <Input
                value={otStr}
                onChange={(e) => {
                  setOtStr(e.target.value);
                  onChange({ otherChargesPaise: rupeesToPaise(e.target.value) });
                }}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-[10px] uppercase font-bold text-rose-500 block mb-1">
                Discount (₹)
              </Label>
              <Input
                value={dcStr}
                onChange={(e) => {
                  setDcStr(e.target.value);
                  onChange({ discountPaise: rupeesToPaise(e.target.value) });
                }}
                className="h-8 text-xs font-mono text-rose-500 border-rose-500/20"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

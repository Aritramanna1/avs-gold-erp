import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDraft } from "@/lib/drafts-store";
import { PageHeader } from "@/components/app-shell";
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
  PAYMENT_MODE_LABELS,
  paiseToRupees,
  rupeesToPaise,
  customerLedger,
  type Invoice,
  type InvoiceItem,
  type PaymentRecord,
  type PaymentMode,
  type GstKind,
  type OrderAdjustment,
} from "@/lib/billing-store";
import { useOrders, ORDER_STATUS_LABELS } from "@/lib/orders-store";
import { useStock } from "@/lib/stock-store";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useLedger } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import { useAttachments } from "@/lib/attachments-store";
import { useBillingStore } from "./billingStore";
import { useModuleStore } from "@/lib/module-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { mgToGrams, gramsToMg, fineGoldMg } from "@/lib/gold";
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
} from "lucide-react";
import { RequireAction } from "@/components/role-gate";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { hardwareService, type ScaleReading } from "@/lib/hardware-service";
import { isValidWaPhone } from "@/lib/wa-link";
import { commService } from "@/lib/comm/service";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";

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

type BillingType =
  | "ready_stock"
  | "custom_order"
  | "repair"
  | "polishing"
  | "wholesale"
  | "advance_receipt"
  | "payment_receipt"
  | "manufacturing";

const BILLING_TYPES = [
  {
    id: "ready_stock",
    label: "Ready Stock Sale / रेडी स्टॉक विक्री",
    desc: "Direct sale of pre-manufactured stock items",
  },
  {
    id: "custom_order",
    label: "Custom Order Delivery / ऑर्डर डिलिव्हरी",
    desc: "Delivery of custom manufactured jewellery order",
  },
  {
    id: "repair",
    label: "Repair Job / दुरुस्ती आणि रिपेअरिंग",
    desc: "Billing for repairing / soldering work",
  },
  {
    id: "polishing",
    label: "Polishing Job / पॉलिशिंग काम",
    desc: "Billing for colouring, polishing or washing items",
  },
  {
    id: "wholesale",
    label: "Wholesale Bill / घाऊक आणि होलसेल बिल",
    desc: "Wholesale transactions with other firms or goldsmiths",
  },
  {
    id: "advance_receipt",
    label: "Advance Deposit / ऑर्डर ॲडव्हान्स पावती",
    desc: "Generate advance receipt for booking a design",
  },
  {
    id: "payment_receipt",
    label: "Outstanding Receipt / जमा पावती",
    desc: "Receive payment for previous outstanding ledgers",
  },
  {
    id: "manufacturing",
    label: "Manufacturing Bill / कारीगर खाते",
    desc: "Karigar gold account — gold given, received, balance",
  },
];

function newItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function getRowItemPhoto(it: { stockItemId?: string; barcode?: string; itemName?: string }) {
  const attachments = useAttachments.getState().items;
  const stockItems = useStock.getState().items;

  // 1. Direct stock attachment by ID
  if (it.stockItemId) {
    const key = `stock:${it.stockItemId}:design_photo`;
    const rec = attachments[key];
    if (rec?.thumbnailDataUrl || rec?.fileDataUrl) return rec.thumbnailDataUrl || rec.fileDataUrl;
  }

  // 2. Find by barcode → stock item → attachment
  if (it.barcode) {
    const si = stockItems.find((s) => s.barcode === it.barcode);
    if (si) {
      const key = `stock:${si.id}:design_photo`;
      const rec = attachments[key];
      if (rec?.thumbnailDataUrl || rec?.fileDataUrl) return rec.thumbnailDataUrl || rec.fileDataUrl;
    }
  }

  return undefined;
}

function getStockItemPhotoDataUrl(s: { id: string }): string | undefined {
  const attachments = useAttachments.getState().items;
  const key = `stock:${s.id}:design_photo`;
  const rec = attachments[key];
  if (rec?.thumbnailDataUrl || rec?.fileDataUrl) return rec.thumbnailDataUrl || rec.fileDataUrl;
  return undefined;
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
    getAttachmentSignedUrl("catalog-designs", stockItem.imageStoragePath)
      .then((url) => {
        if (url) setResolvedUrl(url);
      })
      .catch(() => {});
  }, [stockItem.id, stockItem.imageStoragePath, dataUrl]);

  if (!resolvedUrl) return <>{fallback ?? null}</>;
  return <img src={resolvedUrl} alt="" className={className} />;
}

export function BillingModule({ orderId, stockId, jobId }: BillingModuleProps) {
  const navigate = useNavigate();
  const billing = useBilling();
  const orders = useOrders((s) => s.orders);
  const stockItems = useStock((s) => s.items);
  const changeStockStatus = useStock((s) => s.changeStatus);
  const updateStock = useStock((s) => s.update);
  const updateOrder = useOrders((s) => s.update);
  const appendOrderTimeline = useOrders((s) => s.appendTimeline);
  const jobs = useJobCards((s) => s.jobs);
  const people = usePeople((s) => s.people);
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
    linkedOrder ? "custom_order" : linkedStock ? "ready_stock" : "ready_stock",
  );

  // Customer
  const [customerId, setCustomerId, clearCustomerId] = useDraft<string>(
    "mtj-billing-customerId-v1",
    linkedOrder?.customerId ?? "",
  );
  const customer = people.find((p) => p.id === customerId);
  const customers = people.filter((p) => p.type === "customer" || p.type === "firm_customer");

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

  // Hardware scanner, keyboard shortcuts, and weigh scale integration refs/states
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  const addItemRef = useRef(addItem);
  const addPaymentRowRef = useRef(addPaymentRow);
  const confirmRef = useRef(confirm);

  const [scaleReading, setScaleReading] = useState<ScaleReading>({
    weightGrams: 0,
    isStable: true,
    rawString: "ST,GS,+0000.000g",
  });
  const [scaleConnected, setScaleConnected] = useState(false);
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

  useEffect(() => {
    // 1. Focus listener and keyboard shortcut handler
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        customerInputRef.current?.focus();
        customerInputRef.current?.select();
      } else if (e.key === "F7") {
        e.preventDefault();
        orderInputRef.current?.focus();
        orderInputRef.current?.select();
      } else if (e.key === "F8") {
        e.preventDefault();
        addItemRef.current();
      } else if (e.key === "F9") {
        e.preventDefault();
        addPaymentRowRef.current();
      } else if (e.key === "F10" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
        e.preventDefault();
        confirmRef.current();
      }
    }

    // 2. Hardware Weigh Scale Connection
    let scaleSub: { unsubscribe: () => void } | null = null;
    try {
      if (hardwareService && typeof hardwareService.subscribeToScale === "function") {
        scaleSub = hardwareService.subscribeToScale((reading) => {
          setScaleConnected(hardwareService.isScaleConnected);
          setScaleReading(reading);
          const target = focusedWeightFieldRef.current;
          if (target && reading.weightGrams > 0) {
            const item = itemsRef.current.find((it) => it.id === target.itemId);
            if (item) {
              const updatedVal = gramsToMg(reading.weightGrams.toFixed(3));
              if (target.type === "gross") {
                patchItemRef.current?.(target.itemId, { grossMg: updatedVal });
              } else {
                patchItemRef.current?.(target.itemId, { netMg: updatedVal });
              }
            }
          }
        });
      } else {
        console.warn("[Billing] hardwareService or subscribeToScale is unavailable.");
      }
    } catch (err) {
      console.error("[Billing] Failed to subscribe to scale:", err);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (scaleSub && typeof scaleSub.unsubscribe === "function") {
        try {
          scaleSub.unsubscribe();
        } catch (err) {
          console.error("[Billing] Failed to unsubscribe scale:", err);
        }
      }
    };
  }, []);

  const [customerSearch, setCustomerSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [activeInspectedStock, setActiveInspectedStock] = useState<(typeof stockItems)[0] | null>(
    null,
  );

  // New customer modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustGstin, setNewCustGstin] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

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
        label: type === "fine" ? "MP FINE" : type === "lagad" ? "MP LAGAD" : "MP SCRAP",
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
  const [rawPayments, setPayments, clearPayments] = useDraft<DraftPayment[]>(
    "mtj-billing-payments-v1",
    [
      {
        id: newItemId(),
        mode: "cash",
        amountStr: "",
        reference: "",
        notes: "",
        goldGramsStr: "",
        goldPurityStr: "",
        goldRateStr: "",
      },
    ],
  );

  const payments = useMemo(() => {
    return Array.isArray(rawPayments) ? rawPayments : [];
  }, [rawPayments]);

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
        o.item.itemName.toLowerCase().includes(q) ||
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
        s.itemName.toLowerCase().includes(q) ||
        s.itemCode.toLowerCase().includes(q) ||
        s.barcode.toLowerCase().includes(q) ||
        (s.huid && s.huid.toLowerCase().includes(q)),
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
      if (activeCustomerIdx >= 0 && activeCustomerIdx < filteredCustomers.length) {
        e.preventDefault();
        const selected = filteredCustomers[activeCustomerIdx];
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
      if (activeOrderIdx >= 0 && activeOrderIdx < filteredOrders.length) {
        e.preventDefault();
        const selected = filteredOrders[activeOrderIdx];
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
      if (activeStockIdx >= 0 && activeStockIdx < list.length) {
        e.preventDefault();
        const selected = list[activeStockIdx];
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
      useSettings.getState().goldRatePerGramPaise ??
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
    return computeInvoiceTotals(items, gst, adjustmentLive, paymentRecords);
  }, [items, gst, adjustmentLive, payments]);

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
      setItems((curr) =>
        curr.map((it) => {
          if (it.id !== id) return it;
          const rawMerged = { ...it, ...diff };
          // Auto-recalculate fineMg whenever weights, purity, or wastage changes.
          if (
            "grossMg" in diff ||
            "netMg" in diff ||
            "purity" in diff ||
            "otherChargesPaise" in diff
          ) {
            if (billingType === "manufacturing") {
              // Manufacturing formula: Fine = Net × (Tunch% + Wastage%) / 100
              // purity stores tunch×10 (per-mille), otherChargesPaise stores wastage%×100
              const tunchPct = rawMerged.purity / 10;
              const wstgPct = rawMerged.otherChargesPaise / 100;
              rawMerged.fineMg = Math.round((rawMerged.netMg * (tunchPct + wstgPct)) / 100);
            } else {
              // Retail/normal item: purity is a real per-mille value here —
              // delegate to gold.ts's fineGoldMg() so this agrees with every
              // other fine-gold figure in the ERP (which uses /999, not
              // /1000). The manufacturing branch above uses its own tunch%
              // convention and is unaffected.
              rawMerged.fineMg = fineGoldMg(
                Math.max(0, Math.round(rawMerged.netMg)),
                Math.max(0, Math.min(999, Math.round(rawMerged.purity))),
              );
            }
          }
          const withTotals = computeItemTotals(rawMerged);
          return { ...rawMerged, ...withTotals };
        }),
      );
    },
    [setItems, billingType],
  );
  // Keep ref current so the scale-reading effect can call patchItem without stale closure
  patchItemRef.current = patchItem;

  function addItem() {
    const defaultGoldRate = useSettings.getState().goldRatePerGramPaise || 0;
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
    const alreadyInBill = items.some((it) => it.stockItemId === stock.id);
    if (alreadyInBill) {
      setScanMessage({
        text: "हा दागिना आधीच जोडलेला आहे / Already added to invoice",
        type: "error",
      });
      return;
    }

    const goldValuePaise = Math.round(
      (stock.fineMg * (useSettings.getState().goldRatePerGramPaise || 0)) / 1000,
    );
    // Making charge is always a percentage of gold value — the legacy
    // per-gram rate on older stock rows is only used as a one-time fallback
    // to derive an equivalent percentage, never applied as a flat amount.
    const makingChargePct =
      stock.makingChargePct ??
      (stock.makingChargePerGPaise
        ? goldValuePaise > 0
          ? ((stock.makingChargePerGPaise * (stock.grossMg / 1000)) / goldValuePaise) * 100
          : 0
        : 12);
    const makingChargesPaise = Math.round((goldValuePaise * makingChargePct) / 100);

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
      goldRatePerGramPaise: useSettings.getState().goldRatePerGramPaise || 0,
      goldValuePaise,
      makingChargesPaise,
      makingChargePct,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: 0,
      huid: stock.huid || undefined,
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
        mode: "cash",
        amountStr: "",
        reference: "",
        notes: "",
        goldGramsStr: "",
        goldPurityStr: "",
        goldRateStr: "",
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
    overrides?: { goldGramsStr?: string; goldPurityStr?: string; goldRateStr?: string },
  ) {
    const p = payments[idx];
    if (!p) return;
    try {
      const gramsStr = overrides?.goldGramsStr ?? p.goldGramsStr;
      const purityStr = overrides?.goldPurityStr ?? p.goldPurityStr;
      const rateStr = overrides?.goldRateStr ?? p.goldRateStr;
      const grossMg = gramsToMg(gramsStr);
      const purity = Math.round(Number(purityStr));
      const fine = fineGoldMg(grossMg, purity);
      const ratePaise = rupeesToPaise(rateStr);
      const valuePaise = Math.round((fine * ratePaise) / 1000);
      if (valuePaise > 0) patchPayment(idx, { amountStr: (valuePaise / 100).toString() });
    } catch {
      /* ignore */
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

    const isServiceOrReceipt =
      billingType === "repair" ||
      billingType === "polishing" ||
      billingType === "advance_receipt" ||
      billingType === "payment_receipt";

    if (items.length === 0) {
      toast.error("Please add at least one line item.");
      return;
    }

    if (isServiceOrReceipt) {
      if (items.some((i) => !i.itemName)) {
        toast.error("Each line item needs a description / name.");
        return;
      }
    } else {
      if (items.some((i) => !i.itemName || i.fineMg <= 0 || i.goldRatePerGramPaise <= 0)) {
        toast.error("Each item needs a name, weights, purity and a gold rate.");
        return;
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
            const grossMg = gramsToMg(p.goldGramsStr);
            const purity = Math.round(Number(p.goldPurityStr));
            const fine = fineGoldMg(grossMg, purity);
            const ratePaise = rupeesToPaise(p.goldRateStr);
            base.goldGrossMg = grossMg;
            base.goldPurity = purity;
            base.goldFineMg = fine;
            base.goldRatePerGramPaise = ratePaise;
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

    const computed = computeInvoiceTotals(items, gst, adjustmentLive, realPayments);
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

    const totalFineMg = items.reduce((s, it) => s + it.fineMg, 0);

    // Append ledger sale entry — gold leaves business via finished bucket
    let saleEntryId: string | undefined;
    if (totalFineMg > 0) {
      const entry = await appendLedger({
        type: "sale",
        netFineMg: -totalFineMg,
        deltas: { finished: -totalFineMg },
        notes: `Sale via invoice for ${customer.fullName}`,
        reference: linkedStock?.barcode ?? linkedOrder?.orderNo,
      });
      saleEntryId = entry.id;
    }

    const typeLabel = BILLING_TYPES.find((t) => t.id === billingType)?.label || "Invoice";
    const invNotes = `[Type: ${typeLabel}]`;

    const allocatedInvoiceNo = await getNextSequenceNumber("invoice");

    // Check if the bill is settled in GOLD (Pay-In-Gold or Gold Credit)
    const goldPayment = realPayments.find(
      (p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit",
    );
    const isGoldExchange = !!goldPayment;

    const goldRatePaise = useSettings.getState().goldRatePerGramPaise || 1;
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
        ? Math.round(goldShortfallGrams * 1000 * ((goldPayment.goldPurity ?? 916) / 1000))
        : 0;
    const goldSurplusFineMg =
      isGoldExchange && goldSurplusGrams > 0
        ? Math.round(goldSurplusGrams * 1000 * ((goldPayment.goldPurity ?? 916) / 1000))
        : 0;

    if (isGoldExchange && goldShortfallFineMg > 0) {
      const shortfallEntry = await appendLedger({
        type: "gold_overdraft_issue",
        netFineMg: 0,
        deltas: {
          customer: -goldShortfallFineMg,
          vault: goldShortfallFineMg,
        },
        notes: `Pay-In-Gold settlement shortfall receivable for Invoice ${allocatedInvoiceNo}`,
        reference: allocatedInvoiceNo,
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
          rate_per_gram_paise: useSettings.getState().goldRatePerGramPaise || 0,
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
    }

    if (isGoldExchange && goldSurplusFineMg > 0) {
      // Customer physically handed over MORE gold than the invoice
      // required — this is genuinely `gold_received` (goldIn): it's real
      // gold sitting with us right now as the customer's credit/advance.
      const surplusEntry = await appendLedger({
        type: "gold_overdraft_issue",
        netFineMg: 0,
        deltas: {
          customer: goldSurplusFineMg,
          vault: -goldSurplusFineMg,
        },
        notes: `Pay-In-Gold settlement surplus credit for Invoice ${allocatedInvoiceNo} — customer paid more gold than required`,
        reference: allocatedInvoiceNo,
      });
      additionalLedgerIds.push(surplusEntry.id);

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
          rate_per_gram_paise: useSettings.getState().goldRatePerGramPaise || 0,
          amount_paise: 0,
          notes: `Excess gold received against Invoice ${allocatedInvoiceNo} — recorded as customer credit`,
          payment_mode: "gold_exchange",
        });
      } catch (err) {
        console.error("Failed writing customer gold surplus settlement record:", err);
      }
    }

    const finalBalancePaise = isGoldExchange ? 0 : computed.balancePaise;
    const finalPaidPaise = isGoldExchange ? computed.grandTotalPaise : computed.paidPaise;

    let inv;
    try {
      inv = await billing.add({
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
        grandTotalPaise: computed.grandTotalPaise,
        paidPaise: finalPaidPaise,
        balancePaise: finalBalancePaise,
        payments: realPayments,
        saleLedgerEntryId: saleEntryId,
        additionalLedgerEntryIds: additionalLedgerIds.length > 0 ? additionalLedgerIds : undefined,
        notes:
          invNotes +
          (isGoldExchange && goldShortfallFineMg > 0
            ? ` [Pay-In-Gold Shortfall: ${goldShortfallGrams.toFixed(3)}g]`
            : ""),
      });
    } catch (err: any) {
      alert(
        `किंमत सेव्ह करणे अपयशी ठरले / Failed to save invoice: ${err.message || err}. Please check network connection and try again.`,
      );
      return;
    }

    for (const item of items) {
      if (item.stockItemId) {
        changeStockStatus(item.stockItemId, "sold", `Sold via ${inv.invoiceNo}`);
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

    const savedEmail = customer?.email ?? "";
    clearBillingType();
    clearCustomerId();
    clearGst();
    clearItems();
    clearPayments();

    setConfirmedCustomerEmail(savedEmail);
    setConfirmedInvoice(inv);
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

  // Handle New Customer registration
  async function handleRegisterCustomer() {
    if (!newCustName.trim()) return;
    setAddingCustomer(true);
    try {
      const usePeopleStore = (await import("@/lib/people-store")).usePeople;
      const newCust = await usePeopleStore.getState().add({
        fullName: newCustName.trim(),
        phone: newCustPhone.trim() || "0000000000",
        gstin: newCustGstin.trim() || undefined,
        type: "customer" as const,
        active: true,
        branchId: useSettings.getState().selectedBranchId || "MAIN",
      });
      setCustomerId(newCust.id);
      setShowAddCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustGstin("");
    } catch (err: any) {
      toast.error("Failed to register customer: " + err.message);
    } finally {
      setAddingCustomer(false);
    }
  }

  // Build items helper
  function buildPrefilledItem(
    stock?: ReturnType<typeof useStock.getState>["items"][number],
    order?: ReturnType<typeof useOrders.getState>["orders"][number],
  ): InvoiceItem {
    const currentGoldRate = useSettings.getState().goldRatePerGramPaise || 0;
    if (stock) {
      const ratePaise = currentGoldRate;
      const goldValuePaise2 = Math.round((stock.fineMg * ratePaise) / 1000);
      // Making charge is always a percentage of gold value — never a flat
      // per-gram amount. Legacy per-gram stock rows are converted once to
      // an equivalent percentage rather than applied as a flat rupee sum.
      const makingChargePct2 =
        stock.makingChargePct ??
        (stock.makingChargePerGPaise
          ? goldValuePaise2 > 0
            ? ((stock.makingChargePerGPaise * (stock.grossMg / 1000)) / goldValuePaise2) * 100
            : 0
          : 12);
      const makingChargesPaise = Math.round((goldValuePaise2 * makingChargePct2) / 100);

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
        makingChargesPaise: makingChargesPaise,
        makingChargePct: makingChargePct2,
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
        huid: stock.huid || undefined,
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
      };
      const tot = computeItemTotals(blank);
      return { id: newItemId(), ...blank, ...tot };
    }
    const blank: Omit<InvoiceItem, "id" | "goldValuePaise" | "lineTotalPaise"> = {
      itemName: "",
      category: "Other",
      purity: 916,
      grossMg: 0,
      netMg: 0,
      fineMg: 0,
      goldRatePerGramPaise: currentGoldRate,
      makingChargesPaise: 0,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
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

    async function handleSendEmail() {
      if (!custEmail) {
        toast.error("Customer email not set.");
        return;
      }
      setEmailSending(true);
      await commService.sendInvoice(inv.id, branchId, "email", inv.customerName, {
        email: custEmail,
      });
      setEmailSending(false);
    }

    async function handleSendWhatsApp() {
      await commService.sendInvoice(inv.id, branchId, "whatsapp", inv.customerName, {
        phone: custPhone,
      });
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="font-serif text-2xl text-gold">Invoice Saved!</h2>
            <p className="text-muted-foreground text-sm">{inv.invoiceNo}</p>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2 text-sm">
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
              <span>{inv.items.length}</span>
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="New Invoice"
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

      {/* Compact status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20 text-[10px] font-mono text-muted-foreground">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            ["F2", "Scan"],
            ["F4", "Customer"],
            ["F7", "Order"],
            ["F8", "Add Item"],
            ["F9", "Payment"],
            ["F10", "Save & Print"],
          ].map(([key, label]) => (
            <span key={key}>
              <kbd className="bg-background border border-border px-1 py-0.5 rounded text-[9px] font-bold text-foreground mr-0.5">
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${scaleConnected ? (scaleReading.isStable ? "bg-emerald-500" : "bg-yellow-400 animate-pulse") : "bg-slate-400"}`}
          />
          <span
            className={
              scaleConnected ? (scaleReading.isStable ? "text-emerald-500" : "text-yellow-500") : ""
            }
          >
            {scaleConnected
              ? `Scale: ${scaleReading.weightGrams.toFixed(3)}g${!scaleReading.isStable ? " âš " : ""}`
              : "Scale: —"}
          </span>
        </div>
      </div>

      {/* Billing Type — compact pill row */}
      <div className="flex flex-wrap gap-2">
        {BILLING_TYPES.map((t) => {
          const active = billingType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setBillingType(t.id as BillingType);
                if (t.id === "advance_receipt" || t.id === "payment_receipt") {
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
                } else {
                  setGst("gst3");
                  setItems([buildPrefilledItem(linkedStock, linkedOrder)]);
                }
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
                      <div className="relative flex-1">
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
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border">
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
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gold/30 hover:bg-gold/5 text-gold h-10"
                        onClick={selectOrCreateWalkIn}
                      >
                        Walk-In Customer
                      </Button>
                      <Button
                        type="button"
                        className="bg-gold hover:bg-gold/90 text-white h-10 gap-1"
                        onClick={() => setShowAddCustomer(!showAddCustomer)}
                      >
                        <Plus className="h-4 w-4" /> New Customer
                      </Button>
                    </div>

                    {showAddCustomer && (
                      <div className="p-4 rounded-xl border border-gold/20 bg-gold/5 space-y-3">
                        <div className="font-semibold text-sm text-gold">
                          Register New Customer / नवीन ग्राहक
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Full Name *</Label>
                            <Input
                              required
                              placeholder="Name"
                              value={newCustName}
                              onChange={(e) => setNewCustName(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Phone Number
                            </Label>
                            <Input
                              type="tel"
                              placeholder="Phone"
                              value={newCustPhone}
                              onChange={(e) => setNewCustPhone(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              GSTIN (Optional)
                            </Label>
                            <Input
                              placeholder="GSTIN"
                              value={newCustGstin}
                              onChange={(e) => setNewCustGstin(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 text-xs">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddCustomer(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleRegisterCustomer}
                            className="bg-gold text-white"
                            disabled={addingCustomer || !newCustName.trim()}
                          >
                            Register & Select
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-gold/30 bg-gold/5 gap-3">
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
                  <div className="relative">
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
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border">
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-border bg-background/50 gap-3">
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
                        GST 3% (CGST 1.5 + SGST 1.5) on Jewellery Making/Stone
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
              <div className="mt-4 p-3 rounded-xl border border-border/80 bg-background/40 flex flex-wrap gap-6 text-xs justify-between">
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
                    {pendingCashAdvanceRupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}{" "}
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
                      {customerGoldBalanceMg > 0 ? "(Cr)" : "(Dr)"}
                    </span>
                  </div>
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
                : "Jewellery Billing Ledger Lines"
            }
            right={
              billingType !== "advance_receipt" &&
              billingType !== "payment_receipt" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 border-gold/40 text-gold hover:bg-gold/5"
                  onClick={addItem}
                >
                  <Plus className="h-3 w-3" /> F8 Add Line
                </Button>
              )
            }
          >
            <div className="space-y-4">
              {/* Scan or Search Stock */}
              {billingType !== "advance_receipt" && billingType !== "payment_receipt" && (
                <div className="bg-background/40 p-3 rounded-xl border border-border space-y-3">
                  <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                    <div className="relative flex-1">
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
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-border">
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

              {/* Items Grid */}
              <div className="space-y-4">
                {items.map((it, idx) => (
                  <ItemRow
                    key={it.id}
                    it={it}
                    idx={idx}
                    billingType={billingType}
                    scaleReading={scaleReading}
                    onWeightFocus={(type) => setFocusedWeightField({ itemId: it.id, type })}
                    onWeightBlur={() => setFocusedWeightField(null)}
                    onChange={(diff) => patchItem(it.id, diff)}
                    onRemove={() => removeItem(it.id)}
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* Section 2b: Manufacturing Bill — Karigar Account (MP entries + balances) */}
          {billingType === "manufacturing" && (
            <Section
              title="Karigar Account — Metal Received (MP Entries)"
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
                <div className="rounded-xl border border-border bg-background/40 px-4 py-3">
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
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground grid grid-cols-[1fr_80px_70px_60px_80px_32px] gap-2 px-2">
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
                      className={`rounded-xl border ${color} px-3 py-2.5 grid grid-cols-[1fr_80px_70px_60px_80px_32px] gap-2 items-center`}
                    >
                      <Input
                        value={e.label}
                        onChange={(ev) => patchMfgMp(e.id, { label: ev.target.value })}
                        className="h-8 text-xs font-medium"
                        placeholder="MP FINE / MP LAGAD"
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

                {/* Karigar Balance Summary */}
                {(() => {
                  const totalItemFineMg = items.reduce((s, it) => s + it.fineMg, 0); // Gold given (P entries)
                  const totalMpFineMg = mfgMpEntries.reduce((s, e) => s + e.fineMg, 0);
                  const lbMg = mfgLBGoldMg; // negative = karigar owes us (their opening debit)
                  // P entries ADD to debit (we give gold → they owe more → more negative)
                  const netAfterLB = lbMg - totalItemFineMg;
                  const bhavPer10g = parseFloat(mfgGoldBhavStr || "0");
                  const cashPaymentPaise = payments.reduce(
                    (s, p) => s + rupeesToPaise(p.amountStr),
                    0,
                  );
                  // Gold bhav: cash paid → fine gold equivalent (reduces karigar debit)
                  const bhavGoldMg =
                    bhavPer10g > 0 ? Math.round((cashPaymentPaise / (bhavPer10g * 10)) * 10000) : 0;
                  const closingMg = netAfterLB + totalMpFineMg + bhavGoldMg;
                  return (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm font-mono">
                      <div className="text-[10px] uppercase tracking-wider font-black text-muted-foreground mb-2">
                        Karigar Account Summary
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Gold Given (P entries)</span>
                        <span className="text-rose-400 font-semibold">
                          G -{(totalItemFineMg / 1000).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">LB Opening Balance</span>
                        <span className={lbMg <= 0 ? "text-rose-400" : "text-emerald-400"}>
                          G {(lbMg / 1000).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border pt-1">
                        <span className="text-foreground font-bold">Net Total</span>
                        <span className="font-bold text-rose-400">
                          G {(netAfterLB / 1000).toFixed(3)}
                        </span>
                      </div>
                      {totalMpFineMg > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">MP Received (Fine)</span>
                          <span className="text-emerald-400">
                            + G {(totalMpFineMg / 1000).toFixed(3)}
                          </span>
                        </div>
                      )}
                      {cashPaymentPaise > 0 && bhavPer10g > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            P.GOLD BHAV @{bhavPer10g} (cash→gold adj.)
                          </span>
                          <span className="text-emerald-400">
                            + G {(bhavGoldMg / 1000).toFixed(3)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                        <span className={closingMg < 0 ? "text-rose-400" : "text-emerald-400"}>
                          Closing Balance{" "}
                          {closingMg < 0
                            ? "— Karigar Owes (Jama)"
                            : closingMg === 0
                              ? "— NIL"
                              : "— We Owe Karigar"}
                        </span>
                        <span className={closingMg < 0 ? "text-rose-400" : "text-emerald-400"}>
                          G {Math.abs(closingMg / 1000).toFixed(3)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Section>
          )}

          {/* Section 3: Payment */}
          <Section
            title="Payment Collection"
            right={
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 border-gold/40 text-gold hover:bg-gold/5"
                onClick={addPaymentRow}
              >
                <Plus className="h-3.5 w-3.5" /> F9 Add Mode
              </Button>
            }
          >
            <div className="space-y-3">
              {payments.map((p, idx) => {
                const isGold = p.mode === "gold_exchange" || p.mode === "customer_gold_credit";
                const modeColor = isGold
                  ? "border-gold/30 bg-gold/5"
                  : p.mode === "cash"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : p.mode === "outstanding"
                      ? "border-rose-500/20 bg-rose-500/5"
                      : "border-border bg-background/30";
                const ModeIcon = isGold
                  ? Coins
                  : p.mode === "cash"
                    ? Banknote
                    : p.mode === "upi"
                      ? Smartphone
                      : CreditCard;
                return (
                  <div key={p.id} className={`rounded-xl border ${modeColor} overflow-hidden`}>
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
                            onValueChange={(v) => patchPayment(idx, { mode: v as PaymentMode })}
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
                                  <Wallet className="h-3.5 w-3.5 text-gold" /> Gold Credit (Balance)
                                </span>
                              </SelectItem>
                              <SelectItem value="cash">
                                <span className="inline-flex items-center gap-1.5">
                                  <Banknote className="h-3.5 w-3.5" /> Cash / रोख रक्कम
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
                              <SelectItem value="outstanding">
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" /> Outstanding / उधारी
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                            Amount (₹)
                          </Label>
                          <div className="flex gap-1.5">
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
                          </div>
                        </div>

                        <div className="flex gap-1.5 items-end">
                          <div className="flex-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                              Reference
                            </Label>
                            <Input
                              value={p.reference}
                              onChange={(e) => patchPayment(idx, { reference: e.target.value })}
                              placeholder="Ref / UTR / Cheque No."
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
                      <div className="mt-3 pt-3 border-t border-gold/20 bg-gradient-to-b from-gold/5 to-transparent p-4 rounded-xl space-y-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gold mb-1 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {p.mode === "gold_exchange"
                            ? "Gold Payment Details / सोने पेमेंट"
                            : "Customer Gold Credit Usage"}
                        </div>
                        {/* Input row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-gold/80 font-semibold block mb-1">
                              Gross Wt (g)
                            </Label>
                            <Input
                              value={p.goldGramsStr}
                              onChange={(e) => {
                                patchPayment(idx, { goldGramsStr: e.target.value });
                                autoFillFromGold(idx, { goldGramsStr: e.target.value });
                              }}
                              placeholder="0.000"
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
                            <Input
                              value={p.goldRateStr}
                              onChange={(e) => {
                                patchPayment(idx, { goldRateStr: e.target.value });
                                autoFillFromGold(idx, { goldRateStr: e.target.value });
                              }}
                              placeholder="Market rate"
                              className="h-8 text-xs font-mono border-gold/30 focus-visible:border-gold"
                            />
                          </div>
                        </div>
                        {/* Live calculation chain */}
                        {(() => {
                          try {
                            const grossMgVal = gramsToMg(p.goldGramsStr);
                            const purityVal = Math.round(Number(p.goldPurityStr) || 0);
                            const fine = purityVal > 0 ? fineGoldMg(grossMgVal, purityVal) : 0;
                            const rateP = rupeesToPaise(p.goldRateStr);
                            const goldValue =
                              fine > 0 && rateP > 0 ? Math.round((fine * rateP) / 1000) : 0;
                            return (
                              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Gross</div>
                                  <div className="font-bold text-foreground">
                                    {Number(mgToGrams(grossMgVal)).toFixed(3)} g
                                  </div>
                                </div>
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Fine Gold</div>
                                  <div className="font-bold text-gold">
                                    {Number(mgToGrams(fine)).toFixed(3)} g
                                  </div>
                                </div>
                                <div className="bg-background/60 border border-gold/20 rounded-lg p-2 text-center">
                                  <div className="text-muted-foreground mb-0.5">Rate</div>
                                  <div className="font-bold text-foreground">
                                    ₹{paiseToRupees(rateP)}
                                  </div>
                                </div>
                                <div className="bg-gold/15 border border-gold/40 rounded-lg p-2 text-center">
                                  <div className="text-gold/70 mb-0.5">Value</div>
                                  <div className="font-bold text-gold text-xs">
                                    ₹{paiseToRupees(goldValue)}
                                  </div>
                                </div>
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        {/* Customer gold balance display for credit mode */}
                        {p.mode === "customer_gold_credit" && customerGoldBalanceMg !== 0 && (
                          <div
                            className={`text-[10px] font-mono px-3 py-1.5 rounded-lg flex items-center justify-between ${customerGoldBalanceMg > 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}
                          >
                            <span>Customer Gold Balance:</span>
                            <span className="font-bold">
                              {mgToGrams(Math.abs(customerGoldBalanceMg))} g{" "}
                              {customerGoldBalanceMg > 0 ? "(Cr)" : "(Dr)"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Section 4: Invoice Summary Side Panel */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4 sticky top-6">
            <div className="text-xs uppercase tracking-wider font-black text-muted-foreground">
              Invoice Summary
            </div>

            {/* Calculations Panel */}
            <div className="space-y-2 border-b border-border pb-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal (Net Value):</span>
                <span className="font-mono">₹ {paiseToRupees(totals.subtotalPaise)}</span>
              </div>
              {totals.adjustmentPaise > 0 && (
                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>Adv. Adjusted / वजावट:</span>
                  <span className="font-mono">- ₹ {paiseToRupees(totals.adjustmentPaise)}</span>
                </div>
              )}
              {totals.gstPaise > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST (CGST+SGST):</span>
                  <span className="font-mono">₹ {paiseToRupees(totals.gstPaise)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-extrabold text-sm text-foreground">
                <span>GRAND TOTAL:</span>
                <span className="font-mono text-gold text-base">
                  ₹ {paiseToRupees(totals.grandTotalPaise)}
                </span>
              </div>
            </div>

            {/* Settlement Panel */}
            <div className="space-y-2 text-xs">
              {payments
                .filter((p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit")
                .map((p, i) => {
                  try {
                    const fine = fineGoldMg(
                      gramsToMg(p.goldGramsStr),
                      Math.round(Number(p.goldPurityStr)),
                    );
                    return (
                      <div
                        key={i}
                        className="bg-gold/5 border border-gold/20 rounded-lg px-2 py-1.5 space-y-0.5"
                      >
                        <div className="flex justify-between font-semibold text-gold">
                          <span>Gold Payment</span>
                          <span className="font-mono">
                            {Number(p.goldGramsStr || 0).toFixed(3)} g gross
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Touch {p.goldPurityStr || "—"} → Fine</span>
                          <span className="font-mono text-gold">
                            {Number(mgToGrams(fine)).toFixed(3)} g
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Value @ ₹{p.goldRateStr || 0}/g</span>
                          <span className="font-mono">
                            ₹ {paiseToRupees(rupeesToPaise(p.amountStr))}
                          </span>
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })}
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Paid (Recorded):</span>
                <span className="font-mono">₹ {paiseToRupees(totals.paidPaise)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-500">
                <span>Balance Due:</span>
                <span className="font-mono">₹ {paiseToRupees(totals.balancePaise)}</span>
              </div>
            </div>

            {/* Advance Adjustment Details */}
            {adjustmentLive && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1.5 text-[11px] text-amber-700 dark:text-amber-400">
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
              className="w-full bg-gold hover:bg-gold/90 text-white font-bold h-11 rounded-xl text-xs uppercase shadow-lg transition-all"
            >
              {confirming ? "Issuing…" : "Issue Bill & Print / बिल पूर्ण करा"}
            </Button>
          </div>
        </div>
      </div>

      {/* Stock Inspector Dialog */}
      <Dialog open={!!activeInspectedStock} onOpenChange={() => setActiveInspectedStock(null)}>
        <DialogContent className="max-w-xl rounded-2xl p-6 border-gold/20">
          {activeInspectedStock &&
            (() => {
              const s = activeInspectedStock;
              const currentGoldRate = useSettings.getState().goldRatePerGramPaise || 0;
              const ratePaise = currentGoldRate;
              const previewGoldValuePaise = Math.round((s.fineMg * ratePaise) / 1000);

              // Making charge is always a percentage of gold value, never a
              // flat per-gram amount — legacy per-gram stock rows are
              // converted once to an equivalent percentage for preview.
              const makingChargePct4 =
                s.makingChargePct ??
                (s.makingChargePerGPaise
                  ? previewGoldValuePaise > 0
                    ? ((s.makingChargePerGPaise * (s.grossMg / 1000)) / previewGoldValuePaise) * 100
                    : 0
                  : 12);
              const makingChargesPaise = Math.round(
                (previewGoldValuePaise * makingChargePct4) / 100,
              );

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
              };

              const tot = computeItemTotals(previewItem);
              const totalPaise = tot.lineTotalPaise;
              const gstPaise =
                gst === "gst3"
                  ? Math.round(
                      ((previewItem.makingChargesPaise + previewItem.stoneChargesPaise) * 3) / 100,
                    )
                  : 0;
              const totalAmountWithGst = totalPaise + gstPaise;

              const realPhoto = getRowItemPhoto(s);

              return (
                <div className="grid md:grid-cols-[180px_1fr] gap-6">
                  {/* Photo Section */}
                  <div className="space-y-2">
                    <div className="aspect-square w-full rounded-xl overflow-hidden bg-muted/30 border border-border relative flex items-center justify-center">
                      {realPhoto ? (
                        <img
                          src={realPhoto}
                          referrerPolicy="no-referrer"
                          alt={s.itemName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <StockPhotoImg
                          stockItem={s}
                          className="h-full w-full object-cover"
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
                          <span>Est. GST 3% (on making charges):</span>
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
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
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
  scaleReading?: ScaleReading;
  onWeightFocus?: (type: "gross" | "net") => void;
  onWeightBlur?: () => void;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  if (props.billingType === "manufacturing") {
    return <MfgItemRow {...props} />;
  }
  if (props.billingType === "advance_receipt" || props.billingType === "payment_receipt") {
    return <ReceiptItemRow {...props} />;
  }
  if (props.billingType === "repair" || props.billingType === "polishing") {
    return <ServiceItemRow {...props} />;
  }
  return <StandardItemRow {...props} />;
}

// ── MANUFACTURING ROW COMPONENT ──
function MfgItemRow({
  it,
  idx,
  scaleReading,
  onWeightFocus,
  onWeightBlur,
  onChange,
  onRemove,
}: {
  it: InvoiceItem;
  idx: number;
  scaleReading?: ScaleReading;
  onWeightFocus?: (type: "gross" | "net") => void;
  onWeightBlur?: () => void;
  onChange: (diff: Partial<InvoiceItem>) => void;
  onRemove?: () => void;
}) {
  const [grossStr, setGrossStr] = useState(mgToGrams(it.grossMg).toString());
  const [tunchStr, setTunchStr] = useState(() => (it.purity / 10).toFixed(2));
  const [wstgStr, setWstgStr] = useState(() => (it.otherChargesPaise / 100).toFixed(2));
  const [labourStr, setLabourStr] = useState(() => paiseToRupees(it.stoneChargesPaise));
  const [addWtStr, setAddWtStr] = useState(() => mgToGrams(it.stoneWeightMg || 0).toString());
  const [pcsStr, setPcsStr] = useState(() => String(it.diamondWeightMg || 0));

  useEffect(() => {
    setGrossStr(mgToGrams(it.grossMg).toString());
  }, [it.grossMg]);

  const tunchPct = parseFloat(tunchStr) || 0;
  const wstgPct = parseFloat(wstgStr) || 0;
  const fineMg = Math.round((it.netMg * (tunchPct + wstgPct)) / 100);
  const grossG = parseFloat(mgToGrams(it.grossMg));
  const addWtG = parseFloat(addWtStr) || 0;
  const netG = grossG + addWtG;

  function commitMfgWeights() {
    const netMgCalc = Math.round(netG * 1000);
    onChange({
      netMg: netMgCalc,
      purity: Math.round(tunchPct * 10),
      otherChargesPaise: Math.round(wstgPct * 100),
      stoneWeightMg: Math.round(addWtG * 1000),
      stoneChargesPaise: rupeesToPaise(labourStr),
      diamondWeightMg: parseInt(pcsStr) || 0,
      fineMg,
      goldValuePaise: 0,
      lineTotalPaise: rupeesToPaise(labourStr),
    });
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
        <span className="text-muted-foreground font-bold w-5">P{idx + 1}</span>
        <Input
          value={it.itemName}
          onChange={(e) => onChange({ itemName: e.target.value })}
          className="flex-1 h-7 text-xs font-medium border-none shadow-none bg-transparent focus-visible:ring-1 focus-visible:ring-gold px-0"
          placeholder="Item description (e.g. CHENGING TOPS)"
          data-item-name-input="true"
        />
        <Input
          value={it.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="w-20 h-7 text-xs font-mono border-border/60 text-center"
          placeholder="Stamp"
          title="Stamp (AJP, BIS, 18K...)"
        />
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-border/40">
        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">G.Wt (g)</div>
          <Input
            value={grossStr}
            onFocus={() => onWeightFocus?.("gross")}
            onBlur={() => {
              onWeightBlur?.();
              commitMfgWeights();
            }}
            onChange={(e) => {
              setGrossStr(e.target.value);
              try {
                onChange({ grossMg: gramsToMg(e.target.value) });
              } catch {
                /**/
              }
            }}
            className="h-7 text-xs font-mono border-border/50 focus-visible:ring-gold px-1"
            placeholder="0.000"
          />
          {scaleReading && scaleReading.weightGrams > 0 && (
            <div className="text-[8px] text-emerald-500 font-mono mt-0.5 flex items-center gap-0.5">
              <Scale className="h-2 w-2 animate-pulse" />
              {scaleReading.weightGrams.toFixed(3)}g
            </div>
          )}
        </div>

        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Add Wt</div>
          <Input
            value={addWtStr}
            onChange={(e) => setAddWtStr(e.target.value)}
            onBlur={commitMfgWeights}
            className="h-7 text-xs font-mono border-border/50 px-1"
            placeholder="0.000"
          />
        </div>

        <div className="px-2 py-2 bg-muted/10">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Net Wt</div>
          <div className="h-7 flex items-center font-mono text-xs font-semibold">
            {netG.toFixed(3)}
          </div>
        </div>

        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Tunch</div>
          <Input
            value={tunchStr}
            onChange={(e) => setTunchStr(e.target.value)}
            onBlur={commitMfgWeights}
            className="h-7 text-xs font-mono border-border/50 px-1"
            placeholder="84.00"
          />
        </div>

        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Wstg%</div>
          <Input
            value={wstgStr}
            onChange={(e) => setWstgStr(e.target.value)}
            onBlur={commitMfgWeights}
            className="h-7 text-xs font-mono border-border/50 px-1"
            placeholder="4.00"
          />
        </div>

        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Pcs</div>
          <Input
            value={pcsStr}
            onChange={(e) => setPcsStr(e.target.value)}
            onBlur={commitMfgWeights}
            className="h-7 text-xs font-mono border-border/50 px-1"
            placeholder="1"
            type="number"
          />
        </div>

        <div className="px-2 py-2">
          <div className="text-[9px] uppercase text-muted-foreground font-bold mb-1">
            Labour (₹)
          </div>
          <Input
            value={labourStr}
            onChange={(e) => setLabourStr(e.target.value)}
            onBlur={commitMfgWeights}
            className="h-7 text-xs font-mono border-border/50 px-1"
            placeholder="0"
          />
        </div>

        <div className="px-2 py-2 bg-amber-500/5">
          <div className="text-[9px] uppercase text-amber-600 font-bold mb-1">Fine (g)</div>
          <div className="h-7 flex items-center font-mono text-sm font-bold text-amber-500">
            {(fineMg / 1000).toFixed(3)}
          </div>
        </div>
      </div>
    </div>
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
    <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 p-4 space-y-3">
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
    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
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
  idx,
  scaleReading,
  onWeightFocus,
  onWeightBlur,
  onChange,
  onRemove,
}: {
  it: InvoiceItem;
  idx: number;
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

  const [grossStr, setGrossStr] = useState(mgToGrams(it.grossMg).toString());
  const [netStr, setNetStr] = useState(mgToGrams(it.netMg).toString());
  const [stoneWeightStr, setStoneWeightStr] = useState(mgToGrams(it.stoneWeightMg || 0).toString());
  const [diamondWeightStr, setDiamondWeightStr] = useState(
    ((it.diamondWeightMg || 0) / 200).toString(),
  );
  const [rateStr, setRateStr] = useState(paiseToRupees(it.goldRatePerGramPaise).toString());
  // Making charge is always a percentage of the item's gold value (the
  // jewellery-industry convention), never a flat rupee amount. Existing
  // invoices saved before this field existed only have makingChargesPaise —
  // back-derive an equivalent percentage once so editing them still shows a
  // sensible starting value instead of 0.
  const [mkPctStr, setMkPctStr] = useState(
    (
      it.makingChargePct ??
      (it.goldValuePaise > 0 ? (it.makingChargesPaise / it.goldValuePaise) * 100 : 0)
    ).toString(),
  );
  const [stStr, setStStr] = useState(paiseToRupees(it.stoneChargesPaise).toString());
  const [hmStr, setHmStr] = useState(paiseToRupees(it.hallmarkChargesPaise ?? 0).toString());
  const [otStr, setOtStr] = useState(paiseToRupees(it.otherChargesPaise).toString());
  const [dcStr, setDcStr] = useState(paiseToRupees(it.discountPaise).toString());

  useEffect(() => {
    setGrossStr(mgToGrams(it.grossMg).toString());
  }, [it.grossMg]);

  useEffect(() => {
    setNetStr(mgToGrams(it.netMg).toString());
  }, [it.netMg]);

  useEffect(() => {
    setRateStr(paiseToRupees(it.goldRatePerGramPaise).toString());
  }, [it.goldRatePerGramPaise]);

  // Weight/rate edits change goldValuePaise — recompute makingChargesPaise
  // from the same held percentage so a 12% making charge stays 12% instead
  // of silently drifting back to whatever rupee amount it happened to be.
  useEffect(() => {
    const pct = parseFloat(mkPctStr) || 0;
    const nextPaise = Math.round((it.goldValuePaise * pct) / 100);
    if (nextPaise !== it.makingChargesPaise) {
      onChange({ makingChargesPaise: nextPaise, makingChargePct: pct });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it.goldValuePaise]);

  const thumbnailImg = getRowItemPhoto(it);
  const lessMg = Math.max(0, it.grossMg - it.netMg);
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
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-muted/40 flex-shrink-0 flex items-center justify-center">
          {thumbnailImg ? (
            <img src={thumbnailImg} alt={it.itemName} className="h-full w-full object-cover" />
          ) : stockRef ? (
            <StockPhotoImg
              stockItem={stockRef}
              className="h-full w-full object-cover"
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

      <div className="grid grid-cols-5 divide-x divide-border/50 bg-background/30 text-xs">
        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Gross (g)
          </div>
          <Input
            id={`grossMg-${it.id}`}
            value={grossStr}
            onFocus={() => onWeightFocus?.("gross")}
            onBlur={() => onWeightBlur?.()}
            onChange={(e) => {
              setGrossStr(e.target.value);
              try {
                onChange({ grossMg: gramsToMg(e.target.value) });
              } catch {
                /* */
              }
            }}
            placeholder="0.000"
            className="h-8 text-xs font-mono border-border/60 focus-visible:ring-gold"
          />
          {scaleReading && scaleReading.weightGrams > 0 && (
            <div className="mt-0.5 flex items-center gap-0.5 text-[8px] text-emerald-500 font-mono">
              <Scale className="h-2 w-2 animate-pulse" />
              {scaleReading.weightGrams.toFixed(3)}g
            </div>
          )}
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Net (g)
          </div>
          <Input
            id={`netMg-${it.id}`}
            value={netStr}
            onFocus={() => onWeightFocus?.("net")}
            onBlur={() => onWeightBlur?.()}
            onChange={(e) => {
              setNetStr(e.target.value);
              try {
                onChange({ netMg: gramsToMg(e.target.value) });
              } catch {
                /* */
              }
            }}
            placeholder="0.000"
            className="h-8 text-xs font-mono border-border/60 focus-visible:ring-gold"
          />
        </div>

        <div className="px-3 py-2.5 bg-gold/5">
          <div className="text-[10px] uppercase tracking-wider text-gold/70 font-bold mb-1">
            Fine (g)
          </div>
          <div className="h-8 flex items-center font-mono font-bold text-gold text-sm">
            {mgToGrams(it.fineMg)}
          </div>
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Touch
          </div>
          <Input
            value={String(it.purity)}
            onChange={(e) =>
              onChange({ purity: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })
            }
            className="h-8 text-xs font-mono border-border/60"
          />
        </div>

        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Rate ₹/g
          </div>
          <Input
            value={rateStr}
            onChange={(e) => {
              setRateStr(e.target.value);
              onChange({ goldRatePerGramPaise: rupeesToPaise(e.target.value) });
            }}
            className="h-8 text-xs font-mono border-border/60"
          />
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

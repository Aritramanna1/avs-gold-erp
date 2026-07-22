import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InvoiceItem, PaymentMode, GstKind, BillingType } from "@/lib/billing-store";

// Re-exported (not redefined) so existing `import { BillingType } from
// "./billingStore"` call sites keep working — the canonical definition
// lives in lib/billing-store.ts now.
export type { BillingType };

export interface DraftPayment {
  id: string;
  mode: PaymentMode;
  amountStr: string;
  reference: string;
  notes: string;
  goldGramsStr: string;
  goldPurityStr: string;
  goldRateStr: string;
}

export interface LedgerSummary {
  outstandingAmountPaise: number | null;
  totalDebitPaise: number | null;
  totalCreditPaise: number | null;
  advancePaise: number | null;
  closingBalancePaise: number | null;
}

export interface GoldLedgerSummary {
  totalGrossMg: number | null;
  totalFineMg: number | null;
  depositMg: number | null;
  advanceMg: number | null;
  exchangeMg: number | null;
  closingGoldMg: number | null;
}

export interface BillingState {
  // Core Selection
  customerId: string | null;
  selectedOrderId: string | null;
  selectedStockId: string | null;
  selectedJobId: string | null;
  billingType: BillingType | null;
  gst: GstKind | null;

  // Active Draft Content
  items: InvoiceItem[] | null;
  payments: DraftPayment[] | null;

  // Search Queries & UI State
  customerSearch: string | null;
  orderSearch: string | null;
  stockSearchQuery: string | null;

  // Ledger States (All fields nullable)
  customerLedger: LedgerSummary | null;
  goldLedger: GoldLedgerSummary | null;

  // Actions
  setCustomerId: (id: string | null) => void;
  setSelectedOrderId: (id: string | null) => void;
  setSelectedStockId: (id: string | null) => void;
  setSelectedJobId: (id: string | null) => void;
  setBillingType: (type: BillingType | null) => void;
  setGst: (gst: GstKind | null) => void;

  setItems: (items: InvoiceItem[] | null) => void;
  setPayments: (payments: DraftPayment[] | null) => void;

  setCustomerSearch: (query: string | null) => void;
  setOrderSearch: (query: string | null) => void;
  setStockSearchQuery: (query: string | null) => void;

  setCustomerLedger: (ledger: LedgerSummary | null) => void;
  setGoldLedger: (ledger: GoldLedgerSummary | null) => void;

  resetBillingSession: () => void;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set) => ({
      customerId: null,
      selectedOrderId: null,
      selectedStockId: null,
      selectedJobId: null,
      billingType: "manufacturing",
      gst: "gst3",
      items: [],
      payments: [],
      customerSearch: "",
      orderSearch: "",
      stockSearchQuery: "",
      customerLedger: null,
      goldLedger: null,

      setCustomerId: (id) => set({ customerId: id }),
      setSelectedOrderId: (id) => set({ selectedOrderId: id }),
      setSelectedStockId: (id) => set({ selectedStockId: id }),
      setSelectedJobId: (id) => set({ selectedJobId: id }),
      setBillingType: (type) => set({ billingType: type }),
      setGst: (gst) => set({ gst: gst }),

      setItems: (items) => set({ items: items }),
      setPayments: (payments) => set({ payments: payments }),

      setCustomerSearch: (query) => set({ customerSearch: query }),
      setOrderSearch: (query) => set({ orderSearch: query }),
      setStockSearchQuery: (query) => set({ stockSearchQuery: query }),

      setCustomerLedger: (ledger) => set({ customerLedger: ledger }),
      setGoldLedger: (ledger) => set({ goldLedger: ledger }),

      resetBillingSession: () =>
        set({
          customerId: null,
          selectedOrderId: null,
          selectedStockId: null,
          selectedJobId: null,
          billingType: "manufacturing",
          gst: "gst3",
          items: [],
          payments: [],
          customerSearch: "",
          orderSearch: "",
          stockSearchQuery: "",
          customerLedger: null,
          goldLedger: null,
        }),
    }),
    {
      name: "mtj-billing-module-state-v1",
    },
  ),
);

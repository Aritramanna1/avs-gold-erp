import { useEffect, useState, useMemo } from "react";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useLedger } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { useWorkers } from "@/lib/workers-store";
import { generateNumber } from "@/lib/numbers";
import { mgToGrams, gramsToMg } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { listGoldSettlements } from "@/lib/supabase-services";
import {
  Plus,
  Printer,
  Trash,
  Info,
  Search,
  Coins,
  Scale,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export interface SettlementItem {
  id: string;
  kind: "gold" | "cash";
  description: string;
  huid?: string;
  stamp?: string;
  grossGrams?: number;
  /** Weight added to the item (e.g. repair solder, added findings) — increases net weight, the opposite of lessGrams. */
  addGrams?: number;
  lessGrams?: number;
  netGrams?: number; // = grossGrams + addGrams - lessGrams
  purity?: number; // e.g. 91.60
  wastagePct?: number; // e.g. 4.00
  pcs?: number;
  labourRupees?: number;
  fineGrams?: number; // netGrams * (purity + wastagePct) / 100
  goldRate?: number; // conversion rate
  amountRupees?: number; // conversion amount
  direction: "Jama" | "Naam"; // Jama = Received by us (Credit), Naam = Given by us (Debit)
  /** "item" = goods/gold physically changing hands (legacy's "P" row) — counted into Net Total.
   *  "settlement" = a payment/settlement against the balance (legacy's "MP" row) — counted only into Closing Balance, after Net Total. */
  rowType: "item" | "settlement";
}

export function GoldSettlementTab() {
  const { settlements, addSettlement } = useGoldSettlement();
  const people = usePeople((s) => s.people);
  const { branches, selectedBranchId, firm } = useSettings();

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filterParty, setFilterParty] = useState("");

  // Test suite audit state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditResults, setAuditResults] = useState<any[]>([]);

  const handleRunAudit = () => {
    import("@/lib/gold-payment-test-suite").then(async ({ runGoldPaymentTestSuite }) => {
      const results = await runGoldPaymentTestSuite();
      setAuditResults(results);
      setAuditOpen(true);
      toast.success("compliance audit test run completed!");
    });
  };

  // Voucher Master Form Fields
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split("T")[0]);
  const [partyType, setPartyType] = useState<"customer" | "worker" | "vendor" | "internal">(
    "customer",
  );
  const [partyId, setPartyId] = useState("");
  const [customPartyName, setCustomPartyName] = useState(""); // If internal
  const [branchId, setBranchId] = useState(selectedBranchId || "MAIN");
  const [linkUse, setLinkUse] = useState<string>("general");
  const [paymentMode, setPaymentMode] = useState<string>("Mixed Payment");
  const [notes, setNotes] = useState("");

  // Selected invoice state for linking payments
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const invoices = useBilling((s) => s.invoices);
  const partyInvoices = useMemo(() => {
    if (!partyId || partyType !== "customer") return [];
    return invoices.filter((inv) => inv.customerId === partyId && inv.status !== "paid");
  }, [invoices, partyId, partyType]);

  // Auto-select invoice
  useEffect(() => {
    if (partyInvoices.length > 0) {
      setSelectedInvoiceId(partyInvoices[0].id);
    } else {
      setSelectedInvoiceId("");
    }
  }, [partyInvoices, linkUse]);

  // Multi-item creation list
  const [items, setItems] = useState<SettlementItem[]>([]);

  // Item Active Row Editor Fields
  const [activeKind, setActiveKind] = useState<"gold" | "cash">("gold");
  const [activeDesc, setActiveDesc] = useState("");
  const [activeHuid, setActiveHuid] = useState("");
  const [activeStamp, setActiveStamp] = useState("");
  const [activeGrossGrams, setActiveGrossGrams] = useState("");
  const [activeAddGrams, setActiveAddGrams] = useState("");
  const [activeLessGrams, setActiveLessGrams] = useState("");
  const [activePurity, setActivePurity] = useState("91.60"); // Touch
  const [activeWastagePct, setActiveWastagePct] = useState("0.00"); // Wastage
  const [activePcs, setActivePcs] = useState("");
  const [activeLabour, setActiveLabour] = useState("");
  const [activeGoldRate, setActiveGoldRate] = useState("");
  const [activeAmount, setActiveAmount] = useState("");
  const [activeDirection, setActiveDirection] = useState<"Jama" | "Naam">("Jama");
  const [activeRowType, setActiveRowType] = useState<"item" | "settlement">("item");

  // Pull existing settlements from DB on load
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const live = await listGoldSettlements();
        if (live && live.length > 0) {
          useGoldSettlement.setState({ settlements: live });
        }
      } catch (err) {
        console.error("Failed to load live settlements:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Filter parties based on type
  const partiesToSelect = useMemo(() => {
    if (partyType === "customer") {
      return people.filter((p) => p.type === "customer" || p.type === "firm_customer");
    }
    if (partyType === "worker") {
      return people.filter(
        (p) => p.type === "worker" || p.type === "karigar" || p.type === "outside_worker",
      );
    }
    if (partyType === "vendor") {
      return people.filter((p) => p.type === "vendor");
    }
    return [];
  }, [people, partyType]);

  // Set default party whenever type updates
  useEffect(() => {
    if (partiesToSelect.length > 0) {
      setPartyId(partiesToSelect[0].id);
    } else {
      setPartyId("");
    }
  }, [partiesToSelect, partyType]);

  // Previous balance — system-computed only, never hand-entered. It is the
  // exact sum of every prior voucher's signed gold/cash movement for this
  // party, i.e. the last voucher's closing balance. Locking this (no
  // editable input) matches the legacy ledger, where LB Bal. is always a
  // computed carry-forward, never a typed-in figure.
  const partySettlements = useMemo(
    () =>
      settlements
        .filter((s) => s.party_id === partyId)
        .sort((a, b) => b.settlement_date.localeCompare(a.settlement_date)),
    [settlements, partyId],
  );
  const previousGoldMgSum = useMemo(
    () => partySettlements.reduce((sum, s) => sum + (s.gold_entry_mg ?? 0), 0),
    [partySettlements],
  );
  const previousCashPaiseSum = useMemo(
    () => partySettlements.reduce((sum, s) => sum + (s.cash_entry_paise ?? 0), 0),
    [partySettlements],
  );
  // The single most recent prior voucher — cited on-screen and on print as
  // "LB Bal. [#<voucher> · <date>]", the same lineage the legacy report shows.
  const previousVoucher = partySettlements[0] ?? null;

  // Active item calculations
  const calculatedActiveNetGrams = useMemo(() => {
    const gross = Number(activeGrossGrams) || 0;
    const add = Number(activeAddGrams) || 0;
    const less = Number(activeLessGrams) || 0;
    return Math.max(0, gross + add - less);
  }, [activeGrossGrams, activeAddGrams, activeLessGrams]);

  const calculatedActiveFineGrams = useMemo(() => {
    const net = calculatedActiveNetGrams;
    const purityVal = Number(activePurity) || 0;
    const waste = Number(activeWastagePct) || 0;
    return Math.max(0, (net * (purityVal + waste)) / 100);
  }, [calculatedActiveNetGrams, activePurity, activeWastagePct]);

  // Auto-calculate item cash rate conversion
  useEffect(() => {
    const rate = Number(activeGoldRate) || 0;
    if (rate > 0 && calculatedActiveNetGrams > 0) {
      setActiveAmount(Math.round(calculatedActiveNetGrams * rate).toString());
    }
  }, [activeGoldRate, calculatedActiveNetGrams]);

  const handleAddItemRow = () => {
    if (!activeDesc.trim()) {
      toast.error("Please enter a description/particulars for this item.");
      return;
    }

    if (activeKind === "gold") {
      const gross = Number(activeGrossGrams) || 0;
      if (gross <= 0) {
        toast.error("Gross weight must be greater than 0");
        return;
      }

      const newItem: SettlementItem = {
        id: `item_${Date.now()}`,
        kind: "gold",
        description: activeDesc.trim(),
        huid: activeHuid.trim() || undefined,
        stamp: activeStamp.trim() || undefined,
        grossGrams: gross,
        addGrams: Number(activeAddGrams) || 0,
        lessGrams: Number(activeLessGrams) || 0,
        netGrams: calculatedActiveNetGrams,
        purity: Number(activePurity) || 91.6,
        wastagePct: Number(activeWastagePct) || 0,
        pcs: activePcs.trim() ? Number(activePcs) : undefined,
        labourRupees: activeLabour.trim() ? Number(activeLabour) : undefined,
        fineGrams: calculatedActiveFineGrams,
        goldRate: activeGoldRate.trim() ? Number(activeGoldRate) : undefined,
        amountRupees: activeAmount.trim() ? Number(activeAmount) : undefined,
        direction: activeDirection,
        rowType: activeRowType,
      };

      setItems([...items, newItem]);
      toast.success("Added Gold Item Row successfully!");
    } else {
      const amount = Number(activeAmount) || 0;
      if (amount <= 0) {
        toast.error("Cash amount must be greater than 0");
        return;
      }

      const newItem: SettlementItem = {
        id: `item_${Date.now()}`,
        kind: "cash",
        description: activeDesc.trim(),
        amountRupees: amount,
        direction: activeDirection,
        rowType: activeRowType,
      };

      setItems([...items, newItem]);
      toast.success("Added Cash Entry Row successfully!");
    }

    // Reset editor fields
    setActiveDesc("");
    setActiveHuid("");
    setActiveStamp("");
    setActiveGrossGrams("");
    setActiveAddGrams("");
    setActiveLessGrams("");
    setActivePcs("");
    setActiveLabour("");
    setActiveGoldRate("");
    setActiveAmount("");
  };

  const handleRemoveItemRow = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
    toast.message("Item row removed");
  };

  // Helper Labels
  const linkUseLabel = (val: string) => {
    switch (val) {
      case "advance":
        return "Advance against Order";
      case "invoice":
        return "Invoice Payment";
      case "old_gold":
        return "Old Gold Exchange";
      case "karigar_settlement":
        return "Karigar Settlement";
      case "worker_return":
        return "Worker Gold Return";
      case "rate_cut":
        return "Rate-cut Settlement";
      default:
        return "General Balance Adjustment";
    }
  };

  // Live calculations for the complete voucher summary
  const todayGoldJamaGrams = useMemo(() => {
    return items
      .filter((it) => it.kind === "gold" && it.direction === "Jama")
      .reduce((sum, it) => sum + (it.fineGrams || 0), 0);
  }, [items]);

  const todayGoldNaamGrams = useMemo(() => {
    return items
      .filter((it) => it.kind === "gold" && it.direction === "Naam")
      .reduce((sum, it) => sum + (it.fineGrams || 0), 0);
  }, [items]);

  const todayCashJamaRupees = useMemo(() => {
    return items
      .filter((it) => it.direction === "Jama")
      .reduce((sum, it) => {
        if (it.kind === "cash") return sum + (it.amountRupees || 0);
        // also count gold labour charges as received cash if we are charging it (it's custom/worker)
        return sum + (it.labourRupees || 0);
      }, 0);
  }, [items]);

  const todayCashNaamRupees = useMemo(() => {
    return items
      .filter((it) => it.direction === "Naam")
      .reduce((sum, it) => {
        if (it.kind === "cash") return sum + (it.amountRupees || 0);
        // Also capture converted gold values or payouts
        const conv = it.amountRupees || 0;
        const lab = it.labourRupees || 0;
        return sum + conv + lab;
      }, 0);
  }, [items]);

  // Net Total — the legacy report's own checkpoint: Previous Balance plus
  // only today's ITEM rows (goods/gold changing hands), printed BEFORE any
  // settlement/payment rows are netted in. Closing Balance (below) folds in
  // the settlement rows on top of this.
  const netTotalGoldMg = useMemo(() => {
    const itemNetGrams = items
      .filter((it) => it.kind === "gold" && it.rowType === "item")
      .reduce((sum, it) => sum + (it.direction === "Jama" ? 1 : -1) * (it.fineGrams || 0), 0);
    return previousGoldMgSum + Math.round(itemNetGrams * 1000);
  }, [previousGoldMgSum, items]);

  const netTotalCashPaise = useMemo(() => {
    const itemNetRupees = items
      .filter((it) => it.rowType === "item")
      .reduce((sum, it) => {
        const val = it.kind === "cash" ? it.amountRupees || 0 : it.labourRupees || 0;
        return sum + (it.direction === "Jama" ? 1 : -1) * val;
      }, 0);
    return previousCashPaiseSum + rupeesToPaise(itemNetRupees.toString());
  }, [previousCashPaiseSum, items]);

  const closingGoldMg = useMemo(() => {
    const todayNetMg = Math.round((todayGoldJamaGrams - todayGoldNaamGrams) * 1000);
    return previousGoldMgSum + todayNetMg;
  }, [previousGoldMgSum, todayGoldJamaGrams, todayGoldNaamGrams]);

  const closingCashPaise = useMemo(() => {
    const todayNetPaise = rupeesToPaise((todayCashJamaRupees - todayCashNaamRupees).toString());
    return previousCashPaiseSum + todayNetPaise;
  }, [previousCashPaiseSum, todayCashJamaRupees, todayCashNaamRupees]);

  const handleVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (partyType !== "internal" && !partyId) {
      toast.error("Please select a target party.");
      return;
    }
    if (partyType === "internal" && !customPartyName.trim()) {
      toast.error("Please specify the internal account details.");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one Gold or Cash item to this voucher sheet.");
      return;
    }

    try {
      setLoading(true);

      // 1. Generate the voucher number — one continuous counter for the
      // shop's lifetime (sequence-manager.ts's getNextSequenceNumber), never
      // reset by date or financial year.
      const voucherNo = await generateNumber("gold_settlement");

      // 2. Prepare aggregated fallback fields for database structure compatibility
      const firstGoldItem = items.find((it) => it.kind === "gold");
      const samplePurity = firstGoldItem?.purity ? Math.round(firstGoldItem.purity * 10) : 916;
      const sampleRatePaise = firstGoldItem?.goldRate
        ? rupeesToPaise(firstGoldItem.goldRate.toString())
        : 0;

      const sumGrossMg = items
        .filter((it) => it.kind === "gold")
        .reduce((sum, it) => sum + Math.round((it.grossGrams || 0) * 1000), 0);

      const sumNetMg = items
        .filter((it) => it.kind === "gold")
        .reduce((sum, it) => sum + Math.round((it.netGrams || 0) * 1000), 0);

      const sumWastageMg = items
        .filter((it) => it.kind === "gold")
        .reduce((sum, it) => {
          const wasteVal = ((it.netGrams || 0) * (it.wastagePct || 0)) / 100;
          return sum + Math.round(wasteVal * 1000);
        }, 0);

      let resolvedPartyName = customPartyName;
      let finalPartyId = partyId;

      if (partyType !== "internal") {
        const per = people.find((p) => p.id === partyId);
        resolvedPartyName = per ? per.fullName : "Unknown";
      } else {
        finalPartyId = `internal_${Date.now()}`;
      }

      // Signed values for this slip
      const slipNetGoldMg = Math.round((todayGoldJamaGrams - todayGoldNaamGrams) * 1000);
      const slipNetCashPaise = rupeesToPaise(
        (todayCashJamaRupees - todayCashNaamRupees).toString(),
      );

      // Save persistent settlement row
      await addSettlement({
        id: voucherNo,
        settlement_date: new Date(settlementDate).toISOString(),
        party_type: partyType,
        party_id: finalPartyId,
        branch_id: branchId,
        settlement_type:
          linkUse === "karigar_settlement"
            ? "final_settlement"
            : slipNetGoldMg >= 0
              ? "gold_received"
              : "gold_given",
        purity: samplePurity,
        gross_mg: sumGrossMg > 0 ? sumGrossMg : 1,
        net_mg: sumNetMg > 0 ? sumNetMg : 1,
        wastage_mg: sumWastageMg,
        rate_per_gram_paise: sampleRatePaise,
        amount_paise: Math.abs(slipNetCashPaise),
        payment_mode: paymentMode,
        notes: `${notes} [Voucher Action: ${linkUseLabel(linkUse)}]`.trim(),

        // Extra dynamic variables persisted inside the 'data' JSON field
        items: items,
        p_balance_gold_mg: previousGoldMgSum,
        p_balance_cash_paise: previousCashPaiseSum,
        p_balance_ref_voucher_id: previousVoucher?.id,
        p_balance_ref_voucher_date: previousVoucher?.settlement_date,
        gold_entry_mg: slipNetGoldMg,
        cash_entry_paise: slipNetCashPaise,
        direction: slipNetGoldMg >= 0 ? "Jama" : "Naam",
        link_use: linkUse,
      });

      // If linked to an invoice, apply payments to reduce the invoice outstanding in useBilling
      if (linkUse === "invoice" && selectedInvoiceId && partyType === "customer") {
        const billingAddPayment = useBilling.getState().addPayment;
        items.forEach((it) => {
          const amtPaise = rupeesToPaise(it.amountRupees || 0);
          if (amtPaise <= 0) return;

          if (it.kind === "cash") {
            let mode: any = "cash";
            const descLower = it.description.toLowerCase();
            if (descLower.includes("upi")) {
              mode = "upi";
            } else if (descLower.includes("bank") || descLower.includes("transfer")) {
              mode = "bank";
            } else if (descLower.includes("card")) {
              mode = "card";
            }
            billingAddPayment(selectedInvoiceId, {
              mode,
              amountPaise: amtPaise,
              reference: voucherNo,
              notes: `${it.description} [Voucher No: ${voucherNo}]`,
            });
          } else if (it.kind === "gold") {
            billingAddPayment(selectedInvoiceId, {
              mode: "gold_exchange",
              amountPaise: amtPaise,
              reference: voucherNo,
              notes: `${it.description} [Voucher No: ${voucherNo}]`,
              goldGrossMg: Math.round((it.grossGrams || 0) * 1000),
              goldPurity: Math.round((it.purity || 91.6) * 10),
              goldFineMg: Math.round((it.fineGrams || 0) * 1000),
              goldRatePerGramPaise: rupeesToPaise(it.goldRate || 0),
            });
          }
        });
      }

      // If worker, log in useWorkers registry / worker passbook
      if (partyType === "worker") {
        const workersState = useWorkers.getState();
        items.forEach((it) => {
          if (it.kind === "gold") {
            if (it.direction === "Jama") {
              workersState.addWastageReturn({
                workerId: finalPartyId,
                date: settlementDate,
                grossMg: Math.round((it.grossGrams || 0) * 1000),
                purity: Math.round((it.purity || 91.6) * 10) as any,
                fineMg: Math.round((it.fineGrams || 0) * 1000),
                notes: `${it.description} via gold voucher ${voucherNo}`,
              });
            } else {
              workersState.addGoldAdvance({
                workerId: finalPartyId,
                date: settlementDate,
                grossMg: Math.round((it.grossGrams || 0) * 1000),
                purity: Math.round((it.purity || 91.6) * 10) as any,
                fineMg: Math.round((it.fineGrams || 0) * 1000),
                reason: `${it.description} via gold voucher ${voucherNo}`,
              });
            }
          } else {
            if (it.direction === "Naam") {
              workersState.addWithdrawal({
                workerId: finalPartyId,
                date: settlementDate,
                amountPaise: rupeesToPaise(it.amountRupees || 0),
                mode: "cash",
                notes: `${it.description} via gold voucher ${voucherNo}`,
              });
            }
          }
        });

        if (linkUse === "karigar_settlement") {
          const goldNaamSumMg = items
            .filter((it) => it.kind === "gold" && it.direction === "Naam")
            .reduce((sum, it) => sum + Math.round((it.fineGrams || 0) * 1000), 0);
          const goldJamaSumMg = items
            .filter((it) => it.kind === "gold" && it.direction === "Jama")
            .reduce((sum, it) => sum + Math.round((it.fineGrams || 0) * 1000), 0);

          workersState.addSettlement({
            workerId: finalPartyId,
            fromDate: settlementDate,
            toDate: settlementDate,
            presentDays: 1,
            halfDays: 0,
            absentDays: 0,
            leaveDays: 0,
            payableDays: 1,
            salaryEarnedPaise: 0,
            withdrawalsTotalPaise: Math.max(0, -slipNetCashPaise),
            loanDeductionPaise: 0,
            advanceDeductionPaise: 0,
            finalCashPayablePaise: slipNetCashPaise,
            loanDeductions: {},
            advanceDeductions: {},
            goldAdvanceFineMg: goldNaamSumMg,
            wastageReturnedFineMg: goldJamaSumMg,
            netGoldMg: goldNaamSumMg - goldJamaSumMg,
            notes: `Auto settle via Gold Voucher ${voucherNo}: ${notes}`,
          });
        }
      }

      // 3. Record double-entry items in the official Gold Ledger
      const appendLedger = useLedger.getState().append;
      const goldRows = items.filter((it) => it.kind === "gold");

      goldRows.forEach((it) => {
        const itemPurityNum = Math.round((it.purity || 91.6) * 10); // e.g. 91.60 => 916
        const itemGrossMg = Math.round((it.grossGrams || 0) * 1000);
        const itemFineMg = Math.round((it.fineGrams || 0) * 1000);

        const isJama = it.direction === "Jama";
        const factorSign = isJama ? 1 : -1;

        let netFineMg = 0;
        let deltas: any = {};

        if (partyType === "worker") {
          // Worker transaction: transfer accountability (keeps system total constant, net fine change = 0)
          netFineMg = 0;
          if (isJama) {
            deltas = { vault: itemFineMg, karigar: -itemFineMg };
          } else {
            deltas = { vault: -itemFineMg, karigar: itemFineMg };
          }
        } else {
          // Customer / Vendor transaction: physical metal enters or leaves our vault
          netFineMg = factorSign * itemFineMg;
          deltas = { vault: factorSign * itemFineMg };
        }

        appendLedger({
          type: isJama ? "customer_gold_received" : "issue_to_karigar",
          netFineMg,
          deltas,
          grossMg: itemGrossMg,
          purity: itemPurityNum as any,
          fineMg: itemFineMg,
          form: linkUse === "old_gold" && isJama ? "old_gold" : "other",
          reference: voucherNo,
          notes: `${it.description} [Voucher No: ${voucherNo}] [Party: ${resolvedPartyName}] (${linkUseLabel(linkUse)})`,
        });
      });

      toast.success(`Government-traceable voucher ${voucherNo} stored successfully.`);
      setOpen(false);
      setItems([]);
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize settlement voucher");
    } finally {
      setLoading(false);
    }
  };

  // Filtered local table search
  const filteredList = useMemo(() => {
    const q = filterParty.toLowerCase();
    return settlements.filter((s) => {
      let name = "";
      if (s.party_type === "internal") {
        name = "Internal Account";
      } else {
        const p = people.find((x) => x.id === s.party_id);
        name = p ? p.fullName : "Unknown Party";
      }
      return (
        name.toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [settlements, filterParty, people]);

  return (
    <div className="space-y-4">
      {/* Filters & Trigger Section */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filterParty}
            onChange={(e) => setFilterParty(e.target.value)}
            placeholder="Search voucher, party, notes..."
            className="pl-9 w-full rounded-xl bg-card border-border"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 font-medium rounded-xl transition-all cursor-pointer shadow-sm"
            onClick={handleRunAudit}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Run Gold Payment Audit
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-medium shadow-md transition-all rounded-xl cursor-pointer">
                <Plus className="h-4 w-4" /> Create Gold Payment Voucher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl text-yellow-600 flex items-center gap-2">
                  <Coins className="h-6 w-6 text-gold animate-bounce" /> MTJ Gold Payment &
                  Settlement Voucher
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleVoucherSubmit} className="space-y-6 pt-2">
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/40 p-4 rounded-2xl border border-border">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={settlementDate}
                      onChange={(e) => setSettlementDate(e.target.value)}
                      required
                      className="mt-1 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Branch
                    </Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Voucher Link
                    </Label>
                    <Select value={linkUse} onValueChange={setLinkUse}>
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Adjustment</SelectItem>
                        <SelectItem value="advance">Advance against Order</SelectItem>
                        <SelectItem value="invoice">Invoice Payment</SelectItem>
                        <SelectItem value="old_gold">Old Gold Exchange</SelectItem>
                        <SelectItem value="karigar_settlement">
                          Worker / Karigar Settlement
                        </SelectItem>
                        <SelectItem value="worker_return">Worker Metal Return</SelectItem>
                        <SelectItem value="rate_cut">Rate-Cut Settlement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Payment Mode
                    </Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mixed Payment">Mixed Payment / Multi-asset</SelectItem>
                        <SelectItem value="Gold Payment">Pure Gold Payment</SelectItem>
                        <SelectItem value="Old Gold">Old Gold Exchanged</SelectItem>
                        <SelectItem value="Cash">Cash Only</SelectItem>
                        <SelectItem value="UPI">UPI / Digital</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Party Select */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border pb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Party Type
                    </Label>
                    <Select
                      value={partyType}
                      onValueChange={(v) =>
                        setPartyType(v as "customer" | "worker" | "vendor" | "internal")
                      }
                    >
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="worker">Worker / Karigar</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                        <SelectItem value="internal">Internal Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    {partyType === "internal" ? (
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                          Account / Party Name
                        </Label>
                        <Input
                          value={customPartyName}
                          onChange={(e) => setCustomPartyName(e.target.value)}
                          placeholder="Workshop Exchange Account..."
                          required
                          className="mt-1 bg-background"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                          Select Person
                        </Label>
                        <Select value={partyId} onValueChange={setPartyId}>
                          <SelectTrigger className="mt-1 bg-background">
                            <SelectValue placeholder="Choose person..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[250px]">
                            {partiesToSelect.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.fullName} {p.phone ? `· ${p.phone}` : ""}
                              </SelectItem>
                            ))}
                            {partiesToSelect.length === 0 && (
                              <SelectItem value="none" disabled>
                                No {partyType}s found in directory.
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {linkUse === "invoice" && partyType === "customer" && (
                  <div className="grid grid-cols-1 gap-4 border border-amber-500/20 pb-4 bg-amber-500/5 p-4 rounded-2xl">
                    <div>
                      <Label className="text-xs text-amber-600 uppercase font-bold tracking-wider">
                        Select Unpaid Invoice to Apply Payment
                      </Label>
                      <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                        <SelectTrigger className="mt-1 bg-background border-amber-500/30">
                          <SelectValue placeholder="Choose an active invoice..." />
                        </SelectTrigger>
                        <SelectContent>
                          {partyInvoices.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.invoiceNo} (Date: {new Date(inv.createdAt).toLocaleDateString()},
                              Total: ₹{paiseToRupees(inv.grandTotalPaise)}, Unpaid Balance: ₹
                              {paiseToRupees(inv.balancePaise)})
                            </SelectItem>
                          ))}
                          {partyInvoices.length === 0 && (
                            <SelectItem value="none" disabled>
                              No active unpaid invoices found for this customer.
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Previous Balances (Separate Cash & Gold) — locked, system-computed */}
                <div className="bg-amber-500/5 p-4 rounded-2xl border border-yellow-500/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-yellow-600 uppercase">
                        Previous Gold Balance
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Locked · from ledger
                      </span>
                    </div>
                    <div className="bg-background border border-border rounded-lg px-3 py-2 font-mono text-sm font-semibold">
                      {mgToGrams(Math.abs(previousGoldMgSum))} g{" "}
                      {previousGoldMgSum >= 0 ? "Jama" : "Naam"}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-yellow-600 uppercase">
                        Previous Cash Balance
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Locked · from ledger
                      </span>
                    </div>
                    <div className="bg-background border border-border rounded-lg px-3 py-2 font-mono text-sm font-semibold">
                      ₹{paiseToRupees(Math.abs(previousCashPaiseSum))}{" "}
                      {previousCashPaiseSum >= 0 ? "Jama" : "Naam"}
                    </div>
                  </div>

                  {previousVoucher && (
                    <div className="md:col-span-2 text-[11px] text-muted-foreground font-mono">
                      LB Bal. carried forward from voucher{" "}
                      <span className="text-foreground font-semibold">#{previousVoucher.id}</span> ·{" "}
                      {new Date(previousVoucher.settlement_date).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>

                {/* Item Active Row Editor */}
                <div className="bg-muted/30 p-4 rounded-2xl border border-border space-y-4">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Add Transaction Line
                    </span>
                    <div className="flex bg-background border border-border p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveKind("gold")}
                        className={`px-3 py-1 rounded-md transition-all ${activeKind === "gold" ? "bg-amber-500 text-white font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Metal / Gold Row
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveKind("cash")}
                        className={`px-3 py-1 rounded-md transition-all ${activeKind === "cash" ? "bg-amber-500 text-white font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Cash / Charge Row
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Label className="text-xs font-semibold">Description / Particulars *</Label>
                      <Input
                        value={activeDesc}
                        onChange={(e) => setActiveDesc(e.target.value)}
                        placeholder={
                          activeKind === "gold"
                            ? "e.g. Old Gold Chain, 22K Ornaments"
                            : "e.g. Cash advances, Labour charges"
                        }
                        className="mt-1 bg-background"
                      />
                    </div>

                    {activeKind === "gold" && (
                      <>
                        <div>
                          <Label className="text-xs font-semibold">HUID</Label>
                          <Input
                            value={activeHuid}
                            onChange={(e) => setActiveHuid(e.target.value)}
                            placeholder="e.g. HU1234"
                            className="mt-1 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold">Stamp</Label>
                          <Input
                            value={activeStamp}
                            onChange={(e) => setActiveStamp(e.target.value)}
                            placeholder="e.g. AJP"
                            className="mt-1 bg-background"
                          />
                        </div>
                      </>
                    )}

                    {activeKind === "cash" && (
                      <div>
                        <Label className="text-xs font-semibold">Amount (₹) *</Label>
                        <Input
                          type="number"
                          value={activeAmount}
                          onChange={(e) => setActiveAmount(e.target.value)}
                          placeholder="0"
                          className="mt-1 bg-background"
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-semibold">Row Direction *</Label>
                      <Select
                        value={activeDirection}
                        onValueChange={(v) => setActiveDirection(v as any)}
                      >
                        <SelectTrigger className="mt-1 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Jama">
                            Jama / Credit (Party gave us / deposit)
                          </SelectItem>
                          <SelectItem value="Naam">
                            Naam / Debit (We gave party / withdrawal)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Row Category *</Label>
                      <Select
                        value={activeRowType}
                        onValueChange={(v) => setActiveRowType(v as any)}
                      >
                        <SelectTrigger className="mt-1 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="item">Item (goods/gold changing hands)</SelectItem>
                          <SelectItem value="settlement">
                            Settlement (payment against balance)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activeKind === "gold" && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 border-t border-border pt-3">
                      <div>
                        <Label className="text-xs font-semibold">Gross Wt (g) *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={activeGrossGrams}
                          onChange={(e) => setActiveGrossGrams(e.target.value)}
                          placeholder="0.000"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Add Wt (g)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={activeAddGrams}
                          onChange={(e) => setActiveAddGrams(e.target.value)}
                          placeholder="0.000"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Less Weight (g)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={activeLessGrams}
                          onChange={(e) => setActiveLessGrams(e.target.value)}
                          placeholder="0.000"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Tunch / Touch (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={activePurity}
                          onChange={(e) => setActivePurity(e.target.value)}
                          className="mt-1 bg-background font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Wastage (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={activeWastagePct}
                          onChange={(e) => setActiveWastagePct(e.target.value)}
                          className="mt-1 bg-background font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Pcs (Qty)</Label>
                        <Input
                          type="number"
                          value={activePcs}
                          onChange={(e) => setActivePcs(e.target.value)}
                          placeholder="0"
                          className="mt-1 bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {activeKind === "gold" && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <Label className="text-xs font-semibold">Labour (₹)</Label>
                        <Input
                          type="number"
                          value={activeLabour}
                          onChange={(e) => setActiveLabour(e.target.value)}
                          placeholder="Optional"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Gold Rate Conversion (₹/g)</Label>
                        <Input
                          type="number"
                          value={activeGoldRate}
                          onChange={(e) => setActiveGoldRate(e.target.value)}
                          placeholder="Optional"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Converted Value (₹)</Label>
                        <Input
                          type="number"
                          value={activeAmount}
                          onChange={(e) => setActiveAmount(e.target.value)}
                          placeholder="0"
                          className="mt-1 bg-background"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground p-1 bg-background/50 border border-border/80 rounded col-span-2">
                        <div>
                          Net Wt:{" "}
                          <span className="font-bold text-foreground">
                            {calculatedActiveNetGrams.toFixed(3)}g
                          </span>
                        </div>
                        <div>
                          Fine:{" "}
                          <span className="font-bold text-amber-500">
                            {calculatedActiveFineGrams.toFixed(3)}g
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-dashed border-border">
                    <Button
                      type="button"
                      onClick={handleAddItemRow}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-4"
                    >
                      + Add to Voucher
                    </Button>
                  </div>
                </div>

                {/* Items Table Queue inside modal */}
                {items.length > 0 && (
                  <div className="border border-border rounded-2xl overflow-hidden bg-background">
                    <div className="bg-muted px-4 py-2 font-semibold text-xs text-muted-foreground border-b border-border uppercase tracking-widest flex justify-between items-center">
                      <span>Voucher Bill Items ({items.length})</span>
                      <span className="font-mono text-[10px]">No calculations mix cash & gold</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border text-[10px] uppercase text-muted-foreground font-bold">
                            <th className="p-2">Description</th>
                            <th className="p-2">Direction</th>
                            <th className="p-2 text-right">G.Wt</th>
                            <th className="p-2 text-right">Add</th>
                            <th className="p-2 text-right">Less</th>
                            <th className="p-2 text-right">Net Wt</th>
                            <th className="p-2 text-center">Tunch+Wst</th>
                            <th className="p-2 text-right font-medium text-amber-600">Fine Gold</th>
                            <th className="p-2 text-right">Value (₹)</th>
                            <th className="p-2 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it) => (
                            <tr key={it.id} className="border-b border-border/60 hover:bg-muted/10">
                              <td className="p-2">
                                <div className="font-bold">{it.description}</div>
                                {it.huid && (
                                  <div className="text-[10px] text-muted-foreground">
                                    HUID: {it.huid} · Stamp: {it.stamp || "—"}
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                <Badge
                                  variant={it.direction === "Jama" ? "default" : "outline"}
                                  className={
                                    it.direction === "Jama"
                                      ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-none"
                                      : "border-red-500/30 text-red-500 font-normal"
                                  }
                                >
                                  {it.direction === "Jama" ? "Jama (Credit)" : "Naam (Debit)"}
                                </Badge>
                              </td>
                              <td className="p-2 text-right font-mono">
                                {it.grossGrams ? `${it.grossGrams.toFixed(3)}g` : "—"}
                              </td>
                              <td className="p-2 text-right font-mono">
                                {it.addGrams ? `${it.addGrams.toFixed(3)}g` : "—"}
                              </td>
                              <td className="p-2 text-right font-mono">
                                {it.lessGrams ? `${it.lessGrams.toFixed(3)}g` : "—"}
                              </td>
                              <td className="p-2 text-right font-mono">
                                {it.netGrams ? `${it.netGrams.toFixed(3)}g` : "—"}
                              </td>
                              <td className="p-2 text-center font-mono">
                                {it.purity ? `${it.purity}% + ${it.wastagePct}%` : "—"}
                              </td>
                              <td className="p-2 text-right font-mono font-semibold text-amber-500">
                                {it.fineGrams ? `${it.fineGrams.toFixed(3)}g` : "—"}
                              </td>
                              <td className="p-2 text-right font-mono font-medium">
                                {it.amountRupees ? `₹${it.amountRupees}` : "—"}
                                {it.labourRupees ? (
                                  <div className="text-[9px] text-muted-foreground">
                                    Lab: ₹{it.labourRupees}
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-2 text-center">
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveItemRow(it.id)}
                                  className="h-6 w-6 text-red-500 hover:bg-red-500/15"
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Balances & Net Summary Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gold Summary */}
                  <div className="bg-gradient-to-br from-amber-500/5 to-yellow-500/10 p-5 rounded-2xl border border-yellow-500/15 space-y-3">
                    <div className="flex items-center gap-2 text-yellow-600 font-semibold text-sm border-b border-yellow-500/10 pb-2">
                      <Scale className="h-4 w-4" /> Fine Gold Summary (Grams)
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Today's Deposited (Jama):</div>
                      <td className="font-mono text-right font-semibold text-emerald-500">
                        +{todayGoldJamaGrams.toFixed(3)} g
                      </td>
                      <div>Today's Withdrawn (Naam):</div>
                      <td className="font-mono text-right font-semibold text-red-500">
                        -{todayGoldNaamGrams.toFixed(3)} g
                      </td>
                    </div>
                    <div className="border-t border-dashed border-yellow-500/10 pt-2 flex justify-between items-center text-[11px]">
                      <span className="font-semibold uppercase text-yellow-700/80">Net Total:</span>
                      <span className="font-mono font-semibold">
                        {mgToGrams(Math.abs(netTotalGoldMg))} g{" "}
                        {netTotalGoldMg >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-yellow-500/10 pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-yellow-700">
                        Closing Fine Gold:
                      </span>
                      <span
                        className={`font-mono text-base font-bold ${closingGoldMg >= 0 ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {mgToGrams(Math.abs(closingGoldMg))} g{" "}
                        {closingGoldMg >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium text-center">
                      {closingGoldMg > 0
                        ? "● We owe customer/karigar gold (Jama-Balance)"
                        : closingGoldMg < 0
                          ? "● Customer/karigar owes us gold (Naam-Balance)"
                          : "● Gold balance fully cleared"}
                    </div>
                  </div>

                  {/* Cash Summary */}
                  <div className="bg-gradient-to-br from-indigo-500/5 to-emerald-500/10 p-5 rounded-2xl border border-border space-y-3">
                    <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm border-b border-border pb-2">
                      <DollarSign className="h-4 w-4" /> Cash Transacted Summary (Rupees)
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Today's Received (Jama):</div>
                      <td className="font-mono text-right font-semibold text-emerald-500">
                        +₹{todayCashJamaRupees}
                      </td>
                      <div>Today's Paid/Charged (Naam):</div>
                      <td className="font-mono text-right font-semibold text-red-500">
                        -₹{todayCashNaamRupees}
                      </td>
                    </div>
                    <div className="border-t border-dashed border-border pt-2 flex justify-between items-center text-[11px]">
                      <span className="font-semibold uppercase text-emerald-600/80">
                        Net Total:
                      </span>
                      <span className="font-mono font-semibold">
                        ₹{paiseToRupees(Math.abs(netTotalCashPaise))}{" "}
                        {netTotalCashPaise >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-border pt-2 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-emerald-600">
                        Closing Cash:
                      </span>
                      <span
                        className={`font-mono text-base font-bold ${closingCashPaise >= 0 ? "text-emerald-500" : "text-red-500"}`}
                      >
                        ₹{paiseToRupees(Math.abs(closingCashPaise))}{" "}
                        {closingCashPaise >= 0 ? "Jama" : "Naam"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium text-center">
                      {closingCashPaise > 0
                        ? "● We owe customer/karigar cash (Jama-Balance)"
                        : closingCashPaise < 0
                          ? "● Customer/karigar owes us cash (Naam-Balance)"
                          : "● Cash balance fully settled"}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Internal Notes / Settlement Particulars
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Rate-cut conversion settled physically via ornaments..."
                    rows={2}
                    className="mt-1 bg-background"
                  />
                </div>

                <DialogFooter className="mt-4 gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || items.length === 0}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold shadow-md cursor-pointer"
                  >
                    {loading ? "Recording..." : "Finalize & Save Voucher"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Compliance Audit Results Dialog */}
        <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg text-emerald-600 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-500 animate-pulse" /> MTJ Gold Ledger
                Compliance Report
              </DialogTitle>
              <div className="text-xs text-muted-foreground">
                Live compliance test runner asserting core gold rules and formula correctness.
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {auditResults.map((r) => (
                <div
                  key={r.id}
                  className="border border-border/80 p-4 rounded-2xl bg-muted/20 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {r.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-50/20" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping" />
                      )}
                      {r.name}
                    </h4>
                    <Badge
                      variant={r.passed ? "secondary" : "destructive"}
                      className={
                        r.passed ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : ""
                      }
                    >
                      {r.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                  <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside bg-background/50 p-3 rounded-xl border border-border/40 font-mono">
                    {(r.findings as string[]).map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                onClick={() => setAuditOpen(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl w-full sm:w-auto"
              >
                Close Audit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Voucher Records List */}
      <div className="rounded-2xl border border-border bg-card p-4">
        {loading ? (
          <p className="text-center py-8 text-sm text-muted-foreground animate-pulse">
            Loading settlements and balances...
          </p>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Info className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No gold payment voucher records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-muted-foreground tracking-wider border-b border-border font-bold bg-muted/20">
                <tr>
                  <th className="text-left py-2 px-3">Vou No / Date</th>
                  <th className="text-left py-2 px-3">Party Name</th>
                  <th className="text-left py-2 px-3">Purpose</th>
                  <th className="text-right py-2 px-3 font-semibold text-yellow-600">
                    Net Today's Gold
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-emerald-400">
                    Net Today's Cash
                  </th>
                  <th className="text-center py-2 px-3">Print / Slip</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((s) => {
                  let partyName = "Internal / Private";
                  let phone = "";
                  if (s.party_type !== "internal") {
                    const matched = people.find((p) => p.id === s.party_id);
                    if (matched) {
                      partyName = matched.fullName;
                      phone = matched.phone;
                    } else if (s.party_id) {
                      partyName = `Party #${s.party_id.slice(-6).toUpperCase()}`;
                    }
                  } else {
                    partyName = "Internal App Account";
                  }

                  const goldDeltaMg = s.gold_entry_mg ?? 0;
                  const cashDeltaPaise = s.cash_entry_paise ?? 0;

                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/40 hover:bg-background/20 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs font-bold text-foreground">{s.id}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(s.settlement_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-xs sm:text-sm">{partyName}</div>
                        {phone && <div className="text-[10px] text-muted-foreground">{phone}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase border-border font-medium"
                        >
                          {linkUseLabel(s.link_use || "general")}
                        </Badge>
                        {s.notes && (
                          <div className="text-[10px] text-muted-foreground/80 truncate max-w-[200px] mt-0.5">
                            {s.notes.split("[Voucher Action:")[0]}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs font-bold">
                        <span className={goldDeltaMg >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {goldDeltaMg >= 0 ? "+" : ""}
                          {mgToGrams(goldDeltaMg)} g Fine
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs font-bold">
                        <span
                          className={cashDeltaPaise >= 0 ? "text-emerald-500" : "text-rose-500"}
                        >
                          {cashDeltaPaise >= 0 ? "+" : "-"}₹
                          {paiseToRupees(Math.abs(cashDeltaPaise))}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Link to="/billing/gold-settlement-print/$id" params={{ id: s.id }}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:text-gold cursor-pointer"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

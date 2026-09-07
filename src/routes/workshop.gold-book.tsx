import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useDraft } from "@/lib/drafts-store";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { usePeople } from "@/lib/people-store";
import { isKarigarParty } from "@/lib/party-types";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useManufacturingMaterials } from "@/lib/manufacturing-materials-store";
import { useMaterialVault } from "@/lib/material-vault-store";
import { assertMaterialIssueStock, materialStockCaption } from "@/lib/material-issue-stock";
import { compileAllDailySlips, slipNumberForEntry } from "@/lib/daily-material-slip";
import { toast } from "sonner";
import { MobileConfirmSummary } from "@/components/mobile/MobileConfirmSummary";
import { mgToGrams, gramsToMg, fineGoldMg } from "@/lib/gold";
import { useLedger } from "@/lib/ledger-store";
import {
  isGoldWeightMaterial,
  vaultGoldPurityOptionsForIssue,
} from "@/lib/vault-gold-stock";
import { assertTransactionGoldIssueFromLedger } from "@/lib/transaction-ledger-guards";
import { computeFineGold } from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionModuleNav } from "@/components/transaction-module-nav";
import { GoldPurityHelper } from "@/components/gold-purity-helper";
import { useStock } from "@/lib/stock-store";
import { ReceiveFinishedProductDialog } from "@/components/karigar/ReceiveFinishedProductDialog";
import {
  Printer,
  BookOpen,
  Plus,
  Minus,
  Search,
  Calendar,
  Filter,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  User,
  Scale,
  History,
  X,
  Receipt,
  PackageCheck,
  Tag,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/workshop/gold-book")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Karigar Transactions · ${shortName} ERP` }],
    };
  },
  component: WorkerGoldBookPage,
});

const FALLBACK_MATERIAL_OPTIONS = [
  "Gold",
  "KDM",
  "Die",
  "Ball",
  "Chain",
  "Finding",
  "Wire",
  "Patti",
  "Stone",
  "Item / Ornaments",
  "Filings / Dust",
  "Other",
];

const RETURN_PARTICULAR_OPTIONS = [
  "returned gold",
  "returned remaining chain",
  "returned KDM",
  "returned die",
  "returned ball",
  "returned item",
  "returned filings",
  "not returned anything",
  "Other",
];

function WorkerGoldBookPage() {
  const searchParams = useRouterState({
    select: (s) => (s.location.search as Record<string, string> | undefined) ?? {},
  });
  const searchMode = searchParams.mode === "issue" || searchParams.mode === "receive" ? searchParams.mode : undefined;
  const people = usePeople((s) => s.people);
  const ledgerEntries = useLedger((s) => s.entries);
  const stockItems = useStock((s) => s.items);
  const vaultStockMode = "optional";
  const { entries, removeEntry, getWorkerBalance, refresh } = useWorkerGoldBook();
  const refreshVault = useMaterialVault((s) => s.refresh);
  const masterMaterials = useManufacturingMaterials((s) => s.materials);
  const refreshMasterMaterials = useManufacturingMaterials((s) => s.refresh);
  const materialOptions = useMemo(() => {
    const fromMaster = masterMaterials.filter((m) => m.active).map((m) => m.name);
    if (fromMaster.length > 0) return fromMaster;
    return FALLBACK_MATERIAL_OPTIONS;
  }, [masterMaterials]);
  const [bookLoadError, setBookLoadError] = useState<string | null>(null);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);

  useEffect(() => {
    void refresh()
      .then(() => setBookLoadError(null))
      .catch((e) => setBookLoadError(e instanceof Error ? e.message : String(e)));
    void refreshVault();
    void refreshMasterMaterials();
    void useLedger.getState().refresh();
    void useStock.getState().refresh();
  }, [refresh, refreshVault, refreshMasterMaterials]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { dataProvider } = await import("@/lib/providers/data-provider");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = dataProvider as any;
        const { data: firmId } = await db.rpc("my_firm_id");
        if (!firmId || cancelled) return;
        const { data } = await db
          .from("dhadi_groups")
          .select("id,name,code,active")
          .eq("firm_id", firmId)
          .eq("active", true)
          .order("name");
        if (!cancelled) setDhadiGroups((data ?? []) as typeof dhadiGroups);
      } catch {
        /* optional Offline dg_no — form still works without groups */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [activeTab, setActiveTab] = useDraft<
    "ledger" | "balances" | "daily_slips" | "receive_ready_stock"
  >("mtj-goldbook-activeTab-v5", "ledger");
  const [receiveProductDialogOpen, setReceiveProductDialogOpen] = useState(false);
  const [receiveWorkerId, setReceiveWorkerId] = useState<string>("");
  // Search box for the Daily Slips tab (by slip number or worker).
  const [slipSearch, setSlipSearch] = useState<string>("");
  const [entryType, setEntryType, clearEntryType] = useDraft<"given" | "return" | "overloss">(
    "mtj-goldbook-entryType-v1",
    "given",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<{
    workerName: string;
    particulars: string;
    grossMg: number;
    purity: number;
    qty: number;
    type: "given" | "return" | "overloss";
    payload: Parameters<ReturnType<typeof useWorkerGoldBook.getState>["addEntry"]>[0];
  } | null>(null);

  // Filters state
  const [workerFilter, setWorkerFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [materialFilter, setMaterialFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "given" | "return" | "overloss">("all");
  const [pendingOnly, setPendingOnly] = useState<boolean>(false);

  // Over-loss specific state
  const [formExpectedGrossG, setFormExpectedGrossG] = useState("");
  const [formActualReturnedGrossG, setFormActualReturnedGrossG] = useState("");
  const [formOverLossRatePerG, setFormOverLossRatePerG] = useState("7500");
  const [formOverLossReason, setFormOverLossReason] = useState("Excess process/melting loss");

  // Form State
  const [formWorkerId, setFormWorkerId, clearFormWorkerId] = useDraft<string>(
    "mtj-goldbook-formWorkerId-v1",
    "",
  );
  const [formParticulars, setFormParticulars, clearFormParticulars] = useDraft<string>(
    "mtj-goldbook-formParticulars-v1",
    "",
  );
  const [formCustomParticulars, setFormCustomParticulars, clearFormCustomParticulars] =
    useDraft<string>("mtj-goldbook-formCustomParticulars-v1", "");
  const [formGrossG, setFormGrossG, clearFormGrossG] = useDraft<string>(
    "mtj-goldbook-formGrossG-v1",
    "",
  );
  const [formLessG, setFormLessG, clearFormLessG] = useDraft<string>(
    "mtj-goldbook-formLessG-v1",
    "",
  );
  const [formAddG, setFormAddG, clearFormAddG] = useDraft<string>("mtj-goldbook-formAddG-v1", "");
  const [formWstgPct, setFormWstgPct, clearFormWstgPct] = useDraft<string>(
    "mtj-goldbook-formWstgPct-v1",
    "",
  );
  const [formPlusFineG, setFormPlusFineG, clearFormPlusFineG] = useDraft<string>(
    "mtj-goldbook-formPlusFineG-v1",
    "",
  );
  const [formLabourCash, setFormLabourCash, clearFormLabourCash] = useDraft<string>(
    "mtj-goldbook-formLabourCash-v1",
    "",
  );
  const [formOverLossG, setFormOverLossG, clearFormOverLossG] = useDraft<string>(
    "mtj-goldbook-formOverLossG-v1",
    "",
  );
  const [formProcessType, setFormProcessType, clearFormProcessType] = useDraft<string>(
    "mtj-goldbook-formProcessType-v1",
    "",
  );
  const [formStampCode, setFormStampCode, clearFormStampCode] = useDraft<string>(
    "mtj-goldbook-formStampCode-v1",
    "",
  );
  const [formDhadiGroupId, setFormDhadiGroupId, clearFormDhadiGroupId] = useDraft<string>(
    "mtj-goldbook-formDhadiGroupId-v1",
    "",
  );
  const [dhadiGroups, setDhadiGroups] = useState<
    Array<{ id: string; name: string; code: string | null; active: boolean }>
  >([]);
  const [showOfflineHisab, setShowOfflineHisab] = useState(false);
  const [formPurity, setFormPurity, clearFormPurity] = useDraft<string>(
    "mtj-goldbook-formPurity-v1",
    "916",
  ); // default 22k
  const [formVaultStockId, setFormVaultStockId] = useState("");
  const [formCustomPurity, setFormCustomPurity, clearFormCustomPurity] = useDraft<string>(
    "mtj-goldbook-formCustomPurity-v1",
    "",
  );
  const [formQty, setFormQty, clearFormQty] = useDraft<string>("mtj-goldbook-formQty-v1", "0");
  const [formNotes, setFormNotes, clearFormNotes] = useDraft<string>(
    "mtj-goldbook-formNotes-v1",
    "",
  );
  const [formGivenBy, setFormGivenBy, clearFormGivenBy] = useDraft<string>(
    "mtj-goldbook-formGivenBy-v1",
    "Authorized Staff",
  );
  const [formReceivedBy, setFormReceivedBy, clearFormReceivedBy] = useDraft<string>(
    "mtj-goldbook-formReceivedBy-v1",
    "",
  );
  const [formReference, setFormReference, clearFormReference] = useDraft<string>(
    "mtj-goldbook-formReference-v1",
    "",
  );
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    if (searchParams.mode === "receive") {
      setEntryType("return");
      setActiveTab("ledger");
    } else if (searchParams.mode === "issue") {
      setEntryType("given");
      setActiveTab("ledger");
    }
    if (searchParams.workerId) {
      setFormWorkerId(searchParams.workerId);
    }
    if (searchParams.particulars) {
      setFormParticulars(searchParams.particulars);
    }
    if (searchParams.grossG) {
      setFormGrossG(searchParams.grossG);
    }
    if (searchParams.purity) {
      setFormPurity(searchParams.purity);
    }
    if (searchParams.jobId) {
      setFormReference(`Job: ${searchParams.jobId}`);
    }
  }, [
    searchParams.mode,
    searchParams.workerId,
    searchParams.particulars,
    searchParams.grossG,
    searchParams.purity,
    searchParams.jobId,
    setEntryType,
    setActiveTab,
    setFormWorkerId,
    setFormParticulars,
    setFormGrossG,
    setFormPurity,
    setFormReference,
  ]);

  const vaultGoldPurities = useMemo(
    () => vaultGoldPurityOptionsForIssue(ledgerEntries),
    [ledgerEntries],
  );

  const goldMaterialSelected = isGoldWeightMaterial(formParticulars);

  const handleMaterialChange = (value: string) => {
    setFormParticulars(value);
    if (isGoldWeightMaterial(value)) {
      const first = vaultGoldPurities[0];
      if (first) {
        setFormPurity(String(first.purity));
        setFormVaultStockId(first.id);
        setFormCustomPurity("");
      }
    } else if (value && value !== "Other") {
      setFormPurity("0");
      setFormVaultStockId("");
      setFormCustomPurity("");
    }
  };

  // Get active workers for selection
  const workers = useMemo(() => {
    return people.filter((p) => (isKarigarParty(p) || p.type === "employee") && p.active);
  }, [people]);

  // Selected Worker in Form
  const selectedFormWorker = useMemo(() => {
    return workers.find((w) => w.id === formWorkerId) || null;
  }, [workers, formWorkerId]);

  // Set default received/given by on worker change
  const handleWorkerChange = (id: string) => {
    setFormWorkerId(id);
    const w = workers.find((wk) => wk.id === id);
    if (w) {
      if (entryType === "given") {
        setFormReceivedBy(w.fullName);
      } else {
        setFormGivenBy(w.fullName);
      }
    }
  };

  // Switch entry type
  const handleEntryTypeChange = (type: "given" | "return" | "overloss") => {
    setEntryType(type);
    setFormParticulars(type === "overloss" ? "Over-Loss" : "");
    setFormCustomParticulars("");
    setFormGrossG("");
    setFormLessG("");
    setFormAddG("");
    setFormWstgPct("");
    setFormPlusFineG("");
    setFormLabourCash("");
    setFormOverLossG("");
    setFormProcessType("");
    setFormStampCode("");
    setFormQty("0");
    setFormNotes("");
    setFormReference("");
    setFormError("");

    // Set default names based on worker
    if (selectedFormWorker) {
      if (type === "given") {
        setFormGivenBy("Authorized Staff");
        setFormReceivedBy(selectedFormWorker.fullName);
      } else if (type === "return") {
        setFormGivenBy(selectedFormWorker.fullName);
        setFormReceivedBy("Authorized Staff");
      } else {
        setFormGivenBy(selectedFormWorker.fullName);
        setFormReceivedBy("Loss Account / System");
      }
    }
  };

  // FAB / deep-link: /workshop/gold-book?mode=issue|receive → entry sheet (ledger stays visible)
  useEffect(() => {
    if (searchMode !== "issue" && searchMode !== "receive") return;
    handleEntryTypeChange(searchMode === "issue" ? "given" : "return");
    setEntrySheetOpen(true);
    setActiveTab("ledger");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link
  }, [searchMode]);

  // Form submission
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formWorkerId) {
      setFormError("Please select a worker/karigar.");
      return;
    }

    const workerObj = workers.find((w) => w.id === formWorkerId);
    if (!workerObj) {
      setFormError("Selected worker not found.");
      return;
    }

    if (entryType === "overloss") {
      const expG = parseFloat(formExpectedGrossG) || 0;
      const actG = parseFloat(formActualReturnedGrossG) || 0;
      if (expG <= 0) {
        setFormError("Please enter the expected return weight.");
        return;
      }
      const expMg = Math.round(expG * 1000);
      const actMg = Math.round(actG * 1000);
      const lossGrossMg = Math.max(0, expMg - actMg);
      if (lossGrossMg <= 0) {
        setFormError("Actual returned weight must be less than expected weight to record an over-loss.");
        return;
      }
      const purityVal = Number(formPurity) || 916;
      const lossFineMg = Math.round((lossGrossMg * purityVal) / 1000);
      const ratePaise = Math.round((parseFloat(formOverLossRatePerG) || 7500) * 100);
      const valPaise = Math.round((lossFineMg * ratePaise) / 1000);

      const payload = {
        workerId: formWorkerId,
        workerName: workerObj.fullName,
        particulars: `Over-Loss (${formOverLossReason})`,
        grossMg: lossGrossMg,
        lessMg: 0,
        netMg: lossGrossMg,
        purity: purityVal,
        fineMg: lossFineMg,
        expectedGrossMg: expMg,
        actualReturnedGrossMg: actMg,
        overLossGrossMg: lossGrossMg,
        overLossFineMg: lossFineMg,
        overLossRatePaisePerGram: ratePaise,
        overLossValuePaise: valPaise,
        overLossReason: formOverLossReason,
        quantity: 1,
        notes: `${formNotes.trim()} [Over-Loss: ${mgToGrams(lossGrossMg)}g Gross, ${mgToGrams(lossFineMg)}g Fine @ ₹${ratePaise / 100}/g = ₹${valPaise / 100}]`.trim(),
        givenBy: workerObj.fullName,
        receivedBy: "Loss Relief / Admin",
        type: "overloss" as const,
        reference: formReference.trim() || `Over-Loss ${new Date().toISOString().slice(0, 10)}`,
      };

      setPendingSummary({
        workerName: workerObj.fullName,
        particulars: payload.particulars,
        grossMg: lossGrossMg,
        purity: purityVal,
        qty: 1,
        type: "overloss",
        payload,
      });
      setConfirmOpen(true);
      return;
    }

    const finalParticulars =
      formParticulars === "Other" || !formParticulars
        ? formCustomParticulars.trim()
        : formParticulars;

    if (!finalParticulars) {
      setFormError("Please provide particulars/material description.");
      return;
    }

    let grossMg = 0;
    let lessMg = 0;
    let addMg = 0;
    try {
      if (formGrossG && Number(formGrossG) > 0) {
        grossMg = gramsToMg(formGrossG);
      }
      if (formLessG && Number(formLessG) > 0) {
        lessMg = gramsToMg(formLessG);
      }
      if (formAddG && Number(formAddG) > 0) {
        addMg = gramsToMg(formAddG);
      }
    } catch (err) {
      setFormError("Invalid weight. Please enter a valid number.");
      return;
    }

    const purityVal = goldMaterialSelected
      ? Number(formPurity) || 0
      : 0;
    const wastagePct = Number(formWstgPct) || 0;
    let plusFineMg = 0;
    try {
      if (formPlusFineG && Number(formPlusFineG) > 0) {
        plusFineMg = gramsToMg(formPlusFineG);
      }
    } catch {
      setFormError("Invalid plus fine weight.");
      return;
    }
    const labourCashPaise = Math.round((Number(formLabourCash) || 0) * 100);

    // Vault stock pre-validation
    if (entryType === "given" && goldMaterialSelected) {
      if ((vaultStockMode as string) === "required" || ((vaultStockMode as string) === "optional" && formVaultStockId)) {
        try {
          const fineMg =
            computeFineGold(
              {
                module: "karigar_issue",
                grossMg,
                lessMg,
                addMg,
                purityPermille: purityVal,
                wastagePct: wastagePct > 0 ? wastagePct : undefined,
              },
              currentGoldCalculationRules(),
            ).fineMg + plusFineMg;
          assertTransactionGoldIssueFromLedger({
            entries: ledgerEntries,
            purityPermille: purityVal,
            fineMg,
            grossMg: Math.max(0, grossMg - lessMg + addMg),
            vaultStockLineId: formVaultStockId,
          });
        } catch (vaultErr) {
          setFormError(vaultErr instanceof Error ? vaultErr.message : String(vaultErr));
          return;
        }
      }
    }

    const qtyVal = parseInt(formQty) || 0;

    if (grossMg === 0 && qtyVal === 0) {
      setFormError("Please provide either weight or quantity.");
      return;
    }

    const overLossG = Number(formOverLossG) || 0;
    const notesWithOverloss = `${formNotes.trim()}${overLossG > 0 ? ` [Over-loss: ${overLossG.toFixed(3)}g]` : ""}`.trim();

    const payload = {
      workerId: formWorkerId,
      workerName: workerObj.fullName,
      particulars: finalParticulars,
      grossMg,
      lessMg,
      addMg,
      netMg: Math.max(0, grossMg - lessMg + addMg),
      purity: purityVal,
      wastagePct: wastagePct > 0 ? wastagePct : undefined,
      plusFineMg: plusFineMg > 0 ? plusFineMg : undefined,
      labourCashPaise: labourCashPaise > 0 ? labourCashPaise : undefined,
      processType: formProcessType.trim() || undefined,
      stampCode: formStampCode.trim() || undefined,
      dhadiGroupId: formDhadiGroupId.trim() || undefined,
      dhadiGroupName: formDhadiGroupId.trim()
        ? dhadiGroups.find((g) => g.id === formDhadiGroupId)?.name
        : undefined,
      fineMg: 0,
      quantity: qtyVal,
      notes: notesWithOverloss,
      givenBy: formGivenBy.trim() || "Authorized Staff",
      receivedBy: formReceivedBy.trim() || "Authorized Staff",
      type: entryType,
      reference: formReference.trim(),
      vaultStockLineId:
        entryType === "given" && goldMaterialSelected ? formVaultStockId || undefined : undefined,
    };

    setPendingSummary({
      workerName: workerObj.fullName,
      particulars: finalParticulars,
      grossMg,
      purity: purityVal,
      qty: qtyVal,
      type: entryType,
      payload,
    });
    setConfirmOpen(true);
  };

  const commitPendingEntry = async () => {
    if (!pendingSummary) return;
    try {
      const { captureGoldBookEntry } = await import("@/lib/offline");
      const queued = await captureGoldBookEntry(pendingSummary.payload);
      if (queued.mode === "queued") {
        toast.message(
          "Gold book saved offline — Pending Sync. Gold Vault is not posted until sync succeeds.",
        );
      } else {
        toast.success(
          pendingSummary.type === "given" ? "Material issue recorded" : "Material return recorded",
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save entry.");
      setConfirmOpen(false);
      return;
    }

    clearFormGrossG();
    clearFormLessG();
    clearFormAddG();
    clearFormWstgPct();
    clearFormPlusFineG();
    clearFormLabourCash();
    clearFormOverLossG();
    clearFormProcessType();
    clearFormStampCode();
    clearFormDhadiGroupId();
    clearFormQty();
    clearFormNotes();
    clearFormReference();
    clearFormCustomParticulars();
    clearFormParticulars();
    setPendingSummary(null);
    setConfirmOpen(false);
    setEntrySheetOpen(false);
    setActiveTab("ledger");
    void refresh();
    void refreshVault();
  };

  // Filter and process ledger entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Worker filter
      if (workerFilter !== "all" && e.workerId !== workerFilter) return false;

      // Type filter
      if (typeFilter !== "all" && e.type !== typeFilter) return false;

      // Date range filter
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;

      // Material filter
      if (materialFilter) {
        const query = materialFilter.toLowerCase().trim();
        const matchesParticulars = e.particulars.toLowerCase().includes(query);
        const matchesRef = e.reference?.toLowerCase().includes(query) || false;
        const matchesNotes = e.notes?.toLowerCase().includes(query) || false;
        if (!matchesParticulars && !matchesRef && !matchesNotes) return false;
      }

      // Pending only filter
      if (pendingOnly) {
        const bal = getWorkerBalance(e.workerId);
        // If worker has no pending gold AND no pending qty, filter them out
        if (bal.pendingFine === 0 && bal.pendingQty === 0) return false;
      }

      return true;
    });
  }, [
    entries,
    workerFilter,
    startDate,
    endDate,
    materialFilter,
    typeFilter,
    pendingOnly,
    getWorkerBalance,
  ]);

  // Worker-wise balance summaries
  const workerBalances = useMemo(() => {
    const list = workers.map((w) => {
      const balance = getWorkerBalance(w.id);

      // Assertion: sum of ledger fine-gold per worker == that worker's custody balance
      const ledgerSum = entries
        .filter((e) => e.workerId === w.id)
        .reduce((sum, e) => sum + (e.type === "given" ? e.fineMg : -e.fineMg), 0);
      console.assert(
        Math.max(0, ledgerSum) === balance.pendingFine,
        `Reconciliation Error: Worker ${w.fullName} ledger sum ${ledgerSum} does not match custody balance ${balance.pendingFine}`,
      );

      return {
        worker: w,
        ...balance,
      };
    });

    // Only include workers with at least one transaction OR non-zero balance to reconcile with ledger entries length
    return list.filter((item) => {
      const activeLedgerCount = entries.filter((e) => e.workerId === item.worker.id).length;
      return activeLedgerCount > 0 || item.pendingFine > 0 || item.pendingQty > 0;
    });
  }, [workers, getWorkerBalance, entries]);

  // Daily Material Slips — one consolidated slip per worker per day. Filter by
  // slip number or worker name for the "reprint by slip number" flow.
  const dailySlips = useMemo(() => {
    const all = compileAllDailySlips();
    const q = slipSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) => s.slipNumber.toLowerCase().includes(q) || s.workerName.toLowerCase().includes(q),
    );
    // entries drives recompilation when a transaction is added/removed.
  }, [slipSearch, entries]);

  // Quick reset filters
  const resetFilters = () => {
    setWorkerFilter("all");
    setStartDate("");
    setEndDate("");
    setMaterialFilter("");
    setTypeFilter("all");
    setPendingOnly(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto" id="worker-gold-book-root">
      <TransactionModuleNav />
      {bookLoadError ? (
        <p className="mb-3 text-sm text-destructive font-mono break-all">{bookLoadError}</p>
      ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
                <BookOpen className="h-7 w-7 text-gold" /> Karigar Transactions
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Maintain independent ledger accounts of gold, items, and accessories issued to and
                returned by workers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setReceiveWorkerId("");
                  setReceiveProductDialogOpen(true);
                }}
                className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 gap-1.5 font-semibold"
              >
                <PackageCheck className="h-4 w-4" /> Receive Ready Stock
              </Button>
              <Button
                onClick={() => {
                  handleEntryTypeChange("given");
                  setEntrySheetOpen(true);
                }}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 gap-1.5 font-semibold"
              >
                <Plus className="h-4 w-4" /> Issue
              </Button>
              <Button
                onClick={() => {
                  handleEntryTypeChange("return");
                  setFormParticulars("returned KDM");
                  setEntrySheetOpen(true);
                }}
                variant="outline"
                className="gap-1.5 font-semibold"
              >
                Make material
              </Button>
              <Button
                onClick={() => {
                  handleEntryTypeChange("return");
                  setEntrySheetOpen(true);
                }}
                className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 gap-1.5 font-semibold"
              >
                <Minus className="h-4 w-4" /> Receive
              </Button>
              <Button
                onClick={() => {
                  handleEntryTypeChange("overloss");
                  setEntrySheetOpen(true);
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 gap-1.5 font-semibold"
              >
                <AlertTriangle className="h-4 w-4" /> Record Over-Loss
              </Button>
            </div>
          </div>

          <div className="border-b border-border mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === "ledger" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <History className="h-4 w-4" /> Running Ledger
            </button>
            <button
              onClick={() => setActiveTab("balances")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === "balances" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Scale className="h-4 w-4" /> Custody Balances
            </button>
            <button
              onClick={() => setActiveTab("receive_ready_stock")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === "receive_ready_stock" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <PackageCheck className="h-4 w-4" /> Receive Ready Stock
            </button>
            <button
              onClick={() => setActiveTab("daily_slips")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === "daily_slips" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Receipt className="h-4 w-4" /> Daily Material Slips ({dailySlips.length})
            </button>
          </div>

          {/* ==================== TAB CONTENT: LEDGER STATEMENT ==================== */}
          {activeTab === "ledger" && (
            <div className="space-y-6">
              {/* Filters card */}
              <div className="bg-card border border-border rounded-md p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <Filter className="h-4 w-4 text-gold" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Filter Ledger List
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Worker select */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Worker / Karigar
                    </label>
                    <select
                      value={workerFilter}
                      onChange={(e) => setWorkerFilter(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                    >
                      <option value="all">All Workers</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.fullName} (
                          {PERSON_TYPE_LABELS[w.type as keyof typeof PERSON_TYPE_LABELS] || w.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Material Search */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Search Material / Ref / Narration
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search gold book..."
                        value={materialFilter}
                        onChange={(e) => setMaterialFilter(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Entry type */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Voucher Type
                    </label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                    >
                      <option value="all">All Entries</option>
                      <option value="given">Issue / Given</option>
                      <option value="return">Receive / Return</option>
                      <option value="overloss">Record Over-Loss</option>
                    </select>
                  </div>

                  {/* Date filters */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Start Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        End Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pendingOnly}
                      onChange={(e) => setPendingOnly(e.target.checked)}
                      className="rounded border-border text-gold focus:ring-gold bg-background h-4 w-4"
                    />
                    <span className="text-sm font-medium text-foreground">
                      Show Pending Balances Only
                    </span>
                  </label>

                  <button
                    onClick={resetFilters}
                    className="text-xs font-bold text-gold hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>

              {/* Ledger — mobile + desktop */}
              <div className="bg-card border border-border rounded-md shadow-sm overflow-hidden">
                {/* ── Mobile card view ── */}
                <div className="block md:hidden divide-y divide-border">
                  {filteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground italic text-sm">
                      No transactions match. Issue or return gold to populate ledger.
                    </div>
                  ) : (
                    filteredEntries.map((e) => {
                      const isOverloss = e.type === "overloss";
                      const isGiven = e.type === "given";
                      return (
                        <div key={e.id} className={`p-3 space-y-1 ${isOverloss ? "bg-rose-500/5" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{e.workerName}</span>
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${isOverloss ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : isGiven ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}
                                >
                                  {isOverloss ? (
                                    <AlertTriangle className="h-3 w-3" />
                                  ) : isGiven ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {isOverloss ? "Over-Loss" : isGiven ? "Issued" : "Returned"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {e.particulars}
                                {e.reference && <span className="ml-1">· Ref: {e.reference}</span>}
                                {e.notes ? <span className="ml-1">· {e.notes}</span> : null}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`font-mono text-sm font-bold ${isOverloss ? "text-rose-400" : isGiven ? "text-red-400" : "text-green-400"}`}
                              >
                                {e.fineMg > 0 ? `${mgToGrams(e.fineMg)} g` : "—"}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                Net: {mgToGrams(e.netMg)} · {e.purity > 0 ? e.purity : "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {e.date} · {e.time}
                            </span>
                            <Link
                              to="/workshop/material-slip/$workerId/$date"
                              params={{ workerId: e.workerId, date: e.date }}
                              className="font-mono text-gold hover:underline"
                            >
                              Slip {slipNumberForEntry(e)}
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── Desktop table view ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-4">Date &amp; Time</th>
                        <th className="p-4">Slip No</th>
                        <th className="p-4">Voucher No</th>
                        <th className="p-4">Worker</th>
                        <th className="p-4">Particulars</th>
                        <th className="p-4">Narration</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Net Wt. (g)</th>
                        <th className="p-4 text-right">Purity</th>
                        <th className="p-4 text-right">Fine Gold (g)</th>
                        <th className="p-4 text-right">Qty / Pcs</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={12}
                            className="p-12 text-center text-muted-foreground italic"
                          >
                            No transactions match the filter criteria. Issue or return
                            gold/materials to populate ledger.
                          </td>
                        </tr>
                      ) : (
                        filteredEntries.map((e) => {
                          const isOverloss = e.type === "overloss";
                          const isGiven = e.type === "given";
                          return (
                            <tr
                              key={e.id}
                              className={`border-b border-border hover:bg-muted/30 transition-colors ${isOverloss ? "bg-rose-500/5" : ""}`}
                            >
                              <td className="p-4 whitespace-nowrap">
                                <div className="font-semibold">{e.date}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {e.time}
                                </div>
                              </td>
                              <td className="p-4">
                                <Link
                                  to="/workshop/material-slip/$workerId/$date"
                                  params={{ workerId: e.workerId, date: e.date }}
                                  className="font-mono text-xs font-bold text-gold hover:underline"
                                  title="Open the Daily Material Slip for this transaction"
                                >
                                  {slipNumberForEntry(e)}
                                </Link>
                              </td>
                              <td className="p-4 font-mono font-bold text-amber-500">
                                {e.entryNo}
                              </td>
                              <td className="p-4">
                                <div className="font-bold">{e.workerName}</div>
                              </td>
                              <td className="p-4 max-w-[180px] truncate" title={e.particulars}>
                                <span className="font-semibold text-foreground">
                                  {e.particulars}
                                </span>
                                {e.reference && (
                                  <div className="text-xs text-muted-foreground font-normal">
                                    Ref: {e.reference}
                                  </div>
                                )}
                              </td>
                              <td className="p-4 max-w-[160px] truncate text-muted-foreground" title={e.notes || ""}>
                                {e.notes || "—"}
                              </td>
                              <td className="p-4">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${isOverloss ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : isGiven ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}
                                >
                                  {isOverloss ? (
                                    <AlertTriangle className="h-3 w-3" />
                                  ) : isGiven ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {isOverloss ? "Over-Loss" : isGiven ? "Issued" : "Returned"}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono font-medium">
                                {mgToGrams(e.netMg)}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {e.purity > 0 ? e.purity : "—"}
                              </td>
                              <td
                                className={`p-4 text-right font-mono font-bold ${isOverloss ? "text-rose-400" : isGiven ? "text-red-400" : "text-green-400"}`}
                              >
                                {e.fineMg > 0 ? `${mgToGrams(e.fineMg)} g` : "—"}
                              </td>
                              <td className="p-4 text-right font-mono">
                                {e.quantity > 0 ? e.quantity : "—"}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Are you sure you want to delete this gold book entry?",
                                        )
                                      ) {
                                        removeEntry(e.id);
                                      }
                                    }}
                                    className="h-8 px-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                    title="Delete Entry"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB CONTENT: WORKER BALANCES ==================== */}
          {activeTab === "balances" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {workerBalances.map((item) => {
                  const activeLedgerCount = entries.filter(
                    (e) => e.workerId === item.worker.id,
                  ).length;
                  return (
                    <div
                      key={item.worker.id}
                      className="bg-card border border-border rounded-md p-5 shadow-sm hover:border-gold/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Worker basic profile card */}
                        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gold/10 grid place-items-center text-gold">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <strong className="text-base text-foreground font-serif block">
                                {item.worker.fullName}
                              </strong>
                              <span className="text-xs text-muted-foreground block uppercase font-mono leading-none">
                                {PERSON_TYPE_LABELS[
                                  item.worker.type as keyof typeof PERSON_TYPE_LABELS
                                ] || item.worker.type}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-muted-foreground font-mono block">
                              Account History
                            </span>
                            <span className="text-xs font-bold text-amber-500 font-mono block">
                              {activeLedgerCount} Transactions
                            </span>
                          </div>
                        </div>

                        {/* Numeric breakdown */}
                        <div className="grid grid-cols-3 gap-3 text-center mb-4">
                          <div className="bg-muted/30 border border-border/50 p-2 rounded-md">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-0.5">
                              Total Given
                            </span>
                            <span className="font-mono text-xs font-semibold text-red-400 block">
                              {mgToGrams(item.totalGivenFine)} g
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {item.totalGivenQty} pcs
                            </span>
                          </div>
                          <div className="bg-muted/30 border border-border/50 p-2 rounded-md">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-0.5">
                              Total Returned
                            </span>
                            <span className="font-mono text-xs font-semibold text-green-400 block">
                              {mgToGrams(item.totalReturnedFine)} g
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {item.totalReturnedQty} pcs
                            </span>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-550/20 p-2 rounded-md">
                            <span className="text-[10px] text-amber-500 block font-bold uppercase tracking-wider mb-0.5">
                              Pending
                            </span>
                            <span className="font-mono text-xs font-bold text-amber-500 block">
                              {mgToGrams(item.pendingFine)} g
                            </span>
                            <span className="font-mono text-[9px] text-amber-500 font-medium">
                              {item.pendingQty} pcs
                            </span>
                          </div>
                        </div>

                        {/* Dynamic Material balance breakdown */}
                        {item.materialBalances.length > 0 && (
                          <div className="mb-4">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1.5 block">
                              Material Balance Breakdown
                            </span>
                            <div className="bg-muted/20 border border-border/40 rounded-md px-3 py-2 space-y-1.5 max-h-[140px] overflow-y-auto">
                              {item.materialBalances.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-xs border-b border-border/20 last:border-0 pb-1.5 last:pb-0"
                                >
                                  <span className="font-medium text-foreground">
                                    {m.material} {m.purity > 0 ? `(${m.purity})` : ""}
                                  </span>
                                  <div className="text-right font-mono text-[11px] space-x-2">
                                    {m.pendingFine > 0 && (
                                      <span className="text-amber-500 font-bold">
                                        {mgToGrams(m.pendingFine)} g pending
                                      </span>
                                    )}
                                    {m.pendingQty > 0 && (
                                      <span className="text-amber-400 font-semibold">
                                        {m.pendingQty} pcs pending
                                      </span>
                                    )}
                                    {m.pendingFine === 0 && m.pendingQty === 0 && (
                                      <span className="text-success font-medium flex items-center gap-1 inline-flex">
                                        <CheckCircle className="h-3 w-3" /> Settled
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Ledger Reconciliation Assertion */}
                        <div className="mt-3 mb-1 pt-2 border-t border-dashed border-border/60 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">
                            Ledger Audit Status:
                          </span>
                          {activeLedgerCount === 0 && item.pendingFine === 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/50"></span>
                              No Activity
                            </div>
                          ) : Math.max(0, item.totalGivenFine - item.totalReturnedFine) ===
                            item.pendingFine ? (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" />
                              Ledger Reconciled ✓
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                              <X className="h-3 w-3" />
                              Discrepancy Detected
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions footer */}
                      <div className="flex gap-2 border-t border-border/60 pt-3 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setWorkerFilter(item.worker.id);
                            setActiveTab("ledger");
                          }}
                          className="flex-1 text-xs font-semibold gap-1.5"
                        >
                          <History className="h-4 w-4" /> View Full Ledger
                        </Button>
                        {/* Print is per purity book + period — open the ledger,
                        pick a book and range, then Print/Export from there. */}
                        <Link
                          to="/workshop/worker-book/$workerId"
                          params={{ workerId: item.worker.id }}
                          className="flex-1"
                        >
                          <Button
                            size="sm"
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold gap-1.5"
                          >
                            <Printer className="h-4 w-4" /> Open & Print
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB CONTENT: DAILY MATERIAL SLIPS ==================== */}
          {activeTab === "daily_slips" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-md p-4 shadow-sm">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Reprint by Slip Number or Worker
                </label>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. MTS-20260717-001 or worker name"
                    value={slipSearch}
                    onChange={(e) => setSlipSearch(e.target.value)}
                    className="pl-9 font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  One consolidated slip per worker per day — every Issue and Return that day shares
                  this Slip Number. Click Print to hand it to the worker or reprint a previous day.
                </p>
              </div>

              <div className="bg-card border border-border rounded-md shadow-sm overflow-hidden">
                {/* Mobile view */}
                <div className="block md:hidden divide-y divide-border">
                  {dailySlips.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground italic text-sm">
                      No daily slips yet. Issue or return material to generate a Daily Material
                      Slip.
                    </div>
                  ) : (
                    dailySlips.map((s) => (
                      <div key={`${s.workerId}-${s.date}`} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-gold text-sm">
                            {s.slipNumber}
                          </span>
                          <span className="font-semibold text-xs text-muted-foreground">
                            {s.date}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{s.workerName}</span>
                          <span className="text-muted-foreground font-mono">
                            {s.transactionCount} Txns
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2 rounded-lg text-center font-mono text-[11px]">
                          <div>
                            <span className="text-[9px] text-muted-foreground block uppercase font-sans">
                              Issued
                            </span>
                            <span className="text-red-400 font-semibold">
                              {mgToGrams(s.totalIssuedFineMg)} g
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground block uppercase font-sans">
                              Returned
                            </span>
                            <span className="text-green-400 font-semibold">
                              {mgToGrams(s.totalReturnedFineMg)} g
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-muted-foreground block uppercase font-sans">
                              Custody
                            </span>
                            <span className="text-amber-500 font-bold">
                              {mgToGrams(s.custodyBalanceAfterMg)} g
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Link
                            to="/workshop/material-slip/$workerId/$date"
                            params={{ workerId: s.workerId, date: s.date }}
                            className="w-full"
                          >
                            <Button
                              size="sm"
                              className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold gap-1.5 h-8"
                            >
                              <Printer className="h-4 w-4" /> Print
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-4 w-[18%]">Slip No</th>
                        <th className="p-4 w-[12%]">Date</th>
                        <th className="p-4 w-[18%]">Worker</th>
                        <th className="p-4 w-[8%] text-center">Txns</th>
                        <th className="p-4 w-[12%] text-right">Issued (g)</th>
                        <th className="p-4 w-[12%] text-right">Returned (g)</th>
                        <th className="p-4 w-[12%] text-right">Custody Balance (g)</th>
                        <th className="p-4 w-[8%] text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySlips.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-muted-foreground italic">
                            No daily slips yet. Issue or return material to generate a Daily
                            Material Slip.
                          </td>
                        </tr>
                      ) : (
                        dailySlips.map((s) => (
                          <tr
                            key={`${s.workerId}-${s.date}`}
                            className="border-b border-border hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-mono font-bold text-gold">{s.slipNumber}</td>
                            <td className="p-4 whitespace-nowrap font-semibold">{s.date}</td>
                            <td className="p-4 font-bold">{s.workerName}</td>
                            <td className="p-4 text-center font-mono">{s.transactionCount}</td>
                            <td className="p-4 text-right font-mono text-red-400">
                              {mgToGrams(s.totalIssuedFineMg)}
                            </td>
                            <td className="p-4 text-right font-mono text-green-400">
                              {mgToGrams(s.totalReturnedFineMg)}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-amber-500">
                              {mgToGrams(s.custodyBalanceAfterMg)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center">
                                <Link
                                  to="/workshop/material-slip/$workerId/$date"
                                  params={{ workerId: s.workerId, date: s.date }}
                                >
                                  <Button
                                    size="sm"
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold gap-1.5 h-8"
                                  >
                                    <Printer className="h-4 w-4" /> Print
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB CONTENT: RECEIVE READY STOCK ==================== */}
          {activeTab === "receive_ready_stock" && (
            <div className="space-y-6">
              {/* Hero Banner Card */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                        <PackageCheck className="h-5 w-5" />
                      </span>
                      <h2 className="text-lg font-bold text-foreground">
                        Receive Finished Jewellery into Ready Stock
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-2xl">
                      When a karigar finishes work (e.g. returns 47.000g finished item against 50.000g issued gold), deposit the ready-made jewellery into your Ready Stock inventory with an auto-generated Barcode & Item Code, and credit the Karigar's gold ledger to reduce their outstanding custody balance.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setReceiveWorkerId("");
                      setReceiveProductDialogOpen(true);
                    }}
                    className="bg-gold hover:bg-gold/90 text-primary-foreground font-semibold gap-2 shadow-sm shrink-0"
                  >
                    <Plus className="h-4 w-4" /> Receive Finished Product
                  </Button>
                </div>
              </div>

              {/* Workers with Pending Balances Quick Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gold" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Workers with Pending Custody Gold
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {workerBalances
                    .filter((b) => b.pendingFine > 0 || b.pendingQty > 0)
                    .slice(0, 6)
                    .map((b) => (
                      <div
                        key={b.worker.id}
                        className="bg-card border border-border/80 hover:border-gold/50 rounded-lg p-3.5 transition-all flex items-center justify-between shadow-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate">
                            {b.worker.fullName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Custody: <span className="font-mono font-bold text-amber-400">{mgToGrams(b.pendingFine)} g fine</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setReceiveWorkerId(b.worker.id);
                            setReceiveProductDialogOpen(true);
                          }}
                          className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold h-8 gap-1"
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> Receive Work
                        </Button>
                      </div>
                    ))}
                  {workerBalances.filter((b) => b.pendingFine > 0 || b.pendingQty > 0).length === 0 && (
                    <div className="col-span-full p-6 text-center text-muted-foreground italic text-xs border border-dashed border-border rounded-lg">
                      No workers have pending custody balance. You can still receive finished stock from any worker.
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Finished Stock Received from Karigars */}
              <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gold" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                      Recent Ready Stock Received from Karigars ({stockItems.filter((i) => i.notes?.includes("Manufactured by") || i.notes?.includes("Karigar")).length})
                    </h3>
                  </div>
                  <Link to="/stock">
                    <Button variant="ghost" size="sm" className="text-xs font-semibold text-gold gap-1">
                      View All Ready Stock <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[750px] text-left text-sm">
                    <thead className="bg-muted/50 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="p-3 w-[15%]">Item Code</th>
                        <th className="p-3 w-[15%]">Barcode</th>
                        <th className="p-3 w-[25%]">Item / Category</th>
                        <th className="p-3 w-[10%] text-center">Purity</th>
                        <th className="p-3 w-[12%] text-right">Gross (g)</th>
                        <th className="p-3 w-[12%] text-right">Net (g)</th>
                        <th className="p-3 w-[11%] text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stockItems
                        .filter((i) => i.notes?.includes("Manufactured by") || i.notes?.includes("Karigar"))
                        .slice(0, 15)
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-mono font-bold text-foreground">{item.itemCode}</td>
                            <td className="p-3 font-mono text-xs text-gold">{item.barcode}</td>
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{item.itemName}</div>
                              <div className="text-xs text-muted-foreground truncate">{item.notes}</div>
                            </td>
                            <td className="p-3 text-center font-mono text-xs font-semibold text-amber-400">
                              {item.purity}‰
                            </td>
                            <td className="p-3 text-right font-mono">{mgToGrams(item.grossMg)}</td>
                            <td className="p-3 text-right font-mono font-bold text-foreground">
                              {mgToGrams(item.netMg)}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Link to="/stock/$id" params={{ id: item.id }}>
                                  <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                                    View
                                  </Button>
                                </Link>
                                <Link to="/stock/print/$id" params={{ id: item.id }}>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-gold">
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {stockItems.filter((i) => i.notes?.includes("Manufactured by") || i.notes?.includes("Karigar")).length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground italic text-xs">
                            No finished stock received from karigars yet. Click "Receive Ready Stock" to record completed work and deposit jewellery into Ready Stock inventory.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ENTRY SHEET (ledger stays visible & scrolls smoothly) ==================== */}
          <Sheet open={entrySheetOpen} onOpenChange={setEntrySheetOpen}>
            <SheetContent side="right" className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl w-full flex flex-col h-full p-0 overflow-hidden bg-card text-foreground">
              <SheetHeader className="p-5 pb-3 border-b border-border bg-card/95 shrink-0">
                <SheetTitle className="flex items-center gap-2 font-serif text-gold text-lg">
                  {entryType === "given" ? (
                    <Plus className="h-5 w-5 text-red-400" />
                  ) : entryType === "return" ? (
                    <Minus className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                  )}
                  {entryType === "given"
                    ? "Issue Material / Gold to Karigar"
                    : entryType === "return"
                      ? "Receive Material / Gold from Karigar"
                      : "Record Over-Loss / Excess Ghata"}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {entryType === "given"
                    ? "Draw from live Material / Gold Vault and debit to Karigar custody balance."
                    : entryType === "return"
                      ? "Credit returned metal/material and settle against Karigar custody ledger."
                      : "Record verified manufacturing over-loss, relieve Karigar custody balance, and post to Gold Ledger."}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-2 bg-background border border-border p-1 rounded-md mb-2">
                  <button
                    type="button"
                    onClick={() => handleEntryTypeChange("given")}
                    className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${entryType === "given" ? "bg-red-500/10 text-red-400 font-bold border border-red-500/20" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    <Plus className="h-3.5 w-3.5" /> Issue (Debit)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntryTypeChange("return")}
                    className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${entryType === "return" ? "bg-green-500/10 text-green-400 font-bold border border-green-500/20" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    <Minus className="h-3.5 w-3.5" /> Receive (Credit)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEntryTypeChange("overloss")}
                    className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${entryType === "overloss" ? "bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Over-Loss
                  </button>
                </div>

                <form onSubmit={handleSubmitEntry} className="space-y-4 pb-8">
                  {formError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold rounded-md">
                      {formError}
                    </div>
                  )}

                  {/* Select Worker */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Worker / Karigar <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formWorkerId}
                      onChange={(e) => handleWorkerChange(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                      required
                    >
                      <option value="">-- Choose Worker --</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.fullName} (
                          {PERSON_TYPE_LABELS[w.type as keyof typeof PERSON_TYPE_LABELS] || w.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DEDICATED OVER-LOSS FORM SECTION */}
                  {entryType === "overloss" ? (
                    <div className="space-y-4 border-t border-border/40 pt-3">
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                        Recording an Over-Loss will credit the Karigar's custody balance for the unreturned metal and record a loss relief entry in the Gold Ledger with full audit provenance.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Expected Weight (g) *
                          </label>
                          <DecimalInput
                            placeholder="0.000"
                            value={formExpectedGrossG}
                            onChange={setFormExpectedGrossG}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Actual Returned (g) *
                          </label>
                          <DecimalInput
                            placeholder="0.000"
                            value={formActualReturnedGrossG}
                            onChange={setFormActualReturnedGrossG}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Gold Purity (‰)
                          </label>
                          <select
                            value={formPurity}
                            onChange={(e) => setFormPurity(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                          >
                            <option value="916">22K / 916‰</option>
                            <option value="750">18K / 750‰</option>
                            <option value="999">24K / 999‰ Pure</option>
                            <option value="585">14K / 585‰</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Valuation Rate (₹/g)
                          </label>
                          <Input
                            type="number"
                            value={formOverLossRatePerG}
                            onChange={(e) => setFormOverLossRatePerG(e.target.value)}
                            placeholder="7500"
                          />
                        </div>
                      </div>

                      {/* Over-Loss Live Calculation Box */}
                      {(() => {
                        const expG = parseFloat(formExpectedGrossG) || 0;
                        const actG = parseFloat(formActualReturnedGrossG) || 0;
                        const lossG = Math.max(0, expG - actG);
                        const purityNum = Number(formPurity) || 916;
                        const fineG = (lossG * purityNum) / 1000;
                        const rateNum = parseFloat(formOverLossRatePerG) || 7500;
                        const valRupees = fineG * rateNum;

                        return (
                          <div className="p-3.5 bg-background border border-border rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Calculated Over-Loss:</span>
                              <span className="font-mono font-bold text-rose-400 text-sm">
                                {lossG.toFixed(3)} g Gross ({fineG.toFixed(3)} g Fine)
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs border-t border-border/40 pt-1.5">
                              <span className="text-muted-foreground">Financial Impact:</span>
                              <span className="font-mono font-bold text-foreground">
                                ₹ {valRupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Reason for Over-Loss *
                        </label>
                        <select
                          value={formOverLossReason}
                          onChange={(e) => setFormOverLossReason(e.target.value)}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm mb-2"
                        >
                          <option value="Excess process/melting loss">Excess Process / Melting Loss</option>
                          <option value="Spillage / filings loss">Spillage / Scrap Loss</option>
                          <option value="Casting / die defect">Casting / Die Defect</option>
                          <option value="Acid / chemical reaction">Acid / Chemical Reaction</option>
                          <option value="Other manufacturing loss">Other Manufacturing Loss</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Job Card / Reference
                        </label>
                        <Input
                          placeholder="e.g. Job #JC-102 or Melting batch ref"
                          value={formReference}
                          onChange={(e) => setFormReference(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Audit Notes
                        </label>
                        <Input
                          placeholder="Approver remarks or loss explanation"
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Material Name / Particulars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Particulars / Material <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formParticulars}
                            onChange={(e) => handleMaterialChange(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                            required
                          >
                            <option value="">-- Select Material --</option>
                            {entryType === "given"
                              ? materialOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))
                              : RETURN_PARTICULAR_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                          </select>
                        </div>

                        {/* Custom input if "Other" is chosen */}
                        {(formParticulars === "Other" || !formParticulars) && (
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                              Custom Material Description <span className="text-red-500">*</span>
                            </label>
                            <Input
                              placeholder="e.g. Returned filings with solder, Die set, Ball wire"
                              value={formCustomParticulars}
                              onChange={(e) => setFormCustomParticulars(e.target.value)}
                              required
                            />
                          </div>
                        )}
                      </div>

                  {/* Real-time Material Stock Card */}
                  {entryType === "given" && formParticulars && (
                    <div className="rounded-lg border border-gold/40 bg-gold/5 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                          Material Vault Stock Status
                        </span>
                        <span className="font-mono font-bold text-gold">
                          {materialStockCaption(
                            formParticulars === "Other" ? formCustomParticulars : formParticulars,
                            formPurity === "custom"
                              ? Number(formCustomPurity) || 0
                              : Number(formPurity) || 0,
                            Number(formGrossG) > 0 ? gramsToMg(formGrossG) : 0,
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Weights block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/40 pt-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Gross Weight (grams) *
                      </label>
                      <DecimalInput
                        placeholder="0.000"
                        value={formGrossG}
                        onChange={setFormGrossG}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Less (g)
                      </label>
                      <DecimalInput
                        placeholder="0.000"
                        value={formLessG}
                        onChange={setFormLessG}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <button
                      type="button"
                      className="text-xs font-semibold text-gold hover:underline"
                      onClick={() => setShowOfflineHisab((v) => !v)}
                    >
                      {showOfflineHisab ? "Hide" : "Show"} Offline hisab (Add / Wstg / Plus fine / Labour / Process)
                    </button>
                    {showOfflineHisab ? (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Add (g)
                          </label>
                          <DecimalInput placeholder="0.000" value={formAddG} onChange={setFormAddG} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Wstg %
                          </label>
                          <Input
                            inputMode="decimal"
                            value={formWstgPct}
                            onChange={(e) => setFormWstgPct(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Plus fine (g)
                          </label>
                          <DecimalInput
                            placeholder="0.000"
                            value={formPlusFineG}
                            onChange={setFormPlusFineG}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Labour cash (INR)
                          </label>
                          <Input
                            inputMode="decimal"
                            value={formLabourCash}
                            onChange={(e) => setFormLabourCash(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5">
                            Over-loss (g) / Excess Ghata
                          </label>
                          <DecimalInput
                            placeholder="0.000"
                            value={formOverLossG}
                            onChange={setFormOverLossG}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Dhadi group (dg_no)
                          </label>
                          <select
                            value={formDhadiGroupId}
                            onChange={(e) => setFormDhadiGroupId(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                          >
                            <option value="">— Optional —</option>
                            {dhadiGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.code ? `${g.code} · ` : ""}
                                {g.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Offline Dhadi_Group. Manage under Workshop → Dhadi Group. Not required to post.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Process type
                          </label>
                          <Input
                            value={formProcessType}
                            onChange={(e) => setFormProcessType(e.target.value)}
                            placeholder="PATLA / GAT / RAWAL / …"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Stamp
                          </label>
                          <Input
                            value={formStampCode}
                            onChange={(e) => setFormStampCode(e.target.value)}
                            placeholder="Stamp code"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {goldMaterialSelected && (
                    <GoldPurityHelper
                      weightG={formGrossG}
                      fromPurity={
                        formPurity === "custom"
                          ? Number(formCustomPurity) || undefined
                          : Number(formPurity) || undefined
                      }
                      lockedWeight={false}
                      lockedFrom={formPurity !== "custom" && Boolean(Number(formPurity))}
                    />
                  )}

                  {/* Touch & Purity — vault stock only for gold materials */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/40 pt-3">
                    {goldMaterialSelected ? (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Gold purity in vault
                        </label>
                        {vaultGoldPurities.length === 0 ? (
                          <p className="text-xs text-amber-600">
                            No gold balances in vault yet. Post opening gold under Gold Ledger first.
                          </p>
                        ) : (
                          <select
                            value={formVaultStockId || formPurity}
                            onChange={(e) => {
                              const line = vaultGoldPurities.find((l) => l.id === e.target.value);
                              if (line) {
                                setFormVaultStockId(line.id);
                                setFormPurity(String(line.purity));
                              } else {
                                setFormVaultStockId(e.target.value);
                                setFormPurity(e.target.value);
                              }
                            }}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
                          >
                            {vaultGoldPurities.map((line) => (
                              <option key={line.id} value={line.id}>
                                {line.purity}‰ / {line.touchPct}% — {mgToGrams(line.availableGrossMg)}{" "}
                                g in {line.location}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Material type
                        </label>
                        <p className="text-sm text-muted-foreground py-2">
                          Manufacturing material / accessory
                        </p>
                        <input type="hidden" value="0" readOnly />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Pieces / Quantity (Optional)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={formQty}
                        onChange={(e) => setFormQty(e.target.value)}
                      />
                    </div>

                    {/* Real-time Fine Gold display for gold materials */}
                    {goldMaterialSelected && Number(formPurity) > 0 && (
                      <div className="sm:col-span-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-3 flex items-center justify-between">
                        <div>
                          <strong className="text-xs text-amber-500 block font-semibold uppercase tracking-wider">
                            Estimated Fine Gold Impact
                          </strong>
                          <span className="text-[11px] text-muted-foreground">
                            Automatically credited or debited from worker gold account.
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-bold text-amber-500">
                            {(() => {
                              const gross = (Number(formGrossG) || 0) * 1000;
                              const pur = Number(formPurity) || 0;
                              const fine = fineGoldMg(Math.round(gross), pur);
                              return (fine / 1000).toFixed(3);
                            })()}{" "}
                            g Fine Gold
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reference and Signees */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/40 pt-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Ref Note / Order / Design
                      </label>
                      <Input
                        placeholder="e.g. Order #1042 or Riya Ring"
                        value={formReference}
                        onChange={(e) => setFormReference(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Given By / Handed Over
                      </label>
                      <Input
                        placeholder="Staff/Karigar name"
                        value={formGivenBy}
                        onChange={(e) => setFormGivenBy(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Received By / Confirmed
                      </label>
                      <Input
                        placeholder="Staff/Karigar name"
                        value={formReceivedBy}
                        onChange={(e) => setFormReceivedBy(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Notes / Narration */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Narration / Remarks
                    </label>
                    <textarea
                      placeholder="Provide detailed description of manufacturing requirements, die number, ball wire size..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold h-20 resize-none"
                    />
                  </div>

                    </>
                  )}

                  {/* Submission Button */}
                  <div className="pt-3 border-t border-border/40">
                    <Button
                      type="submit"
                      className={`w-full font-bold uppercase tracking-wider py-3 h-auto ${entryType === "given" ? "bg-red-500 hover:bg-red-600 text-white" : entryType === "return" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}`}
                    >
                      {entryType === "given"
                        ? "Record Material Issue"
                        : entryType === "return"
                          ? "Record Material Return"
                          : "Post Over-Loss Relief Voucher"}
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
      <MobileConfirmSummary
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          pendingSummary?.type === "return"
            ? "Confirm gold receive"
            : pendingSummary?.type === "overloss"
              ? "Confirm Over-Loss Relief"
              : "Confirm gold issue"
        }
        description="Review the voucher before it posts to Karigar Transactions."
        rows={
          pendingSummary
            ? [
                { label: "Worker", value: pendingSummary.workerName },
                {
                  label: "Type",
                  value:
                    pendingSummary.type === "given"
                      ? "Issue (given)"
                      : pendingSummary.type === "return"
                        ? "Receive (return)"
                        : "Record Over-Loss (Relief)",
                },
                { label: "Particulars", value: pendingSummary.particulars },
                {
                  label: "Weight",
                  value:
                    pendingSummary.grossMg > 0
                      ? `${mgToGrams(pendingSummary.grossMg)} g`
                      : "—",
                },
                {
                  label: "Purity",
                  value: pendingSummary.purity > 0 ? `${pendingSummary.purity}‰` : "—",
                },
                {
                  label: "Qty",
                  value: pendingSummary.qty > 0 ? String(pendingSummary.qty) : "—",
                },
              ]
            : []
        }
        confirmLabel={
          pendingSummary?.type === "given"
            ? "Post issue"
            : pendingSummary?.type === "return"
              ? "Post receive"
              : "Post Over-Loss"
        }
        onConfirm={commitPendingEntry}
      />
      <ReceiveFinishedProductDialog
        open={receiveProductDialogOpen}
        onClose={() => setReceiveProductDialogOpen(false)}
        defaultWorkerId={receiveWorkerId || undefined}
        onSaved={({ itemName, barcode, fineMg, workerName }) => {
          void refresh();
          void refreshVault();
          void useStock.getState().refresh();
          toast.success(
            `Received ${itemName} (${(fineMg / 1000).toFixed(3)}g fine) from ${workerName} into Ready Stock!`,
          );
        }}
      />
    </div>
  );
}

const PERSON_TYPE_LABELS = {
  customer: "Customer",
  firm_customer: "Firm Customer",
  karigar: "Karigar",
  worker: "Worker",
  employee: "Employee",
  vendor: "Vendor",
  outside_worker: "Outside Worker",
};

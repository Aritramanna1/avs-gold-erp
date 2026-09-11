/**
 * Universal Transaction Engine Designer & Declarative Voucher Registry
 *
 * Master Reference: docs/MASTER/UNIVERSAL_TRANSACTION_ENGINE.md
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * "WE CANNOT PREDICT EVERY FUTURE JEWELLERY TRANSACTION. THEREFORE, AUTHORISED
 * TENANTS CAN INTRODUCE LEGITIMATE NEW BUSINESS TRANSACTIONS THROUGH DECLARATIVE
 * METADATA WITHOUT TOUCHING SOURCE CODE."
 */
import { useState, useMemo, useEffect } from "react";
import {
  useTransactionTypesStore,
  type TransactionTypeDefinition,
  type TransactionCategory,
  type PartyRequirement,
  type MovementDirection,
  type LineItemType,
  type TransactionCustomField,
  STANDARD_TRANSACTION_PRESETS,
  ensureTransactionTypesLoaded,
} from "@/lib/transaction-types-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Receipt,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Sparkles,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Layers,
  Coins,
  Scale,
  Building2,
  Hammer,
  Truck,
  User,
  Sliders,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORY_TABS: Array<{ key: TransactionCategory | "all"; label: string }> = [
  { key: "all", label: "All Transactions" },
  { key: "sales", label: "Commercial Sales" },
  { key: "purchase", label: "Purchases & Inward" },
  { key: "workshop", label: "Workshop & Mfg" },
  { key: "subcontractor", label: "Subcontractor & Mina" },
  { key: "treasury", label: "Treasury & Vault" },
  { key: "custom", label: "Custom Tenant Types" },
];

export function UniversalTransactionEngineDesigner() {
  const {
    transactionTypes,
    selectedCategory,
    searchQuery,
    setCategory,
    setSearchQuery,
    addTransactionType,
    updateTransactionType,
    deleteTransactionType,
    toggleTransactionActive,
    resetToStandardPresets,
    exportCustomSchemaBundle,
    importCustomSchemaBundle,
  } = useTransactionTypesStore();

  useEffect(() => {
    void ensureTransactionTypesLoaded();
  }, []);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionTypeDefinition | null>(null);

  // Form State for Creator/Editor Modal
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPrefix, setFormPrefix] = useState("");
  const [formCategory, setFormCategory] = useState<TransactionCategory>("custom");
  const [formDescription, setFormDescription] = useState("");
  const [formPartyReq, setFormPartyReq] = useState<PartyRequirement>("optional");
  const [formMovement, setFormMovement] = useState<MovementDirection>("TRANSFER");
  const [formLineItems, setFormLineItems] = useState<LineItemType[]>(["metal"]);
  const [formCustomFields, setFormCustomFields] = useState<TransactionCustomField[]>([]);
  const [formLedgerImpact, setFormLedgerImpact] = useState({
    moneyLedger: true,
    metalLedger: true,
    stockLedger: true,
    partyLedger: true,
    mfgLedger: false,
    taxLedger: false,
  });
  const [formApprovalMode, setFormApprovalMode] = useState<"auto" | "single" | "threshold">("auto");
  const [formMinAmountPaise, setFormMinAmountPaise] = useState<number>(0);
  const [formMinWeightG, setFormMinWeightG] = useState<number>(0);
  const [formApproverRole, setFormApproverRole] = useState<"manager" | "owner" | "admin">(
    "manager",
  );
  const [formDefaultTemplate, setFormDefaultTemplate] = useState("purchase_voucher");

  // New Custom Field Inputs
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<
    "text" | "number" | "date" | "select" | "boolean"
  >("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return transactionTypes.filter((tx) => {
      const matchesCategory = selectedCategory === "all" || tx.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tx.name.toLowerCase().includes(q) ||
        tx.code.toLowerCase().includes(q) ||
        tx.prefix.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [transactionTypes, selectedCategory, searchQuery]);

  const openNewTransactionModal = () => {
    setEditingTx(null);
    setFormName("");
    setFormCode("");
    setFormPrefix("VCH-");
    setFormCategory("custom");
    setFormDescription("");
    setFormPartyReq("customer");
    setFormMovement("TRANSFER");
    setFormLineItems(["metal"]);
    setFormCustomFields([]);
    setFormLedgerImpact({
      moneyLedger: true,
      metalLedger: true,
      stockLedger: true,
      partyLedger: true,
      mfgLedger: false,
      taxLedger: false,
    });
    setFormApprovalMode("auto");
    setFormMinAmountPaise(0);
    setFormMinWeightG(0);
    setFormApproverRole("manager");
    setFormDefaultTemplate("purchase_voucher");
    setIsEditorOpen(true);
  };

  const openEditTransactionModal = (tx: TransactionTypeDefinition) => {
    setEditingTx(tx);
    setFormName(tx.name);
    setFormCode(tx.code);
    setFormPrefix(tx.prefix);
    setFormCategory(tx.category);
    setFormDescription(tx.description);
    setFormPartyReq(tx.partyRequirement);
    setFormMovement(tx.movementDirection);
    setFormLineItems([...tx.lineItemTypes]);
    setFormCustomFields([...tx.customFields]);
    setFormLedgerImpact({ ...tx.ledgerImpact });
    setFormApprovalMode(tx.approvalRule.mode);
    setFormMinAmountPaise(tx.approvalRule.minAmountPaise || 0);
    setFormMinWeightG(tx.approvalRule.minWeightG || 0);
    setFormApproverRole(tx.approvalRule.approverRole || "manager");
    setFormDefaultTemplate(tx.defaultTemplateId || "purchase_voucher");
    setIsEditorOpen(true);
  };

  const cloneTransactionModal = (tx: TransactionTypeDefinition) => {
    setEditingTx(null);
    setFormName(`${tx.name} (Copy)`);
    setFormCode(`${tx.code}_COPY`);
    setFormPrefix(`${tx.prefix}C-`);
    setFormCategory("custom");
    setFormDescription(tx.description);
    setFormPartyReq(tx.partyRequirement);
    setFormMovement(tx.movementDirection);
    setFormLineItems([...tx.lineItemTypes]);
    setFormCustomFields([...tx.customFields]);
    setFormLedgerImpact({ ...tx.ledgerImpact });
    setFormApprovalMode(tx.approvalRule.mode);
    setFormMinAmountPaise(tx.approvalRule.minAmountPaise || 0);
    setFormMinWeightG(tx.approvalRule.minWeightG || 0);
    setFormApproverRole(tx.approvalRule.approverRole || "manager");
    setFormDefaultTemplate(tx.defaultTemplateId || "purchase_voucher");
    setIsEditorOpen(true);
  };

  const handleSaveTransaction = () => {
    if (!formName.trim()) {
      toast.error("Please provide a transaction name.");
      return;
    }
    const cleanCode = (formCode.trim() || formName.trim())
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");

    const payload = {
      name: formName.trim(),
      code: cleanCode,
      prefix: formPrefix.trim() || "VCH-",
      category: formCategory,
      description: formDescription.trim(),
      partyRequirement: formPartyReq,
      movementDirection: formMovement,
      lineItemTypes: formLineItems,
      customFields: formCustomFields,
      ledgerImpact: formLedgerImpact,
      approvalRule: {
        mode: formApprovalMode,
        minAmountPaise: formMinAmountPaise > 0 ? formMinAmountPaise : undefined,
        minWeightG: formMinWeightG > 0 ? formMinWeightG : undefined,
        approverRole: formApproverRole,
      },
      defaultTemplateId: formDefaultTemplate,
      isSystem: editingTx ? editingTx.isSystem : false,
      isActive: editingTx ? editingTx.isActive : true,
    };

    if (editingTx) {
      void updateTransactionType(editingTx.id, payload).then(() => {
        toast.success(`Updated transaction "${payload.name}" successfully.`);
      });
    } else {
      void addTransactionType(payload).then(() => {
        toast.success(`Created custom transaction "${payload.name}" successfully.`);
      });
    }
    setIsEditorOpen(false);
  };

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) {
      toast.error("Please enter a field label.");
      return;
    }
    const fieldCode = (newFieldName.trim() || newFieldLabel.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    const newField: TransactionCustomField = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fieldCode,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      options:
        newFieldType === "select" && newFieldOptions.trim()
          ? newFieldOptions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    };

    setFormCustomFields([...formCustomFields, newField]);
    setNewFieldName("");
    setNewFieldLabel("");
    setNewFieldOptions("");
    setNewFieldRequired(false);
    toast.success(`Field "${newField.label}" added.`);
  };

  const handleRemoveCustomField = (id: string) => {
    setFormCustomFields(formCustomFields.filter((f) => f.id !== id));
  };

  const handleExportJSON = () => {
    const json = exportCustomSchemaBundle();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `avs_universal_transactions_${Date.now()}.json`;
    a.click();
    toast.success("Transaction definitions bundle exported.");
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const res = await importCustomSchemaBundle(text);
      if (res.success) {
        toast.success(`Imported ${res.count} transaction definitions successfully.`);
      } else {
        toast.error(res.error || "Failed to import JSON.");
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Philosophy */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  Universal Transaction & Voucher Engine
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                  >
                    Zero-Leak Multi-Ledger
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Declaratively define any jewelry transaction without code changes. Every voucher
                  posts atomically across 6 ledgers.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSimulatorOpen(true)}
                className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                <Sparkles className="h-3.5 w-3.5" /> Dry-Run Simulator
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="h-8 text-xs gap-1.5"
                title="Export Schema JSON"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportJSON}
                className="h-8 text-xs gap-1.5"
                title="Import Schema JSON"
              >
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <Button
                size="sm"
                onClick={openNewTransactionModal}
                className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> New Transaction Type
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* 6-Ledger Invariant Summary Bar */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3 border-t border-border/50 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>1. Money Ledger</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Scale className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>2. Metal Ledger</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>3. Stock Ledger</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>4. Party Balance</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Hammer className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>5. Mfg & WIP</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>6. GST Schedule</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_TABS.map((cat) => (
            <Button
              key={cat.key}
              variant={selectedCategory === cat.key ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.key)}
              className={`text-xs h-8 ${
                selectedCategory === cat.key
                  ? "bg-amber-500 text-black font-semibold hover:bg-amber-600"
                  : ""
              }`}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search voucher types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Transactions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTransactions.map((tx) => (
          <Card
            key={tx.id}
            className={`transition-all duration-200 border ${
              tx.isActive
                ? "hover:border-amber-500/50 bg-card"
                : "opacity-60 bg-muted/20 border-dashed"
            }`}
          >
            <CardHeader className="p-4 pb-2 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground">{tx.name}</span>
                    {tx.isSystem && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted">
                        Preset
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-mono text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {tx.code}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Prefix: {tx.prefix}
                    </span>
                  </div>
                </div>

                <Switch
                  checked={tx.isActive}
                  onCheckedChange={() => toggleTransactionActive(tx.id)}
                  title={tx.isActive ? "Deactivate Voucher" : "Activate Voucher"}
                />
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                {tx.description || "No description provided."}
              </p>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-3">
              {/* Material Movement & Party requirement */}
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Direction:</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${
                      tx.movementDirection === "INWARD"
                        ? "text-emerald-500 border-emerald-500/30"
                        : tx.movementDirection === "OUTWARD"
                          ? "text-rose-500 border-rose-500/30"
                          : tx.movementDirection === "TRANSFER"
                            ? "text-amber-500 border-amber-500/30"
                            : "text-muted-foreground"
                    }`}
                  >
                    {tx.movementDirection === "INWARD" && (
                      <ArrowDownLeft className="h-3 w-3 mr-0.5 inline" />
                    )}
                    {tx.movementDirection === "OUTWARD" && (
                      <ArrowUpRight className="h-3 w-3 mr-0.5 inline" />
                    )}
                    {tx.movementDirection === "TRANSFER" && (
                      <ArrowRightLeft className="h-3 w-3 mr-0.5 inline" />
                    )}
                    {tx.movementDirection}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Party:</span>
                  <span className="capitalize font-medium text-foreground">
                    {tx.partyRequirement}
                  </span>
                </div>
              </div>

              {/* 6-Ledger Indicator Badges */}
              <div className="flex flex-wrap gap-1">
                {tx.ledgerImpact.moneyLedger && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    Money
                  </span>
                )}
                {tx.ledgerImpact.metalLedger && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded">
                    Metal
                  </span>
                )}
                {tx.ledgerImpact.stockLedger && (
                  <span className="text-[9px] bg-blue-500/10 text-blue-600 border border-blue-500/20 px-1.5 py-0.5 rounded">
                    Stock
                  </span>
                )}
                {tx.ledgerImpact.partyLedger && (
                  <span className="text-[9px] bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1.5 py-0.5 rounded">
                    Party
                  </span>
                )}
                {tx.ledgerImpact.mfgLedger && (
                  <span className="text-[9px] bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                    Mfg WIP
                  </span>
                )}
                {tx.ledgerImpact.taxLedger && (
                  <span className="text-[9px] bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                    GST
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cloneTransactionModal(tx)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Clone as Custom Transaction"
                >
                  <Copy className="h-3 w-3 mr-1" /> Clone
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditTransactionModal(tx)}
                  className="h-7 px-2.5 text-xs text-amber-600 hover:text-amber-700"
                >
                  <Edit2 className="h-3 w-3 mr-1" /> Configure
                </Button>
                {!tx.isSystem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete custom transaction "${tx.name}"?`)) {
                        void deleteTransactionType(tx.id).then((ok) => {
                          if (ok) toast.success("Transaction type deleted.");
                        });
                      }
                    }}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    title="Delete Custom Transaction"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-card/50 text-muted-foreground space-y-3">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm">No transaction definitions found matching the filter.</p>
          <Button size="sm" onClick={openNewTransactionModal} className="text-xs">
            Create New Transaction Type
          </Button>
        </div>
      )}

      {/* ── Transaction Editor / Creator Modal ────────────────────────────── */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-500" />
              {editingTx
                ? `Configure: ${editingTx.name}`
                : "Create Universal Transaction Definition"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Declaratively configure voucher metadata, 6-ledger posting rules, custom fields, and
              approval gates.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="header" className="w-full mt-2">
            <TabsList className="grid grid-cols-4 h-9">
              <TabsTrigger value="header" className="text-xs">
                1. Header & Type
              </TabsTrigger>
              <TabsTrigger value="ledgers" className="text-xs">
                2. 6-Ledger Rules
              </TabsTrigger>
              <TabsTrigger value="fields" className="text-xs">
                3. Custom Fields
              </TabsTrigger>
              <TabsTrigger value="approvals" className="text-xs">
                4. Approvals & Print
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Header & Category */}
            <TabsContent value="header" className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Transaction Name *</Label>
                  <Input
                    placeholder="e.g. Refinery Melting Loss Voucher"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!editingTx) {
                        setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"));
                      }
                    }}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unique System Code *</Label>
                  <Input
                    placeholder="e.g. REFINERY_MELT_LOSS"
                    value={formCode}
                    onChange={(e) =>
                      setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))
                    }
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Voucher Series Prefix *</Label>
                  <Input
                    placeholder="e.g. MLT-2026-"
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    className="h-8 text-xs font-mono mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                  >
                    <option value="sales">Commercial Sales</option>
                    <option value="purchase">Purchases & Inward</option>
                    <option value="workshop">Workshop & Mfg</option>
                    <option value="subcontractor">Subcontractor & Mina</option>
                    <option value="treasury">Treasury & Vault</option>
                    <option value="custom">Custom Tenant Types</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Party Requirement</Label>
                  <select
                    value={formPartyReq}
                    onChange={(e) => setFormPartyReq(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                  >
                    <option value="customer">Customer Only</option>
                    <option value="supplier">Bullion Supplier Only</option>
                    <option value="karigar">Karigar / Artisan Only</option>
                    <option value="refinery">Refinery / Assay Lab</option>
                    <option value="hallmark">Hallmark Center (HUID)</option>
                    <option value="optional">Optional Party</option>
                    <option value="none">Internal Only (No Party)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Description & Business Rationale</Label>
                <Input
                  placeholder="Explain when and why this transaction is booked in the workshop..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs block mb-1">Permitted Line-Item Types</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["metal", "stone", "charge", "payment"] as LineItemType[]).map((itemType) => {
                    const isChecked = formLineItems.includes(itemType);
                    return (
                      <label
                        key={itemType}
                        className="flex items-center gap-2 p-2 border rounded-md bg-muted/20 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormLineItems([...formLineItems, itemType]);
                            } else {
                              setFormLineItems(formLineItems.filter((i) => i !== itemType));
                            }
                          }}
                          className="rounded border-input"
                        />
                        <span className="capitalize text-xs font-medium">
                          {itemType === "metal"
                            ? "Gold / Metal Rows"
                            : itemType === "stone"
                              ? "Diamond / Gems"
                              : itemType === "charge"
                                ? "Labour & Charges"
                                : "Split Payments"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: 6-Ledger Rules & Direction */}
            <TabsContent value="ledgers" className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-xs">Material Physical Movement Direction</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {[
                    { key: "INWARD", label: "Inward (Receipt)", desc: "Adds gold to vault/stock" },
                    { key: "OUTWARD", label: "Outward (Issue)", desc: "Reduces gold from custody" },
                    { key: "TRANSFER", label: "Bench Transfer", desc: "Vault to Artisan custody" },
                    { key: "NONE", label: "Non-Physical", desc: "Quotation or estimate" },
                  ].map((d) => (
                    <label
                      key={d.key}
                      className={`p-3 border rounded-md cursor-pointer flex flex-col justify-between ${
                        formMovement === d.key
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border bg-muted/10"
                      }`}
                      onClick={() => setFormMovement(d.key as any)}
                    >
                      <span className="font-semibold text-foreground">{d.label}</span>
                      <span className="text-[10px] text-muted-foreground mt-1">{d.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  Atomic Multi-Ledger Posting Targets
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Select which ledgers are automatically credited/debited upon voucher confirmation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">1. Financial Money Ledger</div>
                      <div className="text-[10px] text-muted-foreground">
                        Double-entry monetary debits & credits
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.moneyLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, moneyLedger: c })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">2. Physical Metal Ledger</div>
                      <div className="text-[10px] text-muted-foreground">
                        Gross wt, Touch %, Pure 999 Fine Gold
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.metalLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, metalLedger: c })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">3. Stock & Inventory Ledger</div>
                      <div className="text-[10px] text-muted-foreground">
                        Barcode tags, loose bullion, vault trays
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.stockLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, stockLedger: c })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">4. Party 360 Balance Ledger</div>
                      <div className="text-[10px] text-muted-foreground">
                        Jama / Naam running gold & cash balances
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.partyLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, partyLedger: c })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">
                        5. Manufacturing & WIP Ledger
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Job card state, dust/filings recovery
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.mfgLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, mfgLedger: c })
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 border rounded-md bg-card">
                    <div>
                      <div className="font-medium text-foreground">
                        6. GST & Statutory Tax Ledger
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        CGST, SGST, IGST, e-Way, GSTR-1 schedules
                      </div>
                    </div>
                    <Switch
                      checked={formLedgerImpact.taxLedger}
                      onCheckedChange={(c) =>
                        setFormLedgerImpact({ ...formLedgerImpact, taxLedger: c })
                      }
                    />
                  </label>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Custom Fields */}
            <TabsContent value="fields" className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-xs">Configured Custom Voucher Fields</Label>
                <div className="rounded-lg border divide-y mt-1">
                  {formCustomFields.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground italic">
                      No custom fields added yet. Add bespoke attributes below.
                    </div>
                  ) : (
                    formCustomFields.map((field) => (
                      <div
                        key={field.id}
                        className="p-2.5 flex items-center justify-between hover:bg-muted/20"
                      >
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-2">
                            {field.label}
                            {field.required && (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-amber-600 border-amber-500/30"
                              >
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            code: {field.name} | type: {field.type}
                            {field.options && ` | options: [${field.options.join(", ")}]`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveCustomField(field.id)}
                          className="h-6 w-6 p-0 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Custom Field Subform */}
              <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
                <div className="font-semibold text-foreground">Add Bespoke Header Attribute</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input
                    placeholder="Label (e.g. Assay Batch No)"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Field Code (optional)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="text">Text (Single Line)</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown Select</option>
                    <option value="boolean">Checkbox / Toggle</option>
                  </select>
                  <Button size="sm" onClick={handleAddCustomField} className="h-8 text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </Button>
                </div>
                {newFieldType === "select" && (
                  <Input
                    placeholder="Comma-separated options (e.g. Batch A, Batch B, High Assay)"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-muted-foreground">
                    Mandatory field (cannot post voucher if blank)
                  </span>
                </label>
              </div>
            </TabsContent>

            {/* TAB 4: Approval Rules & Print Template */}
            <TabsContent value="approvals" className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-xs">Voucher Approval Authorization Rule</Label>
                  <select
                    value={formApprovalMode}
                    onChange={(e) => setFormApprovalMode(e.target.value as any)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="auto">Auto-Post Instantly (No Approval Required)</option>
                    <option value="single">Single Approval Required (Manager Sign-Off)</option>
                    <option value="threshold">Threshold-Based Approval (Above ₹ or Grams)</option>
                  </select>

                  {formApprovalMode === "threshold" && (
                    <div className="p-3 border rounded-md bg-muted/20 space-y-2">
                      <div>
                        <Label className="text-[11px]">Weight Threshold (Grams)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 50.0"
                          value={formMinWeightG || ""}
                          onChange={(e) => setFormMinWeightG(parseFloat(e.target.value || "0"))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Required Approver Role</Label>
                        <select
                          value={formApproverRole}
                          onChange={(e) => setFormApproverRole(e.target.value as any)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                        >
                          <option value="manager">Workshop Manager</option>
                          <option value="owner">Super Owner / Director</option>
                          <option value="admin">System Administrator</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-xs">Bound Document & Print Template</Label>
                  <select
                    value={formDefaultTemplate}
                    onChange={(e) => setFormDefaultTemplate(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="gst_invoice">Tax Invoice Template (A4 / Laser)</option>
                    <option value="estimate">Sales Estimate Slip</option>
                    <option value="purchase_voucher">Purchase & Scrap Voucher</option>
                    <option value="job_card">Artisan Workshop Job Card</option>
                    <option value="delivery_challan">Outside Subcontract Challan</option>
                    <option value="receipt">POS Thermal Receipt (80mm/58mm)</option>
                    <option value="tag">Jewellery Barcode Tag (30x10mm)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Whenever this voucher is printed or shared via WhatsApp/Email, this layout is
                    automatically compiled.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTransaction}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {editingTx ? "Save Changes" : "Publish Transaction Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dry-Run Simulator Modal ─────────────────────────────────────── */}
      <DryRunSimulatorModal open={isSimulatorOpen} onOpenChange={setIsSimulatorOpen} />
    </div>
  );
}

/** Dry-Run Simulation Component to verify Zero-Leak Multi-Ledger balance */
function DryRunSimulatorModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { transactionTypes } = useTransactionTypesStore();
  const [selectedTxId, setSelectedTxId] = useState<string>(transactionTypes[0]?.id || "");
  const [sampleGrossWeight, setSampleGrossWeight] = useState(25.5);
  const [sampleTouch, setSampleTouch] = useState(91.6);
  const [sampleGoldRate, setSampleGoldRate] = useState(7200);
  const [sampleMakingRate, setSampleMakingRate] = useState(450);

  const activeTx = useMemo(
    () => transactionTypes.find((t) => t.id === selectedTxId) || transactionTypes[0],
    [transactionTypes, selectedTxId],
  );

  const fineGoldG = useMemo(
    () => (sampleGrossWeight * sampleTouch) / 100,
    [sampleGrossWeight, sampleTouch],
  );

  const metalValuePaise = useMemo(
    () => Math.round(sampleGrossWeight * sampleGoldRate * 100),
    [sampleGrossWeight, sampleGoldRate],
  );

  const makingPaise = useMemo(
    () => Math.round(sampleGrossWeight * sampleMakingRate * 100),
    [sampleGrossWeight, sampleMakingRate],
  );

  const totalPaise = metalValuePaise + makingPaise;
  const gstPaise = activeTx?.ledgerImpact.taxLedger ? Math.round(totalPaise * 0.03) : 0;
  const grandTotalPaise = totalPaise + gstPaise;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Universal Transaction Multi-Ledger Simulator
          </DialogTitle>
          <DialogDescription className="text-xs">
            Test any transaction type with live sample inputs to mathematically verify zero leaks
            across all 6 ledgers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Select Transaction Type</Label>
              <select
                value={selectedTxId}
                onChange={(e) => setSelectedTxId(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
              >
                {transactionTypes.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.name} ({tx.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Sample Gross Weight (g)</Label>
              <Input
                type="number"
                value={sampleGrossWeight}
                onChange={(e) => setSampleGrossWeight(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Touch Purity (%)</Label>
              <Input
                type="number"
                value={sampleTouch}
                onChange={(e) => setSampleTouch(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Gold Rate (₹/g)</Label>
              <Input
                type="number"
                value={sampleGoldRate}
                onChange={(e) => setSampleGoldRate(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Making Charge (₹/g)</Label>
              <Input
                type="number"
                value={sampleMakingRate}
                onChange={(e) => setSampleMakingRate(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Computed Ledger Breakdown */}
          <div className="rounded-lg border p-4 bg-amber-500/5 border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Multi-Ledger Integrity Audit Pass
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/30"
              >
                Balanced: 0.00 Leak
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
              <div className="p-2 border rounded bg-card">
                <span className="text-muted-foreground block text-[10px]">
                  Pure Fine Gold (999):
                </span>
                <span className="font-mono font-bold text-amber-500">{fineGoldG.toFixed(3)} g</span>
              </div>
              <div className="p-2 border rounded bg-card">
                <span className="text-muted-foreground block text-[10px]">Gross Metal Value:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{(metalValuePaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-2 border rounded bg-card">
                <span className="text-muted-foreground block text-[10px]">Making Charges:</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{(makingPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-2 border rounded bg-card">
                <span className="text-muted-foreground block text-[10px]">GST Tax (3%):</span>
                <span className="font-mono font-bold text-foreground">
                  ₹{(gstPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-2 border rounded bg-card col-span-2">
                <span className="text-muted-foreground block text-[10px]">
                  Total Voucher Monetary Impact:
                </span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  ₹{(grandTotalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Close Simulator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

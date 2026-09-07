/**
 * AVS ERP — Authoritative Workflow Manager Panel
 *
 * Provides complete visual and programmatic administration for:
 * - Business Mode & Workflow Scopes (Manufacturing Only, Retail Only, Combined)
 * - Process Master (Add, Edit, Toggle, Ledger Mapping)
 * - Physical Metal Books (22K/916, 18K/750, 995 Standard Bullion, Custom)
 * - Sequential Steps & State Machine Gates
 * - Field Requirements & Visibility
 * - Validation & Multi-Version Publishing
 */

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWorkflowEngine,
  type BusinessMode,
  type WorkflowScope,
  type WorkflowProcessConfig,
  type WorkflowBookConfig,
  type WorkflowStepConfig,
  WORKFLOW_PRESETS,
} from "@/lib/workflow-engine";
import {
  GitBranch,
  Hammer,
  BookOpen,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Zap,
  ShieldCheck,
  Layers,
  Settings,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export const WorkflowManagerPanel: React.FC = () => {
  const {
    config,
    patch,
    applyPreset,
    reset,
    resetToOfficialDefault,
    useOfficialDefault,
    addProcess,
    toggleProcess,
    deleteProcess,
    addBook,
    toggleBook,
    deleteBook,
    addStep,
    toggleStep,
    updateFieldConfig,
    validateWorkflow,
    publishWorkflow,
  } = useWorkflowEngine();

  const [activeTab, setActiveTab] = useState<"overview" | "processes" | "books" | "steps" | "fields" | "versions">("overview");

  // Dialog States
  const [showAddProcessDialog, setShowAddProcessDialog] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [newProcessType, setNewProcessType] = useState("");
  const [newProcessScope, setNewProcessScope] = useState<WorkflowScope>("manufacturing");
  const [newProcessRule, setNewProcessRule] = useState("");
  const [newProcessApproval, setNewProcessApproval] = useState(false);
  const [newProcessLabourRate, setNewProcessLabourRate] = useState(2500);

  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookPurity, setNewBookPurity] = useState(916);
  const [newBookUnit, setNewBookUnit] = useState<"mg" | "g" | "kg">("mg");
  const [newBookScope, setNewBookScope] = useState<WorkflowScope>("manufacturing");
  const [newBookLedgerMapping, setNewBookLedgerMapping] = useState("karigar");

  const [showAddStepDialog, setShowAddStepDialog] = useState(false);
  const [newStepName, setNewStepName] = useState("");
  const [newStepSeq, setNewStepSeq] = useState(config.steps.length + 1);
  const [newStepRole, setNewStepRole] = useState("supervisor");
  const [newStepApproval, setNewStepApproval] = useState(false);

  const [publishNotes, setPublishNotes] = useState("");
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  const handleModeChange = (mode: BusinessMode) => {
    patch({ mode });
    toast.success(`Workflow mode updated to ${mode.replace(/_/g, " ").toUpperCase()}`);
  };

  const handleCreateProcess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcessName.trim()) {
      toast.error("Process name is required");
      return;
    }
    const typeCode = newProcessType.trim() || newProcessName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    addProcess({
      name: newProcessName.trim(),
      processType: typeCode,
      workflowScope: newProcessScope,
      applicableModule: "workshop",
      processRule: newProcessRule.trim() || undefined,
      requiredFields: ["grossMg", "purity"],
      approvalRequired: newProcessApproval,
      ledgerMapping: "workshop_process_gold_issued",
      labourRatePaise: newProcessLabourRate,
      labourCalcMethod: "per_gram",
      active: true,
    });
    toast.success(`Process "${newProcessName}" added successfully.`);
    setShowAddProcessDialog(false);
    setNewProcessName("");
    setNewProcessType("");
    setNewProcessRule("");
  };

  const handleCreateBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookName.trim()) {
      toast.error("Book name is required");
      return;
    }
    addBook({
      bookName: newBookName.trim(),
      purity: Number(newBookPurity) || 916,
      unit: newBookUnit,
      workflowScope: newBookScope,
      active: true,
      openingBalanceBehavior: "carry_forward",
      applicableTransactionTypes: ["given", "return", "overloss"],
      ledgerMapping: newBookLedgerMapping,
    });
    toast.success(`Book "${newBookName}" added successfully.`);
    setShowAddBookDialog(false);
    setNewBookName("");
  };

  const handleCreateStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepName.trim()) {
      toast.error("Step name is required");
      return;
    }
    addStep({
      name: newStepName.trim(),
      sequence: Number(newStepSeq) || config.steps.length + 1,
      active: true,
      required: true,
      roleRequired: newStepRole,
      approvalRequired: newStepApproval,
      fieldsRequired: ["grossMg"],
      actionEvent: `workflow.${newStepName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    });
    toast.success(`Step "${newStepName}" added successfully.`);
    setShowAddStepDialog(false);
    setNewStepName("");
  };

  const handleRunValidation = () => {
    const res = validateWorkflow();
    setValidationResult(res);
    if (res.valid) {
      toast.success("Workflow validation passed! 0 errors detected.");
    } else {
      toast.error(`Validation failed with ${res.errors.length} error(s).`);
    }
  };

  const handlePublish = async () => {
    const res = await publishWorkflow(publishNotes || "Published via Workflow Customization Hub");
    if (res.success) {
      toast.success(`Workflow published as Version ${res.version}`);
      setPublishNotes("");
      setValidationResult(null);
    } else {
      toast.error(`Publish failed: ${res.errors?.join(", ")}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER & MODE CONTROLS ──────────────────────────────────────── */}
      <Card className="p-5 border-l-4 border-l-gold bg-card/60 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-gold/10 text-gold border-gold/30 font-semibold px-2.5 py-0.5">
                ACTIVE WORKFLOW SCOPE: {config.mode.replace(/_/g, " ").toUpperCase()}
              </Badge>
              {useOfficialDefault ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                  Official AVS Baseline
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                  Tenant Custom Overrides Active
                </Badge>
              )}
              <Badge variant="outline" className="text-xs font-mono">
                v{config.activeVersion}
              </Badge>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Enterprise Workflow Configuration & Lifecycle
            </h3>
            <p className="text-xs text-muted-foreground">
              Authoritative baseline governing manufacturing processes, physical books, required fields, and state transitions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm("Reset workflow configuration to official AVS Default Baseline? All default processes and purity books will be restored.")) {
                  resetToOfficialDefault();
                  toast.success("Restored to official AVS Default Workflow Baseline");
                }
              }}
              className="text-xs h-8 gap-1 border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to AVS Default
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunValidation}
              className="text-xs h-8 gap-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Validate
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              className="text-xs h-8 gap-1 bg-gold text-black hover:bg-gold/90 font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> Publish v{config.activeVersion}
            </Button>
          </div>
        </div>

        {/* Mode Selector Pill Bar */}
        <div className="pt-2 border-t grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange("manufacturing_only")}
            className={`p-3 rounded-lg border text-left transition-all ${
              config.mode === "manufacturing_only"
                ? "border-gold bg-gold/10 shadow-sm"
                : "border-border bg-background/50 hover:border-gold/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">Manufacturing Only</span>
              {config.mode === "manufacturing_only" && <CheckCircle2 className="w-3.5 h-3.5 text-gold" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Pure manufacturing — Job Cards, Karigar Books, and Manufacturing Bills mandatory.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("retail_only")}
            className={`p-3 rounded-lg border text-left transition-all ${
              config.mode === "retail_only"
                ? "border-gold bg-gold/10 shadow-sm"
                : "border-border bg-background/50 hover:border-gold/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">Retail Only</span>
              {config.mode === "retail_only" && <CheckCircle2 className="w-3.5 h-3.5 text-gold" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Showroom commerce — ready stock counter sales, billing, and customer follow-ups.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("combined_commerce_manufacturing")}
            className={`p-3 rounded-lg border text-left transition-all ${
              config.mode === "combined_commerce_manufacturing"
                ? "border-gold bg-gold/10 shadow-sm"
                : "border-border bg-background/50 hover:border-gold/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">Combined Commerce + Mfg</span>
              {config.mode === "combined_commerce_manufacturing" && <CheckCircle2 className="w-3.5 h-3.5 text-gold" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Full hybrid operations — custom order bench work plus ready stock showroom release.
            </p>
          </button>
        </div>
      </Card>

      {/* ── VALIDATION NOTIFICATION BANNER ───────────────────────────────────── */}
      {validationResult && (
        <Card className={`p-4 border text-xs ${validationResult.valid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          <div className="flex items-center gap-2 font-semibold">
            {validationResult.valid ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{validationResult.valid ? "Workflow Configuration Validated & Ready for Production" : "Workflow Errors Detected"}</span>
          </div>
          {!validationResult.valid && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-rose-300">
              {validationResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── SUB-TABS NAVIGATION ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b overflow-x-auto pb-2 text-xs">
        <Button
          size="sm"
          variant={activeTab === "overview" ? "default" : "ghost"}
          onClick={() => setActiveTab("overview")}
          className="h-8 gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" /> Overview & Gates
        </Button>
        <Button
          size="sm"
          variant={activeTab === "processes" ? "default" : "ghost"}
          onClick={() => setActiveTab("processes")}
          className="h-8 gap-1.5"
        >
          <Hammer className="w-3.5 h-3.5" /> Workshop Processes ({config.processes.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "books" ? "default" : "ghost"}
          onClick={() => setActiveTab("books")}
          className="h-8 gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" /> Physical Books ({config.books.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "steps" ? "default" : "ghost"}
          onClick={() => setActiveTab("steps")}
          className="h-8 gap-1.5"
        >
          <GitBranch className="w-3.5 h-3.5" /> Steps & Sequence ({config.steps.length})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "fields" ? "default" : "ghost"}
          onClick={() => setActiveTab("fields")}
          className="h-8 gap-1.5"
        >
          <Layers className="w-3.5 h-3.5" /> Fields & Visibility ({config.fields.length})
        </Button>
      </div>

      {/* ── 1. OVERVIEW & GATES TAB ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-3 bg-card/60">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" /> Manufacturing Bill & Delivery Gates
            </h4>
            <div className="space-y-3 text-xs divide-y">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-medium block">Manufacturing Bill Mandatory</span>
                  <span className="text-[11px] text-muted-foreground">Blocks customer delivery until bill is finalised</span>
                </div>
                <Switch
                  checked={config.mfgBillMandatoryBeforeDelivery}
                  onCheckedChange={(v) => patch({ mfgBillMandatoryBeforeDelivery: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Approval Required Before Finalisation</span>
                  <span className="text-[11px] text-muted-foreground">Requires Maker-Checker manager sign-off</span>
                </div>
                <Switch
                  checked={config.mfgApprovalRequired}
                  onCheckedChange={(v) => patch({ mfgApprovalRequired: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Auto-Close Job Cards</span>
                  <span className="text-[11px] text-muted-foreground">Transitions card to Closed status on final bill</span>
                </div>
                <Switch
                  checked={config.autoCloseJobCard}
                  onCheckedChange={(v) => patch({ autoCloseJobCard: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Automatic Ready Stock Entry</span>
                  <span className="text-[11px] text-muted-foreground">Auto-populates showroom ready stock from bill</span>
                </div>
                <Switch
                  checked={config.finishedStockAutomatic}
                  onCheckedChange={(v) => patch({ finishedStockAutomatic: v })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3 bg-card/60">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <Lock className="w-4 h-4 text-emerald-500" /> Accounting & Gold Ledger Guardrails
            </h4>
            <div className="space-y-3 text-xs divide-y">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="font-medium block">Month-End Financial Lock Enforcement</span>
                  <span className="text-[11px] text-muted-foreground">Rejects postings dated in closed accounting periods</span>
                </div>
                <Switch
                  checked={config.financialLockEnforcementEnabled}
                  onCheckedChange={(v) => patch({ financialLockEnforcementEnabled: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Auto-Post Gold Ledger</span>
                  <span className="text-[11px] text-muted-foreground">Enforces double-entry vault balance sheet postings</span>
                </div>
                <Switch
                  checked={config.autoPostGoldLedger}
                  onCheckedChange={(v) => patch({ autoPostGoldLedger: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Auto-Post Worker Gold Book</span>
                  <span className="text-[11px] text-muted-foreground">Maintains artisan bench custody integrity</span>
                </div>
                <Switch
                  checked={config.autoPostWorkerGoldBook}
                  onCheckedChange={(v) => patch({ autoPostWorkerGoldBook: v })}
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="font-medium block">Delivery Requires Full Payment</span>
                  <span className="text-[11px] text-muted-foreground">Blocks handover if customer owes cash or metal</span>
                </div>
                <Switch
                  checked={config.deliveryRequiresFullPayment}
                  onCheckedChange={(v) => patch({ deliveryRequiresFullPayment: v })}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── 2. PROCESSES TAB ─────────────────────────────────────────────────── */}
      {activeTab === "processes" && (
        <Card className="p-5 space-y-4 bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Hammer className="w-4 h-4 text-primary" /> Workshop Process Masters
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active processes exposed to bench artisans and outside job-work delegation.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddProcessDialog(true)} className="text-xs h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Process
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2.5 font-medium">Process Name</th>
                  <th className="p-2.5 font-medium">Type Code</th>
                  <th className="p-2.5 font-medium">Scope</th>
                  <th className="p-2.5 font-medium">Labour Rate</th>
                  <th className="p-2.5 font-medium">Approval</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {config.processes.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium text-foreground">
                      {p.name}
                      {p.isCustom && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{p.processType}</td>
                    <td className="p-2.5 capitalize">{p.workflowScope}</td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {p.labourRatePaise ? `₹${(p.labourRatePaise / 100).toFixed(2)}/${p.labourCalcMethod === 'per_gram' ? 'g' : 'pc'}` : 'N/A'}
                    </td>
                    <td className="p-2.5">
                      {p.approvalRequired ? <Badge variant="outline" className="text-red-500 border-red-500/30 text-[10px]">Required</Badge> : <span className="text-muted-foreground">Direct</span>}
                    </td>
                    <td className="p-2.5">
                      <Switch
                        checked={p.active}
                        onCheckedChange={(v) => toggleProcess(p.id, v)}
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      {p.isCustom && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteProcess(p.id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 3. BOOKS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "books" && (
        <Card className="p-5 space-y-4 bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Physical Metal Books & Purity Ledgers
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative purity-wise metal registers (22K/916, 18K/750, 995 Standard Bullion).
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddBookDialog(true)} className="text-xs h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Book
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2.5 font-medium">Book Name</th>
                  <th className="p-2.5 font-medium">Purity (‰)</th>
                  <th className="p-2.5 font-medium">Unit</th>
                  <th className="p-2.5 font-medium">Scope</th>
                  <th className="p-2.5 font-medium">Ledger Mapping</th>
                  <th className="p-2.5 font-medium">Status</th>
                  <th className="p-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {config.books.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium text-foreground">
                      {b.bookName}
                      {b.isCustom && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] font-semibold text-gold">{b.purity}</td>
                    <td className="p-2.5 font-mono uppercase text-[11px] text-muted-foreground">{b.unit}</td>
                    <td className="p-2.5 capitalize">{b.workflowScope}</td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{b.ledgerMapping}</td>
                    <td className="p-2.5">
                      <Switch
                        checked={b.active}
                        onCheckedChange={(v) => toggleBook(b.id, v)}
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      {b.isCustom && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteBook(b.id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 4. STEPS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "steps" && (
        <Card className="p-5 space-y-4 bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" /> Workflow Steps & State Pipeline
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sequential bench lifecycle rules and role authorizations.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAddStepDialog(true)} className="text-xs h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Step
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2.5 font-medium">Seq</th>
                  <th className="p-2.5 font-medium">Step Name</th>
                  <th className="p-2.5 font-medium">Role Required</th>
                  <th className="p-2.5 font-medium">Approval</th>
                  <th className="p-2.5 font-medium">Action Event</th>
                  <th className="p-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {config.steps.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-mono text-[11px] font-bold text-gold">#{s.sequence}</td>
                    <td className="p-2.5 font-medium text-foreground">{s.name}</td>
                    <td className="p-2.5 capitalize text-muted-foreground">{s.roleRequired}</td>
                    <td className="p-2.5">
                      {s.approvalRequired ? <Badge variant="outline" className="text-red-500 border-red-500/30 text-[10px]">Required</Badge> : <span className="text-muted-foreground">Direct</span>}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{s.actionEvent}</td>
                    <td className="p-2.5">
                      <Switch
                        checked={s.active}
                        onCheckedChange={(v) => toggleStep(s.id, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 5. FIELDS TAB ────────────────────────────────────────────────────── */}
      {activeTab === "fields" && (
        <Card className="p-5 space-y-4 bg-card/60">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Field Visibility & Requirement Matrix
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control mandatory vs optional validation across transaction vouchers and manufacturing forms.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {config.fields.map((f) => (
              <div key={f.fieldKey} className="p-3 rounded-lg border bg-background/50 flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground">{f.label}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{f.fieldKey}</span>
                    <span>·</span>
                    <span className="capitalize">{f.moduleScope}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={f.requirement}
                    onValueChange={(v: any) => updateFieldConfig(f.fieldKey, { requirement: v })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mandatory">Mandatory</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                      <SelectItem value="read_only">Read Only</SelectItem>
                      <SelectItem value="calculated">Calculated</SelectItem>
                    </SelectContent>
                  </Select>

                  <Switch
                    checked={f.visibility === "visible"}
                    onCheckedChange={(v) => updateFieldConfig(f.fieldKey, { visibility: v ? "visible" : "hidden" })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ADD PROCESS DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={showAddProcessDialog} onOpenChange={setShowAddProcessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Hammer className="w-4 h-4 text-gold" /> Add Workshop Process
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a new manufacturing bench process or outside delegation flow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProcess} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Process Name</Label>
              <Input
                placeholder="e.g. Rhodium Plating / Laser Engraving"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Process Type Code</Label>
              <Input
                placeholder="e.g. laser_engraving"
                value={newProcessType}
                onChange={(e) => setNewProcessType(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Workflow Scope</Label>
                <Select value={newProcessScope} onValueChange={(v: any) => setNewProcessScope(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Standard Labour Rate (Paise/g)</Label>
                <Input
                  type="number"
                  value={newProcessLabourRate}
                  onChange={(e) => setNewProcessLabourRate(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Process Rule & Loss Policy</Label>
              <Input
                placeholder="e.g. Enforce dust recovery before return"
                value={newProcessRule}
                onChange={(e) => setNewProcessRule(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-md border bg-muted/20">
              <span className="font-medium text-xs">Require Manager Approval</span>
              <Switch checked={newProcessApproval} onCheckedChange={setNewProcessApproval} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddProcessDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-gold text-black hover:bg-gold/90 font-semibold">
                Save Process
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ADD BOOK DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={showAddBookDialog} onOpenChange={setShowAddBookDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-gold" /> Add Physical Metal Book
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define a purity-wise physical ledger for workshop custody tracking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBook} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Book Name</Label>
              <Input
                placeholder="e.g. 14K / 585 Export Karigar Book"
                value={newBookName}
                onChange={(e) => setNewBookName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Purity Grade (‰)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 916, 750, 585"
                  value={newBookPurity}
                  onChange={(e) => setNewBookPurity(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Weight Unit</Label>
                <Select value={newBookUnit} onValueChange={(v: any) => setNewBookUnit(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mg">Milligrams (mg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Workflow Scope</Label>
                <Select value={newBookScope} onValueChange={(v: any) => setNewBookScope(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ledger Destination</Label>
                <Select value={newBookLedgerMapping} onValueChange={setNewBookLedgerMapping}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="karigar">Karigar Custody</SelectItem>
                    <SelectItem value="vault">Vault / Safe</SelectItem>
                    <SelectItem value="scrap">Scrap & Dust</SelectItem>
                    <SelectItem value="finished">Finished Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBookDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-gold text-black hover:bg-gold/90 font-semibold">
                Save Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ADD STEP DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={showAddStepDialog} onOpenChange={setShowAddStepDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-gold" /> Add Workflow Step
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define a sequential stage in the manufacturing bench workflow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStep} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Step Name</Label>
              <Input
                placeholder="e.g. Ultrasonic Cleaning & Final Polish"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sequence Number</Label>
                <Input
                  type="number"
                  value={newStepSeq}
                  onChange={(e) => setNewStepSeq(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Required Role</Label>
                <Select value={newStepRole} onValueChange={setNewStepRole}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="worker">Artisan / Worker</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-md border bg-muted/20">
              <span className="font-medium text-xs">Requires Approval Before Completion</span>
              <Switch checked={newStepApproval} onCheckedChange={setNewStepApproval} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddStepDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-gold text-black hover:bg-gold/90 font-semibold">
                Save Step
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

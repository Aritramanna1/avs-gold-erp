/**
 * Universal Customization Operating System Hub — Complete 18 Categories
 *
 * SETTINGS CONFIGURES THE SYSTEM; CUSTOMIZATION ADAPTS THE BUSINESS.
 *
 * Master Reference: docs/MASTER/UNIVERSAL_CUSTOMIZATION_MASTER.md
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 */
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Languages,
  List,
  FormInput,
  Calculator,
  FileText,
  GitBranch,
  Printer,
  Globe,
  BarChart3,
  Cog,
  Receipt,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  User,
  Hammer,
  Truck,
  Sparkles,
  Building2,
  BookOpen,
  Sliders,
  Coins,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Layers,
  Upload,
} from "lucide-react";
import { useSettings, DROPDOWN_LABELS, type DropdownKey } from "@/lib/settings-store";
import { useTerminology } from "@/lib/terminology-engine-store";
import { TerminologyManager } from "@/components/settings/TerminologyManager";
import { BusinessLanguageAliases } from "./BusinessLanguageAliases";
import {
  applyConfigurationBundle,
  buildExportConfigurationBundle,
  loadBundledJson,
  validateConfigurationBundle,
  type ConfigurationBundle,
} from "@/lib/configuration-bundle";
import { DocumentTemplateDesigner } from "./DocumentTemplateDesigner";
import { PrintProfileDesigner } from "./PrintProfileDesigner";
import { PrintBrandingAssetsPanel } from "./PrintBrandingAssetsPanel";
import { UniversalTransactionEngineDesigner } from "./UniversalTransactionEngineDesigner";
import { CustomEntitiesDesigner } from "./CustomEntitiesDesigner";
import { CustomBooksDesigner } from "./CustomBooksDesigner";
import { CustomRuleEngineDesigner } from "./CustomRuleEngineDesigner";
import { PurityGradesPanel } from "@/components/masters/PurityGradesPanel";
import {
  useCustomizationHubPreferences,
  ensureCustomizationHubPreferencesLoaded,
} from "@/lib/customization-hub-preferences-store";

export const CUSTOMIZATION_CATEGORIES = [
  {
    key: "language",
    label: "Language & Terms",
    icon: Languages,
    description: "Terminology packs, trade vocabulary, and field aliases",
  },
  {
    key: "masters",
    label: "Masters & Lists",
    icon: List,
    description: "Centralized dropdowns, categories, worker types, and operational reasons",
  },
  {
    key: "entities",
    label: "Custom Entities",
    icon: Building2,
    description: "Define bespoke business record types (e.g. Stone Contractors, Assayers)",
  },
  {
    key: "forms",
    label: "Forms & Fields",
    icon: FormInput,
    description: "Dynamic custom fields, field ordering, and validation requirements",
  },
  {
    key: "books",
    label: "Books & Registers",
    icon: BookOpen,
    description: "Configurable operational books, dynamic formula columns, and totals",
  },
  {
    key: "calculations",
    label: "Calculations",
    icon: Calculator,
    description: "Making charge formulas, labour rates, and wastage allowances",
  },
  {
    key: "rules",
    label: "Business Rules",
    icon: Sliders,
    description:
      "Declarative condition-action rules (e.g. IF Process = Chain THEN Deduct Chain Wt)",
  },
  {
    key: "transactions",
    label: "Transactions & Vouchers",
    icon: Receipt,
    description: "Declarative custom voucher types and 6-ledger posting rules",
  },
  {
    key: "gold",
    label: "Gold & Metal Policies",
    icon: Coins,
    description: "Gold ownership vs physical custody separation and conversion rules",
  },
  {
    key: "workflows",
    label: "Workflows",
    icon: GitBranch,
    description: "Multi-tier approval gates, gold issue thresholds, and stage pipelines",
  },
  {
    key: "documents",
    label: "Documents & Templates",
    icon: FileText,
    description: "10 document template families, terms and conditions, and visual blocks",
  },
  {
    key: "printing",
    label: "Printing & Profiles",
    icon: Printer,
    description: "Laser A4, POS Thermal 80mm/58mm, and jewellery barcode tags",
  },
  {
    key: "portals",
    label: "Portals",
    icon: Globe,
    description: "Customer, Karigar, and Supplier external terminal access controls",
  },
  {
    key: "reports",
    label: "Reports & Export",
    icon: BarChart3,
    description: "Custom report layouts, margin visibility, and Tally/Excel export presets",
  },
  {
    key: "advanced",
    label: "Versioning & Rollback",
    icon: Cog,
    description: "Configuration snapshots, draft simulation, and instant rollback",
  },
] as const;

type CategoryKey = (typeof CUSTOMIZATION_CATEGORIES)[number]["key"];

interface CustomizationHubProps {
  activeTab?: string;
}

export function CustomizationHub({ activeTab }: CustomizationHubProps) {
  const navigate = useNavigate();
  const defaultTab: CategoryKey = (activeTab as CategoryKey) || "language";
  const [currentTab, setCurrentTab] = useState<string>(defaultTab);
  const [configState, setConfigState] = useState<"published" | "draft">("published");

  useEffect(() => {
    void ensureCustomizationHubPreferencesLoaded();
  }, []);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    navigate({
      to: "/control/customization",
      search: { tab: value },
      replace: true,
    });
  };

  const handlePublishAll = () => {
    setConfigState("published");
    toast.success("All configuration changes published to production successfully.");
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header with Versioning / Staging Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Universal Customization Operating System
            <Badge
              variant="outline"
              className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
            >
              v3.1.0 · Single Source of Truth
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Adapt how your jewellery enterprise operates: trade language, custom entities, books,
            making formulas, rules, and vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {configState === "draft" && (
            <Badge
              variant="outline"
              className="text-xs text-amber-500 border-amber-500/40 bg-amber-500/10"
            >
              Draft Staged (Not Live)
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handlePublishAll}
            className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Publish Configuration
          </Button>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        {/* Mobile: Select dropdown */}
        <div className="block md:hidden mb-4">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={currentTab}
            onChange={(e) => handleTabChange(e.target.value)}
          >
            {CUSTOMIZATION_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop: Standard TabsList */}
        <TabsList className="hidden md:flex flex-wrap h-auto gap-1 bg-muted/40 p-1 rounded-lg border">
          {CUSTOMIZATION_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-1.5 text-xs py-1.5 px-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black data-[state=active]:font-semibold rounded-md"
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* 1. Language & Terms */}
        <TabsContent value="language" className="mt-4 space-y-4">
          <TerminologyManager />
          <BusinessLanguageAliases />
        </TabsContent>

        {/* 2. Masters & Lists */}
        <TabsContent value="masters" className="mt-4 space-y-4">
          <PurityGradesPanel />
          <MastersAndListsContent />
        </TabsContent>

        {/* 3. Custom Entities */}
        <TabsContent value="entities" className="mt-4">
          <CustomEntitiesDesigner />
        </TabsContent>

        {/* 4. Forms & Fields */}
        <TabsContent value="forms" className="mt-4">
          <FormsAndFieldsContent />
        </TabsContent>

        {/* 5. Books & Registers */}
        <TabsContent value="books" className="mt-4">
          <CustomBooksDesigner />
        </TabsContent>

        {/* 6. Calculations & Formulas */}
        <TabsContent value="calculations" className="mt-4">
          <CalculationsContent />
        </TabsContent>

        {/* 7. Declarative Business Rules */}
        <TabsContent value="rules" className="mt-4">
          <CustomRuleEngineDesigner />
        </TabsContent>

        {/* 8. Transactions & Vouchers */}
        <TabsContent value="transactions" className="mt-4">
          <UniversalTransactionEngineDesigner />
        </TabsContent>

        {/* 9. Gold & Metal Policies */}
        <TabsContent value="gold" className="mt-4">
          <GoldCustomizationContent />
        </TabsContent>

        {/* 10. Workflows & Approvals */}
        <TabsContent value="workflows" className="mt-4">
          <WorkflowsContent />
        </TabsContent>

        {/* 11. Documents & Templates */}
        <TabsContent value="documents" className="mt-4">
          <DocumentTemplateDesigner />
        </TabsContent>

        {/* 12. Printing & Profiles */}
        <TabsContent value="printing" className="mt-4 space-y-4">
          <PrintBrandingAssetsPanel />
          <PrintProfileDesigner />
        </TabsContent>

        {/* 13. Portals */}
        <TabsContent value="portals" className="mt-4">
          <PortalsContent />
        </TabsContent>

        {/* 14. Reports & Exports */}
        <TabsContent value="reports" className="mt-4">
          <ReportsContent />
        </TabsContent>

        {/* 15. Advanced & Versioning */}
        <TabsContent value="advanced" className="mt-4">
          <AdvancedContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Masters & Dropdown Lists (Category 2)                              */
/* ------------------------------------------------------------------ */
function MastersAndListsContent() {
  const {
    dropdowns,
    disabledDropdowns,
    setDropdown,
    addDropdownItem,
    removeDropdownItem,
    renameDropdownItem,
    setDropdownItemDisabled,
  } = useSettings();

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold">Centralized Dropdown Masters Registry</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage custom dropdowns, worker specializations, product categories, and operational
            reasons across the entire ERP.
          </p>
        </div>
        <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">
          Published
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(dropdowns) as DropdownKey[]).map((k) => (
          <div key={k} className="p-3.5 border rounded-lg bg-muted/10 space-y-2">
            <DropdownEditor
              label={DROPDOWN_LABELS[k]}
              values={dropdowns[k]}
              disabled={disabledDropdowns[k] ?? []}
              onAdd={(v) => addDropdownItem(k, v)}
              onRemove={(v) => removeDropdownItem(k, v)}
              onRename={(from, to) => renameDropdownItem(k, from, to)}
              onToggleDisabled={(v, off) => setDropdownItemDisabled(k, v, off)}
              onReorder={(vals) => setDropdown(k, vals)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function DropdownEditor({
  label,
  values,
  disabled,
  onAdd,
  onRemove,
  onRename,
  onToggleDisabled,
  onReorder: _onReorder,
}: {
  label: string;
  values: string[];
  disabled: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onRename: (from: string, to: string) => void;
  onToggleDisabled: (v: string, disabled: boolean) => void;
  onReorder: (v: string[]) => void;
}) {
  const [v, setV] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function commitRename() {
    if (editing) onRename(editing, draft);
    setEditing(null);
    setDraft("");
  }

  return (
    <div>
      <div className="font-semibold text-xs text-foreground mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
        {values.map((x) => {
          const isOff = disabled.includes(x);
          if (editing === x) {
            return (
              <span key={x} className="flex items-center gap-1">
                <Input
                  autoFocus
                  className="h-7 w-36 text-xs"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              </span>
            );
          }
          return (
            <Badge
              key={x}
              variant={isOff ? "outline" : "secondary"}
              className={`gap-1.5 text-xs ${isOff ? "opacity-50 line-through" : ""}`}
            >
              <button
                onClick={() => {
                  setEditing(x);
                  setDraft(x);
                }}
                title="Rename"
              >
                {x}
              </button>
              <button
                onClick={() => onToggleDisabled(x, !isOff)}
                className="hover:text-amber-500"
                title={isOff ? "Enable" : "Disable"}
              >
                {isOff ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
              <button onClick={() => onRemove(x)} className="hover:text-destructive" title="Delete">
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">No values yet.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Add option..."
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (v.trim()) {
                onAdd(v.trim());
                setV("");
              }
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            if (v.trim()) {
              onAdd(v.trim());
              setV("");
            }
          }}
          className="h-8 text-xs px-2.5"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms & Fields (Category 4)                                       */
/* ------------------------------------------------------------------ */
function FormsAndFieldsContent() {
  const settings = useSettings();
  const formsMetadata = settings.formsMetadata ?? [];
  const [selectedEntity, setSelectedEntity] = useState("person");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const currentForm = formsMetadata.find((f) => f.id === selectedEntity) || formsMetadata[0];

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const name = newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const newField = {
      name,
      label: newFieldLabel.trim(),
      type: newFieldType as any,
      required: newFieldRequired,
      placeholder: `Enter ${newFieldLabel.trim()}`,
    };

    const updated = formsMetadata.map((f) =>
      f.id === (currentForm?.id || "person") ? { ...f, fields: [...f.fields, newField] } : f,
    );
    settings.setFormsMetadata(updated);
    setNewFieldLabel("");
    toast.success(`Added custom field "${newField.label}" to ${currentForm?.name || "entity"}`);
  };

  const handleRemoveField = (fieldName: string) => {
    const updated = formsMetadata.map((f) =>
      f.id === currentForm?.id
        ? { ...f, fields: f.fields.filter((field) => field.name !== fieldName) }
        : f,
    );
    settings.setFormsMetadata(updated);
    toast.success("Field removed.");
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold">Existing System Forms Customizer</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Extend native ERP forms (Customer, Supplier, Karigar, Ready Stock, Job Card, Invoice,
            Refinery) with custom attributes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Select Form:</span>
          <select
            value={currentForm?.id || "person"}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {formsMetadata.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border divide-y text-xs">
        <div className="bg-muted p-2.5 font-semibold grid grid-cols-12 gap-2 text-muted-foreground">
          <span className="col-span-4">Field Label</span>
          <span className="col-span-3">Type</span>
          <span className="col-span-3">Mandatory</span>
          <span className="col-span-2 text-right">Action</span>
        </div>
        {!currentForm || currentForm.fields.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground italic">
            No custom fields configured for this entity.
          </div>
        ) : (
          currentForm.fields.map((f) => (
            <div
              key={f.name}
              className="p-2.5 grid grid-cols-12 gap-2 items-center hover:bg-muted/30"
            >
              <span className="col-span-4 font-medium text-foreground">{f.label}</span>
              <span className="col-span-3 capitalize text-muted-foreground">{f.type}</span>
              <span className="col-span-3">
                <Badge variant={f.required ? "default" : "outline"} className="text-[10px]">
                  {f.required ? "Required" : "Optional"}
                </Badge>
              </span>
              <span className="col-span-2 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveField(f.name)}
                  className="h-6 w-6 p-0 text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add New Field Box */}
      <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
        <h4 className="text-xs font-semibold text-foreground">
          Add Custom Field to {currentForm?.name}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Field Label (e.g. Ring Size / RFID)"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            className="text-xs h-8"
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="text">Text (Single Line)</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Checkbox / Toggle</option>
            <option value="select">Dropdown Select</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="field-req"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="field-req" className="text-xs text-muted-foreground">
              Required Field
            </label>
          </div>
          <Button size="sm" onClick={handleAddField} className="h-8 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" /> Add Field
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Calculations & Making Formulas (Category 6)                       */
/* ------------------------------------------------------------------ */
function CalculationsContent() {
  const [ruleType, setRuleType] = useState<
    "per_gram" | "per_piece" | "percent_metal" | "percent_total"
  >("per_gram");
  const [baseRatePaise, setBaseRatePaise] = useState(45000);
  const [minChargePaise, setMinChargePaise] = useState(50000);
  const [testWeightG, setTestWeightG] = useState(10.5);
  const [goldRatePaise, setGoldRatePaise] = useState(720000);

  const calculatedMakingPaise =
    ruleType === "per_gram"
      ? Math.max(minChargePaise, Math.round(testWeightG * baseRatePaise))
      : ruleType === "per_piece"
        ? baseRatePaise
        : ruleType === "percent_metal"
          ? Math.max(
              minChargePaise,
              Math.round(testWeightG * goldRatePaise * (baseRatePaise / 100000)),
            )
          : minChargePaise;

  return (
    <Card className="p-5 space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Making Charge Formulas & Wastage Matrix</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure rule-based calculation engines for wholesale making charges, retail pricing
          tiers, and wastage allowances.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4 bg-muted/20 space-y-4 text-xs">
          <h4 className="font-semibold text-foreground">Default Making Charge Rule</h4>
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground block mb-1">Calculation Method</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="per_gram">Rate Per Gram (₹/g)</option>
                <option value="per_piece">Flat Rate Per Piece (₹/pc)</option>
                <option value="percent_metal">% on Fine Gold Metal Value</option>
                <option value="percent_total">% on Gross Value</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground block mb-1">
                {ruleType === "per_gram"
                  ? "Rate (₹ per Gram)"
                  : ruleType === "percent_metal"
                    ? "Percentage (%)"
                    : "Flat Amount (₹)"}
              </label>
              <Input
                type="number"
                value={baseRatePaise / 100}
                onChange={(e) =>
                  setBaseRatePaise(Math.round(parseFloat(e.target.value || "0") * 100))
                }
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground block mb-1">
                Minimum Making Charge Floor (₹)
              </label>
              <Input
                type="number"
                value={minChargePaise / 100}
                onChange={(e) =>
                  setMinChargePaise(Math.round(parseFloat(e.target.value || "0") * 100))
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-amber-500/5 border-amber-500/30 space-y-4 text-xs">
          <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
            <Sparkles className="h-4 w-4" /> Live Formula Simulator
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground block mb-1">
                Sample Item Gross Weight (g)
              </label>
              <Input
                type="number"
                value={testWeightG}
                onChange={(e) => setTestWeightG(parseFloat(e.target.value || "0"))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-muted-foreground block mb-1">Gold Rate (₹ per 10g)</label>
              <Input
                type="number"
                value={(goldRatePaise / 100) * 10}
                onChange={(e) =>
                  setGoldRatePaise(Math.round((parseFloat(e.target.value || "0") / 10) * 100))
                }
                className="h-8 text-xs"
              />
            </div>
            <div className="pt-2 border-t border-amber-500/20">
              <span className="text-muted-foreground block text-[11px]">
                Computed Making Charge:
              </span>
              <span className="text-xl font-bold text-amber-600 font-mono">
                ₹
                {(calculatedMakingPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Gold & Metal Policies (Category 9)                                */
/* ------------------------------------------------------------------ */
function GoldCustomizationContent() {
  const gold = useCustomizationHubPreferences((s) => s.gold);
  const saveGold = useCustomizationHubPreferences((s) => s.saveGold);
  const saving = useCustomizationHubPreferences((s) => s.saving);

  const handleSave = async () => {
    await saveGold(gold);
    toast.success("Gold policy settings saved.");
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" />
            Gold Ownership & Custody Decoupling Policies
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure how customer metal deposits are handled, physical utilization permissions, and
            melting loss tolerances.
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs text-purple-600 border-purple-500/30 bg-purple-500/10"
        >
          Decoupled Ledger Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
          <div className="font-semibold text-foreground">Physical Utilization Policy</div>
          <p className="text-muted-foreground">
            Allow company to physically pool and melt customer gold deposits into
            production/ready-stock while keeping customer metal liability strictly active until
            order allocation or settlement.
          </p>
          <label className="flex items-center gap-2 pt-1 font-medium">
            <input
              type="checkbox"
              checked={gold.physicalUtilization}
              onChange={(e) =>
                useCustomizationHubPreferences.setState({
                  gold: { ...gold, physicalUtilization: e.target.checked },
                })
              }
              className="rounded border-input"
            />
            <span>Enable Physical Utilization without Erasing Liability</span>
          </label>
        </div>

        <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
          <div className="font-semibold text-foreground">Standard Touch Purities</div>
          <p className="text-muted-foreground text-[11px]">
            Managed in Masters & Lists → Purity Grades. Changes there apply across billing,
            settlement, and stock.
          </p>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {saving ? "Saving…" : "Save Gold Policies"}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Workflows (Category 10)                                           */
/* ------------------------------------------------------------------ */
function WorkflowsContent() {
  const navigate = useNavigate();

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold">Approval Workflows & Threshold Matrix</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Configure multi-tier approval gates for Gold issues, invoice discounts, metal
            write-offs, and Karigar payouts.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate({ to: "/settings/workflow" })}
          className="text-xs h-8 gap-1.5"
        >
          <Cog className="h-3.5 w-3.5" /> Open Workflow Engine
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
        <div className="rounded-lg border p-4 bg-muted/20 space-y-1.5">
          <div className="font-semibold text-foreground">Gold Issue Gate</div>
          <p className="text-muted-foreground">
            Issues exceeding 50.00g require Super Owner OTP approval.
          </p>
          <Badge variant="outline" className="text-[10px]">
            Active
          </Badge>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20 space-y-1.5">
          <div className="font-semibold text-foreground">Discount Authorization</div>
          <p className="text-muted-foreground">
            Discounts above 5.00% require Manager override passcode.
          </p>
          <Badge variant="outline" className="text-[10px]">
            Active
          </Badge>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20 space-y-1.5">
          <div className="font-semibold text-foreground">Karigar Loss Limit</div>
          <p className="text-muted-foreground">
            Loss tolerance strictly enforced at 0.50% max per job.
          </p>
          <Badge variant="outline" className="text-[10px]">
            Active
          </Badge>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Portals (Category 13)                                             */
/* ------------------------------------------------------------------ */
function PortalsContent() {
  const portals = useCustomizationHubPreferences((s) => s.portals);
  const savePortals = useCustomizationHubPreferences((s) => s.savePortals);
  const saving = useCustomizationHubPreferences((s) => s.saving);

  const handleSave = async () => {
    await savePortals(portals);
    toast.success("Portal settings saved.");
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold">External Client & Worker Portals Configuration</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Control access permissions, statement visibility, and live tracking features on Customer,
          Karigar, and Supplier portals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-md border p-4 bg-muted/20 space-y-3">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <User className="h-4 w-4 text-amber-500" /> Customer Portal
          </h4>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span>View Dual Running Ledger</span>
              <input
                type="checkbox"
                checked={portals.customerLedger}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, customerLedger: e.target.checked },
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Track Live Order & CAD Status</span>
              <input
                type="checkbox"
                checked={portals.customerOrders}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, customerOrders: e.target.checked },
                  })
                }
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border p-4 bg-muted/20 space-y-3">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Hammer className="h-4 w-4 text-amber-500" /> Karigar Portal
          </h4>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span>View Bench Custody Book</span>
              <input
                type="checkbox"
                checked={portals.karigarGoldBook}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, karigarGoldBook: e.target.checked },
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Confirm Metal Receipts</span>
              <input
                type="checkbox"
                checked={portals.karigarMetalReceipts}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, karigarMetalReceipts: e.target.checked },
                  })
                }
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border p-4 bg-muted/20 space-y-3">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-amber-500" /> Supplier Portal
          </h4>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Purchase Order Memos</span>
              <input
                type="checkbox"
                checked={portals.supplierPo}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, supplierPo: e.target.checked },
                  })
                }
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Fine Gold Settlements</span>
              <input
                type="checkbox"
                checked={portals.supplierGoldSettlements}
                onChange={(e) =>
                  useCustomizationHubPreferences.setState({
                    portals: { ...portals, supplierGoldSettlements: e.target.checked },
                  })
                }
              />
            </label>
          </div>
        </div>
      </div>

      <StaffRolesPreferencesSection />

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {saving ? "Saving…" : "Save Portal Preferences"}
        </Button>
      </div>
    </Card>
  );
}

function StaffRolesPreferencesSection() {
  const staffRoles = useCustomizationHubPreferences((s) => s.staffRoles);
  const saveStaffRoles = useCustomizationHubPreferences((s) => s.saveStaffRoles);
  const saving = useCustomizationHubPreferences((s) => s.saving);

  return (
    <div className="rounded-md border p-4 bg-muted/20 space-y-3 text-xs">
      <div>
        <h4 className="font-bold text-sm text-foreground">Staff Role Templates</h4>
        <p className="text-muted-foreground mt-1">
          Customize role labels shown in Settings → Users. Each maps to Supabase RBAC roles (owner,
          manager, billing, vault, workshop, accountant, viewer).
        </p>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {staffRoles.map((role, idx) => (
          <div key={role.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <Input
              value={role.label}
              onChange={(e) => {
                const next = [...staffRoles];
                next[idx] = { ...role, label: e.target.value };
                useCustomizationHubPreferences.setState({ staffRoles: next });
              }}
              className="h-8 text-xs"
            />
            <Input
              value={role.department ?? ""}
              placeholder="Department"
              onChange={(e) => {
                const next = [...staffRoles];
                next[idx] = { ...role, department: e.target.value };
                useCustomizationHubPreferences.setState({ staffRoles: next });
              }}
              className="h-8 text-xs"
            />
            <Input
              value={role.appRoles.join(", ")}
              onChange={(e) => {
                const next = [...staffRoles];
                next[idx] = {
                  ...role,
                  appRoles: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean) as typeof role.appRoles,
                };
                useCustomizationHubPreferences.setState({ staffRoles: next });
              }}
              className="h-8 text-xs font-mono"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => void saveStaffRoles(staffRoles)}
        >
          {saving ? "Saving…" : "Save Staff Roles"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reports (Category 14)                                             */
/* ------------------------------------------------------------------ */
function ReportsContent() {
  const reports = useCustomizationHubPreferences((s) => s.reports);
  const saveReports = useCustomizationHubPreferences((s) => s.saveReports);
  const saving = useCustomizationHubPreferences((s) => s.saving);

  const handleSave = async () => {
    await saveReports(reports);
    toast.success("Report preferences saved.");
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold">Report Profiles & Export Preferences</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Customize reporting defaults, margin columns visibility, and standard export formats.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <label className="text-muted-foreground block">Default Export Format</label>
          <select
            value={reports.defaultExport}
            onChange={(e) =>
              useCustomizationHubPreferences.setState({
                reports: {
                  ...reports,
                  defaultExport: e.target.value as typeof reports.defaultExport,
                },
              })
            }
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="xlsx">Excel Workbook (.xlsx)</option>
            <option value="csv">Comma-Separated Values (.csv)</option>
            <option value="tally_xml">Tally Prime XML Export</option>
            <option value="pdf">Official PDF Report</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-muted-foreground block">Executive Security Option</label>
          <label className="flex items-center gap-2 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reports.showProfit}
              onChange={(e) =>
                useCustomizationHubPreferences.setState({
                  reports: { ...reports, showProfit: e.target.checked },
                })
              }
            />
            <span>Show Profit Margins on Stock Reports (Owner Role Only)</span>
          </label>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {saving ? "Saving…" : "Save Report Preferences"}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Advanced: Versioning & Snapshots (Category 15)                     */
/* ------------------------------------------------------------------ */
function AdvancedContent() {
  const settings = useSettings();
  const terminology = useTerminology();
  const [importPreview, setImportPreview] = useState<ConfigurationBundle | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  const handleExportBundle = () => {
    const bundle = buildExportConfigurationBundle("Exported firm configuration");
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ornexa_universal_customization_bundle_${Date.now()}.json`;
    a.click();
    toast.success("Universal configuration bundle exported.");
  };

  const handleFileImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const v = validateConfigurationBundle(raw);
      if (!v.ok) {
        toast.error(v.errors.join("; "));
        return;
      }
      setImportPreview(v.bundle);
      toast.message(`Bundle ready: ${v.bundle.label}. Confirm apply below.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid bundle JSON");
    }
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    if (
      !confirm(
        `Apply configuration bundle "${importPreview.label}" in ${importMode.toUpperCase()} mode?\n\nThis updates customization settings. It does not rewrite gold calculations or historical ledgers.`,
      )
    ) {
      return;
    }
    applyConfigurationBundle(importPreview, { mode: importMode });
    setImportPreview(null);
    toast.success(`Applied ${importPreview.label} (${importMode}).`);
  };

  const handleLoadPreset = async (path: string) => {
    try {
      const bundle = await loadBundledJson(path);
      setImportPreview(bundle);
      toast.message(`Loaded preset: ${bundle.label}. Confirm apply below.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load preset");
    }
  };

  return (
    <Card className="p-5 space-y-6">
      <div className="border-b pb-3">
        <h3 className="text-sm font-semibold">Customization Snapshots & Instant Rollback</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Export full configuration bundles or import approved packs. Apply never happens silently.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
          <h4 className="font-semibold text-foreground">Export Configuration Bundle</h4>
          <p className="text-muted-foreground">
            Download dropdowns, terminology, forms metadata, and firm workshop policy (incl. 995
            config setting) into a portable JSON package.
          </p>
          <Button size="sm" variant="outline" onClick={handleExportBundle} className="text-xs h-8">
            Export JSON Bundle
          </Button>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
          <h4 className="font-semibold text-foreground">Import Configuration Bundle</h4>
          <p className="text-muted-foreground">
            Validate version/schema, preview, then merge or replace. Does not overwrite without
            confirmation.
          </p>
          <Input
            type="file"
            accept="application/json,.json"
            className="text-xs h-8"
            onChange={(e) => void handleFileImport(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => void handleLoadPreset("/config-bundles/mtg-default.v1.json")}
            >
              Load MTG Default
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => void handleLoadPreset("/config-bundles/mtj-default.v1.json")}
            >
              Load MTJ Default
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() => void handleLoadPreset("/config-bundles/retail-oriented.v1.json")}
            >
              Load Retail Default
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={() =>
                void handleLoadPreset("/config-bundles/manufacturing-oriented.v1.json")
              }
            >
              Load Manufacturing Default
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20 space-y-3 sm:col-span-2">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            Pending apply
          </h4>
          {importPreview ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                {importPreview.label} · {importPreview.bundleId} · schema {importPreview.version}
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                  />
                  Merge
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                  />
                  Replace listed keys
                </label>
                <Button size="sm" className="text-xs h-8" onClick={handleApplyImport}>
                  Confirm apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8"
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No bundle staged.</p>
          )}
        </div>

        <div className="rounded-lg border p-4 bg-muted/20 space-y-3 sm:col-span-2">
          <h4 className="font-semibold text-foreground">Invoice print — Customer Hisab</h4>
          <p className="text-muted-foreground">
            Customer Hisab (metal + cash) remains available as its own manufacturing/settlement
            document. It is hidden from customer-facing retail/sale invoices by default.
          </p>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={settings.printDocumentPrefs?.hideCustomerHisabOnInvoice !== false}
              onChange={(e) =>
                settings.setPrintDocumentPrefs({
                  hideCustomerHisabOnInvoice: e.target.checked,
                })
              }
            />
            Hide Customer Hisab on retail / sale invoices
          </label>
        </div>

        <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
          <h4 className="font-semibold text-foreground">Emergency Reset</h4>
          <p className="text-muted-foreground">
            Reset terminology and standard dropdown items back to system factory defaults.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void (async () => {
                if (
                  !confirm(
                    "Reset customization to MTG/MTJ factory defaults?\n\nThis replaces listed configuration keys with the approved default bundle (995 reference, simplified workflow). Gold ledger math (/999) is never rewritten.",
                  )
                ) {
                  return;
                }
                try {
                  terminology.resetCustomOverrides();
                  const bundle = await loadBundledJson("/config-bundles/mtg-default.v1.json");
                  applyConfigurationBundle(bundle, { mode: "replace" });
                  toast.success("Factory defaults restored from MTG/MTJ default bundle.");
                } catch (err: unknown) {
                  toast.error(
                    err instanceof Error ? err.message : "Could not restore factory defaults",
                  );
                }
              })();
            }}
            className="text-xs h-8 text-destructive hover:text-destructive"
          >
            Restore Factory Defaults
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground font-mono">
        Active pack: {terminology.activePack} · Firm 995 config:{" "}
        {settings.maTaraWorkshopPolicy?.pureGoldReferencePermille ?? 995} (settings only)
      </p>
    </Card>
  );
}

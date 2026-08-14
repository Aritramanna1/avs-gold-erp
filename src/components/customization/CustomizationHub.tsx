/**
 * Customization Workspace Hub — 11 Business Adaptation Categories
 *
 * SETTINGS CONFIGURES THE SYSTEM; CUSTOMIZATION ADAPTS THE BUSINESS.
 *
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useSettings, DROPDOWN_LABELS, type DropdownKey } from "@/lib/settings-store";
import { TerminologyManager } from "@/components/settings/TerminologyManager";

const CUSTOMIZATION_CATEGORIES = [
  {
    key: "language",
    label: "Business Language",
    icon: Languages,
    description: "Terminology packs, trade vocabulary, and field aliases",
  },
  {
    key: "masters",
    label: "Masters & Lists",
    icon: List,
    description: "Custom dropdowns, categories, worker types, and operational reasons",
  },
  {
    key: "forms",
    label: "Forms & Fields",
    icon: FormInput,
    description: "Dynamic custom fields, field ordering, and validation requirements",
  },
  {
    key: "calculations",
    label: "Calculations",
    icon: Calculator,
    description: "Making charge rules, labour formulas, and wastage loss allowances",
  },
  {
    key: "transactions",
    label: "Transactions",
    icon: Receipt,
    description: "Custom voucher types and multi-ledger posting rules",
  },
  {
    key: "workflows",
    label: "Workflows",
    icon: GitBranch,
    description: "Manufacturing stages, outside Mina/Polish challans, and QC flows",
  },
  {
    key: "documents",
    label: "Documents",
    icon: FileText,
    description: "10 template families, terms and conditions, and header blocks",
  },
  {
    key: "printing",
    label: "Printing",
    icon: Printer,
    description: "Print profiles for Laser A4, POS Thermal 80mm/58mm, and label tags",
  },
  {
    key: "portals",
    label: "Portals",
    icon: Globe,
    description: "Customer, Karigar, and Supplier portal layout and field controls",
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    description: "Custom report definitions, column layouts, and saved filters",
  },
  {
    key: "advanced",
    label: "Advanced",
    icon: Cog,
    description: "Configuration versions, draft simulations, and instant rollback",
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

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    navigate({
      to: "/control/customization",
      search: { tab: value },
      replace: true,
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Customization Workspace"
        subtitle="Adapt how your jewellery business operates: terminology, dropdowns, forms, making rules, workflows, templates, and portals."
      />

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

        {/* Desktop: TabsList */}
        <TabsList className="hidden md:flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {CUSTOMIZATION_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-1.5 text-xs data-[state=active]:bg-background"
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Category 1: Business Language */}
        <TabsContent value="language">
          <TerminologyManager />
        </TabsContent>

        {/* Category 2: Masters & Lists */}
        <TabsContent value="masters">
          <MastersAndListsContent />
        </TabsContent>

        {/* Category 3: Forms & Fields */}
        <TabsContent value="forms">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[2]} status="Active" />
        </TabsContent>

        {/* Category 4: Calculations */}
        <TabsContent value="calculations">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[3]} status="Active" />
        </TabsContent>

        {/* Category 5: Transactions */}
        <TabsContent value="transactions">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[4]} status="Active" />
        </TabsContent>

        {/* Category 6: Workflows */}
        <TabsContent value="workflows">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[5]} status="Active" />
        </TabsContent>

        {/* Category 7: Documents */}
        <TabsContent value="documents">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[6]} status="Active" />
        </TabsContent>

        {/* Category 8: Printing */}
        <TabsContent value="printing">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[7]} status="Active" />
        </TabsContent>

        {/* Category 9: Portals */}
        <TabsContent value="portals">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[8]} status="Active" />
        </TabsContent>

        {/* Category 10: Reports */}
        <TabsContent value="reports">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[9]} status="Active" />
        </TabsContent>

        {/* Category 11: Advanced */}
        <TabsContent value="advanced">
          <CategoryPlaceholder category={CUSTOMIZATION_CATEGORIES[10]} status="Active" />
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
    <Card className="p-5 mt-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Masters & Dropdown Lists</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage custom dropdowns, categories, worker specializations, and operational reasons.
            Disable retires a value from new records; delete removes it outright.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Published
        </Badge>
      </div>
      {(Object.keys(dropdowns) as DropdownKey[]).map((k) => (
        <DropdownEditor
          key={k}
          label={DROPDOWN_LABELS[k]}
          values={dropdowns[k]}
          disabled={disabledDropdowns[k] ?? []}
          onAdd={(v) => addDropdownItem(k, v)}
          onRemove={(v) => removeDropdownItem(k, v)}
          onRename={(from, to) => renameDropdownItem(k, from, to)}
          onToggleDisabled={(v, off) => setDropdownItemDisabled(k, v, off)}
          onReorder={(vals) => setDropdown(k, vals)}
        />
      ))}
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
      <div className="font-medium text-sm mb-2">{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((x) => {
          const isOff = disabled.includes(x);
          if (editing === x) {
            return (
              <span key={x} className="flex items-center gap-1">
                <Input
                  autoFocus
                  className="h-7 w-40 text-xs"
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
              className={`gap-1.5 ${isOff ? "opacity-50 line-through" : ""}`}
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
                className="hover:text-gold"
                title={isOff ? "Enable" : "Disable"}
                aria-label={isOff ? "Enable" : "Disable"}
              >
                {isOff ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
              <button
                onClick={() => onRemove(x)}
                className="hover:text-destructive"
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">No values yet.</span>
        )}
      </div>
      <div className="flex gap-2 max-w-md">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Add value..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(v);
              setV("");
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            onAdd(v);
            setV("");
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic Category Placeholder                                       */
/* ------------------------------------------------------------------ */
function CategoryPlaceholder({
  category,
  status,
}: {
  category: {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  status: string;
}) {
  const Icon = category.icon;
  return (
    <Card className="p-6 mt-4">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-md bg-muted grid place-items-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{category.label}</h3>
            <Badge variant="outline" className="text-xs">
              {status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
          <p className="text-xs text-muted-foreground mt-3">
            Configure {category.label.toLowerCase()} settings for your business from this workspace.
            Changes follow a Draft, Test, and Publish lifecycle before going live.
          </p>
        </div>
      </div>
    </Card>
  );
}

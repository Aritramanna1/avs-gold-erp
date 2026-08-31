/**
 * Visual Document Template Designer & Safe Block Customizer.
 *
 * Master Reference: docs/DOCUMENT_TEMPLATE_ENGINE.md
 */
import { useState, useMemo, useEffect } from "react";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { DEFAULT_TEMPLATES } from "@/lib/print-engine/default-templates";
import { PRINT_DOC_LABELS, type PrintDocType } from "@/lib/printlog-store";
import {
  TEMPLATE_FAMILY_LABELS,
  type TemplateFamily,
  type PrintSize,
  type SectionConfig,
  type PrintTemplate,
  type OrnexaTemplatePackage,
} from "@/lib/print-engine/types";
import { PrintSections } from "@/components/print-engine/sections";
import { CustomShell } from "@/components/print-engine/CustomShell";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  Download,
  Upload,
  History,
  Eye,
  CheckCircle,
  Copy,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_PAPER_SIZES: PrintSize[] = ["a4", "a5", "a5l", "a6", "thermal", "thermal58", "tag"];

const BLOCK_LIBRARY_ITEMS: Array<{
  type: SectionConfig["type"];
  label: string;
  description: string;
}> = [
  {
    type: "party",
    label: "Customer / Party Block",
    description: "Billed to details, address, phone, GSTIN",
  },
  {
    type: "fieldGrid",
    label: "Label + Value Grid",
    description: "Configurable multi-column metadata grid",
  },
  {
    type: "table",
    label: "Line Items Table",
    description: "Product schedule, purity, weights, charges",
  },
  {
    type: "weightSummary",
    label: "Precious Metal Weight Block",
    description: "Gross, net, purity, fine gold custody",
  },
  {
    type: "taxBreakdown",
    label: "GST Tax Schedule",
    description: "Taxable value, CGST, SGST, IGST breakdown",
  },
  {
    type: "bankDetails",
    label: "Bank & UPI Remittance",
    description: "Account no, IFSC, branch, UPI QR code",
  },
  {
    type: "balanceCard",
    label: "Gold & Cash Balance Card",
    description: "Jama / Naam running customer balances",
  },
  {
    type: "richText",
    label: "Terms & Conditions",
    description: "Legal clauses, returns policy, remarks",
  },
  {
    type: "images",
    label: "Design / Photo Gallery",
    description: "CAD render, reference piece photos",
  },
  {
    type: "signatureBlock",
    label: "Authorised Signatures",
    description: "Client sign, supervisor sign, firm stamp",
  },
  {
    type: "barcode",
    label: "Barcode / HUID Tag",
    description: "Code 128 barcode or HUID identifier",
  },
  {
    type: "customField",
    label: "Dynamic Custom Field",
    description: "Custom attribute from transaction",
  },
  {
    type: "pageFooter",
    label: "Page Audit Footer",
    description: "Page numbers, timestamp, verification hash",
  },
];

export function DocumentTemplateDesigner() {
  const templates = usePrintTemplates((s) => s.templates);
  const refresh = usePrintTemplates((s) => s.refresh);
  const getForDocType = usePrintTemplates((s) => s.getForDocType);
  const update = usePrintTemplates((s) => s.update);
  const createTemplate = usePrintTemplates((s) => s.create);
  const resetToDefault = usePrintTemplates((s) => s.resetToDefault);
  const restoreVersion = usePrintTemplates((s) => s.restoreVersion);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allDocTypes = Object.keys(PRINT_DOC_LABELS) as PrintDocType[];
  const [selectedDocType, setSelectedDocType] = useState<PrintDocType>("gst_invoice");
  const [selectedSize, setSelectedSize] = useState<PrintSize>("a4");

  const currentTemplate = useMemo(() => {
    return getForDocType(selectedDocType, selectedSize);
  }, [selectedDocType, selectedSize, templates, getForDocType]);

  const [activeTemplate, setActiveTemplate] = useState<PrintTemplate>(currentTemplate);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    setActiveTemplate(currentTemplate);
    setHasUnsavedChanges(false);
  }, [currentTemplate]);

  // Generate real sample preview data
  const sampleData = useMemo(() => {
    const live = resolvePrintContext(selectedDocType, "sample");
    if (live) return live;
    return {
      docType: selectedDocType,
      docNumber: `${selectedDocType.toUpperCase().slice(0, 3)}-2026-0042`,
      recordId: "sample_record_id",
      createdAt: Date.now(),
      title: PRINT_DOC_LABELS[selectedDocType] || "Commercial Document",
      fields: {
        customerName: "Mrs. Ananya Sen",
        customerPhone: "+91 98301 23456",
        customerGstin: "19AAACP1234A1Z5",
        customerAddress: "74B Southern Avenue, Kolkata, West Bengal - 700029",
        invoiceNo: "MTJ/2026/00142",
        invoiceDate: new Date().toLocaleDateString("en-IN"),
        subtotalLabel: "₹ 1,84,500.00",
        cgstLabel: "₹ 2,767.50",
        sgstLabel: "₹ 2,767.50",
        grandTotalLabel: "₹ 1,90,035.00",
        paidLabel: "₹ 1,90,035.00",
        balanceLabel: "₹ 0.00",
        amountInWordsText: "Rupees One Lakh Ninety Thousand Thirty-Five Only",
        targetNetWt: "14.250 g",
        purityLabel: "916 (22K)",
        goldReceivedLabel: "14.500 g fine",
        assignedWorkerName: "Bapi Karmakar",
        itemName: "Handcrafted Bridal Choker Necklace",
        slipNumber: "SLIP-2026-0815",
        dateLabel: new Date().toLocaleDateString("en-IN"),
        workerName: "Raju Das (Goldsmith)",
        transactionCount: "4",
        totalIssued: "42.500 g",
        totalReturned: "41.800 g",
        openingBalance: "12.400 g",
        netMovement: "+0.700 g",
        custodyBalance: "13.100 g",
      },
      tables: {
        items: [
          {
            description: "22K Traditional Filigree Bridal Choker",
            huid: "HUID-916-WB42",
            purity: "916 (22K)",
            grossWt: "18.450g",
            netWt: "18.450g",
            fineWt: "16.900g",
            rateLabel: "₹ 7,450/g",
            makingLabel: "₹ 14,200",
            stoneLabel: "—",
            totalLabel: "₹ 1,51,652.00",
          },
          {
            description: "22K Designer Jhumka Earrings (Pair)",
            huid: "HUID-916-WB43",
            purity: "916 (22K)",
            grossWt: "8.600g",
            netWt: "8.600g",
            fineWt: "7.878g",
            rateLabel: "₹ 7,450/g",
            makingLabel: "₹ 6,800",
            stoneLabel: "—",
            totalLabel: "₹ 38,383.00",
          },
        ],
        entries: [
          {
            date: "01/08/2026",
            voucherNo: "OB-001",
            description: "Opening Account Balance",
            purity: "916",
            goldIn: "10.000g",
            goldOut: "—",
            debit: "—",
            credit: "₹ 50,000",
            goldBal: "+10.000g",
            moneyBal: "+₹ 50,000",
          },
          {
            date: "10/08/2026",
            voucherNo: "INV-0142",
            description: "Purchase of Bridal Choker",
            purity: "916",
            goldIn: "—",
            goldOut: "18.450g",
            debit: "₹ 1,90,035",
            credit: "—",
            goldBal: "-8.450g",
            moneyBal: "-₹ 1,40,035",
          },
        ],
      },
      flags: {
        hasCustomerPhone: true,
        hasCustomerGstin: true,
        hasCustomerAddress: true,
        hasCgstSgst: true,
        hasHuid: true,
        hasPayments: true,
        hasBankDetails: true,
        hasTerms: true,
      },
      images: {},
      balances: {
        gold: { previous: 10000, in: 0, out: 18450, closing: -8450 },
        cash: { previous: 5000000, in: 0, out: 19003500, closing: -14003500 },
      },
    };
  }, [selectedDocType]);

  // Section Manipulation Handlers
  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeTemplate.sections.length) return;
    const newSections = [...activeTemplate.sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIdx, 0, moved);
    setActiveTemplate({ ...activeTemplate, sections: newSections });
    setHasUnsavedChanges(true);
  };

  const removeSection = (index: number) => {
    const newSections = activeTemplate.sections.filter((_, i) => i !== index);
    setActiveTemplate({ ...activeTemplate, sections: newSections });
    setHasUnsavedChanges(true);
  };

  const addBlock = (item: (typeof BLOCK_LIBRARY_ITEMS)[number]) => {
    const newBlockId = `block_${Date.now().toString(36)}`;
    let newSection: SectionConfig;
    switch (item.type) {
      case "weightSummary":
        newSection = {
          type: "weightSummary",
          id: newBlockId,
          title: "Precious Metal Weight Breakdown",
          grossPath: "grossWt",
          netPath: "netWt",
          purityPath: "purityLabel",
          finePath: "fineWt",
        };
        break;
      case "taxBreakdown":
        newSection = {
          type: "taxBreakdown",
          id: newBlockId,
          title: "GST Breakdown Schedule",
          taxableValuePath: "subtotalLabel",
          cgstPath: "cgstLabel",
          sgstPath: "sgstLabel",
          totalTaxPath: "gstSummaryLabel",
        };
        break;
      case "bankDetails":
        newSection = {
          type: "bankDetails",
          id: newBlockId,
          title: "Bank & UPI Remittance Details",
          showUpiQr: true,
        };
        break;
      case "barcode":
        newSection = { type: "barcode", id: newBlockId, valuePath: "invoiceNo", format: "CODE128" };
        break;
      case "customField":
        newSection = {
          type: "customField",
          id: newBlockId,
          label: "Custom Hallmark Note",
          valuePath: "huid",
        };
        break;
      case "pageFooter":
        newSection = {
          type: "pageFooter",
          id: newBlockId,
          showMicroAuditHash: true,
          showTimestamp: true,
          showPageNumbers: true,
        };
        break;
      case "richText":
        newSection = {
          type: "richText",
          id: newBlockId,
          title: "Additional Note",
          staticText: "Thank you for your business.",
        };
        break;
      default:
        newSection = {
          type: "richText",
          id: newBlockId,
          title: item.label,
          staticText: "Configured block details.",
        };
    }
    setActiveTemplate({ ...activeTemplate, sections: [...activeTemplate.sections, newSection] });
    setHasUnsavedChanges(true);
    setAddBlockOpen(false);
    toast.success(`Added ${item.label} block.`);
  };

  const handleApplyFamilyPreset = (family: TemplateFamily) => {
    const familyDefaults = DEFAULT_TEMPLATES[selectedDocType] ?? DEFAULT_TEMPLATES.gst_invoice;
    const match = familyDefaults.find((t) => t.family === family) ?? familyDefaults[0];
    if (match) {
      setActiveTemplate({
        ...activeTemplate,
        family,
        name: `${PRINT_DOC_LABELS[selectedDocType]} (${TEMPLATE_FAMILY_LABELS[family]?.name || family})`,
        sections: match.sections,
      });
      setHasUnsavedChanges(true);
      toast.success(`Applied ${TEMPLATE_FAMILY_LABELS[family]?.name} layout.`);
    }
  };

  const handleSavePublish = async () => {
    await update(activeTemplate.id, {
      name: activeTemplate.name,
      family: activeTemplate.family,
      paperSize: activeTemplate.paperSize,
      fontFamily: activeTemplate.fontFamily,
      fontSize: activeTemplate.fontSize,
      primaryColor: activeTemplate.primaryColor,
      accentColor: activeTemplate.accentColor,
      sections: activeTemplate.sections,
    });
    setHasUnsavedChanges(false);
    toast.success(`Published version ${activeTemplate.version + 1} of "${activeTemplate.name}".`);
  };

  const handleResetToDefault = async () => {
    await resetToDefault(selectedDocType, selectedSize);
    toast.success(`Reset ${PRINT_DOC_LABELS[selectedDocType]} to default template.`);
  };

  const handleExportPackage = () => {
    const pkg: OrnexaTemplatePackage = {
      format: "ornexa-template",
      schemaVersion: "3.1.0",
      exportedAt: Date.now(),
      exportedBy: "Administrator",
      template: {
        docType: activeTemplate.docType,
        name: activeTemplate.name,
        family: activeTemplate.family,
        paperSize: activeTemplate.paperSize,
        fontFamily: activeTemplate.fontFamily,
        fontSize: activeTemplate.fontSize,
        primaryColor: activeTemplate.primaryColor,
        accentColor: activeTemplate.accentColor,
        sections: activeTemplate.sections,
        version: activeTemplate.version,
        createdAt: activeTemplate.createdAt,
        updatedAt: activeTemplate.updatedAt,
      },
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Template-${activeTemplate.docType}-${activeTemplate.family || "custom"}.ornexa-template.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported .ornexa-template package.");
  };

  const handleImportPackage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = JSON.parse(ev.target?.result as string);
        if (content.format !== "ornexa-template" || !Array.isArray(content.template?.sections)) {
          throw new Error("Invalid .ornexa-template format.");
        }
        setActiveTemplate({
          ...activeTemplate,
          name: content.template.name || activeTemplate.name,
          family: content.template.family || activeTemplate.family,
          sections: content.template.sections,
        });
        setHasUnsavedChanges(true);
        toast.success("Successfully imported template structure!");
      } catch (err: any) {
        toast.error("Import failed: " + (err?.message || "Invalid package."));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Context Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-md border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-base">Document Template Designer</h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-600 border-amber-500/30"
            >
              10 Base Families
            </Badge>
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="text-[10px]">
                Draft Changes
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Visually customize headers, line-item tables, metal purity blocks, tax breakdowns, and
            terms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedDocType}
            onValueChange={(v) => {
              setSelectedDocType(v as PrintDocType);
            }}
          >
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {allDocTypes.map((dt) => (
                <SelectItem key={dt} value={dt}>
                  {PRINT_DOC_LABELS[dt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSize} onValueChange={(v) => setSelectedSize(v as PrintSize)}>
            <SelectTrigger className="h-9 w-32 text-xs font-mono uppercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_PAPER_SIZES.map((sz) => (
                <SelectItem key={sz} value={sz}>
                  {sz.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={handleSavePublish}
            disabled={!hasUnsavedChanges}
            className="h-9 gap-1.5 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold"
          >
            <Save className="h-3.5 w-3.5" /> Publish
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            className="h-9 gap-1 text-xs"
            title="Version History & Rollback"
          >
            <History className="h-3.5 w-3.5" /> History
          </Button>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Settings & Block Tree (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Base Template Family Selector Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> 10 Base Template Families
              </CardTitle>
              <CardDescription className="text-xs">
                Switch between genuine professional structures.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Select
                value={activeTemplate.family || "classic_business"}
                onValueChange={(v) => handleApplyFamilyPreset(v as TemplateFamily)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(Object.keys(TEMPLATE_FAMILY_LABELS) as TemplateFamily[]).map((fam) => (
                    <SelectItem key={fam} value={fam}>
                      {TEMPLATE_FAMILY_LABELS[fam].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                {TEMPLATE_FAMILY_LABELS[activeTemplate.family || "classic_business"]?.description}
              </p>
            </CardContent>
          </Card>

          {/* Block Layout Manager Card */}
          <Card className="border-border">
            <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Document Sections ({activeTemplate.sections.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Reorder, add, or remove controlled component blocks.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddBlockOpen(true)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Add Block
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 max-h-[500px] overflow-y-auto">
              {activeTemplate.sections.map((section, idx) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted/60 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground w-4">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate capitalize">
                        {(section as any).title || section.type.replace(/([A-Z])/g, " $1")}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {section.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, "up")}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={idx === activeTemplate.sections.length - 1}
                      onClick={() => moveSection(idx, "down")}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(idx)}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Import / Export & Actions Card */}
          <Card className="border-border">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPackage}
                  className="h-8 gap-1"
                >
                  <Download className="h-3 w-3" /> Export (.ornexa-template)
                </Button>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-md border border-input bg-background h-8 px-3 text-xs font-medium hover:bg-accent gap-1">
                    <Upload className="h-3 w-3" /> Import
                  </span>
                  <input
                    type="file"
                    accept=".json,.ornexa-template"
                    onChange={handleImportPackage}
                    className="hidden"
                  />
                </label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                className="h-8 text-muted-foreground hover:text-destructive gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset Shipped Default
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: High-Fidelity Live Interactive Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border border-border">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-amber-500" /> Live Interactive Output Preview
            </span>
            <div className="flex items-center gap-1 bg-background p-0.5 rounded border">
              <Button
                variant={previewMode === "desktop" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewMode("desktop")}
                className="h-6 text-[11px] px-2"
              >
                A4 Desktop
              </Button>
              <Button
                variant={previewMode === "mobile" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPreviewMode("mobile")}
                className="h-6 text-[11px] px-2"
              >
                Mobile Card
              </Button>
            </div>
          </div>

          <div
            className={`border border-border rounded-md bg-white text-black p-6 shadow-md transition-all overflow-x-auto ${
              previewMode === "mobile" ? "max-w-sm mx-auto shadow-2xl rounded-md" : "w-full"
            }`}
          >
            {activeTemplate.shell === "custom" ? (
              <CustomShell paperSize={activeTemplate.paperSize}>
                <PrintSections sections={activeTemplate.sections} data={sampleData} />
              </CustomShell>
            ) : (
              <div className="font-sans text-xs">
                <PrintSections sections={activeTemplate.sections} data={sampleData} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Block Library Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Safe Component Block Library</DialogTitle>
            <DialogDescription>
              Select a controlled block component to add to your document structure.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto py-2">
            {BLOCK_LIBRARY_ITEMS.map((item) => (
              <button
                key={item.type}
                onClick={() => addBlock(item)}
                className="text-left p-3 rounded-lg border border-border hover:border-amber-500/60 hover:bg-muted/50 transition-all group"
              >
                <div className="font-semibold text-xs text-foreground group-hover:text-amber-500">
                  {item.label}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddBlockOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History & Rollback Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-500" /> Template Version History
            </DialogTitle>
            <DialogDescription>
              Rollback to a previously published snapshot with full audit safety.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto py-2">
            {activeTemplate.versions && activeTemplate.versions.length > 0 ? (
              activeTemplate.versions.map((ver) => (
                <div
                  key={ver.version}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs"
                >
                  <div>
                    <div className="font-semibold">Version {ver.version}</div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(ver.savedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await restoreVersion(activeTemplate.id, ver.version);
                      setHistoryOpen(false);
                      toast.success(`Restored to Version ${ver.version}.`);
                    }}
                    className="h-7 text-xs"
                  >
                    Restore
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No previous versions recorded yet.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

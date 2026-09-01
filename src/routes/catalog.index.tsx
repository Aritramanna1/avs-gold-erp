import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useDraft } from "@/lib/drafts-store";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalog, type DesignSource, type Difficulty, type Design } from "@/lib/catalog-store";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { COMMON_PURITIES, gramsToMg, mgToGrams } from "@/lib/gold";
import { usePeople } from "@/lib/people-store";
import { useAttachments, useAttachmentUrl } from "@/lib/attachments-store";
import {
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Plus,
  Search,
  Sparkles,
  FileDown,
  Eye,
  Check,
  Printer,
  CheckSquare,
  Square,
  RotateCcw,
  Upload,
  X,
  SlidersHorizontal,
  Crown,
  Share2,
} from "lucide-react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useSettings } from "@/lib/settings-store";
import { exportToCSV } from "@/lib/report-engine";
import { generateMultiPageCatalogPdf } from "@/lib/catalog-pdf-generator";
import type { TemplateLayout } from "@/lib/catalog-template-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/catalog/")({
  head: () => ({ meta: [{ title: "Catalog · AVS Gold ERP" }] }),
  component: CatalogIndex,
});

const TABS: { value: DesignSource | "all" }[] = [
  { value: "all" },
  { value: "internal" },
  { value: "customer_reference" },
  { value: "external" },
  { value: "saved_from_order" },
];

const TEMPLATE_LAYOUT_OPTIONS: { value: TemplateLayout; label: string; description: string }[] = [
  { value: "four_grid", label: "MTJ Classic (4-Grid Standard)", description: "4 items per page with balanced photography & weights" },
  { value: "two_product", label: "MTJ Premium (2-Product Luxury Spread)", description: "2 large luxury items per page with descriptions" },
  { value: "six_grid", label: "MTJ Minimal (6-Product Clean Grid)", description: "6 items per page for dense wholesale showcase" },
  { value: "single_hero", label: "MTJ Product Focus (Single Hero)", description: "Full page dedicated spotlight with high-res photo" },
  { value: "collection", label: "MTJ Collection (Jewellery Showcase)", description: "3 items per page with category headers" },
  { value: "price_list", label: "MTJ Price List (Tabular Rate Schedule)", description: "Tabular list of codes, purities, and weights" },
  { value: "luxury", label: "MTJ Luxury Showcase (High-End Spread)", description: "Dark gold accented luxury showcase" },
];

function resolveLayoutFromTemplateId(templateId?: string): TemplateLayout {
  if (templateId === "tpl_premium") return "two_product";
  if (templateId === "tpl_minimal") return "six_grid";
  if (templateId === "tpl_product_focus") return "single_hero";
  if (templateId === "tpl_collection") return "collection";
  if (templateId === "tpl_price_list") return "price_list";
  if (templateId === "tpl_luxury") return "luxury";
  return "four_grid";
}

function CatalogIndex() {
  const { t } = useLanguage();
  const designs = useCatalog((s) => s.designs);
  const customers = usePeople((s) => s.people);
  const catalogSettings = useSettings((s) => s.catalog);
  const firmSettings = useSettings((s) => s.firm);

  // Filters State
  const [tab, setTab] = useState<DesignSource | "all">("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [purityFilter, setPurityFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);

  // Selection & Export State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLayout>(() =>
    resolveLayoutFromTemplateId(catalogSettings.defaultTemplateId),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  useEffect(() => {
    if (catalogSettings.defaultTemplateId) {
      setSelectedTemplate(resolveLayoutFromTemplateId(catalogSettings.defaultTemplateId));
    }
  }, [catalogSettings.defaultTemplateId]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...catalogSettings.categories,
          ...ITEM_CATEGORIES,
          ...designs.map((d) => d.category),
        ]),
      ).filter(Boolean),
    [catalogSettings.categories, designs],
  );

  // Comprehensive, fast multi-attribute filtering (Category, Purity, Weight, Search)
  const list = useMemo(() => {
    return designs.filter((d) => {
      if (tab !== "all" && d.source !== tab) return false;
      if (cat !== "all" && d.category !== cat) return false;
      if (purityFilter !== "all" && String(d.purity) !== purityFilter) return false;

      // Weight filtering in grams
      const netG = (d.approxNetMg || d.approxGrossMg || 0) / 1000;
      if (weightFilter === "under_5g" && netG >= 5) return false;
      if (weightFilter === "under_10g" && netG >= 10) return false;
      if (weightFilter === "5g_to_10g" && (netG < 5 || netG >= 10)) return false;
      if (weightFilter === "10g_to_20g" && (netG < 10 || netG >= 20)) return false;
      if (weightFilter === "20g_to_50g" && (netG < 20 || netG >= 50)) return false;
      if (weightFilter === "above_50g" && netG < 50) return false;

      if (q) {
        const tVal = q.toLowerCase();
        const hay = [
          d.designNumber,
          d.designName,
          d.category,
          d.subcategory ?? "",
          d.itemType ?? "",
          ...(d.tags ?? []),
          d.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();

        // Check if query is like "ring under 10g" or "10g"
        if (tVal.includes("under 10g") || tVal.includes("under 10 g") || tVal.includes("< 10g")) {
          if (netG >= 10) return false;
        } else if (tVal.includes("under 5g") || tVal.includes("under 5 g") || tVal.includes("< 5g")) {
          if (netG >= 5) return false;
        }

        if (!hay.includes(tVal) && !tVal.includes(d.category.toLowerCase())) return false;
      }
      return true;
    });
  }, [designs, tab, q, cat, purityFilter, weightFilter]);

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(list.map((d) => d.id)));
  }, [list]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = list.length > 0 && list.every((d) => selectedIds.has(d.id));

  const selectedDesigns = useMemo(() => {
    return designs.filter((d) => selectedIds.has(d.id));
  }, [designs, selectedIds]);

  const [sharingPdf, setSharingPdf] = useState(false);

  // Structured multi-page PDF Export
  async function handleExportPDF() {
    const targets = selectedDesigns.length > 0 ? selectedDesigns : list;
    if (targets.length === 0) {
      toast.error("Select at least one product before exporting.");
      return;
    }
    setExportingPdf(true);
    try {
      const { blob, fileName, pageCount } = await generateMultiPageCatalogPdf(targets, {
        templateLayout: selectedTemplate,
        title: catalogSettings.headerTitle || "EXQUISITE JEWELLERY CATALOGUE",
        showPrices: catalogSettings.showPrice ?? true,
        showDescriptions: catalogSettings.showDescription ?? false,
        showWeights: catalogSettings.showWeight ?? true,
        showPurity: catalogSettings.showPurity ?? true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${targets.length} designs across ${pageCount} PDF page(s)!`);
    } catch (err: any) {
      toast.error(`PDF generation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setExportingPdf(false);
    }
  }

  // Direct clean PDF share
  async function handleSharePDF() {
    const targets = selectedDesigns.length > 0 ? selectedDesigns : list;
    if (targets.length === 0) {
      toast.error("Select at least one product before sharing.");
      return;
    }
    setSharingPdf(true);
    try {
      const { blob, fileName } = await generateMultiPageCatalogPdf(targets, {
        templateLayout: selectedTemplate,
        title: catalogSettings.headerTitle || "EXQUISITE JEWELLERY CATALOGUE",
        showPrices: catalogSettings.showPrice ?? true,
        showDescriptions: catalogSettings.showDescription ?? false,
        showWeights: catalogSettings.showWeight ?? true,
        showPurity: catalogSettings.showPurity ?? true,
      });

      const file = new File([blob], fileName, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Jewellery Catalogue",
          text: `Jewellery Catalogue from ${firmSettings?.shopName || "AVS Gold"} (${targets.length} designs)`,
          files: [file],
        });
        toast.success("Catalogue shared successfully!");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Catalogue PDF generated and downloaded! Ready to share.");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(`Share failed: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setSharingPdf(false);
    }
  }

  // Direct clean PDF print (never webpage UI screenshot)
  async function handlePrintPDF() {
    const targets = selectedDesigns.length > 0 ? selectedDesigns : list;
    if (targets.length === 0) {
      toast.error("Select at least one product before printing.");
      return;
    }
    setPrintingPdf(true);
    try {
      const { blob } = await generateMultiPageCatalogPdf(targets, {
        templateLayout: selectedTemplate,
        title: catalogSettings.headerTitle || "EXQUISITE JEWELLERY CATALOGUE",
      });
      const blobUrl = URL.createObjectURL(blob);
      const printIframe = document.createElement("iframe");
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "0";
      printIframe.src = blobUrl;
      document.body.appendChild(printIframe);
      printIframe.onload = () => {
        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          } catch {
            window.open(blobUrl, "_blank");
          }
        }, 300);
      };
      toast.success("Opening print dialogue for catalogue PDF...");
    } catch (err: any) {
      toast.error(`Print generation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setPrintingPdf(false);
    }
  }

  function exportCatalog() {
    exportToCSV("catalog-designs.csv", [
      [
        t("catalog.design_number"),
        t("catalog.design_name"),
        t("catalog.category"),
        t("catalog.purity"),
        t("catalog.approx_gross"),
        t("catalog.approx_net"),
        t("catalog.source"),
        t("catalog.tags"),
      ],
      ...list.map((design) => [
        design.designNumber,
        design.designName,
        design.category,
        design.purity,
        mgToGrams(design.approxGrossMg),
        mgToGrams(design.approxNetMg),
        t(`catalog.source_${design.source}`),
        design.tags.join(", "),
      ]),
    ]);
    toast.success(t("catalog.export_success"));
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      {/* ── Page Header ── */}
      <PageHeader
        title={t("catalog.title") || "Catalog"}
        subtitle={t("catalog.subtitle") || "Designs, references and saved patterns for orders and stock."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCatalog} disabled={!list.length} className="gap-2">
              <Download className="h-4 w-4" /> {t("catalog.export_csv") || "Export CSV"}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const target = selectedDesigns.length > 0 ? selectedDesigns : list;
                if (target.length === 0) {
                  toast.error("No designs available to preview.");
                  return;
                }
                setPreviewOpen(true);
              }}
              className="gap-2"
            >
              <Eye className="h-4 w-4 text-gold" />
              Preview catalog ({selectedDesigns.length || list.length})
            </Button>

            <Button
              variant="outline"
              onClick={handleSharePDF}
              disabled={sharingPdf || (!selectedDesigns.length && !list.length)}
              className="gap-2"
            >
              <Share2 className="h-4 w-4 text-gold" />
              {sharingPdf ? "Generating..." : "Share catalog PDF"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> More <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Advanced Publishing</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/catalog/designer" className="cursor-pointer flex items-center gap-2 text-xs">
                    <Crown className="h-3.5 w-3.5 text-amber-600" />
                    <span>Designer Catalog Studio</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/catalog/templates" className="cursor-pointer flex items-center gap-2 text-xs">
                    <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Page Template Layouts</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" search={{ tab: "catalog" }} className="cursor-pointer flex items-center gap-2 text-xs">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Catalog Settings &amp; Defaults</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => setAdding(true)} className="gap-2 bg-gold hover:bg-gold/90 text-white font-semibold shadow-sm">
              <Plus className="h-4 w-4" /> {t("catalog.add_design") || "Add Design"}
            </Button>
          </div>
        }
      />

      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t("catalog.total_designs") || "Total Designs", designs.length],
          [t("catalog.internal_designs") || "Internal", designs.filter((d) => d.source === "internal").length],
          [t("catalog.customer_refs") || "Customer Refs", designs.filter((d) => d.source === "customer_reference").length],
          [t("catalog.saved_orders") || "Saved From Orders", designs.filter((d) => d.source === "saved_from_order").length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-border bg-card p-4 shadow-elegant">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 font-serif text-2xl text-gold">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Fast Search & Multi-Filter Bar ── */}
      <div className="rounded-md border border-border bg-card p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("catalog.search_placeholder") || "Search code, name, category, or 'under 10g'..."}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("catalog.all_categories") || "All Categories"}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={purityFilter} onValueChange={setPurityFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Purity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Purities</SelectItem>
              <SelectItem value="995">995‰ (24K Pure)</SelectItem>
              <SelectItem value="916">916‰ (22K Standard)</SelectItem>
              <SelectItem value="875">875‰ (21K)</SelectItem>
              <SelectItem value="750">750‰ (18K Hallmark)</SelectItem>
              <SelectItem value="585">585‰ (14K)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={weightFilter} onValueChange={setWeightFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Weight Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weights</SelectItem>
              <SelectItem value="under_5g">Under 5g</SelectItem>
              <SelectItem value="under_10g">Under 10g</SelectItem>
              <SelectItem value="5g_to_10g">5g – 10g</SelectItem>
              <SelectItem value="10g_to_20g">10g – 20g</SelectItem>
              <SelectItem value="20g_to_50g">20g – 50g</SelectItem>
              <SelectItem value="above_50g">Above 50g</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Source Tabs ── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DesignSource | "all")}>
        <div className="block md:hidden mb-4">
          <Select value={tab} onValueChange={(v) => setTab(v as DesignSource | "all")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((tItem) => (
                <SelectItem key={tItem.value} value={tItem.value}>
                  {t(`catalog.tab_${tItem.value}`) || tItem.value} (
                  {tItem.value === "all"
                    ? designs.length
                    : designs.filter((d) => d.source === tItem.value).length}
                  )
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsList className="hidden md:flex flex-wrap h-auto">
          {TABS.map((tItem) => (
            <TabsTrigger key={tItem.value} value={tItem.value}>
              {t(`catalog.tab_${tItem.value}`) || tItem.value}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {tItem.value === "all"
                  ? designs.length
                  : designs.filter((d) => d.source === tItem.value).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Direct Selection & Template Export Action Bar ── */}
        <div className="my-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={allSelected ? deselectAll : selectAll}
              className="h-8 text-xs gap-1.5 font-medium"
            >
              {allSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-gold" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {allSelected ? "Deselect All" : "Select All Filtered"}
            </Button>
            <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30 font-semibold px-2 py-0.5">
              {selectedIds.size} Selected
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedDesigns.length === 0) {
                  toast.error("Select products first to preview.");
                  return;
                }
                setPreviewOpen(true);
              }}
              disabled={selectedDesigns.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Eye className="h-3.5 w-3.5 text-gold" /> Preview
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintPDF}
              disabled={selectedDesigns.length === 0 || printingPdf}
              className="h-8 text-xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-gold" />
              {printingPdf ? "Printing..." : "Print"}
            </Button>

            <Button
              size="sm"
              onClick={handleExportPDF}
              disabled={selectedDesigns.length === 0 || exportingPdf}
              className="h-8 text-xs gap-1.5 bg-gold hover:bg-gold/90 text-white font-semibold shadow-sm"
            >
              <FileDown className="h-3.5 w-3.5" />
              {exportingPdf ? "Generating..." : "Export Clean PDF"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 text-xs gap-1.5 text-amber-600 border-amber-600/30 hover:bg-amber-600/10"
            >
              <Link to="/catalog/designer">
                <Crown className="h-3.5 w-3.5 text-amber-600" /> Advanced Designer
              </Link>
            </Button>
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {list.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground font-sans">
              {t("catalog.no_designs") || "No designs found."}{" "}
              <button onClick={() => setAdding(true)} className="text-gold underline cursor-pointer">
                {t("catalog.add_design") || "Add Design"}
              </button>{" "}
              {t("catalog.click_add_design") || "to create one."}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((d) => (
                <DesignCard
                  key={d.id}
                  d={d}
                  isSelected={selectedIds.has(d.id)}
                  onToggleSelect={() => toggleSelect(d.id)}
                  customerName={
                    d.customerId
                      ? customers.find((c) => c.id === d.customerId)?.fullName
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── FULL SCREEN PREVIEW MODAL ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Catalogue Preview — {TEMPLATE_LAYOUT_OPTIONS.find((o) => o.value === selectedTemplate)?.label}
            </DialogTitle>
            <DialogDescription>
              {selectedDesigns.length} designs selected • {firmSettings?.shopName || "AVS Gold ERP"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedDesigns.map((d) => (
                <div key={d.id} className="border border-border/80 rounded-lg p-3 bg-card flex gap-3 items-center">
                  <div className="w-20 h-20 bg-muted/30 rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    {d.photoDataUrl ? (
                      <img src={d.photoDataUrl} alt={d.designName} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold text-xs truncate text-foreground">{d.designName}</div>
                    <div className="text-[11px] text-gold font-mono font-bold">{d.designNumber} • {d.purity}‰</div>
                    <div className="text-[10px] text-muted-foreground">Cat: {d.category}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      GW: {mgToGrams(d.approxGrossMg)}g | NW: {mgToGrams(d.approxNetMg || d.approxGrossMg)}g
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPDF}
              disabled={printingPdf}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4 text-gold" />
              {printingPdf ? "Printing..." : "Print PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSharePDF}
              disabled={sharingPdf}
              className="gap-1.5"
            >
              <Share2 className="h-4 w-4 text-gold" />
              {sharingPdf ? "Sharing..." : "Share PDF"}
            </Button>
            <Button
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="bg-gold hover:bg-gold/90 text-white font-semibold gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              {exportingPdf ? "Generating PDF..." : "Export Full PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD DESIGN DIALOG ── */}
      <AddDesignDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function DesignCard({
  d,
  customerName,
  isSelected,
  onToggleSelect,
}: {
  d: Design;
  customerName?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const { t } = useLanguage();
  const r2Url = useAttachmentUrl("catalog", d.id, "design_photo");
  const att = useAttachments((s) => s.items[`catalog:${d.id}:design_photo`]);
  const photo = r2Url || att?.thumbnailDataUrl || att?.fileDataUrl || d.photoDataUrl;

  return (
    <div
      className={`relative rounded-md border transition-all overflow-hidden bg-card flex flex-col justify-between ${
        isSelected ? "border-gold shadow-md ring-2 ring-gold/40 bg-gold/5" : "border-border hover:border-gold/40"
      }`}
    >
      {/* Top selection checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`h-6 w-6 rounded flex items-center justify-center border transition-colors shadow-sm ${
            isSelected ? "bg-gold border-gold text-white" : "bg-card/90 border-border hover:border-gold"
          }`}
        >
          {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
        </button>
      </div>

      <Link
        to="/catalog/$id"
        params={{ id: d.id }}
        className="block"
      >
        <div className="aspect-video bg-muted/40 grid place-items-center text-muted-foreground relative overflow-hidden p-2">
          {photo ? (
            <img
              src={photo}
              alt={d.designName || d.designNumber}
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-8 w-8 opacity-50" />
          )}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium truncate">{d.designName || "—"}</div>
            <Badge variant="outline" className="text-[10px] shrink-0 font-mono text-gold border-gold/30">
              {d.designNumber}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2">
            <span>{d.category}</span>
            <span>·</span>
            <span>{d.purity}‰</span>
            <span>·</span>
            <span>{mgToGrams(d.approxGrossMg)}g</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {t(`catalog.source_${d.source}`)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {t(`catalog.difficulty_${d.difficulty}`)}
            </Badge>
            {customerName && (
              <span className="text-[10px] text-muted-foreground truncate">· {customerName}</span>
            )}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          onClick={onToggleSelect}
          className={`w-full h-7 text-xs font-semibold gap-1.5 ${
            isSelected ? "bg-gold hover:bg-gold/90 text-white" : "border-border"
          }`}
        >
          {isSelected ? (
            <>
              <Check className="h-3 w-3" /> Selected
            </>
          ) : (
            <>
              <Square className="h-3 w-3" /> Select for Catalogue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function AddDesignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const add = useCatalog((s) => s.add);
  const nextNum = useCatalog((s) => s.nextDesignNumber);
  const customers = usePeople((s) => s.people);
  const catalogSettings = useSettings((s) => s.catalog);
  const configuredCategories = Array.from(
    new Set([...catalogSettings.categories, ...ITEM_CATEGORIES]),
  ).filter(Boolean);
  const configuredPurity =
    catalogSettings.defaultPurity.match(/\b\d{3}\b/)?.[0] ??
    String(COMMON_PURITIES[0]?.value ?? 916);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [draftId, setDraftId, clearDraftId] = useDraft(
    "mtj-catalog-draftId-v1",
    () => `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );
  const [designNumber, setDesignNumber, clearDesignNumber] = useDraft(
    "mtj-catalog-designNumber-v1",
    "",
  );
  const [designName, setDesignName, clearDesignName] = useDraft("mtj-catalog-designName-v1", "");
  const [category, setCategory, clearCategory] = useDraft(
    "mtj-catalog-category-v1",
    configuredCategories[0] ?? "Ring",
  );
  const [subcategory, setSubcategory, clearSubcategory] = useDraft(
    "mtj-catalog-subcategory-v1",
    "",
  );
  const [itemType, setItemType, clearItemType] = useDraft("mtj-catalog-itemType-v1", "");
  const [purity, setPurity, clearPurity] = useDraft("mtj-catalog-purity-v1", configuredPurity);
  const [grossG, setGrossG, clearGrossG] = useDraft("mtj-catalog-grossG-v1", "");
  const [netG, setNetG, clearNetG] = useDraft("mtj-catalog-netG-v1", "");
  const [difficulty, setDifficulty, clearDifficulty] = useDraft<Difficulty>(
    "mtj-catalog-difficulty-v1",
    "medium",
  );
  const [tags, setTags, clearTags] = useDraft("mtj-catalog-tags-v1", "");
  const [source, setSource, clearSource] = useDraft<DesignSource>(
    "mtj-catalog-source-v1",
    "internal",
  );
  const [notes, setNotes, clearNotes] = useDraft("mtj-catalog-notes-v1", "");
  const [customerId, setCustomerId, clearCustomerId] = useDraft("mtj-catalog-customerId-v1", "");

  const [isCustomCategory, setIsCustomCategory] = useState(
    !configuredCategories.includes(category) && category !== "",
  );

  // Auto design number pre-fill
  useEffect(() => {
    if (open && !designNumber) {
      setDesignNumber(nextNum(category));
    }
  }, [open, category]);

  useEffect(() => {
    if (category && configuredCategories.includes(category)) {
      setIsCustomCategory(false);
    }
  }, [category]);

  useEffect(() => {
    if (open && !draftId) {
      setDraftId(`d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    }
  }, [open, draftId]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo must be less than 10MB.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const rec = await useAttachments.getState().saveWithFile(
        "catalog",
        draftId,
        "design_photo",
        file,
        { filed: true, note: "Design photograph" },
      );
      const displayUrl = rec.thumbnailDataUrl || rec.fileDataUrl;
      setPhotoDataUrl(displayUrl);
      toast.success("Design photograph stored in Cloudflare R2.");
    } catch (err: any) {
      console.error("[Catalog R2 Upload Error]:", err);
      toast.error(`Image upload failed: ${err?.message || "Storage error"}. The catalog was not saved.`);
      setPhotoDataUrl(undefined);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleGrossChange(val: string) {
    setGrossG(val);
    if (!netG || netG === grossG) {
      setNetG(val);
    }
  }

  function save() {
    const cleanName = designName.trim();
    if (!cleanName) {
      toast.error(t("catalog.design_name_required"));
      return;
    }
    if (!category) {
      toast.error(t("catalog.category_required"));
      return;
    }

    const num = designNumber.trim() || nextNum(category);
    const existingDesigns = useCatalog.getState().designs;
    const isDuplicate = existingDesigns.some(
      (d) => d.designNumber.toLowerCase() === num.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(t("catalog.duplicate_design").replace("{number}", num));
      return;
    }

    const grossMg = grossG ? gramsToMg(grossG) : 0;
    const netMg = netG ? gramsToMg(netG) : grossMg;
    if (grossMg < 0 || netMg < 0 || (grossMg > 0 && netMg > grossMg)) {
      toast.error(t("catalog.invalid_weight"));
      return;
    }

    try {
      const att = useAttachments.getState().items[`catalog:${draftId}:design_photo`];
      const d = add({
        id: draftId,
        designNumber: num,
        designName: cleanName,
        category,
        subcategory: subcategory || undefined,
        itemType: itemType || undefined,
        purity: Number(purity) || 916,
        approxGrossMg: grossMg,
        approxNetMg: netMg,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source,
        customerId: source === "customer_reference" && customerId ? customerId : undefined,
        notes: notes || undefined,
        photoDataUrl: photoDataUrl || att?.thumbnailDataUrl || att?.fileDataUrl,
      });

      clearDraftId();
      clearDesignNumber();
      clearDesignName();
      clearCategory();
      clearSubcategory();
      clearItemType();
      clearPurity();
      clearGrossG();
      clearNetG();
      clearDifficulty();
      clearTags();
      clearSource();
      clearNotes();
      clearCustomerId();
      setPhotoDataUrl(undefined);
      onClose();
      toast.success(t("catalog.design_saved").replace("{number}", d.designNumber));
    } catch (e: any) {
      toast.error(`Failed to save design: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] md:w-full">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">{t("catalog.add_design")}</DialogTitle>
          <DialogDescription>{t("catalog.add_design_desc")}</DialogDescription>
        </DialogHeader>

        {/* ── Photo Dropzone ── */}
        <div className="p-3 bg-muted/20 border border-dashed border-border rounded-lg flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
          <div className="w-16 h-16 bg-muted/40 rounded flex items-center justify-center overflow-hidden shrink-0 border border-border">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground">Design Photograph</div>
            <div className="text-[11px] text-muted-foreground">Permanent Cloudflare R2 storage • Embedded in PDF catalogue.</div>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs gap-1"
            >
              {isUploadingPhoto ? (
                <>
                  <RotateCcw className="h-3 w-3 animate-spin" /> Uploading to R2...
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" /> {photoDataUrl ? "Change" : "Upload to R2"}
                </>
              )}
            </Button>
            {photoDataUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isUploadingPhoto}
                onClick={() => setPhotoDataUrl(undefined)}
                className="h-7 text-xs px-2 text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={t("catalog.design_number")}>
            <div className="flex gap-1.5">
              <Input
                value={designNumber}
                onChange={(e) => setDesignNumber(e.target.value)}
                placeholder={`auto: ${nextNum(category)}`}
                className="h-8 text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDesignNumber(nextNum(category))}
                title="Auto-Generate"
                className="h-8 px-2"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </Field>
          <Field label={`${t("catalog.design_name")} *`}>
            <Input
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder={t("catalog.design_name_placeholder")}
              className="h-8 text-xs"
            />
          </Field>
          <Field label={`${t("catalog.category")} *`}>
            <Select
              value={isCustomCategory ? "Custom" : category}
              onValueChange={(v) => {
                if (v === "Custom") {
                  setIsCustomCategory(true);
                  setCategory("");
                } else {
                  setIsCustomCategory(false);
                  setCategory(v);
                  if (!designNumber) setDesignNumber(nextNum(v));
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {configuredCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="Custom">{t("catalog.custom") || "+ Custom Category"}</SelectItem>
              </SelectContent>
            </Select>
            {isCustomCategory && (
              <Input
                className="mt-2 h-8 text-xs"
                placeholder={t("catalog.custom_category_placeholder")}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            )}
          </Field>
          <Field label={`${t("catalog.purity")} *`}>
            <Select value={String(purity)} onValueChange={setPurity}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PURITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.value} ({p.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`${t("catalog.approx_gross")} (g)`}>
            <Input
              type="number"
              step="0.001"
              value={grossG}
              onChange={(e) => handleGrossChange(e.target.value)}
              placeholder="8.500"
              className="h-8 text-xs"
            />
          </Field>
          <Field label={`${t("catalog.approx_net")} (g)`}>
            <Input
              type="number"
              step="0.001"
              value={netG}
              onChange={(e) => setNetG(e.target.value)}
              placeholder="8.500"
              className="h-8 text-xs"
            />
          </Field>
          <Field label={t("catalog.making_difficulty")}>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t("catalog.difficulty_easy")}</SelectItem>
                <SelectItem value="medium">{t("catalog.difficulty_medium")}</SelectItem>
                <SelectItem value="hard">{t("catalog.difficulty_hard")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("catalog.source")}>
            <Select value={source} onValueChange={(v) => setSource(v as DesignSource)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">{t("catalog.source_internal")}</SelectItem>
                <SelectItem value="customer_reference">
                  {t("catalog.source_customer_reference")}
                </SelectItem>
                <SelectItem value="external">{t("catalog.source_external")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {source === "customer_reference" && (
            <Field label={t("catalog.customer")}>
              <Select
                value={customerId || "none"}
                onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("catalog.no_customer")}</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label={t("catalog.tags")}>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={catalogSettings.tags.join(", ") || t("catalog.tags_placeholder")}
                className="h-8 text-xs"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("catalog.notes")}>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
            </Field>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <AttachmentButton
              entityType="catalog"
              entityId={draftId}
              docKey="design_photo"
              docLabel={t("catalog.design_photo")}
              title={t("catalog.add_design_photo")}
              variant="outline"
              className="gap-2"
            />
            <AttachmentButton
              entityType="catalog"
              entityId={draftId}
              docKey="customer_reference"
              docLabel={t("catalog.customer_reference_attachment")}
              title={t("catalog.attach_customer_reference")}
              variant="outline"
              className="gap-2"
            />
            <AttachmentButton
              entityType="catalog"
              entityId={draftId}
              docKey="tech_drawing"
              docLabel={t("catalog.technical_drawing")}
              title={t("catalog.attach_technical_drawing")}
              variant="outline"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("catalog.cancel")}
          </Button>
          <Button onClick={save} disabled={!designName.trim() || !category} className="bg-gold text-white hover:bg-gold/90 font-semibold">
            <Sparkles className="h-4 w-4 mr-2" /> {t("catalog.save_design")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

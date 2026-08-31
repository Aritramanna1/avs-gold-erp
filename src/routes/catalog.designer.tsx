import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalog, type Design } from "@/lib/catalog-store";
import { useDesignCatalogStore } from "@/lib/design-catalog-store";
import {
  compileCatalogPagesHtml,
  generateDesignerCatalogPdf,
  resolveDesignPhoto,
} from "@/lib/design-catalog-engine";
import { mgToGrams } from "@/lib/gold";
import { ITEM_CATEGORIES } from "@/lib/orders-store";
import { useSettings } from "@/lib/settings-store";
import {
  Crown,
  Sparkles,
  LayoutTemplate,
  FileDown,
  Eye,
  Check,
  CheckSquare,
  Square,
  Search,
  SlidersHorizontal,
  ArrowRight,
  Printer,
  Image as ImageIcon,
  Zap,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/catalog/designer")({
  head: () => ({ meta: [{ title: "Designer Catalog · AVS Gold ERP" }] }),
  component: DesignerCatalogPage,
});

function DesignerCatalogPage() {
  const designs = useCatalog((s) => s.designs);
  const catalogSettings = useSettings((s) => s.catalog);
  const firmSettings = useSettings((s) => s.firm);
  const { templates, defaultTemplateId, textBlocks, updateTextBlock, resetTextBlocks } = useDesignCatalogStore();

  // Selection & Hero state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [heroId, setHeroId] = useState<string | undefined>(undefined);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplateId);
  const [collectionTitle, setCollectionTitle] = useState(
    textBlocks.collectionTitle?.content || "DIWALI 2026 COLLECTION",
  );
  const [catalogTitle, setCatalogTitle] = useState("EXQUISITE JEWELLERY CATALOGUE");

  // Filters
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [purityFilter, setPurityFilter] = useState("all");
  const [weightFilter, setWeightFilter] = useState("all");

  // Preview & Export state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [textBlocksOpen, setTextBlocksOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  const categories = useMemo(() => {
    return Array.from(
      new Set([...catalogSettings.categories, ...ITEM_CATEGORIES, ...designs.map((d) => d.category)]),
    ).filter(Boolean);
  }, [catalogSettings.categories, designs]);

  // Fast filter matching
  const filteredDesigns = useMemo(() => {
    return designs.filter((d) => {
      if (cat !== "all" && d.category !== cat) return false;
      if (purityFilter !== "all" && String(d.purity) !== purityFilter) return false;

      const netG = (d.approxNetMg || d.approxGrossMg || 0) / 1000;
      if (weightFilter === "under_5g" && netG >= 5) return false;
      if (weightFilter === "under_10g" && netG >= 10) return false;
      if (weightFilter === "5g_to_10g" && (netG < 5 || netG >= 10)) return false;
      if (weightFilter === "10g_to_20g" && (netG < 10 || netG >= 20)) return false;
      if (weightFilter === "above_20g" && netG < 20) return false;

      if (q) {
        const query = q.toLowerCase();
        const hay = [d.designNumber, d.designName, d.category, ...(d.tags ?? []), d.notes ?? ""].join(" ").toLowerCase();
        if (query.includes("under 10g") || query.includes("under 10 g") || query.includes("< 10g")) {
          if (netG >= 10) return false;
        }
        if (!hay.includes(query) && !query.includes(d.category.toLowerCase())) return false;
      }
      return true;
    });
  }, [designs, cat, purityFilter, weightFilter, q]);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (heroId === id) setHeroId(undefined);
      } else {
        next.add(id);
        if (!heroId) setHeroId(id); // auto-designate first selected as hero
      }
      return next;
    });
  }, [heroId]);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredDesigns.forEach((d) => next.add(d.id));
      if (!heroId && filteredDesigns.length > 0) setHeroId(filteredDesigns[0].id);
      return next;
    });
  }, [filteredDesigns, heroId]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setHeroId(undefined);
  }, []);

  const selectedDesigns = useMemo(() => {
    return designs.filter((d) => selectedIds.has(d.id));
  }, [designs, selectedIds]);

  const allFilteredSelected = filteredDesigns.length > 0 && filteredDesigns.every((d) => selectedIds.has(d.id));

  // Compile preview HTML
  const { pagesHtml, totalPages } = useMemo(() => {
    if (selectedDesigns.length === 0 || !activeTemplate) return { pagesHtml: [], totalPages: 0 };
    return compileCatalogPagesHtml(selectedDesigns, heroId, activeTemplate, {
      collectionName: collectionTitle,
      catalogTitle,
    });
  }, [selectedDesigns, heroId, activeTemplate, collectionTitle, catalogTitle]);

  // PDF Export
  async function handleExportPdf() {
    if (selectedDesigns.length === 0) {
      toast.error("Please select at least 1 design for the catalog.");
      return;
    }
    setExporting(true);
    try {
      const { blob, fileName, pageCount } = await generateDesignerCatalogPdf(
        selectedDesigns,
        heroId,
        activeTemplate,
        { collectionName: collectionTitle, catalogTitle },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Designer brochure exported successfully (${pageCount} page(s))!`);
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title="Design Catalog — Premium Brochure Studio"
        subtitle="Create high-end, editorial jewellery brochures with hero spotlight products and HTML/CSS/SVG templates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/catalog">
                <Zap className="h-4 w-4 text-gold" /> Fast Catalog
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setTextBlocksOpen(true)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4 text-gold" /> Edit Text Blocks
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link to="/settings" search={{ tab: "catalog" }}>
                <LayoutTemplate className="h-4 w-4" /> Template Importer
              </Link>
            </Button>
            <Button
              onClick={() => {
                if (selectedDesigns.length === 0) {
                  toast.error("Select at least 1 product first.");
                  return;
                }
                setPreviewOpen(true);
              }}
              disabled={selectedDesigns.length === 0}
              className="gap-2 bg-gold hover:bg-gold/90 text-white font-semibold shadow-sm"
            >
              <Eye className="h-4 w-4" /> Preview &amp; Export Brochure
            </Button>
          </div>
        }
      />

      {/* ── Studio Top Bar: Template, Hero & Titles ── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5 text-gold" /> Designer Template
              </label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.productsPerPage} items/p)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-gold" /> Designated Hero Product
              </label>
              <Select value={heroId || "none"} onValueChange={(v) => setHeroId(v === "none" ? undefined : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Hero Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Hero (Uniform Grid)</SelectItem>
                  {selectedDesigns.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.designNumber} — {d.designName} ({mgToGrams(d.approxNetMg || d.approxGrossMg)}g)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Collection Banner Title
              </label>
              <Input
                value={textBlocks.collectionTitle?.content || collectionTitle}
                onChange={(e) => {
                  setCollectionTitle(e.target.value);
                  updateTextBlock("collectionTitle", e.target.value);
                }}
                placeholder="e.g. DIWALI 2026 COLLECTION"
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTextBlocksOpen(true)}
                className="flex-1 h-9 text-xs gap-1.5 border-gold/40 hover:bg-gold/5"
              >
                <SlidersHorizontal className="h-4 w-4 text-gold" /> Dynamic Text
              </Button>
              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={selectedDesigns.length === 0 || exporting}
                className="flex-1 h-9 text-xs gap-1.5 bg-gold hover:bg-gold/90 text-white font-semibold"
              >
                <FileDown className="h-4 w-4" /> {exporting ? "Compiling..." : "Export PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Product Selection & Filters Bar ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={allFilteredSelected ? deselectAll : selectAllFiltered}
              className="h-8 text-xs gap-1.5"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-3.5 w-3.5 text-gold" />
              ) : (
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {allFilteredSelected ? "Deselect All" : "Select All Filtered"}
            </Button>
            <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30 font-semibold px-2 py-0.5">
              {selectedIds.size} Products Selected
            </Badge>
            {heroId && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1">
                <Crown className="h-3 w-3" /> Hero Assigned
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search or 'under 10g'..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={weightFilter} onValueChange={setWeightFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Weight" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weights</SelectItem>
                <SelectItem value="under_5g">&lt; 5g</SelectItem>
                <SelectItem value="under_10g">&lt; 10g</SelectItem>
                <SelectItem value="5g_to_10g">5g – 10g</SelectItem>
                <SelectItem value="10g_to_20g">10g – 20g</SelectItem>
                <SelectItem value="above_20g">&gt; 20g</SelectItem>
              </SelectContent>
            </Select>

            <Select value={purityFilter} onValueChange={setPurityFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Purity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purities</SelectItem>
                <SelectItem value="995">995‰ (24K)</SelectItem>
                <SelectItem value="916">916‰ (22K)</SelectItem>
                <SelectItem value="750">750‰ (18K)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Product Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDesigns.map((d) => {
            const isSelected = selectedIds.has(d.id);
            const isHero = heroId === d.id;
            const photo = resolveDesignPhoto(d);

            return (
              <div
                key={d.id}
                onClick={() => toggleSelect(d.id)}
                className={`
                  relative rounded-xl border p-3 cursor-pointer transition-all duration-200 flex flex-col justify-between bg-card
                  ${isHero
                    ? "border-amber-500 ring-2 ring-amber-500/40 bg-amber-500/5 shadow-md"
                    : isSelected
                    ? "border-gold ring-2 ring-gold/40 bg-gold/5 shadow-sm"
                    : "border-border hover:border-gold/40 hover:bg-muted/20"
                  }
                `}
              >
                {/* Top Badge Indicators */}
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`h-5 w-5 rounded flex items-center justify-center border text-xs shadow-sm ${
                      isSelected ? "bg-gold border-gold text-white" : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex items-center gap-1">
                    {isHero && (
                      <Badge className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0 h-4">
                        HERO
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] font-mono border-gold/40 text-gold font-bold">
                      {d.purity}‰
                    </Badge>
                  </div>
                </div>

                {/* Product Photo */}
                <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center p-2 mb-2">
                  {photo ? (
                    <img src={photo} alt={d.designName} className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1">
                  <div className="font-semibold text-xs truncate text-foreground">{d.designName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono flex justify-between">
                    <span>{d.designNumber}</span>
                    <span>{d.category}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex justify-between border-t border-border/40 pt-1">
                    <span>GW: {mgToGrams(d.approxGrossMg)}g</span>
                    <span className="text-foreground font-medium">NW: {mgToGrams(d.approxNetMg || d.approxGrossMg)}g</span>
                  </div>
                </div>

                {/* Hero Product Toggle Button */}
                {isSelected && (
                  <Button
                    type="button"
                    size="sm"
                    variant={isHero ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeroId(isHero ? undefined : d.id);
                    }}
                    className={`mt-2.5 h-6 text-[10px] w-full gap-1 ${
                      isHero ? "bg-amber-500 text-black hover:bg-amber-600 font-bold" : "text-amber-500 border-amber-500/40"
                    }`}
                  >
                    <Crown className="h-3 w-3" /> {isHero ? "Active Hero Product" : "Set as Hero Product"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Live WYSIWYG Modal Preview ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[96vw] max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Catalogue Preview — {activeTemplate?.name} ({totalPages} Page(s))
            </DialogTitle>
            <DialogDescription>
              {selectedDesigns.length} products arranged in brochure layout • Ready for client export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-3">
            <style dangerouslySetInnerHTML={{ __html: activeTemplate?.css || "" }} />
            {pagesHtml.map((pageHtml, idx) => (
              <div key={idx} className="border border-border/80 rounded-xl overflow-hidden shadow-2xl mx-auto max-w-[210mm]">
                <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close Preview
            </Button>
            <Button
              onClick={handleExportPdf}
              disabled={exporting}
              className="bg-gold hover:bg-gold/90 text-white font-semibold gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              {exporting ? "Generating PDF..." : "Export Full PDF Brochure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dynamic Text Blocks Editor Dialog ── */}
      <Dialog open={textBlocksOpen} onOpenChange={setTextBlocksOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              Dynamic Catalog Text Blocks
            </DialogTitle>
            <DialogDescription>
              Customize every text block in the catalog brochure. Changes save permanently to your catalog settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {Object.values(textBlocks).map((block) => (
              <div key={block.id} className="space-y-1.5 p-3 rounded-lg border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {block.label}
                  </label>
                  <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                    {"{{"}text.{block.id}{"}}"}
                  </span>
                </div>
                {block.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={block.content}
                    onChange={(e) => {
                      updateTextBlock(block.id, e.target.value);
                      if (block.id === "collectionTitle") setCollectionTitle(e.target.value);
                    }}
                    placeholder={block.defaultValue}
                    className="w-full text-xs rounded-md border border-input bg-background p-2 focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                ) : (
                  <Input
                    value={block.content}
                    onChange={(e) => {
                      updateTextBlock(block.id, e.target.value);
                      if (block.id === "collectionTitle") setCollectionTitle(e.target.value);
                    }}
                    placeholder={block.defaultValue}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetTextBlocks();
                setCollectionTitle("DIWALI 2026 COLLECTION");
                toast.success("Text blocks restored to defaults.");
              }}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset Defaults
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setTextBlocksOpen(false);
                toast.success("Catalog text blocks saved!");
              }}
              className="bg-gold hover:bg-gold/90 text-white font-semibold"
            >
              Done &amp; Update Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * MTJ ERP — Catalog Design & Template Settings Panel
 *
 * Configurable from Settings / Customization -> Catalog Design.
 * Includes:
 * - Default template picker & custom HTML/CSS/SVG template importer
 * - Page sizes & layout geometry
 * - Visible fields toggles
 * - Company branding, header titles, and footer notes
 */
import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings, flushSettingsPersistence } from "@/lib/settings-store";
import { useDesignCatalogStore } from "@/lib/design-catalog-store";
import { type DesignerTemplateManifest } from "@/lib/designer-templates-library";
import {
  LayoutTemplate,
  Check,
  RotateCcw,
  Sparkles,
  Eye,
  Sliders,
  Palette,
  FileText,
  Building2,
  Layers,
  Upload,
  Download,
  Copy,
  Trash2,
  Plus,
  Code,
} from "lucide-react";
import { toast } from "sonner";

export function CatalogDesignSettingsPanel() {
  const catalog = useSettings((s) => s.catalog);
  const setCatalog = useSettings((s) => s.setCatalog);
  const {
    templates,
    defaultTemplateId,
    setDefaultTemplate,
    importTemplate,
    duplicateTemplate,
    deleteTemplate,
    resetToBuiltInTemplates,
  } = useDesignCatalogStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Template Import Modal State
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDesc, setImportDesc] = useState("");
  const [importPerPage, setImportPerPage] = useState(6);
  const [importHtml, setImportHtml] = useState("");
  const [importCss, setImportCss] = useState("");

  // Template Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<DesignerTemplateManifest | null>(null);

  // Settings State
  const [defaultPageSize, setDefaultPageSize] = useState(catalog.defaultPageSize || "a4_portrait");
  const [defaultProductsPerPage, setDefaultProductsPerPage] = useState(catalog.defaultProductsPerPage || 4);
  const [showPrice, setShowPrice] = useState(catalog.showPrice ?? true);
  const [showWeight, setShowWeight] = useState(catalog.showWeight ?? true);
  const [showPurity, setShowPurity] = useState(catalog.showPurity ?? true);
  const [showItemCode, setShowItemCode] = useState(catalog.showItemCode ?? true);
  const [showDescription, setShowDescription] = useState(catalog.showDescription ?? false);
  const [showHsn, setShowHsn] = useState(catalog.showHsn ?? false);
  const [showFine, setShowFine] = useState(catalog.showFine ?? true);
  const [showBranding, setShowBranding] = useState(catalog.showBranding ?? true);
  const [showFooter, setShowFooter] = useState(catalog.showFooter ?? true);
  const [showPageNumber, setShowPageNumber] = useState(catalog.showPageNumber ?? true);
  const [headerTitle, setHeaderTitle] = useState(catalog.headerTitle || "EXQUISITE JEWELLERY CATALOGUE");
  const [footerText, setFooterText] = useState(catalog.footerText || "Certified 100% Hallmarked Jewellery • All weights approximate");
  const [themeBackground, setThemeBackground] = useState(catalog.themeBackground || "cream");

  async function handleSave() {
    setSaving(true);
    try {
      setCatalog({
        defaultTemplateId,
        defaultPageSize,
        defaultProductsPerPage,
        showPrice,
        showWeight,
        showPurity,
        showItemCode,
        showDescription,
        showHsn,
        showFine,
        showBranding,
        showFooter,
        showPageNumber,
        headerTitle,
        footerText,
        themeBackground,
      });

      const res = await flushSettingsPersistence();
      if (!res.ok) throw new Error(res.error || "Persistence failed");
      toast.success("Catalog design & template settings saved successfully!");
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function handleImportFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.name && parsed.html && parsed.css) {
          const res = importTemplate(parsed);
          if (res.ok) {
            toast.success(`Template "${parsed.name}" imported successfully!`);
            setImportOpen(false);
          } else {
            toast.error(res.error || "Failed to import template.");
          }
        } else {
          toast.error("JSON file must contain 'name', 'html', and 'css' fields.");
        }
      } catch (err) {
        toast.error("Invalid JSON template file.");
      }
    };
    reader.readAsText(file);
  }

  function handleManualImport() {
    if (!importName.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (!importHtml.trim()) {
      toast.error("HTML template code is required.");
      return;
    }
    if (!importCss.trim()) {
      toast.error("CSS stylesheet is required.");
      return;
    }

    const res = importTemplate({
      name: importName,
      description: importDesc,
      productsPerPage: importPerPage,
      html: importHtml,
      css: importCss,
    });

    if (res.ok) {
      toast.success(`Template "${importName}" imported successfully!`);
      setImportOpen(false);
      setImportName("");
      setImportDesc("");
      setImportHtml("");
      setImportCss("");
    } else {
      toast.error(res.error || "Failed to import template.");
    }
  }

  function exportTemplateJson(tpl: DesignerTemplateManifest) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tpl, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `catalog-template-${tpl.id}.json`;
    a.click();
    toast.success(`Exported ${tpl.name} template package!`);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold font-serif text-gold flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" /> Catalog Design &amp; HTML Template Studio
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure default layouts, visible fields, branding, and import HTML/CSS/SVG templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import HTML Template
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 text-xs bg-gold hover:bg-gold/90 text-white font-semibold shadow-sm"
          >
            <Check className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Catalog Settings"}
          </Button>
        </div>
      </div>

      {/* ── 1. Designer Templates Registry ── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-gold" /> Registered Catalog Templates ({templates.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Active HTML/CSS/SVG templates. Click to set default or preview.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToBuiltInTemplates}
              className="text-[11px] h-7 text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset Starter Templates
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((tpl) => {
              const isDefault = defaultTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`
                    rounded-lg border p-3.5 transition-all duration-200 flex flex-col justify-between bg-card
                    ${isDefault
                      ? "border-gold bg-gold/5 shadow-sm ring-2 ring-gold/40"
                      : "border-border hover:border-gold/40"
                    }
                  `}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{tpl.name}</span>
                      {isDefault ? (
                        <Badge className="bg-gold text-white text-[9px] font-bold px-1.5 py-0 h-4">
                          Default
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">
                          {tpl.isBuiltIn ? "Built-In" : "Custom"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{tpl.description}</p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/40 space-y-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{tpl.pageSize} • {tpl.productsPerPage} Items/Page</span>
                      <span>{tpl.supportsHero ? "Hero Enabled" : "Grid"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDefaultTemplate(tpl.id);
                            toast.success(`Set "${tpl.name}" as default catalog template.`);
                          }}
                          className="h-6 text-[10px] flex-1"
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewTemplate(tpl)}
                        className="h-6 px-2 text-[10px]"
                        title="View Code & Preview"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => exportTemplateJson(tpl)}
                        className="h-6 px-2 text-[10px]"
                        title="Export JSON Package"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const copy = duplicateTemplate(tpl.id);
                          if (copy) toast.success(`Duplicated "${tpl.name}"`);
                        }}
                        className="h-6 px-2 text-[10px]"
                        title="Duplicate"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {!tpl.isBuiltIn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete custom template "${tpl.name}"?`)) {
                              deleteTemplate(tpl.id);
                              toast.info(`Deleted "${tpl.name}"`);
                            }
                          }}
                          className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Page & Layout Settings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-gold" /> Page &amp; Geometry Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Default dimensions and background theme styling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Page Size</Label>
              <Select value={defaultPageSize} onValueChange={(v: any) => setDefaultPageSize(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4_portrait">A4 Portrait (210 × 297 mm) — Standard</SelectItem>
                  <SelectItem value="a4_landscape">A4 Landscape (297 × 210 mm)</SelectItem>
                  <SelectItem value="a5_portrait">A5 Portrait (148 × 210 mm)</SelectItem>
                  <SelectItem value="square">Square Booklet (210 × 210 mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Theme Background</Label>
              <Select value={themeBackground} onValueChange={(v: any) => setThemeBackground(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">Clean White</SelectItem>
                  <SelectItem value="cream">Warm Cream / Light Gold</SelectItem>
                  <SelectItem value="dark">Luxury Dark Onyx</SelectItem>
                  <SelectItem value="gradient">Subtle Gold Gradient</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Field Visibility Controls ── */}
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-gold" /> Product Field Visibility
            </CardTitle>
            <CardDescription className="text-xs">
              Default field bindings displayed in exported catalogues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">Gross &amp; Net Weights</div>
                <div className="text-[11px] text-muted-foreground">Show GW and NW in grams (g)</div>
              </div>
              <Switch checked={showWeight} onCheckedChange={setShowWeight} />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">Gold Purity &amp; Touch</div>
                <div className="text-[11px] text-muted-foreground">Show per-mille (e.g. 916‰ / 22K)</div>
              </div>
              <Switch checked={showPurity} onCheckedChange={setShowPurity} />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">Design Code &amp; Item Number</div>
                <div className="text-[11px] text-muted-foreground">Show unique design alphanumeric code</div>
              </div>
              <Switch checked={showItemCode} onCheckedChange={setShowItemCode} />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">Fine Gold Equivalent</div>
                <div className="text-[11px] text-muted-foreground">Show calculated pure gold weight</div>
              </div>
              <Switch checked={showFine} onCheckedChange={setShowFine} />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="font-medium">Price / Indicative Rate</div>
                <div className="text-[11px] text-muted-foreground">Show bullion estimate or labour charges</div>
              </div>
              <Switch checked={showPrice} onCheckedChange={setShowPrice} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Branding & Header / Footer ── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gold" /> Branding &amp; Document Annotations
          </CardTitle>
          <CardDescription className="text-xs">
            Banner titles, company header branding, and hallmarking notices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catalogue Header Title</Label>
              <Input
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                placeholder="EXQUISITE JEWELLERY CATALOGUE"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Footer Hallmarking Note</Label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Certified 100% Hallmarked Jewellery • All weights approximate"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="font-medium">Show Company Header</span>
              <Switch checked={showBranding} onCheckedChange={setShowBranding} />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Show Footer Note</span>
              <Switch checked={showFooter} onCheckedChange={setShowFooter} />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Show Page Numbers</span>
              <Switch checked={showPageNumber} onCheckedChange={setShowPageNumber} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Import Template Modal ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import HTML/CSS Template Package
            </DialogTitle>
            <DialogDescription>
              Upload a JSON template package or paste HTML/CSS with data bindings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="p-3 bg-muted/20 border border-dashed border-border rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium text-xs">Upload .json Template Package</div>
                <div className="text-[11px] text-muted-foreground">Contains manifest, HTML template, and CSS styles.</div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileUpload}
                accept=".json"
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs gap-1.5"
              >
                <Upload className="h-3 w-3" /> Select File
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Template Name *</Label>
                <Input
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="e.g. Royal Bridal Lookbook"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Products Per Page</Label>
                <Input
                  type="number"
                  value={importPerPage}
                  onChange={(e) => setImportPerPage(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={importDesc}
                onChange={(e) => setImportDesc(e.target.value)}
                placeholder="Description of this catalogue layout..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">HTML Template Code *</Label>
              <Textarea
                rows={6}
                value={importHtml}
                onChange={(e) => setImportHtml(e.target.value)}
                placeholder="<div class='catalog-page'>\n  <h1>{{company.name}}</h1>\n  {{#products}}\n    <div>{{name}} - {{netWeight}}g</div>\n  {{/products}}\n</div>"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">CSS Stylesheet *</Label>
              <Textarea
                rows={4}
                value={importCss}
                onChange={(e) => setImportCss(e.target.value)}
                placeholder=".catalog-page { width: 210mm; min-height: 297mm; background: #fff; }"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleManualImport} className="bg-gold text-white hover:bg-gold/90 font-semibold">
              <Plus className="h-4 w-4 mr-1.5" /> Save &amp; Import Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Code / Inspect Template Modal ── */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => !o && setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <Code className="h-5 w-5" /> {previewTemplate?.name} — Template Source
            </DialogTitle>
            <DialogDescription>{previewTemplate?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-gold">HTML Template</Label>
              <pre className="p-3 bg-muted/40 rounded-lg overflow-x-auto text-[11px] font-mono border border-border">
                {previewTemplate?.html}
              </pre>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-gold">CSS Styles</Label>
              <pre className="p-3 bg-muted/40 rounded-lg overflow-x-auto text-[11px] font-mono border border-border">
                {previewTemplate?.css}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

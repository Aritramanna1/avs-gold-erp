/**
 * /catalog/templates — Catalog Page Template Browser & Export
 *
 * Allows the user to:
 *   SELECT DESIGN → SELECT PRODUCTS → PREVIEW → EXPORT PDF
 *
 * Uses the Universal Print Engine (usePrintEngine) for PDF/print output.
 * Templates control PRESENTATION only; product data is authoritative.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  useCatalogTemplates,
  type CatalogTemplate,
  type CatalogTemplateConfig,
  DEFAULT_TEMPLATES,
} from "@/lib/catalog-template-store";
import { useCatalog } from "@/lib/catalog-store";
import { useStock } from "@/lib/stock-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { guardRoute } from "@/lib/permissions";
import {
  LayoutGrid,
  Eye,
  Printer,
  FileDown,
  Copy,
  Trash2,
  Plus,
  Crown,
  Sparkles,
  BookOpen,
  Settings2,
  Check,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/catalog/templates")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Catalog Templates · AVS Gold ERP" }] }),
  component: CatalogTemplatesPage,
});

// ── Page size labels ──────────────────────────────────────────────────────────
const PAGE_SIZE_LABELS: Record<CatalogTemplateConfig["pageSize"], string> = {
  a4_portrait: "A4 Portrait",
  a4_landscape: "A4 Landscape",
  a5_portrait: "A5 Portrait",
  square: "Square / Social",
};

const LAYOUT_LABELS: Record<string, string> = {
  single_hero: "Single Hero",
  two_product: "Two Product",
  three_product: "Three Product",
  four_grid: "Four Grid",
  six_grid: "Six Grid",
  large_image_details: "Large Image + Details",
  minimal: "Minimal",
  luxury: "Luxury Showcase",
  collection: "Collection",
  price_list: "Price List",
  cover_page: "Cover Page",
  section_divider: "Section Divider",
  contact_page: "Contact / End Page",
};

// ── Visual thumbnail preview for each template ────────────────────────────────
function TemplateThumbnail({
  template,
  selected,
  onClick,
}: {
  template: CatalogTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={`catalog-template-card-${template.id}`}
      onClick={onClick}
      className={`
        group relative rounded-xl border-2 transition-all duration-200 overflow-hidden text-left w-full
        ${selected
          ? "border-gold shadow-lg shadow-gold/20 bg-gold/5"
          : "border-border bg-card hover:border-gold/40 hover:shadow-md"
        }
      `}
    >
      {/* Thumbnail visual */}
      <div
        className={`
          h-36 w-full flex flex-col items-center justify-center relative overflow-hidden
          ${template.config.background === "dark"
            ? "bg-zinc-900"
            : template.config.background === "cream"
            ? "bg-amber-50"
            : template.config.background === "gradient"
            ? "bg-gradient-to-br from-amber-900 to-yellow-700"
            : "bg-white"
          }
        `}
        style={{ borderBottom: `3px solid ${template.config.primaryColor}` }}
      >
        {/* Layout preview grid */}
        <CatalogLayoutPreview template={template} />

        {/* Selected overlay */}
        {selected && (
          <div className="absolute top-2 right-2 bg-gold rounded-full p-1">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}
        {template.isDefault && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              Built-in
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-base">{template.thumbnailEmoji}</span>
          <span className="font-medium text-sm truncate">{template.name}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
          {template.description}
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge variant="outline" className="text-[9px] px-1">
            {PAGE_SIZE_LABELS[template.config.pageSize]}
          </Badge>
          <Badge variant="outline" className="text-[9px] px-1">
            {LAYOUT_LABELS[template.layout] || template.layout}
          </Badge>
        </div>
      </div>
    </button>
  );
}

// ── CSS-rendered layout miniature ─────────────────────────────────────────────
function CatalogLayoutPreview({ template }: { template: CatalogTemplate }) {
  const { layout, config } = template;
  const pc = config.primaryColor;
  const bg = config.background === "dark" ? "#ffffff22" : `${pc}22`;

  const box = (key: string | number, full = false) => (
    <div
      key={key}
      className={`rounded ${full ? "h-12" : "h-8"} flex-1 min-w-0`}
      style={{ background: bg, border: `1px solid ${pc}44` }}
    />
  );

  if (layout === "single_hero" || layout === "large_image_details") {
    return (
      <div className="flex flex-col gap-1 w-3/4 h-full justify-center py-3">
        <div className="rounded h-16 w-full" style={{ background: bg, border: `1px solid ${pc}44` }} />
        <div className="h-2 rounded w-3/4" style={{ background: pc, opacity: 0.7 }} />
        <div className="h-1.5 rounded w-1/2" style={{ background: bg, border: `1px solid ${pc}44` }} />
      </div>
    );
  }
  if (layout === "two_product" || layout === "luxury") {
    return (
      <div className="flex gap-2 w-5/6 h-full justify-center items-center py-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div className="h-14 rounded" style={{ background: bg, border: `1px solid ${pc}44` }} />
            <div className="h-1.5 rounded" style={{ background: pc, opacity: 0.6 }} />
            <div className="h-1 rounded w-3/4" style={{ background: bg, border: `1px solid ${pc}44` }} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "three_product") {
    return (
      <div className="flex gap-1.5 w-5/6 h-full justify-center items-center py-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div className="h-12 rounded" style={{ background: bg, border: `1px solid ${pc}44` }} />
            <div className="h-1.5 rounded" style={{ background: pc, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "four_grid" || layout === "collection") {
    return (
      <div className="grid grid-cols-2 gap-1.5 w-5/6 h-full justify-center py-3 content-center">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="h-9 rounded" style={{ background: bg, border: `1px solid ${pc}44` }} />
            <div className="h-1 rounded" style={{ background: pc, opacity: 0.5 }} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "six_grid" || layout === "minimal") {
    return (
      <div className="grid grid-cols-3 gap-1 w-5/6 h-full justify-center py-3 content-center">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="h-7 rounded" style={{ background: bg, border: `1px solid ${pc}44` }} />
            <div className="h-0.5 rounded" style={{ background: pc, opacity: 0.4 }} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "price_list") {
    return (
      <div className="flex flex-col gap-1 w-5/6 h-full justify-center py-3">
        <div className="h-3 rounded w-full" style={{ background: pc, opacity: 0.7 }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-2 rounded flex-1" style={{ background: bg, border: `1px solid ${pc}33` }} />
            <div className="h-2 rounded w-8" style={{ background: bg, border: `1px solid ${pc}33` }} />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "cover_page") {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full py-2 gap-2">
        <div className="h-8 w-8 rounded-full" style={{ background: pc, opacity: 0.6 }} />
        <div className="h-2 rounded w-1/2" style={{ background: pc, opacity: 0.8 }} />
        <div className="h-1 rounded w-1/3" style={{ background: bg, border: `1px solid ${pc}44` }} />
      </div>
    );
  }
  // Fallback
  return (
    <div className="flex gap-2 w-3/4 justify-center py-2">
      {box(0)} {box(1)}
    </div>
  );
}

// ── Product picker ────────────────────────────────────────────────────────────
function ProductPicker({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const designs = useCatalog((s) => s.designs);
  const stockItems = useStock((s) => s.items);
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const designItems = designs.map((d) => ({
      id: `design:${d.id}`,
      name: d.designName || d.designNumber,
      code: d.designNumber,
      category: d.category,
      purity: d.purity,
      grossG: mgToGrams(d.approxGrossMg),
      netG: mgToGrams(d.approxNetMg),
      source: "Design",
    }));
    const stockList = stockItems.map((s) => ({
      id: `stock:${s.id}`,
      name: s.itemName,
      code: s.itemCode,
      category: s.category || "—",
      purity: s.purity,
      grossG: mgToGrams(s.grossMg),
      netG: mgToGrams(s.netMg),
      source: "Stock",
    }));
    const all = [...designItems, ...stockList];
    if (!q) return all;
    const lq = q.toLowerCase();
    return all.filter(
      (i) =>
        i.name.toLowerCase().includes(lq) ||
        i.code.toLowerCase().includes(lq) ||
        i.category.toLowerCase().includes(lq),
    );
  }, [designs, stockItems, q]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search products by name, code or category…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No products found. Add designs or stock items first.
          </p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            id={`catalog-product-pick-${item.id}`}
            onClick={() => onToggle(item.id)}
            className={`
              w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors text-sm
              ${selected.has(item.id)
                ? "bg-gold/10 border border-gold/30"
                : "hover:bg-muted/50 border border-transparent"
              }
            `}
          >
            <div
              className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center
                ${selected.has(item.id) ? "bg-gold border-gold" : "border-border"}`}
            >
              {selected.has(item.id) && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {item.code} · {item.category} · {item.purity} · {item.grossG}g
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] flex-shrink-0">
              {item.source}
            </Badge>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.size} product{selected.size !== 1 ? "s" : ""} selected
      </p>
    </div>
  );
}

// ── Catalog preview renderer ──────────────────────────────────────────────────
function CatalogPagePreview({
  template,
  products,
  branding,
}: {
  template: CatalogTemplate;
  products: ReturnType<typeof buildProductsForPreview>;
  branding: { name: string; address: string; phone: string; gstin: string; website: string };
}) {
  const { config, layout } = template;
  const pc = config.primaryColor;
  const isDark = config.background === "dark";
  const textCls = isDark ? "text-white" : "text-zinc-800";
  const mutedCls = isDark ? "text-zinc-400" : "text-zinc-500";
  const bgStyle: React.CSSProperties =
    config.background === "gradient"
      ? { background: `linear-gradient(135deg, ${pc}22, ${config.accentColor}11)` }
      : config.background === "dark"
      ? { background: "#1a1a1a" }
      : config.background === "cream"
      ? { background: "#fdf6e3" }
      : { background: "#ffffff" };

  const page = products.slice(0, config.productsPerPage);

  const isGrid = ["four_grid", "six_grid", "minimal", "collection"].includes(layout);
  const isList = layout === "price_list";
  const isSingle = layout === "single_hero" || layout === "large_image_details";
  const isTwo = layout === "two_product" || layout === "luxury";
  const isThree = layout === "three_product";

  const gridCols = config.productsPerPage <= 2 ? 2 : config.productsPerPage <= 3 ? 3 : config.productsPerPage <= 6 ? 3 : 4;

  return (
    <div
      className={`w-full rounded-lg overflow-hidden shadow-xl border border-border/50 ${textCls}`}
      style={{ ...bgStyle, fontFamily: config.fontFamily === "serif" ? "Georgia, serif" : "Inter, sans-serif", minHeight: 480 }}
    >
      {/* Header / branding */}
      {config.showBranding && (
        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{ borderBottom: `2px solid ${pc}` }}
        >
          <div>
            <div className="font-bold text-sm" style={{ color: pc }}>
              {branding.name}
            </div>
            {branding.phone && (
              <div className={`text-xs ${mutedCls}`}>{branding.phone}</div>
            )}
          </div>
          <div className={`text-xs ${mutedCls} text-right`}>
            {branding.gstin && <div>GSTIN: {branding.gstin}</div>}
            {branding.website && <div>{branding.website}</div>}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex-1">
        {isList ? (
          // Price list layout
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: pc, color: "#fff" }}>
                <th className="px-2 py-1 text-left">Item</th>
                {config.showItemCode && <th className="px-2 py-1 text-left">Code</th>}
                {config.showPurity && <th className="px-2 py-1 text-right">Purity</th>}
                {config.showWeight && <th className="px-2 py-1 text-right">G.Wt</th>}
                {config.showWeight && <th className="px-2 py-1 text-right">N.Wt</th>}
                {config.showPrice && <th className="px-2 py-1 text-right">Rate</th>}
              </tr>
            </thead>
            <tbody>
              {page.map((p, i) => (
                <tr
                  key={p.id}
                  style={{ background: i % 2 === 0 ? `${pc}08` : "transparent" }}
                >
                  <td className="px-2 py-1">{p.name}</td>
                  {config.showItemCode && <td className="px-2 py-1 opacity-70">{p.code}</td>}
                  {config.showPurity && <td className="px-2 py-1 text-right">{p.purity}</td>}
                  {config.showWeight && <td className="px-2 py-1 text-right">{p.grossG}g</td>}
                  {config.showWeight && <td className="px-2 py-1 text-right">{p.netG}g</td>}
                  {config.showPrice && (
                    <td className="px-2 py-1 text-right" style={{ color: pc }}>
                      {p.price || "On Req."}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : isSingle ? (
          // Hero layout
          <div className="flex gap-4 h-full items-start">
            <div className="flex-1 rounded-lg bg-black/10 flex items-center justify-center overflow-hidden" style={{ minHeight: 200 }}>
              {page[0]?.photoUrl ? (
                <img src={page[0].photoUrl} alt={page[0].name} className="w-full h-52 object-contain p-2" />
              ) : page[0] ? (
                <div className={`text-center ${mutedCls}`}>
                  <div className="text-4xl mb-2">💍</div>
                  <div className="text-xs">{page[0].category}</div>
                </div>
              ) : (
                <div className={`text-xs ${mutedCls}`}>No product selected</div>
              )}
            </div>
            {page[0] && (
              <div className="flex-1 space-y-2">
                <div className="text-xl font-bold" style={{ color: pc }}>{page[0].name}</div>
                {config.showItemCode && <div className={`text-xs ${mutedCls}`}>{page[0].code}</div>}
                {config.showPurity && <div className="text-sm">{page[0].purity} · {page[0].category}</div>}
                {config.showWeight && (
                  <div className="text-sm">GW: {page[0].grossG}g · NW: {page[0].netG}g</div>
                )}
                {config.showDescription && (
                  <div className={`text-xs ${mutedCls} leading-relaxed`}>{page[0].description}</div>
                )}
                {config.showPrice && (
                  <div className="text-lg font-bold" style={{ color: pc }}>{page[0].price || "Price on Request"}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Grid layouts
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${isTwo ? 2 : isThree ? 3 : gridCols}, 1fr)` }}
          >
            {(page.length ? page : [{ id: "empty", name: "Sample Product", code: "SP-001", category: "Ring", purity: "916", grossG: "8.500", netG: "7.800", price: "₹ 45,000", description: "Beautiful handcrafted ring", photoUrl: "" }]).map((p) => (
              <div
                key={p.id}
                className="rounded-lg overflow-hidden"
                style={{ border: `1px solid ${pc}22` }}
              >
                <div
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    background: `${pc}11`,
                    height: config.imageSize === "large" ? 120 : config.imageSize === "small" ? 60 : 90,
                  }}
                >
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-2xl">💍</span>
                  )}
                </div>
                <div className="p-2 space-y-0.5">
                  <div className="font-semibold text-xs truncate" style={{ color: pc }}>{p.name}</div>
                  {config.showItemCode && <div className={`text-[10px] ${mutedCls}`}>{p.code}</div>}
                  {config.showPurity && <div className="text-[10px]">{p.purity}</div>}
                  {config.showWeight && (
                    <div className={`text-[10px] ${mutedCls}`}>G:{p.grossG}g N:{p.netG}g</div>
                  )}
                  {config.showPrice && (
                    <div className="text-xs font-bold" style={{ color: pc }}>{p.price || "On Request"}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {config.showFooter && (
        <div
          className={`px-6 py-2 text-[10px] ${mutedCls} flex justify-between`}
          style={{ borderTop: `1px solid ${pc}33` }}
        >
          <span>{branding.address}</span>
          {config.showPageNumber && <span>Page 1</span>}
        </div>
      )}
    </div>
  );
}

// ── Helper: build product list for preview ────────────────────────────────────
function buildProductsForPreview(selectedIds: Set<string>) {
  const designs = useCatalog.getState().designs;
  const stockItems = useStock.getState().items;
  const result: {
    id: string;
    name: string;
    code: string;
    category: string;
    purity: string;
    grossG: string;
    netG: string;
    price: string;
    description: string;
    photoUrl?: string;
  }[] = [];

  for (const sid of selectedIds) {
    if (sid.startsWith("design:")) {
      const d = designs.find((x) => `design:${x.id}` === sid);
      if (d) {
        result.push({
          id: sid,
          name: d.designName || d.designNumber,
          code: d.designNumber,
          category: d.category,
          purity: String(d.purity),
          grossG: mgToGrams(d.approxGrossMg),
          netG: mgToGrams(d.approxNetMg),
          price: "",
          description: d.notes || "",
          photoUrl: d.photoDataUrl,
        });
      }
    } else if (sid.startsWith("stock:")) {
      const s = stockItems.find((x) => `stock:${x.id}` === sid);
      if (s) {
        result.push({
          id: sid,
          name: s.itemName,
          code: s.itemCode,
          category: s.category || "—",
          purity: String(s.purity),
          grossG: mgToGrams(s.grossMg),
          netG: mgToGrams(s.netMg),
          price: "",
          description: "",
          photoUrl: (s as any).imageUrl || (s as any).photoDataUrl,
        });
      }
    }
  }
  return result;
}

// ── Config panel ──────────────────────────────────────────────────────────────
function TemplateConfigPanel({
  config,
  onChange,
}: {
  config: CatalogTemplateConfig;
  onChange: (patch: Partial<CatalogTemplateConfig>) => void;
}) {
  const row = (label: string, key: keyof CatalogTemplateConfig) => (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch
        id={`cfg-toggle-${key}`}
        checked={!!config[key]}
        onCheckedChange={(v) => onChange({ [key]: v })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Page
        </Label>
        <Select
          value={config.pageSize}
          onValueChange={(v) => onChange({ pageSize: v as CatalogTemplateConfig["pageSize"] })}
        >
          <SelectTrigger className="h-8" id="cfg-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries({
              a4_portrait: "A4 Portrait",
              a4_landscape: "A4 Landscape",
              a5_portrait: "A5 Portrait",
              square: "Square / Social",
            }) as [CatalogTemplateConfig["pageSize"], string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Spacing
        </Label>
        <Select
          value={config.spacing}
          onValueChange={(v) => onChange({ spacing: v as CatalogTemplateConfig["spacing"] })}
        >
          <SelectTrigger className="h-8" id="cfg-spacing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="relaxed">Relaxed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fields
        </Label>
        <div className="space-y-2.5">
          {row("Show Price", "showPrice")}
          {row("Show Weight", "showWeight")}
          {row("Show Purity", "showPurity")}
          {row("Show Item Code", "showItemCode")}
          {row("Show Description", "showDescription")}
          {row("Show Fine Gold", "showFine")}
          {row("Show HSN", "showHsn")}
          {row("Branding", "showBranding")}
          {row("Footer", "showFooter")}
          {row("Page Numbers", "showPageNumber")}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Background
        </Label>
        <Select
          value={config.background}
          onValueChange={(v) => onChange({ background: v as CatalogTemplateConfig["background"] })}
        >
          <SelectTrigger className="h-8" id="cfg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="cream">Cream</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Primary Colour
        </Label>
        <div className="flex items-center gap-2">
          <input
            id="cfg-primary-color"
            type="color"
            value={config.primaryColor}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            className="h-8 w-12 rounded border border-border cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{config.primaryColor}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Font
        </Label>
        <Select
          value={config.fontFamily}
          onValueChange={(v) => onChange({ fontFamily: v as CatalogTemplateConfig["fontFamily"] })}
        >
          <SelectTrigger className="h-8" id="cfg-font">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="serif">Serif (Classic)</SelectItem>
            <SelectItem value="sans">Sans-serif (Modern)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function CatalogTemplatesPage() {
  const templates = useCatalogTemplates((s) => s.templates);
  const selectedId = useCatalogTemplates((s) => s.selectedTemplateId);
  const selectTemplate = useCatalogTemplates((s) => s.selectTemplate);
  const duplicateTemplate = useCatalogTemplates((s) => s.duplicateTemplate);
  const deleteTemplate = useCatalogTemplates((s) => s.deleteTemplate);
  const updateTemplate = useCatalogTemplates((s) => s.updateTemplate);
  const resetToDefaults = useCatalogTemplates((s) => s.resetToDefaults);

  const firmSettings = useSettings((s) => s.firm);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? templates[0];

  const [tab, setTab] = useState<"templates" | "products" | "preview">("templates");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [localConfig, setLocalConfig] = useState<CatalogTemplateConfig | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const effectiveConfig: CatalogTemplateConfig = localConfig ?? selectedTemplate?.config ?? DEFAULT_TEMPLATES[0].config;

  const branding = {
    name: firmSettings?.shopName || "AVS Gold Jewellers",
    address: firmSettings?.address || "",
    phone: firmSettings?.phone || "",
    gstin: firmSettings?.gstin || "",
    website: firmSettings?.website || "",
  };

  const products = useMemo(
    () => buildProductsForPreview(selectedProducts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProducts],
  );

  const toggleProduct = useCallback((id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function handleSelectTemplate(id: string) {
    selectTemplate(id);
    setLocalConfig(null);
  }

  function handleConfigChange(patch: Partial<CatalogTemplateConfig>) {
    setLocalConfig((prev) => ({ ...(prev ?? selectedTemplate.config), ...patch }));
  }

  function handleSaveConfig() {
    if (!localConfig) return;
    updateTemplate(selectedTemplate.id, { config: localConfig });
    setLocalConfig(null);
    toast.success("Template configuration saved");
  }

  function handleDuplicate(id: string) {
    const copy = duplicateTemplate(id);
    selectTemplate(copy.id);
    toast.success(`Created "${copy.name}"`);
  }

  function handleDelete(id: string) {
    try {
      deleteTemplate(id);
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function handlePrint() {
    if (selectedProducts.size === 0) {
      toast.error("Select at least one product before printing");
      return;
    }
    // Open print dialog via window.print on the preview panel
    // The Universal Print Engine is invoked via the preview iframe
    setPreviewOpen(true);
    setTimeout(() => {
      window.print();
    }, 300);
  }

  async function handleExportPDF() {
    if (selectedProducts.size === 0) {
      toast.error("Select at least one product before exporting");
      return;
    }
    const allDesigns = useCatalog.getState().designs;
    const chosenDesigns = Array.from(selectedProducts)
      .map((sid) => {
        if (sid.startsWith("design:")) {
          const id = sid.replace("design:", "");
          return allDesigns.find((d) => d.id === id);
        }
        return null;
      })
      .filter(Boolean) as any[];

    if (!chosenDesigns.length) {
      toast.error("No valid catalog designs found in selection.");
      return;
    }

    try {
      toast.info("Generating multi-page PDF...");
      const { generateMultiPageCatalogPdf } = await import("@/lib/catalog-pdf-generator");
      const { blob, fileName, pageCount } = await generateMultiPageCatalogPdf(chosenDesigns, {
        templateLayout: selectedTemplate?.layout,
        title: selectedTemplate?.name ? `${selectedTemplate.name.toUpperCase()} CATALOGUE` : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${chosenDesigns.length} products across ${pageCount} PDF page(s)!`);
    } catch (err: any) {
      toast.error(`PDF export failed: ${err?.message || "Unknown error"}`);
    }
  }

  const activeTemplates = templates.filter((t) => t.isActive);
  const customTemplates = templates.filter((t) => !t.isDefault);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Catalog Page Designs"
        subtitle="Select a template, choose products, preview and export your catalogue"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5"
              id="btn-catalog-preview"
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5"
              id="btn-catalog-print"
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              size="sm"
              onClick={handleExportPDF}
              className="gap-1.5 bg-gold text-white hover:bg-gold/90"
              id="btn-catalog-export-pdf"
            >
              <FileDown className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ["Templates", templates.length],
          ["Built-in", templates.filter((t) => t.isDefault).length],
          ["Custom", customTemplates.length],
          ["Products Selected", selectedProducts.size],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-md border border-border bg-card p-3 shadow-elegant">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 font-serif text-2xl text-gold">{val}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="templates" id="tab-catalog-templates">
            <LayoutGrid className="h-4 w-4 mr-1.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="products" id="tab-catalog-products">
            <BookOpen className="h-4 w-4 mr-1.5" /> Select Products
            {selectedProducts.size > 0 && (
              <Badge className="ml-1.5 bg-gold text-white text-[10px] px-1">{selectedProducts.size}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview" id="tab-catalog-live-preview">
            <Eye className="h-4 w-4 mr-1.5" /> Live Preview
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Templates ── */}
        <TabsContent value="templates" className="mt-0">
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            {/* Template grid */}
            <div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeTemplates.map((t) => (
                  <div key={t.id} className="relative group">
                    <TemplateThumbnail
                      template={t}
                      selected={t.id === selectedId}
                      onClick={() => handleSelectTemplate(t.id)}
                    />
                    {/* Action menu */}
                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 z-10">
                      <button
                        title="Duplicate"
                        onClick={() => handleDuplicate(t.id)}
                        className="bg-background border border-border rounded p-1 shadow"
                      >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                      {!t.isDefault && (
                        <button
                          title="Delete"
                          onClick={() => handleDelete(t.id)}
                          className="bg-background border border-destructive/40 rounded p-1 shadow"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                  className="gap-1.5 text-muted-foreground"
                  id="btn-catalog-reset-defaults"
                >
                  <RotateCcw className="h-4 w-4" /> Reset to Defaults
                </Button>
              </div>
            </div>

            {/* Config panel */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-4 w-4 text-gold" />
                <span className="font-medium text-sm">Configure: {selectedTemplate?.name}</span>
              </div>

              {selectedTemplate && (
                <TemplateConfigPanel
                  config={effectiveConfig}
                  onChange={handleConfigChange}
                />
              )}

              {localConfig && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" onClick={handleSaveConfig} className="flex-1 gap-1.5" id="btn-catalog-save-config">
                    <Check className="h-3.5 w-3.5" /> Save Config
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLocalConfig(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Products ── */}
        <TabsContent value="products" className="mt-0">
          <div className="rounded-xl border border-border bg-card p-5 max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="font-medium">
                Select products for "{selectedTemplate?.name}"
              </span>
            </div>
            <ProductPicker
              selected={selectedProducts}
              onToggle={toggleProduct}
            />
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={() => setTab("preview")}
                disabled={selectedProducts.size === 0}
                className="gap-1.5 bg-gold text-white hover:bg-gold/90"
                id="btn-catalog-go-preview"
              >
                <Eye className="h-4 w-4" /> Preview Catalogue →
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedProducts(new Set())}
                disabled={selectedProducts.size === 0}
                id="btn-catalog-clear-products"
              >
                Clear All
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Live Preview ── */}
        <TabsContent value="preview" className="mt-0">
          {selectedProducts.size === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No products selected.</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setTab("products")}
                id="btn-catalog-go-select"
              >
                Select Products
              </Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_280px] gap-6">
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Showing {Math.min(selectedProducts.size, effectiveConfig.productsPerPage)} of {selectedProducts.size} products
                  (page 1 of {Math.ceil(selectedProducts.size / effectiveConfig.productsPerPage)})
                </div>

                {/* Printable area */}
                <div id="catalog-print-area">
                  <CatalogPagePreview
                    template={selectedTemplate}
                    products={products}
                    branding={branding}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    <Crown className="h-4 w-4 text-gold" /> Export Options
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Template: <strong>{selectedTemplate?.name}</strong><br />
                    Layout: {LAYOUT_LABELS[selectedTemplate?.layout]}<br />
                    Page: {PAGE_SIZE_LABELS[effectiveConfig.pageSize]}<br />
                    Products: {selectedProducts.size}<br />
                    Pages: ~{Math.ceil(selectedProducts.size / effectiveConfig.productsPerPage)}
                  </p>
                  <Button
                    className="w-full gap-1.5 bg-gold text-white hover:bg-gold/90"
                    onClick={handleExportPDF}
                    id="btn-catalog-preview-export"
                  >
                    <FileDown className="h-4 w-4" /> Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={handlePrint}
                    id="btn-catalog-preview-print"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Full-screen preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-gold flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Catalogue Preview — {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <CatalogPagePreview
              template={selectedTemplate}
              products={products}
              branding={branding}
            />
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handlePrint} className="gap-1.5" id="btn-catalog-dialog-print">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              onClick={handleExportPDF}
              className="gap-1.5 bg-gold text-white hover:bg-gold/90"
              id="btn-catalog-dialog-export"
            >
              <FileDown className="h-4 w-4" /> Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useStock } from "@/lib/stock-store";
import { BarcodeLabelPreview } from "@/components/print/BarcodeLabelPreview";
import { ArrowLeft, Printer, Settings2, LayoutGrid, Sliders } from "lucide-react";

export const Route = createFileRoute("/stock/print/$id")({
  head: () => ({ meta: [{ title: "Tag Preview · AVS Gold ERP" }] }),
  component: TagPreview,
});

function TagPreview() {
  const { id } = Route.useParams();
  const item = useStock((s) => s.items.find((i) => i.id === id));
  const defaultTag = useStock((s) => s.tagSettings);

  // Local printing overrides for instant adjustments
  const [shopName, setShopName] = useState("");
  const [showPrice, setShowPrice] = useState(true);
  const [showHuid, setShowHuid] = useState(true);
  const [showMaking, setShowMaking] = useState(true);
  const [tagSize, setTagSize] = useState("50x38mm");
  const [layout, setLayout] = useState<"dual_landscape" | "portrait_upright" | "single_thermal">(
    "dual_landscape",
  );
  const [customMargin, setCustomMargin] = useState("2");
  const [numCopies, setNumCopies] = useState(2);

  useEffect(() => {
    if (defaultTag) {
      setShopName(defaultTag.shopName || "");
      setShowPrice(defaultTag.showPrice !== false);
      setShowHuid(defaultTag.showHuid !== false);
      setShowMaking(defaultTag.showMaking !== false);
      setTagSize(defaultTag.tagSize || "50x38mm");
    }
  }, [defaultTag]);

  useEffect(() => {
    document.body.classList.add("bg-neutral-50");
    return () => document.body.classList.remove("bg-neutral-50");
  }, []);

  if (!item) return <div className="p-8 text-black">Item not found.</div>;

  function triggerThermalPrint() {
    window.print();
  }

  // Generate preview array based on layout configurations
  const renderCount = layout === "single_thermal" ? 1 : numCopies;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto print:p-0">
        {/* Back and Print Actions bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 print:hidden">
          <div>
            <Link to="/stock/$id" params={{ id: item.id }}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Item
              </Button>
            </Link>
            <h1 className="font-serif text-2xl font-bold text-slate-900 mt-1">
              Jewelry Tag Printing Console
            </h1>
          </div>
          <Button
            onClick={triggerThermalPrint}
            className="gap-2 bg-gold hover:bg-gold/90 text-white font-medium px-5 py-5 shadow-lg shadow-gold/20"
          >
            <Printer className="h-5 w-5" /> Print Tag Sticker
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Label Preview Sheet container */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 shadow-sm flex flex-col items-center justify-center min-h-[450px]">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-6 print:hidden flex items-center gap-1">
              <LayoutGrid className="h-3.5 w-3.5" /> LIVE TAG PREVIEW (Browser &amp; Thermal output)
            </div>

            {/* Simulated sticker roll layout */}
            <div
              className={`grid gap-6 justify-items-center ${layout === "dual_landscape" ? "grid-cols-2 max-w-2xl" : "grid-cols-1 max-w-sm"}`}
              style={{ padding: `${customMargin}mm` }}
            >
              {Array.from({ length: renderCount }).map((_, idx) => (
                <BarcodeLabelPreview
                  key={idx}
                  item={item}
                  tagSize={tagSize}
                  showPrice={showPrice}
                  showHuid={showHuid}
                  showMaking={showMaking}
                  shopName={shopName}
                  layout={layout}
                />
              ))}
            </div>
          </div>

          {/* Config panel details */}
          <div className="space-y-6 print:hidden">
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <Settings2 className="h-4 w-4 text-gold" />
                <h3 className="font-serif text-base font-bold text-slate-800">
                  Tag Template Layout
                </h3>
              </div>

              {/* Layout selections */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Orientation &amp; Style</Label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLayout("dual_landscape");
                      setNumCopies(2);
                    }}
                    className={`p-3 text-left rounded-xl border text-xs font-semibold flex flex-col transition-all ${
                      layout === "dual_landscape"
                        ? "border-gold bg-gold/5 text-slate-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-muted-foreground"
                    }`}
                  >
                    <span>Dual Landscape (50x38mm)</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Dual stickers layout side-by-side. TSC standard jewelry tags.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayout("portrait_upright");
                      setNumCopies(1);
                    }}
                    className={`p-3 text-left rounded-xl border text-xs font-semibold flex flex-col transition-all ${
                      layout === "portrait_upright"
                        ? "border-gold bg-gold/5 text-slate-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-muted-foreground"
                    }`}
                  >
                    <span>Portrait Upright (38x50mm)</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Narrow vertical layout. rotated barcode. Compact luxury tag.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayout("single_thermal");
                      setNumCopies(1);
                    }}
                    className={`p-3 text-left rounded-xl border text-xs font-semibold flex flex-col transition-all ${
                      layout === "single_thermal"
                        ? "border-gold bg-gold/5 text-slate-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-muted-foreground"
                    }`}
                  >
                    <span>Single Column Thermal (50x38mm)</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                      Ideal for direct roll printer outputs. Minimal borders.
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <Sliders className="h-4 w-4 text-gold" />
                <h3 className="font-serif text-base font-bold text-slate-800">Print Parameters</h3>
              </div>

              {/* Shop Header Details */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Shop Name Header</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Sizing selection */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Standard tag physical size</Label>
                <select
                  value={tagSize}
                  onChange={(e) => setTagSize(e.target.value)}
                  className="w-full h-9 rounded-lg bg-white border border-neutral-200 text-xs text-foreground px-2"
                >
                  <option value="50x38mm">50 x 38 mm (Standard Gold Tag)</option>
                  <option value="40x25mm">40 x 25 mm (Compact Silver Ring Tag)</option>
                </select>
              </div>

              {/* Sizing margin */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Margins (mm)</Label>
                  <Input
                    type="number"
                    value={customMargin}
                    onChange={(e) => setCustomMargin(e.target.value)}
                    className="h-9"
                  />
                </div>
                {layout === "dual_landscape" && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Number of tag cards</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={numCopies}
                      onChange={(e) => setNumCopies(parseInt(e.target.value) || 1)}
                      className="h-9"
                    />
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-normal">Show valuation price</Label>
                  <Switch checked={showPrice} onCheckedChange={setShowPrice} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-normal">Include HUID serials</Label>
                  <Switch checked={showHuid} onCheckedChange={setShowHuid} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-normal">Include making estimation</Label>
                  <Switch checked={showMaking} onCheckedChange={setShowMaking} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CSS rule injects to handle print margins */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print, [data-testid="barcode-label-preview-root"] {
              border: none !important;
              box-shadow: none !important;
            }
            @page {
              size: auto;
              margin: 0;
            }
          }
        `,
          }}
        />
      </div>
    </div>
  );
}

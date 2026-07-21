import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Printer, ArrowLeft, Download, Loader2, Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARCHIVAL_SIZES,
  DEFAULT_MARGINS,
  PRINT_SIZE_LABELS,
  defaultOrientation,
  type PrintOrientation,
  type PrintSize,
} from "@/components/print/PrintLayout";
import { usePrintSetup, type PrintMargins } from "@/lib/print-setup-store";

const MARGIN_SIDES: (keyof PrintMargins)[] = ["top", "bottom", "left", "right"];

/**
 * Page setup — paper size, orientation, per-side margins, scale, fit-to-page.
 *
 * These write to print-setup-store, which PrintLayout reads to build BOTH the
 * on-screen sheet and the real `@page` rule that goes to the printer, so every
 * control here changes the actual output. The toolbar is never printed (it is
 * `print:hidden`, and printDocument() serializes only the PrintLayout roots).
 */
function PageSetupPanel({ documentSize }: { documentSize: PrintSize }) {
  const setup = usePrintSetup();
  const size = setup.sizeOverride ?? documentSize;
  const isArchival = ARCHIVAL_SIZES.includes(size);
  const orientation = isArchival
    ? (setup.orientation ?? defaultOrientation(size))
    : defaultOrientation(size);
  const margins = setup.margins ?? DEFAULT_MARGINS[size];

  return (
    <div
      data-testid="print-page-setup"
      className="flex flex-wrap items-end gap-3 border-t border-border/40 px-4 py-3 print:hidden"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Paper size
        <Select value={size} onValueChange={(v) => setup.setSizeOverride(v as PrintSize)}>
          <SelectTrigger className="h-9 w-60 text-xs" data-testid="page-setup-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRINT_SIZE_LABELS) as PrintSize[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PRINT_SIZE_LABELS[s]}
                {s === documentSize ? " · document default" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {/* Roll/label stock has no meaningful orientation — the control is hidden
          rather than shown doing nothing. */}
      {isArchival && (
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Orientation
          <Select
            value={orientation}
            onValueChange={(v) => setup.setOrientation(v as PrintOrientation)}
          >
            <SelectTrigger className="h-9 w-32 text-xs" data-testid="page-setup-orientation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Margins (mm)
        </span>
        <div className="flex items-center gap-1.5">
          {MARGIN_SIDES.map((side) => (
            <label key={side} className="flex items-center gap-1">
              <span className="text-[10px] uppercase text-muted-foreground w-4">{side[0]}</span>
              <Input
                type="number"
                min={0}
                max={50}
                value={margins[side]}
                data-testid={`page-setup-margin-${side}`}
                onChange={(e) => {
                  const mm = Math.min(50, Math.max(0, Number(e.target.value)));
                  setup.setMargins({ ...margins, [side]: Number.isFinite(mm) ? mm : 0 });
                }}
                className="h-9 w-16 text-xs"
              />
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Scale (%)
        <Input
          type="number"
          min={25}
          max={200}
          step={5}
          value={setup.scalePct}
          data-testid="page-setup-scale"
          onChange={(e) => setup.setScalePct(Number(e.target.value))}
          className="h-9 w-20 text-xs"
        />
      </label>

      <label className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
        <Switch
          checked={setup.fitToPage}
          onCheckedChange={setup.setFitToPage}
          data-testid="page-setup-fit"
        />
        Fit to page
      </label>

      <Button
        variant="ghost"
        size="sm"
        onClick={setup.reset}
        className="h-9 gap-1.5 text-xs"
        data-testid="page-setup-reset"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset
      </Button>
    </div>
  );
}

/**
 * V1 prints with one click and no limits: the Secure Reprint dialog, the
 * reprint counter and the print log are gone. The reprint-related props are
 * retained (and ignored) so the print routes that still pass them keep
 * compiling.
 */
interface PrintToolbarProps {
  title: string;
  docNumber: string;
  isReprint?: boolean;
  reprintCount?: number;
  reprintOpen?: boolean;
  setReprintOpen?: (open: boolean) => void;
  onPrint?: () => void;
  onReprintConfirm?: (reason: string, note?: string) => void;
  backUrl?: string; // Optional custom fallback URL
  layoutSize?: "a4" | "a5" | "thermal" | "thermal58" | "tag";
  onLayoutSizeChange?: (size: "a4" | "a5" | "thermal" | "thermal58" | "tag") => void;
  /** Unified Print Engine: renders a "Download PDF" button when provided. Absent for every non-migrated route — no behavior change there. */
  onDownloadPdf?: () => void;
  downloadingPdf?: boolean;
  /** The size the document itself declares — the "document default" the page-setup panel offers to fall back to. */
  documentSize?: PrintSize;
}

export function PrintToolbar({
  title,
  docNumber,
  onPrint,
  backUrl,
  layoutSize,
  onLayoutSizeChange,
  onDownloadPdf,
  downloadingPdf = false,
  documentSize,
}: PrintToolbarProps) {
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);

  const isIframe = typeof window !== "undefined" && window !== window.parent;

  if (isIframe) {
    return null;
  }

  const handleBack = () => {
    if (backUrl) {
      // Route through the app router, not window.location.href — under the
      // packaged Electron build (file:// + hash history, see router.tsx),
      // a bare app path like "/people" is not a real filesystem path or
      // hash fragment, so assigning it to location.href fails to load and
      // Chromium shows its chrome-error://chromewebdata/ page (a blank
      // white screen) instead of navigating back into the app.
      navigate({ to: backUrl as any });
    } else {
      window.history.back();
    }
  };

  return (
    <>
      <header
        data-testid="print-toolbar"
        className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/40 z-50 print:hidden shadow-sm"
      >
        <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9 shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-serif text-base font-semibold tracking-tight text-foreground truncate">
                  {title}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                  {docNumber}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                MTJ ERP High-Fidelity Printing System. Inkjet copies are optimized for legal
                archives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            {onLayoutSizeChange && layoutSize && (
              <div className="flex bg-muted rounded-xl p-0.5 border border-border mr-1">
                {(["a4", "a5", "thermal", "thermal58", "tag"] as const).map((sz) => {
                  let label = sz.toUpperCase();
                  if (sz === "thermal") label = "80mm Thermal";
                  if (sz === "thermal58") label = "58mm Thermal";
                  if (sz === "tag") label = "Jewellery Tag";
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onLayoutSizeChange(sz)}
                      className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer font-sans whitespace-nowrap ${
                        layoutSize === sz
                          ? "bg-background text-foreground shadow-sm font-semibold border-stone-200"
                          : "text-muted-foreground hover:text-foreground hover:bg-neutral-100/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => setSetupOpen((o) => !o)}
              className="text-xs gap-1.5 px-4 h-9"
              data-testid="print-page-setup-toggle"
              aria-expanded={setupOpen}
            >
              <Settings2 className="h-4 w-4" />
              Page Setup
            </Button>

            {onDownloadPdf && (
              <Button
                variant="outline"
                onClick={onDownloadPdf}
                disabled={downloadingPdf}
                className="text-xs gap-1.5 px-4 h-9"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
            )}

            <Button
              onClick={onPrint}
              className="bg-gold text-black hover:bg-gold/90 font-medium text-xs gap-1.5 px-4 h-9 shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Document
            </Button>
          </div>
        </div>

        {setupOpen && <PageSetupPanel documentSize={documentSize ?? layoutSize ?? "a4"} />}
      </header>
    </>
  );
}

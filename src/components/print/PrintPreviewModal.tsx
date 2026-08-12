import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Printer, X, RotateCcw } from "lucide-react";
import {
  PRINT_SIZE_LABELS,
  ARCHIVAL_SIZES,
  DEFAULT_MARGINS,
  marginCss,
  pageSizeCss,
  defaultOrientation,
  sheetMm,
  type PrintSize,
  type PrintOrientation,
} from "@/components/print/PrintLayout";
import { usePrintSetup, type PrintMargins } from "@/lib/print-setup-store";
import { serializeWithInlinedImages, printHtmlInWebBrowser } from "@/lib/print-document";
import { listAvailablePrinters, type PrinterInfo } from "@/lib/print/print-queue";

// Every triggerPrint(url, ...) call site across the app (~30 of them, in
// Billing/Orders/Repair/Workshop/People) passes a bare app path like
// "/workshop/gold-book-print/abc123". Under the packaged Electron build
// (file:// protocol, hash history — see router.tsx) that bare path is not a
// valid iframe src: the browser resolves it as an absolute filesystem path,
// which fails to load anything, leaving the preview permanently blank with
// no console error. Fixed once here, at the single place these URLs are
// actually consumed, rather than at every call site.
function toIframeSrc(printUrl: string): string {
  const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
  if (!isFileProtocol || printUrl.startsWith("#")) return printUrl;
  return `#${printUrl}`;
}

function hasElectronPrintBridge(): boolean {
  return (
    typeof window !== "undefined" &&
    "mtjDesktop" in window &&
    !!(window as unknown as { mtjDesktop?: { print?: unknown } }).mtjDesktop?.print
  );
}

// On-screen preview container sizing per format — cosmetic only, never
// affects what actually gets printed (the @page override in applyPageOverride
// is what reaches the printer).
const PREVIEW_CONTAINER_CLASS: Record<PrintSize, string> = {
  a4: "w-full h-full max-w-4xl",
  a5: "w-full h-full max-w-2xl",
  a5l: "w-full h-full max-w-4xl",
  a6: "w-full h-full max-w-xl",
  thermal: "w-[80mm] h-full",
  thermal58: "w-[58mm] h-full",
  tag: "w-[260px] h-[200px]",
};

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  printUrl: string;
}

export function PrintPreviewModal({ isOpen, onClose, title, printUrl }: PrintPreviewModalProps) {
  // Auto-detected from the loaded document's own data-print-size attribute
  // (set by PrintLayout) once the iframe finishes loading — never guessed
  // from the URL. Defaults to "a4" only until detection runs.
  const [printSize, setPrintSize] = useState<PrintSize>("a4");
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Desktop-only: real printer selection + silent printing via Electron's
  // print IPC (see print-queue.ts) — invisible/no-op in the browser build.
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [silentPrint, setSilentPrint] = useState(false);
  const isDesktop = hasElectronPrintBridge();

  // Page setup lives in ONE store (print-setup-store), shared with PrintLayout
  // and the toolbar's Page Setup panel — so the modal, the route's own preview
  // and the printed page can never disagree about size/orientation/margins/
  // scale. Every value here is emitted into a real `@media print { @page }`
  // rule inside the previewed document itself (applyPageOverride), and that
  // same document is what gets printed.
  const setup = usePrintSetup();

  /** The size actually being printed: the user's choice, else the document's own. */
  const effectiveSize: PrintSize = setup.sizeOverride ?? printSize;
  const effectiveOrientation: PrintOrientation = ARCHIVAL_SIZES.includes(effectiveSize)
    ? (setup.orientation ?? defaultOrientation(effectiveSize))
    : defaultOrientation(effectiveSize);
  const effectiveMargins: PrintMargins = setup.margins ?? DEFAULT_MARGINS[effectiveSize];

  useEffect(() => {
    if (!isOpen || !isDesktop) return;
    listAvailablePrinters().then((list) => {
      setPrinters(list);
      const def = list.find((p) => p.isDefault);
      if (def) setSelectedPrinter(def.name);
    });
  }, [isOpen, isDesktop]);

  useEffect(() => {
    if (isOpen) setIframeLoading(true);
  }, [printUrl, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("print-preview-open");
    } else {
      document.body.classList.remove("print-preview-open");
    }
    return () => {
      document.body.classList.remove("print-preview-open");
    };
  }, [isOpen]);

  const handlePrint = async () => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      let attempts = 0;
      while (
        doc.documentElement.getAttribute("data-print-ready") !== "true" &&
        doc.querySelector('[data-testid="print-layout-root"]') &&
        attempts < 20
      ) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
    }

    if (isDesktop && iframeRef.current.contentDocument) {
      try {
        const html = await serializeWithInlinedImages(
          iframeRef.current.contentDocument.documentElement,
        );
        const desktop = (
          window as unknown as {
            mtjDesktop: {
              print: {
                printHtml: (h: string, o?: any) => Promise<{ success: boolean; error?: string }>;
              };
            };
          }
        ).mtjDesktop;
        // Page setup rides along IN THE HTML: applyPageOverride() injects the
        // `@page { size; margin }` rule into this very document, and the
        // serializer above carries its <head> across. So the print window is
        // governed by exactly the CSS the preview is showing — preview and
        // paper cannot disagree.
        //
        // We therefore do NOT also pass orientation/margins over IPC: doing so
        // would apply them a second time, at a different layer, and the two
        // could contradict each other. (The old code passed `orientation` /
        // `marginMm`, names no handler reads — so both controls were silently
        // dropped. Hence "dummy controls".) `landscape` is still sent because
        // Chromium needs the print job itself oriented to match the @page rule.
        const result = await desktop.print.printHtml(html, {
          silent: silentPrint,
          printerName: selectedPrinter || undefined,
          landscape: effectiveOrientation === "landscape",
        });
        if (!result.success) {
          console.warn("[Print] Desktop print failed, falling back to web print:", result.error);
          printHtmlInWebBrowser(html);
        }
        return;
      } catch (err) {
        console.error("[Print] Desktop print path threw, falling back to web print:", err);
      }
    }

    // Web Browser Mode (SaaS platform or standard web browser)
    try {
      if (iframeRef.current.contentDocument?.documentElement) {
        const html = await serializeWithInlinedImages(
          iframeRef.current.contentDocument.documentElement,
        );
        printHtmlInWebBrowser(html);
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Direct iframe print failed, falling back to window print:", err);
      window.print();
    }
  };

  const PAGE_OVERRIDE_STYLE_ID = "mtj-print-preview-page-override";

  // Applies ONLY a @page override (margin, and orientation for archival
  // sizes) scoped inside @media print. Deliberately does not touch element
  // visibility — the loaded document's own PrintLayout already hides its
  // toolbar/chrome correctly via .no-print / [data-testid="print-toolbar"].
  // The previous implementation's unscoped, unconditional
  // `body > *:not(main) { display: none }` rule (assuming a <main> wrapper
  // no print route actually has) is what blanked the preview; this replaces
  // it rather than reintroducing the same class of bug.
  const applyPageOverride = () => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      let style = doc.getElementById(PAGE_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = PAGE_OVERRIDE_STYLE_ID;
        doc.head.appendChild(style);
      }
      // The REAL page size, never `auto`. `size: auto <orientation>` discards
      // the paper size entirely — which is why picking A5 previously changed
      // nothing on paper and A4 was the only format that ever worked.
      //
      // Scale is applied to the document root in BOTH the on-screen preview and
      // the print rendering (CSS zoom, which Chromium's print renderer honours),
      // so the preview shows the scale that will actually be printed.
      // A4 (and A5/A6…) page-break preview: a faint dashed guide at each
      // page boundary, screen-only (removed for the actual print). The sheet
      // is mm-sized, so a mm interval lands correctly regardless of on-screen
      // zoom. Interval = usable height (sheet minus top+bottom margin) — the
      // height of content that fits one printed page. Roll/label stock has no
      // fixed page, so it gets no guide.
      const sheet = sheetMm(effectiveSize, effectiveOrientation);
      const usableMm = sheet ? sheet.height - effectiveMargins.top - effectiveMargins.bottom : 0;
      const pageGuide =
        usableMm > 20
          ? `[data-testid="print-layout-root"] {
               background-image: repeating-linear-gradient(
                 to bottom,
                 transparent 0,
                 transparent calc(${usableMm}mm - 1.5px),
                 rgba(220,38,38,0.45) calc(${usableMm}mm - 1.5px),
                 rgba(220,38,38,0.45) ${usableMm}mm
               );
             }
             @media print { [data-testid="print-layout-root"] { background-image: none !important; } }`
          : "";
      style.textContent = `
        [data-testid="print-layout-root"] { zoom: ${setup.scalePct / 100}; }
        ${pageGuide}
        @media print {
          @page {
            size: ${pageSizeCss(effectiveSize, effectiveOrientation)} !important;
            margin: ${marginCss(effectiveMargins)} !important;
          }
        }
      `;
    } catch (err) {
      console.warn(
        "Could not apply print page override to iframe (cross-origin or load timing):",
        err,
      );
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    try {
      const doc = iframeRef.current?.contentDocument;
      const root = doc?.querySelector<HTMLElement>('[data-testid="print-layout-root"]');
      const declaredSize = root?.dataset.printSize as PrintSize | undefined;
      if (declaredSize && declaredSize in PRINT_SIZE_LABELS) {
        setPrintSize(declaredSize);
      }
    } catch (err) {
      console.warn("Could not read print size from iframe document:", err);
    }
    applyPageOverride();
  };

  // Re-apply margin/orientation live if the user changes them after the
  // iframe has already finished loading, without reloading the preview.
  useEffect(() => {
    if (!iframeLoading) applyPageOverride();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSize, effectiveOrientation, effectiveMargins, setup.scalePct, iframeLoading]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-4 bg-background border-border print-preview-dialog-content">
        <DialogHeader className="pb-3 border-b space-y-3">
          <div>
            <DialogTitle className="text-gold font-serif text-lg flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {title} Print Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Safe local render context. Preview margins before physically printing.
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Paper size. Defaults to the document's own declared format, and
                the user can override it — a job card designed for half-A4 can be
                run on A4 stock without editing the template. The choice reaches
                the printer via the @page rule, so it is real, not decorative. */}
            <Select
              value={effectiveSize}
              onValueChange={(v) => setup.setSizeOverride(v as PrintSize)}
            >
              <SelectTrigger className="h-9 w-64 text-xs" data-testid="print-size-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRINT_SIZE_LABELS) as PrintSize[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {PRINT_SIZE_LABELS[s]}
                    {s === printSize ? " · document default" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-2">
              {/* Roll and label stock has no meaningful orientation, so the
                  control is hidden rather than shown doing nothing. */}
              {ARCHIVAL_SIZES.includes(effectiveSize) && (
                <Select
                  value={effectiveOrientation}
                  onValueChange={(v) => setup.setOrientation(v as PrintOrientation)}
                >
                  <SelectTrigger
                    className="h-9 w-32 text-xs"
                    data-testid="print-orientation-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Per-side margins, in mm — each one lands in the @page rule. */}
              <div className="flex items-center gap-1" data-testid="print-margin-inputs">
                {(["top", "bottom", "left", "right"] as (keyof PrintMargins)[]).map((side) => (
                  <label key={side} className="flex items-center gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground">{side[0]}</span>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={effectiveMargins[side]}
                      data-testid={`print-margin-${side}`}
                      onChange={(e) => {
                        const mm = Math.min(50, Math.max(0, Number(e.target.value)));
                        setup.setMargins({
                          ...effectiveMargins,
                          [side]: Number.isFinite(mm) ? mm : 0,
                        });
                      }}
                      className="h-9 w-14 text-xs"
                    />
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-1">
                <span className="text-[10px] uppercase text-muted-foreground">Scale</span>
                <Input
                  type="number"
                  min={25}
                  max={200}
                  step={5}
                  value={setup.scalePct}
                  data-testid="print-scale-input"
                  onChange={(e) => setup.setScalePct(Number(e.target.value))}
                  className="h-9 w-16 text-xs"
                />
              </label>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <Switch
                  checked={setup.fitToPage}
                  onCheckedChange={setup.setFitToPage}
                  data-testid="print-fit-switch"
                />
                Fit to page
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={setup.reset}
                className="h-9 gap-1 text-xs"
                data-testid="print-setup-reset"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            {isDesktop && (
              <>
                <div className="h-6 w-px bg-border shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-3" data-testid="print-desktop-controls">
                  <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                    <SelectTrigger className="h-9 w-48 text-xs" data-testid="print-printer-select">
                      <SelectValue placeholder="Default printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName || p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Checkbox
                      checked={silentPrint}
                      onCheckedChange={(c) => setSilentPrint(c === true)}
                      data-testid="print-silent-checkbox"
                    />
                    Silent print
                  </label>
                </div>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg border border-border p-4 flex justify-center items-start relative">
          <div className="w-full h-full flex justify-center items-center relative">
            {iframeLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 z-10 rounded-lg">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                <p className="text-xs text-muted-foreground font-mono">
                  Generating print layout preview...
                </p>
              </div>
            )}
            {/* Fit-to-page is a measurement the previewed document performs on
                itself (PrintLayout's ResizeObserver), not CSS we can inject —
                so toggling it re-loads the frame, which re-reads the (already
                persisted) setup. Size/orientation/margins/scale need no reload:
                applyPageOverride edits the live document. */}
            <iframe
              key={String(setup.fitToPage)}
              ref={iframeRef}
              src={toIframeSrc(printUrl)}
              onLoad={handleIframeLoad}
              className={`border-0 bg-white shadow-lg transition-all duration-300 ${PREVIEW_CONTAINER_CLASS[effectiveSize]}`}
              title="AVS ERP Print Frame"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t flex flex-row items-center justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 text-xs">
            <X className="h-4 w-4" /> Close
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90 font-medium"
            id="print-preview-print-btn"
          >
            <Printer className="h-4 w-4" /> Print Document Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

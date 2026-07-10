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
import { Printer, X } from "lucide-react";
import { PRINT_SIZE_LABELS, type PrintSize } from "@/components/print/PrintLayout";
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

const ARCHIVAL_SIZES: PrintSize[] = ["a4", "a5", "a6"];

// On-screen preview container sizing per format — cosmetic only, never
// affects what actually gets printed (the loaded document's own PrintLayout
// already declares its real @page size; see applyPageOverride below, which
// only ever touches margin/orientation).
const PREVIEW_CONTAINER_CLASS: Record<PrintSize, string> = {
  a4: "w-full h-full max-w-4xl",
  a5: "w-full h-full max-w-2xl",
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

  // Orientation + margin — genuine physical page-setup overrides, applied
  // ONLY via a real @media print @page rule (never touches element
  // visibility, unlike the previous implementation).
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginMm, setMarginMm] = useState(12);

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

    // Desktop path: real printer selection + optional silent printing,
    // reusing the exact same rendered iframe content the preview already
    // shows — nothing about WHAT gets printed changes, only HOW (named
    // printer, no OS dialog if silent is checked).
    if (isDesktop && iframeRef.current.contentDocument) {
      try {
        const html = iframeRef.current.contentDocument.documentElement.outerHTML;
        const desktop = (
          window as unknown as {
            mtjDesktop: {
              print: {
                printHtml: (h: string, o?: any) => Promise<{ success: boolean; error?: string }>;
              };
            };
          }
        ).mtjDesktop;
        const result = await desktop.print.printHtml(html, {
          silent: silentPrint,
          printerName: selectedPrinter || undefined,
        });
        if (!result.success) {
          console.warn("[Print] Desktop print failed, falling back to iframe print:", result.error);
          iframeRef.current.contentWindow?.focus();
          iframeRef.current.contentWindow?.print();
        }
        return;
      } catch (err) {
        console.error("[Print] Desktop print path threw, falling back to iframe print:", err);
      }
    }

    try {
      iframeRef.current.contentWindow?.focus();
      iframeRef.current.contentWindow?.print();
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
      const isArchival = ARCHIVAL_SIZES.includes(printSize);
      style.textContent = `
        @media print {
          @page {
            ${isArchival ? `size: auto ${orientation};` : ""}
            margin: ${marginMm}mm !important;
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
  }, [orientation, marginMm, printSize]);

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
            {/* Format is auto-detected from the actual document — not a
                user toggle, since switching it would not change what's
                inside the iframe, only mislead about what will print. */}
            <div
              className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/40 text-xs font-medium"
              data-testid="print-detected-format"
            >
              {PRINT_SIZE_LABELS[printSize]}
            </div>

            <div className="h-6 w-px bg-border shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-2">
              {ARCHIVAL_SIZES.includes(printSize) && (
                <Select
                  value={orientation}
                  onValueChange={(v) => setOrientation(v as "portrait" | "landscape")}
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
              <Select value={String(marginMm)} onValueChange={(v) => setMarginMm(Number(v))}>
                <SelectTrigger className="h-9 w-36 text-xs" data-testid="print-margin-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No margin</SelectItem>
                  <SelectItem value="6">Narrow (6mm)</SelectItem>
                  <SelectItem value="12">Normal (12mm)</SelectItem>
                  <SelectItem value="20">Wide (20mm)</SelectItem>
                </SelectContent>
              </Select>
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
            <iframe
              ref={iframeRef}
              src={toIframeSrc(printUrl)}
              onLoad={handleIframeLoad}
              className={`border-0 bg-white shadow-lg transition-all duration-300 ${PREVIEW_CONTAINER_CLASS[printSize]}`}
              title="MTJ ERP Print Frame"
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

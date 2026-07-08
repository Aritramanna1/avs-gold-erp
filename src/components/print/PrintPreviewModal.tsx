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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, X, Laptop, FileText } from "lucide-react";
import { ThermalPrintLayout } from "./ThermalPrintLayout";
import { ArchivalPrintLayout } from "./ArchivalPrintLayout";
import { QRCodeBlock } from "./QRCodeBlock";
import { SignatureBlock } from "./SignatureBlock";
import { AttachmentPrintGrid } from "./AttachmentPrintGrid";
import { listAvailablePrinters, type PrinterInfo } from "@/lib/print/print-queue";

function hasElectronPrintBridge(): boolean {
  return (
    typeof window !== "undefined" &&
    "mtjDesktop" in window &&
    !!(window as unknown as { mtjDesktop?: { print?: unknown } }).mtjDesktop?.print
  );
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  docNo?: string;
  relatedTable?: string;
  relatedRecordId?: string;
  printUrl?: string;
  children?: React.ReactNode;
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  title,
  docNo = "",
  relatedTable = "",
  relatedRecordId = "",
  printUrl,
  children,
}: PrintPreviewModalProps) {
  const [printMode, setPrintMode] = useState<"archival" | "thermal" | "tag">("archival");
  const [iframeLoading, setIframeLoading] = useState(true);
  const printableAreaRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Desktop-only (Priority 5): real printer selection + silent printing via
  // Electron's print IPC (see print-queue.ts) — invisible/no-op in the
  // browser build, where this list is always empty and the toolbar below
  // simply doesn't render.
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [silentPrint, setSilentPrint] = useState(false);
  const isDesktop = hasElectronPrintBridge();

  // Orientation + margin (Priority 5) — works in BOTH the browser (via an
  // injected @page rule, same mechanism as the existing chrome-hiding style
  // injection below) and the desktop path (passed through to Electron's
  // print IPC). Defaults follow the selected print mode, since a thermal
  // roll or a jewellery tag has no meaningful "orientation" concept the way
  // an A4 document does.
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
    if (printUrl) {
      setIframeLoading(true);
      const urlLower = printUrl.toLowerCase();
      if (
        urlLower.includes("/stock/print") ||
        urlLower.includes("tag") ||
        urlLower.includes("barcode")
      ) {
        setPrintMode("tag");
      } else if (
        urlLower.includes("receipt") ||
        urlLower.includes("slip") ||
        urlLower.includes("thermal")
      ) {
        setPrintMode("thermal");
      } else {
        setPrintMode("archival");
      }
    }
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
    // Desktop path: real printer selection + optional silent printing,
    // reusing the exact same rendered iframe content the preview already
    // shows — nothing about WHAT gets printed changes, only HOW (named
    // printer, no OS dialog if silent is checked).
    if (isDesktop && printUrl && iframeRef.current?.contentDocument) {
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

    if (printUrl && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.focus();
        iframeRef.current.contentWindow?.print();
      } catch (err) {
        console.error("Direct iframe print failed, falling back to window print:", err);
        window.print();
      }
      return;
    }

    const printContent = printableAreaRef.current?.innerHTML;
    if (!printContent) return;

    const collectedStyles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((tag) => tag.outerHTML)
      .join("\n");

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>${title} - ${docNo}</title>
            ${collectedStyles}
            <style>
              @media print {
                body {
                  background: white !important;
                  color: black !important;
                  padding: 10px !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                }
                .no-print, header, footer, nav { display: none !important; }
                @page {
                  size: ${printMode === "thermal" ? "80mm auto" : printMode === "tag" ? "340px 210px" : "A4 portrait"};
                  margin: ${printMode === "thermal" ? "2mm" : printMode === "tag" ? "1mm" : "12mm 15mm 15mm 15mm"};
                }
                /* High-Contrast Table Border Enforcement */
                table {
                  border-collapse: collapse !important;
                  width: 100% !important;
                }
                th, td {
                  border: 1px solid #78716c !important; /* stone-500 deep gray border */
                  padding: 6px 8px !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                thead {
                  display: table-header-group !important;
                  background-color: #f5f5f4 !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                h1, h2, h3, h4, p, span, div, td {
                  word-break: break-word !important;
                  overflow-wrap: break-word !important;
                }
              }
              body {
                font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: white;
                color: black;
                padding: 15px;
              }
            </style>
          </head>
          <body>
            <div>${printContent}</div>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.focus();
                  window.print();
                  setTimeout(() => {
                    window.parent.document.body.removeChild(window.frameElement);
                  }, 500);
                }, 100);
              };
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  };

  const PRINT_STYLE_ELEMENT_ID = "mtj-print-preview-injected-style";

  const injectPrintStyle = () => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;
      const pageSize =
        printMode === "thermal" ? "80mm auto" : printMode === "tag" ? "40mm 25mm" : "A4";
      let style = doc.getElementById(PRINT_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = PRINT_STYLE_ELEMENT_ID;
        doc.head.appendChild(style);
      }
      style.innerHTML = `
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
        body > *:not(main):not(script):not(style) { display: none !important; }
        body > main { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        body > main > * { display: block !important; }
        .no-print, header.no-print, div.no-print { display: none !important; }
        @page {
          size: ${pageSize}${printMode === "archival" ? ` ${orientation}` : ""};
          margin: ${printMode === "archival" ? marginMm : Math.min(marginMm, 3)}mm;
        }
      `;
    } catch (err) {
      console.warn("Could not inject css to iframe (cross-origin or load timing):", err);
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    injectPrintStyle();
  };

  // Re-apply page size/margin/orientation live if the user changes them
  // after the iframe has already finished loading, without needing to
  // reload the whole preview.
  useEffect(() => {
    if (!iframeLoading) injectPrintStyle();
  }, [orientation, marginMm, printMode]);

  const paperClasses = {
    archival:
      "bg-white p-8 rounded shadow-md border border-neutral-300 w-full max-w-3xl aspect-[1/1.41] overflow-auto print:shadow-none print:border-none",
    thermal:
      "bg-white p-4 rounded shadow-md border border-neutral-300 w-[80mm] min-h-[140mm] overflow-auto print:shadow-none print:border-none",
    tag: "bg-white p-3 rounded shadow-md border border-neutral-300 w-[340px] h-[210px] overflow-hidden print:shadow-none print:border-none",
  };

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
              Safe local render context. Preview margins and barcode scaling before physically
              printing.
            </DialogDescription>
          </div>

          {/*
            One toolbar, one row of controls that wraps as a unit when
            space is tight — every control shares the same height (h-9) so
            nothing looks squeezed or misaligned next to its neighbours,
            and a narrow window wraps whole controls onto a new line
            instead of compressing them into overlapping text.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Tabs value={printMode} onValueChange={(v) => setPrintMode(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="archival" className="text-xs px-3">
                  Archival (A4)
                </TabsTrigger>
                <TabsTrigger value="thermal" className="text-xs px-3">
                  Thermal (Roll)
                </TabsTrigger>
                <TabsTrigger value="tag" className="text-xs px-3">
                  Jewellery (Tag)
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="h-6 w-px bg-border shrink-0" aria-hidden="true" />

            {/* Paper controls (Priority 5) — orientation only applies to A4/archival; margin applies to all modes (capped for thermal/tag). Works for both the browser print path (via @page CSS) and the desktop path (same CSS, carried in the HTML sent to Electron). */}
            <div className="flex items-center gap-2">
              {printMode === "archival" && (
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

            {/* Desktop-only: real printer selection + silent printing (Priority 5) */}
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

        {/* Scrollable Printable Display region */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg border border-border p-4 flex justify-center items-start relative">
          {printUrl ? (
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
                src={printUrl}
                onLoad={handleIframeLoad}
                className={`border-0 bg-white shadow-lg transition-all duration-300 ${
                  printMode === "thermal"
                    ? "w-[80mm] h-full"
                    : printMode === "tag"
                      ? "w-[360px] h-[240px]"
                      : "w-full h-full max-w-4xl"
                }`}
                title="MTJ ERP Print Frame"
              />
            </div>
          ) : (
            <div ref={printableAreaRef} className={paperClasses[printMode]}>
              {printMode === "thermal" ? (
                <ThermalPrintLayout>
                  <div className="text-xs space-y-3">
                    <div className="flex justify-between font-bold border-b border-black pb-1 mb-2">
                      <span>Doc Code: {docNo}</span>
                      <span>Date: {new Date().toLocaleDateString("en-IN")}</span>
                    </div>
                    {children}
                    <div className="flex justify-center my-4">
                      <QRCodeBlock value={docNo} size={85} />
                    </div>
                    <div className="border-t border-dashed border-black pt-3">
                      <SignatureBlock
                        leftLabel="Operator"
                        rightLabel="Karigar"
                        className="pt-2 mt-4"
                      />
                    </div>
                  </div>
                </ThermalPrintLayout>
              ) : printMode === "tag" ? (
                <div className="h-full flex flex-col justify-between text-black text-xs leading-tight">
                  <div className="flex justify-between border-b pb-1 font-bold">
                    <span>{docNo}</span>
                    <span>TAG</span>
                  </div>
                  <div className="my-2 space-y-1">{children}</div>
                  <div className="border-t pt-1 text-[9px] text-center font-mono">
                    MTJ Jewellery Tag Layout · TSC Compatible
                  </div>
                </div>
              ) : (
                <ArchivalPrintLayout title={title} subtitle={`Invoice Code: ${docNo}`}>
                  <div className="space-y-6 pt-4 text-sm text-black">
                    <div className="grid grid-cols-2 gap-4 border-b pb-4 border-neutral-200">
                      <div>
                        <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                          Document No:
                        </span>
                        <p className="font-mono text-base font-bold text-neutral-800">{docNo}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                          Timestamp:
                        </span>
                        <p className="font-mono text-base font-bold text-neutral-800">
                          {new Date().toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {children}

                    {/* QR validation & interactive features code bar */}
                    <div className="flex items-center justify-between border-t border-b py-4 my-6 border-neutral-200 shrink-0">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-widest block">
                          Digital Audit Trail
                        </span>
                        <p className="text-xs text-neutral-600 max-w-sm">
                          This document carries a cryptographically hashed verification signature in
                          our database. Scan to verify credentials.
                        </p>
                      </div>
                      <QRCodeBlock value={docNo} size={110} />
                    </div>

                    {relatedRecordId && (
                      <AttachmentPrintGrid
                        relatedTable={relatedTable}
                        relatedRecordId={relatedRecordId}
                      />
                    )}

                    <SignatureBlock />
                  </div>
                </ArchivalPrintLayout>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t flex flex-row items-center justify-end gap-2 shrink-0">
          <div className="text-[10px] text-muted-foreground/85 font-sans font-medium mr-auto hidden sm:block">
            Thermal/Tag supports Zebra, TSC &amp; browser resizing. A4 optimized for laser vaults.
          </div>
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

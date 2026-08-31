/**
 * Native document preview — Print Engine PDF in MobileDocumentViewer.
 * Print / Download / Share all use the same cached PDF. Never iframes the print SPA.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Share2, X } from "lucide-react";
import {
  MobileDocumentViewerChrome,
  MobileDocumentViewerStage,
  type MobileFitMode,
} from "@/components/print/MobileDocumentViewer";
import { mapPrintUrlToDocument } from "@/lib/native/print-url-map";
import {
  cachePdfForPreview,
  downloadPdfBlob,
  generatePrintEnginePdf,
  printPdfBlob,
  sharePdfBlobCanonical,
  type GeneratedPdf,
} from "@/lib/native/document-output";
import { SHARE_INITIATED_TOAST } from "@/lib/native/share-business-document";
import { toast } from "sonner";

function convertNativeFileSrc(fileUri: string): string {
  try {
    const cap = (window as unknown as {
      Capacitor?: { convertFileSrc?: (path: string) => string };
    }).Capacitor;
    return cap?.convertFileSrc?.(fileUri) ?? fileUri;
  } catch {
    return fileUri;
  }
}

export interface NativeDocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  printUrl: string;
  pdfBlob?: Blob | null;
  pdfFileName?: string;
  shareCaption?: string;
}

export function NativeDocumentPreviewModal({
  isOpen,
  onClose,
  title,
  printUrl,
  pdfBlob,
  pdfFileName,
  shareCaption,
}: NativeDocumentPreviewModalProps) {
  const [fitMode, setFitMode] = useState<MobileFitMode>("width");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<GeneratedPdf | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState<"print" | "download" | "share" | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFitMode("width");
    setPreviewZoom(1);
    let revoked: string | null = null;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setPdf(null);
      setPreviewSrc(null);
      try {
        let generated: GeneratedPdf;
        if (pdfBlob) {
          generated = {
            blob: pdfBlob,
            fileName: pdfFileName ?? `${title.replace(/\s+/g, "-") || "document"}.pdf`,
            title,
            caption: shareCaption ?? title,
          };
        } else {
          const mapped = mapPrintUrlToDocument(printUrl);
          if (mapped) {
            const enginePdf = await generatePrintEnginePdf(mapped.docType, mapped.recordId);
            if (!enginePdf) throw new Error("Could not build this document PDF.");
            generated = enginePdf;
          } else {
            throw new Error("This document has no Print Engine PDF mapping.");
          }
        }
        if (cancelled) return;
        setPdf(generated);
        const cached = await cachePdfForPreview(generated.blob, generated.fileName);
        revoked = cached.blobUrl;
        const src = cached.fileUri
          ? convertNativeFileSrc(cached.fileUri)
          : cached.blobUrl;
        if (!cancelled) setPreviewSrc(src);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not generate PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [isOpen, printUrl, title, pdfBlob, pdfFileName, shareCaption]);

  const resetMobileViewport = () => {
    setFitMode("width");
    setPreviewZoom(1);
  };

  const handlePrint = async () => {
    if (!pdf) return;
    setBusy("print");
    try {
      await printPdfBlob(pdf.blob, {
        title: pdf.title,
        fileName: pdf.fileName,
        printSize: pdf.printSize ?? "a4",
      });
      toast.success("Opened Android print dialog");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!pdf) return;
    setBusy("download");
    try {
      const result = await downloadPdfBlob(pdf.blob, pdf.fileName);
      toast.success(result.saved ? "PDF saved to Documents" : "Could not save PDF");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!pdf) return;
    setBusy("share");
    try {
      await sharePdfBlobCanonical(pdf.blob, {
        title: pdf.title,
        fileName: pdf.fileName,
        caption: pdf.caption,
      });
      toast.message(SHARE_INITIATED_TOAST);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not share document");
    } finally {
      setBusy(null);
    }
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
              Canonical Print Engine PDF. Print, download, and share use this same file.
            </DialogDescription>
          </div>
          <MobileDocumentViewerChrome
            fitMode={fitMode}
            zoom={previewZoom}
            onZoom={setPreviewZoom}
            onFitMode={setFitMode}
            onResetZoom={resetMobileViewport}
          />
        </DialogHeader>

        <MobileDocumentViewerStage
          zoom={previewZoom}
          onZoom={setPreviewZoom}
          fitMode={fitMode}
          className="flex justify-center items-start"
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 z-10 rounded-lg">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <p className="text-xs text-muted-foreground font-mono">Generating PDF…</p>
            </div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : previewSrc ? (
            <iframe
              src={previewSrc}
              className="w-full min-h-[70vh] border-0 bg-white shadow-lg"
              title="AVS ERP PDF preview"
              data-testid="print-preview-pdf"
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">PDF ready. Use Print, Download, or Share.</p>
          )}
        </MobileDocumentViewerStage>

        <DialogFooter className="pt-2 border-t flex flex-row items-center justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 text-xs">
            <X className="h-4 w-4" /> Close
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownload()}
            disabled={!pdf || busy !== null}
            className="gap-1.5 text-xs"
            data-testid="print-preview-download-pdf"
          >
            <Download className="h-4 w-4" />
            {busy === "download" ? "Saving…" : "Download"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleShare()}
            disabled={!pdf || busy !== null}
            className="gap-1.5 text-xs"
            data-testid="print-preview-share"
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button
            size="sm"
            onClick={() => void handlePrint()}
            disabled={!pdf || busy !== null}
            className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90 font-medium"
            id="print-preview-print-btn"
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

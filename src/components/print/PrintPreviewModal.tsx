import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download } from "lucide-react";
import { NativeDocumentPreviewModal } from "@/components/print/NativeDocumentPreviewModal";
import { toast } from "sonner";
import { isNativeApp, prefersMobileAppChrome } from "@/lib/native/platform";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  printUrl: string;
  pdfBlob?: Blob | null;
  pdfFileName?: string;
  shareCaption?: string;
}

/**
 * Print preview is PDF-first on every surface.
 * Native → NativeDocumentPreviewModal (Print Engine PDF).
 * Web → resolve URL → Print Engine PDF blob → print that PDF.
 * Never iframes the live SPA / UI for business print.
 */
export function PrintPreviewModal({
  isOpen,
  onClose,
  title,
  printUrl,
  pdfBlob,
  pdfFileName,
  shareCaption,
}: PrintPreviewModalProps) {
  if (isNativeApp() || prefersMobileAppChrome()) {
    return (
      <NativeDocumentPreviewModal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        printUrl={printUrl}
        pdfBlob={pdfBlob}
        pdfFileName={pdfFileName}
        shareCaption={shareCaption}
      />
    );
  }

  return (
    <WebPrintPreviewModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      printUrl={printUrl}
      pdfBlob={pdfBlob}
      pdfFileName={pdfFileName}
      shareCaption={shareCaption}
    />
  );
}

function WebPrintPreviewModal({
  isOpen,
  onClose,
  title,
  printUrl,
  pdfBlob,
  pdfFileName,
  shareCaption,
}: PrintPreviewModalProps) {
  const [resolved, setResolved] = useState<{
    blob: Blob;
    fileName?: string;
    caption?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setResolved(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setResolved(null);
      try {
        if (pdfBlob) {
          if (!cancelled) {
            setResolved({
              blob: pdfBlob,
              fileName: pdfFileName,
              caption: shareCaption,
            });
          }
          return;
        }
        const { mapPrintUrlToDocument } = await import("@/lib/native/print-url-map");
        const { generatePrintEnginePdf } = await import("@/lib/native/document-output");
        const mapped = mapPrintUrlToDocument(printUrl);
        if (!mapped) {
          throw new Error(
            "No Print Engine PDF mapping for this URL. Business print must use Universal Print Engine PDF — not the on-screen UI.",
          );
        }
        const pdf = await generatePrintEnginePdf(mapped.docType, mapped.recordId);
        if (!pdf) throw new Error("Could not build Print Engine PDF for this document.");
        if (!cancelled) {
          setResolved({
            blob: pdf.blob,
            fileName: pdf.fileName,
            caption: pdf.caption || shareCaption,
          });
        }
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
    };
  }, [isOpen, printUrl, pdfBlob, pdfFileName, shareCaption]);

  if (resolved) {
    return (
      <WebBlobPreviewModal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        blob={resolved.blob}
        fileName={resolved.fileName}
        shareCaption={resolved.caption}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] flex flex-col p-4 bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-gold font-serif text-lg flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {loading ? "Generating Print Engine PDF…" : "PDF required before print"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 flex flex-col items-center gap-3 text-center">
          {loading ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          ) : (
            <p className="text-sm text-destructive max-w-sm">{error ?? "Could not generate PDF"}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebBlobPreviewModal({
  isOpen,
  onClose,
  title,
  blob,
  fileName,
  shareCaption,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  blob: Blob;
  fileName?: string;
  shareCaption?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState<"print" | "download" | "share" | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-4 bg-background border-border print-preview-dialog-content">
        <DialogHeader className="pb-3 border-b print-preview-chrome" data-print-preview-chrome>
          <DialogTitle className="text-gold font-serif text-lg flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Print Engine PDF — Print, Download, and Share use this same file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {src ? (
            <iframe title={title} src={src} className="h-full w-full rounded-md border border-border bg-white" />
          ) : null}
        </div>
        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-end print-preview-chrome" data-print-preview-chrome>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> Close
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              void (async () => {
                setBusy("download");
                try {
                  const { downloadPdfBlob } = await import("@/lib/native/document-output");
                  await downloadPdfBlob(blob, fileName ?? `${title.replace(/\s+/g, "-")}.pdf`);
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => {
              void (async () => {
                setBusy("share");
                try {
                  const { sharePdfBlobCanonical } = await import("@/lib/native/document-output");
                  const { SHARE_INITIATED_TOAST } = await import(
                    "@/lib/native/share-business-document"
                  );
                  await sharePdfBlobCanonical(blob, {
                    title,
                    fileName: fileName ?? `${title.replace(/\s+/g, "-")}.pdf`,
                    caption: shareCaption ?? title,
                  });
                  toast.message(SHARE_INITIATED_TOAST);
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            Share
          </Button>
          <Button
            disabled={busy !== null}
            className="bg-gold text-black hover:bg-gold/90"
            onClick={() => {
              void (async () => {
                setBusy("print");
                try {
                  const { printPdfBlob } = await import("@/lib/native/document-output");
                  await printPdfBlob(blob, {
                    title,
                    fileName: fileName ?? `${title.replace(/\s+/g, "-")}.pdf`,
                  });
                } finally {
                  setBusy(null);
                }
              })();
            }}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

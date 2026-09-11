/**
 * Mobile document output — PDF share + native Android PrintManager.
 * Never uses window.print() inside Capacitor.
 */
import { buildPrintableHtmlFromDocument } from "@/lib/print-document";
import { shareContent } from "@/lib/native/share";
import { isNativeApp } from "@/lib/native/platform";
import { writeCacheFile } from "@/lib/native/filesystem";
import { hapticSuccess } from "@/lib/native/haptics";
import { OrnexaPrint } from "@/lib/native/ornexa-print-plugin";
import type { PrintSize } from "@/components/print/PrintLayout";

export function printSizeToMediaSize(size: PrintSize | string | undefined): string {
  switch (size) {
    case "a5":
    case "a5l":
      return "iso_a5";
    case "a6":
      return "iso_a6";
    case "thermal":
      return "thermal80";
    case "thermal58":
      return "thermal58";
    case "tag":
      return "tag";
    case "a4":
    default:
      return "iso_a4";
  }
}

/** Last-resort thermal HTML print. Business documents must use printPdfNative. */
export async function printDocumentNative(
  doc: Document,
  opts?: { title?: string; printSize?: PrintSize | string },
): Promise<void> {
  const html = await buildPrintableHtmlFromDocument(doc);
  if (!html) throw new Error("Could not build printable document.");

  if (isNativeApp()) {
    await OrnexaPrint.printHtml({
      jobName: opts?.title ?? "AVS ERP Document",
      html,
      mediaSize: printSizeToMediaSize(opts?.printSize),
    });
    await hapticSuccess();
    return;
  }

  const { printHtmlInWebBrowser } = await import("@/lib/print-document");
  printHtmlInWebBrowser(html);
}

/** @deprecated Prefer printDocumentNative — kept for callers that share HTML. */
export async function printOrShareHtmlDocument(
  doc: Document,
  opts?: { title?: string; fileName?: string },
): Promise<void> {
  const html = await buildPrintableHtmlFromDocument(doc);
  if (!html) throw new Error("Could not build printable document.");

  if (isNativeApp()) {
    const fileName = opts?.fileName ?? "ornexa-document.html";
    const cached = await writeCacheFile(fileName, html);
    if (!cached?.uri) throw new Error("Could not cache document.");
    await shareContent({
      title: opts?.title ?? "AVS ERP document",
      fileUris: [cached.uri],
      text: opts?.title,
    });
    await hapticSuccess();
    return;
  }

  const { printHtmlInWebBrowser } = await import("@/lib/print-document");
  printHtmlInWebBrowser(html);
}

/** Share a PDF blob through the native share sheet (cache URI + files[]). */
export async function sharePdfBlob(
  blob: Blob,
  fileName: string,
  title?: string,
  text?: string,
): Promise<void> {
  await shareFileBlob(blob, fileName, "application/pdf", title, text);
}

/** Share any file blob (PDF / PNG / …) via Capacitor Share or Web Share. */
export async function shareFileBlob(
  blob: Blob,
  fileName: string,
  mimeType: string,
  title?: string,
  text?: string,
): Promise<void> {
  const caption = text ?? title ?? fileName;
  if (isNativeApp()) {
    const cached = await writeCacheFile(fileName, blob);
    if (!cached?.uri) throw new Error("Could not cache file for sharing.");
    await shareContent({
      title: title ?? fileName,
      fileUris: [cached.uri],
      text: caption,
    });
    await hapticSuccess();
    return;
  }
  const file = new File([blob], fileName, { type: mimeType });
  await shareContent({ title: title ?? fileName, text: caption, files: [file] });
  await hapticSuccess();
}

/**
 * @deprecated Business documents must use generateDocumentPdf + sharePdfBlob.
 * Kept only as last-resort thermal HTML when no PrintDocType exists.
 */
export async function shareDocumentFromDom(
  doc: Document,
  opts?: { title?: string; fileName?: string },
): Promise<void> {
  const html = await buildPrintableHtmlFromDocument(doc);
  if (!html) throw new Error("Could not build document.");
  const base = (opts?.fileName ?? "ornexa-document").replace(/\.(html?|pdf)$/i, "");
  const caption = opts?.title ?? base;
  if (isNativeApp()) {
    const cached = await writeCacheFile(`${base}.html`, html);
    if (!cached?.uri) throw new Error("Could not cache document for sharing.");
    await shareContent({
      title: caption,
      fileUris: [cached.uri],
      text: caption,
    });
    await hapticSuccess();
    return;
  }
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  await shareContent({
    title: opts?.title,
    text: caption,
    files: [new File([blob], `${base}.html`, { type: "text/html" })],
  });
}

/** Print PDF bytes via Android PrintManager (native) or browser PDF print (web). */
export async function printPdfNative(
  blob: Blob,
  opts?: { title?: string; fileName?: string; printSize?: PrintSize | string },
): Promise<void> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    // Create hidden iframe for direct PDF printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;
    document.body.appendChild(iframe);

    let triggered = false;
    const executePrint = () => {
      if (triggered) return;
      triggered = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("[print] Iframe print blocked/failed, opening print window:", err);
        const w = window.open(url, "_blank", "noopener,noreferrer");
        if (w) {
          const tryPrintWindow = () => {
            try {
              w.focus();
              w.print();
            } catch {
              /* user can print directly from PDF viewer controls */
            }
          };
          w.addEventListener?.("load", tryPrintWindow);
          setTimeout(tryPrintWindow, 400);
        }
      } finally {
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }
    };

    iframe.addEventListener("load", executePrint);
    setTimeout(executePrint, 500);
    return;
  }
  const fileName = opts?.fileName ?? "ornexa-document.pdf";
  const cached = await writeCacheFile(fileName, blob);
  if (cached?.uri) {
    await OrnexaPrint.printPdf({
      jobName: opts?.title ?? "AVS ERP Document",
      fileUri: cached.uri,
      fileName,
      mediaSize: printSizeToMediaSize(opts?.printSize),
    });
  } else {
    throw new Error("Could not cache PDF for printing.");
  }
  await hapticSuccess();
}

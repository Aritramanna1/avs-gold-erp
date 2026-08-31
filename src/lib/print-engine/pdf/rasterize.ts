/**
 * Rasterize a Universal Print Engine PDF into a high-resolution PNG.
 * Same PDF bytes as Share-as-PDF / WhatsApp API — no separate WhatsApp layout.
 */
import * as pdfjs from "pdfjs-dist";

let workerConfigured = false;

function ensurePdfjsWorker(): void {
  if (workerConfigured) return;
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  } catch {
    // Worker optional in some test environments; getDocument may still work.
  }
  workerConfigured = true;
}

export interface RasterizePdfOptions {
  /** Render scale (2–3 = hi-res). Default 2.5. */
  scale?: number;
  /** Base name without extension (e.g. INV-001.pdf → INV-001). */
  fileNameBase?: string;
  /** Max pages to stitch vertically (default 8). */
  maxPages?: number;
}

/**
 * Render every page of a PDF blob to one vertically stacked PNG.
 * Preserves all particulars already drawn by generateDocumentPdf.
 */
export async function rasterizePdfToPng(
  pdfBlob: Blob,
  opts: RasterizePdfOptions = {},
): Promise<{ blob: Blob; fileName: string; pageCount: number; width: number; height: number }> {
  ensurePdfjsWorker();
  const scale = Math.min(3, Math.max(1.5, opts.scale ?? 2.5));
  const maxPages = Math.max(1, Math.min(20, opts.maxPages ?? 8));
  const data = new Uint8Array(await pdfBlob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, maxPages);

  const pageCanvases: HTMLCanvasElement[] = [];
  let totalHeight = 0;
  let maxWidth = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas for document image.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    pageCanvases.push(canvas);
    totalHeight += canvas.height;
    maxWidth = Math.max(maxWidth, canvas.width);
  }

  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = totalHeight;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Could not compose document image.");
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, out.width, out.height);

  let y = 0;
  for (const c of pageCanvases) {
    outCtx.drawImage(c, 0, y);
    y += c.height;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed."))),
      "image/png",
      1,
    );
  });

  const base =
    (opts.fileNameBase ?? "document").replace(/\.pdf$/i, "").replace(/[<>:"|?*]/g, "-") ||
    "document";

  return {
    blob,
    fileName: `${base}.png`,
    pageCount,
    width: out.width,
    height: out.height,
  };
}

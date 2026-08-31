/**
 * Print path for every generated document (Job Card, KYC Cover Sheet,
 * Manufacturing Bill, Dispatch Slip, Ledger Statement, ...).
 *
 * Only the document itself is printed: the printable HTML is built from the
 * PrintLayout roots on the page, so no toolbar, dialog, toast, overlay or any
 * other application chrome can reach the paper — they are not in the document
 * that gets sent to the printer at all, rather than being hidden by CSS and
 * hoping every overlay was covered by a selector.
 *
 * On the desktop (Electron) the HTML is rendered to a PDF and shown in
 * Chromium's PDF viewer, so the user gets a real preview and prints the exact
 * bytes they previewed. In a plain browser there is no such bridge, so we fall
 * back to window.print() (whose own preview the browser provides).
 */

import { useSettings, type PrinterProfile } from "@/lib/settings-store";

export const PRINT_ROOT_SELECTOR = '[data-testid="print-layout-root"]';

/**
 * Maps a PrinterProfile's paperSize to a valid CSS `size` value for `@page`.
 * Falls back to "auto" when no profile is available.
 */
function cssPageSize(profile: PrinterProfile | undefined): string {
  if (!profile) return "auto";
  switch (profile.paperSize) {
    case "A4":
      return profile.orientation === "landscape" ? "A4 landscape" : "A4";
    case "A5":
      return profile.orientation === "landscape" ? "A5 landscape" : "A5";
    case "80mm":
      return "80mm 297mm"; // thermal roll: width fixed, height auto-cut
    case "58mm":
      return "58mm 297mm";
    case "40x25":
      return "40mm 25mm";
    case "50x25":
      return "50mm 25mm";
    default:
      return "auto";
  }
}

/**
 * The `@page` rule to append after the document's own styles, or "" when the
 * document should keep the paper it already declared.
 *
 * This rule is emitted last, so anything it declares beats the `@page` rule
 * PrintLayout (and the preview's page override) already resolved from the
 * user's chosen size, orientation and margins. Emitting `size: auto` here
 * therefore discards the paper size entirely — every format prints as the
 * printer's default. Only a printer profile that actually specifies paper may
 * override the document.
 */
export function printPageRule(profile: PrinterProfile | undefined): string {
  if (!profile) return "";
  const { top, right, bottom, left } = profile.margins;
  return `@page { size: ${cssPageSize(profile)}; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; }`;
}

/** Every stylesheet on the page, inlined — the print window loads no external assets. */
function collectStylesFromDocument(doc: Document = document): string {
  let css = "";
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      // A stylesheet we cannot read (cross-origin) — skip it. Every stylesheet
      // this app ships is same-origin, so this is a defensive skip, not a
      // silent loss of the document's styling.
    }
  }
  return css;
}

function collectStyles(): string {
  return collectStylesFromDocument(document);
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    let resolvedSrc = src;
    if (src.startsWith("/") && window.location.protocol === "file:") {
      const base = window.location.href.substring(0, window.location.href.lastIndexOf("/"));
      resolvedSrc = `${base}${src}`;
    } else if (
      !src.includes("://") &&
      !src.startsWith("data:") &&
      !src.startsWith("blob:") &&
      window.location.protocol === "file:"
    ) {
      const base = window.location.href.substring(0, window.location.href.lastIndexOf("/"));
      resolvedSrc = `${base}/${src}`;
    }
    const response = await fetch(resolvedSrc);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[print] could not inline image:", src, err);
    return null;
  }
}

/**
 * Serializes `root` with every image embedded as a data: URL.
 *
 * Printing hands the document HTML to a separate browser print window. A
 * `blob:` object URL is scoped to the document that created it and may resolve
 * to nothing in that other window, so a mandatory scan/photo can print as a
 * blank box. Embedding the bytes is the stable form that survives the print
 * window boundary. Every printable document in the ERP goes through here, so a
 * new attachment type needs no print-side work.
 */
export async function serializeWithInlinedImages(root: HTMLElement): Promise<string> {
  const clone = root.cloneNode(true) as HTMLElement;
  const originalImgs = Array.from(root.querySelectorAll("img"));
  const clonedImgs = Array.from(clone.querySelectorAll("img"));

  await Promise.all(
    clonedImgs.map(async (img, idx) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      const originalImg = originalImgs[idx];
      if (originalImg && originalImg.complete && originalImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = originalImg.naturalWidth;
          canvas.height = originalImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(originalImg, 0, 0);
            const dataUrl = canvas.toDataURL("image/png");
            img.setAttribute("src", dataUrl);
            return;
          }
        } catch (canvasErr) {
          console.warn("[print] canvas inline failed for:", src, canvasErr);
        }
      }

      const dataUrl = await toDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
    }),
  );
  return clone.outerHTML;
}

/** The document's own markup: the PrintLayout roots, in page order. */
async function collectDocumentHtmlFromRoots(roots: HTMLElement[]): Promise<string> {
  if (roots.length === 0) return "";

  const htmls = await Promise.all(roots.map((root) => serializeWithInlinedImages(root)));

  return htmls
    .map((html, i) =>
      i === 0
        ? `<section>${html}</section>`
        : `<section style="break-before: page;">${html}</section>`,
    )
    .join("\n");
}

async function collectDocumentHtml(): Promise<string> {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(PRINT_ROOT_SELECTOR));
  return collectDocumentHtmlFromRoots(roots);
}

/**
 * Builds a self-contained printable HTML document from print-layout-root nodes
 * inside any loaded document (e.g. a PrintPreviewModal iframe).
 */
export async function buildPrintableHtmlFromDocument(
  doc: Document,
  docLabel?: string,
): Promise<string> {
  const roots = Array.from(doc.querySelectorAll<HTMLElement>(PRINT_ROOT_SELECTOR));
  const bodyHtml = await collectDocumentHtmlFromRoots(roots);
  if (!bodyHtml) return "";

  const profile = docLabel
    ? useSettings.getState().printerProfiles.find((p) => p.templateMapping.includes(docLabel))
    : undefined;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${collectStylesFromDocument(doc)}</style>
    <style>
      ${printPageRule(profile)}
      body { margin: 0; background: #fff; color: #000; }
      section { break-inside: auto; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

async function buildPrintableHtml(docLabel?: string): Promise<string> {
  // Resolve the printer profile for this document category (e.g. "Invoice",
  // "Receipt", "Job Card") so we can inject the correct @page CSS. Falls
  // back to no @page rule (browser defaults) when no profile matches.
  const profile = docLabel
    ? useSettings.getState().printerProfiles.find((p) => p.templateMapping.includes(docLabel))
    : undefined;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${collectStyles()}</style>
    <style>
      ${printPageRule(profile)}
      /* The print window contains only the document — make its on-screen
         (PDF) rendering identical to its print rendering. */
      body { margin: 0; background: #fff; color: #000; }
      section { break-inside: auto; }
    </style>
  </head>
  <body>${await collectDocumentHtml()}</body>
</html>`;
}

interface DesktopPrintApi {
  print?: {
    previewHtml?: (
      html: string,
      options?: { title?: string; landscape?: boolean },
    ) => Promise<{ success: boolean; error?: string }>;
  };
}

/** Print only the print-layout-root content from a loaded iframe document. */
export async function printDocumentFromFrame(
  doc: Document,
  title?: string,
  docLabel?: string,
): Promise<void> {
  const html = await buildPrintableHtmlFromDocument(doc, docLabel);
  if (!html) {
    window.print();
    return;
  }

  const desktop = (window as unknown as { mtjDesktop?: DesktopPrintApi }).mtjDesktop;
  const previewHtml = desktop?.print?.previewHtml;
  if (previewHtml) {
    const profile = docLabel
      ? useSettings.getState().printerProfiles.find((p) => p.templateMapping.includes(docLabel))
      : undefined;
    const landscape = profile?.orientation === "landscape";
    const result = await previewHtml(html, { title, landscape });
    if (!result.success) {
      console.error("[print] Preview failed, falling back to browser print:", result.error);
      printHtmlInWebBrowser(html);
    }
    return;
  }

  printHtmlInWebBrowser(html);
}

/**
 * Triggers printing of raw HTML in web browsers by writing the HTML to a temporary
 * un-modalized hidden iframe on document.body, focusing it, and calling window.print().
 * This avoids modal backdrop hiding ([role="dialog"] { display: none !important }),
 * viewport clipping, and cross-origin iframe print errors.
 */
export function printHtmlInWebBrowser(html: string): void {
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.id = "mtj-web-print-frame";

  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  void waitForFrameReady(frameDoc).then(() => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch (err) {
      console.error("[print] hidden frame print error:", err);
      window.print();
    } finally {
      setTimeout(() => {
        printFrame.remove();
      }, 1000);
    }
  });
}

const FRAME_READY_TIMEOUT_MS = 5000;

/**
 * Resolves once the print frame's fonts and images have settled, or after a
 * hard timeout. A fixed short delay printed documents whose logo, stamp or
 * product photos had not decoded yet, producing blank boxes on paper.
 */
async function waitForFrameReady(frameDoc: Document): Promise<void> {
  const settle = (async () => {
    try {
      await frameDoc.fonts?.ready;
    } catch {
      // Font loading API unavailable or rejected — proceed with layout as-is.
    }
    const images = Array.from(frameDoc.images).filter((img) => !img.complete);
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );
  })();

  await Promise.race([
    settle,
    new Promise<void>((resolve) => setTimeout(resolve, FRAME_READY_TIMEOUT_MS)),
  ]);
}

/**
 * Prints the document currently on screen. One click, no confirmation, no
 * limit on how many times a document may be printed (V1: unlimited reprints).
 * Returns once the print/preview has been handed off to the OS.
 *
 * @param title   — the window/tab title shown in the print preview
 * @param docLabel — category label used to resolve the Printer Profile
 *                   (e.g. "Invoice", "Receipt", "Job Card", "Label")
 */
export async function printDocument(title?: string, docLabel?: string): Promise<void> {
  const desktop = (window as unknown as { mtjDesktop?: DesktopPrintApi }).mtjDesktop;
  const previewHtml = desktop?.print?.previewHtml;

  const html = await buildPrintableHtml(docLabel);

  if (!previewHtml) {
    if (html.includes("<section")) {
      printHtmlInWebBrowser(html);
    } else {
      window.print();
    }
    return;
  }

  if (!html.includes("<section")) {
    window.print();
    return;
  }

  const profile = docLabel
    ? useSettings.getState().printerProfiles.find((p) => p.templateMapping.includes(docLabel))
    : undefined;
  const landscape = profile?.orientation === "landscape";

  const result = await previewHtml(html, { title, landscape });
  if (!result.success) {
    console.error("[print] Preview failed, falling back to browser print:", result.error);
    printHtmlInWebBrowser(html);
  }
}

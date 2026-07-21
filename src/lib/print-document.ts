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

const PRINT_ROOT_SELECTOR = '[data-testid="print-layout-root"]';

/** Every stylesheet on the page, inlined — the print window loads no external assets. */
function collectStyles(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
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

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const blob = await (await fetch(src)).blob();
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
 * Printing on the desktop hands the document's HTML to a SEPARATE Electron
 * window (see main.ts PRINT_HTML / PRINT_PREVIEW_HTML). A `blob:` object URL —
 * which is what the local file vault hands back for any stored attachment: a
 * worker's photo, a scanned Aadhaar/PAN/GST certificate, a signature, a design
 * photo on a job card — is scoped to the document that created it and resolves
 * to nothing in that other window, so the image prints as its alt text and the
 * document goes out with a blank box where a mandatory scan should be. An
 * `http(s):` src fails the same way on a workshop floor with no network.
 *
 * Embedding the bytes is the only form that survives the window boundary, an
 * offline install, and a restart. Every printable document in the ERP goes
 * through here, so a new attachment type needs no print-side work.
 */
export async function serializeWithInlinedImages(root: HTMLElement): Promise<string> {
  const clone = root.cloneNode(true) as HTMLElement;
  await Promise.all(
    Array.from(clone.querySelectorAll("img")).map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await toDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
    }),
  );
  return clone.outerHTML;
}

/** The document's own markup: the PrintLayout roots, in page order. */
async function collectDocumentHtml(): Promise<string> {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(PRINT_ROOT_SELECTOR));
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

async function buildPrintableHtml(): Promise<string> {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${collectStyles()}</style>
    <style>
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

/**
 * Prints the document currently on screen. One click, no confirmation, no
 * limit on how many times a document may be printed (V1: unlimited reprints).
 * Returns once the print/preview has been handed off to the OS.
 */
export async function printDocument(title?: string): Promise<void> {
  const desktop = (window as unknown as { mtjDesktop?: DesktopPrintApi }).mtjDesktop;
  const previewHtml = desktop?.print?.previewHtml;

  if (!previewHtml) {
    window.print();
    return;
  }

  const html = await buildPrintableHtml();
  if (!html.includes("<section")) {
    // No PrintLayout on this page — nothing to serialize. Print the page as
    // the browser sees it rather than opening an empty preview.
    window.print();
    return;
  }

  const result = await previewHtml(html, { title });
  if (!result.success) {
    console.error(
      "[print] Preview failed, falling back to the browser print dialog:",
      result.error,
    );
    window.print();
  }
}

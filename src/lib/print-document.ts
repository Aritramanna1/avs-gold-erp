/** Browser-only document printing helpers for the Workshop ERP. */

/**
 * Clone printable markup and inline images where possible so browser print
 * previews remain self-contained. The browser owns the actual print dialog.
 */
export async function serializeWithInlinedImages(root: HTMLElement): Promise<string> {
  const clone = root.cloneNode(true) as HTMLElement;
  const originalImgs = Array.from(root.querySelectorAll("img"));
  const clonedImgs = Array.from(clone.querySelectorAll("img"));

  await Promise.all(
    clonedImgs.map(async (img, index) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      const original = originalImgs[index];
      if (original?.complete && original.naturalWidth > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = original.naturalWidth;
          canvas.height = original.naturalHeight;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(original, 0, 0);
            img.setAttribute("src", canvas.toDataURL("image/png"));
            return;
          }
        } catch {
          // Fall through to a fetch-based inline attempt.
        }
      }
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch {
        // A missing optional image must not prevent the document from printing.
      }
    }),
  );

  return clone.outerHTML;
}

/** Open the browser's standard print dialog. */
export async function printDocument(title?: string, docLabel?: string): Promise<void> {
  void title;
  void docLabel;
  window.print();
}

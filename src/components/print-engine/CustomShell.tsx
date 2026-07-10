/**
 * Unified Print Engine — custom shell.
 *
 * For documents whose approved format is its own bespoke wrapper rather
 * than the shared PrintLayout chrome — the GST/retail invoice never used
 * PrintLayout even before migration (its own gradient-accented "purple &
 * gold" A4/A5 design, a distinct thermal receipt box, and per-item tag
 * cards with no page-box wrapper at all). Replicates the legacy route's
 * exact @page CSS and outer classNames per paper size, including a
 * pre-existing legacy quirk this migration preserves rather than "fixes":
 * A5 gets the same "A4 portrait" @page size as A4 (never its own A5 page
 * size) — matching the approved format exactly means matching what it
 * actually does today, not what it arguably should do.
 */
import type { ReactNode } from "react";
import type { PrintSize } from "@/lib/print-engine/types";

const PAGE_SIZE: Record<PrintSize, string> = {
  a4: "A4 portrait",
  a5: "A4 portrait",
  a6: "A4 portrait",
  thermal: "80mm auto",
  thermal58: "58mm auto",
  tag: "50mm 30mm",
};

function isThermalOrTag(size: PrintSize) {
  return size === "thermal" || size === "thermal58" || size === "tag";
}

export function CustomShell({
  paperSize,
  children,
}: {
  paperSize: PrintSize;
  children: ReactNode;
}) {
  const margin = isThermalOrTag(paperSize) ? "2mm" : "12mm 15mm 15mm 15mm";

  const boxClass =
    paperSize === "tag"
      ? "flex flex-col gap-3 mx-auto items-center"
      : paperSize === "thermal" || paperSize === "thermal58"
        ? `${paperSize === "thermal58" ? "w-[58mm] p-2" : "w-[80mm] p-4"} mx-auto bg-white text-slate-900 border border-neutral-200 shadow-lg rounded-xl print:border-none print:shadow-none print:p-0 print:rounded-none font-mono text-[10px] leading-snug space-y-4`
        : `${paperSize === "a4" ? "w-[210mm] min-h-[297mm] p-10" : "w-[148mm] min-h-[210mm] p-6"} mx-auto bg-white text-slate-800 border border-neutral-200 shadow-xl rounded-2xl relative overflow-hidden print:border-none print:shadow-none print:p-0 print:rounded-none`;

  return (
    <div className="min-h-screen bg-muted/15 flex flex-col font-sans">
      <style>{`
        @media print {
          @page {
            size: ${PAGE_SIZE[paperSize]};
            margin: ${margin};
          }
        }
      `}</style>
      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <div className={boxClass} style={{ contentVisibility: "auto" }}>
          {!isThermalOrTag(paperSize) && (
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950" />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

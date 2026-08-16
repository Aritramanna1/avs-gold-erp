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
import { useId, type ReactNode } from "react";
import type { PrintSize } from "@/lib/print-engine/types";
import {
  ARCHIVAL_SIZES,
  DEFAULT_MARGINS,
  defaultOrientation,
  marginCss,
  pageSizeCss,
  sheetMm,
  type PrintOrientation,
} from "@/components/print/PrintLayout";
import { usePrintSetup, type PrintMargins } from "@/lib/print-setup-store";

function isThermalOrTag(size: PrintSize) {
  return size === "thermal" || size === "thermal58" || size === "tag";
}

export function CustomShell({
  paperSize: declaredSize,
  children,
}: {
  paperSize: PrintSize;
  children: ReactNode;
}) {
  // Same page setup as PrintLayout — the invoice shell is a different chrome,
  // not a different printer. Without this, choosing A5/landscape/margins in the
  // toolbar would silently do nothing for every custom-shell document.
  const sizeOverride = usePrintSetup((s) => s.sizeOverride);
  const orientationOverride = usePrintSetup((s) => s.orientation);
  const marginOverride = usePrintSetup((s) => s.margins);
  const scalePct = usePrintSetup((s) => s.scalePct);

  const paperSize = sizeOverride ?? declaredSize;
  const orientation: PrintOrientation = ARCHIVAL_SIZES.includes(paperSize)
    ? (orientationOverride ?? defaultOrientation(paperSize))
    : defaultOrientation(paperSize);
  const margins: PrintMargins = marginOverride ?? DEFAULT_MARGINS[paperSize];
  const sheet = sheetMm(paperSize, orientation);
  const scale = scalePct / 100;
  const rootId = `print-root-${useId().replace(/:/g, "")}`;

  const boxClass =
    paperSize === "tag"
      ? "flex flex-col gap-3 mx-auto items-center"
      : paperSize === "thermal" || paperSize === "thermal58"
        ? `${paperSize === "thermal58" ? "w-[58mm] p-2" : "w-[80mm] p-4"} mx-auto bg-white text-slate-900 border border-neutral-200 shadow-lg rounded-md print:border-none print:shadow-none print:p-0 print:rounded-none font-mono text-[10px] leading-snug space-y-4`
        : `${paperSize === "a4" ? "p-10" : "p-6"} mx-auto bg-white text-slate-800 border border-neutral-200 shadow-xl rounded-md relative overflow-hidden print:border-none print:shadow-none print:p-0 print:rounded-none`;

  return (
    <div className="min-h-screen bg-muted/15 flex flex-col font-sans">
      <style>{`
        @media print {
          #${rootId} {
            width: 100% !important;
            min-height: 0 !important;
          }
          @page {
            size: ${pageSizeCss(paperSize, orientation)};
            margin: ${marginCss(margins)};
          }
        }
      `}</style>
      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-x-auto overflow-y-auto">
        <div
          id={rootId}
          className={boxClass}
          style={{
            contentVisibility: "auto",
            ...(scale !== 1 ? { zoom: scale } : {}),
            ...(sheet ? { width: `${sheet.width}mm`, minHeight: `${sheet.height}mm` } : {}),
          }}
          data-testid="print-layout-root"
          data-print-size={paperSize}
          data-print-orientation={orientation}
        >
          {!isThermalOrTag(paperSize) && (
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-900 via-amber-500 to-purple-950" />
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

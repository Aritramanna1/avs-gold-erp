import { ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { usePrintSetup, type PrintMargins } from "@/lib/print-setup-store";
import { PrintQR } from "@/components/print-qr";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { Logo } from "@/components/ui/Logo";
import type { PrintDocType } from "@/lib/printlog-store";

export type PrintSize = "a4" | "a5" | "a5l" | "a6" | "thermal" | "thermal58" | "tag";

/** Physical dimensions per size, for anything (e.g. the print preview modal) that needs to display them without duplicating this table. */
export const PRINT_SIZE_LABELS: Record<PrintSize, string> = {
  a4: "A4 (210 × 297mm)",
  a5: "A5 (148 × 210mm)",
  a5l: "Half A4 / A5 Landscape (210 × 148mm)",
  a6: "A6 (105 × 148mm)",
  thermal: "Thermal 80mm",
  thermal58: "Thermal 58mm",
  tag: "Tag / Label (50 × 30mm)",
};

interface PrintLayoutProps {
  children: ReactNode;
  title: string;
  docNumber: string;
  docType?: PrintDocType;
  recordId?: string;
  createdAt?: number | string | Date;
  verificationPublicToken?: string | null;
  partyLabel?: string | null;
  totalPaise?: number | null;
  size?: PrintSize;
  showQR?: boolean;
  qrLabel?: string;
  qrPosition?: "header" | "footer" | "none";
  footerLine?: string;
  /**
   * When true (default for a4/a5), the document is measured after render and
   * scaled down just enough to fit one physical page whenever the content is
   * only slightly over — avoiding a near-empty second page for a few
   * overflowing lines. Never scales UP, and gives up (prints across however
   * many pages the content genuinely needs) once shrinking would make text
   * smaller than a legibility floor, per "only create multiple pages when
   * the actual business content requires it."
   */
  autoFit?: boolean;
  /** Branch the printed record belongs to — resolves the branch's own address/phone/GSTIN override, same as print-header.tsx. Falls back to the currently-selected branch, then "MAIN". */
  branchId?: string;
}

export type PrintOrientation = "portrait" | "landscape";

/**
 * The CSS `@page size` for each format — its REAL physical page, not "auto".
 *
 * Every non-thermal size used to fall through to "A4 portrait", so an A5
 * document was told to print on A4 stock. And the preview's override emitted
 * `size: auto <orientation>`, which throws the paper size away entirely — which
 * is why choosing a size changed nothing on paper. Both go through this table
 * now, so what the user picks is what the printer is told.
 */
export const PAGE_SIZE_CSS: Record<PrintSize, string> = {
  a4: "A4 portrait",
  a5: "A5 portrait",
  a5l: "A5 landscape",
  a6: "A6 portrait",
  thermal: "80mm auto",
  thermal58: "58mm auto",
  tag: "50mm 30mm",
};

/** Sizes with a fixed sheet, whose orientation the user may legitimately flip. */
export const ARCHIVAL_SIZES: PrintSize[] = ["a4", "a5", "a5l", "a6"];

/** Whether a format is portrait or landscape by nature. */
export function defaultOrientation(size: PrintSize): PrintOrientation {
  return size === "a5l" ? "landscape" : "portrait";
}

/**
 * The `@page size` value for a format, optionally re-oriented by the user.
 * Roll/label stock (thermal, tag) has no meaningful orientation — its size is
 * returned untouched rather than being silently rotated.
 */
export function pageSizeCss(size: PrintSize, orientation?: PrintOrientation): string {
  const base = PAGE_SIZE_CSS[size];
  if (!orientation || !ARCHIVAL_SIZES.includes(size)) return base;
  // "A4 portrait" → "A4 <orientation>"
  const paper = base.split(" ")[0];
  return `${paper} ${orientation}`;
}

const MM_TO_PX = 96 / 25.4; // 96dpi

/**
 * Physical sheet, in mm, for the sizes that have one. Roll/label stock
 * (thermal, tag) has no fixed height and is absent on purpose — it is excluded
 * from auto-fit and from orientation.
 */
export const SHEET_MM: Partial<Record<PrintSize, { width: number; height: number }>> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a5l: { width: 210, height: 148 },
  a6: { width: 105, height: 148 },
};

/** The sheet as oriented — flipping orientation flips the sheet, on screen and on paper alike. */
export function sheetMm(size: PrintSize, orientation: PrintOrientation) {
  const sheet = SHEET_MM[size];
  if (!sheet) return undefined;
  const isLandscape = orientation === "landscape";
  const long = Math.max(sheet.width, sheet.height);
  const short = Math.min(sheet.width, sheet.height);
  return isLandscape ? { width: long, height: short } : { width: short, height: long };
}

/** Default @page margins per size, in mm. The user may override all four (see print-setup-store). */
export const DEFAULT_MARGINS: Record<PrintSize, PrintMargins> = {
  a4: { top: 12, right: 15, bottom: 15, left: 15 },
  a5: { top: 10, right: 12, bottom: 12, left: 12 },
  a5l: { top: 8, right: 10, bottom: 12, left: 10 },
  a6: { top: 8, right: 10, bottom: 10, left: 10 },
  thermal: { top: 2, right: 2, bottom: 2, left: 2 },
  thermal58: { top: 1, right: 1, bottom: 1, left: 1 },
  tag: { top: 1, right: 1, bottom: 1, left: 1 },
};

export function marginCss(m: PrintMargins): string {
  return `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
}

const MIN_FIT_SCALE = 0.75; // never shrink text past 75% — the legibility floor

export function PrintLayout({
  children,
  title,
  docNumber,
  docType,
  recordId,
  createdAt,
  size: declaredSize = "a4",
  showQR = false,
  qrLabel = "Verify",
  qrPosition = "header",
  footerLine,
  autoFit = true,
  branchId,
  verificationPublicToken,
  partyLabel,
  totalPaise,
}: PrintLayoutProps) {
  const { firm: profile, branding, branches, selectedBranchId } = useSettings();
  // Page setup (paper size, orientation, margins, scale, fit-to-page). The
  // document declares its own default; the user's override wins. These same
  // values produce BOTH the on-screen sheet below AND the @page rule the
  // printer/printToPDF is given — so preview and paper always match.
  const sizeOverride = usePrintSetup((s) => s.sizeOverride);
  const orientationOverride = usePrintSetup((s) => s.orientation);
  const marginOverride = usePrintSetup((s) => s.margins);
  const scalePct = usePrintSetup((s) => s.scalePct);
  const fitToPage = usePrintSetup((s) => s.fitToPage);

  const size = sizeOverride ?? declaredSize;
  const orientation: PrintOrientation = ARCHIVAL_SIZES.includes(size)
    ? (orientationOverride ?? defaultOrientation(size))
    : defaultOrientation(size);
  const margins: PrintMargins = marginOverride ?? DEFAULT_MARGINS[size];
  const sheet = sheetMm(size, orientation);
  const scale = scalePct / 100;
  // Same branch-aware resolution print-header.tsx already uses — without
  // this, every document printed through PrintLayout showed the firm's
  // global address/phone/GSTIN only, never a branch's own override, even
  // though print-header.tsx's 3 consumers already got this correctly.
  const resolvedBranchId = branchId || selectedBranchId || "MAIN";
  const branch = branches.find((b) => b.id === resolvedBranchId);
  const displayAddress = branch?.address || profile.address;
  const displayPhone = branch?.phone || profile.phone;
  const displayGstin = branch?.gstin || profile.gstin;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  // Measured against THIS sheet at THIS orientation, minus THESE margins —
  // not a hardcoded A4 — so fit-to-page fits the page actually being printed.
  const usableHeightPx = sheet
    ? (sheet.height - margins.top - margins.bottom) * MM_TO_PX
    : undefined;
  // Usable printable WIDTH, same basis. A wide ledger (many columns) overflows
  // the sheet horizontally and gets clipped at the page edge — height-only
  // auto-fit never caught that. Scaling by the worse of the two ratios keeps
  // the whole document inside the chosen paper, so no column is ever cut.
  const usableWidthPx = sheet ? (sheet.width - margins.left - margins.right) * MM_TO_PX : undefined;
  const shouldAutoFit =
    autoFit && fitToPage && usableHeightPx !== undefined && usableWidthPx !== undefined;

  useLayoutEffect(() => {
    if (!shouldAutoFit || !usableHeightPx || !usableWidthPx || !bodyRef.current) return;
    const measure = () => {
      const el = bodyRef.current;
      if (!el) return;
      el.style.zoom = "";
      const contentHeight = el.scrollHeight;
      // scrollWidth catches horizontal overflow (a table wider than the sheet);
      // clientWidth is the current laid-out width. Use the larger so an
      // over-wide table shrinks even before it forces a scrollbar.
      const contentWidth = Math.max(el.scrollWidth, el.clientWidth);
      const heightScale = contentHeight > usableHeightPx ? usableHeightPx / contentHeight : 1;
      const widthScale = contentWidth > usableWidthPx ? usableWidthPx / contentWidth : 1;
      const next = Math.min(heightScale, widthScale);
      // Width overflow is a hard cut (a lost column) — allow shrinking below the
      // vertical legibility floor when it's width that overflows, so nothing is
      // clipped; otherwise keep the floor. Below the floor, height overflow just
      // paginates (zoom reflows and breaks across pages), so we don't shrink text
      // into illegibility — we let it flow onto however many pages it needs.
      const floor = widthScale < heightScale ? 0.4 : MIN_FIT_SCALE;
      setFitScale(next < 1 ? Math.max(floor, next) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [shouldAutoFit, usableHeightPx, usableWidthPx, children]);

  // Padding/chrome only — the sheet's own width/height comes from `sheet`
  // above (so an orientation flip actually re-shapes it on screen), and roll
  // stock keeps its fixed roll width.
  const sizeClasses: Record<PrintSize, string> = {
    a4: "w-[210mm] p-8 mx-auto bg-white text-black border border-stone-200 shadow-md print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    a5: "w-[148mm] p-6 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    // Half A4 — an A4 sheet cut across. The workshop's standard job-card stock:
    // two per sheet, sits flat on the bench next to the piece.
    a5l: "w-[210mm] p-5 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    a6: "w-[105mm] p-4 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    thermal:
      "w-[80mm] p-4 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    thermal58:
      "w-[58mm] p-2 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    tag: "w-[50mm] p-2 mx-auto bg-white text-black border border-stone-100 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
  };

  const isThermalOrTag = size === "thermal" || size === "thermal58" || size === "tag";
  // Scopes this instance's print reset, so a page holding several PrintLayouts
  // (report shells) can't have one sheet's rule hit another's.
  const rootId = `print-root-${useId().replace(/:/g, "")}`;

  return (
    <div
      id={rootId}
      className={sizeClasses[size]}
      data-testid="print-layout-root"
      data-print-size={size}
      data-print-orientation={orientation}
      style={{
        // CSS zoom (not transform) — it reflows and is honoured by Chromium's
        // print/printToPDF renderer, so the scale the user sees is the scale
        // that reaches the paper.
        ...(scale !== 1 ? { zoom: scale } : {}),
        ...(sheet ? { width: `${sheet.width}mm`, minHeight: `${sheet.height}mm` } : {}),
      }}
    >
      {/* Universal Print System Overrides */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          .no-print, [data-testid="print-toolbar"] {
            display: none !important;
          }
          /* App chrome only — never the document's own semantic header/footer,
             which is what these selectors would hit inside the print window. */
          header:not(#${rootId} *),
          footer:not(#${rootId} *),
          nav:not(#${rootId} *),
          aside:not(#${rootId} *) {
            display: none !important;
          }
          /* The on-screen sheet is sized in mm so the preview is physically
             true; on paper the page box already IS that sheet, so the root
             fills it instead of overflowing it by its own margins. */
          #${rootId} {
            width: 100% !important;
            min-height: 0 !important;
          }
          /* The real page: the size and margins the user actually chose.
             printToPDF runs with preferCSSPageSize, and printDocument()
             carries this very rule into the print window — so this is what
             the printer is told, not a decorative default. */
          @page {
            size: ${pageSizeCss(size, orientation)};
            margin: ${marginCss(margins)};
          }
          /* High-Contrast Table Border Enforcement */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #78716c !important; /* stone-500 deep gray border */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          thead {
            display: table-header-group !important;
            background-color: #f5f5f4 !important; /* stone-100 */
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Text clipping and spacing fixes */
          h1, h2, h3, h4, p, span, div, td {
            word-break: break-word !important;
            overflow-wrap: break-word !important;
          }
        }
      `}</style>

      {/* Visual Header */}
      {!isThermalOrTag ? (
        <div className="flex justify-between items-start border-b-2 border-stone-300 pb-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-1">
              <Logo variant="png" className="h-12 w-12 object-contain flex-shrink-0" />
              <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 leading-none">
                {branding.printHeader || profile.shopName || branding.applicationName}
              </h1>
            </div>
            {(profile.tagline || branding.tagline) && (
              <p className="text-[10px] italic font-medium text-stone-600 uppercase tracking-wider">
                {profile.tagline || branding.tagline}
              </p>
            )}
            <p className="text-xs text-stone-600 font-mono mt-1 max-w-sm leading-relaxed">
              {displayAddress}
            </p>
            {branch && branch.id !== "MAIN" && (
              <p className="text-[10px] font-semibold text-stone-700">({branch.name})</p>
            )}
            {displayPhone && (
              <p className="text-xs text-stone-500 font-mono">
                Phone: <span className="font-semibold">{displayPhone}</span>
                {profile.email && <span> · {profile.email}</span>}
              </p>
            )}
            {profile.website && (
              <p className="text-xs text-stone-500 font-mono">
                Web: <span className="font-semibold">{profile.website}</span>
              </p>
            )}
          </div>

          <div className="text-right flex flex-col items-end gap-2">
            <div className="inline-block bg-stone-100 border border-stone-300 px-3 py-1.5 rounded">
              <span className="font-serif text-sm font-bold uppercase tracking-wider text-black">
                {title}
              </span>
            </div>
            <div className="font-mono text-xs text-stone-800 space-y-0.5">
              <div>
                Doc No: <strong className="font-semibold">{docNumber}</strong>
              </div>
              {createdAt && (
                <div>
                  Date: {new Date(createdAt).toLocaleString("en-IN", { dateStyle: "medium" })}
                </div>
              )}
              {displayGstin && (
                <div className="text-[10px] font-semibold text-stone-600">GST: {displayGstin}</div>
              )}
            </div>

            {showQR && qrPosition === "header" && docType && recordId && (
              <div className="mt-1">
                <PrintQR
                  docType={docType}
                  docNumber={docNumber}
                  recordId={recordId}
                  createdAt={createdAt}
                  size={64}
                  label={qrLabel}
                  verificationPublicToken={verificationPublicToken}
                  partyLabel={partyLabel}
                  totalPaise={totalPaise}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Compressed Header for Thermal / Jewellery Tag sizes */
        <div className="text-center border-b border-dashed border-stone-400 pb-2 mb-3">
          <h2 className="font-serif text-sm font-bold tracking-tight text-stone-900">
            {profile.shopName ||
              branding.printHeader ||
              branding.companyName ||
              branding.applicationName}
          </h2>
          <div className="text-[9px] font-mono text-stone-600 leading-tight">
            {title} · <span className="font-semibold">{docNumber}</span>
          </div>
          {createdAt && (
            <div className="text-[8px] text-stone-500 font-mono">
              {new Date(createdAt).toLocaleString("en-IN", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </div>
          )}
        </div>
      )}

      {/* Primary Payload Body — auto-fit shrinks content just enough to
          avoid a near-empty second page; never grows it, never shrinks past
          the legibility floor. Uses `zoom` (not `transform: scale`): zoom
          REFLOWS and paginates in Chromium's print/printToPDF renderer, so a
          long ledger shrinks to the floor and then breaks cleanly across as
          many pages as it needs. A transform would render one continuous
          scaled block that overflows page one and gets cut off — the exact
          overflow bug this replaces. */}
      <div
        ref={bodyRef}
        className="flex-1 min-h-[1.5in]"
        style={shouldAutoFit && fitScale < 1 ? { zoom: fitScale } : undefined}
      >
        {children}
      </div>

      {/* Visual Footer */}
      {!isThermalOrTag ? (
        <div className="mt-12">
          {/* Footer message / legal compliance line */}
          <div className="border-t border-dashed border-stone-300 pt-4 text-center">
            <p className="text-[10px] text-stone-600 font-serif italic">
              {footerLine ||
                profile.footerLine ||
                "Official transaction record. Handcrafted quality and guaranteed purity."}
            </p>
            <div className="text-[8px] font-mono text-stone-400 mt-1 tracking-wider uppercase">
              SYSTEM VERIFIED ORIGINAL COPY · HIGH-CONTRAST INKJET/LASER OPTIMIZED
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            {showQR && qrPosition === "footer" && docType && recordId && (
              <div className="shrink-0">
                <PrintQR
                  docType={docType}
                  docNumber={docNumber}
                  recordId={recordId}
                  createdAt={createdAt}
                  size={64}
                  label={qrLabel}
                  verificationPublicToken={verificationPublicToken}
                  partyLabel={partyLabel}
                  totalPaise={totalPaise}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <AvsPrintFooter className="mt-0" />
            </div>
          </div>
        </div>
      ) : (
        /* Compressed/Thermal style small footer */
        <div className="mt-4 pt-1.5 border-t border-dashed border-stone-400 text-center text-[8px] font-mono text-stone-600 space-y-1">
          <div>Thank you for your valued custom.</div>
          <div className="text-[7px] text-stone-500 uppercase">Verified Transaction Copy</div>
          {showQR && docType && recordId && (
            <div className="pt-2 flex justify-center">
              <PrintQR
                docType={docType}
                docNumber={docNumber}
                recordId={recordId}
                createdAt={createdAt}
                size={56}
                label={qrLabel}
              />
            </div>
          )}
          <AvsPrintFooter className="mt-2 text-[7px]" />
        </div>
      )}
    </div>
  );
}

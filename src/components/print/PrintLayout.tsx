import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-store";
import { PrintQR } from "@/components/print-qr";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { Logo } from "@/components/ui/Logo";
import type { PrintDocType } from "@/lib/printlog-store";

interface PrintLayoutProps {
  children: ReactNode;
  title: string;
  docNumber: string;
  docType?: PrintDocType;
  recordId?: string;
  createdAt?: number | string | Date;
  size?: "a4" | "a5" | "thermal" | "thermal58" | "tag";
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

// A4 usable height in mm after PrintLayout's own margin (297mm page - 27mm
// margin from the @page rule below), converted to px at 96dpi/25.4mm-per-inch.
const A4_USABLE_HEIGHT_PX = ((297 - 27) / 25.4) * 96;
const MIN_FIT_SCALE = 0.75; // never shrink text past 75% — the legibility floor

export function PrintLayout({
  children,
  title,
  docNumber,
  docType,
  recordId,
  createdAt,
  size = "a4",
  showQR = true,
  qrLabel = "Verify",
  qrPosition = "header",
  footerLine,
  autoFit = true,
  branchId,
}: PrintLayoutProps) {
  const { firm: profile, branches, selectedBranchId } = useSettings();
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
  const shouldAutoFit = autoFit && (size === "a4" || size === "a5");

  useLayoutEffect(() => {
    if (!shouldAutoFit || !bodyRef.current) return;
    const measure = () => {
      const el = bodyRef.current;
      if (!el) return;
      el.style.transform = "";
      const contentHeight = el.scrollHeight;
      if (contentHeight <= A4_USABLE_HEIGHT_PX) {
        setFitScale(1);
        return;
      }
      const scale = Math.max(MIN_FIT_SCALE, A4_USABLE_HEIGHT_PX / contentHeight);
      setFitScale(scale);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [shouldAutoFit, children]);

  // Width and height mapping for physical paper sizes
  const sizeClasses = {
    a4: "w-[210mm] min-h-[297mm] p-8 mx-auto bg-white text-black border border-stone-200 shadow-md print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    a5: "w-[148mm] min-h-[210mm] p-6 mx-auto bg-white text-black border border-stone-200 shadow-sm print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    thermal:
      "w-[80mm] p-4 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    thermal58:
      "w-[58mm] p-2 mx-auto bg-white text-black border border-stone-200 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
    tag: "w-[50mm] p-2 mx-auto bg-white text-black border border-stone-100 print:border-none print:p-0 print:shadow-none print:w-full print:min-h-0",
  };

  const isThermalOrTag = size === "thermal" || size === "thermal58" || size === "tag";

  return (
    <div className={sizeClasses[size]} data-testid="print-layout-root">
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
          .no-print, [data-testid="print-toolbar"], header, footer, nav, aside {
            display: none !important;
          }
          @page {
            size: ${size === "thermal" ? "80mm auto" : size === "thermal58" ? "58mm auto" : size === "tag" ? "50mm 30mm" : "A4 portrait"};
            margin: ${size === "thermal" ? "2mm" : size === "thermal58" ? "1mm" : size === "tag" ? "1mm" : "12mm 15mm 15mm 15mm"};
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
                {profile.shopName || "MAA TARA JEWELLERS"}
              </h1>
            </div>
            {profile.tagline && (
              <p className="text-[10px] italic font-medium text-stone-600 uppercase tracking-wider">
                {profile.tagline}
              </p>
            )}
            <p className="text-xs text-stone-600 font-mono mt-1 max-w-sm leading-relaxed">
              {displayAddress || "Main Market, Gold Bazar, West Bengal"}
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
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Compressed Header for Thermal / Jewellery Tag sizes */
        <div className="text-center border-b border-dashed border-stone-400 pb-2 mb-3">
          <h2 className="font-serif text-sm font-bold tracking-tight text-stone-900">
            {profile.shopName || "MAA TARA JEWELLERS"}
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
          the legibility floor, so genuinely long content still paginates. */}
      <div
        ref={bodyRef}
        className="flex-1 min-h-[1.5in]"
        style={
          shouldAutoFit && fitScale < 1
            ? {
                transform: `scale(${fitScale})`,
                transformOrigin: "top left",
                width: `${100 / fitScale}%`,
              }
            : undefined
        }
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

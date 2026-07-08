import { ReactNode } from "react";
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
}

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
}: PrintLayoutProps) {
  const profile = useSettings((s) => s.firm);

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
              {profile.address || "Main Market, Gold Bazar, West Bengal"}
            </p>
            {profile.phone && (
              <p className="text-xs text-stone-500 font-mono">
                Phone: <span className="font-semibold">{profile.phone}</span>
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
              {profile.gstin && (
                <div className="text-[10px] font-semibold text-stone-600">GST: {profile.gstin}</div>
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

      {/* Primary Payload Body */}
      <div className="flex-1 min-h-[1.5in]">{children}</div>

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

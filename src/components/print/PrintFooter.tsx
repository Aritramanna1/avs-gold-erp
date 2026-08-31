import { useSettings } from "@/lib/settings-store";

interface PrintFooterProps {
  className?: string;
  docType?: string;
  docId?: string;
}

/**
 * Standardized Document Branding and System Integrity Footer.
 * Configured via system preferences. Keeps print layout designs globally uniformed.
 */
export function PrintFooter({ className = "", docType = "", docId = "" }: PrintFooterProps) {
  const { developer } = useSettings();

  if (!developer || developer.footerEnabled === false) {
    return null;
  }

  return (
    <div
      className={`mt-6 pt-2 border-t border-dotted border-gray-300 flex flex-col sm:flex-row items-center justify-between text-[9px] text-gray-500 font-mono tracking-tight print:mt-4 print:pt-1.5 ${className}`}
      id="shared-erp-credit-footer"
      data-testid="print-footer-container"
    >
      <div className="flex flex-col items-start gap-0.5">
        <div className="flex items-center gap-1">
          <span>Powered by</span>
          <span className="font-semibold text-gray-700">
            {developer.avsName || "AVS Gold ERP — Arivahly Venture Sphere"}
          </span>
        </div>
        {docType && (
          <span className="text-[7.5px] text-gray-400 font-mono">
            Document Category: {docType} {docId && `· Ref: ${docId}`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1 sm:mt-0 text-[8px]">
        {developer.contactNumber && <span>Support: {developer.contactNumber}</span>}
        {developer.email && <span>Email: {developer.email}</span>}
      </div>
    </div>
  );
}

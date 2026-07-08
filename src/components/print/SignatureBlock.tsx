import { useSettings } from "@/lib/settings-store";

interface SignatureBlockProps {
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

/**
 * Signature indicators styled specifically for secure ERP transactions
 */
export function SignatureBlock({ leftLabel, rightLabel, className = "" }: SignatureBlockProps) {
  const settings = useSettings((s) => s.firm);

  // Fallbacks to user settings if not explicitly passed
  const displayLeft = leftLabel || settings.signatureLabelLeft || "Authorized Signatory";
  const displayRight = rightLabel || settings.signatureLabelRight || "Customer / Receiver";

  return (
    <div
      className={`grid grid-cols-2 gap-8 pt-8 mt-6 print:mt-12 text-center text-xs text-black border-t border-dashed border-black/10 print:border-black/20 ${className}`}
    >
      <div className="flex flex-col items-center justify-end h-14">
        <div className="w-36 border-b border-black/40 border-dotted mb-1.5" />
        <span className="font-semibold text-[10px] uppercase tracking-wider text-black/75">
          {displayLeft}
        </span>
      </div>
      <div className="flex flex-col items-center justify-end h-14">
        <div className="w-36 border-b border-black/40 border-dotted mb-1.5" />
        <span className="font-semibold text-[10px] uppercase tracking-wider text-black/75">
          {displayRight}
        </span>
      </div>
    </div>
  );
}

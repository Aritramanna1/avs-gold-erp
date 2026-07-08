import { ReactNode } from "react";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";

interface ArchivalPrintLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Premium archival office copy (A4/A5 scale) styled beautifully with crisp golden frames and clean typographic grids
 */
export function ArchivalPrintLayout({ children, title, subtitle }: ArchivalPrintLayoutProps) {
  const profile = useSettings((s) => s.firm);

  return (
    <div className="w-[210mm] max-w-full min-h-[297mm] p-8 mx-auto bg-white text-black font-sans leading-normal border border-neutral-300 shadow bg-gradient-to-b from-[#FAF8F5]/30 to-[#FFF] print:border-none print:shadow-none print:p-0">
      {/* Premium branded header */}
      <div className="flex justify-between items-start border-b-2 border-amber-600/30 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Logo variant="png" className="h-10 w-10 object-contain flex-shrink-0" />
            <h1 className="font-serif text-2xl font-bold tracking-tight text-amber-900 leading-none">
              {profile.shopName || "MAA TARA JEWELLERS"}
            </h1>
          </div>
          {profile.tagline && (
            <p className="text-[10px] italic font-medium text-amber-800/80 mt-1 uppercase tracking-wider">
              {profile.tagline}
            </p>
          )}
          <p className="text-xs text-stone-600 font-mono mt-1 w-80 leading-normal">
            {profile.address || "Main Market, Gold Bazar, West Bengal"}
          </p>
          {profile.phone && (
            <p className="text-xs text-stone-500 font-mono mt-0.5">Phone: {profile.phone}</p>
          )}
        </div>

        <div className="text-right">
          <div className="inline-block bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1 mb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800">
              {title}
            </span>
          </div>
          {subtitle && <p className="text-xs text-stone-500 font-mono">{subtitle}</p>}
          {profile.gstin && (
            <p className="text-xs text-stone-500 font-mono font-medium mt-1">
              GSTIN: {profile.gstin}
            </p>
          )}
        </div>
      </div>

      {/* Main payload */}
      <div className="flex-1 space-y-6">{children}</div>

      {/* Branded print footlines */}
      <div className="mt-12 border-t border-dashed border-amber-600/20 pt-4 text-center">
        <p className="text-[10px] text-stone-500 font-serif italic">
          {profile.footerLine ||
            "Official archival record. Handcrafted quality and guaranteed purity."}
        </p>
        <div className="text-[8px] font-mono text-stone-400 mt-2 tracking-wider">
          SYSTEM VERIFIED COPY · INKJET / LASER HIGH-CONTRAST OPTIMIZED
        </div>
      </div>
    </div>
  );
}

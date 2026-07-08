import { ReactNode } from "react";
import { useSettings } from "@/lib/settings-store";

interface ThermalPrintLayoutProps {
  children: ReactNode;
}

export function ThermalPrintLayout({ children }: ThermalPrintLayoutProps) {
  const shopName = useSettings((s) => s.firm.shopName);
  return (
    <div className="w-[80mm] max-w-full p-2 mx-auto bg-white text-black font-mono leading-tight border border-black/15 select-none print:border-none print:p-0">
      <div className="text-center pb-2 border-b border-black border-dashed mb-3">
        <h1 className="font-bold text-base tracking-tight uppercase">{shopName}</h1>
        <p className="text-[10px] uppercase font-semibold">Quick Slip</p>
      </div>

      {children}

      <div className="mt-4 border-t border-black border-dashed pt-2.5 text-center space-y-1">
        <p className="text-[8px] font-sans leading-snug tracking-normal text-black font-semibold text-center italic">
          NOTE: This is a quick thermal copy. Text may fade or darken over time. Keep away from
          heat, dampness and direct sunlight.
        </p>
        <p className="text-[8px] tracking-widest text-center font-bold">*** THANK YOU ***</p>
      </div>
    </div>
  );
}

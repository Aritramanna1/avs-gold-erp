import { ShoppingBag } from "lucide-react";
import { RETAIL_COMING_SOON_MESSAGE } from "@/lib/pilot-config";

/** Placeholder shown in place of any Retail-only screen during the Manufacturing-only pilot. */
export function RetailComingSoon() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto text-center">
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 mt-6">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-serif text-xl text-gold">{RETAIL_COMING_SOON_MESSAGE}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This ERP is running in Manufacturing Mode for the current pilot. Retail features remain in
          the codebase and will return in a future version.
        </p>
      </div>
    </div>
  );
}

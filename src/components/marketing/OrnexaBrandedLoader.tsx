import { useEffect, useState } from "react";
import { OrnexaBrandLogo } from "./OrnexaBrandLogo";
import { cn } from "@/lib/utils";

/**
 * Original Ornexa branded loader — subtle logo pulse, hard timeout, no infinite spin.
 */
export function OrnexaBrandedLoader({
  enabled = true,
  maxMs = 4000,
  label = "Loading",
  className,
}: {
  enabled?: boolean;
  maxMs?: number;
  label?: string;
  className?: string;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => setTimedOut(true), maxMs);
    return () => window.clearTimeout(t);
  }, [enabled, maxMs]);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-6 bg-[#faf8f4] px-6",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={!timedOut}
    >
      <div className="ornexa-loader-pulse">
        <OrnexaBrandLogo variant="stacked" />
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      {timedOut && (
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          This is taking longer than expected. Please check your connection or refresh the page.
        </p>
      )}
    </div>
  );
}

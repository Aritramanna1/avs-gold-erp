/** Approved AVS ERP lockups from brand artwork — do not redraw in CSS. */
import { cn } from "@/lib/utils";

type Variant = "horizontal" | "stacked" | "icon" | "wordmark";

const MARK = "/assets/ornexa-mark.png";
const FULL = "/assets/ornexa-logo-full.png";

export function OrnexaBrandLogo({
  variant = "horizontal",
  className,
  alt = "AVS ERP — Jewellery Ecosystem",
}: {
  variant?: Variant;
  className?: string;
  alt?: string;
}) {
  if (variant === "icon") {
    return <img src={MARK} alt={alt} className={cn("h-11 w-11 object-contain", className)} />;
  }

  if (variant === "stacked" || variant === "wordmark") {
    return (
      <img
        src={FULL}
        alt={alt}
        className={cn(
          variant === "stacked"
            ? "h-32 w-auto max-w-[240px] object-contain object-left"
            : "h-10 w-auto object-contain",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={FULL}
      alt={alt}
      className={cn("h-16 w-auto max-h-16 object-contain object-left", className)}
    />
  );
}

export function OrnexaParentAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      A product by AVS — Arivahly Venture Sphere
    </p>
  );
}

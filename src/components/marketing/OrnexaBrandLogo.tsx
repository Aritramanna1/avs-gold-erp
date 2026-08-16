/** Approved Ornexa brand lockups — crop from master artwork, do not redesign. */
import { cn } from "@/lib/utils";

type Variant = "horizontal" | "stacked" | "icon" | "wordmark";

const MASTER = "/assets/ornexa-brand-master.png";
const LOGO_SVG = "/assets/logo.svg";

export function OrnexaBrandLogo({
  variant = "horizontal",
  className,
  alt = "Ornexa — Jewellery Ecosystem",
}: {
  variant?: Variant;
  className?: string;
  alt?: string;
}) {
  if (variant === "wordmark") {
    return <img src={LOGO_SVG} alt={alt} className={cn("h-8 w-auto object-contain", className)} />;
  }

  if (variant === "icon") {
    return (
      <div
        className={cn(
          "relative h-12 w-12 overflow-hidden rounded-full border border-gold/30 bg-[#f8f4ec]",
          className,
        )}
        aria-hidden
      >
        <img
          src={MASTER}
          alt=""
          className="absolute left-1/2 top-[8%] h-[88%] w-[180%] max-w-none -translate-x-[28%] object-cover object-left"
        />
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <OrnexaBrandLogo variant="icon" className="h-16 w-16" />
        <div className="text-center">
          <p className="font-serif text-xl tracking-[0.2em] text-foreground">ORNEXA</p>
          <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            Jewellery Ecosystem
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <OrnexaBrandLogo variant="icon" className="h-11 w-11 shrink-0" />
      <div className="leading-tight">
        <p className="font-serif text-lg tracking-[0.18em] text-foreground">ORNEXA</p>
        <p className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground">
          Jewellery Ecosystem
        </p>
      </div>
    </div>
  );
}

export function OrnexaParentAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      A product by AVS — Arivahly Venture Sphere
    </p>
  );
}

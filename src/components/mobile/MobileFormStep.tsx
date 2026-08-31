import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileFormStepChrome({
  step,
  total,
  title,
  children,
  className,
}: {
  step: number;
  total: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Step {step} of {total}
        </p>
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full", i < step ? "bg-gold" : "bg-border")}
            />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

export function MobileFormStepActions({
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  nextDisabled,
  nextLoading,
  hideBack,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  hideBack?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-auto flex gap-2 border-t border-border bg-background/95 px-1 pt-3 ornexa-sheet-footer-safe backdrop-blur-sm">
      {!hideBack && onBack ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[var(--touch-target)] flex-1"
          onClick={onBack}
        >
          {backLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        className="min-h-[var(--touch-target)] flex-[1.4] bg-gold text-black hover:bg-gold/90 font-semibold"
        disabled={nextDisabled || nextLoading}
        onClick={onNext}
      >
        {nextLoading ? "Saving…" : nextLabel}
      </Button>
    </div>
  );
}

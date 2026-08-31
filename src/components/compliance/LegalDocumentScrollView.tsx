import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/native/platform";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  acceptLabel?: string;
  declineLabel?: string;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
  /** Force dark high-contrast chrome (Capacitor trial/invite overlays). */
  variant?: "default" | "nativeDark";
};

/**
 * Explicit-consent UX: Accept stays disabled until the user scrolls to the end.
 * This scroll-to-end rule is AVS ERP policy — not a Google OAuth requirement.
 */
export function LegalDocumentScrollView({
  title,
  subtitle,
  children,
  acceptLabel = "Accept & Continue",
  declineLabel = "Decline / Exit",
  onAccept,
  onDecline,
  busy = false,
  className,
  variant,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const dark = variant === "nativeDark" || (variant == null && isNativeApp());

  const checkScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= 24) setReachedEnd(true);
  }, []);

  useEffect(() => {
    setReachedEnd(false);
    const el = scrollerRef.current;
    if (!el) return;
    // Short content (nothing to scroll) counts as reached.
    const id = requestAnimationFrame(() => {
      if (el.scrollHeight <= el.clientHeight + 8) setReachedEnd(true);
      else checkScroll();
    });
    return () => cancelAnimationFrame(id);
  }, [children, checkScroll]);

  return (
    <div
      className={cn(
        "flex h-[min(88dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-lg",
        dark
          ? "border-white/15 bg-[#14110f] text-white"
          : "border-border bg-card text-card-foreground",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-scroll-title"
    >
      <header
        className={cn(
          "shrink-0 border-b px-4 py-3",
          dark ? "border-white/10" : "border-border",
        )}
      >
        <div className="flex items-center gap-2">
          <Logo className="h-6" />
          <div>
            <h2
              id="legal-scroll-title"
              className={cn(
                "text-sm font-semibold",
                dark ? "text-white" : "text-foreground",
              )}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className={cn("text-[10px]", dark ? "text-white/55" : "text-muted-foreground")}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div
        ref={scrollerRef}
        onScroll={checkScroll}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap",
          dark ? "text-white/85" : "text-muted-foreground",
        )}
        data-testid="legal-scroll-body"
      >
        {children}
        <div className="h-6" aria-hidden />
      </div>

      <footer
        className={cn(
          "shrink-0 space-y-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          dark ? "border-white/10 bg-black/40" : "border-border bg-muted/30",
        )}
      >
        <p className={cn("text-[10px]", dark ? "text-white/50" : "text-muted-foreground")}>
          Scroll to the end to enable Accept. This is AVS ERP&apos;s explicit-consent UX — not a
          Google requirement.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            className="w-full bg-gold text-slate-950 hover:bg-gold/90 sm:flex-1"
            disabled={!reachedEnd || busy}
            onClick={() => void onAccept()}
            data-testid="legal-accept"
          >
            {acceptLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full sm:flex-1",
              dark && "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white",
            )}
            disabled={busy}
            onClick={() => void onDecline()}
            data-testid="legal-decline"
          >
            {declineLabel}
          </Button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Canonical mobile page layout — scroll body + optional sticky primary action.
 * Safe-area aware via .ornexa-sticky-action-bar / --ornexa-inset-*.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobilePageScaffoldProps {
  title: string;
  subtitle?: string;
  /** Optional leading control (back) */
  leading?: ReactNode;
  /** Optional trailing controls */
  trailing?: ReactNode;
  children: ReactNode;
  /** Sticky footer primary actions (Save / Post) */
  stickyAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function MobilePageScaffold({
  title,
  subtitle,
  leading,
  trailing,
  children,
  stickyAction,
  className,
  bodyClassName,
}: MobilePageScaffoldProps) {
  return (
    <div className={cn("ornexa-mobile-page bg-background text-foreground", className)}>
      <header className="shrink-0 border-b border-border bg-card/90 px-4 py-3 ornexa-safe-pad-x">
        <div className="flex items-start gap-2">
          {leading}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-lg font-semibold leading-tight truncate">{title}</h1>
            {subtitle ? (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
            ) : null}
          </div>
          {trailing}
        </div>
      </header>
      <div className={cn("ornexa-mobile-page__body px-4 py-3 ornexa-safe-pad-x", bodyClassName)}>
        {children}
      </div>
      {stickyAction ? <div className="ornexa-sticky-action-bar">{stickyAction}</div> : null}
    </div>
  );
}

export interface MobileListCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  className?: string;
}

export function MobileListCard({
  title,
  subtitle,
  meta,
  onClick,
  trailing,
  className,
}: MobileListCardProps) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        {meta ? <p className="text-[11px] text-muted-foreground mt-1 font-mono">{meta}</p> : null}
      </div>
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 min-h-[var(--touch-target)] active:scale-[0.99] transition-transform",
          className,
        )}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "w-full text-left rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 min-h-[var(--touch-target)]",
        className,
      )}
    >
      {body}
    </div>
  );
}

export function MobileFilterChips({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold min-h-[2.25rem]",
            value === o.id
              ? "border-gold bg-gold/15 text-gold"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  showBack?: boolean;
  backLabel?: string;
  className?: string;
  /** Compact variant for nested panels / drawers */
  dense?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  backTo,
  onBack,
  showBack,
  backLabel,
  className,
  dense = false,
}: PageHeaderProps) {
  const showBackControl = Boolean(backTo || onBack || showBack);
  const resolvedSubtitle = subtitle || description;

  return (
    <header className={cn("mb-5 space-y-1", dense && "mb-3", className)}>
      {showBackControl &&
        (backTo ? (
          <Link to={backTo as never}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 min-h-[var(--touch-target)] sm:min-h-0 px-2 gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel || "Back"}
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-h-[var(--touch-target)] sm:min-h-0 px-2 gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            onClick={onBack ?? (() => window.history.back())}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel || "Back"}
          </Button>
        ))}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground leading-tight",
              dense ? "text-lg" : "text-xl md:text-2xl",
            )}
          >
            {title}
          </h1>
          {resolvedSubtitle ? (
            <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">{resolvedSubtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 justify-start sm:justify-end shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

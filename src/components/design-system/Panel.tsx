import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "muted" | "inset";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

export function Panel({
  title,
  description,
  actions,
  padding = "md",
  variant = "default",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "ornexa-panel border border-border bg-card text-card-foreground",
        variant === "muted" && "bg-muted/40",
        variant === "inset" && "bg-background border-border/80",
        paddingMap[padding],
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

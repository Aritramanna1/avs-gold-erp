import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted/50 text-muted-foreground",
        info: "border-primary/25 bg-primary/8 text-primary",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/35 bg-warning/10 text-warning",
        danger: "border-destructive/35 bg-destructive/10 text-destructive",
        brand:
          "border-[color:var(--avs-gold)]/30 bg-[color:var(--avs-gold-soft)] text-[color:var(--avs-gold-deep)] dark:text-[color:var(--avs-gold)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone, dot, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {label}
    </span>
  );
}

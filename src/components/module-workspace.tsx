import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WorkspaceMetric = { label: string; value: string | number; detail?: string };
export type WorkspaceAction = { label: string; to: string; icon?: LucideIcon };

export function ModuleWorkspace({
  eyebrow,
  title,
  description,
  icon: Icon,
  metrics,
  actions,
  children,
  onRefresh,
  loading = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metrics: WorkspaceMetric[];
  actions: WorkspaceAction[];
  children?: ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-7 page-enter">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md border border-gold/30 bg-gold/5">
            <Icon className="h-5 w-5 text-gold" />
          </div>
          <div>
            <p className="erp-section-title">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        )}
      </header>
      {metrics.length > 0 && (
        <section className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div className="bg-card p-4" key={metric.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-gold">
                {loading ? "—" : metric.value}
              </p>
              {metric.detail && (
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="flex flex-wrap gap-2">
        {actions.map(({ label, to, icon: ActionIcon }) => (
          <Button asChild variant="outline" size="sm" key={to}>
            <Link to={to}>
              {ActionIcon && <ActionIcon />}
              {label}
              <ArrowRight />
            </Link>
          </Button>
        ))}
      </section>
      {children}
    </main>
  );
}

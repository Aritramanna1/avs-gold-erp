import { Link } from "@tanstack/react-router";
import type { MobileAction } from "@/lib/mobile/mobile-actions-catalog";

export function MobileActionGrid({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions: MobileAction[];
}) {
  return (
    <div className="space-y-4 p-4 pb-24 max-w-lg mx-auto">
      <header className="space-y-1">
        <h1 className="font-serif text-xl text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="grid gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              to={action.to}
              search={action.search}
              className="flex items-center gap-3 min-h-[var(--touch-target)] rounded-md border border-border bg-card px-4 py-3 hover:border-gold/40 active:scale-[0.99] transition-colors"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gold/10 text-gold">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{action.label}</p>
                {action.description ? (
                  <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

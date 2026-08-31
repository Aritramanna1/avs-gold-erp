import { useId } from "react";
import { Clock3, Sparkles, type LucideIcon } from "lucide-react";

interface ModuleComingSoonProps {
  title: string;
  message: string;
  icon?: LucideIcon;
}

/** Generic planned-workflow notice for scoped modules not yet enabled in this tenant. */
export function ModuleComingSoon({ title, message, icon: Icon = Sparkles }: ModuleComingSoonProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center p-4 md:p-8"
    >
      <div className="w-full rounded-md border border-border/80 bg-card p-8 text-center shadow-elegant motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200 md:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-md border border-gold/25 bg-gold/5 shadow-sm">
          <Icon className="h-7 w-7 text-gold" aria-hidden="true" />
        </div>
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Planned workflow
        </div>
        <h2 id={titleId} className="mt-4 font-serif text-2xl font-semibold text-gold">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{message}</p>
        <p className="mx-auto mt-5 max-w-xl border-t border-border/70 pt-4 text-xs text-muted-foreground/80">
          This workspace is not enabled for the current production scope. Existing Supabase records
          and active workflows are unaffected.
        </p>
      </div>
    </section>
  );
}

import { Sparkles, type LucideIcon } from "lucide-react";

interface ModuleComingSoonProps {
  title: string;
  message: string;
  icon?: LucideIcon;
}

/** Generic placeholder for any Workshop V1.1 deferred module/section — see src/lib/pilot-config.ts. */
export function ModuleComingSoon({ title, message, icon: Icon = Sparkles }: ModuleComingSoonProps) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto text-center">
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 mt-6">
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-serif text-xl text-gold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

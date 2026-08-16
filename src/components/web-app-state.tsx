import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

type StateTone = "neutral" | "warning" | "danger";

const toneClasses: Record<StateTone, string> = {
  neutral: "border-border bg-card/45 text-muted-foreground",
  warning: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  danger: "border-destructive/35 bg-destructive/10 text-destructive",
};

export function WebAppState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  tone?: StateTone;
}) {
  return (
    <div className={`rounded-sm border border-dashed p-6 md:p-8 text-center ${toneClasses[tone]}`}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-current">
        {icon ?? <AlertCircle className="h-5 w-5" />}
      </div>
      <div className="font-medium text-foreground">{title}</div>
      {description && <p className="mx-auto mt-1 max-w-md text-sm">{description}</p>}
      {action && (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <WebAppState
      icon={<SearchX className="h-5 w-5" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function InlineSavingState({ label = "Saving..." }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  );
}

export function FormStatus({
  status,
  title,
  description,
}: {
  status: "error" | "saving" | "success" | "idle";
  title?: string;
  description?: string;
}) {
  if (status === "idle") return null;

  const Icon = status === "saving" ? Loader2 : status === "success" ? CheckCircle2 : AlertCircle;
  const tone =
    status === "success"
      ? "border-success/35 bg-success/10 text-success"
      : status === "saving"
        ? "border-border bg-muted/35 text-muted-foreground"
        : "border-destructive/35 bg-destructive/10 text-destructive";

  return (
    <div className={`flex gap-3 rounded-md border p-3 text-sm ${tone}`} role="status">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${status === "saving" ? "animate-spin" : ""}`} />
      <div>
        {title && <div className="font-medium text-foreground">{title}</div>}
        {description && <p className="mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmSummaryRow = { label: string; value: ReactNode };

/**
 * Informative confirm for gold / post / pay / delete — not a bare "Are you sure?".
 */
export function MobileConfirmSummary({
  open,
  onOpenChange,
  title,
  description,
  rows,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: ConfirmSummaryRow[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-gold">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">
              Review details before confirming.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <dl className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">
                {row.label}
              </dt>
              <dd className="text-right font-medium tabular-nums break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[var(--touch-target)]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`min-h-[var(--touch-target)] ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-gold text-black hover:bg-gold/90"
            }`}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

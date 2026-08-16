import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentConfirmationState } from "@/hooks/use-payment-confirmation";

export function PaymentResultBanner({
  state,
  message,
  onDismiss,
  onRetry,
}: {
  state: PaymentConfirmationState;
  message: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  if (state === "idle" || !message) return null;

  const styles = {
    polling: "border-primary/30 bg-primary/5 text-foreground",
    confirmed: "border-emerald-500/30 bg-emerald-500/10 text-foreground",
    pending: "border-amber-500/30 bg-amber-500/10 text-foreground",
    failed: "border-destructive/30 bg-destructive/10 text-foreground",
  } as const;

  const icons = {
    polling: <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />,
    confirmed: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    pending: <Clock className="h-5 w-5 text-amber-500 shrink-0" />,
    failed: <XCircle className="h-5 w-5 text-destructive shrink-0" />,
  };

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${styles[state]}`}
      data-testid="payment-result-banner"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icons[state]}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {state === "polling" && "Processing payment"}
            {state === "confirmed" && "Payment successful"}
            {state === "pending" && "Payment pending confirmation"}
            {state === "failed" && "Payment not completed"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {state === "failed" && onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {(state === "confirmed" || state === "pending" || state === "failed") && onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

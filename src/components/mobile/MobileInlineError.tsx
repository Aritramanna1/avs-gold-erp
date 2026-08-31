/**
 * Compact mobile error recovery — no giant red AI blocks.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MobileInlineErrorProps {
  message: string;
  onRetry?: () => void;
  onKeepEditing?: () => void;
  onGoBack?: () => void;
  onReportIssue?: () => void;
  className?: string;
}

export function MobileInlineError({
  message,
  onRetry,
  onKeepEditing,
  onGoBack,
  onReportIssue,
  className,
}: MobileInlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border border-border bg-card p-3 text-sm space-y-2", className)}
    >
      <p className="text-foreground leading-snug">{message}</p>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="min-h-[var(--touch-target)]"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
        {onKeepEditing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[var(--touch-target)]"
            onClick={onKeepEditing}
          >
            Keep editing
          </Button>
        ) : null}
        {onGoBack ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-[var(--touch-target)]"
            onClick={onGoBack}
          >
            Go back
          </Button>
        ) : null}
        {onReportIssue ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-[var(--touch-target)]"
            onClick={onReportIssue}
          >
            Report issue
          </Button>
        ) : null}
      </div>
    </div>
  );
}

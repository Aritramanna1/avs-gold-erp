import { AlertTriangle, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StagedLoadPhase } from "@/lib/performance/resilient-async";

interface StagedLoadPanelProps {
  phase: StagedLoadPhase;
  title?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onReportIssue?: () => void;
  compact?: boolean;
  className?: string;
}

export function StagedLoadPanel({
  phase,
  title = "Loading",
  onRetry,
  onGoHome,
  onReportIssue,
  compact = false,
  className = "",
}: StagedLoadPanelProps) {
  if (phase === "idle" || phase === "done") return null;

  const message =
    phase === "loading"
      ? "Please wait while we connect to your workspace…"
      : phase === "slow"
        ? "Connection is taking longer than usual. We're still trying…"
        : phase === "retry"
          ? "Still trying to connect. You can wait or retry now."
          : "We couldn't finish loading in time. Your session is safe — please retry.";

  return (
    <div
      className={`rounded-lg border border-border bg-card/95 shadow-sm ${compact ? "p-3" : "p-5"} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {phase === "failed" ? (
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden />
        ) : phase === "slow" || phase === "retry" ? (
          <WifiOff className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" aria-hidden />
        ) : (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gold mt-0.5" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
          {(phase === "retry" || phase === "failed") && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onRetry ? (
                <Button size="sm" variant="default" onClick={onRetry}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Retry
                </Button>
              ) : null}
              {onGoHome ? (
                <Button size="sm" variant="outline" onClick={onGoHome}>
                  Go Home
                </Button>
              ) : null}
              {onReportIssue ? (
                <Button size="sm" variant="ghost" onClick={onReportIssue}>
                  Report Issue
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

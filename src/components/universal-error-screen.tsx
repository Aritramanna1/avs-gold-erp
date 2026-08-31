import { useState } from "react";
import { AlertCircle, ChevronDown, Copy, Home, RotateCcw, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatErrorDetails, type NormalizedAppError } from "@/lib/error-handling";
import { toast } from "sonner";

interface UniversalErrorScreenProps {
  error: NormalizedAppError;
  fullScreen?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
  onBack?: () => void;
  /** Compact page-section recovery (default for route boundaries). */
  variant?: "critical" | "section";
}

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => {});
}

/**
 * Professional recovery UI — no giant red cards, no stack traces for shop users.
 * Technical diagnostics stay collapsed / logged; reference ID is secondary.
 */
export function UniversalErrorScreen({
  error,
  fullScreen = true,
  retryLabel = "Retry",
  onRetry,
  onBack,
  variant,
}: UniversalErrorScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const details = formatErrorDetails(error);
  const mode = variant ?? (fullScreen ? "critical" : "section");

  const headline =
    mode === "section"
      ? "We couldn’t load this section"
      : error.category === "network"
        ? "Connection interrupted"
        : "Something went wrong";

  const body =
    mode === "section"
      ? "Your session is still open. Try again, or go back and continue elsewhere."
      : error.category === "network"
        ? "Check your connection, then retry. Your data is safe on the server."
        : "You can retry or return to the home screen. If it keeps happening, share the reference with support.";

  return (
    <div
      className={
        fullScreen
          ? "min-h-screen bg-background px-4 py-10 flex items-start justify-center"
          : "min-h-[280px] px-4 py-8 flex items-start justify-center"
      }
      role="alert"
    >
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-base font-semibold tracking-tight text-foreground">{headline}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRetry ?? (() => window.location.reload())}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {retryLabel}
          </Button>
          <Button size="sm" variant="outline" onClick={onBack ?? (() => history.back())}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Go back
          </Button>
          {mode === "critical" ? (
            <Button size="sm" variant="ghost" onClick={() => (window.location.href = "/app")}>
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              Home
            </Button>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Reference <span className="font-mono text-foreground/80">{error.id}</span>
          {" · "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              copyText(`${error.id}\n${error.message}`);
              toast.message("Reference copied");
            }}
          >
            Copy for support
          </button>
        </p>

        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between py-2 text-left text-xs text-muted-foreground"
          >
            Diagnostics for support
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {detailsOpen ? (
            <div className="space-y-2 pb-2">
              <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-[10px] leading-4 text-muted-foreground">
                {details}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  copyText(details);
                  toast.message("Diagnostics copied");
                }}
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
                Copy diagnostics
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Compact inline failure for a single widget/section — never a full page. */
export function InlineSectionError({
  title = "Unable to load",
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground flex items-center justify-between gap-3"
      role="status"
    >
      <span>{title}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold text-foreground underline underline-offset-2"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Subtle non-blocking connection strip. */
export function ConnectionStatusBanner({ message }: { message?: string }) {
  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-900 dark:text-amber-100"
      role="status"
    >
      {message ?? "Connection interrupted — retrying…"}
    </div>
  );
}

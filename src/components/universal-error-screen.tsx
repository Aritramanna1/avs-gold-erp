import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Headphones,
  Home,
  MessageSquare,
  RotateCcw,
  TicketPlus,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatErrorDetails, type NormalizedAppError } from "@/lib/error-handling";
import { createSupportTicket } from "@/lib/platform-support-service";
import { toast } from "sonner";

interface UniversalErrorScreenProps {
  error: NormalizedAppError;
  fullScreen?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => {});
}

function supportPageUrl(
  error: NormalizedAppError,
  details: string,
  mode: "ticket" | "chat",
  ticketId?: string,
) {
  const params = new URLSearchParams({
    mode,
    subject: `${error.title} - ${error.id}`,
    description: `Please help with this AVS ERP error.\n\n${details}`,
  });
  if (ticketId) params.set("open", ticketId);
  return `/settings/support?${params.toString()}`;
}

export function UniversalErrorScreen({
  error,
  fullScreen = true,
  retryLabel = "Retry",
  onRetry,
  onBack,
}: UniversalErrorScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [supportBusy, setSupportBusy] = useState<"ticket" | "chat" | null>(null);
  const details = formatErrorDetails(error);

  async function handleSupportAction(mode: "ticket" | "chat") {
    setSupportBusy(mode);
    try {
      const ticket = await createSupportTicket({
        subject: `${error.title} - ${error.id}`,
        description: `Please help with this AVS ERP error.\n\n${details}`,
        category: error.category,
        priority: error.severity === "critical" ? "urgent" : "normal",
      });
      toast.success(`Ticket ${ticket.ticket_no} created.`);
      window.location.href = supportPageUrl(error, details, mode, ticket.id);
    } catch (supportError) {
      toast.error(
        supportError instanceof Error ? supportError.message : "Could not create a support ticket.",
      );
      window.location.href = supportPageUrl(error, details, mode);
    } finally {
      setSupportBusy(null);
    }
  }

  return (
    <div
      className={
        fullScreen
          ? "min-h-screen bg-background px-4 py-8"
          : "min-h-[420px] bg-background/40 px-4 py-8"
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{error.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.message}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.guidance}</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Error Reference ID
          </div>
          <div className="mt-1 break-all font-mono text-sm text-foreground">{error.id}</div>
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Technical summary
            </div>
            <div className="mt-1 break-words font-mono text-xs text-muted-foreground">
              {error.technicalMessage}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry ?? (() => window.location.reload())}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
          <Button variant="outline" onClick={onBack ?? (() => history.back())}>
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Go Back
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            <Home className="h-4 w-4" aria-hidden="true" />
            Return to Dashboard
          </Button>
          <Button variant="outline" onClick={() => copyText(details)}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy Error Details
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSupportAction("ticket")}
            disabled={supportBusy !== null}
          >
            <TicketPlus className="h-4 w-4" aria-hidden="true" />
            {supportBusy === "ticket" ? "Creating..." : "Create Ticket"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSupportAction("chat")}
            disabled={supportBusy !== null}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {supportBusy === "chat" ? "Opening..." : "Live Chat"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const subject = encodeURIComponent(`AVS Gold ERP Support - ${error.id}`);
              const body = encodeURIComponent(
                `Please help with this AVS Gold ERP error.\n\n${details}`,
              );
              window.location.href = `mailto:support@arivahly.in?subject=${subject}&body=${body}`;
            }}
          >
            <Headphones className="h-4 w-4" aria-hidden="true" />
            Contact Support
          </Button>
        </div>

        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
          >
            Technical details
            <ChevronDown
              className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {detailsOpen ? (
            <pre className="max-h-64 overflow-auto border-t border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
              {details}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

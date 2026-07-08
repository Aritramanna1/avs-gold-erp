/**
 * MTJ ERP — Communication log card (renders per-record).
 */
import { useCommLog, COMM_KIND_LABELS, type CommLinkedType } from "@/lib/comm-log-store";
import { TEMPLATE_KIND_LABELS } from "@/lib/wa-templates-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send } from "lucide-react";

export function CommLogCard({
  linkedType,
  linkedId,
}: {
  linkedType: CommLinkedType;
  linkedId: string;
}) {
  const allEvents = useCommLog((s) => s.events);
  const events = allEvents.filter((e) => e.linkedType === linkedType && e.linkedId === linkedId);
  const markSent = useCommLog((s) => s.markSent);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-lg text-gold">Communication log</h3>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No WhatsApp messages prepared yet.</p>
      ) : (
        <ol className="space-y-2 text-xs">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-background/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{TEMPLATE_KIND_LABELS[e.templateKind]}</div>
                <Badge
                  variant="outline"
                  className={
                    e.kind === "manually_sent"
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : e.kind === "opened_web" || e.kind === "opened_app"
                        ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  }
                >
                  {COMM_KIND_LABELS[e.kind]}
                </Badge>
              </div>
              <div className="text-muted-foreground mt-1">
                To {e.recipientLabel} · {e.recipientPhone} ·{" "}
                {new Date(e.ts).toLocaleString("en-IN")}
              </div>
              {e.kind !== "manually_sent" && (
                <div className="mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-xs"
                    onClick={() => markSent(e.id)}
                  >
                    <Send className="h-3 w-3" /> Mark manually sent
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[10px] text-muted-foreground mt-3">
        Status reflects ERP-side actions only (prepared, copied, opened, manually sent). No delivery
        / read receipts — official WhatsApp API not used.
      </p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { LifeBuoy, Loader2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Ticket = {
  id: string;
  ticket_no: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

type ThreadMessage = {
  id: string;
  body: string;
  status: string;
  created_at: string;
  sender: "customer" | "support";
};

type Thread = { ticket: Ticket; messages: ThreadMessage[] };

export const Route = createFileRoute("/settings/support")({
  head: () => ({ meta: [{ title: "Support · AVS Gold ERP" }] }),
  component: SupportPage,
});

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  waiting: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reopened: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadBusy, setThreadBusy] = useState(false);
  const [reply, setReply] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_my_support_tickets" as never);
      if (error) throw new Error(error.message);
      setTickets((data ?? []) as Ticket[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc(
        "create_staff_support_ticket" as never,
        {
          p_subject: subject,
          p_description: description,
          p_category: "staff",
          p_priority: "normal",
        } as never,
      );
      if (error) throw new Error(error.message);
      const ticket = data as unknown as Ticket;
      setSubject("");
      setDescription("");
      setTickets((prev) => [ticket, ...prev]);
      toast.success(`Ticket ${ticket.ticket_no} created.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openThread(ticketId: string) {
    setThreadBusy(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_customer_support_thread" as never,
        {
          p_ticket_id: ticketId,
        } as never,
      );
      if (error) throw new Error(error.message);
      setThread(data as unknown as Thread);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open this ticket.");
    } finally {
      setThreadBusy(false);
    }
  }

  // Live chat: subscribe to new replies on the open ticket's conversation so
  // they appear instantly, no manual refresh — RLS already scopes delivery
  // to this requester's own thread (see migration 20260811070000).
  useEffect(() => {
    if (!thread?.ticket?.id) return;
    const ticketId = thread.ticket.id;
    const channel = supabase
      .channel(`support-thread-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "platform_conversation_messages" },
        () => {
          void openThread(ticketId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.ticket?.id]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread?.ticket?.id || !reply.trim()) return;
    setThreadBusy(true);
    try {
      const { error } = await supabase.rpc(
        "reply_customer_support_ticket" as never,
        {
          p_ticket_id: thread.ticket.id,
          p_body: reply,
        } as never,
      );
      if (error) throw new Error(error.message);
      setReply("");
      await openThread(thread.ticket.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your reply.");
    } finally {
      setThreadBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Support"
        subtitle="Raise a ticket with Arivahly support and chat live once it's open."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="erp-surface rounded-md p-5 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-4 w-4 text-gold" /> New ticket
          </h2>
          <form className="space-y-3" onSubmit={submitTicket}>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
                minLength={3}
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening, and what did you expect instead?"
                minLength={10}
                maxLength={10000}
                rows={4}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit ticket
            </Button>
          </form>
        </div>

        <div className="erp-surface rounded-md p-5 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-gold" /> Your tickets
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No tickets yet.</p>
          ) : (
            <div className="divide-y divide-border/60 -mx-5">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void openThread(t.id)}
                  className="w-full text-left px-5 py-3 hover:bg-muted/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.subject}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{t.ticket_no}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase shrink-0 ${STATUS_STYLE[t.status] ?? STATUS_STYLE.open}`}
                  >
                    {t.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {thread ? (
        <div className="erp-surface rounded-md p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{thread.ticket.subject}</h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                {thread.ticket.ticket_no}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${STATUS_STYLE[thread.ticket.status] ?? STATUS_STYLE.open}`}
            >
              {thread.ticket.status}
            </Badge>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 border border-border/60 rounded-lg p-3 bg-muted/10">
            {thread.messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No messages yet — support will reply here.
              </p>
            ) : (
              thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.sender === "customer"
                      ? "ml-auto bg-gold/15 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
            <div ref={threadEndRef} />
          </div>

          {thread.ticket.status !== "closed" && (
            <form className="flex gap-2" onSubmit={sendReply}>
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a message…"
                disabled={threadBusy}
              />
              <Button
                type="submit"
                disabled={threadBusy || !reply.trim()}
                size="sm"
                className="gap-1.5"
              >
                {threadBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { FileText, Loader2, MessageCircle, Package, Wrench } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { guardRoute } from "@/lib/permissions";

type PortalData = {
  profile: { id: string; full_name: string; phone: string | null; email: string | null };
  invoices: Array<{ id: string; invoice_no?: string; status?: string; total_paise?: number }>;
  orders: Array<{ id: string; order_no?: string; status?: string }>;
  repairs: Array<{ id: string; repair_no?: string; status?: string }>;
  support_tickets: Array<{ id: string; ticket_no?: string; status?: string; subject?: string }>;
};

export const Route = createFileRoute("/customer-portal")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  component: CustomerPortal,
});

function CustomerPortal() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [threadReply, setThreadReply] = useState("");
  const [threadBusy, setThreadBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: result, error: queryError } = await (supabase as any).rpc(
        "get_customer_portal",
      );
      if (!active) return;
      if (queryError)
        setError("Your customer portal is not configured yet. Please contact the firm.");
      else setData(result as PortalData);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="erp-surface rounded-md p-6">
          <h1 className="text-xl font-semibold">Customer portal unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </section>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading customer portal" />
      </main>
    );
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setSubmitting(true);
    const { data: ticket, error: ticketError } = await (supabase as any).rpc(
      "create_customer_support_ticket",
      {
        p_subject: subject,
        p_description: description,
        p_category: "customer",
        p_priority: "normal",
      },
    );
    setSubmitting(false);
    if (ticketError) {
      setNotice(ticketError.message || "Could not create the support ticket.");
      return;
    }
    setSubject("");
    setDescription("");
    setNotice(`Ticket ${ticket.ticket_no} created successfully.`);
    setData((previous) =>
      previous ? { ...previous, support_tickets: [ticket, ...previous.support_tickets] } : previous,
    );
  }

  async function openThread(ticketId: string) {
    setThreadBusy(true);
    const { data: result, error: threadError } = await (supabase as any).rpc(
      "get_customer_support_thread",
      { p_ticket_id: ticketId },
    );
    setThreadBusy(false);
    if (threadError) {
      setNotice(threadError.message || "Could not load the support conversation.");
      return;
    }
    setThread(result);
  }

  async function sendThreadReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread?.ticket?.id || !threadReply.trim()) return;
    setThreadBusy(true);
    const { error: replyError } = await (supabase as any).rpc("reply_customer_support_ticket", {
      p_ticket_id: thread.ticket.id,
      p_body: threadReply,
    });
    setThreadBusy(false);
    if (replyError) {
      setNotice(replyError.message || "Could not send your reply.");
      return;
    }
    setThreadReply("");
    await openThread(thread.ticket.id);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">My account</p>
        <h1 className="mt-2 text-2xl font-semibold">Welcome, {data.profile.full_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your invoices, orders, and repairs in one place.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [FileText, "Invoices", data.invoices.length],
          [Package, "Orders", data.orders.length],
          [Wrench, "Repairs", data.repairs.length],
        ].map(([Icon, label, count]) => {
          const Component = Icon as typeof FileText;
          return (
            <section className="erp-surface rounded-md p-5" key={String(label)}>
              <Component className="h-5 w-5 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">{String(label)}</p>
              <p className="text-2xl font-semibold">{String(count)}</p>
            </section>
          );
        })}
      </div>
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Recent activity</h2>
        <div className="mt-4 divide-y text-sm">
          {[
            ...data.invoices.map((x) => ({
              kind: "Invoice",
              id: x.invoice_no ?? x.id,
              status: x.status,
            })),
            ...data.orders.map((x) => ({
              kind: "Order",
              id: x.order_no ?? x.id,
              status: x.status,
            })),
            ...data.repairs.map((x) => ({
              kind: "Repair",
              id: x.repair_no ?? x.id,
              status: x.status,
            })),
            ...data.support_tickets.map((x) => ({
              kind: "Support",
              id: x.ticket_no ?? x.id,
              status: x.status,
            })),
          ]
            .slice(0, 12)
            .map((item) => (
              <div className="flex justify-between gap-4 py-3" key={`${item.kind}-${item.id}`}>
                <span>
                  {item.kind} · {item.id}
                </span>
                <span className="text-muted-foreground">{item.status ?? "Recorded"}</span>
              </div>
            ))}
          {data.invoices.length +
            data.orders.length +
            data.repairs.length +
            data.support_tickets.length ===
            0 && <p className="py-3 text-muted-foreground">No activity yet.</p>}
        </div>
      </section>
      <section className="erp-surface rounded-md p-5">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Support conversations</h2>
        </div>
        <div className="mt-4 space-y-2">
          {data.support_tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">No support tickets yet.</p>
          )}
          {data.support_tickets.map((ticket) => (
            <button
              className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/40"
              key={ticket.id}
              onClick={() => void openThread(ticket.id)}
              type="button"
            >
              <span>
                {ticket.ticket_no ?? ticket.id} · {ticket.subject ?? "Support request"}
              </span>
              <span className="text-muted-foreground">{ticket.status ?? "open"}</span>
            </button>
          ))}
        </div>
        {thread && (
          <div className="mt-4 rounded-md border p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{thread.ticket.subject}</h3>
              <button
                className="text-sm text-muted-foreground underline"
                onClick={() => setThread(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-auto">
              {(thread.messages ?? []).map((message: any) => (
                <div className="rounded-md bg-muted/40 p-3 text-sm" key={message.id}>
                  <div className="text-xs text-muted-foreground">{message.sender}</div>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>
            <form className="mt-4 flex gap-2" onSubmit={sendThreadReply}>
              <input
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                maxLength={10000}
                required
                value={threadReply}
                onChange={(event) => setThreadReply(event.target.value)}
                placeholder="Reply to support"
              />
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                disabled={threadBusy}
                type="submit"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </section>
      <section className="erp-surface rounded-md p-5">
        <h2 className="font-semibold">Contact support</h2>
        <form className="mt-4 space-y-3" onSubmit={submitTicket}>
          <label className="block text-sm">
            <span className="mb-1 block">Subject</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              minLength={3}
              maxLength={160}
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block">What do you need help with?</span>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background px-3 py-2"
              minLength={10}
              maxLength={10000}
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Submitting…" : "Create support ticket"}
          </button>
          {notice && (
            <p className="text-sm text-muted-foreground" role="status">
              {notice}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

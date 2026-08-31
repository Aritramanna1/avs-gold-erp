/**
 * Help Agent — separate from ERP Assistant. Guides users, troubleshoots, prepares support tickets.
 */
import { useState } from "react";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchKnowledgeRepository,
  formatKnowledgeAnswer,
} from "@/lib/assistant/knowledge-repository";
import { useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { createSupportTicket } from "@/lib/platform-support-service";
import { BookOpen, Send, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";

interface HelpMessage {
  role: "user" | "agent";
  content: string;
  sources?: Array<{ title: string; id: string }>;
}

const DIAGNOSTIC_PROMPTS = [
  "Which document are you trying to print?",
  "Does preview work but physical print fails?",
  "Which client: Web, Desktop, or Mobile?",
  "Which printer profile is selected?",
  "What error message do you see?",
];

export function HelpAgentWorkspace() {
  const [messages, setMessages] = useState<HelpMessage[]>([
    {
      role: "agent",
      content:
        "I'm the Help Agent. I can guide you through Ornexa, troubleshoot issues, and prepare a support ticket. What do you need help with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketDraft, setTicketDraft] = useState<string | null>(null);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [submittedTicketNo, setSubmittedTicketNo] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { firm, currentUserRole } = useSettings();

  async function handleSend() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);

    const results = searchKnowledgeRepository(q, { limit: 3 });
    const formatted = formatKnowledgeAnswer(results);
    let reply =
      formatted.content ||
      "I couldn't find a matching article. Let me ask a few questions to prepare a proper support ticket.";

    if (results.length === 0 && /print/i.test(q)) {
      reply += `\n\n${DIAGNOSTIC_PROMPTS.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
    }

    setMessages((m) => [
      ...m,
      {
        role: "agent",
        content: reply,
        sources: formatted.sources.map((s) => ({ title: s.title, id: s.id })),
      },
    ]);
    setBusy(false);
  }

  function prepareTicket() {
    const summary = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" | ");
    const draft = [
      `Subject: Support request from ${firm.shopName || "tenant"}`,
      `Module: ${pathname}`,
      `Role: ${currentUserRole ?? "unknown"}`,
      `Summary: ${summary || "User requested help via Help Agent"}`,
      `Page: ${pathname}`,
      `Browser: ${navigator.userAgent}`,
    ].join("\n");
    setTicketDraft(draft);
  }

  async function submitTicket() {
    const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
    const summary = userMessages.join(" | ") || "User requested help via Help Agent";
    const subject = `Help Agent: ${pathname.replace(/^\//, "") || "general"}`;
    const description = [
      `Tenant: ${firm.shopName || "unknown"}`,
      `Role: ${currentUserRole ?? "unknown"}`,
      `Page: ${pathname}`,
      `Summary: ${summary}`,
      `Browser: ${navigator.userAgent}`,
    ].join("\n");

    setSubmittingTicket(true);
    try {
      const ticket = await createSupportTicket({
        subject,
        description,
        category: "help_agent",
        priority: "normal",
      });
      setSubmittedTicketNo(ticket.ticket_no);
      setTicketDraft(null);
      toast.success(`Support ticket ${ticket.ticket_no} created`);
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          content: `Your support ticket ${ticket.ticket_no} has been submitted. Our team will respond through the support channel.`,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create support ticket");
    } finally {
      setSubmittingTicket(false);
    }
  }

  return (
    <Panel
      title="Help Agent"
      description="Guidance and troubleshooting — separate from the ERP Assistant that operates transactions."
    >
      <div className="flex flex-col gap-3 max-w-2xl">
        <div className="border border-border rounded-sm bg-muted/10 p-3 max-h-72 overflow-y-auto space-y-2 text-sm">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-sm p-2.5 ${m.role === "user" ? "bg-gold/10 ml-8" : "bg-card border border-border mr-8"}`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.sources.map((s) => (
                    <span
                      key={s.id}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                    >
                      <BookOpen className="inline h-3 w-3 mr-0.5" />
                      {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching help articles…
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your issue or ask how to do something…"
            onKeyDown={(e) => e.key === "Enter" && void handleSend()}
            className="h-9"
          />
          <Button size="sm" onClick={() => void handleSend()} disabled={busy}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="w-fit" onClick={prepareTicket}>
            Prepare Support Ticket Draft
          </Button>
          <Button
            size="sm"
            className="w-fit gap-1"
            onClick={() => void submitTicket()}
            disabled={submittingTicket || messages.filter((m) => m.role === "user").length === 0}
          >
            {submittingTicket ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ticket className="h-3.5 w-3.5" />
            )}
            Submit Support Ticket
          </Button>
        </div>
        {submittedTicketNo && (
          <p className="text-xs text-success">Ticket {submittedTicketNo} submitted successfully.</p>
        )}
        {ticketDraft && (
          <pre className="text-xs p-3 rounded-sm border border-border bg-muted/20 whitespace-pre-wrap">
            {ticketDraft}
          </pre>
        )}
      </div>
    </Panel>
  );
}

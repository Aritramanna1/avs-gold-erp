import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Mic, MicOff, Paperclip, History, MoreHorizontal } from "lucide-react";
import type { AssistantMessage, ProviderAdapterConfig } from "@/lib/assistant/assistant-types";
import { processAssistantQuery } from "@/lib/assistant/ai-provider-service";
import { VoiceService } from "@/lib/assistant/voice-service";
import { AssistantCardRenderer } from "@/components/assistant/AssistantCardRenderer";
import { Logo } from "@/components/ui/Logo";
import { MOBILE_ASSISTANT_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useRoles } from "@/lib/rbac";

const STORAGE_KEY = "ornexa_mobile_assistant_history";

export function MobileAssistant({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState(initialQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<VoiceService | null>(null);
  const { roles } = useRoles();
  const userRole = roles[0] ?? "Owner";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
      else {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Ask about fine gold position, today's issue/return, karigar balances, invoices, or job status. I use live ERP tools — not static demo data.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (messages.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialQuery?.trim()) void send(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount when deep-linked
  }, []);

  useEffect(() => {
    voiceRef.current = new VoiceService({
      onListeningStateChange: setListening,
      onTranscriptChange: (text, isFinal) => {
        setInput(text);
        if (isFinal && text.trim()) void send(text);
      },
    });
    return () => {
      voiceRef.current?.stopSpeaking?.();
    };
  }, []);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: AssistantMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const config: ProviderAdapterConfig = { provider: "local", model: "deterministic-v3" };
      const response = await processAssistantQuery(q, config, userRole);
      setMessages((m) => [...m, response]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "Could not process query.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)] max-h-[calc(100dvh-3.5rem-4rem)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Logo variant="svg" className="h-6 w-6" />
          <div>
            <p className="text-sm font-serif font-semibold text-foreground">AVS Assistant</p>
            <p className="text-[10px] text-muted-foreground">Your ERP intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="p-2 text-muted-foreground" aria-label="History">
                <History className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetHeader>
                <SheetTitle>Conversation</SheetTitle>
              </SheetHeader>
              <p className="text-xs text-muted-foreground mt-2">Current session messages</p>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <button type="button" className="p-2 text-muted-foreground" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-lg">
              <SheetHeader>
                <SheetTitle className="text-left">Quick actions</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {MOBILE_ASSISTANT_ACTIONS.map((a) => (
                  <Link
                    key={a.id}
                    to={a.to}
                    search={a.search}
                    className="min-h-[var(--touch-target)] rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-gold/40"
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}
          >
            {msg.role === "assistant" ? (
              <Logo variant="svg" className="h-6 w-6 shrink-0 mt-1" />
            ) : null}
            <div
              className={`max-w-[88%] rounded-md px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-gold/15 text-foreground border border-gold/25"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {msg.content ? <p className="whitespace-pre-wrap">{msg.content}</p> : null}
              {msg.erpCard ? (
                <div className="mt-2">
                  <AssistantCardRenderer card={msg.erpCard} />
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? <p className="text-xs text-muted-foreground pl-8">Thinking…</p> : null}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 items-end max-w-lg mx-auto">
          <button type="button" className="p-2 text-muted-foreground shrink-0" aria-label="Attach">
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask anything about your business…"
            className="flex-1 min-h-[44px] max-h-28 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <button
            type="button"
            onClick={() =>
              listening ? voiceRef.current?.stopListening() : voiceRef.current?.startListening()
            }
            className={`p-2 shrink-0 ${listening ? "text-gold" : "text-muted-foreground"}`}
            aria-label={listening ? "Stop voice" : "Voice input"}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          AI can make mistakes — verify critical figures.
        </p>
      </div>
    </div>
  );
}

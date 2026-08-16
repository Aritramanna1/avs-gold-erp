import { useState } from "react";
import { useWhatsAppInboxStore } from "@/lib/comm/whatsapp/whatsapp-inbox-store";
import {
  requiresTemplateForOutbound,
  type WhatsAppCapabilities,
} from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send, StickyNote } from "lucide-react";
import { toast } from "sonner";

export function ConversationThread({ capabilities }: { capabilities: WhatsAppCapabilities }) {
  const { selectedId, messages, messagesLoading, sendReply, addInternalNote, conversations } =
    useWhatsAppInboxStore();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const conv = conversations.find((c) => c.id === selectedId);
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
  const needsTemplate = requiresTemplateForOutbound(lastInbound?.createdAt);

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground p-8">
        Select a conversation
      </div>
    );
  }

  async function handleSend() {
    if (!text.trim()) return;
    setBusy(true);
    const result = await sendReply(selectedId!, text.trim());
    setBusy(false);
    if (result.ok) {
      setText("");
      toast.success("Message sent");
    } else {
      toast.error(result.error ?? "Send failed");
    }
  }

  async function handleNote() {
    if (!note.trim()) return;
    await addInternalNote(selectedId!, note.trim());
    setNote("");
    toast.success("Internal note added — never sent to WhatsApp");
  }

  return (
    <div className="flex flex-col min-h-[560px]">
      <div className="p-2 border-b border-border text-sm font-medium">
        {conv?.contactName || conv?.contactPhone}
        {needsTemplate && (
          <span className="ml-2 text-[10px] text-amber-600 font-normal">
            Service window closed — template required
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-background">
        {messagesLoading && <p className="text-xs text-muted-foreground">Loading messages…</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-sm px-3 py-2 text-sm",
              m.direction === "inbound" && "bg-muted mr-auto",
              m.direction === "outbound" && "bg-gold/15 ml-auto",
              m.direction === "internal_note" &&
                "bg-amber-500/10 border border-dashed border-amber-500/40 mx-auto text-center text-xs",
              m.direction === "system_event" && "bg-muted/50 mx-auto text-xs text-muted-foreground",
            )}
          >
            {m.direction === "internal_note" && (
              <span className="text-[10px] font-medium text-amber-700 block mb-1">
                Internal Note — not sent to customer
              </span>
            )}
            <p className="whitespace-pre-wrap">{m.bodyText}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(m.createdAt).toLocaleTimeString()} · {m.status}
            </p>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border space-y-2">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={needsTemplate ? "Use template for outbound…" : "Type a reply…"}
            disabled={needsTemplate}
            onKeyDown={(e) => e.key === "Enter" && void handleSend()}
            className="h-9"
          />
          <Button size="sm" onClick={() => void handleSend()} disabled={busy || needsTemplate}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note (never sent to WhatsApp)…"
            className="min-h-[48px] text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleNote()}
            className="shrink-0"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

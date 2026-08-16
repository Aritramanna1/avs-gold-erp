import { useWhatsAppInboxStore } from "@/lib/comm/whatsapp/whatsapp-inbox-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ConversationList({ selectedId }: { selectedId: string | null }) {
  const { conversations, loading, selectConversation } = useWhatsAppInboxStore();

  return (
    <div className="border-r border-border bg-muted/20 flex flex-col">
      <div className="p-2 border-b border-border text-xs font-medium text-muted-foreground">
        Conversations
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="p-3 text-xs text-muted-foreground">Loading…</p>}
        {!loading && conversations.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => void selectConversation(c.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/40 transition",
              selectedId === c.id && "bg-gold/10 border-l-2 border-l-gold",
            )}
          >
            <div className="flex justify-between gap-2">
              <span className="text-sm font-medium truncate">
                {c.contactName || c.contactPhone}
              </span>
              {c.unreadCount > 0 && (
                <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px]">
                  {c.unreadCount}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {c.lastMessagePreview || "—"}
            </p>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span className="capitalize">{c.status.replace(/_/g, " ")}</span>
              {c.lastMessageAt && (
                <span>
                  {new Date(c.lastMessageAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

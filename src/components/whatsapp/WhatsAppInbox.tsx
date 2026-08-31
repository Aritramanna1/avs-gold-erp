import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { useWhatsAppInboxStore } from "@/lib/comm/whatsapp/whatsapp-inbox-store";
import type { WhatsAppCapabilities } from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { ConversationContextPanel } from "./ConversationContextPanel";

export function WhatsAppInbox({
  initialConversationId,
  initialPhone,
  capabilities,
}: {
  initialConversationId?: string;
  initialPhone?: string;
  capabilities: WhatsAppCapabilities;
}) {
  const [firmId, setFirmId] = useState<string | null>(null);
  const { hydrate, selectConversation, selectByPhone, selectedId, subscribeRealtime } =
    useWhatsAppInboxStore();

  useEffect(() => {
    void supabase
      .from("user_profiles" as never)
      .select("firm_id")
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { firm_id?: string } | null;
        if (row?.firm_id) setFirmId(row.firm_id);
      });
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (initialConversationId) void selectConversation(initialConversationId);
    else if (initialPhone) void selectByPhone(initialPhone);
  }, [initialConversationId, initialPhone, selectConversation, selectByPhone]);

  useEffect(() => {
    if (!firmId) return;
    return subscribeRealtime(firmId);
  }, [firmId, subscribeRealtime]);

  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] min-h-[560px] border border-border rounded-sm">
        <ConversationList selectedId={selectedId} />
        <ConversationThread capabilities={capabilities} />
        <ConversationContextPanel />
      </div>
    </Panel>
  );
}

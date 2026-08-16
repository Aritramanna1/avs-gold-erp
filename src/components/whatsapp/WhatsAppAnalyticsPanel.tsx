import { Panel } from "@/components/design-system";
import { useWhatsAppCampaignStore } from "@/lib/comm/whatsapp/whatsapp-campaign-store";
import { fetchWhatsAppConnections } from "@/lib/comm/platform/whatsapp-connections-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { useEffect, useState } from "react";

export function WhatsAppAnalyticsPanel() {
  const { campaigns, hydrate } = useWhatsAppCampaignStore();
  const [conn, setConn] = useState<Awaited<ReturnType<typeof fetchWhatsAppConnections>>[0] | null>(
    null,
  );

  useEffect(() => {
    void hydrate();
    void fetchWhatsAppConnections({ productId: DEFAULT_AVS_PRODUCT }).then((list) =>
      setConn(list[0] ?? null),
    );
  }, [hydrate]);

  const totals = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.stats?.sent ?? 0),
      delivered: acc.delivered + (c.stats?.delivered ?? 0),
      failed: acc.failed + (c.stats?.failed ?? 0),
      responses: acc.responses + (c.stats?.responses ?? 0),
    }),
    { sent: 0, delivered: 0, failed: 0, responses: 0 },
  );

  const deliveryPct = totals.sent ? Math.round((totals.delivered / totals.sent) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel title="Messages Sent" padding="sm">
        <p className="text-2xl font-bold">{conn?.messagesSentCount ?? 0}</p>
      </Panel>
      <Panel title="Delivered" padding="sm">
        <p className="text-2xl font-bold">{conn?.messagesDeliveredCount ?? 0}</p>
      </Panel>
      <Panel title="Campaign Delivery %" padding="sm">
        <p className="text-2xl font-bold">{deliveryPct}%</p>
        <p className="text-[10px] text-muted-foreground">
          {totals.delivered}/{totals.sent} campaign messages
        </p>
      </Panel>
      <Panel title="Failed" padding="sm">
        <p className="text-2xl font-bold text-destructive">{conn?.messagesFailedCount ?? 0}</p>
      </Panel>
    </div>
  );
}

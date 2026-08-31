import { Panel } from "@/components/design-system";
import { WhatsAppOnboardingPanel } from "@/components/communications/WhatsAppOnboardingPanel";
import type { WhatsAppConnection } from "@/lib/comm/platform/whatsapp-connections-store";
import type { WhatsAppCapabilities } from "@/lib/comm/whatsapp/whatsapp-capabilities";

export function WhatsAppConnectionSettings({
  connection,
  capabilities,
}: {
  connection: WhatsAppConnection | null;
  capabilities: WhatsAppCapabilities;
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Panel title="Operating Mode">
        <p className="text-sm">{capabilities.modeLabel}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {capabilities.isManagedFull
            ? "AVS Managed Meta — full inbox, campaigns, inbound messages, and CRM integration."
            : "External / client-owned — outbound templates, automation, and delivery logs. Manage templates at your provider when required."}
        </p>
      </Panel>
      {connection && (
        <dl className="text-xs grid grid-cols-2 gap-2 p-4 border border-border rounded-sm">
          <dt className="text-muted-foreground">WABA ID</dt>
          <dd className="font-mono">{connection.wabaId ?? "—"}</dd>
          <dt className="text-muted-foreground">Embedded Signup</dt>
          <dd>{connection.embeddedSignupStatus ?? "—"}</dd>
          <dt className="text-muted-foreground">Webhook</dt>
          <dd>{connection.webhookStatus ?? "—"}</dd>
          <dt className="text-muted-foreground">Template Sync</dt>
          <dd>{connection.templateSyncStatus ?? "—"}</dd>
        </dl>
      )}
    </div>
  );
}

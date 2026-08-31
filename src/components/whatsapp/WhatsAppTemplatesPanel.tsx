import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import {
  fetchWhatsAppTemplates,
  syncWhatsAppTemplatesFromMeta,
  type WhatsAppMessageTemplate,
} from "@/lib/comm/platform/whatsapp-templates-store";
import type { WhatsAppConnection } from "@/lib/comm/platform/whatsapp-connections-store";
import type { WhatsAppCapabilities } from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppTemplatesPanel({
  connection,
  capabilities,
  branchId,
}: {
  connection: WhatsAppConnection | null;
  capabilities: WhatsAppCapabilities;
  branchId: string;
}) {
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    if (!connection?.id) return;
    const tpls = await fetchWhatsAppTemplates(connection.id);
    setTemplates(tpls);
  };

  useEffect(() => {
    void load();
  }, [connection?.id]);

  async function handleSync() {
    if (!connection?.id) return;
    setSyncing(true);
    const result = await syncWhatsAppTemplatesFromMeta(connection.id);
    setSyncing(false);
    if (result.ok) {
      toast.success(`Synced ${result.synced} templates`);
      void load();
    } else toast.error(result.error);
  }

  return (
    <Panel
      title="Message Templates"
      description="Approved Meta templates for campaigns and automations."
      actions={
        <div className="flex gap-2">
          {capabilities.showManageTemplatesAtProvider && (
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://business.facebook.com/wa/manage/message-templates/"
                target="_blank"
                rel="noreferrer"
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Manage at Provider
              </a>
            </Button>
          )}
          {capabilities.isManagedFull && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSync()}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      }
    >
      <ul className="divide-y divide-border text-sm">
        {templates.map((t) => (
          <li key={t.id} className="py-2 flex justify-between gap-2">
            <span className="font-mono text-xs">{t.templateName}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {t.status} · {t.category}
            </span>
          </li>
        ))}
        {templates.length === 0 && (
          <li className="py-4 text-muted-foreground text-xs">
            No templates synced.{" "}
            {capabilities.isManagedFull ? "Use Sync from Meta." : "Manage templates at your BSP."}
          </li>
        )}
      </ul>
    </Panel>
  );
}

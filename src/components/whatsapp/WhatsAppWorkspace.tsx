/**
 * WhatsApp Workspace — full business module on AVS Communication Platform.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { StandardPage, Panel, StatusBadge } from "@/components/design-system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useCurrentBranchId } from "@/lib/branch-store";
import {
  fetchWhatsAppConnections,
  type WhatsAppConnection,
} from "@/lib/comm/platform/whatsapp-connections-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { getWhatsAppCapabilities, canUse } from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { WhatsAppInbox } from "@/components/whatsapp/WhatsAppInbox";
import { WhatsAppCampaignManager } from "@/components/whatsapp/WhatsAppCampaignManager";
import { WhatsAppOverview } from "@/components/whatsapp/WhatsAppOverview";
import { WhatsAppConnectionSettings } from "@/components/whatsapp/WhatsAppConnectionSettings";
import { WhatsAppTemplatesPanel } from "@/components/whatsapp/WhatsAppTemplatesPanel";
import { WhatsAppOptInManager } from "@/components/whatsapp/WhatsAppOptInManager";
import { WhatsAppAnalyticsPanel } from "@/components/whatsapp/WhatsAppAnalyticsPanel";
import { WhatsAppOnboardingPanel } from "@/components/communications/WhatsAppOnboardingPanel";
import {
  MessageSquare,
  Inbox,
  Users,
  Megaphone,
  FileText,
  Zap,
  BarChart3,
  Settings,
  Link2,
  Lock,
} from "lucide-react";

const SearchSchema = z.object({
  tab: z.string().optional(),
  conversation: z.string().optional(),
  phone: z.string().optional(),
});

const TABS = [
  { id: "overview", label: "Overview", icon: MessageSquare },
  { id: "inbox", label: "Inbox", icon: Inbox, cap: "inbox" as const },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, cap: "campaigns" as const },
  { id: "templates", label: "Templates", icon: FileText, cap: "templates" as const },
  { id: "contacts", label: "Opt-in / Contacts", icon: Users },
  { id: "automations", label: "Automations", icon: Zap, cap: "automations" as const },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "connection", label: "Connection", icon: Link2 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function WhatsAppWorkspace() {
  const branchId = useCurrentBranchId() ?? "MAIN";
  const { tab, conversation, phone } = useSearch({ strict: false }) as z.infer<typeof SearchSchema>;
  const navigate = useNavigate();
  const [conn, setConn] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = tab ?? "overview";

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const list = await fetchWhatsAppConnections({ productId: DEFAULT_AVS_PRODUCT });
      const c = list.find((x) => x.branchId === branchId || !x.branchId) ?? list[0] ?? null;
      setConn(c);
      setLoading(false);
    })();
  }, [branchId]);

  const caps = getWhatsAppCapabilities(conn);

  function setTab(next: string) {
    void navigate({ to: "/whatsapp", search: { tab: next, conversation } });
  }

  return (
    <StandardPage
      title="WhatsApp"
      subtitle="AVS Communication Platform — inbox, campaigns, templates, and CRM integration across all AVS products."
      maxWidth="full"
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge tone={conn?.isEnabled ? "success" : "neutral"} label={caps.modeLabel} />
          <Button variant="outline" size="sm" asChild>
            <Link to="/communications">Communications Hub</Link>
          </Button>
        </div>
      }
    >
      {caps.isExternalRestricted && (
        <Panel variant="muted" className="mb-4 border-amber-500/30">
          <div className="flex items-start gap-2 text-sm">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-medium">External BSP / Client-Owned Mode</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Full AVS Inbox and inbound CRM are available on AVS Managed Meta. Your current mode
                supports outbound messaging, approved templates, automation, and delivery logs.
                {caps.billingModel === "annual_integration_fee" &&
                  " Annual integration fee applies — AVS does not deduct message credits for provider charges paid directly by you."}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {TABS.map((t) => {
            if ("cap" in t && t.cap && !canUse(caps, t.cap)) return null;
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs">
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <WhatsAppOverview connection={conn} capabilities={caps} loading={loading} />
        </TabsContent>

        {canUse(caps, "inbox") && (
          <TabsContent value="inbox" className="mt-4">
            <WhatsAppInbox
              initialConversationId={conversation}
              initialPhone={phone}
              capabilities={caps}
            />
          </TabsContent>
        )}

        {canUse(caps, "campaigns") && (
          <TabsContent value="campaigns" className="mt-4">
            <WhatsAppCampaignManager capabilities={caps} />
          </TabsContent>
        )}

        {canUse(caps, "templates") && (
          <TabsContent value="templates" className="mt-4">
            <WhatsAppTemplatesPanel connection={conn} capabilities={caps} branchId={branchId} />
          </TabsContent>
        )}

        <TabsContent value="contacts" className="mt-4">
          <WhatsAppOptInManager />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <WhatsAppAnalyticsPanel />
        </TabsContent>

        <TabsContent value="connection" className="mt-4">
          <WhatsAppOnboardingPanel branchId={branchId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <WhatsAppConnectionSettings connection={conn} capabilities={caps} />
        </TabsContent>
      </Tabs>
    </StandardPage>
  );
}

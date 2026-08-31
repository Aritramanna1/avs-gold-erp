/**
 * WhatsApp Meta onboarding — connection mode, WABA state, embedded signup placeholder.
 */
import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchWhatsAppConnections,
  upsertWhatsAppConnection,
  type WhatsAppConnection,
  type WhatsAppConnectionMode,
} from "@/lib/comm/platform/whatsapp-connections-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import {
  fetchWhatsAppTemplates,
  syncWhatsAppTemplatesFromMeta,
  type WhatsAppMessageTemplate,
} from "@/lib/comm/platform/whatsapp-templates-store";
import { launchMetaEmbeddedSignup } from "@/lib/comm/platform/meta-embedded-signup";
import { MessageSquare, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppOnboardingPanel({ branchId }: { branchId: string }) {
  const [conn, setConn] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<string>("off");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await fetchWhatsAppConnections({ productId: DEFAULT_AVS_PRODUCT });
    const c = list.find((x) => x.branchId === branchId || !x.branchId) ?? list[0];
    setConn(c ?? null);
    if (c) {
      setMode(c.connectionMode);
      setWabaId(c.wabaId ?? "");
      setPhoneNumberId(c.phoneNumberId ?? "");
      setDisplayPhone(c.displayPhone ?? "");
      const tpls = await fetchWhatsAppTemplates(c.id);
      setTemplates(tpls);
    } else {
      setTemplates([]);
    }
    setLoading(false);
  };

  async function handleMetaSignup() {
    if (!conn?.id) {
      toast.error("Save connection first");
      return;
    }
    setMetaBusy(true);
    const result = await launchMetaEmbeddedSignup({ connectionId: conn.id, branchId });
    setMetaBusy(false);
    if (result.ok) {
      toast.success("Meta Embedded Signup completed");
      void load();
    } else {
      toast.error(result.error ?? "Meta signup failed");
    }
  }

  async function handleSyncTemplates() {
    if (!conn?.id) {
      toast.error("Save connection first");
      return;
    }
    setSyncing(true);
    const result = await syncWhatsAppTemplatesFromMeta(conn.id);
    setSyncing(false);
    if (result.ok) {
      toast.success(`Synced ${result.synced ?? 0} of ${result.total ?? 0} templates from Meta`);
      void load();
    } else {
      toast.error(result.error ?? "Template sync failed");
    }
  }

  useEffect(() => {
    void load();
  }, [branchId]);

  async function handleSave() {
    const billingResponsibility =
      mode === "managed_partner" ? "AVS" : mode === "off" ? "AVS" : "CLIENT";
    const meteredCreditsEnabled = mode === "managed_partner";
    const result = await upsertWhatsAppConnection({
      id: conn?.id,
      productId: DEFAULT_AVS_PRODUCT,
      branchId,
      connectionMode: mode as WhatsAppConnectionMode,
      billingResponsibility,
      meteredCreditsEnabled,
      isEnabled: mode !== "off",
      onboardingStatus: mode === "off" ? "not_started" : "configured",
      wabaId: wabaId || undefined,
      phoneNumberId: phoneNumberId || undefined,
      displayPhone: displayPhone || undefined,
    });
    if (result) {
      toast.success("WhatsApp connection updated");
      setConn(result);
    } else toast.error("Failed to save WhatsApp connection");
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/whatsapp-webhook`;

  return (
    <Panel
      title="WhatsApp (Meta Cloud API)"
      description="Multi-product AVS communication platform. Secrets stored server-side."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <div className="grid gap-3 max-w-lg">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <StatusBadge
            tone={conn?.isEnabled ? "success" : "neutral"}
            label={conn?.isEnabled ? "Enabled" : "Disabled"}
          />
          {conn && (
            <span className="text-xs text-muted-foreground">
              Onboarding: {conn.onboardingStatus}
            </span>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Connection Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="managed_partner">Managed Partner (AVS credit line)</SelectItem>
              <SelectItem value="client_owned">Client-owned WABA (Embedded Signup)</SelectItem>
              <SelectItem value="custom_connector">Custom Connector</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "client_owned" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground rounded-sm border border-border p-2">
              Complete Meta Embedded Signup to connect your WABA. Requires VITE_META_APP_ID and
              server META_APP_SECRET configured.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => void handleMetaSignup()}
              disabled={metaBusy || !conn?.id}
            >
              {metaBusy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Connect with Meta (Embedded Signup)
            </Button>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs">WABA ID</Label>
          <Input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="WhatsApp Business Account ID"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Phone Number ID</Label>
          <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Display Phone</Label>
          <Input
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder="+91..."
          />
        </div>
        <div className="text-[10px] text-muted-foreground font-mono border border-border rounded-sm p-2">
          Webhook URL: {webhookUrl}
        </div>
        {conn && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Billing</dt>
            <dd>{conn.billingResponsibility === "CLIENT" ? "Paid by client" : "Managed by AVS"}</dd>
            <dt className="text-muted-foreground">Metered credits</dt>
            <dd>{conn.meteredCreditsEnabled ? "On" : "Off"}</dd>
            <dt className="text-muted-foreground">Sent / Delivered / Failed</dt>
            <dd>
              {conn.messagesSentCount} / {conn.messagesDeliveredCount} / {conn.messagesFailedCount}
            </dd>
            <dt className="text-muted-foreground">Webhook</dt>
            <dd>{conn.webhookStatus ?? "—"}</dd>
            <dt className="text-muted-foreground">Templates</dt>
            <dd>{conn.templateSyncStatus ?? "—"}</dd>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSave()}>Save WhatsApp Configuration</Button>
          <Button
            variant="outline"
            onClick={() => void handleSyncTemplates()}
            disabled={!conn?.id || syncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync Templates from Meta
          </Button>
        </div>
        {templates.length > 0 && (
          <div className="border border-border rounded-sm overflow-hidden">
            <p className="text-xs font-medium px-2 py-1.5 bg-muted/30 border-b border-border">
              Synced Templates ({templates.length})
            </p>
            <ul className="max-h-40 overflow-y-auto divide-y divide-border text-xs">
              {templates.map((t) => (
                <li key={t.id} className="px-2 py-1.5 flex justify-between gap-2">
                  <span className="font-mono truncate">{t.templateName}</span>
                  <span className="text-muted-foreground shrink-0">{t.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

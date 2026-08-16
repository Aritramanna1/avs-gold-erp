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
  useWhatsAppCampaignStore,
  type AudienceSegmentRule,
  type CampaignStatus,
} from "@/lib/comm/whatsapp/whatsapp-campaign-store";
import type { WhatsAppCapabilities } from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { fetchWhatsAppTemplates } from "@/lib/comm/platform/whatsapp-templates-store";
import { fetchWhatsAppConnections } from "@/lib/comm/platform/whatsapp-connections-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";
import { Plus, Play, Pause } from "lucide-react";
import { toast } from "sonner";

const STATUS_TONE: Record<CampaignStatus, "neutral" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  READY: "success",
  APPROVAL_REQUIRED: "warning",
  SCHEDULED: "neutral",
  RUNNING: "success",
  PAUSED: "warning",
  COMPLETED: "success",
  PARTIAL: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export function WhatsAppCampaignManager({ capabilities }: { capabilities: WhatsAppCapabilities }) {
  const { campaigns, loading, hydrate, createCampaign, launchCampaign, updateCampaignStatus } =
    useWhatsAppCampaignStore();
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [segment, setSegment] = useState<string>("opted_in_whatsapp");
  const [templates, setTemplates] = useState<Array<{ templateName: string; status: string }>>([]);

  useEffect(() => {
    void hydrate();
    void (async () => {
      const conns = await fetchWhatsAppConnections({ productId: DEFAULT_AVS_PRODUCT });
      const c = conns[0];
      if (c) {
        const tpls = await fetchWhatsAppTemplates(c.id);
        setTemplates(tpls.map((t) => ({ templateName: t.templateName, status: t.status })));
      }
    })();
  }, [hydrate]);

  const rules: AudienceSegmentRule[] = (() => {
    switch (segment) {
      case "outstanding_50k":
        return [{ type: "outstanding_gt", amountPaise: 5_000_000 }, { type: "opted_in_whatsapp" }];
      case "anniversary":
        return [
          { type: "anniversary_month", month: new Date().getMonth() + 1 },
          { type: "opted_in_whatsapp" },
        ];
      case "purchased_12m":
        return [{ type: "purchased_within_months", months: 12 }, { type: "opted_in_whatsapp" }];
      default:
        return [{ type: "opted_in_whatsapp" }];
    }
  })();

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Campaign name required");
      return;
    }
    if (!templateName) {
      toast.error("Approved template required — campaigns cannot use free-form marketing text");
      return;
    }
    const c = await createCampaign({
      name: name.trim(),
      templateName,
      audienceConfig: { rules },
    });
    if (c) {
      toast.success("Campaign draft created");
      setName("");
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="New Campaign"
        description="Template-only mass messaging with opt-in enforcement."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Campaign Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Approved Template</Label>
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates
                  .filter((t) => t.status === "approved")
                  .map((t) => (
                    <SelectItem key={t.templateName} value={t.templateName}>
                      {t.templateName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Audience Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opted_in_whatsapp">All opted-in WhatsApp contacts</SelectItem>
                <SelectItem value="outstanding_50k">Outstanding &gt; ₹50,000</SelectItem>
                <SelectItem value="anniversary">Anniversary this month</SelectItem>
                <SelectItem value="purchased_12m">Purchased within 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => void handleCreate()} className="gap-1 w-full">
              <Plus className="h-3.5 w-3.5" /> Create Draft
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Campaigns"
        description="DRAFT → READY → RUNNING → COMPLETED with per-recipient tracking."
      >
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        <div className="divide-y divide-border">
          {campaigns.map((c) => (
            <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  Template: {c.templateName ?? "—"} · Est. {c.estimatedRecipients} recipients
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Sent {c.stats.sent} · Delivered {c.stats.delivered} · Failed {c.stats.failed}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={STATUS_TONE[c.status]} label={c.status} />
                {c.status === "DRAFT" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void updateCampaignStatus(c.id, "READY")}
                  >
                    Mark Ready
                  </Button>
                )}
                {(c.status === "READY" || c.status === "SCHEDULED") && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void launchCampaign(c.id).then((r) => !r.ok && toast.error(r.error))
                    }
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Send Now
                  </Button>
                )}
                {c.status === "RUNNING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void updateCampaignStatus(c.id, "PAUSED")}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {campaigns.length === 0 && !loading && (
            <p className="py-4 text-sm text-muted-foreground">No campaigns yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

import { Panel } from "@/components/design-system";
import type { WhatsAppConnection } from "@/lib/comm/platform/whatsapp-connections-store";
import type { WhatsAppCapabilities } from "@/lib/comm/whatsapp/whatsapp-capabilities";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Inbox, Megaphone, BarChart3, CreditCard } from "lucide-react";

export function WhatsAppOverview({
  connection,
  capabilities,
  loading,
}: {
  connection: WhatsAppConnection | null;
  capabilities: WhatsAppCapabilities;
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading connection…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Panel title="Connection">
        <dl className="text-xs space-y-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Mode</dt>
            <dd>{capabilities.modeLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{connection?.displayPhone ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Billing</dt>
            <dd className="capitalize">{capabilities.billingModel.replace(/_/g, " ")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Sent / Delivered / Failed</dt>
            <dd>
              {connection?.messagesSentCount ?? 0} / {connection?.messagesDeliveredCount ?? 0} /{" "}
              {connection?.messagesFailedCount ?? 0}
            </dd>
          </div>
        </dl>
      </Panel>

      {capabilities.isManagedFull && (
        <Panel title="Inbox" className="flex flex-col">
          <p className="text-xs text-muted-foreground mb-3">
            Full WhatsApp Business + CRM experience — receive and reply with Party 360 context.
          </p>
          <Button size="sm" className="mt-auto w-fit gap-1" asChild>
            <Link to="/whatsapp" search={{ tab: "inbox" }}>
              <Inbox className="h-3.5 w-3.5" /> Open Inbox
            </Link>
          </Button>
        </Panel>
      )}

      <Panel title="Campaigns">
        <p className="text-xs text-muted-foreground mb-3">
          Template-enforced broadcasts with opt-in segmentation and per-recipient analytics.
        </p>
        <Button size="sm" variant="outline" className="gap-1" asChild>
          <Link to="/whatsapp" search={{ tab: "campaigns" }}>
            <Megaphone className="h-3.5 w-3.5" /> Manage Campaigns
          </Link>
        </Button>
      </Panel>

      <Panel title="Usage & Cost">
        <p className="text-xs text-muted-foreground">
          {capabilities.billingModel === "avs_credits"
            ? "AVS-managed messaging deducts credits on delivered messages via rate card."
            : capabilities.billingModel === "annual_integration_fee"
              ? "External BSP: you pay Meta/BSP directly. AVS charges configurable annual integration fee."
              : "Configure connection to view usage."}
        </p>
        <Button size="sm" variant="ghost" className="mt-2 gap-1" asChild>
          <Link to="/settings" search={{ tab: "credits" }}>
            <CreditCard className="h-3.5 w-3.5" /> Credits Wallet
          </Link>
        </Button>
      </Panel>

      <Panel title="CRM Integration">
        <p className="text-xs text-muted-foreground">
          WhatsApp threads link to Party 360 — orders, gold balance, invoices, and support history
          in one place.
        </p>
        <Button size="sm" variant="ghost" className="mt-2 gap-1" asChild>
          <Link to="/communications" search={{ tab: "crm" }}>
            <BarChart3 className="h-3.5 w-3.5" /> Sales Pipeline
          </Link>
        </Button>
      </Panel>
    </div>
  );
}

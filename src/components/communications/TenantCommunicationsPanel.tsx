/**
 * Tenant 360 Communications — WhatsApp + Email status (Platform Owner & Settings).
 * Secrets are never displayed.
 */
import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, RefreshCw } from "lucide-react";
import {
  fetchWhatsAppConnections,
  type WhatsAppConnection,
} from "@/lib/comm/platform/whatsapp-connections-store";
import {
  fetchTenantEmailAccounts,
  type TenantEmailAccount,
} from "@/lib/comm/platform/tenant-email-store";
import { DEFAULT_AVS_PRODUCT } from "@/lib/comm/platform/communication-events";

function onboardingTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "connected" || status === "approved" || status === "verified") return "success";
  if (status === "in_progress" || status === "pending") return "info";
  if (status === "failed" || status === "rejected") return "danger";
  return "neutral";
}

export function TenantCommunicationsPanel({
  firmId,
  title = "Communications",
}: {
  firmId?: string;
  title?: string;
}) {
  const [waConnections, setWaConnections] = useState<WhatsAppConnection[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<TenantEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [wa, email] = await Promise.all([
      fetchWhatsAppConnections({ firmId, productId: DEFAULT_AVS_PRODUCT }),
      fetchTenantEmailAccounts({ firmId }),
    ]);
    setWaConnections(wa);
    setEmailAccounts(email);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [firmId]);

  const wa = waConnections[0];

  return (
    <Panel
      title={title}
      description="WhatsApp and email connection status. Credentials are stored securely server-side."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* WhatsApp */}
        <div className="rounded-sm border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">WhatsApp</h4>
            <StatusBadge
              tone={wa?.isEnabled ? "success" : "neutral"}
              label={wa?.isEnabled ? "Enabled" : "Disabled"}
            />
          </div>
          {wa ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Product</dt>
              <dd className="font-mono">{wa.productId}</dd>
              <dt className="text-muted-foreground">Mode</dt>
              <dd>{wa.connectionMode.replace(/_/g, " ")}</dd>
              <dt className="text-muted-foreground">Billing</dt>
              <dd>{wa.billingResponsibility === "AVS" ? "AVS Managed" : "Client Owned"}</dd>
              <dt className="text-muted-foreground">Metered Credits</dt>
              <dd>{wa.meteredCreditsEnabled ? "On" : "Off"}</dd>
              <dt className="text-muted-foreground">WABA ID</dt>
              <dd className="font-mono truncate">{wa.wabaId ?? "—"}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{wa.displayPhone ?? "—"}</dd>
              <dt className="text-muted-foreground">Display Name</dt>
              <dd>{wa.displayName ?? "—"}</dd>
              <dt className="text-muted-foreground">Onboarding</dt>
              <dd>
                <StatusBadge
                  tone={onboardingTone(wa.onboardingStatus)}
                  label={wa.onboardingStatus}
                />
              </dd>
              <dt className="text-muted-foreground">Embedded Signup</dt>
              <dd>{wa.embeddedSignupStatus ?? "—"}</dd>
              <dt className="text-muted-foreground">Webhook</dt>
              <dd>{wa.webhookStatus ?? "—"}</dd>
              <dt className="text-muted-foreground">Templates</dt>
              <dd>{wa.templateSyncStatus ?? "—"}</dd>
              <dt className="text-muted-foreground">Sent / Delivered / Failed</dt>
              <dd className="font-mono">
                {wa.messagesSentCount} / {wa.messagesDeliveredCount} / {wa.messagesFailedCount}
              </dd>
              <dt className="text-muted-foreground">Last Message</dt>
              <dd>{wa.lastMessageAt ? new Date(wa.lastMessageAt).toLocaleString("en-IN") : "—"}</dd>
              <dt className="text-muted-foreground">Last Webhook</dt>
              <dd>{wa.lastWebhookAt ? new Date(wa.lastWebhookAt).toLocaleString("en-IN") : "—"}</dd>
              {wa.lastError && (
                <>
                  <dt className="text-muted-foreground">Last Error</dt>
                  <dd className="text-red-500 col-span-1">{wa.lastError}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">No WhatsApp connection configured.</p>
          )}
        </div>

        {/* Email */}
        <div className="rounded-sm border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Email</h4>
            <StatusBadge
              tone={emailAccounts.some((a) => a.isActive) ? "success" : "neutral"}
              label={emailAccounts.some((a) => a.isActive) ? "Configured" : "Not configured"}
            />
          </div>
          {emailAccounts.length > 0 ? (
            <div className="space-y-2">
              {emailAccounts.map((acct) => (
                <div
                  key={acct.id}
                  className="rounded-sm border border-border/60 bg-muted/10 p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{acct.displayName ?? acct.fromEmail}</span>
                    {acct.isDefault && <StatusBadge tone="info" label="Default" />}
                  </div>
                  <p className="text-muted-foreground font-mono">{acct.fromEmail}</p>
                  <p className="text-muted-foreground">
                    Provider: {acct.providerType.replace("email_", "").replace(/_/g, " ")}
                    {acct.lastTestStatus ? ` · Last test: ${acct.lastTestStatus}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No tenant email sender configured. System default or platform SMTP will be used.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

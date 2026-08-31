import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommSettings } from "@/lib/comm/comm-settings-store";
import { useCurrentBranchId, useBranch } from "@/lib/branch-store";
import { PROVIDER_LABELS, createProvider } from "@/lib/comm/provider-registry";
import type {
  ProviderConfig,
  ProviderType,
  CommChannel,
  CommRequest,
  ResolvedContent,
} from "@/lib/comm/types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import {
  Plus,
  Trash2,
  Check,
  Zap,
  Mail,
  MessageSquare,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Send,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState as useReactState } from "react";
import { TenantCommunicationsPanel } from "@/components/communications/TenantCommunicationsPanel";
import { EmailAutomationSettingsPanel } from "@/components/communications/EmailAutomationSettingsPanel";

export const Route = createFileRoute("/settings/communications")({
  head: () => ({ meta: [{ title: "Communication Settings · AVS Gold ERP" }] }),
  component: CommunicationSettings,
});

const CHANNEL_PROVIDERS: Record<CommChannel, ProviderType[]> = {
  whatsapp: [
    "whatsapp_deep_link",
    "whatsapp_wasender",
    "whatsapp_cloud_api",
    "whatsapp_interakt",
    "whatsapp_wati",
    "whatsapp_aisensy",
    "whatsapp_gupshup",
  ],
  email: ["email_smtp", "email_resend", "email_sendgrid", "email_ses", "email_mailgun"],
  sms: ["sms_twilio", "sms_msg91", "sms_fast2sms"],
};

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  email: Mail,
  sms: Zap,
};

const WA_CLOUD_API_FIELDS = [
  {
    key: "api_base_url",
    label: "API Base URL",
    placeholder: "https://graph.facebook.com",
  },
  { key: "phone_number_id", label: "Phone Number ID", placeholder: "1234567890..." },
  { key: "access_token", label: "Access Token", placeholder: "EAABxxxxxx...", type: "password" },
  { key: "business_account_id", label: "Business Account ID (WABA)", placeholder: "9876543210..." },
  { key: "api_version", label: "API Version", placeholder: "v18.0" },
  { key: "template_language", label: "Template Language Code", placeholder: "en_IN" },
  { key: "webhook_url", label: "Webhook Callback URL (optional)", placeholder: "https://..." },
  {
    key: "webhook_verify_token",
    label: "Webhook Verify Token (optional)",
    placeholder: "your_verify_token",
    type: "password",
  },
];

const WA_TEMPLATE_FIELDS = [
  { key: "template_invoice", label: "Invoice Template Name", placeholder: "invoice_notification" },
  { key: "template_receipt", label: "Receipt Template Name", placeholder: "payment_receipt" },
  { key: "template_order_ready", label: "Order Ready Template", placeholder: "order_ready" },
  {
    key: "template_payment_reminder",
    label: "Payment Reminder Template",
    placeholder: "payment_reminder",
  },
  { key: "template_repair_ready", label: "Repair Ready Template", placeholder: "repair_ready" },
];

const BSP_FIELDS = [
  { key: "api_key", label: "API Key", placeholder: "your_api_key", type: "password" },
  { key: "api_url", label: "API URL (optional, leave blank for default)", placeholder: "" },
  { key: "sender_phone", label: "Sender Phone", placeholder: "91XXXXXXXXXX" },
];

const EMAIL_SMTP_FIELDS = [
  { key: "from_email", label: "From Email", placeholder: "no-reply@example.com" },
  { key: "from_name", label: "From Name", placeholder: "AVS ERP" },
  { key: "reply_to", label: "Reply-To (optional)", placeholder: "support@example.com" },
  { key: "host", label: "SMTP Host", placeholder: "smtp.hostinger.com" },
  { key: "port", label: "Port", placeholder: "465" },
  { key: "username", label: "Username / Email", placeholder: "smtp user" },
  { key: "password", label: "Password", placeholder: "••••••••", type: "password" },
  { key: "encryption", label: "Encryption (ssl / starttls / none)", placeholder: "ssl" },
];

const EMAIL_API_FIELDS = [
  { key: "from_email", label: "From Email", placeholder: "no-reply@example.com" },
  { key: "from_name", label: "From Name", placeholder: "AVS ERP" },
  { key: "api_key", label: "API Key", placeholder: "your_api_key", type: "password" },
];

const SMS_FIELDS = [
  { key: "sender_id", label: "Sender ID", placeholder: "AVSERP" },
  { key: "account_sid", label: "Twilio Account SID", placeholder: "AC..." },
  { key: "auth_token", label: "Provider Auth Token", placeholder: "••••••••", type: "password" },
  { key: "api_url", label: "API URL (optional)", placeholder: "https://" },
];

function getSettingFields(
  type: ProviderType,
): { key: string; label: string; placeholder: string; type?: string }[] {
  if (type === "whatsapp_cloud_api") return [...WA_CLOUD_API_FIELDS, ...WA_TEMPLATE_FIELDS];
  if (type === "whatsapp_deep_link") return [];
  // WasenderAPI is NOT a BSP — its token lives encrypted in the Electron main
  // process and is configured on its own Integration page, not with inline
  // credential fields here.
  if (type === "whatsapp_wasender") return [];
  if (type.startsWith("whatsapp_")) return [...BSP_FIELDS, ...WA_TEMPLATE_FIELDS];
  if (type === "email_smtp") return EMAIL_SMTP_FIELDS;
  if (type.startsWith("email_")) return EMAIL_API_FIELDS;
  if (type.startsWith("sms_")) return SMS_FIELDS;
  return [{ key: "api_key", label: "API Key", placeholder: "••••••••", type: "password" }];
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cp_${Date.now()}`;
}

function CommunicationSettings() {
  const currentBranchId = useCurrentBranchId();
  const { configs, upsertConfig, removeConfig, ensureDefaults, refresh } = useCommSettings();
  const accessible = useBranch(useShallow((s) => s.getAccessibleBranches()));
  const [selectedBranch, setSelectedBranch] = useState(currentBranchId);

  // Ensure defaults exist for the selected branch
  useEffect(() => {
    void refresh().finally(() => ensureDefaults(selectedBranch));
  }, [selectedBranch, ensureDefaults, refresh]);

  const branchConfigs = configs.filter((c) => c.branchId === selectedBranch);

  function addProvider(channel: CommChannel, type: ProviderType) {
    const config: ProviderConfig = {
      id: makeId(),
      branchId: selectedBranch,
      channel,
      providerType: type,
      isActive: true,
      priority: branchConfigs.filter((c) => c.channel === channel).length,
      settings: {},
    };
    upsertConfig(config);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Communication Settings"
        subtitle="Automatic Email & Document Engine, AVS Cloud Mail fallback, and multichannel provider configuration."
      />

      {/* Automatic Email Dispatch & Document Attachment Engine */}
      <EmailAutomationSettingsPanel />

      <TenantCommunicationsPanel title="Multichannel Connection Status" />

      {/* Branch Selector */}
      {accessible.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Branch
          </Label>
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              ensureDefaults(v);
            }}
          >
            <SelectTrigger className="w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessible.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Channel sections */}
      {(["whatsapp", "email", "sms"] as CommChannel[]).map((channel) => {
        const Icon = CHANNEL_ICONS[channel];
        const channelConfigs = branchConfigs
          .filter((c) => c.channel === channel)
          .sort((a, b) => a.priority - b.priority);
        const availableProviders = CHANNEL_PROVIDERS[channel];

        return (
          <div key={channel} className="rounded-md border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gold" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  {channel.toUpperCase()} Providers
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {channelConfigs.length} configured
                </Badge>
              </div>
              <Select onValueChange={(type) => addProvider(channel, type as ProviderType)}>
                <SelectTrigger className="w-52 h-8 text-xs">
                  <SelectValue placeholder="+ Add Provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {PROVIDER_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {channelConfigs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No {channel} provider configured. Add one above.
              </p>
            ) : (
              <div className="space-y-4">
                {channelConfigs.map((cfg, i) => (
                  <ProviderCard
                    key={cfg.id}
                    config={cfg}
                    index={i}
                    onUpdate={upsertConfig}
                    onRemove={() => removeConfig(cfg.id)}
                  />
                ))}
              </div>
            )}

            {channel === "whatsapp" && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 flex items-center justify-between gap-3">
                <span>
                  <strong>Advanced WA settings</strong> (automations, template mapping, rate limits,
                  webhook):
                </span>
                <Link to="/settings" search={{ tab: "whatsapp", waSection: "business" }}>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-gold underline text-xs font-medium"
                  >
                    Open WhatsApp Settings <ExternalLink className="h-3 w-3" />
                  </button>
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProviderCard({
  config,
  index,
  onUpdate,
  onRemove,
}: {
  config: ProviderConfig;
  index: number;
  onUpdate: (c: ProviderConfig) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState(config);
  // Resync when the store's copy changes from outside this card's own save
  // (e.g. the async Supabase pull for `comm_configs` in data-loader.ts
  // landing after this card already mounted) — otherwise `local` keeps
  // showing pre-hydration/default settings, `hasChanges` spuriously turns
  // true once the real config loads, and clicking the resulting "Save
  // Changes" button would overwrite live provider credentials with stale
  // ones.
  useEffect(() => {
    setLocal(config);
  }, [config]);
  const [testing, setTesting] = useReactState(false);
  const [testResult, setTestResult] = useReactState<{ ok: boolean; message: string } | null>(null);
  const [testRecipient, setTestRecipient] = useReactState("");
  const fields = getSettingFields(config.providerType);
  const hasChanges = JSON.stringify(local) !== JSON.stringify(config);

  const isEmail = config.channel === "email";
  const isServerEmail = config.providerType === "email_smtp" || config.providerType === "email_ses";
  const isCloudApi = config.providerType === "whatsapp_cloud_api";
  const secretKeys = new Set([
    "access_token",
    "api_key",
    "password",
    "webhook_verify_token",
    "auth_token",
    "account_sid",
    "token",
  ]);

  function updateSetting(key: string, value: string) {
    setLocal((c) => ({ ...c, settings: { ...c.settings, [key]: value } }));
  }

  async function save() {
    const secretData = Object.fromEntries(
      Object.entries(local.settings).filter(([key, value]) => secretKeys.has(key) && value.trim()),
    );
    if (Object.keys(secretData).length > 0) {
      const { error } = await supabase.functions.invoke("save-provider-secret", {
        body: {
          branchId: local.branchId,
          providerType: local.providerType,
          secretData,
        },
      });
      if (error) {
        toast.error(await extractEdgeFunctionError(error, "Secret storage failed."));
        return;
      }
    }
    onUpdate({
      ...local,
      settings: Object.fromEntries(
        Object.entries(local.settings).filter(([key]) => !secretKeys.has(key)),
      ),
    });
    toast.success(`${PROVIDER_LABELS[config.providerType]} settings saved securely`);
  }

  // ── Test SMTP Connection (server-side handshake, no email sent) ──────────────
  async function testSmtpConnection() {
    const s = local.settings;
    if (!s["host"] || !s["username"]) {
      toast.error("Host and Username are required to test the SMTP connection.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      if (s["password"]?.trim()) {
        const { error: secretError } = await supabase.functions.invoke("save-provider-secret", {
          body: {
            branchId: local.branchId,
            providerType: local.providerType,
            secretData: { password: s["password"], username: s["username"] },
          },
        });
        if (secretError) {
          throw new Error(await extractEdgeFunctionError(secretError, "Secret storage failed."));
        }
      }
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          verifyOnly: true,
          branchId: local.branchId,
        },
      });
      if (error) {
        const msg = await extractEdgeFunctionError(error, "SMTP connection failed.");
        throw new Error(msg);
      }
      if (data?.success) {
        const msg = data.message || "Connected & authenticated successfully.";
        setTestResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = data?.error || "SMTP connection failed.";
        setTestResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, message: msg });
      toast.error(`Connection failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  // ── Send Test Email through this provider (uses current, unsaved settings) ───
  async function sendTestEmail() {
    if (!testRecipient || !testRecipient.includes("@")) {
      toast.error("Enter a recipient email address to send the test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      if (local.providerType === "email_smtp") {
        // Route straight to the dedicated SMTP test backend so unsaved edits in
        // `local.settings` can be tested before Save, with the exact backend
        // error surfaced instead of a generic Edge Function failure message.
        const s = local.settings;
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: {
            to: testRecipient.trim(),
            branchId: local.branchId,
          },
        });
        if (error) {
          const msg = await extractEdgeFunctionError(error, "Failed to send test email.");
          throw new Error(msg);
        }
        if (data?.success) {
          const msg = `Test email sent to ${testRecipient.trim()}.`;
          setTestResult({ ok: true, message: msg });
          toast.success(msg);
        } else {
          const msg = data?.error || "Failed to send test email.";
          setTestResult({ ok: false, message: msg });
          toast.error(msg);
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testRecipient.trim(),
          branchId: local.branchId,
          subject: "AVS ERP - Test Email",
          htmlBody:
            "<div style='font-family:sans-serif'><h2>AVS ERP</h2><p>This is a <strong>test email</strong> sent from Settings → Communications.</p></div>",
          textBody: "AVS ERP - Test email from Communications settings.",
        },
      });
      if (error) {
        const msg = await extractEdgeFunctionError(error, "Failed to send test email.");
        throw new Error(msg);
      }
      if (data?.success) {
        const msg = `Test email sent to ${testRecipient.trim()}.`;
        setTestResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = data?.error || "Failed to send test email.";
        setTestResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, message: msg });
      toast.error(`Send failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  async function sendTestWhatsApp() {
    const to = (testRecipient || "").replace(/\D/g, "");
    if (!to) {
      toast.error("Enter a recipient phone number (with country code) to send the test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const secretData = Object.fromEntries(
        Object.entries(local.settings).filter(
          ([key, value]) =>
            ["access_token", "api_key", "password", "webhook_verify_token"].includes(key) &&
            String(value).trim(),
        ),
      );
      if (Object.keys(secretData).length > 0) {
        const { error: secretError } = await supabase.functions.invoke("save-provider-secret", {
          body: {
            branchId: local.branchId,
            providerType: local.providerType,
            secretData,
          },
        });
        if (secretError) {
          throw new Error(await extractEdgeFunctionError(secretError, "Secret storage failed."));
        }
      }
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          branchId: local.branchId,
          phone: to,
          message: "AVS ERP test message from Communications settings.",
        },
      });
      if (error) {
        const msg = await extractEdgeFunctionError(error, "Test message failed.");
        setTestResult({ ok: false, message: msg });
        toast.error(`Test message failed: ${msg}`);
      } else if (data?.ok) {
        const msg = `Test message queued to ${to}.`;
        setTestResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = data?.error || "Test message failed.";
        setTestResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, message: msg });
      toast.error(`Send failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  async function testCloudApi() {
    setTesting(true);
    setTestResult(null);
    try {
      const secretData = Object.fromEntries(
        Object.entries(local.settings).filter(
          ([key, value]) => key === "access_token" && String(value).trim(),
        ),
      );
      if (Object.keys(secretData).length > 0) {
        const { error: secretError } = await supabase.functions.invoke("save-provider-secret", {
          body: {
            branchId: local.branchId,
            providerType: local.providerType,
            secretData,
          },
        });
        if (secretError) {
          throw new Error(await extractEdgeFunctionError(secretError, "Secret storage failed."));
        }
      }
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { branchId: local.branchId, verifyOnly: true },
      });
      if (error) {
        const msg = await extractEdgeFunctionError(error, "Connection test failed.");
        setTestResult({ ok: false, message: msg });
        toast.error(`Connection failed: ${msg}`);
      } else if (data?.ok) {
        const msg = data.message || "Connected successfully.";
        setTestResult({ ok: true, message: msg });
        toast.success(msg);
      } else {
        const msg = data?.error || "Connection test failed.";
        setTestResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className={`rounded-md border p-4 space-y-4 ${config.isActive ? "border-gold/30 bg-gold/5" : "border-border bg-muted/10 opacity-60"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
            P{index + 1}
          </div>
          <span className="text-sm font-semibold">{PROVIDER_LABELS[config.providerType]}</span>
          {config.providerType === "whatsapp_cloud_api" && (
            <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              Official API
            </Badge>
          )}
          {config.providerType === "whatsapp_deep_link" && (
            <Badge variant="outline" className="text-[9px]">
              Free · Manual
            </Badge>
          )}
          {config.providerType === "whatsapp_wasender" && (
            <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              Native API · Encrypted
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              checked={local.isActive}
              onCheckedChange={(v) => {
                const updated = { ...local, isActive: v };
                setLocal(updated);
                onUpdate(updated);
              }}
            />
            {local.isActive ? "Active" : "Inactive"}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Priority:</span>
        <Input
          type="number"
          min={0}
          value={local.priority}
          onChange={(e) => setLocal((c) => ({ ...c, priority: parseInt(e.target.value) || 0 }))}
          className="h-7 w-16 text-xs font-mono"
        />
        <span className="text-[10px]">0 = try first; higher = fallback</span>
      </div>

      {/* Provider-specific settings */}
      {fields.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {f.label}
              </Label>
              <Input
                type={f.type ?? "text"}
                value={local.settings[f.key] ?? ""}
                onChange={(e) => updateSetting(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="h-8 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && config.providerType === "whatsapp_wasender" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground space-y-2">
          <p>
            WasenderAPI is a native WhatsApp provider. Its Bearer token is stored{" "}
            <strong>encrypted in the desktop app</strong> (never here), and sessions/QR are managed
            on its own page.
          </p>
          <Link to="/settings" search={{ tab: "whatsapp", waSection: "wasender" }}>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              Configure WasenderAPI <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {fields.length === 0 && config.providerType === "whatsapp_deep_link" && (
        <p className="text-xs text-muted-foreground">
          No configuration needed — uses device WhatsApp app.
        </p>
      )}

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg p-2 text-xs ${testResult.ok ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}
        >
          {testResult.ok ? (
            <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          )}
          {testResult.message}
        </div>
      )}

      {/* Test recipient input (email providers + WhatsApp Cloud API) */}
      {(isEmail || isCloudApi) && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-1">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {isEmail ? "Send test to (email)" : "Send test to (phone, with country code)"}
            </Label>
            <Input
              type={isEmail ? "email" : "tel"}
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={isEmail ? "you@example.com" : "9198XXXXXXXX"}
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end flex-wrap">
        {isServerEmail && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={testSmtpConnection}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <TestTube className="h-3 w-3" />
            )}
            {testing ? "Testing…" : "Test SMTP Connection"}
          </Button>
        )}
        {isEmail && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={sendTestEmail}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Send Test Email
          </Button>
        )}
        {isCloudApi && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={testCloudApi}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <TestTube className="h-3 w-3" />
              )}
              {testing ? "Testing…" : "Test Connection"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={sendTestWhatsApp}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send Test Message
            </Button>
          </>
        )}
        {hasChanges && (
          <Button
            size="sm"
            className="bg-gold text-black hover:bg-gold/90 h-8 gap-1.5"
            onClick={save}
          >
            <Check className="h-3.5 w-3.5" /> Save Changes
          </Button>
        )}
      </div>
    </div>
  );
}

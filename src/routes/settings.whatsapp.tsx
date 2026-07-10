/**
 * Settings → WhatsApp
 * Full WhatsApp Business API configuration, template mappings, and automation toggles.
 * All credentials are stored in branch_settings.wa_config in Supabase — never in frontend code.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useWaAutomation,
  WA_AUTOMATION_LABELS,
  type WaAutomationKey,
  type WaConfig,
  WA_CONFIG_DEFAULTS,
} from "@/lib/wa-automation-store";
import { useCurrentBranchId, useBranch } from "@/lib/branch-store";
import { Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  Save,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp Settings · AVS Gold ERP" }] }),
  component: WhatsAppSettingsPage,
});

const PROVIDER_OPTIONS = [
  { value: "whatsapp_deep_link", label: "WhatsApp Deep Link (free, manual send)" },
  { value: "whatsapp_cloud_api", label: "Meta WhatsApp Cloud API (official)" },
  { value: "whatsapp_interakt", label: "Interakt BSP" },
  { value: "whatsapp_wati", label: "WATI BSP" },
  { value: "whatsapp_aisensy", label: "AiSensy BSP" },
  { value: "whatsapp_gupshup", label: "Gupshup BSP" },
] as const;

const TEMPLATE_FIELDS: { key: keyof WaConfig; label: string; placeholder: string }[] = [
  { key: "templateOrderConfirm", label: "Order Confirmation", placeholder: "order_confirmation" },
  { key: "templateOrderReady", label: "Order Ready for Pickup", placeholder: "order_ready_pickup" },
  { key: "templateInvoice", label: "Invoice Notification", placeholder: "invoice_notification" },
  { key: "templateReceipt", label: "Payment Receipt", placeholder: "payment_receipt" },
  { key: "templatePaymentReminder", label: "Payment Reminder", placeholder: "payment_reminder" },
  { key: "templateRepairReady", label: "Repair Ready", placeholder: "repair_ready" },
  { key: "templateMfgBill", label: "Manufacturing Bill", placeholder: "manufacturing_bill" },
  { key: "templateGoldIssue", label: "Gold Issue Alert", placeholder: "gold_issue_alert" },
  { key: "templateBirthday", label: "Birthday Wishes", placeholder: "birthday_wishes" },
  { key: "templateFestival", label: "Festival Greetings", placeholder: "festival_greetings" },
];

const AUTOMATION_GROUPS: { title: string; keys: WaAutomationKey[] }[] = [
  {
    title: "Order & Sales",
    keys: ["orderConfirmation", "orderReady", "invoiceGenerated", "paymentReceived"],
  },
  {
    title: "Workshop & Manufacturing",
    keys: ["manufacturingComplete", "goldDueReminder", "repairReady"],
  },
  {
    title: "Reminders",
    keys: ["outstandingReminder", "deliveryReminder"],
  },
  {
    title: "Relationship",
    keys: ["birthdayWishes", "festivalGreetings", "anniversaryWishes"],
  },
];

function WhatsAppSettingsPage() {
  const branchId = useCurrentBranchId();
  const accessible = useBranch(useShallow((s) => s.getAccessibleBranches()));
  const [selectedBranch, setSelectedBranch] = useState(branchId);

  const waStore = useWaAutomation();
  const cfg = waStore.getConfig(selectedBranch);
  const automations = waStore.getAutomations(selectedBranch);
  // Raw (unmerged) per-branch config — stable until an actual store write
  // (hydration/save/test), unlike getConfig()'s always-fresh merged object.
  // Used only to detect "the store changed under us", not read directly.
  const storedBranchCfg = useWaAutomation((s) => s.configsByBranch[selectedBranch]);

  const [local, setLocal] = useState<WaConfig>(cfg);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Resync the draft when the branch's real config lands from Supabase
  // (hydrateWaStore runs after pullBranchSettings, asynchronously, and can
  // finish after this page has already mounted and snapshotted `cfg` into
  // `local`) — without this, Save could silently overwrite live WhatsApp
  // Business API credentials with empty defaults.
  useEffect(() => {
    setLocal(waStore.getConfig(selectedBranch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, storedBranchCfg]);

  function set(partial: Partial<WaConfig>) {
    setLocal((p) => ({ ...p, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      waStore.setConfig(selectedBranch, local);
      await waStore.saveToDb(selectedBranch);
      toast.success("WhatsApp configuration saved.");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    // Save current local values first so testConnection reads them
    waStore.setConfig(selectedBranch, local);
    const result = await waStore.testConnection(selectedBranch);
    setTestResult(result);
    setTesting(false);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  const isCloudApi = local.providerType === "whatsapp_cloud_api";
  const isBsp = [
    "whatsapp_interakt",
    "whatsapp_wati",
    "whatsapp_aisensy",
    "whatsapp_gupshup",
  ].includes(local.providerType);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="WhatsApp Configuration"
        subtitle="Advanced: template ID mapping, per-event automation toggles. For Email/SMS/other channels, or the basic provider connection, see Settings → Communications."
      />
      <div className="text-xs text-muted-foreground">
        <Link to="/settings/communications" className="text-gold underline">
          ← Back to Communications Settings
        </Link>
      </div>

      {/* Branch Selector */}
      {accessible.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
            Branch
          </Label>
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              setLocal(waStore.getConfig(v));
              setTestResult(null);
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

      <Tabs defaultValue="connection">
        <TabsList className="mb-6">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="templates">Template Mapping</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        {/* ── Connection Tab ─────────────────────────────────────────────── */}
        <TabsContent value="connection" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" />
                <h3 className="font-bold text-sm">Provider Configuration</h3>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Enable WhatsApp</Label>
                <Switch checked={local.enabled} onCheckedChange={(v) => set({ enabled: v })} />
                <Badge variant={local.enabled ? "default" : "secondary"} className="text-[10px]">
                  {local.enabled ? "Active" : "Disabled"}
                </Badge>
              </div>
            </div>

            {/* Provider select */}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Provider
              </Label>
              <Select
                value={local.providerType}
                onValueChange={(v) => set({ providerType: v as WaConfig["providerType"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {local.providerType === "whatsapp_deep_link" && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Deep-link mode opens WhatsApp with a pre-filled message. Free, no API setup
                  required. Switch to "Meta WhatsApp Cloud API" when you have a Business account.
                </p>
              )}
            </div>

            {/* Meta Cloud API fields */}
            {isCloudApi && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Phone Number ID"
                  placeholder="1234567890"
                  value={local.phoneNumberId}
                  onChange={(v) => set({ phoneNumberId: v })}
                />
                <Field
                  label="Access Token"
                  placeholder="EAABxxxxxx…"
                  value={local.accessToken}
                  onChange={(v) => set({ accessToken: v })}
                  type="password"
                />
                <Field
                  label="Business Account ID"
                  placeholder="9876543210"
                  value={local.businessAccountId}
                  onChange={(v) => set({ businessAccountId: v })}
                />
                <Field
                  label="API Version"
                  placeholder="v19.0"
                  value={local.apiVersion}
                  onChange={(v) => set({ apiVersion: v })}
                />
                <Field
                  label="API Base URL"
                  placeholder="https://graph.facebook.com"
                  value={local.apiBaseUrl}
                  onChange={(v) => set({ apiBaseUrl: v })}
                />
                <Field
                  label="Webhook Verify Token"
                  placeholder="my_secure_verify_token"
                  value={local.webhookVerifyToken}
                  onChange={(v) => set({ webhookVerifyToken: v })}
                />
                <Field
                  label="Webhook Secret"
                  placeholder="••••••••"
                  value={local.webhookSecret}
                  onChange={(v) => set({ webhookSecret: v })}
                  type="password"
                />
                <Field
                  label="Sender Display Name"
                  placeholder="MTJ Jewellers"
                  value={local.senderDisplayName}
                  onChange={(v) => set({ senderDisplayName: v })}
                />
              </div>
            )}

            {/* BSP fields */}
            {isBsp && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="API Key"
                  placeholder="••••••••"
                  value={local.accessToken}
                  onChange={(v) => set({ accessToken: v })}
                  type="password"
                />
                <Field
                  label="API Base URL (optional)"
                  placeholder="Leave blank for default"
                  value={local.apiBaseUrl}
                  onChange={(v) => set({ apiBaseUrl: v })}
                />
                <Field
                  label="Sender Phone Number"
                  placeholder="91XXXXXXXXXX"
                  value={local.phoneNumberId}
                  onChange={(v) => set({ phoneNumberId: v })}
                />
                <Field
                  label="Sender Display Name"
                  placeholder="MTJ Jewellers"
                  value={local.senderDisplayName}
                  onChange={(v) => set({ senderDisplayName: v })}
                />
              </div>
            )}

            <Field
              label="Default Country Code"
              placeholder="91"
              value={local.defaultCountryCode}
              onChange={(v) => set({ defaultCountryCode: v })}
              hint="Prepended to 10-digit phone numbers (91 for India)"
            />

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                  testResult.ok
                    ? "bg-success/10 border border-success/30 text-success"
                    : "bg-destructive/10 border border-destructive/30 text-destructive"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {isCloudApi && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                  className="gap-1.5"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5" />
                  )}
                  {testing ? "Testing…" : "Test Connection"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="ml-auto bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Configuration"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Template Mapping Tab ────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div>
              <h3 className="font-bold text-sm mb-1">Approved Template Names</h3>
              <p className="text-xs text-muted-foreground">
                Map each workflow to your Meta-approved template name. These must exactly match
                names approved in WhatsApp Business Manager. Leave blank to fall back to the text
                message body.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {TEMPLATE_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={String(local[f.key] ?? "")}
                  onChange={(v) => set({ [f.key]: v } as any)}
                />
              ))}
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Template Mapping"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Available template variables:</p>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {[
                "{{customerName}}",
                "{{orderNo}}",
                "{{invoiceNo}}",
                "{{mfgBillNo}}",
                "{{goldWeightGrams}}",
                "{{dueAmountRupees}}",
                "{{deliveryDate}}",
                "{{branchName}}",
                "{{shopPhone}}",
                "{{shopAddress}}",
              ].map((v) => (
                <code key={v} className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[11px]">
                  {v}
                </code>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Advanced Tab ────────────────────────────────────────────────── */}
        <TabsContent value="advanced" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <h3 className="font-bold text-sm">Rate Limiting & Reliability</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Rate Limit (messages/min)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={local.rateLimitPerMinute}
                  onChange={(e) => set({ rateLimitPerMinute: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Retry Count
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={local.retryCount}
                  onChange={(e) => set({ retryCount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Timeout (ms)
                </Label>
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  value={local.timeoutMs}
                  onChange={(e) => set({ timeoutMs: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Advanced Settings"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Automations Tab ─────────────────────────────────────────────── */}
        <TabsContent value="automations" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="font-bold text-sm mb-1">Automation Triggers</h3>
              <p className="text-xs text-muted-foreground">
                Enable WhatsApp messages to be sent automatically when workflow events occur.
                Requires an API provider (not deep-link) for true automation.
              </p>
            </div>

            {AUTOMATION_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                  {group.title}
                </h4>
                <div className="space-y-2.5">
                  {group.keys.map((key) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-medium">{WA_AUTOMATION_LABELS[key]}</p>
                        {local.providerType === "whatsapp_deep_link" && automations[key] && (
                          <p className="text-[10px] text-amber-400">
                            Deep-link mode: user must confirm send manually
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={automations[key]}
                        onCheckedChange={(v) => {
                          waStore.setAutomation(selectedBranch, key, v);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Button
                size="sm"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await waStore.saveToDb(selectedBranch);
                    toast.success("Automation settings saved.");
                  } catch (e: any) {
                    toast.error("Save failed: " + e.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving…" : "Save Automations"}
              </Button>
            </div>
          </div>

          {local.providerType === "whatsapp_deep_link" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-300 space-y-1">
              <p className="font-semibold">Note: Deep-link provider selected</p>
              <p>
                Automations with deep-link open WhatsApp with a pre-filled message — the user must
                tap Send manually. For fully automated sends, configure the Meta WhatsApp Cloud API
                or a BSP provider in the Connection tab.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
